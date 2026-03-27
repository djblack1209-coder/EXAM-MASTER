/**
 * 重导出代理 — 规范化导入路径
 * 实际实现位于 src/services/fsrs-service.js
 */
export {
  loadUserParams,
  restoreUserParams,
  hasCustomParams,
  createNewCard,
  saveCardState,
  loadCardState,
  removeCardState,
  scheduleCard,
  previewSchedule,
  getDueCards,
  getReviewStats,
  scheduleAndSave,
  Rating,
  State,
  formatInterval
} from '@/services/fsrs-service.js';
