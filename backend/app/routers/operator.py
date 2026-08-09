from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import func

from app.database.session import get_db
from app.models.models import User, Road, Alert, TrafficData
from app.middleware.dependencies import get_current_user, require_roles

router = APIRouter(
    prefix="/operator",
    tags=["Operator Operations"],
    dependencies=[Depends(require_roles(["Operator", "Admin"]))]
)

class UpdateRoadStatusRequest(BaseModel):
    status: str  # e.g., "Low", "Moderate", "High", "Critical"

@router.get("/dashboard-stats")
def get_operator_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Operator API: Serves aggregate statistics and traffic table data strictly
    scoped to roads assigned to the authenticated operator.
    Fast path: returns HTTP 200 immediately if 0 roads are assigned.
    """
    if (current_user.role or "").upper() == "ADMIN":
        roads = db.query(Road).all()
    else:
        roads = db.query(Road).filter(Road.assigned_operator_id == current_user.id).all()

    assigned_roads_count = len(roads)

    # FAST PATH: Return immediately if no roads assigned (Task 4)
    if assigned_roads_count == 0:
        return {
            "assigned_roads": [],
            "alerts": [],
            "telemetry": [],
            "summary": {
                "vehicle_count": 0,
                "average_speed": 0,
                "active_alerts": 0
            },
            "message": "No roads assigned.",
            "metrics": {
                "assigned_roads": 0,
                "total_vehicle_count": 0,
                "active_alerts_count": 0,
                "congestion_status": "Low",
                "road_status": "No Corridors Assigned",
                "current_shift": "Duty Shift"
            },
            "assigned_roads_list": [],
            "active_alerts_list": []
        }

    assigned_road_ids = [r.id for r in roads]

    # Query active alerts strictly for assigned roads
    active_alerts = db.query(Alert).filter(
        Alert.road_id.in_(assigned_road_ids),
        func.lower(Alert.status) == "active"
    ).order_by(Alert.created_at.desc()).all()

    active_alerts_count = len(active_alerts)
    road_map = {r.id: r for r in roads}
    active_alerts_list = [
        {
            "id": a.id,
            "road_id": a.road_id,
            "road_name": road_map.get(a.road_id).road_name if road_map.get(a.road_id) else "Unknown Corridor",
            "alert_type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in active_alerts
    ]

    # Calculate Current Duty Shift
    hour = datetime.now().hour
    if 6 <= hour < 14:
        current_shift = "Morning Shift (06:00 - 14:00)"
    elif 14 <= hour < 22:
        current_shift = "Afternoon/Evening Shift (14:00 - 22:00)"
    else:
        current_shift = "Night Shift (22:00 - 06:00)"

    # Single-pass batch fetch latest telemetry
    subq = (
        db.query(
            TrafficData.road_id,
            func.max(TrafficData.timestamp).label("max_ts")
        )
        .filter(TrafficData.road_id.in_(assigned_road_ids))
        .group_by(TrafficData.road_id)
        .subquery()
    )
    latest_telemetry_list = (
        db.query(TrafficData)
        .join(
            subq,
            (TrafficData.road_id == subq.c.road_id) & (TrafficData.timestamp == subq.c.max_ts)
        )
        .all()
    )
    telemetry_map = {t.road_id: t for t in latest_telemetry_list}

    total_vehicle_count = 0
    congestion_levels = []
    assigned_roads_list = []

    for r in roads:
        latest = telemetry_map.get(r.id)
        v_count = latest.vehicle_count if latest else 0
        speed = latest.average_speed if latest else 0.0
        level = latest.congestion_level if latest else "Low"

        is_ai = latest.confidence is not None if latest else False
        ai_status = "ACTIVE" if is_ai else "SEEDED"

        total_vehicle_count += v_count
        congestion_levels.append(level)

        assigned_roads_list.append({
            "id": r.id,
            "road_name": r.road_name,
            "road_code": r.road_code or f"RD-{r.id:03d}",
            "zone": r.zone,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "current_vehicle_count": v_count,
            "current_speed": speed,
            "congestion_level": level,
            "confidence": latest.confidence if (latest and latest.confidence is not None) else None,
            "processed_at": latest.processed_at.isoformat() if (latest and latest.processed_at is not None) else None,
            "ai_status": ai_status,
            "timestamp": latest.timestamp.isoformat() if (latest and latest.timestamp) else datetime.now().isoformat()
        })

    # Dominant Congestion Status
    if "Critical" in congestion_levels:
        dominant_status = "Critical"
    elif "High" in congestion_levels:
        dominant_status = "High"
    elif "Moderate" in congestion_levels:
        dominant_status = "Moderate"
    else:
        dominant_status = "Low"

    # Road Status Summary
    high_count = congestion_levels.count("High") + congestion_levels.count("Critical")
    if high_count > 0:
        road_status_summary = f"{high_count} Corridor Alert Active"
    else:
        road_status_summary = "All Corridors Operational"

    return {
        "assigned_roads": assigned_roads_list,
        "summary": {
            "vehicle_count": total_vehicle_count,
            "average_speed": round(sum(r["current_speed"] for r in assigned_roads_list) / max(1, len(assigned_roads_list)), 1),
            "congestion": dominant_status
        },
        "metrics": {
            "assigned_roads": assigned_roads_count,
            "total_vehicle_count": total_vehicle_count,
            "active_alerts_count": active_alerts_count,
            "congestion_status": dominant_status,
            "road_status": road_status_summary,
            "current_shift": current_shift
        },
        "assigned_roads_list": assigned_roads_list,
        "active_alerts_list": active_alerts_list
    }


@router.get("/roads")
def get_assigned_roads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Operator API: View ONLY roads assigned to the logged-in operator.
    Admins can view all roads.
    Fast path: returns empty list immediately if 0 roads are assigned.
    """
    if (current_user.role or "").upper() == "ADMIN":
        roads = db.query(Road).all()
    else:
        roads = db.query(Road).filter(Road.assigned_operator_id == current_user.id).all()

    if not roads:
        return []

    assigned_road_ids = [r.id for r in roads]
    subq = (
        db.query(
            TrafficData.road_id,
            func.max(TrafficData.timestamp).label("max_ts")
        )
        .filter(TrafficData.road_id.in_(assigned_road_ids))
        .group_by(TrafficData.road_id)
        .subquery()
    )
    latest_telemetry_list = (
        db.query(TrafficData)
        .join(
            subq,
            (TrafficData.road_id == subq.c.road_id) & (TrafficData.timestamp == subq.c.max_ts)
        )
        .all()
    )
    telemetry_map = {t.road_id: t for t in latest_telemetry_list}

    result = []
    for r in roads:
        latest_telemetry = telemetry_map.get(r.id)
        is_ai = latest_telemetry.confidence is not None if latest_telemetry else False
        ai_status = "ACTIVE" if is_ai else "SEEDED"
        result.append({
            "id": r.id,
            "road_name": r.road_name,
            "zone": r.zone,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "assigned_operator_id": r.assigned_operator_id,
            "current_vehicle_count": latest_telemetry.vehicle_count if latest_telemetry else 0,
            "current_speed": latest_telemetry.average_speed if latest_telemetry else 0.0,
            "congestion_level": latest_telemetry.congestion_level if latest_telemetry else "Low",
            "confidence": latest_telemetry.confidence if (latest_telemetry and latest_telemetry.confidence is not None) else None,
            "processed_at": latest_telemetry.processed_at.isoformat() if (latest_telemetry and latest_telemetry.processed_at is not None) else None,
            "ai_status": ai_status,
            "timestamp": latest_telemetry.timestamp.isoformat() if (latest_telemetry and latest_telemetry.timestamp) else datetime.now().isoformat()
        })
    return result

