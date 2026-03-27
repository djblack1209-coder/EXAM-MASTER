# Component Inventory

> Auto-generated: 2026-03-22 | Last updated: 2026-03-25 (Round 39 AI助手化)

## Base Components (`src/components/base/`)

Primitive UI building blocks with no business logic.

| Component      | File                                  | Purpose                                                                                                                                                   |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BaseCard       | `base-card/base-card.vue`             | Generic card container with border, shadow, radius                                                                                                        |
| BaseEmpty      | `base-empty/base-empty.vue`           | Empty state display with icon and message                                                                                                                 |
| BaseIcon       | `base-icon/base-icon.vue`             | **(Round 35k)** SVG icon component — 86 icons (74 base + 12 Lucide-style), 35 aliases. Globally registered in main.js. Supports dark mode theme switching |
| BaseSkeleton   | `base-skeleton/base-skeleton.vue`     | Generic loading skeleton placeholder                                                                                                                      |
| SchoolSkeleton | `school-skeleton/school-skeleton.vue` | School list item loading skeleton                                                                                                                         |
| CountUpNumber  | `base/CountUpNumber.vue`              | **(Round 14)** 数字滚动动画组件，基于 countup.js 10k+                                                                                                     |
| PageTransition | `common/PageTransition.vue`           | **(Round 17)** CSS-only 页面过渡动画（slide-up/fade/slide-left/zoom），搬运 Nuxt 50k+ 模式                                                                |

## Business Components (`src/components/business/`)

Domain-specific components organized by feature area.

### Index (Home Page) Components (`business/index/`)

| Component            | File                       | Purpose                                                                                                   |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| AIDailyBriefing      | `AIDailyBriefing.vue`      | **(Round 39)** AI每日简报 — 智能任务调度+个性化建议+一键开始最优先任务。基于FSRS/倒计时/错题/进度本地计算 |
| CorrectionCard       | `CorrectionCard.vue`       | **(Round 36a)** AI深度矫正卡片 — 自动诊断根因+同类题推荐+一键矫正练习                                     |
| DailyGoalRing        | `DailyGoalRing.vue`        | Circular progress ring for daily goal tracking                                                            |
| StatsGrid            | `StatsGrid.vue`            | Grid of key learning statistics                                                                           |
| StudyHeatmap         | `StudyHeatmap.vue`         | GitHub-style contribution heatmap for study days                                                          |
| WelcomeBanner        | `WelcomeBanner.vue`        | Personalized welcome banner with greeting                                                                 |
| KnowledgeBubbleField | `KnowledgeBubbleField.vue` | Interactive knowledge point bubble visualization                                                          |
| StudyTimeCard        | `StudyTimeCard.vue`        | Today's study time display card                                                                           |
| DailyQuoteCard       | `DailyQuoteCard.vue`       | Daily motivational quote card                                                                             |
| ActivityList         | `ActivityList.vue`         | Recent learning activity feed                                                                             |
| RecommendationsList  | `RecommendationsList.vue`  | AI-powered study recommendations                                                                          |
| IndexHeaderBar       | `IndexHeaderBar.vue`       | Home page custom navigation header                                                                        |
| QuotePosterModal     | `QuotePosterModal.vue`     | Share quote as poster image                                                                               |
| FormulaModal         | `FormulaModal.vue`         | Mathematical formula reference modal                                                                      |
| LearningStatsCard    | `LearningStatsCard.vue`    | (in practice/) Learning statistics display                                                                |

### Practice Components (`business/practice/`)

| Component             | File                        | Purpose                                         |
| --------------------- | --------------------------- | ----------------------------------------------- |
| PracticeConfigPanel   | `PracticeConfigPanel.vue`   | Quiz configuration (subject, count, mode)       |
| EnhancedRichText      | `EnhancedRichText.vue`      | Rich text with KaTeX math rendering             |
| GenerationProgressBar | `GenerationProgressBar.vue` | AI question generation progress indicator       |
| PauseBanner           | `PauseBanner.vue`           | Quiz pause state banner                         |
| QuizManageModal       | `QuizManageModal.vue`       | Quiz bank management modal                      |
| GoalSettingModal      | `GoalSettingModal.vue`      | Daily practice goal setting                     |
| AchievementModal      | `AchievementModal.vue`      | Achievement unlocked celebration modal          |
| PracticeModesModal    | `PracticeModesModal.vue`    | Practice mode selection (normal, speed, review) |
| SpeedReadyModal       | `SpeedReadyModal.vue`       | Speed mode countdown ready screen               |
| AiGenerationOverlay   | `AiGenerationOverlay.vue`   | Full-screen AI generation loading overlay       |
| LearningStatsCard     | `LearningStatsCard.vue`     | Compact learning statistics display             |

### Chat Components (`business/chat/`)

