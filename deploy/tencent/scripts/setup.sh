#!/usr/bin/env bash
# ============================================
# EXAM-MASTER 腾讯云服务器一键部署脚本
#
# 用法: ssh root@101.43.41.96 'bash -s' < deploy/tencent/scripts/setup.sh
#
# 服务器: 2核 2GB 40GB SSD Ubuntu 22.04
# 多项目共享目录: /opt/apps/{project-name}/
# ============================================

set -euo pipefail

# ==================== 颜色输出 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo "============================================"
echo "  EXAM-MASTER 腾讯云服务器部署"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ==================== 1. 系统基础 ====================
info "Phase 1: 系统配置"

# 设置时区
timedatectl set-timezone Asia/Shanghai 2>/dev/null || true

# 更新系统
apt-get update -qq
apt-get upgrade -y -qq

# 基础工具
apt-get install -y -qq \
    curl wget git vim htop iotop \
    ca-certificates gnupg lsb-release \
    ufw fail2ban \
    unzip jq

log "系统基础包安装完成"

# ==================== 2. 防火墙 ====================
info "Phase 2: 防火墙配置"

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
# 不开放 3001, 27017 等内部端口
ufw --force enable

log "UFW 防火墙已启用 (22/80/443)"

# ==================== 3. Fail2Ban ====================
info "Phase 3: Fail2Ban 配置"

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
EOF

systemctl restart fail2ban
log "Fail2Ban 已配置 (SSH 暴力破解防护)"

# ==================== 4. Docker 安装 ====================
info "Phase 4: Docker 安装"

if ! command -v docker &> /dev/null; then
    # Docker 官方安装
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    log "Docker 已安装: $(docker --version)"
else
    log "Docker 已存在: $(docker --version)"
fi

# ==================== 5. Nginx 安装 ====================
info "Phase 5: Nginx 安装"

if ! command -v nginx &> /dev/null; then
    apt-get install -y -qq nginx
    systemctl enable nginx
    log "Nginx 已安装"
else
    log "Nginx 已存在"
fi

# ==================== 6. 多项目目录结构 ====================
info "Phase 6: 创建多项目目录结构"

# 顶层结构
mkdir -p /opt/apps
mkdir -p /opt/nginx/conf.d

# 各项目目录
for project in exam-master ai-chain-discussion edu-math job-bot openclaw-bot; do
    mkdir -p "/opt/apps/${project}"
    log "  /opt/apps/${project}/"
done

echo ""
info "端口规划 (已预留):"
echo "  ┌──────────────────────┬────────┬────────────┐"
echo "  │ 项目                 │ 后端端口│ DB 端口     │"
echo "  ├──────────────────────┼────────┼────────────┤"
echo "  │ EXAM-MASTER          │ 3001   │ 27017      │"
echo "  │ AI Chain Discussion  │ 3002   │ 27018      │"
echo "  │ Edu Math             │ 3003   │ 27019      │"
echo "  │ Job Bot              │ 3004   │ (shared)   │"
echo "  │ OpenClaw Bot         │ 3005   │ (shared)   │"
echo "  └──────────────────────┴────────┴────────────┘"
echo "  Nginx: 80/443"

# ==================== 7. Nginx 全局配置 ====================
info "Phase 7: Nginx 多项目配置"

# 备份原始配置
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%s) 2>/dev/null || true

# 注意：Nginx 配置文件需要从项目仓库同步到 /etc/nginx/
# 此处先创建软链接目录结构
mkdir -p /opt/nginx/conf.d

