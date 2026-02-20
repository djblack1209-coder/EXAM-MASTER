# Exam-Master 项目综合报告

> 最后更新：2026-02-20
> 版本：v2.1（整合历史报告 + 全量审计结果 + 40项代码修复）

---

## 一、项目概述

Exam-Master（考研备考小程序）是一款 AI 驱动的研究生考试备考平台，口号"AI助力，一战成硕"。支持微信小程序、QQ小程序、H5网页、Android/iOS原生App四端运行。

### 核心功能矩阵

| 功能域   | 核心功能                                 | 状态                                |
| -------- | ---------------------------------------- | ----------------------------------- |
| 智能刷题 | 题库练习、AI出题、模拟考试、断点续做     | 已实现                              |
| PK对战   | 实时匹配、排行榜、邀请对战               | 已实现                              |
| AI服务   | AI聊天、拍照搜题、智能分析、语音服务     | 已实现（语音未接入前端）            |
| 择校分析 | 学校查询、AI择校咨询、数据爬虫           | 已实现                              |
| 学习系统 | 学习计划、目标追踪、知识图谱、自适应学习 | 已实现                              |
| 社交功能 | 好友列表、学习小组、邀请系统             | 部分实现（小组/素材管理未接入前端） |
| 工具箱   | 证件照、文档转换、拍照搜题               | 已实现                              |
| 错题本   | 错题收集、标签管理、AI分析、报告生成     | 已实现                              |
| 收藏夹   | 题目收藏、资源收藏                       | 已实现                              |
| 成就系统 | 徽章、成就解锁、学习统计                 | 已实现                              |

---

## 二、技术架构

### 2.1 技术栈

| 层级     | 技术选型                                       |
| -------- | ---------------------------------------------- |
| 前端框架 | Vue 3.4.21 (Composition API + Options API)     |
| 跨平台   | uni-app (@dcloudio alpha-5000020260104004)     |
| 状态管理 | Pinia 2.1.7                                    |
| 构建工具 | Vite 5.2.8                                     |
| 样式系统 | SCSS + 双主题（Wise绿/Bitget暗）+ 暗黑模式     |
| 后端     | Laf Cloud Functions（Serverless）              |
| 数据库   | MongoDB                                        |
| AI引擎   | 智谱AI (GLM-4-Plus) + SiliconFlow（多Key轮转） |
| 外部服务 | 腾讯云COS、CloudConvert、SerpApi、Brave Search |
| 测试     | Vitest 4.x + Playwright + @vue/test-utils      |
| CI/CD    | GitHub Actions（3条流水线）                    |
| 部署     | Docker + Kubernetes + Nginx                    |
| 监控     | Prometheus + Alertmanager + Grafana            |

### 2.2 代码量统计

| 区域              | 文件数   | 代码行数（估算） |
| ----------------- | -------- | ---------------- |
| 前端 src/         | 233      | ~91,000          |
| 后端 laf-backend/ | ~113     | ~20,000          |
| 测试 tests/       | 26       | ~3,500           |
| 脚本 scripts/     | 29       | ~4,000           |
| 部署 deploy/      | 000      |
| 文档 docs/        | 5        | ~1,500           |
| **合计**          | **~522** | **~122,000**     |

### 2.3 项目结构

