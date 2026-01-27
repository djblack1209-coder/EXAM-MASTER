# Exam-Master 项目报告

> 版本: v1.0.0 | 生成日期: 2026-01-27 | 报告版本: R1.2 (全量扫描)

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
| API 域名 | nf98ia8qnt.sealosbja.site |
| AI 模型 | GLM-4-Plus |
| 审核模式 | 开启 (VITE_AUDIT_MODE=true) |

---

## 二、技术架构

### 2.1 技术栈总览

```
┌─────────────────────────────────────────────────────────────┐
│                      前端技术栈                              │
├─────────────────────────────────────────────────────────────┤
│  框架层    │ uni-app 3.x + Vue 3.4.21 + Pinia 2.1.7         │
│  UI 层     │ uni-ui 1.5.11 + 自定义组件库 + SCSS            │
│  构建工具  │ Vite 5.2.8 + Webpack 5.x                       │
│  测试框架  │ Playwright 1.57.0                              │
├─────────────────────────────────────────────────────────────┤
│                      后端服务                                │
├─────────────────────────────────────────────────────────────┤
│  云平台    │ Sealos (Kubernetes Cluster)                    │
│  AI 服务   │ 智谱 GLM-4-Plus / GLM-4-Flash                  │
│  语音服务  │ 智谱 GLM-ASR / GLM-TTS                         │
│  图像服务  │ 腾讯云 BDA (人像分割)                           │
│  数据库    │ MongoDB 7.0 (ReplicaSet)                       │
│  缓存      │ Redis 7.x (Cluster)                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 系统架构图

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                        用户端                                │
                                    │  ┌─────────────────┐         ┌─────────────────┐           │
                                    │  │   微信小程序     │         │      H5 端      │           │
                                    │  │  (uni-app)      │         │   (uni-app)     │           │
                                    │  └────────┬────────┘         └────────┬────────┘           │
                                    └───────────┼────────────────────────────┼───────────────────┘
                                                │                            │
                                                ▼                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         Sealos 云平台                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Kubernetes Cluster (exam-master namespace)                      │  │
│  │                                                                                              │  │
│  │   ┌──────────────────┐     ┌──────────────────────────────────────────────────────────┐    │  │
│  │   │  Nginx Ingress   │────▶│                    Service Mesh                          │    │  │
│  │   │  (SSL/WAF/限流)   │     │  ┌────────────────┐    ┌────────────────┐               │    │  │
│  │   └──────────────────┘     │  │   Frontend     │    │    Backend     │               │    │  │
│  │                            │  │   (Nginx)      │    │   (Node.js)    │               │    │  │
│  │                            │  │   Replicas: 2  │    │   Replicas: 2  │               │    │  │
│  │                            │  │   HPA: 2-5     │    │   HPA: 2-10    │               │    │  │
│  │                            │  └────────────────┘    └───────┬────────┘               │    │  │
│  │                            └────────────────────────────────┼────────────────────────┘    │  │
│  │                                                             │                             │  │
│  │   ┌─────────────────────────────────────────────────────────┼─────────────────────────┐  │  │
│  │   │                           数据层                         │                         │  │  │
│  │   │   ┌────────────────┐    ┌────────────────┐    ┌────────┴───────┐                 │  │  │
│  │   │   │    MongoDB     │    │     Redis      │    │   ConfigMap    │                 │  │  │
│  │   │   │  (ReplicaSet)  │    │   (Cluster)    │    │    Secrets     │                 │  │  │
│  │   │   └────────────────┘    └────────────────┘    └────────────────┘                 │  │  │
│  │   └───────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                          │  │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │   │                           监控层                                                   │  │  │
│  │   │   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐                 │  │  │
│  │   │   │   Prometheus   │───▶│    Grafana     │    │  AlertManager  │                 │  │  │
│  │   │   │   (指标采集)    │    │   (可视化)     │    │    (告警)      │                 │  │  │
│  │   │   └────────────────┘    └────────────────┘    └────────────────┘                 │  │  │
│  │   └───────────────────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 项目目录结构

```
EXAM-MASTER/
├── src/
│   ├── pages/                    # 页面文件 (23个页面)
│   ├── components/               # 组件库 (55个组件)
│   ├── stores/                   # Pinia 状态管理 (8个模块)
│   ├── services/                 # 服务层 (13个文件)
│   ├── ai/                       # AI 相关模块
│   ├── config/                   # 配置文件
│   ├── composables/              # Vue Composable
│   ├── design/                   # 设计系统
│   ├── styles/                   # 全局样式
│   ├── utils/                    # 工具函数
│   └── static/                   # 静态资源
├── deploy/                       # 部署配置
│   ├── docker/                   # Docker 配置
│   ├── k8s/                      # Kubernetes 配置
│   ├── monitoring/               # 监控配置
│   ├── scripts/                  # 运维脚本
│   └── docs/                     # 运维文档
├── laf-backend/                  # 后端云函数
├── scripts/                      # 开发脚本
├── logs/                         # 日志文件
├── PROJECT-REPORT.md             # 项目报告 (本文件)
└── DEV_LOG_V1.md                 # 开发日志
```

### 2.4 核心依赖

| 依赖包 | 版本 | 用途 |
|--------|------|------|
| vue | 3.4.21 | 核心框架 (锁定版本) |
| pinia | 2.1.7 | 状态管理 (锁定版本) |
| @dcloudio/uni-ui | 1.5.11 | UI 组件库 |
| @dcloudio/uni-app | 3.0.0-alpha | uni-app 核心 |
| @dcloudio/uni-mp-weixin | 3.0.0-alpha | 微信小程序编译器 |
| vite | 5.2.8 | 构建工具 |
| @playwright/test | 1.57.0 | E2E 测试 |
| lottie-miniprogram | 1.0.12 | Lottie 动画 |

---

## 三、功能模块

### 3.1 TabBar 主导航 (4个)

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| 首页 | /pages/index | 学习概览、今日任务、快捷入口、每日金句 |
| 刷题 | /pages/practice | 智能刷题、题库管理、PK 对战、错题本 |
| 择校 | /pages/school | AI 择校分析、院校推荐、院校详情 |
| 我的 | /pages/profile | 个人中心、学习统计、设置、好友列表 |

### 3.2 页面清单 (23个)

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | pages/index/index | 主页面 |
| 刷题首页 | pages/practice/index | 刷题入口 |
| 做题页 | pages/practice/do-quiz | 答题界面 |
| 导入资料 | pages/practice/import-data | AI 出题 |
| PK 对战 | pages/practice/pk-battle | 好友 PK |
| 排行榜 | pages/practice/rank | 排名展示 |
| 模拟考试 | pages/practice/mock-exam | 模考功能 |
| 文件管理 | pages/practice/file-manager | 题库管理 |
| 错题本 | pages/mistake/index | 错题收集 |
| 择校首页 | pages/school/index | 择校入口 |
| 院校详情 | pages/school/detail | 院校信息 |
| 个人中心 | pages/profile/index | 用户信息 |
| 设置 | pages/settings/index | 应用设置 |
| 好友列表 | pages/social/friend-list | 社交功能 |
| 好友详情 | pages/social/friend-profile | 好友信息 |
| 学习计划 | pages/plan/index | 计划列表 |
| 创建计划 | pages/plan/create | 新建计划 |
| 学习详情 | pages/study-detail/index | 学习统计 |
| AI 聊天 | pages/chat/chat | AI 对话 |
| 拍照搜题 | pages/tools/photo-search | OCR 搜题 |
| 探索宇宙 | pages/universe/index | 知识星空 |
| 启动页 | pages/splash/index | 开屏动画 |
| 排行详情 | pages/practice/rank-list | 排名详情 |

### 3.3 组件清单 (55个)

**基础组件 (base/)**:
- base-loading - 加载动画
- base-skeleton - 骨架屏
- base-empty - 空状态
- ErrorBoundary - 错误边界
- school-skeleton - 择校骨架屏
- plan-skeleton - 计划骨架屏
- mistake-skeleton - 错题骨架屏

**通用组件 (common/)**:
- CustomModal - 自定义弹窗
- GlassModal - 毛玻璃弹窗
- EnhancedCard - 增强卡片
- EnhancedButton - 增强按钮
- EnhancedAvatar - 增强头像
- EnhancedProgress - 进度条
- TodoList - 待办列表
- todo-editor - 待办编辑器
- share-modal - 分享弹窗
- InviteModal - 邀请弹窗
- FilePreviewModal - 文件预览
- data-merge-modal - 数据合并
- ResumePracticeModal - 继续练习
- PosterModal - 海报生成
- CountdownCard - 倒计时卡片
- PracticeBanner - 练习横幅
- EmptyGuide - 空状态引导
- empty-state-home - 首页空状态
- offline-indicator - 离线指示器
- StudyTrendChart - 学习趋势图
- StudyHeatmap - 学习热力图
- SubjectPieChart - 科目饼图
- StudyBookshelf - 学习书架

**业务组件 (business/)**:
- practice/UploadCard - 上传卡片
- practice/MistakesCard - 错题卡片
- practice/AiEntry - AI 入口
- practice/PKLobby - PK 大厅
- practice/RecentTools - 最近工具
- profile/UserProfile - 用户资料
- profile/FriendsList - 好友列表
- profile/ToolsGrid - 工具网格
- profile/ProgressCircle - 进度圆环
- school/EducationForm - 学历表单
- school/AbilityForm - 能力表单
- school/RegionForm - 地区表单
- school/ConfirmForm - 确认表单
- school/StepProgress - 步骤进度
- ai-consult/ai-consult - AI 咨询
- pk-share-card - PK 分享卡片

**布局组件 (layout/)**:
- custom-tabbar - 自定义导航栏
- HomeNavbar - 首页导航

**V0 组件 (v0/)**:
- BubbleCard - 气泡卡片
- BubbleField - 气泡场
- WelcomeBanner - 欢迎横幅
- KnowledgeBubble - 知识气泡
- StatsCard - 统计卡片
- ActivityItem - 活动项

### 3.4 服务层 (13个)

| 服务 | 文件 | 功能 |
|------|------|------|
| HTTP 服务 | http.js | 请求封装、重试机制 |
| Laf 服务 | lafService.js | 后端 API 调用 |
| 存储服务 | storageService.js | 本地/云端存储 |
| 社交服务 | socialService.js | 好友功能 |
| 错误处理 | errorHandler.js | 全局错误处理 |
| 成就引擎 | achievement-engine.js | 成就系统 |
| 签到连续 | checkin-streak.js | 签到功能 |
| 连续恢复 | streak-recovery.js | 连续天数恢复 |
| 排名 Socket | ranking-socket.js | 实时排名 |
| 徽章动画 | badge-animator.js | 徽章动效 |
| 自我定位 | self-position-tracker.js | 用户定位 |
| 邀请链接 | invite-deep-link.js | 深度链接 |
| UI 自动更新 | ui-auto-update.service.js | UI 更新服务 |

### 3.5 Store 模块 (8个)

| 模块 | 文件 | 功能 |
|------|------|------|
| 用户 | user.js | 用户信息、登录状态 |
| 学习 | study.js | 学习数据、进度 |
| 主题 | theme.js | 深色/浅色模式 |
| 应用 | app.js | 应用状态 |
| 学校 | school.js | 择校数据 |
| 待办 | todo.js | 待办事项 |
| 学习轨迹 | learning-trajectory-store.js | 学习轨迹 |
| 入口 | index.js | Store 统一导出 |

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

### 4.3 AI 代理支持的 Action 类型

| Action | 说明 | 使用模型 |
|--------|------|---------|
| generate_questions | 生成题目 | glm-4.5-air |
| analyze | 错题分析 | glm-4.5-air |
| chat | 通用聊天 | glm-4-flash |
| adaptive_pick | 智能组题 | glm-4.5-air |
| material_understand | 资料理解 | glm-4.5-air |
| trend_predict | 趋势预测 | glm-4.5-air |
| friend_chat | AI好友对话 | glm-4-flash |
| vision | 视觉识别 | glm-4v-plus |
| consult | 院校咨询 | glm-4-flash |

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
  hiddenFeatures: ['universe', 'ai-photo-search', 'voice-input']
}
```

