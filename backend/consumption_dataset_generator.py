"""
ShelfSense AI — Authentic Retail Consumption & Replenishment Dataset Generator
==============================================================================
Generates a realistic multi-store retail dataset simulating continuous
shelf observations, customer pick-up events, rush-hour demand spikes,
and stock depletion dynamics across the 4 authoritative SKUs:
  - CocaCola (Beverage - high rush hour sensitivity, impulsive)
  - KitKat (Confectionery - impulse checkout, multi-pack cluster picks)
  - Lays (Snacks - high evening/lunch basket attachment)
  - Oreo (Biscuits - steady family pantry demand)

Features generated per record:
  - sku: Product Name & Category
  - hour_of_day, day_of_week, is_weekend, is_rush_hour
  - current_stock: Units currently on shelf (0 to max_capacity)
  - max_capacity: Shelf slot physical limit
  - stock_ratio: current_stock / max_capacity
  - reorder_threshold: Store-configured replenishment trigger
  - depletion_deficit: max(0, reorder_threshold - current_stock)
  - consumption_vel_15m: Units removed/hr over last 15 mins
  - consumption_vel_1h: Units removed/hr over last 60 mins
  - consumption_vel_24h: Average daily velocity
  - velocity_acceleration: vel_15m - vel_1h (demand surge indicator)
  - observation_confidence: Camera clarity (accounting for occlusions & lighting)

Ground-truth Targets:
  - next_hour_velocity: Realized consumption rate in t+1
  - minutes_to_stockout: Exact time until shelf reaches 0 units
  - stockout_risk_60m: Probability of reaching 0 in next 60 min (0.0 to 1.0)
  - replenishment_urgency_score: Multi-factor composite priority score (0 to 100)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple
import csv
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_CSV = ROOT / "datasets" / "consumption_synthetic_dataset.csv"
OUTPUT_METADATA = ROOT / "datasets" / "consumption_dataset_metadata.json"

SKU_PROFILES = {
    "CocaCola": {
        "max_capacity": 12,
        "base_hourly_lambda": 2.2,
        "rush_multiplier": 2.8,  # Huge lunch & evening spikes
        "lunch_affinity": 2.4,
        "evening_affinity": 2.6,
        "weekend_mult": 1.3,
        "urgency_weight": 1.2,
    },
    "KitKat": {
        "max_capacity": 16,
        "base_hourly_lambda": 1.8,
        "rush_multiplier": 2.2,
        "lunch_affinity": 1.6,
        "evening_affinity": 2.4,
        "weekend_mult": 1.4,
        "urgency_weight": 1.1,
    },
    "Lays": {
        "max_capacity": 10,
        "base_hourly_lambda": 1.9,
        "rush_multiplier": 2.5,
        "lunch_affinity": 2.2,
        "evening_affinity": 2.8,
        "weekend_mult": 1.5,
        "urgency_weight": 1.15,
    },
    "Oreo": {
        "max_capacity": 14,
        "base_hourly_lambda": 1.4,
        "rush_multiplier": 1.8,
        "lunch_affinity": 1.3,
        "evening_affinity": 2.0,
        "weekend_mult": 1.6,
        "urgency_weight": 1.0,
    },
}


def compute_rush_factor(hour: int, is_weekend: bool, profile: Dict[str, float]) -> Tuple[float, bool]:
    """Computes hourly customer traffic multiplier based on retail diurnal cycles."""
    is_rush = False
    factor = 0.35  # baseline early morning / late night

    if 8 <= hour < 11:
        factor = 0.8  # morning opening
    elif 11 <= hour < 14:
        factor = profile["lunch_affinity"]  # Lunch peak
        is_rush = True
    elif 14 <= hour < 17:
        factor = 1.1  # Afternoon steady
    elif 17 <= hour < 21:
        factor = profile["evening_affinity"]  # Evening commuter peak
        is_rush = True
    elif 21 <= hour < 23:
        factor = 0.6  # Late evening tapering

    if is_weekend:
        factor *= profile["weekend_mult"]

    return factor, is_rush


def generate_synthetic_consumption_dataset(
    num_samples: int = 50000,
    random_seed: int = 42
) -> pd.DataFrame:
    """Generates 50,000 highly realistic observation records."""
    rng = np.random.RandomState(random_seed)
    records: List[Dict] = []
    skus = list(SKU_PROFILES.keys())

    print("=" * 75)
    print("SHELFSENSE: GENERATING HIGH-FIDELITY RETAIL CONSUMPTION DATASET")
    print(f"Target Samples  : {num_samples:,}")
    print(f"Authoritative SKUs: {skus}")
    print("=" * 75)

    for i in range(num_samples):
        sku = str(rng.choice(skus))
        profile = SKU_PROFILES[sku]
        max_cap = profile["max_capacity"]

        hour = int(rng.randint(0, 24))
        day = int(rng.randint(0, 7))
        is_weekend = (day >= 5)

        rush_factor, is_rush = compute_rush_factor(hour, is_weekend, profile)

        # Baseline latent Poisson demand for current and next periods
        base_lambda = profile["base_hourly_lambda"] * rush_factor
        current_lambda = max(0.1, rng.normal(base_lambda, base_lambda * 0.20))
        next_lambda = max(0.1, rng.normal(base_lambda, base_lambda * 0.25))

        # Current stock level on shelf (uniform mixed with Poisson depletion)
        # Includes healthy stock, borderline low-stock, and total stockouts
        stock_mode = rng.choice(["healthy", "low", "empty"], p=[0.55, 0.35, 0.10])
        reorder_threshold = int(rng.randint(2, max(3, max_cap // 3 + 2)))

        if stock_mode == "empty":
            current_stock = 0
        elif stock_mode == "low":
            current_stock = int(rng.randint(1, reorder_threshold + 1))
        else:
            current_stock = int(rng.randint(reorder_threshold, max_cap + 1))

        stock_ratio = current_stock / max_cap
        depletion_deficit = max(0, reorder_threshold - current_stock)

        # Recent consumption velocities with realistic variance
        # If stock was 0, observed velocity was artificially throttled (censored demand)
        vel_24h = max(0.2, rng.normal(base_lambda * 0.9, 0.4))
        vel_1h = max(0.0, rng.poisson(max(0.1, current_lambda)))
        vel_15m = max(0.0, rng.poisson(max(0.05, current_lambda * 0.25)) * 4.0)

        # Acceleration (demand shock or rush beginning)
        vel_accel = vel_15m - vel_1h

        # Sensor confidence (ambient camera noise & customer occlusions)
        obs_conf = float(rng.beta(15, 2))  # Mean ~0.88, occasionally drops to 0.55 during occlusions
        if is_rush and rng.rand() < 0.25:
            # Temporary shopper occlusion in front of shelf
            obs_conf = float(rng.uniform(0.45, 0.70))

        # Target 1: Next hour realized velocity
        # If stock is 0, customers can't buy (censored), but demand still indicates required refill speed!
        next_hour_vel = float(next_lambda)

        # Target 2: Minutes to stockout
        if current_stock <= 0:
            minutes_to_stockout = 0.0
        else:
            effective_consumption_per_min = max(0.02, next_hour_vel / 60.0)
            minutes_to_stockout = float(min(1440.0, current_stock / effective_consumption_per_min))

        # Target 3: Stockout risk in next 60 minutes (probability 0 to 1)
        if current_stock <= 0:
            stockout_risk_60m = 1.0
        else:
            expected_60m_consumption = next_hour_vel
            # Normal approximation for stockout probability P(Demand >= current_stock)
            z = (expected_60m_consumption - current_stock) / max(0.5, np.sqrt(expected_60m_consumption))
            stockout_risk_60m = float(1.0 / (1.0 + np.exp(-1.5 * z)))

        # Target 4: Multi-Factor Replenishment Urgency Score (0 to 100)
        # Combines stock deficit, velocity surge, runout proximity, and SKU criticality
        deficit_term = 40.0 * (depletion_deficit / max(1, reorder_threshold)) if depletion_deficit > 0 else 0.0
        runout_term = 35.0 / (1.0 + minutes_to_stockout / 45.0)
        velocity_term = 15.0 * min(2.0, next_hour_vel / (profile["base_hourly_lambda"] * 2.5))
        empty_penalty = 15.0 if current_stock == 0 else 0.0

        raw_urgency = (deficit_term + runout_term + velocity_term + empty_penalty) * profile["urgency_weight"]
        # Uncertainty attenuation: if camera is severely occluded, flag for inspection
        urgency_score = float(np.clip(raw_urgency, 0.0, 100.0))

        records.append({
            "sku": sku,
            "sku_id": skus.index(sku),
            "hour_of_day": hour,
            "hour_sin": np.sin(2 * np.pi * hour / 24.0),
            "hour_cos": np.cos(2 * np.pi * hour / 24.0),
            "day_of_week": day,
            "is_weekend": int(is_weekend),
            "is_rush_hour": int(is_rush),
            "current_stock": current_stock,
            "max_capacity": max_cap,
            "stock_ratio": round(stock_ratio, 4),
            "reorder_threshold": reorder_threshold,
            "depletion_deficit": depletion_deficit,
            "consumption_vel_15m": round(vel_15m, 2),
            "consumption_vel_1h": round(vel_1h, 2),
            "consumption_vel_24h": round(vel_24h, 2),
            "velocity_acceleration": round(vel_accel, 2),
            "observation_confidence": round(obs_conf, 4),
            # Targets:
            "next_hour_velocity": round(next_hour_vel, 2),
            "minutes_to_stockout": round(minutes_to_stockout, 1),
            "stockout_risk_60m": round(stockout_risk_60m, 4),
            "replenishment_urgency_score": round(urgency_score, 2),
        })

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)

    print(f"[OK] Saved {len(records):,} synthetic consumption records to: {OUTPUT_CSV}")

    urgencies = [r["replenishment_urgency_score"] for r in records]
    zeros = [1 for r in records if r["current_stock"] == 0]
    vels = [r["next_hour_velocity"] for r in records]

    metadata = {
        "total_records": len(records),
        "skus": skus,
        "feature_columns": [
            "sku_id", "hour_sin", "hour_cos", "is_weekend", "is_rush_hour",
            "current_stock", "max_capacity", "stock_ratio", "reorder_threshold",
            "depletion_deficit", "consumption_vel_15m", "consumption_vel_1h",
            "consumption_vel_24h", "velocity_acceleration", "observation_confidence"
        ],
        "target_columns": [
            "next_hour_velocity", "minutes_to_stockout", "stockout_risk_60m", "replenishment_urgency_score"
        ],
        "stats": {
            "mean_urgency": round(float(np.mean(urgencies)), 2),
            "stockout_pct": round(float(len(zeros) / len(records) * 100), 2),
            "mean_velocity": round(float(np.mean(vels)), 2),
        }
    }
    with open(OUTPUT_METADATA, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return records


if __name__ == "__main__":
    generate_synthetic_consumption_dataset()
