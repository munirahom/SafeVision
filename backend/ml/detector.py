import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
from config import MODEL_PATH, CLASS_NAMES, CLASS_COLORS_BGR, PPE_CLASSES, PERSON_CLASS

_model = None


def get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(MODEL_PATH)
    return _model


def detect_image(img_bgr: np.ndarray, conf: float = 0.25, iou: float = 0.45):
    """
    Run YOLO on a BGR numpy image.
    Returns (annotated_bgr, detections_list, missing_ppe_list, severity).

    Violation logic (absence-based):
      For every PPE class (Helmet, Gloves, Vest, Boots, Goggles) that is NOT
      detected anywhere in the image, we record a "Missing <item>" violation.
      Only runs when at least one Person is detected in the frame; otherwise
      there is no worker to evaluate and no violations are produced.
    """
    model = get_model()
    results = model.predict(img_bgr, imgsz=640, conf=conf, iou=iou, verbose=False)
    result = results[0]

    detections = []
    detected_classes = set()

    annotated = img_bgr.copy()

    if result.boxes is not None:
        for box in result.boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            cid = int(box.cls[0].item())
            conf_val = float(box.conf[0].item())
            name = CLASS_NAMES.get(cid, str(cid))
            color = CLASS_COLORS_BGR.get(cid, (255, 255, 255))

            # Draw box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            # Draw label background
            label = f"{name} {conf_val:.2f}"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(annotated, (x1, y1 - lh - 8), (x1 + lw + 4, y1), color, -1)
            cv2.putText(annotated, label, (x1 + 2, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

            detections.append({"class": name, "class_id": cid, "confidence": round(conf_val, 3),
                                "bbox": [x1, y1, x2, y2]})
            detected_classes.add(cid)

    # Absence-based violations: only meaningful when a Person is in the frame.
    missing = []
    if PERSON_CLASS in detected_classes:
        for cid in sorted(PPE_CLASSES):
            if cid not in detected_classes:
                missing.append(f"Missing {CLASS_NAMES[cid]}")

    # Severity based on number of missing PPE items
    n = len(missing)
    severity = "high" if n >= 3 else "medium" if n >= 1 else "low"

    return annotated, detections, missing, severity


def draw_detections_on_frame(frame: np.ndarray, conf: float = 0.25, iou: float = 0.45):
    """Thin wrapper for video frames — returns annotated frame + detections."""
    annotated, detections, missing, severity = detect_image(frame, conf, iou)
    return annotated, detections, missing, severity


def encode_frame_jpeg(frame: np.ndarray, quality: int = 85) -> bytes:
    """Encode a BGR frame as JPEG bytes."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes()
