"""
ShelfSense AI — Intelligent Consumption Forecasting & Replenishment Engine
==========================================================================
Integrates deep multi-task predictive models with real-time YOLO11n shelf detections
to calculate:
  - Rolling consumption velocities (15m, 1h, 24h)
  - Next-hour velocity forecasts
  - Minutes to stockout runout predictions
  - 60-minute stockout risk probability
  - Prioritized refill queue ordering (which product to restock first)
"""

from __future__ import annotations

import datetime
import json
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from backend.config import CLASS_NAMES

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "models" / "replenishment_priority_model.pt"
METADATA_PATH = ROOT / "models" / "replenishment_model_metadata.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

SKU_METADATA = {
    "CocaCola": {"id": 0, "max_capacity": 12, "default_threshold": 3, "category": "Beverage", "deck": "Top-Right Deck"},
    "KitKat": {"id": 1, "max_capacity": 16, "default_threshold": 4, "category": "Confectionery", "deck": "Bottom-Left Shelf"},
    "Lays": {"id": 2, "max_capacity": 10, "default_threshold": 2, "category": "Snacks", "deck": "Top-Left Deck"},
    "Oreo": {"id": 3, "max_capacity": 14, "default_threshold": 3, "category": "Biscuits", "deck": "Bottom-Right Shelf"},
}

FEATURE_COLS = [
    "hour_sin", "hour_cos", "is_weekend", "is_rush_hour",
    "current_stock", "max_capacity", "stock_ratio", "reorder_threshold",
    "depletion_deficit", "consumption_vel_15m", "consumption_vel_1h",
    "consumption_vel_24h", "velocity_acceleration", "observation_confidence"
]


