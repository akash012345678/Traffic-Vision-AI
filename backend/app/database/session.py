from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config.settings import settings
import logging

logger = logging.getLogger("trafficvision.db")

Base = declarative_base()

def get_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False})
    
    try:
        # Connect to PostgreSQL / Supabase with pool tuning and 3s connection timeout for fast failover
        eng = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            pool_recycle=300,
            connect_args={"connect_timeout": 3}
        )
        conn = eng.connect()
        conn.close()
        logger.info("Successfully connected to primary PostgreSQL / Supabase database.")
        return eng
    except Exception as e:
        logger.warning(
            "Primary database connection failed (%s). Falling back to local SQLite database (trafficvision.db)...", 
            str(e)
        )
        fallback_url = "sqlite:///./trafficvision.db"
        return create_engine(fallback_url, connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency helper to yield DB sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all configured tables in Supabase / PostgreSQL or fallback DB"""
    from app.models.models import User, Road, TrafficData, Alert, Prediction, Zone, OperatorRoadAssignment, UploadedVideo # Ensure models are registered in Base
    from sqlalchemy import text, inspect
    logger.info("Creating database tables via SQLAlchemy metadata...")
    Base.metadata.create_all(bind=engine)

    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        columns_by_table = {}
        for tbl in ["users", "roads", "zones", "alerts", "traffic_data", "uploaded_videos"]:
            if tbl in table_names:
                columns_by_table[tbl] = {c['name'] for c in inspector.get_columns(tbl)}

        def add_column_if_missing(table_name: str, col_name: str, col_type_sql: str):
            try:
                if table_name in columns_by_table:
                    if col_name not in columns_by_table[table_name]:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type_sql};"))
                        logger.info("Added missing column %s to %s", col_name, table_name)
            except Exception as col_err:
                logger.warning("Could not add column %s to %s: %s", col_name, table_name, str(col_err))

        # Users table columns
        add_column_if_missing("users", "phone", "VARCHAR(50)")
        add_column_if_missing("users", "status", "VARCHAR(50) DEFAULT 'ACTIVE'")
        add_column_if_missing("users", "zone", "VARCHAR(100)")
        add_column_if_missing("users", "shift", "VARCHAR(100) DEFAULT 'Day Shift (08:00 - 16:00)'")
        add_column_if_missing("users", "designation", "VARCHAR(100) DEFAULT 'Senior Traffic Controller'")
        add_column_if_missing("users", "avatar_url", "VARCHAR(255)")
        add_column_if_missing("users", "last_login", "TIMESTAMP")
        add_column_if_missing("users", "updated_at", "TIMESTAMP")

        # Roads table columns
        add_column_if_missing("roads", "zone_id", "INTEGER REFERENCES zones(id)")
        add_column_if_missing("roads", "road_code", "VARCHAR(50)")
        add_column_if_missing("roads", "status", "VARCHAR(50) DEFAULT 'Active'")
        add_column_if_missing("roads", "created_at", "TIMESTAMP")
        add_column_if_missing("roads", "length_km", "FLOAT DEFAULT 2.5")
        add_column_if_missing("roads", "lanes", "INTEGER DEFAULT 4")
        add_column_if_missing("roads", "speed_limit", "INTEGER DEFAULT 60")
        add_column_if_missing("roads", "updated_at", "TIMESTAMP")

        # Zones table columns
        add_column_if_missing("zones", "status", "VARCHAR(50) DEFAULT 'Active'")
        add_column_if_missing("zones", "zone_code", "VARCHAR(50)")
        add_column_if_missing("zones", "center_latitude", "FLOAT DEFAULT 12.9716")
        add_column_if_missing("zones", "center_longitude", "FLOAT DEFAULT 77.5946")
        add_column_if_missing("zones", "created_at", "TIMESTAMP")
        add_column_if_missing("zones", "updated_at", "TIMESTAMP")

        # Alerts table columns
        add_column_if_missing("alerts", "updated_at", "TIMESTAMP")
        add_column_if_missing("alerts", "attachment_url", "VARCHAR(255)")
        add_column_if_missing("alerts", "assigned_operator_id", "INTEGER REFERENCES users(id)")
        add_column_if_missing("alerts", "notes", "TEXT")

        # Traffic telemetry table columns
        add_column_if_missing("traffic_data", "confidence", "FLOAT")
        add_column_if_missing("traffic_data", "processed_at", "TIMESTAMP")
        add_column_if_missing("traffic_data", "video_timestamp", "FLOAT DEFAULT 0.0")
        add_column_if_missing("traffic_data", "video_id", "INTEGER REFERENCES uploaded_videos(id) ON DELETE SET NULL")
        add_column_if_missing("traffic_data", "car_count", "INTEGER DEFAULT 0")
        add_column_if_missing("traffic_data", "bus_count", "INTEGER DEFAULT 0")
        add_column_if_missing("traffic_data", "truck_count", "INTEGER DEFAULT 0")
        add_column_if_missing("traffic_data", "motorcycle_count", "INTEGER DEFAULT 0")
        add_column_if_missing("traffic_data", "video_name", "VARCHAR(255)")

        # Uploaded videos table columns
        add_column_if_missing("uploaded_videos", "road_name", "VARCHAR(150)")
        add_column_if_missing("uploaded_videos", "video_url", "VARCHAR(255)")
        add_column_if_missing("uploaded_videos", "processed_video_url", "VARCHAR(255)")
        add_column_if_missing("uploaded_videos", "total_vehicles", "INTEGER DEFAULT 0")
        add_column_if_missing("uploaded_videos", "car_count", "INTEGER DEFAULT 0")
        add_column_if_missing("uploaded_videos", "bus_count", "INTEGER DEFAULT 0")
        add_column_if_missing("uploaded_videos", "truck_count", "INTEGER DEFAULT 0")
        add_column_if_missing("uploaded_videos", "motorcycle_count", "INTEGER DEFAULT 0")
        add_column_if_missing("uploaded_videos", "average_speed", "FLOAT DEFAULT 30.0")
        add_column_if_missing("uploaded_videos", "congestion_level", "VARCHAR(50) DEFAULT 'MODERATE'")
        add_column_if_missing("uploaded_videos", "confidence", "FLOAT DEFAULT 0.60")
        add_column_if_missing("uploaded_videos", "resolution", "VARCHAR(50)")
        add_column_if_missing("uploaded_videos", "fps", "FLOAT")
        add_column_if_missing("uploaded_videos", "duration_seconds", "FLOAT")

        # Create High-Performance SQL Indexes
        indexes = [
            ("idx_roads_assigned_op", "CREATE INDEX IF NOT EXISTS idx_roads_assigned_op ON roads(assigned_operator_id)"),
            ("idx_roads_zone_id", "CREATE INDEX IF NOT EXISTS idx_roads_zone_id ON roads(zone_id)"),
            ("idx_traffic_road_ts", "CREATE INDEX IF NOT EXISTS idx_traffic_road_ts ON traffic_data(road_id, timestamp)"),
            ("idx_alerts_op_status", "CREATE INDEX IF NOT EXISTS idx_alerts_op_status ON alerts(assigned_operator_id, status)"),
            ("idx_alerts_road", "CREATE INDEX IF NOT EXISTS idx_alerts_road ON alerts(road_id)"),
            ("idx_videos_road", "CREATE INDEX IF NOT EXISTS idx_videos_road ON uploaded_videos(road_id)")
        ]
        with engine.begin() as conn:
            for idx_name, idx_sql in indexes:
                try:
                    conn.execute(text(idx_sql))
                except Exception as idx_err:
                    logger.warning("Could not create index %s: %s", idx_name, str(idx_err))

        # Ensure foreign key ON DELETE SET NULL constraint exists in active DB (PostgreSQL)
        if engine.name != "sqlite":
            try:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE traffic_data DROP CONSTRAINT IF EXISTS traffic_data_video_id_fkey"))
                    conn.execute(text("ALTER TABLE traffic_data ADD CONSTRAINT traffic_data_video_id_fkey FOREIGN KEY (video_id) REFERENCES uploaded_videos(id) ON DELETE SET NULL"))
            except Exception as constraint_err:
                logger.warning("Failed to recreate foreign key constraint: %s", str(constraint_err))
    except Exception as e:
        logger.warning("Column migration check notice: %s", str(e))

    logger.info("Database tables and performance indexes initialized successfully.")
