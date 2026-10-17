#!/bin/bash

set -e

echo "========================================="
echo "  Linux U盘强制格式化脚本"
echo "  注意：此操作将清空U盘上的所有数据！"
echo "========================================="
echo ""

if [ "$(id -u)" != "0" ]; then
    echo "❌ 错误：需要以root权限运行此脚本"
    echo "请使用: sudo bash $0"
    exit 1
fi

echo "📋 步骤1：查看当前系统中的块设备"
echo "-----------------------------------------"
lsblk -d -o NAME,SIZE,TYPE,MODEL
echo ""

read -p "请输入你的U盘设备名称（如 sdb，不要包含 /dev/）：" DEVICE_NAME

if [ -z "$DEVICE_NAME" ]; then
    echo "❌ 错误：设备名称不能为空"
    exit 1
fi

DEVICE="/dev/$DEVICE_NAME"

if [ ! -b "$DEVICE" ]; then
    echo "❌ 错误：设备 $DEVICE 不存在"
    exit 1
fi

echo ""
echo "⚠️  警告：你即将格式化设备 $DEVICE"
echo "请确认这是你的U盘，不是系统硬盘！"
echo ""
echo "当前设备信息："
lsblk $DEVICE
echo ""

read -p "请输入 YES 确认继续：" CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "✅ 操作已取消"
    exit 0
fi

echo ""
echo "🔓 步骤2：卸载所有已挂载的分区"
echo "-----------------------------------------"
for PARTITION in $(ls ${DEVICE}* 2>/dev/null); do
    if mount | grep -q "$PARTITION"; then
        echo "正在卸载 $PARTITION..."
        umount -f "$PARTITION" 2>/dev/null || echo "  卸载失败，可能已被占用"
    fi
done

echo ""
echo "🗑️  步骤3：使用dd清除分区表（强制擦除）"
echo "-----------------------------------------"
echo "正在清除MBR分区表..."
dd if=/dev/zero of=$DEVICE bs=512 count=1 conv=notrunc

echo "正在清除GPT分区表和备份..."
dd if=/dev/zero of=$DEVICE bs=1 count=34 conv=notrunc
dd if=/dev/zero of=$DEVICE bs=1 count=512 seek=$(( $(blockdev --getsz $DEVICE) * 512 - 512 )) conv=notrunc 2>/dev/null || true

echo ""
echo "🔄 步骤4：重新扫描磁盘"
echo "-----------------------------------------"
partprobe $DEVICE
sleep 1

echo ""
echo "📐 步骤5：创建新的分区表和分区"
echo "-----------------------------------------"
echo "正在创建MBR分区表..."
echo -e "o\nn\np\n1\n\n\nw" | fdisk $DEVICE

sleep 1

PARTITION="${DEVICE}1"

echo ""
echo "✨ 步骤6：格式化分区为FAT32"
echo "-----------------------------------------"
echo "正在格式化 $PARTITION 为 FAT32 文件系统..."
mkfs.vfat -F 32 -n "USB_DISK" "$PARTITION"

echo ""
echo "✅ 格式化完成！"
echo "-----------------------------------------"
echo "设备：$DEVICE"
echo "分区：$PARTITION"
echo "文件系统：FAT32"
echo "卷标：USB_DISK"
echo ""
echo "你可以使用以下命令挂载U盘："
echo "mkdir -p /mnt/usb && mount $PARTITION /mnt/usb"
echo ""
echo "挂载后U盘将在 /mnt/usb 目录下访问。"