import heapq
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import Road, TrafficData
from app.services.prediction_engine import get_travel_time_estimates

def build_road_graph(db: Session) -> Tuple[Dict[int, Dict[str, Any]], Dict[int, List[Dict[str, Any]]]]:
    """
    Builds a topological traffic-weighted road network graph from database telemetry.
    Vertices: Road corridors (Road.id)
    Edges: Zone-connected corridors (e.g., Zone Alpha, Zone Beta, Zone Gamma)
    """
    roads = db.query(Road).all()
    if not roads:
        return {}, {}

    # Get real travel time estimates & congestion metrics
    tt_payload = get_travel_time_estimates(db, is_public_safe=False)
    tt_map = {est["road_id"]: est for est in tt_payload.get("estimates", [])}

    road_nodes = {}
    for r in roads:
        est = tt_map.get(r.id, {})
        cur_tt = float(est.get("current_travel_time_minutes") or 5.0)
        pred_tt = float(est.get("predicted_travel_time_minutes") or 5.5)
        delay = float(est.get("current_delay_minutes") or 0.0)
        cong = est.get("current_congestion") or "LOW"

        # Congestion Penalty
        cong_penalty = 0.0
        if cong == "CRITICAL":
            cong_penalty = 5.0
        elif cong == "HIGH":
            cong_penalty = 2.0
        elif cong == "MODERATE":
            cong_penalty = 0.5

        # Total Traffic-Aware Edge Cost (Travel Time + Delay + Congestion Penalty)
        cost = cur_tt + delay + cong_penalty

        road_nodes[r.id] = {
            "road_id": r.id,
            "road_code": r.road_code or f"RD-{r.id:03d}",
            "road_name": r.road_name,
            "zone": r.zone,
            "length_km": float(r.length_km if r.length_km else 2.5),
            "speed_limit_kmh": float(r.speed_limit if r.speed_limit else 60.0),
            "current_speed_kmh": float(est.get("current_speed_kmh") or 40.0),
            "predicted_speed_kmh": float(est.get("predicted_speed_kmh") or 38.0),
            "current_travel_time_minutes": cur_tt,
            "predicted_travel_time_minutes": pred_tt,
            "delay_minutes": delay,
            "current_congestion": cong,
            "predicted_congestion": est.get("predicted_congestion") or cong,
            "edge_cost": round(cost, 2)
        }

    # Group roads by Zone to establish topological connectivity graph
    zone_groups = {}
    for r_id, node in road_nodes.items():
        z = node["zone"]
        if z not in zone_groups:
            zone_groups[z] = []
        zone_groups[z].append(r_id)

    adjacency = {r_id: [] for r_id in road_nodes}
    for z, r_ids in zone_groups.items():
        for i in range(len(r_ids)):
            for j in range(len(r_ids)):
                if i != j:
                    u, v = r_ids[i], r_ids[j]
                    adjacency[u].append({
                        "neighbor_id": v,
                        "cost": road_nodes[v]["edge_cost"]
                    })

    return road_nodes, adjacency

