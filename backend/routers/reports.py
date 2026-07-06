import json
import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_admin
import models
from datetime import datetime, timedelta
from collections import Counter

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    total_violations = db.query(models.Violation).count()
    reviewed = db.query(models.Violation).filter(models.Violation.status == "reviewed").count()
    pending = db.query(models.Violation).filter(models.Violation.status == "pending").count()

    # Monthly trend (last 6 months)
    monthly = []
    for i in range(5, -1, -1):
        start = datetime.utcnow().replace(day=1) - timedelta(days=30 * i)
        end = start + timedelta(days=31)
        count = db.query(models.Violation).filter(
            models.Violation.timestamp >= start,
            models.Violation.timestamp < end
        ).count()
        monthly.append({"month": start.strftime("%b %Y"), "count": count})

    # Missing PPE breakdown (all time)
    all_v = db.query(models.Violation).all()
    counter = Counter()
    for v in all_v:
        try:
            for item in json.loads(v.missing_ppe):
                counter[item] += 1
        except Exception:
            pass

    return {
        "total_violations": total_violations,
        "reviewed": reviewed,
        "pending": pending,
        "monthly_trend": monthly,
        "ppe_breakdown": [{"item": k, "count": v} for k, v in counter.most_common()],
    }


@router.get("/export/violations")
def export_violations_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    violations = db.query(models.Violation).order_by(models.Violation.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Filename", "Media Type", "Missing PPE", "Severity",
                     "Status", "Timestamp", "Reviewed By"])
    for v in violations:
        writer.writerow([
            v.id, v.filename, v.media_type,
            ", ".join(json.loads(v.missing_ppe or "[]")),
            v.severity, v.status,
            v.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            v.reviewed_by or ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=violations_report.csv"}
    )


@router.get("/export/audit")
def export_audit_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "User Email", "Role", "Action Type", "Description", "Timestamp"])
    for l in logs:
        writer.writerow([
            l.id, l.user_email, l.role,
            l.action_type, l.description,
            l.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log_report.csv"}
    )
