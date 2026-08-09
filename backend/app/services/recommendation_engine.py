from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.models import Road, TrafficData, Alert

def generate_traffic_recommendations(
    db: Session,
    road_id: Optional[int] = None,
    zone: Optional[str] = None,
    is_public_safe: bool = True
) -> List[Dict[str, Any]]:
    """
    Deterministic Data-Driven AI Traffic Recommendation Engine.
    Analyzes real-time traffic telemetry from Supabase/PostgreSQL.
    
    Evaluates:
    - Current vehicle volume & speed velocity vs speed limit
    - Short-term volume trends & speed velocity changes
    - Active incident alert status
    - Same-zone alternative corridor comparisons
    
    Returns structured, explainable recommendations with supporting database metrics.
    """
    query = db.query(Road).filter(Road.status == "Active")
    if road_id:
        query = query.filter(Road.id == road_id)
    elif zone and zone != "ALL":
        query = query.filter(Road.zone.ilike(f"%{zone}%"))

    active_roads = query.all()
    if not active_roads:
        return []

    # Map latest & previous telemetry for each road
    road_telemetry_map = {}
    now = datetime.now(timezone.utc)

    for r in active_roads:
        records = (
            db.query(TrafficData)
            .filter(TrafficData.road_id == r.id)
            .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
            .limit(2)
            .all()
        )

        latest = records[0] if len(records) > 0 else None
        prev = records[1] if len(records) > 1 else None

        v_curr = latest.vehicle_count if latest else 0
        v_prev = prev.vehicle_count if prev else v_curr
        v_diff = v_curr - v_prev
        v_pct = round((v_diff / max(1, v_prev)) * 100, 1) if v_prev > 0 else 0.0

        s_curr = round(latest.average_speed, 1) if latest else float(r.speed_limit or 60)
        s_prev = round(prev.average_speed, 1) if prev else s_curr
        s_diff = round(s_curr - s_prev, 1)

        c_lvl = (latest.congestion_level if latest else "LOW").upper()
        if c_lvl in ["CRITICAL", "SEVERE"]:
            c_lvl = "CRITICAL"

        # Check active alerts for this road
        alert_cnt = db.query(Alert).filter(Alert.road_id == r.id, Alert.status == "Active").count()

        ts = latest.timestamp if (latest and latest.timestamp) else r.updated_at
        ts_iso = ts.isoformat() if ts else now.isoformat()
        
        # Check staleness (> 2 hours old)
        is_stale = False
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if (now - ts) > timedelta(hours=2):
                is_stale = True

        road_telemetry_map[r.id] = {
            "road": r,
            "latest": latest,
            "v_curr": v_curr,
            "v_pct": v_pct,
            "s_curr": s_curr,
            "s_diff": s_diff,
            "c_lvl": c_lvl,
            "alert_cnt": alert_cnt,
            "ts_iso": ts_iso,
            "is_stale": is_stale
        }

    recommendations = []
    severity_order = {"CRITICAL": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1}

    # Evaluate recommendations per road
    for r_id, t_data in road_telemetry_map.items():
        r = t_data["road"]
        v_curr = t_data["v_curr"]
        v_pct = t_data["v_pct"]
        s_curr = t_data["s_curr"]
        s_diff = t_data["s_diff"]
        c_lvl = t_data["c_lvl"]
        alert_cnt = t_data["alert_cnt"]
        ts_iso = t_data["ts_iso"]
        is_stale = t_data["is_stale"]
        speed_limit = float(r.speed_limit or 60)

        # -------------------------------------------------------------
        # RULE 1: HIGH_RISK_CORRIDOR (Active Incident Alert + Congestion)
        # -------------------------------------------------------------
        if c_lvl in ["HIGH", "CRITICAL"] and alert_cnt > 0:
            recommendations.append({
                "id": f"rec-risk-{r.id}",
                "road_id": r.id,
                "road_code": r.road_code or f"RD-{r.id:03d}",
                "road_name": r.road_name,
                "zone": r.zone,
                "recommendation_type": "HIGH_RISK_CORRIDOR",
                "severity": "CRITICAL",
                "message": f"CRITICAL: Active incident dispatch alert on {r.road_name} with heavy congestion.",
                "explainable_rationale": f"High vehicle volume ({v_curr} veh) combined with active dispatch alert #{alert_cnt}.",
                "supporting_metrics": {
                    "vehicle_count": v_curr,
                    "average_speed": s_curr,
                    "congestion_level": c_lvl,
                    "speed_limit": speed_limit,
                    "volume_change_pct": v_pct,
                    "speed_change_kmh": s_diff,
                    "active_alert_count": alert_cnt,
                    "timestamp": ts_iso,
                    "is_stale": is_stale
                },
                "generated_at": now.isoformat()
            })
            continue

        # -------------------------------------------------------------
        # RULE 2: CONGESTION_WARNING (High / Critical Congestion)
        # -------------------------------------------------------------
        if c_lvl in ["HIGH", "CRITICAL"] or s_curr < (speed_limit * 0.6):
            sev = "CRITICAL" if c_lvl == "CRITICAL" else "HIGH"
            recommendations.append({
                "id": f"rec-cong-{r.id}",
                "road_id": r.id,
                "road_code": r.road_code or f"RD-{r.id:03d}",
                "road_name": r.road_name,
                "zone": r.zone,
                "recommendation_type": "CONGESTION_WARNING",
                "severity": sev,
                "message": f"{r.road_name} is experiencing elevated {c_lvl} congestion. Speeds dropped to {s_curr} km/h.",
                "explainable_rationale": f"Vehicle volume is {v_curr} veh with average speed {s_curr} km/h (speed limit: {speed_limit} km/h).",
                "supporting_metrics": {
                    "vehicle_count": v_curr,
                    "average_speed": s_curr,
                    "congestion_level": c_lvl,
                    "speed_limit": speed_limit,
                    "volume_change_pct": v_pct,
                    "speed_change_kmh": s_diff,
                    "timestamp": ts_iso,
                    "is_stale": is_stale
                },
                "generated_at": now.isoformat()
            })
            continue

        # -------------------------------------------------------------
        # RULE 3: SPEED_REDUCTION (Sudden Speed Drop or Below Threshold)
        # -------------------------------------------------------------
        if s_diff <= -3.0 or s_curr < (speed_limit * 0.75):
            recommendations.append({
                "id": f"rec-spd-{r.id}",
                "road_id": r.id,
                "road_code": r.road_code or f"RD-{r.id:03d}",
                "road_name": r.road_name,
                "zone": r.zone,
                "recommendation_type": "SPEED_REDUCTION",
                "severity": "MODERATE",
                "message": f"Speed reduction advisory on {r.road_name}. Current average speed is {s_curr} km/h ({s_diff} km/h change).",
                "explainable_rationale": f"Average speed reduced to {s_curr} km/h compared to corridor speed limit of {speed_limit} km/h.",
                "supporting_metrics": {
                    "vehicle_count": v_curr,
                    "average_speed": s_curr,
                    "congestion_level": c_lvl,
                    "speed_limit": speed_limit,
                    "volume_change_pct": v_pct,
                    "speed_change_kmh": s_diff,
                    "timestamp": ts_iso,
                    "is_stale": is_stale
                },
                "generated_at": now.isoformat()
            })
            continue

        # -------------------------------------------------------------
        # RULE 4: TRAFFIC_INCREASE (Rapid Volume Growth)
        # -------------------------------------------------------------
        if v_pct >= 15.0:
            recommendations.append({
                "id": f"rec-volup-{r.id}",
                "road_id": r.id,
                "road_code": r.road_code or f"RD-{r.id:03d}",
                "road_name": r.road_name,
                "zone": r.zone,
                "recommendation_type": "TRAFFIC_INCREASE",
                "severity": "MODERATE",
                "message": f"Traffic volume on {r.road_name} increased by +{v_pct}% over recent readings.",
                "explainable_rationale": f"Short-term vehicle volume surged from previous baseline to {v_curr} veh.",
                "supporting_metrics": {
                    "vehicle_count": v_curr,
                    "average_speed": s_curr,
                    "congestion_level": c_lvl,
                    "speed_limit": speed_limit,
                    "volume_change_pct": v_pct,
                    "speed_change_kmh": s_diff,
                    "timestamp": ts_iso,
                    "is_stale": is_stale
                },
                "generated_at": now.isoformat()
            })
            continue

        # -------------------------------------------------------------
        # RULE 5: STABLE_TRAFFIC (Optimal Low Congestion Flow)
        # -------------------------------------------------------------
        recommendations.append({
            "id": f"rec-stable-{r.id}",
            "road_id": r.id,
            "road_code": r.road_code or f"RD-{r.id:03d}",
            "road_name": r.road_name,
            "zone": r.zone,
            "recommendation_type": "STABLE_TRAFFIC",
            "severity": "LOW",
            "message": f"{r.road_name} traffic flow is optimal and stable at {s_curr} km/h.",
            "explainable_rationale": f"Low vehicle density ({v_curr} veh) with smooth speed flow.",
            "supporting_metrics": {
                "vehicle_count": v_curr,
                "average_speed": s_curr,
                "congestion_level": c_lvl,
                "speed_limit": speed_limit,
                "volume_change_pct": v_pct,
                "speed_change_kmh": s_diff,
                "timestamp": ts_iso,
                "is_stale": is_stale
            },
            "generated_at": now.isoformat()
        })

    # -------------------------------------------------------------
    # RULE 6: SAME-ZONE ALTERNATIVE CORRIDOR RECOMMENDATIONS
    # -------------------------------------------------------------
    # Group roads by zone to find lower-congestion alternatives
    zone_groups = {}
    for r_id, t_data in road_telemetry_map.items():
        z = t_data["road"].zone
        if z not in zone_groups:
            zone_groups[z] = []
        zone_groups[z].append(t_data)

    for z_name, members in zone_groups.items():
        if len(members) < 2:
            continue

        # Sort members by congestion score ascending, speed descending
        congested_corridors = [m for m in members if m["c_lvl"] in ["HIGH", "CRITICAL", "MODERATE"]]
        clear_corridors = [m for m in members if m["c_lvl"] in ["LOW", "MODERATE"]]

        for cong in congested_corridors:
            for alt in clear_corridors:
                if alt["road"].id != cong["road"].id and (alt["s_curr"] > cong["s_curr"] + 5.0 or severity_order.get(alt["c_lvl"], 1) < severity_order.get(cong["c_lvl"], 1)):
                    recommendations.append({
                        "id": f"rec-alt-{cong['road'].id}-{alt['road'].id}",
                        "road_id": cong["road"].id,
                        "road_code": cong["road"].road_code or f"RD-{cong['road'].id:03d}",
                        "road_name": cong["road"].road_name,
                        "zone": z_name,
                        "recommendation_type": "ALTERNATIVE_ROUTE_SUGGESTION",
                        "severity": "MODERATE" if cong["c_lvl"] in ["HIGH", "CRITICAL"] else "LOW",
                        "message": f"Alternative Corridor: {alt['road'].road_name} ({alt['road'].road_code or 'RD'}) in {z_name} currently has lower congestion ({alt['c_lvl']}) and higher speed ({alt['s_curr']} km/h) compared to {cong['road'].road_name} ({cong['c_lvl']}, {cong['s_curr']} km/h).",
                        "explainable_rationale": f"Spatial zone telemetry comparison in {z_name}. Speed delta: +{round(alt['s_curr'] - cong['s_curr'], 1)} km/h.",
                        "supporting_metrics": {
                            "vehicle_count": cong["v_curr"],
                            "average_speed": cong["s_curr"],
                            "congestion_level": cong["c_lvl"],
                            "speed_limit": float(cong["road"].speed_limit or 60),
                            "timestamp": cong["ts_iso"],
                            "is_stale": cong["is_stale"]
                        },
                        "alternative_corridor": {
                            "road_id": alt["road"].id,
                            "road_code": alt["road"].road_code or f"RD-{alt['road'].id:03d}",
                            "road_name": alt["road"].road_name,
                            "congestion_level": alt["c_lvl"],
                            "average_speed": alt["s_curr"],
                            "vehicle_count": alt["v_curr"]
                        },
                        "generated_at": now.isoformat()
                    })
                    break # One alternative per congested road is sufficient

    # Sort recommendations by severity descending
    recommendations.sort(key=lambda x: severity_order.get(x["severity"], 1), reverse=True)
    return recommendations
