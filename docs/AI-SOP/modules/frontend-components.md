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

## Business Components (`src/components/business/`)

Domain-specific components organized by feature area.

### Index (Home Page) Components (`business/index/`)

| Component       | File                  | Purpose                                                                                                   |
| --------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| AIDailyBriefing | `AIDailyBriefing.vue` | **(Round 39)** AI每日简报 — 智能任务调度+个性化建议+一键开始最优先任务。基于FSRS/倒计时/错题/进度本地计算 |
| DailyGoalRing   | `DailyGoalRing.vue`   | Circular progress ring for daily goal tracking                                                            |
| StatsGrid       | `StatsGrid.vue`       | Grid of key learning statistics                                                                           |
| StudyHeatmap    | `StudyHeatmap.vue`    | GitHub-style contribution heatmap for study days                                                          |
| WelcomeBanner   | `WelcomeBanner.vue`   | Personalized welcome banner with greeting                                                                 |
| StudyTimeCard   | `StudyTimeCard.vue`   | Today's study time display card                                                                           |
| ActivityList    | `ActivityList.vue`    | Recent learning activity feed                                                                             |
| IndexHeaderBar  | `IndexHeaderBar.vue`  | Home page custom navigation header                                                                        |
| FormulaModal    | `FormulaModal.vue`    | Mathematical formula reference modal                                                                      |

### Practice Components (`business/practice/`)

| Component             | File                        | Purpose                                         |
| --------------------- | --------------------------- | ----------------------------------------------- |
| GenerationProgressBar | `GenerationProgressBar.vue` | AI question generation progress indicator       |
| PauseBanner           | `PauseBanner.vue`           | Quiz pause state banner                         |
| QuizManageModal       | `QuizManageModal.vue`       | Quiz bank management modal                      |
| GoalSettingModal      | `GoalSettingModal.vue`      | Daily practice goal setting                     |
| AchievementModal      | `AchievementModal.vue`      | Achievement unlocked celebration modal          |
| PracticeModesModal    | `PracticeModesModal.vue`    | Practice mode selection (normal, speed, review) |
| SpeedReadyModal       | `SpeedReadyModal.vue`       | Speed mode countdown ready screen               |
| AiGenerationOverlay   | `AiGenerationOverlay.vue`   | Full-screen AI generation loading overlay       |
| LearningStatsCard     | `LearningStatsCard.vue`     | Compact learning statistics display             |

## Chart Components (`src/components/charts/`)

ECharts-based data visualization components. **v2 (Round 13)**: 搬运 ECharts 官方最佳实践配置。

| Component  | File             | Purpose                                                                                |
| ---------- | ---------------- | -------------------------------------------------------------------------------------- |
| StudyTrend | `StudyTrend.vue` | **v2**: 学习趋势图 — dataZoom 横向滚动 + areaStyle 渐变 + markLine 均值 + HTML tooltip |

## Common Components (`src/components/common/`)

Cross-cutting UI components used across multiple pages.

| Component           | File                      | Purpose                                                               |
| ------------------- | ------------------------- | --------------------------------------------------------------------- |
| CustomModal         | `CustomModal.vue`         | Reusable modal dialog with slot content                               |
| EmptyState          | `EmptyState.vue`          | Empty state with illustration and CTA                                 |
| share-modal         | `share-modal.vue`         | Social sharing modal (WeChat, QQ, poster)                             |
| ResumePracticeModal | `ResumePracticeModal.vue` | "Resume where you left off" prompt                                    |
| offline-indicator   | `offline-indicator.vue`   | Network offline status banner (6 pages)                               |
| ErrorBoundary       | `ErrorBoundary.vue`       | Catches render errors, shows recovery UI (global registered, 5 pages) |
| privacy-popup       | `privacy-popup.vue`       | Privacy agreement popup (first launch)                                |

## Layout Components (`src/components/layout/`)

| Component     | File                              | Purpose                                 |
| ------------- | --------------------------------- | --------------------------------------- |
| custom-tabbar | `custom-tabbar/custom-tabbar.vue` | Custom bottom tab bar (replaces native) |

## Summary

- **Total shared components**: ~32
- **Base**: 5 primitives
- **Business**: 18 domain-specific components (across 2 domains)
- **Charts**: 1 ECharts wrapper
- **Common**: 7 cross-cutting components
- **Layout**: 1 tab bar

### New in Round 13-15

| Component  | File                    | Change                          |
| ---------- | ----------------------- | ------------------------------- |
| StudyTrend | `charts/StudyTrend.vue` | v2: dataZoom+areaStyle+markLine |
