# ========================================
# WSL 2 + Docker 快速安装脚本
# 适用于 Windows 11 家庭版
# ========================================

param(
    [switch]$SkipWSLSetup,
    [switch]$AutoInstallDocker
)

$ErrorActionPreference = "Continue"
$DOWNLOAD_DIR = [Environment]::GetFolderPath("Desktop")
$WSL_DIR = "C:\WSL"
$TEMP_DIR = Join-Path $env:TEMP "wsl-install"
$LOG_FILE = Join-Path $TEMP_DIR "install.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage -Encoding UTF8
}

Write-Host ""
Write-Host "========================================"
Write-Host "WSL 2 + Docker 快速安装脚本"
Write-Host "========================================"
Write-Host ""

# 创建日志目录
if (-not (Test-Path $TEMP_DIR)) {
    New-Item -ItemType Directory -Path $TEMP_DIR -Force | Out-Null
}

Write-Log "开始 WSL 2 安装..."

# ========================================
# 步骤 1: 启用 WSL 功能
# ========================================

if (-not $SkipWSLSetup) {
    Write-Host "[1/7] 启用 WSL 和虚拟机平台（需要管理员权限）..." -ForegroundColor Cyan
    
    Write-Log "启用 WSL 功能..."
    $wslResult = dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart 2>&1
    
    Write-Log "启用虚拟机平台..."
    $vmResult = dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart 2>&1
    
    Write-Host "✅ WSL 功能已启用" -ForegroundColor Green
    Write-Host "需要重启电脑后继续..."
    Write-Host ""
    Write-Host "请运行以下命令重启电脑:" -ForegroundColor Yellow
    Write-Host "  Restart-Computer" -ForegroundColor White
    Write-Host ""
    Write-Host "重启后，再次运行此脚本:" -ForegroundColor Yellow
    Write-Host "  .\wsl-quick-install.ps1 -SkipWSLSetup" -ForegroundColor White
    Write-Host ""
    
    Write-Log "需要重启电脑以完成 WSL 安装"
    return
}

# ========================================
# 步骤 2: 检查 WSL 状态
# ========================================

Write-Host "[2/7] 检查 WSL 状态..." -ForegroundColor Cyan
$wslStatus = wsl --status 2>&1
Write-Host $wslStatus
Write-Log "WSL 状态: $wslStatus"

# ========================================
# 步骤 3: 设置 WSL 2 为默认
# ========================================

Write-Host "[3/7] 设置 WSL 2 为默认版本..." -ForegroundColor Cyan
wsl --set-default-version 2 2>&1 | Out-Null
Write-Host "✅ WSL 2 已设为默认版本" -ForegroundColor Green
Write-Log "WSL 2 设为默认版本"

# ========================================
# 步骤 4: 下载 WSL 内核更新
# ========================================

Write-Host "[4/7] 检查 WSL 内核..." -ForegroundColor Cyan
$wslKernelFile = Join-Path $TEMP_DIR "wsl_update_x64.msi"

