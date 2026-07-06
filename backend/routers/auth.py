import random
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from auth import (hash_password, verify_password, create_access_token,
                  get_current_user)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _log(db: Session, user: models.User, action: str, desc: str):
    db.add(models.AuditLog(
        user_id=user.id, user_email=user.email,
        role=user.role, action_type=action, description=desc
    ))
    db.commit()


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == payload.email
    ).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": str(user.id), "role": user.role})

    _log(db, user, "Login", f"User logged in as {user.role}")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "department": user.department,
        }
    }


@router.post("/request-access", status_code=201)
def request_access(payload: schemas.AccessRequestCreate, db: Session = Depends(get_db)):
    existing = db.query(models.AccessRequest).filter(
        models.AccessRequest.email == payload.email,
        models.AccessRequest.status == "pending"
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A pending request already exists for this email")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    req = models.AccessRequest(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        department=payload.department,
        role=payload.role,
        reason=payload.reason,
        requested_password_hash=hash_password(payload.password),
    )
    db.add(req)
    db.commit()
    return {"message": "Access request submitted successfully"}


@router.post("/reset-password/request")
def reset_request(payload: schemas.ResetRequestPayload, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    # Always return success to avoid email enumeration
    if user:
        code = "".join(random.choices(string.digits, k=5))
        expires = datetime.utcnow() + timedelta(minutes=15)
        # Invalidate old codes
        db.query(models.PasswordResetCode).filter(
            models.PasswordResetCode.email == payload.email
        ).delete()
        db.add(models.PasswordResetCode(email=payload.email, code=code, expires_at=expires))
        db.commit()
        # In production you'd email this; for demo, return in response
        return {"message": "Verification code sent", "demo_code": code}
    return {"message": "Verification code sent"}


@router.post("/reset-password/confirm")
def reset_confirm(payload: schemas.ResetConfirmPayload, db: Session = Depends(get_db)):
    record = db.query(models.PasswordResetCode).filter(
        models.PasswordResetCode.email == payload.email,
        models.PasswordResetCode.code == payload.code,
        models.PasswordResetCode.used == False,
    ).first()
    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    record.used = True
    db.commit()
    return {"message": "Password reset successfully"}


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
        "department": current_user.department,
        "notif_email": current_user.notif_email,
        "notif_violations": current_user.notif_violations,
        "notif_system_updates": current_user.notif_system_updates,
        "notif_weekly_reports": current_user.notif_weekly_reports,
    }


@router.put("/me")
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    _log(db, current_user, "Settings Changed", "User updated their profile settings")
    return {"message": "Profile updated"}


@router.put("/me/password")
def change_password(
    payload: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    _log(db, current_user, "Settings Changed", "User changed their password")
    return {"message": "Password changed successfully"}


@router.put("/me/notifications")
def update_notifications(
    payload: schemas.NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    for field, value in payload.model_dump().items():
        setattr(current_user, field, value)
    db.commit()
    return {"message": "Notifications updated"}
