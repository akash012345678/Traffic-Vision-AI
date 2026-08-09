import logging
import os
import time
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
import cv2
from ultralytics import YOLO

from app.config.settings import settings
from app.config.road_configs import ROAD_CONFIGS, get_road_roi_polygon_pixels

logger = logging.getLogger("trafficvision.ai")

# Map COCO class IDs to target vehicle types
VEHICLE_CLASS_MAP = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

# Rich neon color palette (B, G, R) for drawing target vehicle types
VEHICLE_COLOR_MAP = {
    "car": (46, 204, 113),         # Neon Green
    "motorcycle": (241, 196, 15),  # Neon Yellow
    "bus": (52, 152, 219),         # Neon Blue
    "truck": (155, 89, 182)        # Neon Purple
}

class AIProcessor:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.YOLO_MODEL_PATH
        self.model = None
        # Track history map: track_id -> [(cx, cy, frame_id), ...]
        self.track_history: Dict[int, List[Tuple[int, int, int]]] = {}
        # EMA smoothed congestion score per road_id
        self.smoothed_congestion: Dict[int, float] = {}
        self._initialize_model()

    def _initialize_model(self):
        """
        Loads the YOLOv8 model from the settings path.
        """
        logger.info("Initializing AI Processor with model path: %s", self.model_path)
        try:
            model_dir = os.path.dirname(self.model_path)
            if model_dir:
                os.makedirs(model_dir, exist_ok=True)
            
            self.model = YOLO(self.model_path)
            logger.info("YOLOv8 Model loaded successfully.")
        except Exception as e:
            logger.critical("Failed to load YOLOv8 model: %s", str(e))
            raise RuntimeError(f"YOLOv8 initialization error: {str(e)}")

    def process_frame(
        self, 
        frame: np.ndarray, 
        frame_id: int, 
        road_id: int = 1,
        draw_debug_overlay: bool = True
    ) -> Dict[str, Any]:
        """
        Processes a single video frame with ByteTrack persistent tracking, camera ROI filtering,
        vehicle motion vector estimation, composite multi-signal congestion calculation, and HUD rendering.
        """
        t_start = time.perf_counter()
        
        if frame is None:
            return {
                "frame_id": frame_id,
                "detected_vehicles": 0,
                "roi_vehicles": 0,
                "counts": {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0},
                "congestion_score": 0.0,
                "congestion_level": "Low",
                "average_speed": 45.0,
                "confidences": [],
                "inference_time_ms": 0.0
            }

        height, width = frame.shape[:2]

        # 1. Fetch camera perspective configuration & Road ROI polygon
        road_cfg = ROAD_CONFIGS.get(road_id, ROAD_CONFIGS[1])
        num_lanes = road_cfg.get("lanes", 4)
        speed_limit = road_cfg.get("speed_limit_kmh", 50.0)
        roi_pixel_poly = get_road_roi_polygon_pixels(road_id, width, height)
        roi_np = np.array(roi_pixel_poly, dtype=np.int32)
        roi_area = max(1.0, float(cv2.contourArea(roi_np)))

        # Draw Cyan Road ROI Boundary line on frame if debug enabled
        if draw_debug_overlay:
            cv2.polylines(frame, [roi_np], isClosed=True, color=(255, 255, 0), thickness=2, lineType=cv2.LINE_AA)

        counts = {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0}
        confidences = []
        roi_vehicles_count = 0
        total_roi_box_area = 0.0

        # Track motion stats
        free_flowing_count = 0
        slow_count = 0
        stopped_count = 0

        # 2. Run YOLOv8 ByteTrack inference
        try:
            results = self.model.track(
                source=frame,
                persist=True,
                tracker="bytetrack.yaml",
                classes=list(VEHICLE_CLASS_MAP.keys()),
                conf=0.25,
                imgsz=864,
                device="cpu",
                verbose=False
            )
            
            if results and len(results) > 0:
                boxes = results[0].boxes
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    
                    # Track ID
                    track_id = int(box.id[0].item()) if (box.id is not None and len(box.id) > 0) else None

                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    
                    # Reference contact point (bottom-center of bounding box)
                    contact_cx = (x1 + x2) // 2
                    contact_cy = y2

                    # Check if contact point falls INSIDE the Road ROI polygon
                    is_in_roi = cv2.pointPolygonTest(roi_np, (float(contact_cx), float(contact_cy)), False) >= 0

                    class_name = VEHICLE_CLASS_MAP.get(cls_id, "unknown")
                    color = VEHICLE_COLOR_MAP.get(class_name, (255, 255, 255))

                    if is_in_roi:
                        roi_vehicles_count += 1
                        if class_name in counts:
                            counts[class_name] += 1
                        confidences.append(conf)
                        box_w, box_h = max(1, x2 - x1), max(1, y2 - y1)
                        total_roi_box_area += (box_w * box_h)

                        # Motion vector calculation if track_id exists
                        if track_id is not None:
                            history = self.track_history.setdefault(track_id, [])
                            history.append((contact_cx, contact_cy, frame_id))
                            # Keep last 15 frames of history
                            if len(history) > 15:
                                history.pop(0)

                            # Calculate displacement over last available frames
                            if len(history) >= 3:
                                prev_cx, prev_cy, _ = history[0]
                                disp = np.sqrt((contact_cx - prev_cx)**2 + (contact_cy - prev_cy)**2)
                                frames_diff = max(1, frame_id - history[0][2])
                                disp_per_frame = disp / frames_diff

                                if disp_per_frame < 2.0:
                                    stopped_count += 1
                                elif disp_per_frame < 6.0:
                                    slow_count += 1
                                else:
                                    free_flowing_count += 1
                            else:
                                free_flowing_count += 1
                        else:
                            free_flowing_count += 1

                    # Drawing overlay on frame
                    if draw_debug_overlay:
                        # Draw bounding box (Thicker if in ROI, thin if outside ROI)
                        box_thickness = 2 if is_in_roi else 1
                        box_color = color if is_in_roi else (100, 100, 100)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, box_thickness, cv2.LINE_AA)

                        # Draw contact point circle (Green if inside ROI, Red if outside)
                        dot_color = (0, 255, 0) if is_in_roi else (0, 0, 255)
                        cv2.circle(frame, (contact_cx, contact_cy), 4, dot_color, -1)

                        # Label tag with track ID
                        track_str = f" #{track_id}" if track_id is not None else ""
                        label = f"{class_name}{track_str} {conf:.2f}"
                        if not is_in_roi:
                            label += " [OUT]"
                        
                        (w_txt, h_txt), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
                        y_lbl = max(y1, h_txt + 10)
                        cv2.rectangle(frame, (x1, y_lbl - h_txt - 6), (x1 + w_txt + 10, y_lbl), box_color, -1)
                        cv2.putText(frame, label, (x1 + 5, y_lbl - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)

        except Exception as pred_err:
            logger.error("Inference/Tracking failed for frame ID %d: %s", frame_id, str(pred_err))

        # Enforce strict summation equality: total_vehicles == cars + motorcycles + buses + trucks
        total_vehicles = counts["car"] + counts["motorcycle"] + counts["bus"] + counts["truck"]
        mean_confidence = round(float(np.mean(confidences)), 3) if confidences else 0.60

        # 3. Calculate Multi-Signal Composite Congestion Score
        # Component A: Normalized Density Ratio against Lane Capacity
        max_roi_capacity = float(num_lanes * 5.5)
        density_ratio = min(1.0, float(total_vehicles) / max_roi_capacity) if max_roi_capacity > 0 else 0.0

        # Component B: Spatial Occupancy Ratio inside ROI
        occupancy_ratio = min(1.0, total_roi_box_area / max(1.0, roi_area * 0.75))

        # Component C: Slow / Stopped Vehicle Ratio
        slow_traffic_ratio = float(stopped_count * 1.0 + slow_count * 0.5) / max(1.0, float(total_vehicles))

        # Component D: Persistence / Traffic Volume Load Score
        persistence_score = min(1.0, float(total_vehicles) / 40.0)

        # Composite Raw Score (0 to 100)
        raw_congestion_score = round(100.0 * (
            0.30 * density_ratio +
            0.35 * occupancy_ratio +
            0.25 * slow_traffic_ratio +
            0.10 * persistence_score
        ), 2)

        # Apply Temporal Exponential Moving Average (EMA) Smoothing across frames
        prev_score = self.smoothed_congestion.get(road_id, raw_congestion_score)
        smoothed_score = round(0.35 * raw_congestion_score + 0.65 * prev_score, 2)
        self.smoothed_congestion[road_id] = smoothed_score

        # Map to Congestion Level thresholds
        if smoothed_score < settings.CONGESTION_THRESHOLD_LOW:
            congestion_level = "Low"
            level_color = (46, 204, 113) # Neon Green
        elif smoothed_score < settings.CONGESTION_THRESHOLD_MODERATE:
            congestion_level = "Moderate"
            level_color = (241, 196, 15) # Neon Yellow
        elif smoothed_score < settings.CONGESTION_THRESHOLD_HIGH:
            congestion_level = "High"
            level_color = (230, 126, 34) # Neon Orange
        else:
            congestion_level = "Severe"
            level_color = (231, 76, 60) # Neon Red

        # Calculate Greenshields Traffic Flow Calibrated Speed (km/h)
        speed_factor = max(0.15, 1.0 - 0.75 * (smoothed_score / 100.0))
        average_speed = round(max(12.0, speed_limit * speed_factor), 1)

        # 4. Render Glassmorphic Telemetry HUD Panel (top-left) if debug enabled
        if draw_debug_overlay:
            try:
                overlay = frame.copy()
                card_x1, card_y1 = 15, 15
                card_x2, card_y2 = 360, 215
                cv2.rectangle(overlay, (card_x1, card_y1), (card_x2, card_y2), (20, 24, 33), -1)
                cv2.rectangle(overlay, (card_x1, card_y1), (card_x2, card_y2), (58, 63, 76), 1)
                
                alpha = 0.75
                cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, frame)
                
                # Header
                cv2.putText(frame, f"TRAFFICVISION AI | {road_cfg['road_name'].upper()}", (card_x1 + 10, card_y1 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (52, 152, 219), 2, cv2.LINE_AA)
                cv2.line(frame, (card_x1 + 10, card_y1 + 26), (card_x2 - 10, card_y1 + 26), (58, 63, 76), 1, cv2.LINE_AA)
                
                # Line 1: ROI Vehicles & Motion
                cv2.putText(frame, f"ROI Vehicles: {total_vehicles} (Total: {roi_vehicles_count})", (card_x1 + 10, card_y1 + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(frame, f"Motion: {free_flowing_count} Free | {slow_count} Slow | {stopped_count} Stop", (card_x1 + 10, card_y1 + 65), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (189, 195, 199), 1, cv2.LINE_AA)
                
                # Line 2: Vehicle Breakdown
                bd = f"Cars: {counts['car']} | Buses: {counts['bus']} | Trucks: {counts['truck']} | Motos: {counts['motorcycle']}"
                cv2.putText(frame, bd, (card_x1 + 10, card_y1 + 85), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (189, 195, 199), 1, cv2.LINE_AA)
                cv2.line(frame, (card_x1 + 10, card_y1 + 92), (card_x2 - 10, card_y1 + 92), (58, 63, 76), 1, cv2.LINE_AA)
                
                # Line 3: Congestion Score & Speed
                cv2.putText(frame, f"Congestion Score: {smoothed_score:.1f}%", (card_x1 + 10, card_y1 + 112), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(frame, f"Congestion Level: {congestion_level.upper()}", (card_x1 + 10, card_y1 + 132), cv2.FONT_HERSHEY_SIMPLEX, 0.42, level_color, 2, cv2.LINE_AA)
                cv2.putText(frame, f"Est. Speed: {average_speed} km/h (Limit: {speed_limit} km/h)", (card_x1 + 10, card_y1 + 152), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (46, 204, 113), 1, cv2.LINE_AA)
                
                # Line 4: ROI Occupancy %
                cv2.putText(frame, f"ROI Occupancy: {occupancy_ratio*100.0:.1f}% | Conf: {mean_confidence*100.0:.0f}%", (card_x1 + 10, card_y1 + 172), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (189, 195, 199), 1, cv2.LINE_AA)

            except Exception as hud_err:
                logger.error("HUD overlay error: %s", str(hud_err))

        t_end = time.perf_counter()
        inference_time_ms = round((t_end - t_start) * 1000.0, 1)

        return {
            "frame_id": frame_id,
            "detected_vehicles": total_vehicles,
            "roi_vehicles": roi_vehicles_count,
            "counts": counts,
            "congestion_score": smoothed_score,
            "congestion_level": congestion_level,
            "average_speed": average_speed,
            "confidence": mean_confidence,
            "inference_time_ms": inference_time_ms
        }
