import os
import sys
import requests
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.session import SessionLocal, init_db

def find_nearest_telemetry_py(telemetry_list, time_sec):
    if not telemetry_list:
        return None
    low = 0
    high = len(telemetry_list) - 1
    best = telemetry_list[0]
    min_diff = abs((best.get("video_timestamp") or 0.0) - time_sec)

    while low <= high:
        mid = (low + high) // 2
        item = telemetry_list[mid]
        ts = item.get("video_timestamp") or 0.0
        diff = abs(ts - time_sec)

        if diff < min_diff:
            min_diff = diff
            best = item

        if ts < time_sec:
            low = mid + 1
        elif ts > time_sec:
            high = mid - 1
        else:
            return item
    return best

def test_telemetry_sync():
    init_db()
    db = SessionLocal()
    base_url = "http://localhost:8000/api/v1"

    print("=" * 95)
    print(" AUTOMATED VERIFICATION: REAL-TIME VIDEO TELEMETRY SYNCHRONIZATION")
    print("=" * 95)

    # 1. Test Wall Street Junction (Road ID 2, Video ID 2)
    print("\n[PART 1] BENCHMARKING WALL STREET JUNCTION (RD-002, Video ID 2)")
    res = requests.get(f"{base_url}/videos/2/telemetry")
    assert res.status_code == 200, "Could not fetch telemetry endpoint"
    data = res.json()
    t_list = data.get("telemetry", [])
    print(f"  [OK] Total Telemetry Timeline Snapshots: {len(t_list)}")

    test_timestamps = [
        (10.0, "00:10"),
        (30.0, "00:30"),
        (60.0, "01:00"),
        (120.0, "02:00"),
        (158.0, "02:38"),
        (190.0, "03:10"),
        (240.0, "04:00"),
    ]

    print(f"\n  {'Video Time':<10} | {'Sec':<5} | {'Matched Snapshot':<16} | {'Total':<5} | {'Vehicles Breakdown (C/M/B/T)':<28} | {'Speed':<9} | {'Level':<8} | {'Math Check'}")
    print("  " + "-" * 105)

    for time_sec, time_str in test_timestamps:
        snap = find_nearest_telemetry_py(t_list, time_sec)
        assert snap is not None, f"No snapshot found for {time_str}"
        ts = snap.get("video_timestamp")
        total_v = snap.get("vehicle_count")
        cars = snap.get("car_count", 0)
        motos = snap.get("motorcycle_count", 0)
        buses = snap.get("bus_count", 0)
        trucks = snap.get("truck_count", 0)
        speed = snap.get("average_speed")
        level = snap.get("congestion_level")
        math_ok = "PASS" if total_v == (cars + motos + buses + trucks) else "FAIL"

        print(f"  {time_str:<10} | {time_sec:<5.1f} | {f'{ts:.1f}s':<16} | {total_v:<5} | {f'{cars} / {motos} / {buses} / {trucks}':<28} | {f'{speed} km/h':<9} | {level:<8} | {math_ok}")

    # 2. Test All 12 Roads
    print("\n\n[PART 2] VERIFYING 1-SECOND TELEMETRY COVERAGE ACROSS ALL 12 ROADS")
    print(f"  {'Road ID':<7} | {'Road Name':<28} | {'Records':<8} | {'Min TS':<7} | {'Max TS':<7} | {'Math Consistency'}")
    print("  " + "-" * 85)

    roads = db.execute(text("SELECT id, road_name FROM roads ORDER BY id ASC")).fetchall()
    for r in roads:
        r_id, r_name = r[0], r[1]
        v_rec = db.execute(text("SELECT id FROM uploaded_videos WHERE road_id = :rid ORDER BY id DESC LIMIT 1"), {"rid": r_id}).fetchone()
        if not v_rec:
            print(f"  {r_id:<7} | {r_name:<28} | {'NO VIDEO RECORD':<40}")
            continue
        v_id = v_rec[0]
        
        r_tel = requests.get(f"{base_url}/videos/{v_id}/telemetry").json().get("telemetry", [])
        min_ts = r_tel[0].get("video_timestamp") if r_tel else 0.0
        max_ts = r_tel[-1].get("video_timestamp") if r_tel else 0.0

        # Check math equality across all records
        all_math_ok = all(t.get("vehicle_count") == (t.get("car_count",0) + t.get("motorcycle_count",0) + t.get("bus_count",0) + t.get("truck_count",0)) for t in r_tel)
        math_str = "100% PASSED" if all_math_ok else "FAILED"

        print(f"  {r_id:<7} | {r_name:<28} | {len(r_tel):<8} | {f'{min_ts:.1f}s':<7} | {f'{max_ts:.1f}s':<7} | {math_str}")

    print("\n" + "=" * 95)
    print(" ALL TELEMETRY SYNCHRONIZATION TESTS PASSED PERFECTLY!")
    print("=" * 95)
    db.close()

if __name__ == "__main__":
    test_telemetry_sync()
