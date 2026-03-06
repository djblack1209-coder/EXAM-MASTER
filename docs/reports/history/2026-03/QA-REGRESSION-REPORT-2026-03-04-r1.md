# Exam-Master 全量回归报告（Round r1）

## 1) 执行范围与环境

- 执行分支：`test-fix/2026-03-04-r1`
- 执行阶段：B（先测后改）+ C（批量修复判定）
- Node 版本：`v20.20.0`（通过 Homebrew 安装 `node@20`）
- npm 版本：`10.8.2`

## 2) 执行命令（可直接复制）

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && node -v && npm -v
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm ci
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npx playwright install chromium
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run test:e2e:regression
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run test:e2e:compat
export PATH="/opt/homebrew/opt/node@20/bin:$HOME/.maestro/bin:$PATH" && npm run test:maestro
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run test
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && npm run audit:secrets:tracked
```

成功判定标准：

- `test:e2e:regression` 输出 `30 passed`
- `test:e2e:compat` 输出 `90 passed`
- `test:maestro` 生成 `docs/reports/maestro-results.xml`
- `npm run test` 输出 `79 passed` 文件、`1206 passed` 用例
- 密钥审计输出 `no tracked secret patterns found`

## 3) B1 全量测试结果

### 3.1 总体通过/失败

| 套件                           | 通过 | 失败 | 跳过 | 结果 |
| ------------------------------ | ---: | ---: | ---: | ---- |
| Playwright 回归（移动基线）    |   30 |    0 |    0 | ✅   |
| Playwright 兼容回归（3分辨率） |   90 |    0 |    0 | ✅   |
| Maestro（Android H5 fallback） |    1 |    0 |    0 | ✅   |
| Vitest（单测/集成）            | 1206 |    0 |    0 | ✅   |

### 3.2 按页面分组（Playwright 回归 30 条）

| 页面                                             | 用例数 | 通过 | 失败 |
| ------------------------------------------------ | -----: | ---: | ---: |
| `/pages/chat/chat`                               |      4 |    4 |    0 |
| `/pages/index/index`                             |      3 |    3 |    0 |
| `/pages/login/index`                             |      3 |    3 |    0 |
| `/pages/practice/index`                          |      3 |    3 |    0 |
| `/pages/school/index`                            |      3 |    3 |    0 |
| `/pages/practice-sub/do-quiz`                    |      2 |    2 |    0 |
| `/pages/tools/doc-convert`                       |      2 |    2 |    0 |
| `/pages/tools/id-photo`                          |      2 |    2 |    0 |
| `/pages/tools/photo-search`                      |      2 |    2 |    0 |
| 其余页面（plan/import/mock/pk/profile/settings） |      6 |    6 |    0 |

### 3.3 按严重级别分组（Playwright 回归 30 条）

分级规则：`SMOKE/CORE=P0`，`EXC/STATE/HR=P1`，`PERF/HUMAN=P2`。

| 严重级别 | 总数 | 通过 | 失败 |
| -------- | ---: | ---: | ---: |
| P0       |    6 |    6 |    0 |
| P1       |   21 |   21 |    0 |
| P2       |    3 |    3 |    0 |

### 3.4 Top 10 阻塞问题

本轮无业务阻塞缺陷（Top 10 = 0）。

唯一环境阻塞项（不属于业务缺陷）：

- `ENV-BLOCKER-001`：模拟器未安装 Exam-Master Native 包，`npm run test:maestro` 自动降级为 H5 Flow（`10-web-h5-smoke`）。

## 4) B2 失败项详情（复现/证据/根因）

本轮业务失败项为 0，故无 P0/P1/P2 业务缺陷条目。

环境阻塞证据：

- 预检报告：`docs/reports/maestro-preflight.md`
- Maestro 结果：`docs/reports/maestro-results.xml`

## 5) C 批量修复与回归结论

### C1 修复执行

- P0 失败：0（无需修复）
- P1 失败：0（无需修复）
- 本轮未改动业务代码，故无新增修复提交

### C2 修复后全量回归

- 因无业务失败，本轮“先测后改”后直接判定通过
- 核心链路（登录/刷题/择校）与高风险页面已全量重跑并全部通过

## 6) 本轮产物

- 阶段A建模：`docs/reports/QA-PHASE-A-TEST-MODEL-2026-03-04-r1.md`
- 回归结果（Playwright）：
  - `docs/reports/e2e-regression-results.json`
  - `docs/reports/e2e-regression-results.xml`
  - `docs/reports/e2e-regression-html/index.html`
- 兼容回归结果：
  - `docs/reports/e2e-compat-results.json`
  - `docs/reports/e2e-compat-results.xml`
  - `docs/reports/e2e-compat-html/index.html`
- Maestro：
  - `docs/reports/maestro-preflight.md`
  - `docs/reports/maestro-results.xml`
- Vitest：`docs/reports/vitest-results-2026-03-04-r1.json`
- 缺陷CSV：`docs/reports/QA-DEFECTS-2026-03-04-r1.csv`

## 7) 本轮统计（按你要求）

- 新发现问题数：`0`（业务缺陷）
- 已修复问题数：`0`
- 未解决阻塞问题：`1`（环境阻塞：Native APP_ID/安装包缺失）
- 下一轮计划：
  1. 在模拟器安装 Exam-Master 包并设置 `APP_ID`，执行 Native Maestro 5 条主流程。
  2. 将 `npm run test:qa:full-regression` 接入定时 CI，按天产出趋势报告。
  3. 引入真实账号凭证后重跑 `CORE-002` 真登录路径，补齐外部依赖稳定性监控。
