import os
import sys
import time
import cv2
import numpy as np
from ultralytics import YOLO

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
video_path = os.path.join(backend_dir, "uploads", "videos", "Fulton Transit Corridor.mp4")

VEHICLE_CLASSES = [2, 3, 5, 7] # car, motorcycle, bus, truck
CLASS_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# 10 Representative timestamps in seconds
TIMESTAMPS_SEC = [5, 10, 13, 20, 30, 45, 60, 90, 120, 180]

def extract_frames():
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frames = []
    
    for sec in TIMESTAMPS_SEC:
        frame_idx = int(sec * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if ret:
            frames.append((sec, frame_idx, frame))
        else:
            print(f"Warning: Could not read frame at {sec}s")
    cap.release()
    return frames

def benchmark_model(model_name, imgsz, conf=0.25):
    print(f"\n--- Benchmarking Model: {model_name} (imgsz={imgsz}, conf={conf}) ---")
    model = YOLO(model_name)
    frames = extract_frames()
    
    total_detections = 0
    total_time_ms = 0.0
    all_confs = []
    
    results_per_frame = []
    
    for sec, frame_idx, frame in frames:
        t0 = time.perf_counter()
        results = model.predict(
            source=frame,
            classes=VEHICLE_CLASSES,
            conf=conf,
            imgsz=imgsz,
            device="cpu",
            verbose=False
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        total_time_ms += elapsed_ms
        
        counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}
        frame_confs = []
        
        if results and len(results) > 0:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                c_val = float(box.conf[0].item())
                frame_confs.append(c_val)
                c_name = CLASS_NAMES.get(cls_id, "unknown")
                if c_name in counts:
                    counts[c_name] += 1
                    
        total_veh = sum(counts.values())
        total_detections += total_veh
        all_confs.extend(frame_confs)
        mean_c = np.mean(frame_confs) if frame_confs else 0.0
        
        results_per_frame.append({
            "sec": sec,
            "veh_count": total_veh,
            "counts": counts,
            "mean_conf": round(mean_c, 3),
            "time_ms": round(elapsed_ms, 1)
        })
        print(f"  Time {sec:02d}s: Veh={total_veh:02d} (Cars:{counts['car']} Motos:{counts['motorcycle']} Buses:{counts['bus']} Trucks:{counts['truck']}) | Conf: {mean_c:.2f} | Time: {elapsed_ms:.1f}ms")

    avg_time = total_time_ms / len(frames) if frames else 0
    avg_conf = np.mean(all_confs) if all_confs else 0.0
    print(f"Summary [{model_name} imgsz={imgsz}]: Total Detections across 10 frames = {total_detections}, Avg Time = {avg_time:.1f}ms/frame, Avg Conf = {avg_conf:.3f}")
    return results_per_frame, avg_time, avg_conf

if __name__ == "__main__":
    b1, t1, c1 = benchmark_model("yolov8n.pt", imgsz=640)
    b2, t2, c2 = benchmark_model("yolov8n.pt", imgsz=848)
    b3, t3, c3 = benchmark_model("yolov8s.pt", imgsz=640)
    b4, t4, c4 = benchmark_model("yolov8s.pt", imgsz=848)
