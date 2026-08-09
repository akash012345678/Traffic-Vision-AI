import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import logging
from sqlalchemy import text
from app.database.session import SessionLocal, init_db
from app.services.video_processor import VideoProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reprocess_fulton")

def reprocess_fulton():
    # Initialize database tables
    init_db()

    db = SessionLocal()
    road_id = 4 # Fulton Transit Corridor
    video_file = os.path.join(backend_dir, "uploads", "videos", "Fulton Transit Corridor.mp4")

    if not os.path.exists(video_file):
        logger.error("Video file does not exist: %s", video_file)
        db.close()
        return

    logger.info("=" * 60)
    logger.info("REPROCESSING FULTON TRANSIT CORRIDOR (ROAD ID 4)")
    logger.info("Video File: %s", video_file)
    logger.info("YOLO Model: YOLOv8s (imgsz=864, conf=0.25)")
    logger.info("=" * 60)

    try:
        # 1. Clean up stale telemetry interval records for Road 4
        db.execute(text("DELETE FROM traffic_data WHERE road_id = 4"))
        db.commit()
        logger.info("Deleted stale traffic_data records for road_id = 4")

        # 2. Query or create video record for Fulton
        video_rec = db.execute(text("SELECT id FROM uploaded_videos WHERE road_id = 4 ORDER BY id DESC LIMIT 1")).fetchone()
        if video_rec:
            video_id = video_rec[0]
        else:
            new_v = db.execute(text("""
                INSERT INTO uploaded_videos (filename, filepath, video_url, processed_video_url, status, road_id, uploaded_at)
                VALUES ('Fulton Transit Corridor.mp4', 'uploads/processed/processed_Fulton Transit Corridor.mp4',
                        '/uploads/videos/Fulton Transit Corridor.mp4', '/uploads/processed/processed_Fulton Transit Corridor.mp4',
                        'PROCESSING', 4, NOW())
                RETURNING id
            """)).fetchone()
            db.commit()
            video_id = new_v[0]

        logger.info("Using video_id = %d for Fulton Transit Corridor", video_id)

        # 3. Process video using upgraded VideoProcessor pipeline
        vp = VideoProcessor()
        summary = vp.process_video(
            filepath=video_file,
            road_id=road_id,
            video_id=video_id,
            db=db
        )

        logger.info("Video Processing Summary: %s", summary)

        # 4. Update uploaded_videos record status to PROCESSED
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
            "proc_url": "/uploads/processed/processed_Fulton Transit Corridor.mp4",
            "vid": video_id
        })
        db.commit()

        logger.info("Successfully updated video record #%d for Fulton Transit Corridor!", video_id)

    except Exception as e:
        db.rollback()
        logger.error("Failed to reprocess Fulton Transit Corridor video: %s", str(e), exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    reprocess_fulton()
