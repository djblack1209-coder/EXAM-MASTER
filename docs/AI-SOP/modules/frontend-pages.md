# Frontend Pages Inventory

> Auto-generated: 2026-03-22 | Last updated: 2026-03-26 (Round 53 架构重构)
>
> **Round 53 变更**:
>
> - **D001 service 层重构**：删除 6 个 `.service.js` 文件 (-10,085 行)，`lafService.js` 改为聚合 8 个 `.api.js`
> - **H005 Store 层归位**：31 处 `lafService.xxx()` → Store action（classroomStore 8处, toolsStore 6处, reviewStore 17处）
> - **D004/D009 清理**：废弃 `getApiKey()` 删除，4 个 mixin 迁移为 composable，`src/mixins/` 目录删除

## Main Package (tabBar)

| Page          | Path                           | Lines | Title        | Key Features                                                                               |
| ------------- | ------------------------------ | ----- | ------------ | ------------------------------------------------------------------------------------------ |
| Splash        | `src/pages/splash/index.vue`   | 562   | Exam Master  | Brand animation, auto-redirect                                                             |
| Home          | `src/pages/index/index.vue`    | 2310  | (custom nav) | ECharts, FSRS review, heatmap, knowledge bubbles, daily quote, stats grid, recommendations |
| Practice Hub  | `src/pages/practice/index.vue` | 1955  | 智能刷题     | Quiz config panel, Anki import, AI generation, practice modes, learning stats              |
| School Search | `src/pages/school/index.vue`   | 2396  | 择校分析     | Province filter, school list, hot schools, search input                                    |
| Profile       | `src/pages/profile/index.vue`  | 1907  | 个人中心     | User stats, VIP status, settings entry, gamification display                               |

## Sub-Package: practice-sub

| Page               | Path                                          | Lines | Title      | Key Features                                                                                     |
| ------------------ | --------------------------------------------- | ----- | ---------- | ------------------------------------------------------------------------------------------------ |
| Quiz Engine        | `src/pages/practice-sub/do-quiz.vue`          | 1774  | 刷题进行中 | R43拆分: script -87%，逻辑提取到5个composable (useQuizState/Timer/Submit/Navigation/FSRS)        |
| PK Battle          | `src/pages/practice-sub/pk-battle.vue`        | 1959  | PK 对战    | R45拆分: script -92%，逻辑提取到4个mixin (pkMatching/Gameplay/Result/Share)                      |
| Ranking            | `src/pages/practice-sub/rank.vue`             | 1758  | 学霸排行榜 | Leaderboard, weekly/monthly/all-time, user rank card                                             |
| Import Data        | `src/pages/practice-sub/import-data.vue`      | 2851  | 资料导入   | Anki .apkg import, file upload, format conversion, progress tracking                             |
| File Manager       | `src/pages/practice-sub/file-manager.vue`     | 624   | 文件管理   | Uploaded files list, delete, preview                                                             |
| Mock Exam          | `src/pages/practice-sub/mock-exam.vue`        | ~1600 | 模拟考试   | **[ENHANCED]** 计时压力感(warning/danger) + 实时IRT分数预测 + 每题用时 + 分科统计 + 离线三层降级 |
| Smart Review       | `src/pages/practice-sub/smart-review.vue`     | 950   | 智能复习   | FSRS-driven due cards, retrievability sorting                                                    |
| Question Bank      | `src/pages/practice-sub/question-bank.vue`    | 487   | 考研题库   | Browse question bank, filter by subject/chapter                                                  |
| Diagnosis Report   | `src/pages/practice-sub/diagnosis-report.vue` | 1035  | 学习诊断   | AI analysis, weak points, improvement plan                                                       |
| **Error Clusters** | `src/pages/practice-sub/error-clusters.vue`   | ~215  | 错题归因   | **[NEW]** 错题按error_type×category聚类，趋势分析，severity分级                                  |
| **Sprint Mode**    | `src/pages/practice-sub/sprint-mode.vue`      | ~225  | 冲刺模式   | **[NEW]** ROI优先级排序，考试倒计时，战略放弃建议                                                |

## Sub-Package: login

| Page            | Path                                  | Lines | Title    | Key Features                                            |
| --------------- | ------------------------------------- | ----- | -------- | ------------------------------------------------------- |
| Login           | `src/pages/login/index.vue`           | 1890  | 登录     | Email + code, WeChat login, QQ login, privacy agreement |
| WeChat Callback | `src/pages/login/wechat-callback.vue` | 366   | 微信登录 | OAuth callback handler                                  |
| QQ Callback     | `src/pages/login/qq-callback.vue`     | 499   | QQ登录   | OAuth callback handler                                  |

