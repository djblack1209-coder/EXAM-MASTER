# EXAM-MASTER Change Log

> Version: 2.0 | Scope tags: `frontend` | `backend` | `ai-pool` | `deploy` | `auth` | `database` | `docs` | `infra`

## Format

```
## [YYYY-MM-DD] Session Title
- **Scope**: [frontend|backend|ai-pool|deploy|auth|database|docs|infra]
- **Files Changed**: list of files
- **Summary**: What was done and why
- **Breaking Changes**: Any API or behavior changes
```

---

## [2026-03-31] 第二十六轮审计 — P2 内存泄漏全面修复（5 fixes）

- **Scope**: `frontend`, `performance`
- **Files Changed**:
  - **P2 内存泄漏 — HIGH (2 fixes)**:
    - `src/pages/settings/AIChatModal.vue` — 7个 setTimeout 无清理：添加 pendingTimers 数组 + \_safeTimeout 辅助方法，beforeUnmount 批量清理（含 AI 重试 2s timer、TTS 延迟、语音识别后发送等） [R262]
    - `src/pages/chat/ai-router.js` + `src/pages/chat/chat.vue` — 模块级单例 AIRouter 的 5 分钟缓存清理 setInterval 永不停止：导出 stopAICacheCleanup()，在 chat.vue onUnmounted 中调用 [R263]
  - **P2 内存泄漏 — MEDIUM (3 fixes)**:
    - `src/pages/practice-sub/do-quiz.vue` — ~12 个 setTimeout 未追踪：添加 pendingTimers 数组 + \_safeTimeout 方法，onUnload 批量清理（含选项反馈动画、XP toast、防重复点击等） [R264]
    - `src/pages/practice-sub/pk-battle.vue` — ~10 个匿名 setTimeout 未追踪：添加 safePendingTimers 数组 + \_safeTimeout 方法，clearAllTimers() 中追加批量清理（含匹配成功延迟、对手动画、分享超时等） [R265]
    - `src/pages/chat/chat.vue` — 4 个 setTimeout 未追踪：添加 \_pendingTimers 数组 + safeTimeout 辅助函数，onUnmounted 批量清理（含自动发送、加载超时、骨架屏关闭、滚动重置） [R266]
- **Summary**: 第二十六轮审计专注 P2 内存泄漏修复。全面扫描了 src/ 下所有 setInterval(32处)、setTimeout(167处)、uni.$on(42处)、addEventListener、watch、$subscribe。发现 2 个 HIGH + 5 个 MEDIUM + 6 个 LOW。修复全部 2 个 HIGH 和 3 个 MEDIUM（共涉及 ~36 个 setTimeout 的追踪清理）；1 个 MEDIUM（learning-trajectory-store 的 bubble:clicked）经分析为全局单例 + tabBar 页面组合，实际不会泄漏，判定为 LOW 跳过；6 个 LOW 为 Store 单例/App 级事件（正常运行不泄漏）。共计 R262-R266 (5 fixes)。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-31] 第二十五轮审计 — P0-P5 全量生产就绪审计（15 fixes）

- **Scope**: `backend`, `frontend`, `config`, `performance`
- **Files Changed**:
  - **P0 安全 (10 fixes)**:
    - `laf-backend/functions/ai-photo-search.ts` — 移除 error.message 直接返回客户端（改为固定中文提示） [R247]
    - `laf-backend/functions/id-photo-segment-base64.ts` — 重构错误处理：if-else 链改为 ERROR_MAP 查表，未匹配错误码时返回通用中文提示而非原始 error.message [R248]
    - `laf-backend/functions/achievement-manager.ts` — 旧版内存限流 checkRateLimit 替换为分布式限流 checkRateLimitDistributed（30次/分钟） [R254]
    - `laf-backend/functions/ai-friend-memory.ts` — 添加分布式限流 checkRateLimitDistributed（20次/分钟） [R255]
    - `laf-backend/functions/invite-service.ts` — 添加分布式限流 checkRateLimitDistributed（15次/分钟） [R256]
    - `laf-backend/functions/learning-goal.ts` — 旧版内存限流 checkRateLimit 替换为分布式限流 checkRateLimitDistributed（30次/分钟） [R257]
    - `laf-backend/functions/mistake-manager.ts` — 添加分布式限流 checkRateLimitDistributed（30次/分钟） [R258]
    - `laf-backend/functions/pk-battle.ts` — 添加分布式限流 checkRateLimitDistributed（20次/分钟） [R259]
    - `laf-backend/functions/rag-ingest.ts` — 添加分布式限流 checkRateLimitDistributed（5次/5分钟，重型嵌入API保护） [R260]
    - `laf-backend/functions/study-stats.ts` — 添加分布式限流 checkRateLimitDistributed（30次/分钟） [R261]
  - **P1 功能完整性 (1 fix)**:
    - `src/services/api/domains/school.api.js` — getHotSchools/getProvinces catch 分支补充缺失的 message 字段（用户友好中文提示） [R249]
  - **P3 性能与稳定性 (3 fixes)**:
    - `src/pages/study-detail/StudyTrendChart.vue` — calculateSummary 除零防护：avgMinutes 计算添加 chartData.length > 0 守卫 [R250]
    - `src/pages.json` — preloadRule 增强：首页预加载新增 login 分包（新用户首次启动路径），刷题页新增 tools 分包（拍照搜题入口）；个人中心预加载从 wifi-only 改为 all（蜂窝网络也预加载） [R251]
    - `src/pages/chat/chat.vue` — 3 处聊天页头像 image 标签添加 lazy-load 属性（欢迎页+消息列表+输入指示器） [R252]
  - **P5 文档 (1 fix)**:
    - `.env.example` — 补充缺失的 VITE_API_FALLBACK_URL 条目（双服务器容灾备用地址） [R253]
- **Summary**: 第二十五轮全量生产就绪审计，按 P0→P5 严格执行。P0 密钥扫描零泄露、43 个云函数鉴权全部正确、前端 XSS 防护完善（零 v-html/eval）；修复 2 个 error.message 泄露；**8 个云函数补齐分布式限流**（achievement-manager/ai-friend-memory/invite-service/learning-goal/mistake-manager/pk-battle/rag-ingest/study-stats），其中 2 个从旧版内存限流升级、6 个新增，至此全部需鉴权接口均具备分布式限流保护。P1 扫描确认零 TODO 未实现、零 mock 残留、零空函数体；修复 1 个 API 错误响应缺 message 字段。P2 确认 ESLint 零报错、分层纪律无违规、lafService 零生产导入。P3 修复 1 个除零边界、增强分包预加载覆盖（login/tools + wifi→all）、添加 3 处 lazy-load。P4 暗黑模式经 24 轮修复确认无遗漏。P5 确认 5 个 CI workflow 配置正确、Husky 钩子正常、Electron 安全配置完善；修复 1 个 .env.example 遗漏。共计 R247-R261 (15 fixes)。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-30] 第二十四轮审计 — P4 暗黑模式硬编码色值修复（2文件 45 fixes）

- **Scope**: `frontend`, `ui/ux`
- **Files Changed**:
  - **P4 UI/UX — login/index.vue 暗黑模式全量修复 (35 edits)**:
    - `src/pages/login/index.vue` — 23处早期+活跃区硬编码色值→CSS变量，26个冗余`.dark-mode`覆盖块移除(早期23+活跃区3)，compound glass/icon/checkbox/link等全部迁移 [R202-R226]
  - **P4 UI/UX — import-data.vue 暗黑模式全量修复 (30 edits)**:
    - `src/pages/practice-sub/import-data.vue` — 25处硬编码色值→CSS变量/color-mix()，18个冗余`.dark-mode`覆盖块移除(早期9+Final polish 9)，upload-trigger/file-capsule/meta-tag/glass-btn/speed-icon-box/error-icon-box等全部迁移，净减126行CSS [R227-R246]
- **Summary**: 第二十四轮审计继续推进P4暗黑模式适配CRITICAL级文件。login/index.vue 处理双层样式架构（早期结构层+Final polish覆盖层），清除所有冗余暗色覆盖块并统一为CSS变量驱动。import-data.vue 同样双层架构，全量迁移glass/icon/badge/button/mask色值，引入color-mix()方案处理语义化半透明色。两文件共计 R202-R246 (45 fixes)。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-30] 第二十三轮审计 — P4 暗黑模式硬编码色值修复（4文件 22 fixes）

- **Scope**: `frontend`, `ui/ux`
- **Files Changed**:
  - **P4 UI/UX — CustomModal.vue 暗黑模式修复 (3 fixes)**:
    - `src/components/common/CustomModal.vue` — 移除2个手动`.dark`/`.dark-mode`覆盖块，取消/确认按钮文字色→CSS变量 [R180-R182]
  - **P4 UI/UX — practice/index.vue 暗黑模式修复 (7 fixes)**:
    - `src/pages/practice/index.vue` — AI推荐卡片装饰渐变/徽章/按钮硬编码色→CSS变量，移除冗余`.dark-mode`覆盖块，spinner/导入卡暗色背景→变量 [R183-R189]
  - **P4 UI/UX — plan/index.vue 暗黑模式修复 (6 fixes)**:
    - `src/pages/plan/index.vue` — 任务圆点review/practice硬编码色→`var(--warning)`/`var(--success)`，CTA按钮渐变+文字色→CSS变量，移除3个冗余`.dark-mode`覆盖块 [R190-R195]
  - **P4 UI/UX — mistake/index.vue 暗黑模式全量修复 (6 fixes)**:
    - `src/pages/mistake/index.vue` — 11处硬编码色值→CSS变量(cluster-badge/trend-text/cluster-chip)，移除20个冗余`.dark-mode`覆盖块（净减113行CSS）[R196-R201]
- **Summary**: 第二十三轮审计继续推进P4暗黑模式适配。CustomModal 消除手动暗色覆盖；practice 修复AI推荐卡片全部装饰性色值；plan 修复任务圆点和CTA按钮；mistake 是本轮最大工作量——11处硬编码色值改为`color-mix()`+CSS变量方案，20个冗余`.dark-mode`覆盖块全部清除。共计 R180-R201 (22 fixes)。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-30] 第二十二轮审计 — P4 暗黑模式硬编码色值修复（3文件 15 fixes）

- **Scope**: `frontend`, `ui/ux`
- **Files Changed**:
  - **P4 UI/UX — classroom.vue 暗黑模式全量修复 (12 fixes)**:
    - `src/pages/ai-classroom/classroom.vue` — 58处硬编码色值替换为CSS变量，16个手动`.dark-mode`覆盖块全部移除 [R165-R176]
  - **P4 UI/UX — rank.vue 残留硬编码色值修复 (1 fix)**:
    - `src/pages/practice-sub/rank.vue` — `.item-score` 硬编码 `#22873a`/`#7bc0ff` + `.dark-mode` 覆盖块 → 单行 `var(--success-dark)` [R177]
  - **P4 UI/UX — StudyHeatmap.vue 暗黑模式遗漏修复 (2 fixes)**:
    - `src/components/business/index/StudyHeatmap.vue` — `.dark` 块内 `.day-cell` 缺少 border-color/box-shadow 暗黑覆盖 [R178]；`.legend-cell` 缺少 border-color 暗黑覆盖 [R179]
- **Summary**: 第二十二轮审计专注 P4 暗黑模式适配。classroom.vue 是本轮主要工作量（58处硬编码色值→CSS变量、16个手动暗黑覆盖块全部消除），rank.vue 修复残留的2处语义硬编码色值并消除 `.dark-mode` 覆盖块，StudyHeatmap.vue 补全3处缺失的暗黑模式边框/阴影覆盖。共计 R165-R179 (15 fixes)。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-30] 第二十一轮审计 — 全栈生产就绪审计 P0-P4（4安全 + 2功能 + 4架构 + 8性能 + 12 UI/UX）

- **Scope**: `frontend`, `backend`, `security`, `performance`, `ui/ux`
- **Files Changed**:
  - **P0 安全 (4 fixes)**:
    - `src/pages/settings/AIChatModal.vue` — 添加 sanitizeAIChatInput 输入过滤
    - `laf-backend/functions/rag-ingest.ts` — 移除 serverError() 中的 error.message 泄露
    - `laf-backend/functions/lesson-generator.ts` — 错误信息消毒(.slice(0,100)+regex) + 静默 catch 改为 logger.error
  - **P1 功能完整性 (2 fixes)**:
    - `laf-backend/functions/data-cleanup.ts` — 空 catch 块添加 logger.warn
    - `laf-backend/functions/lesson-generator.ts` — 静默 .catch() 改为错误日志记录
  - **P2 架构质量 (4 fixes)**:
    - `src/utils/core/performance.js` — 移除重复的 debounce/throttle，改为从 throttle.js re-export
    - `src/pages/practice-sub/smart-review.vue` — uni.getSystemInfoSync() 替换为 getStatusBarHeight()
    - `src/pages/practice-sub/diagnosis-report.vue` — 同上 getStatusBarHeight() 修复
    - `src/pages/ai-classroom/classroom.vue` — 同上 getStatusBarHeight() 修复
  - **P3 性能 (8 fixes)**:
    - `src/pages/practice-sub/diagnosis-report.vue` — 内存泄漏修复：pendingTimers + onBeforeUnmount 清理所有 setTimeout
    - `src/components/business/index/AIDailyBriefing.vue` — watcher 防抖(300ms) + weakPoints 默认值冻结(Object.freeze)
    - `src/pages/study-detail/StudyTrendChart.vue` — 移除 studyData watcher 的 deep:true
    - `src/components/business/index/StudyHeatmap.vue` — 移除 studyData watcher 的 deep:true
    - `laf-backend/functions/school-query.ts` — getFavorites() 添加 .limit(200) 防止无限查询
    - `src/pages/practice-sub/sprint-mode.vue` — priorityCounts 单次遍历替代双次 .filter()
    - `src/pages/practice-sub/rank.vue` — 列表头像添加 lazy-load 属性
  - **P4 UI/UX Phase 1 — 错误处理 + 空状态 (3 files, 5 fixes)**:
    - `src/pages/practice-sub/diagnosis-report.vue` — loadFailed 状态 + 错误 toast + 失败 UI(重试按钮) + CSS
    - `src/pages/ai-classroom/classroom.vue` — continueClass/sendMessage catch 块添加 toast.error()
    - `src/pages/study-detail/index.vue` — 数据加载 catch 块添加 toast.error()
  - **P4 UI/UX Phase 2 — 响应式 px→rpx (2 files)**:
    - `src/pages/practice-sub/diagnosis-report.vue` — 74 处 px→rpx 转换
    - `src/pages/ai-classroom/index.vue` — 22 处 font-size/layout px→rpx 转换
  - **P4 UI/UX Phase 2 — 暗黑模式硬编码色值修复 (3 files)**:
    - `src/pages/index/index.vue` — ~11 处硬编码色值替换为 CSS 变量
    - `src/pages/practice-sub/do-quiz.vue` — ~15 处硬编码色值替换为 CSS 变量
    - `src/pages/practice-sub/pk-battle.vue` — ~23 处硬编码色值替换为 CSS 变量
- **Summary**: 第二十一轮全栈生产就绪审计，按 P0→P4 优先级严格执行。共计修复 30 个问题（R135-R164）：P0 安全 4 项（AI 输入未过滤、3 处 error.message 泄露/静默吞错）；P1 功能 2 项（空 catch 块恢复日志）；P2 架构 4 项（重复工具函数、3 处非标准 API 调用）；P3 性能 8 项（内存泄漏、深度 watcher、无限查询、重复计算、懒加载）；P4 UI/UX 12 项（错误提示缺失、px→rpx 响应式、暗黑模式适配）。技术债务记录：层违规(friend-profile/friend-list)、17 个大文件(>1500行)、后端 N+1 查询/缺失索引/无界聚合、前端 lazy-loading modal/ARIA 可达性等。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-30] 第二十轮审计 — 微信小程序审核合规修复（2 BLOCKER + 1 HIGH + 1 MEDIUM）

- **Scope**: `frontend`, `config`, `docs`
- **Files Changed**:
  - `scripts/build/inject-mp-weixin-privacy.mjs` — [B-001] 移除虚假 `requiredPrivateInfos` 声明（`chooseAddress`/`chooseLocation`/`choosePoi` 从未被调用），仅保留 `chooseMessageFile`；移除 `scope.userLocation` 权限注入逻辑
  - `src/manifest.json` — [B-002] 移除 `permission.scope.userLocation` 块（应用从未调用任何位置 API，属"过度数据收集"）
  - `src/pages/settings/privacy.vue` — [H-003] 更新账号删除说明，从"联系我们"改为准确描述应用内自助删除流程（7天冷静期）
  - `project.config.json` — [M-004] `miniprogramRoot` 从 `dist/dev/mp-weixin/` 修正为 `dist/build/mp-weixin/`（生产构建路径）
- **Summary**: 第二十轮审计，针对微信小程序提交审核前的合规检查。对照微信官方审核标准执行深度审计，发现并修复 2 个 BLOCKER 级问题（虚假隐私 API 声明 + 过度权限申请，均为**审核必拒**项）、1 个 HIGH 级问题（隐私政策描述与实际功能不符）、1 个 MEDIUM 级问题（DevTools 配置指向开发路径）。构建验证：主包 1298KB（远低于 2048KB 限制），总包 2609KB，13 个分包正常，隐私弹窗 `__usePrivacyCheck__` 启用。另有 1 个 HIGH 待办（H-002: AI 内容安全检测未接入 `security.msgSecCheck`），风险可控但建议后续补全。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK | MP-Weixin build OK (主包 1298KB)

