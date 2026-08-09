import os
import sys
import time
import cv2
import imageio_ffmpeg
import subprocess
from datetime import datetime, timezone
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.session import SessionLocal, init_db
from app.services.ai_processor import AIProcessor
from app.models.models import UploadedVideo, TrafficData

ROAD_ID = 6
ROAD_NAME = "42nd Street Express"
FILENAME = "42nd Street Express.mp4"

TEST_TIMESTAMPS = [
    (10.0, "00:10"),
    (18.0, "00:18"),
    (30.0, "00:30"),
    (60.0, "01:00"),
    (120.0, "02:00"),
    (240.0, "04:00"),
    (360.0, "06:00"),
    (480.0, "08:00")
]

def reprocess_rd006():
    init_db()
    db = SessionLocal()

    src_video = os.path.join(backend_dir, "uploads", "videos", FILENAME)
    proc_video = os.path.join(backend_dir, "uploads", "processed", f"processed_{FILENAME}")
    debug_video = os.path.join(backend_dir, "uploads", "processed", f"debug_{FILENAME}")

    if not os.path.exists(src_video):
        print(f"[ERROR] Source video missing: {src_video}")
        return

    print("=" * 110)
    print(f" REPROCESSING & BENCHMARKING: {ROAD_NAME.upper()} (ROAD #{ROAD_ID})")
    print("=" * 110)

    ai = AIProcessor()
    cap = cv2.VideoCapture(src_video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1000
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
    duration = round(total_frames / fps, 1)

    print(f"Video Properties: {w}x{h} @ {fps:.2f} fps | Total Frames: {total_frames} | Duration: {duration}s")

    # Set up video writer for debug output overlay video
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(debug_video, fourcc, fps, (w, h))

    # Fetch database record
    v_rec = db.query(UploadedVideo).filter(UploadedVideo.road_id == ROAD_ID).order_by(UploadedVideo.id.desc()).first()
    if not v_rec:
        v_rec = UploadedVideo(
            filename=FILENAME,
            filepath=f"uploads/processed/processed_{FILENAME}",
            file_size_bytes=os.path.getsize(src_video),
            mime_type="video/mp4",
            road_name=ROAD_NAME,
            total_frames=total_frames,
            fps=fps,
            duration_seconds=duration,
            resolution=f"{w}x{h}",
            status="PROCESSED",
            road_id=ROAD_ID,
            uploaded_at=datetime.now(timezone.utc)
        )
        db.add(v_rec)
        db.commit()
        db.refresh(v_rec)

    video_id = v_rec.id

    # Delete previous telemetry
    db.query(TrafficData).filter(TrafficData.road_id == ROAD_ID).delete()
    db.commit()

    frame_idx = 0
    second_acc = {}
    records_to_insert = []
    benchmark_results = {}

    t_start_proc = time.time()

    print("\nProcessing 1-second interval frames with ByteTrack & Road ROI filtering...")

    frame_step = int(round(fps))

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        
        # Process 1 frame per second for optimal throughput & precise 1-sec telemetry
        if frame_idx % frame_step != 1 and frame_idx != 1:
            continue

        curr_sec = float(round(frame_idx / fps, 1))
        sec_key = int(round(curr_sec))

        # Process frame with AIProcessor
        result = ai.process_frame(frame, frame_id=frame_idx, road_id=ROAD_ID, draw_debug_overlay=True)

        # Write frame to debug overlay video
        out.write(frame)

        # Record telemetry for this second
        second_acc[sec_key] = {
            "count": 1,
            "total_v": [result["detected_vehicles"]],
            "cars": [result["counts"]["car"]],
            "buses": [result["counts"]["bus"]],
            "trucks": [result["counts"]["truck"]],
            "motos": [result["counts"]["motorcycle"]],
            "speed": [result["average_speed"]],
            "score": [result["congestion_score"]],
            "conf": [result["confidence"]],
            "level": result["congestion_level"]
        }

        # Check if frame matches test timestamps for benchmark logging
        for test_sec, label in TEST_TIMESTAMPS:
            if abs(curr_sec - test_sec) <= 2.0 and label not in benchmark_results:
                benchmark_results[label] = {
                    "sec": curr_sec,
                    "total": result["detected_vehicles"],
                    "cars": result["counts"]["car"],
                    "motos": result["counts"]["motorcycle"],
                    "buses": result["counts"]["bus"],
                    "trucks": result["counts"]["truck"],
                    "speed": result["average_speed"],
                    "score": result["congestion_score"],
                    "level": result["congestion_level"],
                    "conf": result["confidence"]
                }

        if frame_idx % 250 == 0:
            print(f"  Processed {frame_idx}/{total_frames} frames ({round(frame_idx/total_frames*100, 1)}%)...")

    cap.release()
    out.release()
    t_end_proc = time.time()
    print(f"\nCompleted AI frame processing in {round(t_end_proc - t_start_proc, 1)}s.")

    # Re-encode debug video to H.264 MP4
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"Re-encoding debug video to H.264 MP4: {proc_video}")
    cmd = [ffmpeg_exe, "-y", "-i", debug_video, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p", proc_video]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Save 1-second interval time-series records to database
    for sec_idx, acc in sorted(second_acc.items()):
        if acc["count"] == 0:
            continue
        avg_cars = int(round(sum(acc["cars"]) / acc["count"]))
        avg_motos = int(round(sum(acc["motos"]) / acc["count"]))
        avg_buses = int(round(sum(acc["buses"]) / acc["count"]))
        avg_trucks = int(round(sum(acc["trucks"]) / acc["count"]))
        tot_v = avg_cars + avg_motos + avg_buses + avg_trucks
        avg_sp = round(sum(acc["speed"]) / acc["count"], 1)
        avg_sc = round(sum(acc["score"]) / acc["count"], 2)
        avg_conf = round(sum(acc["conf"]) / acc["count"], 3)

        records_to_insert.append(TrafficData(
            road_id=ROAD_ID,
            video_id=video_id,
            video_name=FILENAME,
            video_timestamp=float(sec_idx),
            vehicle_count=tot_v,
            car_count=avg_cars,
            bus_count=avg_buses,
            truck_count=avg_trucks,
            motorcycle_count=avg_motos,
            average_speed=avg_sp,
            congestion_level=acc["level"],
            confidence=avg_conf,
            processed_at=datetime.now(timezone.utc)
        ))

    db.add_all(records_to_insert)
    db.commit()

    # Update UploadedVideo summary metadata
    v_rec.status = "PROCESSED"
    v_rec.processed_video_url = f"/uploads/processed/processed_{FILENAME}"
    db.commit()

    print("\n" + "=" * 110)
    print(f" BENCHMARK RESULTS FOR 42ND STREET EXPRESS (RD-006)")
    print("=" * 110)
    print(f"{'Time':<8} | {'Sec':<5} | {'Total':<6} | {'Cars':<5} | {'Motos':<6} | {'Buses':<6} | {'Trucks':<7} | {'Avg Speed':<10} | {'Score %':<8} | {'Congestion Level':<16} | {'Math Check'}")
    print("-" * 110)

    for test_sec, label in TEST_TIMESTAMPS:
        res = benchmark_results.get(label)
        if res:
            math_ok = "PASS" if res["total"] == (res["cars"] + res["motos"] + res["buses"] + res["trucks"]) else "FAIL"
            speed_str = f"{res['speed']} km/h"
            score_str = f"{res['score']}%"
            print(f"{label:<8} | {test_sec:<5.1f} | {res['total']:<6} | {res['cars']:<5} | {res['motos']:<6} | {res['buses']:<6} | {res['trucks']:<7} | {speed_str:<10} | {score_str:<8} | {res['level']:<16} | {math_ok}")
        else:
            print(f"{label:<8} | {test_sec:<5.1f} | N/A")
    print("=" * 110)
    db.close()

if __name__ == "__main__":
    reprocess_rd006()
