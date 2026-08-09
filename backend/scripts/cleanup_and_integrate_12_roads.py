import os
import sys
import time
from datetime import datetime, timezone

# Ensure backend path is in sys.path
backend_dir = r"c:\Users\akash\OneDrive\Desktop\Traffic-Vision-AI (2)\Traffic-Vision-AI\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import cv2
from sqlalchemy import text
from app.database.session import SessionLocal, engine
from app.models.models import Road, UploadedVideo, TrafficData, Alert, OperatorRoadAssignment, User, Zone, Prediction
from app.services.video_processor import VideoProcessor
from app.utils.cache import ttl_cache

def main():
    print("========================================================")
    print("TRAFFICVISION AI - MASTER 12-ROAD INTEGRATION & CLEANUP")
    print("========================================================")

    # ----------------------------------------------------
    # PHASE 1 - DISCOVER THE 12 VIDEOS
    # ----------------------------------------------------
    print("\n--- PHASE 1: DISCOVER THE 12 VIDEOS ---")
    video_dir = os.path.join(backend_dir, "uploads", "videos")
    if not os.path.exists(video_dir):
        raise FileNotFoundError(f"Video directory does not exist: {video_dir}")

    all_files = sorted(os.listdir(video_dir))
    video_files = [f for f in all_files if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))]
    print(f"Total video files discovered: {len(video_files)}")

    discovered_videos = []
    for vf in video_files:
        path = os.path.join(video_dir, vf)
        size = os.path.getsize(path)
        ext = os.path.splitext(vf)[1].lower()

        cap = cv2.VideoCapture(path)
        can_open = cap.isOpened()
        fps = cap.get(cv2.CAP_PROP_FPS) if can_open else 0.0
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) if can_open else 0
        cap.release()

        # Standardize normalized road name from video filename
        name_no_ext = os.path.splitext(vf)[0]
        normalized_name = name_no_ext.replace("_", " ").strip()

        video_info = {
            "filename": vf,
            "path": path,
            "size_bytes": size,
            "size_mb": round(size / (1024 * 1024), 2),
            "format": ext,
            "can_open": can_open,
            "fps": fps,
            "total_frames": frames,
            "normalized_road_name": normalized_name
        }
        discovered_videos.append(video_info)
        print(f" • Video: '{vf}' | Size: {video_info['size_mb']} MB | Format: {ext} | OpenCV Openable: {can_open} | Normalized: '{normalized_name}'")

    if len(discovered_videos) != 12:
        print(f"WARNING: Expected exactly 12 videos, found {len(discovered_videos)}.")

    # ----------------------------------------------------
    # PHASE 2 & 3 - AUDIT CURRENT ROADS & CREATE MAPPING
    # ----------------------------------------------------
    print("\n--- PHASE 2 & 3: AUDIT CURRENT ROADS & CREATE MAPPING ---")
    db = SessionLocal()
    try:
        all_roads = db.query(Road).order_by(Road.id).all()
        print(f"Total roads currently in LIVE database: {len(all_roads)}")

        mapping_results = []
        retained_road_ids = []
        obsolete_road_ids = []

        video_by_name = {v["normalized_road_name"].lower(): v for v in discovered_videos}

        print("\nRoad ID | Road Name | Video Filename | Match Confidence | Status | Action")
        print("-" * 85)
        for r in all_roads:
            r_name_clean = r.road_name.strip().lower()
            matched_vid = None
            
            for v_name, v_info in video_by_name.items():
                if v_name == r_name_clean or v_name in r_name_clean or r_name_clean in v_name:
                    matched_vid = v_info
                    break

            if matched_vid:
                retained_road_ids.append(r.id)
                action = "KEEP"
                conf = "100%"
                status = "MATCHED"
                vid_name = matched_vid["filename"]
            else:
                obsolete_road_ids.append(r.id)
                action = "REMOVE"
                conf = "0%"
                status = "UNMATCHED"
                vid_name = "NONE"

            mapping_results.append({
                "road_id": r.id,
                "road_name": r.road_name,
                "zone": r.zone,
                "operator_id": r.assigned_operator_id,
                "video_info": matched_vid,
                "action": action
            })
            print(f"{r.id:<7} | {r.road_name:<24} | {vid_name:<24} | {conf:<16} | {status:<7} | {action}")

        print(f"\nSummary of Audit:")
        print(f" Retained Roads (Video Available): {len(retained_road_ids)} -> IDs: {retained_road_ids}")
        print(f" Obsolete Roads (To be removed):   {len(obsolete_road_ids)} -> IDs: {obsolete_road_ids}")

        if len(retained_road_ids) != 12:
            raise ValueError(f"Mapping failed! Expected 12 retained roads, found {len(retained_road_ids)}.")

        # ----------------------------------------------------
        # PHASE 4 & 5 - DATABASE SAFETY CHECK & REMOVE EXTRA ROADS
        # ----------------------------------------------------
        print("\n--- PHASE 4 & 5: DATABASE SAFETY CHECK & REMOVE EXTRA ROADS ---")
        print("Starting atomic database transaction for obsolete road removal...")

        try:
            # Clean dependent records exclusively belonging to removed roads
            td_deleted = db.query(TrafficData).filter(TrafficData.road_id.in_(obsolete_road_ids)).delete(synchronize_session=False)
            al_deleted = db.query(Alert).filter(Alert.road_id.in_(obsolete_road_ids)).delete(synchronize_session=False)
            op_deleted = db.query(OperatorRoadAssignment).filter(OperatorRoadAssignment.road_id.in_(obsolete_road_ids)).delete(synchronize_session=False)
            pr_deleted = db.query(Prediction).filter(Prediction.road_id.in_(obsolete_road_ids)).delete(synchronize_session=False)
            uv_deleted = db.query(UploadedVideo).filter(UploadedVideo.road_id.in_(obsolete_road_ids)).delete(synchronize_session=False)
            
            rd_deleted = db.query(Road).filter(Road.id.in_(obsolete_road_ids)).delete(synchronize_session=False)

            db.commit()
            print(f"Transaction Committed Successfully!")
            print(f" Deleted Dependent Records: TrafficData={td_deleted}, Alerts={al_deleted}, Assignments={op_deleted}, Predictions={pr_deleted}, Videos={uv_deleted}")
            print(f" Deleted Obsolete Roads: {rd_deleted}")

        except Exception as delete_err:
            db.rollback()
            print(f"ERROR: Removal transaction failed! Executed ROLLBACK. Reason: {delete_err}")
            raise delete_err

        # ----------------------------------------------------
        # PHASE 6 - VERIFY FINAL ROAD DATABASE
        # ----------------------------------------------------
        print("\n--- PHASE 6: VERIFY FINAL ROAD DATABASE ---")
        final_road_count = db.query(Road).count()
        print(f"SELECT COUNT(*) FROM roads; => {final_road_count}")

        if final_road_count != 12:
            raise ValueError(f"Verification Failed! Expected 12 roads, found {final_road_count}.")

        final_roads = db.query(Road).order_by(Road.id).all()
        print("\nFinal Retained 12 Roads:")
        print("Road ID | Road Name | Zone | Assigned Operator ID")
        print("-" * 75)
        for fr in final_roads:
            print(f"{fr.id:<7} | {fr.road_name:<25} | {fr.zone:<30} | {fr.assigned_operator_id}")

        # ----------------------------------------------------
        # PHASE 7, 8, 9, 10 - REGISTER VIDEOS & RUN AI PIPELINE
        # ----------------------------------------------------
        print("\n--- PHASE 7..10: REGISTER VIDEOS & PROCESS VIA AI PIPELINE ---")
        
        for m in mapping_results:
            if m["action"] != "KEEP" or not m["video_info"]:
                continue

            r_id = m["road_id"]
            r_name = m["road_name"]
            v_info = m["video_info"]
            vf_name = v_info["filename"]
            v_path = v_info["path"]

            print(f"\nProcessing Road ID {r_id} ('{r_name}') with video '{vf_name}'...")

            # 1. Register / Get UploadedVideo entry
            video_rec = db.query(UploadedVideo).filter(UploadedVideo.road_id == r_id, UploadedVideo.filename == vf_name).first()
            if not video_rec:
                video_rec = db.query(UploadedVideo).filter(UploadedVideo.filename == vf_name).first()

            if not video_rec:
                video_rec = UploadedVideo(
                    road_id=r_id,
                    road_name=r_name,
                    filename=vf_name,
                    filepath=v_path,
                    file_size_bytes=v_info["size_bytes"],
                    mime_type="video/mp4",
                    status="Processing",
                    uploaded_at=datetime.now(timezone.utc)
                )
                db.add(video_rec)
                db.commit()
                db.refresh(video_rec)
                print(f" Registered new UploadedVideo record with ID {video_rec.id}")
            else:
                video_rec.road_id = r_id
                video_rec.road_name = r_name
                video_rec.filepath = v_path
                video_rec.status = "Processing"
                db.commit()
                print(f" Updated existing UploadedVideo record ID {video_rec.id}")

            # 2. Run AI Processing Pipeline
            start_t = time.time()
            stats = VideoProcessor.process_video(filepath=v_path, road_id=r_id, db=db)
            proc_duration = time.time() - start_t

            # Update UploadedVideo record
            video_rec.total_frames = stats["total_frames"]
            video_rec.fps = stats["fps"]
            video_rec.duration_seconds = stats["duration_seconds"]
            video_rec.resolution = stats["resolution"]
            video_rec.car_count = stats.get("car_count", 0)
            video_rec.bus_count = stats.get("bus_count", 0)
            video_rec.truck_count = stats.get("truck_count", 0)
            video_rec.motorcycle_count = stats.get("motorcycle_count", 0)
            video_rec.filepath = stats["processed_filepath"]
            video_rec.status = "Processed"

            # Create primary aggregate telemetry entry linked to video_id
            primary_telemetry = TrafficData(
                road_id=r_id,
                video_id=video_rec.id,
                video_name=vf_name,
                vehicle_count=stats["avg_vehicle_count"],
                car_count=stats.get("car_count", 0),
                bus_count=stats.get("bus_count", 0),
                truck_count=stats.get("truck_count", 0),
                motorcycle_count=stats.get("motorcycle_count", 0),
                average_speed=round(60.0 * (1.0 - min(1.0, stats["avg_congestion_score"] / 100.0)), 1),
                congestion_level=stats["overall_congestion_level"].upper(),
                confidence=stats["avg_confidence"],
                timestamp=datetime.now(timezone.utc),
                processed_at=datetime.now(timezone.utc)
            )
            db.add(primary_telemetry)
            db.commit()

            print(f" Finished AI Pipeline in {proc_duration:.1f}s:")
            print(f"   • Total Frames: {stats['total_frames']} | Resolution: {stats['resolution']}")
            print(f"   • Avg Vehicles: {stats['avg_vehicle_count']} (Cars: {stats['car_count']}, Buses: {stats['bus_count']}, Trucks: {stats['truck_count']}, Motorcycles: {stats['motorcycle_count']})")
            print(f"   • Congestion Score: {stats['avg_congestion_score']} | Congestion Level: {stats['overall_congestion_level']}")

        ttl_cache.invalidate()

        # ----------------------------------------------------
        # FINAL AUDIT & SUMMARY REPORT
        # ----------------------------------------------------
        print("\n========================================================")
        print("FINAL ACCEPTANCE AUDIT REPORT")
        print("========================================================")

        final_roads_list = db.query(Road).order_by(Road.id).all()
        print(f"Total videos = {len(discovered_videos)}")
        print(f"Total active roads in DB = {len(final_roads_list)}")

        print("\nRoad Name | Video Filename | Road ID | Status | Telemetry Records | Latest Veh Count | Latest Congestion")
        print("-" * 110)

        report_rows = []
        for r in final_roads_list:
            v_rec = db.query(UploadedVideo).filter(UploadedVideo.road_id == r.id).first()
            td_records = db.query(TrafficData).filter(TrafficData.road_id == r.id).order_by(TrafficData.timestamp.desc()).all()
            latest_td = td_records[0] if td_records else None

            v_filename = v_rec.filename if v_rec else "N/A"
            v_status = v_rec.status if v_rec else "N/A"
            td_cnt = len(td_records)
            latest_veh = latest_td.vehicle_count if latest_td else 0
            latest_cong = latest_td.congestion_level if latest_td else "N/A"

            report_rows.append({
                "road_name": r.road_name,
                "video": v_filename,
                "road_id": r.id,
                "status": v_status,
                "telemetry_count": td_cnt,
                "latest_veh": latest_veh,
                "latest_cong": latest_cong
            })

            print(f"{r.road_name:<25} | {v_filename:<24} | {r.id:<7} | {v_status:<8} | {td_cnt:<17} | {latest_veh:<16} | {latest_cong}")

        print("\n========================================================")
        print("ALL 12 ROADS PROCESSED & VERIFIED SUCCESSFULLY!")
        print("========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    main()
