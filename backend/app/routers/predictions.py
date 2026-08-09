from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.database.session import get_db
from app.models.models import User
from app.middleware.dependencies import require_roles
from app.services.prediction_engine import train_and_predict_traffic, get_congestion_forecasts, get_travel_time_estimates

router = APIRouter(prefix="/predictions", tags=["Traffic Predictions Engine"])

@router.get("/traffic")
def get_traffic_predictions(
    road_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Admin", "Operator"]))
) -> Dict[str, Any]:
    """
    Control Center Endpoint (Admin & Operator):
    Returns 15-minute ahead machine-learning traffic predictions trained on real Supabase PostgreSQL telemetry.
    Model: scikit-learn RandomForestRegressor with chronological 80/20 train/test split.
    """
    return train_and_predict_traffic(db, road_id=road_id, is_public_safe=False)

@router.get("/congestion")
def get_traffic_congestion_forecasts(
    road_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Admin", "Operator"]))
) -> Dict[str, Any]:
    """
    Control Center Endpoint (Admin & Operator):
    Returns 15-minute data-driven congestion level forecasts built on top of the completed RandomForestRegressor prediction model.
    Evaluates volume changes and speed velocity to forecast LOW, MODERATE, HIGH, or CRITICAL congestion transitions.
    """
    return get_congestion_forecasts(db, road_id=road_id, is_public_safe=False)

@router.get("/travel-time")
def get_corridor_travel_time_estimates(
    road_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Admin", "Operator"]))
) -> Dict[str, Any]:
    """
    Control Center Endpoint (Admin & Operator):
    Estimates corridor travel time (minutes) based on real road length (km), speed limit (km/h),
    current average speed, and 15-minute predicted speed.
    Formula: Travel Time = (Distance / Speed) * 60
    """
    return get_travel_time_estimates(db, road_id=road_id, is_public_safe=False)
