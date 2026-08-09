from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="OPERATOR", nullable=False)
    phone = Column(String(50), nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)
    zone = Column(String(100), nullable=True)
    shift = Column(String(100), default="Day Shift (08:00 - 16:00)", nullable=False)
    designation = Column(String(100), default="Senior Traffic Controller", nullable=False)
    avatar_url = Column(String(255), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


    # Relationships
    assigned_roads = relationship("Road", back_populates="assigned_operator")

class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    zone_name = Column(String(100), unique=True, index=True, nullable=False)
    zone_code = Column(String(50), unique=True, index=True, nullable=True)

    description = Column(String(255), nullable=True)
    status = Column(String(50), default="Active", nullable=False) # Active, Maintenance, Inactive, Archived
    center_latitude = Column(Float, default=12.9716, nullable=False)
    center_longitude = Column(Float, default=77.5946, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


    # Relationship
    roads = relationship("Road", back_populates="zone_rel")


class OperatorRoadAssignment(Base):
    __tablename__ = "operator_road_assignments"

    id = Column(Integer, primary_key=True, index=True)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=False, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True, index=True)
    assigned_by = Column(String(100), default="Admin Chief Controller", nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default="ACTIVE", nullable=False)

    # Relationships
    operator = relationship("User")
    road = relationship("Road")
    zone_rel = relationship("Zone")


class Road(Base):
    __tablename__ = "roads"

    id = Column(Integer, primary_key=True, index=True)
    road_code = Column(String(50), nullable=True, index=True)
    road_name = Column(String(150), nullable=False, index=True)
    zone = Column(String(100), nullable=False, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String(50), default="Active", nullable=False) # Active, Closed, Maintenance, Archived
    assigned_operator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    length_km = Column(Float, default=2.5, nullable=False)
    lanes = Column(Integer, default=4, nullable=False)
    speed_limit = Column(Integer, default=60, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


    # Relationships
    assigned_operator = relationship("User", back_populates="assigned_roads")
    zone_rel = relationship("Zone", back_populates="roads")
    traffic_records = relationship("TrafficData", back_populates="road", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="road", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="road", cascade="all, delete-orphan")
    uploaded_videos = relationship("UploadedVideo", back_populates="road", cascade="all, delete-orphan")

class TrafficData(Base):
    __tablename__ = "traffic_data"

    id = Column(Integer, primary_key=True, index=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=False, index=True)
    vehicle_count = Column(Integer, default=0, nullable=False)
    car_count = Column(Integer, default=0, nullable=True)
    bus_count = Column(Integer, default=0, nullable=True)
    truck_count = Column(Integer, default=0, nullable=True)
    motorcycle_count = Column(Integer, default=0, nullable=True)
    video_name = Column(String(255), nullable=True)
    average_speed = Column(Float, default=0.0, nullable=False)
    congestion_level = Column(String(50), default="Low", nullable=False) # Low, Moderate, High, Critical/Severe
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # New columns for Phase 4 / AI & Video Synchronization
    confidence = Column(Float, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    video_timestamp = Column(Float, default=0.0, nullable=True, index=True)
    
    # ForeignKey to trace originating uploaded video (Phase 6)
    video_id = Column(Integer, ForeignKey("uploaded_videos.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    road = relationship("Road", back_populates="traffic_records")
    uploaded_video = relationship("UploadedVideo")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=False, index=True)
    alert_type = Column(String(100), nullable=False) # Congestion Spike, Accident, Signal Failure, Emergency Corridor
    severity = Column(String(50), default="Medium", nullable=False) # Low, Medium, High, Critical
    status = Column(String(50), default="Active", nullable=False) # Active, Resolved, Dismissed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    assigned_operator_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    attachment_url = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


    # Relationships
    road = relationship("Road", back_populates="alerts")
    assigned_operator = relationship("User")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=False, index=True)
    prediction = Column(String(255), nullable=False) # e.g. "Expected 30% increase in traffic density"
    confidence = Column(Float, default=0.85, nullable=False)
    prediction_time = Column(DateTime(timezone=True), nullable=False, index=True)

    # Relationship
    road = relationship("Road", back_populates="predictions")


class UploadedVideo(Base):
    __tablename__ = "uploaded_videos"

    id = Column(Integer, primary_key=True, index=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=True, index=True)
    road_name = Column(String(150), nullable=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=True)
    total_frames = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    resolution = Column(String(50), nullable=True)
    car_count = Column(Integer, default=0, nullable=True)
    bus_count = Column(Integer, default=0, nullable=True)
    truck_count = Column(Integer, default=0, nullable=True)
    motorcycle_count = Column(Integer, default=0, nullable=True)
    status = Column(String(50), default="Uploaded", nullable=False) # Uploaded, Processing, Processed, Failed
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    road = relationship("Road", back_populates="uploaded_videos")


class UserFavoriteRoad(Base):
    __tablename__ = "user_favorite_roads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    road_id = Column(Integer, ForeignKey("roads.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")
    road = relationship("Road")

