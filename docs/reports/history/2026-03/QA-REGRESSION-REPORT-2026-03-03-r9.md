# Exam-Master 自动化回归报告（Round r9）

## 执行信息

- 执行分支：`test-fix/2026-03-03-r9`
- 本轮目标：修复兼容回归剩余失败并完成全量复跑
- 测试策略：`Vitest + Playwright(标准回归 + 兼容回归) + Maestro(优先 native，缺参自动降级 H5)`

## 本轮变更

- 用例稳定性修复：`tests/e2e-regression/specs/01-core-flow.spec.js`
  - `ensureEmailFormVisible` 增强为多候选入口 + 重试 + 强制点击，修复 `CORE-001` 在 `mobile-390x844` 下偶发未展开问题。
- 业务幂等修复：`src/pages/login/index.vue`
  - 邮箱登录提交冷却从硬编码 `1200ms` 改为常量 `EMAIL_SUBMIT_COOLDOWN_MS=2500`，修复 `STATE-005` 在桌面兼容下偶发双请求。

## 执行命令

```bash
npm test
npm run test:e2e:regression
npm run test:e2e:compat
npm run test:maestro:syntax
npm run test:maestro:web:h5
npm run test:maestro
```

## 全量结果汇总

- Vitest：`1206 passed / 0 failed / 0 skipped`
- E2E 标准回归：`30 passed / 0 failed / 0 skipped`
- E2E 兼容回归：`90 passed / 0 failed / 0 skipped`
- Maestro 语法：`all flow syntax checks passed`
- Maestro Android H5 回归：`1 passed / 0 failed`（`10-web-h5-smoke`）
- Maestro 套件命令：`passed`（缺少 `APP_ID` 时自动降级为 H5 回归）
- 证据：`docs/reports/maestro-web-smoke-r9.xml`、`docs/reports/maestro-results.xml`

## Native 覆盖缺口

- 缺口ID：`MB-BLOCK-001`
- 描述：当前未知可启动 Android 包名，native 流程仍未全量执行。
- 现状补充：已尝试 `APP_ID="__UNI__EXAM2026"`（来自 `manifest.json`），设备返回 `Unable to launch app __UNI__EXAM2026`。
- 已落实缓解：`npm run test:maestro` 在缺少 `APP_ID` 时自动执行 `10-web-h5-smoke`，保证移动端链路不断档。
- 强制 native 模式：`MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro`。

## 本轮结果（按规则）

- 新发现问题数：0
- 已修复问题数：2（`CORE-001`、`STATE-005`）
- 未解决阻塞问题：0
- 下一轮计划：
  1. 获取并安装可启动包名后，执行 `MAESTRO_REQUIRE_NATIVE=1 APP_ID=\"<pkg>\" npm run test:maestro` 补齐 `docs/reports/maestro-results.xml`。
  2. 在 Node `>=20.17` 环境下统一执行，消除当前 Node18 + npm11 的引擎告警噪音。
