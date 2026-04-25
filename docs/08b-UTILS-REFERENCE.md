# Exam-Master 工具函数文档

> 目录: `src/utils/`
> 按功能域分类，所有模块均为 ES Module
> Last updated: 2026-03-29 (Round 39)

---

## 一、核心工具 (`core/`)

| 文件                 | 导出           | 说明                                                                           |
| -------------------- | -------------- | ------------------------------------------------------------------------------ |
| `index.js`           | 聚合导出       | 核心工具统一入口                                                               |
| `date.js`            | 日期格式化工具 | `formatDate()`, `getRelativeTime()`, `isToday()` 等                            |
| `system.js`          | 系统信息       | `getSystemInfo()`, `getStatusBarHeight()`, `isIPhoneX()`                       |
| `performance.js`     | 性能监控       | `measureTime()`, `reportPerformance()`                                         |
| `network-monitor.js` | 网络状态监控   | `NetworkMonitor` 类：在线/离线检测，ping 检测（URL 从 `config/index.js` 读取） |
| `offline-queue.js`   | 离线请求队列   | 网络恢复后自动重发排队请求                                                     |

## 二、认证工具 (`auth/`)

| 文件                      | 说明                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `loginGuard.js`           | 登录守卫：`checkLogin()` 检查登录状态，`restoreUserInfo()` 恢复用户信息，未登录时跳转登录页 |
| `token-refresh-plugin.js` | Token 自动刷新：`isTokenExpiringSoon()` 检测即将过期，自动刷新 token，失败时清除登录态      |

## 三、学习工具 (`learning/`)

| 文件                          | 说明                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `learning-goal.js`            | 学习目标管理：`init()` 初始化（含后端同步）、`updateProgress()` 更新进度、`getGoals()` 获取目标列表 |
| `adaptive-learning-engine.js` | 自适应学习引擎：根据用户答题数据动态调整题目难度和推荐策略                                          |

## 四、练习工具 (`practice/`)

| 文件                | 说明                           |
| ------------------- | ------------------------------ |
| `draft-detector.js` | 草稿检测：检测未完成的练习会话 |

## 五、分析工具 (`analytics/`)

| 文件                     | 说明                                                     |
| ------------------------ | -------------------------------------------------------- |
| `learning-analytics.js`  | 学习分析：成就系统（含后端同步）、学习数据统计、能力评估 |
| `event-bus-analytics.js` | 事件总线分析：用户行为事件追踪                           |

## 六、辅助工具 (`helpers/`)

| 文件                           | 说明                                   |
| ------------------------------ | -------------------------------------- |
| `haptic.js`                    | 触觉反馈：震动反馈封装                 |
| `quote-interaction-handler.js` | 金句交互：每日金句的展示和分享逻辑     |
| `permission-handler.js`        | 权限处理：相机/相册/位置等权限请求封装 |
| `todo-store-patch.js`          | 待办存储补丁                           |

## 七、错误处理 (`error/`)

| 文件                      | 说明                                                      |
| ------------------------- | --------------------------------------------------------- |
| `global-error-handler.js` | 全局错误处理：未捕获异常、Promise rejection、Vue 错误边界 |

## 八、根目录工具

| 文件               | 说明                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `logger.js`        | 日志工具：`logger.log()`, `logger.warn()`, `logger.error()`，生产环境自动静默        |
| `formatters.js`    | 格式化工具：`formatRelativeTime(timestamp)` 相对时间、`getInitials(name)` 姓名首字母 |
| `safe-navigate.js` | 安全导航：统一页面跳转封装，防止重复跳转、处理 tabBar 页面                           |
| `throttle.js`      | 节流函数：`throttle(fn, delay)`                                                      |
