@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Cap nhat ket qua moi
echo ==========================================
echo   CAP NHAT KET QUA MOI (XSMB + XSMN)
echo ==========================================
py -u update.py --workers 6
echo.
echo Xong! Mo lai app (F5) de xem du lieu moi.
pause