### 5.3 构建配置

```javascript
// vite.config.js
export default defineConfig({
  plugins: [uni()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || '')
  }
})
```

---

## 六、开发命令

```bash
# 开发
npm run dev:mp-weixin    # 微信小程序开发
npm run dev:h5           # H5 开发

# 构建
npm run build:mp-weixin  # 微信小程序构建
npm run build:h5         # H5 构建

# 测试
npm run test:visual      # 视觉回归测试
npm run test:visual:update  # 更新快照

# UI 更新
npm run ui:update        # UI 自动更新
npm run ui:status        # 查看更新状态

# 审计
npm run audit:console    # 控制台日志审计
npm run report:generate  # 生成报告
```

---

## 七、部署运维

### 7.1 资源配置

| 组件 | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|------|-------------|-----------|----------------|--------------|----------|
| Backend | 100m | 500m | 256Mi | 512Mi | 2-10 |
| Frontend | 50m | 200m | 64Mi | 128Mi | 2-5 |
| MongoDB | 500m | 2000m | 1Gi | 4Gi | 3 |
| Redis | 100m | 500m | 256Mi | 512Mi | 3 |

### 7.2 部署命令

```bash
# 首次部署
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/rbac.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/secrets.yaml
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/service.yaml
kubectl apply -f deploy/k8s/ingress.yaml
kubectl apply -f deploy/k8s/hpa.yaml

# 验证部署
kubectl get all -n exam-master
kubectl rollout status deployment/exam-master-backend -n exam-master

# 更新部署
kubectl set image deployment/exam-master-backend \
  backend=ghcr.io/exam-master/exam-master-backend:v1.0.1 \
  -n exam-master

# 回滚部署
kubectl rollout undo deployment/exam-master-backend -n exam-master
```

