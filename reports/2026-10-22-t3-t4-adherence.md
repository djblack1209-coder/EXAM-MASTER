# T3 对话行为数据 + T4 复习依从性第一版

结论：行为事实、复习批次、跳过/改期与原因、断签首课、Goal 只读进度已落现有 state/events/Repository；专项与相关回归通过。真实 App/微信真机、390/1090、生产通知与 T6 未验。

## 已实现

- **T3 行为投影**：[learning-adherence.js](../laf-backend/functions/_shared/learning-adherence.js)
  - 从既有 `question.focus / attempt.submit / hint / help / task.stop / learning.leave / reminder.receipt / review.* / coach.*` 投影题目呈现、作答、帮助、离开、复习到期/打开/完成/跳过/改期、Goal 进度。
  - 新事件：`review.open / review.batch.start / review.skip / review.reschedule / learning.leave / review.idea.suggest`；带 owner、at、source、conversationId、questionKey、reason；不含正文/PII。
  - 周汇总 `weeklyAdherence`：完成/跳过/改期/离开/本地时段；未知暴露窗口的分母保持 null；账户隔离。
- **T4 复习依从性**
  - `reviewBatch`：到期批量，首批最多 10；按最早到期、重复可靠错题打破同到期；断签 ≥2 天首批 3；不伪造 BKT。
  - 跳过/改期不扣分、不清零；原因写入事件；当日后续批次自动降量；断签首课轻。
  - `reviewGoalProgress` 只读回写 Goal 进度；`reviewAdjustmentSuggestion` 需至少 3 天且跨 14 天才生成待确认 Idea，不自动改 Goal。
  - 复习页 [review.vue](../src/pages/learning/review.vue) 提供批次、跳过、改到两天后和原因；沿用现有提醒/通知合同。
- 未新增集合、Store、路由或依赖；行为视图在 learning 分包。

## 验证

- 专项 `tests/unit/learning-adherence.spec.js` **20/20**。
- 相关 10 文件 **272/272**（含修复后的 learning-journey-ui、session-round7）。
- 覆盖：23 条到期拆 10、最早到期/错题优先、跳过/改期不惩罚、原因落库、断签首课 3、Goal 只读、账户隔离、幂等、隐私删除、14 天待确认 Idea、未知分母 null。
- H5 构建通过；微信构建通过；主包 **2,068,425 / 2,097,152**，媒体 127,725 / 204,800。
- 未验证：真实 390/1090 浏览器操作、App/微信真机、通知送达、生产 Mongo/Laf 租约、真实模型；未启用生产 cron/通知/部署。

## 未实现

- 复习页的完整跨端视觉验收与截图。
- 真实模型提醒文案润色（T6 未开始）。
- BKT/掌握概率没有引入；批次优先级只用现有可靠错题与 FSRS 到期。
- T1/T2 真实效果指标仍缺外部数据，见 [eval-data-readiness](2026-10-22-eval-data-readiness.md)。
