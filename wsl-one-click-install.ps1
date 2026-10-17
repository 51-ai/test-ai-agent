# ========================================
# WSL 2 一键快速安装脚本
# 下载 + 安装 一次完成
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WSL 2 一键快速安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$DOWNLOAD_DIR = "$env:USERPROFILE\Downloads"
$UBUNTU_FILE = Join-Path $DOWNLOAD_DIR "ubuntu22.04.zip"
$EXTRACT_DIR = "$env:TEMP\ubuntu-wsl-install"

# ========================================
# 步骤 1: 检查是否已安装 WSL
# ========================================

Write-Host "[1/6] 检查 WSL 状态..." -ForegroundColor Yellow
$wslCheck = wsl --status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  WSL 尚未安装" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先安装 WSL 功能：" -ForegroundColor Yellow
    Write-Host "1. 以管理员身份打开 PowerShell" -ForegroundColor White
    Write-Host "2. 运行: wsl --install" -ForegroundColor White
    Write-Host "3. 重启电脑" -ForegroundColor White
    Write-Host "4. 再次运行本脚本" -ForegroundColor White
    return
}

Write-Host "✅ WSL 已安装" -ForegroundColor Green
Write-Host ""

# ========================================
# 步骤 2: 设置 WSL 2 为默认
# ========================================

Write-Host "[2/6] 设置 WSL 2 为默认版本..." -ForegroundColor Yellow
wsl --set-default-version 2 | Out-Null
Write-Host "✅ WSL 2 已设为默认版本" -ForegroundColor Green
Write-Host ""

# ========================================
# 步骤 3: 下载 Ubuntu 镜像
# ========================================

Write-Host "[3/6] 下载 Ubuntu 22.04 WSL 镜像..." -ForegroundColor Yellow

if (Test-Path $UBUNTU_FILE) {
    Write-Host "✅ Ubuntu 镜像已存在，跳过下载" -ForegroundColor Green
    Write-Host "  位置: $UBUNTU_FILE" -ForegroundColor Gray
} else {
    Write-Host "正在下载 Ubuntu WSL 镜像（约 800MB）..." -ForegroundColor Yellow
    Write-Host "请耐心等待，下载速度取决于网络..." -ForegroundColor Gray
    Write-Host ""
    
    try {
        $startTime = Get-Date
        
        # 使用国内镜像加速（如果主镜像失败则使用备用）
        $urls = @(
            "https://aka.ms/wslubuntu2204",
            "https://mirrors.aliyun.com/wsl/ubuntu22.04.zip"
        )
        
        $downloadSuccess = $false
        foreach ($url in $urls) {
            Write-Host "尝试下载: $url" -ForegroundColor Gray
            try {
                Invoke-WebRequest -Uri $url -OutFile $UBUNTU_FILE -UseBasicParsing -TimeoutSec 600
                $downloadSuccess = $true
                break
            }
            catch {
                Write-Host "⚠️  下载失败，尝试下一个镜像..." -ForegroundColor Yellow
                continue
            }
        }
        
        if (-not $downloadSuccess) {
            throw "所有镜像下载失败"
        }
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        $fileSizeMB = [math]::Round((Get-Item $UBUNTU_FILE).Length / 1MB, 2)
        $speedMBps = [math]::Round($fileSizeMB / $duration, 2)
        
        Write-Host ""
        Write-Host "✅ Ubuntu 镜像下载完成!" -ForegroundColor Green
        Write-Host "  文件大小: $fileSizeMB MB" -ForegroundColor Gray
        Write-Host "  下载耗时: $([math]::Round($duration, 2)) 秒" -ForegroundColor Gray
        Write-Host "  下载速度: $speedMBps MB/s" -ForegroundColor Gray
    }
    catch {
        Write-Host ""
        Write-Host "❌ Ubuntu 镜像下载失败: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "请手动下载：" -ForegroundColor Yellow
        Write-Host "1. 打开浏览器访问: https://aka.ms/wslubuntu2204" -ForegroundColor White
        Write-Host "2. 保存到: $UBUNTU_FILE" -ForegroundColor White
        Write-Host "3. 重新运行本脚本" -ForegroundColor White
        return
    }
}

Write-Host ""

# ========================================
# 步骤 4: 解压镜像
# ========================================

Write-Host "[4/6] 解压 Ubuntu WSL 镜像..." -ForegroundColor Yellow

if (Test-Path $EXTRACT_DIR) {
    Remove-Item $EXTRACT_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $EXTRACT_DIR -Force | Out-Null

try {
    Expand-Archive -Path $UBUNTU_FILE -DestinationPath $EXTRACT_DIR -Force
    Write-Host "✅ 镜像解压完成" -ForegroundColor Green
}
catch {
    Write-Host "❌ 镜像解压失败: $_" -ForegroundColor Red
    return
}

Write-Host ""

# ========================================
# 步骤 5: 导入 Ubuntu
# ========================================

Write-Host "[5/6] 导入 Ubuntu 22.04..." -ForegroundColor Yellow

$wslFile = Get-ChildItem -Path $EXTRACT_DIR -Filter "*.wsl" | Select-Object -First 1

if (-not $wslFile) {
    Write-Host "❌ 未找到 WSL 镜像文件" -ForegroundColor Red
    Write-Host "解压目录内容：" -ForegroundColor Yellow
    Get-ChildItem -Path $EXTRACT_DIR | Format-Table Name, Length
    return
}

Write-Host "找到镜像: $($wslFile.Name)" -ForegroundColor Gray
Write-Host "正在导入 Ubuntu..." -ForegroundColor Yellow
Write-Host "（这可能需要几分钟）" -ForegroundColor Gray
Write-Host ""

try {
    $importResult = wsl --import Ubuntu-22.04 C:\WSL\Ubuntu-22.04 $wslFile.FullName --version 2 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Ubuntu 22.04 导入成功!" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Ubuntu 导入失败: $importResult" -ForegroundColor Red
        return
    }
}
catch {
    Write-Host "❌ Ubuntu 导入失败: $_" -ForegroundColor Red
    return
}

Write-Host ""

# ========================================
# 步骤 6: 完成
# ========================================

Write-Host "[6/6] 安装完成!" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ WSL 2 + Ubuntu 22.04 安装成功!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "查看已安装的发行版：" -ForegroundColor Cyan
wsl -l -v
Write-Host ""

Write-Host "启动 Ubuntu：" -ForegroundColor Cyan
Write-Host "  wsl -d Ubuntu-22.04" -ForegroundColor White
Write-Host ""

Write-Host "在 Ubuntu 中安装 Docker：" -ForegroundColor Cyan
Write-Host "  sudo apt update && sudo apt install -y docker.io docker-compose" -ForegroundColor White
Write-Host "  sudo systemctl start docker" -ForegroundColor White
Write-Host "  sudo usermod -aG docker \$USER" -ForegroundColor White
Write-Host ""

Write-Host "验证 Docker 安装：" -ForegroundColor Cyan
Write-Host "  docker --version" -ForegroundColor White
Write-Host "  docker run hello-world" -ForegroundColor White
Write-Host ""

# 清理临时文件
Remove-Item $EXTRACT_DIR -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
