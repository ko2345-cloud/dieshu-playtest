@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if /I "%~1"=="--open-browser" goto openbrowser

title Dieshu web test

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  找不到 Node.js，網頁測試沒有啟動。
  echo  請先安裝 Node.js：https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\expo\package.json" (
  echo.
  echo  第一次執行，正在安裝依賴...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  依賴安裝失敗，網頁測試沒有啟動。
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  疊數 — 網頁測試
echo  伺服器起來後會打開 http://localhost:8081
echo  關閉此視窗即停止伺服器。
echo.

set BROWSER=none
start "dieshu-open-browser" /MIN cmd /c ""%~f0" --open-browser"

call npx expo start --web --port 8081 --localhost
set EXITCODE=%ERRORLEVEL%

echo.
if not "%EXITCODE%"=="0" echo  伺服器已停止，代碼 %EXITCODE%。
pause
exit /b %EXITCODE%

:openbrowser
for /L %%I in (1,1,60) do (
  netstat -ano | findstr "LISTENING" | findstr ":8081 " >nul
  if not errorlevel 1 (
    start "" "http://localhost:8081"
    exit /b 0
  )
  ping -n 2 127.0.0.1 >nul
)
exit /b 1
