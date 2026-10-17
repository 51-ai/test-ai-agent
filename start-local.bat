@echo off
REM ========================================
REM AI Agent - 本地开发环境启动脚本
REM ========================================

echo.
echo ========================================
echo AI Agent 本地开发环境
echo ========================================
echo.

REM 检查Node.js是否安装
echo [1/5] 检查Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js未安装，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js已安装
node --version

REM 检查MongoDB和Redis（或使用内存存储）
echo.
echo [2/5] 检查npm...
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm未安装
    pause
    exit /b 1
)
echo ✅ npm已安装
npm --version

REM 安装后端依赖
echo.
echo [3/5] 安装后端依赖...
cd backend
if not exist "node_modules" (
    echo 正在安装依赖，这可能需要几分钟...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ 后端依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 后端依赖已安装
)

REM 安装前端依赖
echo.
echo [4/5] 安装前端依赖...
cd ..\frontend
if not exist "node_modules" (
    echo 正在安装依赖，这可能需要几分钟...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ 前端依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 前端依赖已安装
)

REM 创建环境变量文件
echo.
echo [5/5] 配置环境变量...
cd ..\backend
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ✅ 已创建.env文件
    )
)

REM 启动服务
echo.
echo ========================================
echo 🚀 启动服务
echo ========================================
echo.
echo 启动后端服务器 (端口: 3000)...
start "AI Agent Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo 启动前端服务器 (端口: 5173)...
start "AI Agent Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo ✅ 服务已启动！
echo ========================================
echo.
echo 访问地址：
echo   - 前端界面: http://localhost:5173
echo   - 后端API:  http://localhost:3000
echo   - 健康检查: http://localhost:3000/api/health
echo.
echo 提示：
echo   - 第一个窗口是后端服务器
echo   - 第二个窗口是前端服务器
echo   - 关闭这些窗口将停止服务
echo   - 数据库使用内存存储，重启后数据会丢失
echo.
pause