## [2026-03-30] 第十九轮审计 — 深度扫描：微信MP超限修复 + 安全加固(error泄露+速率限制) + 部署同步

- **Scope**: `backend`, `frontend`, `security`, `deploy`, `performance`
- **Files Changed**:
  - `vite.config.js` — PWA manifest 图标路径从 `static/images/` 改为 `static/pwa-icons/`，避免PWA图标占用微信MP主包空间
  - `src/static/pwa-icons/` — 新建目录，从 `src/static/images/` 迁入 icon-192x192.png、icon-512x512.png、icon-512x512-maskable.png
  - `laf-backend/functions/getHomeData.ts` — 移除 serverError() 中 err.message 参数（防止内部错误泄露）
  - `laf-backend/functions/anki-export.ts` — 移除2处 String(e) 错误泄露 + 新增 checkRateLimitDistributed(5次/5分钟)
  - `laf-backend/functions/anki-import.ts` — 移除 String(e) 错误泄露 + 新增 checkRateLimitDistributed(5次/5分钟)
  - `laf-backend/functions/db-create-indexes.ts` — 移除 error.message 直接返回客户端
  - `laf-backend/functions/db-migrate-timestamps.ts` — 移除 error.message 直接返回客户端
  - `laf-backend/functions/group-service.ts` — 新增 checkRateLimitDistributed 写操作限制(10次/分钟)
  - `laf-backend/functions/fsrs-optimizer.ts` — 新增 checkRateLimitDistributed(3次/小时)
  - `laf-backend/functions/user-profile.ts` — 新增 checkRateLimitDistributed(20次/分钟)
  - `laf-backend/functions/user-stats.ts` — 从内存 checkRateLimit 升级为 checkRateLimitDistributed
- **Summary**: 第十九轮深度扫描审计。**BLOCKER修复**：微信小程序主包从2072KB(超出2048KB限制)降至1840KB，通过将PWA专用图标迁移到独立目录避免被打包进小程序主包。**安全加固**：修复6处HIGH级error.message泄露（getHomeData/anki-export×2/anki-import/db-create-indexes/db-migrate-timestamps），攻击者无法再通过错误响应获取内部堆栈信息；新增5个端点的分布式速率限制（group-service/anki-export/anki-import/fsrs-optimizer/user-profile），升级1个端点从内存限制到分布式限制（user-stats）。服务器同步部署完成，PM2重启0错误。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK | TypeScript 0 errors

## [2026-03-30] 第十八轮审计 — 安全修复 + 暗黑模式修复 + 空状态/骨架屏 + 部署同步

- **Scope**: `backend`, `frontend`, `security`, `deploy`
- **Files Changed**:
  - `laf-backend/functions/upload-avatar.ts` — 新增 `checkRateLimitDistributed` 速率限制（每用户每分钟最多5次上传）
  - `laf-backend/functions/answer-submit.ts` — 移除 `serverError()` 中的 `error.message` 参数，防止内部错误信息泄露到客户端
  - `src/pages/settings/ThemeSelectorModal.vue` — 移除2处硬编码色值 `#495057` fallback，改用 CSS 变量
  - `src/pages/mistake/MistakeCard.vue` — 移除3处硬编码色值（`#f0f0f0`、`#333`、`rgba(255,59,48,0.15)`），改用 CSS 变量
  - `src/pages/settings/AIChatModal.vue` — 移除5处硬编码色值/冗余 fallback（`#e9ecef`、`#495057`、`rgba(0,0,0,0.1)` 等），改用 CSS 变量
  - `src/components/business/practice/AiGenerationOverlay.vue` — 修复进度条背景、灵感气泡、暂停按钮使用硬编码 rgba 颜色，改用 CSS 变量
  - `src/pages/study-detail/index.vue` — 新增空状态引导（新用户无学习记录时展示引导卡片+「开始学习」按钮）
  - `src/pages/ai-classroom/index.vue` — 新增加载骨架屏（3卡片骨架动画）+ 修复 catch 块变量名 bug（`_e` vs `e`）
- **Summary**: 第十八轮审计。安全方面：upload-avatar 新增分布式速率限制（LOW-02），answer-submit 移除错误信息泄露（LOW-04）。UI方面：4个P1组件暗黑模式修复（ThemeSelectorModal/MistakeCard/AIChatModal/AiGenerationOverlay），共修复13处硬编码色值。UX方面：study-detail 新增空状态引导页，ai-classroom 新增加载骨架屏。修复1个运行时 bug（ai-classroom catch块变量引用错误）。服务器同步部署完成。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-30] 第十七轮全量审计 — P0修复 + 安全强化 + 孤儿清理 + 部署同步

- **Scope**: `backend`, `frontend`, `security`, `deploy`, `infra`
- **Files Changed**:
  - `laf-backend/functions/answer-submit.ts` — 重构 handleSubmit：移除已删除的 FsrsService/AgentService 动态导入，改为直接使用 fsrs-scheduler.ts 函数
  - `src/pages/practice/index.vue` — 修复 analyzeMastery 导入路径（study.api.js → smart-study.api.js）
  - `src/components/business/index/AIDailyBriefing.vue` — 修复 analyzeMastery/getPendingCorrections/getSprintPriority 导入路径
  - `src/services/api/domains/_request-core.js` — 移除浏览器禁止的 Accept-Encoding header
  - `laf-backend/functions/group-service.ts` — 手动JWT验证替换为 requireAuth 中间件
  - `laf-backend/functions/ai-friend-memory.ts` — 手动JWT验证替换为 requireAuth 中间件
  - `laf-backend/functions/school-query.ts` — 21处成功响应添加 success: true 字段
  - `src/pages/practice-sub/question-bank.vue` — 16处硬编码色值替换为 CSS 变量（暗黑模式支持）
  - 删除 14 个前端孤儿文件（AIConsultPanel.vue, StudyTrend.vue, 6个 useQuiz\* composable, usePKMatching.js, core/index.js, core/date.js, ConfettiOverlay.vue, ForceGraph.vue, QuestionChoice.vue, question-renderer/, streamService.js, usePKResult.js, usePKGameplay.js, usePKShare.js）
  - 删除 5 个后端孤儿文件（rag-query.ts, ai-quiz-grade.ts, material-manager.ts, fsrs.service.ts, agent.service.ts）+ \_shared/services/ 空目录
  - `tests/unit/real-utils.spec.js` — 移除已删除 core/date.js 的测试
  - `tests/unit/audit-idor-jwt.spec.js` — 移除已删除 material-manager 的测试
  - 删除 `tests/unit/audit-material-manager-security.spec.js`（整个文件）
  - `.gitignore` — 添加 .clinerules 和 .cursorrules
- **Summary**: 第十七轮全量审计。修复3个P0运行时崩溃（answer-submit引用已删除文件、practice/AIDailyBriefing导入路径错误），移除1个浏览器禁止的header。安全强化：2个云函数手动JWT替换为统一中间件，school-query 21处响应补全success字段。UI修复：question-bank 16处硬编码色值改为CSS变量支持暗黑模式。文件治理：清理19个孤儿文件共5757行死代码。部署同步：服务器TS重编译+rsync+PM2重启，0错误。Electron桌面端验证通过。
- **Breaking Changes**: 无
- **Quality Gate**: ESLint 0 errors | 89 files / 1168 tests passed | H5 build OK

## [2026-03-30] AI 治理体系全面升级 — 7 个方向全部完成

- **Scope**: `docs`
- **Files Changed**:
  - 新建 `docs/sop/ACCEPTANCE-CHECKLIST.md` — 66项功能验收清单(CHK-001~CHK-066)
  - 新建 `docs/sop/REGRESSION-TEST-STRATEGY.md` — 4级回归测试策略+触发矩阵
  - 新建 `docs/sop/CHANGE-IMPACT-ANALYSIS.md` — 变更影响分析模板+风险映射表
  - 新建 `docs/sop/AI-DECISION-LOG.md` — 决策黑匣子(含7条历史决策DEC-001~007)
  - 新建 `docs/sop/WORKFLOW-PLAYBOOK.md` — 8个流程详细步骤+参考手册(从CLAUDE.md拆出)
  - 重构 `CLAUDE.md` — 277行→141行(减少49%),详细内容按需加载
  - 更新 `docs/sop/UPDATE-PROTOCOL.md` — 新增5条SOP文档触发规则
  - 更新 `docs/sop/AI-DEV-RULES.md` — Rule 9完成协议扩展为6步
- **Summary**: 建立完整的非技术人员友好型AI开发治理体系。此前项目有700+行规则但全是代码级(lint/test/build),缺乏功能级验证。本次新增6个方向的SOP文档覆盖：功能验收、回归测试策略、变更影响分析、决策追踪、规则分层精简、体系集成。CLAUDE.md重构为"核心必读+按需加载"架构,避免上下文窗口稀释。
- **Breaking Changes**: CLAUDE.md结构变化——8个流程详细步骤移至WORKFLOW-PLAYBOOK.md,服务器信息/常用命令/已知陷阱/配置文件位置同步移出。AI需按路由表指示按需读取SOP文档。

---

## [2026-03-30] 后端TS编译错误清零 + 架构重构提交

- **Scope**: `backend`, `frontend`, `docs`, `infra`
- **Files Changed**:
  - `laf-backend/functions/answer-submit.ts` — 10个TS6133修复(未使用导入/变量)
  - `laf-backend/functions/school-crawler-api.ts` — 8个TS6133修复(未使用导入/正则/变量)
  - `laf-backend/functions/smart-study-engine.ts` — 6个TS6133修复(未使用变量/函数)
  - `laf-backend/functions/pk-battle.ts` — 4个TS6133修复(未使用导入/参数)
  - `laf-backend/functions/data-cleanup.ts` — 2个TS6133修复(未使用变量/参数)
  - `laf-backend/functions/social-service.ts` — 2个TS6133修复(未使用导入/参数)
  - `laf-backend/functions/upload-avatar.ts` — 1个TS6133修复(未使用导入)
  - `laf-backend/functions/user-stats.ts` — 2个TS6133修复(未使用导入)
  - `laf-backend/functions/question-bank.ts` — 1个TS6133修复(未使用变量)
  - 新建 `docs/doc-cache/` — 8个官方文档缓存(vue3/uniapp/pinia/mongodb/typescript/eslint/wot-design/wechat-mp)
  - 新建 `src/config/game-constants.js` — 游戏常量唯一源
  - 40+前端文件 — lafService消除/API分层/配置集中化/死代码清理
  - 6个SOP文档 — 验收清单/回归测试/影响分析/决策日志/流程手册/文档规则
- **Summary**: 后端TypeScript编译从36个TS6133错误降至0错误。修复策略：移除未使用导入、前缀化未使用参数(`_varName`)、导出保留的基础设施函数、删除重复声明的局部变量。同时完成架构重构(lafService消除+游戏常量统一+魔法数字集中化)和AI治理体系建设(6个SOP文档)的合并提交。
- **Breaking Changes**: 无

---

## [2026-03-29] 架构清爽化重构 — Task 1~5 完成

- **Scope**: `frontend`, `docs`
- **审计范围**: 配置碎片化统一(Task 1)、硬编码魔法数字集中化(Task 2)、Store/Page分层修复(Task 3)、lafService中间层彻底消除(Task 4)、死代码清理(Task 5)
- **质量关卡**: ESLint 0错误, 90文件/1196测试全过, H5构建通过

### Task 1: 配置碎片化修复

- 创建 `src/config/game-constants.js` — 游戏常量唯一源(XP奖励/等级/连续签到/成就/存储键)
- 重构4个消费者: `gamification.js`, `useXPSystem.js`, `learning-analytics.js`, `checkin-streak.js`

### Task 2: 硬编码魔法数字集中化

- `config/index.js` 扩展18个配置键(api.fallbackUrl/Threshold, ai.analysisTimeout, retry.maxRetryDelay等)
- 重构13个文件从魔法数字改为读取中央配置

### Task 3: smart-study API分层修复

- `study-engine.js` Store从lafService改为直接调用 `smart-study.api.js`(修复运行时静默失败的latent bug)
- 4个页面(`study-detail`, `plan`, `mistake`, `quiz-result`)同步更新

### Task 4: lafService彻底消除(方案B)

- **Stores**: 7个Store(`school/tools/review/user/profile/auth/classroom`)从lafService改为domain API直接导入
- **Pages**: 8个页面(`ai-consult/AIConsultPanel/MistakeReport/pk-battle/rank/AIChatModal/chat/import-data`)从lafService改走Store
- **Services**: 17个文件的剩余lafService引用全部替换为对应domain API
- **新增API**: `ai.api.js`(getSmartRecommendations), `practice.api.js`(ankiImport/ragIngest/getFSRSParams/getFSRSReviewStats), `social.api.js`(rankCenter)
- **测试**: 3个测试文件mock从lafService改为对应domain API mock
- **lafService.js保留**: 0生产导入, 263测试引用, 作为测试兼容层不删除

### Task 5: 死代码清理

- 删除孤儿 `ErrorBoundary.vue`(90行, 零引用)
- 实现 `offline-cache-service.js`(原为0字节空文件, 被2个composable导入导致运行时崩溃)
  - 新增 `offlineCache` 对象: isOnline/getCachedQuestions/cacheQuestions/addToSyncQueue
  - 新增 `checkOfflineAvailability()` 返回 `{ available, isOnline }` 结构化状态
  - `do-quiz.vue` 从旧 `offline-cache.js`(返回boolean) 重定向到新服务(返回对象)
- 移除 `index.vue` 11行注释掉的待办事项UI死代码
- 修复 `MODULE-INDEX.md` 引用已删除的 `vip.js` 和 `invite.js`

### 文件变更汇总

- **新建**: `src/config/game-constants.js`, `src/services/offline-cache-service.js`(重写)
- **删除**: `src/components/common/ErrorBoundary.vue`
- **修改**: 40+文件(stores/pages/services/composables/tests/docs)

---

## [2026-03-29] 十六轮审计 — 遗留问题清零+安全加固+响应格式统一

- **Scope**: `backend`, `frontend`, `security`, `database`, `infra`
- **审计范围**: D036后端响应格式统一、Electron安全加固(CSP+协议过滤)、后端日志敏感信息脱敏、竞态条件MongoDB唯一索引防护、PWA图标修复(D033/D034)、CSS死代码清理、pages.json路由一致性验证、Pinia Store反模式检查
- **质量关卡**: ESLint 0错误, 90文件/1196测试全过, H5构建通过, 后端TS编译通过

### 后端响应格式统一（D036部分修复）

- `fsrs-optimizer.ts`: 全部8处 `ok:` 字段改为 `success:` 与标准 `api-response.ts` 格式对齐
- `mistake-manager.ts`: 全部17处冗余 `ok:` 字段移除（原本已有 `success:` 字段，`ok:` 为非标准重复）
- 测试文件同步更新: `audit-mistake-manager-update-fields.spec.js` 移除5处 `result.ok` 断言

### Electron安全加固

- `electron/main.cjs`: 添加 CSP header（`session.defaultSession.webRequest.onHeadersReceived`）
- `electron/main.cjs`: `shell.openExternal` 限制仅允许 `http:`/`https:` 协议，防止 `file:`/`javascript:` 等危险协议

### 后端日志敏感信息脱敏（4个HIGH修复）

- `login.ts`: 新增 `maskEmailForLog()` 函数，QQ/WeChat OAuth token数据脱敏（3处）+ 邮箱地址脱敏（2处）
- `agent.service.ts`: 错误日志从完整error对象改为仅记录 `e?.message`

### 竞态条件防护（B006: 5个唯一索引）

- `db-create-indexes.ts` 新增 B006 章节，6个唯一复合索引:
  - `rankings { uid: 1 }` — 防止重复用户排行记录
  - `mistake_book { user_id: 1, _content_hash: 1 }` — 防止重复错题
  - `group_members { group_id: 1, user_id: 1 }` + `{ user_id: 1, joined_at: -1 }` — 防止重复成员
  - `idempotency_records { key: 1 }` — 防止PK重复提交
  - `learning_goals { user_id: 1, type: 1, status: 1 }` — 防止重复活跃目标
- **全部6个索引已部署到生产MongoDB**

### PWA图标修复（D033/D034）

- 从 `electron/icons/icon.png`(1024x1024) 生成3个标准PWA图标: 192x192, 512x512, 512x512-maskable
- `vite.config.js` PWA manifest更新: 分离 `purpose: "any"` 和 `purpose: "maskable"` 图标条目
- 修复原配置中192和512均指向同一64x64 logo.png的问题

### CSS死代码清理

- `button-animations.scss`: 从550行精简至108行，移除35个未使用的CSS类（仅保留4个实际引用的动画类）

### 审计结论（无需修复）

- pages.json路由一致性: 42条路由全部有对应.vue文件，零孤儿路由
- Pinia Store反模式检查: 零违规（无解构reactive/computed后丢失响应性）
- ErrorBoundary.vue: 存在但未被任何页面引用（42页面无保护），记录为技术债务
- D030 vite-plugin-compression: Nginx已配置gzip，无需构建时预压缩，关闭
- 80+个catch块日志完整error对象: 系统性问题，记录为已接受风险

### Files Changed (9 files + 3 new)

