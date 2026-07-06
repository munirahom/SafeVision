import re
import secrets
import string
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_admin, hash_password
import models, schemas

router = APIRouter(prefix="/api/users", tags=["users"])


def _log(db, actor, action, desc):
    db.add(models.AuditLog(
        user_id=actor.id, user_email=actor.email,
        role=actor.role, action_type=action, description=desc
    ))
    db.commit()


def _build_unique_username(db: Session, email: str) -> str:
    base = re.sub(r"[^a-z0-9._-]+", ".", email.split("@")[0].lower()).strip("._-") or "user"
    username = base
    suffix = 1

    while db.query(models.User).filter(models.User.username == username).first():
        suffix += 1
        username = f"{base}{suffix}"

    return username


def _generate_temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Sv!" + "".join(secrets.choice(alphabet) for _ in range(9))


@router.get("/", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    return db.query(models.User).all()


@router.post("/", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = models.User(
        username=payload.username,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _log(db, current_user, "User Created", f"Created new user account for {payload.email}")
    return user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    _log(db, current_user, "User Updated", f"Updated account for {user.email}")
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    email = user.email
    db.delete(user)
    db.commit()
    _log(db, current_user, "User Deleted", f"Deleted user account: {email}")
    return {"message": "User deleted"}


# --- Access Requests ---
@router.get("/access-requests", response_model=list[schemas.AccessRequestOut])
def list_access_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    return db.query(models.AccessRequest).order_by(models.AccessRequest.created_at.desc()).all()


@router.put("/access-requests/{req_id}")
def review_access_request(
    req_id: int,
    payload: schemas.AccessRequestReview,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    req = db.query(models.AccessRequest).filter(models.AccessRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = payload.status
    req.reviewed_by = current_user.email
    req.reviewed_at = datetime.utcnow()

    response = {"message": f"Request {payload.status}"}

    if payload.status == "approved":
        user = db.query(models.User).filter(models.User.email == req.email).first()
        requested_password_hash = getattr(req, "requested_password_hash", None)

        if user:
            was_active = user.is_active
            user.first_name = req.first_name
            user.last_name = req.last_name
            user.department = req.department
            user.role = req.role
            user.is_active = True
            if requested_password_hash and not was_active:
                user.hashed_password = requested_password_hash
                response["sign_in_message"] = "User can sign in with the password set during registration."
            else:
                response["sign_in_message"] = "Account is ready. Existing credentials remain unchanged."
            response["account_action"] = "updated"
            response["user_id"] = user.id
        else:
            temp_password = None
            hashed_password = requested_password_hash
            if not hashed_password:
                temp_password = _generate_temp_password()
                hashed_password = hash_password(temp_password)

            user = models.User(
                username=_build_unique_username(db, req.email),
                email=req.email,
                first_name=req.first_name,
                last_name=req.last_name,
                hashed_password=hashed_password,
                role=req.role,
                department=req.department,
                is_active=True,
            )
            db.add(user)
            db.flush()
            response["account_action"] = "created"
            if temp_password:
                response["temporary_password"] = temp_password
                response["sign_in_message"] = "Share the temporary password with the requester so they can sign in."
            else:
                response["sign_in_message"] = "User can sign in with the password set during registration."
            response["user_id"] = user.id

    db.commit()
    _log(db, current_user, "Access Request Reviewed",
         f"Access request from {req.email} marked as {payload.status}")
    return response
