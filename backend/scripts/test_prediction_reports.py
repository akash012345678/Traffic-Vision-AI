import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_prediction_reports():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING TRAFFIC PREDICTION REPORTS (MILESTONE 2 PHASE 5)")
    print("=" * 80)

    # 1. Test Admin Traffic Prediction Report API
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res_rep = client.get("/api/v1/reports/traffic/predictions", headers=headers)
    print(f"Prediction Report API Status: {res_rep.status_code}")
    assert res_rep.status_code == 200, "Prediction report API failed!"

    data = res_rep.json()
    model_val = data.get("model_validation", {})
    summary = data.get("summary", {})
    reports = data.get("road_prediction_reports", [])

    print("\n--- REPORT SUMMARY & VALIDATION METRICS ---")
    print(f"Total Monitored Corridors: {summary.get('total_monitored_corridors')}")
    print(f"Network Growth Trend:      {summary.get('volume_growth_trend')}")
    print(f"Average Network Delay:     {summary.get('avg_network_delay_minutes')} min")
    print(f"Prediction Model:          {model_val.get('prediction_model')}")
    print(f"Validation MAE:            {model_val.get('prediction_mae')} veh")
    print(f"Validation R2 Score:       {model_val.get('prediction_r2')}")
    print(f"Forecast Accuracy:         {model_val.get('forecast_accuracy') * 100:.1f}%")
    print(f"Forecast F1 Score:         {model_val.get('forecast_f1_score')}")

    assert len(reports) > 0, "No road prediction reports returned!"

    # 2. Test Road Selection & Metric Isolation (Road #1 - 5th Avenue Corridor)
    r1 = next((r for r in reports if r["road_id"] == 1), None)
    assert r1 is not None, "Missing report for 5th Avenue Corridor (Road 1)!"

    print("\n--- ROAD-SPECIFIC PREDICTION REPORT (5th Avenue) ---")
    print(f"Road Code:               {r1['road_code']}")
    print(f"Road Name:               {r1['road_name']}")
    print(f"Current Vehicles:        {r1['current_vehicle_count']} veh")
    print(f"Predicted Vehicles (15m):{r1['predicted_vehicle_count']} veh (Growth: {r1['volume_change']} veh)")
    print(f"Current Congestion:      {r1['current_congestion']}")
    print(f"Forecasted Congestion:   {r1['forecasted_congestion']}")
    print(f"Current Travel Time:     {r1['current_travel_time_minutes']} min")
    print(f"Forecasted Travel Time:  {r1['forecasted_travel_time_minutes']} min")
    print(f"Traffic Delay:           {r1['delay_minutes']} min")
    
    if r1.get("route_optimization", {}).get("has_alternative"):
        print(f"Alternative Route:       {r1['route_optimization']['alternative_road_name']} (Saves {r1['route_optimization']['time_saved_minutes']} mins)")

    # 3. Test Filtering (Road #1 filter)
    res_filt = client.get("/api/v1/reports/traffic/predictions?road_id=1", headers=headers)
    print(f"\nFiltered Road #1 Report Status: {res_filt.status_code}")
    assert res_filt.status_code == 200
    filt_reports = res_filt.json().get("road_prediction_reports", [])
    assert len(filt_reports) == 1, "Filtering by road_id=1 failed to scope payload to 1 road!"

    print("\n[OK] ALL TRAFFIC PREDICTION REPORT REQUIREMENTS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING MASTER REGRESSION SUITE")
    print("=" * 80)
    import scripts.run_milestone3_master_audit as master
    master.run_master_audit()

if __name__ == "__main__":
    test_prediction_reports()