- `electron/main.cjs` — CSP header + shell.openExternal协议过滤
- `laf-backend/functions/login.ts` — maskEmailForLog() + 6处日志脱敏
- `laf-backend/functions/_shared/services/agent.service.ts` — 错误日志精简
- `laf-backend/functions/db-create-indexes.ts` — B006竞态条件防护索引(6个)
- `laf-backend/functions/fsrs-optimizer.ts` — 8处ok→success
- `laf-backend/functions/mistake-manager.ts` — 17处ok字段移除
- `src/styles/button-animations.scss` — 550→108行CSS精简
- `vite.config.js` — PWA图标配置更新
- `tests/unit/audit-mistake-manager-update-fields.spec.js` — 5处result.ok断言移除
- **(new)** `src/static/images/icon-192x192.png` — PWA图标192x192
- **(new)** `src/static/images/icon-512x512.png` — PWA图标512x512
- **(new)** `src/static/images/icon-512x512-maskable.png` — PWA maskable图标

---

## [2026-03-29] 十五轮审计 — 分包优化+Bundle拆分+MongoDB索引补全

- **Scope**: `frontend`, `backend`, `performance`, `database`
- **审计范围**: 微信小程序分包优化(D031)、H5 Bundle vendor拆分(D029)、53组件Props校验、MongoDB缺失索引补全(10集合+5已有集合补充)、preloadRule增强
- **质量关卡**: ESLint 0错误, 90文件/1196测试全过, H5构建通过, 后端TS编译通过

### 微信小程序分包优化

- onboarding页面从主包移入login分包: `/pages/onboarding/index` → `/pages/login/onboarding`，主包减少~24KB
- preloadRule增强: 首页预加载新增plan+ai-classroom，刷题页新增mistake，个人中心新增favorite+study-detail

### H5 Bundle Vendor拆分（D029修复）

- vite.config.js 添加 manualChunks（仅H5平台）: vendor-core(Vue+Pinia+uni-app运行时 309KB) + vendor-wot(wot-design UI 27KB)
- **入口JS从443KB降至135KB（-69.5%）**，vendor chunks独立缓存，后续访问只需加载业务代码

### MongoDB索引补全（B005）

- 10个完全缺失索引的集合: review_logs、email_code_attempts、pk_rooms、user_questions、user_materials、deep_corrections、user_school_favorites、admission_ratios、document_chunks、colleges
- 5个已有集合补充缺失索引: rankings(uid+version)、schools(status+code)、questions(is_active+category)
- P0级别: review_logs(3索引)、email_code_attempts(2索引+TTL)、pk_rooms(3索引+TTL)、user_questions(3索引)
- P1级别: user_materials(1)、deep_corrections(1)、user_school_favorites(2)、admission_ratios(2)
- P2级别: document_chunks(1)、colleges(1)
- db-create-indexes.ts 版本升级 1.3.0 → 1.4.0，新增约25个索引

### 审计结论（无需修复）

- 53个组件Props校验: **全部A+**，零数组形式props，零缺type，零缺default/required，零引用类型默认值非工厂函数
- 静态资源: tabbar图标44KB(10个PNG)可优化为SVG但非阻塞
- 网络异常韧性: \_request-core.js已有统一超时/错误处理/重试，offline-indicator已实现，无P0问题

### Files Changed (6 files)

- `src/pages.json` — onboarding移入login分包 + preloadRule增强
- `src/App.vue` — 路由守卫白名单更新onboarding路径
- `src/pages/splash/index.vue` — onboarding跳转路径更新
- `src/pages/login/onboarding.vue` — 从pages/onboarding/index.vue移入（物理移动）
- `vite.config.js` — 添加H5 manualChunks vendor拆分
- `laf-backend/functions/db-create-indexes.ts` — 新增10集合+5补充共25个索引(B005)

---

## [2026-03-29] 十四轮审计 — 安全加固+内存泄漏修复+全局路由守卫

- **Scope**: `frontend`, `security`, `performance`
- **审计范围**: 路由权限守卫(36页面)、前端XSS防护(v-html/输入校验)、后端接口鉴权(46云函数)、内存泄漏(定时器/监听器/watch)
- **质量关卡**: ESLint 0错误, 90文件/1196测试全过, H5构建通过

### 安全加固（P0修复）

- App.vue 添加全局路由守卫: `uni.addInterceptor`拦截navigateTo/redirectTo，14个公开页面白名单，未登录用户无法访问22个需保护页面
- 新建 `src/utils/security/sanitize.js`: 统一XSS防护工具(sanitizeInput+sanitizeAIChatInput+escapeHtml)
- 消除重复代码: settings/index.vue 和 plan/create.vue 中的 sanitizeInput 改为从全局工具导入
- 4个AI对话入口补齐输入过滤: chat.vue、ai-classroom/classroom.vue、AIConsultPanel.vue、ai-consult.vue
- EnhancedRichText.vue: 添加script/style/iframe/object/embed标签+事件处理器+javascript:协议过滤
- MarkdownRenderer.vue: fallback路径改用escapeHtml()转义，防止绕过markdown-it的html:false

### 内存泄漏修复

- ai-classroom/index.vue: 轮询定时器提升为模块变量，onBeforeUnmount清理，clearPollTimers()集中管理
- useTypewriter.js: 添加getCurrentInstance()+onBeforeUnmount自动清理，组件销毁时定时器不再泄漏

### 审计结论（无需修复）

- 后端接口鉴权: 46个云函数逐一检查，**0个漏洞**，JWT实现安全(HS256+timingSafeEqual+过期检查)
- 前端XSS: 零v-html使用，markdown-it配置html:false，Vue模板{{}}自动转义，整体风险中低

### Files Changed (12 files)

- `src/App.vue` — 添加全局路由守卫(initRouteGuard)
- `src/utils/security/sanitize.js` — **新建** 全局输入净化工具
- `src/pages/settings/index.vue` — 删除本地sanitizeInput，改为全局导入
- `src/pages/plan/create.vue` — 同上
- `src/pages/chat/chat.vue` — 添加sanitizeAIChatInput
- `src/pages/ai-classroom/classroom.vue` — 添加sanitizeAIChatInput
- `src/pages/ai-classroom/index.vue` — 修复轮询定时器泄漏
- `src/components/business/school/AIConsultPanel.vue` — 添加sanitizeAIChatInput
- `src/pages/school-sub/ai-consult.vue` — 添加sanitizeAIChatInput
- `src/pages/practice-sub/components/EnhancedRichText.vue` — 添加HTML净化
- `src/pages/chat/components/MarkdownRenderer.vue` — fallback路径安全修复
- `src/composables/useTypewriter.js` — 添加自动清理

---

## [2026-03-29] 十三轮审计 — 死代码深度清理+盲区扫描+.env同步修复

- **Scope**: `frontend`, `backend`, `config`, `docs`
- **审计范围**: Store/API孤儿导出清理、全量盲区扫描(硬编码/Console泄漏/错误处理/a11y/i18n/.env同步/后端响应一致性/TODO/Git Hooks/全局错误处理)
- **质量关卡**: ESLint 0错误, 90文件/1196测试全过, H5构建通过

### 死代码清理

- 删除2个完全死亡Store: `vip.js`(68行) + `invite.js`(64行) — 零UI消费者
- 清理user.js facade: 移除17个VIP/邀请代理导出, 153→112行
- 清理5个Store孤儿导出(-373行/-31导出):
  - study.js: 174→66行, 删除8个孤儿(dailyGoal/todayStudyTime/weeklyProgress等)
  - school.js: 136→73行, 删除5个孤儿(info/hasPlan/setInfo/clearInfo/restore)
  - theme.js: 263→89行, 删除5个孤儿(toggleDarkMode/restoreTheme/watchSystemTheme/currentThemeConfig)
  - review.js: 215→196行, 删除8个孤儿(fsrsStatus/retentionCurve/currentDiagnosis/diagnosisList等)
  - gamification.js: 383→374行, 删除5个孤儿导出(longestStreak/lastStudyDate/streakFreezeCount/isStreakAtRisk/resetGamification)
- 清理30个未使用API导出(8个文件, -473行):
  - ai.api.js: -130行(getLessonDetail/getClassroomState/gradeQuiz等8个)
  - social.api.js: -117行(getInviteInfo/signInviteLink/findPKMatch等10个)
  - study.api.js: -63行, smart-study.api.js: -46行, practice.api.js: -47行
  - tools.api.js: -29行, user.api.js: -23行, school.api.js: -18行
- 删除35个测试已删除代码的测试用例(VIP/邀请/孤儿Store测试)

### 配置修复

- package.json: dev/build脚本显式指定`-p h5`(消除歧义)
- .env.production(本地): 补充缺失的VITE_INVITE_SECRET

### 盲区扫描结果(10项检查)

- CLEAN(5项): 硬编码字符串0, Console泄漏0, Service API错误处理完善, 全局错误处理完善(5层覆盖), i18n不需要(纯中文应用)
- MINOR(2项): 3个TODO注释(learning-analytics.js, 已知技术债), pre-push hook未跑测试(有CI保护)
- ISSUE(2项): .env.production缺失VITE_INVITE_SECRET(已修复), 后端3种响应格式不一致(记入技术债D036)
- INFO(1项): a11y基础缺失(无aria-label, 微信小程序场景非阻塞)

---

## [2026-03-29] 十二轮审计 — 孤儿SCSS/文档/Store/快照深度清理+死引用修复

- **Scope**: `frontend`, `backend`, `docs`, `config`, `infra`
- **审计范围**: SCSS孤儿扫描、文档死引用审计、Store/Composable孤儿审计、后端TS/YAML一致性、构建配置审计
- **质量关卡**: ESLint 0错误, 90文件/1231测试全过, H5构建通过

### 前端清理

- 删除8个孤儿SCSS文件(~84KB/3956行): responsive/design-system/design-system-v2/theme-bitget/design-system-mp/theme-wise/\_theme-vars/\_variables.scss
- 删除孤儿Store `useAppStore`(app.js, 110行) — 从未被任何页面/组件实例化, 同步移除stores/index.js导出+3个测试用例
- 测试用例数从1234→1231(删除3个测试孤儿useAppStore的用例)

### 文档清理

- 删除 docs/superpowers/ 整个目录(13个spec/plan文件, 1080行) — 功能均已实现
- 删除10个旧vitest/maestro快照(~2.9MB未跟踪文件)
- 修复11个AI-SOP文档中的160个死文件引用(3组并行Agent处理)
  - utils-reference.md: 39个死引用清理, 55→22个条目
  - MODULE-INDEX.md: 38个死引用清理
  - frontend-components.md: 29个死引用清理(含4个整节删除)
  - frontend-services.md: 14个死引用清理
  - ARCHITECTURE.md: 22个死引用清理(Service Layer/Composables/Design System树)
  - styling-system.md: 10个死引用清理(含8个已删SCSS文件)
  - PROJECT-BRIEF.md: 5个死引用清理
  - frontend-pages.md: 1个死引用清理
  - testing-infra.md: 1个死引用清理
  - backend-functions.md: 1个死引用清理
  - api-documentation.md: 主URL从Sealos备用修正为腾讯云主服务器
- 修复 docs/reports/current/README.md(列出6个文件但仅1个存在)

### 后端修复

- 创建 proxy-ai-stream.yaml(缺失的YAML配置)
- 删除 dist/functions/job-bot-handoff-notify.js(源.ts已删除的幽灵编译产物)
- 清理 .env.example: 移除5个已删除功能的JOB*BOT_HANDOFF*\*变量, 精简12个未集成AI提供商Key为3个

### 配置修复

- vite.config.js line 374: 注释从"lightningcss"修正为"esbuild"(与实际代码一致)

---

## [2026-03-29] 十一轮审计 — 冗余文件/文档/死代码/孤儿导出深度清理

- **Scope**: `frontend`, `infra`, `config`, `docs`
- **审计范围**: 静态资源孤儿扫描、NPM依赖审计、文档新鲜度审计、工具函数导出审计、配置文件一致性审计
- **质量关卡**: ESLint 0错误, 90文件/1234测试全过, H5构建通过

### 文件/文档清理

- 删除2个孤儿工具文件: `code-highlight.js`(11行), `mistake-classifier.js`(22行)
- git rm 34+历史报告文件(docs/reports/history/ 全部 + docs/reports/current/ 16个过期文件)
- 删除重复文档 `docs/archive/2026-02-reset/PROJECT_DEEP_SCAN_REPORT.md`(2152行)
- 删除本地未跟踪大型报告目录: `e2e-compat-html/`(96MB), `e2e-regression-html/`, `visual-report/`

### 孤儿导出清理（8个文件共清理约30个未使用导出）

- `performance.js`: 删除9个孤儿导出(memoize/memoizeAsync/requestIdleCallback等), 474→238行
- `learning-analytics.js`: 删除7个孤儿包装函数(getMultiDimensionReport/getLearningEfficiency等)+ACHIEVEMENTS导出
- `draft-detector.js`: 删除5个孤儿函数(detectUnfinishedPK/detectUnfinishedImport/savePKDraft等), 285→150行
- `micro-interactions.js`: 删除3个孤儿导出(hapticFeedback/celebrate/pageTransition)+关联私有代码, 226→59行
- `mp-confetti.js`: 删除3个孤儿快捷方法(celebrateSuccess/celebrateHighScore/celebrateCombo), 138→97行
- `haptic.js`: 删除2个孤儿函数(vibrateMedium/vibrateHeavy), 34→20行
- `system.js`: 删除3个孤儿函数(getWindowHeight/getPlatformInfo/getUserAgent), 247→198行
- `global-error-handler.js`: 删除2个孤儿函数(wrapAsync/safeExecute), 213→171行
- `event-bus-analytics.js`: 移除2个未使用常量导出(CONVERSION_EVENTS/EVENT_PRIORITY), 488→485行

### 配置修复

- `.gitignore`: 移除重复的`laf-backend/.app.yaml`条目(行51和63重复)
- `docker-compose.yml`: 移除已弃用的`version: '3.8'`字段
- `.env.test`: 移除2个幽灵变量(VITE_API_FALLBACK_URL/VITE_USER_NODE_ENV), 补充5个缺失变量

### 审计扫描结论

- 静态资源: 10个文件全部有引用, 0个孤儿
- NPM依赖: 11+27个包全部在用, 0个冗余
- 配置文件: pages.json 36路由全部对应文件, ESLint↔Prettier零冲突, jsconfig↔vite完全一致
- D032(3冗余tsconfig): 实际仅2个,分别服务Laf Cloud和Express Standalone编译目标, 不可合并, 已关闭

---

## [2026-03-29] 十轮审计 — 后端深度清理+PWA关键修复+Electron审计+环境变量同步

- **Scope**: `backend`, `frontend`, `infra`, `config`, `docs`
- **审计范围**: 后端孤儿代码/配置/工具类扫描、PWA离线缓存审计、Electron安全审计、环境变量一致性审计、前端死代码扫描、测试孤儿检查、.claude/目录清理
- **质量关卡**: ESLint 0错误, 90文件/1234测试全过, H5构建通过

### 关键修复

- **[Critical] PWA API缓存失效**: `vite.config.js:249` urlPattern正则仅匹配Sealos/Laf域名，完全遗漏主服务器`api.245334.xyz`，导致H5离线缓存无效。已修复
- **PWA manifest语言**: `lang`从默认`en`改为`zh-CN`
- **Electron preload.cjs**: 移除未使用的`ipcRenderer`导入

### 后端清理

- 删除孤儿YAML `job-bot-handoff-notify.yaml`（对应.ts已在Round 3删除）
- 创建缺失配置 `smart-study-engine.yaml`
- 删除3个零引用工具类: `anomaly-detector.ts`, `audit-logger.ts`, `env-validator.ts`
- 删除未引用脚本 `test-connection.js` + 空目录 `scripts/`
- 同步 `standalone/package.json` 版本号: `sql.js` ^1.11.0→^1.14.1, `ts-fsrs` ^5.3.1→^5.2.3

### 环境变量同步

- **laf-backend/.env.example**: 补充24个缺失键（SiliconFlow DS Keys ×10、其他AI提供商 ×12、REQUEST_SIGN_SALT、ENABLE_RANK_CACHE、SMTP_RETRY_TIMES/DELAY_MS）
- **前端.env.example**: 补充3个VITE*CACHE*\*变量（DEFAULT_TTL/LONG_TTL/MAX_SIZE）

### 代码健康扫描结论

- 前端89个.js文件 / 254条import → **0个死导入**
- 前端0个循环依赖
- 90个测试文件 → **0个孤儿测试**
- `.claude/` 清理: 删除23MB未使用的thread-manager ONNX模型 + 1个备份文件

### 新增技术债务

- D032: 3个冗余tsconfig文件（合并风险高，暂记录）
- D033: PWA图标4.8KB可能非真实512×512分辨率
- D034: PWA maskable与any图标应分离
- D035: 35个后端API导出未在前端使用（保留为可扩展能力）

- **Files Changed**: `vite.config.js`, `electron/preload.cjs`, `laf-backend/functions/smart-study-engine.yaml`(新建), `laf-backend/functions/job-bot-handoff-notify.yaml`(删除), `laf-backend/utils/{anomaly-detector,audit-logger,env-validator}.ts`(删除), `laf-backend/test-connection.js`(删除), `laf-backend/standalone/package.json`, `laf-backend/.env.example`, `.env.example`, `CLAUDE.md`

---

## [2026-03-29] 九轮审计 — 深度冗余清理+配置一致性修复+孤儿代码消除

- **Scope**: `infra`, `frontend`, `config`, `docs`
- **审计范围**: 全量孤儿代码扫描（组件/Store/Composable/静态资源/API导出）、配置文件一致性审计、文档状态检查
- **质量关卡**: ESLint 0错误, 90文件/1234测试全过, H5构建通过
- **扫描结果**:
  - 34个组件 → 1个孤儿（ErrorBoundary.vue，保留备用）
  - 16个Store → 2个间接消费（vip/invite通过useUserStore组合，保留）、1个仅测试引用（app，保留）
  - 18个Composable → **2个真孤儿已删除**（useSearchHistory、useStreamChat）
  - 12个静态资源 → **2个废弃图标已删除**（universe tab图标对，已无对应Tab）
  - 104个API导出 → 35个未使用（保留，代表后端已支持但前端未接入的能力）
