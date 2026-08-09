from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "TrafficVision AI"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    
    # Security & JWT
    SECRET_KEY: str = "trafficvision-enterprise-supersecret-jwt-key-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # CORS Origins
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    # Databases
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/trafficvision_db"
    MONGODB_URL: str = "mongodb://localhost:27017/trafficvision_logs"
    MONGODB_DB_NAME: str = "trafficvision_logs"

    # AI / Video Ingestion Settings
    YOLO_MODEL_PATH: str = "models/yolov8s.pt"
    UPLOAD_FOLDER: str = "uploads/videos"
    OUTPUT_FOLDER: str = "uploads/processed"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50 MB
    
    # Congestion configuration
    VIEW_LENGTH_KM: float = 0.1
    LANE_CAPACITY_PER_KM: int = 150
    CONGESTION_THRESHOLD_LOW: float = 25.0
    CONGESTION_THRESHOLD_MODERATE: float = 50.0
    CONGESTION_THRESHOLD_HIGH: float = 75.0
    
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
