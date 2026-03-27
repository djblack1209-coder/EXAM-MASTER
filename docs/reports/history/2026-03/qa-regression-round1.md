# Exam-Master QA 回归报告（2026-03-15 round1）

## 结论
- 结论：H5 自动化回归通过；Android Maestro 自动化回归未达标（驱动安装拦截 + App 前台可视性不稳定）。
- 说明：本轮重点完成 H5/单测/视觉回归与 Android 真机自动化试跑；Android 端仍需解除系统拦截并稳定前台可视性后再跑全量。

## 执行环境
- Node 版本：v20.17.0
- Playwright 版本：1.58.2
- 执行分支：test-fix/2026-03-15-round1
- 设备：Android 真机（ADB 已连接）
- 执行时间：2026-03-15

## 执行结果汇总

| 测试类型 | 总数 | 通过 | 失败 | 跳过 | 退出码/备注 |
|----------|------|------|------|------|-------------|
| ESLint | - | - | - | - | 通过（ESLINT_EXIT=0） |
| Prettier | - | - | - | - | 已执行写入格式化 |
| H5 构建 | - | - | - | - | 通过 |
| 单元测试 (Vitest) | 1241 | 1241 | 0 | 0 | /tmp/exam-vitest-results-round1.json |
| E2E 回归 (Playwright) | 88 | 88 | 0 | 0 | docs/reports/e2e-regression-results.json |
| E2E 兼容性 | 198 | 195 | 0 | 3 | docs/reports/e2e-compat-results.json |
| 视觉回归 | 41 | 41 | 0 | 0 | tests/visual |
| Android Maestro | 6 | 1 | 5 | 0 | 详见缺陷清单 |

## 修复前 vs 修复后对比

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 视觉回归失败数 | 2 | 0 |
| Maestro 流程失败数 | 6 | 5 |

## 本轮修复清单
- Splash 视觉快照漂移：`src/pages/splash/index.vue`
- 视觉快照路由固定：`tests/visual/full-feature-pages.spec.js`
- 视觉快照等待挂载：`tests/visual/ui-pages.spec.js`
- Maestro 选择器与稳定性修复：
  - `tests/maestro/flows/01-login-input.yaml`
  - `tests/maestro/flows/02-core-practice.yaml`
  - `tests/maestro/flows/03-high-risk-tools.yaml`
  - `tests/maestro/flows/04-state-recovery.yaml`
  - `tests/maestro/flows/00-smoke.yaml`
  - `tests/maestro/flows/10-web-h5-smoke.yaml`

## 剩余问题
- Android Maestro 驱动安装被系统拦截（INSTALL_FAILED_USER_RESTRICTED）
- Android App 启动后前台可视性不稳定，UI 树中“首页”不可见，导致 00/01/02/03/04 流程失败

## 本轮统计
- 新发现问题数：2
- 已修复问题数：2
- 未解决阻塞问题：2
- 下一轮计划：
  1) 解除系统对 Maestro Driver 安装的拦截（一次性允许或改用 Maestro Cloud）
  2) 为 App 关键元素增加可访问性文本（确保 Maestro 可读取“首页/刷题/择校/我的”）
  3) 重跑 Android Maestro 全量流程

## 产物路径
- 单元测试结果：`/tmp/exam-vitest-results-round1.json`
- E2E 回归结果：`docs/reports/e2e-regression-results.json`
- 兼容性结果：`docs/reports/e2e-compat-results.json`
- 视觉回归快照：`tests/visual`
- Maestro 失败截图：`/Users/blackdj/.maestro/tests/2026-03-15_162410`（以及同目录时间戳文件夹）
