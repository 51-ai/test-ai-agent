# ========================================
# WSL 2 国内镜像快速安装脚本
# 使用阿里云镜像加速下载
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WSL 2 国内镜像快速安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$DOWNLOAD_DIR = "$env:USERPROFILE\Downloads"
$UBUNTU_FILE = Join-Path $DOWNLOAD_DIR "ubuntu22.04.zip"
$EXTRACT_DIR = "$env:TEMP\ubuntu-wsl-mirror"
$TEMP_WSL_DIR = "$env:TEMP\wsl-install"

# 创建日志目录
if (-not (Test-Path $TEMP_WSL_DIR)) {
    New-Item -ItemType Directory -Path $TEMP_WSL_DIR -Force | Out-Null
}

$LOG_FILE = Join-Path $TEMP_WSL_DIR "mirror-install.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage -Encoding UTF8
}

Write-Log "开始 WSL 2 国内镜像安装..."

# ========================================
# 步骤 1: 启用 WSL 功能（如需要）
# ========================================

Write-Host "[1/7] 检查并启用 WSL 功能..." -ForegroundColor Yellow
Write-Log "检查 WSL 状态..."

$wslCheck = wsl --status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  WSL 尚未安装，正在启用..." -ForegroundColor Yellow
    Write-Log "启用 WSL 功能..."
    
    try {
        dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
        dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
        
        Write-Host "✅ WSL 功能已启用" -ForegroundColor Green
        Write-Log "WSL 功能已启用"
        Write-Host ""
        Write-Host "⚠️  需要重启电脑才能完成 WSL 安装！" -ForegroundColor Red
        Write-Host ""
        Write-Host "请运行以下命令重启电脑：" -ForegroundColor Yellow
        Write-Host "  Restart-Computer" -ForegroundColor White
        Write-Host ""
        Write-Host "重启后，再次运行本脚本继续安装：" -ForegroundColor Yellow
        Write-Host "  .\wsl-mirror-install.ps1" -ForegroundColor White
        Write-Host ""
        Write-Log "需要重启电脑以完成 WSL 安装"
        return
    }
    catch {
        Write-Host "❌ 启用 WSL 功能失败: $_" -ForegroundColor Red
        Write-Log "启用 WSL 功能失败: $_" "ERROR"
        return
    }
} else {
    Write-Host "✅ WSL 已安装" -ForegroundColor Green
    Write-Log "WSL 已安装"
}

Write-Host ""

# ========================================
# 步骤 2: 设置 WSL 2 为默认版本
# ========================================

Write-Host "[2/7] 设置 WSL 2 为默认版本..." -ForegroundColor Yellow
Write-Log "设置 WSL 2 为默认版本..."

try {
    wsl --set-default-version 2 2>&1 | Out-Null
    Write-Host "✅ WSL 2 已设为默认版本" -ForegroundColor Green
    Write-Log "WSL 2 设为默认版本成功"
}
catch {
    Write-Host "⚠️  设置 WSL 2 失败，继续..." -ForegroundColor Yellow
    Write-Log "设置 WSL 2 失败: $_" "WARN"
}

Write-Host ""

# ========================================
# 步骤 3: 检查已安装的发行版
# ========================================

Write-Host "[3/7] 检查已安装的发行版..." -ForegroundColor Yellow
Write-Log "检查已安装的发行版..."

$ubuntuCheck = wsl -l -v 2>&1

if ($ubuntuCheck -match "Ubuntu-22.04") {
    Write-Host "✅ Ubuntu 22.04 已安装！" -ForegroundColor Green
    Write-Log "Ubuntu 22.04 已安装"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "🎉 Ubuntu 22.04 已经安装完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "启动 Ubuntu：" -ForegroundColor Cyan
    Write-Host "  wsl -d Ubuntu-22.04" -ForegroundColor White
    Write-Host ""
    Write-Host "在 Ubuntu 中安装 Docker：" -ForegroundColor Cyan
    Write-Host "  sudo apt update && sudo apt install -y docker.io docker-compose" -ForegroundColor White
    Write-Host "  sudo systemctl start docker" -ForegroundColor White
    Write-Host ""
    
    return
}

Write-Host "未检测到 Ubuntu 22.04，继续安装..." -ForegroundColor Yellow
Write-Host ""

# ========================================
# 步骤 4: 下载 Ubuntu 镜像（国内镜像）
# ========================================

Write-Host "[4/7] 下载 Ubuntu 22.04 WSL 镜像（国内镜像加速）..." -ForegroundColor Yellow
Write-Log "开始下载 Ubuntu 镜像..."