### 7.3 监控告警

| 级别 | 触发条件 | 通知方式 | 响应时间 |
|------|----------|----------|----------|
| P0 | 服务宕机、OOMKilled、错误率>5% | 电话+短信+企业微信 | 5 分钟 |
| P1 | CPU>80%、内存>85%、错误率>1%、延迟>2s | 短信+企业微信 | 15 分钟 |
| P2 | 磁盘>85%、证书30天内过期 | 邮件+企业微信 | 30 分钟 |

### 7.4 备份恢复

```bash
# 全量备份
./deploy/scripts/backup-mongodb.sh full

# 增量备份
./deploy/scripts/backup-mongodb.sh incremental

# 全量恢复
./deploy/scripts/restore-mongodb.sh full exam-master-full-20260127_030000.tar.gz

# 时间点恢复
./deploy/scripts/restore-mongodb.sh point-in-time \
  exam-master-full-20260127_030000.tar.gz \
  "2026-01-27 05:00:00"
```

---

## 八、CI/CD 流水线

### 8.1 流水线阶段

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Push   │───▶│  Lint   │───▶│  Test   │───▶│ Security│───▶│  Build  │───▶│ Deploy  │
│  Code   │    │  Check  │    │  Unit   │    │  Scan   │    │  Image  │    │ Staging │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └────┬────┘
                                                                                │
                                                                                ▼
                                                                         ┌─────────────┐
                                                                         │   Canary    │
                                                                         │  (5% 流量)   │
                                                                         └──────┬──────┘
                                                                                │ 10分钟观察
                                                                                ▼
                                                                         ┌─────────────┐
                                                                         │  Full Deploy│
                                                                         │  (100% 流量) │
                                                                         └─────────────┘