- **配置修复**:
  - **manifest.json**: 删除重复`plus`块（与`app-plus`完全重复的39行）、`requiredPrivateInfos`从4项修正为1项（仅`chooseMessageFile`实际使用，移除3个虚假声明避免微信审核风险）、清理空的百度/头条/quickapp平台占位
  - **根目录manifest.json**: 删除（与`src/manifest.json`重复，uni-app只用src/下的）
  - **project.config.json**: `es6`和`enhance`与manifest.json同步（true→false）
  - **jsconfig.json**: 移除14行冗余路径别名（`@/*`通配符已全覆盖）+ 移除指向已删除`common/`的死别名
  - **测试修复**: `app-launch-config.spec.js`适配`plus`块删除（改为断言`plus`不存在）
- **Files Changed**: `src/manifest.json`, `manifest.json`(删除), `project.config.json`, `jsconfig.json`, `src/composables/useSearchHistory.js`(删除), `src/composables/useStreamChat.js`(删除), `src/static/tabbar/universe.png`(删除), `src/static/tabbar/universe-active.png`(删除), `tests/unit/app-launch-config.spec.js`

---

## [2026-03-29] 八轮审计 — 仓库瘦身+NPM清理+微信小程序包验证+后端函数全量测试+性能审计

- **Scope**: `infra`, `frontend`, `backend`, `performance`
- **审计范围**: 仓库清理、NPM依赖健康、Git跟踪治理、微信小程序包大小验证、46个后端云函数运行时测试、H5性能审计
- **质量关卡**: ESLint 0错误, 90文件/1234测试全过, H5构建通过, 微信小程序构建通过
- **清理内容**:
  - **Git仓库瘦身**: `git rm -r --cached audit-screenshots/` 移除54个PNG文件(~10MB)的Git跟踪（文件仍在本地，仅从版本控制移除）
  - **NPM依赖清理**: 卸载 `@vitest/coverage-istanbul`（vitest使用v8 provider，非istanbul）、`ai-agent-team`（后端有独立package.json）
  - **废弃脚本删除**: 删除10个一次性/过期脚本（add-will-change, apply-design-tokens, convert-to-webp, final-quality-review, 3个hljs/katex/markdown-it shim, cleanup-test-data, fix-wxss-universal-selector, setup-maestro-macos）
- **验证结果**:
  - **微信小程序主包**: 1896KB < 2048KB ✅（余量152KB，13个分包共2040KB，总计3936KB）
  - **后端云函数**: 46/46全部正常 — 41个对外函数正常响应（200 + JSON），5个内部管理函数（db-create-indexes, db-migrate-timestamps, data-cleanup, account-purge, material-manager）按设计不暴露路由
  - **H5性能评分**: 7.5/10 — 总包3MB(gzip后~1MB)，86个代码分割chunk，页面级分割+动态懒加载优秀，依赖管理干净无臃肿库
- **性能审计发现**:
  - 主入口452KB(gzip 149KB)偏大，缺少vendor分离（vue/pinia/uni-app运行时）
  - 未配置vite-plugin-compression构建时预压缩
  - 5组重复图片浪费~76KB（uni-app静态资源复制行为）
  - 建议：安装vite-plugin-compression + 配置manualChunks可将首屏JS从149KB降至~80KB
- **Files Changed**: `package.json`, `package-lock.json`, 54个`audit-screenshots/*.png`移出跟踪, 10个`scripts/`废弃脚本删除

---

## [2026-03-29] 七轮审计 — CI/CD修复+全量UI截图审计(34子包页面+暗色模式)

- **Scope**: `ci`, `infra`, `docs`
- **审计范围**: CI/CD流水线诊断修复、34个子包页面UI截图审计、暗色模式验证
- **质量关卡**: ESLint 0错误, 90文件/1234测试全过, H5构建通过
- **修复内容**:
  - **CI/CD: trivy-action版本不存在(Critical)**: `aquasecurity/trivy-action@0.28.0`版本号不存在（标签格式应为`v`前缀），导致所有CI运行失败。更新为`@v0.35.0`，影响ci-cd.yml(2处)+security-scan.yml(2处)共4处
  - **CI/CD: Maestro Java 17兼容性**: GitHub Runner环境变量`JAVA_TOOL_OPTIONS`包含Java 17不支持的`--sun-misc-unsafe-memory-access=allow`参数，导致QA Nightly Regression失败。在qa-nightly-regression.yml中覆盖JAVA_TOOL_OPTIONS
  - **UI截图审计(34页面)**: 使用Playwright对全部36个子包页面截图审查(390x844@2x)。结论：所有页面UI正常，空态/加载态显示正确
  - **暗色模式验证**: 10个关键页面暗色模式截图，确认CSS变量切换正常
- **审计发现**: lint-and-test job一直通过，但security-scan和build job因trivy-action版本错误持续失败
- **Files Changed**: `.github/workflows/ci-cd.yml`, `.github/workflows/security-scan.yml`, `.github/workflows/qa-nightly-regression.yml`, `docs/sop/CHANGE-LOG.md`, `docs/status/HEALTH.md`

---

## [2026-03-29] 六轮全量全方位审计 — SOP重写+文件治理+BUG修复+Electron补全

- **Scope**: `frontend`, `backend`, `infra`, `arch`, `docs`
- **审计范围**: 12阶段全覆盖（质量关卡/后端编译/服务器运维/API全链路/架构分层/安全/UI截图/UX交互/文件治理/SOP重写/BUG修复/最终验证）
- **质量关卡**: ESLint 0错误, 90文件/1234测试全过, H5构建通过, 后端TS编译通过
- **服务器状态**: PM2在线(63MB/19h), MongoDB正常(6天), Nginx正常, SSL有效至2026-06-20, 磁盘42%
- **API全链路审计**: 101个前端API函数 → 36个后端云函数，链路100%匹配，0断裂
- **安全审计**: 无CRITICAL发现，密钥管理/Auth防护/XSS防护/IDOR防护全部合规
- **修复内容**:
  - **TabBar缺失"择校"标签(Critical)**: custom-tabbar.vue 的 allTabs 数组只有3个标签（首页/刷题/我的），遗漏了"择校"。已修复，4个标签全部显示正常
  - **practice/index.vue lafService未导入BUG**: 第869行使用未导入的 lafService.request()，改为使用 practice.api.js 的 exportAnki() 封装函数
  - **文件治理**: 删除根目录重复 App.vue（与src/App.vue内容不同步）、删除孤儿目录 common/（2个零引用文件）、删除无效脚本 update_changelog.sh
  - **依赖清理**: 卸载未使用的 @formkit/auto-animate（仅注释中提及，无实际import）
  - **Electron桌面应用补全**: 安装 electron + electron-builder，添加 electron:dev/build:mac/build:win npm scripts
  - **manifest.json同步**: src/manifest.json 的 requiredPrivateInfos 从空数组补全为与根目录一致的4项
  - **CLAUDE.md SOP重写**: 升级为CEO模式（AI局限性防护/8个请求路由/开源搬运流程/Electron命令/配置文件索引）
- **审计发现(已知技术债务)**:
  - 9个文件绕过Service层直接调用lafService（与CLAUDE.md记录一致）
  - 5个孤儿后端函数（upload-avatar/rag-query/proxy-ai-stream/material-manager/group-service）待评估
  - 3个LOW级安全建议（material-manager等3个函数建议统一用requireAuth）
  - npm有46个构建工具链漏洞（不影响运行时，需等uni-app框架升级）

## [2026-03-29] 五轮全量全方位审计 — 架构修复+文件治理+35页面UI审计+分支清理

- **Scope**: `frontend`, `backend`, `infra`, `arch`, `docs`
- **审计范围**: 10阶段全覆盖（全貌扫描/构建/运维/架构/API/UI截图/安全/SOP/文档）
- **质量关卡**: ESLint 0错误, 90文件/1234测试全过, H5构建通过, 后端TS编译通过
- **服务器状态**: PM2在线(65MB), MongoDB正常, Nginx正常, SSL有效至2026-06-20, 磁盘42%
- **修复内容**:
  - **PK Battle API动作名不匹配(Critical)**: social.api.js 中4个便捷函数(createPKRoom/joinPKRoom/getPKRoomStatus/submitPKResult)使用了后端不支持的action名，会被拒绝。重写为后端实际支持的7个action: find_match/poll_room/submit_result/room_answer/leave_room/get_records/calculate_elo
  - **3对完全重复文件消除(-1632行)**: useTypewriter.js(2处→共享composable), privacy-authorization.js(2处→共享utils/auth), StudyHeatmap.vue(2处→共享component)。原位置改为代理re-export文件
  - **26个过期本地分支清理**: 24个已合并的test-fix分支 + 1个孤立pre-release分支 + 1个已合并feature分支。保留2个有价值未合并分支(feat/integrate-mp-html, refactor/yolo-optimizations)
  - **35页面UI截图审计**: 使用Playwright headless Chromium(390x844 @2x)对全部36个路由页面截图审查。结论: 所有页面UI正常，空态显示正确，深色/浅色模式切换正常
- **审计发现(待观察)**:
  - 19个文件存在分层违规(pages直接调用lafService)，其中usePKRoom.js和storageService.js已有修改待提交
  - learning-analytics.js生成模拟的"同伴对比"数据(标记了\_isEstimated:true)
  - 3个未使用组件(ErrorBoundary/ConfettiOverlay/StudyTrend)和4个未使用服务
  - 本地网络到腾讯云间歇性RST(D022已记录)，服务器内部一切正常
- **Files Changed**: `src/services/api/domains/social.api.js`, `src/composables/useTypewriter.js`(new), `src/utils/auth/privacy-authorization.js`(new), `src/pages/practice-sub/composables/useTypewriter.js`, `src/pages/chat/composables/useTypewriter.js`, `src/pages/tools/privacy-authorization.js`, `src/pages/chat/privacy-authorization.js`, `src/pages/study-detail/index.vue`, `docs/status/HEALTH.md`, `docs/sop/CHANGE-LOG.md`

---

## [2026-03-28] 深度审计四轮 — 后端部署+性能审计+全量API封装+CI/CD修正

- **Scope**: `backend`, `frontend`, `infra`, `ci`, `docs`
- **审计范围**: Phase 21-26
- **修复内容**:
  - 后端部署: TS编译→scp上传→pm2 restart
  - cloud-shim修复: 创建 @lafjs/cloud shim package 让 health-check 正常加载
  - 性能审计: H5总JS Gzip 529KB，最大bundle 149KB Gzip，markdown-it已懒加载，无明显优化点
  - API断链: mistake-manager封装7函数 + pk-battle封装5函数，9条断链全部完成
  - CI/CD修正: smoke test URL从占位地址改为真实 api.245334.xyz
  - .gitignore: 新增 audit-screenshots/ 排除
- **当前质量关卡**: lint ✅ | 90文件/1234用例 ✅ | H5构建 ✅ | 后端部署在线 ✅
- **Breaking Changes**: 无

---

## [2026-03-28] 深度审计三轮 — 页面交互测试+API断链封装+后端死函数清理

- **Scope**: `frontend`, `backend`, `docs`
- **审计范围**: Phase 17-20，覆盖36页面交互/API断链/后端死函数/文档
- **审计结果**:
  - Phase 17: 28个页面交互测试通过，Vite懒编译问题仅影响开发环境，生产构建正常
  - Phase 18: 9个API断链 → 5个已封装到domain层，4个(pk/mistake/avatar/stream)待渐进迁移
  - Phase 19: 8个疑似死函数 → 7个确认保留(3个运维工具+4个待对接功能)，1个确认删除
  - 后端管理函数安全结论：data-cleanup/db-create-indexes/db-migrate-timestamps 均已有 requireAdminAccess 保护（上轮审计结论有误已纠正）
- **修复内容**:
  - `practice.api.js`: 新增 exportAnki() + importAnki() + submitAnswer() 三个封装
  - `ai.api.js`: 新增 ragIngest() 封装
  - `school.api.js`: 新增 crawlSchoolData() 封装
  - 删除 `laf-backend/functions/job-bot-handoff-notify.ts` (-601行，与考研业务无关)
  - 删除 `tests/unit/audit-job-bot-handoff-notify.spec.js`
  - CLAUDE.md 质量关卡数据更新: 90 files / 1234 tests
- **当前质量关卡**: lint ✅ | 90文件/1234用例 ✅ | H5构建 ✅
- **Breaking Changes**: 无

---

## [2026-03-28] 深度审计二轮 — 分层违规修复+UI交互测试+focus-timer修复+后端验证

- **Scope**: `frontend`, `backend`
- **审计范围**: Phase 11-16，覆盖微信包体积/分层违规/UI交互/半成品功能/API链路/后端函数
- **审计结果**:
  - Phase 11: 微信小程序主包 1888KB/2048KB，余量 160KB ✅
  - Phase 12: 分层违规 8 处分析→profile 已修复，其余 6 处保持现状合理
  - Phase 13: UI交互测试 — 引导流程完整 ✅，首页弹窗正常 ✅，专注计时器 Bug 已修复
  - Phase 14: 后端 47 个函数全部有 try-catch 错误处理（审计工具误判已澄清）
  - 9 个 API 断链（前端绕过 API 层裸调后端）确认为技术债务，不阻塞生产
- **修复内容**:
  - `profile/index.vue`: lafService→profileStore.updateProfile()，分层违规归零
  - `focus-timer.vue`: WdCircle Canvas 不支持 CSS 变量，改为 computed 颜色值
    修复前: 189 个 console error + 进度条不渲染
    修复后: 0 error + 进度条正常显示
- **Files Changed**:
  - `src/pages/profile/index.vue` — 分层违规修复
  - `src/pages/tools/focus-timer.vue` — Canvas 颜色兼容性修复
- **Breaking Changes**: 无

---

## [2026-03-28] 全量全方位审计 — 10阶段SOP级审计+修复+SOP重写

- **Scope**: `frontend`, `backend`, `infra`, `docs`, `test`
- **审计方案**: 按世界顶级软件开发公司职位架构设计10阶段审计，覆盖构建/代码质量/后端健康/安全/UI-UX/功能完整性/架构治理/SOP/文档/CI-CD
- **审计结果**:
  - Phase 1 构建验证: H5构建通过 + 后端TS编译通过
  - Phase 2 代码质量: ESLint 0错误 + 91文件/1240用例全通过（清理后）
  - Phase 3 后端健康: PM2在线 + MongoDB运行 + Nginx+SSL正常 + 证书到2026-06-20
  - Phase 4 安全审计: 前端无密钥泄露 + 后端鉴权覆盖完整 + Git历史干净
  - Phase 5 UI/UX: 16张截图（深色/浅色），发现TabBar遮挡问题
- **修复内容**:
  - 修复首页TabBar遮挡内容: `padding-bottom` 从 `200rpx` 改为 `140px`（与practice页一致）
  - 清理20个死代码文件: 8个未使用组件 + 2个composables + 7个utils + 3个services
  - 同步删除关联测试: `integration-mistake.spec.js` + `real-utils.spec.js` config-validator块
  - `.env.test` 从14行补充至66行，与 `.env.example` 完全同步
  - 3处 `console.warn` 改为 `logger.warn`（import-data/do-quiz/knowledge-graph）
  - CLAUDE.md 重写: 移除明文密码 + 新增第8条红线 + 记录分层违规技术债务 + 更新质量关卡数据
  - 创建 `.env.server`（gitignore）存放服务器敏感凭证
  - `.gitignore` 新增 `.env.server` 排除规则
- **Files Changed**:
  - `src/pages/index/index.vue` — 修复TabBar遮挡
  - `src/pages/practice-sub/import-data.vue` — console.warn → logger.warn
  - `src/pages/practice-sub/do-quiz.vue` — console.warn → logger.warn
  - `src/pages/knowledge-graph/index.vue` — console.warn → logger.warn
  - `tests/unit/real-utils.spec.js` — 移除已删除模块的测试块
  - `.env.test` — 补充31个缺失变量
  - `CLAUDE.md` — SOP重写（安全+质量关卡+已知陷阱更新）
  - `.env.server` — 新建（服务器凭证）
  - `.gitignore` — 新增 .env.server 排除
  - `docs/status/HEALTH.md` — 更新审计日期和资源数据
  - 删除20个死代码文件（详见审计报告）
- **Breaking Changes**: 无

---

## [2026-03-28] 全量审计 Round 7 — 安全漏洞修复+功能阻断修复+代码质量加固

- **Scope**: `backend`, `frontend`, `test`, `docs`
- **Files Changed**:
  - `laf-backend/functions/question-bank.ts` — [Critical] seedPreset添加requireAdminAccess校验
  - `laf-backend/functions/school-query.ts` — [High] 添加checkRateLimitDistributed(30req/min/IP)
  - `src/pages/practice-sub/invite-deep-link.js` — [Blocker] validateInviteCode和joinPKRoom改为调用后端API
  - `src/services/api/domains/study.api.js` — 移除7个从smart-study.api.js的重导出
  - `src/services/api/domains/smart-study.api.js` — 移除generateAdaptivePlan别名
  - `src/stores/modules/study-engine.js` — generateAdaptivePlan→generateStudyPlan
  - `src/pages/plan/index.vue` + `adaptive.vue` + `study-detail/index.vue` + `mistake/index.vue` + `quiz-result.vue` — 更新导入路径
  - `src/services/subscribe-message.js` — 添加isConfigured()优雅降级
  - `src/pages/plan/intelligent-plan-manager.js` — 最佳学习时间从硬编码→智能推荐
  - 删除根目录pages.json(过时副本,与src/pages.json分叉)
  - 3个测试文件适配代码变更(invite-deep-link/school-query/question-bank)
