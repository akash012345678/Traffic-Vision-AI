import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_route_optimization_and_alternatives():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING ROUTE OPTIMIZATION & ALTERNATE ROUTE RECOMMENDATIONS (MILESTONE 2 PHASE 4)")
    print("=" * 80)

    # 1. Test Public Alternate Route API
    res_pub_alt = client.get("/api/v1/public/routes/alternatives?road_id=1")
    print(f"Public Alternate Route API Status: {res_pub_alt.status_code}")
    assert res_pub_alt.status_code == 200, "Public alternate route API failed!"

    pub_alt_data = res_pub_alt.json()
    print(f"Public Recommendation Status: {pub_alt_data.get('status')}")
    print(f"Explanation: {pub_alt_data.get('recommendation_explanation')}")
    assert pub_alt_data.get("recommendation_available") is True, "Expected alternate route for 5th Avenue Corridor!"

    # 2. Test Admin Route Optimization API (Dijkstra Algorithm)
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res_opt = client.get("/api/v1/routes/optimize?origin_road_id=1&destination_road_id=3", headers=headers)
    print(f"\nAdmin Route Optimization API Status: {res_opt.status_code}")
    assert res_opt.status_code == 200, "Route optimization API failed!"

    opt_data = res_opt.json()
    print("--- DIJKSTRA SHORTEST PATH EVALUATION ---")
    print(f"Origin Corridor:      {opt_data.get('origin_road', {}).get('name')}")
    print(f"Destination Corridor: {opt_data.get('destination_road', {}).get('name')}")
    print(f"Total Distance:       {opt_data.get('total_distance_km')} km")
    print(f"Total Travel Time:    {opt_data.get('total_travel_time_minutes')} min")
    print(f"15m Forecasted Time:  {opt_data.get('forecasted_travel_time_minutes')} min")
    print(f"Total Traffic Delay:  {opt_data.get('total_delay_minutes')} min")
    
    route_nodes = opt_data.get("recommended_route", [])
    print(f"Recommended Path Nodes ({len(route_nodes)} corridors): {[n['road_name'] for n in route_nodes]}")
    assert len(route_nodes) >= 2, "Dijkstra path failed to build multi-node route!"

    # 3. Test Prompt Scenario 5: Invalid Road ID (404 Error)
    res_inv = client.get("/api/v1/routes/alternatives?road_id=9999", headers=headers)
    print(f"\nInvalid Road ID Status: {res_inv.status_code}")
    assert res_inv.status_code == 404, "Invalid road ID should return HTTP 404!"

    # 4. Test Prompt Scenario 7: Road-Specific Telemetry Isolation
    res_alt1 = client.get("/api/v1/routes/alternatives?road_id=1", headers=headers).json()
    res_alt2 = client.get("/api/v1/routes/alternatives?road_id=2", headers=headers).json()
    assert res_alt1["road_id"] != res_alt2["road_id"], "Corridor recommendation telemetry contaminated!"

    print("\n[OK] ALL ROUTE OPTIMIZATION & ALTERNATE ROUTE REQUIREMENTS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING MASTER REGRESSION SUITE")
    print("=" * 80)
    import scripts.run_milestone3_master_audit as master
    master.run_master_audit()

if __name__ == "__main__":
    test_route_optimization_and_alternatives()
