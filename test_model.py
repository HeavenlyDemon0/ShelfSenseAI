"""
ShelfSense — Universal Model Runner & Test Utility
===================================================
A unified CLI tool to run and test the ShelfSense YOLO11n retail detection model:
  - Live Webcam Detection with anti-flicker temporal tracking and HUD
  - Single Image & Batch Directory testing
  - Instant Physical Shelf Scene evaluation
  - Automated Repeatability & Stability benchmarking

Usage Examples:
  # 1. Live Webcam (default):
  python test_model.py
  python test_model.py --source webcam --camera 0

  # 2. Test the Physical Shelf Scene:
  python test_model.py --shelf

  # 3. Test an Image or Directory:
  python test_model.py --source path/to/image.jpg
  python test_model.py --source datasets/final/cocacola/test/images/

  # 4. Run the Repeatability Benchmark:
  python test_model.py --repeatability

Interactive Controls (Webcam Mode):
  [q] / [ESC] : Quit cleanly
  [+] / [-]   : Increase / decrease confidence threshold
  [t]         : Toggle temporal tracking smoothing on / off
  [s]         : Save annotated snapshot of current frame
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
from ultralytics import YOLO

# Add root directory to sys.path
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import CLASS_NAMES, CONF_THRESHOLD, DEVICE, IMGSZ, IOU_THRESHOLD
from backend.tracker import ShelfSenseTemporalTracker, TrackedItem

# Authoritative class color scheme (BGR for OpenCV)
CLASS_COLORS: Dict[str, Tuple[int, int, int]] = {
    "CocaCola": (30, 30, 230),   # Vibrant Crimson Red
    "KitKat":   (200, 30, 200),  # Purple / Magenta
    "Lays":     (0, 215, 255),   # Golden Yellow
    "Oreo":     (255, 140, 0),   # Sky Blue / Cyan
}

DEFAULT_MODEL_PATH = ROOT / "models" / "best.pt"
FALLBACK_MODEL_PATH = ROOT / "models" / "shelfsense_yolo11n.pt"
SHELF_IMAGE_PATH = ROOT / "frontend" / "public" / "assets" / "images" / "physical_shelf_raw.jpg"
if not SHELF_IMAGE_PATH.exists():
    _legacy_fallback = Path(r"C:\Users\Nishant\.gemini\antigravity\brain\8dc0fe14-b3c0-418d-86b7-797ac9e0f9fb\.user_uploaded\media_1792497884461_b1ac6007.jpg")
    if _legacy_fallback.exists():
        SHELF_IMAGE_PATH = _legacy_fallback


def get_model_path(custom_path: Optional[str] = None) -> Path:
    """Finds the best available model weights."""
    if custom_path:
        p = Path(custom_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"Specified model file not found: {custom_path}")

    if DEFAULT_MODEL_PATH.exists():
        return DEFAULT_MODEL_PATH
    if FALLBACK_MODEL_PATH.exists():
        return FALLBACK_MODEL_PATH

    # Search in results directory
    candidates = list(ROOT.glob("results/**/weights/best.pt"))
    if candidates:
        return candidates[-1]

    raise FileNotFoundError("No trained model weights found in models/ or results/.")


def draw_hud(
    frame: np.ndarray,
    fps: float,
    latency_ms: float,
    counts: Dict[str, int],
    conf_thresh: float,
    smoothing_active: bool,
    model_name: str,
) -> np.ndarray:
    """Renders a sleek real-time HUD bar."""
    h, w = frame.shape[:2]
    hud_h = 48
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, hud_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.78, frame, 0.22, 0, frame)

    # Left: FPS, Latency, Conf
    status_str = f"ShelfSense YOLO11n | {fps:.1f} FPS | {latency_ms:.1f}ms | Conf: {conf_thresh:.2f}"
    cv2.putText(frame, status_str, (12, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (240, 240, 240), 1, cv2.LINE_AA)

    # Right: Per-product live inventory
    inv_str = f"CocaCola: {counts.get('CocaCola', 0)} | KitKat: {counts.get('KitKat', 0)} | Lays: {counts.get('Lays', 0)} | Oreo: {counts.get('Oreo', 0)}"
    t_size = cv2.getTextSize(inv_str, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)[0]
    cv2.putText(frame, inv_str, (w - t_size[0] - 14, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 255, 180), 1, cv2.LINE_AA)

    # Controls reminder
    ctrl_str = f"Keys: [Q] Quit | [+/-] Conf | [T] Smoothing: {'ON' if smoothing_active else 'OFF'} | [S] Save Snapshot"
    cv2.putText(frame, ctrl_str, (12, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (170, 170, 170), 1, cv2.LINE_AA)

    return frame


def run_webcam_mode(model_path: Path, camera_index: int = 0, initial_conf: float = 0.35):
    """Runs interactive live webcam object detection."""
    print("=" * 80)
    print(f"STARTING LIVE WEBCAM INFERENCE")
    print(f"Model Checkpoint : {model_path}")
    print(f"Camera Index     : {camera_index}")
    print(f"Device           : {'CUDA GPU (0)' if torch.cuda.is_available() else 'CPU'}")
    print("=" * 80)

    model = YOLO(str(model_path))
    tracker = ShelfSenseTemporalTracker(
        iou_threshold=0.35,
        max_misses=6,
        min_hits_confirm=2,
        smoothing_alpha=0.65,
    )

    cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print(f"\n[Warning] DirectShow could not open Camera {camera_index}. Trying default driver...")
        cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        print(f"\n[Error] Unable to open Camera {camera_index}!")
        print("Possible causes:")
        print("  1. No webcam connected or privacy shutter closed.")
        print("  2. Camera is in use by another application (e.g. Teams, Zoom, Browser).")
        print("  3. Windows camera permissions disabled for desktop apps.")
        print("\nTip: You can test the model on images using:")
        print("  python test_model.py --shelf")
        print("  python test_model.py --source <image_path>")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    window_name = "ShelfSense Live Detection — [Q / ESC to quit]"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    conf_thresh = initial_conf
    smoothing_active = True
    prev_time = time.time()
    fps_smooth = 30.0

    print("\nWebcam started successfully! Press 'q' or 'ESC' in the window to quit.\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                print("[Warning] Empty frame received from webcam. Retrying...")
                time.sleep(0.05)
                continue

            t_start = time.time()
            results = model.predict(
                source=frame,
                conf=conf_thresh,
                iou=IOU_THRESHOLD,
                imgsz=IMGSZ,
                device=0 if torch.cuda.is_available() else "cpu",
                verbose=False,
            )
            latency_ms = (time.time() - t_start) * 1000.0

            raw_detections = []
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    xyxy = [int(v) for v in box.xyxy[0].tolist()]
                    raw_detections.append({
                        "class_id": cls_id,
                        "class_name": model.names[cls_id],
                        "confidence": conf,
                        "bbox": xyxy,
                    })

            # Apply temporal tracking / smoothing if active
            if smoothing_active:
                tracker_input = [
                    {
                        "class_id": d["class_id"],
                        "class_name": d["class_name"],
                        "confidence": d["confidence"],
                        "bbox": d["bbox"]
                    }
                    for d in raw_detections
                ]
                active_tracks = tracker.update(tracker_input)
                display_items = [
                    {"class_name": t.class_name, "confidence": t.confidence, "bbox": t.bbox, "id": t.track_id}
                    for t in active_tracks
                ]
            else:
                display_items = [
                    {"class_name": d["class_name"], "confidence": d["confidence"], "bbox": d["bbox"], "id": None}
                    for d in raw_detections
                ]

            counts = Counter(item["class_name"] for item in display_items)

            # Draw bounding boxes
            for item in display_items:
                cname = item["class_name"]
                color = CLASS_COLORS.get(cname, (0, 255, 0))
                x1, y1, x2, y2 = item["bbox"]
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

                id_tag = f"#{item['id']} " if item.get("id") else ""
                label_text = f"{id_tag}{cname} {item['confidence']:.0%}"
                (tw, th), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(frame, (x1, max(0, y1 - th - 6)), (x1 + tw + 4, max(th + 6, y1)), color, -1)
                cv2.putText(frame, label_text, (x1 + 2, max(th, y1 - 3)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

            # Compute smoothed FPS
            dt = time.time() - prev_time
            prev_time = time.time()
            if dt > 0:
                fps_smooth = 0.9 * fps_smooth + 0.1 * (1.0 / dt)

            # Draw HUD
            frame = draw_hud(frame, fps_smooth, latency_ms, counts, conf_thresh, smoothing_active, model_path.name)

            cv2.imshow(window_name, frame)
            key = cv2.waitKey(1) & 0xFF

            if key in [ord("q"), 27]:  # 'q' or ESC
                break
            elif key in [ord("+"), ord("=")]:
                conf_thresh = min(0.95, conf_thresh + 0.05)
                print(f"[HUD] Confidence threshold set to: {conf_thresh:.2f}")
            elif key in [ord("-"), ord("_")]:
                conf_thresh = max(0.10, conf_thresh - 0.05)
                print(f"[HUD] Confidence threshold set to: {conf_thresh:.2f}")
            elif key == ord("t"):
                smoothing_active = not smoothing_active
                print(f"[HUD] Temporal smoothing: {'ENABLED' if smoothing_active else 'DISABLED'}")
            elif key == ord("s"):
                snap_path = ROOT / "results" / f"webcam_snapshot_{int(time.time())}.jpg"
                snap_path.parent.mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(snap_path), frame)
                print(f"[HUD] Saved snapshot to: {snap_path}")

    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("\nWebcam session ended.")


def run_image_mode(model_path: Path, image_path: Path, conf_thresh: float = 0.35, save_output: bool = True):
    """Runs detection on a single image and prints structured detections."""
    print("=" * 80)
    print(f"IMAGE DETECTION TEST")
    print(f"Model Checkpoint : {model_path}")
    print(f"Target Image     : {image_path}")
    print("=" * 80)

    if not image_path.exists():
        print(f"[Error] Image not found: {image_path}")
        return

    img = cv2.imread(str(image_path))
    h, w = img.shape[:2]
    print(f"Image Resolution : {w}x{h}")

    model = YOLO(str(model_path))
    t0 = time.time()
    results = model.predict(
        source=img,
        conf=conf_thresh,
        iou=IOU_THRESHOLD,
        imgsz=IMGSZ,
        device=0 if torch.cuda.is_available() else "cpu",
        verbose=False,
    )
    latency_ms = (time.time() - t0) * 1000.0

    detections = []
    vis = img.copy()

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = [int(v) for v in box.xyxy[0].tolist()]
            cname = model.names[cls_id]

            detections.append({
                "class_id": cls_id,
                "class_name": cname,
                "confidence": round(conf, 4),
                "bbox": xyxy,
            })

            # Draw on image
            color = CLASS_COLORS.get(cname, (0, 255, 0))
            cv2.rectangle(vis, (xyxy[0], xyxy[1]), (xyxy[2], xyxy[3]), color, 2)
            lbl = f"{cname} {conf:.1%}"
            (tw, th), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(vis, (xyxy[0], max(0, xyxy[1] - th - 6)), (xyxy[0] + tw + 4, max(th + 6, xyxy[1])), color, -1)
            cv2.putText(vis, lbl, (xyxy[0] + 2, max(th, xyxy[1] - 3)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

    print(f"\nInference Latency: {latency_ms:.1f}ms")
    print(f"Total Objects Detected: {len(detections)}")
    print("-" * 80)
    for idx, d in enumerate(detections, 1):
        print(f"  {idx}. [{d['class_name']:<10}] Conf: {d['confidence']:>6.2%} | Bounding Box: {d['bbox']}")

    counts = Counter(d["class_name"] for d in detections)
    print("\nInventory Summary:")
    for prod in ["CocaCola", "KitKat", "Lays", "Oreo"]:
        print(f"  - {prod:<10}: {counts.get(prod, 0)}")

    if save_output:
        out_path = ROOT / "results" / f"test_pred_{image_path.stem}.jpg"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out_path), vis)
        print(f"\n[OK] Annotated output saved to: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="ShelfSense Universal Model Runner & Test Utility")
    parser.add_argument("--source", type=str, default="webcam", help="Source to test: 'webcam', image file path, or folder path")
    parser.add_argument("--camera", type=int, default=0, help="Webcam device index (default: 0)")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold (default: 0.35)")
    parser.add_argument("--model", type=str, default=None, help="Custom model checkpoint path")
    parser.add_argument("--shelf", action="store_true", help="Immediately test on the physical shelf scene image")
    parser.add_argument("--repeatability", action="store_true", help="Run the full quantitative repeatability benchmark")

    args = parser.parse_args()

    # Locate model
    try:
        model_path = get_model_path(args.model)
    except FileNotFoundError as e:
        print(f"[Error] {e}")
        sys.exit(1)

    # 1. Repeatability Benchmark Mode
    if args.repeatability:
        from tests.benchmark_repeatability import benchmark_model_repeatability
        benchmark_model_repeatability(model_path)
        return

    # 2. Physical Shelf Scene Mode
    if args.shelf:
        run_image_mode(model_path, SHELF_IMAGE_PATH, conf_thresh=args.conf)
        return

    # 3. Webcam Mode
    if args.source.lower() == "webcam":
        run_webcam_mode(model_path, camera_index=args.camera, initial_conf=args.conf)
        return

    # 4. Single Image or Folder Mode
    src_path = Path(args.source)
    if not src_path.exists():
        print(f"[Error] Source path not found: {src_path}")
        sys.exit(1)

    if src_path.is_file():
        run_image_mode(model_path, src_path, conf_thresh=args.conf)
    elif src_path.is_dir():
        imgs = list(src_path.glob("*.jpg")) + list(src_path.glob("*.png"))
        print(f"Batch testing {len(imgs)} images from {src_path}...")
        for p in imgs:
            run_image_mode(model_path, p, conf_thresh=args.conf)


if __name__ == "__main__":
    main()

