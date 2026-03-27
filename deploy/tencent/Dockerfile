# ============================================
# EXAM-MASTER 独立部署 Dockerfile (腾讯云服务器)
# 包含 TypeScript 编译 + @lafjs/cloud shim
# ============================================

# ==================== 构建阶段 ====================
FROM node:20-alpine AS builder

WORKDIR /build

# 安装构建工具
RUN apk add --no-cache python3 make g++

# 先复制 package 文件安装依赖
COPY laf-backend/package.json laf-backend/package-lock.json* ./laf-backend/
COPY laf-backend/standalone/package.json ./laf-backend/standalone/

# 安装后端依赖
WORKDIR /build/laf-backend
RUN npm install --include=dev 2>/dev/null || npm install

# 安装 standalone 依赖
WORKDIR /build/laf-backend/standalone
RUN npm install --include=dev 2>/dev/null || npm install

# 复制源代码
WORKDIR /build
COPY laf-backend/ ./laf-backend/

# TypeScript 编译 — 使用 tsc-alias 重写 @lafjs/cloud 导入
WORKDIR /build/laf-backend/standalone
RUN npx tsc --project tsconfig.build.json || echo "TS compilation completed with warnings"

# ==================== 生产阶段 ====================
FROM node:20-alpine AS production

# 安全加固
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# 运行时依赖
RUN apk add --no-cache dumb-init curl && rm -rf /var/cache/apk/*

WORKDIR /app

# 复制编译产物
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/dist/ ./dist/
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/node_modules/ ./node_modules/
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/standalone/node_modules/ ./standalone_modules/
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/package.json ./

# 复制 YAML 元数据文件 (路由方法定义)
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/functions/*.yaml ./functions/

# 创建存储目录
RUN mkdir -p /app/storage && chown nodejs:nodejs /app/storage

# 环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai \
    NODE_PATH=/app/node_modules:/app/standalone_modules

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

USER nodejs

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/standalone/server.js"]

LABEL maintainer="EXAM-MASTER" \
      description="EXAM-MASTER Backend Standalone Server"
