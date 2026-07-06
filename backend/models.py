from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="supervisor")  # "admin" or "supervisor"
    department = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    notif_email = Column(Boolean, default=True)
    notif_violations = Column(Boolean, default=True)
    notif_system_updates = Column(Boolean, default=True)
    notif_weekly_reports = Column(Boolean, default=True)

    audit_logs = relationship("AuditLog", back_populates="user", foreign_keys="AuditLog.user_id")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    department = Column(String, nullable=False)
    role = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    requested_password_hash = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending / approved / rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String, nullable=True)


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    output_path = Column(String, nullable=True)
    detections = Column(Text, nullable=False)   # JSON string
    missing_ppe = Column(Text, nullable=False)  # JSON string list
    severity = Column(String, default="medium")  # low / medium / high
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # pending / reviewed
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    media_type = Column(String, default="image")  # image / video


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String, nullable=False)
    role = Column(String, nullable=False)
    action_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs", foreign_keys=[user_id])


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
