@echo off
REM ========================================
REM WSL 2 + Docker 快速安装脚本
REM 适用于 Windows 11 家庭版
REM ========================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo WSL 2 + Docker 快速安装脚本
echo ========================================
echo.

set ERROR_COUNT=0
set DOWNLOAD_DIR=%USERPROFILE%\Downloads
set WSL_DIR=C:\WSL
set TEMP_DIR=%TEMP%\wsl-install

REM 创建临时目录
echo [1/7] 准备安装目录...
if not exist "%WSL_DIR%" mkdir "%WSL_DIR%"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
echo.

REM ========================================
echo [2/7] 启用 WSL 和虚拟机平台（需要管理员权限）...
echo.

dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
if %errorlevel% neq 0 (
    echo ❌ 启用 WSL 失败，尝试直接下载安装...
) else (
    echo ✅ WSL 功能已启用
)

dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
if %errorlevel% neq 0 (
    echo ❌ 启用虚拟机平台失败
    set /a ERROR_COUNT+=1
) else (
    echo ✅ 虚拟机平台已启用
)
echo.

REM ========================================
echo [3/7] 下载 WSL 内核更新包...
echo.

set WSL_KERNEL_URL=https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi
set WSL_KERNEL_FILE=%TEMP_DIR%\wsl_update_x64.msi

if exist "%WSL_KERNEL_FILE%" (
    echo ✅ WSL 内核已存在，跳过下载
) else (
    echo 下载 WSL 内核更新包...
    powershell -Command "Invoke-WebRequest -Uri '%WSL_KERNEL_URL%' -OutFile '%WSL_KERNEL_FILE%' -UseBasicParsing"
    if %errorlevel% neq 0 (
        echo ❌ WSL 内核下载失败
        set /a ERROR_COUNT+=1
    ) else (
        echo ✅ WSL 内核下载完成
    )
)
echo.

REM 安装 WSL 内核
echo 安装 WSL 内核更新包...
msiexec /i "%WSL_KERNEL_FILE%" /quiet /norestart
echo ✅ WSL 内核安装完成
echo.

REM ========================================
echo [4/7] 设置 WSL 2 为默认版本...
echo.
wsl --set-default-version 2
echo.

REM ========================================
echo [5/7] 下载 Ubuntu 22.04 WSL 镜像...
echo.

set UBUNTU_URL=https://aka.ms/wslubuntu2204
set UBUNTU_FILE=%DOWNLOAD_DIR%\ubuntu22.04.zip

if exist "%UBUNTU_FILE%" (
    echo ✅ Ubuntu 镜像已存在，跳过下载
) else (
    echo 正在下载 Ubuntu 22.04 WSL 镜像（约 800MB）...
    echo 请耐心等待，下载速度取决于网络...
    powershell -Command "Invoke-WebRequest -Uri '%UBUNTU_URL%' -OutFile '%UBUNTU_FILE%' -UseBasicParsing"
    if %errorlevel% neq 0 (
        echo ❌ Ubuntu 镜像下载失败
        echo 请手动下载：%UBUNTU_URL%
        set /a ERROR_COUNT+=1
    ) else (
        echo ✅ Ubuntu 镜像下载完成
    )
)
echo.

REM ========================================
echo [6/7] 导入 Ubuntu 22.04...
echo.

if exist "%WSL_DIR%\Ubuntu-22.04" (
    echo ✅ Ubuntu 已安装，跳过导入
) else (
    echo 解压并导入 Ubuntu...
    powershell -Command "Expand-Archive -Path '%UBUNTU_FILE%' -DestinationPath '%TEMP_DIR%' -Force"
    
    for %%f in ("%TEMP_DIR%\*.wsl") do (
        echo 导入 WSL 镜像...
        wsl --import Ubuntu-22.04 "%WSL_DIR%\Ubuntu-22.04" "%%f" --version 2
    )
    
    echo ✅ Ubuntu 22.04 安装完成
)
echo.

REM ========================================
echo [7/7] 启动 Ubuntu 并完成初始设置...
echo.

echo 请在打开的 Ubuntu 窗口中：
echo 1. 输入用户名（英文，小写）
echo 2. 输入密码（两次）
echo.
echo 然后关闭 Ubuntu 窗口，继续本脚本...
echo.

wsl -d Ubuntu-22.04

echo.
echo ========================================
echo 安装完成检查
echo ========================================
echo.

wsl -l -v

if %ERROR_COUNT% equ 0 (
    echo.
    echo ✅ WSL 2 + Ubuntu 22.04 安装成功！
    echo.
    echo 下一步：在 Ubuntu 中安装 Docker
    echo 请打开 Ubuntu 终端，运行：
    echo   sudo apt update ^&^& sudo apt install -y docker.io docker-compose
    echo   sudo systemctl start docker
    echo   sudo usermod -aG docker $USER
    echo.
) else (
    echo.
    echo ⚠️  安装过程中有 %ERROR_COUNT% 个错误
    echo 请查看上述错误信息
    echo.
)

echo.
pause
endlocal
