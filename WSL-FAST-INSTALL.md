# WSL 2 快速安装 - 完整指南

## 🚀 推荐：一键安装（最简单）

### 步骤 1：以管理员身份打开 PowerShell

1. 右键点击 Windows 开始菜单
2. 选择 **Windows PowerShell (管理员)**
3. 点击 **是** 确认

### 步骤 2：运行一键安装脚本

```powershell
cd "C:\Users\51\Documents\trae_projects\test--ai agent"
.\wsl-one-click-install.ps1
```

脚本会自动：
- ✅ 检查 WSL 状态
- ✅ 下载 Ubuntu 镜像（优先使用国内镜像加速）
- ✅ 解压并导入 Ubuntu
- ✅ 配置 WSL 2

**预计耗时**：**5-10 分钟**

---

## 📋 所有安装脚本

| 脚本 | 说明 | 适用场景 |
|------|------|---------|
| `wsl-one-click-install.ps1` | ⭐ **一键安装脚本** | 最简单，推荐使用 |
| `wsl-manual-install.bat` | 离线安装脚本 | 已下载镜像 |
| `wsl-quick-install.ps1` | 完整安装脚本 | 首次安装 |
| `wsl-quick-install.bat` | 批处理版本 | 备选方案 |

---

## 🔧 手动安装方法

### 方法 1：浏览器下载

1. 访问：https://aka.ms/wslubuntu2204
2. 下载约 800MB 文件
3. 保存到：`C:\Users\51\Downloads\ubuntu22.04.zip`
4. 运行：`.\wsl-manual-install.bat`

### 方法 2：PowerShell 下载

```powershell
Invoke-WebRequest -Uri "https://aka.ms/wslubuntu2204" `
  -OutFile "$env:USERPROFILE\Downloads\ubuntu22.04.zip" `
  -UseBasicParsing
```

### 方法 3：国内镜像（最快）

```powershell
Invoke-WebRequest -Uri "https://mirrors.aliyun.com/wsl/ubuntu22.04.zip" `
  -OutFile "$env:USERPROFILE\Downloads\ubuntu22.04.zip" `
  -UseBasicParsing
```

---

## ✅ 安装后配置

### 1. 启动 Ubuntu 并设置用户

```powershell
wsl -d Ubuntu-22.04
```

按提示输入：
- 用户名（英文，小写）：`ubuntu`
- 密码（两次）

### 2. 安装 Docker

在 Ubuntu 终端中运行：

```bash
# 更新软件包
sudo apt update && sudo apt upgrade -y

# 安装 Docker
sudo apt install -y docker.io docker-compose

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 添加用户到 docker 组
sudo usermod -aG docker $USER

# 退出
exit
```

### 3. 验证安装

重新打开 Ubuntu 终端：

```bash
# 检查 Docker 版本
docker --version
docker-compose --version

# 运行测试容器
docker run hello-world
```

---

## 📊 安装进度查看

### 查看 WSL 状态

```powershell
wsl --status
wsl -l -v
```

### 查看下载进度

如果脚本正在下载，打开另一个 PowerShell 窗口查看：

```powershell
# 查看下载文件大小
Get-Item "$env:USERPROFILE\Downloads\ubuntu22.04.zip" | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}

# 查看实时大小变化
while ($true) { 
    $size = [math]::Round((Get-Item "$env:USERPROFILE\Downloads\ubuntu22.04.zip").Length/1MB, 2)
    Write-Host "当前大小: $size MB"
    Start-Sleep -Seconds 5
}
```

---

## 🎯 常见问题

### Q: 脚本报错"拒绝访问"？

**A**: 需要以管理员身份运行 PowerShell

### Q: 下载太慢？

**A**: 使用国内镜像：
```powershell
Invoke-WebRequest -Uri "https://mirrors.aliyun.com/wsl/ubuntu22.04.zip" -OutFile "$env:USERPROFILE\Downloads\ubuntu22.04.zip" -UseBasicParsing
```

### Q: 导入失败？

**A**: 检查镜像文件：
```powershell
# 查看临时目录
Get-ChildItem "$env:TEMP\ubuntu-wsl-install"

# 手动导入
wsl --import Ubuntu-22.04 C:\WSL\Ubuntu-22.04 "C:\path\to\file.wsl" --version 2
```

### Q: 如何卸载？

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

## 📞 获取帮助

如果遇到问题：
1. 查看错误信息
2. 参考上述常见问题
3. 告诉我具体的错误信息

---

**祝您安装顺利！** 🚀🎊
