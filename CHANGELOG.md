# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-02-21

首个正式发布版本。涵盖考研备考小程序全部核心功能、安全加固、全链路集成测试、代码审计及文档整合。

### Added

- 智能刷题系统：题库练习、AI 出题、模拟考试、断点续做
- PK 对战：实时匹配、排行榜、邀请对战
- AI 服务：AI 聊天、拍照搜题、智能分析（GLM-4-Plus + SiliconFlow 多 Key 轮转）
- 择校分析：学校查询、AI 择校咨询、数据爬虫
- 学习系统：学习计划、目标追踪、知识图谱、自适应学习引擎
- 社交功能：好友列表、邀请系统
- 错题本：错题收集、标签管理、AI 分析、报告生成
- 收藏夹：题目收藏、资源收藏
- 成就系统：徽章、成就解锁、学习统计
- 个人中心：用户信息管理、主题切换（Wise 绿/Bitget 暗 + 暗黑模式）
- 登录系统：微信、QQ、邮箱三种登录方式
- 文档转换工具（Word/PDF/Excel 互转，基于 CloudConvert）
- 证件照制作工具（AI 抠图 + 背景替换 + 美颜）
- AI 好友对话功能（4 个 AI 角色）
- 收藏模块 API、学习资源推荐 API、拍照搜题 API
- 统一 API 响应格式 + 速率限制
- 后端 34 个 Laf 云函数、19 个 MongoDB 数据库 Schema
- CI/CD：GitHub Actions 3 条流水线（构建部署、安全扫描、数据库备份）
- 部署：Docker + Kubernetes + Nginx + Prometheus + Grafana 监控
- 全链路集成测试 825 个（32 个测试文件），含：
  - 15 个 e2e 全链路测试（启动→登录→刷题→错题→择校→AI→社交→存储→导航→上传→按钮交互）
  - 4 个总监级深度审计测试（AI 真实性、文件上传边界、登录鉴权门控、主题引擎与空状态）
  - 17 个基础单元测试（存储、配置、工具函数、组件、性能等）
- `docs/PROJECT-REPORT.md` — 整合 5 份历史项目/测试报告
- `docs/AUDIT-REPORT.md` — 整合检测汇总报告 + 模块详细报告 + 审计记录
- `docs/TECH-ANALYSIS.md` — 技术分析与优化方案

### Fixed

- 全量代码审计 40 项安全/Bug 修复（20 个审计阶段）：
  - loginGuard 缺失 storageService 导入（运行时 ReferenceError）
  - wechat/qq 回调 CSRF 绕过
  - do-quiz closeResult 逻辑修复
  - mock-exam Vue 2 响应式问题
  - material-manager 分页修复
  - school-query userId 鉴权绕过
  - create.vue formatDate 修复
  - user-stats 鉴权绕过
  - settings 主题监听器泄漏、缓存清理连带清除认证
  - achievement-manager 鉴权绕过、变量遮蔽
  - data-cleanup 空密钥、db-migrate 分页 ×2
  - 5 个后端函数添加 JWT 鉴权（ai-photo-search, photo-bg, voice-service, id-photo-segment, ai-friend-memory）
  - SSRF 防护（ai-photo-search URL 白名单）
  - network-monitor 监听器泄漏、offline-queue 竞态、retry-interceptor 误报
  - learning-goal 时区、question-favorite 排序变异、mistake-auto-collect 标签去重
  - smart-question-picker 边界、adaptive-learning NaN + typo、draft-detector JSON 解析
  - clearChatData 缺失导入、image-optimizer 缩放 Bug、useNavbar 负值、field-normalizer falsy 0
  - checkin-streak 时区 ×2、streak-recovery 时区
  - universe 动画泄漏 + URL 校验、splash 定时器泄漏、canvas-report 截断、LogoutButton 导入
