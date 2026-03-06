# QA toB 交付回归报告（2026-03-05 r3）

## 执行结论

- 已按“覆盖所有页面内容”目标完成扩展测试并通过全链路门禁。
- H5 视觉回归从 13 页扩展到 pages.json 全量 30 页。
- Playwright 回归新增全量路由健康度扫描（亮色+深色、多视口兼容矩阵）。

## 本轮新增覆盖

- 新增全量路由覆盖用例：`tests/e2e-regression/specs/07-full-route-coverage.spec.js`
  - 亮色/深色两套检查
  - 检查项：路由可达、运行时就绪、致命错误信号、横向溢出
- 视觉回归扩展：`tests/visual/full-feature-pages.spec.js`
  - 自动读取 `pages.json`，覆盖 root + subPackages 全量路由
  - 总视觉快照用例数提升至 41
- 新增通用路由工具：`tests/shared/page-routes.js`

## 结果摘要（本轮 clean gate）

- 执行命令：`QA_SKIP_PLAYWRIGHT_INSTALL=1 bash scripts/test/run-full-regression-gate.sh`
- Lint / Format / Laf strict audit / Build：passed
- Unit（Vitest）：79 files / 1206 passed
- Visual（Playwright）：41 passed
- E2E Regression：32 passed
- E2E Compat：96 passed
- Maestro：skipped（无设备，按当前策略非阻断）
- MiniProgram E2E（Jest）：13 passed

## 风险说明

- `npm audit --omit=dev` 仍有 11 项上游漏洞（`@dcloudio/uni-cli-shared` 依赖链），当前保持 non-blocking。
