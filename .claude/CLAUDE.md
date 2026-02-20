# Exam-Master AI 智能开发团队配置

---

## 项目概述

Exam-Master 是一个基于 uni-app + Vue 3 + Laf Cloud 的全栈考研备考应用，支持微信小程序、QQ小程序和 H5。

### 技术栈

| 层级     | 技术                                                                 |
| -------- | -------------------------------------------------------------------- |
| 前端框架 | uni-app + Vue 3 (Composition API + `<script setup>`) + Pinia         |
| 后端服务 | Laf Cloud (Sealos) + TypeScript                                      |
| 数据库   | MongoDB (Laf 内置)                                                   |
| AI 能力  | 智谱 GLM 系列 (glm-4-flash / glm-4-plus / glm-4.5-air / glm-4v-plus) |
| 构建工具 | Vite 5                                                               |
| 样式     | SCSS + 设计令牌                                                      |
| 测试     | Vitest (单元) + Playwright (视觉回归)                                |
| 代码规范 | ESLint 9 + Prettier + Husky + Commitlint                             |

### 项目结构

```
exam-master/
├── src/                        # 前端源码
│   ├── pages/                  #   页面（主包）
│   │   ├── chat/               #   AI 聊天（4个AI好友角色）
│   │   ├── practice/           #   刷题练习
│   │   ├── practice-sub/       #   练习子包
│   │   ├── school/             #   院校查询
│   │   ├── school-sub/         #   院校子包
│   │   ├── social/             #   社交功能（PK/排行/好友）
│   │   └── ...
│   ├── components/             #   组件（base / business）
│   ├── composables/            #   组合式函数
│   ├── services/               #   服务层
│   │   ├── lafService.js       #   核心 API 客户端（统一请求/缓存/签名）
│   │   ├── storageService.js   #   本地存储抽象
│   │   └── auth-storage.js     #   认证令牌读取
│   ├── stores/modules/         #   Pinia 状态管理
│   │   ├── user.js             #   用户/认证/VIP/社交
│   │   ├── study.js            #   学习进度
│   │   ├── school.js           #   院校数据
│   │   └── ...
│   ├── utils/                  #   工具函数
│   ├── config/index.js         #   应用配置（读取 VITE_* 环境变量）
│   └── styles/                 #   全局样式 / 设计令牌
├── laf-backend/                # 后端云函数（46个）
│   ├── functions/              #   云函数入口
│   │   ├── proxy-ai.ts         #   AI 代理（核心）
│   │   ├── login.ts            #   登录认证
│   │   ├── question-bank.js    #   题库
│   │   ├── social-service.ts   #   社交服务
│   │   ├── _shared/            #   共享模块
│   │   └── ...
│   └── database-schema/        #   数据库 Schema
├── tests/                      # 测试用例
└── deploy/                     # 部署配置
```

### 编码规范

- 前端全部使用 Vue 3 Composition API + `<script setup>`
- Pinia Store 使用 `defineStore('name', () => {...})` 组合式风格
- 路径别名 `@` → `src/`
- JSDoc 类型注释（前端无 TypeScript，后端用 TypeScript）
- 使用 `@/utils/logger.js` 统一日志（生产环境自动禁用）
- 内联标签追踪 Bug/Feature：`✅ P1-2`、`✅ B021`、`✅ F024`

---

## 智能体架构

### 核心智能体

1. **技术负责人** - `/agent tech-leader`
   - 技术决策和团队协调
   - `.claude/agents/tech-leader.md`

2. **产品经理** - `/agent product_manager`
   - 考研产品规划、需求分析、用户研究
   - `.claude/agents/product_manager.md`

3. **前端开发** - `/agent frontend_dev`
   - uni-app + Vue 3 开发、小程序适配
   - `.claude/agents/frontend_dev.md`

4. **后端开发** - `/agent backend_dev`
   - Laf 云函数、MongoDB、智谱 AI 集成
   - `.claude/agents/backend_dev.md`

5. **QA工程师** - `/agent qa_engineer`
   - Vitest 单元测试、Playwright 视觉测试
   - `.claude/agents/qa_engineer.md`

6. **DevOps工程师** - `/agent devops_engineer`
   - Laf 部署、Sealos 运维、CI/CD
   - `.claude/agents/devops_engineer.md`

### 快捷命令

- `/pm` - 产品经理
- `/fe` - 前端开发
- `/be` - 后端开发
- `/qa` - QA工程师
- `/ops` - DevOps工程师
- `/tl` - 技术负责人

### 工作流示例

```bash
# 考研备考新功能完整流程
/agent product_manager "分析考研倒计时功能需求，包含每日学习计划推荐"
/agent backend_dev "在 Laf 云函数中实现学习计划 API，集成智谱 AI 生成个性化计划"
/agent frontend_dev "创建倒计时页面和学习计划组件，适配微信小程序"
/agent qa_engineer "为学习计划功能编写 Vitest 单元测试"
/agent devops_engineer "部署新云函数到 Laf 生产环境"
```

---

## ⚠️ Thread Manager 输出显示规则

当使用 `thread-manager` MCP 工具时：

1. 直接原样展示 `message` 字段，禁止总结或改写
2. 展示后立即停止输出，禁止添加额外回复
3. 确保完整性，不折叠或省略内容