## Sub-Package: settings

| Page             | Path                             | Lines | Title    | Key Features                                                 |
| ---------------- | -------------------------------- | ----- | -------- | ------------------------------------------------------------ |
| Settings         | `src/pages/settings/index.vue`   | 2132  | 系统设置 | Theme switch, account mgmt, about, feedback, AI tutor config |
| Privacy Policy   | `src/pages/settings/privacy.vue` | 229   | 隐私政策 | Static content                                               |
| Terms of Service | `src/pages/settings/terms.vue`   | 231   | 用户协议 | Static content                                               |

## Sub-Package: social

| Page           | Path                                  | Lines | Title    | Key Features                              |
| -------------- | ------------------------------------- | ----- | -------- | ----------------------------------------- |
| Friend List    | `src/pages/social/friend-list.vue`    | 1513  | 我的好友 | Friend list, add friend, search, requests |
| Friend Profile | `src/pages/social/friend-profile.vue` | 867   | 好友资料 | Friend stats, AI chat, study comparison   |

## Sub-Package: chat

| Page    | Path                      | Lines | Title    | Key Features                                                     |
| ------- | ------------------------- | ----- | -------- | ---------------------------------------------------------------- |
| AI Chat | `src/pages/chat/chat.vue` | 2024  | 智能对话 | Streaming SSE chat, Markdown rendering, KaTeX, code highlighting |

## Sub-Package: mistake

| Page         | Path                          | Lines | Title  | Key Features                                            |
| ------------ | ----------------------------- | ----- | ------ | ------------------------------------------------------- |
| Mistake Book | `src/pages/mistake/index.vue` | 1161  | 错题本 | Error collection, filter by subject/type, stats, export |

## Sub-Package: favorite

| Page      | Path                           | Lines | Title    | Key Features                           |
| --------- | ------------------------------ | ----- | -------- | -------------------------------------- |
| Favorites | `src/pages/favorite/index.vue` | 1339  | 我的收藏 | Saved questions, folders, quick access |

## Sub-Package: plan

| Page              | Path                          | Lines | Title        | Key Features                                      |
| ----------------- | ----------------------------- | ----- | ------------ | ------------------------------------------------- |
| Plan List         | `src/pages/plan/index.vue`    | 1184  | 我的学习计划 | Plan overview, progress tracking, daily tasks     |
| Create Plan       | `src/pages/plan/create.vue`   | 759   | 创建学习计划 | Plan wizard, goal setting, schedule configuration |
| **Adaptive Plan** | `src/pages/plan/adaptive.vue` | ~235  | 智能学习计划 | **[NEW]** AI自适应7天计划，阶段划分，每日任务卡片 |

## Sub-Package: study-detail

| Page         | Path                               | Lines | Title    | Key Features                                        |
| ------------ | ---------------------------------- | ----- | -------- | --------------------------------------------------- |
| Study Detail | `src/pages/study-detail/index.vue` | 707   | 学习详情 | Detailed stats, trend chart, heatmap, ability radar |

## Sub-Package: tools

| Page         | Path                               | Lines | Title      | Key Features                                     |
| ------------ | ---------------------------------- | ----- | ---------- | ------------------------------------------------ |
| Photo Search | `src/pages/tools/photo-search.vue` | 1796  | 拍照搜题   | Camera/gallery input, OCR, AI answer generation  |
| Doc Convert  | `src/pages/tools/doc-convert.vue`  | 1510  | 文档转换   | File format conversion (PDF, DOCX, etc.)         |
| ID Photo     | `src/pages/tools/id-photo.vue`     | 1479  | 证件照制作 | Background removal, color change, size selection |

## Sub-Package: knowledge-graph

| Page                 | Path                                    | Lines | Title      | Key Features                                            |
| -------------------- | --------------------------------------- | ----- | ---------- | ------------------------------------------------------- |
| Knowledge Graph      | `src/pages/knowledge-graph/index.vue`   | 1961  | 知识图谱   | Force-directed graph, node interaction, mastery display |
| **Mastery Overview** | `src/pages/knowledge-graph/mastery.vue` | ~220  | 掌握度全景 | **[NEW]** 各知识点掌握度可视化，科目分组，趋势指示      |

