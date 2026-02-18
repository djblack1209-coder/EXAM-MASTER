# Exam-Master 项目综合报告

> 最后更新：2026-02-17 | 项目版本：v1.1.1 | 技术栈：uni-app + Vue 3.4.21 + Pinia 2.1.7

---

## 一、项目概述

**Exam-Master** 是一款面向考研学生的智能备考微信小程序，集成 AI 辅助学习、智能刷题、择校分析、社交互动等核心功能。

| 属性 | 值 |
|------|-----|
| 版本号 | 1.1.1 |
| AppID | wxd634d50ad63e14ed |
| 后端服务 | Sealos (nf98ia8qnt.sealosbja.site) |
| AI 模型 | GLM-4-Plus |
| 技术栈 | uni-app + Vue 3.4.21 + Pinia 2.1.7 |

---

## 二、功能模块

### 2.1 TabBar 主导航

| 模块 | 路径 | 功能 |
|------|------|------|
| 首页 | /pages/index | 学习概览、今日任务、每日金句 |
| 刷题 | /pages/practice | 智能刷题、PK 对战、错题本 |
| 择校 | /pages/school | AI 择校分析、院校推荐 |
| 我的 | /pages/profile | 个人中心、学习统计、设置 |

### 2.2 核心页面 (27个)

- 首页、刷题首页、做题页、导入资料、PK 对战、排行榜、模拟考试
- 文件管理、错题本、择校首页、院校详情、个人中心、设置
- 好友列表、好友详情、学习计划、创建计划、学习详情
- AI 聊天、拍照搜题、探索宇宙、启动页、排行详情
- 学习小组、小组详情
- **文档转换**（V1.1.0 新增）、**证件照制作**（V1.1.0 新增）

### 2.3 AI 代理 Action 类型

| Action | 说明 | 模型 |
|--------|------|------|
| generate_questions | 生成题目 | glm-4.5-air |
| analyze | 错题分析 | glm-4.5-air |
| chat | 通用聊天 | glm-4-flash |
| vision | 视觉识别 | glm-4v-plus |
| consult | 院校咨询 | glm-4-flash |

---

## 三、项目结构

### 3.1 目录组织

```
EXAM-MASTER/
├── src/                # 前端源代码
│   ├── pages/          # 25 个页面
│   ├── components/     # 55 个组件
│   ├── stores/         # 8 个 Pinia 模块
│   ├── services/       # 15 个服务文件
│   └── config/         # 配置文件
├── laf-backend/        # 后端云函数
│   ├── functions/      # 云函数
│   └── database-schema/ # 数据库 schema
├── deploy/             # 部署配置 (K8s/Docker/监控)
├── docs/               # 技术文档 (API/组件/工具/脚本)
├── scripts/            # 开发/测试脚本
└── tests/              # 单元测试和视觉测试
```

### 3.2 架构特点

- **前后端分离**：前端和后端代码分离，通过 API 进行通信
- **模块化设计**：功能模块化，便于维护和扩展
- **多端支持**：基于 Uni-app 开发，支持微信小程序、H5、App 等多端
- **AI 集成**：集成了 GLM-4 模型，提供智能问答、分析等功能
- **安全性考虑**：实现了 JWT 认证、密码加密、权限检查等安全措施

---

## 四、外部依赖

| 服务 | 用途 |
|------|------|
| 智谱 AI | AI 对话/出题 |
| 腾讯云 BDA | 人像分割/证件照处理 |
| CloudConvert | 文档格式转换 |
| 微信开放平台 | 小程序登录 |

---

## 五、开发命令

```bash
npm run dev:mp-weixin    # 微信小程序开发
npm run build:mp-weixin  # 微信小程序构建
npm run dev:h5           # H5 开发
npm run test             # 运行测试
npm run lint             # 代码质量检查
npm run lint:fix         # 自动修复代码质量问题
```

---

## 六、部署运维

### 6.1 资源配置

| 组件 | CPU | Memory | Replicas |
|------|-----|--------|----------|
| Backend | 100m-500m | 256Mi-512Mi | 2-10 |
| Frontend | 50m-200m | 64Mi-128Mi | 2-5 |

### 6.2 常用命令

```bash
# 部署
kubectl apply -f deploy/k8s/

# 查看状态
kubectl get all -n exam-master

# 查看日志
kubectl logs -f <pod-name> -n exam-master
```

