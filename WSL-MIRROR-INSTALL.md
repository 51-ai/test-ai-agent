# WSL 2 国内镜像快速安装指南

## 🚀 推荐：使用国内镜像安装

### 步骤 1：以管理员身份打开 PowerShell

1. 右键点击 **开始菜单**
2. 选择 **Windows PowerShell (管理员)**
3. 点击 **是**

### 步骤 2：运行国内镜像安装脚本

```powershell
cd "C:\Users\51\Documents\trae_projects\test--ai agent"
.\wsl-mirror-install.ps1
```

脚本会自动：
- ✅ 检测 WSL 状态
- ✅ 启用 WSL 功能（如需要）
- ✅ **使用阿里云/腾讯云/华为云镜像加速下载**
- ✅ 解压并导入 Ubuntu
- ✅ 配置 WSL 2

---

## 📊 镜像源列表

脚本会自动尝试以下镜像源，按顺序选择最快的：

| 镜像源 | 地址 | 推荐度 |
|--------|------|--------|
| 阿里云 | https://mirrors.aliyun.com/wsl/ubuntu22.04.zip | ⭐⭐⭐⭐⭐ |
| 腾讯云 | https://mirrors.cloud.tencent.com/wsl/ubuntu22.04.zip | ⭐⭐⭐⭐ |
| 华为云 | https://mirrors.huaweicloud.com/wsl/ubuntu22.04.zip | ⭐⭐⭐ |
| 微软官方 | https://aka.ms/wslubuntu2204 | ⭐⭐ |

---

## ⏱️ 预计下载时间

| 镜像源 | 预计速度 | 预计时间（800MB） |
|--------|---------|------------------|
| 阿里云 | 5-10 MB/s | **2-3 分钟** ⭐ |
| 腾讯云 | 3-8 MB/s | 2-5 分钟 |
| 华为云 | 2-5 MB/s | 3-7 分钟 |
| 微软官方 | 0.5-2 MB/s | 7-30 分钟 |

---

## 🔧 脚本功能

### 自动重试机制
- 如果第一个镜像失败，自动尝试下一个
- 显示实时下载速度和进度

### 智能加速
- 优先使用国内镜像
- 失败时自动切换到备用镜像

### 完整日志
- 所有操作记录到日志文件
- 便于排查问题

---

## ✅ 安装后配置

### 1. 启动 Ubuntu

```powershell
wsl -d Ubuntu-22.04
```

### 2. 设置用户名和密码

首次启动时：
```
输入新的用户名：ubuntu
输入新的密码：
确认密码：
```

### 3. 安装 Docker

在 Ubuntu 终端中运行：

```bash
# 更新软件包
sudo apt update && sudo apt upgrade -y

# 安装 Docker
sudo apt install -y docker.io docker-compose

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 添加用户到 docker 组（避免每次使用 sudo）
sudo usermod -aG docker $USER

# 退出
exit
```

### 4. 验证 Docker 安装

重新打开 Ubuntu 终端：

```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Compose 版本
docker-compose --version

# 运行测试容器
docker run hello-world
```

---

## 📋 所有安装脚本

| 脚本 | 说明 | 推荐度 |
|------|------|--------|
| `wsl-mirror-install.ps1` | ⭐ **国内镜像安装** | ⭐⭐⭐⭐⭐ |
| `wsl-one-click-install.ps1` | 一键安装脚本 | ⭐⭐⭐⭐ |
| `wsl-manual-install.bat` | 离线安装脚本 | ⭐⭐⭐ |

---

## 🎯 快速安装命令汇总

### 方法 1：运行安装脚本（推荐）

```powershell
.\wsl-mirror-install.ps1
```

### 方法 2：手动使用国内镜像

```powershell
# 下载（使用阿里云）
Invoke-WebRequest -Uri "https://mirrors.aliyun.com/wsl/ubuntu22.04.zip" `
  -OutFile "$env:USERPROFILE\Downloads\ubuntu22.04.zip" `
  -UseBasicParsing

# 解压
Expand-Archive -Path "$env:USERPROFILE\Downloads\ubuntu22.04.zip" `
  -DestinationPath "$env:TEMP\ubuntu" -Force

# 导入
wsl --import Ubuntu-22.04 C:\WSL\Ubuntu-22.04 "$env:TEMP\ubuntu\*.wsl" --version 2
```

---

## 🔍 查看下载进度

如果脚本正在下载，您可以另开一个 PowerShell 窗口查看：

```powershell
# 查看文件大小
Get-Item "$env:USERPROFILE\Downloads\ubuntu22.04.zip" | Format-Table Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}

# 实时监控下载速度
while ($true) {
    $size = [math]::Round((Get-Item "$env:USERPROFILE\Downloads\ubuntu22.04.zip").Length/1MB, 2)
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] 当前大小: $size MB"
    Start-Sleep -Seconds 5
}
```

---

## ❓ 常见问题

### Q: 脚本提示"需要重启电脑"？

**A**: 这是正常的。运行以下命令重启：
```powershell
Restart-Computer
```
重启后，再次运行脚本。

### Q: 所有镜像都下载失败？

**A**: 可以手动下载：
1. 使用浏览器下载：https://aka.ms/wslubuntu2204
2. 保存到：`C:\Users\51\Downloads\ubuntu22.04.zip`
3. 运行：`.\wsl-manual-install.bat`

### Q: 导入失败？

**A**: 检查镜像文件：
```powershell
Get-ChildItem "$env:TEMP\ubuntu" -Recurse | Select-Object Name, Length
```

### Q: 如何查看安装日志？

**A**: 
```powershell
Get-Content "$env:TEMP\wsl-install\mirror-install.log"
```

### Q: 如何卸载 Ubuntu？

**A**: 
```powershell
wsl --unregister Ubuntu-22.04
```

---

## 🎉 安装完成后

运行 AI Agent 系统的 Docker 容器：

```bash
# 进入项目目录
cd /mnt/c/Users/51/Documents/trae\ projects/test--ai\ agent

# 复制环境变量
cp .env.example .env

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 访问应用
echo "前端: http://localhost"
echo "后端 API: http://localhost:3000"
```

---

## 📞 技术支持

如果遇到问题：
1. 查看错误信息
2. 查看安装日志：`$env:TEMP\wsl-install\mirror-install.log`
3. 告诉我具体的错误信息

---

**祝您安装顺利！** 🚀🎊
