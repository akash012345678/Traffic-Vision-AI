from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.database.session import get_db
from app.middleware.dependencies import require_roles
from app.repositories.road_repository import RoadRepository
from app.repositories.operator_repository import OperatorRepository
from app.repositories.traffic_repository import TrafficRepository
from app.repositories.alert_repository import AlertRepository

router = APIRouter(
    prefix="/admin",
    tags=["Admin Operations"],
    dependencies=[Depends(require_roles(["Admin"]))]
)

# --- REQUEST SCHEMAS ---
class CreateRoadRequest(BaseModel):
    road_name: str
    zone: str
    latitude: float = 0.0
    longitude: float = 0.0
    assigned_operator_id: Optional[int] = None

class UpdateRoadRequest(BaseModel):
    road_name: Optional[str] = None
    zone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    assigned_operator_id: Optional[int] = None

class AssignOperatorRequest(BaseModel):
    operator_id: Optional[int] = None

class CreateOperatorRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    zone: Optional[str] = "Zone Alpha"
    shift: Optional[str] = "Day Shift (08:00 - 16:00)"
    designation: Optional[str] = "Senior Traffic Controller"
    avatar_url: Optional[str] = None
    assigned_roads: Optional[List[int]] = []
    status: Optional[str] = "ACTIVE"

class UpdateOperatorRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    zone: Optional[str] = None
    shift: Optional[str] = None
    designation: Optional[str] = None
    avatar_url: Optional[str] = None
    assigned_roads: Optional[List[int]] = None
    status: Optional[str] = None


class UpdateOperatorStatusRequest(BaseModel):
    status: str

class AssignOperatorRoadsRequest(BaseModel):
    zone: Optional[str] = None
    road_ids: List[int] = []

class SettingsRequest(BaseModel):
    camera_latency_threshold_ms: int = 150
    prediction_interval_minutes: int = 15
    auto_signal_override: bool = True
    theme: str = "dark"
    email_notifications: bool = True

# --- 1. ADMIN CONTROL CENTER DASHBOARD STATS ---
@router.get("/dashboard-stats")
def get_admin_dashboard_stats(db: Session = Depends(get_db)):
    summary = TrafficRepository.get_dashboard_summary_metrics(db)
    trends = TrafficRepository.get_traffic_trend_chart_data(db)
    monitoring = TrafficRepository.get_live_monitoring(db, page_size=6)
    alerts = AlertRepository.get_alerts(db)[:5]
    operators = OperatorRepository.get_all_operators(db)[:6]

    recent_activity = [
        {"id": 1, "text": "Corridor duty scoping updated across active zones", "timestamp": "2 mins ago", "type": "assignment"},
        {"id": 2, "text": "High congestion alert cleared on West Arterial", "timestamp": "14 mins ago", "type": "alert"},
        {"id": 3, "text": "Control Center telemetry session active", "timestamp": "28 mins ago", "type": "auth"},
        {"id": 4, "text": "Telemetry sync complete across edge cameras", "timestamp": "45 mins ago", "type": "system"},
    ]

    return {
        "summary_metrics": summary,
        "traffic_trends": trends,
        "congestion_distribution": summary["congestion_distribution"],
        "live_traffic_summary": monitoring["items"],
        "recent_alerts": alerts,
        "operator_activity": operators,
        "recent_system_activity": recent_activity
    }