@router.get("/alerts")
def get_assigned_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Operator API: View ONLY alerts corresponding to roads assigned to the logged-in operator.
    Fast path: returns empty list immediately if 0 roads are assigned.
    """
    if (current_user.role or "").upper() == "ADMIN":
        alerts = db.query(Alert).all()
    else:
        assigned_road_ids = [r.id for r in db.query(Road.id).filter(Road.assigned_operator_id == current_user.id).all()]
        if not assigned_road_ids:
            return []
        alerts = db.query(Alert).filter(Alert.road_id.in_(assigned_road_ids)).all()

    road_ids = [a.road_id for a in alerts]
    roads = db.query(Road).filter(Road.id.in_(road_ids)).all() if road_ids else []
    road_map = {r.id: r for r in roads}

    result = []
    for a in alerts:
        road = road_map.get(a.road_id)
        result.append({
            "id": a.id,
            "road_id": a.road_id,
            "road_name": road.road_name if road else "Unknown",
            "alert_type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return result

@router.put("/roads/{road_id}/status")
def update_road_status(
    road_id: int,
    payload: UpdateRoadStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Operator API: Update status of an assigned road.
    Operators can only update roads assigned to them.
    """
    road = db.query(Road).filter(Road.id == road_id).first()
    if not road:
        raise HTTPException(status_code=404, detail="Road not found")

    if (current_user.role or "").upper() != "ADMIN" and road.assigned_operator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. You can only update roads assigned to your account."
        )

    # Insert or update latest telemetry record for status change
    latest_telemetry = db.query(TrafficData).filter(TrafficData.road_id == road.id).order_by(TrafficData.timestamp.desc()).first()
    if latest_telemetry:
        latest_telemetry.congestion_level = payload.status
    else:
        new_telemetry = TrafficData(
            road_id=road.id,
            vehicle_count=50,
            average_speed=40.0,
            congestion_level=payload.status
        )
        db.add(new_telemetry)

    db.commit()

    return {
        "message": f"Status for '{road.road_name}' updated successfully",
        "road_id": road.id,
        "new_status": payload.status
    }
