"""
ShelfSense V1 Backend Engine Launcher
====================================
Starts the Uvicorn REST API server for ShelfSense AI.

Usage:
    .venv\\Scripts\\python.exe run_backend.py
"""

import uvicorn
from backend.config import HOST, PORT

if __name__ == "__main__":
    print(f"\n[ShelfSense] Starting backend server on http://{HOST}:{PORT}")
    print("[ShelfSense] API Docs available at http://{HOST}:{PORT}/docs\n")
    uvicorn.run("backend.api_v4_1:app", host=HOST, port=PORT, reload=False)
