@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  疊數 — 網頁測試
echo  http://localhost:8081
echo.
echo  關閉此視窗即停止伺服器。
echo.

npx expo start --web --port 8081

echo.
pause
