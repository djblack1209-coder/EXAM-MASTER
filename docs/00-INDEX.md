# 考研大师 — 文档总索引

> 最后更新：2026-04-30

## 命名规范

- 文件名：`NN-KEBAB-CASE.md`（编号-大写短横线命名）
- 子编号：`NNA-NAME.md`（如 08B、08C）
- 归档目录：`archive/YYYY-MM-label/`
- 缓存目录：`cache/technology-name.md`（小写短横线）

## 文档清单

| 编号 | 文档 | 说明 |
|------|------|------|
| 00 | 本文件 | 文档总索引 |
| 01 | [产品愿景](./01-PRODUCT-VISION.md) | 产品定位、技术架构、平台策略、商业模式 |
| 02 | [系统架构](./02-ARCHITECTURE.md) | 技术栈、数据流、模块关系 |
| 03 | [模块索引](./03-MODULE-INDEX.md) | 所有前后端模块快速定位表 |
| 04 | [API文档](./04-API-DOCUMENTATION.md) | 全部接口定义与用法 |
| 05 | [数据库结构](./05-DATABASE-SCHEMAS.md) | MongoDB集合结构 |
| 06 | [前端参考手册](./06-FRONTEND-REFERENCE.md) | 组件、页面、Store、Service 合集 |
| 07 | [样式系统](./07-STYLING-SYSTEM.md) | 主题、变量、设计规范 |
| 08 | [测试基础设施](./08-TESTING-INFRA.md) | Vitest配置、E2E框架 |
| 08B | [工具函数参考](./08B-UTILS-REFERENCE.md) | src/utils/ 下各工具说明 |
| 08C | [脚本参考](./08C-SCRIPTS-REFERENCE.md) | 构建/审计脚本说明 |
| 09 | [部署运维指南](./09-DEPLOYMENT-GUIDE.md) | 前端部署、后端部署、应急响应 |
| 09A | [Laf 后端部署指南](./09A-LAF-BACKEND-DEPLOYMENT.md) | 当前 Sealos/Laf 云函数部署、smoke、平台现象与发布后验证 |
| 09B | [后端分仓迁移指南](./09B-BACKEND-MIGRATION-GUIDE.md) | 将 `laf-backend/` 拆分为独立仓库时使用的迁移步骤 |
| 10 | [开发规范](./10-DEV-RULES.md) | AI开发铁律、变更分析、验收清单、测试策略 |
| 11 | [发布记录](./11-RELEASE-NOTES.md) | 版本发布说明 |
| 12 | [变更日志](./12-CHANGELOG.md) | 项目变更记录 |
| 13 | [源码审计清单](./13-CODE-AUDIT-CHECKLIST.md) | 死代码标记（保留/移除判定） |
| 14 | [小程序UI重设计规格](./14-MP-UI-REDESIGN-SPEC.md) | Wise绿成熟视觉、PNG物料、分阶段小程序重构规格 |
| 15 | [百度API验证报告](./15-BAIDU-API-VALIDATION.md) | 百度网盘开放API技术验证 |
| 16 | [PNG物料生成提示词清单](./16-PNG-ASSET-PROMPTS.md) | 全量PNG替换路径、尺寸、生成提示词与验收标准 |
| 17 | [题库资源采集与知识神经架构方案](./17-QUESTION-BANK-KNOWLEDGE-GRAPH-SPEC.md) | `/EXAM-MASTER` 日扫、增量清洗队列、公共课题库、多级导航、知识神经图谱与刷题体验 |
| 18 | [小程序视觉体验与增长护城河优化报告](./18-MP-VISUAL-GROWTH-OPTIMIZATION.md) | Nanfu式冲击力转译、学生体验、投资视角、护城河与本轮落地清单 |
| 19 | [敏感信息泄露审计报告](./19-SECURITY-LEAK-AUDIT.md) | 公开仓库风险、Git历史扫描、本地凭据处置、轮换与历史清洗方案 |
| 20 | [发布就绪清单](./20-RELEASE-READINESS.md) | 上线剩余任务、百度清洗队列、当前门禁结果、P0/P1/P2 发布阻断项 |
| 21 | [Free LLM API 号池与降级策略](./21-FREE-LLM-POOL.md) | 免费/免费额度 AI provider 优先级、限额文档、降级和禁用无余额 key 策略 |
| 22 | [工作区清理方案](./22-WORKSPACE-CLEANUP-PLAN.md) | 文档集中、审计归档、运行产物忽略和提交前清洁规则 |
| 23 | [移动端设计方向与解耦准则](./23-MOBILE-APP-DESIGN-DIRECTION.md) | iOS/Android 主力产品的现代商业审美、模块解耦、动效、组件和美术资产策略 |

## 辅助目录

| 目录 | 说明 |
|------|------|
| [cache/](./cache/) | 技术文档速查缓存(Vue3/Pinia/uni-app等) |
| [release/](./release/) | 发布证据模板与人工验收记录 |
| [archive/](./archive/) | 历史归档文档(只读) |

## 已清理与合并

以下旧目录的内容已合并到上述编号文档中：
- `docs/sop/` → 合并到 10-DEV-RULES.md
- `docs/AI-SOP/modules/` → 合并到 04/05/06/07/08
- `docs/AI-SOP/` → 合并到 02/03
- `docs/releases/` → 合并到 11
- `deploy/docs/` → 合并到 09
- `laf-backend/deployment-guide.md` → 移入 09A
- `laf-backend/MIGRATION-GUIDE.md` → 移入 09B
- `docs/archive/2026-02-reset/*.md` → 合并为 2026-02 修复记录
- `docs/archive/2026-03-review/*.md` → 合并为 2026-03 修复记录
- `docs/archive/2026-04-review/` → 重复草稿删除，正式内容保留在 18/19