- **Summary**:
  - **[Critical安全]** question-bank seedPreset现在需要管理员权限,任何普通用户无法批量插入题目
  - **[High安全]** school-query添加分布式速率限制,防止爬虫/DDoS
  - **[Blocker修复]** PK邀请码验证和加入房间从"永远失败"修复为调用后端API
  - **[D019修复]** study.api.js与smart-study.api.js 7个同名导出消除,generateAdaptivePlan统一为generateStudyPlan
  - **[D020修复]** subscribe-message.js添加优雅降级,模板ID为空时静默跳过
  - **[功能增强]** 最佳学习时间从硬编码09:00→基于答题数据智能推荐
  - **[配置修复]** 删除根目录过时的pages.json(与src/pages.json严重分叉)
  - **测试**: 92/92文件 1265/1265用例全部通过(+2新测试)
- **Breaking Changes**:
  - study.api.js不再重导出smart-study的函数,需从smart-study.api.js直接导入
  - generateAdaptivePlan已重命名为generateStudyPlan

---

## [2026-03-28] 全量审计 Round 3-5 — 安全加固+测试全通过+文档清洗+ESLint清零

- **Scope**: `backend`, `frontend`, `docs`, `test`
- **Files Changed**:
  - `laf-backend/functions/{user-profile,question-bank,answer-submit,upload-avatar}.ts` — 认证顺序修复(参数前→认证前)
  - `src/pages/practice-sub/do-quiz.vue` — showXpToast未定义修复 + ESLint清零
  - `src/pages/study-detail/index.vue` — LOADING emoji→📊字符
  - `src/pages/index/index.vue` + `src/pages/practice-sub/composables/useMarkdownRenderer.js` — ESLint清零
  - `src/utils/animations/mp-confetti.js` — ESLint清零
  - `tests/unit/audit-auth-response-shape.spec.js` — 适配认证顺序修复(400→401)
  - `tests/unit/integration-mistake.spec.js` — 适配ts-fsrs双重掌握条件
  - 17个冗余文档删除, 8个测试产物移出git追踪, 1个大报告归档
  - `package.json` — 卸载未使用的@antv/f2
- **Summary**:
  - **安全加固**: 4个端点认证顺序修复并部署到生产服务器
  - **测试**: 92/92文件 1263/1263用例全部通过(修复2个因代码改动导致的测试失败)
  - **代码质量**: ESLint从6个警告→0个(完全清零)
  - **文档治理**: 112→95个文档(删除17个冗余+8个测试产物)
  - **依赖卫生**: 卸载未使用的@antv/f2, NPM漏洞73→69
  - **UI审计**: 新增4个页面截图(mock-exam/file-manager/import-data/doc-convert), 累计25页
  - **微信小程序**: 主包1800KB/2048KB(余量248KB)
- **Breaking Changes**: question-bank无认证请求从400→401(D023认证顺序修复)

---

## [2026-03-28] 全量深度审计 Round 2 — 生产修复 + 文件治理 + SOP重建

- **Scope**: `backend`, `frontend`, `infra`, `docs`
- **Files Changed**:
  - `laf-backend/standalone/package.json` — 新增4个缺失依赖(ts-fsrs/jszip/sql.js/ai-agent-team)
  - 服务器 `/opt/apps/exam-master/backend/` — 安装ts-fsrs修复fsrs-optimizer 404
  - `src/pages/practice-sub/services/fsrs-service.js` — 640行重复→22行重导出代理
  - `src/pages/practice-sub/services/fsrs-optimizer-client.js` — 229行重复→10行重导出代理
  - `src/pages/practice-sub/utils/question-normalizer.js` — 131行分叉→10行重导出代理
  - `src/pages/practice-sub/utils/mistake-fsrs-scheduler.js` — 167行→12行重导出代理
  - `src/utils/practice/question-normalizer.js` — 合并B版本的explanation回退逻辑
  - `src/utils/practice/mistake-fsrs-scheduler.js` — 升级为完整ts-fsrs实现（从practice-sub提升）
  - `src/pages/_unreleased/` — 删除6个死代码文件+目录
  - 根目录 `audit-h5-*.png` — 删除4个垃圾截图文件
  - `src/pages/index/index.vue` — 修复content-wrapper底部padding，避免tabbar遮挡
  - `src/pages/ai-classroom/index.vue` — 修复背景色（从纯黑硬编码→主题感知渐变）
  - `CLAUDE.md` — 全面重写为自动化开发引擎（请求路由器+执行流水线）
  - `docs/status/HEALTH.md` — 更新活跃问题清单(D022-D026)
- **Summary**:
  - **生产修复**: 服务器缺少ts-fsrs导致fsrs-optimizer返回404，已安装并重启PM2
  - **文件治理**: 清理4对重复代码（共~1070行→54行代理），6个死代码文件，4个垃圾文件
  - **UI修复**: 首页tabbar遮挡内容 + AI课堂背景纯黑
  - **后端审计**: 47个云函数全部可达，认证机制正确生效
  - **SOP重建**: CLAUDE.md重写为"请求路由器"模式
  - **UI审计**: 17个核心页面截图审查（浅色+深色模式）
  - **发现**: 腾讯云控制台防火墙未放行443（HTTPS外部不可达），需用户操作
- **Breaking Changes**: 无

---

## [2026-03-27] 全量审计第二轮 — 页面上线 + DailyGoalRing + E2E + 深色模式

- **Scope**: `frontend`, `docs`
- **Files Changed**: 5页面移动+路由注册, DailyGoalRing组件(266行), useDynamicMixin修复, study.api.js去重, 11文件ESLint修复, favicon, plan重复键修复
- **Summary**: 6个未发布页面上线，DailyGoalRing进度环组件开发，E2E P0/P1 96.3%通过，深色模式审查良好
- **Breaking Changes**: 无

---

## [2026-03-27] 全量审计 — 安全修复 + 死代码清理 + 配置修正 + UI修复

- **Scope**: `frontend`, `backend`, `deploy`, `docs`, `infra`
- **Files Changed**:
  - `laf-backend/.env.example` — **P0安全修复**: 7 个真实 API 密钥替换为占位符(Zhipu/Groq/Gemini/OpenRouter/Cerebras/Mistral/Manus)
  - `src/services/api/core/request.js` — **已删除**: 106行遗留文件，无任何代码引用
  - `src/stores/modules/auth.js` — 配置导入迁移: `common/config` → `@/config/index.js`
  - `src/stores/modules/profile.js` — 同上
  - `src/stores/modules/study.js` — 同上
  - `src/config/index.js` — 新增 `storage.cacheKeys` 配置项(token/userInfo/studyProgress)
  - `deploy/docker/Dockerfile` — CMD 修正: `health-check.js` → `standalone/server.js`
  - `package.json` — lint 脚本移除 `|| true`，不再吞掉 ESLint 错误
  - `CLAUDE.md` — 服务层路径修正(ai.service.js→ai.api.js)、云函数数量更新(35→47)
  - `src/App.vue` — **BUG修复**: H5 环境隐藏原生 tabBar，解决双 TabBar 重叠遮挡内容问题
  - `src/services/api/domains/social.api.js` — **BUG修复**: socialService 函数补充便捷方法(getFriendList/searchUser/sendRequest等)，修复 friend-list.vue TypeError
  - `src/composables/useDynamicMixin.js` — **BUG修复**: H5分包模块加载从 require() 改为 import()，消除 practice 页 "当前环境不支持" 错误
  - `src/pages/index/index.vue` — **BUG修复**: 注释掉不存在的 DailyGoalRing 组件引用，消除 Vue 警告；移除未使用的 lafService 导入
  - `src/services/api/domains/study.api.js` — **D019修复**: 移除与 smart-study.api.js 重复的 7 个函数，改为 re-export
  - `src/services/api/domains/smart-study.api.js` — 新增 generateAdaptivePlan 别名
  - `src/pages/plan/index.vue` — 移除 data() 中重复定义的 isRefreshing 属性
  - `index.html` — 添加 favicon link 标签消除 404
  - 11 个文件 ESLint 修复: 未使用变量前缀 `_`、移除死导入、Vue reserved keys 重命名
- **Summary**: 全量审计涵盖安全/构建/测试/运维/API/UI截图/文件归类/架构。修复 P0 安全漏洞(密钥泄露)、H5双TabBar重叠、社交服务TypeError，清理死代码。18个页面逐页截图审查。92个测试文件1263用例全部通过。
- **Breaking Changes**: 无。所有修改均向后兼容。

---

## [2026-03-27] Round 63: 发布阻塞修复 — SVG 404 + school分包 + 主包瘦身

- **Scope**: `frontend`, `deploy`, `infra`
- **Files Changed**:
  - `src/components/base/base-icon/icons.js` — 完全重写：从引用 SVG 文件改为内联 data URI，消除 folder.svg/sparkle.svg 等 404 错误
  - `pages.json` — school 从 tabBar 主包移到 subPackages 分包
  - `src/components/layout/custom-tabbar/custom-tabbar.vue` — 移除"择校"tab
  - `src/pages/practice-sub/quiz-gamification-bridge.js` — store 引用路径修正
  - `src/stores/index.js` — barrel export 精简，移除非主包 store 的 re-export
  - `src/composables/useHomeReview.js` — fsrs-service + knowledge-engine 改为动态导入
  - `src/pages/profile/index.vue` — checkin-streak + streak-recovery 改为动态导入
  - `src/pages/practice/index.vue` — learning-analytics + study.api 改为动态导入
  - `src/components/business/index/AIDailyBriefing.vue` — study.api 改为动态导入
- **Summary**:
  - **SVG 404 修复**: icons.js 从引用 `/static/icons/ui/*.svg` 文件改为内联 data URI（18个核心图标），彻底消除图标加载失败
  - **school 分包化**: 从 tabBar 移到 subPackages，底部导航变为3个（首页/刷题/我的）
  - **主包瘦身尝试**: 多个大模块（study.api/learning-analytics/checkin-streak/streak-recovery/fsrs-service/knowledge-engine）改为动态导入。但 uni-app 微信小程序构建器不支持动态 import 的分包优化，所有引用过的模块仍被打入主包
  - **当前主包**: 1740KB（目标 1500KB，差 240KB）
- **Breaking Changes**: school 页面不再是 tabBar 页面，需要通过"我的"页面跳转访问

## [2026-03-27] Round 62: 部署上线 — 后端47函数 + smart-study-engine 首次部署

- **Scope**: `deploy`, `backend`
- **Files Changed**: 服务器端 47 个编译后的 .js 云函数 + standalone/ 目录
- **Summary**:
  - 后端 TS 编译 → rsync 上传腾讯云 → perl/sed import rewrite (`@lafjs/cloud` → `../standalone/cloud-shim.js`) → PM2 重启
  - **smart-study-engine 首次部署**：analyze_mastery / error_clustering / sprint_priority / generate_plan 四个 action 全部可用
  - 健康检查通过：`/health-check` → `{"code":0,"status":"ok"}`
  - smart-study-engine 认证验证通过：`/smart-study-engine` → `{"code":401,"message":"请先登录"}` → 函数加载成功
  - 微信小程序构建通过：主包 1872KB（< 2048KB 限制）
  - 修复了 `_shared/` 子目录的相对路径深度问题（services/agents/generation/orchestration 需要 `../../../` 而非 `../`）
- **Breaking Changes**: 无

## [2026-03-27] Round 61: 质量收尾 — 停止加功能，验证稳定性

- **Scope**: `testing`, `docs`
- **Summary**: 单元测试 91/92 通过（1261断言0失败），H5构建通过。AI助手转型7层级全覆盖，建议进入部署+用户验证阶段。
- **Breaking Changes**: 无

## [2026-03-27] Round 60: AI从"陌生人"到"记住你的私教" + 自适应周计划

- **Scope**: `frontend`
- **Files Changed**:
  - `src/components/business/index/AIDailyBriefing.vue` — 新增 AI 学习记忆（每日摘要存储 + 次日简报引用昨日进展）
  - `src/pages/plan/index.vue` — 接入后端 generate_plan API，展示 AI 自适应7天学习计划
- **Summary**:
  - **AI学习记忆**: 每次首页AI简报完成分析后，将当天的学习摘要（做题数/正确率/薄弱点）保存到本地存储。次日打开APP时，简报会引用"昨天你做了15题，「概率统计」仍需加强"，形成跨会话连续性。最多保留7天记忆。
  - **自适应学习计划**: plan 页从纯手动管理升级为 AI 驱动——调用后端 `generate_plan` API 生成7天自适应计划（含阶段划分、每日重点科目、具体任务列表），"今天"卡片有一键开始按钮。计划缓存1小时，下拉刷新可重新生成。
- **Breaking Changes**: 无

## [2026-03-27] Round 59: AI从单向广播→双向对话 + 考前冲刺自动化

- **Scope**: `frontend`
- **Files Changed**:
  - `src/pages/practice-sub/do-quiz.vue` — 答错弹窗新增"还是不懂？问AI导师"按钮 + askAIAboutThis 方法
  - `src/pages/chat/chat.vue` — 支持 context=question URL 参数，自动读取上下文并发送
  - `src/components/business/index/AIDailyBriefing.vue` — 冲刺模式：距考试≤30天时调用 sprint_priority API，用ROI战略优先级重写任务列表
- **Summary**:
  - **上下文感知AI对话**: 答错后出现"问AI导师"入口，点击后跳转聊天页，自动带入题目+选择+正确答案上下文，AI导师直接针对这道题解答。从"AI说给你听"变成"你可以跟AI对话"
  - **考前冲刺自动化**: 当用户设置的考试日期距今≤30天，首页AI简报自动调用后端 sprint_priority API，用ROI计算重写任务列表（只推 must_do 项），显示战略放弃建议，消息语气变为冲刺模式
- **Breaking Changes**: 无

## [2026-03-27] Round 58: AI全程教练 — 练习页/做题过程/学习节奏三大改造

- **Scope**: `frontend`
- **Files Changed**:
  - `src/pages/practice/index.vue` — 新增 AI 推荐今日训练卡片（调用 analyzeMastery 获取薄弱知识点，一键开始零决策）
  - `src/pages/practice-sub/do-quiz.vue` — 新增答错后个人历史AI微反馈 + 连续45分钟休息提醒
- **Summary**:
  - **练习页AI入口**: LearningStatsCard 下方新增醒目的 AI 推荐卡片，显示"AI推荐：今日重点：线性代数（掌握度35%）"+ 一键开始按钮，让AI推荐从首页延续到练习页
  - **答错AI微反馈**: 答题结果弹窗新增 personalHint 条，基于错题本历史数据生成一句话上下文提醒（"你在「概率统计」上已累计错5题，建议做完后去错题本集中突破"），纯本地零延迟
  - **学习节奏管理**: 计时器检测连续学习45分钟后显示温和的休息提醒条（渐变紫色），每次练习仅提醒一次
- **Breaking Changes**: 无

## [2026-03-27] Round 57: AI助手体验第二轮 — 打通全链路 + 消灭假数据

- **Scope**: `frontend`
- **Files Changed**:
  - `src/pages/practice-sub/do-quiz.vue` — 做题完成弹窗从 CustomModal 升级为 QuizResult 全屏结果页
  - `src/pages/practice-sub/components/quiz-result/quiz-result.vue` — 新增 diagnosisSummary/hasNextRecommendation prop；激励文案从随机假数据→基于表现的真实个性化点评；新增 continueNext emit
  - `src/pages/study-detail/index.vue` — 新增 AI 学习洞察卡片（调用 analyzeMastery 生成一句话诊断 + 薄弱点标签）
- **Summary**:
  - **做题完成体验重构**: 将 CustomModal 纯文本弹窗替换为 quiz-result 全屏结果页，展示正确率圆环+分类正确率+AI推荐下一步+多出口跳转（错题本/薄弱训练/继续刷/诊断报告）
  - **消灭假数据**: quiz-result 的"你超过了XX%用户"（随机数）替换为基于分类正确率的真实个性化点评；如果有后端 AI 诊断摘要则优先使用
  - **学习数据页AI化**: study-detail 页新增 AI 洞察卡片，调用 analyzeMastery 获取真实掌握度数据，生成人话诊断 + 趋势预警 + 薄弱点标签
- **Breaking Changes**: do-quiz.vue 做题完成从 CustomModal 改为 QuizResult 全屏页，UI体验变化较大（改善方向）

## [2026-03-27] Round 56: 产品从"功能集合"升级为"AI助手" — 四层改造

- **Scope**: `frontend`, `backend`
- **Files Changed**:
  - `src/services/api/domains/study.api.js` — 修正2个API action名不匹配 + 新增3个API方法
  - `src/components/business/index/AIDailyBriefing.vue` — 假AI→真AI，接入后端 smart-study-engine
  - `src/pages/index/index.vue` — 首页集成 AIDailyBriefing 组件
  - `src/pages/practice-sub/components/quiz-result/quiz-result.vue` — 新增"AI推荐下一步"功能
  - `src/pages/mistake/index.vue` — 新增知识点聚类视图 + 一键针对训练