- 前后端字段名不一致修复（4 类）：
  - rank.vue / pk-battle.vue: action `get_rank` → `get`（排行榜页面完全无法加载）
  - doc-convert.vue / lafService.js: `taskId` → `jobId`（文档转换状态轮询失败）
  - storageService.js: addMistake 添加 `offlineMistakeToBackend` 归一化（`question` → `question_content`）
  - mistake-manager.ts: 所有响应添加 `success: true`（兼容标准 ApiResponse 格式）
- PK 对战分数上传完全失效：action `update_score` → `update`（后端无此 handler）
- PK 对战分数双重计数：前端发送累计总分但后端 `_.inc()` 再次累加，改为发送增量分数
- PK 对战分数无上限：服务端添加单次 200 分上限 + 30 秒频率限制
- 院校查询 matchRate 使用随机数 → 改为后端真实值
- 学习详情页注入 90 天虚假学习记录 → 仅显示真实数据
- 聊天语音识别为硬编码模拟文本 → 改用 RecorderManager 真实录音 + 功能开发中提示
- 学习计划智能调整使用随机进度 → 从 study_stats 读取真实数据
- 好友主页硬编码 3 个成就徽章 → 改为空数组 + "暂无成就" 提示
- Sass `@import` deprecation warnings in App.vue — migrated to `@use`
- 前端硬编码混淆密钥迁移至 `config/index.js` security 配置段
- 配置文件敏感 fallback 值改为空字符串 + 安全检查
- `handleUpdateStatus` 返回码统一为 `code: 0`
- `login.ts` 重复用户创建代码提取为 `buildNewUserData()` + `createNewUser()`
- `mistake-manager` 内存过滤 2000 条改用 MongoDB `$in`/`$all` + DB 级过滤
- `learning-resource` `$regex` 无索引添加关键词长度限制（50 字符）
- 微信小程序代码质量检查问题
- vite.config.js uni-plugin CJS/ESM 双层 default 兼容问题
- CI/CD 流水线多处报错

### Changed

- icons8 CDN URL 配置化：chat.vue（12 处）+ PosterModal.vue（4 处）统一使用 `config.externalCdn.icons8BaseUrl`
- 孤立后端函数标记：voice-service、material-manager 添加 `⚠️ [未启用]` 注释
- laf-backend/README.md：移除不存在的 group-service，标注 voice-service / material-manager 未接入前端
- 文档整合：9 份冗余文档合并为 3 份，净减少约 1,550 行重复内容
- README.md 文档索引更新为 10 个链接
- 首页双模式 UI 重构（Wise/Bitget 风格）
- v0 组件库集成（+38 组件、+68 设计令牌、+8 动画）
- GPU 加速优化（性能提升 40%）
- 分包加载（主包从 2.1M 降至 1.47M）
- 防御性重构 P0-P3：去重、组件瘦身、注释索引、缓存修复
- 完成问题清单 P001-P015 全部 15 项修复及发布前审计
- Git 仓库清理：累计移除 173 个冗余文件，.gitignore 覆盖一次性脚本/测试/修复工具

### Removed

- 根目录 5 份冗余中文文档（项目综合报告、全量测试报告、测试报告、问题清单与修复记录、技术分析与优化方案）
- docs/ 下 4 份冗余文档（API.md、检测汇总报告、检测详细报告-M5、项目报告）
- 冗余 git 跟踪文件：backups/、database/、.claude/skills|agents|commands/、common/zhipu.js、common/styles/common.scss
- 一次性脚本：scripts/fix/、scripts/refactor/、scripts/crawlers/、scripts/data-sync/、scripts/test/
- laf-backend 一次性脚本：laf-backend/scripts/、test-connection.js、data fix artifacts
- 开发调试文件：tests/debug-selectors.js、playwright.visual.config.js、tests/visual/、.opencode/

### Security

- 清除硬编码密钥、补全 .gitignore、创建 .dockerignore
- JWT 身份认证 + 请求签名防篡改
- 本地存储 Feistel v2 加密 + SipHash HMAC 完整性校验
- 前端限流保护 + 后端速率限制
- PK 对战服务端分数校验（单次 200 分上限 + 30 秒频率限制）
