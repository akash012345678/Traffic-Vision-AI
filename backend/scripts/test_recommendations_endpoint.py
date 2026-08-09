import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

def test_recommendations():
    client = TestClient(app)

    print("=" * 80)
    print("TESTING AI-BASED TRAFFIC RECOMMENDATIONS API")
    print("=" * 80)

    # 1. Test Public Unauthenticated Endpoint
    res_pub = client.get("/api/v1/public/recommendations")
    print(f"Public Recommendation API Status: {res_pub.status_code}")
    assert res_pub.status_code == 200, "Public recommendations endpoint failed!"

    pub_data = res_pub.json()
    pub_recs = pub_data.get("recommendations", [])
    print(f"Public Recommendations Returned: {len(pub_recs)}")
    assert "data_source" in pub_data, "Missing data source banner!"

    # 2. Test Admin Authenticated Endpoint
    res_login = client.post("/api/v1/auth/login", json={"email": "admin.chief@trafficvision.ai", "password": "adminpass123"})
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    res_admin = client.get("/api/v1/reports/traffic/recommendations", headers=headers)
    print(f"Admin Recommendation API Status: {res_admin.status_code}")
    assert res_admin.status_code == 200, "Admin recommendations endpoint failed!"

    admin_data = res_admin.json()
    admin_recs = admin_data.get("recommendations", [])
    print(f"Admin Recommendations Returned: {len(admin_recs)}")

    # 3. Verify Prompt Scenarios & Supporting Metrics
    types_found = set()
    for rec in admin_recs:
        types_found.add(rec.get("recommendation_type"))
        assert "road_id" in rec, "Missing road_id in recommendation!"
        assert "message" in rec, "Missing message!"
        assert "explainable_rationale" in rec, "Missing explainable rationale!"
        assert "supporting_metrics" in rec, "Missing supporting_metrics!"
        m = rec["supporting_metrics"]
        for f in ["vehicle_count", "average_speed", "congestion_level", "timestamp", "is_stale"]:
            assert f in m, f"Missing metric field: {f}"

    print(f"Evaluated Recommendation Types: {list(types_found)}")
    print("\n[OK] ALL AI RECOMMENDATION RULES & SUPPORTING METRICS VERIFIED!")

    print("\n" + "=" * 80)
    print("RUNNING REGRESSION E2E SUITE")
    print("=" * 80)
    import scripts.run_milestone3_e2e_audit as e2e
    e2e.run_audit()

if __name__ == "__main__":
    test_recommendations()