if (Test-Path $wslKernelFile) {
    Write-Host "✅ WSL 内核已存在" -ForegroundColor Green
} else {
    Write-Host "下载 WSL 内核更新包..." -ForegroundColor Yellow
    $wslKernelUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
    
    try {
        Invoke-WebRequest -Uri $wslKernelUrl -OutFile $wslKernelFile -UseBasicParsing -TimeoutSec 300
        Write-Host "✅ WSL 内核下载完成" -ForegroundColor Green
        Write-Log "WSL 内核下载完成"
        
        Write-Host "安装 WSL 内核..." -ForegroundColor Yellow
        Start-Process msiexec -ArgumentList "/i `"$wslKernelFile`" /quiet /norestart" -Wait -NoNewWindow
        Write-Host "✅ WSL 内核安装完成" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  WSL 内核下载失败，跳过" -ForegroundColor Yellow
        Write-Log "WSL 内核下载失败: $_" "WARN"
    }
}

# ========================================
# 步骤 5: 下载 Ubuntu 镜像
# ========================================

Write-Host "[5/7] 下载 Ubuntu 22.04 WSL 镜像..." -ForegroundColor Cyan
$ubuntuUrl = "https://aka.ms/wslubuntu2204"
$ubuntuFile = Join-Path $DOWNLOAD_DIR "ubuntu22.04.zip"

if (Test-Path $ubuntuFile) {
    Write-Host "✅ Ubuntu 镜像已存在: $ubuntuFile" -ForegroundColor Green
} else {
    Write-Host "正在下载 Ubuntu 22.04 WSL 镜像（约 800MB）..." -ForegroundColor Yellow
    Write-Host "下载速度取决于网络，请耐心等待..." -ForegroundColor Gray
    
    try {
        $startTime = Get-Date
        Invoke-WebRequest -Uri $ubuntuUrl -OutFile $ubuntuFile -UseBasicParsing
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        $fileSizeMB = [math]::Round((Get-Item $ubuntuFile).Length / 1MB, 2)
        $speedMBps = [math]::Round($fileSizeMB / $duration, 2)
        
        Write-Host "✅ Ubuntu 镜像下载完成!" -ForegroundColor Green
        Write-Host "  文件大小: $fileSizeMB MB" -ForegroundColor Gray
        Write-Host "  下载耗时: $([math]::Round($duration, 2)) 秒" -ForegroundColor Gray
        Write-Host "  下载速度: $speedMBps MB/s" -ForegroundColor Gray
        
        Write-Log "Ubuntu 镜像下载完成: $fileSizeMB MB, 耗时: $([math]::Round($duration, 2))s"
    }
    catch {
        Write-Host "❌ Ubuntu 镜像下载失败: $_" -ForegroundColor Red
        Write-Host "请手动下载: $ubuntuUrl" -ForegroundColor Yellow
        Write-Host "下载后保存到: $ubuntuFile" -ForegroundColor Yellow
        Write-Log "Ubuntu 镜像下载失败: $_" "ERROR"
        return
    }
}

# ========================================
# 步骤 6: 导入 Ubuntu
# ========================================

Write-Host "[6/7] 导入 Ubuntu 22.04..." -ForegroundColor Cyan

if (-not (Test-Path $WSL_DIR)) {
    New-Item -ItemType Directory -Path $WSL_DIR -Force | Out-Null
}

$ubuntuInstallDir = Join-Path $WSL_DIR "Ubuntu-22.04"

if (Test-Path $ubuntuInstallDir) {
    Write-Host "✅ Ubuntu 已安装: $ubuntuInstallDir" -ForegroundColor Green
} else {
    Write-Host "解压并导入 Ubuntu..." -ForegroundColor Yellow
    
    $extractDir = Join-Path $TEMP_DIR "ubuntu-extract"
    if (Test-Path $extractDir) {
        Remove-Item $extractDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
    
    Expand-Archive -Path $ubuntuFile -DestinationPath $extractDir -Force
    
    $wslFile = Get-ChildItem -Path $extractDir -Filter "*.wsl" | Select-Object -First 1
    
    if ($wslFile) {
        Write-Host "找到 WSL 镜像: $($wslFile.Name)" -ForegroundColor Gray
        Write-Host "正在导入..." -ForegroundColor Yellow
        
        $importResult = wsl --import Ubuntu-22.04 $ubuntuInstallDir $wslFile.FullName --version 2 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Ubuntu 22.04 导入成功!" -ForegroundColor Green
            Write-Log "Ubuntu 22.04 导入成功"
        } else {
            Write-Host "❌ Ubuntu 导入失败: $importResult" -ForegroundColor Red
            Write-Log "Ubuntu 导入失败: $importResult" "ERROR"
            return
        }
    } else {
        Write-Host "❌ 未找到 WSL 镜像文件" -ForegroundColor Red
        Write-Log "未找到 WSL 镜像文件" "ERROR"
        return
    }
}

# ========================================
# 步骤 7: 安装 Docker
# ========================================

if ($AutoInstallDocker) {
    Write-Host "[7/7] 在 Ubuntu 中安装 Docker..." -ForegroundColor Cyan
    
    $dockerCommands = @"
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker `$USER
echo '✅ Docker 安装完成！'
docker --version
docker-compose --version
"@
    
    Write-Host ""
    Write-Host "请在 Ubuntu 终端中运行以下命令安装 Docker:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host $dockerCommands -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "[7/7] Docker 安装（可选）" -ForegroundColor Cyan
}

# ========================================
# 完成
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ WSL 2 + Ubuntu 22.04 安装完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "检查安装结果:" -ForegroundColor Cyan
wsl -l -v
Write-Host ""

Write-Host "启动 Ubuntu:" -ForegroundColor Cyan
Write-Host "  wsl -d Ubuntu-22.04" -ForegroundColor White
Write-Host ""

if (-not $AutoInstallDocker) {
    Write-Host "在 Ubuntu 中安装 Docker:" -ForegroundColor Cyan
    Write-Host "  sudo apt update && sudo apt install -y docker.io docker-compose" -ForegroundColor White
    Write-Host "  sudo systemctl start docker" -ForegroundColor White
    Write-Host ""
}

Write-Host "或者运行此脚本自动安装 Docker:" -ForegroundColor Cyan
Write-Host "  .\wsl-quick-install.ps1 -SkipWSLSetup -AutoInstallDocker" -ForegroundColor White
Write-Host ""

Write-Log "安装脚本执行完成"

# 打开 Ubuntu 让用户设置初始用户名和密码
Write-Host "正在启动 Ubuntu 进行初始设置..." -ForegroundColor Yellow
Write-Host "请在打开的窗口中输入用户名和密码" -ForegroundColor Gray
Write-Host ""
wsl -d Ubuntu-22.04
