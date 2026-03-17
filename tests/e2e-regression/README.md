# E2E Regression Skeleton (Phase A)

## 目录结构

```text
tests/e2e-regression/
├── data/
│   └── test-data.js                 # 测试账号/输入数据/性能阈值
├── fixtures/
│   └── regression.fixture.js        # 公共 fixture + 失败截图 + 网络日志
├── helpers/
│   ├── assertions.js                # 通用断言
│   ├── human-actions.js             # 点击/输入/滑动/返回/后台恢复/弱网
│   └── network-logger.js            # 请求日志抓取与挂载
└── specs/
    ├── 00-smoke.spec.js             # 冒烟测试
    ├── 01-core-flow.spec.js         # 核心链路
    ├── 02-exception-flow.spec.js    # 异常流程
    ├── 03-state-recovery.spec.js    # 状态恢复/防重复提交
    ├── 04-performance.spec.js       # 首屏/交互性能
    ├── 05-high-risk-pages.spec.js   # 高风险页面回归
    └── 06-human-gesture.spec.js     # 手势滑动模拟
```

## 运行前准备

```bash
bash scripts/test/setup-qa-macos.sh
```

如需手动执行：

```bash
brew install node@20 openjdk android-platform-tools
export PATH="$(brew --prefix node@20)/bin:$(brew --prefix openjdk)/bin:$HOME/.maestro/bin:$PATH"
export JAVA_HOME="$(brew --prefix openjdk)"
npm ci
npx playwright install chromium
```

## 运行命令

```bash
# 全量回归
npm run test:e2e:regression

# 跨分辨率兼容回归（移动 + 桌面）
npm run test:e2e:compat

# 一键全链路门禁（自动使用 Node 20.17.0，含 lint/format/build/audit + visual/maestro/e2e-report）
npm run test:qa:full-regression:clean

# UI 模式
npm run test:e2e:regression:ui

# 有头模式（便于观察“人工点击”）
npm run test:e2e:regression:headed

# 兼容回归有头模式
npm run test:e2e:compat:headed

# 调试单测
npx playwright test tests/e2e-regression/specs/00-smoke.spec.js --config=playwright.regression.config.js --debug

# Maestro 流程语法校验（移动端自动化骨架）
npm run test:maestro:syntax

# Maestro 真机/模拟器回归（需 APP_ID + 已连接设备）
APP_ID="com.exam.master" npm run test:maestro
```

## 输出产物

- HTML 报告：`docs/reports/e2e-regression-html/index.html`
- JSON 报告：`docs/reports/e2e-regression-results.json`
- JUnit 报告：`docs/reports/e2e-regression-results.xml`
- 兼容回归报告：`docs/reports/e2e-compat-html/index.html`
- 失败截图/视频/trace：`test-results/e2e-regression/`
- 每个用例网络日志：`test-results/e2e-regression/**/network-log.json`

## 成功判定标准

- 冒烟与核心链路用例通过率 >= 95%
- P0 用例 0 失败
- 首屏与交互性能满足 `tests/e2e-regression/data/test-data.js` 阈值

## 运行时阻塞门禁

- `SMOKE-001` 为 H5 runtime 门禁：若 `hasUni=false` 且 `textLen=0`，判定运行时未就绪并保留为 `P0` 失败。
- 其余用例在运行时未就绪时会 `skip(blocked)`，避免级联误报。
