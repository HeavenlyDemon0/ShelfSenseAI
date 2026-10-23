@echo off
title ShelfSense AI — Unified Edge Retail Platform
cd /d "%~dp0"

echo ======================================================================
echo    Starting ShelfSense AI Platform (Frontend + Backend + ML Models)
echo ======================================================================

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run.py
) else (
    python run.py
)

pause

