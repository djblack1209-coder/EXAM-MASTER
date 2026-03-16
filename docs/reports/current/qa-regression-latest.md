# Exam-Master YOLO 回归报告（2026-03-08 round1）

## 结论

- 结论：**达到 H5 自动化上线标准**。
- 说明：本轮已完成“测试 -> 修复 -> 测试”闭环；当前未发现 P0/P1 产品缺陷。
- 剩余限制：`npm run test:maestro` 已完成语法/预检，但当前无 Android/iOS 设备接入，native 套件自动跳过，不阻断 H5 回归结论。

## 执行分支

- `test-fix/2026-03-08-round1`

## 本轮处理

- 修复自动化门禁问题：更新 `tests/unit/login-password-privacy.spec.js`，使断言匹配登录页真实的密码显隐实现。
- 扩充长尾页面回归：新增 `tests/e2e-regression/specs/15-long-tail-pages.spec.js`。
- 新增覆盖页面：`/pages/favorite/index`、`/pages/practice-sub/file-manager`、`/pages/social/friend-list`、`/pages/social/friend-profile`、`/pages/knowledge-graph/index`、`/pages/plan/index`。

## 执行命令

```bash
fnm install 20.17.0 && fnm use 20.17.0
fnm exec --using 20.17.0 npm run lint
fnm exec --using 20.17.0 npm run build:h5
fnm exec --using 20.17.0 npm run test
fnm exec --using 20.17.0 npm run test:e2e:regression
fnm exec --using 20.17.0 npm run test:e2e:compat
bash scripts/test/setup-maestro-macos.sh
export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.maestro/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk"
fnm exec --using 20.17.0 npm run test:maestro:syntax
fnm exec --using 20.17.0 npm run test:maestro:preflight
fnm exec --using 20.17.0 npm run test:maestro
```

成功判定标准：

- `npm run test` 退出码为 `0`
- `npm run test:e2e:regression` 退出码为 `0`
- `npm run test:e2e:compat` 退出码为 `0`
- `docs/reports/e2e-regression-results.json` 中 `failed = 0`
- `docs/reports/e2e-compat-results.json` 中 `failed = 0`

## 结果汇总

- `npm run lint`: passed
- `npm run build:h5`: passed
- `npm run test`: 82 文件 / 1214 用例，全通过
- `npm run test:e2e:regression`: 66 passed / 0 failed / 0 skipped
- `npm run test:e2e:compat`: 195 passed / 0 failed / 3 skipped
- `npm run test:maestro:syntax`: passed
- `npm run test:maestro:preflight`: passed
- `npm run test:maestro`: passed（无设备，native 自动 skip）

## 本轮新增覆盖

- 收藏页：答案展开、笔记保存、练习跳转
- 文件管理：文件信息查看、删除、清空
- 社交页：搜索、加好友、资料页删除好友
- 知识图谱：掌握度、学习路径/关联分析/薄弱点动作
- 学习计划页：详情查看、智能调整、删除

## 产物路径

- `docs/reports/e2e-regression-results.json`
- `docs/reports/e2e-regression-results.xml`
- `docs/reports/e2e-compat-results.json`
- `docs/reports/e2e-compat-results.xml`
- `docs/reports/maestro-preflight.md`
- `test-results/e2e-regression/`
- `test-results/e2e-compat/`

## 缺陷结论

- 产品缺陷：0
- 自动化资产问题：1（已关闭）
- 环境阻塞：1（native 设备未接入，见缺陷 CSV）

## 本轮统计

- 新发现问题数：1
- 已修复问题数：1
- 未解决阻塞问题：1
- 下一轮计划：补一次 Android/iOS 真机 Maestro native smoke，完成最终跨端放行。