### 6.3 监控告警

| 级别 | 触发条件 | 响应时间 |
|------|----------|----------|
| P0 | 服务宕机、错误率>5% | 5 分钟 |
| P1 | CPU>80%、延迟>2s | 15 分钟 |
| P2 | 磁盘>85% | 30 分钟 |

### 6.4 应急响应

| 级别 | 响应时间 | 通知方式 |
|------|----------|----------|
| P0 | 5 分钟 | 电话+短信+企业微信 |
| P1 | 15 分钟 | 短信+企业微信 |
| P2 | 30 分钟 | 邮件+企业微信 |

```bash
# 查看 Pod 状态
kubectl get pods -n exam-master -o wide
kubectl describe pod <pod-name> -n exam-master

# 手动扩容
kubectl scale deployment exam-master-backend -n exam-master --replicas=5

# 回滚部署
kubectl rollout undo deployment/exam-master-backend -n exam-master
```

---

## 七、审核模式

```javascript
// src/config/index.js
audit: {
  isAuditMode: true,
  hiddenFeatures: ['universe', 'ai-photo-search', 'voice-input']
}
```

---

## 八、开发日志

### 8.1 V1.0.0 (2026-01-27 ~ 2026-02-05)

**项目状态**: Golden Master，已发布

#### 已完成核心任务

| 任务 | 说明 |
|------|------|
| 项目文档整理 | 清理多余文档，建立统一管理规范 |
| 云原生运维体系 | K8s 部署、监控告警、备份恢复 |
| 环境重置与基线锁定 | 依赖版本锁定 (vue@3.4.21, pinia@2.1.7) |
| UI/UX 微调 | TabBar 热区、安全区域适配、深色模式 |
| 后端安全加固 | Audit-Mode 拦截、速率限制、事务一致性 |
| 前端代码审查 | JSON.parse 异常兜底、防抖节流、空状态 |
| 构建配置修复 | 修复 process is not defined 错误 |
| 导航栏修复 | 页面路径修复、图标文件更新 |
| QA 全量回归测试 | 破坏性测试、审核模式穿透测试 |

#### 安全修复

| 漏洞 | 修复方案 |
|------|----------|
| 审核模式后端缺失 | proxy-ai.js 新增 Audit-Mode 拦截 |
| ai-photo-search 绕过 | 新增审核模式检查 |
| JSON 解析边界 | 新增安全响应包装器 |
| 前端空数据白屏 | 模板空值防护 + JS 数据校验 |

#### 刷题功能集成 (2026-02-05)

集成 18 个功能模块，覆盖刷题功能各个方面：

| 分类 | 模块数量 | 主要功能 |
|------|----------|----------|
| 学习核心 | 8个 | 智能组题、自适应学习、间隔重复、知识图谱、收藏、笔记、离线缓存、答题动画 |
| 数据分析 | 4个 | 学习分析、错题归因、薄弱预警、AI解析 |
| 用户体验 | 6个 | 单题计时、滑动手势、连击特效、里程碑动画 |

核心算法：
- **SM-2 间隔重复算法**：考虑个人学习能力差异，动态调整难度系数 (1.3-3.0)
- **智能组题**：70%薄弱知识点 + 30%其他题目，基于遗忘曲线自动插入复习题
- **学习热力图**：365天学习记录可视化

### 8.2 V1.0.0 全面排查测试 (2026-02-06 ~ 2026-02-07)

#### 测试范围
- 全项目代码分析、前端页面功能测试、后端API功能验证、API对接检查、代码质量检查

#### 发现的主要问题

| 级别 | 问题 |
|------|------|
| P0 | ESLint配置错误、后端环境变量依赖、硬编码模拟数据 |
| P1 | 重复页面功能、API对接异常处理不完善、缺少TypeScript类型定义 |
| P2 | 代码风格不一致、缺少单元测试、性能优化空间 |
| P3 | 注释不完整、变量命名不规范、冗余代码 |

#### 修复记录 (2026-02-07)

| 类别 | 修复内容 |
|------|----------|
| 硬编码数据 | lafService.js 移除 Mock 数据，storageService.js 添加环境检测开关 |
| 重复代码 | login.js 删除重复 QQ 登录实现 |
| 代码结构 | store/modules/user.js 标记废弃，stores/modules/user.js 改用真实 API |
| 错误处理 | lafService.js 增强响应解析、认证错误区分、网络错误细分 |
| 数据同步 | storageService.js 新增同步状态监控和冲突解决机制 |
| 数据验证 | social-service.js 增强输入验证、正则转义、长度限制 |

