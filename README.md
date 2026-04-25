# Exam-Master 考研大师

> 基于百度网盘资源库的考研备考闪卡刷题工具

## 产品定位

将百度网盘中的机构 PDF 资料**离线加工**为结构化闪卡题目，用户在 APP 内刷闪卡复习，FSRS 算法智能安排间隔重复。

**不做内容生产者，做内容加工工具。**

## 核心链路

```
闲鱼资源 → baidu-autosave 自动转存 → 你的百度网盘
    → AI 离线加工(PDF→结构化闪卡JSON)
    → 用户 APP 刷闪卡 + FSRS 复习调度
```

## 平台策略

| 平台 | 定位 | 状态 |
|------|------|------|
| 微信小程序 | 轻量入口（3页面，<500KB） | 已上线(ICP备案)，重构中 |
| iOS / Android | 主力产品（全功能） | 规划中 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | uni-app 3.x + Vue 3.4 + Pinia + Vite 5 |
| UI | wot-design-uni |
| 后端 | Laf 云函数 (TypeScript) |
| 数据库 | MongoDB |
| 算法 | FSRS (ts-fsrs) — 间隔重复记忆调度 |
| 存储 | 百度网盘 SVIP (通过开放API读取) |

## 项目结构

```
├── src/                 # 前端源码
│   ├── pages/           # 页面
│   ├── components/      # 组件
│   ├── stores/          # Pinia 状态管理
│   ├── services/        # API 调用层
│   ├── composables/     # Vue 3 组合式函数
│   ├── styles/          # 全局样式/主题
│   ├── config/          # 配置
│   └── utils/           # 工具函数
├── laf-backend/         # 后端云函数
│   ├── functions/       # 云函数
│   └── database-schema/ # 数据库结构
├── docs/                # 文档（编号体系，见下方）
├── deploy/              # 部署配置
├── tests/unit/          # 单元测试
├── cdn-assets/          # CDN 图片资源
└── scripts/build/       # 构建脚本
```

## 文档体系

所有文档在 `docs/` 下按编号排列，详见 [docs/00-INDEX.md](./docs/00-INDEX.md)：

| 编号 | 内容 |
|------|------|
| 01 | 产品愿景与战略 |
| 02 | 系统架构 |
| 03 | 模块索引 |
| 04 | API 文档 |
| 05 | 数据库结构 |
| 06 | 前端参考手册 |
| 07 | 样式系统 |
| 08 | 测试基础设施 |
| 09 | 部署运维指南 |
| 10 | 开发规范 |
| 11 | 发布记录 |
| 12 | 变更日志 |

## 快速开始

```bash
# 安装依赖
npm install --legacy-peer-deps

# H5 开发
npm run dev:h5

# 微信小程序开发
npm run dev:mp-weixin

# 运行测试
npm test

# 构建
npm run build:h5
npm run build:mp-weixin
```

## 环境变量

复制 `.env.example` → `.env.development`，填入必要的 API 密钥。

**敏感文件（不在版本控制中）**：`.env`、`.env.local`、`.env.server`
