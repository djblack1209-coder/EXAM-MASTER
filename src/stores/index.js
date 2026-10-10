/**
 * Pinia Store 入口文件
 * 只导出主包 tabBar 页面需要的 store
 * 分包页面直接导入对应的 store 模块，避免将其依赖拖入主包。
 */

export { useUserStore, useAuthStore, useProfileStore } from './modules/user';
export { useStudyStore } from './modules/study';
export { useThemeStore } from './modules/theme';
// 以下 store 仅在分包中使用，不从 barrel 导出（避免拖入主包）
// import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store'
// import { useReviewStore } from '@/stores/modules/review'