```
EXAM-MASTER/
├── src/                          # 前端源码
│   ├── pages/                    # 18个页面模块（85个文件）
│   │   ├── index/                # 首页
│   │   ├── practice/             # 智能刷题
│   │   ├── practice-sub/         # 刷题子页面（31个文件，最复杂模块）
│   │   ├── school/               # 择校分析
│   │   ├── school-sub/           # 学校详情+AI咨询
│   │   ├── profile/              # 个人中心
│   │   ├── chat/                 # AI聊天
│   │   ├── login/                # 登录（微信/QQ/邮箱）
│   │   ├── social/               # 社交
│   │ls/                # 工具箱
│   │   ├── plan/                 # 学习计划
│   │   ├── mistake/              # 错题本
│   │   ├── favorite/             # 收藏夹
│   │   ├── knowledge-graph/      # 知识图谱
│   │   ├── study-detail/         # 学习详情
│   │   ├── universe/             # 探索宇宙（游戏化）
│   │   ├── settings/             # 设置
│   │   └── splash/               # 启动页
│   ├── components/               # 31个可复用组件
│   ├── stores/                   # 8个Pinia Store
│   ├── services/                 # 5个服务层文件
│   ├── utils/                    # 49个工具函数
│   ├── styles/                   # 10个样式文件（设计系统+主题）
│   ├── mixins/                   # 7个Vue Mixin
│   └── config/                   # 配置文件
├── laf-backend/                  # 后端云函数
│   ├── functions/                # 32个云函数
│   ├── utils/                    # 7个后端工具
│   ├── types/                    # TypeScript类型定义（1505行）
│   ├── database-schema/          # 19个数据库Schema
│   └── triggers/                 # 数据库触发器
├── tests/                        # 测试（17个单元测试）
├── deploy/                       # 部署配置（Docker + K8s + 监控）
├── scripts/                      # 构建/测试/修复/优化脚本
└── .github/workflows/            # CI/CD流水线（3条）
```

---

## 三、前后端集成映射

### 3.1 已对接的API（36个端点）

| 功能域     | 前端函数                          | 后端函数               | 状态      |
| ---------- | --------------------------------- | ---------------------- | --------- |
| AI服务     | proxyAI() 等7个                   | proxy-ai.ts            | ✅ 已对接 |
| 拍照搜题   | photoSearch()                     | ai-photo-search.ts     | ✅ 已对接 |
| 登录       | login()                           | login.ts               | ✅ 已对接 |
| 用户资料   | updateUserProfile()               | user-profile.ts        | ✅ 已对接 |
| 收藏管理   | add/get/remove/checkFavorite()    | favorite-manager.ts    | ✅ 已对接 |
| 学习资源   | 4个资源函数                       | learning-resource.ts   | ✅ 已对接 |
| 学习目标   | sync/get/recordGoalProgress()     | learning-goal.ts       | ✅ 已对接 |
| 成就系统   | check/getAll/unlockAchievement()  | achievement-manager.ts | ✅ 已对接 |
| 邀请系统   | handle/claim/getInviteInfo()      | invite-service.ts      | ✅ 已对接 |
| 用户统计   | getUserStatsOverview()            | user-stats.ts          | ✅ 已对接 |
| 文档转换   | 4个文档函数                       | doc-convert.ts         | ✅ 已对接 |
| 证件照     | getPhotoConfig/process/removeBg() | photo-bg.ts            | ✅ 已对接 |
| 排行榜     | rankCenter()                      | rank-center.ts         | ✅ 已对接 |
| 社交服务   | socialService()                   | social-service.ts      | ✅ 已对接 |
| 错题管理   | (via storageService)              | mistake-manager.ts     | ✅ 已对接 |
| PK对战     | (via pk-battle.vue)               | pk-battle.ts           | ✅ 已对接 |
| 答题提交   | (via offline-cache.js)            | answer-submit.ts       | ✅ 已对接 |
| 头像上传   | (via settings/profile)            | upload-avatar.ts       | ✅ 已对接 |
| 题库查询   | getQuestionBank/Random()          | question-bank.js       | ✅ 已对接 |
| 学习统计   | getStudyStats()                   | study-stats.js         | ✅ 已对接 |
| AI好友记忆 | getAiFriendMemory()               | ai-friend-memory.js    | ✅ 已对接 |
| 邮箱验证码 | sendEmailCode()                   | send-email-code.js     | ✅ 已对接 |
| 学校查询   | 5个学校函数                       | school-query.js        | ✅ 已对接 |

### 3.2 集成Gap

