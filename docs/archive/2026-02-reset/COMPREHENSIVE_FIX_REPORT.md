# Exam-Master 综合修复与验证报告（当前基线）

更新时间: 2026-02-28
执行环境: Sealos / Laf Cloud (`nf98ia8qnt`)
调用域名: `https://nf98ia8qnt.sealosbja.site`

---

## 1) 本轮目标与结果

### 目标

- 修复线上 `500` / `Function Not Found` 相关问题
- 完成核心后端接口真调用验证（含 JWT 鉴权链路）
- 统一并收敛分散的部署/状态文档

### 结果

- 已完成关键函数修复并上线，`question-bank` 最新版本已推送
- 已完成核心认证链路验证（邮箱密码登录 -> JWT -> 受保护接口）
- 已完成冗余部署报告收敛（见“文档收敛”）
- 已完成 Laf 函数入口 **TS-only** 治理（移除 7 组 `.js/.ts` 双入口漂移）
- 已将 `audit:laf:function-sources -- --strict` 接入 CI 并启用强约束

---

## 2) 关键修复说明

- 修复了多函数在 Sealos 运行期依赖解析不稳定问题（关键路径改为 `./_shared/*`）
- `question-bank` 修复了鉴权相关缺陷：
  - 用户 ID 字段使用错误修复（`payload.ud` -> `payload.userId`）
  - 返回字段拼写修复（`ccess` -> `success`）
  - 取消对 `login` `_internal_action` 的依赖，改为直接 JWT 验证
- `question-bank` 已发布并回归通过
- 修复 5 个鉴权失效函数对 `login` `_internal_action` 的遗留依赖，统一改为 `verifyJWT + extractBearerToken` 并已上线：
  - `group-service`
  - `material-manager`
  - `study-stats`
  - `ai-friend-memory`
  - `school-query`
- 清理 `send-email-code` 中无效鉴权辅助代码，避免后续误用

---

## 3) 线上验证结果（已执行）

### 公共与基础接口

- `health-check` 正常
- `proxy-ai` `health_check` 正常
- `getHomeData` 正常
- 多接口远程 smoke（同一轮）返回稳定业务态：`question-bank`、`rank-center`、`pk-battle`、`school-query(list)`
- 新增可复用脚本 `npm run test:cloud:smoke`，已实测通过（`5 passed / 0 failed / 2 skipped`，登录链路按环境变量可选）
- smoke 已覆盖 `question-bank random public` 与 `question-bank invalid token` 两项回归

### 鉴权与用户链路

- `login`（email + password）可成功签发 JWT
- `login` 新增 `type=qq` 分支（支持 H5 OAuth / App OAuth / QQ 小程序 code）
- `doc-convert`：未登录 401、带 token 可正常 `get_types`
- `user-profile`：带 token 可正常 `get`

### 业务核心链路

- `favorite-manager`：`add/get/remove` 全链路通过
- `mistake-manager`：`add/get/remove` 全链路通过
- `answer-submit`：记录查询可用，提交不存在题目返回 404（符合预期）
- `group-service`：带 token 访问恢复正常（不再误报 token 失效）
- `material-manager`：带 token 访问恢复正常
- `study-stats`：带 token 访问恢复正常
- `ai-friend-memory`：带 token 访问恢复正常
- `school-query` 用户收藏接口：带 token 访问恢复正常

### 认证边界验证

- `answer-submit` 未登录访问返回 401（符合预期）
- `send-email-code` 在 Gmail SMTP 配置后返回 `code:0`（已恢复真实发信）

### `question-bank` 专项回归

- 无 token + 公共 action：正常
- 无效 token：401
- 有效 token + 非法 action：400（不再误判为 token 失效）
- token userId 与请求 userId 不一致：403

---

## 4) 真实用户模拟测试结论

- 已完成：
  - 真实邮箱账号登录（email/password）
  - 登录后带 token 的核心业务接口调用
- 未完成：
  - 新用户“验证码注册”真实闭环（受 SMTP 通道状态影响）
  - 前端 UI 端到端全流程自动化回归（真机/浏览器全路径）

说明：为完成登录链路验证，曾临时创建受控测试账号；临时建号函数已在验证后删除，无线上调试函数残留。

