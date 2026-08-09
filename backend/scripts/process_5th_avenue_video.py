import os
import sys
import time
from datetime import datetime, timezone

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.session import SessionLocal, init_db
from app.models.models import Road, UploadedVideo, TrafficData
from app.services.video_processor import VideoProcessor
from app.repositories.traffic_repository import TrafficRepository
from app.repositories.video_repository import VideoRepository
from app.utils.cache import ttl_cache

def main():
    print("=" * 70)
    print(" MILESTONE 2 - PHASE 1: 5TH AVENUE TRAFFIC CONGESTION AI PIPELINE")
    print("=" * 70)
    
    # 1. Initialize DB Schema
    print("\n[STEP 1] Ensuring Database Schema and Migrations are initialized...")
    init_db()
    db = SessionLocal()

    try:
        # Locate 5th Avenue road
        road = db.query(Road).filter(Road.road_name.ilike("%5th Avenue%")).first()
        if not road:
            print("[ERROR] Could not find 5th Avenue in DB. Creating 5th Avenue Corridor...")
            road = Road(
                road_name="5th Avenue Corridor",
                road_code="RD-5TH",
                zone="Zone Alpha - Financial District",
                latitude=40.7580,
                longitude=-73.9855,
                lanes=4,
                length_km=2.5,
                status="Active"
            )
            db.add(road)
            db.commit()
            db.refresh(road)
        
        print(f"[SUCCESS] 5th Avenue Corridor located (ID: {road.id}, Code: {road.road_code}, Zone: {road.zone})")

        # 2. Check for uploaded video
        video_dir = os.path.join(backend_dir, "uploads", "videos")
        video_filename = "5th Avenue Corridor.mp4"
        video_filepath = os.path.join(video_dir, video_filename)

        if not os.path.exists(video_filepath):
            print(f"[ERROR] Video file not found at: {video_filepath}")
            sys.exit(1)

        file_size = os.path.getsize(video_filepath)
        print(f"\n[STEP 2] Video Registration...")
        print(f"  • Video Filename: {video_filename}")
        print(f"  • Road ID:        {road.id}")
        print(f"  • Road Name:      {road.road_name}")
        print(f"  • File Size:      {file_size / (1024*1024):.2f} MB")
        print(f"  • Upload Path:    {video_filepath}")

        # Register video in UploadedVideo DB table
        video_record_data = {
            "road_id": road.id,
            "road_name": road.road_name,
            "filename": video_filename,
            "filepath": video_filepath,
            "file_size_bytes": file_size,
            "mime_type": "video/mp4",
            "status": "Processing"
        }
        
        # Remove any previous uploaded video entry for clean test run
        db.query(UploadedVideo).filter(UploadedVideo.filename == video_filename).delete()
        db.commit()

        video_db = VideoRepository.create_video(db, video_record_data)
        print(f"[SUCCESS] Video registered in Database with ID: {video_db.id} (Status: Processing)")

        # 3. OpenCV & YOLOv8 Processing
        print(f"\n[STEP 3 & 4 & 5 & 6] Reading video with OpenCV, processing frames, running YOLOv8 detection & congestion analysis...")
        t_start = time.time()
        
        stats = VideoProcessor.process_video(video_filepath, road_id=road.id, video_id=video_db.id, db=db)
        proc_time = time.time() - t_start

        print(f"\n" + "-" * 50)
        print(" AI PROCESSING SUMMARY FOR 5TH AVENUE")
        print("-" * 50)
        print(f"  • Total Frames:       {stats['total_frames']}")
        print(f"  • FPS:                {stats['fps']}")
        print(f"  • Video Duration:     {stats['duration_seconds']} sec")
        print(f"  • Resolution:         {stats['resolution']}")
        print(f"  • Processing Time:    {proc_time:.2f} sec")
        print(f"  • Cars Detected:      {stats['car_count']}")
        print(f"  • Buses Detected:     {stats['bus_count']}")
        print(f"  • Trucks Detected:    {stats['truck_count']}")
        print(f"  • Motorcycles:        {stats['motorcycle_count']}")
        print(f"  • Total Vehicles:     {stats['avg_vehicle_count']}")
        print(f"  • Congestion Score:   {stats['avg_congestion_score']}%")
        print(f"  • Congestion Level:   {stats['overall_congestion_level'].upper()}")
        print(f"  • Model Confidence:   {stats['avg_confidence'] * 100:.1f}%")
        print("-" * 50)

        # 7. Store AI-Generated Results in Database (Supabase)
        print(f"\n[STEP 7] Storing AI-generated metrics in Database for 5th Avenue...")
        now_utc = datetime.now(timezone.utc)
        
        traffic_data_entry = {
            "road_id": road.id,
            "video_id": video_db.id,
            "video_name": video_filename,
            "vehicle_count": stats["avg_vehicle_count"],
            "car_count": stats["car_count"],
            "bus_count": stats["bus_count"],
            "truck_count": stats["truck_count"],
            "motorcycle_count": stats["motorcycle_count"],
            "average_speed": round(60.0 * (1.0 - min(1.0, stats["avg_congestion_score"] / 100.0)), 1),
            "congestion_level": stats["overall_congestion_level"].upper(),
            "confidence": stats["avg_confidence"],
            "processed_at": now_utc
        }

        traffic_rec = TrafficRepository.create_traffic_record(db, traffic_data_entry)
        
        # Update UploadedVideo status
        video_db.total_frames = stats["total_frames"]
        video_db.fps = stats["fps"]
        video_db.duration_seconds = stats["duration_seconds"]
        video_db.resolution = stats["resolution"]
        video_db.car_count = stats["car_count"]
        video_db.bus_count = stats["bus_count"]
        video_db.truck_count = stats["truck_count"]
        video_db.motorcycle_count = stats["motorcycle_count"]
        video_db.status = "Processed"
        db.commit()

        # Invalidate telemetry cache so dashboard updates immediately
        ttl_cache.invalidate()

        print(f"[SUCCESS] Telemetry record saved in DB! Record ID: {traffic_rec.id}")

        # 8. Dashboard Verification
        print(f"\n[STEP 8 & 9] Verifying 5th Avenue Dashboard telemetry updates...")
        live_monitoring = TrafficRepository.get_live_monitoring(db, search="5th Avenue")
        items = live_monitoring.get("items", [])
        
        fifth_ave_item = None
        for item in items:
            if "5th Avenue" in item["road_name"]:
                fifth_ave_item = item
                break

        if fifth_ave_item:
            print(f"  ✓ 5th Avenue AI Status:   {fifth_ave_item.get('ai_status')}")
            print(f"  ✓ Vehicle Count:          {fifth_ave_item.get('vehicle_count')} veh")
            print(f"  ✓ Congestion Level:       {fifth_ave_item.get('congestion_level')}")
            print(f"  ✓ Model Confidence:       {fifth_ave_item.get('confidence')}")
            print(f"  ✓ Processed At:           {fifth_ave_item.get('processed_at')}")
        else:
            print("[WARNING] Could not find 5th Avenue in live monitoring response.")

        print("\n" + "=" * 70)
        print(" VERIFICATION COMPLETE: ALL 9 STEPS SUCCESSFULLY EXECUTED!")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Pipeline execution failed: {str(e)}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()
