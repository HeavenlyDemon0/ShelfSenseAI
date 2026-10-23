# TC02 Failure Diagnosis: Unexpected `PepsiTest` Detection in Core Image Detection API

**Project Root**: `D:\Shelfsense-ai`  
**Test Case**: `TC02_Image_Detection_API`  
**Timestamp**: 2026-10-23T22:41:00+05:30  
**Status**: Root Cause Diagnosed, Minimal Correction Implemented, Regression Test Passed (`Exit Code 0`)

---

## 1. Executive Summary & Failure Description

During automated execution of Katalon test `TC02_Image_Detection_API` against `POST /api/detect/image` with test image `experiments/shelf_test.jpg`, the endpoint returned an unexpected detection:

```json
{
  "class": "PepsiTest",
  "class_name": "PepsiTest",
  "confidence": 0.9995,
  "bbox": [134, 645, 182, 762],
  "track_id": 107,
  "few_shot": true
}
```

The core ShelfSense retail vision specification strictly authorizes only four baseline product classes:
* `CocaCola`
* `KitKat`
* `Lays`
* `Oreo`

---

## 2. Root Cause Diagnosis & Trace

### A. Code Trace
1. **API Endpoint (`backend/api_v4_1.py`)**:
   `POST /api/detect/image` decodes the uploaded image and passes it to:
   ```python
   state = engine.process_image_bytes(contents)
   ```
2. **State Engine (`backend/engine_v4_1.py` - `process_frame()`)**:
   * Step 1: Evaluates the authoritative YOLO model via `self.detector.detect(frame)`.
   * Step 2: Unconditionally evaluated the few-shot metric matcher:
     ```python
     if few_shot_engine.registry:
         candidate_boxes = [d.bbox for d in raw_detections]
         fs_matches = few_shot_engine.detect_and_match(frame, candidate_boxes)
         for m in fs_matches:
             cname = m["class_name"]
             new_products[cname] = new_products.get(cname, 0) + 1
             new_detections_list.append(...)
     ```
   * At coordinate `bbox: [134, 645, 182, 762]`, `detect_and_match()` matched the image crop against the stored prototype for `PepsiTest` and appended it to `new_detections_list` with `track_id: 107`.
3. **Few-Shot Engine (`backend/few_shot_continual.py`)**:
   * Prototype `PepsiTest` had undergone 132 automated online self-training passes (`total_observations: 1320`), which resulted in significant centroid drift (`prototype_drift: 0.7634`) and a loose similarity acceptance radius (`threshold: 0.65`).

### B. Persistence Analysis (Why Server Restart Did Not Clear State)
* The few-shot registry is persisted to disk at:
  * `models/few_shot_prototypes.json`
  * `models/few_shot_prototypes.pt`
* In `backend/few_shot_continual.py` (`_load_saved_prototypes()`, line 448), the engine automatically reloads all serialized prototypes into memory upon application startup:
  ```python
  [FewShotEngine] Restored 2 enrolled few-shot prototypes from disk.
  ```
* Consequently, restarting the server reload `PepsiTest` into `few_shot_engine.registry`.

---

## 3. Data & Checkpoint Preservation Compliance

In strict compliance with evaluation rules:
* **No datasets were deleted.**
* **No model checkpoints were modified or deleted (`best.pt`, `replenishment_priority_model.pt`).**
* **No user profiles or database records were removed.**
* **No prototype files were wiped; existing enrollment files remain intact on disk.**
* **Katalon assertions were not weakened.**

---

## 4. Minimal Safe Correction Applied

To ensure that the core image detection API is strictly isolated to the four authorized retail classes while keeping experimental few-shot capabilities functional when explicitly requested:

### 1. `backend/engine_v4_1.py`: Core-Only Default Mode
Added `include_few_shot: bool = False` parameter to `process_frame()`, `process_image_bytes()`, and `process_image_file()`:
* When running in standard/core mode (`include_few_shot=False`), the few-shot evaluation block is bypassed.
* Detections are strictly produced by the authoritative YOLO11n retail model (`CocaCola`, `KitKat`, `Lays`, `Oreo`).

### 2. `backend/api_v4_1.py`: Strict Output Filtering
* `POST /api/detect/image` defaults to core mode (`include_few_shot: bool = Query(False)`).
* In core mode, the response strictly filters detections and product counts against `V4_1_CLASSES`:
  ```python
  if not include_few_shot:
      valid_classes = set(V4_1_CLASSES)
      safe_detections = [
          d for d in state["detections"]
          if d.get("class") in valid_classes or d.get("class_name") in valid_classes
      ]
      safe_products = {
          k: v for k, v in state["products"].items()
          if k in valid_classes
      }
  ```

---

## 5. Automated Regression Verification

An automated regression test was created at `tests/test_tc02_regression.py`.
The test deliberately forces an unapproved prototype (`PepsiTest`) with a zero-threshold trigger into `few_shot_engine.registry` and submits `experiments/shelf_test.jpg` via multipart form-data.

### Execution Command:
```powershell
& "d:\Shelfsense-ai\.venv\Scripts\python.exe" tests\test_tc02_regression.py
```

### Actual Test Output:
```text
[FewShotEngine] Restored 2 enrolled few-shot prototypes from disk.
[ReplenishmentEngine] Deep Replenishment Net loaded successfully onto cuda.
[YOLODetector] Loading Authoritative Unified Model: D:\Shelfsense-ai\models\best.pt
[YOLODetector] Unified model loaded successfully. Classes: {0: 'CocaCola', 1: 'KitKat', 2: 'Lays', 3: 'Oreo'}
TC02 Products returned: {'CocaCola': 1, 'KitKat': 6, 'Lays': 1, 'Oreo': 1}
TC02 Detections count: 7
  Det #1: KitKat (conf: 0.9467)
  Det #2: KitKat (conf: 0.9463)
  Det #3: KitKat (conf: 0.9388)
  Det #4: CocaCola (conf: 0.9272)
  Det #5: Lays (conf: 0.909)
  Det #6: Oreo (conf: 0.8814)
  Det #7: KitKat (conf: 0.4243)

>>> REGRESSION TEST PASSED: Core detection API strictly isolated to approved classes.
Exit code: 0
```

### Full Test Suite Status:
* `tests/test_tc02_regression.py`: **PASSED (Exit Code 0)**
* `tests/test_api.py`: **PASSED (Exit Code 0)**
* `tests/test_static_assets.py`: **PASSED (Exit Code 0)**

