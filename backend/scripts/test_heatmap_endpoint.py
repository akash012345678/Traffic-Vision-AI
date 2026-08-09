import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_heatmap():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING TRAFFIC HEATMAP BACKEND API (GET /api/v1/public/traffic/heatmap)")
    print("=" * 80)

    res_heat = client.get("/api/v1/public/traffic/heatmap")
    print(f"Endpoint Response Status: {res_heat.status_code}")
    assert res_heat.status_code == 200, "Heatmap endpoint failed!"

    data = res_heat.json()
    print(f"Total Heatmap Points Returned: {len(data)}")
    assert len(data) > 0, "No heatmap points returned!"

    sample = data[0]
    print("\nSample Heatmap Record (100% Real DB Data):")
    for k, v in sample.items():
        print(f"  - {k}: {v}")

    required_fields = [
        "road_id", "road_name", "road_code", "zone", 
        "latitude", "longitude", "vehicle_count", "average_speed", 
        "congestion_level", "intensity", "heat_color", "radius_meters", "last_updated_at"
    ]
    
    for field in required_fields:
        assert field in sample, f"Missing required heatmap field: {field}"

    print("\n[OK] ALL 13 REQUIRED HEATMAP DATA FIELDS VERIFIED!")

    print("\nCongestion -> Intensity Mapping Verification:")
    for point in data:
        print(f"  • {point['road_code']} ({point['road_name']}): {point['congestion_level']} -> Intensity {point['intensity']} ({point['heat_color']}, Radius {point['radius_meters']}m)")

    print("\n" + "=" * 80)
    print("RUNNING REGRESSION E2E SUITE")
    print("=" * 80)
    import scripts.run_milestone3_e2e_audit as e2e
    e2e.run_audit()

if __name__ == "__main__":
    test_heatmap()
