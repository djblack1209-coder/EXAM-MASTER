# Exam-Master 全流程自动化回归报告（2026-03-03，Round-4）

## 1. 执行范围

- 执行分支：`test-fix/2026-03-03-r1`
- 阶段A（测试建模）：已完成
- 阶段B（先测后改）：已完成
- 阶段C（批量修复 + 全量回归）：已完成第 2 轮（含 P0 修复与回归）
- 阶段D（交付物）：本报告 + 缺陷 CSV + 自动化脚本命令 + 证据路径

## 2. 执行命令

```bash
npm run test:e2e:regression
npm test
npm run test:qa:full-regression
```

说明：当前环境 Node 为 `18.20.8`，项目 engines 期望 `>=20.17.0`，执行过程持续告警但不影响本轮结果判定。

## 3. 多轮回归结果总览

### Round-1（基线，先测后改）

- 总数 23，通过 3，失败 19，跳过 1
- 结论：大面积级联失败，收敛出 1 个底层 P0（H5 runtime 空白）

### Round-2（测试体系层收敛）

- 总数 23，通过 0，失败 1，跳过 22
- 结论：通过 runtime gate 消除噪音，保留真实阻塞 `SMOKE-001`

### Round-3（P0 修复后首轮回归）

- 总数 23，通过 18，失败 4，跳过 1
- 结论：H5 空白已解除，剩余失败集中在 E2E 用例断言和弱网模拟稳定性

### Round-4（本轮最终）

- 总数 23，通过 22，失败 0，跳过 1
- 跳过项：`CORE-002`（未配置真实账号 `E2E_EMAIL/E2E_PASSWORD`）
- 结论：P0 已关闭，核心路径与高风险页已恢复自动回归能力

证据：

- JSON 报告：`docs/reports/e2e-regression-results.json`
- JUnit 报告：`docs/reports/e2e-regression-results.xml`
- HTML 报告：`docs/reports/e2e-regression-html/index.html`
- 运行产物：`test-results/e2e-regression/`

## 4. P0 根因与修复映射

### DEF-001（P0）H5 runtime 空白（已修复）

- 复现（修复前）：
  1. 打开 H5 首页
  2. `#app` 存在但无业务渲染内容
  3. `window.uni` 不可用，页面空白
- 预期：首页渲染 tab 与核心文案，可交互
- 实际（修复前）：空白页面，绝大多数 E2E blocked
- 证据（修复前）：
  - `test-results/e2e-regression/00-smoke-A2-冒烟测试-SMOKE-001-应用启动并显示首页结构/trace.zip`
  - `test-results/e2e-regression/00-smoke-A2-冒烟测试-SMOKE-001-应用启动并显示首页结构/network-log.json`
- 根因：
  - `package.json` 未显式声明 `@dcloudio/uni-h5`，导致 H5 相关 uni 插件链未完整注册。
  - `index.html` 入口指向 `/main.js`，绕过 `uni:h5-main-js` 对 `/src/main.js` 的注入改写，未执行 `pages-json` 注入与 uni plugin 挂载。
- 修复：
  - 新增 `@dcloudio/uni-h5` 依赖。
  - 入口改为 `/src/main.js`。
  - 回归至 uni 官方 H5 装配链路（由插件注入 `pages-json` 与 `__plugin` 挂载）。
- 修复后验证：`SMOKE-001` 通过；Round-4 E2E 无失败。

## 5. 本轮批量修复内容（阶段C）

1. H5 runtime 装配修复（P0）
   - `index.html`：入口改为 `/src/main.js`
   - `package.json`：补充 `@dcloudio/uni-h5`
   - `main.js`：移除试验性 `setupApp` 直连写法，保留 uni 标准入口导出模式
   - `vite.config.js`：移除试验性 `vue` alias（由 uni-h5 插件链接管）

2. E2E 用例批量修复（P1）
   - `CORE-001`：登录页先点击“邮箱登录/注册”再输入
   - `EXC-004/STATE-003/RISK-chat`：关键字断言与真实 UI 对齐（`研聪`/`和AI好友聊聊`/`清华学霸`）
   - 弱网模拟稳定性：`human-actions.js` 中路由延迟改为 `setTimeout`，避免测试结束竞态异常

3. 全量回归
   - E2E：22 passed / 0 failed / 1 skipped
   - Unit/Integration：79 files / 1206 tests 全通过

## 6. 当前残留项

1. `CORE-002` 被跳过（数据前置缺失）
   - 需配置 `E2E_EMAIL`、`E2E_PASSWORD` 才能跑真实登录闭环
   - 当前状态：`Blocked(TestData)`

2. 环境告警
   - Node 版本低于 engines 要求（`18.20.8 < 20.17.0`）
   - 当前状态：`Open`

## 7. 交付物清单（阶段D）

- 回归报告：`docs/reports/QA-REGRESSION-REPORT-2026-03-03.md`
- 缺陷清单：`docs/reports/QA-DEFECTS-2026-03-03.csv`
- Playwright 配置：`playwright.regression.config.js`
- 自动化脚本：`tests/e2e-regression/**`
- 回归结果：
  - `docs/reports/e2e-regression-results.json`
  - `docs/reports/e2e-regression-results.xml`
  - `docs/reports/e2e-regression-html/index.html`

## 8. Commit 列表

- 本轮尚未创建 commit（按要求仅在用户明确要求时提交）

## 9. 下一轮建议

1. 补齐真实 E2E 账号环境变量，解锁 `CORE-002` 全链路登录验证。
2. 将 Node 升级到 `>=20.17.0`，消除 engines 风险与工具链漂移。
3. 将“入口必须为 `/src/main.js`”加入项目约束与 CI 检查，防止 runtime 回归。
