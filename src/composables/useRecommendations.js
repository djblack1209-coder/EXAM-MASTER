/**
 * useRecommendations — 个性化推荐内容加载 & 点击交互
 * 从 recommendationMixin 迁移为 Composition API composable
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import { DEFAULT_USER_PREFERENCES } from '@/config/home-data.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';

export function useRecommendations() {
  const personalizedRecommendations = ref([]);
  const userPreferences = ref({ ...DEFAULT_USER_PREFERENCES });

  function loadPersonalizedRecommendations() {
    const recommendations = [];
    if (userPreferences.value.preferredSubjects.length > 0) {
      userPreferences.value.preferredSubjects.forEach((subject) => {
        recommendations.push({
          id: `rec_${Date.now()}_${subject}`,
          title: `${subject}专项练习`,
          subtitle: `针对${subject}的重点知识点进行练习`,
          icon: 'target',
          type: 'practice',
          subject
        });
      });
    } else {
      recommendations.push(
        {
          id: `rec_${Date.now()}_1`,
          title: '错题复习',
          subtitle: '复习最近的错题，巩固知识点',
          icon: 'note',
          type: 'mistake'
        },
        {
          id: `rec_${Date.now()}_2`,
          title: '模拟考试',
          subtitle: '进行一次模拟考试，检验学习成果',
          icon: 'clock',
          type: 'mock'
        }
      );
    }
    personalizedRecommendations.value = recommendations;
  }

  function loadUserPreferences() {
    const saved = storageService.get('user_preferences');
    if (saved) {
      userPreferences.value = { ...DEFAULT_USER_PREFERENCES, ...saved };
    }
  }

  function handleRecommendationClick(recommendation) {
    logger.log('[useRecommendations] clicked:', recommendation);
    try {
      uni.vibrateShort?.();
    } catch (_e) {
      /* */
    }

    switch (recommendation.type) {
      case 'practice':
        uni.switchTab({ url: '/pages/practice/index', fail: () => uni.reLaunch({ url: '/pages/practice/index' }) });
        break;
      case 'mistake':
        requireLogin(() => safeNavigateTo('/pages/mistake/index'), { message: '请先登录后查看错题' });
        break;
      case 'mock':
        requireLogin(() => safeNavigateTo('/pages/practice-sub/mock-exam'), { message: '请先登录后进行模拟考试' });
        break;
      default:
        uni.switchTab({ url: '/pages/practice/index', fail: () => uni.reLaunch({ url: '/pages/practice/index' }) });
    }
  }

  return {
    personalizedRecommendations,
    userPreferences,
    loadPersonalizedRecommendations,
    loadUserPreferences,
    handleRecommendationClick
  };
}
