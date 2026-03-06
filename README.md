# Exam-Master

> 考研备考小程序 — AI 助力，一战成硕

基于 uni-app + Vue 3 + Laf Cloud 的全栈考研备考应用，支持微信小程序、QQ 小程序和 H5。

## 功能概览

- **智能刷题** — 题库练习、模拟考试、错题本、收藏夹，支持自适应学习引擎
- **AI 助手** — AI 对话答疑、拍照搜题、AI 自动生成题目
- **学习管理** — 学习目标设定、成就系统、学习统计、签到打卡
- **社交功能** — PK 对战、排行榜、好友系统、学习小组
- **院校工具** — 院校查询、AI 择校咨询、学习资源库
- **实用工具** — 证件照处理、文档转换

## 技术栈

| 层级     | 技术                                   |
| -------- | -------------------------------------- |
| 前端框架 | uni-app + Vue 3 + Pinia                |
| 后端服务 | Laf Cloud (Sealos) + TypeScript        |
| 数据库   | MongoDB (Laf 内置)                     |
| AI 能力  | 智谱 GLM-4-Plus / SiliconFlow          |
| 构建工具 | Vite                                   |
| 测试     | Vitest + Playwright                    |
| 代码规范 | ESLint + Prettier + Husky + Commitlint |

## 项目结构

```
exam-master/
├── src/                    # 前端源码
│   ├── pages/              #   页面（主包）
│   ├── pages/practice-sub/ #   练习子包
│   ├── pages/school-sub/   #   院校子包
│   ├── components/         #   组件（base / business）
│   ├── composables/        #   组合式函数
│   ├── mixins/             #   混入（Vue 2 Options API 页面）
│   ├── services/           #   服务层（HTTP / 存储 / 错误处理）
│   ├── stores/             #   Pinia 状态管理
│   ├── utils/              #   工具函数
│   ├── config/             #   应用配置
│   └── styles/             #   全局样式 / 设计令牌
├── laf-backend/            # 后端云函数（独立子项目）
│   ├── functions/          #   云函数入口（35 个）
│   ├── functions/_shared/  #   共享模块（响应码 / 日志 / 限流）
│   ├── database-schema/    #   数据库 Schema
│   └── README.md           #   后端文档
├── docs/                   # 项目文档（当前 + 归档）
│   ├── README.md            #  文档导航（当前文档入口）
│   ├── BASELINE-START-2026-02-28.md # 新基线说明
│   ├── API_DOCUMENTATION.md #  API 使用文档（含示例）
│   ├── archive/             #  历史审计/交付文档归档
│   ├── COMPONENTS.md        #  组件文档
│   ├── UTILS.md             #  工具函数文档
│   └── SCRIPTS.md           #  脚本与 CI/CD
├── deploy/                 # 部署配置与运维文档
├── tests/                  # 测试用例
├── .env.example            # 环境变量模板（前端）
└── laf-backend/.env.example #  环境变量模板（后端）
```

## 快速开始

### 环境要求

- Node.js >= 20.17（与 CI 保持一致）
- npm >= 10
- 微信开发者工具（小程序开发）
- [Laf CLI](https://docs.laf.run/guide/cli/)（后端部署）

### 前端

```bash
# 使用仓库内固定版本（nvm）
nvm use

# 或（fnm）
fnm use 20.17.0

# 安装依赖
npm install

# 复制环境变量并填入配置
cp .env.example .env.local

# 启动开发服务器（H5）
npm run dev:h5

# 构建微信小程序
npm run build:mp-weixin
```

### 后端

```bash
cd laf-backend

# 安装依赖
npm install

# 复制环境变量并填入配置
cp .env.example .env

# 部署到 Laf
laf login && laf init <appid> && laf deploy
```

详见 [laf-backend/README.md](./laf-backend/README.md)。

## 常用命令

| 命令                                    | 说明                    |
| --------------------------------------- | ----------------------- |
| `npm run dev:h5`                        | H5 开发服务器           |
| `npm run dev:mp-weixin`                 | 微信小程序开发          |
| `npm run build:mp-weixin`               | 构建微信小程序          |
| `npm run test`                          | 运行单元测试            |
| `npm run test:coverage`                 | 测试覆盖率报告          |
| `npm run lint:fix`                      | ESLint 自动修复         |
| `npm run format`                        | Prettier 格式化         |
| `npm run test:qa:full-regression:clean` | Node20 交付级全链路门禁 |

`test:qa:full-regression:clean` 当前会执行：`lint(0 warning)`、`format:check`、`laf 源码严格审计`、`build:h5`、`vitest`、`visual`、`e2e regression/compat`、`maestro`、`tracked secrets`、`prod deps audit(非阻断)`、`mp 主包引用审计`、`mini program e2e report`。

## 文档

- [文档导航](./docs/README.md) — 当前文档总入口（含归档说明）
- [新起点基线](./docs/archive/2026-02-reset/BASELINE-START-2026-02-28.md) — 以当前状态重新开始的执行基线
- [API 文档](./docs/API_DOCUMENTATION.md) — 完整 API 参考（含快速速查表 + 详细示例）
- [备份状态](./docs/archive/2026-02-reset/BACKUP-STATUS-2026-02-28.md) — 备份保障现状与证据清单
- [部署指南](./laf-backend/DEPLOYMENT_GUIDE.md) — Laf 发布与线上验证
- [组件文档](./docs/COMPONENTS.md) — 前端组件说明
- [工具函数](./docs/UTILS.md) — 工具函数说明
- [脚本与 CI/CD](./docs/SCRIPTS.md) — 构建脚本与流水线
- [应急响应](./deploy/docs/EMERGENCY-RESPONSE.md) — 故障处理预案
- [后端文档](./laf-backend/README.md) — 云函数开发指南

## 环境变量

前端环境变量详见 [.env.example](./.env.example)，后端环境变量详见 [laf-backend/.env.example](./laf-backend/.env.example)。

关键配置项：

- `VITE_API_BASE_URL` — 后端 API 地址
- `VITE_WECHAT_APPID` — 微信小程序 AppID
- `VITE_QQ_APPID` — QQ 小程序 AppID
- `VITE_AI_*` — AI 服务配置

## License

Private — 仅供内部使用。
