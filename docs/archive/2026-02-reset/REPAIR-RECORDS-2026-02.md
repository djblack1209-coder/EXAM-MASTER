# 2026-02 修复记录

> 本文件合并 2026-02 reset 周期的审计、修复、备份、提审和交付记录。旧的逐轮审计大报告已清理，当前发布状态以 `docs/20-RELEASE-READINESS.md` 为准。

## 保留结论

- 2026-02 周期完成了认证、鉴权、限流、NoSQL 防护、日志、错误响应、上传链路和前端运行时稳定性修复。
- 后端云函数从混合入口收敛到 TypeScript 源码入口，并补齐 Laf 函数源码一致性审计。
- `question-bank`、`login`、`doc-convert`、`user-profile`、`favorite-manager`、`mistake-manager`、`study-stats` 等关键接口完成线上 smoke。
- 备份恢复能力完成基线记录，并在后续 2026-04 发布流程中升级为 `docs/release/backup-restore-drill.md` 证据文件。
- 微信提审前核对从人工文档迁移到发布门禁与 release evidence 模板，不再依赖旧截图和旧审计报告。

## 已收口修复

| 范围 | 修复摘要 | 当前归口 |
| --- | --- | --- |
| 认证与鉴权 | 统一 JWT 校验、修复 login 竞态、补齐非法 token 分支 | `laf-backend/functions/_shared/auth.ts`、相关单测 |
| 速率限制 | 引入分布式限流与请求保护 | `laf-backend/functions/_shared/request-guard.ts` |
| 输入安全 | 增强参数白名单、NoSQL 注入防护、空 catch 治理 | `docs/10-DEV-RULES.md` |
| 云函数部署 | 固化 Laf CLI 发布、函数源码 strict 审计和 smoke 命令 | `docs/09A-LAF-BACKEND-DEPLOYMENT.md` |
| 发布门禁 | 构建、单测、云端 smoke、微信 artifact 审计、secret 扫描 | `docs/20-RELEASE-READINESS.md` |
| 备份运维 | 备份状态、恢复演练、告警证据从旧报告迁移到 release evidence | `docs/release/` |

## 历史验证摘录

旧报告中有价值的验证项已经转入现行门禁：

- `npm test`
- `npm run build:h5`
- `npm run build:mp-weixin`
- `npm run audit:laf:function-sources`
- `npm run audit:secrets:tracked`
- `npm run test:cloud:smoke`

旧报告中的截图、逐页面人工描述、一次性 commit 计划和重复项目综述不再作为发布依据。需要追溯完整文本时，从 Git 历史查看清理前版本。

## 后续规则

1. 新的发布证据只写入 `docs/release/`。
2. 新的发布状态只更新 `docs/20-RELEASE-READINESS.md`。
3. 新的操作规范只更新 `docs/09-DEPLOYMENT-GUIDE.md`、`docs/09A-LAF-BACKEND-DEPLOYMENT.md`、`docs/10-DEV-RULES.md`。
4. 不再新增按轮次命名的大型审计报告。
