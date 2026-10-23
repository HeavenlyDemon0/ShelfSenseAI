"""
ShelfSense AI — Consumption ML Model & Replenishment Queue Test Suite
=====================================================================
Validates:
  1. Synthetic consumption dataset integrity (50,000 records)
  2. Multi-Task Deep Neural Network checkpoint loading and forward inference
  3. Replenishment Queue ordering fidelity (monotonicity of priority ranks)
  4. Sensitivity testing: Stockout (0 units) vs Healthy stock (10 units)
  5. FastAPI endpoints: /api/replenishment/queue, /forecast, /dispatch, /audit/report, /products/enroll
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import json
import torch
import numpy as np
from fastapi.testclient import TestClient
from backend.api_v4_1 import app
from backend.replenishment_engine import replenishment_engine, MODEL_PATH, METADATA_PATH

client = TestClient(app)


def test_dataset_integrity():
    csv_path = ROOT / "datasets" / "consumption_synthetic_dataset.csv"
    assert csv_path.exists(), f"Dataset not found at {csv_path}"

    with open(csv_path, "r", encoding="utf-8") as f:
        header = f.readline().strip().split(",")
        assert "sku" in header
        assert "current_stock" in header
        assert "replenishment_urgency_score" in header
        assert "minutes_to_stockout" in header

        line_count = sum(1 for _ in f)

    assert line_count == 50000, f"Expected 50,000 records, got {line_count}"
    print(f"  [PASS] Dataset verification: 50,000 records with full feature schema.")


def test_model_loading_and_metadata():
    assert MODEL_PATH.exists(), f"Trained weights not found at {MODEL_PATH}"
    assert METADATA_PATH.exists(), f"Metadata not found at {METADATA_PATH}"

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    metrics = meta.get("metrics", {})
    assert metrics.get("velocity_r2", 0) > 0.80, f"Velocity R² too low: {metrics.get('velocity_r2')}"
    assert metrics.get("priority_rank_correlation", 0) > 0.95, f"Rank correlation too low: {metrics.get('priority_rank_correlation')}"

    print(f"  [PASS] Model metadata: R²={metrics.get('velocity_r2')} | Rank Correlation={metrics.get('priority_rank_correlation')}")
    assert replenishment_engine.model_loaded, "Replenishment engine failed to load PyTorch model weights."
    print("  [PASS] Neural network checkpoint loaded into PyTorch successfully.")


def test_prioritization_logic_and_monotonicity():
    # Scenario: CocaCola is depleted (0 units), Oreo is healthy (10 units)
    test_stock = {"CocaCola": 0, "KitKat": 3, "Lays": 2, "Oreo": 10}
    test_thresholds = {"CocaCola": 3, "KitKat": 4, "Lays": 2, "Oreo": 2}

    res = replenishment_engine.analyze_replenishment_priorities(
        current_products=test_stock,
        reorder_thresholds=test_thresholds,
    )

    queue = res.get("queue", [])
    assert len(queue) == 4, f"Expected 4 items in queue, got {len(queue)}"

    # 1. Monotonicity check: item at rank i must have urgency >= item at rank i+1
    for i in range(len(queue) - 1):
        assert queue[i]["urgency_score"] >= queue[i + 1]["urgency_score"], (
            f"Queue ordering violation: Rank {queue[i]['refill_rank']} ({queue[i]['urgency_score']}) "
            f"< Rank {queue[i+1]['refill_rank']} ({queue[i+1]['urgency_score']})"
        )

    # 2. Sensitivity check: Depleted item (CocaCola with 0 units) MUST be Rank #1
    top_item = queue[0]
    assert top_item["sku"] == "CocaCola", f"Expected CocaCola as Top Priority, got {top_item['sku']}"
    assert top_item["priority_tier"] == "CRITICAL"
    assert top_item["runout_minutes"] == 0.0

    print("  [PASS] Prioritization logic: CocaCola (0 units) correctly assigned Rank #1 (CRITICAL).")
    print(f"  [PASS] Monotonic queue ordering verified across all 4 ranks.")


def test_fastapi_endpoints():
    # 1. /api/replenishment/queue
    r = client.get("/api/replenishment/queue")
    assert r.status_code == 200
    q_data = r.json()
    assert "queue" in q_data
    assert len(q_data["queue"]) == 4

    # 2. /api/replenishment/forecast
    r = client.get("/api/replenishment/forecast")
    assert r.status_code == 200
    f_data = r.json()
    assert len(f_data.get("hourly_projections", [])) == 24

    # 3. /api/replenishment/dispatch
    r = client.post("/api/replenishment/dispatch", json={"sku": "CocaCola", "quantity": 6})
    assert r.status_code == 200
    d_data = r.json()
    assert d_data.get("status") == "success"

    # 4. /api/audit/report
    r = client.get("/api/audit/report")
    assert r.status_code == 200
    rep_data = r.json()
    assert "report_id" in rep_data
    assert "compliance_score_pct" in rep_data

    # 5. /api/products/enroll
    r = client.post("/api/products/enroll", json={
        "sku_name": "Pepsi Zero Sugar",
        "category": "Beverages",
        "designated_zone": "Top-Right Deck",
        "reorder_threshold": 3,
        "sample_images_count": 12
    })
    assert r.status_code == 200
    enr_data = r.json()
    assert enr_data.get("status") == "success"
    assert enr_data.get("samples_enrolled") == 12

    print("  [PASS] All 5 FastAPI Replenishment & Audit endpoints returned 200 OK.")


if __name__ == "__main__":
    print("=" * 70)
    print("SHELFSENSE: RUNNING REPLENISHMENT ML TEST SUITE")
    print("=" * 70)
    test_dataset_integrity()
    test_model_loading_and_metadata()
    test_prioritization_logic_and_monotonicity()
    test_fastapi_endpoints()
    print("\nALL CONSUMPTION ML TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

