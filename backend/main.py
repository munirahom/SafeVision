from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from database import engine, Base
import models  # noqa: register all models
from routers import auth, detection, users, violations, audit, dashboard, reports, weather
from config import OUTPUT_DIR

# Create all DB tables
Base.metadata.create_all(bind=engine)


def ensure_schema():
    with engine.begin() as conn:
        access_request_columns = {
            row[1] for row in conn.exec_driver_sql("PRAGMA table_info(access_requests)").fetchall()
        }
        if "requested_password_hash" not in access_request_columns:
            conn.execute(text("ALTER TABLE access_requests ADD COLUMN requested_password_hash VARCHAR"))


ensure_schema()

app = FastAPI(title="SafeVision API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve annotated outputs
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Routers
app.include_router(auth.router)
app.include_router(detection.router)
app.include_router(users.router)
app.include_router(violations.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(weather.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SafeVision API"}
