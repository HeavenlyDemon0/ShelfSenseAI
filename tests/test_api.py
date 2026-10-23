"""
ShelfSense AI — API Test Suite
==============================
Validates:
  - System health (/health)
  - Role management (/api/roles)
  - Planogram configuration and zones (/api/planogram, /api/planogram/zones)
  - Shelf test inference pipeline (/api/shelf-test)
  - Static frontend production distribution delivery (/)
"""

import sys
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from backend.api_v4_1 import app

client = TestClient(app)


def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert data.get("status") == "ok"
    assert "CocaCola" in data.get("classes", [])


def test_roles_endpoint():
    r = client.get("/api/roles")
    assert r.status_code == 200
    roles = r.json().get("roles", [])
    assert len(roles) >= 6, "Expected at least 6 standard enterprise roles"


def test_planogram_endpoints():
    r = client.get("/api/planogram/zones")
    assert r.status_code == 200
    zones = r.json().get("zones", {})
    assert len(zones) == 4, "Expected 4 planogram zones"


def test_shelf_test_pipeline():
    r = client.post("/api/shelf-test")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    state = r.json().get("state", {})
    assert "products" in state
    assert state.get("compliance_pct") is not None


def test_frontend_static_serving():
    r = client.get("/")
    assert r.status_code == 200
    assert "ShelfSense" in r.text


def test_inventory_thresholds_and_alerts():
    # 1. Update thresholds (set KitKat to 4 which triggers low stock since count is 3 or 4)
    r = client.post("/api/inventory/thresholds", json={"thresholds": {"CocaCola": 3, "KitKat": 5, "Lays": 2, "Oreo": 2}})
    assert r.status_code == 200
    res = r.json()
    assert res.get("thresholds", {}).get("KitKat") == 5

    # 2. Query alerts
    r_alerts = client.get("/api/alerts")
    assert r_alerts.status_code == 200
    alerts_data = r_alerts.json()
    assert "alerts" in alerts_data
    print(f"  -> Active alerts: {len(alerts_data['alerts'])} (Low-stock / stockouts / misplacements)")


def test_planogram_calibration():
    # Recalibrate zones
    custom_zones = {
        "TOP_LEFT": {"x_range": [0.0, 0.49], "y_range": [0.0, 0.52], "name": "Snacks Left Deck", "designated_product": "Lays"}
    }
    r = client.post("/api/planogram/calibrate", json={"zones": custom_zones})
    assert r.status_code == 200
    zones = r.json().get("zones", {})
    assert zones["TOP_LEFT"]["name"] == "Snacks Left Deck"


if __name__ == "__main__":
    print("Running ShelfSense API Tests...")
    test_health_endpoint()
    print("  [PASS] /health")
    test_roles_endpoint()
    print("  [PASS] /api/roles")
    test_planogram_endpoints()
    print("  [PASS] /api/planogram/zones")
    test_shelf_test_pipeline()
    print("  [PASS] /api/shelf-test")
    test_inventory_thresholds_and_alerts()
    print("  [PASS] /api/inventory/thresholds & /api/alerts")
    test_planogram_calibration()
    print("  [PASS] /api/planogram/calibrate")
    test_frontend_static_serving()
    print("  [PASS] / (Frontend Distribution)")
    print("\nALL API TESTS PASSED SUCCESSFULLY!")

