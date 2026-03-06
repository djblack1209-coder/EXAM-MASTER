# Exam-Master 全量回归报告（Round r4）

## 本轮目标

- 在修复截图问题基础上继续推进：落地 Native Maestro 前置门禁自动化，减少环境阻塞的人肉操作。
- 按规则执行“先全量回归，再统一汇总”。

## 本轮代码变更

1. Native 门禁自动化
   - `scripts/test/run-maestro-suite.sh`
   - 新增能力：
     - 支持 `ANDROID_APK_PATH` / `MAESTRO_ANDROID_APK_PATH`
     - 自动从 APK 解析包名（`apkanalyzer`/`aapt`）
     - 自动尝试 `adb install -r`（可由 `MAESTRO_AUTO_INSTALL_APK=0`关闭）
     - `MAESTRO_REQUIRE_NATIVE=1` 下若包未安装直接 fail-fast
2. 脚本入口
   - `package.json` 新增 `test:maestro:native`
3. 文档更新
   - `tests/maestro/README.md` 增加 APK 自动安装与 native 严格模式用法
4. 主包门禁补强
   - `scripts/build/check-mp-main-package-usage.mjs` 增加 `utils/analytics/learning-analytics.js` 检查项

## 可执行命令

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run audit:mp-main-usage
export PATH="/opt/homebrew/opt/node@20/bin:$HOME/.maestro/bin:$PATH" && npm run test:qa:full-regression
export PATH="/opt/homebrew/opt/node@20/bin:$HOME/.maestro/bin:$PATH" && MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro
```

原生自动安装执行示例：

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$HOME/.maestro/bin:$PATH" && ANDROID_APK_PATH="artifacts/android/app-debug.apk" MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro
```

## 结果汇总

- `audit:mp-main-usage`：通过（主包引用检查通过）
- `test:e2e:regression`：30 passed / 0 failed
- `test:e2e:compat`：90 passed / 0 failed
- `vitest`：1206 passed / 0 failed（`docs/reports/vitest-results-2026-03-04-r4.json`）
- `maestro`：1 passed（H5 fallback；native 未实际执行）
- `audit:secrets:tracked`：通过

### 按严重级别分组（Playwright 回归）

- P0：6/6 通过，0 失败
- P1：21/21 通过，0 失败
- P2：3/3 通过，0 失败

### 按页面分组（Playwright 回归）

- `/pages/chat/chat`：4/4
- `/pages/index/index`：3/3
- `/pages/practice/index`：3/3
- `/pages/school/index`：3/3
- `/pages/login/index`：3/3
- 其余高风险页面：全部通过

### Top 10 阻塞问题

- 业务阻塞：0
- 环境阻塞：1（`ENV-BLOCKER-001`）

## 缺陷/问题闭环

### OPS-001（已修复）

- 标题：Native 回归缺少自动安装与 APP_ID 自动解析门禁
- 复现步骤：
  1. 执行 `MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro`
  2. 环境无 APP_ID、无已安装业务包
- 预期：给出可执行的自动化安装路径，而不是仅失败
- 实际（修复前）：仅提示 APP_ID 缺失
- 根因：run-maestro-suite 缺少 APK 安装链路与包名解析链路
- 修复后：支持 `ANDROID_APK_PATH` 自动解析+安装，且 native 严格门禁可 fail-fast

### ENV-BLOCKER-001（仍阻塞）

- 标题：当前设备无业务包，且本地无可用 APK 产物
- 证据：`docs/reports/maestro-preflight.md`（third-party package count = 0）
- 影响：Native 00~04 flow 仍无法在本机本轮执行
- 当前状态：Blocked（已提供自动化安装入口，待接入 APK 产物）

## 本轮统计（固定输出）

- 新发现问题数：`1`（OPS 流程问题）
- 已修复问题数：`1`
- 未解决阻塞问题：`1`（ENV-BLOCKER-001）
- 下一轮计划：
  1. 接入 Android debug APK 产物路径（CI artifact 或本地构建输出）
  2. 用 `ANDROID_APK_PATH=... MAESTRO_REQUIRE_NATIVE=1 npm run test:maestro` 跑原生套件
  3. 原生通过后再次执行 `npm run test:qa:full-regression` 并更新趋势报告
