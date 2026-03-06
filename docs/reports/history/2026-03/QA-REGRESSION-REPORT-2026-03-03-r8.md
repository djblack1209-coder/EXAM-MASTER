# Exam-Master 自动化回归报告（Round r8）

## 执行信息

- 执行分支：`test-fix/2026-03-03-r8`
- 本轮目标：继续全量回归，并补充跨分辨率兼容性自动化
- 测试策略：`Vitest + Playwright(标准回归 + 兼容回归)`

## 本轮新增自动化能力

- 新增兼容回归配置：`playwright.regression.compat.config.js`
- 新增命令：
  - `npm run test:e2e:compat`
  - `npm run test:e2e:compat:headed`
- 兼容矩阵：
  - `mobile-390x844`
  - `mobile-375x667`
  - `desktop-1440x900`

## 执行命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm test
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:compat
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:regression
eval "$(fnm env)" && fnm use 20.17.0 && npx vitest run --reporter=json --outputFile=docs/reports/vitest-results-r8.json
```

成功判定标准：

- 单元回归失败数 = 0
- 标准 E2E 失败数 = 0
- 兼容 E2E 失败数 = 0
- 报告产物完整生成

实际结果：通过。

---

## 全量结果汇总

- Vitest：`1206 passed / 0 failed / 0 skipped`
- E2E 标准回归：`30 passed / 0 failed / 0 skipped`
- E2E 兼容回归：`90 passed / 0 failed / 0 skipped`
- 总计：`1326 passed / 0 failed`

## 覆盖确认（符合你的单轮要求）

- 冒烟：覆盖并通过
- 核心流程：覆盖并通过
- 前10高风险页面：覆盖 11 页并通过
- 异常流程（空输入/500/断网/弱网）：覆盖并通过
- 状态恢复（返回/多击/后台恢复/刷新会话）：覆盖并通过
- 人工手势模拟（滑动）：覆盖并通过

## 按页面分组失败（高风险页）

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

## 按严重级别分组失败

- P0：0
- P1：0
- P2：0

## Top 10 阻塞问题

本轮无阻塞缺陷。

---

## 性能观察（通过项中耗时较高）

兼容回归中稳定偏慢的用例（全部通过，非缺陷）：

- `CORE-002`（登录后进入刷题并打开做题页）：约 22s
- `EXC-004`（弱网场景页面响应）：约 13s
- `EXC-002`（文档转换未选文件拦截）：约 11s

说明：与弱网模拟及页面初始化等待策略相关，目前在阈值内。

---

## 失败项明细（复现步骤/预期/实际/证据/根因）

本轮无失败项，无需失败明细条目。

---

## 交付产物

- 回归报告：`docs/reports/QA-REGRESSION-REPORT-2026-03-03-r8.md`
- 缺陷清单：`docs/reports/QA-DEFECTS-2026-03-03-r8.csv`
- 单元 JSON：`docs/reports/vitest-results-r8.json`
- 标准 E2E：
  - `docs/reports/e2e-regression-results.json`
  - `docs/reports/e2e-regression-results.xml`
  - `docs/reports/e2e-regression-html/index.html`
- 兼容 E2E：
  - `docs/reports/e2e-compat-results.json`
  - `docs/reports/e2e-compat-results.xml`
  - `docs/reports/e2e-compat-html/index.html`

## 本轮结果（按你的规则）

- 新发现问题数：0
- 已修复问题数：0
- 未解决阻塞问题：0
- 下一轮计划：
  1. 增加移动端真机自动化（Maestro/Appium）并接入同一报告口径
  2. 增加长时间稳定性回归（连续后台恢复 + 断网恢复循环）
  3. 将 `test:e2e:compat` 接入 CI 夜间任务，统计 7 天趋势
