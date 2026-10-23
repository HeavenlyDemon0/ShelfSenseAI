@echo off
title ShelfSense AI Launcher
echo ========================================================
echo               ShelfSense AI Web Dashboard               
echo ========================================================
echo.

if exist .venv\Scripts\python.exe (
    set PYTHON_CMD=.venv\Scripts\python.exe
) else (
    set PYTHON_CMD=python
)

echo Opening Web Dashboard in default browser...
start http://127.0.0.1:8000

echo.
echo Starting Backend REST API Server...
echo Press Ctrl+C to stop the server when done.
echo.

%PYTHON_CMD% run_backend.py

pause

