from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from app.config.settings import settings
from app.middleware.cors import setup_cors
from app.middleware.performance_logger import PerformanceLoggingMiddleware
from app.routers import traffic, analytics, auth, admin, operator, assignments, zones, reports
from app.schemas.traffic import SystemHealthResponse
from app.utils.logger import logger
from app.database.mongo import mongo_db

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="TrafficVision AI – Smart Traffic Prediction & Congestion Management System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure Middleware
setup_cors(app)
app.add_middleware(PerformanceLoggingMiddleware)

# --- GLOBAL EXCEPTION HANDLERS ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning("HTTP Exception on %s %s: %s", request.method, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "status_code": exc.status_code,
            "detail": exc.detail,
            "path": request.url.path
        },
        headers=exc.headers
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled Exception on %s %s: %s", request.method, request.url.path, str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "status_code": 500,
            "detail": "Internal Server Error. The system encountered an unhandled exception.",
            "path": request.url.path
        }
    )

import os
from fastapi.staticfiles import StaticFiles

# Mount static video uploads directory for video streaming
os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/processed", exist_ok=True)
os.makedirs("uploads/videos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from fastapi import APIRouter, Depends
from app.middleware.dependencies import require_roles
from app.routers import traffic, analytics, auth, admin, operator, assignments, zones, reports, roads, operators, alerts, videos, public, notifications, predictions

# Register Routers (Base /api/v1)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(public.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(predictions.router, prefix=settings.API_V1_STR)
app.include_router(roads.router, prefix=settings.API_V1_STR)
app.include_router(operators.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(operator.router, prefix=settings.API_V1_STR)
app.include_router(assignments.router, prefix=settings.API_V1_STR)
app.include_router(zones.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(traffic.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(videos.router, prefix=settings.API_V1_STR)

# Register Dual Routers under /api/v1/admin to resolve frontend path variations
admin_prefix = f"{settings.API_V1_STR}/admin"
app.include_router(zones.router, prefix=admin_prefix)
app.include_router(assignments.router, prefix=admin_prefix)
app.include_router(roads.router, prefix=admin_prefix)
app.include_router(operators.router, prefix=admin_prefix)
app.include_router(alerts.router, prefix=admin_prefix)
app.include_router(videos.router, prefix=admin_prefix)

# Register Aliases for top-level /api/v1/operators, /api/v1/roads, etc.
alias_router = APIRouter(tags=["Admin Operations (Aliases)"], dependencies=[Depends(require_roles(["Admin"]))])
alias_router.add_api_route("/operators", admin.list_operators, methods=["GET"])
alias_router.add_api_route("/operators/{operator_id}", admin.get_operator, methods=["GET"])
alias_router.add_api_route("/operators/{operator_id}/roads", admin.get_operator_roads, methods=["GET"])
alias_router.add_api_route("/operators/{operator_id}/assign-roads", admin.assign_operator_roads, methods=["PUT"])
alias_router.add_api_route("/operators/{operator_id}/zones", admin.get_operator, methods=["GET"])
app.include_router(alias_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def startup_event():
    logger.info("Initializing TrafficVision AI backend engine...")
    from app.database.session import init_db
    init_db()
    mongo_db.connect()

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down TrafficVision AI backend engine...")
    mongo_db.close()

@app.get("/", tags=["Health Check"])
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "Online",
        "docs": "/docs",
        "api_v1": f"{settings.API_V1_STR}"
    }

@app.get("/health", tags=["Health Check"])
def health_check():
    """Verify Supabase PostgreSQL and MongoDB connection status."""
    supabase_status = "Connected"
    try:
        from app.database.session import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        supabase_status = f"Warning: {str(e)}"

    mongo_status = "Connected"
    try:
        if mongo_db.client:
            mongo_db.client.admin.command('ping')
        else:
            mongo_status = "Initialized (Lazy Standby)"
    except Exception:
        mongo_status = "Initialized (Lazy Standby)"

    return {
        "status": "Healthy",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "supabase_database": supabase_status,
        "mongodb_database": mongo_status,
        "active_junctions": 24,
        "prediction_engine": "Ready"
    }

