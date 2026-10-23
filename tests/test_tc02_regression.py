"""
Regression Test: TC02 Core Detection Image API - Prevention of Unapproved/Few-Shot Detections
Verifies that POST /api/detect/image strictly returns only the four approved core retail classes:
['CocaCola', 'KitKat', 'Lays', 'Oreo']
and never leaks few-shot prototypes (such as 'PepsiTest') into core detection responses.
"""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure root in path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.api_v4_1 import app
from backend.few_shot_continual import few_shot_engine
import torch

APPROVED_CORE_CLASSES = {"CocaCola", "KitKat", "Lays", "Oreo"}

client = TestClient(app)

def test_tc02_core_image_detection_strictly_approved_classes():
    """
    Test Case TC02:
    Even if an unapproved few-shot prototype (e.g. 'PepsiTest') is present in the few-shot registry,
    the core detection API must strictly return only approved core classes.
    """
    # 1. Deliberately simulate / ensure PepsiTest is registered in the few-shot engine
    few_shot_engine.registry["PepsiTest"] = {
        "sku_name": "PepsiTest",
        "category": "Beverages",
        "designated_zone": "Top-Right Deck",
        "reorder_threshold": 4,
        "prototype": torch.randn(1, 128),
        "initial_prototype": torch.randn(1, 128),
        "threshold": 0.01,  # extremely loose threshold to guarantee it would trigger if called
        "total_observations": 100,
        "self_training_updates": 10,
        "prototype_drift": 0.5,
        "replay_buffer": [torch.randn(1, 576)],
        "enrolled_at": "2026-10-23T00:00:00",
        "last_seen_at": "2026-10-23T00:00:00",
    }

    test_image_path = Path("experiments/shelf_test.jpg")
    assert test_image_path.is_file(), f"Test image missing at {test_image_path}"

    with open(test_image_path, "rb") as f:
        response = client.post(
            "/api/detect/image",
            files={"file": ("shelf_test.jpg", f, "image/jpeg")}
        )

    # Assert HTTP 200
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    assert data.get("status") == "success", "Response status field is not 'success'"
    products = data.get("products", {})
    detections = data.get("detections", [])

    print(f"TC02 Products returned: {products}")
    print(f"TC02 Detections count: {len(detections)}")

    # 2. Strict Core Class Isolation Assertions
    assert "PepsiTest" not in products, "FAILURE: Unapproved class 'PepsiTest' found in products!"

    for idx, det in enumerate(detections):
        cls_name = det.get("class") or det.get("class_name")
        print(f"  Det #{idx+1}: {cls_name} (conf: {det.get('confidence')})")
        assert cls_name != "PepsiTest", f"FAILURE: Detection #{idx+1} is unapproved class 'PepsiTest'!"
        assert cls_name in APPROVED_CORE_CLASSES, (
            f"FAILURE: Detection #{idx+1} class '{cls_name}' is not in approved classes {APPROVED_CORE_CLASSES}!"
        )

    # 3. Core Products Verification
    for required_sku in ["CocaCola", "KitKat", "Lays", "Oreo"]:
        assert required_sku in products, f"Missing required core SKU '{required_sku}' in products"
        assert products[required_sku] >= 1, f"Expected at least 1 unit of '{required_sku}', got {products[required_sku]}"

    print("\n>>> REGRESSION TEST PASSED: Core detection API strictly isolated to approved classes.")


if __name__ == "__main__":
    test_tc02_core_image_detection_strictly_approved_classes()

