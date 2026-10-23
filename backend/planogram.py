"""
ShelfSense — Retail Planogram & Spatial Misplacement Analysis Engine
===================================================================
Analyzes the 2D spatial arrangement of detected items relative to
the authoritative physical shelf layout:
  - Top-Left:      Lay's Zone (Snacks Deck Left)
  - Top-Right:     Coca-Cola Zone (Beverages Deck Right)
  - Bottom-Left:   KitKat Zone (Confectionery Interior Left)
  - Bottom-Right:  Oreo Zone (Biscuits Interior Right)

Detects:
  1. Product Misplacement: Flags items placed in the wrong shelf zone
     and articulates exact misplacement context (e.g. "KitKat is near Lay's").
  2. Multi-Pack Stack Decomposition: Accurately resolves KitKat clusters into
     individual bar unit counts based on bounding box geometry.
  3. Out-of-Stock (OOS) conditions when designated zones are empty.
  4. Real-time planogram compliance percentage score.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class ShelfZone:
    id: str
    name: str
    designated_product: str
    # Normalized bounding box [x_min, y_min, x_max, y_max] within the shelf scene
    x_range: Tuple[float, float]
    y_range: Tuple[float, float]
    color: str  # Hex for UI rendering


# Authoritative Physical Shelf Planogram Grid
SHELF_ZONES: Dict[str, ShelfZone] = {
    "TOP_LEFT": ShelfZone(
        id="TOP_LEFT",
        name="Top-Left Deck",
        designated_product="Lays",
        x_range=(0.0, 0.48),
        y_range=(0.0, 0.52),
        color="#FFD700",
    ),
    "TOP_RIGHT": ShelfZone(
        id="TOP_RIGHT",
        name="Top-Right Deck",
        designated_product="CocaCola",
        x_range=(0.48, 1.0),
        y_range=(0.0, 0.52),
        color="#E61E1E",
    ),
    "BOTTOM_LEFT": ShelfZone(
        id="BOTTOM_LEFT",
        name="Bottom-Left Shelf",
        designated_product="KitKat",
        x_range=(0.0, 0.45),
        y_range=(0.52, 1.0),
        color="#C81EC8",
    ),
    "BOTTOM_RIGHT": ShelfZone(
        id="BOTTOM_RIGHT",
        name="Bottom-Right Shelf",
        designated_product="Oreo",
        x_range=(0.45, 1.0),
        y_range=(0.52, 1.0),
        color="#008CFF",
    ),
}

# Mapping from product to its designated shelf zone
PRODUCT_TO_ZONE: Dict[str, str] = {
    zone.designated_product: zone_id for zone_id, zone in SHELF_ZONES.items()
}


@dataclass
class ItemSpatialAnalysis:
    track_id: Optional[int]
    class_name: str
    confidence: float
    bbox: List[int]
    center_norm: Tuple[float, float]  # (norm_x, norm_y)
    actual_zone_id: str
    actual_zone_name: str
    expected_zone_id: str
    expected_zone_name: str
    neighbor_sku: Optional[str]
    status: str  # "CORRECT" or "MISPLACED"
    message: str
    estimated_units: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "class_name": self.class_name,
            "confidence": self.confidence,
            "bbox": self.bbox,
            "center_norm": [round(self.center_norm[0], 4), round(self.center_norm[1], 4)],
            "actual_zone_id": self.actual_zone_id,
            "actual_zone_name": self.actual_zone_name,
            "expected_zone_id": self.expected_zone_id,
            "expected_zone_name": self.expected_zone_name,
            "neighbor_sku": self.neighbor_sku,
            "status": self.status,
            "message": self.message,
            "estimated_units": self.estimated_units,
        }


class PlanogramAnalyzer:
    """Evaluates detections against the physical shelf planogram."""

    def __init__(self, decompose_kitkat_clusters: bool = True) -> None:
        self.decompose_kitkat_clusters = decompose_kitkat_clusters
        self.audit_log: List[Dict[str, Any]] = []
        self.zones: Dict[str, ShelfZone] = dict(SHELF_ZONES)
        self.product_to_zone: Dict[str, str] = {
            zone.designated_product: zone_id for zone_id, zone in self.zones.items()
        }

    def update_zones(self, zones_config: Dict[str, Any]) -> Dict[str, ShelfZone]:
        """
        Dynamically recalibrates shelf zone coordinate boundaries or product allocations.
        """
        for z_id, conf in zones_config.items():
            if z_id in self.zones:
                cur = self.zones[z_id]
                x_rng = tuple(conf["x_range"]) if "x_range" in conf else cur.x_range
                y_rng = tuple(conf["y_range"]) if "y_range" in conf else cur.y_range
                p_name = conf.get("designated_product", cur.designated_product)
                z_name = conf.get("name", cur.name)
                color = conf.get("color", cur.color)

                self.zones[z_id] = ShelfZone(
                    id=z_id,
                    name=z_name,
                    designated_product=p_name,
                    x_range=x_rng,
                    y_range=y_rng,
                    color=color
                )
                SHELF_ZONES[z_id] = self.zones[z_id]

        self.product_to_zone = {
            zone.designated_product: zone_id for zone_id, zone in self.zones.items()
        }
        PRODUCT_TO_ZONE.clear()
        PRODUCT_TO_ZONE.update(self.product_to_zone)
        return self.zones

    def get_zone_for_center(self, norm_x: float, norm_y: float) -> ShelfZone:
        """Determines which shelf zone contains the normalized coordinates."""
        for zone in self.zones.values():
            x_min, x_max = zone.x_range
            y_min, y_max = zone.y_range
            if x_min <= norm_x <= x_max and y_min <= norm_y <= y_max:
                return zone
        # Default fallback based on active split boundaries
        top_left = self.zones.get("TOP_LEFT", SHELF_ZONES["TOP_LEFT"])
        y_split = top_left.y_range[1]
        x_split = top_left.x_range[1]
        if norm_y < y_split:
            return self.zones.get("TOP_LEFT", SHELF_ZONES["TOP_LEFT"]) if norm_x < x_split else self.zones.get("TOP_RIGHT", SHELF_ZONES["TOP_RIGHT"])
        else:
            return self.zones.get("BOTTOM_LEFT", SHELF_ZONES["BOTTOM_LEFT"]) if norm_x < x_split else self.zones.get("BOTTOM_RIGHT", SHELF_ZONES["BOTTOM_RIGHT"])

    def estimate_kitkat_units(self, bbox: List[int], frame_shape: Tuple[int, int]) -> int:
        """
        Estimates the number of mini KitKat bars in a detected bounding box.
        If a single box encloses an entire stack/cluster of 3 mini bars,
        it estimates unit count based on box aspect ratio and relative area.
        """
        if not self.decompose_kitkat_clusters:
            return 1

        x1, y1, x2, y2 = bbox
        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)
        fh, fw = frame_shape[:2]

        # Normalized width and height relative to camera frame
        norm_w = bw / fw
        norm_h = bh / fh
        aspect_ratio = bw / bh

        # A single 2-finger KitKat bar is slender (aspect ratio ~0.25 to 0.45 when vertical).
        # When 2 or 3 bars lie side-by-side or stacked in a cluster, width/height is ~0.8 to 1.8.
        if norm_w > 0.12 or norm_h > 0.14 or aspect_ratio > 0.85:
            # Multi-bar cluster detected
            if aspect_ratio >= 1.2 or (norm_w > 0.14 and norm_h > 0.12):
                return 3
            elif aspect_ratio >= 0.7 or norm_w > 0.10:
                return 2
        return 1

    def analyze(
        self,
        detections: List[Dict[str, Any]],
        frame_shape: Tuple[int, int] = (720, 1280),
    ) -> Dict[str, Any]:
        """
        Analyzes full set of detections against planogram allocations.
        """
        fh, fw = frame_shape[:2]
        analyzed_items: List[ItemSpatialAnalysis] = []
        misplaced_items: List[ItemSpatialAnalysis] = []

        zone_occupancy: Dict[str, Dict[str, Any]] = {
            z_id: {
                "zone_id": z_id,
                "zone_name": zone.name,
                "designated_product": zone.designated_product,
                "color": zone.color,
                "item_count": 0,
                "detected_products": {},
                "status": "EMPTY",  # "COMPLIANT", "MISPLACED", "EMPTY"
            }
            for z_id, zone in self.zones.items()
        }

        adjusted_products: Dict[str, int] = {"CocaCola": 0, "KitKat": 0, "Lays": 0, "Oreo": 0}

        for det in detections:
            cname = det.get("class") or det.get("class_name", "Unknown")
            conf = det.get("confidence", 0.0)
            bbox = det.get("bbox", [0, 0, 0, 0])
            tid = det.get("track_id")

            # Compute normalized center
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = (bbox[1] + bbox[3]) / 2.0
            norm_x = cx / fw
            norm_y = cy / fh

            actual_zone = self.get_zone_for_center(norm_x, norm_y)
            expected_zone_id = self.product_to_zone.get(cname, "UNKNOWN")
            expected_zone = self.zones.get(expected_zone_id)
            expected_name = expected_zone.name if expected_zone else "Unassigned Area"

            # Determine unit count (with multi-pack cluster estimation)
            units = 1
            if cname == "KitKat":
                units = self.estimate_kitkat_units(bbox, frame_shape)
            adjusted_products[cname] = adjusted_products.get(cname, 0) + units

            neighbor = actual_zone.designated_product
            # Misplacement check
            if actual_zone.id == expected_zone_id:
                status = "CORRECT"
                msg = f"{cname} is correctly placed in {actual_zone.name}."
            else:
                status = "MISPLACED"
                msg = f"{cname} is misplaced! Placed in {actual_zone.name} (near {neighbor}) instead of {expected_name}."

            item_analysis = ItemSpatialAnalysis(
                track_id=tid,
                class_name=cname,
                confidence=conf,
                bbox=bbox,
                center_norm=(norm_x, norm_y),
                actual_zone_id=actual_zone.id,
                actual_zone_name=actual_zone.name,
                expected_zone_id=expected_zone_id,
                expected_zone_name=expected_name,
                neighbor_sku=neighbor if status == "MISPLACED" else None,
                status=status,
                message=msg,
                estimated_units=units,
            )

            analyzed_items.append(item_analysis)
            if status == "MISPLACED":
                misplaced_items.append(item_analysis)
                # Log event
                self._record_misplacement_event(item_analysis)

            # Update zone occupancy stats
            z_entry = zone_occupancy[actual_zone.id]
            z_entry["item_count"] += units
            z_entry["detected_products"][cname] = z_entry["detected_products"].get(cname, 0) + units

        # Compute zone statuses
        for z_id, z_data in zone_occupancy.items():
            designated = z_data["designated_product"]
            products_in_zone = z_data["detected_products"]

            if z_data["item_count"] == 0:
                z_data["status"] = "OUT_OF_STOCK"
            elif all(p == designated for p in products_in_zone.keys()):
                z_data["status"] = "COMPLIANT"
            else:
                z_data["status"] = "MISPLACED_OCCUPIED"

        total_detected = len(analyzed_items)
        correct_count = total_detected - len(misplaced_items)
        compliance_pct = round((correct_count / total_detected * 100.0) if total_detected > 0 else 100.0, 1)

        return {
            "timestamp": datetime.datetime.now().isoformat(),
            "total_items_detected": total_detected,
            "total_units_counted": sum(adjusted_products.values()),
            "adjusted_product_counts": adjusted_products,
            "compliance_rate_pct": compliance_pct,
            "misplaced_count": len(misplaced_items),
            "zones": zone_occupancy,
            "items": [item.to_dict() for item in analyzed_items],
            "misplacements": [item.to_dict() for item in misplaced_items],
            "audit_log": self.audit_log[-20:],  # Recent 20 events
        }

    def _record_misplacement_event(self, item: ItemSpatialAnalysis) -> None:
        """Appends a timestamped audit log event."""
        # Avoid duplicate consecutive logs for the same track
        now_ts = datetime.datetime.now().strftime("%H:%M:%S")
        if self.audit_log:
            last = self.audit_log[-1]
            if last["track_id"] == item.track_id and last["message"] == item.message:
                return

        self.audit_log.append({
            "timestamp": now_ts,
            "track_id": item.track_id,
            "product": item.class_name,
            "severity": "WARNING",
            "message": item.message,
            "actual_zone": item.actual_zone_name,
            "expected_zone": item.expected_zone_name,
        })

