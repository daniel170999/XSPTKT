@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Tai toan bo lich su xo so
echo ==========================================================
echo   TAI TOAN BO LICH SU XO SO (chi can chay MOT LAN)
echo.
echo   XSMB: tu 01/10/2005   ^| XSMN: tu 2008
echo   Lan dau mat khoang 8-12 phut. Nhung lan sau chi vai giay.
echo ==========================================================
echo.
py -u update.py --all --workers 8
echo.
echo Xong! Bam dup MoApp.bat de mo app.
pause
