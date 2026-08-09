import cv2
import os
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.config.settings import settings
from app.models.models import Road

logger = logging.getLogger("trafficvision.ai")

class VideoProcessor:
    @staticmethod
    def reencode_to_h264(input_filepath: str) -> str:
        """
        Re-encodes the specified MP4 video file to H.264 (libx264, yuv420p)
        to ensure HTML5 browser compatibility.
        """
        try:
            import imageio_ffmpeg
            import subprocess
            import gc
            import time

            gc.collect()
            time.sleep(0.3)

            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            tmp_output = f"{input_filepath}.h264.mp4"
            cmd = [
                ffmpeg_exe, "-y", "-i", input_filepath,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-pix_fmt", "yuv420p", tmp_output
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0 and os.path.exists(tmp_output) and os.path.getsize(tmp_output) > 0:
                gc.collect()
                time.sleep(0.3)
                replaced = False
                for attempt in range(5):
                    try:
                        if os.path.exists(input_filepath):
                            try:
                                os.remove(input_filepath)
                            except Exception:
                                pass
                        os.replace(tmp_output, input_filepath)
                        replaced = True
                        logger.info("Successfully re-encoded video to H.264: %s", input_filepath)
                        break
                    except Exception:
                        time.sleep(0.5)
                if not replaced and os.path.exists(tmp_output):
                    try:
                        import shutil
                        shutil.copyfile(tmp_output, input_filepath)
                        os.remove(tmp_output)
                        logger.info("Copied re-encoded H.264 video to destination: %s", input_filepath)
                    except Exception as c_err:
                        logger.warning("Could not finalize H.264 replace: %s", str(c_err))
            else:
                if os.path.exists(tmp_output):
                    try:
                        os.remove(tmp_output)
                    except Exception:
                        pass
                logger.warning("FFmpeg re-encoding warning (code %d): %s", res.returncode, res.stderr)
        except Exception as err:
            logger.warning("H.264 re-encoding step failed: %s", str(err))
        return input_filepath

    @staticmethod
    def process_video(
        filepath: str, 
        road_id: Optional[int] = None, 
        video_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Open the video file, query database for road lanes/length,
        run YOLO vehicle detection frame-by-frame, write annotated output video,
        and calculate average congestion metrics.
        Raises ValueError if the video is invalid or corrupted.
        """
        if not os.path.exists(filepath):
            raise ValueError(f"Video file does not exist at: {filepath}")

        # Ensure the file is not empty
        if os.path.getsize(filepath) == 0:
            raise ValueError("Video file is empty (0 bytes).")

        # 1. Fetch road lane and length info if db & road_id are present
        lanes = 4
        length_km = 2.5
        if db is not None and road_id is not None:
            try:
                road = db.query(Road).filter(Road.id == road_id).first()
                if road:
                    lanes = road.lanes or 4
                    length_km = road.length_km or 2.5
                    logger.info("Found road config for ID %d: Lanes=%d, Length=%.2f km", road_id, lanes, length_km)
            except Exception as db_err:
                logger.warning("Could not read road parameters from database: %s. Using defaults.", str(db_err))

        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            raise ValueError("Failed to open video file. The file may be corrupted or in an unsupported format.")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        resolution = f"{width}x{height}"

        # Guard against zero/negative properties
        if fps <= 0 or total_frames <= 0 or width <= 0 or height <= 0:
            cap.release()
            raise ValueError("Invalid video file metadata properties. The video may be corrupted.")

        duration = total_frames / fps
        
        # Display video information
        print("=" * 40)
        print("VIDEO INGESTION PIPELINE PROPERTIES")
        print(f"Total Frames:   {total_frames}")
        print(f"FPS:            {fps:.2f}")
        print(f"Video Duration: {duration:.2f} seconds")
        print(f"Resolution:     {resolution}")
        print("=" * 40)

        logger.info(
            "Video properties loaded: Total Frames=%d, FPS=%.2f, Duration=%.2fs, Resolution=%s",
            total_frames, fps, duration, resolution
        )

        # 2. Setup video writer
        os.makedirs(settings.OUTPUT_FOLDER, exist_ok=True)
        filename = os.path.basename(filepath)
        output_filepath = os.path.join(settings.OUTPUT_FOLDER, f"processed_{filename}")
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_filepath, fourcc, fps, (width, height))
        if not out.isOpened():
            cap.release()
            raise ValueError("Failed to initialize video writer for saving processed output.")

        # 3. Process frame by frame with 1-second interval time-series telemetry persistence
        from app.services.ai_processor import AIProcessor
        from app.repositories.traffic_repository import TrafficRepository
        from app.utils.cache import ttl_cache
        from datetime import datetime, timezone

        ai_processor = AIProcessor()
        
        frame_count = 0
        total_vehicles_sum = 0
        car_sum = 0
        bus_sum = 0
        truck_sum = 0
        motorcycle_sum = 0
        all_confidences = []
        congestion_scores_sum = 0.0

        # Interval tracking (every 1 second = int(fps) frames)
        interval_frames = max(1, int(round(fps)))
        window_veh = 0
        window_car = 0
        window_bus = 0
        window_truck = 0
        window_moto = 0
        window_scores = []
        window_confs = []

        frame_stride = 3
        last_result = None

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Run frame-by-frame vehicle and congestion detection with frame_stride optimization
                if frame_count % frame_stride == 0 or last_result is None:
                    result = ai_processor.process_frame(frame, frame_count, road_id=road_id if road_id else 1)
                    last_result = result
                else:
                    result = last_result
                
                # Write annotated frame
                out.write(frame)
                
                # Aggregate total statistics
                total_vehicles_sum += result["detected_vehicles"]
                counts = result.get("counts", {})
                car_sum += counts.get("car", 0)
                bus_sum += counts.get("bus", 0)
                truck_sum += counts.get("truck", 0)
                motorcycle_sum += counts.get("motorcycle", 0)
                all_confidences.append(result.get("confidence", 0.85))
                congestion_scores_sum += result["congestion_score"]

                # Accumulate window interval metrics
                window_veh += result["detected_vehicles"]
                window_car += counts.get("car", 0)
                window_bus += counts.get("bus", 0)
                window_truck += counts.get("truck", 0)
                window_moto += counts.get("motorcycle", 0)
                window_scores.append(result["congestion_score"])
                window_confs.append(result.get("confidence", 0.85))

                frame_count += 1

                # Every 1-second interval or last frame: save time-series record to DB
                if frame_count % interval_frames == 0 and db is not None and road_id is not None:
                    count_in_window = len(window_scores) or 1
                    iv_car = int(round(window_car / count_in_window))
                    iv_bus = int(round(window_bus / count_in_window))
                    iv_truck = int(round(window_truck / count_in_window))
                    iv_moto = int(round(window_moto / count_in_window))
                    # Enforce strict mathematical equality: total_vehicles == cars + motorcycles + buses + trucks
                    iv_veh = iv_car + iv_bus + iv_truck + iv_moto
                    
                    iv_score = round(sum(window_scores) / count_in_window, 2)
                    iv_conf = round(float(sum(window_confs) / len(window_confs)), 3) if window_confs else 0.0

                    if iv_score < settings.CONGESTION_THRESHOLD_LOW:
                        iv_level = "LOW"
                    elif iv_score < settings.CONGESTION_THRESHOLD_MODERATE:
                        iv_level = "MODERATE"
                    elif iv_score < settings.CONGESTION_THRESHOLD_HIGH:
                        iv_level = "HIGH"
                    else:
                        iv_level = "SEVERE"

                    v_timestamp = round(frame_count / fps, 1)
                    # Speed estimation: drops gracefully from free-flow (60 km/h) down to 5 km/h at heavy congestion
                    road_speed_limit = 60.0
                    avg_speed_est = max(5.0, round(road_speed_limit * (1.0 - min(1.0, iv_score / 100.0) * 0.85), 1))

                    telemetry_interval_entry = {
                        "road_id": road_id,
                        "video_id": video_id,
                        "video_name": filename,
                        "video_timestamp": v_timestamp,
                        "vehicle_count": iv_veh,
                        "car_count": iv_car,
                        "bus_count": iv_bus,
                        "truck_count": iv_truck,
                        "motorcycle_count": iv_moto,
                        "average_speed": avg_speed_est,
                        "congestion_level": iv_level,
                        "confidence": iv_conf,
                        "processed_at": datetime.now(timezone.utc)
                    }

                    try:
                        TrafficRepository.create_traffic_record(db, telemetry_interval_entry)
                        
                        # Generate AI Incident Alert if video detection observes High or Severe Congestion
                        if iv_level in ["HIGH", "SEVERE"]:
                            from app.models.models import Alert
                            existing_ai_alert = db.query(Alert).filter(
                                Alert.road_id == road_id,
                                Alert.status == "Active",
                                Alert.alert_type == "AI Congestion Spike"
                            ).first()

                            if not existing_ai_alert:
                                road_obj = db.query(Road).filter(Road.id == road_id).first()
                                op_id = road_obj.assigned_operator_id if road_obj else None
                                r_name = road_obj.road_name if road_obj else f"Corridor #{road_id}"

                                ai_alert = Alert(
                                    road_id=road_id,
                                    alert_type="AI Congestion Spike",
                                    severity="Critical" if iv_level == "SEVERE" else "High",
                                    status="Active",
                                    notes=f"AI Video Detection Alert: Real-time YOLO model analysis detected {iv_veh} vehicles with congestion level '{iv_level}' (confidence: {iv_conf * 100:.1f}%) on {r_name}.",
                                    assigned_operator_id=op_id,
                                    created_at=datetime.now(timezone.utc)
                                )
                                db.add(ai_alert)
                                db.commit()

                        ttl_cache.invalidate()
                    except Exception as t_err:
                        try:
                            db.rollback()
                        except Exception:
                            pass
                        logger.warning("Could not persist interval telemetry record: %s", str(t_err))

                    # Reset interval window
                    window_veh = 0
                    window_car = 0
                    window_bus = 0
                    window_truck = 0
                    window_moto = 0
                    window_scores = []
                    window_confs = []

        finally:
            cap.release()
            out.release()

        # If no frames could actually be read, mark as invalid
        if frame_count == 0:
            if os.path.exists(output_filepath):
                try:
                    os.remove(output_filepath)
                except Exception:
                    pass
            raise ValueError("Video is corrupted (zero readable frames).")

        logger.info("Video validation and AI traversal completed. Successfully processed %d frames.", frame_count)

        # Transcode processed output video to browser-compatible H.264 format
        VideoProcessor.reencode_to_h264(output_filepath)

        # 4. Compute overall averages
        avg_vehicle_count = round(total_vehicles_sum / frame_count, 1)
        avg_car_count = int(round(car_sum / frame_count))
        avg_bus_count = int(round(bus_sum / frame_count))
        avg_truck_count = int(round(truck_sum / frame_count))
        avg_motorcycle_count = int(round(motorcycle_sum / frame_count))
        avg_confidence = round(sum(all_confidences) / len(all_confidences), 2) if len(all_confidences) > 0 else 0.85
        avg_congestion_score = round(congestion_scores_sum / frame_count, 2)

        # Map average congestion score to Level thresholds
        if avg_congestion_score < settings.CONGESTION_THRESHOLD_LOW:
            overall_congestion_level = "Low"
        elif avg_congestion_score < settings.CONGESTION_THRESHOLD_MODERATE:
            overall_congestion_level = "Moderate"
        elif avg_congestion_score < settings.CONGESTION_THRESHOLD_HIGH:
            overall_congestion_level = "High"
        else:
            overall_congestion_level = "Severe"

        return {
            "total_frames": frame_count,
            "fps": round(fps, 2),
            "duration_seconds": round(duration, 2),
            "resolution": resolution,
            "processed_filepath": output_filepath,
            "avg_vehicle_count": int(round(avg_vehicle_count)),
            "car_count": avg_car_count,
            "bus_count": avg_bus_count,
            "truck_count": avg_truck_count,
            "motorcycle_count": avg_motorcycle_count,
            "avg_confidence": avg_confidence,
            "avg_congestion_score": avg_congestion_score,
            "overall_congestion_level": overall_congestion_level
        }

    @classmethod
    def process_video_background(cls, video_id: int, filepath: str, road_id: Optional[int] = None):
        """
        Background worker function to run frame-by-frame YOLO inference asynchronously.
        Updates UploadedVideo status from Processing to Processed/Failed and inserts TrafficData telemetry.
        """
        from app.database.session import SessionLocal
        from app.models.models import UploadedVideo
        from app.repositories.traffic_repository import TrafficRepository
        from app.utils.cache import ttl_cache
        from datetime import datetime, timezone

        db = SessionLocal()
        try:
            video_record = db.query(UploadedVideo).filter(UploadedVideo.id == video_id).first()
            if not video_record:
                logger.error("Background task: Video record ID %d not found.", video_id)
                return

            logger.info("Background task started: processing video ID %d (%s)...", video_id, filepath)
            stats = cls.process_video(filepath, road_id=road_id, video_id=video_id, db=db)

            # Update UploadedVideo record with stats
            video_record.total_frames = stats["total_frames"]
            video_record.fps = stats["fps"]
            video_record.duration_seconds = stats["duration_seconds"]
            video_record.resolution = stats["resolution"]
            video_record.car_count = stats.get("car_count", 0)
            video_record.bus_count = stats.get("bus_count", 0)
            video_record.truck_count = stats.get("truck_count", 0)
            video_record.motorcycle_count = stats.get("motorcycle_count", 0)
            video_record.filepath = stats["processed_filepath"]
            video_record.status = "Processed"

            # Create TrafficData telemetry record if associated with a road
            if road_id is not None:
                traffic_data_entry = {
                    "road_id": road_id,
                    "video_id": video_id,
                    "video_name": os.path.basename(filepath),
                    "vehicle_count": stats["avg_vehicle_count"],
                    "car_count": stats.get("car_count", 0),
                    "bus_count": stats.get("bus_count", 0),
                    "truck_count": stats.get("truck_count", 0),
                    "motorcycle_count": stats.get("motorcycle_count", 0),
                    "average_speed": round(60.0 * (1.0 - min(1.0, stats["avg_congestion_score"] / 100.0)), 1),
                    "congestion_level": stats["overall_congestion_level"].upper(),
                    "confidence": stats["avg_confidence"],
                    "processed_at": datetime.now(timezone.utc)
                }
                TrafficRepository.create_traffic_record(db, traffic_data_entry)

            db.commit()
            ttl_cache.invalidate()
            logger.info("Background task complete: Video ID %d processed successfully.", video_id)

            # Clean up raw video file if temporary and different from output (do not delete source videos in videos folder)
            is_source_video = "uploads" in filepath and ("videos" in filepath or "uploads\\videos" in filepath or "uploads/videos" in filepath)
            if not is_source_video and os.path.exists(filepath) and filepath != stats["processed_filepath"]:
                try:
                    os.remove(filepath)
                except Exception:
                    pass

        except Exception as exc:
            db.rollback()
            logger.error("Background processing failed for video ID %d: %s", video_id, str(exc))
            try:
                fail_record = db.query(UploadedVideo).filter(UploadedVideo.id == video_id).first()
                if fail_record:
                    fail_record.status = "Failed"
                    db.commit()
            except Exception:
                pass
        finally:
            db.close()

