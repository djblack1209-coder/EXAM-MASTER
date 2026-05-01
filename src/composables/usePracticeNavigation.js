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
import { toast } from '@/utils/toast.js';

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
          return toast.info('请先导入题库');
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
        loginUrl: '/pages/login/index',
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
          return toast.info('请先导入题库');
        }
        toast.info('小程序版已下线 PK 对战，请使用刷题练习');
        _resetNav();
      },
      {
        message: '请先登录后参与PK对战',
        loginUrl: '/pages/login/index',
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
          toast.info('暂无错题');
          return;
        }
        safeNavigateTo('/pages/mistake/index?mode=review');
      },
      { message: '请先登录后查看错题', loginUrl: '/pages/login/index' }
    );
  }

  function goFileManager() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/practice-sub/question-bank');
      },
      { message: '请先登录后查看题库', loginUrl: '/pages/login/index' }
    );
  }

  function goAITutor() {
    requireLogin(
      () => {
        toast.info('小程序版已关闭 AI 导师，请先查看题目解析');
      },
      { message: '请先登录后使用智能辅导', loginUrl: '/pages/login/index' }
    );
  }

  function goMistake() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/mistake/index');
      },
      { message: '请先登录后查看错题本', loginUrl: '/pages/login/index' }
    );
  }

  function goRank() {
    requireLogin(
      () => {
        toast.info('小程序版已下线排行榜，请专注个人练习');
      },
      { message: '请先登录后查看排行榜', loginUrl: '/pages/login/index' }
    );
  }

  function goToStudyDetail() {
    requireLogin(
      () => {
        safeNavigateTo('/pages/profile/index');
      },
      { message: '请先登录后查看学习详情', loginUrl: '/pages/login/index' }
    );
  }

  function goFavorites() {
    requireLogin(
      () => {
        toast.info('小程序版暂不提供收藏夹入口');
      },
      { message: '请先登录后查看收藏', loginUrl: '/pages/login/index' }
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
