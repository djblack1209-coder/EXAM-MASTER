/**
 * 刷题中心导航 Mixin
 * 从 practice/index.vue 提取的导航逻辑，减少主组件方法数量
 *
 * 提供方法：goPractice, goBattle, goMistakeReview, goFileManager,
 *   goAITutor, goMistake, goRank, goToStudyDetail, goFavorites
 * 提供数据：isNavigating
 *
 * @module composables/usePracticeNavigation
 */

import { safeNavigateTo } from '@/utils/safe-navigate';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { analytics } from '@/utils/analytics/event-bus-analytics.js';

export const practiceNavigationMixin = {
  data() {
    return {
      isNavigating: false
    };
  },
  methods: {
    /** @private 重置导航锁定状态（500ms 延迟防重复点击） */
    _resetNav() {
      setTimeout(() => {
        this.isNavigating = false;
      }, 500);
    },

    /** 跳转到刷题页面（需登录 + 题库） */
    goPractice() {
      if (this.isNavigating) return;
      this.isNavigating = true;

      requireLogin(
        () => {
          if (!this.hasBank) {
            this.isNavigating = false;
            return uni.showToast({ title: '请先导入题库', icon: 'none' });
          }
          analytics.track('button_click', {
            buttonName: '开始刷题',
            page: 'practice/index',
            questionCount: this.totalQuestions
          });
          safeNavigateTo('/pages/practice-sub/do-quiz', {
            complete: () => this._resetNav()
          });
        },
        {
          message: '请先登录后开始刷题',
          loginUrl: '/pages/settings/index',
          onCancel: () => {
            this.isNavigating = false;
          }
        }
      );
    },

    /** 跳转到 PK 对战页面（需登录 + 题库） */
    goBattle() {
      if (this.isNavigating) return;
      this.isNavigating = true;

      requireLogin(
        () => {
          if (!this.hasBank) {
            this.isNavigating = false;
            return uni.showToast({ title: '请先导入题库', icon: 'none' });
          }
          safeNavigateTo('/pages/practice-sub/pk-battle', {
            complete: () => this._resetNav()
          });
        },
        {
          message: '请先登录后参与PK对战',
          loginUrl: '/pages/settings/index',
          onCancel: () => {
            this.isNavigating = false;
          }
        }
      );
    },

    /** 跳转到错题复习（无错题时 toast 提示） */
    goMistakeReview() {
      requireLogin(
        () => {
          if (this.mistakeCount === 0) {
            uni.showToast({ title: '暂无错题', icon: 'none' });
            return;
          }
          safeNavigateTo('/pages/mistake/index?mode=review');
        },
        { message: '请先登录后查看错题', loginUrl: '/pages/settings/index' }
      );
    },

    /** 跳转到题库文件管理 */
    goFileManager() {
      requireLogin(
        () => {
          safeNavigateTo('/pages/practice-sub/file-manager');
        },
        { message: '请先登录后管理文件', loginUrl: '/pages/settings/index' }
      );
    },

    /** 跳转到 AI 辅导对话 */
    goAITutor() {
      requireLogin(
        () => {
          safeNavigateTo('/pages/chat/chat');
        },
        { message: '请先登录后使用AI辅导', loginUrl: '/pages/settings/index' }
      );
    },

    /** 跳转到错题本 */
    goMistake() {
      requireLogin(
        () => {
          safeNavigateTo('/pages/mistake/index');
        },
        { message: '请先登录后查看错题本', loginUrl: '/pages/settings/index' }
      );
    },

    /** 跳转到排行榜 */
    goRank() {
      requireLogin(
        () => {
          safeNavigateTo('/pages/practice-sub/rank');
        },
        { message: '请先登录后查看排行榜', loginUrl: '/pages/settings/index' }
      );
    },

    /** 跳转到学习详情 */
    goToStudyDetail() {
      requireLogin(
        () => {
          safeNavigateTo('/pages/study-detail/index');
        },
        { message: '请先登录后查看学习详情', loginUrl: '/pages/settings/index' }
      );
    },

    /** 跳转到收藏夹 */
    goFavorites() {
      requireLogin(
        () => {
          safeNavigateTo('/pages/favorite/index');
        },
        { message: '请先登录后查看收藏', loginUrl: '/pages/settings/index' }
      );
    }
  }
};

export default practiceNavigationMixin;
