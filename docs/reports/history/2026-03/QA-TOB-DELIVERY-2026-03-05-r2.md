# QA toB 交付回归报告（2026-03-05 r2）

## 执行结论

- 交付级全链路门禁已通过，当前版本满足 toB 交付标准。
- MiniProgram E2E 已补充抗抖处理后稳定通过（13/13）。
- Maestro 在无 Android 设备/模拟器场景按策略产出 `skipped` 报告，不阻塞其余门禁。

## 本轮关键收敛

- 全链路门禁升级为交付级链路：增加 `lint(0 warning)`、`format:check`、`laf 严格审计`、`build:h5`、`mp 主包引用审计`。
- ESLint 与 Prettier 规则冲突已收敛，`lint` 与 `format:check` 可同时通过。
- MiniProgram Case3/Case4 超时抖动已加固：增加更稳健的答题推进实现与多次重试策略。

## 执行环境

- 执行命令：`QA_SKIP_PLAYWRIGHT_INSTALL=1 bash scripts/test/run-full-regression-gate.sh`
- Node 版本：`fnm` 固定 `20.17.0`
- Playwright 浏览器：本轮复跑复用已安装 Chromium（跳过重复安装）

## 门禁结果

| 检查项                         | 结果                               |
| ------------------------------ | ---------------------------------- |
| Lint（ESLint，0 warning）      | passed                             |
| Format（Prettier check）       | passed                             |
| Laf Source Audit（strict）     | passed                             |
| Build（H5）                    | passed                             |
| Unit（Vitest）                 | 79 files / 1206 passed             |
| Visual（Playwright）           | 24 passed                          |
| E2E Regression                 | 30 passed                          |
| E2E Compat                     | 90 passed                          |
| Maestro                        | skipped（无设备）                  |
| Secret Audit                   | no tracked secret patterns found   |
| Prod Deps Audit                | 11 vulnerabilities（non-blocking） |
| MP Main Package Usage Audit    | passed                             |
| MiniProgram E2E Report（Jest） | 13 passed                          |

## 关键产物

- `test-results/e2e/jest-results.json`
- `test-results/e2e/junit.xml`
- `docs/reports/maestro-results.xml`
- `docs/reports/e2e-regression-results.xml`
- `docs/reports/e2e-compat-results.xml`

## 说明

- 若需将 Maestro 作为强制失败门禁，可设置：`MAESTRO_REQUIRE_DEVICE=1`。
- 若需强制 Native 流程（缺少 APP_ID 直接失败），可设置：`MAESTRO_REQUIRE_NATIVE=1`。
- `npm audit --omit=dev` 仍存在 11 项上游依赖漏洞（`@dcloudio/uni-cli-shared` 链路），官方修复路径需要 `npm audit fix --force` 并引入框架级 breaking change；本轮以不引入兼容性风险为原则，保留为后续专项升级项。
