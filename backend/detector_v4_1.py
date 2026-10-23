"""
ShelfSense — Unified YOLO Inference Module (detector_v4_1)
==========================================================
Upgraded to use the authoritative unified 4-class YOLO11n model:
  results/shelfsense_final_yolo11n/weights/best.pt

Classes:
  0: CocaCola
  1: KitKat
  2: Lays
  3: Oreo

Supports:
  - Single forward-pass 4-class inference (~3-4ms on GPU)
  - Seamless fallback to multi-model mode if unified model is not yet compiled
  - Standardized Detection dataclass output
  - Configurable confidence and IoU thresholds
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]

UNIFIED_MODEL_PATH: Path = ROOT / "models" / "best.pt"

MODEL_PATHS: Dict[str, Path] = {
    "CocaCola": ROOT / "results/yolo_v4_1/cocacola/baseline_yolo11n_640/weights/best.pt",
    "KitKat": ROOT / "results/yolo_v4_1/kitkat/baseline_yolo11n_640/weights/best.pt",
    "Lays": ROOT / "results/yolo_v4_1/lays/baseline_yolo11n_640/weights/best.pt",
    "Oreo": ROOT / "results/yolo_v4_1/oreo/baseline_yolo11n_640/weights/best.pt",
}

CLASS_NAMES: Dict[int, str] = {
    0: "CocaCola",
    1: "KitKat",
    2: "Lays",
    3: "Oreo",
}

DEFAULT_CONF_THRESHOLD: float = 0.25
DEFAULT_IOU_THRESHOLD: float = 0.45
DEFAULT_CROSS_NMS_IOU: float = 0.50
DEFAULT_IMGSZ: int = 640


@dataclass
class Detection:
    class_name: str
    confidence: float
    bbox: list[int]  # [x1, y1, x2, y2]
    track_id: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "class": self.class_name,
            "confidence": round(self.confidence, 4),
            "bbox": self.bbox,
            "track_id": self.track_id,
        }


def compute_iou(boxA: list[int], boxB: list[int]) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interWidth = max(0, xB - xA)
    interHeight = max(0, yB - yA)
    interArea = interWidth * interHeight

    boxAArea = max(0, boxA[2] - boxA[0]) * max(0, boxA[3] - boxA[1])
    boxBArea = max(0, boxB[2] - boxB[0]) * max(0, boxB[3] - boxB[1])

    denom = float(boxAArea + boxBArea - interArea)
    if denom <= 0:
        return 0.0
    return interArea / denom


class MultiModelYOLODetector:
    """
    Detector supporting either the unified 4-class YOLO11n model
    or legacy 4-model ensemble, maintaining full API compatibility.
    """

    def __init__(
        self,
        model_paths: Optional[Dict[str, Path]] = None,
        unified_path: Optional[Path] = None,
        conf_thresh: float = DEFAULT_CONF_THRESHOLD,
        iou_thresh: float = DEFAULT_IOU_THRESHOLD,
        device: str = "0",
    ) -> None:
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.device = device if torch.cuda.is_available() else "cpu"
        self.paths = model_paths or MODEL_PATHS
        self.unified_path = unified_path or UNIFIED_MODEL_PATH
        self.unified_model: Optional[YOLO] = None
        self.models: Dict[str, YOLO] = {}
        self.load_models()

    def load_models(self) -> None:
        """Loads available model(s) from disk. Prioritizes the unified model."""
        if self.unified_path.is_file():
            print(f"[YOLODetector] Loading Authoritative Unified Model: {self.unified_path}")
            try:
                self.unified_model = YOLO(str(self.unified_path))
                print(f"[YOLODetector] Unified model loaded successfully. Classes: {self.unified_model.names}")
                return
            except Exception as e:
                print(f"[YOLODetector] WARN: Failed to load unified model ({e}), falling back to multi-model mode.")

        print("[YOLODetector] Initializing legacy individual models:")
        for product_name, weight_path in self.paths.items():
            if weight_path.is_file():
                try:
                    self.models[product_name] = YOLO(str(weight_path))
                    print(f"  - Loaded {product_name}: {weight_path}")
                except Exception as e:
                    print(f"  [WARN] Failed to load {product_name}: {e}")
            else:
                print(f"  - [PENDING] {product_name} weight not found at {weight_path}")

    def reload_pending_models(self) -> None:
        """Attempts to hot-load the unified model or any pending models."""
        if self.unified_model is None and self.unified_path.is_file():
            try:
                self.unified_model = YOLO(str(self.unified_path))
                print(f"[YOLODetector] Hot-loaded unified model: {self.unified_path}")
                return
            except Exception as e:
                print(f"[YOLODetector] Failed to hot-load unified model: {e}")

        if self.unified_model is None:
            for product_name, weight_path in self.paths.items():
                if product_name not in self.models and weight_path.is_file():
                    try:
                        self.models[product_name] = YOLO(str(weight_path))
                        print(f"  - Hot-loaded {product_name}: {weight_path}")
                    except Exception as e:
                        print(f"  [WARN] Failed to hot-load {product_name}: {e}")

    def detect(
        self,
        frame: np.ndarray,
        conf_thresh: Optional[float] = None,
        apply_cross_nms: bool = True,
    ) -> List[Detection]:
        """
        Runs inference and returns list of Detection objects.
        """
        self.reload_pending_models()
        conf = conf_thresh if conf_thresh is not None else self.conf_thresh
        all_detections: List[Detection] = []

        # 1. Preferred Path: Single Unified Model forward pass
        if self.unified_model is not None:
            results = self.unified_model.predict(
                source=frame,
                conf=conf,
                iou=self.iou_thresh,
                imgsz=DEFAULT_IMGSZ,
                device=self.device,
                verbose=False,
            )
            if results and len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                cls_tensor = boxes.cls.int().cpu().tolist() if boxes.cls is not None else []
                conf_tensor = boxes.conf.cpu().tolist() if boxes.conf is not None else []
                xyxy_tensor = boxes.xyxy.int().cpu().tolist() if boxes.xyxy is not None else []

                for cid, score, bbox in zip(cls_tensor, conf_tensor, xyxy_tensor):
                    cname = CLASS_NAMES.get(cid, f"class_{cid}")
                    all_detections.append(
                        Detection(
                            class_name=cname,
                            confidence=float(score),
                            bbox=bbox,
                            track_id=None,
                        )
                    )
            return all_detections

        # 2. Fallback Path: Multi-model iteration
        for prod_idx, (product_name, model) in enumerate(self.models.items()):
            try:
                results = model(
                    source=frame,
                    conf=conf,
                    iou=self.iou_thresh,
                    imgsz=DEFAULT_IMGSZ,
                    device=self.device,
                    verbose=False,
                )
                if not results or len(results) == 0 or results[0].boxes is None:
                    continue

                boxes = results[0].boxes
                conf_tensor = boxes.conf.cpu().numpy() if boxes.conf is not None else []
                xyxy_tensor = boxes.xyxy.cpu().numpy() if boxes.xyxy is not None else []

                for i, bbox in enumerate(xyxy_tensor):
                    score = float(conf_tensor[i])
                    x1, y1, x2, y2 = [int(v) for v in bbox]
                    all_detections.append(
                        Detection(
                            class_name=product_name,
                            confidence=score,
                            bbox=[x1, y1, x2, y2],
                            track_id=None,
                        )
                    )
            except Exception as e:
                print(f"[MultiModelYOLODetector] Error during {product_name} inference: {e}")

        # Cross-model Non-Maximum Suppression
        if apply_cross_nms and len(all_detections) > 1:
            all_detections.sort(key=lambda d: d.confidence, reverse=True)
            suppressed = [False] * len(all_detections)
            filtered_detections: List[Detection] = []

            for i, det_i in enumerate(all_detections):
                if suppressed[i]:
                    continue
                filtered_detections.append(det_i)
                for j in range(i + 1, len(all_detections)):
                    if not suppressed[j]:
                        iou = compute_iou(det_i.bbox, all_detections[j].bbox)
                        if iou > DEFAULT_CROSS_NMS_IOU:
                            suppressed[j] = True
            all_detections = filtered_detections

        return all_detections
