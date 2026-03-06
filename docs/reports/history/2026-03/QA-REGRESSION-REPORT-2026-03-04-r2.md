# Exam-Master 全量回归报告（Round r2）

## 1. 执行范围

- 分支：`test-fix/2026-03-04-r2`
- 覆盖要求：冒烟 + 核心流程 + 前10高风险页面 + 异常流程 + 状态恢复 + 兼容性 + 基础性能
- 执行策略：先全量回归，再判定是否需要批量修复

## 2. 执行命令

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run test:e2e:regression
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run test:e2e:compat
export PATH="/opt/homebrew/opt/node@20/bin:$HOME/.maestro/bin:$PATH" && npm run test:maestro
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run test
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run audit:secrets:tracked
```

Native 阻塞复核命令（强制不允许 fallback）：

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$HOME/.maestro/bin:$PATH" && MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro
```

## 3. 回归结果

### 3.1 总体统计

| 套件                   | 通过 | 失败 | 结果 |
| ---------------------- | ---: | ---: | ---- |
| Playwright 回归        |   30 |    0 | ✅   |
| Playwright 兼容回归    |   90 |    0 | ✅   |
| Maestro（H5 fallback） |    1 |    0 | ✅   |
| Vitest（单元+集成）    | 1206 |    0 | ✅   |

### 3.2 严重级别分组（Playwright 回归）

| 严重级别           | 总数 | 通过 | 失败 |
| ------------------ | ---: | ---: | ---: |
| P0（SMOKE+CORE）   |    6 |    6 |    0 |
| P1（EXC+STATE+HR） |   21 |   21 |    0 |
| P2（PERF+HUMAN）   |    3 |    3 |    0 |

### 3.3 页面分组（重点）

- `/pages/chat/chat`：4/4
- `/pages/login/index`：3/3
- `/pages/practice/index`：3/3
- `/pages/school/index`：3/3
- `/pages/tools/doc-convert`：2/2
- `/pages/tools/photo-search`：2/2
- `/pages/tools/id-photo`：2/2

### 3.4 Top 10 阻塞问题

- 业务阻塞：0
- 环境阻塞：1（`ENV-BLOCKER-001`）

## 4. 失败项明细（B2）

本轮业务失败项为 0。

环境阻塞项：`ENV-BLOCKER-001`

- 标题：Native Maestro 无法执行（APP_ID 缺失 + 设备无业务包）
- 复现步骤：
  1. 连接 Android 模拟器
  2. 执行 `MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro`
- 预期结果：执行 `tests/maestro/flows/00~04` 原生流程
- 实际结果：脚本在 preflight 后报 `APP_ID is required when MAESTRO_REQUIRE_NATIVE=1`
- 证据：
  - `docs/reports/maestro-preflight.md`（third-party package count = 0）
  - `docs/reports/maestro-results.xml`（仅 `10-web-h5-smoke`）
- 初步根因：测试环境未安装 Exam-Master 原生包，且未提供有效 `APP_ID`
- 优先级：P2（环境阻塞）

## 5. 连续复发 RCA（满足你的规则）

`ENV-BLOCKER-001` 已连续两轮出现（r1 -> r2），执行 RCA：

1. 为什么 Native 流程没跑？
   - 因为 `APP_ID` 缺失，脚本触发 fallback
2. 为什么 `APP_ID` 缺失？
   - 因为设备中没有可识别业务包
3. 为什么设备没有业务包？
   - 本地没有可安装的 `.apk/.aab` 产物
4. 为什么没有安装产物？
   - 当前回归流程只覆盖 H5/小程序构建与测试，没有 native 安装工序
5. 为什么流程里没有安装工序？
   - 缺少“native 回归前置门禁”（构建/安装/包名注入）

永久修复方案（可落地）：

1. 在 CI 增加 native 产物步骤：输出 Android debug APK 到固定路径（例如 `artifacts/android/exam-master-debug.apk`）
2. 在回归前执行安装门禁：
   - `adb install -r artifacts/android/exam-master-debug.apk`
   - `adb shell pm list packages -3`
3. 从 APK 解析包名后注入 `APP_ID` 再跑 Maestro：
   - `APP_ID="<resolved.package.name>" npm run test:maestro`
4. 若安装失败则直接 fail-fast，不允许回归报告标记“Native 已覆盖”

## 6. C 阶段批量修复结论

- P0/P1 业务失败：0，未触发代码修复
- 修复后回归：不适用（无业务缺陷可修）
- 剩余问题清单：仅环境阻塞 `ENV-BLOCKER-001`

## 7. 交付文件

- 阶段A模型：`docs/reports/QA-PHASE-A-TEST-MODEL-2026-03-04-r1.md`
- 本轮报告：`docs/reports/QA-REGRESSION-REPORT-2026-03-04-r2.md`
- 缺陷CSV：`docs/reports/QA-DEFECTS-2026-03-04-r2.csv`
- Playwright 报告：
  - `docs/reports/e2e-regression-results.json`
  - `docs/reports/e2e-regression-results.xml`
  - `docs/reports/e2e-regression-html/index.html`
- 兼容报告：
  - `docs/reports/e2e-compat-results.json`
  - `docs/reports/e2e-compat-results.xml`
  - `docs/reports/e2e-compat-html/index.html`
- Maestro 证据：
  - `docs/reports/maestro-preflight.md`
  - `docs/reports/maestro-results.xml`
- Vitest：`docs/reports/vitest-results-2026-03-04-r1.json`

## 8. 本轮统计（固定输出）

- 新发现问题数：`0`（业务）
- 已修复问题数：`0`
- 未解决阻塞问题：`1`（环境阻塞）
- 下一轮计划：
  1. 先落地 native APK 构建与安装门禁
  2. 用 `MAESTRO_REQUIRE_NATIVE=1` 执行强制 native 套件
  3. 再执行一次全量回归并更新缺陷趋势