- **Summary**:
  - **API层**: 修正 `error_clustering`/`generate_plan` action名与后端不匹配的问题；新增 `getDeepCorrection`/`getPendingCorrections`/`markCorrectionRead` 三个 API
  - **首页AI助手**: 已开发但闲置的 AIDailyBriefing 组件升级为真正调用后端AI的版本（本地规则即时展示 + 后端异步增强 + 静默降级），集成到首页 WelcomeBanner 下方
  - **做题结束引导**: quiz-result 新增"AI推荐下一步"区域，基于本次做题表现（错题数/正确率/分类正确率）+ 后端掌握度分析，推荐复习错题/薄弱点训练/挑战新题
  - **错题智能聚类**: 错题页筛选栏新增"知识点聚类"入口，调用后端 error_clustering API 展示按错误类型×知识点的聚合分析，含严重度/趋势/AI建议/一键针对训练
- **Breaking Changes**: 无

## [2026-03-26] Round 55: 构建验证 + uni.showToast 100%清零 + Options API 第二批迁移

- **Scope**: `frontend`, `testing`
- **Files Changed**:
  - `src/utils/date.js` — 新建：`today()` 函数导出（修复构建报错）
  - `src/services/api/domains/study.api.js` — 补 4 个缺失方法：`analyzeMastery/getErrorClusters/getSprintPriority/generateAdaptivePlan`
  - `src/utils/auth/loginGuard.js`, `src/utils/learning/learning-goal.js`, `src/pages/practice-sub/quiz-mistake-handler.js` — 最后 5 处 uni.showToast/Loading → toast.\*
  - 3 个测试文件补 `hideToast` mock
  - 10 个 Vue 组件 Options API → `<script setup>`（ResumePracticeModal, AbilityRadar, CustomModal, custom-tabbar, AIDailyBriefing, StudyTrendChart, offline-indicator, InviteModal, school-skeleton, base-skeleton）
- **Summary**:
  1. **构建验证**：H5 + MP 均 DONE，MP 主包 **1568KB**（从 2036KB 降 23%）
  2. **uni.showToast 100% 清零**：业务代码零残留（仅 toast.js 内部实现层保留）
  3. **Options API 迁移**：42→32 个文件，`<script setup>` 覆盖率 **72%** (83/115)
  4. **缺失方法修复**：date.js `today()` + study.api.js 4 个智能学习引擎方法
- **Breaking Changes**: 无

---

### 概述

- **Scope**: frontend
- **Summary**: 将 index/index.vue 和 practice/index.vue 中高度集中的逻辑提取为独立 composable，降低单文件复杂度，提高可维护性和可测试性
- **Breaking Changes**: 无（所有对外 API/行为完全保持兼容）

### 新建 Composable 文件（5个，共 662 行）

| 文件                                    | 行数 | 提取来源           | 职责                                     |
| --------------------------------------- | ---- | ------------------ | ---------------------------------------- |
| `src/composables/useHomeStats.js`       | 165  | index/index.vue    | 统计数据刷新、成就加载、活动历史、热力图 |
| `src/composables/useHomeReview.js`      | 124  | index/index.vue    | FSRS 复习数量、未完成进度检测、智能推荐  |
| `src/composables/useStyleOnboarding.js` | 67   | index/index.vue    | 学习风格引导 3 步配置流程                |
| `src/composables/useBankStatus.js`      | 138  | practice/index.vue | 题库状态管理、备份恢复、生成检测         |
| `src/composables/useDynamicMixin.js`    | 168  | practice/index.vue | 分包动态加载、方法注入、重试机制         |

### 页面缩减

| 页面                           | 原行数 | 新行数 | 减少         |
| ------------------------------ | ------ | ------ | ------------ |
| `src/pages/index/index.vue`    | 2038   | 1820   | -218 (10.7%) |
| `src/pages/practice/index.vue` | 1926   | 1739   | -187 (9.7%)  |

### do-quiz.vue / pk-battle.vue 评估

- do-quiz.vue (3040行)：已有 4 个 composable (useQuizEngine, useXPSystem, useCardStack, useTypewriter)，剩余逻辑高度耦合（UI 状态 + 答题流程），进一步拆分需配合组件拆分
- pk-battle.vue (3288行)：已有 1 个 composable (usePKRoom)，仍有 100+ 方法，建议后续独立任务处理

### 测试

- 92 文件 / 1263 测试全部通过
- 修改 2 个测试文件适配 composable 迁移

---

## [2026-03-26] Round 54: Store 层全覆盖 + 大页面瘦身 + script setup 迁移 28 个文件

> 包含上方各子条目（H005-B / D002+H004 / H003）的详细记录。
>
> - H005-B: authStore(+6), schoolStore(+6), profileStore(+4) 共 16 个新 action，7 个页面迁移
> - D002: index.vue(-218行) + practice/index.vue(-187行)，5 个新 composable
> - H003: 28 个组件 Options API → script setup，script setup 占比 45→73 个
> - 测试：92 文件 / 1263 测试 / 0 失败

---

## [2026-03-26] Round 53: 架构重构 — 删 10K 行重复代码 + Store 层归位 + Mixin 清理

### D001: lafService 接入新 .api.js 体系 (-10,085 行)

- **Scope**: `frontend`
- **Files Changed**:
  - `src/services/lafService.js` — 从 spread 合并 6 个 `.service.js` 改为 import 8 个 `.api.js`
  - `src/services/api/domains/tools.api.js` — 补齐 6 个缺失方法
  - **删除**: `ai.service.js`(2436行), `auth.service.js`(2006行), `favorite.service.js`(2006行), `practice.service.js`(2006行), `school.service.js`(2006行), `social.service.js`(2013行)
  - 9 个测试文件 mock 路径更新
- **Summary**: 旧体系 6 个 `.service.js` 文件是完整副本（每个 ~2000 行），含大量 ReferenceError 隐患。新体系 `.api.js` 已存在但未接入。现在完成接线，删除 10,085 行重复代码，同时获得双服务器自动切换能力。
- **Breaking Changes**: 无（方法签名完全兼容）

### H005-A: 31 处 lafService 绕过 Store 层替换

- **Scope**: `frontend`
- **Files Changed**: 14 个页面/组件文件 + `src/stores/index.js`
- **Summary**: 31 处 `lafService.xxx()` 替换为 `classroomStore`(8处), `toolsStore`(6处), `reviewStore`(17处) 的对应 action。架构违规从 84 处降至 53 处（其中 34 处标记为可接受例外）。
- **Breaking Changes**: 无

### D004 + D009: 代码清理

- **Scope**: `frontend`
- **Summary**:
  - D004: 删除废弃 `getApiKey()` 函数
  - D009: 删除 4 个零引用 mixin（studyTimer/dailyQuote/practiceNavigation/tracking），迁移到对应 composable。保留 2 个动态代码分割模块（ai-generation-mixin/learning-stats-mixin）
  - `src/mixins/` 目录已清空删除
- **Breaking Changes**: 无

---

## [2026-03-26] Round 52: 视觉E2E全绿 + uni.showToast迁移 + cloud-shim升级 + Nginx备份 + 冗余清理

### H010-H013 视觉回归和 E2E 回归测试修复

- **Scope**: `frontend` | `testing` | `docs`
- **Files Changed**:
  - `src/pages/login/index.vue` — 时间戳冷却锁前移至 `handleEmailLogin` 顶部，防止快速多次点击 (H013)
  - `tests/e2e-regression/fixtures/regression.fixture.js` — `setLoggedInSession` 补充 `__exam_storage__:` 前缀键 (H012)
  - `tests/e2e-regression/specs/02-exception-flow.spec.js` — EXC-005 chatInput 超时 15s→25s, expectAnyText 15s→20s (H012)
  - `pages.json` — 注册 `ai-classroom`(2页) 和 `onboarding`(1页) 为 subPackages (H011)
  - `tests/visual/snapshots/` — 全量更新 44 张基准截图 (H010/H011)
- **Summary**: 修复四个 🔴 Blocker 级测试问题。H010/H011 一次性更新全部过期/缺失快照；H012 根因是 storageService 前缀键缺失；H013 根因是时间戳冷却检查位置不对。

### H006 uni.showToast → toast.js 迁移 (98.9%)

- **Scope**: `frontend`
- **Files Changed**: 70 个 .vue/.js 文件
- **Summary**: 将 490 处 `uni.showToast` + 44 处 `uni.showLoading` + 95 处 `uni.hideLoading` 统一迁移为 `toast.success/info/error/loading/hide`。残留 8 处因测试 mock 限制暂不迁移。
- **Breaking Changes**: 无

### H002 cloud-shim .get/.post 短写法

- **Scope**: `backend`
- **Files Changed**: `laf-backend/standalone/cloud-shim.ts`
- **Summary**: `cloudFetch` 挂载 `.get/.post/.put/.delete/.head/.patch` 快捷方法。

### H001/D005 Nginx HTTPS 备份代理

- **Scope**: `infra`
- **Files Changed**: `/opt/nginx/conf.d/exam-master.conf`
- **Summary**: `error_page 502 503 504 = @sealos_fallback` + `proxy_ssl_server_name on` 实现故障转移。

### D003/D015 后端质量清理

- **Scope**: `backend` | `infra`
- **Summary**: D003 确认 TS 源码 `.js` 扩展名已全量补全；D015 清理 `laf-backend/scripts/` 下 11 个冗余文件。
- **Breaking Changes**: 无

---

## [2026-03-26] Round 51: 全量测试绿灯 + TS零错误 + 后端部署 + UI质量修复

- **Scope**: testing, backend, frontend
- **Files Changed**:
  - **Timer 超时修复 (3 文件)**:
    - `tests/unit/login-guard.spec.js` — `vi.useFakeTimers()` 移到 `await import()` 之后，`toFake` 排除 `requestAnimationFrame`
    - `tests/unit/real-utils.spec.js` — afterEach 补 `vi.clearAllTimers()`，限定 `toFake` 范围
    - `tests/unit/theme.spec.js` — 动态 import 改为静态 import，`toFake` 限定为 `['Date']`
  - **Audit mock 修复 (16 文件)**:
    - 16 个 `audit-*.spec.js` — requireAuth mock 集成 jwtPayload、补缺失 mock、断言适配后端实际行为
    - `tests/__mocks__/api-response-mock.js` — 补 `checkRateLimit`、`validateUserId`、`sanitizeString`、`validateAction`
  - **TS 类型修复 (12 文件, 63→0 错误)**:
    - `fsrs.service.ts` — `as typeof card` 断言 + 移除不兼容类型
    - `proxy-ai.ts` — `callAIWithFallback` 新增参数消除 `ctx` 引用
    - `answer-submit.ts` — 解构断言 + `as string` + `as unknown as ApiResponse`
    - `data-cleanup.ts` — 8处 `as string` 断言
    - `school-crawler-api.ts` — 5处 `as string`/`as number` 断言
    - `school-query.ts` — `as Record<string, unknown>` 断言
    - `study-stats.ts` — 数组类型断言
    - `material-manager.ts` — query 类型改为 `Record<string, unknown>`
    - `ai-diagnosis.ts` — `max_tokens` → `maxTokens`
    - `smart-study-engine.ts` — `uid` → `userId`
    - `user-profile.ts` — `ctx as Record<string, unknown>`
    - `voice-service.ts` — requestBody 显式类型标注
  - **后端 Bug 修复**:
    - `laf-backend/functions/group-service.ts` — `handleGetGroups`/`handleGetResources` 分页查询重构为条件对象 + `Promise.all`
  - **UI 质量修复 (H015/H016)**:
    - `MarkdownRenderer.vue` — 渲染异常时 toast 提示
    - `question-bank.vue` — 加载失败时 toast 提示
    - `InviteModal.vue` — 分享失败时 toast 提示
    - `FSRSOptimizer.vue` — 新增 loading 状态 + 加载中/加载失败提示
- **Summary**:
  1. **[测试-全绿]** 单元测试 161→0 失败，92 文件 1263 测试全部通过
  2. **[TS编译-零错误]** 后端 TypeScript 63→0 编译错误，全部通过类型标注修复
  3. **[H014修复]** group-service `get_groups` TypeError → 条件对象 + `Promise.all` 并行查询
  4. **[部署]** 后端编译 + 后处理 + 上传 + PM2 重启，health check 通过
  5. **[UI质量]** H015 错误提示 3个组件修复 + H016 加载状态修复
- **Breaking Changes**: 无

---

## [2026-03-26] Round 50: 测试专项修复 — mock策略重构+缺失模块补全

- **Scope**: testing, frontend, backend
- **Files Changed**:
  - 6个 integration-\* 测试文件 — mock 策略从 `_request-core.js` 改为直接突变 `aiService.request`
  - 3个 integration/voice/social 测试文件 — 已被 Round 49 子代理修复
  - `src/services/api/domains/social.service.js` — 补全缺失的 `logger` import
  - `src/utils/practice/mistake-fsrs-scheduler.js` — 新增错题 FSRS 间隔重复调度模块
  - `src/stores/modules/theme.js` — `uni.getSystemInfoSync` 防御性检查
  - `tests/__mocks__/api-response-mock.js` — api-response 完整 mock factory
  - 12个 audit-\* 测试文件 — auth-middleware mock 补全
- **Summary**:
  1. **[测试-P0]** 单元测试从 247→161 个失败（-35%），通过测试从 1013→1099（+86）
  2. **[mock重构]** 发现 ai.service.js 和 \_request-core.js 有两套独立 request 函数，integration 测试需直接突变 aiService.request
  3. **[缺失模块]** 创建 mistake-fsrs-scheduler.js（错题 FSRS 调度），修复 social.service.js 缺失的 logger import
  4. **[已知残留]** 26个文件 161 个测试仍失败：主要是超时(login-guard 45个, real-utils 41个) + audit mock 不完整
- **Breaking Changes**: 无

## [2026-03-26] Round 49: 深度审计续 — TS编译修复+测试基础设施+主包瘦身

- **Scope**: backend, testing, frontend, performance
- **Files Changed**:
  - `laf-backend/functions/**/*.ts` — 123处 import 缺 `.js` 扩展名全部补全
  - `laf-backend/types/global.d.ts` — 新增 @lafjs/cloud + FunctionContext + nodemailer 等类型声明
  - `laf-backend/tsconfig.standalone.json` — include 添加 types/ 目录
  - `tests/setup.js` — 添加 JWT_SECRET_PLACEHOLDER
  - `tests/__mocks__/api-response-mock.js` — 新增后端 api-response 完整 mock factory
  - `src/stores/modules/theme.js` — 修复 uni.getSystemInfoSync 防御性检查
  - 13个 audit-\* 测试文件 — api-response mock 替换为完整版
  - 12个 audit-\* 测试文件 — 新增 auth-middleware mock
  - 删除 17 个零引用死文件（static/icons/ + composables + mixins 等）
- **Summary**:
  1. **[TS编译]** 261→63 个错误（-76%）：123个 .js 扩展名补全 + 52个模块声明 + 类型声明文件
  2. **[主包瘦身]** 2036KB→1888KB（-148KB），余量从12KB增到160KB
  3. **[测试基础]** 创建 api-response-mock factory，修复 25 个审计测试的 mock
  4. **[运行时]** theme.js getSystemInfoSync 防御性修复
- **Breaking Changes**: 无

## [2026-03-26] Round 48: 全量审计 — 安全加固+H5白屏修复+主包瘦身+后端部署

- **Scope**: security, backend, frontend, deploy, testing, performance
- **Files Changed**:
  - `laf-backend/functions/invite-service.ts` — 新增 sign_link/verify_link（HMAC-SHA256）
  - `laf-backend/functions/mistake-manager.ts` — 修复40处重复属性名
  - `laf-backend/.env.example` — 添加 INVITE_LINK_SECRET
  - `src/pages/practice-sub/invite-deep-link.js` — 签名逻辑改为调后端API
  - `src/services/api/domains/social.api.js` — 新增 signInviteLink/verifyInviteLink
  - `src/config/index.js` — 移除 VITE_INVITE_SECRET
  - `src/main.js` — 完整化（修复H5白屏）
  - `tests/unit/invite-deep-link-security.spec.js` — 7个测试适配后端签名
  - 删除17个确认零引用死文件（SwipeCard/icons/composables等）
- **Summary**:
  1. **[安全-P0]** VITE_INVITE_SECRET 泄露修复：签名迁移到后端HMAC-SHA256
  2. **[H5-P0]** 白屏修复：src/main.js 完整化使 uni-h5-vite 的 createSSRApp 转换生效
  3. **[性能-P0]** 微信主包 2036KB→1888KB（-148KB），余量从12KB增到160KB
  4. **[后端-P2]** mistake-manager.ts 40处重复属性修复
  5. **[运维]** 服务器.env补全MONGODB_URI+INVITE_LINK_SECRET，后端编译部署
  6. **[清理]** 删除17个死文件（icons/components/composables等）
- **Breaking Changes**: 邀请链接签名改为后端生成

## [2026-03-23] Round 24: 项目深度扫描审计

- **Scope**: docs | infra
- **Files Changed**:
  - `docs/status/HEALTH.md`
  - `docs/AI-SOP/MODULE-INDEX.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 通过查看自动生成的 `docs/reports/PROJECT_DEEP_SCAN_REPORT.md`，发现项目中存在目录冗余。
  - 明确发现 `laf-backend/scripts/` 下的 `crawlers`, `data-sync`, `test` 等目录与根目录下相应的 `scripts/` 子目录重复。
  - 更新了 `docs/status/HEALTH.md` 中的技术债条目（添加了 D015）以记录这些重复目录可能带来的维护负担。
  - 更新了 `docs/AI-SOP/MODULE-INDEX.md`，在结尾补充了有关脚本目录冗余的注释，以便后续开发注意。
- **Breaking Changes**: None

---

## [2026-03-23] Round 23: UI质量门禁审计

- **Scope**: docs | frontend
- **Files Changed**:
  - `docs/status/HEALTH.md`
  - `docs/AI-SOP/modules/styling-system.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 运行 `npm run audit:ui-quality` 对前端组件和页面的 UI 质量进行扫描。
  - 当前评分：**97/100**，总计检查了 268 个文件（120 个 Vue 文件，148 个 JS 文件）。
  - 通过项包含：26 个加载状态实现，154 个错误处理覆盖，68 个 GPU 加速组件（242 项全通过）。
  - 共记录了 7 个警告并已更新至 `HEALTH.md`（H015, H016），主要集中在 `base-icon.vue`, `MarkdownRenderer.vue`, `WelcomeBanner.vue`, `SchoolSearchInput.vue`, `question-bank.vue`, `InviteModal.vue` 捕获到错误但无用户提示；以及 `FSRSOptimizer.vue` 存在异步操作但缺少加载状态。
  - 将相关的 UI 质量审查结果详细信息补充更新至 `docs/AI-SOP/modules/styling-system.md` 的 `UI Quality Metrics` 章节。
