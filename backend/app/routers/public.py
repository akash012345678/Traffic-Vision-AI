from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from datetime import datetime, timezone

from app.database.session import get_db
from app.models.models import Road, TrafficData, Alert, Zone

router = APIRouter(prefix="/public", tags=["Public Transparency Portal"])

@router.get("/dashboard-stats")
def get_public_dashboard_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Public Read-Only Endpoint: Returns live city-wide traffic metrics.
    Uses real database telemetry and road records without exposing sensitive credentials.
    """
    # 1. Total active monitored roads
    total_roads = db.query(Road).filter(Road.status == "Active").count()

    # 2. Get latest telemetry for each active road
    active_roads = db.query(Road).filter(Road.status == "Active").all()
    road_ids = [r.id for r in active_roads]

    low_count = 0
    moderate_count = 0
    high_count = 0
    critical_count = 0
    latest_timestamp = None

    for r in active_roads:
        latest = (
            db.query(TrafficData)
            .filter(TrafficData.road_id == r.id)
            .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
            .first()
        )
        if latest:
            lvl = (latest.congestion_level or "LOW").upper()
            if latest.timestamp and (latest_timestamp is None or latest.timestamp > latest_timestamp):
                latest_timestamp = latest.timestamp
        else:
            lvl = "LOW"

        if lvl == "LOW":
            low_count += 1
        elif lvl == "MODERATE":
            moderate_count += 1
        elif lvl == "HIGH":
            high_count += 1
        elif lvl in ["CRITICAL", "SEVERE"]:
            critical_count += 1
        else:
            low_count += 1

    # 3. Active Public Alerts
    active_alerts_count = db.query(Alert).filter(Alert.status == "Active").count()

    # Formatted ISO timestamp
    last_updated_iso = (
        latest_timestamp.isoformat()
        if latest_timestamp
        else datetime.now(timezone.utc).isoformat()
    )

    return {
        "total_monitored_roads": total_roads,
        "low_congestion_count": low_count,
        "moderate_congestion_count": moderate_count,
        "high_congestion_count": high_count,
        "critical_congestion_count": critical_count,
        "active_public_alerts_count": active_alerts_count,
        "last_updated_at": last_updated_iso
    }

@router.get("/roads")
def get_public_roads(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Public Read-Only Endpoint: Returns list of monitored road corridors.
    Includes congestion, vehicle count, speed, and location. Excludes operator personal data.
    """
    roads = db.query(Road).filter(Road.status == "Active").order_by(Road.id).all()
    results = []

    for r in roads:
        latest = (
            db.query(TrafficData)
            .filter(TrafficData.road_id == r.id)
            .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
            .first()
        )

        ts_iso = (
            latest.timestamp.isoformat()
            if (latest and latest.timestamp)
            else (r.updated_at.isoformat() if r.updated_at else datetime.now(timezone.utc).isoformat())
        )

        results.append({
            "id": r.id,
            "road_code": r.road_code or f"RD-{r.id:03d}",
            "road_name": r.road_name,
            "zone": r.zone,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "length_km": r.length_km or 2.5,
            "lanes": r.lanes or 4,
            "speed_limit": r.speed_limit or 60,
            "vehicle_count": latest.vehicle_count if latest else 0,
            "average_speed": latest.average_speed if latest else float(r.speed_limit or 60),
            "congestion_level": (latest.congestion_level if latest else "LOW").upper(),
            "confidence": round(latest.confidence, 2) if (latest and latest.confidence is not None) else 0.85,
            "last_updated_at": ts_iso
        })

    return results

@router.get("/roads/{road_id}")
def get_public_road_detail(road_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Public Read-Only Endpoint: Returns detailed public telemetry for a specific road.
    """
    r = db.query(Road).filter(Road.id == road_id, Road.status == "Active").first()
    if not r:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitored road corridor not found or unavailable."
        )

    latest = (
        db.query(TrafficData)
        .filter(TrafficData.road_id == r.id)
        .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
        .first()
    )

    recent_records = (
        db.query(TrafficData)
        .filter(TrafficData.road_id == r.id)
        .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
        .limit(5)
        .all()
    )

    history = [
        {
            "id": item.id,
            "timestamp": item.timestamp.isoformat() if item.timestamp else None,
            "vehicle_count": item.vehicle_count or 0,
            "average_speed": item.average_speed or 0.0,
            "congestion_level": (item.congestion_level or "LOW").upper()
        }
        for item in recent_records
    ]

    ts_iso = (
        latest.timestamp.isoformat()
        if (latest and latest.timestamp)
        else (r.updated_at.isoformat() if r.updated_at else datetime.now(timezone.utc).isoformat())
    )

    return {
        "id": r.id,
        "road_code": r.road_code or f"RD-{r.id:03d}",
        "road_name": r.road_name,
        "zone": r.zone,
        "latitude": r.latitude,
        "longitude": r.longitude,
        "length_km": r.length_km or 2.5,
        "lanes": r.lanes or 4,
        "speed_limit": r.speed_limit or 60,
        "vehicle_count": latest.vehicle_count if latest else 0,
        "car_count": latest.car_count if latest else 0,
        "motorcycle_count": latest.motorcycle_count if latest else 0,
        "bus_count": latest.bus_count if latest else 0,
        "truck_count": latest.truck_count if latest else 0,
        "average_speed": latest.average_speed if latest else float(r.speed_limit or 60),
        "congestion_level": (latest.congestion_level if latest else "LOW").upper(),
        "confidence": round(latest.confidence, 2) if (latest and latest.confidence is not None) else 0.85,
        "last_updated_at": ts_iso,
        "telemetry_history": history
    }

@router.get("/alerts")
def get_public_alerts(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Public Read-Only Endpoint: Returns list of active public traffic advisories and incident alerts.
    Excludes internal operator identity data.
    """
    alerts = db.query(Alert).filter(Alert.status == "Active").order_by(Alert.created_at.desc()).all()
    results = []

    for a in alerts:
        road = db.query(Road).filter(Road.id == a.road_id).first()
        results.append({
            "id": a.id,
            "alert_code": f"#ALT-{a.id:03d}",
            "alert_type": a.alert_type,
            "severity": a.severity,
            "status": a.status,
            "road_id": a.road_id,
            "road_name": road.road_name if road else f"Corridor #{a.road_id}",
            "zone": road.zone if road else "Central Zone",
            "notes": a.notes or "Public Advisory: Active traffic delay reported along this corridor.",
            "created_at": a.created_at.isoformat() if a.created_at else datetime.now(timezone.utc).isoformat()
        })

    return results

@router.get("/map-data")
def get_public_map_data(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Public Read-Only Endpoint: Returns spatial nodes and real-time corridor congestion status for Map rendering.
    """
    roads = db.query(Road).filter(Road.status == "Active").order_by(Road.id).all()
    nodes = []

    for r in roads:
        latest = (
            db.query(TrafficData)
            .filter(TrafficData.road_id == r.id)
            .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
            .first()
        )

        nodes.append({
            "id": r.id,
            "road_name": r.road_name,
            "road_code": r.road_code or f"RD-{r.id:03d}",
            "zone": r.zone,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "vehicle_count": latest.vehicle_count if latest else 0,
            "average_speed": latest.average_speed if latest else float(r.speed_limit or 60),
            "congestion_level": (latest.congestion_level if latest else "LOW").upper()
        })

    return nodes