补充（本地自动化与构建验证已执行）：

- `npm test`：63 个测试文件、979 个测试用例全部通过
- `npx vitest run tests/unit/audit-*.spec.js`：31 个测试文件、323 个测试用例全部通过
- `npm run test:visual`：11 个视觉回归用例全部通过
- `npm run lint`：通过
- `npm run build:h5`：通过
- `npm run audit:laf:function-sources -- --strict`：通过（Root JS entry = 0，Untracked TS = 0）

---

## 5) 审计完成度（针对你关心的问题）

### 当前结论

- 前端+后端“全部审计完毕”：**否（未 100%）**
- “所有代码层面全面审计完毕”：**否（未逐文件逐行全量闭环）**
- “模拟真实用户测试全部完成”：**否（核心链路完成，但非全场景完成）**

### 已完成范围

- 后端核心鉴权、题库、错题、收藏、文档转换、部分 AI/工具链路已实测
- 核心安全修复（JWT/鉴权/注入等重点项）已落地

### 未覆盖或未完全覆盖范围

- 前端全页面交互与弱网/异常态的系统化回归
- 部分非核心函数的逐项深度行为验证
- 新用户验证码注册的真实邮件闭环

---

## 6) 文档收敛（已执行）

为避免重复和结论冲突，已移除以下冗余文档：

- `DEPLOYMENT_EMERGENCY_REPORT.md`
- `DEPLOYMENT_STATUS_REPORT.md`
- `DEPLOYMENT_FINAL_REPORT.md`
- `DEPLOYMENT_COMPLETE.md`

当前保留为主文档：

- `COMPREHENSIVE_FIX_REPORT.md`（本文件，最终状态与结论）
- `laf-backend/DEPLOYMENT_GUIDE.md`（部署与验证操作指南）

---

## 7) 下一步建议（最短闭环）

1. 先补通 SMTP（或提供稳定验证码通道），完成“新用户注册”真实闭环测试。
2. 执行前端端到端回归（登录、刷题、错题、收藏、个人中心、文档转换）。
3. 对剩余未深测函数做批量 smoke + 关键路径深测，并更新本报告为“全量审计完成版”。

---

## 8) 本轮新增自动化能力

- 新增线上冒烟脚本：`scripts/build/live-cloud-smoke.mjs`
- 新增 npm 命令：`npm run test:cloud:smoke`
- 新增 Laf 源码审计脚本：`scripts/build/audit-laf-function-sources.mjs`
- 新增 npm 命令：`npm run audit:laf:function-sources`
- 脚本特性：
  - 默认调用线上域名（可用 `SMOKE_BASE_URL` 覆盖）
  - 针对 Sealos 偶发 `Function Not Found` 增加重试（默认 8 次）
  - 支持可选鉴权链路（`SMOKE_EMAIL` + `SMOKE_PASSWORD`）
  - 未配置账号时自动跳过登录相关校验，不阻塞公开接口 smoke
  - 可审计 Laf 函数入口的 TS/JS 漂移、TS 跟踪状态、本地与 pull 源一致性

---

## 10) 备份与交付文档状态

- 备份工作流：`.github/workflows/backup.yml`（含 preflight，未配置密钥时会跳过并提示）
- 备份脚本：`deploy/scripts/backup-mongodb.sh`（支持 full/incremental、SHA256 校验、过期清理）
- 当前备份记录文档：`docs/BACKUP-STATUS-2026-02-28.md`
- 说明：仓库已忽略 `backups/` 目录，交付以「工作流 Artifact + 备份状态文档」为准

---

## 9) 本轮配置与联调进展

- 已配置并下发环境变量：`ZHIPU_API_KEY`、`QQ_APPID`、`QQ_SECRET`、`QQ_REDIRECT_URI`、`SMTP_*`
- 已确认：`proxy-ai health_check` 返回 `status=ready`
- 已确认：`send-email-code` 真实线上调用返回 `code:0`（可发送验证码）
- 前端已恢复 QQ 登录入口并接入 `qq-callback` 页面路由
- 后端已实现 QQ 登录处理；剩余依赖 QQ 平台回调域与真实 OAuth 授权码联调
