import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_congestion_forecasting():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING CONGESTION FORECASTING ENGINE (MILESTONE 2 PHASE 2)")
    print("=" * 80)

    # 1. Test Public Forecast API
    res_pub = client.get("/api/v1/public/predictions/congestion")
    print(f"Public Congestion Forecast API Status: {res_pub.status_code}")
    assert res_pub.status_code == 200, "Public congestion forecast API failed!"

    pub_data = res_pub.json()
    pub_fc = pub_data.get("forecasts", [])
    print(f"Public Congestion Forecasts Returned: {len(pub_fc)} corridors")
    assert len(pub_fc) > 0, "No public forecasts returned!"

    # 2. Test Admin Forecast API & Classification Metrics
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res_admin = client.get("/api/v1/predictions/congestion", headers=headers)
    print(f"Admin Congestion Forecast API Status: {res_admin.status_code}")
    assert res_admin.status_code == 200, "Admin congestion forecast API failed!"

    admin_data = res_admin.json()
    val_metrics = admin_data.get("validation_metrics", {})
    admin_fcs = admin_data.get("forecasts", [])

    print("\n--- CLASSIFICATION VALIDATION METRICS ---")
    print(f"Classification Accuracy: {val_metrics.get('classification_accuracy') * 100:.1f}%")
    print(f"Precision:               {val_metrics.get('precision')}")
    print(f"Recall:                  {val_metrics.get('recall')}")
    print(f"F1-Score:                {val_metrics.get('f1_score')}")

    assert val_metrics.get("classification_accuracy") is not None, "Missing classification accuracy!"
    assert val_metrics.get("f1_score") is not None, "Missing F1-score!"

    # 3. Test Road-Specific Scoping (5th Avenue & Wall Street)
    r1_fc = next((f for f in admin_fcs if f["road_id"] == 1), None)
    r2_fc = next((f for f in admin_fcs if f["road_id"] == 2), None)

    assert r1_fc is not None, "Missing forecast for 5th Avenue Corridor (Road 1)!"
    assert r2_fc is not None, "Missing forecast for Wall Street Junction (Road 2)!"

    print("\n--- CONGESTION FORECAST EXAMPLES ---")
    print(f"Road 1 (5th Avenue):  Current {r1_fc['current_congestion']} ({r1_fc['current_vehicle_count']} veh) -> 15m Forecast {r1_fc['forecasted_congestion']} ({r1_fc['predicted_vehicle_count']} veh)")
    print(f"Rationale: {r1_fc['forecast_explanation']}")

    print(f"\nRoad 2 (Wall Street): Current {r2_fc['current_congestion']} ({r2_fc['current_vehicle_count']} veh) -> 15m Forecast {r2_fc['forecasted_congestion']} ({r2_fc['predicted_vehicle_count']} veh)")
    print(f"Rationale: {r2_fc['forecast_explanation']}")

    print("\n[OK] ALL CONGESTION FORECASTING REQUIREMENTS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING MASTER REGRESSION SUITE")
    print("=" * 80)
    import scripts.run_milestone3_master_audit as master
    master.run_master_audit()

if __name__ == "__main__":
    test_congestion_forecasting()
