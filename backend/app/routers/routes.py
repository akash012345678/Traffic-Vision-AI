from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.database.session import get_db
from app.models.models import User
from app.middleware.dependencies import require_roles
from app.services.route_optimizer import optimize_route, get_alternate_route_recommendation

router = APIRouter(prefix="/routes", tags=["Route Optimization & Alternatives"])

@router.get("/optimize")
def get_optimized_route(
    origin_road_id: int = Query(..., description="Origin Road Corridor ID"),
    destination_road_id: int = Query(..., description="Destination Road Corridor ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Admin", "Operator", "Public"]))
) -> Dict[str, Any]:
    """
    Route Optimization Endpoint:
    Calculates the shortest traffic-aware path between origin and destination corridors using Dijkstra's algorithm.
    Weighted by real travel time (mins), congestion penalties, and traffic delays.
    """
    res = optimize_route(db, origin_road_id, destination_road_id, is_public_safe=False)
    if not res.get("route_found", True) and res.get("status") == "Invalid Endpoint":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

@router.get("/alternatives")
def get_alternate_corridor_recommendation(
    road_id: int = Query(..., description="Selected Road Corridor ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Admin", "Operator", "Public"]))
) -> Dict[str, Any]:
    """
    Alternate Route Recommendation Endpoint:
    Recommends a faster alternative corridor when the selected road suffers from HIGH/CRITICAL congestion or delays.
    Calculates time saved (mins) using real travel-time telemetry and 15m predictions.
    """
    res = get_alternate_route_recommendation(db, road_id, is_public_safe=False)
    if res.get("status") == "Road Not Found":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res
