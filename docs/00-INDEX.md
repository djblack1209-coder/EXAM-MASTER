# 考研大师 — 文档总索引

> 最后更新：2026-08-29

本项目文档统一保存在 `docs/` 下。当前保留 17 个核心文档，删除了 2026 年 5 月前的审计/发布证据、历史归档、文档缓存、分散设计报告和临时清理计划。运行时扫描报告、PDF 渲染页、OCR 探针和 release evidence 不进入 `docs/`；需要复跑时使用脚本在 `data/reports/` 或本地 `tmp/` 生成。

> 2026-08-28 生产复查：Tencent 首页、API `/health-check`、Cloudflare/Nginx、备份 timer 和健康 timer 均正常；HostDare/Yanhuo 暂停未造成当前链路中断。题库 public release 仍 blocked，缺口槽位、source-manifest、candidate 证据、官方题源/答案核验和真实微信设备验收不能由 HTTP 200 或本地测试替代。

> 2026-08-29 最终复查：公网首页与 API health-check 仍返回 HTTP 200；`npm test -- --run`、LAF source strict audit、题库/外部 release gate 和敏感信息检查均按既有入口复跑。基础设施没有新故障；public release 仍 blocked，原因仍是内容证据和真实微信设备验收，不因本地测试通过而放行。

## 项目定位

`EXAM-MASTER` 是基于真题资料库的考研公共课刷题工具。当前小程序核心链路是打开首页查看进度或进入题库，按科目和年份选择整套真题，再进入刷题、错题复练和 FSRS 间隔复习。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | uni-app 3.x、Vue 3、Pinia、Vite |
| UI | wot-design-uni、自研主题与动效 token |
| 后端 | Laf 云函数、TypeScript |
| 数据库 | MongoDB |
| 算法 | FSRS、题库质量门禁、掌握度模型 |
| 资源管线 | 百度网盘 API、离线 PDF -> 闪卡 JSON 管线 |

## 快速开始

```bash
npm install --legacy-peer-deps
npm run dev:h5
npm run dev:mp-weixin
npm test
```

后端部署、Laf CLI、线上 smoke 与云函数发布见 `09A-LAF-BACKEND-DEPLOYMENT.md`。

## 目录结构

```text
src/                 前端源码
laf-backend/         Laf 云函数、数据库 schema、后端工具
docs/                项目核心文档
deploy/              部署配置
tests/unit/          Vitest 单元与安全回归测试
cdn-assets/          CDN 图片资源
scripts/             构建、百度网盘、PDF 处理与质量门禁脚本
data/                题库处理输入/输出数据，不放临时审计报告
tmp/                 本地 PDF 渲染/OCR/探针缓存，git 忽略，不作为发布证据
```

## 当前项目全景

- 代码规模：当前 git 跟踪约 3562 个文件，其中 `src/` 约 390 个、`laf-backend/` 约 182 个、`tests/` 约 186 个、`scripts/` 约 136 个、`cdn-assets/` 约 2586 个。
- 前端：uni-app + Vue 3 + Pinia，小程序主包和分包按 `src/pages.json` 组织；核心用户链路是首页、公共课题库、刷题/复习、个人中心和设置。
- 后端：Laf 云函数在 `laf-backend/functions/`，源码审计要求 TS/JS entry 与 YAML/部署配置保持一致，严格门禁命令是 `npm run audit:laf:function-sources -- --strict`。
- 题库资产：正式公共课题库在 `src/config/flashcard-banks/`，注册表是 `src/config/bank-registry.js`，图片资产在 `cdn-assets/question-bank/`，清洗和构建脚本集中在 `scripts/cleaning/` 与 `scripts/baidu/`。
- 发布门禁：`data/release-blocker-backlog.json` 当前显示 public release 仍为 blocked；本地可安全闭环的是脚本/文档/仓库冗余清理和可复跑门禁，不能伪造真实手机微信证据、官方题源或答案 matched 证据。
- 当前 P0 阻塞边界：真实手机微信 evidence 1 项；公共课缺口 14 个槽位；Source Manifest 证据缺口 7 个；`data/flashcards/politics-2023.json` 仍有 38 张卡为 candidate 证据状态。`math2/math3 2021-2022` 有本地 raw PDF 但仍需逐题裁切、答案核验和 registry 注册；2026 槽位需要外部官方题源。

## 核心文档

| 编号 | 文档 | 说明 |
|------|------|------|
| 00 | [文档总索引](./00-INDEX.md) | 项目入口、文档政策、快速开始 |
| 01 | [产品愿景](./01-PRODUCT-VISION.md) | 产品定位、平台策略、商业模式 |
| 02 | [系统架构](./02-ARCHITECTURE.md) | 技术栈、数据流、模块关系 |
| 03 | [模块索引](./03-MODULE-INDEX.md) | 前后端模块快速定位 |
| 04 | [API 文档](./04-API-DOCUMENTATION.md) | 接口定义与调用方式 |
| 05 | [数据库结构](./05-DATABASE-SCHEMAS.md) | MongoDB 集合结构 |
| 06 | [前端参考手册](./06-FRONTEND-REFERENCE.md) | 页面、组件、Store、Service 合集 |
| 07 | [样式系统](./07-STYLING-SYSTEM.md) | 主题、token、设计基线与 UI 质量口径 |
| 08 | [测试基础设施](./08-TESTING-INFRA.md) | Vitest、mock、audit 测试与质量门禁 |
| 08B | [工具函数参考](./08B-UTILS-REFERENCE.md) | `src/utils/` 工具说明 |
| 08C | [脚本参考](./08C-SCRIPTS-REFERENCE.md) | 构建、审计、资源管线脚本说明 |
| 09 | [部署运维指南](./09-DEPLOYMENT-GUIDE.md) | 前端部署、后端部署、应急响应 |
| 09A | [Laf 后端部署指南](./09A-LAF-BACKEND-DEPLOYMENT.md) | Laf 云函数部署、验证与后端启动 |
| 09B | [后端分仓迁移指南](./09B-BACKEND-MIGRATION-GUIDE.md) | `laf-backend/` 独立仓库迁移步骤 |
| 10 | [开发规范](./10-DEV-RULES.md) | 开发铁律、变更分析、验收清单、测试策略 |
| 11 | [发布记录](./11-RELEASE-NOTES.md) | 版本发布说明 |
| 12 | [变更日志](./12-CHANGELOG.md) | 项目变更记录 |

## 文档维护规则

- 新文档必须先判断能否合并到现有 17 个核心文档。
- 临时审计、发布证据、截图记录、外部文档缓存不进入 `docs/`，运行完成后清理。
- 如果确需新增长期文档，必须先删除或合并一个旧文档，确保项目核心文档数少于 20。
- 根目录和子模块目录不再放项目说明文档；需要入口说明时更新本文件。
