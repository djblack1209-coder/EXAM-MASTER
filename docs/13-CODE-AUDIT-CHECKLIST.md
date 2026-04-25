# 源码审计清单 — 死代码标记

> 审计日期：2026-04-25
> 依据：产品战略转型（从"全功能考研小程序"转为"百度网盘驱动的闪卡刷题工具"）
> 操作指引：标记为 ❌ 的文件/目录在确认无活跃引用后可安全删除

## 新产品保留的核心功能

1. 闪卡刷题（多题型）+ FSRS 间隔重复
2. 错题管理
3. 学习进度可视化
4. 用户认证
5. 基础设置

## 一、src/pages/ — 页面

### ❌ 整目录移除

| 目录 | 原功能 |
|------|--------|
| `ai-classroom/` | AI课堂/多Agent对话 |
| `chat/` | AI对话 |
| `school/` | AI择校 |
| `school-sub/` | 择校详情 |
| `social/` | 好友系统 |
| `group/` | 学习小组 |
| `knowledge-graph/` | 知识图谱力导向图 |
| `tools/` | 证件照/文档转换/拍照搜题 |

### ❌ 单文件移除（practice-sub/ 内）

| 文件 | 原功能 |
|------|--------|
| `pk-battle.vue` | PK对战 |
| `rank.vue` | ELO排行 |
| `ranking-socket.js` | 排行WebSocket |
| `diagnosis-report.vue` | AI诊断 |
| `import-data.vue` | Anki导入 |
| `invite-deep-link.js` | 邀请链接 |
| `quiz-ai-analysis.js` | AI课堂分析 |
| `quiz-gamification-bridge.js` | PK游戏化 |
| `self-position-tracker.js` | 排名定位 |

### ❌ 单文件移除（settings/ 内）

| 文件 | 原功能 |
|------|--------|
| `AIChatModal.vue` | AI对话入口 |
| `AITutorList.vue` | AI导师列表 |
| `FriendsEntryCard.vue` | 好友入口 |
| `InviteModal.vue` | 邀请好友 |
| `PosterModal.vue` | 分享海报 |
| `poster-generator.js` | 海报生成 |

### ✅ 保留

index/, login/, practice/, practice-sub/(核心做题组件), mistake/, favorite/, profile/, settings/(核心设置), study-detail/, splash/, common/

## 二、src/stores/modules/ — 状态仓库

### ❌ 移除

| 文件 | 原功能 |
|------|--------|
| `gamification.js` | PK/ELO游戏化 |
| `group.js` | 学习小组 |
| `invite.js` | 邀请系统 |
| `school.js` | AI择校 |
| `tools.js` | 工具集 |

### ✅ 保留

auth, user, practice-engine, study-engine, review, study, stats, favorite, profile, theme

## 三、src/services/api/domains/ — API服务

### ❌ 移除

| 文件 | 原功能 |
|------|--------|
| `ai.api.js` | AI对话/课堂 |
| `group.api.js` | 学习小组 |
| `invite.api.js` | 邀请系统 |
| `school.api.js` | AI择校 |
| `social.api.js` | 社交/好友 |
| `tools.api.js` | 工具集 |

### ✅ 保留

_request-core, auth, user, practice, study, stats, favorite, smart-study

## 四、src/composables/ — 组合函数

### ❌ 移除

| 文件 | 原功能 |
|------|--------|
| `useRecommendations.js` | AI推荐 |
| `useLearningStyle.js` | 学习风格(AI课堂) |
| `useStyleOnboarding.js` | 风格引导 |

### ✅ 保留

useNavigation, usePracticeNavigation, useQuizAutoSave, useStudyTimer, useHomeStats, useHomeReview, useTheme, useBankStatus

## 五、src/components/business/ — 业务组件

### ❌ 移除

| 文件 | 原功能 |
|------|--------|
| `AIDailyBriefing.vue` | AI每日简报 |
| `AchievementModal.vue` | 成就系统 |
| `SpeedReadyModal.vue` | PK限时竞赛 |

### ✅ 保留

DailyGoalRing, StatsGrid, StudyHeatmap, StudyTimeCard, IndexHeaderBar, WelcomeBanner, PracticeModesModal, GoalSettingModal, LearningStatsCard, PauseBanner, QuizManageModal

## 六、laf-backend/functions/ — 云函数

### ❌ 移除

| 文件 | 原功能 |
|------|--------|
| `pk-battle.ts` | PK对战 |
| `rank-center.ts` | ELO排行 |
| `achievement-manager.ts` | 成就系统 |
| `agent-orchestrator.ts` | 多Agent编排 |
| `ai-diagnosis.ts` | AI诊断 |
| `ai-friend-memory.ts` | AI好友记忆 |
| `ai-photo-search.ts` | 拍照搜题 |
| `anki-export.ts` | Anki导出 |
| `anki-import.ts` | Anki导入 |
| `doc-convert.ts` | 文档转换 |
| `group-service.ts` | 学习小组 |
| `id-photo-segment-base64.ts` | 证件照 |
| `invite-service.ts` | 邀请系统 |
| `lesson-generator.ts` | AI课堂 |
| `photo-bg.ts` | 证件照背景 |
| `proxy-ai.ts` | AI代理 |
| `proxy-ai-stream.ts` | AI流式代理 |
| `rag-ingest.ts` | RAG摄入 |
| `school-crawler-api.ts` | 学校爬虫 |
| `school-query.ts` | 择校查询 |
| `social-service.ts` | 社交服务 |
| `voice-service.ts` | 语音服务 |

### ❌ 移除（_shared/ 内）

| 文件 | 原功能 |
|------|--------|
| `agents/` (整目录) | 多Agent系统 |
| `orchestration/` (整目录) | AI编排 |
| `anti-cheat.ts` | PK防作弊 |
| `conversation-memory.ts` | AI对话记忆 |
| `embedding.ts` | 向量嵌入 |
| `rag-retriever.ts` | RAG检索 |
| `prompts/chat.ts` | AI聊天 |
| `prompts/consult.ts` | 择校咨询 |
| `prompts/friend-chat.ts` | AI好友 |
| `prompts/diagnosis.ts` | AI诊断 |
| `prompts/deep-correction.ts` | AI纠错 |
| `prompts/adaptive-pick.ts` | AI选题 |
| `prompts/vision.ts` | 拍照搜题 |
| `prompts/trend-predict.ts` | 趋势预测 |
| `prompts/material-understand.ts` | 材料理解 |

### ✅ 保留

login, user-profile, upload-avatar, question-bank, answer-submit, mistake-manager, favorite-manager, fsrs-optimizer, smart-study-engine, user-stats, getHomeData, health-check, account-delete/purge, db-*, data-cleanup, upload-static-assets, _shared/(auth, api-response, validator, sanitize, date-utils, fsrs-*, request-guard, idempotency, memory-cache, perf-monitor, wx-content-check, admin-auth)

## 七、执行注意事项

1. **先删页面路由**：从 `src/pages.json` 中移除对应页面的路由配置
2. **再删组件引用**：检查保留页面中是否import了待删组件
3. **最后删文件**：确认无引用后再物理删除
4. **每删一批跑三板斧**：`npm run lint && npm test && npm run build:h5`
5. **分批提交**：按功能模块分批删除并提交，不要一次性全删

## 八、统计

| | ✅ 保留 | ❌ 待移除 | ⚠️ 待评估 |
|---|---------|----------|-----------|
| 总计 | 75 | 61 | 30 |
| 占比 | 45% | 37% | 18% |
