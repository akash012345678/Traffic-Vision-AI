import os
import cv2

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
videos_dir = os.path.join(backend_dir, "uploads", "videos")

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

print("=" * 90)
print(f"{'ID':<3} | {'Road Name':<28} | {'Filename':<30} | {'Exists':<6} | {'Size MB':<8} | {'Frames':<7} | {'Duration'}")
print("=" * 90)

for rid, rname, fname in ROAD_FILES:
    fpath = os.path.join(videos_dir, fname)
    exists = os.path.exists(fpath)
    size_mb = round(os.path.getsize(fpath) / (1024*1024), 2) if exists else 0.0
    frames = 0
    duration = 0.0
    if exists:
        cap = cv2.VideoCapture(fpath)
        if cap.isOpened():
            frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            duration = round(frames / fps, 1)
        cap.release()
    print(f"{rid:<3} | {rname:<28} | {fname:<30} | {'YES' if exists else 'NO':<6} | {size_mb:<8.2f} | {frames:<7} | {duration}s")
print("=" * 90)
