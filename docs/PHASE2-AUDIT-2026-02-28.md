# Phase 2 Audit Report (2026-02-28)

## Scope

- 范围：`laf-backend/functions/*`、`deploy/*`、`laf-backend/test-connection.js`、CI/监控配置。
- 方法：静态审计 + 实时接口探测 + 云端 smoke + 本地测试回归。

## Findings and Status

### High

1. 管理员鉴权存在直接字符串比较（非统一鉴权路径）
   - 影响文件：`laf-backend/functions/db-create-indexes.ts`、`laf-backend/functions/db-migrate-timestamps.ts`、`laf-backend/functions/data-cleanup.ts`
   - 风险：鉴权逻辑分散，容易出现比较方式不一致和后续维护偏差。
   - 处理：已改为统一调用 `requireAdminAccess`，并保留 body fallback 兼容历史调用。
   - 状态：Fixed

2. Sealos PAT 换 token 端点漂移导致连接脚本失败
   - 影响文件：`laf-backend/test-connection.js`
   - 风险：`/v1/pat2token` 失效时脚本误判整体不可用，且非 JSON 响应会触发解析崩溃。
   - 处理：新增多端点 fallback（含 `/v1/auth/pat2token`），并对所有关键响应使用容错解析。
   - 状态：Fixed

### Medium

1. Ingress CORS 允许任意来源
   - 影响文件：`deploy/k8s/ingress.yaml`
   - 风险：`cors-allow-origin: "*"` 扩大跨域攻击面。
   - 处理：改为显式 allowlist（生产域名 + staging + Sealos 域名）。
   - 状态：Fixed

2. 监控/验证端点与 Laf 实际健康端点不一致
   - 影响文件：`deploy/monitoring/prometheus.yml`、`laf-backend/deploy/monitoring/prometheus.yml`、`laf-backend/.github/workflows/ci-cd.yml`
   - 风险：`/health` 在 Laf 场景可能 404，导致监控和发布校验误报失败。
   - 处理：将 Sealos 探测与后端 CI 校验统一到 `/health-check`。
   - 状态：Fixed

3. health-check 管理态返回运行时内部信息
   - 影响文件：`laf-backend/functions/health-check.ts`
   - 风险：`environment/uptime` 属于非必要暴露面。
   - 处理：管理员响应中移除 `environment`、`uptime` 字段；保持公开态最小返回。
   - 状态：Fixed

### Low / Observations

1. 本地 Node/NPM 版本提示不匹配
   - 现象：npm 输出 `npm v11` 与 `node v18` 兼容告警。
   - 影响：当前测试可通过，但建议对齐工具链版本。

## Validation Results

- `npm test`：63 files / 979 tests passed
- `npm run test:cloud:smoke`：5 passed / 0 failed / 2 skipped（发布后复测通过）
- `node laf-backend/test-connection.js`：PAT/token、云函数端点、Laf API 列表均验证通过
- 云函数已发布：`data-cleanup`、`db-create-indexes`、`db-migrate-timestamps`、`health-check`
- `npm run audit:laf:function-sources -- --strict`：通过（content diff = 0）

## Changed Files

- `laf-backend/functions/db-create-indexes.ts`
- `laf-backend/functions/db-migrate-timestamps.ts`
- `laf-backend/functions/data-cleanup.ts`
- `laf-backend/functions/health-check.ts`
- `laf-backend/test-connection.js`（本地调试脚本，当前在 `.gitignore` 中）
- `deploy/k8s/ingress.yaml`
- `deploy/monitoring/prometheus.yml`
- `laf-backend/deploy/monitoring/prometheus.yml`
- `laf-backend/.github/workflows/ci-cd.yml`

## Phase 3 Readiness

- Critical/High 项已处理完成并通过回归。
- Phase 3 与云端同步已完成，可直接进入 Phase 4 持续回归与发布收尾。