cat > /etc/nginx/nginx.conf << 'NGINX_CONF'
user www-data;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr [$time_local] "$request" $status $body_bytes_sent '
                    '"$http_user_agent" $upstream_addr $upstream_response_time';
    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    client_max_body_size 20m;
    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript;

    limit_req_zone $binary_remote_addr zone=global_api:10m rate=50r/s;
    limit_conn_zone $binary_remote_addr zone=global_conn:10m;

    include /opt/nginx/conf.d/*.conf;
}
NGINX_CONF

log "Nginx 全局配置已写入"

# 写入 EXAM-MASTER 配置
cat > /opt/nginx/conf.d/exam-master.conf << 'EXAM_NGINX'
# EXAM-MASTER — 反向代理 + 故障转移
limit_req_zone $binary_remote_addr zone=exam_api:5m rate=20r/s;

upstream exam_master_backend {
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server nf98ia8qnt.sealosbja.site:443 backup;
}

server {
    listen 80 default_server;
    server_name 101.43.41.96;

    location = /health {
        access_log off;
        return 200 '{"status":"ok","server":"nginx-tencent"}';
        add_header Content-Type application/json;
    }

    # EXAM-MASTER 命名空间路由
    location /exam-master/ {
        limit_req zone=exam_api burst=30 nodelay;

        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;

        rewrite ^/exam-master/(.*)$ /$1 break;
        proxy_pass http://exam_master_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;

        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_tries 2;
        proxy_next_upstream_timeout 30s;
    }

    # 直接路径兼容 (前端直调)
    location ~ ^/(login|proxy-ai|proxy-ai-stream|health-check|question-bank|answer-submit|mistake-manager|favorite-manager|user-stats|user-profile|study-stats|learning-goal|learning-resource|material-manager|rank-center|pk-battle|social-service|group-service|invite-service|achievement-manager|school-query|send-email-code|upload-avatar|voice-service|doc-convert|photo-bg|id-photo-segment-base64|ai-quiz-grade|ai-photo-search|ai-friend-memory|ai-diagnosis|agent-orchestrator|lesson-generator|rag-ingest|rag-query|anki-import|anki-export|getHomeData|fsrs-optimizer|account-delete|account-purge|data-cleanup|db-create-indexes|db-migrate-timestamps|job-bot-handoff-notify|school-crawler-api)$ {
        limit_req zone=exam_api burst=30 nodelay;
        proxy_pass http://exam_master_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_tries 2;
    }

    location / {
        return 404 '{"code":404,"message":"Not Found"}';
        add_header Content-Type application/json;
    }
}
EXAM_NGINX

nginx -t && systemctl reload nginx
log "Nginx EXAM-MASTER 配置已生效"

# ==================== 8. 系统优化 ====================
info "Phase 8: 系统优化 (2GB RAM)"

# Swap (防止 OOM)
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log "2GB Swap 已创建"
fi

# 内核参数优化
cat >> /etc/sysctl.conf << 'SYSCTL'
# EXAM-MASTER 优化
vm.swappiness=10
vm.overcommit_memory=1
net.core.somaxconn=1024
net.ipv4.tcp_max_syn_backlog=2048
net.ipv4.tcp_fin_timeout=15
net.ipv4.tcp_tw_reuse=1
SYSCTL
sysctl -p > /dev/null 2>&1

log "系统优化完成 (swap + 内核参数)"

# ==================== 9. Docker 日志限制 ====================
info "Phase 9: Docker 日志限制"

mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DOCKER_CONF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
DOCKER_CONF

systemctl restart docker
log "Docker 日志限制已配置 (10MB × 3)"

# ==================== 完成 ====================
echo ""
echo "============================================"
echo -e "${GREEN}  服务器初始化完成！${NC}"
echo "============================================"
echo ""
echo "下一步操作:"
echo ""
echo "1. 上传项目代码:"
echo "   scp -r deploy/tencent root@101.43.41.96:/opt/apps/exam-master/"
echo "   scp -r laf-backend root@101.43.41.96:/opt/apps/exam-master/"
echo ""
echo "2. 配置环境变量:"
echo "   ssh root@101.43.41.96"
echo "   cd /opt/apps/exam-master"
echo "   cp .env.example .env  # 编辑填入真实密码"
echo ""
echo "3. 启动服务:"
echo "   docker compose -f docker-compose.yml up -d --build"
echo ""
echo "4. 验证:"
echo "   curl http://101.43.41.96/health"
echo "   curl http://101.43.41.96/exam-master/health-check"
echo ""
echo "5. 部署 CF Worker (海外 API 代理):"
echo "   cd deploy/tencent/cf-worker"
echo "   npx wrangler deploy"
echo ""
