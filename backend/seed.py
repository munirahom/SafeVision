"""
Run once to seed the database with initial users and sample data.
Usage: python seed.py
"""
import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal, engine, Base
import models
from auth import hash_password
from datetime import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Clear existing data (for fresh seed)
db.query(models.AuditLog).delete()
db.query(models.Violation).delete()
db.query(models.AccessRequest).delete()
db.query(models.PasswordResetCode).delete()
db.query(models.User).delete()
db.commit()

# --- Users ---
users = [
    models.User(
        username="admin",
        email="admin@safevision.com",
        first_name="Alex",
        last_name="Admin",
        hashed_password=hash_password("admin123"),
        role="admin",
        department="IT Security",
    ),
    models.User(
        username="supervisor1",
        email="supervisor@safevision.com",
        first_name="Sam",
        last_name="Supervisor",
        hashed_password=hash_password("super123"),
        role="supervisor",
        department="Operations",
    ),
    models.User(
        username="john.doe",
        email="john.doe@safevision.com",
        first_name="John",
        last_name="Doe",
        hashed_password=hash_password("password123"),
        role="supervisor",
        department="Safety",
    ),
]
for u in users:
    db.add(u)
db.commit()

admin = db.query(models.User).filter(models.User.email == "admin@safevision.com").first()

# --- Sample Violations ---
missing_options = [
    (["Helmet"], "medium"),
    (["Safety Vest"], "medium"),
    (["Gloves", "Helmet"], "high"),
    (["Face Mask"], "medium"),
    (["Helmet", "Safety Vest", "Gloves"], "high"),
    ([], "low"),
    (["Safety Vest", "Face Mask"], "high"),
    (["Gloves"], "medium"),
]
filenames = ["site_cam_01.jpg", "warehouse_feed.jpg", "construction_zone.mp4",
             "entry_gate.jpg", "floor_B.jpg", "rooftop.jpg", "loading_bay.mp4"]

for i in range(20):
    missing, severity = random.choice(missing_options)
    fname = random.choice(filenames)
    v = models.Violation(
        filename=fname,
        output_path=None,
        detections=json.dumps([{"class": "Person", "confidence": 0.91}]),
        missing_ppe=json.dumps(missing),
        severity=severity,
        timestamp=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
        status=random.choice(["pending", "reviewed"]),
        reviewed_by="admin@safevision.com" if random.random() > 0.5 else None,
        media_type="image" if fname.endswith(".jpg") else "video"
    )
    db.add(v)

# --- Sample Audit Logs ---
audit_actions = [
    ("User Created", "Created new user account for john.doe@safevision.com"),
    ("Health Check", "System health check completed successfully"),
    ("Violation Updated", "Updated violation #3 status to 'Reviewed'"),
    ("Settings Changed", "Updated alert thresholds settings"),
    ("Login", "User logged in as admin"),
    ("Login", "User logged in as supervisor"),
    ("User Updated", "Updated account for supervisor@safevision.com"),
]

for i, (action, desc) in enumerate(audit_actions):
    db.add(models.AuditLog(
        user_id=admin.id,
        user_email=admin.email,
        role=admin.role,
        action_type=action,
        description=desc,
        timestamp=datetime.utcnow() - timedelta(hours=i * 3)
    ))

# --- Sample Access Request ---
db.add(models.AccessRequest(
    first_name="Maria",
    last_name="Torres",
    email="m.torres@company.com",
    department="Logistics",
    role="supervisor",
    reason="I need access to monitor PPE compliance in the logistics department.",
    status="pending",
))

db.commit()
db.close()

print("Database seeded successfully!")
print("Login credentials:")
print("  Admin    — email: admin@safevision.com     password: admin123")
print("  Supervisor — email: supervisor@safevision.com  password: super123")
