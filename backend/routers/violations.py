from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models, schemas
from datetime import datetime

router = APIRouter(prefix="/api/violations", tags=["violations"])


@router.get("/", response_model=list[schemas.ViolationOut])
def list_violations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Violation).order_by(models.Violation.timestamp.desc()).all()


@router.get("/{violation_id}", response_model=schemas.ViolationOut)
def get_violation(
    violation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    v = db.query(models.Violation).filter(models.Violation.id == violation_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")
    return v


@router.put("/{violation_id}/review")
def review_violation(
    violation_id: int,
    payload: schemas.ViolationReview,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    v = db.query(models.Violation).filter(models.Violation.id == violation_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")
    v.status = payload.status
    v.reviewed_by = current_user.email
    v.reviewed_at = datetime.utcnow()
    db.add(models.AuditLog(
        user_id=current_user.id, user_email=current_user.email,
        role=current_user.role, action_type="Violation Updated",
        description=f"Violation #{violation_id} status updated to '{payload.status}'"
    ))
    db.commit()
    return {"message": "Violation updated"}


@router.delete("/{violation_id}")
def delete_violation(
    violation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    v = db.query(models.Violation).filter(models.Violation.id == violation_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")
    db.delete(v)
    db.commit()
    return {"message": "Violation deleted"}
