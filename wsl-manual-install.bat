@echo off
REM ========================================
REM WSL 2 手动快速安装脚本（离线版）
REM 适用于已下载 Ubuntu WSL 镜像的情况
REM ========================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo WSL 2 手动快速安装脚本（离线版）
echo ========================================
echo.

set ERROR_COUNT=0
set UBUNTU_FILE=

REM ========================================
REM 查找已下载的 Ubuntu 镜像
REM ========================================

echo [步骤 1/5] 查找 Ubuntu WSL 镜像...
echo.

set SEARCH_PATHS=%USERPROFILE%\Downloads;%USERPROFILE%\Desktop;C:\Downloads

for %%P in (%SEARCH_PATHS%) do (
    if exist "%%P\ubuntu22.04.zip" (
        set UBUNTU_FILE=%%P\ubuntu22.04.zip
        goto :found_ubuntu
    )
    if exist "%%P\Ubuntu22.04.zip" (
        set UBUNTU_FILE=%%P\Ubuntu22.04.zip
        goto :found_ubuntu
    )
)

:found_ubuntu

if not defined UBUNTU_FILE (
    echo 未找到 Ubuntu WSL 镜像！
    echo.
    echo 请先下载 Ubuntu WSL 镜像：
    echo 1. 打开浏览器访问：https://aka.ms/wslubuntu2204
    echo 2. 下载完成后保存到以下位置之一：
    echo    - %USERPROFILE%\Downloads\ubuntu22.04.zip
    echo    - %USERPROFILE%\Desktop\ubuntu22.04.zip
    echo    - C:\Downloads\ubuntu22.04.zip
    echo.
    echo 或者直接运行此命令下载：
    echo powershell -Command "Invoke-WebRequest -Uri 'https://aka.ms/wslubuntu2204' -OutFile '%USERPROFILE%\Downloads\ubuntu22.04.zip'"
    echo.
    set /a ERROR_COUNT+=1
    goto :error
)

echo ✅ 找到 Ubuntu 镜像: %UBUNTU_FILE%
echo.

REM ========================================
REM 检查 WSL 状态
REM ========================================

echo [步骤 2/5] 检查 WSL 状态...
echo.

wsl --status >nul 2>&1
if errorlevel 1 (
    echo ⚠️  WSL 尚未安装
    echo.
    echo 请先以管理员身份运行 WSL 安装命令：
    echo 1. 右键点击开始菜单
    echo 2. 选择 "Windows PowerShell (管理员)"
    echo 3. 运行以下命令：
    echo    wsl --install
    echo.
    echo 然后重启电脑，再运行本脚本。
    echo.
    set /a ERROR_COUNT+=1
    goto :error
) else (
    echo ✅ WSL 已安装
)

echo.

REM ========================================
REM 设置 WSL 2 为默认版本
REM ========================================

echo [步骤 3/5] 设置 WSL 2 为默认版本...
echo.

wsl --set-default-version 2
if errorlevel 1 (
    echo ⚠️  设置 WSL 2 失败，继续...
)

echo ✅ WSL 2 已设为默认版本
echo.

REM ========================================
REM 导入 Ubuntu
REM ========================================

echo [步骤 4/5] 导入 Ubuntu 22.04...
echo.

set EXTRACT_DIR=%TEMP%\ubuntu-wsl-extract
if exist "%EXTRACT_DIR%" rmdir /s /q "%EXTRACT_DIR%"
mkdir "%EXTRACT_DIR%"

echo 解压 Ubuntu WSL 镜像...
powershell -Command "Expand-Archive -Path '%UBUNTU_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force"

for %%f in ("%EXTRACT_DIR%\*.wsl") do (
    echo 找到镜像: %%f
    echo.
    echo 正在导入 Ubuntu...
    echo 这可能需要几分钟，请耐心等待...
    echo.
    
    wsl --import Ubuntu-22.04 C:\WSL\Ubuntu-22.04 "%%f" --version 2
    
    if errorlevel 1 (
        echo ❌ Ubuntu 导入失败
        set /a ERROR_COUNT+=1
        goto :error
    ) else (
        echo ✅ Ubuntu 22.04 导入成功
    )
)

echo.

REM ========================================
REM 完成
REM ========================================

echo [步骤 5/5] 完成！
echo.

echo ========================================
echo ✅ WSL 2 + Ubuntu 22.04 安装完成！
echo ========================================
echo.
echo 下一步：启动 Ubuntu 并设置用户名和密码
echo.
echo 1. 运行以下命令启动 Ubuntu：
echo    wsl -d Ubuntu-22.04
echo.
echo 2. 按提示输入用户名和密码（英文）
echo.
echo 3. 在 Ubuntu 中安装 Docker：
echo    sudo apt update ^&^& sudo apt install -y docker.io docker-compose
echo    sudo systemctl start docker
echo    sudo usermod -aG docker $USER
echo.
echo 4. 验证 Docker 安装：
echo    docker --version
echo    docker run hello-world
echo.
goto :end

:error
echo.
echo ========================================
echo ⚠️  安装过程中出现错误
echo ========================================
echo.

:end
pause
endlocal
