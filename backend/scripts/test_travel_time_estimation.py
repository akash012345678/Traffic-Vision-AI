import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_travel_time_estimation():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING TRAVEL-TIME ESTIMATION ENGINE (MILESTONE 2 PHASE 3)")
    print("=" * 80)

    # 1. Test Public Travel-Time API
    res_pub = client.get("/api/v1/public/travel-time")
    print(f"Public Travel-Time API Status: {res_pub.status_code}")
    assert res_pub.status_code == 200, "Public travel-time API failed!"

    pub_data = res_pub.json()
    pub_tt = pub_data.get("estimates", [])
    print(f"Public Travel-Time Estimates Returned: {len(pub_tt)} corridors")
    assert len(pub_tt) > 0, "No public travel-time estimates returned!"

    # 2. Test Admin Travel-Time API
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res_admin = client.get("/api/v1/predictions/travel-time", headers=headers)
    print(f"Admin Travel-Time API Status: {res_admin.status_code}")
    assert res_admin.status_code == 200, "Admin travel-time API failed!"

    admin_data = res_admin.json()
    admin_tts = admin_data.get("estimates", [])

    # 3. Test Road-Specific Scoping & Math Validation (5th Avenue & Wall Street)
    r1_tt = next((t for t in admin_tts if t["road_id"] == 1), None)
    r2_tt = next((t for t in admin_tts if t["road_id"] == 2), None)

    assert r1_tt is not None, "Missing travel-time estimate for 5th Avenue Corridor (Road 1)!"
    assert r2_tt is not None, "Missing travel-time estimate for Wall Street Junction (Road 2)!"

    print("\n--- TRAVEL-TIME CALCULATION VALIDATION ---")
    
    # 5th Avenue Verification
    d1 = r1_tt["distance_km"]
    s1 = r1_tt["current_speed_kmh"]
    expected_t1 = round((d1 / s1) * 60.0, 1)
    actual_t1 = r1_tt["current_travel_time_minutes"]
    print(f"Road 1 (5th Avenue): Distance = {d1} km, Speed = {s1} km/h")
    print(f"  Calculated Travel Time: {actual_t1} min (Expected: {expected_t1} min)")
    assert abs(actual_t1 - expected_t1) <= 0.1, "5th Avenue travel time calculation mismatch!"

    # Wall Street Verification
    d2 = r2_tt["distance_km"]
    s2 = r2_tt["current_speed_kmh"]
    expected_t2 = round((d2 / s2) * 60.0, 1)
    actual_t2 = r2_tt["current_travel_time_minutes"]
    print(f"Road 2 (Wall Street): Distance = {d2} km, Speed = {s2} km/h")
    print(f"  Calculated Travel Time: {actual_t2} min (Expected: {expected_t2} min)")
    assert abs(actual_t2 - expected_t2) <= 0.1, "Wall Street travel time calculation mismatch!"

    print("\n[OK] ALL TRAVEL-TIME ESTIMATION REQUIREMENTS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING MASTER REGRESSION SUITE")
    print("=" * 80)
    import scripts.run_milestone3_master_audit as master
    master.run_master_audit()

if __name__ == "__main__":
    test_travel_time_estimation()
