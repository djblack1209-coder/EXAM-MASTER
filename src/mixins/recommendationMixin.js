/**
 * recommendationMixin — 个性化推荐内容加载 & 点击交互
 * F002-I3: 从 index/index.vue 提取
 *
 * 依赖父组件提供的 data:
 *   - personalizedRecommendations (Array)
 *   - userPreferences (Object)
 */
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import { DEFAULT_USER_PREFERENCES } from '@/config/home-data.js';

export const recommendationMixin = {
  methods: {
    // 加载个性化推荐内容
    loadPersonalizedRecommendations() {
      const recommendations = [];

      if (this.userPreferences.preferredSubjects.length > 0) {
        this.userPreferences.preferredSubjects.forEach((subject) => {
          recommendations.push({
            id: `rec_${Date.now()}_${subject}`,
            title: `${subject}专项练习`,
            subtitle: `针对${subject}的重点知识点进行练习`,
            icon: '🎯',
            type: 'practice',
            subject: subject
          });
        });
      } else {
        recommendations.push(
          {
            id: `rec_${Date.now()}_1`,
            title: '错题复习',
            subtitle: '复习最近的错题，巩固知识点',
            icon: '📝',
            type: 'mistake'
          },
          {
            id: `rec_${Date.now()}_2`,
            title: '模拟考试',
            subtitle: '进行一次模拟考试，检验学习成果',
            icon: '⏰',
            type: 'mock'
          }
        );
      }

      this.personalizedRecommendations = recommendations;
    },

    // 加载用户学习偏好
    loadUserPreferences() {
      const savedPreferences = storageService.get('user_preferences');
      if (savedPreferences) {
        this.userPreferences = { ...DEFAULT_USER_PREFERENCES, ...savedPreferences };
      }
    },

    // 处理个性化推荐点击
    handleRecommendationClick(recommendation) {
      logger.log('[Index] Recommendation clicked:', recommendation);

      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (_e) { logger.warn('[Index] handleRecommendationClick vibrate failed', _e); }

      switch (recommendation.type) {
        case 'practice':
          uni.switchTab({
            url: '/pages/practice/index',
            fail: () => uni.reLaunch({ url: '/pages/practice/index' })
          });
          break;
        case 'mistake':
          safeNavigateTo('/pages/mistake/index');
          break;
        case 'mock':
          safeNavigateTo('/pages/practice-sub/mock-exam');
          break;
        default:
          uni.switchTab({
            url: '/pages/practice/index',
            fail: () => uni.reLaunch({ url: '/pages/practice/index' })
          });
      }
    }
  }
};