```

### 8.2 GitHub Actions 工作流

| 工作流 | 文件 | 功能 |
|--------|------|------|
| CI/CD | ci-cd.yml | 主流水线 (构建/测试/金丝雀发布) |
| 安全扫描 | security-scan.yml | Trivy/CodeQL 扫描 |
| 备份 | backup.yml | 数据库自动备份 |

---

## 九、应急响应

### 9.1 常见故障处理

| 故障 | 处理方式 |
|------|----------|
| 504 Timeout | 检查 Ingress 超时配置，增加 proxy-read-timeout |
| 503 不可用 | 检查 Pod 状态，查看 Events |
| OOMKilled | 增加内存限制，检查内存泄漏 |
| CrashLoopBackOff | 查看日志定位错误，修复后重新部署 |
| ImagePullBackOff | 检查镜像地址和拉取凭证 |

### 9.2 常用命令

```bash
# 查看所有资源
kubectl get all -n exam-master

# 查看 Pod 日志
kubectl logs -f <pod-name> -n exam-master --tail=100

# 进入 Pod 调试
kubectl exec -it <pod-name> -n exam-master -- /bin/sh

# 查看资源使用
kubectl top pods -n exam-master

# 查看事件
kubectl get events -n exam-master --sort-by='.lastTimestamp'

# 手动扩容
kubectl scale deployment exam-master-backend -n exam-master --replicas=5
```

---

## 十、外部服务依赖

| 服务 | 用途 | 地址 |
|------|------|------|
| 智谱 AI | AI 对话/出题 | api.zhipuai.cn |
| 腾讯云 BDA | 人像分割 | bda.tencentcloudapi.com |
| 微信开放平台 | 小程序登录 | api.weixin.qq.com |

---

## 十一、v2.0 开发规划

### 11.1 技术升级

- UI 渲染优化：Three.js 小程序适配版
- 网络通信：WebSocket 支持云自习室
- AI 服务层：Prompt 管理系统 + 向量数据库

### 11.2 功能规划

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
| Vue 组件 | 55 |
| JS 服务 | 13 |
| Store 模块 | 8 |
| K8s 配置 | 8 |
| 监控配置 | 5 |
| 运维脚本 | 4 |

### B. 项目文档

| 文件 | 说明 |
|------|------|
| PROJECT-REPORT.md | 项目报告 (本文件) |
| DEV_LOG_V1.md | 开发日志 (详细开发记录) |
| deploy/docs/DEPLOYMENT-GUIDE.md | 部署运维手册 |
| deploy/docs/EMERGENCY-RESPONSE.md | 应急响应手册 |

### C. 日志文件

| 文件 | 说明 |
|------|------|
| logs/pm-backlog.json | 产品待办事项 |
| logs/backups/ | 配置备份 |

---

*最后更新: 2026-01-27 (全量扫描) | 维护者: 开发团队*
