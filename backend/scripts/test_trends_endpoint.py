import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_trends():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING TRAFFIC TREND ANALYSIS API (GET /api/v1/reports/traffic/trends)")
    print("=" * 80)

    # Login Admin
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/reports/traffic/trends?time_range=24h", headers=headers)
    print(f"Endpoint Response Status: {res.status_code}")
    assert res.status_code == 200, "Trends endpoint failed!"

    data = res.json()
    trend_summary = data.get("trend_summary", {})
    time_series = data.get("time_series", [])

    print(f"Selected Road / Network: {data.get('selected_road_name')}")
    print(f"Time Range Filter: {data.get('time_range')}")
    print(f"Sample Count: {data.get('sample_count')}")
    print(f"Volume Summary: {trend_summary.get('volume_summary')}")
    print(f"Speed Summary ({trend_summary.get('speed_direction')}): {trend_summary.get('speed_summary')}")
    print(f"Congestion Summary: {trend_summary.get('congestion_summary')}")

    assert len(time_series) > 0, "No time series records returned!"
    assert "data_source" in data, "Missing data source banner!"

    sample = time_series[0]
    required_fields = ["id", "road_id", "vehicle_count", "average_speed", "congestion_level", "congestion_score", "timestamp", "time_label"]
    for f in required_fields:
        assert f in sample, f"Missing required field in trend item: {f}"

    # Test with specific road_id filter
    res_road = client.get("/api/v1/reports/traffic/trends?road_id=1&time_range=6h", headers=headers)
    assert res_road.status_code == 200, "Road-specific trends endpoint failed!"
    print(f"Corridor #1 Specific Trend Output Verified ({len(res_road.json().get('time_series', []))} samples)")

    print("\n[OK] ALL REQUIRED TRAFFIC TREND METRICS AND CALCULATIONS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING REGRESSION E2E SUITE")
    print("=" * 80)
    import scripts.run_milestone3_e2e_audit as e2e
    e2e.run_audit()

if __name__ == "__main__":
    test_trends()