### 8.3 V1.1.0 (2026-02-16)

#### 新增功能

1. **文档转换工具**（免费）
   - 支持 Word↔PDF、Excel→PDF、PPT→PDF、图片↔PDF 六种转换
   - 后端云函数 `doc-convert.ts` 基于 CloudConvert API
   - 前端页面 `pages/tools/doc-convert.vue`

2. **证件照制作工具**（免费）
   - 支持智能抠图、背景颜色替换（白/蓝/红/灰/浅蓝/深蓝）、多种证件照尺寸
   - 后端云函数 `photo-bg.ts` 基于腾讯云 BDA 人像分割 API
   - 前端页面 `pages/tools/id-photo.vue`

3. **首页实用工具入口**
   - 首页新增「实用工具」卡片区域，包含文档转换、证件照制作、拍照搜题三个入口

#### 代码质量
- 修复 11 项代码问题（5 critical / 4 medium / 2 low）
- auth-storage.js 重写支持 V2 Feistel 解密格式
- 全部 275 项单元测试通过，WeChat 构建零错误零警告

### 8.4 V1.1.1 代码审计 (2026-02-17)

深度代码审计识别 6 个真实存在的问题，全部已修复，292 项单元测试通过：

| 批次 | 优先级 | 问题 | 修复方案 |
|------|--------|------|----------|
| 1 | P1 | 硬编码混淆密钥出现在3个客户端文件 | `config/index.js` 新增 `security` 配置节，支持环境变量覆盖 |
| 2 | P2 | `handleUpdateStatus` 返回码不一致 | 改为 `code: 0` |
| 3 | P2 | `config/index.js` 硬编码敏感 fallback 值 | 改为空字符串 + 安全检查 |
| 4 | P3 | `login.ts` 用户创建代码重复 | 提取 `buildNewUserData()` + `createNewUser()` |
| 5 | P3 | `handleGetByTags`/`handleGetCategories` 内存过滤 | 改用 DB 级 `$in`/`$all` 和 `aggregate` |
| 6 | P3 | `learning-resource.ts` `$regex` 搜索无索引 | 添加长度限制 + 索引建议 |

审计同时确认大量问题为误报（lafService/storageService 无 mock 数据、proxy-ai 已有限流和熔断、learning-goal 已有权限检查等）。

---

## 九、功能完善建议

### 9.1 优先级划分

| 优先级 | 功能模块 | 建议完善项 |
|--------|----------|------------|
| P0 (高) | 智能学习计划 | 动态计划调整、多维度计划管理、智能提醒 |
| P0 (高) | 知识点图谱 | 知识关联分析、个性化学习路径、薄弱点智能定位 |
| P0 (高) | AI导师 | 多模态交互、个性化教学风格、实时答疑 |
| P0 (高) | 数据统计与分析 | 多维度学习报告、进步趋势追踪、同水平对比 |
| P1 (中) | 题目质量 | 题目难度分级、多题型支持、题目解析增强 |
| P1 (中) | 练习模式 | 专项突破模式、限时训练模式、错题变式练习 |
| P1 (中) | 社交与社区 | 学习小组、资源共享、话题讨论区 |
| P1 (中) | 用户体验 | 个性化首页、深色模式优化、多端同步 |
| P2 (低) | 商业化 | VIP会员、付费课程、一对一辅导 |
| P2 (低) | 多考试类型 | 公务员、教师编、考证等多种考试类型支持 |

---

## 十、关键文件路径

| 功能 | 文件 |
|------|------|
| 前端 AI 服务 | `src/services/lafService.js` |
| 后端 AI 代理 | `laf-backend/functions/proxy-ai.ts` |
| 审核模式配置 | `src/config/index.js` |
| 全局错误处理 | `src/services/errorHandler.js` |
| 设计系统 | `src/styles/design-system.scss` |
| 本地存储服务 | `src/services/storageService.js` |
| 认证存储 | `src/services/auth-storage.js` |

---

*报告生成日期：2026-10 | V1.1.0 更新：2026-02-16 | V1.1.1 更新：2026-02-17*
