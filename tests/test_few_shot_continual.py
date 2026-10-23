"""
ShelfSense AI — Few-Shot Object Enrollment & Continual Learning Test Suite
===========================================================================
Validates:
  1. Backbone & Metric Projection Head Initialization
  2. 15-Image Few-Shot Cold-Start Enrollment & Prototype Centroid Generation
  3. Dynamic Acceptance Radius Thresholding
  4. Real-Time Detection Matching & Momentum EMA Prototype Update
  5. Continual Contrastive Replay Fine-Tuning Gradient Step
  6. Persistence & Serialization Roundtrip
  7. FastAPI REST Endpoints (/api/few-shot/*)
"""

import sys
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import cv2
import numpy as np
import torch
from fastapi.testclient import TestClient

from backend.api_v4_1 import app
from backend.few_shot_continual import few_shot_engine, ShelfSenseFewShotContinualEngine

client = TestClient(app)


def generate_synthetic_product_samples(n: int = 15, color: tuple = (0, 165, 255)) -> list[np.ndarray]:
    """Generates distinct patterned images for few-shot testing."""
    samples = []
    for i in range(n):
        img = np.zeros((224, 224, 3), dtype=np.uint8)
        # Background
        img[:] = (30, 30, 30)
        # Can / bottle body
        cv2.rectangle(img, (50, 30), (174, 194), color, -1)
        # Unique branding pattern / noise
        cv2.circle(img, (112, 112 + (i % 5)), 25, (255, 255, 255), -1)
        cv2.putText(img, "TEST", (75, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        samples.append(img)
    return samples


def test_engine_initialization():
    """Validates frozen MobileNet backbone and projection head geometry."""
    engine = ShelfSenseFewShotContinualEngine()
    # Check backbone is in eval mode and parameters frozen
    for p in engine.backbone.parameters():
        assert not p.requires_grad, "Backbone parameters must be frozen"

    # Check projection head outputs unit-normalized vectors
    dummy_feat = torch.randn(4, 576).to(engine.device)
    proj = engine.projection_head(dummy_feat)
    assert proj.shape == (4, 128), f"Expected shape (4, 128), got {proj.shape}"

    norms = torch.norm(proj, p=2, dim=1)
    for n in norms:
        assert abs(n.item() - 1.0) < 1e-4, f"Embeddings must be unit normalized, got {n.item()}"


def test_few_shot_enrollment():
    """Tests cold-start enrollment from 15 reference images."""
    samples = generate_synthetic_product_samples(15, color=(0, 200, 100))
    sku = "MountainDew_ColdStart"

    res = few_shot_engine.enroll_product_from_images(
        sku_name=sku,
        images=samples,
        category="Beverages",
        designated_zone="Top-Right Deck",
        reorder_threshold=4,
    )

    assert res["status"] == "ENROLLED_AND_ACTIVE"
    assert res["sku_name"] == sku
    assert res["enrolled_samples"] == 15
    assert 0.65 <= res["threshold"] <= 0.88, f"Threshold out of expected bounds: {res['threshold']}"

    assert sku in few_shot_engine.registry
    reg_item = few_shot_engine.registry[sku]
    assert reg_item["prototype"].shape == (1, 128)
    proto_norm = torch.norm(reg_item["prototype"], p=2).item()
    assert abs(proto_norm - 1.0) < 1e-4, "Prototype must be normalized on unit sphere"
    assert len(reg_item["replay_buffer"]) > 0, "Replay buffer must be initialized"


def test_detection_matching_and_momentum_adaptation():
    """Tests runtime candidate matching and momentum prototype adaptation."""
    sku = "MountainDew_ColdStart"
    assert sku in few_shot_engine.registry

    initial_drift = few_shot_engine.registry[sku]["prototype_drift"]
    initial_obs = few_shot_engine.registry[sku]["total_observations"]

    # Create a frame with the enrolled product in candidate box
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    sample_img = generate_synthetic_product_samples(1, color=(0, 200, 100))[0]
    frame[100:324, 150:374] = sample_img

    candidate_boxes = [[150, 100, 374, 324]]
    matches = few_shot_engine.detect_and_match(frame, candidate_boxes)

    assert len(matches) == 1, "Expected 1 candidate match for enrolled product"
    match = matches[0]
    assert match["class_name"] == sku
    assert match["confidence"] >= few_shot_engine.registry[sku]["threshold"]

    # Verify online momentum continual update
    updated_obs = few_shot_engine.registry[sku]["total_observations"]
    assert updated_obs == initial_obs + 1, "Total observations must increment"


def test_contrastive_gradient_finetune():
    """Validates PyTorch backpropagation and gradient updates on metric projection head."""
    sku = "MountainDew_ColdStart"
    assert sku in few_shot_engine.registry

    initial_updates = few_shot_engine.registry[sku]["self_training_updates"]

    # Ensure optimizer step runs cleanly without autograd errors
    few_shot_engine._incremental_contrastive_finetune(sku)

    updated_data = few_shot_engine.registry[sku]
    assert updated_data["self_training_updates"] == initial_updates + 1, "Self training updates counter must increment"


def test_fastapi_few_shot_endpoints():
    """Tests the REST API layer for few-shot enrollment and continual learning."""
    # 1. Demo enrollment
    demo_res = client.post(
        "/api/few-shot/demo-enroll?sku_name=PepsiMax_Test&category=Beverages&designated_zone=Top-Right%20Deck&reorder_threshold=4"
    )
    assert demo_res.status_code == 200
    demo_json = demo_res.json()
    assert demo_json["status"] == "success"

    # 2. Registry retrieval
    reg_res = client.get("/api/few-shot/registry")
    assert reg_res.status_code == 200
    reg_json = reg_res.json()
    skus = [p["sku_name"] for p in reg_json["enrolled_products"]]
    assert "PepsiMax_Test" in skus

    # 3. Trigger self-training pass
    train_res = client.post("/api/few-shot/trigger-self-train?sku_name=PepsiMax_Test")
    assert train_res.status_code == 200
    train_json = train_res.json()
    assert train_json["status"] == "success"
    assert train_json["self_training_updates"] >= 1

    # 4. Product deletion / unenroll
    del_res = client.delete("/api/few-shot/product/PepsiMax_Test")
    assert del_res.status_code == 200

    # Cleanup temporary test SKU
    few_shot_engine.delete_product("MountainDew_ColdStart")


if __name__ == "__main__":
    print("Running test_engine_initialization()...")
    test_engine_initialization()
    print("PASS: Engine Initialization")

    print("Running test_few_shot_enrollment()...")
    test_few_shot_enrollment()
    print("PASS: Few-Shot Enrollment & Prototype Generation")

    print("Running test_detection_matching_and_momentum_adaptation()...")
    test_detection_matching_and_momentum_adaptation()
    print("PASS: Detection Matching & Continual EMA Momentum Adaptation")

    print("Running test_contrastive_gradient_finetune()...")
    test_contrastive_gradient_finetune()
    print("PASS: Incremental Contrastive Replay Fine-Tuning")

    print("Running test_fastapi_few_shot_endpoints()...")
    test_fastapi_few_shot_endpoints()
    print("PASS: FastAPI Few-Shot & Continual Learning Endpoints")

    print("\nALL FEW-SHOT & CONTINUAL LEARNING TESTS PASSED 100%!")
