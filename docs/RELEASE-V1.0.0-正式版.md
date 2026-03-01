# EXAM-MASTER V1.0.0 正式版发布说明

更新时间: 2026-03-02
目标: 微信平台提审版本

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
- `npm run audit:deep-scan`: 通过（`487` 文件）
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
