#!/bin/bash

# Docker安装脚本 for Ubuntu on WSL2

echo "=== 开始安装 Docker CE ==="

# 1. 更新apt
echo "[1/6] 更新apt包索引..."
sudo apt-get update -qq

# 2. 安装必要的前置包
echo "[2/6] 安装前置依赖..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 3. 创建keyrings目录
echo "[3/6] 添加Docker GPG密钥..."
sudo mkdir -p /etc/apt/keyrings

# 4. 下载GPG密钥（使用阿里云镜像）
echo "[4/6] 下载Docker GPG密钥..."
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 5. 添加Docker仓库
echo "[5/6] 添加Docker仓库..."
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list

# 6. 安装Docker
echo "[6/6] 安装Docker CE..."
sudo apt-get update -qq
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 7. 启动Docker服务
echo "启动Docker服务..."
sudo service docker start

# 8. 验证安装
echo "验证Docker安装..."
docker --version
docker compose version

echo "=== Docker安装完成！==="
echo "注意：在WSL2中，Docker需要通过dockerd运行"