## Sub-Package: ai-classroom

| Page               | Path                                   | Lines | Title   | Key Features                                             |
| ------------------ | -------------------------------------- | ----- | ------- | -------------------------------------------------------- |
| AI Classroom Index | `src/pages/ai-classroom/index.vue`     | 544   | AI 课堂 | Lesson selection, subject browser (R18: 修复 timer leak) |
| AI Classroom       | `src/pages/ai-classroom/classroom.vue` | 751   | AI 课堂 | Interactive lesson, teacher/student/examiner agents      |

## Sub-Package: school-sub

| Page          | Path                                  | Lines | Title    | Key Features                             |
| ------------- | ------------------------------------- | ----- | -------- | ---------------------------------------- |
| School Detail | `src/pages/school-sub/detail.vue`     | 1417  | 院校详情 | Score lines, major info, admission stats |
| AI Consult    | `src/pages/school-sub/ai-consult.vue` | —     | —        | AI school counseling                     |

## Sub-Package: login (含 onboarding)

| Page       | Path                                | Lines | Title    | Key Features                |
| ---------- | ----------------------------------- | ----- | -------- | --------------------------- |
| Onboarding | `src/pages/login/onboarding.vue`    | —     | 新手引导 | Feature tour with driver.js |

## Page-Local Components

Some pages have co-located components in their directories:

| Component          | Path                                                                        | Parent Page     |
| ------------------ | --------------------------------------------------------------------------- | --------------- |
| quiz-progress      | `src/pages/practice-sub/components/quiz-progress/quiz-progress.vue`         | do-quiz         |
| answer-sheet       | `src/pages/practice-sub/components/answer-sheet/answer-sheet.vue`           | do-quiz         |
| quiz-result        | `src/pages/practice-sub/components/quiz-result/quiz-result.vue`             | do-quiz         |
| TutorFeedbackCard  | `src/pages/practice-sub/components/quiz-result/TutorFeedbackCard.vue`       | quiz-result     |
| MemoryStatsRow     | `src/pages/practice-sub/components/quiz-result/MemoryStatsRow.vue`          | quiz-result     |
| xp-toast           | `src/pages/practice-sub/components/xp-toast/xp-toast.vue`                   | do-quiz         |
| base-loading       | `src/pages/practice-sub/components/base-loading/base-loading.vue`           | do-quiz         |
| RichText           | `src/pages/practice-sub/components/RichText.vue`                            | do-quiz         |
| EnhancedProgress   | `src/pages/practice-sub/EnhancedProgress.vue`                               | do-quiz         |
| knowledge-graph.js | `src/pages/knowledge-graph/knowledge-graph.js`                             | knowledge-graph |
| plan-skeleton      | `src/pages/plan/components/plan-skeleton/plan-skeleton.vue`                 | plan            |
| mistake-skeleton   | `src/pages/mistake/components/mistake-skeleton/mistake-skeleton.vue`        | mistake         |
| MistakeCard        | `src/pages/mistake/MistakeCard.vue`                                         | mistake         |
| MistakeReport      | `src/pages/mistake/MistakeReport.vue`                                       | mistake         |
| StatsCard          | `src/pages/mistake/StatsCard.vue`                                           | mistake         |
| FSRSOptimizer      | `src/pages/study-detail/FSRSOptimizer.vue`                                  | study-detail    |
| StudyTrendChart    | `src/pages/study-detail/StudyTrendChart.vue`                                | study-detail    |
| AbilityRadar       | `src/pages/study-detail/AbilityRadar.vue`                                   | study-detail    |
| ThemeSelectorModal | `src/pages/settings/ThemeSelectorModal.vue`                                 | settings        |
| AITutorList        | `src/pages/settings/AITutorList.vue`                                        | settings        |
| AIChatModal        | `src/pages/settings/AIChatModal.vue`                                        | settings        |
| InviteModal        | `src/pages/settings/InviteModal.vue`                                        | settings        |
| PosterModal        | `src/pages/settings/PosterModal.vue`                                        | settings        |
| FriendsEntryCard   | `src/pages/settings/FriendsEntryCard.vue`                                   | settings        |
| LogoutButton       | `src/pages/settings/LogoutButton.vue`                                       | settings        |

## Summary

- **Total pages**: 36
- **Total page lines**: ~49,870
- **Largest page**: pk-battle.vue (3327 lines)
- **Heaviest sub-package**: practice-sub (9 pages, ~15,639 lines)
