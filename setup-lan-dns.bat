@echo off
:: ============================================================
:: Project Hub - LAN DNS Setup
:: Run this as Administrator on EVERY PC that needs access
:: ============================================================
echo.
echo ============================================================
echo  Project Hub - Private LAN DNS Setup
echo  This adds "projecthub.local" to your hosts file
echo ============================================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Please right-click this file and select
    echo        "Run as administrator"
    echo.
    pause
    exit /b 1
)

:: Add hosts entries
set HOSTS=C:\Windows\System32\drivers\etc\hosts
set IP=172.16.9.102

:: Check if already exists
findstr /C:"projecthub.local" "%HOSTS%" >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] projecthub.local is already in your hosts file.
) else (
    echo.>> "%HOSTS%"
    echo 172.16.9.102	projecthub.local>> "%HOSTS%"
    echo 172.16.9.102	www.projecthub.local>> "%HOSTS%"
    echo [ADDED] 172.16.9.102  projecthub.local
    echo [ADDED] 172.16.9.102  www.projecthub.local
)

:: Flush DNS cache
ipconfig /flushdns >nul
echo [DONE] DNS cache flushed.
echo.
echo ============================================================
echo  SUCCESS! Open your browser and go to:
echo  http://projecthub.local:3000
echo ============================================================
echo.
pause
