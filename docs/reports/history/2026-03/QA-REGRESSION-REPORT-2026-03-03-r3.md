# Exam-Master 自动化回归与批量修复报告（R3）

## 轮次信息

- 备份分支：`test-fix/2026-03-03-r3`
- 执行时间：2026-03-03
- 执行策略：先全量回归 -> 统一修复 -> 再全量回归
- 测试范围：冒烟 + 核心流程 + 异常流程 + 状态恢复 + 性能门禁 + 前10高风险页面

## 阶段B：先测后改（基线检测）

### 执行命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:regression
```

### 基线结果（修复前）

- E2E 回归：`26 passed / 0 failed / 1 skipped`
- 跳过项：`CORE-002 登录后进入刷题页并打开做题页`

### 按页面分组（修复前）

- `00-smoke.spec.js`: 3 pass
- `01-core-flow.spec.js`: 2 pass, 1 skip
- `02-exception-flow.spec.js`: 4 pass
- `03-state-recovery.spec.js`: 4 pass
- `04-performance.spec.js`: 2 pass
- `05-high-risk-pages.spec.js`: 11 pass

### 按严重级别分组（修复前）

- P0 失败：0
- P1 失败：0
- 阻塞项（blocked/skip）：1（核心流程覆盖缺口）

### Top 10 阻塞问题

1. `QA-R3-001`：核心流程 `CORE-002` 在未提供真实账号时被 `skip`，导致“登录后关键业务链路”无法稳定覆盖。

## 阶段B2：失败项明细（含复现与证据）

### QA-R3-001（P1）

- 标题：核心流程 `CORE-002` 依赖真实账号导致回归跳过
- 页面：`/pages/login/index` -> `/pages/practice/index` -> `/pages/practice-sub/do-quiz`
- 复现步骤：
  1. 不设置 `E2E_EMAIL` 与 `E2E_PASSWORD`
  2. 执行 `npm run test:e2e:regression`
  3. 观察 `01-core-flow.spec.js` 中 `CORE-002` 被跳过
- 预期结果：即使无真实账号，也应通过模拟会话覆盖“登录后到刷题并进入做题页”的核心链路
- 实际结果：用例被直接 `skip`，核心流程覆盖缺口
- 证据：
  - 回归输出记录：`CORE-002 ... skipped`
  - 修复后验证截图：`test-results/e2e-regression/01-core-flow-A2-核心流程-CORE-002-登录后进入刷题页并打开做题页/core-practice-to-quiz.png`
  - 修复后网络日志：`test-results/e2e-regression/01-core-flow-A2-核心流程-CORE-002-登录后进入刷题页并打开做题页/network-log.json`
- 初步根因定位：测试设计问题（自动化用例对真实账号强依赖）
- 根因分类：自动化测试层（非前端业务缺陷）

## 阶段C：批量修复（先P0/P1）

### 本轮修复内容

1. 修复 `CORE-002` 的账号依赖问题：
   - 文件：`tests/e2e-regression/specs/01-core-flow.spec.js`
   - 方案：保留真实账号路径；无真实账号时切换为 `setLoggedInSession()` 模拟会话，不再跳过。
2. 为修复项补充断言（防回归）：
   - 新增/加强断言：从刷题页进入做题页后，校验 `题库空空如也/确认退出/继续答题/练习完成` 等关键文本。

## 阶段C2：修复后全量回归

### 执行命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:qa:full-regression
```

### 回归结果（修复后）

- Unit：`79 files / 1206 tests` 全部通过
- E2E：`27 passed / 0 failed / 0 skipped`
- 核心链路重跑结果：`CORE-001/CORE-002/CORE-003` 全通过
- 高风险页面：`11/11` 全通过

## 剩余问题清单

- P0：0
- P1：0
- 阻塞问题：0

## 本轮统计（按你要求）

- 新发现问题数：1
- 已修复问题数：1
- 未解决阻塞问题：0
- 下一轮计划：
  1. 接入真实测试账号池（脱敏管理）执行“真实登录链路”夜间回归
  2. 增加 API 500 注入与重试行为校验（异常流程进一步强化）
  3. 增加移动端真机自动化（Maestro）覆盖系统权限弹窗与前后台切换

## 产物路径

- 本报告：`docs/reports/QA-REGRESSION-REPORT-2026-03-03-r3.md`
- E2E HTML 报告：`docs/reports/e2e-regression-html/index.html`
- E2E JSON 报告：`docs/reports/e2e-regression-results.json`
- E2E JUnit 报告：`docs/reports/e2e-regression-results.xml`
- 失败/截图/网络日志目录：`test-results/e2e-regression/`
