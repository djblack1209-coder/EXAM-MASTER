# Exam-Master 项目报告

> 版本: v1.0.0 | 生成日期: 2026-01-27 | 报告版本: R1.1 (已扫描)

---

## 一、项目概述

### 1.1 项目简介

**Exam-Master** 是一款面向考研学生的智能备考微信小程序，集成了 AI 辅助学习、智能刷题、择校分析、社交互动等核心功能。项目采用 uni-app + Vue3 技术栈，支持微信小程序和 H5 双端部署。

### 1.2 核心定位

- **产品定位**: 考研备考一站式智能助手
- **目标用户**: 考研学生群体
- **核心价值**: AI 助力，一战成硕

### 1.3 版本信息

| 属性 | 值 |
|------|-----|
| 应用名称 | Exam-Master |
| 版本号 | 1.0.0 |
| AppID | wxd634d50ad63e14ed |
| 后端服务 | Sealos 平台 |
| AI 模型 | GLM-4-Plus |

---

## 二、技术架构

### 2.1 技术栈总览

```
┌─────────────────────────────────────────────────────────────┐
│                      前端技术栈                              │
├─────────────────────────────────────────────────────────────┤
│  框架层    │ uni-app 3.x + Vue 3.4 + Pinia 2.x              │
│  UI 层     │ uni-ui + 自定义组件库 + SCSS                    │
│  构建工具  │ Vite 5.x + Webpack 5.x                         │
│  测试框架  │ Vitest + Playwright                            │
├─────────────────────────────────────────────────────────────┤
│                      后端服务                                │
├─────────────────────────────────────────────────────────────┤
│  云平台    │ Sealos (原 Laf 云迁移)                          │
│  AI 服务   │ 智谱 GLM-4-Plus                                │
│  语音服务  │ 智谱 GLM-ASR / GLM-TTS                         │
│  图像服务  │ 腾讯云 BDA (人像分割)                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 项目目录结构

```
EXAM-MASTER/
├── src/
│   ├── pages/                    # 页面文件 (23个页面)
│   ├── components/               # 组件库 (51个组件)
│   ├── stores/                   # Pinia 状态管理 (8个模块)
│   ├── services/                 # 服务层 (13个文件)
│   ├── ai/                       # AI 相关模块
│   ├── config/                   # 配置文件
│   ├── composables/              # Vue Composable
│   └── design/                   # 设计系统
├── static/                       # 静态资源
├── scripts/                      # 脚本文件
├── tests/                        # 测试文件
├── PROJECT-REPORT.md             # 项目报告 (本文件)
└── DEV_LOG_V1.md                 # 开发日志
```

### 2.3 核心依赖

| 依赖包 | 版本 | 用途 |
|--------|------|------|
| vue | ^3.4.21 | 核心框架 |
| pinia | ^2.1.7 | 状态管理 |
| @dcloudio/uni-ui | ^1.5.11 | UI 组件库 |
| vite | ^5.2.8 | 构建工具 |
| vitest | ^4.0.18 | 单元测试 |

---

## 三、功能模块

### 3.1 TabBar 主导航 (4个)

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| 首页 | /pages/index | 学习概览、今日任务、快捷入口 |
| 刷题 | /pages/practice | 智能刷题、题库管理、PK 对战 |
| 择校 | /pages/school | AI 择校分析、院校推荐 |
| 我的 | /pages/profile | 个人中心、学习统计、设置 |

### 3.2 核心功能

- **智能刷题**: 支持单选、多选、判断、填空题型
- **AI 出题**: 基于学习资料自动生成题目
- **错题收集**: 自动收集错题，支持错题重练
- **PK 对战**: 好友实时 PK，ELO 匹配算法
- **AI 择校**: 基于用户画像智能推荐院校

---

## 四、API 接口

### 4.1 后端服务地址

```javascript
BASE_URL: 'https://nf98ia8qnt.sealosbja.site'
API_TIMEOUT: 100000ms
AI_TIMEOUT: 60000ms
```

### 4.2 核心接口

| 接口路径 | 方法 | 功能 |
|----------|------|------|
| /login | POST | 微信登录 |
| /proxy-ai | POST | AI 代理服务 |
| /rank-center | POST | 排行榜服务 |
| /social-service | POST | 社交服务 |
| /question-bank | POST | 题库服务 |
| /school-query | POST | 学校查询 |

---

## 五、配置说明

### 5.1 环境变量

```bash
VITE_WX_APP_ID=wxd634d50ad63e14ed
VITE_API_BASE_URL=https://nf98ia8qnt.sealosbja.site
VITE_AUDIT_MODE=true
```

### 5.2 审核模式

```javascript
// src/config/index.js
audit: {
  isAuditMode: true,           // 送审时设为 true
  hiddenFeatures: ['universe', 'ai-photo-search']
}
```

---

## 六、开发命令

```bash
# 开发
npm run dev:mp-weixin    # 微信小程序开发
npm run dev:h5           # H5 开发

