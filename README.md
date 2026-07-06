# SafeVision 

**AI-powered real-time PPE compliance monitoring for industrial worksites.**

SafeVision uses computer vision to automatically detect whether workers are wearing required Personal Protective Equipment (PPE) — helmets, gloves, vests, boots, and goggles — and flags violations in real time through a full web dashboard.

Built as a graduation project at Imam Abdulrahman Bin Faisal University.

---

## ✨ Key Features

- **Real-time PPE detection** — fine-tuned YOLO11s object detection model identifies workers and safety gear in live video
- **Absence-based violation logic** — cross-checks overlapping bounding boxes to flag *missing* equipment per worker, not just detect what's present
- **High-performance streaming** — asynchronous frame-processing pipeline (FastAPI + WebSockets) sustaining ~30 FPS on GPU
- **Weather-aware safety alerts** — integrates Open-Meteo forecasts to raise advisories for extreme heat, high winds, storms, and heavy precipitation
- **Secure multi-user dashboard** — 12-page responsive React app with JWT authentication and Role-Based Access Control (admin/user)
- **Forensic audit trail** — violation histories, system health metrics, and audit logs persisted in SQLite via SQLAlchemy ORM

## Architecture

```
┌──────────────┐   WebSocket / REST   ┌──────────────────┐
│   React UI   │ ◄──────────────────► │  FastAPI backend │
│  (Vite, JWT, │                      │  ┌────────────┐  │
│   Recharts)  │                      │  │  YOLO11s   │  │
└──────────────┘                      │  │  inference │  │
                                      │  └────────────┘  │
                                      │  ┌────────────┐  │
                                      │  │ SQLite +   │  │
                                      │  │ SQLAlchemy │  │
                                      │  └────────────┘  │
                                      │  ┌────────────┐  │
                                      │  │ Open-Meteo │  │
                                      │  │ weather API│  │
                                      │  └────────────┘  │
                                      └──────────────────┘
```

## Tech Stack

| Layer            | Technology |

| Object detection | YOLO11s (fine-tuned), OpenCV |
| Backend          | Python, FastAPI, WebSockets, SQLAlchemy, SQLite |
| Frontend         | React (Vite), Recharts, JWT auth, RBAC |
| External data    | Open-Meteo weather & geocoding APIs |
| Security         | bcrypt password hashing, JWT tokens, environment-based secrets |

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) NVIDIA GPU with CUDA for real-time inference speeds

### Backend

```bash
cd backend
pip install -r requirements.txt

# Set your secret key (any long random string)
export SECRET_KEY="your-secret-key-here"     # macOS/Linux
# setx SECRET_KEY "your-secret-key-here"     # Windows

# Seed the database with an initial admin user
python seed.py

# Start the API
uvicorn main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:5173`.

### One-command startup (Windows)

```powershell
./start-safevision.ps1
```

## How Detection Works

1. Video frames stream to the backend over WebSocket.
2. The fine-tuned YOLO11s model detects six classes: **Person, Helmet, Gloves, Vest, Boots, Goggles**.
3. For each detected person, the system cross-checks overlapping bounding boxes — any required PPE class *not* found on a worker is logged as a violation.
4. Annotated frames are returned to the dashboard in real time; violations are written to an immutable audit log.

## Weather Safety Advisories

SafeVision polls Open-Meteo (keyless, free API) for 3-day forecasts and raises severity-ranked alerts when conditions threaten worksite safety:

- **High:** extreme heat (≥45°C), severe wind (≥70 km/h), thunderstorms, violent rain
- 🟡**Medium:** high heat (≥40°C), freezing temperatures, high wind, high precipitation probability

## Security Notes

- Secrets are managed via environment variables — no credentials are stored in the codebase
- Passwords are hashed with bcrypt; sessions use expiring JWT tokens
- Role-Based Access Control separates admin and standard user capabilities

## License

This project was developed for academic purposes. Feel free to explore the code; please credit if you build on it.

---

*Developed by Munirah Almukhailed — [LinkedIn](https://www.linkedin.com/) · munirah.almokhlied@gmail.com*
