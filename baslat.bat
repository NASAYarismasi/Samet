@echo off
chcp 65001 > nul
title ARES - Astronot Kol ve Bilek Terminali
echo ======================================================
echo    ARES Astronot Kol ve Bilek Terminali Baslatiliyor
echo ======================================================
echo.
echo Tarayici aciliyor...
start http://localhost:5173
echo.
echo Sunucu aktif. Kapatmak icin bu pencereyi kapatabilirsiniz.
echo.
call npm run dev
pause
