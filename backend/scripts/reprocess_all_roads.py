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
logger = logging.getLogger("reprocess_all")

def reprocess_road(road_id, filename):
    init_db()
    db = SessionLocal()
    video_file = os.path.join(backend_dir, "uploads", "videos", filename)
    if not os.path.exists(video_file):
        video_file = os.path.join(backend_dir, "uploads", "processed", f"processed_{filename}")

    if not os.path.exists(video_file):
        logger.warning("Video file not found for road_id %d (%s)", road_id, filename)
        db.close()
        return

    logger.info("=" * 60)
    logger.info("REPROCESSING ROAD #%d (%s)", road_id, filename)
    logger.info("=" * 60)

    try:
        # Delete stale telemetry for this road
        db.execute(text("DELETE FROM traffic_data WHERE road_id = :rid"), {"rid": road_id})
        db.commit()

        video_rec = db.execute(text("SELECT id FROM uploaded_videos WHERE road_id = :rid ORDER BY id DESC LIMIT 1"), {"rid": road_id}).fetchone()
        if video_rec:
            video_id = video_rec[0]
        else:
            new_v = db.execute(text("""
                INSERT INTO uploaded_videos (filename, filepath, video_url, processed_video_url, status, road_id, uploaded_at)
                VALUES (:fn, :fp, :vurl, :purl, 'PROCESSING', :rid, NOW())
                RETURNING id
            """), {
                "fn": filename,
                "fp": f"uploads/processed/processed_{filename}",
                "vurl": f"/uploads/videos/{filename}",
                "purl": f"/uploads/processed/processed_{filename}",
                "rid": road_id
            }).fetchone()
            db.commit()
            video_id = new_v[0]

        vp = VideoProcessor()
        summary = vp.process_video(
            filepath=video_file,
            road_id=road_id,
            video_id=video_id,
            db=db
        )

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
            "proc_url": f"/uploads/processed/processed_{filename}",
            "vid": video_id
        })
        db.commit()
        logger.info("Successfully reprocessed road #%d (%s)!", road_id, filename)
    except Exception as e:
        db.rollback()
        logger.error("Failed to reprocess road #%d: %s", road_id, str(e), exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    reprocess_road(2, "Wall Street Junction.mp4")
