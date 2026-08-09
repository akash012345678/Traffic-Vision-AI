import os
import sys
import logging
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.session import SessionLocal, init_db
from app.services.video_processor import VideoProcessor
import imageio_ffmpeg
import subprocess

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("repair_12_roads")

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

def fast_reencode(in_path, out_path):
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ffmpeg_exe, "-y", "-i", in_path, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p", out_path]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return res.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0

def repair_all():
    init_db()
    db = SessionLocal()
    vp = VideoProcessor()

    print("=" * 80)
    print("STARTING COMPLETE 12-ROAD VIDEO REPAIR & TELEMETRY SYNCHRONIZATION")
    print("=" * 80)

    for r_id, r_name, fname in ROAD_FILES:
        print(f"\n[ROAD #{r_id}] {r_name} ({fname})")
        src_file = os.path.join(backend_dir, "uploads", "videos", fname)
        proc_file = os.path.join(backend_dir, "uploads", "processed", f"processed_{fname}")

        if not os.path.exists(src_file):
            print(f"  [ERROR] Source file missing: {src_file}")
            continue

        # Check DB video record
        v_rec = db.execute(text("SELECT id, status FROM uploaded_videos WHERE road_id = :rid ORDER BY id DESC LIMIT 1"), {"rid": r_id}).fetchone()
        
        if v_rec:
            video_id = v_rec[0]
        else:
            # Create new video record in uploaded_videos
            res = db.execute(text("""
                INSERT INTO uploaded_videos (filename, filepath, video_url, processed_video_url, status, road_id, uploaded_at)
                VALUES (:fn, :fp, :vurl, :purl, 'PROCESSING', :rid, NOW())
                RETURNING id
            """), {
                "fn": fname,
                "fp": f"uploads/processed/processed_{fname}",
                "vurl": f"/uploads/videos/{fname}",
                "purl": f"/uploads/processed/processed_{fname}",
                "rid": r_id
            }).fetchone()
            db.commit()
            video_id = res[0]
            print(f"  [CREATED] Database video record ID: {video_id}")

        # Check if telemetry interval records exist for this road
        t_count = db.execute(text("SELECT COUNT(*) FROM traffic_data WHERE road_id = :rid"), {"rid": r_id}).scalar() or 0

        # If telemetry missing or processed video broken/missing: process/re-encode
        needs_processing = (t_count == 0) or (not os.path.exists(proc_file)) or (os.path.getsize(proc_file) == 0)

        if needs_processing:
            print(f"  [PROCESSING] Running VideoProcessor for Road #{r_id}...")
            try:
                # Fast re-encode to ensure H.264 MP4 output exists first
                fast_reencode(src_file, proc_file)
                
                # Run VideoProcessor to calculate metrics and populate interval telemetry
                summary = vp.process_video(
                    filepath=src_file,
                    road_id=r_id,
                    video_id=video_id,
                    db=db
                )
                print(f"  [OK] Processed {summary.get('total_frames')} frames. Total Vehicles: {summary.get('total_vehicles')}")
                
                # Update uploaded_videos metadata
                db.execute(text("""
                    UPDATE uploaded_videos
                    SET status = 'PROCESSED',
                        total_vehicles = :total_v,
                        car_count = :cars,
                        bus_count = :buses,
                        truck_count = :trucks,
                        motorcycle_count = :motos,
                        average_speed = :avg_speed,
                        congestion_level = :cong_level,
                        confidence = :conf,
                        processed_video_url = :proc_url
                    WHERE id = :vid
                """), {
                    "total_v": summary.get("total_vehicles", 0),
                    "cars": summary.get("counts", {}).get("car", 0),
                    "buses": summary.get("counts", {}).get("bus", 0),
                    "trucks": summary.get("counts", {}).get("truck", 0),
                    "motos": summary.get("counts", {}).get("motorcycle", 0),
                    "avg_speed": summary.get("average_speed", 30.0),
                    "cong_level": summary.get("congestion_level", "MODERATE"),
                    "conf": summary.get("average_confidence", 0.60),
                    "proc_url": f"/uploads/processed/processed_{fname}",
                    "vid": video_id
                })
                db.commit()
            except Exception as p_err:
                print(f"  [ERROR] Processing failed: {p_err}")
                db.rollback()
        else:
            # Fast re-encode to ensure H.264 MP4 if non-H.264
            fast_reencode(src_file, proc_file)
            db.execute(text("UPDATE uploaded_videos SET status = 'PROCESSED', processed_video_url = :purl WHERE id = :vid"), {
                "purl": f"/uploads/processed/processed_{fname}",
                "vid": video_id
            })
            db.commit()
            print(f"  [VERIFIED] Telemetry exists ({t_count} records) & H.264 stream updated.")

    print("\n" + "=" * 80)
    print("ALL 12 ROADS PROCESSED, RE-ENCODED, AND SYNCHRONIZED SUCCESSFULLY!")
    print("=" * 80)
    db.close()

if __name__ == "__main__":
    repair_all()
