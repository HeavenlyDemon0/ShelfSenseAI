"""
ShelfSense — Component B: Advanced Temporal Smoothing & Tracking Module
========================================================================
Implements real-time temporal tracking, exponential moving average (EMA)
bounding-box smoothing, hysteresis confirmation, and miss grace periods.
Prevents webcam detection flickering and stabilizes multi-object inventory counting.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
import numpy as np

CLASS_NAMES: Dict[int, str] = {
    0: "CocaCola",
    1: "KitKat",
    2: "Lays",
    3: "Oreo",
}


@dataclass
class TrackedItem:
    track_id: int
    class_id: int
    class_name: str
    bbox: List[int]  # [x1, y1, x2, y2]
    confidence: float
    hits: int = 1
    misses: int = 0
    confirmed: bool = False
    history: List[List[int]] = field(default_factory=list)

    def update(self, new_bbox: List[int], new_conf: float, alpha: float = 0.65) -> None:
        """Update track with EMA smoothed coordinates and confidence."""
        # Exponential moving average for smooth bounding box transitions without jitter
        self.bbox = [
            int(alpha * new_bbox[0] + (1 - alpha) * self.bbox[0]),
            int(alpha * new_bbox[1] + (1 - alpha) * self.bbox[1]),
            int(alpha * new_bbox[2] + (1 - alpha) * self.bbox[2]),
            int(alpha * new_bbox[3] + (1 - alpha) * self.bbox[3]),
        ]
        self.confidence = float(0.6 * new_conf + 0.4 * self.confidence)
        self.hits += 1
        self.misses = 0
        if self.hits >= 2:
            self.confirmed = True
        self.history.append(self.bbox)
        if len(self.history) > 10:
            self.history.pop(0)

    def mark_missed(self) -> None:
        self.misses += 1
        # Slightly decay confidence during miss grace period
        self.confidence *= 0.90


def compute_iou(boxA: List[int], boxB: List[int]) -> float:
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


class ShelfSenseTemporalTracker:
    """
    Temporal tracker that eliminates flicker, smooths bounding boxes,
    maintains persistent track IDs, and accurately tracks distinct physical items.
    """

    def __init__(
        self,
        iou_threshold: float = 0.35,
        max_misses: int = 4,      # ~130ms grace period at 30 FPS
        min_hits_confirm: int = 2, # Requires 2 consecutive hits to confirm
        smoothing_alpha: float = 0.65,
        **kwargs: Any,
    ) -> None:
        if "iou_match_threshold" in kwargs:
            iou_threshold = kwargs["iou_match_threshold"]
        if "max_age" in kwargs:
            max_misses = kwargs["max_age"]
        if "min_hits" in kwargs:
            min_hits_confirm = kwargs["min_hits"]
        if "ema_alpha" in kwargs:
            smoothing_alpha = kwargs["ema_alpha"]

        self.iou_threshold = iou_threshold
        self.max_misses = max_misses
        self.min_hits_confirm = min_hits_confirm
        self.smoothing_alpha = smoothing_alpha

        self.tracks: Dict[int, TrackedItem] = {}
        self.next_id: int = 1

    def update(
        self,
        raw_detections: List[Dict], # list of dicts: {"class_id": int, "class_name": str, "confidence": float, "bbox": [x1,y1,x2,y2]}
    ) -> List[TrackedItem]:
        """
        Associates raw detections with existing tracks using class-aware IoU matching.
        Returns the list of active, confirmed tracked items for display and inventory counts.
        """
        matched_track_ids = set()
        unmatched_detections = []

        # Sort raw detections by confidence descending
        detections = sorted(raw_detections, key=lambda d: d["confidence"], reverse=True)

        for det in detections:
            best_iou = 0.0
            best_tid = None

            for tid, track in self.tracks.items():
                if tid in matched_track_ids:
                    continue
                # Class-aware matching: only match same product class
                if track.class_name != det["class_name"]:
                    continue

                iou = compute_iou(track.bbox, det["bbox"])
                if iou > best_iou and iou >= self.iou_threshold:
                    best_iou = iou
                    best_tid = tid

            if best_tid is not None:
                matched_track_ids.add(best_tid)
                self.tracks[best_tid].update(
                    det["bbox"],
                    det["confidence"],
                    alpha=self.smoothing_alpha,
                )
            else:
                unmatched_detections.append(det)

        # Handle unmatched existing tracks (increment miss count)
        for tid in list(self.tracks.keys()):
            if tid not in matched_track_ids:
                self.tracks[tid].mark_missed()
                # Prune tracks that exceed max grace period
                if self.tracks[tid].misses > self.max_misses:
                    del self.tracks[tid]

        # Initialize new tracks for unmatched raw detections
        for det in unmatched_detections:
            new_track = TrackedItem(
                track_id=self.next_id,
                class_id=det.get("class_id", 0),
                class_name=det["class_name"],
                bbox=det["bbox"],
                confidence=det["confidence"],
                hits=1,
                misses=0,
                confirmed=(self.min_hits_confirm <= 1),
            )
            self.tracks[self.next_id] = new_track
            self.next_id += 1

        # Return active confirmed tracks (or unconfirmed if min_hits_confirm == 1)
        active_items = [
            t for t in self.tracks.values()
            if t.confirmed or t.hits >= self.min_hits_confirm
        ]
        return active_items

    def reset(self) -> None:
        """Reset internal tracking state on camera stop."""
        self.tracks.clear()
        self.next_id = 1


class ObjectTracker:
    """Wrapper matching the original ObjectTracker interface while utilizing ShelfSenseTemporalTracker."""

    def __init__(self) -> None:
        self.inner_tracker = ShelfSenseTemporalTracker()

    def process_detections(self, detections: list) -> list:
        # If detections are Detection objects, convert to dict, track, and return updated Detection objects
        from backend.detector_v4_1 import Detection
        
        raw_list = []
        for d in detections:
            raw_list.append({
                "class_name": d.class_name,
                "confidence": d.confidence,
                "bbox": d.bbox,
                "class_id": 0,
            })

        tracked_items = self.inner_tracker.update(raw_list)
        
        results = []
        for item in tracked_items:
            results.append(
                Detection(
                    class_name=item.class_name,
                    confidence=item.confidence,
                    bbox=item.bbox,
                    track_id=item.track_id,
                )
            )
        return results

    def reset(self) -> None:
        self.inner_tracker.reset()
