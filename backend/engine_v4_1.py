"""
ShelfSense — Shelf Sensing, State & Planogram Engine (engine_v4_1)
==================================================================
Coordinates:
  - Unified YOLO11n Retail Detection (CocaCola, KitKat, Lays, Oreo)
  - Zero-flicker temporal tracking and EMA coordinate smoothing
  - Spatial Planogram Analysis & Misplacement Triangulation
  - Live MJPEG video stream generation with bounding box HUD
  - Multi-pack KitKat cluster decomposition
"""

from __future__ import annotations

import datetime
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import cv2
import numpy as np

from backend.detector_v4_1 import Detection, MultiModelYOLODetector
from backend.planogram import PlanogramAnalyzer, SHELF_ZONES
from backend.tracker import ShelfSenseTemporalTracker, TrackedItem
from backend.few_shot_continual import few_shot_engine

V4_1_CLASSES: List[str] = ["CocaCola", "KitKat", "Lays", "Oreo"]

CLASS_COLORS: Dict[str, Tuple[int, int, int]] = {
    "CocaCola": (30, 30, 230),   # Vibrant Crimson Red
    "KitKat":   (200, 30, 200),  # Purple / Magenta
    "Lays":     (0, 215, 255),   # Golden Yellow
    "Oreo":     (255, 140, 0),   # Sky Blue / Cyan
}


