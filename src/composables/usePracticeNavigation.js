/**
 * 刷题中心导航 Composable
 * 从 practiceNavigationMixin 迁移为 Composition API
 *
 * 提供方法：goPractice, goBattle, goMistakeReview, goFileManager,
 *   goAITutor, goMistake, goRank, goToStudyDetail, goFavorites
 * 提供数据：isNavigating
 */

import { ref } from 'vue';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { analytics } from '@/utils/analytics/event-bus-analytics.js';

/**
 * @param {Object} deps - 外部响应式依赖
 * @param {import('vue').Ref<boolean>} deps.hasBank
 * @param {import('vue').Ref<number>} deps.totalQuestions
 * @param {import('vue').Ref<number>} deps.mistakeCount
 */
export function usePracticeNavigation(deps = {}) {
  const isNavigating = ref(false);

  function _resetNav() {
    setTimeout(() => {
      isNavigating.value = false;
    }, 500);
  }

  function goPractice() {
    if (isNavigating.value) return;
    isNavigating.value = true;

    requireLogin(
      () => {
        if (!deps.hasBank?.value) {
          isNavigating.value = false;
          return uni.showToast({ title: '请先导入题库', icon: 'none' });
        }
        analytics.track('button_click', {
          buttonName: '开始刷题',
          page: 'practice/index',
          questionCount: deps.totalQuestions?.value
        });
        safeNavigateTo('/pages/practice-sub/do-quiz', {
          complete: () => _resetNav()
        });
      },
      {
        message: '请先登录后开始刷题',
        loginUrl: '/pages/settings/index',
        onCancel: () => {
          isNavigating.value = false;
        }
      }
    );
  }

  function goBattle() {
    if (isNavigating.value) return;
    isNavigating.value = true;

    requireLogin(
      () => {
        if (!deps.hasBank?.value) {
          isNavigating.value = false;
          return uni.showToast({ title: '请先导入题库', icon: 'none' });
        }
        safeNavigateTo('/pages/practice-sub/pk-battle', {
          complete: () => _resetNav()
        });
      },
      {
        message: '请先登录后参与PK对战',
        loginUrl: '/pages/settings/index',
        onCancel: () => {
          isNavigating.value = false;
        }
      }
    );
  }

  function goMistakeReview() {
    requireLogin(
      () => {
        if (deps.mistakeCount?.value === 0) {
          uni.showToast({ title: '暂无错题', icon: 'none' });
          return;
        }
        safeNavigateTo('/pages/mistake/index?mode=review');
      },
      { message: '请先登录后查看错题', loginUrl: '/pages/settings/index' }
    );
  }

  function goFileManager() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/practice-sub/file-manager');
      },
      { message: '请先登录后管理文件', loginUrl: '/pages/settings/index' }
    );
  }

  function goAITutor() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/chat/chat');
      },
      { message: '请先登录后使用智能辅导', loginUrl: '/pages/settings/index' }
    );
  }

  function goMistake() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/mistake/index');
      },
      { message: '请先登录后查看错题本', loginUrl: '/pages/settings/index' }
    );
  }

  function goRank() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/practice-sub/rank');
      },
      { message: '请先登录后查看排行榜', loginUrl: '/pages/settings/index' }
    );
  }

  function goToStudyDetail() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/study-detail/index');
      },
      { message: '请先登录后查看学习详情', loginUrl: '/pages/settings/index' }
    );
  }

  function goFavorites() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/favorite/index');
      },
      { message: '请先登录后查看收藏', loginUrl: '/pages/settings/index' }
    );
  }

  return {
    isNavigating,
    goPractice,
    goBattle,
    goMistakeReview,
    goFileManager,
    goAITutor,
    goMistake,
    goRank,
    goToStudyDetail,
    goFavorites
  };
}
