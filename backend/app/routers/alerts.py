from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, desc, asc
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.database.session import get_db
from app.models.models import Alert, Road, User
from app.middleware.dependencies import get_current_user
from app.schemas.alert import (
    CreateAlertSchema,
    UpdateAlertStatusSchema,
    AssignAlertSchema,
    UpdateAlertNotesSchema,
    AlertResponseSchema
)

router = APIRouter(prefix="/alerts", tags=["Alerts Management Operations"])

def format_alert_dict(a: Alert, db: Session = None) -> dict:
    # Use eagerly loaded relationships if available to eliminate N+1 SQL queries
    road_obj = getattr(a, "road", None)
    if not road_obj and db:
        road_obj = db.query(Road).filter(Road.id == a.road_id).first()
    
    assigned_op = None
    if getattr(a, "assigned_operator", None):
        op_user = a.assigned_operator
        assigned_op = {"id": op_user.id, "name": op_user.name, "email": op_user.email}
    elif a.assigned_operator_id and db:
        op_user = db.query(User).filter(User.id == a.assigned_operator_id).first()
        if op_user:
            assigned_op = {"id": op_user.id, "name": op_user.name, "email": op_user.email}
    elif road_obj and getattr(road_obj, "assigned_operator", None):
        op_user = road_obj.assigned_operator
        assigned_op = {"id": op_user.id, "name": op_user.name, "email": op_user.email}
    elif road_obj and road_obj.assigned_operator_id and db:
        op_user = db.query(User).filter(User.id == road_obj.assigned_operator_id).first()
        if op_user:
            assigned_op = {"id": op_user.id, "name": op_user.name, "email": op_user.email}

    road_data = None
    if road_obj:
        road_data = {
            "id": road_obj.id,
            "road_name": road_obj.road_name,
            "road_code": road_obj.road_code or f"RD-{road_obj.id:03d}",
            "zone": road_obj.zone
        }

    # History timeline log & resolution history
    created_str = a.created_at.isoformat() if a.created_at else None
    updated_str = a.updated_at.isoformat() if getattr(a, "updated_at", None) else created_str

    timeline = [
        {"id": 1, "event": "Incident Alert Registered", "details": f"Alert #{a.id} ({a.alert_type}) logged in Supabase PostgreSQL", "timestamp": created_str, "author": "Control Sensor Engine"},
    ]
    if assigned_op:
        timeline.append({"id": 2, "event": "Duty Operator Assigned", "details": f"Assigned to operator '{assigned_op['name']}' ({assigned_op['email']})", "timestamp": created_str, "author": "Control Desk"})
    if a.status and a.status.upper() != "ACTIVE":
        timeline.append({"id": 3, "event": f"Status Transition: {a.status}", "details": f"Incident alert status updated to '{a.status}'", "timestamp": updated_str, "author": assigned_op['name'] if assigned_op else "Control Desk"})

    resolution_history = []
    if a.notes:
        resolution_history.append({
            "id": 1,
            "notes": a.notes,
            "status": a.status,
            "attachment_url": getattr(a, "attachment_url", None),
            "updated_at": updated_str,
            "updated_by": assigned_op['name'] if assigned_op else "Operator"
        })

    return {
        "id": a.id,
        "alert_type": a.alert_type,
        "severity": a.severity,
        "status": a.status,
        "created_at": created_str,
        "updated_at": updated_str,
        "notes": a.notes,
        "attachment_url": getattr(a, "attachment_url", None),
        "road": road_data,
        "assigned_operator": assigned_op,
        "history": timeline,
        "timeline": timeline,
        "resolution_history": resolution_history
    }

