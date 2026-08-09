from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database.session import get_db
from app.models.models import User
from app.middleware.dependencies import get_current_user
from app.services.notification_service import (
    get_user_notifications,
    get_unread_count,
    mark_notification_read,
    mark_all_notifications_read
)

router = APIRouter(prefix="/notifications", tags=["Notification Workflows"])

@router.get("")
@router.get("/")
def get_my_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticated Endpoint: Retrieves user-scoped notifications.
    Strictly isolated to the authenticated user (Public, Operator, or Admin).
    """
    notifs = get_user_notifications(db, user_id=current_user.id, unread_only=unread_only, limit=limit)
    unread_cnt = get_unread_count(db, user_id=current_user.id)

    return {
        "count": len(notifs),
        "unread_count": unread_cnt,
        "notifications": notifs,
        "user_role": current_user.role
    }

@router.get("/unread-count")
def get_my_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticated Endpoint: Returns live unread notification count for header badge.
    """
    cnt = get_unread_count(db, user_id=current_user.id)
    return {
        "unread_count": cnt,
        "user_id": current_user.id
    }

@router.patch("/{notification_id}/read")
def mark_single_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticated Endpoint: Marks a specific notification as read.
    Users can only mark their own notifications.
    """
    success = mark_notification_read(db, user_id=current_user.id, notification_id=notification_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or access unauthorized."
        )

    unread_cnt = get_unread_count(db, user_id=current_user.id)
    return {
        "message": "Notification marked as read.",
        "notification_id": notification_id,
        "is_read": True,
        "unread_count": unread_cnt
    }

@router.patch("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticated Endpoint: Marks all unread notifications as read for the user.
    """
    updated_count = mark_all_notifications_read(db, user_id=current_user.id)
    return {
        "message": f"All {updated_count} notifications marked as read.",
        "marked_count": updated_count,
        "unread_count": 0
    }
