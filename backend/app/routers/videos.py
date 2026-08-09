from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import logging

from app.database.session import get_db
from app.middleware.dependencies import require_roles
from app.repositories.video_repository import VideoRepository
from app.schemas.video import VideoResponseSchema
from app.services.video_processor import VideoProcessor
from app.config.settings import settings
from app.models.models import Road

logger = logging.getLogger("trafficvision.api")

router = APIRouter(
    prefix="/videos",
    tags=["Traffic Video Processing Pipeline"]
)

@router.post("/upload", response_model=VideoResponseSchema, status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_roles(["Admin", "Operator"]))])
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="The video file to upload (MP4, AVI, MOV)"),
    road_id: Optional[int] = Form(None, description="Optional ID of associated road corridor"),
    db: Session = Depends(get_db)
):
    """
    Upload a traffic video file. Saves file, registers metadata record as 'Processing',
    dispatches non-blocking background AI frame processing, and returns immediately (< 1s).
    """
    # 1. Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    ext = file.filename.split(".")[-1].lower()
    if ext not in ["mp4", "avi", "mov"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only MP4, AVI, and MOV video formats are supported."
        )

    # 2. Validate road_id if provided
    road_name_val = None
    if road_id is not None:
        road = db.query(Road).filter(Road.id == road_id).first()
        if not road:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Road corridor with ID {road_id} not found."
            )
        road_name_val = road.road_name

    # 3. Create upload directory if missing
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_FOLDER, file.filename)

    # 4. Stream upload file in chunks and validate size
    size_bytes = 0
    try:
        with open(filepath, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)  # Read 1MB chunk
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > settings.MAX_UPLOAD_SIZE:
                    f.close()
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE / (1024 * 1024):.0f}MB."
                    )
                f.write(chunk)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        if os.path.exists(filepath):
            os.remove(filepath)
        logger.error("Error writing uploaded file to disk: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save video file to server."
        )

    # 5. Create initial UploadedVideo record with status "Processing"
    video_data = {
        "road_id": road_id,
        "road_name": road_name_val,
        "filename": file.filename,
        "filepath": filepath,
        "file_size_bytes": size_bytes,
        "mime_type": file.content_type,
        "total_frames": 0,
        "fps": 0.0,
        "duration_seconds": 0.0,
        "resolution": "Processing",
        "car_count": 0,
        "bus_count": 0,
        "truck_count": 0,
        "motorcycle_count": 0,
        "status": "Processing"
    }

    try:
        db_video = VideoRepository.create_video(db, video_data)
        logger.info("Video record registered with ID %d (Status: Processing).", db_video.id)
    except Exception as db_err:
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass
        logger.error("Database save failed for video metadata: %s", str(db_err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist video metadata in database."
        )

    # 6. Schedule non-blocking asynchronous AI video processing in background
    background_tasks.add_task(
        VideoProcessor.process_video_background,
        db_video.id,
        filepath,
        road_id
    )

    return db_video

@router.get("", response_model=List[VideoResponseSchema], dependencies=[Depends(require_roles(["Admin", "Operator"]))])
def get_videos(db: Session = Depends(get_db)):
    """Retrieve metadata of all uploaded videos."""
    return VideoRepository.get_all_videos(db)

@router.delete("/{video_id}", dependencies=[Depends(require_roles(["Admin", "Operator"]))])
def delete_video(video_id: int, db: Session = Depends(get_db)):
    """Delete video metadata from database and delete local physical video file."""
    db_video = VideoRepository.get_video_by_id(db, video_id)
    if not db_video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video metadata with ID {video_id} not found."
        )

    # Remove physical file
    if db_video.filepath and os.path.exists(db_video.filepath):
        try:
            os.remove(db_video.filepath)
            logger.info("Deleted physical video file: %s", db_video.filepath)
        except Exception as file_err:
            logger.error("Failed to delete physical video file: %s. Error: %s", db_video.filepath, str(file_err))

    # Remove DB record
    success = VideoRepository.delete_video(db, video_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove video metadata from database."
        )

    return {"message": f"Video {video_id} deleted successfully."}

