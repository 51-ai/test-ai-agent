@echo off
REM ========================================
REM Docker on WSL 2 Installation Script
REM For Windows 11 Home Edition
REM ========================================

echo.
echo ========================================
echo Docker on WSL 2 Installation Script
echo ========================================
echo.
echo Your System: Windows 11 家庭版 (64位)
echo RAM: 32GB
echo.
echo This script will:
echo 1. Enable WSL and Virtual Machine Platform
echo 2. Set WSL 2 as default
echo 3. Install Ubuntu from Microsoft Store
echo.

pause

echo.
echo [Step 1/3] Enabling WSL and Virtual Machine Platform...
echo.

dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
if %errorlevel% neq 0 (
    echo ❌ Failed to enable WSL
    pause
    exit /b 1
)

dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
if %errorlevel% neq 0 (
    echo ❌ Failed to enable Virtual Machine Platform
    pause
    exit /b 1
)

echo ✅ Features enabled successfully

echo.
echo [Step 2/3] Setting WSL 2 as default version...
echo.

wsl --set-default-version 2

echo ✅ WSL 2 set as default

echo.
echo [Step 3/3] Opening Microsoft Store for Ubuntu installation...
echo.

start ms-windows-store://pdp/?ProductId=9PDXGNCFSCZV

echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Click "Get" in Microsoft Store to install Ubuntu
echo 2. Wait for installation to complete
echo 3. Launch Ubuntu and set up your username/password
echo 4. Run these commands in Ubuntu terminal:
echo    sudo apt update && sudo apt install -y docker.io docker-compose
echo    sudo systemctl start docker && sudo systemctl enable docker
echo    sudo usermod -aG docker $USER
echo    exit
echo ========================================
echo.

pause