| Component        | File                   | Purpose                                                                             |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| ChatBox          | `ChatBox.vue`          | Main chat input/output container                                                    |
| MessageActions   | `MessageActions.vue`   | Message action buttons (copy, retry, etc.)                                          |
| ThinkingBlock    | `ThinkingBlock.vue`    | AI "thinking" animation block                                                       |
| MarkdownRenderer | `MarkdownRenderer.vue` | Markdown + KaTeX + **syntax highlighting (highlight.js v11, 15 langs, 亮暗双主题)** |
| SuggestedReplies | `SuggestedReplies.vue` | Quick reply suggestions below messages                                              |
| SessionList      | `SessionList.vue`      | Chat session history list                                                           |

### Knowledge Components (`business/knowledge/`)

| Component  | File             | Purpose                                                                                              |
| ---------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| ForceGraph | `ForceGraph.vue` | **v2**: 力导向知识图谱 — BFS 子图高亮 + 边流光粒子 + 待复习脉动 + 单指平移 + 速度阻尼(d3-force 策略) |

### School Components (`business/school/`)

| Component         | File                    | Purpose                                                                    |
| ----------------- | ----------------------- | -------------------------------------------------------------------------- |
| SchoolSearchInput | `SchoolSearchInput.vue` | **v3**: 拼音搜索(pinyin-match) + 搜索历史(useSearchHistory) + 自动去重置顶 |

## Chart Components (`src/components/charts/`)

ECharts-based data visualization components. **v2 (Round 13)**: 搬运 ECharts 官方最佳实践配置。

| Component       | File                  | Purpose                                                                                |
| --------------- | --------------------- | -------------------------------------------------------------------------------------- |
| StudyTrend      | `StudyTrend.vue`      | **v2**: 学习趋势图 — dataZoom 横向滚动 + areaStyle 渐变 + markLine 均值 + HTML tooltip |
| ForgettingCurve | `ForgettingCurve.vue` | **v2**: 遗忘曲线 — 达标/未达标状态 tooltip                                             |
| SkillRadar      | `SkillRadar.vue`      | **v2**: 能力雷达图 — tooltip 能力画像(百分比+评级) + hover emphasis                    |

## Common Components (`src/components/common/`)

Cross-cutting UI components used across multiple pages.

| Component           | File                      | Purpose                                                               |
| ------------------- | ------------------------- | --------------------------------------------------------------------- |
| CustomModal         | `CustomModal.vue`         | Reusable modal dialog with slot content                               |
| EmptyState          | `EmptyState.vue`          | Empty state with illustration and CTA                                 |
| TodoList            | `TodoList.vue`            | Interactive checklist for daily tasks                                 |
| todo-editor         | `todo-editor.vue`         | Task creation/editing form                                            |
| share-modal         | `share-modal.vue`         | Social sharing modal (WeChat, QQ, poster)                             |
| ResumePracticeModal | `ResumePracticeModal.vue` | "Resume where you left off" prompt                                    |
| offline-indicator   | `offline-indicator.vue`   | Network offline status banner (6 pages)                               |
| ErrorBoundary       | `ErrorBoundary.vue`       | Catches render errors, shows recovery UI (global registered, 5 pages) |
| privacy-popup       | `privacy-popup.vue`       | Privacy agreement popup (first launch)                                |
| MiniGuide           | `MiniGuide.vue`           | Compact feature guide tooltip                                         |

## Layout Components (`src/components/layout/`)

| Component     | File                              | Purpose                                 |
| ------------- | --------------------------------- | --------------------------------------- |
| custom-tabbar | `custom-tabbar/custom-tabbar.vue` | Custom bottom tab bar (replaces native) |

## Standalone Components (`src/components/`)

| Component | File            | Purpose                                 |
| --------- | --------------- | --------------------------------------- |
| SwipeCard | `SwipeCard.vue` | Tinder-style swipeable card interaction |

## Summary

- **Total shared components**: ~51
- **Base**: 5 primitives + 1 new (CountUpNumber)
- **Business**: 28 domain-specific components (across 5 domains)
- **Charts**: 3 ECharts wrappers (all v2 enhanced in Round 13)
- **Common**: 9 cross-cutting components
- **Layout**: 1 tab bar
- **Standalone**: 1

### New in Round 13-15

| Component         | File                           | Change                                       |
| ----------------- | ------------------------------ | -------------------------------------------- |
| ForceGraph        | `knowledge/ForceGraph.vue`     | v2: BFS子图高亮+边流光+节点脉动+单指平移     |
| MarkdownRenderer  | `chat/MarkdownRenderer.vue`    | v2: rich-text→mp-html，解锁可选文字/图片预览 |
| CountUpNumber     | `base/CountUpNumber.vue`       | 新增: 数字滚动动画(countup.js 10k+)          |
| SchoolSearchInput | `school/SchoolSearchInput.vue` | v2: pinyin-match拼音搜索                     |
| StudyTrend        | `charts/StudyTrend.vue`        | v2: dataZoom+areaStyle+markLine              |
| SkillRadar        | `charts/SkillRadar.vue`        | v2: tooltip能力画像+hover emphasis           |
