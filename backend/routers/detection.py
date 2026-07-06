import asyncio
import json
import uuid
import cv2
import numpy as np
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models
from config import UPLOAD_DIR, OUTPUT_DIR
from ml.detector import detect_image, draw_detections_on_frame, encode_frame_jpeg, get_model

router = APIRouter(prefix="/api/detect", tags=["detection"])

# Store pending video tasks: task_id -> task info
_pending_video_tasks: dict = {}

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2}


def _max_severity(current: str, incoming: str) -> str:
    return incoming if _SEVERITY_RANK.get(incoming, 0) > _SEVERITY_RANK.get(current, 0) else current


def _create_video_writer(task_id: str, fps: float, width: int, height: int):
    codec_candidates = [
        ("avc1", ".mp4"),
        ("H264", ".mp4"),
        ("X264", ".mp4"),
        ("mp4v", ".mp4"),
    ]

    for fourcc_code, extension in codec_candidates:
        out_name = f"{task_id}_annotated{extension}"
        out_path = str(OUTPUT_DIR / out_name)
        writer = cv2.VideoWriter(
            out_path,
            cv2.VideoWriter_fourcc(*fourcc_code),
            fps,
            (width, height),
        )
        if writer.isOpened():
            return writer, out_name, out_path
        writer.release()

    raise HTTPException(status_code=500, detail="Could not initialize annotated video writer")


