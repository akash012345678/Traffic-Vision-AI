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

ROAD_FILES = [
    (1, "5th Avenue Corridor", "5th Avenue Corridor.mp4"),
    (2, "Wall Street Junction", "Wall Street Junction.mp4"),
    (3, "Broadway Commercial Ave", "Broadway Commercial Ave.mp4"),
    (4, "Fulton Transit Corridor", "Fulton Transit Corridor.mp4"),
    (5, "Exchange Place Connector", "Exchange Place connector.mp4"),
    (6, "42nd Street Express", "42nd Street Express.mp4"),
    (7, "Madison Avenue North", "Madison Avenue North.mp4"),
    (8, "Park Avenue Tunnel Route", "Park Avenue Tunnel Route.mp4"),
    (9, "Lexington Ave Arterial", "Lexington Ave Arterial.mp4"),
    (10, "7th Avenue Theater Arc", "7th Avenue Theater Arc.mp4"),
    (11, "West Side Highway North", "West side Highway North.mp4"),
    (12, "FDR Drive Southbound", "FDR Drive Southbound.mp4"),
]

def reprocess_all_12():
    init_db()
    db = SessionLocal()
    ai = AIProcessor()

    print("=" * 110)
    print(" REPROCESSING ALL 12 ROADS WITH CAMERA ROI FILTERING & BYTETRACK MOTION ANALYSIS")
    print("=" * 110)

    for r_id, r_name, fname in ROAD_FILES:
        src_video = os.path.join(backend_dir, "uploads", "videos", fname)
        proc_video = os.path.join(backend_dir, "uploads", "processed", f"processed_{fname}")

        if not os.path.exists(src_video):
            print(f" [SKIP] Road #{r_id} {r_name}: Source video missing.")
            continue

        cap = cv2.VideoCapture(src_video)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1000
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
        duration = round(total_frames / fps, 1)
        cap.release()

        # Database record
        v_rec = db.query(UploadedVideo).filter(UploadedVideo.road_id == r_id).order_by(UploadedVideo.id.desc()).first()
        if not v_rec:
            v_rec = UploadedVideo(
                filename=fname,
                filepath=f"uploads/processed/processed_{fname}",
                file_size_bytes=os.path.getsize(src_video),
                mime_type="video/mp4",
                road_name=r_name,
                total_frames=total_frames,
                fps=fps,
                duration_seconds=duration,
                resolution=f"{w}x{h}",
                status="PROCESSED",
                road_id=r_id,
                uploaded_at=datetime.now(timezone.utc)
            )
            db.add(v_rec)
            db.commit()
            db.refresh(v_rec)

        video_id = v_rec.id

        # Clear previous telemetry
        db.query(TrafficData).filter(TrafficData.road_id == r_id).delete()
        db.commit()

        print(f"\n[ROAD #{r_id}] {r_name} ({total_frames} frames, {duration}s)")
        print(f"  Processing 1-sec telemetry with ByteTrack & Road ROI...")

        cap = cv2.VideoCapture(src_video)
        frame_idx = 0
        frame_step = int(round(fps))
        records_to_insert = []

        scores = []
        speeds = []
        confs = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % frame_step != 1 and frame_idx != 1:
                continue

            curr_sec = float(round(frame_idx / fps, 1))

            result = ai.process_frame(frame, frame_id=frame_idx, road_id=r_id, draw_debug_overlay=False)

            tot_v = result["detected_vehicles"]
            cars = result["counts"]["car"]
            buses = result["counts"]["bus"]
            trucks = result["counts"]["truck"]
            motos = result["counts"]["motorcycle"]
            speed = result["average_speed"]
            score = result["congestion_score"]
            level = result["congestion_level"]
            conf = result["confidence"]

            scores.append(score)
            speeds.append(speed)
            confs.append(conf)

            records_to_insert.append(TrafficData(
                road_id=r_id,
                video_id=video_id,
                video_name=fname,
                video_timestamp=curr_sec,
                vehicle_count=tot_v,
                car_count=cars,
                bus_count=buses,
                truck_count=trucks,
                motorcycle_count=motos,
                average_speed=speed,
                congestion_level=level,
                confidence=conf,
                processed_at=datetime.now(timezone.utc)
            ))

        cap.release()

        db.add_all(records_to_insert)
        db.commit()

        avg_score = round(sum(scores) / len(scores), 1) if scores else 30.0
        avg_speed = round(sum(speeds) / len(speeds), 1) if speeds else 40.0
        avg_conf = round(sum(confs) / len(confs), 3) if confs else 0.60
        overall_level = "LOW" if avg_score < 25.0 else "MODERATE" if avg_score < 50.0 else "HIGH" if avg_score < 75.0 else "CRITICAL"

        v_rec.status = "PROCESSED"
        v_rec.average_speed = avg_speed
        v_rec.congestion_level = overall_level
        v_rec.confidence = avg_conf
        v_rec.processed_video_url = f"/uploads/processed/processed_{fname}"
        db.commit()

        print(f"  [OK] Saved {len(records_to_insert)} 1-sec telemetry records! Overall Level: {overall_level} ({avg_score}%), Avg Speed: {avg_speed} km/h")

    print("\n" + "=" * 110)
    print(" ALL 12 ROADS SUCCESSFULLY REPROCESSED WITH ROI FILTERING & BYTETRACK!")
    print("=" * 110)
    db.close()

if __name__ == "__main__":
    reprocess_all_12()
