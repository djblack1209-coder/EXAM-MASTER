#!/usr/bin/env bash
# ============================================
# EXAM-MASTER H5(PWA) 一键部署脚本
#
# 用法:
#   bash deploy/tencent/scripts/deploy-h5.sh
#
# 功能:
#   1. 本地构建 H5 版本
#   2. 上传到腾讯云服务器
#   3. 同步 Nginx 配置
#   4. 重载 Nginx
#   5. 验证部署
# ============================================

set -euo pipefail

# ==================== 配置 ====================
SERVER="root@101.43.41.96"
REMOTE_H5_DIR="/opt/apps/exam-master/h5"
REMOTE_NGINX_DIR="/etc/nginx"
LOCAL_BUILD_DIR="dist/build/h5"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "============================================"
echo "  EXAM-MASTER H5 部署"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ==================== 1. 本地构建 ====================
echo ""
echo "步骤 1/5: 构建 H5 版本..."

if ! npm run build:h5; then
    err "H5 构建失败，停止部署"
fi

if [ ! -d "$LOCAL_BUILD_DIR" ]; then
    err "构建产物目录不存在: $LOCAL_BUILD_DIR"
fi

FILE_COUNT=$(find "$LOCAL_BUILD_DIR" -type f | wc -l)
log "构建完成 — $FILE_COUNT 个文件"

# ==================== 2. 上传静态文件 ====================
echo ""
echo "步骤 2/5: 上传静态文件到服务器..."

ssh "$SERVER" "mkdir -p $REMOTE_H5_DIR"

# 使用 rsync 增量同步（比 scp 快，只传变化的文件）
if command -v rsync &> /dev/null; then
    rsync -avz --delete "$LOCAL_BUILD_DIR/" "$SERVER:$REMOTE_H5_DIR/"
else
    # 降级到 scp
    warn "rsync 不可用，使用 scp（全量上传）"
    scp -r "$LOCAL_BUILD_DIR/"* "$SERVER:$REMOTE_H5_DIR/"
fi

log "静态文件已上传"

# ==================== 3. 同步 Nginx 配置 ====================
echo ""
echo "步骤 3/5: 同步 Nginx 配置..."

# 上传主配置
scp deploy/tencent/nginx/nginx.conf "$SERVER:$REMOTE_NGINX_DIR/nginx.conf"
# 上传站点配置（API + H5）
scp deploy/tencent/nginx/conf.d/exam-master.conf "$SERVER:$REMOTE_NGINX_DIR/conf.d/exam-master.conf"
scp deploy/tencent/nginx/conf.d/exam-master-h5.conf "$SERVER:$REMOTE_NGINX_DIR/conf.d/exam-master-h5.conf"

log "Nginx 配置已同步"

# ==================== 4. 重载 Nginx ====================
echo ""
echo "步骤 4/5: 验证并重载 Nginx..."

ssh "$SERVER" "nginx -t && systemctl reload nginx"

log "Nginx 已重载"

# ==================== 5. 验证部署 ====================
echo ""
echo "步骤 5/5: 验证部署..."

sleep 2

# 健康检查
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://101.43.41.96:8080/health" 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    log "H5 健康检查通过"
else
    warn "H5 健康检查返回 $HEALTH（服务器防火墙可能需要放行 8080 端口）"
    echo ""
    echo "  如需放行端口，在服务器上执行:"
    echo "    ufw allow 8080/tcp"
    echo "    # 同时在腾讯云控制台安全组中添加 8080 入站规则"
fi

# 首页检查
INDEX=$(curl -s -o /dev/null -w "%{http_code}" "http://101.43.41.96:8080/" 2>/dev/null || echo "000")
if [ "$INDEX" = "200" ]; then
    log "H5 首页加载成功"
else
    warn "H5 首页返回 $INDEX"
fi

echo ""
echo "============================================"
echo -e "${GREEN}  H5 部署完成！${NC}"
echo "============================================"
echo ""
echo "访问地址: http://101.43.41.96:8080"
echo ""
echo "注意事项:"
echo "  1. 首次部署需在服务器防火墙放行 8080 端口:"
echo "     ssh $SERVER 'ufw allow 8080/tcp'"
echo "  2. 腾讯云控制台安全组也需添加 8080 TCP 入站规则"
echo "  3. 如需域名访问，配置 DNS 后修改 server_name"
echo ""