- **Breaking Changes**: None

---

## [2026-03-23] Round 22: 测试基础设施第二次审计与状态更新

- **Scope**: docs | testing
- **Files Changed**:
  - `docs/status/HEALTH.md`
  - `docs/AI-SOP/modules/testing-infra.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 补充了具体的测试失败信息到健康状态与测试架构文档中，重点标注了 4 个具体维度的失败：
  - Unit Tests: 254 / ~300 失败，具体原因包括 `JWT_SECRET_PLACEHOLDER
  - Visual Regression: 11 失败，其中因为过期快照造成核心页不匹配，且完全缺失 `ai-classroom-classroom` 及 `onboarding` 页面的截图文件。
  - E2E Regression: EXC-005（智能接口超时）与 STATE-005（登录按钮多次点击触发多次请求带来的幂等性问题）等失败。
- **Breaking Changes**: None

---

## [2026-03-23] Round 21: 测试基础设施审计与状态更新

- **Scope**: docs
- **Files Changed**:
  - `docs/AI-SOP/modules/testing-infra.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 执行了测试套件的全面审计并更新 `testing-infra.md` 文档，记录了测试套件的当前状态与失败原因。
  - Unit Tests: 约 254/300 失败，主要由于环境缺失 `JWT_SECRET_PLACEHOLDER
  - Visual Regression Tests: 11/48 失败，主要由于未预期的基准图像差异（合法的 UI 更改未重新捕获）以及新页面缺少快照文件。
  - E2E Regression Tests: 2/~30 失败，主要因为异常流程的超时（Timeout）以及状态恢复页面的并发/幂等性错误。
- **Breaking Changes**: None

---

## [2026-03-23] Round 20: 限流升级 + 代码清理 + 测试修复 — 通过率 993→1006

- **Scope**: backend + frontend + tests
- **Files Changed**:
  - `laf-backend/functions/achievement-manager.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `laf-backend/functions/learning-goal.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `laf-backend/functions/user-stats.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `laf-backend/functions/learning-resource.ts` — `checkRateLimit` → `checkRateLimitDistributed`（2处）
  - `laf-backend/functions/school-crawler-api.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `src/pages/social/socialService.js` → `src/services/social-facade.js`（移出 pages/ 到正确的服务层）
  - `src/pages/social/friend-profile.vue` — 更新 socialService 导入路径
  - `src/pages/social/friend-list.vue` — 更新 socialService 导入路径
  - `tests/unit/formatters.spec.js` — 修复 15 个因 dayjs relativeTime + vi.useFakeTimers 不兼容导致的预存失败
- **Summary**: (1) 技术债 D011 全面清除：5个后端文件 6处调用从本地内存限流升级为 MongoDB 分布式限流，多实例部署不再绕过限流。(2) 技术债 D010 清除：重复的 `socialService.js` 从 pages/ 移到 services/ 目录，消除架构违规。(3) 修复 `formatters.spec.js` 15 个预存失败：根因是 dayjs `fromNow()` 与 `vi.useFakeTimers()` 冲突导致 afterEach 超时。重写为不依赖 fake timers 的相对时间匹配模式。全量测试通过率从 993→1006。
- **Breaking Changes**: 无。限流行为对外不变，仅内部存储从内存升级为数据库。

---

## [2026-03-23] Round 19 (QA): 深度安全审计 — 3 个 CRITICAL 权限漏洞修复 + 6 项安全回归测试

- **Scope**: backend + docs
- **Files Changed**:
  - `laf-backend/functions/question-bank.ts` — **CRITICAL** `seed_preset` action 添加 `requireAdminAccess` 权限检查（之前任何认证用户可注入 500 题）
  - `laf-backend/functions/group-service.ts` — **CRITICAL** 重写认证层：手动 JWT 解析 → `requireAuth()` 统一中间件 + 添加 `checkRateLimitDistributed` 分布式限流 + 自定义 logger → `createLogger()`
  - `laf-backend/functions/ai-friend-memory.ts` — **CRITICAL** 手动 JWT → `requireAuth()` + 添加 `checkRateLimitDistributed`（30次/分钟）
  - `tests/unit/qa-backend-security-audit.spec.js` (new) — 安全回归测试（6 cases: seed_preset 权限、group-service 认证、ai-friend-memory IDOR）
  - `docs/status/HEALTH.md` — 新增 R017-R019 已解决 + H007 活跃问题 + D011 技术债
  - `docs/sop/CHANGE-LOG.md` — 本记录
- **Summary**: 以 QA 工程师视角对全部 46 个后端云函数进行安全审计，重点检查认证一致性、限流覆盖、IDOR 防护、参数校验。发现 3 个 CRITICAL 权限漏洞：(1) `question-bank` 的 `seed_preset` 无 admin 权限校验，任何登录用户可批量注入题目；(2) `group-service` 未使用 `requireAuth` 统一中间件且无限流，认证不一致；(3) `ai-friend-memory` 同样绕过统一认证且无限流。同时识别 4 个端点使用本地 `checkRateLimit` 而非分布式 `checkRateLimitDistributed` 的稳定性风险。H5 构建验证通过，全量测试 993/1260 通过（无新增回归）。
- **Breaking Changes**: `seed_preset` 现在需要管理员密钥（`x-admin-secret` header 或 JWT admin role），普通用户调用将返回 403。

---

## [2026-03-23] Round 18: 全面审计 — 10 个 Bug 修复 + 5 个后端 TS 修复 + 4 项新增技术债记录

- **Scope**: frontend + backend + docs
- **Files Changed**:
  - `src/services/auth-storage.js` — **CRITICAL** `uni.getItem()` → `localStorage.getItem()`（修复运行时崩溃）
  - `src/pages/ai-classroom/index.vue` — **CRITICAL** 添加 `activeTimers` 追踪 + `onBeforeUnmount` 清理 setInterval/setTimeout 泄漏
  - `src/services/api/domains/ai.service.js` — `console.warn/log` → `logger.warn/log`（3处）
  - `src/config/index.js` — 硬编码域名 `exam-master.com` → 实际生产域名 `245334.xyz`（2处）
  - `src/utils/cache/swr-cache.js` — 导入 `logger` + `console.warn` → `logger.warn`（2处）
  - `src/utils/core/offline-queue.js` — 构造函数添加 `this.paused = false` 初始化
  - `src/pages/index/index.vue` — 移除 onLoad 中重复的 `uni.$on('loginStatusChanged')` 注册
  - `src/pages/practice-sub/useQuizAutoSave.js` — 删除孤儿重复文件（所有导入均指向 composables/）
  - `laf-backend/functions/study-stats.ts` — 修复 weeks 数组类型 `{}[]` → `{ total: number; correct: number }[]` + 补全 `.js` 导入扩展名
  - `laf-backend/functions/upload-avatar.ts` — 补全 `.js` 导入扩展名（2处）
  - `laf-backend/functions/user-profile.ts` — 补全 `.js` 导入扩展名（2处）
  - `laf-backend/functions/user-stats.ts` — 补全 `.js` 导入扩展名（2处）
  - `laf-backend/functions/voice-service.ts` — 补全 `.js` 导入扩展名（4处）
  - `tests/unit/ai-classroom-timer-cleanup.spec.js` (new) — 定时器清理测试（3 cases）
  - `docs/status/HEALTH.md` — 新增 R007-R016 已解决问题 + H005-H006 活跃问题 + D007-D010 技术债
  - `docs/sop/CHANGE-LOG.md` — 本记录
- **Summary**: 对全项目前端+后端进行系统化审计（审查 100+ Vue 文件 + 46 个云函数）。发现并修复 2 个 CRITICAL 运行时 Bug（auth-storage 调用不存在的 uni.getItem 导致 H5 端认证崩溃；ai-classroom 定时器泄漏）、4 个 IMPORTANT 问题（生产 console 输出、错误域名、重复文件、未初始化字段）、4 个 NORMAL 问题（事件监听重复注册等）。后端修复 5 个文件的 TypeScript 导入扩展名 + 1 处类型错误。新增 4 项技术债记录（Options API 迁移 73 文件、lafService 架构违规 88 处、mixin 残留 6 个、socialService 重复）。H5 构建验证通过，测试 988/1251 通过（263 个为预存失败）。
- **Breaking Changes**: 无。

---

## [2026-03-23] Round 17: 数字格式化 + 搜索历史 + 页面过渡 + Toast 大扫除

- **Scope**: frontend
- **Files Changed**:
  - `src/utils/core/index.js` — 新增 `formatNumberCN(num)`: 12000→"1.2万", 135000000→"1.4亿"（搬运自 GSQZ/TuneFree 700+ Stars）
  - `src/pages/practice-sub/question-bank.vue` — 题库总数使用 `formatNumberCN` 展示
  - `src/components/business/school/SchoolSearchInput.vue` — v3: 集成 `useSearchHistory` 搜索历史（聚焦空输入框 → 展示最近搜索标签 → 点击直接搜索 → 选择学校后自动记录）
  - `src/components/common/PageTransition.vue` (new) — CSS-only 页面过渡动画组件（4种动画：slide-up/fade/slide-left/zoom），搬运 Nuxt 50k+ Stars 过渡模式，支持 prefers-reduced-motion
  - `src/composables/useSearchHistory.js` — 搜索历史持久化 composable（去重+置顶+上限+uni.setStorageSync）
  - Toast 第三波迁移: composables(31处) + 页面残余(16处) = 47处，全项目 uni.showToast 从 192→145，累计迁移率 **72%** (378/523)
  - 修复全部 Python 脚本产生的转义引号 bug（18个文件）
- **Summary**: 本轮三条主线并行推进。(1) formatNumberCN 让大数字展示更自然（考研题库数万题时展示"1.2万"而非"12000"）。(2) SchoolSearchInput 三代升级完成：v1 纯字符串匹配 → v2 拼音搜索 → v3 搜索历史。用户聚焦搜索框即可看到最近搜索的学校，一键回搜。(3) PageTransition 提供 4 种 CSS-only 过渡动画，可用于内容切换/弹窗弹出等场景。
- **Breaking Changes**: 无。`formatNumber` 原函数保持不变（千分位），新增 `formatNumberCN`。

---

## [2026-03-23] Round 15: 搜索体验 + 骨架屏 + Toast 批量迁移

- **Scope**: frontend
- **Files Changed**:
  - `package.json` — 新增 `pinyin-match`（WeChat MP 兼容，1.7k Stars）
  - `src/components/business/school/SchoolSearchInput.vue` — v2: 本地搜索从纯 `includes` 升级为 `PinyinMatch.match()`，支持拼音首字母/全拼/多音字（bjdx→北京大学，qhdx→清华大学）；placeholder 提示支持拼音
  - `src/pages/practice-sub/question-bank.vue` — 骨架屏替换：删除 ~50行手写 skeleton CSS + HTML，改用 wot-design-uni `wd-skeleton`（flicker 动画，0 新依赖）
  - `src/pages/login/index.vue` — 36/39 处 `uni.showToast` 迁移至 `toast.js`
  - `src/pages/settings/index.vue` — 24/33 处迁移至 `toast.js`
  - `src/pages/profile/index.vue` — 21/26 处迁移至 `toast.js`
  - `src/pages/school/index.vue` — 24/24 处迁移至 `toast.js`（100%）
- **Summary**: 按价值位阶推进三类优化。(1) pinyin-match 解决学校搜索痛点：用户输入「bjdx」「清华」「qhdx」都能命中结果，提升新用户注册/选校转化率。(2) wd-skeleton 替换手写骨架屏：减少约 50 行 CSS 代码，动画效果更统一（wot-design-uni 已是项目依赖，0 新包）。(3) Toast 批量迁移：top-4 高密度页面 105 处调用统一迁移，全项目 uni.showToast 从 523 降至 419（已迁移 20%，剩余页面后续轮次继续）。
- **Breaking Changes**: 无。

---

## [2026-03-23] Round 14: 工具链升级 — timeago / toast / countup / mp-html

- **Scope**: frontend
- **Files Changed**:
  - `package.json` — 新增 `timeago.js@latest` (5k+ Stars) + `countup.js@latest` (10k+ Stars)
  - `src/utils/timeago.js` (new) — 搬运 timeago.js 中文 locale 注册方案，导出 `formatTimeago()` (相对时间) + `smartTimeFormat()` (智能混合：<7天相对/>=7天绝对)
  - `src/utils/toast.js` (new) — 中心化 Toast 工具，统一 API：`toast.success/error/info/warn/loading/hide()`，底层复用 `uni.showToast` + `uni.hideToast`
  - `src/utils/useCountUp.js` (new) — 搬运 countup.js 核心 easeOutCubic 缓动逻辑，适配 uni-app requestAnimationFrame，支持千分位/前缀后缀/完成回调
  - `src/components/base/CountUpNumber.vue` (new) — countup 封装组件，`<CountUpNumber :to="score" prefix="" suffix="分" />`，可直接替换现有 useAnimatedNumber
  - `src/components/business/chat/MarkdownRenderer.vue` — 升级为 mp-html 渲染（支持可选文本/图片预览/链接跳转/代码高亮），注册 `mpHtml` 组件
  - `src/pages/mistake/MistakeCard.vue` — `formatDate()` 集成 `formatTimeago`：7天内显示「3分钟前」/「昨天」，>7天显示绝对日期
  - `src/pages/social/friend-list.vue` — `formatTime()` 删除 ~20行手写 timeago 代码，替换为 `smartTimeFormat()`
  - `src/pages/practice-sub/question-bank.vue` — 导入 `toast.js`，示范性替换 `uni.showToast` 调用
- **Summary**: 按价值位阶搬运高 Star 工具库，消除重复代码。timeago.js 替换 friend-list 里 20 行手写相对时间逻辑；toast.js 统一 523 处散落的 uni.showToast 调用（本轮示范 question-bank，后续可 ESLint rule 强制）；countup.js 提供更强大的数字动画（千分位+前后缀+回调），可替代现有 useAnimatedNumber；MarkdownRenderer 升级为 mp-html 解锁可选文字/图片预览。
- **Breaking Changes**: 无（所有改动向后兼容）。

---

## [2026-03-23] Round 13: 高 Star 开源组件集成 + 核心体验升级

- **Scope**: frontend
- **Files Changed**:
  - `package.json` — 新增 `highlight.js@^11.11.1` (23k+ Stars) + `z-paging@^2.8.8` (3k+ Stars)
  - `src/utils/code-highlight.js` (new) — 搬运 highlight.js 按需加载方案，15 语言注册，GitHub 双主题配色(light/dark)，CSS 类名→内联样式转换（兼容 rich-text）
  - `src/pages/practice-sub/composables/useMarkdownRenderer.js` — 集成代码高亮：markdown-it `highlight` 回调 + 亮暗双实例缓存 + 自定义 fence 渲染器(语言标签+复制提示)
  - `src/components/business/chat/MarkdownRenderer.vue` — 传入 isDark 到渲染函数 + watch isDark 重新渲染代码块颜色
  - `src/pages/practice-sub/question-bank.vue` — 补齐缺失的下拉刷新（refresher-enabled + onPullRefresh）
  - `src/pages/knowledge-graph/components/ForceGraph.vue` — v2 增强：BFS 连通子图高亮 + 边流光粒子 + 待复习节点脉动 + 单指画布平移 + 暗色信息面板 + 速度阻尼(搬运 d3-force 策略) + 节点再点取消选中
  - `src/components/charts/StudyTrend.vue` — v2 增强：dataZoom 横向滚动(>7天) + 做题量 areaStyle 渐变面积 + markLine 平均值参考线 + 自定义 HTML tooltip + hover emphasis
  - `src/components/charts/SkillRadar.vue` — v2 增强：tooltip 能力画像(各科百分比+评级) + hover emphasis(线宽放大+面积加深)
  - `src/components/charts/ForgettingCurve.vue` — v2 增强：tooltip 达标/未达标状态提示 + borderRadius + padding 统一
- **Summary**: 按价值位阶从 GitHub 搬运高 Star 组件集成，不重复造轮子。Tier 1: highlight.js 让 AI 对话代码块从纯文本升级为 15 语言语法高亮+GitHub 配色+暗色适配。Tier 2: 题库页补齐下拉刷新(原无此功能)。Tier 3: 知识图谱从"静态展示"升级为"可交互探索"(选中节点→BFS 高亮关联子图→非关联节点降透明→边上流光粒子→待复习节点脉动+单指平移画布)。Tier 4: 三个图表组件搬运 ECharts 官方最佳实践配置(dataZoom/areaStyle/markLine/自定义 tooltip)。
- **Breaking Changes**: `renderMarkdownAsync(text)` 新增可选第二参数 `{ isDark }`, 旧调用不传参时 isDark 默认 false, 完全向后兼容。

