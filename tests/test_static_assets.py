import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import re
from fastapi.testclient import TestClient
from backend.api_v4_1 import app

client = TestClient(app)

def test_static_distribution_and_assets():
    res = client.get("/")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    html = res.text
    assert "<div id=\"root\">" in html, "HTML should contain root div"

    # Find bundle references
    js_files = re.findall(r'/assets/([^"]+\.js)', html)
    css_files = re.findall(r'/assets/([^"]+\.css)', html)

    print(f"Discovered JS assets: {js_files}")
    print(f"Discovered CSS assets: {css_files}")

    assert len(js_files) > 0, "No JS bundles found in index.html"
    for js in js_files:
        r = client.get(f"/assets/{js}")
        assert r.status_code == 200, f"Failed to fetch {js}: status {r.status_code}"
        assert len(r.content) > 1000, f"JS file {js} unexpectedly empty"

    assert len(css_files) > 0, "No CSS bundles found in index.html"
    for css in css_files:
        r = client.get(f"/assets/{css}")
        assert r.status_code == 200, f"Failed to fetch {css}: status {r.status_code}"
        assert len(r.content) > 1000, f"CSS file {css} unexpectedly empty"

    # Also test image asset
    r_img = client.get("/assets/images/physical_shelf_annotated.jpg")
    assert r_img.status_code == 200, "Failed to load /assets/images/physical_shelf_annotated.jpg"

    print("ALL STATIC ASSETS (JS, CSS, IMAGES) VERIFIED 100% OK!")

if __name__ == "__main__":
    test_static_distribution_and_assets()
