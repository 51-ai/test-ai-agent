# WSL 2 + Docker 快速安装指南

## 🚀 快速开始（推荐）

### 步骤 1：以管理员身份运行 PowerShell

1. 右键点击 Windows 开始菜单
2. 选择 **Windows PowerShell (管理员)** 或 **终端 (管理员)**
3. 点击 **是** 确认

### 步骤 2：运行安装脚本

在管理员 PowerShell 中运行：

```powershell
cd "C:\Users\51\Documents\trae_projects\test--ai agent"
.\wsl-quick-install.ps1
```

### 步骤 3：重启电脑

脚本会提示需要重启电脑。运行：

```powershell
Restart-Computer
```

### 步骤 4：重启后继续安装

电脑重启后，再次以管理员身份打开 PowerShell：

```powershell
cd "C:\Users\51\Documents\trae_projects\test--ai agent"
.\wsl-quick-install.ps1 -SkipWSLSetup
```

### 步骤 5：设置 Ubuntu 用户名和密码

脚本会自动启动 Ubuntu，按照提示设置：
- 输入用户名（英文，小写）
- 输入密码（两次）

### 步骤 6：在 Ubuntu 中安装 Docker

打开 Ubuntu 终端，运行：

```bash
sudo apt update && sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
exit
```

### 步骤 7：验证安装

重新打开 Ubuntu 终端：

```bash
docker --version
docker-compose --version
docker run hello-world
```

---

## 📋 脚本说明

| 脚本 | 说明 |
|------|------|
| `wsl-quick-install.ps1` | PowerShell 版本（推荐） |
| `wsl-quick-install.bat` | 批处理版本（备选） |

### 参数说明（PowerShell 版本）

```powershell
# 跳过 WSL 设置（已启用后使用）
.\wsl-quick-install.ps1 -SkipWSLSetup

# 自动安装 Docker
.\wsl-quick-install.ps1 -SkipWSLSetup -AutoInstallDocker

# 完整安装（首次运行）
.\wsl-quick-install.ps1
```

---

## 🎯 自动安装脚本（一条命令完成）

如果您想一条命令完成所有步骤，运行：

```powershell
.\wsl-quick-install.ps1 -SkipWSLSetup -AutoInstallDocker
```

---

## ⚠️ 注意事项

1. **管理员权限**：启用 WSL 功能需要管理员权限
2. **电脑重启**：启用 WSL 后需要重启电脑
3. **网络速度**：Ubuntu 镜像约 800MB，下载时间取决于网络
4. **用户名**：必须是英文小写，不能包含空格

---

## 🔧 手动安装命令（如脚本失败）

### 启用 WSL（需要管理员）

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
Restart-Computer
```

### 安装 Ubuntu

```powershell
wsl --install -d Ubuntu-22.04
```

---

## ✅ 验证安装成功

运行以下命令检查：

```powershell
# 检查 WSL 状态
wsl --status

# 查看已安装的发行版
wsl -l -v

# 检查 WSL 版本
wsl --list --verbose
```

---

## 🐳 Docker 安装验证

在 Ubuntu 终端中运行：

```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Compose 版本
docker-compose --version

# 运行测试容器
docker run hello-world

# 查看 Docker 状态
sudo systemctl status docker
```

---

## 📞 常见问题

### Q: 脚本提示"需要管理员权限"？

**A**: 右键 PowerShell 图标，选择"以管理员身份运行"

### Q: 下载太慢？

**A**: 可以手动下载 Ubuntu 镜像，保存到桌面，脚本会自动检测

### Q: 安装失败？

**A**: 查看日志文件：`%TEMP%\wsl-install\install.log`

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
cd /mnt/c/Users/51/Documents/trae_projects/test--ai\ agent

# 复制环境变量
cp .env.example .env

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

---

**祝您安装顺利！** 🎊
