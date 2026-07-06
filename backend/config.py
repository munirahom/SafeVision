from pathlib import Path

BASE_DIR = Path(__file__).parent
ROOT_DIR = BASE_DIR.parent.parent

import os
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

MODEL_PATH = str(BASE_DIR/ "best.pt")
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
DEFAULT_WEATHER_LOCATION = "Riyadh"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite:///{BASE_DIR}/safevision.db"

CLASS_NAMES = {
    0: "Helmet",
    1: "Gloves",
    2: "Vest",
    3: "Boots",
    4: "Goggles",
    5: "Person",
}
CLASS_COLORS_BGR = {
    0: (219, 152, 52),    # Helmet  — blue
    1: (60, 76, 231),     # Gloves  — red
    2: (182, 89, 155),    # Vest    — purple
    3: (34, 126, 230),    # Boots   — orange
    4: (156, 188, 26),    # Goggles — teal
    5: (18, 156, 243),    # Person  — yellow
}
# PPE classes that must be present on each worker. If a class in this set
# is NOT detected anywhere in the image, it is counted as a missing-PPE
# violation for that item. Person (class 5) is excluded — it only indicates
# that there is a worker in the frame to check against.
PPE_CLASSES = {0, 1, 2, 3, 4}
PERSON_CLASS = 5
