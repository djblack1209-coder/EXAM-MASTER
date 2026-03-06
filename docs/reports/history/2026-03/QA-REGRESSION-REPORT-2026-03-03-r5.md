# Exam-Master YOLO 回归报告（R5）

## 轮次概览

- 分支：`test-fix/2026-03-03-r5`
- 策略：全量回归 -> 增量高风险检测 -> 批量修复 -> 全量回归
- 覆盖：冒烟 + 核心流程 + 异常流程 + 状态恢复 + 性能 + 高风险页面（11页）

## 阶段B：基线与增量检测

### 基线（承接上一轮）

- E2E 基线：`28 passed / 0 failed / 0 skipped`
- Unit 基线：`1206 passed`

### 本轮新增检测项

1. `STATE-005 登录按钮快速多次点击仅触发一次请求`
   - 文件：`tests/e2e-regression/specs/03-state-recovery.spec.js`
2. `EXC-005 AI接口500时聊天页可降级并保持可交互`
   - 文件：`tests/e2e-regression/specs/02-exception-flow.spec.js`

### 首次执行结果（增量阶段）

- `03-state-recovery.spec.js`：`4 passed / 1 failed`
- 失败点：`STATE-005`

## 阶段B2：失败项详情

### QA-R5-001（P1）

- 标题：登录页输入定位策略不稳定，导致幂等用例失败
- 页面：`/pages/login/index`
- 复现步骤：
  1. 运行：`npx playwright test tests/e2e-regression/specs/03-state-recovery.spec.js --config=playwright.regression.config.js`
  2. 执行 `STATE-005`
  3. 在输入邮箱步骤出现 `locator.click timeout`（选择器 `input[placeholder="请输入邮箱地址"]` 未命中）
- 预期结果：可稳定定位输入框并继续验证“重复点击只触发一次请求”
- 实际结果：输入框定位失败，用例中断
- 证据：
  - 报错位置：`tests/e2e-regression/helpers/human-actions.js:17`
  - 修复后截图：`test-results/e2e-regression/03-state-recovery-A2-状态恢复与幂等-STATE-005-登录按钮快速多次点击仅触发一次请求/state-login-debounce.png`
  - 修复后日志：`test-results/e2e-regression/03-state-recovery-A2-状态恢复与幂等-STATE-005-登录按钮快速多次点击仅触发一次请求/network-log.json`
- 初步根因：uni-app H5 下输入组件渲染层级与原始 placeholder 选择器存在不一致，导致定位脆弱
- 根因分类：自动化测试层

## 连续复发问题 RCA（跨 R4/R5）

- 复发现象：连续两轮均出现“输入控件定位不稳定”导致用例失败。
- 根因分析：
  1. uni-app H5 渲染为宿主节点（如 `uni-input`），真实可编辑节点在子层。
  2. 依赖 placeholder 或单一 CSS 选择器在不同页面结构下不稳定。
  3. 旧输入动作对“宿主-内层输入”结构兼容不足。
- 永久修复方案：
  1. 统一输入策略为“宿主定位 + 内层可编辑节点输入”（`input/textarea/contenteditable`）。
  2. 用例侧禁止新增 placeholder-only 定位，优先使用结构化宿主定位。
  3. 将该策略固化到 `HumanActions.input`，作为回归默认入口。

## 阶段C：批量修复

### 修复内容

1. 调整 `STATE-005` 输入定位方案：
   - 从 placeholder 精确定位改为 `.email-form .form-input` 宿主 + 内层可编辑元素定位
   - 文件：`tests/e2e-regression/specs/03-state-recovery.spec.js`
2. 保持输入动作兼容：
   - 复用上一轮升级后的 `human-actions.input`（支持宿主内层 input/textarea）
   - 文件：`tests/e2e-regression/helpers/human-actions.js`
3. 新增并保留异常降级用例：
   - 文件：`tests/e2e-regression/specs/02-exception-flow.spec.js`

## 阶段C2：修复后全量回归

### 执行命令

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:qa:full-regression
```

### 结果

- Unit：`79 files / 1206 tests` 全通过
- E2E：`29 passed / 0 failed / 0 skipped`

E2E 按模块分组：

- `00-smoke.spec.js`: 3 pass
- `01-core-flow.spec.js`: 3 pass
- `02-exception-flow.spec.js`: 5 pass
- `03-state-recovery.spec.js`: 5 pass
- `04-performance.spec.js`: 2 pass
- `05-high-risk-pages.spec.js`: 11 pass

关键校验证据：

- `STATE-005` 登录请求计数：`1`
  - 日志路径：`test-results/e2e-regression/03-state-recovery-A2-状态恢复与幂等-STATE-005-登录按钮快速多次点击仅触发一次请求/network-log.json`
- `EXC-005` 注入 500 响应：
  - 日志路径：`test-results/e2e-regression/02-exception-flow-A2-异常流程-EXC-005-AI接口500时聊天页可降级并保持可交互/network-log.json`

## 本轮统计（按规则）

- 新发现问题数：`1`
- 已修复问题数：`1`
- 未解决阻塞问题：`0`
- 下一轮计划：
  1. 增加 `EXC-006`：接口超时 + 前端提示 + 手动重试链路
  2. 增加 `STATE-006`：切换账号后缓存隔离验证（跨用户数据污染防回归）
  3. 增加 Maestro 脚本覆盖系统权限弹窗与前后台切换
