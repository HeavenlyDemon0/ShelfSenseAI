@echo off
title ShelfSense AI - Live Camera Model Detection
echo ========================================================
echo        ShelfSense AI - Live OpenCV Camera Detection      
echo ========================================================
echo.

if exist .venv\Scripts\python.exe (
    set PYTHON_CMD=.venv\Scripts\python.exe
) else (
    set PYTHON_CMD=python
)

echo Launching ShelfSense Live Camera Inference Window...
echo Press 'Q' or 'ESC' inside the camera window to exit.
echo Press '+' / '-' to adjust confidence threshold.
echo Press 'T' to toggle temporal smoothing tracker.
echo.

%PYTHON_CMD% test_model.py --source webcam

pause

