# 考研大师 — 文档总索引

> 最后更新：2026-05-02

本项目文档统一保存在 `docs/` 下。当前保留 17 个核心文档，删除了 2026 年 5 月前的审计/发布证据、历史归档、文档缓存、分散设计报告和临时清理计划。

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
```

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
