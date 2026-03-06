# Exam-Master 仓库梳理回归报告（2026-03-07 r4）

## 目标

- 全量扫描并清理冗余文档/报告结构
- 统一报告命名与目录归类
- 合并重复文件并减少实现副本
- 确保清理后核心功能回归通过

## 本轮改动

- 文档与报告归档：
  - 引入 `docs/reports/current/`（最新结论）
  - 引入 `docs/reports/history/2026-03/`（历史轮次）
  - 引入 `docs/releases/`（版本发布文档）
  - 引入 `docs/archive/2026-03-review/`（手工验证归档）
- 重复报告处理：删除重复空缺陷快照 `r7/r8`
- 配置整理：扩展 `.gitignore`，统一忽略运行时生成报告
- 源码去重：
  - 抽取 `src/utils/learning/smart-question-picker.js` 作为唯一实现
  - 删除页面级重复工具副本（favorite/plan/practice-sub/mistake/settings 下 10 个 utils 文件）
  - 全量切换调用到统一实现：`@/utils/favorite/*`、`@/utils/analytics/*`、`@/utils/learning/*`、`@/utils/helpers/permission-handler.js`

## 自动化验证

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run lint
eval "$(fnm env)" && fnm use 20.17.0 && npm run build:h5
eval "$(fnm env)" && fnm use 20.17.0 && npm run test
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:regression
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:report
eval "$(fnm env)" && fnm use 20.17.0 && node scripts/build/verify-wechat-artifacts.mjs
```

## 结果

- `npm run lint`: passed
- `npm run build:h5`: passed
- `npm run test`: 79/79 files passed, 1206/1206 tests passed
- `npm run test:e2e:regression`: 32/32 passed
- `npm run test:e2e:report`: 13/13 passed
- `verify-wechat-artifacts`: passed
- 覆盖项满足：冒烟 + 核心流程 + 前10高风险页面

## 本轮统计

- 新发现问题数：0
- 已修复问题数：0
- 未解决阻塞问题：0