if (Test-Path $UBUNTU_FILE) {
    $fileSizeMB = [math]::Round((Get-Item $UBUNTU_FILE).Length / 1MB, 2)
    Write-Host "✅ Ubuntu 镜像已存在: $fileSizeMB MB" -ForegroundColor Green
    Write-Log "Ubuntu 镜像已存在: $fileSizeMB MB"
} else {
    Write-Host "正在下载 Ubuntu WSL 镜像（约 800MB）..." -ForegroundColor Yellow
    Write-Host "使用阿里云镜像加速下载" -ForegroundColor Gray
    Write-Host ""
    
    # 国内镜像列表
    $mirrors = @(
        @{ Name="阿里云"; Url="https://mirrors.aliyun.com/wsl/ubuntu22.04.zip" },
        @{ Name="腾讯云"; Url="https://mirrors.cloud.tencent.com/wsl/ubuntu22.04.zip" },
        @{ Name="华为云"; Url="https://mirrors.huaweicloud.com/wsl/ubuntu22.04.zip" },
        @{ Name="微软官方"; Url="https://aka.ms/wslubuntu2204" }
    )
    
    $downloadSuccess = $false
    $downloadUrl = ""
    
    foreach ($mirror in $mirrors) {
        Write-Host "尝试下载镜像: $($mirror.Name)" -ForegroundColor Cyan
        Write-Log "尝试下载镜像: $($mirror.Name)"
        
        try {
            $startTime = Get-Date
            
            # 启用进度显示
            $ProgressPreference = 'Continue'
            
            Invoke-WebRequest -Uri $mirror.Url `
                -OutFile $UBUNTU_FILE `
                -UseBasicParsing `
                -TimeoutSec 600
            
            $endTime = Get-Date
            $duration = ($endTime - $startTime).TotalSeconds
            $fileSizeMB = [math]::Round((Get-Item $UBUNTU_FILE).Length / 1MB, 2)
            $speedMBps = [math]::Round($fileSizeMB / $duration, 2)
            
            Write-Host ""
            Write-Host "✅ $($mirror.Name) 下载成功!" -ForegroundColor Green
            Write-Host "  文件大小: $fileSizeMB MB" -ForegroundColor Gray
            Write-Host "  下载耗时: $([math]::Round($duration, 2)) 秒" -ForegroundColor Gray
            Write-Host "  下载速度: $speedMBps MB/s" -ForegroundColor Gray
            Write-Log "镜像下载完成: $($mirror.Name), $fileSizeMB MB, $([math]::Round($duration, 2))s"
            
            $downloadSuccess = $true
            $downloadUrl = $mirror.Name
            break
        }
        catch {
            Write-Host "⚠️  $($mirror.Name) 下载失败: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Log "$($mirror.Name) 下载失败: $($_.Exception.Message)" "WARN"
            
            # 如果下载失败，删除不完整的文件
            if (Test-Path $UBUNTU_FILE) {
                Remove-Item $UBUNTU_FILE -Force -ErrorAction SilentlyContinue
            }
            
            continue
        }
    }
    
    if (-not $downloadSuccess) {
        Write-Host ""
        Write-Host "❌ 所有镜像下载失败！" -ForegroundColor Red
        Write-Host ""
        Write-Host "请手动下载：" -ForegroundColor Yellow
        Write-Host "1. 打开浏览器访问: https://aka.ms/wslubuntu2204" -ForegroundColor White
        Write-Host "2. 保存到: $UBUNTU_FILE" -ForegroundColor White
        Write-Host "3. 重新运行本脚本" -ForegroundColor White
        Write-Log "所有镜像下载失败" "ERROR"
        return
    }
}

Write-Host ""

# ========================================
# 步骤 5: 解压镜像
# ========================================

Write-Host "[5/7] 解压 Ubuntu WSL 镜像..." -ForegroundColor Yellow
Write-Log "解压 Ubuntu 镜像..."

if (Test-Path $EXTRACT_DIR) {
    Remove-Item $EXTRACT_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $EXTRACT_DIR -Force | Out-Null

try {
    Write-Host "正在解压镜像..." -ForegroundColor Yellow
    Expand-Archive -Path $UBUNTU_FILE -DestinationPath $EXTRACT_DIR -Force
    
    $extractedFiles = Get-ChildItem -Path $EXTRACT_DIR -Recurse -File
    Write-Host "✅ 镜像解压完成，发现 $($extractedFiles.Count) 个文件" -ForegroundColor Green
    Write-Log "镜像解压完成"
}
catch {
    Write-Host "❌ 镜像解压失败: $_" -ForegroundColor Red
    Write-Log "镜像解压失败: $_" "ERROR"
    return
}

Write-Host ""

# ========================================
# 步骤 6: 导入 Ubuntu
# ========================================

Write-Host "[6/7] 导入 Ubuntu 22.04..." -ForegroundColor Yellow
Write-Log "导入 Ubuntu 22.04..."

# 查找 .wsl 文件
$wslFiles = Get-ChildItem -Path $EXTRACT_DIR -Filter "*.wsl" -Recurse

if ($wslFiles.Count -eq 0) {
    # 尝试查找 .tar 或其他格式
    $wslFiles = Get-ChildItem -Path $EXTRACT_DIR -Include "*.tar", "*.tar.gz", "*.vhdx" -Recurse
}

if ($wslFiles.Count -eq 0) {
    Write-Host "❌ 未找到 WSL 镜像文件！" -ForegroundColor Red
    Write-Host "解压目录内容：" -ForegroundColor Yellow
    Get-ChildItem -Path $EXTRACT_DIR -Recurse | Format-Table Name, Length
    Write-Log "未找到 WSL 镜像文件" "ERROR"
    return
}

$wslFile = $wslFiles[0]
Write-Host "找到镜像: $($wslFile.Name)" -ForegroundColor Gray
Write-Host "镜像大小: $([math]::Round($wslFile.Length/1MB, 2)) MB" -ForegroundColor Gray
Write-Host ""
Write-Host "正在导入 Ubuntu..." -ForegroundColor Yellow
Write-Host "（这可能需要几分钟，请耐心等待）" -ForegroundColor Gray
Write-Host ""

try {
    # 确保目标目录存在
    $wslInstallDir = "C:\WSL\Ubuntu-22.04"
    if (-not (Test-Path "C:\WSL")) {
        New-Item -ItemType Directory -Path "C:\WSL" -Force | Out-Null
    }
    
    $startImport = Get-Date
    
    # 导入 WSL
    $importResult = wsl --import Ubuntu-22.04 $wslInstallDir $wslFile.FullName --version 2 2>&1
    
    $endImport = Get-Date
    $importDuration = ($endImport - $startImport).TotalSeconds
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Ubuntu 22.04 导入成功!" -ForegroundColor Green
        Write-Host "  导入耗时: $([math]::Round($importDuration, 2)) 秒" -ForegroundColor Gray
        Write-Log "Ubuntu 22.04 导入成功"
    }
    else {
        Write-Host "❌ Ubuntu 导入失败: $importResult" -ForegroundColor Red
        Write-Log "Ubuntu 导入失败: $importResult" "ERROR"
        return
    }
}
catch {
    Write-Host "❌ Ubuntu 导入失败: $_" -ForegroundColor Red
    Write-Log "Ubuntu 导入失败: $_" "ERROR"
    return
}

Write-Host ""

# ========================================
# 步骤 7: 完成
# ========================================

Write-Host "[7/7] 安装完成!" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ WSL 2 + Ubuntu 22.04 安装成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "查看已安装的发行版：" -ForegroundColor Cyan
wsl -l -v
Write-Host ""

Write-Host "启动 Ubuntu：" -ForegroundColor Cyan
Write-Host "  wsl -d Ubuntu-22.04" -ForegroundColor White
Write-Host ""

Write-Host "首次启动时需要设置用户名和密码：" -ForegroundColor Yellow
Write-Host "1. 输入新的用户名（英文，小写）" -ForegroundColor Gray
Write-Host "2. 输入密码（两次）" -ForegroundColor Gray
Write-Host ""

Write-Host "在 Ubuntu 中安装 Docker：" -ForegroundColor Cyan
Write-Host "  sudo apt update && sudo apt install -y docker.io docker-compose" -ForegroundColor White
Write-Host "  sudo systemctl start docker" -ForegroundColor White
Write-Host "  sudo systemctl enable docker" -ForegroundColor White
Write-Host "  sudo usermod -aG docker `$USER" -ForegroundColor White
Write-Host ""

Write-Host "验证 Docker 安装：" -ForegroundColor Cyan
Write-Host "  docker --version" -ForegroundColor White
Write-Host "  docker-compose --version" -ForegroundColor White
Write-Host "  docker run hello-world" -ForegroundColor White
Write-Host ""

Write-Log "安装脚本执行完成"

# 清理临时文件
Write-Host "清理临时文件..." -ForegroundColor Gray
Remove-Item $EXTRACT_DIR -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $UBUNTU_FILE -Force -ErrorAction SilentlyContinue
Write-Host "✅ 清理完成" -ForegroundColor Gray
Write-Host ""

Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
