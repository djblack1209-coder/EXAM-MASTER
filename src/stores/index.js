/**
 * Pinia Store 入口文件
 * 统一导出所有 store 模块
 */

export { useUserStore, useAuthStore, useProfileStore, useVipStore, useInviteStore } from './modules/user';
export { useStudyStore } from './modules/study';
export { useAppStore } from './modules/app';
export { useSchoolStore } from './modules/school';
export { useTodoStore } from './modules/todo';
export { useThemeStore } from './modules/theme';
export { useLearningTrajectoryStore } from './modules/learning-trajectory-store';
export { useGamificationStore } from './modules/gamification';
