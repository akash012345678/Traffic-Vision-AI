"""
Road ROI & Camera Calibration Configurations for TrafficVision AI.

Defines camera-specific Region of Interest (ROI) polygons in normalized coordinates [x, y]
(0.0 to 1.0 relative to frame dimensions), lane counts, and speed limits for all 12 road corridors.
"""

from typing import Dict, Any, List

ROAD_CONFIGS: Dict[int, Dict[str, Any]] = {
    # Road #1: 5th Avenue Corridor
    1: {
        "road_name": "5th Avenue Corridor",
        "lanes": 4,
        "speed_limit_kmh": 50.0,
        # Normalized ROI Polygon (x, y) [0.0 to 1.0]
        "roi_polygon_normalized": [
            [0.15, 0.38],
            [0.85, 0.38],
            [0.98, 0.98],
            [0.02, 0.98]
        ]
    },
    # Road #2: Wall Street Junction
    2: {
        "road_name": "Wall Street Junction",
        "lanes": 4,
        "speed_limit_kmh": 45.0,
        "roi_polygon_normalized": [
            [0.10, 0.35],
            [0.90, 0.35],
            [0.98, 0.96],
            [0.02, 0.96]
        ]
    },
    # Road #3: Broadway Commercial Ave
    3: {
        "road_name": "Broadway Commercial Ave",
        "lanes": 4,
        "speed_limit_kmh": 50.0,
        "roi_polygon_normalized": [
            [0.15, 0.35],
            [0.85, 0.35],
            [0.96, 0.98],
            [0.04, 0.98]
        ]
    },
    # Road #4: Fulton Transit Corridor
    4: {
        "road_name": "Fulton Transit Corridor",
        "lanes": 4,
        "speed_limit_kmh": 45.0,
        "roi_polygon_normalized": [
            [0.12, 0.35],
            [0.88, 0.35],
            [0.98, 0.98],
            [0.02, 0.98]
        ]
    },
    # Road #5: Exchange Place Connector
    5: {
        "road_name": "Exchange Place Connector",
        "lanes": 4,
        "speed_limit_kmh": 55.0,
        "roi_polygon_normalized": [
            [0.10, 0.30],
            [0.90, 0.30], [0.98, 0.98], [0.02, 0.98]
        ]
    },
    # Road #6: 42nd Street Express (6-lane express highway corridor)
    6: {
        "road_name": "42nd Street Express",
        "lanes": 6,
        "speed_limit_kmh": 65.0,
        # ROI polygon focused tightly on the 6 express travel lanes, excluding background ramps/side lanes
        "roi_polygon_normalized": [
            [0.12, 0.35],
            [0.88, 0.35],
            [0.96, 0.96],
            [0.04, 0.96]
        ]
    },
    # Road #7: Madison Avenue North
    7: {
        "road_name": "Madison Avenue North",
        "lanes": 4,
        "speed_limit_kmh": 50.0,
        "roi_polygon_normalized": [
            [0.15, 0.35], [0.85, 0.35], [0.95, 0.95], [0.05, 0.95]
        ]
    },
    # Road #8: Park Avenue Tunnel Route
    8: {
        "road_name": "Park Avenue Tunnel Route",
        "lanes": 4,
        "speed_limit_kmh": 50.0,
        "roi_polygon_normalized": [
            [0.15, 0.35], [0.85, 0.35], [0.95, 0.95], [0.05, 0.95]
        ]
    },
    # Road #9: Lexington Ave Arterial
    9: {
        "road_name": "Lexington Ave Arterial",
        "lanes": 4,
        "speed_limit_kmh": 50.0,
        "roi_polygon_normalized": [
            [0.15, 0.35], [0.85, 0.35], [0.95, 0.95], [0.05, 0.95]
        ]
    },
    # Road #10: 7th Avenue Theater Arc
    10: {
        "road_name": "7th Avenue Theater Arc",
        "lanes": 4,
        "speed_limit_kmh": 45.0,
        "roi_polygon_normalized": [
            [0.15, 0.35], [0.85, 0.35], [0.95, 0.95], [0.05, 0.95]
        ]
    },
    # Road #11: West Side Highway North
    11: {
        "road_name": "West Side Highway North",
        "lanes": 6,
        "speed_limit_kmh": 65.0,
        "roi_polygon_normalized": [
            [0.12, 0.35], [0.88, 0.35], [0.96, 0.96], [0.04, 0.96]
        ]
    },
    # Road #12: FDR Drive Southbound
    12: {
        "road_name": "FDR Drive Southbound",
        "lanes": 6,
        "speed_limit_kmh": 65.0,
        "roi_polygon_normalized": [
            [0.12, 0.35], [0.88, 0.35], [0.96, 0.96], [0.04, 0.96]
        ]
    }
}

def get_road_roi_polygon_pixels(road_id: int, frame_width: int, frame_height: int) -> List[List[int]]:
    """
    Returns absolute pixel coordinates [[x, y], ...] of the Road ROI polygon for a given road_id.
    """
    cfg = ROAD_CONFIGS.get(road_id, ROAD_CONFIGS[1])
    norm_poly = cfg.get("roi_polygon_normalized", [[0.1, 0.3], [0.9, 0.3], [0.95, 0.95], [0.05, 0.95]])
    pixel_poly = []
    for pt in norm_poly:
        px = int(pt[0] * frame_width)
        py = int(pt[1] * frame_height)
        pixel_poly.append([px, py])
    return pixel_poly
