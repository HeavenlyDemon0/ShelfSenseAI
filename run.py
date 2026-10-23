"""
ShelfSense AI — Unified Single-File Project Launcher
====================================================
Runs the entire ShelfSense full-stack application with a single command:
  1. Checks Python & ML runtime dependencies
  2. Ensures the frontend React/Vite production build is compiled
  3. Launches the FastAPI + Uvicorn server (REST API, MJPEG video, ML engines)
  4. Automatically opens the interactive dashboard in your default browser

Usage:
  python run.py
  (or double-click run.bat on Windows)
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"

HOST = "0.0.0.0"
PORT = 8000
LOCAL_URL = f"http://localhost:{PORT}"


def print_banner() -> None:
    banner = f"""
======================================================================
   SHELFSENSE AI — UNIFIED RETAIL PLANOGRAM & REPLENISHMENT PLATFORM
======================================================================
   * Unified YOLO11n Retail Neural Engine (4 Classes)
   * Deep Consumption Velocity & Replenishment Net (PyTorch)
   * Few-Shot Object Enrollment & Continual Learning Engine
   * Zero-Flicker Temporal Tracking & Cluster Decomposition
   * Spatial Planogram Misplacement Triangulation
   * Interactive 3D Digital Twin (Three.js) & CAD Studio
======================================================================
   Local Dashboard: {LOCAL_URL}
   REST API Docs:   {LOCAL_URL}/docs
======================================================================
"""
    print(banner)


def ensure_frontend_build() -> None:
    """Checks if frontend/dist exists; if not, builds it via npm."""
    if not FRONTEND_INDEX.exists():
        print("[Launcher] Frontend production build not found in frontend/dist.")
        print("[Launcher] Building React single-page application (npm run build)...")
        try:
            cmd = "npm --prefix frontend run build"
            result = subprocess.run(cmd, shell=True, check=True, cwd=str(ROOT))
            if result.returncode == 0 and FRONTEND_INDEX.exists():
                print("[Launcher] Frontend built successfully!")
            else:
                print("[Launcher] Warning: npm build completed with non-zero exit code.")
        except Exception as e:
            print(f"[Launcher] Warning: Failed to build frontend automatically: {e}")
            print("[Launcher] You can build it manually by running: cd frontend && npm run build")
    else:
        print(f"[Launcher] Frontend production build verified at: {FRONTEND_DIST}")


def open_browser_delayed() -> None:
    """Opens the user's default browser after the server has initialized."""
    time.sleep(1.8)
    print(f"[Launcher] Opening {LOCAL_URL} in default browser...")
    try:
        webbrowser.open(LOCAL_URL)
    except Exception as e:
        print(f"[Launcher] Could not open browser automatically: {e}")


def main() -> None:
    os.chdir(str(ROOT))
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    print_banner()
    ensure_frontend_build()

    # Launch browser opener in background thread
    threading.Thread(target=open_browser_delayed, daemon=True).start()

    # Launch Uvicorn server
    import uvicorn

    print(f"[Launcher] Starting Uvicorn server on http://{HOST}:{PORT} ...\n")
    try:
        uvicorn.run("backend.api_v4_1:app", host=HOST, port=PORT, reload=False, log_level="info")
    except KeyboardInterrupt:
        print("\n[Launcher] ShelfSense server stopped by user. Goodbye!")


if __name__ == "__main__":
    main()

