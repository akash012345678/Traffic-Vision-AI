from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.database.session import get_db
from app.models.models import User
from app.middleware.dependencies import require_roles
from app.services.prediction_engine import train_and_predict_traffic

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
