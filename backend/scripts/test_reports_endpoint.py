import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_reports():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING TRAFFIC ANALYTICS & REPORTS API (GET /api/v1/reports/traffic)")
    print("=" * 80)

    # Login Admin
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/reports/traffic", headers=headers)
    print(f"Endpoint Response Status: {res.status_code}")
    assert res.status_code == 200, "Reports endpoint failed!"

    data = res.json()
    summary = data.get("summary", {})
    road_reports = data.get("road_reports", [])
    timeline = data.get("telemetry_timeline", [])

    print(f"Monitored Corridors Returned: {len(road_reports)}")
    print(f"Total Vehicle Volume: {summary.get('total_vehicle_volume')} veh")
    print(f"Average Network Speed: {summary.get('average_network_speed')} km/h")
    print(f"Vehicle Composition Splits: {summary.get('vehicle_types')}")
    print(f"Congestion Severity Distribution: {summary.get('congestion_distribution')}")

    assert len(road_reports) > 0, "No road report items returned!"
    assert "data_source" in data, "Missing data source banner!"

    sample = road_reports[0]
    required_fields = ["road_id", "road_name", "road_code", "zone", "vehicle_count", "average_speed", "congestion_level", "car_count", "motorcycle_count", "bus_count", "truck_count", "last_updated_at"]
    for f in required_fields:
        assert f in sample, f"Missing required field in road report: {f}"

    print("\n[OK] ALL REQUIRED TRAFFIC REPORT METRICS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING REGRESSION E2E SUITE")
    print("=" * 80)
    import scripts.run_milestone3_e2e_audit as e2e
    e2e.run_audit()

if __name__ == "__main__":
    test_reports()