class ShelfSenseReplenishmentNet(nn.Module):
    """Multi-task neural network architecture matching the trained checkpoint."""

    def __init__(self, num_skus: int = 4, num_features: int = 14, embedding_dim: int = 8) -> None:
        super().__init__()
        self.sku_embedding = nn.Embedding(num_skus, embedding_dim)

        in_dim = embedding_dim + num_features
        self.input_layer = nn.Sequential(
            nn.Linear(in_dim, 128),
            nn.LayerNorm(128),
            nn.GELU(),
            nn.Dropout(0.10),
        )

        self.res_block1 = nn.Sequential(
            nn.Linear(128, 128),
            nn.LayerNorm(128),
            nn.GELU(),
            nn.Dropout(0.10),
            nn.Linear(128, 128),
            nn.LayerNorm(128),
        )

        self.res_block2 = nn.Sequential(
            nn.Linear(64, 64),
            nn.LayerNorm(64),
            nn.GELU(),
            nn.Dropout(0.05),
            nn.Linear(64, 64),
            nn.LayerNorm(64),
        )
        self.transition = nn.Linear(128, 64)

        self.head_velocity = nn.Sequential(
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Softplus(),
        )

        self.head_runout = nn.Sequential(
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Softplus(),
        )

        self.head_stockout_risk = nn.Sequential(
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

        self.head_urgency = nn.Sequential(
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

    def forward(
        self, sku_ids: torch.Tensor, features: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        sku_emb = self.sku_embedding(sku_ids)
        x = torch.cat([sku_emb, features], dim=1)
        x = self.input_layer(x)
        x = F.gelu(x + self.res_block1(x))
        res2_in = self.transition(x)
        x = F.gelu(res2_in + self.res_block2(res2_in))

        pred_vel = self.head_velocity(x)
        pred_runout = torch.clamp(self.head_runout(x), 0.0, 1440.0)
        pred_risk = self.head_stockout_risk(x)
        pred_urgency = self.head_urgency(x) * 100.0

        return pred_vel, pred_runout, pred_risk, pred_urgency


class ShelfSenseReplenishmentEngine:
    """
    Maintains rolling consumption windows and predicts optimal replenishment ranking.
    """

    def __init__(self) -> None:
        self.model: Optional[ShelfSenseReplenishmentNet] = None
        self.scaler_mean: Optional[np.ndarray] = None
        self.scaler_std: Optional[np.ndarray] = None
        self.metadata: Dict[str, Any] = {}
        self.model_loaded: bool = False

        # Rolling consumption transaction event logs per SKU
        # Stores (timestamp, quantity_change)
        self.consumption_logs: Dict[str, deque] = {
            sku: deque(maxlen=500) for sku in SKU_METADATA.keys()
        }

        # Last known stock levels
        self.last_stock: Dict[str, int] = {sku: SKU_METADATA[sku]["default_threshold"] for sku in SKU_METADATA.keys()}
        self._lock = threading.Lock()

        self._load_model()

    def _load_model(self) -> None:
        """Loads trained multi-task weights and standardization parameters."""
        if not MODEL_PATH.exists() or not METADATA_PATH.exists():
            print(f"[ReplenishmentEngine] Warning: Model weights not found at {MODEL_PATH}. Using calibrated heuristic fallback.")
            self.model_loaded = False
            return

        try:
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

            scaler_info = self.metadata.get("scaler", {})
            self.scaler_mean = np.array(scaler_info.get("mean", []), dtype=np.float32)
            self.scaler_std = np.array(scaler_info.get("std", []), dtype=np.float32)

            self.model = ShelfSenseReplenishmentNet(num_skus=4, num_features=len(FEATURE_COLS)).to(DEVICE)
            self.model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
            self.model.eval()
            self.model_loaded = True
            print(f"[ReplenishmentEngine] Deep Replenishment Net loaded successfully onto {DEVICE}.")
        except Exception as e:
            print(f"[ReplenishmentEngine] Failed to load model weights: {e}")
            self.model_loaded = False

    def record_stock_update(self, current_stock: Dict[str, int]) -> None:
        """Records stock transitions and computes consumption removal events."""
        now = time.time()
        with self._lock:
            for sku, count in current_stock.items():
                if sku in self.last_stock:
                    prev = self.last_stock[sku]
                    diff = prev - count
                    if diff > 0:
                        # Product units removed from shelf (purchased / consumed)
                        self.consumption_logs[sku].append((now, diff))
                    self.last_stock[sku] = count

    def get_consumption_velocities(self, sku: str) -> Tuple[float, float, float, float]:
        """Calculates rolling consumption rates (units/hr) for 15m, 1h, 24h windows."""
        now = time.time()
        logs = self.consumption_logs.get(sku, deque())

        # Sum units removed in respective windows
        rem_15m = sum(qty for ts, qty in logs if now - ts <= 900)
        rem_1h = sum(qty for ts, qty in logs if now - ts <= 3600)
        rem_24h = sum(qty for ts, qty in logs if now - ts <= 86400)

        # Baseline velocity simulations if newly initialized
        base_v = {"CocaCola": 2.2, "KitKat": 2.8, "Lays": 1.9, "Oreo": 1.4}.get(sku, 1.5)

        vel_15m = max(float(rem_15m * 4.0), base_v * 1.1)
        vel_1h = max(float(rem_1h), base_v)
        vel_24h = max(float(rem_24h / 24.0) if rem_24h > 0 else base_v * 0.9, 0.4)
        accel = vel_15m - vel_1h

        return vel_15m, vel_1h, vel_24h, accel

    def analyze_replenishment_priorities(
        self,
        current_products: Dict[str, int],
        reorder_thresholds: Dict[str, int],
        observation_confidence: float = 0.92,
    ) -> Dict[str, Any]:
        """
        Runs full inference across all SKUs, predicts velocity and runout times,
        and generates the sorted refill queue.
        """
        now_dt = datetime.datetime.now()
        hour = now_dt.hour
        hour_sin = float(np.sin(2 * np.pi * hour / 24.0))
        hour_cos = float(np.cos(2 * np.pi * hour / 24.0))
        is_weekend = 1 if now_dt.weekday() >= 5 else 0
        is_rush = 1 if (11 <= hour <= 14 or 17 <= hour <= 21) else 0

        queue_items: List[Dict[str, Any]] = []

        # Batch prepare inputs if model is available
        sku_order = list(SKU_METADATA.keys())
        features_list = []
        sku_ids = []

        for sku in sku_order:
            meta = SKU_METADATA[sku]
            stock = current_products.get(sku, 0)
            max_cap = meta["max_capacity"]
            thresh = reorder_thresholds.get(sku, meta["default_threshold"])
            deficit = max(0, thresh - stock)
            stock_ratio = stock / max_cap

            vel_15m, vel_1h, vel_24h, accel = self.get_consumption_velocities(sku)

            feats = [
                hour_sin, hour_cos, is_weekend, is_rush,
                stock, max_cap, stock_ratio, thresh, deficit,
                vel_15m, vel_1h, vel_24h, accel, observation_confidence
            ]
            features_list.append(feats)
            sku_ids.append(meta["id"])

        if self.model_loaded and self.model is not None and self.scaler_mean is not None:
            # Neural Multi-Task Prediction
            feat_arr = np.array(features_list, dtype=np.float32)
            norm_feats = (feat_arr - self.scaler_mean) / self.scaler_std

            with torch.no_grad():
                t_sku = torch.tensor(sku_ids, dtype=torch.long).to(DEVICE)
                t_feat = torch.tensor(norm_feats, dtype=torch.float32).to(DEVICE)
                p_vel, p_runout, p_risk, p_urg = self.model(t_sku, t_feat)

                pred_vels = p_vel.cpu().numpy().flatten()
                pred_runouts = p_runout.cpu().numpy().flatten()
                pred_risks = p_risk.cpu().numpy().flatten()
                pred_urgs = p_urg.cpu().numpy().flatten()
        else:
            # Calibrated Mathematical Heuristic Fallback
            pred_vels = [features_list[i][10] * 1.1 for i in range(len(sku_order))]
            pred_runouts = [
                0.0 if current_products.get(sku, 0) == 0
                else min(1440.0, (current_products.get(sku, 0) / max(0.1, pred_vels[i])) * 60.0)
                for i, sku in enumerate(sku_order)
            ]
            pred_risks = [1.0 if current_products.get(sku, 0) == 0 else 0.45 for sku in sku_order]
            pred_urgs = [
                85.0 if current_products.get(sku, 0) == 0
                else max(10.0, 75.0 - current_products.get(sku, 0) * 12.0)
                for sku in sku_order
            ]

        for i, sku in enumerate(sku_order):
            meta = SKU_METADATA[sku]
            stock = current_products.get(sku, 0)
            max_cap = meta["max_capacity"]
            thresh = reorder_thresholds.get(sku, meta["default_threshold"])
            deficit = max(0, thresh - stock)
            recommended_refill = max(0, max_cap - stock)

            urg = float(pred_urgs[i])
            runout_mins = float(pred_runouts[i])
            vel_forecast = float(pred_vels[i])
            risk = float(pred_risks[i])

            # Classify Priority Level
            if stock == 0:
                priority_tier = "CRITICAL"
                badge_color = "rose"
                status_text = "DEPLETED / IMMEDIATE REFILL"
            elif stock < thresh:
                priority_tier = "HIGH"
                badge_color = "amber"
                status_text = "BELOW STORE THRESHOLD"
            elif urg >= 50.0:
                priority_tier = "MEDIUM"
                badge_color = "blue"
                status_text = "ACTIVE CONSUMPTION"
            else:
                priority_tier = "LOW"
                badge_color = "emerald"
                status_text = "STOCK HEALTHY"

            queue_items.append({
                "sku": sku,
                "category": meta["category"],
                "deck": meta["deck"],
                "current_stock": stock,
                "max_capacity": max_cap,
                "reorder_threshold": thresh,
                "depletion_deficit": deficit,
                "recommended_refill_units": recommended_refill,
                "predicted_velocity_units_hr": round(vel_forecast, 2),
                "runout_minutes": round(runout_mins, 1),
                "stockout_risk_60m": round(risk, 3),
                "urgency_score": round(urg, 1),
                "priority_tier": priority_tier,
                "status_text": status_text,
                "badge_color": badge_color,
            })

        # Sort strictly by urgency score descending to establish the optimal replenishment sequence!
        queue_items.sort(key=lambda x: x["urgency_score"], reverse=True)

        for rank, item in enumerate(queue_items, start=1):
            item["refill_rank"] = rank

        top_priority = queue_items[0] if queue_items else None

        return {
            "timestamp": now_dt.isoformat(),
            "model_version": "ShelfSense-ReplenishmentNet-v1.0",
            "is_rush_hour": bool(is_rush),
            "hour_of_day": hour,
            "top_priority_product": top_priority["sku"] if top_priority else None,
            "queue": queue_items,
            "summary": {
                "critical_refill_count": sum(1 for item in queue_items if item["priority_tier"] == "CRITICAL"),
                "high_priority_count": sum(1 for item in queue_items if item["priority_tier"] in ("CRITICAL", "HIGH")),
                "total_refill_units_needed": sum(item["recommended_refill_units"] for item in queue_items if item["depletion_deficit"] > 0),
            }
        }


# Singleton engine instance
replenishment_engine = ShelfSenseReplenishmentEngine()

