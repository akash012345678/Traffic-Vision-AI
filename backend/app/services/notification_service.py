from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import Notification, Alert, Road, User, OperatorRoadAssignment, UserFavoriteRoad

def sync_alert_notifications(db: Session) -> int:
    """
    Background Notification Synchronizer.
    Triggers notification workflows from active AI Alert events.
    
    Recipient Scoping Rules:
    - ADMIN: Receives notifications for system-wide HIGH and CRITICAL severity alerts.
    - OPERATOR: Receives notifications ONLY for alerts on corridors assigned to them.
    - PUBLIC USER: Receives notifications ONLY for alerts on corridors in their favorites.
    - DEDUPLICATION: Ensures one notification per user per alert per type.
    """
    active_alerts = db.query(Alert).filter(Alert.status == "Active").all()
    created_count = 0
    now = datetime.now(timezone.utc)

    for alert in active_alerts:
        road = db.query(Road).filter(Road.id == alert.road_id).first()
        if not road:
            continue

        road_name = road.road_name
        road_code = road.road_code or f"RD-{road.id:03d}"
        severity_upper = (alert.severity or "MODERATE").upper()
        if severity_upper in ["CRITICAL", "SEVERE"]:
            severity_upper = "CRITICAL"

        # -------------------------------------------------------------
        # 1. ADMIN SCOPING (System-wide HIGH & CRITICAL alerts)
        # -------------------------------------------------------------
        if severity_upper in ["HIGH", "CRITICAL"]:
            admins = db.query(User).filter(User.role.ilike("ADMIN")).all()
            for admin in admins:
                existing = db.query(Notification).filter(
                    Notification.user_id == admin.id,
                    Notification.alert_id == alert.id,
                    Notification.notification_type == "ADMIN_ALERT"
                ).first()

                if not existing:
                    notif = Notification(
                        user_id=admin.id,
                        alert_id=alert.id,
                        notification_type="ADMIN_ALERT",
                        title=f"Control Center Alert: {alert.alert_type}",
                        message=f"{severity_upper} severity alert on {road_name} ({road_code}). {alert.notes or ''}".strip(),
                        severity=severity_upper,
                        is_read=0
                    )
                    db.add(notif)
                    created_count += 1

        # -------------------------------------------------------------
        # 2. OPERATOR SCOPING (Assigned Corridors Only)
        # -------------------------------------------------------------
        # Find assigned operator for this road
        operator_ids = set()
        if road.assigned_operator_id:
            operator_ids.add(road.assigned_operator_id)

        # Check operator assignments table
        assignments = db.query(OperatorRoadAssignment).filter(
            OperatorRoadAssignment.road_id == road.id,
            OperatorRoadAssignment.status == "ACTIVE"
        ).all()
        for assign in assignments:
            operator_ids.add(assign.operator_id)

        for op_id in operator_ids:
            op_user = db.query(User).filter(User.id == op_id, User.role.ilike("OPERATOR")).first()
            if not op_user:
                continue

            existing = db.query(Notification).filter(
                Notification.user_id == op_id,
                Notification.alert_id == alert.id,
                Notification.notification_type == "OPERATOR_ASSIGNMENT_ALERT"
            ).first()

            if not existing:
                notif = Notification(
                    user_id=op_id,
                    alert_id=alert.id,
                    notification_type="OPERATOR_ASSIGNMENT_ALERT",
                    title=f"Assigned Corridor Alert: {road_code}",
                    message=f"Alert on assigned corridor {road_name}: {alert.alert_type} ({severity_upper}).",
                    severity=severity_upper,
                    is_read=0
                )
                db.add(notif)
                created_count += 1

        # -------------------------------------------------------------
        # 3. PUBLIC USER SCOPING (Favorited Corridors Only)
        # -------------------------------------------------------------
        # Find logged-in public users who favorited this road
        favs = db.query(UserFavoriteRoad).filter(UserFavoriteRoad.road_id == road.id).all()
        for fav in favs:
            existing = db.query(Notification).filter(
                Notification.user_id == fav.user_id,
                Notification.alert_id == alert.id,
                Notification.notification_type == "PUBLIC_FAVORITE_ALERT"
            ).first()

            if not existing:
                notif = Notification(
                    user_id=fav.user_id,
                    alert_id=alert.id,
                    notification_type="PUBLIC_FAVORITE_ALERT",
                    title=f"Traffic Alert: {road_name}",
                    message=f"{severity_upper} congestion alert on your pinned corridor {road_name}.",
                    severity=severity_upper,
                    is_read=0
                )
                db.add(notif)
                created_count += 1

    if created_count > 0:
        db.commit()

    return created_count

def get_user_notifications(db: Session, user_id: int, unread_only: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve notifications for the authenticated user."""
    # Ensure notifications are synced first
    sync_alert_notifications(db)

    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == 0)

    records = query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()
    results = []

    for r in records:
        alert_obj = db.query(Alert).filter(Alert.id == r.alert_id).first() if r.alert_id else None
        road_obj = db.query(Road).filter(Road.id == alert_obj.road_id).first() if alert_obj else None

        results.append({
            "id": r.id,
            "user_id": r.user_id,
            "alert_id": r.alert_id,
            "road_id": road_obj.id if road_obj else None,
            "road_code": road_obj.road_code if road_obj else None,
            "road_name": road_obj.road_name if road_obj else None,
            "notification_type": r.notification_type,
            "title": r.title,
            "message": r.message,
            "severity": r.severity,
            "is_read": bool(r.is_read),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "read_at": r.read_at.isoformat() if r.read_at else None
        })

    return results

def get_unread_count(db: Session, user_id: int) -> int:
    """Get total count of unread notifications for the user."""
    sync_alert_notifications(db)
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == 0
    ).count()

def mark_notification_read(db: Session, user_id: int, notification_id: int) -> bool:
    """Mark a single notification as read for the user."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id
    ).first()

    if notif:
        notif.is_read = 1
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        return True
    return False

def mark_all_notifications_read(db: Session, user_id: int) -> int:
    """Mark all notifications as read for the user."""
    notifs = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == 0
    ).all()

    now = datetime.now(timezone.utc)
    count = len(notifs)
    for n in notifs:
        n.is_read = 1
        n.read_at = now

    if count > 0:
        db.commit()

    return count
