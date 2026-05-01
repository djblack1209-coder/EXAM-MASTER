/**
 * useNavigation — 首页导航跳转 & 新手引导
 * 从 navigationMixin 迁移为 Composition API composable
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { logger } from '@/utils/logger.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { startGuestDemoPractice } from '@/utils/practice/demo-bank.js';

export function useNavigation() {
  const isNavigating = ref(false);
  const showEmptyBankModal = ref(false);
  const showLoginModal = ref(false);

  function openLoginModal() {
    showLoginModal.value = true;
  }

  function navToPractice() {
    if (isNavigating.value) return;
    isNavigating.value = true;
    vibrateLight();

    const bank = storageService.get('v30_bank', []);
    if (bank.length === 0) {
      isNavigating.value = false;
      showEmptyBankModal.value = true;
    } else {
      uni.switchTab({
        url: '/pages/practice/index',
        fail: (err) => {
          logger.error('[useNavigation] switchTab fail:', err);
          uni.reLaunch({ url: '/pages/practice/index' });
        },
        complete: () => {
          setTimeout(() => {
            isNavigating.value = false;
          }, 500);
        }
      });
    }
  }

  function navToMockExam() {
    if (isNavigating.value) return;
    isNavigating.value = true;
    vibrateLight();

    const bank = storageService.get('v30_bank', []);
    if (bank.length === 0) {
      isNavigating.value = false;
      showEmptyBankModal.value = true;
    } else if (bank.length < 10) {
      isNavigating.value = false;
      uni.showModal({
        title: '题目数量不足',
        content: `当前题库仅有 ${bank.length} 道题，建议至少 10 道题目后再进行模拟考试。`,
        confirmText: '加载题库',
        cancelText: '先刷题',
        success: (res) => {
          if (res.confirm) safeNavigateTo('/pages/practice-sub/question-bank');
          else
            uni.switchTab({ url: '/pages/practice/index', fail: () => uni.reLaunch({ url: '/pages/practice/index' }) });
        }
      });
    } else {
      safeNavigateTo('/pages/practice-sub/do-quiz', {
        complete: () => {
          isNavigating.value = false;
        }
      });
    }
  }

  function navToStudyDetail() {
    requireLogin(() => safeNavigateTo('/pages/profile/index'), { message: '请先登录后查看学习详情' });
  }

  function handleStatClick(type) {
    const routes = {
      questions: '/pages/practice/index',
      accuracy: '/pages/mistake/index',
      streak: '/pages/profile/index',
      achievements: '/pages/profile/index'
    };
    if (!routes[type]) return;
    if (type === 'questions' || type === 'achievements') {
      uni.switchTab({ url: routes[type], fail: () => uni.reLaunch({ url: routes[type] }) });
    } else if (type === 'accuracy') {
      requireLogin(() => safeNavigateTo(routes[type]), { message: '请先登录后查看错题统计' });
    } else if (type === 'streak') {
      requireLogin(() => safeNavigateTo(routes[type]), { message: '请先登录后查看学习记录' });
    }
  }

  function handleQuickStart() {
    startGuestDemoPractice({ destination: 'practice' });
  }

  function handleTutorial() {
    uni.showModal({
      title: '快速上手教程',
      content: '1. 在刷题中心加载内置题库\n2. 开始刷题，错题自动收录\n3. 使用智能复习持续巩固',
      confirmText: '去加载',
      cancelText: '稍后再说',
      success: (res) => {
        if (res.confirm) safeNavigateTo('/pages/practice-sub/question-bank');
      }
    });
  }

  async function tryAutoLogin(userStore, isLoggedIn) {
    try {
      userStore.restoreUserInfo();
      if (isLoggedIn) return;
      const result = await userStore.silentLogin();
      if (result.success) uni.$emit('loginStatusChanged', true);
    } catch (error) {
      logger.warn('[useNavigation] auto login failed:', error);
    }
  }

  return {
    isNavigating,
    showEmptyBankModal,
    showLoginModal,
    openLoginModal,
    navToPractice,
    navToMockExam,
    navToStudyDetail,
    handleStatClick,
    handleQuickStart,
    handleTutorial,
    tryAutoLogin
  };
}
