# Exam-Master 文案合规回归报告（2026-03-07 r2）

## 目标

- 将小程序前端可见文案中的 `AI` 字样替换为 `智能`（或删除），不改功能、不改入口。

## 变更范围

- 文案替换覆盖：`src/pages`、`src/components`、`src/mixins`、`manifest.json`。
- 代表性页面：
  - `src/pages/practice-sub/import-data.vue`
  - `src/pages/school/index.vue`
  - `src/pages/school-sub/detail.vue`
  - `src/pages/settings/index.vue`
  - `src/pages/settings/privacy.vue`
  - `src/pages/settings/terms.vue`
  - `src/pages/settings/PosterModal.vue`
- 代表性提示文案：
  - `src/mixins/navigationMixin.js`
  - `src/mixins/practiceNavigationMixin.js`

## 自动化验证

1. 全量质量门禁（首次）

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:qa:full-regression:clean
```

- 结果：仅 1 项失败（`e2e-tests/specs/exam-flow.spec.js` 文案断言未更新）。

2. 修复后回归

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:report
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:regression
eval "$(fnm env)" && fnm use 20.17.0 && npm run build:mp-weixin && node scripts/build/verify-wechat-artifacts.mjs
```

- `test:e2e:report`: 13/13 passed
- `test:e2e:regression`: 32/32 passed
- `build:mp-weixin + verify`: passed

## 扫描结论

- 源码可见文案扫描（中文邻接规则）已无 `AI` 用户文案残留。
- 仅保留代码标识符级别命名（如 `proxyAI`、`AIChatModal`），不影响界面展示与审核文案。

## 本轮统计

- 新发现问题数：1
- 已修复问题数：1
- 未解决阻塞问题：0（微信发布链路无阻塞）