@router.get("/{video_id}/stream")
def stream_video(
    video_id: int,
    request: Request,
    token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    HTTP Range-compliant video streaming endpoint (206 Partial Content).
    Supports scrubbing, seeking, and smooth HTML5 playback in Chrome/Edge.
    Does not load full video into memory.
    """
    from app.models.models import UploadedVideo
    video = db.query(UploadedVideo).filter(UploadedVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail=f"Video metadata for ID {video_id} not found.")

    # Locate physical video file (prefer processed annotated video, fall back to raw upload)
    filepath = None
    if video.filepath and os.path.exists(video.filepath):
        filepath = video.filepath
    else:
        cand1 = os.path.join(settings.OUTPUT_FOLDER, f"processed_{video.filename}")
        cand2 = os.path.join(settings.UPLOAD_FOLDER, video.filename)
        if os.path.exists(cand1):
            filepath = cand1
        elif os.path.exists(cand2):
            filepath = cand2

    if not filepath or not os.path.exists(filepath):
        raise HTTPException(
            status_code=404, 
            detail=f"Physical video file for video ID {video_id} ({video.filename}) not found on server."
        )

    file_size = os.path.getsize(filepath)
    range_header = request.headers.get("range") or request.headers.get("Range")
    content_type = "video/mp4"

    if range_header:
        # Parse range header format "bytes=start-end"
        try:
            range_str = range_header.replace("bytes=", "").strip()
            parts = range_str.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        except Exception:
            start = 0
            end = file_size - 1

        if start >= file_size:
            raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

        end = min(end, file_size - 1)
        content_length = end - start + 1

        def range_stream():
            chunk_size = 1024 * 1024  # 1MB chunk size
            bytes_left = content_length
            with open(filepath, "rb") as video_file:
                video_file.seek(start)
                while bytes_left > 0:
                    read_bytes = min(chunk_size, bytes_left)
                    data = video_file.read(read_bytes)
                    if not data:
                        break
                    bytes_left -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type,
            "Access-Control-Allow-Origin": "*",
        }
        return StreamingResponse(
            range_stream(),
            status_code=206,
            headers=headers,
            media_type=content_type
        )
    else:
        def full_stream():
            chunk_size = 1024 * 1024
            with open(filepath, "rb") as video_file:
                while True:
                    data = video_file.read(chunk_size)
                    if not data:
                        break
                    yield data

        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
            "Access-Control-Allow-Origin": "*",
        }
        return StreamingResponse(
            full_stream(),
            status_code=200,
            headers=headers,
            media_type=content_type
        )

@router.get("/{video_id}/telemetry")
def get_video_telemetry(video_id: int, db: Session = Depends(get_db)):
    """
    Retrieve ordered time-series telemetry for a specific video,
    sorted by video_timestamp ASC for frontend synchronization.
    """
    from app.models.models import TrafficData, UploadedVideo
    video = db.query(UploadedVideo).filter(UploadedVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail=f"Video ID {video_id} not found.")

    # 1. First fetch interval telemetry specific to this video with timestamp > 0
    records = db.query(TrafficData).filter(
        (TrafficData.video_id == video_id) | (TrafficData.video_name == video.filename)
    ).filter(TrafficData.video_timestamp > 0.0).order_by(TrafficData.video_timestamp.asc()).all()

    # 2. If no interval telemetry exists yet, fall back to any road telemetry
    if not records:
        records = db.query(TrafficData).filter(
            (TrafficData.video_id == video_id) | (TrafficData.road_id == video.road_id)
        ).order_by(TrafficData.video_timestamp.asc(), TrafficData.timestamp.asc()).all()

    items = []
    for r in records:
        items.append({
            "id": r.id,
            "road_id": r.road_id,
            "video_id": r.video_id,
            "video_name": r.video_name or video.filename,
            "video_timestamp": r.video_timestamp or 0.0,
            "vehicle_count": r.vehicle_count or 0,
            "car_count": r.car_count or 0,
            "motorcycle_count": r.motorcycle_count or 0,
            "bus_count": r.bus_count or 0,
            "truck_count": r.truck_count or 0,
            "congestion_level": (r.congestion_level or "LOW").upper(),
            "average_speed": r.average_speed or 0.0,
            "confidence": r.confidence or 0.85,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "processed_at": r.processed_at.isoformat() if r.processed_at else None
        })
    return {
        "video_id": video.id,
        "filename": video.filename,
        "road_id": video.road_id,
        "total_records": len(items),
        "telemetry": items
    }

@router.get("/road/{road_id}")
def get_road_video_details(road_id: int, db: Session = Depends(get_db)):
    """
    Retrieve associated video info and AI processing status for a specified road.
    """
    from app.models.models import UploadedVideo, Road
    road = db.query(Road).filter(Road.id == road_id).first()
    if not road:
        raise HTTPException(status_code=404, detail=f"Road ID {road_id} not found.")

    video = db.query(UploadedVideo).filter(UploadedVideo.road_id == road_id).first()
    if not video:
        return {
            "has_video": False,
            "road_id": road_id,
            "road_name": road.road_name,
            "status": "NONE"
        }

    # Construct web accessible static and stream URLs
    filename = video.filename
    raw_url = f"/uploads/videos/{filename}"
    proc_filename = f"processed_{filename}"
    processed_url = f"/uploads/processed/{proc_filename}"
    stream_url = f"/videos/{video.id}/stream"

    return {
        "has_video": True,
        "video_id": video.id,
        "road_id": road_id,
        "road_name": road.road_name,
        "road_code": road.road_code or f"RD-{road_id:03d}",
        "filename": video.filename,
        "filepath": video.filepath,
        "video_url": raw_url,
        "processed_video_url": processed_url,
        "stream_url": stream_url,
        "status": (video.status or "Uploaded").upper(),
        "total_frames": video.total_frames or 0,
        "fps": video.fps or 0.0,
        "duration_seconds": video.duration_seconds or 0.0,
        "resolution": video.resolution or "N/A",
        "car_count": video.car_count or 0,
        "bus_count": video.bus_count or 0,
        "truck_count": video.truck_count or 0,
        "motorcycle_count": video.motorcycle_count or 0,
        "uploaded_at": video.uploaded_at.isoformat() if video.uploaded_at else None
    }


