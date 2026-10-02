# 构建、ESM 打包和运行目录使用同一合同；任一步失败即停止构建。
FROM node:22-alpine AS builder
WORKDIR /build/laf-backend/standalone
COPY laf-backend/standalone/package.json laf-backend/standalone/package-lock.json ./
RUN npm ci --include=dev --ignore-scripts
WORKDIR /build
COPY laf-backend/ ./laf-backend/
WORKDIR /build/laf-backend/standalone
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
RUN apk add --no-cache dumb-init curl
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/standalone/dist/ ./dist/
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/standalone/node_modules/ ./node_modules/
COPY --from=builder --chown=nodejs:nodejs /build/laf-backend/standalone/package.json ./package.json
RUN mkdir -p /app/storage && chown nodejs:nodejs /app/storage
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 TZ=Asia/Shanghai
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 CMD curl -f http://localhost:3000/health || exit 1
EXPOSE 3000
USER nodejs
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/standalone/server.js"]
LABEL maintainer="EXAM-MASTER" description="EXAM-MASTER Backend Standalone Server"
