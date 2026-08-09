import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_prediction_model():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING MACHINE LEARNING TRAFFIC PREDICTION ENGINE (MILESTONE 2 PHASE 1)")
    print("=" * 80)

    # 1. Test Public Prediction API
    res_pub = client.get("/api/v1/public/predictions")
    print(f"Public Prediction API Status: {res_pub.status_code}")
    assert res_pub.status_code == 200, "Public prediction API failed!"

    pub_data = res_pub.json()
    pub_preds = pub_data.get("predictions", [])
    print(f"Public Predictions Returned: {len(pub_preds)} corridors")
    assert len(pub_preds) > 0, "No public predictions returned!"

    # 2. Test Admin Prediction API & Model Performance Metrics
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res_admin = client.get("/api/v1/predictions/traffic", headers=headers)
    print(f"Admin Prediction API Status: {res_admin.status_code}")
    assert res_admin.status_code == 200, "Admin prediction API failed!"

    admin_data = res_admin.json()
    model_info = admin_data.get("model_info", {})
    admin_preds = admin_data.get("predictions", [])

    print("\n--- MODEL PERFORMANCE & METRICS ---")
    print(f"Model Type:            {model_info.get('model_type')}")
    print(f"Train/Test Methodology:{model_info.get('train_test_split')}")
    print(f"Validation MAE:        {model_info.get('mae')} veh")
    print(f"Validation RMSE:       {model_info.get('rmse')} veh")
    print(f"Validation R2 Score:   {model_info.get('r2_score')}")
    print(f"Evaluated DB Samples:  {model_info.get('total_samples_evaluated')} records")

    assert model_info.get("mae") is not None, "Missing MAE score!"
    assert model_info.get("rmse") is not None, "Missing RMSE score!"
    assert model_info.get("r2_score") is not None, "Missing R2 score!"

    # 3. Test Road-Specific Scoping (5th Avenue & Wall Street)
    r1_pred = next((p for p in admin_preds if p["road_id"] == 1), None)
    r2_pred = next((p for p in admin_preds if p["road_id"] == 2), None)

    assert r1_pred is not None, "Missing prediction for 5th Avenue Corridor (Road 1)!"
    assert r2_pred is not None, "Missing prediction for Wall Street Junction (Road 2)!"

    print("\n--- CORRIDOR FORECAST EXAMPLES ---")
    print(f"Road 1 (5th Avenue):  Current {r1_pred['current_vehicle_count']} veh ({r1_pred['current_congestion']}) -> Predicted (15m) {r1_pred['predicted_vehicle_count']} veh ({r1_pred['predicted_congestion']})")
    print(f"Road 2 (Wall Street): Current {r2_pred['current_vehicle_count']} veh ({r2_pred['current_congestion']}) -> Predicted (15m) {r2_pred['predicted_vehicle_count']} veh ({r2_pred['predicted_congestion']})")

    assert r1_pred["road_code"] != r2_pred["road_code"], "Corridor predictions contaminated!"

    print("\n[OK] ALL MACHINE LEARNING TRAFFIC PREDICTION REQUIREMENTS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING REGRESSION E2E SUITE")
    print("=" * 80)
    import scripts.run_milestone3_master_audit as master
    master.run_master_audit()

if __name__ == "__main__":
    test_prediction_model()