# --- 2. ROAD MANAGEMENT CRUD ---
@router.get("/roads")
def list_roads(
    search: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("id"),
    sort_order: Optional[str] = Query("asc"),
    page: Optional[int] = Query(None),
    limit: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return RoadRepository.get_all_roads(
        db,
        search=search,
        zone=zone,
        status_filter=status,
        sort_by=sort_by or "id",
        sort_order=sort_order or "asc",
        page=page,
        limit=limit
    )

@router.get("/roads/{road_id}")
def get_road(road_id: int, db: Session = Depends(get_db)):
    road = RoadRepository.get_road_by_id(db, road_id)
    if not road:
        raise HTTPException(status_code=404, detail="Road corridor not found")
    return road

@router.post("/roads", status_code=status.HTTP_201_CREATED)
def create_road(payload: CreateRoadRequest, db: Session = Depends(get_db)):
    road = RoadRepository.create_road(db, payload.dict())
    return {
        "message": f"Road corridor '{road['road_name']}' created successfully",
        "road_id": road['id'],
        "road": road
    }

@router.put("/roads/{road_id}")
def update_road(road_id: int, payload: UpdateRoadRequest, db: Session = Depends(get_db)):
    updated = RoadRepository.update_road(db, road_id, payload.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Road corridor not found")
    return {"message": "Road corridor updated successfully", "road_id": updated['id'], "road": updated}

@router.delete("/roads/{road_id}")
def delete_road(road_id: int, db: Session = Depends(get_db)):
    success = RoadRepository.delete_road(db, road_id)
    if not success:
        raise HTTPException(status_code=404, detail="Road corridor not found")
    return {"message": "Road corridor deleted successfully"}

@router.put("/roads/{road_id}/assign")
def assign_road(road_id: int, payload: AssignOperatorRequest, db: Session = Depends(get_db)):
    updated = RoadRepository.assign_operator(db, road_id, payload.operator_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Road corridor not found")
    return {
        "message": "Operator assignment updated",
        "road_id": updated['id'],
        "road_name": updated['road_name'],
        "assigned_operator_name": updated['assigned_operator_name']
    }

from app.utils.cache import ttl_cache

# --- 3. OPERATOR MANAGEMENT CRUD ---
@router.get("/operators")
def list_operators(
    search: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve filtered list of traffic operators."""
    cache_key = f"admin_operators_list_{search or 'all'}_{zone or 'all'}_{status or 'all'}"
    cached = ttl_cache.get(cache_key)
    if cached:
        return cached

    res = OperatorRepository.get_all_operators(db, search=search, zone=zone, status_filter=status)
    ttl_cache.set(cache_key, res, ttl_seconds=300)
    return res

@router.get("/operators/{operator_id}")
def get_operator(operator_id: int, db: Session = Depends(get_db)):
    """Retrieve detailed operator profile by ID."""
    op = OperatorRepository.get_operator_by_id(db, operator_id)
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found.")
    return op

@router.post("/operators", status_code=status.HTTP_201_CREATED)
def create_operator(payload: CreateOperatorRequest, db: Session = Depends(get_db)):
    """
    Provision a new Traffic Operator.
    Automatically generates a secure temporary password, bcrypt hashes it, stores only the hash in Supabase,
    and returns the temporary password ONCE in the response.
    """
    return OperatorRepository.create_operator(db, payload.dict())

@router.put("/operators/{operator_id}")
def update_operator(operator_id: int, payload: UpdateOperatorRequest, db: Session = Depends(get_db)):
    """Update operator profile details (Name, Email, Phone, Zone, Status)."""
    return OperatorRepository.update_operator(db, operator_id, payload.dict(exclude_unset=True))

@router.delete("/operators/{operator_id}")
def delete_operator(operator_id: int, db: Session = Depends(get_db)):
    """Delete an operator and unassign their roads."""
    OperatorRepository.delete_operator(db, operator_id)
    return {"message": "Operator deleted successfully."}

@router.put("/operators/{operator_id}/status")
def update_operator_status(operator_id: int, payload: UpdateOperatorStatusRequest, db: Session = Depends(get_db)):
    """Activate or Deactivate an operator account."""
    return OperatorRepository.update_operator_status(db, operator_id, payload.status)

@router.post("/operators/{operator_id}/reset-password")
def reset_operator_password(operator_id: int, db: Session = Depends(get_db)):
    """Reset operator password with auto-generated temporary password."""
    return OperatorRepository.reset_operator_password(db, operator_id)

@router.put("/operators/{operator_id}/assign-roads")
def assign_operator_roads(operator_id: int, payload: AssignOperatorRoadsRequest, db: Session = Depends(get_db)):
    """Assign zone and multiple road corridors to an operator."""
    return OperatorRepository.assign_operator_roads(db, operator_id, payload.zone, payload.road_ids)

@router.get("/operators/{operator_id}/roads")
def get_operator_roads(operator_id: int, db: Session = Depends(get_db)):
    """Retrieve roads assigned to a specific operator."""
    return OperatorRepository.get_operator_roads(db, operator_id)

# --- 4. ALERTS OPERATIONS ---
@router.get("/alerts")
def get_alerts(
    severity: str = Query("ALL"),
    status: str = Query("ALL"),
    db: Session = Depends(get_db)
):
    return AlertRepository.get_alerts(db, severity=severity, status=status)

@router.put("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    res = AlertRepository.resolve_alert(db, alert_id)
    if not res:
        raise HTTPException(status_code=404, detail="Alert record not found")
    return res

# --- 5. SYSTEM SETTINGS ---
@router.get("/settings")
def get_settings():
    return {
        "camera_latency_threshold_ms": 150,
        "prediction_interval_minutes": 15,
        "auto_signal_override": True,
        "theme": "dark",
        "email_notifications": True
    }

@router.put("/settings")
def update_settings(payload: SettingsRequest):
    return {"message": "System configuration updated successfully", "settings": payload.dict()}
