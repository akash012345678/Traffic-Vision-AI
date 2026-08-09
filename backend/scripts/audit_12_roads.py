import os
import sys
import requests
import cv2
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.session import SessionLocal, init_db

def audit_all_roads():
    init_db()
    db = SessionLocal()
    base_url = "http://localhost:8000/api/v1"

    roads = db.execute(text("SELECT id, road_name, road_code FROM roads ORDER BY id ASC")).fetchall()
    print("=" * 110)
    print(f"{'ID':<3} | {'Code':<7} | {'Road Name':<28} | {'Vid ID':<6} | {'Original Filename':<28} | {'Proc Exists':<11} | {'Size MB':<8} | {'Codec':<6} | {'HTTP':<4} | {'Playable'}")
    print("=" * 110)

    for r in roads:
        r_id, r_name, r_code = r[0], r[1], r[2] or f"RD-{r[0]:03d}"
        
        # Fetch video record for this road
        v_rec = db.execute(text("SELECT id, filename, filepath, processed_video_url, status FROM uploaded_videos WHERE road_id = :rid ORDER BY id DESC LIMIT 1"), {"rid": r_id}).fetchone()
        
        if not v_rec:
            print(f"{r_id:<3} | {r_code:<7} | {r_name:<28} | {'NONE':<6} | {'NO VIDEO RECORD':<28} | {'NO':<11} | {'0.0':<8} | {'N/A':<6} | {'404':<4} | NO")
            continue

        v_id, filename, filepath, proc_url, status = v_rec[0], v_rec[1], v_rec[2], v_rec[3], v_rec[4]

        # Determine physical file path on disk
        proc_disk_path = os.path.join(backend_dir, "uploads", "processed", f"processed_{filename}")
        orig_disk_path = os.path.join(backend_dir, "uploads", "videos", filename)

        file_exists = os.path.exists(proc_disk_path) or os.path.exists(orig_disk_path)
        target_file = proc_disk_path if os.path.exists(proc_disk_path) else orig_disk_path if os.path.exists(orig_disk_path) else None
        
        size_mb = 0.0
        codec = "N/A"
        is_playable = False

        if target_file:
            size_mb = round(os.path.getsize(target_file) / (1024 * 1024), 2)
            cap = cv2.VideoCapture(target_file)
            if cap.isOpened():
                fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC))
                fourcc_hex = hex(fourcc_int)
                codec = "h264" if fourcc_hex == "0x34363268" else "mp4v" if fourcc_hex == "0x34504d46" else fourcc_hex
                frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
                if frames > 0:
                    is_playable = True
            cap.release()

        # Test HTTP streaming endpoint
        http_status = 404
        try:
            stream_res = requests.get(f"{base_url}/videos/{v_id}/stream", headers={"Range": "bytes=0-1023"}, timeout=3)
            http_status = stream_res.status_code
        except Exception:
            http_status = 500

        playable_str = "YES" if (is_playable and http_status in [200, 206] and codec == "h264") else "NO"

        print(f"{r_id:<3} | {r_code:<7} | {r_name:<28} | {v_id:<6} | {filename:<28} | {'YES' if target_file else 'NO':<11} | {size_mb:<8.2f} | {codec:<6} | {http_status:<4} | {playable_str}")

    print("=" * 110)
    db.close()

if __name__ == "__main__":
    audit_all_roads()
