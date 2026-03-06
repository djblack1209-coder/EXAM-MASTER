# QA toB 交付回归报告（2026-03-05 r1）

## 执行结论

- 本次全链路门禁执行通过，满足当前 toB 交付回归基线。
- Maestro 在无 Android 设备/模拟器场景下按策略产出 `skipped` 报告，不阻塞其余质量门禁。

## 执行环境

- 执行命令：`bash scripts/test/run-full-regression-gate.sh`
- Node 版本策略：`fnm` 固定 `20.17.0`
- Playwright 浏览器：执行前自动确保 `chromium` 可用

## 门禁结果

| 检查项                 | 结果                             |
| ---------------------- | -------------------------------- |
| Unit（Vitest）         | 79 files / 1206 passed           |
| Visual（Playwright）   | 24 passed                        |
| E2E Regression         | 30 passed                        |
| E2E Compat             | 90 passed                        |
| Maestro                | skipped（无设备）                |
| Secret Audit           | no tracked secret patterns found |
| MiniProgram E2E Report | 13 passed                        |

## 产物清单

- `test-results/e2e/jest-results.json`
- `test-results/e2e/junit.xml`
- `docs/reports/maestro-results.xml`
- `docs/reports/maestro-web-smoke.xml`
- `docs/reports/maestro-preflight.md`
- `docs/reports/e2e-regression-results.json`
- `docs/reports/e2e-regression-results.xml`
- `docs/reports/e2e-compat-results.json`
- `docs/reports/e2e-compat-results.xml`

## 说明

- 若需将 Maestro 作为强制失败门禁，可设置：`MAESTRO_REQUIRE_DEVICE=1`。
- 若需强制 Native 流程（缺少 APP_ID 直接失败），可设置：`MAESTRO_REQUIRE_NATIVE=1`。
