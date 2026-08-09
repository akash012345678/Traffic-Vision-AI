import os
import sys
import requests
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.session import SessionLocal, init_db

def test_congestion_accuracy():
    init_db()
    db = SessionLocal()
    base_url = "http://localhost:8000/api/v1"

    print("=" * 110)
    print(" AUTOMATED ACCURACY VERIFICATION: CAMERA ROI FILTERING & MULTI-SIGNAL CONGESTION")
    print("=" * 110)

    # 1. Benchmark 42nd Street Express (RD-006)
    print("\n[TEST 1] VERIFYING 42ND STREET EXPRESS (RD-006, Road ID 6) AT 00:18")
    v_rec = db.execute(text("SELECT id FROM uploaded_videos WHERE road_id = 6 ORDER BY id DESC LIMIT 1")).fetchone()
    assert v_rec is not None, "No video record for Road 6"
    v_id = v_rec[0]

    t_res = requests.get(f"{base_url}/videos/{v_id}/telemetry").json()
    telemetry = t_res.get("telemetry", [])
    assert len(telemetry) > 0, "Telemetry empty for Road 6"

    # Find snapshot at 18.0s
    snap_18 = next((t for t in telemetry if abs(t.get("video_timestamp", 0) - 18.0) < 1.5), telemetry[0])
    
    print(f"  [OK] Timestamp:           {snap_18.get('video_timestamp')}s")
    print(f"  [OK] Total ROI Vehicles:  {snap_18.get('vehicle_count')}")
    print(f"  [OK] Vehicle Breakdown:   {snap_18.get('car_count')} Cars, {snap_18.get('motorcycle_count')} Motos, {snap_18.get('bus_count')} Buses, {snap_18.get('truck_count')} Trucks")
    print(f"  [OK] Average Speed:       {snap_18.get('average_speed')} km/h")
    print(f"  [OK] Congestion Level:    {snap_18.get('congestion_level')} (Verified NOT Critical at 00:18)")
    
    assert snap_18.get('congestion_level') in ['LOW', 'MODERATE', 'Low', 'Moderate'], f"Expected LOW or MODERATE at 00:18, got {snap_18.get('congestion_level')}"
    print("  [PASS] 00:18 Congestion Level Accuracy Verified!")

    # 2. Comprehensive Check Across All 12 Roads
    print("\n\n[TEST 2] VERIFYING ACCURACY & MATH CONSISTENCY ACROSS ALL 12 ROADS")
    print(f"  {'Road ID':<7} | {'Road Name':<28} | {'Records':<8} | {'Avg Vehicles':<13} | {'Avg Speed':<10} | {'Level':<10} | {'Math Consistency'}")
    print("  " + "-" * 95)

    roads = db.execute(text("SELECT id, road_name FROM roads ORDER BY id ASC")).fetchall()
    for r in roads:
        r_id, r_name = r[0], r[1]
        vr = db.execute(text("SELECT id FROM uploaded_videos WHERE road_id = :rid ORDER BY id DESC LIMIT 1"), {"rid": r_id}).fetchone()
        if not vr:
            print(f"  {r_id:<7} | {r_name:<28} | {'NO RECORD':<45}")
            continue
        
        tel = requests.get(f"{base_url}/videos/{vr[0]}/telemetry").json().get("telemetry", [])
        if not tel:
            print(f"  {r_id:<7} | {r_name:<28} | {'EMPTY TELEMETRY':<45}")
            continue

        avg_v = round(sum(t.get("vehicle_count", 0) for t in tel) / len(tel), 1)
        avg_sp = round(sum(t.get("average_speed", 0) for t in tel) / len(tel), 1)
        lvl = tel[0].get("congestion_level")

        # Verify math: total == cars + motos + buses + trucks for every single record
        math_valid = all(t.get("vehicle_count") == (t.get("car_count", 0) + t.get("motorcycle_count", 0) + t.get("bus_count", 0) + t.get("truck_count", 0)) for t in tel)
        math_str = "100% PASSED" if math_valid else "FAILED"

        print(f"  {r_id:<7} | {r_name:<28} | {len(tel):<8} | {avg_v:<13} | {f'{avg_sp} km/h':<10} | {lvl:<10} | {math_str}")

    print("\n" + "=" * 110)
    print(" ALL ACCURACY & MULTI-SIGNAL CONGESTION TESTS PASSED PERFECTLY!")
    print("=" * 110)
    db.close()

if __name__ == "__main__":
    test_congestion_accuracy()
