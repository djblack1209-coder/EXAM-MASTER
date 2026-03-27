# ============================================
# Exam-Master 后端服务 Dockerfile
# 多阶段构建，优化镜像大小和安全性
# ============================================

# ==================== 构建阶段 ====================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制源代码（Laf 云函数项目）
COPY laf-backend/ ./

# 安装依赖（仅在 package.json 有实际依赖时）
RUN if [ -f package.json ] && [ -f package-lock.json ]; then \
      npm ci --omit=dev && npm cache clean --force; \
    elif [ -f package.json ]; then \
      DEPS=$(node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies||{}).length)" 2>/dev/null || echo "0"); \
      if [ "$DEPS" != "0" ]; then \
        npm install --omit=dev && npm cache clean --force; \
      fi; \
    fi

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
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# 复制云函数代码（使用通配符避免目录不存在时失败）
COPY --from=builder --chown=nodejs:nodejs /app/cloud-function[s] ./cloud-functions
COPY --from=builder --chown=nodejs:nodejs /app/database-schem[a] ./database-schema
COPY --from=builder --chown=nodejs:nodejs /app/trigger[s] ./triggers
COPY --from=builder --chown=nodejs:nodejs /app/function[s] ./functions

# node_modules 仅在有依赖时存在，使用通配符避免 COPY 失败
COPY --from=builder --chown=nodejs:nodejs /app/node_module[s] ./node_modules

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

# 启动 Express 服务器（standalone 模式）
CMD ["node", "standalone/server.js"]

# ==================== 标签 ====================
LABEL maintainer="Exam-Master DevOps Team" \
      version="1.0.0" \
      description="Exam-Master Backend Service" \
      org.opencontainers.image.source="https://github.com/djblack1209-coder/EXAM-MASTER"