@router.get("")
@router.get("/")
def list_alerts(
    search: str = Query(""),
    severity: str = Query("ALL"),
    status_filter: str = Query("ALL", alias="status"),
    alert_type: str = Query("ALL"),
    road_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=50),  # Capped page_size to 50 items max
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    GET /api/v1/alerts
    - Admin: view all alerts across the city.
    - Operator: view strictly alerts on assigned duty corridors or directly assigned to account.
    - Eager loads relationships to guarantee < 500ms execution.
    """
    is_operator = (current_user.role or "").upper() == "OPERATOR"
    # Fast path for operators with no assigned corridors
    if is_operator:
        assigned_road_ids = [r.id for r in db.query(Road.id).filter(Road.assigned_operator_id == current_user.id).all()]
        has_direct_alerts = db.query(Alert.id).filter(Alert.assigned_operator_id == current_user.id).first()
        if not assigned_road_ids and not has_direct_alerts:
            return []

    query = db.query(Alert).options(
        joinedload(Alert.road).joinedload(Road.assigned_operator),
        joinedload(Alert.assigned_operator)
    )

    # Operator Scoping
    if is_operator:
        query = query.filter(
            or_(
                Alert.road_id.in_(assigned_road_ids) if assigned_road_ids else False,
                Alert.assigned_operator_id == current_user.id
            )
        )

    # Road ID Filter
    if road_id:
        query = query.filter(Alert.road_id == road_id)

    # Alert Type Filter
    if alert_type and alert_type.upper() != "ALL":
        query = query.filter(func.lower(Alert.alert_type) == alert_type.lower())

    # Severity Filter
    if severity and severity.upper() != "ALL":
        query = query.filter(func.lower(Alert.severity) == severity.lower())

    # Status Filter
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(func.lower(Alert.status) == status_filter.lower())

    # Search Filter
    if search:
        query = query.join(Road, Alert.road_id == Road.id).filter(
            or_(
                Alert.alert_type.ilike(f"%{search}%"),
                Road.road_name.ilike(f"%{search}%"),
                Road.zone.ilike(f"%{search}%")
            )
        )

    query = query.order_by(desc(Alert.created_at))
    
    # Database level pagination limit
    offset_val = (page - 1) * page_size
    paginated_alerts = query.offset(offset_val).limit(page_size).all()

    return [format_alert_dict(a, db=None) for a in paginated_alerts]

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: CreateAlertSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """POST /api/v1/alerts - Create incident alert in Supabase."""
    road = db.query(Road).filter(Road.id == payload.road_id).first()
    if not road:
        raise HTTPException(status_code=404, detail=f"Road corridor ID {payload.road_id} not found.")

    new_alert = Alert(
        road_id=payload.road_id,
        alert_type=payload.alert_type,
        severity=payload.severity,
        status=payload.status or "Active",
        notes=payload.notes,
        assigned_operator_id=payload.assigned_operator_id or road.assigned_operator_id,
        attachment_url=payload.attachment_url
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)

    # Fetch eager loaded alert
    fetched = db.query(Alert).options(
        joinedload(Alert.road).joinedload(Road.assigned_operator),
        joinedload(Alert.assigned_operator)
    ).filter(Alert.id == new_alert.id).first()

    return format_alert_dict(fetched, db=None)

@router.get("/{alert_id}")
def get_alert_detail(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """GET /api/v1/alerts/{alert_id} - Fetch single alert details."""
    alert = db.query(Alert).options(
        joinedload(Alert.road).joinedload(Road.assigned_operator),
        joinedload(Alert.assigned_operator)
    ).filter(Alert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert ID #{alert_id} not found")

    return format_alert_dict(alert, db=None)

@router.put("/{alert_id}/status")
def update_alert_status(
    alert_id: int,
    payload: UpdateAlertStatusSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """PUT /api/v1/alerts/{alert_id}/status - Update alert status."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert #{alert_id} not found")

    alert.status = payload.status
    if payload.notes:
        existing = alert.notes or ""
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        alert.notes = f"{existing}\n[{stamp} - {current_user.name}]: Status changed to {payload.status}. {payload.notes}".strip()

    alert.updated_at = datetime.utcnow()
    db.commit()

    fetched = db.query(Alert).options(
        joinedload(Alert.road).joinedload(Road.assigned_operator),
        joinedload(Alert.assigned_operator)
    ).filter(Alert.id == alert_id).first()

    return format_alert_dict(fetched, db=None)

@router.put("/{alert_id}/assign")
def assign_alert_operator(
    alert_id: int,
    payload: AssignAlertSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """PUT /api/v1/alerts/{alert_id}/assign - Assign operator to alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert #{alert_id} not found")

    op_user = db.query(User).filter(User.id == payload.operator_id).first()
    if not op_user:
        raise HTTPException(status_code=404, detail=f"Operator ID #{payload.operator_id} not found")

    alert.assigned_operator_id = payload.operator_id
    alert.updated_at = datetime.utcnow()
    db.commit()

    fetched = db.query(Alert).options(
        joinedload(Alert.road).joinedload(Road.assigned_operator),
        joinedload(Alert.assigned_operator)
    ).filter(Alert.id == alert_id).first()

    return format_alert_dict(fetched, db=None)

@router.delete("/{alert_id}", status_code=status.HTTP_200_OK)
def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """DELETE /api/v1/alerts/{alert_id} - Admin delete alert."""
    if (current_user.role or "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden. Only Administrators can delete alerts.")

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert #{alert_id} not found")

    db.delete(alert)
    db.commit()
    return {"message": f"Alert #{alert_id} deleted successfully", "id": alert_id}
