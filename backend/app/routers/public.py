from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from datetime import datetime, timezone

from app.database.session import get_db
from app.models.models import Road, TrafficData, Alert, Zone, UserFavoriteRoad, User
from app.middleware.dependencies import get_current_user

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

@router.get("/traffic/heatmap")
def get_public_traffic_heatmap(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Public Read-Only Endpoint: Returns geographic traffic density & heatmap intensity values
    calculated strictly from real database telemetry.
    """
    roads = db.query(Road).filter(Road.status == "Active").order_by(Road.id).all()
    heatmap_points = []

    for r in roads:
        latest = (
            db.query(TrafficData)
            .filter(TrafficData.road_id == r.id)
            .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
            .first()
        )

        congestion = (latest.congestion_level if latest else "LOW").upper()
        v_count = latest.vehicle_count if latest else 0
        speed = latest.average_speed if latest else float(r.speed_limit or 60)

        # Intensity scoring mapped directly from real DB congestion level & vehicle count
        if congestion in ["CRITICAL", "SEVERE"]:
            intensity = 1.00
            heat_color = "#ef4444" # Crimson Red
            radius_meters = 750
        elif congestion == "HIGH":
            intensity = 0.75
            heat_color = "#f97316" # Orange
            radius_meters = 600
        elif congestion == "MODERATE":
            intensity = 0.50
            heat_color = "#f59e0b" # Amber/Yellow
            radius_meters = 450
        else: # LOW
            intensity = 0.25
            heat_color = "#10b981" # Emerald Green
            radius_meters = 300

        ts_iso = (
            latest.timestamp.isoformat()
            if (latest and latest.timestamp)
            else (r.updated_at.isoformat() if r.updated_at else datetime.now(timezone.utc).isoformat())
        )

        heatmap_points.append({
            "road_id": r.id,
            "road_name": r.road_name,
            "road_code": r.road_code or f"RD-{r.id:03d}",
            "zone": r.zone,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "vehicle_count": v_count,
            "average_speed": speed,
            "congestion_level": congestion,
            "intensity": intensity,
            "heat_color": heat_color,
            "radius_meters": radius_meters,
            "last_updated_at": ts_iso
        })

    return heatmap_points

@router.get("/me/favorites")
def get_user_favorite_roads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Authenticated Public Endpoint: Returns favorite corridors for the logged-in user.
    """
    favs = db.query(UserFavoriteRoad).filter(UserFavoriteRoad.user_id == current_user.id).all()
    fav_road_ids = [f.road_id for f in favs]

    if not fav_road_ids:
        return []

    roads = db.query(Road).filter(Road.id.in_(fav_road_ids), Road.status == "Active").all()
    results = []

    for r in roads:
        latest = (
            db.query(TrafficData)
            .filter(TrafficData.road_id == r.id)
            .order_by(TrafficData.timestamp.desc(), TrafficData.id.desc())
            .first()
        )
        active_alert_count = db.query(Alert).filter(Alert.road_id == r.id, Alert.status == "Active").count()

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
            "vehicle_count": latest.vehicle_count if latest else 0,
            "average_speed": latest.average_speed if latest else float(r.speed_limit or 60),
            "congestion_level": (latest.congestion_level if latest else "LOW").upper(),
            "active_alerts_count": active_alert_count,
            "last_updated_at": ts_iso,
            "is_favorite": True
        })

    return results

@router.post("/me/favorites/{road_id}")
def add_user_favorite_road(
    road_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticated Public Endpoint: Adds a road corridor to the logged-in user's favorites.
    """
    road = db.query(Road).filter(Road.id == road_id).first()
    if not road:
        raise HTTPException(status_code=404, detail="Road corridor not found.")

    existing = db.query(UserFavoriteRoad).filter(
        UserFavoriteRoad.user_id == current_user.id,
        UserFavoriteRoad.road_id == road_id
    ).first()

    if not existing:
        new_fav = UserFavoriteRoad(user_id=current_user.id, road_id=road_id)
        db.add(new_fav)
        db.commit()

    return {"message": "Corridor added to favorites successfully.", "road_id": road_id, "is_favorite": True}

@router.delete("/me/favorites/{road_id}")
def remove_user_favorite_road(
    road_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticated Public Endpoint: Removes a road corridor from the logged-in user's favorites.
    """
    existing = db.query(UserFavoriteRoad).filter(
        UserFavoriteRoad.user_id == current_user.id,
        UserFavoriteRoad.road_id == road_id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()

    return {"message": "Corridor removed from favorites successfully.", "road_id": road_id, "is_favorite": False}

from app.services.recommendation_engine import generate_traffic_recommendations

@router.get("/recommendations")
def get_public_traffic_recommendations(
    road_id: int = None,
    zone: str = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Public Read-Only Endpoint: Returns public-safe AI traffic advisories and recommendations.
    Uses 100% real database telemetry to recommend lower-congestion corridors and explainable speed alerts.
    """
    recs = generate_traffic_recommendations(db, road_id=road_id, zone=zone, is_public_safe=True)
    return {
        "count": len(recs),
        "recommendations": recs,
        "data_source": "AI Traffic Telemetry / Supabase Cloud PostgreSQL"
    }

from app.services.prediction_engine import train_and_predict_traffic, get_congestion_forecasts, get_travel_time_estimates

@router.get("/predictions")
def get_public_traffic_predictions(
    road_id: int = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Public Read-Only Endpoint: Returns 15-minute ahead machine-learning traffic predictions.
    Clearly labeled 'AI Traffic Prediction' with prediction horizon and 100% real DB telemetry metrics.
    """
    return train_and_predict_traffic(db, road_id=road_id, is_public_safe=True)

@router.get("/predictions/congestion")
def get_public_congestion_forecasts(
    road_id: int = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Public Read-Only Endpoint: Returns 15-minute data-driven AI Congestion Forecasts.
    Clearly labeled 'AI Congestion Forecast' with prediction horizon and explainable DB rationale.
    """
    return get_congestion_forecasts(db, road_id=road_id, is_public_safe=True)

@router.get("/travel-time")
def get_public_travel_time_estimates(
    road_id: int = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Public Read-Only Endpoint: Returns corridor travel-time estimates and 15m delay predictions.
    Calculates exact transit time from distance (km) / speed (km/h) * 60.
    """
    return get_travel_time_estimates(db, road_id=road_id, is_public_safe=True)
