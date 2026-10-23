"""
ShelfSense Backend Configuration
================================
Points to the authoritative unified YOLO11n model and the 4 target retail classes:
  0: CocaCola
  1: KitKat
  2: Lays
  3: Oreo
"""

from pathlib import Path

# Project paths
ROOT = Path(__file__).resolve().parents[1]
WEIGHTS = ROOT / "models" / "best.pt"

# Authoritative 4-class mappings
CLASS_NAMES: dict[int, str] = {
    0: "CocaCola",
    1: "KitKat",
    2: "Lays",
    3: "Oreo",
}

# Inference & Camera Settings
WEBCAM_INDEX: int = 0
CONF_THRESHOLD: float = 0.25
IOU_THRESHOLD: float = 0.45
IMGSZ: int = 640
DEVICE: str = "0"
TRACKER_CONFIG: str = "bytetrack.yaml"

# API Settings
HOST: str = "127.0.0.1"
PORT: int = 8000