| 后端函数                 | 状态          | 说明                           |
| ------------------------ | ------------- | ------------------------------ |
| voice-service.ts         | ⚠️ 未接入前端 | 仅在限流配置中出现，无实际调用 |
| group-service.js         | ⚠️ 未接入前端 | 学习小组功能，前端零引用       |
| material-manager.js      | ⚠️ 未接入前端 | 素材管理功能，前端零引用       |
| school-crawler-api.ts    | ✅ 预期无前端 | 爬虫API，仅后台管理用途        |
| data-cleanup.ts          | ✅ 预期无前端 | 管理员维护功能                 |
| db-create-indexes.ts     | ✅ 预期无前端 | 数据库维护                     |
| db-migrate-timestamps.ts | ✅ 预期无前端 | 数据迁移                       |
| health-check.ts          | ✅ 预期无前端 | 运维健康检查                   |

---

## 四、代码复杂度热点

### 4.1 Top 20 最大源文件

| 排名 | 文件                                   | 行数 | 风险等级 |
| ---- | -------------------------------------- | ---- | -------- |
| 1    | src/pages/practice-sub/pk-battle.vue   | 2685 | 极高     |
| 2    | src/pages/practice-sub/import-data.vue | 2322 | 极高     |
| 3    | src/pages/school/index.vue             | 2166 | 极高     |
| 4    | src/pages/practice-sub/do-quiz.vue     | 1973 | 极高     |
| 5    | src/services/lafService.js             | 1800 | 极高     |
| 6    | laf-backend/functions/proxy-ai.ts      | 1711 | 极高     |
| 7    | src/pages/settings/index.vue           | 1565 | 高       |
| 8    | src/pages/universe/index.vue           | 1558 | 高       |
| 9    | src/pages/practice-sub/rank.vue        | 1496 | 高       |
| 10   | src/pages/chat/chat.vue                | 1494 | 高       |

### 4.2 后端复杂度分布

| 复杂度          | 数量 | 说明                             |
| --------------- | ---- | -------------------------------- |
| 大型(>500行)    | 16   | proxy-ai, school-query, login 等 |
| 中型(200-500行) | 10   | social-service, rank-center 等   |
| 小型(<200行)    | 6    | study-stats, question-bank 等    |

---

## 五、测试覆盖

### 5.1 单元测试（17个spec文件）

| 测试文件                         | 覆盖范围                                                |
| -------------------------------- | ------------------------------------------------------- |
| real-utils.spec.js               | 工具函数实际测试                                        |
| api.spec.js                      | API服务层                                               |
| quiz-modules.spec.js             | 刷题模块逻辑                                            |
| adaptive-learning-engine.spec.js | 自适应学习算法                                          |
| functional-tests.spec.js         | 跨模块功能测试                                          |
| utils.spec.js                    | 通用工具函数                                            |
| components.spec.js               | Vue组件渲染                                             |
| field-normalizer.spec.js         | 字段标准化                                              |
| 其他9个                          | AI路由、错误处理、配置、存储、格式化、待办Store、主题等 |

### 5.2 测试覆盖Gap

- 无后端云函数测试（仅有脚本级集成测试）
- 无E2E端到端测试
- 页面组件测试仅覆盖基础渲染，缺少交互测试
- 无安全渗透测试（仅代码级审查）

---

## 六、CI/CD与DevOps

| 流水线            | 触发条件                      | 功能                                                    |
| ----------------- | ----------------------------- | ------------------------------------------------------- |
| ci-cd.yml         | Push main/develop, PR to main | Lint + Test → 安全扫描 → 构建H5 → Docker镜像 → 镜像扫描 |
| security-scan.yml | 每周一凌晨2点 + 手动          | 依赖漏洞扫描 + CodeQL + Trivy容器扫描                   |
| backup.yml        | 每周日凌晨3点 + 手动          | MongoDB备份 → 归档 → 上传Artifact(30天保留)             |

---

## 七、全量测试结果

### 7.1 功能测试（2026-02-19）

| 模块     | 测试项                                                                                   | 结果        |
| -------- | ---------------------------------------------------------------------------------------- | ----------- |
| 首页     | 欢迎横幅、统计卡片、学习时长、知识气泡、活动列表、推荐、工具入口、待办、每日金句、骨架屏 | ✅ 全部通过 |
| 登录     | 微信登录、QQ登录、邮箱登录、错误处理                                                     | ✅ 全部通过 |
| 练习     | 题库状态、学习统计、AI生成进度、主要操作区、功能菜单                                     | ✅ 全部通过 |
| 学校查询 | 三步流程、AI分析、院校数据库、目标管理                                                   | ✅ 全部通过 |
| 错题本   | 错题管理、统计卡片、重练模式、报告生成                                                   | ✅ 全部通过 |
| 个人中心 | 用户信息、学习数据、主题切换                                                             | ✅ 全部通过 |

