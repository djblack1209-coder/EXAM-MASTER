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

---

# Phase 3-4 Audit Report (2026-03-01)

## Scope

- Phase 3：修复 Phase 2 遗留的鉴权路径分散、CI endpoint 漂移、本地/云端源码漂移。
- Phase 4：Node 版本对齐、全量回归、线上实时验证、发布收尾。

## Phase 3 Fixes

### High — 鉴权路径统一

1. `school-query.ts` sync_from_chsi 管理员鉴权统一到 `_shared/admin-auth.ts`
   - 移除内联 `process.env.ADMIN_SECRET` + 手动 `crypto.timingSafeEqual`
   - 改为 `requireAdminAccess(ctx, { allowBodyFallback: true })`
   - 移除 `import crypto`（不再直接使用）
   - 状态：Fixed + Deployed + Live-verified (403)

2. `school-crawler-api.ts` refresh/crawl_all 管理员鉴权统一到 `_shared/admin-auth.ts`
   - 两处内联鉴权块替换为 `requireAdminAccess`
   - 移除 `import crypto`
   - 状态：Fixed + Deployed + Live-verified (403)

### High — CI Smoke Endpoint 修正

3. `.github/workflows/ci-cd.yml` staging/production smoke 从 `/health` 改为 `/health-check`
   - `/health` 在 Laf 返回 404 Function Not Found（已实测确认）
   - `/health-check` 返回 200 `{"code":0,"status":"ok"}`
   - 状态：Fixed

### High — 本地/云端源码漂移消除

4. 8 个 Phase 2 修复文件推送到 Laf 云端
   - `db-create-indexes.ts`、`favorite-manager.ts`、`group-service.ts`、`learning-goal.ts`
   - `mistake-manager.ts`、`proxy-ai.ts`、`social-service.ts`、`study-stats.ts`
   - 加上本次新改的 `school-query.ts`、`school-crawler-api.ts`（共 10 个函数）
   - `audit:laf:function-sources --strict` content diffs: 0
   - 状态：Fixed

## Phase 4 Fixes

### Node 版本对齐

- 切换本机 Node 从 18.20.8 到 20.17.0（via `fnm use 20.17.0`）
- 解决 `@vitejs/plugin-vue` 的 `crypto.hash is not a function` 导致的 11 个 EmptyState 组件测试失败

### 测试适配

- `audit-school-query-auth-response.spec.js`：设置 `ADMIN_SECRET` 环境变量使测试走"客户端未提供凭据→403"路径（而非"服务端未配置→503"）；断言 message 从 `管理员权限` 改为 `无权执行`
- `audit-school-crawler-auth-response.spec.js`：同上处理

## Validation Results (Phase 4 Final)

- `npm test` (Node 20.17.0)：64 files / 986 tests passed / 0 failed
- `npm run lint`：通过，无错误
- `npm run test:cloud:smoke`：6 passed / 0 failed / 3 skipped
- `npm run audit:laf:function-sources -- --strict`：通过（content diffs: 0）
- 线上实时验证：
  - `health-check` → 200 `{"code":0,"status":"ok"}`
  - `proxy-ai health_check` → `{"code":0,"status":"ready"}`（不再暴露 models/uptime）
  - `school-query sync_from_chsi` 无凭据 → 403
  - `school-crawler-api refresh` 无凭据 → 403
  - `school-crawler-api crawl_all` 无凭据 → 403
  - `school-crawler-api crawl_all` 错误凭据 → 403
  - `account-purge` 无凭据 → 403

## Changed Files (Phase 3-4)

- `laf-backend/functions/school-query.ts`
- `laf-backend/functions/school-crawler-api.ts`
- `.github/workflows/ci-cd.yml`
- `tests/unit/audit-school-query-auth-response.spec.js`
- `tests/unit/audit-school-crawler-auth-response.spec.js`

## Remaining Known Issues

1. `fnm default` 仍为 Node 18.20.8 — 建议执行 `fnm default 20.17.0` 持久化
2. GitHub CLI 未登录 — 无法做 Actions Secrets 只读校验
3. 无 SSH/Cloudflare 凭据 — 对应交叉验证标记为 Limit Reached
