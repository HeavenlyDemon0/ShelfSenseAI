"""
ShelfSense — Main Backend Entry Point
=====================================
Starts the FastAPI server with uvicorn.
"""

from __future__ import annotations

import uvicorn
from backend.api_v4_1 import app
from backend.config import HOST, PORT

def run():
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)

if __name__ == "__main__":
    run()