### 7.2 数据测试

- ✅ 大部分数据来自本地存储或后端API
- ⚠️ 首页配置文件中存在静态模拟数据（金句、公式、知识点等）
- ✅ 本地存储正常，数据在应用重启后保持
- ✅ 支持离线缓存和网络恢复后同步

### 7.3 后端接口完整性

- ✅ 21个云函数已与前端对接
- ⚠️ 3个云函数未接入前端（voice-service、group-service、material-manager）
- ✅ 4个管理/运维函数无需前端对接

---

## 八、问题汇总与修复记录

### 8.1 v2.1 全量代码审计修复（40项，2026-02-20）

20个审计阶段，覆盖全部前后端代码，共修复40项安全/Bug问题：

| 阶段        | 范围           | 修复数 | 关键修复                                          |
| ----------- | -------------- | ------ | ------------------------------------------------- |
| Phase 2     | 登录认证       | 3      | loginGuard缺失导入、CSRF绕过修复                  |
| Phase 4a    | 练习核心       | 2      | do-quiz关闭结果、mock-exam Vue2响应式             |
| Phase 4c    | 后端函数       | 1      | material-manager分页修复                          |
| Phase 5     | 院校查询       | 1      | school-query userId鉴权绕过                       |
| Phase 7     | 学习管理       | 2      | formatDate修复、user-stats鉴权绕过                |
| Phase 9     | 个人中心       | 4      | 主题监听器、缓存清理、成就鉴权、变量遮蔽          |
| Phase 11    | 后端基础设施   | 3      | data-cleanup空密钥、db-migrate分页×2              |
| Phase 12    | 后端未审计函数 | 7      | 5个函数添加JWT鉴权、SSRF防护、鉴权绕过            |
| Phase 13    | 核心工具       | 4      | 网络监听器泄漏、离线队列竞态、重试误报            |
| Phase 14-15 | 学习/练习工具  | 7      | 时区修复、排序变异、标签去重、边界修复、NaN防护   |
| Phase 16-17 | 辅助工具+Store | 4      | 缺失导入、缩放Bug、负值防护、falsy 0处理          |
| Phase 18    | 服务+Mixin     | 2      | 签到时区修复×2                                    |
| Phase 19-20 | 页面+子组件    | 5      | 动画泄漏、URL校验、定时器泄漏、截断修复、导入修复 |

提交记录：`824d469 fix: 全量代码审计 — 40项安全/Bug修复（Phase 1-20）`

### 8.2 v1.1.1 历史修复（6项）

| #   | 问题                            | 修复内容                                  |
| --- | ------------------------------- | ----------------------------------------- |
| 1   | 前端硬编码混淆密钥              | 迁移至 config/index.js security 配置段    |
| 2   | 配置文件敏感值硬编码            | 改为空字符串 + 安全检查                   |
| 3   | handleUpdateStatus 返回码不一致 | 统一为 code: 0                            |
| 4   | login.ts 重复用户创建代码       | 提取 buildNewUserData() + createNewUser() |
| 5   | mistake-manager 内存过滤2000条  | 改用 MongoDB $in/$all + DB级过滤          |
| 6   | learning-resource $regex无索引  | 添加关键词长度限制(50字符) + 索引建议     |

### 8.3 仍然开放的问题

