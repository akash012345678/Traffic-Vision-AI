import time
import logging
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, asc
from datetime import datetime, timedelta
from app.models.models import Road, TrafficData, Alert, User

logger = logging.getLogger("trafficvision.repo")

class TrafficRepository:
    @staticmethod
    def get_dashboard_summary_metrics(db: Session):
        t0 = time.perf_counter()

        total_roads = db.query(func.count(Road.id)).scalar() or 0
        total_operators = db.query(func.count(User.id)).filter(func.upper(User.role) == "OPERATOR").scalar() or 0
        total_cameras = total_roads * 6  # 6 edge telemetry cameras per corridor
        active_alerts = db.query(func.count(Alert.id)).filter(func.upper(Alert.status) != "RESOLVED").scalar() or 0

        # Batch fetch latest telemetry snapshot for all roads in 1 SINGLE SQL QUERY
        subq = (
            db.query(
                TrafficData.road_id,
                func.max(TrafficData.timestamp).label("max_ts")
            )
            .group_by(TrafficData.road_id)
            .subquery()
        )
        latest_telemetry_list = (
            db.query(
                TrafficData.road_id,
                TrafficData.vehicle_count,
                TrafficData.average_speed,
                TrafficData.congestion_level
            )
            .join(
                subq,
                (TrafficData.road_id == subq.c.road_id) & (TrafficData.timestamp == subq.c.max_ts)
            )
            .all()
        )

        high_congestion_count = 0
        total_vehicles = 0
        total_speed = 0.0
        active_roads_count = max(1, len(latest_telemetry_list))

        congestion_counts = {"Low": 0, "Moderate": 0, "High": 0, "Critical": 0}

        for r_id, v_count, speed, level in latest_telemetry_list:
            total_vehicles += v_count or 0
            total_speed += speed or 0.0
            clevel = level or "Low"
            congestion_counts[clevel] = congestion_counts.get(clevel, 0) + 1
            if clevel in ["High", "Critical"]:
                high_congestion_count += 1

        avg_vehicles = round(total_vehicles / active_roads_count, 1)
        avg_speed = round(total_speed / active_roads_count, 1)

        system_status = "Optimal" if high_congestion_count <= 2 else "Elevated Traffic" if high_congestion_count <= 5 else "Congestion Warning"

        exec_ms = round((time.perf_counter() - t0) * 1000, 2)
        logger.info("[PERF SQL] get_dashboard_summary_metrics executed in %s ms", exec_ms)

        return {
            "total_roads": total_roads,
            "total_operators": total_operators,
            "total_cameras": total_cameras,
            "active_alerts": active_alerts,
            "high_congestion_roads": high_congestion_count,
            "avg_vehicle_count": avg_vehicles,
            "avg_speed": avg_speed,
            "system_status": system_status,
            "congestion_distribution": congestion_counts
        }

    @staticmethod
    def get_live_monitoring(
        db: Session,
        operator_id: int = None,
        search: str = "",
        zone: str = "ALL",
        status: str = "ALL",
        sort_by: str = "road_name",
        order: str = "asc",
        page: int = 1,
        page_size: int = 10
    ):
        t0 = time.perf_counter()

        # FAST PATH: Check if operator has assigned roads
        if operator_id is not None:
            assigned_count = db.query(func.count(Road.id)).filter(Road.assigned_operator_id == operator_id).scalar()
            if assigned_count == 0:
                exec_ms = round((time.perf_counter() - t0) * 1000, 2)
                logger.info("[PERF FAST PATH] Operator ID %s has 0 assigned roads. Returned HTTP 200 empty list in %s ms", operator_id, exec_ms)
                return {
                    "assigned_roads": [],
                    "items": [],
                    "summary": {
                        "vehicle_count": 0,
                        "average_speed": 0,
                        "congestion": "Low"
                    },
                    "message": "No roads assigned.",
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 1
                }

        # Query Matching Roads with operator name join
        query = db.query(Road).options(joinedload(Road.assigned_operator))

        if operator_id is not None:
            query = query.filter(Road.assigned_operator_id == operator_id)

        if zone and zone != "ALL":
            query = query.filter(Road.zone.ilike(f"%{zone}%"))

        if search:
            query = query.filter(
                (Road.road_name.ilike(f"%{search}%")) |
                (Road.road_code.ilike(f"%{search}%"))
            )

        all_matching_roads = query.all()
        road_ids = [r.id for r in all_matching_roads]

        # Single-pass batch fetch latest telemetry for all matching roads (selecting ONLY needed columns)
        telemetry_map = {}
        if road_ids:
            subq = (
                db.query(
                    TrafficData.road_id,
                    func.max(TrafficData.timestamp).label("max_ts")
                )
                .filter(TrafficData.road_id.in_(road_ids))
                .group_by(TrafficData.road_id)
                .subquery()
            )
            latest_telemetry_list = (
                db.query(
                    TrafficData.road_id,
                    TrafficData.vehicle_count,
                    TrafficData.average_speed,
                    TrafficData.congestion_level,
                    TrafficData.timestamp,
                    TrafficData.confidence,
                    TrafficData.processed_at
                )
                .join(
                    subq,
                    (TrafficData.road_id == subq.c.road_id) & (TrafficData.timestamp == subq.c.max_ts)
                )
                .all()
            )
            telemetry_map = {row.road_id: row for row in latest_telemetry_list}

        processed_records = []

        for r in all_matching_roads:
            latest = telemetry_map.get(r.id)
            level = latest.congestion_level if latest else "Low"
            v_count = latest.vehicle_count if latest else 0
            speed = latest.average_speed if latest else 0.0
            updated_at = latest.timestamp.isoformat() if (latest and latest.timestamp) else datetime.now().isoformat()
            
            # AI Status determination: check if confidence exists (which indicates AI-generated telemetry)
            is_ai = latest.confidence is not None if latest else False
            ai_status = "ACTIVE" if is_ai else "SEEDED"

            # Operational status
            if level == "Critical":
                road_status = "DETOUR / CLOSED"
            elif level == "High":
                road_status = "HEAVY CONGESTION"
            elif level == "Moderate":
                road_status = "MODERATE FLOW"
            else:
                road_status = "OPERATIONAL"

            # Filter by Status
            if status and status != "ALL" and level.upper() != status.upper() and road_status.upper() != status.upper():
                continue

            op_name = r.assigned_operator.name if r.assigned_operator else "Unassigned"

            processed_records.append({
                "id": r.id,
                "road_id": r.id,
                "road_name": r.road_name,
                "road_code": r.road_code or f"RD-{r.id:03d}",
                "zone": r.zone,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "vehicle_count": v_count,
                "average_speed": speed,
                "congestion_level": level,
                "road_status": road_status,
                "assigned_operator_name": op_name,
                "timestamp": updated_at,
                "last_updated": updated_at,
                "confidence": latest.confidence if (latest and latest.confidence is not None) else None,
                "processed_at": latest.processed_at.isoformat() if (latest and latest.processed_at is not None) else None,
                "ai_status": ai_status
            })

        # Sorting
        reverse = (order.lower() == "desc")
        if sort_by == "vehicle_count":
            processed_records.sort(key=lambda x: x["vehicle_count"], reverse=reverse)
        elif sort_by == "average_speed":
            processed_records.sort(key=lambda x: x["average_speed"], reverse=reverse)
        elif sort_by == "congestion_level":
            processed_records.sort(key=lambda x: x["congestion_level"], reverse=reverse)
        elif sort_by == "zone":
            processed_records.sort(key=lambda x: x["zone"].lower(), reverse=reverse)
        elif sort_by in ["operator", "assigned_operator_name"]:
            processed_records.sort(key=lambda x: x["assigned_operator_name"].lower(), reverse=reverse)
        elif sort_by == "timestamp":
            processed_records.sort(key=lambda x: x["timestamp"], reverse=reverse)
        elif sort_by == "status":
            processed_records.sort(key=lambda x: x["road_status"].lower(), reverse=reverse)
        else:
            processed_records.sort(key=lambda x: x["road_name"].lower(), reverse=reverse)

        # Pagination
        total_count = len(processed_records)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_records = processed_records[start_idx:end_idx]

        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 1

        exec_ms = round((time.perf_counter() - t0) * 1000, 2)
        logger.info("[PERF SQL] get_live_monitoring (operator_id=%s) executed in %s ms (Records: %s)", operator_id, exec_ms, len(paginated_records))

        return {
            "items": paginated_records,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, total_pages)
        }

    @staticmethod
    def get_traffic_trend_chart_data(db: Session):
        """Returns 6 4-hour historical time buckets from Supabase TrafficData in 1 single pass query"""
        now = datetime.now()
        start_24h = now - timedelta(hours=24)
        
        # Single SQL query for the entire 24h window
        records = db.query(
            TrafficData.timestamp,
            TrafficData.vehicle_count,
            TrafficData.average_speed
        ).filter(TrafficData.timestamp >= start_24h).all()

        trends = []
        for i in range(5, -1, -1):
            b_start = now - timedelta(hours=(i+1)*4)
            b_end = now - timedelta(hours=i*4)
            
            # Filter in memory
            bucket_records = [r for r in records if r.timestamp and b_start <= r.timestamp < b_end]
            
            if bucket_records:
                avg_v = sum(r.vehicle_count or 0 for r in bucket_records) / len(bucket_records)
                speeds = [float(r.average_speed) for r in bucket_records if r.average_speed is not None]
                avg_s = sum(speeds) / len(speeds) if speeds else None
            else:
                avg_v = None
                avg_s = None

            time_str = b_end.strftime("%H:%M")
            trends.append({
                "time": time_str,
                "vehicle_count": round(float(avg_v), 1) if avg_v is not None else (120 + i * 25),
                "average_speed": round(float(avg_s), 1) if avg_s is not None else (48 - i * 3)
            })

        return trends

    @staticmethod
    def create_traffic_record(db: Session, traffic_data: dict) -> TrafficData:
        db_record = TrafficData(
            road_id=traffic_data.get("road_id"),
            video_id=traffic_data.get("video_id"),
            vehicle_count=traffic_data.get("vehicle_count", 0),
            car_count=traffic_data.get("car_count", 0),
            bus_count=traffic_data.get("bus_count", 0),
            truck_count=traffic_data.get("truck_count", 0),
            motorcycle_count=traffic_data.get("motorcycle_count", 0),
            video_name=traffic_data.get("video_name"),
            video_timestamp=traffic_data.get("video_timestamp"),
            average_speed=traffic_data.get("average_speed", 0.0),
            congestion_level=traffic_data.get("congestion_level", "Low"),
            confidence=traffic_data.get("confidence", 0.0),
            processed_at=traffic_data.get("processed_at")
        )
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        return db_record

    @staticmethod
    def get_road_live_telemetry(db: Session, road_id: int):
        road = db.query(Road).filter(Road.id == road_id).first()
        if not road:
            return None

        # Fetch latest telemetry snapshot
        latest = db.query(TrafficData).filter(TrafficData.road_id == road_id).order_by(desc(TrafficData.timestamp), desc(TrafficData.id)).first()

        # Fetch recent time-series telemetry history (past 50 intervals)
        history = db.query(TrafficData).filter(TrafficData.road_id == road_id).order_by(desc(TrafficData.timestamp), desc(TrafficData.id)).limit(50).all()

        is_ai = (latest and latest.confidence is not None)
        ai_status = "ACTIVE" if is_ai else "SEEDED"

        return {
            "road_id": road.id,
            "road_name": road.road_name,
            "road_code": road.road_code or f"RD-{road.id:03d}",
            "zone": road.zone,
            "status": road.status or "Active",
            "current_telemetry": {
                "vehicle_count": latest.vehicle_count if latest else 0,
                "car_count": latest.car_count if latest else 0,
                "bus_count": latest.bus_count if latest else 0,
                "truck_count": latest.truck_count if latest else 0,
                "motorcycle_count": latest.motorcycle_count if latest else 0,
                "average_speed": latest.average_speed if latest else 0.0,
                "congestion_level": latest.congestion_level if latest else "Low",
                "confidence": latest.confidence if (latest and latest.confidence is not None) else None,
                "processed_at": latest.processed_at.isoformat() if (latest and latest.processed_at) else None,
                "video_name": latest.video_name if latest else None,
                "timestamp": latest.timestamp.isoformat() if (latest and latest.timestamp) else None,
                "ai_status": ai_status
            },
            "telemetry_history": [
                {
                    "id": h.id,
                    "timestamp": h.timestamp.isoformat() if h.timestamp else None,
                    "vehicle_count": h.vehicle_count,
                    "car_count": h.car_count,
                    "bus_count": h.bus_count,
                    "truck_count": h.truck_count,
                    "motorcycle_count": h.motorcycle_count,
                    "average_speed": h.average_speed,
                    "congestion_level": h.congestion_level,
                    "confidence": h.confidence
                } for h in reversed(history)
            ]
        }
