# ============================================
# Exam-Master 后端服务 Dockerfile
# 多阶段构建，优化镜像大小和安全性
# ============================================

# ==================== 构建阶段 ====================
FROM node:20-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制依赖文件
COPY laf-backend/package*.json ./

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY laf-backend/ ./

# ==================== 生产阶段 ====================
FROM node:20-alpine AS production

# 安全加固：创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# 安装运行时依赖
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# 从构建阶段复制文件
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/cloud-functions ./cloud-functions
COPY --from=builder --chown=nodejs:nodejs /app/database-schema ./database-schema
COPY --from=builder --chown=nodejs:nodejs /app/triggers ./triggers
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 暴露端口
EXPOSE 3000

# 切换到非 root 用户
USER nodejs

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 启动命令
CMD ["node", "cloud-functions/system/health.js"]

# ==================== 标签 ====================
LABEL maintainer="Exam-Master DevOps Team" \
      version="1.0.0" \
      description="Exam-Master Backend Service" \
      org.opencontainers.image.source="https://github.com/exam-master/exam-master"