| #   | 级别 | 问题                          | 涉及文件                   |
| --- | ---- | ----------------------------- | -------------------------- |
| 1   | P0   | 特定环境下登录失败            | login/index.vue, login.ts  |
| 2   | P0   | AI择校分析超时                | proxy-ai.ts                |
| 3   | P0   | 题库生成导致UI卡顿            | practice/index.vue         |
| 4   | P0   | 离线模式数据加载失败          | storageService.js          |
| 5   | P0   | AI服务依赖外部API Key部署风险 | proxy-ai.ts                |
| 6   | P1   | 学校详情页硬编码mock数据      | school-sub/detail.vue      |
| 7   | P1   | 学校匹配分数使用随机值        | school-sub/detail.vue      |
| 8   | P1   | 模拟考试使用静态数据          | practice-sub/mock-exam.vue |
| 9   | P2   | 模块间功能重复                | navigationMixin + 各页面   |
| 10  | P3   | UI交互不够流畅                | 多个页面                   |
| 11  | P3   | 数据同步延迟                  | storageService.js          |

### 8.4 前后端功能完整性

**前端已开发但后端可能需完善的功能：**

1. AI 导师功能 — 前端UI存在，后端逻辑完整性未知
2. 学习轨迹分析 — 前端展示存在，后端分析算法完整性未知
3. 个性化推荐 — 前端展示存在，后端推荐算法完整性未知
4. 首页动态数据 — 前端已实现，后端 `/getHomeData` 已实现

**后端已实现但前端未集成的功能：**

1. voice-service.ts — 语音服务
2. group-service.js — 学习小组
3. material-manager.js — 素材管理

---

## 九、风险评估

| 风险域       | 等级 | 说明                                                     |
| ------------ | ---- | -------------------------------------------------------- |
| 代码复杂度   | 高   | Top 6文件均超1700行，pk-battle.vue达2685行               |
| 前后端一致性 | 中   | 3个后端功能未接入前端，多处mock数据                      |
| 安全性       | 中   | v2.1已修复40项安全/Bug问题，但仍需持续审计               |
| 性能         | 中   | 大文件渲染、AI超时、弱网退化                             |
| 可维护性     | 中   | Options API + Composition API混用，Mixin与Composable并存 |
| 测试覆盖     | 高   | 无后端测试、无E2E、无安全测试                            |

---

## 十、修复优先级建议

### 第一优先级（1-3天）：P0 安全与功能

1. 修复特定环境下登录失败
2. AI择校分析超时保护
3. 题库生成UI卡顿优化
4. 离线模式数据加载修复
5. 确保AI服务API Key安全配置

### 第二优先级（3-7天）：P1 功能缺陷

6. 替换学校详情页硬编码mock数据
7. 实现真实的院校匹配算法
8. 模拟考试接入真实数据
9. 接入voice-service/group-service/material-manager

### 第三优先级（1-2周）：P2 代码质量

10. 统一导航逻辑，消除重复
11. 统一日志系统
12. 拆分超大文件

### 第四优先级（2-4周）：P3 体验优化

13. UI交互流畅度优化
14. 数据同步延迟优化
15. 错误提示友好化

---

## 十一、后续计划

### 功能迭代

- **V1.2**: 增强AI学习助手功能，添加更多练习模式
- **V1.3**: 完善社交功能，增加学习社区
- **V2.0**: 推出PC端，实现多端同步

### 技术升级

- AI模型升级到更先进版本
- 微服务架构改造
- 补充后端测试和E2E测试

### 市场拓展

- 扩展到其他考试领域（公务员、托福、雅思等）
- 与教育机构合作
- 国际化支持

---

## 附录：测试历史

| 测试时间   | 测试范围       | 主要发现                                        |
| ---------- | -------------- | ----------------------------------------------- |
| 2025-07-23 | 发布前全面排查 | 硬编码mock数据、前后端对接问题、代码质量问题    |
| 2026-02-17 | v1.1.1深度审计 | 6项修复（密钥硬编码、返回码不一致、内存过滤等） |
| 2026-02-19 | 全量测试       | 核心功能全部通过，发现P0-P3级问题若干           |
| 2026-02-19 | 16批次深度检测 | 314+问题（23个P0、101个P1、150个P2、40+个P3）   |
| 2026-02-20 | 全量代码审计   | 40项安全/Bug修复（20个审计阶段）                |

---

_本报告整合自项目历史全部测试报告、检测报告、问题清单与修复记录。_
