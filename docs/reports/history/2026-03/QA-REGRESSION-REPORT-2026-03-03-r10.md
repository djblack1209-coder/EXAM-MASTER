# Exam-Master 自动化回归报告（Round r10）

## 执行信息

- 执行分支：`test-fix/2026-03-03-r10`
- 本轮目标：在 Node 20 基线下完成全链路复跑并固化 Maestro fallback 口径
- 测试策略：`Vitest + Playwright(标准回归 + 兼容回归) + Maestro(缺参自动降级 H5)`

## 本轮补充改进

- 新增 tracked secrets 审计脚本：`scripts/build/audit-tracked-secrets.sh`
- 追加 Maestro 设备 preflight 报告：`docs/reports/QA-MAESTRO-PREFLIGHT-2026-03-03-r10.md`
- 调整 `.gitignore` 白名单，纳管关键 `scripts/test/*` Maestro 脚本到版本控制
- 新增夜间回归工作流：`.github/workflows/qa-nightly-regression.yml`

## 执行命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && node -v && npm -v
eval "$(fnm env)" && fnm use 20.17.0 && npm test
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:regression
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:compat
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:maestro:preflight
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:maestro
eval "$(fnm env)" && fnm use 20.17.0 && npx vitest run --reporter=json --outputFile=docs/reports/vitest-results-r10.json
npm run audit:secrets:tracked
# 一键全链路（已更新）
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:qa:full-regression
```

成功判定标准：

- Vitest 失败数 = 0
- E2E 标准回归失败数 = 0
- E2E 兼容回归失败数 = 0
- Maestro 命令可执行并产出 JUnit 报告
- Maestro preflight 报告可生成

## 安全卫生检查

- Tracked 代码密钥扫描：通过（`npm run audit:secrets:tracked`）
- 本地环境文件：检测到本机 `.env` / backups 含敏感值（不在 Git 跟踪内）
- 明细报告：`docs/reports/QA-SECURITY-HYGIENE-2026-03-03-r10.md`

## 全量结果汇总

- Node / npm：`v20.17.0 / 10.8.2`
- Vitest：`1206 passed / 0 failed / 0 skipped`
- E2E 标准回归：`30 passed / 0 failed / 0 skipped`
- E2E 兼容回归：`90 passed / 0 failed / 0 skipped`
- Maestro 套件命令：`passed`（无 `APP_ID` 时自动降级执行 `10-web-h5-smoke`）
- Maestro preflight：`device connected` + `no third-party package`（见 preflight 报告）
- 一键命令 `npm run test:qa:full-regression`：`passed`

## 覆盖确认

- 冒烟：通过
- 核心流程：通过
- 前 10 高风险页面：通过（实际覆盖 11 页）
- 异常流程（空输入/500/断网/弱网）：通过
- 状态恢复（返回/多击/后台恢复/刷新）：通过
- 手势模拟（滑动）：通过

## 报告产物

- 回归报告：`docs/reports/QA-REGRESSION-REPORT-2026-03-03-r10.md`
- 缺陷清单：`docs/reports/QA-DEFECTS-2026-03-03-r10.csv`
- 单元 JSON：`docs/reports/vitest-results-r10.json`
- Playwright 标准回归：
  - `docs/reports/e2e-regression-results.json`
  - `docs/reports/e2e-regression-results.xml`
  - `docs/reports/e2e-regression-html/index.html`
- Playwright 兼容回归：
  - `docs/reports/e2e-compat-results.json`
  - `docs/reports/e2e-compat-results.xml`
  - `docs/reports/e2e-compat-html/index.html`
- Maestro：
  - `docs/reports/maestro-results.xml`
  - `docs/reports/maestro-web-smoke.xml`
  - `docs/reports/maestro-web-smoke-r10.xml`
  - `docs/reports/maestro-preflight.md`
  - `docs/reports/QA-MAESTRO-PREFLIGHT-2026-03-03-r10.md`
- 安全卫生：
  - `docs/reports/QA-SECURITY-HYGIENE-2026-03-03-r10.md`

## 本轮结果（按规则）

- 新发现问题数：0
- 已修复问题数：0（沿用 r9 修复结果，复验通过）
- 未解决阻塞问题：0
- 已知覆盖缺口：`MB-BLOCK-001`（当前模拟器无第三方安装包，native 覆盖受限，H5 fallback 兜底）

## 下一轮计划

1. 获取可启动 Android 包名后执行：`MAESTRO_REQUIRE_NATIVE=1 APP_ID="<pkg>" npm run test:maestro`。
2. 观察 `qa-nightly-regression` 连续 7 天结果，固化失败告警阈值。
3. 完成外部密钥轮换，并清理/加密本地 backups 中的历史 env 文件。
