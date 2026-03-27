# EXAM-MASTER Project Index

> 项目全景导航 — 任何 AI 的第一个路标

## 文档体系结构

```
第一层: 根目录入口 (AI 自动读取)
├── CLAUDE.md          ← Claude Code / OpenCode 自动读取
├── .cursorrules       ← Cursor 自动读取
└── .clinerules        ← Cline 自动读取

第二层: 系统感知 (上帝视角)
├── docs/PROJECT-INDEX.md     ← 你在这里
└── docs/status/HEALTH.md     ← 系统健康 + Bug + 技术债

第三层: 开发规范 (深入工作)
├── docs/sop/AI-DEV-RULES.md      ← 铁律
├── docs/sop/UPDATE-PROTOCOL.md   ← 文档更新触发规则
└── docs/sop/CHANGE-LOG.md        ← 变更历史

第四层: 模块深度文档 (按需查阅)
└── docs/AI-SOP/
    ├── PROJECT-BRIEF.md      ← 项目概览 + 依赖 + 构建
    ├── ARCHITECTURE.md       ← 分层架构 + 数据流 + 安全
    ├── MODULE-INDEX.md       ← 问题导向文件定位器
    └── modules/              ← 11 个模块详细报告
```

## 快速跳转

### 我要改前端

1. 先看 → `docs/AI-SOP/MODULE-INDEX.md` (找到相关文件)
2. 组件库 → `docs/AI-SOP/modules/frontend-components.md`
3. 页面 → `docs/AI-SOP/modules/frontend-pages.md`
4. 服务层 → `docs/AI-SOP/modules/frontend-services.md`
5. 状态管理 → `docs/AI-SOP/modules/frontend-stores.md`
6. 样式 → `docs/AI-SOP/modules/styling-system.md`

### 我要改后端

1. 云函数 → `docs/AI-SOP/modules/backend-functions.md`
2. 数据库 → `docs/AI-SOP/modules/backend-schemas.md`
3. API 文档 → `docs/AI-SOP/modules/api-documentation.md`
4. LLM 号池 → `docs/AI-SOP/modules/backend-functions.md` (LLM API 号池详情章节)

### 我要部署

1. 腾讯云 → `deploy/tencent/` (Nginx + PM2 + MongoDB Docker)
2. Sealos Laf → `laf-backend/DEPLOYMENT_GUIDE.md`
3. CF Worker → `deploy/tencent/cf-worker/`
4. Docker → `deploy/docker/`
5. K8s → `deploy/k8s/`

### 我要跑测试

1. 测试架构 → `docs/AI-SOP/modules/testing-infra.md`
2. 工具函数 → `docs/AI-SOP/modules/utils-reference.md`
3. 脚本 → `docs/AI-SOP/modules/scripts-reference.md`

### 我要查 Bug / 技术债

→ `docs/status/HEALTH.md`

### 我要看历史变更

→ `docs/sop/CHANGE-LOG.md`

## 服务器拓扑

```
                     Frontend (WeChat MP / H5)
                              │
               ┌──────────────▼──────────────┐
               │  Nginx (api.245334.xyz:443)  │
               └──┬─────────────────────┬─────┘
                  │ Primary             │ Fallback
         ┌────────▼────────┐   ┌────────▼──────────┐
         │ Express/PM2     │   │  Sealos Laf        │
         │ 101.43.41.96    │   │  nf98ia8qnt...     │
         │ Port 3001       │   │  35+ cloud funcs   │
         └────────┬────────┘   └────────────────────┘
                  │
         ┌────────▼────────┐
         │  MongoDB Docker  │
         │  :27017 (local)  │
         └─────────────────┘

         ┌─────────────────────────────┐
         │  CF Worker (api-gw.245334)  │
         │  14 海外 API 代理            │
         └─────────────────────────────┘
```

## 多项目端口规划 (腾讯云共享服务器)

| 项目                | 后端端口 | Nginx 路径    |
| ------------------- | -------- | ------------- |
| EXAM-MASTER         | 3001     | `/` (default) |
| AI Chain Discussion | 3002     | `/ai-chain/`  |
| Edu Math            | 3003     | `/edu-math/`  |
| Job Bot             | 3004     | `/job-bot/`   |
| OpenClaw Bot        | 3005     | `/openclaw/`  |