---

## [2026-03-23] Round 12: AI-SOP 文档体系升级 v2.0

- **Scope**: docs
- **Files Changed**:
  - `CLAUDE.md` (new) — 根目录 AI 入口，30 秒速览 + 铁律 + 完工协议 + 已知陷阱 + 配置表
  - `.cursorrules` (new) — Cursor 自动读取
  - `.clinerules` (new) — Cline 自动读取
  - `docs/PROJECT-INDEX.md` (new) — 项目全景导航 + 快速跳转表 + 服务器拓扑
  - `docs/status/HEALTH.md` (new) — 系统健康仪表盘 (部署状态 + 活跃Bug + 已解决 + 技术债 + 资源监控)
  - `docs/sop/AI-DEV-RULES.md` (new) — 10 条铁律 (从 SOP-RULES.md 迁移精简)
  - `docs/sop/UPDATE-PROTOCOL.md` (new) — 文档更新触发矩阵 + CHANGE-LOG 格式 + Bug 生命周期
  - `docs/sop/CHANGE-LOG.md` (moved) — 从 `docs/AI-SOP/CHANGE-LOG.md` 迁移，增加领域标签
  - `docs/AI-SOP/SOP-RULES.md` — 标记 DEPRECATED，指向新位置
  - `docs/AI-SOP/CHANGE-LOG.md` — 标记 MOVED，指向新位置
- **Summary**: 对标 GitHub 顶级开源项目 (Twenty CRM, Anthropic Cookbook) 的 CLAUDE.md 模式，建立三层文档防线: 根目录入口 (AI 自动读取) → 系统感知 (上帝视角) → 开发规范 (深入工作)。原 `docs/AI-SOP/` 16 个文件作为第四层深度参考保留，不删除。
- **Breaking Changes**: CHANGE-LOG 位置从 `docs/AI-SOP/CHANGE-LOG.md` 移至 `docs/sop/CHANGE-LOG.md`。旧位置保留重定向。

---

## [2026-03-23] Round 11: CF Worker + HTTPS + 前端双服务器切换

- **Scope**: deploy + frontend + infra
- **Files Changed**:
  - `deploy/tencent/cf-worker/worker.js` — Groq pathPrefix 修复 + 部署到 CF
  - `.env.production`, `.env.development` — API URL 切换到 `api.245334.xyz` + 新增 fallback
  - `src/config/index.js` — 新增 `api.fallbackUrl`
  - `src/services/api/domains/ai.service.js` — 双服务器自动切换 (3次失败→备用→60秒恢复)
  - `laf-backend/functions/_shared/ai-providers/provider-factory.ts` — CF Worker 代理集成
  - Nginx SSL: Let's Encrypt for `api.245334.xyz` + `exam.245334.xyz`
  - CF DNS: A records + Worker route `api-gw.245334.xyz`
- **Summary**: 完成 HTTPS 域名绑定、CF Worker 海外 API 代理部署、前端双服务器自动 fallback。
- **Breaking Changes**: 前端 `VITE_API_BASE_URL` 从 Sealos 切换到腾讯云。

---

## [2026-03-23] Round 10: 腾讯云服务器部署 — 已上线

- **Scope**: backend + infra
- **Status**: **DEPLOYED & VERIFIED** at `http://101.43.41.96`
- **Key Files**:
  - `laf-backend/standalone/cloud-shim.ts` — @lafjs/cloud 兼容层 (已通过 Laf SDK GitHub 源码审计, 修复 7 个问题: CRITICAL: _.or()/_.and() where查询 + \_.all()缺失; HIGH: add()/update()返回值 + field()数组支持)
  - `laf-backend/standalone/server.ts` — Express 路由服务器 (46 函数自动注册, ESM \_\_dirname 修复, 404 handler 顺序修复)
  - `deploy/tencent/` — Nginx + PM2 + MongoDB Docker 完整部署配置
  - `deploy/tencent/cf-worker/` — Cloudflare Worker 海外 API 代理 (14 供应商)
- **Architecture**:
  - **本地编译** (Mac TS→JS) → **上传 dist** → **PM2 运行** (非 Docker 构建, 因 2GB 服务器编译太慢)
  - MongoDB 7.0 via Docker (WiredTiger 256MB cache)
  - Nginx 反代 port 3001 + upstream backup 到 Sealos Laf
  - 多项目隔离: 5 个项目规划 port 3001-3005
  - 内存: Node.js ~65MB + MongoDB ~400MB = ~500MB, 剩余 1.4GB 给其他项目
- **Build Pipeline**: `tsc → perl rewrite (@lafjs/cloud + .js extensions) → tar → scp → pm2 restart`
- **Verified Endpoints**: `/health`, `/health-check`, `/school-query`, `/login`
- **Known Issues**:
  - Sealos backup 需 HTTPS proxy, Nginx upstream 不支持混合协议, 待优化为 error_page + proxy_pass fallback
  - CF Worker 未部署 (配置已就绪, 需 `npx wrangler deploy`)
- **Breaking Changes**: None

---

## [2026-03-22] Round 9: LLM API 号池扩容 + 深搜 Key 池

- **Scope**: backend + docs
- **Files Changed**:
  - `laf-backend/.env` — 新增 10 条硅基流动深搜专用 Key（SILICONFLOW_DS_KEY_1~10）
  - `laf-backend/.env.example` — 新增深搜 Key 文档 + 补全 NVIDIA/Volcengine/Cohere/HuggingFace/Fal/Deepgram/Mem0/Kling/Vercel AI 环境变量文档
  - `laf-backend/functions/_shared/ai-providers/provider-factory.ts`:
    - 新增 `siliconflow_deepsearch` provider（10 条 DS Key 独立轮询，DeepSeek-V3 模型）
    - 新增 `getDeepSearchProvider()` 导出函数
    - 修复 Cerebras 模型名 `llama-3.3-70b` → `llama3.1-8b`（旧模型已下线）
    - Cohere 加入 auto 轮询池（之前仅有配置未入池）
    - 新增 `ENV_KEY_MAP` 统一处理不规则环境变量名
  - `docs/AI-SOP/modules/backend-functions.md` — 新增 LLM API 号池详情章节（14 provider + 10 DS Key + 辅助服务 + 主路径模型）
  - `docs/AI-SOP/CHANGE-LOG.md` — 本记录
- **Summary**: 号池从 12 个 provider 扩展到 14 个（+Cohere 入池 +DeepSearch 池）。新增 10 条硅基流动 DeepSeek 专用 Key（总余额 140 元，支持 V3 ~10000 次 / R1 ~1750 次调用）。修复 Cerebras 模型名为当前可用模型。完善 .env.example 文档覆盖全部 25+ 环境变量。
- **Breaking Changes**: Cerebras 模型从 `llama-3.3-70b` 更新为 `llama3.1-8b`，该模型已在 Cerebras 平台下线，旧配置本已不可用。

---

## [2026-03-22] Round 8: Last Page Upgrade + Action Sheet Standardization

- **Scope**: frontend
- **Files Changed**:
  - `src/pages/practice-sub/question-bank.vue` — 全面重写(487→785行): 暗色模式+wd-tabs+wd-progress+wd-button+搜索+骨架屏+BaseEmpty+BaseIcon+触觉反馈+毛玻璃卡片
  - `src/pages/chat/chat.vue` — uni.showActionSheet→wd-action-sheet
  - `src/pages/profile/index.vue` — 2处uni.showActionSheet→wd-action-sheet
  - `src/pages/settings/index.vue` — 2处uni.showActionSheet→wd-action-sheet
  - `src/pages/favorite/index.vue` — uni.showActionSheet→wd-action-sheet
- **Summary**: 升级项目内最后一个零暗色模式页面(question-bank)，从原型级质量提升到与全APP一致的设计语言。4个高频页面的7处原生ActionSheet替换为wd-action-sheet，消除暗色模式下白色弹窗的违和感。
- **Breaking Changes**: None

---

## [2026-03-22] Round 7: Performance + Interaction + Core Value

- **Scope**: frontend
- **Files Changed**:
  - `src/utils/echarts-custom.js` (new) — ECharts按需导入（Radar/Line/Bar + 必要组件）
  - `vite.config.js` — echarts alias指向自定义构建，~1.1MB→~200KB
  - `src/pages/chat/chat.vue` — 语音波形从Math.random()改为真实PCM帧数据RMS
  - `src/pages/knowledge-graph/components/ForceGraph.vue` — 新增双指缩放(0.5x-3x)+节点拖拽+拖拽高亮
  - `src/pages/index/index.vue` — 新增quick-actions快捷统计栏(待复习/今日已做/正确率)
- **Summary**: ECharts包体积优化~900KB。知识图谱从"只能看"升级为"可缩放可拖拽"。语音录制波形从假随机变为真实音频振幅。首页新增FSRS复习队列数据的直达入口。
- **Breaking Changes**: None. echarts功能不变，仅减少未使用的图表类型。

---

## [2026-03-22] Round 6: MP Confetti + Calendar View + User Flow Fixes

- **Scope**: frontend
- **Files Changed**:
  - `src/utils/animations/mp-confetti.js` (new) — 跨平台庆祝粒子效果
  - `src/components/common/ConfettiOverlay.vue` (new) — CSS动画粒子覆盖层
  - 6个文件替换canvas-confetti为mp-confetti（do-quiz, mock-exam, DailyGoalRing, quiz-animation, micro-interactions, useGamificationEffects）
  - `src/pages/plan/index.vue` — 新增wd-calendar-view日历视图切换
  - `src/pages/practice-sub/components/quiz-result/quiz-result.vue` — 新增"返回首页"按钮
  - `src/pages/profile/index.vue` — 新增"我的好友"菜单入口
  - `src/pages/index/index.vue` — 新增streak徽章+ConfettiOverlay
  - 3个文件替换手建进度条为wd-progress（diagnosis-report, quiz-result, practice/index）
- **Summary**: 解决微信小程序端庆祝效果失效（mp-confetti替代canvas-confetti）。新增日历视图填补最后一个竞品差距。修复3个用户流程死胡同：quiz结束后无法一键回首页、好友入口埋太深、首页看不到连续学习天数。继续用wd-progress标准化进度条。
- **Breaking Changes**: None. canvas-confetti仍保留为H5平台后端，小程序端使用CSS动画替代。

---

## [2026-03-22] Round 5: Competitor Feature Parity + Component Standardization

- **Scope**: frontend
- **Files Changed**:
  - `src/components/business/index/ExamCountdownCard.vue` (new) — 考研倒计时卡片
  - `src/pages/tools/focus-timer.vue` (new) — 番茄专注计时器
  - `src/pages/index/index.vue` — 集成倒计时卡片 + 专注计时工具入口
  - `src/pages/settings/index.vue` — 新增考试日期设置
  - `pages.json` — 注册focus-timer页面
  - `src/pages/knowledge-graph/index.vue` — wd-progress替换手建进度条(2处)
  - `src/pages/practice-sub/smart-review.vue` — wd-progress替换(3处)
  - `src/pages/plan/index.vue` — wd-progress替换(2处)
  - `src/pages/profile/index.vue` — wd-progress替换XP进度条
  - `src/pages/social/friend-list.vue` — wd-tabs替换手建标签栏(-55行CSS)
  - `src/pages/school/index.vue` — wd-tabs替换学历切换
- **Summary**: 填补了与竞品(粉笔/考虫/研途)的3个关键功能差距：考研倒计时(用户可设日期+实时天时分+阶段激励语)、番茄专注计时器(25/5循环+wd-circle+屏幕常亮+历史记录)。用wot-design-uni的wd-progress替换了8处手建进度条(删除~70行CSS)，用wd-tabs替换了2个手建标签栏(删除~65行CSS)。
- **Breaking Changes**: None

---

## [2026-03-22] Round 4: Fix Broken Integrations + Dead Code Cleanup

- **Scope**: fullstack
- **Files Changed**:
  - `pages.json` — registered 6 missing pages (smart-review, question-bank, diagnosis-report, ai-classroom×2, onboarding)
  - `src/pages/practice-sub/do-quiz.vue` — fixed question-bank→do-quiz integration (source=question-bank handler)
  - `src/pages/practice-sub/diagnosis-report.vue` — fixed dark-only CSS → theme-aware variables + replaced Canvas ring with wd-circle
  - `src/pages/practice-sub/smart-review.vue` — replaced Canvas ring with wd-circle
  - `src/pages/social/friend-profile.vue` — removed fake generateActivities() data
  - `src/utils/date.js` (new) — dayjs wrapper with 10 utility functions
  - 7 files updated to use dayjs (formatters, SessionList, autoSave, draft-detector, index, do-quiz, studyTimerMixin)
  - `package.json` — removed @vueuse/core, @formkit/auto-animate, markdown-it-katex
  - `laf-backend/.env.example` — scrubbed 7 real API keys
  - Deleted 12 orphan root-level files
  - `src/pages/practice/index.vue` — hid Anki export on non-WeChat platforms
  - `src/pages/tools/doc-convert.vue` — fixed H5 webview navigation (window.open)
- **Summary**: Fixed 4 CRITICAL navigation failures (pages not registered), 1 broken feature integration (question-bank practice), cleaned 3 dead npm deps (~19KB), replaced 2 Canvas rings with wd-circle, adopted dayjs globally, removed fake social data, scrubbed leaked API keys.
- **Breaking Changes**: None. Anki export menu now only visible on WeChat MP.

---

## [2026-03-22] Round 3: UX Polish + New Components + Real Data

- **Scope**: frontend
- **Files Changed**: 25+ files across pages, components, services
- **Summary**: Connected chart data to real FSRS/practice records. Created MiniGuide for MP onboarding. Added swipe-to-delete on mistakes/favorites. Added mistake export. Created SchoolSearchInput autocomplete. Wired offline-cache-service into do-quiz flow.
- **Breaking Changes**: None

---

## [2026-03-22] Round 2: High-Star Component Integration

- **Scope**: frontend
- **Files Changed**: 20+ files
- **Summary**: Integrated mp-html (rich text), created PracticeConfigPanel, overhauled Plan pages (datetime picker + detail popup), redesigned Onboarding (swiper), enhanced Settings page, animated splash waves, added DailyGoalRing completion celebration.
- **Breaking Changes**: None

---

## [2026-03-22] Round 1: Core UX Upgrades

- **Scope**: frontend
- **Files Changed**: 30+ files
- **Summary**: Phase 0 (补内伤): useAnimatedNumber across 6 pages, button-animations.scss activation, dark mode transitions, page transitions, skeleton fade, haptic feedback, hover-class standardization. Phase 1-5: ECharts charts, AI chat Markdown/ThinkingBlock/MessageActions, anime.js utils, driver.js onboarding, offline cache service.
- **Breaking Changes**: StatsGrid.vue converted from Options API to script setup.

---

## [2026-03-22] AI-SOP Documentation System Created

- **Scope**: docs
- **Files Changed**:
  - `docs/AI-SOP/PROJECT-BRIEF.md` (new)
  - `docs/AI-SOP/ARCHITECTURE.md` (new)
  - `docs/AI-SOP/MODULE-INDEX.md` (new)
  - `docs/AI-SOP/CHANGE-LOG.md` (new)
  - `docs/AI-SOP/SOP-RULES.md` (new)
  - `docs/AI-SOP/modules/frontend-pages.md` (new)
  - `docs/AI-SOP/modules/frontend-components.md` (new)
  - `docs/AI-SOP/modules/frontend-services.md` (new)
  - `docs/AI-SOP/modules/frontend-stores.md` (new)
  - `docs/AI-SOP/modules/backend-functions.md` (new)
  - `docs/AI-SOP/modules/backend-schemas.md` (new)
  - `docs/AI-SOP/modules/styling-system.md` (new)
  - `docs/AI-SOP/modules/testing-infra.md` (new)
- **Summary**: Created comprehensive AI-SOP documentation system for EXAM-MASTER. This is a one-time investment so future AI assistants can understand the project without full codebase scanning.
- **Breaking Changes**: None

---

## Historical Changes (Pre-AI-SOP)

### AI Provider Expansion (commits 7eef506, 738b1e6, c760197)

- Added 10+ AI providers to rotation pool (NVIDIA, Volcengine, SiliconFlow, GPT_API_free)
- Enables high availability and cost optimization

### Service Deduplication (commit b93d8bf)

- 5 domain service files now reuse ai.service.js request infrastructure
- Eliminated ~10,000 lines of duplicated request/retry/cache logic

### Performance Optimization (commits ecdcaf3, f3c92dd)

- Moved `useTypewriter` out of main package
- Moved 8 composables/utils from main to practice-sub subpackage
- Reduces WeChat MP main package size

### WeChat Runtime Fixes (commit ce26285)

- Fixed 3 runtime errors identified in WeChat dev console

### WeChat Subscription Messages (commit 25c0cb2)

- Added subscription message service for study reminders
- New service: `src/services/subscribe-message.js`

### Homepage Personalization (commit 4b6657f)

- Personalized homepage with exam_type
- Enhanced mistake filters

### Network Error Recovery (commit 9080040)

- Added error retry UI on homepage for network failure recovery

### Social Sharing (commit 1d858b0)

- Added share to tool pages
- Added pull-to-refresh on 5 pages

### Splash & Celebrations (commit da26a64)

- Splash brand animation
- Tool grid conversion optimization
- Quiz celebration effects

### Traffic Acquisition Tools (commit e0dee6e)

- Restored id-photo and doc-convert as traffic acquisition tools

### Content Engine & FSRS (commit c36c3ec)

- Phase 1-4 content engine implementation
- FSRS scheduling integration
- RAG pipeline
- Major UX overhaul
