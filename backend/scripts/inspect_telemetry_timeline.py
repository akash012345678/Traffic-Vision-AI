import os
import sys
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.session import SessionLocal, init_db

def inspect_telemetry():
    init_db()
    db = SessionLocal()

    roads = db.execute(text("SELECT id, road_name FROM roads ORDER BY id ASC")).fetchall()
    print("=" * 100)
    print(f"{'Road ID':<7} | {'Road Name':<28} | {'Telemetry Records':<18} | {'Min Timestamp':<13} | {'Max Timestamp'}")
    print("=" * 100)

    for r in roads:
        r_id, r_name = r[0], r[1]
        t_stats = db.execute(text("""
            SELECT COUNT(*), MIN(video_timestamp), MAX(video_timestamp)
            FROM traffic_data
            WHERE road_id = :rid
        """), {"rid": r_id}).fetchone()

        count = t_stats[0] or 0
        min_ts = round(t_stats[1], 1) if t_stats[1] is not None else "N/A"
        max_ts = round(t_stats[2], 1) if t_stats[2] is not None else "N/A"

        print(f"{r_id:<7} | {r_name:<28} | {count:<18} | {str(min_ts):<13} | {str(max_ts)}")

    print("=" * 100)
    db.close()

if __name__ == "__main__":
    inspect_telemetry()
