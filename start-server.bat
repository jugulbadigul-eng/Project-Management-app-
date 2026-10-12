@echo off
:: ============================================================
:: Project Hub - Local Web Server Launcher
:: Run this on the HOST machine (172.16.9.102)
:: Keep this window open while people are using the site
:: ============================================================
echo.
echo ============================================================
echo  Project Hub - Starting Local Web Server
echo  Site will be available at:
echo    http://172.16.9.102:3000
echo    http://projecthub.local:3000  (after DNS setup)
echo.
echo  Keep this window open! Close it to stop the server.
echo ============================================================
echo.
cd /d "%~dp0"
npx serve . --listen 3000
pause