@router.post("/image")
async def detect_image_endpoint(
    file: UploadFile = File(...),
    conf: float = Query(0.25, ge=0.05, le=0.95),
    iou: float = Query(0.45, ge=0.1, le=0.9),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    arr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    loop = asyncio.get_event_loop()
    annotated, detections, missing, severity = await loop.run_in_executor(
        None, detect_image, img, conf, iou
    )

    out_name = f"{uuid.uuid4().hex}_{file.filename}"
    out_path = OUTPUT_DIR / out_name
    cv2.imwrite(str(out_path), annotated)

    if missing:
        violation = models.Violation(
            filename=file.filename,
            output_path=out_name,
            detections=json.dumps(detections),
            missing_ppe=json.dumps(missing),
            severity=severity,
            media_type="image"
        )
        db.add(violation)
        db.add(models.AuditLog(
            user_id=current_user.id,
            user_email=current_user.email,
            role=current_user.role,
            action_type="Violation Detected",
            description=f"PPE violation detected in image '{file.filename}': {', '.join(missing)}"
        ))
        db.commit()

    return {
        "detections": detections,
        "missing_ppe": missing,
        "severity": severity,
        "output_file": out_name,
        "has_violation": len(missing) > 0
    }


@router.post("/video/upload")
async def upload_video(
    file: UploadFile = File(...),
    conf: float = Query(0.25, ge=0.05, le=0.95),
    iou: float = Query(0.45, ge=0.1, le=0.9),
    current_user: models.User = Depends(get_current_user)
):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    task_id = uuid.uuid4().hex
    save_path = UPLOAD_DIR / f"{task_id}_{file.filename}"

    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    _pending_video_tasks[task_id] = {
        "path": str(save_path),
        "filename": file.filename,
        "conf": conf,
        "iou": iou,
    }

    return {"task_id": task_id, "filename": file.filename}


@router.websocket("/video/{task_id}")
async def video_stream(
    websocket: WebSocket,
    task_id: str,
    db: Session = Depends(get_db)
):
    await websocket.accept()

    task = _pending_video_tasks.get(task_id)
    if not task:
        await websocket.send_json({"type": "error", "message": "Task not found"})
        await websocket.close()
        return

    video_path = task["path"]
    filename = task["filename"]
    conf = task.get("conf", 0.25)
    iou = task.get("iou", 0.45)

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        await websocket.send_json({"type": "error", "message": "Could not open video"})
        await websocket.close()
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    writer, out_name, out_path = _create_video_writer(task_id, fps, width, height)

    all_detections = []
    all_missing = set()
    frame_idx = 0
    loop = asyncio.get_event_loop()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            annotated, detections, missing, severity = await loop.run_in_executor(
                None, draw_detections_on_frame, frame, conf, iou
            )

            writer.write(annotated)
            all_detections.extend(detections)
            all_missing.update(missing)

            jpeg_bytes = encode_frame_jpeg(annotated, quality=75)
            progress = int((frame_idx / max(total_frames, 1)) * 100)

            await websocket.send_json({
                "type": "frame",
                "frame_idx": frame_idx,
                "progress": progress,
                "detections": detections,
                "missing": missing,
            })
            await websocket.send_bytes(jpeg_bytes)

            frame_idx += 1

            if frame_idx % 5 == 0:
                await asyncio.sleep(0)

    except WebSocketDisconnect:
        pass
    finally:
        cap.release()
        writer.release()

    n = len(all_missing)
    severity = "high" if n >= 3 else "medium" if n >= 1 else "low"

    missing_list = list(all_missing)
    if missing_list:
        try:
            violation = models.Violation(
                filename=filename,
                output_path=out_name,
                detections=json.dumps(all_detections[:100]),
                missing_ppe=json.dumps(missing_list),
                severity=severity,
                media_type="video"
            )
            db.add(violation)
            db.add(models.AuditLog(
                user_id=None,
                user_email="system",
                role="system",
                action_type="Violation Detected",
                description=f"PPE violation in video '{filename}': {', '.join(missing_list)}"
            ))
            db.commit()
        except Exception:
            pass

    try:
        await websocket.send_json({
            "type": "done",
            "total_frames": frame_idx,
            "fps": fps,
            "missing_ppe": missing_list,
            "severity": severity,
            "output_file": out_name,
            "has_violation": len(missing_list) > 0
        })
    except Exception:
        pass

    _pending_video_tasks.pop(task_id, None)


@router.websocket("/camera/live")
async def camera_live_stream(
    websocket: WebSocket,
    conf: float = Query(0.25, ge=0.05, le=0.95),
    iou: float = Query(0.45, ge=0.1, le=0.9),
    db: Session = Depends(get_db),
):
    await websocket.accept()
    loop = asyncio.get_event_loop()
    session_id = uuid.uuid4().hex[:10]
    session_started = datetime.utcnow()
    all_detections = []
    all_missing = set()
    session_severity = "low"
    snapshot_name = None

    try:
        while True:
            message = await websocket.receive()
            frame_bytes = message.get("bytes")

            if not frame_bytes:
                if message.get("type") == "websocket.disconnect":
                    break
                continue

            arr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json({"type": "error", "message": "Could not decode camera frame"})
                continue

            annotated, detections, missing, severity = await loop.run_in_executor(
                None, draw_detections_on_frame, frame, conf, iou
            )
            all_detections.extend(detections)
            all_missing.update(missing)
            session_severity = _max_severity(session_severity, severity)

            if missing and snapshot_name is None:
                snapshot_name = f"live_camera_{session_started.strftime('%Y%m%d_%H%M%S')}_{session_id}.jpg"
                cv2.imwrite(str(OUTPUT_DIR / snapshot_name), annotated)

            jpeg_bytes = encode_frame_jpeg(annotated, quality=75)

            await websocket.send_json({
                "type": "frame",
                "detections": detections,
                "missing": missing,
                "severity": severity,
            })
            await websocket.send_bytes(jpeg_bytes)
    except WebSocketDisconnect:
        pass
    finally:
        missing_list = sorted(all_missing)
        if missing_list:
            try:
                filename = f"Live Camera Session {session_started.strftime('%Y-%m-%d %H:%M:%S')}"
                violation = models.Violation(
                    filename=filename,
                    output_path=snapshot_name,
                    detections=json.dumps(all_detections[:100]),
                    missing_ppe=json.dumps(missing_list),
                    severity=session_severity,
                    media_type="image"
                )
                db.add(violation)
                db.add(models.AuditLog(
                    user_id=None,
                    user_email="system",
                    role="system",
                    action_type="Violation Detected",
                    description=f"PPE violation in live camera session: {', '.join(missing_list)}"
                ))
                db.commit()
            except Exception:
                db.rollback()


@router.get("/output/{filename}")
async def get_output(filename: str, current_user: models.User = Depends(get_current_user)):
    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))