# 构建
npm run build:mp-weixin  # 微信小程序构建

# 测试
npm run test             # 运行测试
```

---

## 七、架构重构设计

### 7.1 问题陈述

当前 `lafService.js` (1365行) 是典型的 God Class 反模式：
- 单文件承载 8 个业务域
- AI 调用同步阻塞，100s 超时风险
- 无限流机制，Token 盗刷风险

### 7.2 新服务层架构

```
src/services/
├── core/                      # 基础设施层
│   ├── http-client.js         # HTTP客户端
│   ├── rate-limiter.js        # 客户端限流
│   ├── replay-guard.js        # 防重放攻击
│   └── audit-guard.js         # 审核模式守卫
├── ai-core-service/           # AI 核心服务
├── study-service/             # 学习服务
├── social-service/            # 社交服务
├── school-service/            # 学校服务
├── tools-service/             # 工具服务
└── index.js                   # 统一导出
```

### 7.3 API 迁移对照表

| 旧 API | 新 API |
|--------|--------|
| `lafService.proxyAI()` | `aiCoreService.proxyAI()` |
| `lafService.getQuestionBank()` | `studyService.getQuestionBank()` |
| `lafService.socialService()` | `socialService.*` |

---

## 八、CI/CD 流水线

### 8.1 流水线阶段

1. 代码质量检查 (lint, test)
2. 安全扫描 (Trivy, npm audit)
3. Docker 镜像构建
4. Staging 部署
5. 金丝雀发布 (5% 流量)
6. 全量发布

### 8.2 回滚机制

```bash
kubectl rollout undo deployment/exam-master-backend -n exam-master
```

---

## 九、应急响应

### 9.1 常见故障

| 故障 | 处理方式 |
|------|----------|
| 504 Timeout | 检查 Ingress 超时配置 |
| 503 不可用 | 检查 Pod 状态 |
| OOMKilled | 增加内存限制 |

### 9.2 常用命令

```bash
kubectl get all -n exam-master
kubectl logs -f -n exam-master -l app=exam-master
kubectl top pods -n exam-master
```

---

## 十、v2.0 开发规划

### 10.1 技术升级

- UI 渲染优化：Three.js 小程序适配版
- 网络通信：WebSocket 支持云自习室
- AI 服务层：Prompt 管理系统 + 向量数据库

### 10.2 功能规划

| 阶段 | 时间 | 交付成果 |
|------|------|----------|
| Sprint 1 | 第1-2周 | OCR 拍照搜题、向量数据库 |
| Sprint 2 | 第3-5周 | 知识星空 v2.0、云自习室 |
| Sprint 3 | 第6周 | AI 主动式助教、灰度发布 |

---

## 附录

### A. 文件统计

| 类型 | 数量 |
|------|------|
| Vue 页面 | 23 |
| Vue 组件 | 51 |
| JS 服务 | 13 |
| Store 模块 | 8 |

### B. 项目文档

| 文件 | 说明 |
|------|------|
| PROJECT-REPORT.md | 项目报告 (本文件) |
| DEV_LOG_V1.md | 开发日志 |

---

*最后更新: 2026-01-27 (已重新扫描) | 维护者: 开发团队*
