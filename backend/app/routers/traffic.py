from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database.session import get_db
from app.repositories.traffic_repository import TrafficRepository
from app.repositories.road_repository import RoadRepository
from app.middleware.dependencies import get_current_user
from app.models.models import User

router = APIRouter(prefix="/traffic", tags=["Traffic Telemetry Operations"])

@router.get("/monitoring")

def get_live_traffic_monitoring(
    search: str = Query(""),
    zone: str = Query("ALL"),
    status: str = Query("ALL"),
    sort_by: str = Query("road_name"),
    order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    operator_id: Optional[int] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Live Traffic Monitoring API with Search, Zone/Status Filtering, Sorting, and Pagination.
    Directly queries Supabase PostgreSQL telemetry tables.
    - Admin: queries all roads across the city when operator_id is None.
    - Operator: queries ONLY roads assigned to current_user.id.
    """
    effective_op_id = operator_id
    if current_user and (current_user.role or "").upper() == "OPERATOR":
        effective_op_id = current_user.id

    return TrafficRepository.get_live_monitoring(
        db,
        operator_id=effective_op_id,
        search=search,
        zone=zone,
        status=status,
        sort_by=sort_by,
        order=order,
        page=page,
        page_size=page_size
    )


from app.utils.cache import ttl_cache

@router.get("/roads/{road_id}")
def get_road_telemetry_detail(road_id: int, db: Session = Depends(get_db)):
    """Retrieve road corridor metadata, recent alerts, and past telemetry history logs with 5-minute TTL caching."""
    cache_key = f"road_telemetry_detail_{road_id}"
    cached = ttl_cache.get(cache_key)
    if cached:
        return cached

    road = RoadRepository.get_road_by_id(db, road_id)
    if not road:
        raise HTTPException(status_code=404, detail="Road corridor not found")

    from app.models.models import TrafficData, Alert
    history = db.query(TrafficData).filter(TrafficData.road_id == road_id).order_by(TrafficData.timestamp.desc()).limit(15).all()
    recent_alerts = db.query(Alert).filter(Alert.road_id == road_id).order_by(Alert.created_at.desc()).limit(10).all()

    latest = history[0] if history else None
    
    if isinstance(road, dict):
        road_id_val = road.get("id", road_id)
        road_code_val = road.get("road_code") or f"RD-{road_id_val:03d}"
        road_name_val = road.get("road_name", "Unknown Corridor")
        zone_val = road.get("zone", "Unassigned Zone")
        lat_val = road.get("latitude", 0.0)
        lng_val = road.get("longitude", 0.0)
        length_km_val = road.get("length_km", 2.5)
        lanes_val = road.get("lanes", 4)
        speed_limit_val = road.get("speed_limit", 60)
        status_val = road.get("status", "Active")
        created_at_val = road.get("created_at")
        updated_at_val = road.get("updated_at")
        op_info = road.get("assigned_operator") or {}
        op_id = road.get("assigned_operator_id") or op_info.get("id")
        op_name = op_info.get("name") or road.get("assigned_operator_name") or "Unassigned"
        op_email = op_info.get("email", "N/A")
    else:
        road_id_val = road.id
        road_code_val = road.road_code or f"RD-{road.id:03d}"
        road_name_val = road.road_name
        zone_val = road.zone
        lat_val = road.latitude
        lng_val = road.longitude
        length_km_val = getattr(road, "length_km", 2.5)
        lanes_val = getattr(road, "lanes", 4)
        speed_limit_val = getattr(road, "speed_limit", 60)
        status_val = road.status or "Active"
        created_at_val = road.created_at.isoformat() if getattr(road, "created_at", None) else None
        updated_at_val = road.updated_at.isoformat() if getattr(road, "updated_at", None) else None
        op_id = road.assigned_operator_id
        op_name = road.assigned_operator.name if road.assigned_operator else "Unassigned"
        op_email = road.assigned_operator.email if road.assigned_operator else "N/A"

    res = {
        "road_id": road_id_val,
        "road_code": road_code_val,
        "road_name": road_name_val,
        "zone": zone_val,
        "latitude": lat_val,
        "longitude": lng_val,
        "length_km": length_km_val,
        "lanes": lanes_val,
        "speed_limit": speed_limit_val,
        "status": status_val,
        "created_at": created_at_val,
        "updated_at": updated_at_val,
        "assigned_operator": {
            "id": op_id,
            "name": op_name,
            "email": op_email
        },
        "current_telemetry": {
            "vehicle_count": latest.vehicle_count if latest else 0,
            "car_count": getattr(latest, "car_count", 0) if latest else 0,
            "bus_count": getattr(latest, "bus_count", 0) if latest else 0,
            "truck_count": getattr(latest, "truck_count", 0) if latest else 0,
            "motorcycle_count": getattr(latest, "motorcycle_count", 0) if latest else 0,
            "video_name": getattr(latest, "video_name", None) if latest else None,
            "average_speed": latest.average_speed if latest else 0.0,
            "congestion_level": latest.congestion_level if latest else "Low",
            "timestamp": latest.timestamp.isoformat() if (latest and latest.timestamp) else None,
            "confidence": latest.confidence if (latest and latest.confidence is not None) else None,
            "processed_at": latest.processed_at.isoformat() if (latest and latest.processed_at is not None) else None,
            "ai_status": "ACTIVE" if (latest and latest.confidence is not None) else "SEEDED"
        },
        "recent_alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "status": a.status,
                "notes": a.notes,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in recent_alerts
        ],
        "telemetry_history": [
            {
                "id": h.id,
                "vehicle_count": h.vehicle_count,
                "average_speed": h.average_speed,
                "congestion_level": h.congestion_level,
                "timestamp": h.timestamp.isoformat() if h.timestamp else None,
                "confidence": h.confidence if h.confidence is not None else None,
                "processed_at": h.processed_at.isoformat() if h.processed_at is not None else None,
                "ai_status": "ACTIVE" if h.confidence is not None else "SEEDED"
            }
            for h in history
        ]
    }
    ttl_cache.set(cache_key, res, ttl_seconds=300)
    return res

@router.get("/road/{road_id}/telemetry")
@router.get("/roads/{road_id}/telemetry")
def get_live_road_telemetry_stream(road_id: int, db: Session = Depends(get_db)):
    """
    GET /api/v1/traffic/road/{road_id}/telemetry or /api/v1/traffic/roads/{road_id}/telemetry
    Returns uncached real-time live telemetry snapshot and time-series history for a road corridor.
    """
    telemetry = TrafficRepository.get_road_live_telemetry(db, road_id)
    if not telemetry:
        raise HTTPException(status_code=404, detail="Road corridor not found")
    return telemetry

