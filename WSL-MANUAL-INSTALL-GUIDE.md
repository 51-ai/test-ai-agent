# WSL 2 手动快速安装指南

## 🚀 方法一：使用浏览器下载（推荐，最简单）

### 步骤 1：下载 Ubuntu WSL 镜像

1. 打开浏览器访问：
   ```
   https://aka.ms/wslubuntu2204
   ```

2. 文件会自动下载（约 800MB）

3. 下载完成后，将文件移动或复制到：
   ```
   C:\Users\51\Downloads\ubuntu22.04.zip
   ```

### 步骤 2：运行安装脚本

1. 以管理员身份打开 PowerShell
   - 右键点击开始菜单
   - 选择 **Windows PowerShell (管理员)**

2. 运行安装脚本：
   ```powershell
   cd "C:\Users\51\Documents\trae_projects\test--ai agent"
   .\wsl-manual-install.bat
   ```

3. 脚本会自动：
   - 检测已下载的镜像
   - 导入 Ubuntu
   - 配置 WSL 2

---

## 🚀 方法二：使用 PowerShell 下载（最快）

### 步骤 1：下载镜像

在 PowerShell（管理员）中运行：

```powershell
# 创建下载目录
New-Item -ItemType Directory -Path "$env:USERPROFILE\Downloads\wsl" -Force

# 下载 Ubuntu WSL 镜像（约 800MB）
# 使用 -UseBasicParsing 加快下载速度
Invoke-WebRequest -Uri "https://aka.ms/wslubuntu2204" `
  -OutFile "$env:USERPROFILE\Downloads\ubuntu22.04.zip" `
  -UseBasicParsing

# 显示下载进度
Write-Host "下载完成！文件位置: $env:USERPROFILE\Downloads\ubuntu22.04.zip"
```

### 步骤 2：安装 Ubuntu

```powershell
# 运行安装脚本
cd "C:\Users\51\Documents\trae_projects\test--ai agent"
.\wsl-manual-install.bat
```

---

## 🚀 方法三：使用下载工具（速度最快）

### 支持的工具

- **IDM (Internet Download Manager)** - 速度最快
- **迅雷** - 国内速度快
- **浏览器下载** - 简单方便

### 下载地址

```
https://aka.ms/wslubuntu2204
```

### IDM 配置

1. 打开 IDM
2. 点击 **任务** → **添加任务**
3. 粘贴下载地址
4. 选择下载目录：`C:\Users\51\Downloads\`
5. 开始下载

### 完成后安装

下载完成后，运行：
```powershell
cd "C:\Users\51\Documents\trae_projects\test--ai agent"
.\wsl-manual-install.bat
```

---

## 📊 下载速度对比

| 方法 | 预计速度 | 预计时间 |
|------|---------|---------|
| 浏览器下载 | 1-3 MB/s | 5-15 分钟 |
| PowerShell 下载 | 2-5 MB/s | 3-8 分钟 |
| IDM 下载 | 5-10 MB/s | 2-3 分钟 |

---

## 🔧 方法四：使用国内镜像（最快）

### 阿里云镜像（推荐国内用户）

```powershell
# 下载 Ubuntu WSL 镜像
Invoke-WebRequest -Uri "https://mirrors.aliyun.com/wsl/ubuntu22.04.zip" `
  -OutFile "$env:USERPROFILE\Downloads\ubuntu22.04.zip" `
  -UseBasicParsing

# 如果上面的镜像不可用，试试这个：
Invoke-WebRequest -Uri "https://github.com/microsoft/WSL/releases/download/wsl-2.0.9/ubuntu-22.04-server.zip" `
  -OutFile "$env:USERPROFILE\Downloads\ubuntu22.04.zip" `
  -UseBasicParsing
```

---

## ✅ 安装后验证

### 检查 WSL 状态

```powershell
wsl --status
wsl -l -v
```

### 启动 Ubuntu

```powershell
wsl -d Ubuntu-22.04
```

按提示设置：
- 输入用户名（英文，小写）
- 输入密码（两次）

### 在 Ubuntu 中安装 Docker

打开 Ubuntu 终端，运行：

```bash
# 更新软件包
sudo apt update && sudo apt upgrade -y

# 安装 Docker
sudo apt install -y docker.io docker-compose

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 将用户添加到 docker 组
sudo usermod -aG docker $USER

# 退出并重新登录
exit
```

### 验证 Docker 安装

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

## 🎯 快速安装脚本汇总

| 脚本 | 说明 | 使用场景 |
|------|------|---------|
| `wsl-quick-install.ps1` | 完整安装脚本 | 首次安装 |
| `wsl-manual-install.bat` | 离线安装脚本 | 已下载镜像 |
| `wsl-quick-install.bat` | 批处理版本 | 备选方案 |

---

## ❓ 常见问题

### Q: 下载地址打不开？

**A**: 尝试以下备用地址：
- https://github.com/microsoft/WSL/releases
- https://mirrors.aliyun.com/wsl/

### Q: 脚本提示找不到镜像？

**A**: 确保镜像文件名是 `ubuntu22.04.zip`，保存在：
- `C:\Users\51\Downloads\ubuntu22.04.zip`
- `C:\Users\51\Desktop\ubuntu22.04.zip`

### Q: 导入失败？

**A**: 尝试手动导入：
```powershell
# 解压镜像
Expand-Archive -Path "$env:USERPROFILE\Downloads\ubuntu22.04.zip" -DestinationPath "$env:TEMP\ubuntu" -Force

# 查找镜像文件
Get-ChildItem -Path "$env:TEMP\ubuntu" -Filter "*.wsl"

# 导入（替换为实际文件名）
wsl --import Ubuntu-22.04 C:\WSL\Ubuntu-22.04 "$env:TEMP\ubuntu\ubuntu-22.04-server.wsl" --version 2
```

### Q: 如何卸载 Ubuntu？

**A**: 
```powershell
wsl --unregister Ubuntu-22.04
```

---

## 🎉 完成！

安装完成后，您就可以：

```bash
# 进入项目目录
cd /mnt/c/Users/51/Documents/trae\ projects/test--ai\ agent

# 启动 AI Agent 系统
docker-compose up -d

# 访问应用
echo "前端: http://localhost"
echo "后端 API: http://localhost:3000"
```

---

**祝您安装顺利！** 🚀
