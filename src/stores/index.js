/**
 * Pinia Store 入口文件
 * 只导出主包 tabBar 页面需要的 store
 * 分包页面应直接 import 对应的 store 模块（如 import { useClassroomStore } from '@/stores/modules/classroom'）
 */

export { useUserStore, useAuthStore, useProfileStore } from './modules/user';
export { useStudyStore } from './modules/study';
export { useSchoolStore } from './modules/school';
export { useTodoStore } from './modules/todo';
export { useThemeStore } from './modules/theme';
// 以下 store 仅在分包中使用，不从 barrel 导出（避免拖入主包）
// import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store'
// import { useGamificationStore } from '@/stores/modules/gamification'
// import { useClassroomStore } from '@/stores/modules/classroom'
// import { useToolsStore } from '@/stores/modules/tools'
// import { useReviewStore } from '@/stores/modules/review'
