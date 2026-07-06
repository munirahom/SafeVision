from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import require_admin
import models, schemas

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/", response_model=list[schemas.AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(500).all()