class ShelfSenseV4Engine:
    """ShelfSense state engine managing unified detection, live camera, and planogram telemetry."""

    def __init__(self, webcam_index: int = 0) -> None:
        self.webcam_index = webcam_index
        self.detector = MultiModelYOLODetector()
        self.tracker = ShelfSenseTemporalTracker(
            iou_threshold=0.35,
            max_misses=6,
            min_hits_confirm=2,
            smoothing_alpha=0.65,
        )
        self.planogram = PlanogramAnalyzer(decompose_kitkat_clusters=True)

        self._lock = threading.Lock()
        self._running = False
        self._camera_thread: Optional[threading.Thread] = None

        # Engine State
        self._camera_active: bool = False
        self._last_timestamp: str = datetime.datetime.now().isoformat()
        self._changed: bool = False
        self._products: Dict[str, int] = {name: 0 for name in V4_1_CLASSES}
        self._detections: List[Dict[str, Any]] = []
        self._planogram_state: Dict[str, Any] = {}
        self._last_error: Optional[str] = None
        self._last_frame: Optional[np.ndarray] = None
        self._last_annotated_jpeg: Optional[bytes] = None

        # Configurable Store Reorder Thresholds & Alert State
        self.reorder_thresholds: Dict[str, int] = {
            "CocaCola": 2,
            "KitKat": 3,
            "Lays": 2,
            "Oreo": 2,
        }
        self._dismissed_alerts: set = set()

    def process_frame(
        self,
        frame: np.ndarray,
        is_live_stream: bool = True,
        include_few_shot: bool = False,
    ) -> Dict[str, Any]:
        """
        Runs inference on a frame, updates temporal tracking, and executes planogram analysis.
        include_few_shot: If False (core-only mode), strictly limits detections to V4_1_CLASSES.
        """
        raw_detections = self.detector.detect(frame)

        new_products: Dict[str, int] = {name: 0 for name in V4_1_CLASSES}
        new_detections_list: List[Dict[str, Any]] = []

        if is_live_stream:
            raw_list = [
                {
                    "class_name": det.class_name,
                    "confidence": det.confidence,
                    "bbox": det.bbox,
                    "class_id": 0,
                }
                for det in raw_detections
            ]
            tracked_items: List[TrackedItem] = self.tracker.update(raw_list)

            for item in tracked_items:
                new_products[item.class_name] = new_products.get(item.class_name, 0) + 1
                new_detections_list.append({
                    "class": item.class_name,
                    "confidence": round(item.confidence, 4),
                    "bbox": item.bbox,
                    "track_id": item.track_id,
                })
        else:
            for idx, det in enumerate(raw_detections, start=1):
                det.track_id = idx
                new_products[det.class_name] = new_products.get(det.class_name, 0) + 1
                new_detections_list.append(det.to_dict())

        # Few-Shot Enrolled Product Candidates Evaluation (Only if explicitly enabled)
        # Authoritative trained retail classes (CocaCola, KitKat, Lays, Oreo) take absolute precedence.
        if include_few_shot and few_shot_engine.registry:
            candidate_boxes = [
                d.bbox for d in raw_detections
                if d.confidence < 0.50 or d.class_name not in V4_1_CLASSES
            ]
            if candidate_boxes:
                fs_matches = few_shot_engine.detect_and_match(frame, candidate_boxes)
                for m in fs_matches:
                    cname = m["class_name"]
                    clamped_conf = min(1.0, max(0.0, float(m["confidence"])))
                    new_products[cname] = new_products.get(cname, 0) + 1
                    new_detections_list.append({
                        "class": cname,
                        "class_name": cname,
                        "confidence": round(clamped_conf, 4),
                        "bbox": m["bbox"],
                        "track_id": len(new_detections_list) + 100,
                        "few_shot": True,
                    })

        # Spatial Planogram Analysis
        planogram_results = self.planogram.analyze(new_detections_list, frame.shape)
        # Use adjusted counts from cluster decomposition
        adjusted_counts = planogram_results["adjusted_product_counts"]

        # Render annotated frame with bounding boxes and planogram HUD
        annotated_frame = self._render_annotated_frame(frame, planogram_results)
        ret, jpeg = cv2.imencode(".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        jpeg_bytes = jpeg.tobytes() if ret else None

        with self._lock:
            state_changed = (
                adjusted_counts != self._products
                or len(new_detections_list) != len(self._detections)
                or planogram_results.get("misplaced_count", 0) > 0
            )
            self._products = adjusted_counts
            self._detections = new_detections_list
            self._planogram_state = planogram_results
            self._changed = state_changed
            self._last_timestamp = datetime.datetime.now().isoformat()
            self._last_frame = frame
            self._last_annotated_jpeg = jpeg_bytes

        return self.get_state()

    def _render_annotated_frame(self, frame: np.ndarray, planogram_res: Dict[str, Any]) -> np.ndarray:
        """Renders bounding boxes, track IDs, misplacement alerts, and planogram HUD."""
        vis = frame.copy()
        h, w = vis.shape[:2]

        # Draw subtle shelf zone division lines
        cv2.line(vis, (int(w * 0.48), 0), (int(w * 0.48), h), (80, 80, 80), 1, cv2.LINE_AA)
        cv2.line(vis, (0, int(h * 0.52)), (w, int(h * 0.52)), (80, 80, 80), 1, cv2.LINE_AA)

        # Draw detected items
        items = planogram_res.get("items", [])
        for item in items:
            cname = item["class_name"]
            status = item["status"]
            bbox = item["bbox"]
            conf = min(1.0, max(0.0, float(item["confidence"])))
            tid = item.get("track_id")
            units = item.get("estimated_units", 1)

            # Red warning box if misplaced, otherwise class color
            color = (0, 0, 240) if status == "MISPLACED" else CLASS_COLORS.get(cname, (0, 255, 0))
            x1, y1, x2, y2 = bbox
            cv2.rectangle(vis, (x1, y1), (x2, y2), color, 2)

            # Label banner
            id_str = f"#{tid} " if tid else ""
            units_str = f" (x{units})" if units > 1 else ""
            status_tag = " [MISPLACED]" if status == "MISPLACED" else ""
            label_text = f"{id_str}{cname}{units_str} {conf:.0%}{status_tag}"

            (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(vis, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, max(th + 6, y1)), color, -1)
            cv2.putText(vis, label_text, (x1 + 3, max(th, y1 - 3)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # Draw top HUD bar
        cv2.rectangle(vis, (0, 0), (w, 38), (15, 15, 15), -1)
        comp_pct = planogram_res.get("compliance_rate_pct", 100)
        mis_count = planogram_res.get("misplaced_count", 0)

        hud_left = f"ShelfSense Live | Compliance: {comp_pct}% | Misplaced: {mis_count}"
        cv2.putText(vis, hud_left, (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 200) if mis_count == 0 else (0, 100, 255), 1, cv2.LINE_AA)

        inv_str = f"CocaCola: {self._products.get('CocaCola', 0)} | KitKat: {self._products.get('KitKat', 0)} | Lays: {self._products.get('Lays', 0)} | Oreo: {self._products.get('Oreo', 0)}"
        t_w = cv2.getTextSize(inv_str, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)[0][0]
        cv2.putText(vis, inv_str, (w - t_w - 14, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (230, 230, 230), 1, cv2.LINE_AA)

        return vis

    def get_annotated_jpeg(self) -> Optional[bytes]:
        """Returns the latest annotated JPEG frame for HTTP streaming."""
        with self._lock:
            return self._last_annotated_jpeg

    def process_image_bytes(self, image_bytes: bytes, include_few_shot: bool = False) -> Dict[str, Any]:
        """Decodes raw image bytes and processes the shelf scene."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image bytes into a valid image.")
        return self.process_frame(frame, is_live_stream=False, include_few_shot=include_few_shot)

    def process_image_file(self, file_path: Union[str, Path], include_few_shot: bool = False) -> Dict[str, Any]:
        """Reads image from disk and processes the shelf scene."""
        frame = cv2.imread(str(file_path))
        if frame is None:
            raise FileNotFoundError(f"Could not read image file at: {file_path}")
        return self.process_frame(frame, is_live_stream=False, include_few_shot=include_few_shot)

    def start_camera(self) -> Dict[str, Any]:
        """Starts live webcam acquisition in a background thread."""
        with self._lock:
            if self._running:
                return self.get_state()

            self._last_error = None
            self.tracker.reset()
            self._running = True
            self._camera_active = True
            self._camera_thread = threading.Thread(
                target=self._worker_loop, daemon=True
            )
            self._camera_thread.start()

        time.sleep(0.5)
        return self.get_state()

    def stop_camera(self) -> Dict[str, Any]:
        """Stops the camera worker thread."""
        with self._lock:
            if not self._running:
                self._camera_active = False
                return self.get_state()

            self._running = False
            self._camera_active = False

        if self._camera_thread and self._camera_thread.is_alive():
            self._camera_thread.join(timeout=2.0)

        with self._lock:
            self.tracker.reset()
            self._changed = False

        return self.get_state()

    def _worker_loop(self) -> None:
        """Background loop reading frames and running unified detection and tracking."""
        cap = cv2.VideoCapture(self.webcam_index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(self.webcam_index)

        if not cap.isOpened():
            print(f"[ShelfSenseV4Engine] ERROR: Could not open camera {self.webcam_index}")
            with self._lock:
                self._running = False
                self._camera_active = False
                self._last_error = f"Could not open camera device {self.webcam_index}."
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        try:
            while True:
                with self._lock:
                    if not self._running:
                        break

                ret, frame = cap.read()
                if not ret or frame is None:
                    time.sleep(0.03)
                    continue

                self.process_frame(frame, is_live_stream=True)
                time.sleep(0.015)  # Steady ~30-45 FPS
        finally:
            cap.release()

    def set_reorder_thresholds(self, thresholds: Dict[str, int]) -> Dict[str, int]:
        """Updates store-configured minimum stock reorder thresholds."""
        with self._lock:
            for sku, thresh in thresholds.items():
                if sku in V4_1_CLASSES and isinstance(thresh, (int, float)):
                    self.reorder_thresholds[sku] = max(0, int(thresh))
            # Clear stock alerts if thresholds were lowered below current counts
            self._dismissed_alerts.clear()
        return dict(self.reorder_thresholds)

    def update_planogram_zones(self, zones_config: Dict[str, Any]) -> Dict[str, Any]:
        """Recalibrates shelf CAD boundaries and immediately re-evaluates the active frame."""
        with self._lock:
            self.planogram.update_zones(zones_config)
            last_frame = self._last_frame.copy() if self._last_frame is not None else None

        if last_frame is not None:
            return self.process_frame(last_frame, is_live_stream=False)
        return self.get_state()

    def dismiss_alert(self, alert_id: str) -> bool:
        """Dismisses an alert by ID."""
        with self._lock:
            self._dismissed_alerts.add(alert_id)
        return True

    def get_state(self) -> Dict[str, Any]:
        """Returns current shelf inventory, planogram state, and computed alerts."""
        with self._lock:
            products = dict(self._products)
            planogram_state = dict(self._planogram_state)
            reorder_thresholds = dict(self.reorder_thresholds)

            # Generate real-time comprehensive alert list
            alerts: List[Dict[str, Any]] = []

            # 1. Misplacement alerts from planogram engine
            misplacements = planogram_state.get("misplacements", [])
            for mis in misplacements:
                aid = f"misplacement_{mis.get('track_id', 0)}_{mis.get('class_name')}_{mis.get('actual_zone_id')}"
                if aid not in self._dismissed_alerts:
                    neighbor = mis.get("neighbor_sku")
                    neighbor_phrase = f" (near {neighbor})" if neighbor else ""
                    alerts.append({
                        "id": aid,
                        "type": "MISPLACEMENT",
                        "severity": "WARNING",
                        "title": f"Misplaced {mis.get('class_name')}",
                        "product": mis.get("class_name"),
                        "message": f"{mis.get('class_name')} is misplaced in {mis.get('actual_zone_name')}{neighbor_phrase} instead of {mis.get('expected_zone_name')}.",
                        "zone": mis.get("actual_zone_name"),
                        "expected_zone": mis.get("expected_zone_name"),
                        "neighbor_sku": neighbor,
                        "timestamp": self._last_timestamp,
                    })

            # 2. Store-configurable Low-Stock & Out-of-Stock alerts
            for sku in V4_1_CLASSES:
                count = products.get(sku, 0)
                threshold = reorder_thresholds.get(sku, 2)
                expected_zone_id = self.planogram.product_to_zone.get(sku, "")
                zone_info = self.planogram.zones.get(expected_zone_id)
                zone_name = zone_info.name if zone_info else "Designated Zone"

                if count == 0:
                    aid = f"stockout_{sku}"
                    if aid not in self._dismissed_alerts:
                        alerts.append({
                            "id": aid,
                            "type": "STOCKOUT",
                            "severity": "CRITICAL",
                            "title": f"Out of Stock: {sku}",
                            "product": sku,
                            "current_count": 0,
                            "threshold": threshold,
                            "message": f"CRITICAL: {sku} is completely depleted in {zone_name}! Urgent replenishment required.",
                            "zone": zone_name,
                            "timestamp": self._last_timestamp,
                        })
                elif count < threshold:
                    aid = f"low_stock_{sku}_{threshold}"
                    if aid not in self._dismissed_alerts:
                        alerts.append({
                            "id": aid,
                            "type": "LOW_STOCK",
                            "severity": "WARNING",
                            "title": f"Low Stock Warning: {sku}",
                            "product": sku,
                            "current_count": count,
                            "threshold": threshold,
                            "message": f"Low Stock: {sku} count ({count}) is below store minimum ({threshold}). Replenishment recommended.",
                            "zone": zone_name,
                            "timestamp": self._last_timestamp,
                        })

            return {
                "camera_active": self._camera_active,
                "timestamp": self._last_timestamp,
                "changed": self._changed,
                "products": products,
                "reorder_thresholds": reorder_thresholds,
                "alerts": alerts,
                "detections": list(self._detections),
                "planogram": planogram_state,
                "few_shot_registry": few_shot_engine.get_registry_summary(),
                "compliance_pct": planogram_state.get("compliance_rate_pct", 100.0),
                "misplaced_count": planogram_state.get("misplaced_count", 0),
                "error": self._last_error,
            }
