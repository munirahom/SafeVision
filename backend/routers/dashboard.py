from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models
import json
from datetime import datetime, timedelta, timezone
from collections import Counter
from pathlib import Path
from config import CLASS_NAMES, MODEL_PATH
from routers.weather import get_weather_summary

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).isoformat()
    return value.replace(tzinfo=timezone.utc).isoformat()


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    total_users = db.query(models.User).filter(models.User.is_active == True).count()
    active_violations = db.query(models.Violation).filter(models.Violation.status == "pending").count()
    pending_requests = db.query(models.AccessRequest).filter(models.AccessRequest.status == "pending").count()

    # Top weekly violations: count missing PPE items from last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_violations = db.query(models.Violation).filter(
        models.Violation.timestamp >= week_ago
    ).all()

    missing_counter = Counter()
    for v in recent_violations:
        try:
            items = json.loads(v.missing_ppe)
            for item in items:
                missing_counter[item] += 1
        except Exception:
            pass

    top_violations = [
        {"item": k, "count": v}
        for k, v in missing_counter.most_common(5)
    ]

    recent_logs_out = []
    if current_user.role == "admin":
        recent_logs = db.query(models.AuditLog).order_by(
            models.AuditLog.timestamp.desc()
        ).limit(5).all()

        recent_logs_out = [
            {
                "id": l.id,
                "user_email": l.user_email,
                "role": l.role,
                "action_type": l.action_type,
                "description": l.description,
                "timestamp": _utc_iso(l.timestamp),
            }
            for l in recent_logs
        ]

    # Severity breakdown
    high = db.query(models.Violation).filter(models.Violation.severity == "high").count()
    medium = db.query(models.Violation).filter(models.Violation.severity == "medium").count()
    low = db.query(models.Violation).filter(models.Violation.severity == "low").count()

    weather_summary = None
    weather_error = None
    try:
        weather_summary = get_weather_summary()
    except Exception as exc:
        weather_error = getattr(exc, "detail", None) or str(exc)

    return {
        "active_users": total_users,
        "active_violations": active_violations,
        "pending_requests": pending_requests,
        "camera_uptime": None,
        "camera_feeds_online": 0,
        "camera_feeds_total": 0,
        "top_violations": top_violations,
        "recent_audit_logs": recent_logs_out,
        "severity_breakdown": {"high": high, "medium": medium, "low": low},
        "model_info": {
            "name": Path(MODEL_PATH).name,
            "class_count": len(CLASS_NAMES),
            "classes": [CLASS_NAMES[idx] for idx in sorted(CLASS_NAMES)],
        },
        "system_status": {
            "detection_engine": "Operational",
            "database": "Healthy",
            "api": "Connected",
            "websocket": "Available",
        },
        "weather": weather_summary,
        "weather_error": weather_error,
    }
