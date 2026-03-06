# Exam-Master 自动化回归报告（Round r7）

## 执行信息

- 执行分支：`test-fix/2026-03-03-r7`
- 执行时间：2026-03-03
- 目标：阶段B 自动执行检测（先测后改）
- 测试策略：`Vitest(单元/集成) + Playwright(H5人工行为模拟)`

## 环境准备

执行命令：

```bash
eval "$(fnm env)" && fnm install 20.17.0 && fnm use 20.17.0 && node -v && npm -v
eval "$(fnm env)" && fnm use 20.17.0 && npm ci
```

成功判定标准：

- `node -v` 输出 `v20.17.0`
- 依赖安装成功，无安装中断

实际结果：通过。

补充风险（非阻塞）：

- `npm ci` 存在 `EBADENGINE` 警告（`vite@7.3.1`、`@vitejs/plugin-vue@6.0.4` 要求 Node `>=20.19.0`），当前 `v20.17.0` 仍可运行并通过全部测试，但建议在 CI 固定 `>=20.19.0`。

---

## B1 全量测试结果

### B1.1 执行命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm test
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:regression
eval "$(fnm env)" && fnm use 20.17.0 && npx vitest run --reporter=json --outputFile=docs/reports/vitest-results-r7.json
```

成功判定标准：

- 单元回归：`numFailedTests = 0`
- E2E 回归：`failed = 0`
- 产物完整：HTML/JSON/XML 报告可访问

实际结果：通过。

### B1.2 汇总统计

- 单元/集成回归（Vitest）：`1206 passed / 0 failed / 0 skipped`
- E2E 全量回归（Playwright）：`30 passed / 0 failed / 0 skipped`
- 总计：`1236 passed / 0 failed`

报告产物：

- `docs/reports/vitest-results-r7.json`
- `docs/reports/e2e-regression-results.json`
- `docs/reports/e2e-regression-results.xml`
- `docs/reports/e2e-regression-html/index.html`

### B1.3 按页面分组失败（E2E）

- `/pages/login/index`：0
- `/pages/school/index`：0
- `/pages/practice-sub/import-data`：0
- `/pages/practice-sub/do-quiz`：0
- `/pages/practice-sub/pk-battle`：0
- `/pages/practice-sub/mock-exam`：0
- `/pages/tools/doc-convert`：0
- `/pages/tools/photo-search`：0
- `/pages/tools/id-photo`：0
- `/pages/settings/index`：0
- `/pages/chat/chat`：0

### B1.4 按严重级别分组失败

- P0：0
- P1：0
- P2：0

### B1.5 Top 10 阻塞问题

本轮无阻塞缺陷（Top 10 = 空）。

---

## B2 失败项明细（复现步骤/预期/实际/证据/根因）

本轮无失败项，故无缺陷复现条目。

说明：失败截图与失败网络日志在本轮未生成（全部通过）。

---

## 覆盖确认（满足“单轮至少覆盖”）

- 冒烟：3 条（全部通过）
- 核心流程：3 条（全部通过）
- 异常流程：5 条（全部通过）
- 状态恢复：5 条（全部通过）
- 高风险页面：11 页（全部通过）
- 手势模拟（滑动）：1 条（通过）

## 本轮结果（按你的规则输出）

- 新发现问题数：0
- 已修复问题数：0
- 未解决阻塞问题：0
- 下一轮计划：
  1. 进入阶段C时无 P0/P1 待修复项，可直接保持基线并执行稳定性补充（长时运行 + 网络抖动压测）
  2. 补充移动端真机自动化（Maestro/Appium）与 H5 Playwright 结果对齐
  3. 开启连续回归（每日定时）并监控同问题复发率（触发 RCA 门槛）
