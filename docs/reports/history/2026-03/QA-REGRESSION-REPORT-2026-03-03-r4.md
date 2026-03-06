# Exam-Master YOLO 回归报告（R4）

## 轮次摘要

- 分支：`test-fix/2026-03-03-r3`
- 模式：YOLO（自动执行：全量回归 -> 扩展高风险用例 -> 批量修复 -> 全量回归）
- 覆盖要求：冒烟 + 核心流程 + 前10高风险页面（本轮高风险页 11 个）

## 阶段B：先跑全量回归（改动前）

### 命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:qa:full-regression
```

### 结果

- Unit：`79 files / 1206 tests` 通过
- E2E：`27 passed / 0 failed / 0 skipped`

结论：基线稳定，可进入“增量高风险检测”阶段。

## 增量检测与新发现

为增强异常流程覆盖，本轮新增：

- `EXC-005 AI接口500时聊天页可降级并保持可交互`
  - 文件：`tests/e2e-regression/specs/02-exception-flow.spec.js`

新增用例首次执行发现 1 个问题。

## 失败项明细

### QA-R4-001（P1）

- 标题：`HumanActions.input` 无法处理 `uni-input` 宿主节点，导致输入步骤失败
- 页面：`/pages/chat/chat`
- 复现步骤：
  1. 执行 `npx playwright test tests/e2e-regression/specs/02-exception-flow.spec.js --config=playwright.regression.config.js`
  2. 进入 `EXC-005`
  3. 在聊天输入框执行 `app.actions.input('.msg-input, input[type="text"]', '接口异常回归测试')`
- 预期结果：输入成功并继续发送消息流程
- 实际结果：报错 `locator.fill: Element is not an <input>...`，测试中断
- 证据：
  - 报错关键信息：`tests/e2e-regression/helpers/human-actions.js:18`
  - 修复后截图：`test-results/e2e-regression/02-exception-flow-A2-异常流程-EXC-005-AI接口500时聊天页可降级并保持可交互/exception-chat-api-500-fallback.png`
  - 修复后网络日志：`test-results/e2e-regression/02-exception-flow-A2-异常流程-EXC-005-AI接口500时聊天页可降级并保持可交互/network-log.json`
- 初步根因：测试基础动作封装未兼容 uni-app H5 的 `uni-input -> input` 嵌套结构
- 根因分类：自动化框架层

## 阶段C：批量修复

### 修复内容

1. 修复输入助手对 `uni-input` 的兼容：
   - 文件：`tests/e2e-regression/helpers/human-actions.js`
   - 改动：`input()` 从“直接 fill 宿主节点”改为“优先定位宿主内层 `input/textarea/contenteditable` 再执行输入”。
2. 同轮补充回归断言用例：
   - 文件：`tests/e2e-regression/specs/02-exception-flow.spec.js`
   - 新增：`EXC-005`，覆盖 API 500 降级回复与页面可交互性。

## 阶段C2：修复后全量回归

### 命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:qa:full-regression
```

### 结果

- Unit：`79 files / 1206 tests` 全通过
- E2E：`28 passed / 0 failed / 0 skipped`

按页面分组（E2E）：

- `00-smoke.spec.js`: 3 pass
- `01-core-flow.spec.js`: 3 pass
- `02-exception-flow.spec.js`: 5 pass
- `03-state-recovery.spec.js`: 4 pass
- `04-performance.spec.js`: 2 pass
- `05-high-risk-pages.spec.js`: 11 pass

## 本轮统计（按你要求）

- 新发现问题数：`1`
- 已修复问题数：`1`
- 未解决阻塞问题：`0`
- 下一轮计划：
  1. 扩展 `EXC-006`（接口超时 + 重试提示链路）
  2. 增加登录页“重复点击防抖”E2E用例并注入慢网
  3. 增加 Maestro 真机脚本覆盖权限弹窗与前后台切换
