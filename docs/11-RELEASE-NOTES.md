# 发布记录

---

# EXAM-MASTER V1.1.0 闪卡重构版

更新时间: 2026-04-27
目标: 微信小程序迭代提审（产品转型为闪卡刷题工具）

## 1. 发布范围

### 产品转型
- 从"全功能考研小程序"转型为"百度网盘驱动的闪卡刷题工具"
- 小程序精简为 3 页面 MVP：首页 / 刷题中心 / 我的
- 题库来源：PDF → AI 离线加工 → 结构化闪卡 JSON（4 题库 153 题）

### Phase 2.5: 多科目题库
- 4 个闪卡题库：政治-2025(52题)、政治-2024(39题)、英语-2025(34题)、数学-2025(28题)
- bank-registry.js 动态注册 + flashcard-adapter.js 格式转换

### Phase 3: 经典闪卡模式 + FSRS
- 翻转查看答案 + FSRS 四级自评（忘了/模糊/记得/简单）
- 分析题/闪卡类型自动进入闪卡模式
- FSRS 间隔重复调度真正驱动复习计划

### Phase 4: 生产提审就绪
- 15 项审核阻塞修复（详见 12-CHANGELOG.md）
- TabBar 4→3 tabs、pages[0] 改为首页、权限声明清理、全页面浅色主题
- 构建体积 1.5MB（主包 589KB）

### Phase 5: 关键流程 Bug 修复
- useFlashcardBank.js 存储键不一致（CRITICAL）——写入 `v30_bank`，读取 `u_${userId}_v30_bank`
- loadedBankIds 无响应式更新
- goSmartReview 路由参数不匹配
- do-quiz.vue `this.mode` 未声明

## 2. 构建验证

- `npm run build:mp-weixin`: 通过
- 总体积: 1.5MB（主包 589KB）
- app.json: permission 为空、requiredPrivateInfos 为空、__usePrivacyCheck__ = true
- project.config.json: projectname = 考研大师, appid = wxd634d50ad63e14ed, libVersion = 2.32.3

## 3. 提审检查项

1. 微信开发者工具导入 `dist/build/mp-weixin`
2. 清理开发者工具缓存后重新编译
3. 验证题库加载流程：加载 → 进入刷题 → 闪卡翻转 → FSRS 评分
4. 验证未登录状态可正常刷题（不强制登录）

---

# EXAM-MASTER V1.0.0 正式版发布说明

更新时间: 2026-03-02
目标: 微信平台提审版本

Git 基线:

- `f73b065` fix(runtime): stabilize mp error handling and harden Laf retries
- `c8e4f05` fix(security): finalize v1.0.0 hardening and release readiness
- `d7b842b` docs: record v1.0.0 release baseline commits

## 1. 发布范围

- 前端运行时稳定性修复（mp-weixin 启动崩溃路径）
- Laf 冷启动 404 自愈重试增强
- 后端鉴权与输入校验加固（`ai-friend-memory`、`proxy-ai`、`send-email-code`）
- 分布式限流窗口字段补齐（`_shared/api-response`）

## 2. 质量门禁结果（正式版）

- `npm run lint`: 通过
- `npm test`: 通过（`70 files / 1179 tests`）
- `npm run build:h5`: 通过
- `npm run build:mp-weixin`: 通过
- `npm run audit:mp-main-usage`: 通过
- `node scripts/build/verify-wechat-artifacts.mjs`: 通过
- `npm run audit:deep-scan`: 通过（`488` 文件）
- `npm run audit:ui-quality`: 通过（`100/100`）
- `npm run audit:laf:function-sources -- --strict`: 通过
- `npm run test:cloud:smoke`: 通过（`6 passed / 0 failed / 3 skipped`）

## 3. 后端上线与探测

已发布到 Laf 云端函数：

- `_shared/api-response`
- `ai-friend-memory`
- `proxy-ai`
- `send-email-code`

线上 sanity 探测结果：

- `proxy-ai health_check`: `code=0`
- `send-email-code` 非法邮箱: `code=400`
- `send-email-code` 缺失邮箱: `code=400`
- `ai-friend-memory` 无 token: `code=401`（带重试验证）

## 4. 微信提审前最终检查项

1. 微信开发者工具导入目录使用：`dist/build/mp-weixin`
2. 清理微信开发者工具缓存后重新编译（避免旧构建缓存）
3. 确认首屏启动无 `storageService.js.then` 相关报错
4. 登录、题库、收藏、错题、AI 对话主链路至少各回归 1 次

## 5. 正式版备份（V1.0.0）

本地快照目录：

- `backups/V1.0.0正式版-20260302-070316`

关键备份文件：

- `backups/V1.0.0正式版-20260302-070316/artifacts/EXAM-MASTER-V1.0.0正式版-source.tar.gz`
- `backups/V1.0.0正式版-20260302-070316/artifacts/EXAM-MASTER-V1.0.0正式版-laf-functions.tar.gz`
- `backups/V1.0.0正式版-20260302-070316/artifacts/EXAM-MASTER-V1.0.0正式版-mp-weixin-dist.tar.gz`
- `backups/V1.0.0正式版-20260302-070316/meta/SHA256SUMS.txt`

说明：备份已排除 `.env*` 与 `laf-backend/.app.yaml` 等敏感配置。

## 6. 提审前最终验证（2026-03-02 07:15 CST）

最终一轮全量复核结论：全部通过。

- 质量门禁：`lint`、`test`、`build:h5`、`build:mp-weixin`、`audit:mp-main-usage`、`verify-wechat-artifacts`
- 云端门禁：`audit:laf:function-sources -- --strict`、`test:cloud:smoke`
- 边界验证：
  - `ai-friend-memory` 长度收敛 `2000/2000/1000`
  - `ai-friend-memory` token/body userId 不一致返回 `403`
  - `ai-friend-memory` 无 token 返回 `401`
  - `proxy-ai health_check` 返回 `code=0`
  - `send-email-code` 非法输入保持 `400`
  - 冷启动重试探测 `health-check/question-bank` 均 `20/20` 成功

最终门禁日志位于：

- `backups/V1.0.0正式版-20260302-070316/gates/final-lint.log`
- `backups/V1.0.0正式版-20260302-070316/gates/final-test.log`
- `backups/V1.0.0正式版-20260302-070316/gates/final-build-mp-weixin.log`
- `backups/V1.0.0正式版-20260302-070316/gates/final-cloud-smoke.log`
- `backups/V1.0.0正式版-20260302-070316/gates/final-audit-laf-function-sources.log`
- `backups/V1.0.0正式版-20260302-070316/gates/final-backend-live-sanity.log`
- `backups/V1.0.0正式版-20260302-070316/gates/final-ai-memory-edge.log`
- `backups/V1.0.0正式版-20260302-070316/gates/final-coldstart-retry-probe.log`
