# Exam-Master 工具函数文档

> 目录: `src/utils/`
> 按功能域分类，所有模块均为 ES Module

---

## 一、核心工具 (`core/`)

| 文件 | 导出 | 说明 |
|------|------|------|
| `index.js` | 聚合导出 | 核心工具统一入口 |
| `date.js` | 日期格式化工具 | `formatDate()`, `getRelativeTime()`, `isToday()` 等 |
| `jwt.js` | JWT 解析 | `decodeJWT()`, `isTokenExpired()` |
| `system.js` | 系统信息 | `getSystemInfo()`, `getStatusBarHeight()`, `isIPhoneX()` |
| `theme.js` | 主题管理 | `getTheme()`, `setTheme()`, `watchSystemTheme()` |
| `performance.js` | 性能监控 | `measureTime()`, `reportPerformance()` |
| `network-monitor.js` | 网络状态监控 | `NetworkMonitor` 类：在线/离线检测，ping 检测（URL 从 `config/index.js` 读取） |
| `offline-queue.js` | 离线请求队列 | 网络恢复后自动重发排队请求 |
| `retry-interceptor.js` | 请求重试拦截器 | 可配置重试次数和延迟（配置从 `config/index.js` 读取） |
| `conflict-resolver.js` | 数据冲突解决 | 本地/远端数据合并策略 |
| `config-validator.js` | 配置校验 | 启动时校验必要环境变量 |
| `timer-sync-worker.js` | 计时器同步 | 跨页面计时器状态同步 |

## 二、认证工具 (`auth/`)

| 文件 | 说明 |
|------|------|
| `loginGuard.js` | 登录守卫：`checkLogin()` 检查登录状态，`restoreUserInfo()` 恢复用户信息，未登录时跳转登录页 |
| `token-refresh-plugin.js` | Token 自动刷新：`isTokenExpiringSoon()` 检测即将过期，自动刷新 token，失败时清除登录态 |
| `secure-storage.js` | 安全存储封装：敏感数据加密读写 |

## 三、学习工具 (`learning/`)

| 文件 | 说明 |
|------|------|
| `learning-goal.js` | 学习目标管理：`init()` 初始化（含后端同步）、`updateProgress()` 更新进度、`getGoals()` 获取目标列表 |
| `adaptive-learning-engine.js` | 自适应学习引擎：根据用户答题数据动态调整题目难度和推荐策略 |
| `intelligent-plan-manager.js` | 智能计划管理：基于用户数据生成个性化学习计划 |
| `knowledge-graph.js` | 知识图谱：知识点关系构建、掌握度计算、薄弱点识别 |
| `smart-question-picker.js` | 智能选题：基于遗忘曲线和掌握度的题目推荐 |
| `practice-mode-manager.js` | 练习模式管理：顺序/随机/错题/收藏等模式切换 |
| `question-favorite.js` | 题目收藏：本地收藏管理 |
| `question-note.js` | 题目笔记：本地笔记管理 |
| `question-timer.js` | 答题计时器：单题计时、总时长统计 |
| `quiz-animation.js` | 答题动画：正确/错误反馈动画 |
| `swipe-gesture.js` | 滑动手势：左右滑动切换题目 |
| `offline-cache.js` | 离线缓存：题目数据本地缓存策略 |

## 四、练习工具 (`practice/`)

| 文件 | 说明 |
|------|------|
| `mistake-auto-collect.js` | 错题自动收集：答错时自动添加到错题本（使用 `storageService`） |
| `mistake-classifier.js` | 错题分类器：按知识点/错误类型自动分类 |
| `draft-detector.js` | 草稿检测：检测未完成的练习会话 |
| `elo-matchmaker.js` | ELO 匹配：PK 对战的 ELO 评分和匹配算法 |
| `question-dedup-worker.js` | 题目去重：基于内容相似度的题目去重 |
| `similarity-comparison.js` | 相似度比较：文本相似度计算（用于去重和搜索） |

## 五、分析工具 (`analytics/`)

| 文件 | 说明 |
|------|------|
| `learning-analytics.js` | 学习分析：成就系统（含后端同步）、学习数据统计、能力评估 |
| `ai-analytics.js` | AI 分析：AI 使用统计、效果评估 |
| `event-bus-analytics.js` | 事件总线分析：用户行为事件追踪 |
| `mistake-attribution.js` | 错题归因：错误原因分析和分类 |
| `tracking-mixin.js` | 追踪 Mixin：页面级用户行为追踪（Vue mixin） |
| `weak-point-alert.js` | 薄弱点预警：基于错题数据的薄弱知识点提醒 |

## 六、AI 工具 (`ai/`)

| 文件 | 说明 |
|------|------|
| `enhanced-analysis.js` | 增强分析：AI 深度错题分析、学习建议生成 |
| `question-quality-optimizer.js` | 题目质量优化：AI 生成题目的质量评估和优化 |

## 七、辅助工具 (`helpers/`)

| 文件 | 说明 |
|------|------|
| `canvas-report.js` | Canvas 报告绘制：`drawLabel()`, `drawReportBackground()`, `canvasToImage()` |
| `file-handler.js` | 文件处理：文件读取、格式检测、大小校验 |
| `bubble-interaction.js` | 气泡交互：知识点气泡的物理动画和碰撞检测 |
| `haptic.js` | 触觉反馈：震动反馈封装 |
| `image-optimizer.js` | 图片优化：压缩、裁剪、格式转换 |
| `poster-generator.js` | 海报生成：Canvas 绘制分享海报 |
| `quote-interaction-handler.js` | 金句交互：每日金句的展示和分享逻辑 |
| `onboarding-flow.js` | 新手引导：首次使用引导流程 |
| `permission-handler.js` | 权限处理：相机/相册/位置等权限请求封装 |
| `useNavbar.js` | 导航栏 Hook：获取导航栏高度和状态栏高度 |
| `clearChatData.js` | 清除聊天数据 |
| `todo-store-patch.js` | 待办存储补丁 |

## 八、错误处理 (`error/`)

| 文件 | 说明 |
|------|------|
| `global-error-handler.js` | 全局错误处理：未捕获异常、Promise rejection、Vue 错误边界 |
| `sentry-mini-program-patch.js` | Sentry 小程序适配补丁 |

## 九、调试工具 (`debug/`)

| 文件 | 说明 |
|------|------|
| `qa.js` | QA 调试工具：开发环境调试面板 |

## 十、根目录工具

| 文件 | 说明 |
|------|------|
| `logger.js` | 日志工具：`logger.log()`, `logger.warn()`, `logger.error()`，生产环境自动静默 |
| `formatters.js` | 格式化工具：`formatRelativeTime(timestamp)` 相对时间、`getInitials(name)` 姓名首字母 |
| `safe-navigate.js` | 安全导航：统一页面跳转封装，防止重复跳转、处理 tabBar 页面 |
| `throttle.js` | 节流函数：`throttle(fn, delay)` |
