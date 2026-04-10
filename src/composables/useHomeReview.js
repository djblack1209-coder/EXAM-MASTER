/**
 * useHomeReview — 首页复习入口逻辑
 * 从 index/index.vue 提取的 FSRS 复习数量加载、未完成进度检测、跳转智能复习等
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { safeImport } from '@/utils/helpers/safe-import.js';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
// 动态导入 — 避免 fsrs-service(5KB) 和 knowledge-engine(6KB) 拖进主包
// import { getReviewStats } from '@/services/fsrs-service.js';
// import { getNextRecommendedTopic } from '@/services/knowledge-engine.js';
import { hasUnfinishedProgress, getProgressSummary } from '@/composables/useQuizAutoSave.js';

export function useHomeReview({ reviewStore } = {}) {
  // 待复习数量
  const reviewPending = ref(0);
  // FSRS 本地调度统计详情
  const reviewStats = ref({ dueCount: 0, newCount: 0, learningCount: 0, overdueCount: 0 });
  // 推荐学习主题
  const recommendedTopic = ref(null);
  // 一键续刷状态
  const hasUnfinished = ref(false);
  const resumeSummary = ref('');

  /**
   * 加载今日待复习数量（FSRS 本地优先 + 服务端增量同步）
   */
  async function loadReviewPending() {
    try {
      if (!isUserLoggedIn()) {
        reviewPending.value = 0;
        reviewStats.value = { dueCount: 0, newCount: 0, learningCount: 0, overdueCount: 0 };
        return;
      }

      // 本地 FSRS 优先：从本地存储的题目计算待复习数量
      const allQuestions = storageService.get('v30_bank', []);
      if (allQuestions.length > 0) {
        const fsrsMod = await safeImport(import('@/services/fsrs-service.js'));
        const getReviewStats = fsrsMod.getReviewStats || fsrsMod.default?.getReviewStats;
        const stats = getReviewStats(allQuestions);
        reviewStats.value = stats;
        reviewPending.value = stats.dueCount + stats.overdueCount;
      }

      // 服务端增量同步（不阻塞 UI）
      // 支持 ref 包装和普通对象两种传入方式，也支持延迟加载（初始 null 后赋值）
      const store = reviewStore?.value || reviewStore;
      if (store?.fetchReviewPlan) {
        store
          .fetchReviewPlan()
          .then((res) => {
            if (res.success && res.data) {
              const serverPending = res.data.reviewPlan?.totalPending || 0;
              // 取本地和服务端的最大值，确保不遗漏
              if (serverPending > reviewPending.value) {
                reviewPending.value = serverPending;
              }
            }
          })
          .catch(() => {
            /* 静默失败，服务端不可用时依赖本地 FSRS */
          });
      } else {
        // reviewStore 尚未加载（动态导入延迟），尝试动态获取
        safeImport(import('@/stores/modules/review.js'))
          .then((mod) => {
            const useReviewStore = mod.useReviewStore || mod.default?.useReviewStore;
            const dynamicStore = useReviewStore();
            if (dynamicStore?.fetchReviewPlan) {
              dynamicStore
                .fetchReviewPlan()
                .then((res) => {
                  if (res.success && res.data) {
                    const serverPending = res.data.reviewPlan?.totalPending || 0;
                    if (serverPending > reviewPending.value) {
                      reviewPending.value = serverPending;
                    }
                  }
                })
                .catch(() => {
                  /* 静默降级 */
                });
            }
          })
          .catch(() => {
            /* 静默降级：reviewStore 不可用，纯依赖本地 FSRS */
          });
      }
    } catch (_e) {
      // 静默失败，不影响首页
    }
  }

  /**
   * 加载推荐学习主题
   */
  async function loadRecommendedTopic() {
    try {
      const allQuestions = storageService.get('v30_bank', []);
      if (allQuestions.length > 0) {
        const keMod = await safeImport(import('@/pages/knowledge-graph/knowledge-engine.js'));
        const getNextRecommendedTopic = keMod.getNextRecommendedTopic || keMod.default?.getNextRecommendedTopic;
        recommendedTopic.value = getNextRecommendedTopic(allQuestions);
      }
    } catch (_e) {
      /* silent */
    }
  }

  /**
   * 检测是否有未完成的答题进度
   */
  function checkUnfinishedProgress() {
    try {
      if (hasUnfinishedProgress()) {
        hasUnfinished.value = true;
        const summary = getProgressSummary();
        if (summary) {
          const answered = summary.answeredCount || 0;
          const total = summary.totalQuestions || 0;
          resumeSummary.value = `已答 ${answered}/${total} 题，点击继续`;
        } else {
          resumeSummary.value = '有未完成的练习，点击继续';
        }
      } else {
        hasUnfinished.value = false;
      }
    } catch (_e) {
      hasUnfinished.value = false;
    }
  }

  /**
   * 跳转智能复习
   */
  function goSmartReview() {
    safeNavigateTo('/pages/practice-sub/smart-review');
  }

  /**
   * 一键续刷 — 直接跳转到上次未完成的答题
   */
  function resumeLastSession() {
    safeNavigateTo('/pages/practice-sub/do-quiz?resume=true');
  }

  return {
    // 响应式状态
    reviewPending,
    reviewStats,
    recommendedTopic,
    hasUnfinished,
    resumeSummary,
    // 方法
    loadReviewPending,
    loadRecommendedTopic,
    checkUnfinishedProgress,
    goSmartReview,
    resumeLastSession
  };
}