def get_alternate_route_recommendation(db: Session, road_id: int, is_public_safe: bool = False) -> Dict[str, Any]:
    """
    Alternate Route Recommendation Engine (Milestone 2 - Phase 4).
    Recommends a faster alternative corridor when the selected road suffers from HIGH/CRITICAL congestion or delays.
    Calculates time saved (mins) using real travel-time telemetry and 15m predictions.
    """
    road_nodes, adjacency = build_road_graph(db)

    if road_id not in road_nodes:
        return {
            "road_id": road_id,
            "status": "Road Not Found",
            "message": "Selected road corridor was not found in active telemetry system.",
            "recommendation_available": False
        }

    target_node = road_nodes[road_id]
    neighbors = adjacency.get(road_id, [])

    if not neighbors:
        return {
            "road_id": road_id,
            "road_name": target_node["road_name"],
            "current_travel_time_minutes": target_node["current_travel_time_minutes"],
            "current_congestion": target_node["current_congestion"],
            "status": "No Connected Alternative",
            "message": "No connected alternative corridor available in current zone network.",
            "recommendation_available": False
        }

    # Find the alternative corridor with the lowest edge cost
    best_alt_id = None
    best_alt_cost = float('inf')

    for nbr in neighbors:
        nid = nbr["neighbor_id"]
        nnode = road_nodes[nid]
        if nnode["edge_cost"] < best_alt_cost:
            best_alt_cost = nnode["edge_cost"]
            best_alt_id = nid

    if best_alt_id is None:
        return {
            "road_id": road_id,
            "road_name": target_node["road_name"],
            "status": "No Faster Alternative",
            "message": "No faster alternative route currently available.",
            "recommendation_available": False
        }

    best_alt = road_nodes[best_alt_id]
    time_saved = round(target_node["current_travel_time_minutes"] - best_alt["current_travel_time_minutes"], 1)

    if time_saved <= 0:
        return {
            "road_id": road_id,
            "road_name": target_node["road_name"],
            "current_travel_time_minutes": target_node["current_travel_time_minutes"],
            "current_congestion": target_node["current_congestion"],
            "best_alternative": {
                "road_id": best_alt["road_id"],
                "road_code": best_alt["road_code"],
                "road_name": best_alt["road_name"],
                "travel_time_minutes": best_alt["current_travel_time_minutes"],
                "congestion": best_alt["current_congestion"]
            },
            "time_saved_minutes": 0.0,
            "status": "No Faster Alternative",
            "message": "No faster alternative route currently available. Current route remains optimal.",
            "recommendation_available": False,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }

    # Generate explainable DB rationale
    explanation = f"Bypassing {target_node['road_name']} ({target_node['current_congestion']} congestion, {target_node['current_travel_time_minutes']} mins) via {best_alt['road_name']} ({best_alt['current_congestion']} congestion, {best_alt['current_travel_time_minutes']} mins) saves an estimated {time_saved} minutes."

    payload = {
        "road_id": road_id,
        "road_code": target_node["road_code"],
        "road_name": target_node["road_name"],
        "zone": target_node["zone"],
        "current_route": {
            "road_id": target_node["road_id"],
            "road_name": target_node["road_name"],
            "travel_time_minutes": target_node["current_travel_time_minutes"],
            "predicted_travel_time_minutes": target_node["predicted_travel_time_minutes"],
            "congestion": target_node["current_congestion"],
            "delay_minutes": target_node["delay_minutes"]
        },
        "recommended_alternative": {
            "road_id": best_alt["road_id"],
            "road_code": best_alt["road_code"],
            "road_name": best_alt["road_name"],
            "travel_time_minutes": best_alt["current_travel_time_minutes"],
            "predicted_travel_time_minutes": best_alt["predicted_travel_time_minutes"],
            "congestion": best_alt["current_congestion"],
            "delay_minutes": best_alt["delay_minutes"]
        },
        "time_saved_minutes": time_saved,
        "recommendation_explanation": explanation,
        "recommendation_available": True,
        "status": "Alternative Recommended",
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

    return payload

def optimize_route(db: Session, origin_road_id: int, destination_road_id: int, is_public_safe: bool = False) -> Dict[str, Any]:
    """
    Route Optimization Engine (Milestone 2 - Phase 4).
    Calculates the shortest traffic-aware path between origin and destination corridors using Dijkstra's algorithm.
    Weighted by real travel time (mins), congestion penalties, and traffic delays.
    """
    road_nodes, adjacency = build_road_graph(db)

    if origin_road_id not in road_nodes or destination_road_id not in road_nodes:
        return {
            "origin_road_id": origin_road_id,
            "destination_road_id": destination_road_id,
            "status": "Invalid Endpoint",
            "message": "Origin or destination road corridor not found in active telemetry system.",
            "route_found": False
        }

    if origin_road_id == destination_road_id:
        node = road_nodes[origin_road_id]
        return {
            "origin_road": {"id": node["road_id"], "code": node["road_code"], "name": node["road_name"]},
            "destination_road": {"id": node["road_id"], "code": node["road_code"], "name": node["road_name"]},
            "recommended_route": [node],
            "total_distance_km": node["length_km"],
            "total_travel_time_minutes": node["current_travel_time_minutes"],
            "forecasted_travel_time_minutes": node["predicted_travel_time_minutes"],
            "total_delay_minutes": node["delay_minutes"],
            "congestion_level": node["current_congestion"],
            "time_saved_minutes": 0.0,
            "status": "Identical Endpoint",
            "route_found": True
        }

    # Dijkstra's Algorithm
    distances = {r_id: float('inf') for r_id in road_nodes}
    previous = {r_id: None for r_id in road_nodes}
    distances[origin_road_id] = road_nodes[origin_road_id]["edge_cost"]

    pq = [(distances[origin_road_id], origin_road_id)]

    while pq:
        current_dist, u = heapq.heappop(pq)

        if u == destination_road_id:
            break

        if current_dist > distances[u]:
            continue

        for edge in adjacency.get(u, []):
            v = edge["neighbor_id"]
            weight = edge["cost"]
            if distances[u] + weight < distances[v]:
                distances[v] = distances[u] + weight
                previous[v] = u
                heapq.heappush(pq, (distances[v], v))

    if distances[destination_road_id] == float('inf'):
        return {
            "origin_road_id": origin_road_id,
            "destination_road_id": destination_road_id,
            "status": "Unreachable Destination",
            "message": "No connected route path found between specified corridors.",
            "route_found": False
        }

    # Reconstruct optimal route path
    path_ids = []
    curr = destination_road_id
    while curr is not None:
        path_ids.append(curr)
        curr = previous[curr]
    path_ids.reverse()

    route_nodes = [road_nodes[rid] for rid in path_ids]
    tot_dist = round(sum(n["length_km"] for n in route_nodes), 2)
    tot_tt = round(sum(n["current_travel_time_minutes"] for n in route_nodes), 1)
    tot_pred_tt = round(sum(n["predicted_travel_time_minutes"] for n in route_nodes), 1)
    tot_delay = round(sum(n["delay_minutes"] for n in route_nodes), 1)

    payload = {
        "origin_road": {
            "id": road_nodes[origin_road_id]["road_id"],
            "code": road_nodes[origin_road_id]["road_code"],
            "name": road_nodes[origin_road_id]["road_name"]
        },
        "destination_road": {
            "id": road_nodes[destination_road_id]["road_id"],
            "code": road_nodes[destination_road_id]["road_code"],
            "name": road_nodes[destination_road_id]["road_name"]
        },
        "recommended_route": route_nodes,
        "total_distance_km": tot_dist,
        "total_travel_time_minutes": tot_tt,
        "forecasted_travel_time_minutes": tot_pred_tt,
        "total_delay_minutes": tot_delay,
        "congestion_level": route_nodes[-1]["current_congestion"],
        "status": "Optimal Route Found",
        "route_found": True,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

    return payload
