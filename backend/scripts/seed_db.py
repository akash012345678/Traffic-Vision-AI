import os
import sys
import random
from datetime import datetime, timedelta

# Add parent directory to path so app modules can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.session import engine, SessionLocal, Base, init_db
from app.models.models import User, Road, TrafficData, Alert, Prediction, Zone, OperatorRoadAssignment, UploadedVideo
from app.utils.security import hash_password

def seed_database():
    print("[INFO] Initializing TrafficVision AI Database Schema...")
    init_db()

    session = SessionLocal()

    try:
        print("[INFO] Cleaning existing database records...")
        session.query(OperatorRoadAssignment).delete()
        session.query(Prediction).delete()
        session.query(Alert).delete()
        session.query(TrafficData).delete()
        session.query(UploadedVideo).delete()
        session.query(Road).delete()
        session.query(Zone).delete()
        session.query(User).delete()
        session.commit()

        # ----------------------------------------------------
        # 1. SEED USERS (10 Operators + 2 Admins)
        # ----------------------------------------------------
        print("[SEED] Seeding Users with bcrypt password hashes (10 Operators, 2 Admins)...")
        users = []
        
        # 2 Admins
        users.append(User(
            name="Admin Chief Controller",
            email="admin.chief@trafficvision.ai",
            password_hash=hash_password("adminpass123"),
            role="ADMIN",
            phone="+1 (555) 019-2831",
            status="ACTIVE",
            zone="All Zones"
        ))
        users.append(User(
            name="Admin System Engineer",
            email="admin.system@trafficvision.ai",
            password_hash=hash_password("adminpass123"),
            role="ADMIN",
            phone="+1 (555) 019-2832",
            status="ACTIVE",
            zone="All Zones"
        ))

        session.add_all(users)
        session.commit()

        # Retrieve operators list (IDs assigned by DB)
        operators = session.query(User).filter(User.role == "OPERATOR").all()
        operator_ids = [op.id for op in operators]

        # ----------------------------------------------------
        # 2. SEED ZONES & ROADS (4 Zones, 20 Roads)
        # ----------------------------------------------------
        # ----------------------------------------------------
        # 2. SEED ZONES & ROADS (6 Zones, 20 Roads)
        # ----------------------------------------------------
        print("[SEED] Seeding Zones & 20 Roads...")
        zones_data = [
            ("Zone Alpha - Financial District", "High-density commercial financial district corridors"),
            ("Zone Beta - Midtown Hub", "Central arterial transit hub & commercial grid"),
            ("Zone Gamma - Harbor Expressway", "Waterfront arterial highway & tunnel approaches"),
            ("Zone Delta - Suburban Arterial", "Suburban expressways & perimeter parkways"),
            ("North Zone", "Northern metropolitan transit corridors & arterial ring roads"),
            ("South Zone", "Southern logistics corridors & express bypass routes")
        ]

        zone_objects = {}
        for z_name, z_desc in zones_data:
            z_obj = Zone(zone_name=z_name, description=z_desc)
            session.add(z_obj)
            zone_objects[z_name] = z_obj

        session.commit()

        road_names_by_zone = {
            "Zone Alpha - Financial District": [
                "5th Avenue Corridor",
                "Wall Street Junction",
                "Broadway Commercial Ave",
                "Fulton Transit Corridor",
                "Exchange Place Connector"
            ],
            "Zone Beta - Midtown Hub": [
                "42nd Street Express",
                "Madison Avenue North",
                "Park Avenue Tunnel Route",
                "Lexington Ave Arterial",
                "7th Avenue Theater Arc"
            ],
            "Zone Gamma - Harbor Expressway": [
                "West Side Highway North",
                "FDR Drive Southbound",
                "Lincoln Tunnel Approach",
                "Brooklyn Bridge Access Way",
                "Hudson Waterfront Bypass"
            ],
            "Zone Delta - Suburban Arterial": [
                "Grand Central Parkway E",
                "Queens Boulevard Central",
                "Ocean Parkway Extension",
                "Cross Bronx Expressway Node",
                "Belt Parkway Gateway"
            ]
        }

        # Base GPS coordinates for NYC region
        base_coords = [
            (40.7074, -74.0113), (40.7580, -73.9855),
            (40.7614, -73.9776), (40.7484, -73.9857),
            (40.7128, -74.0060), (40.7527, -73.9772),
            (40.7306, -73.9921), (40.7589, -74.0022),
            (40.7061, -73.9969), (40.7831, -73.9712),
            (40.7145, -73.9482), (40.7350, -73.9800),
            (40.7700, -73.9500), (40.8200, -73.9200),
            (40.6700, -73.9800), (40.7400, -73.8900),
            (40.7600, -73.8300), (40.6500, -73.9500),
            (40.8400, -73.8900), (40.6000, -74.0600)
        ]

        roads = []
        assignments = []
        coord_idx = 0
        for z_name, r_list in road_names_by_zone.items():
            z_obj = zone_objects.get(z_name)
            z_id = z_obj.id if z_obj else None
            for r_name in r_list:
                lat, lng = base_coords[coord_idx % len(base_coords)]
                assigned_op_id = operator_ids[coord_idx % len(operator_ids)] if operator_ids else None
                r_obj = Road(
                    road_name=r_name,
                    zone=z_name,
                    zone_id=z_id,
                    latitude=lat,
                    longitude=lng,
                    assigned_operator_id=assigned_op_id
                )
                roads.append(r_obj)
                coord_idx += 1

        session.add_all(roads)
        session.commit()

        # Retrieve roads with generated IDs
        db_roads = session.query(Road).all()
        road_ids = [r.id for r in db_roads]

        # Seed OperatorRoadAssignments junction records
        for r in db_roads:
            if r.assigned_operator_id:
                assignments.append(OperatorRoadAssignment(
                    operator_id=r.assigned_operator_id,
                    road_id=r.id,
                    zone_id=r.zone_id,
                    assigned_by="Admin Chief Controller",
                    status="ACTIVE"
                ))

        session.add_all(assignments)
        session.commit()

        # ----------------------------------------------------
        # VERIFICATION REPORT
        # ----------------------------------------------------
        u_count = session.query(User).count()
        r_count = session.query(Road).count()
        t_count = session.query(TrafficData).count()
        a_count = session.query(Alert).count()
        p_count = session.query(Prediction).count()

        print("\n[SUCCESS] DATABASE SEEDING COMPLETE!")
        print("---------------------------------------")
        print(f" Users Inserted:         {u_count}")
        print(f" Roads Inserted:         {r_count}")
        print(f" AI Telemetry Records:   {t_count}")
        print(f" AI Alerts Inserted:     {a_count}")
        print(f" Predictions Inserted:   {p_count}")
        print("---------------------------------------")

    except Exception as e:
        session.rollback()
        print(f" ERROR DURING SEEDING: {e}")
        raise e
    finally:
        session.close()

if __name__ == "__main__":
    seed_database()
