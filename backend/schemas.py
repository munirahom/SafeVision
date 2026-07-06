from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# --- Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class ResetRequestPayload(BaseModel):
    email: str


class ResetConfirmPayload(BaseModel):
    email: str
    code: str
    new_password: str


class AccessRequestCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    department: str
    role: str
    reason: str
    password: str


# --- Users ---
class UserCreate(BaseModel):
    username: str
    email: str
    first_name: str
    last_name: str
    password: str
    role: str
    department: Optional[str] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    department: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class NotificationUpdate(BaseModel):
    notif_email: bool
    notif_violations: bool
    notif_system_updates: bool
    notif_weekly_reports: bool


# --- Access Requests ---
class AccessRequestOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    department: str
    role: str
    reason: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AccessRequestReview(BaseModel):
    status: str  # approved / rejected


# --- Violations ---
class ViolationOut(BaseModel):
    id: int
    filename: str
    output_path: Optional[str]
    detections: str
    missing_ppe: str
    severity: str
    timestamp: datetime
    status: str
    reviewed_by: Optional[str]
    media_type: str

    class Config:
        from_attributes = True


class ViolationReview(BaseModel):
    status: str


# --- Audit Log ---
class AuditLogOut(BaseModel):
    id: int
    user_email: str
    role: str
    action_type: str
    description: str
    timestamp: datetime

    class Config:
        from_attributes = True
