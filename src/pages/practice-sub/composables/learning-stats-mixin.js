/**
 * 学习数据统计 Mixin（分包动态加载）
 * 从 practice/index.vue 抽离，减小主包体积
 * 包含：学习统计、目标设置、成就、收藏、练习模式
 */
import { logger } from '@/utils/logger.js';

export const learningStatsMixin = {
  methods: {
    // ✅ P0-2: 加载学习数据统计
    async loadLearningStats() {
      try {
        const { getStreakData, getComprehensiveReport } = await import('@/utils/analytics/learning-analytics.js');
        const streakData = getStreakData();
        this.currentStreak = streakData.currentStreak || 0;

        const report = getComprehensiveReport();
        if (report && report.today) {
          this.todayQuestions = report.today.questions || 0;
        }
        if (report && report.overview) {
          this.weeklyAccuracy = parseFloat(report.overview.overallAccuracy) || 0;
        }
        if (report && report.knowledge) {
          this.weakPointsCount = report.knowledge.weakPoints ? report.knowledge.weakPoints.length : 0;
        }

        await this.loadTodayGoal();
        await this.loadAchievements();

        logger.log('[practice] 📊 学习数据加载完成:', {
          todayQuestions: this.todayQuestions,
          todayGoal: this.todayGoal,
          currentStreak: this.currentStreak,
          weeklyAccuracy: this.weeklyAccuracy,
          weakPointsCount: this.weakPointsCount,
          unlockedAchievements: this.unlockedAchievements.length
        });
      } catch (e) {
        logger.warn('[practice] 加载学习数据失败:', e);
      }
    },

    // ✅ P1: 加载今日学习目标
    async loadTodayGoal() {
      try {
        const { getTodayGoals, GOAL_TYPES } = await import('../utils/learning-goal.js');
        const todayGoals = getTodayGoals();
        const dailyQuestionGoal = todayGoals.find((g) => g.type === 'DAILY_QUESTIONS');
        if (dailyQuestionGoal) {
          this.todayGoal = dailyQuestionGoal.targetValue;
        } else {
          this.todayGoal = GOAL_TYPES.DAILY_QUESTIONS.defaultValue;
        }
      } catch (e) {
        logger.warn('[practice] 加载今日目标失败:', e);
        this.todayGoal = 20;
      }
    },

    // ✅ P2: 加载成就数据
    async loadAchievements() {
      try {
        const { getAchievements } = await import('@/utils/analytics/learning-analytics.js');
        const achievementData = getAchievements();
        this.unlockedAchievements = achievementData.unlocked || [];
        this.allAchievements = [...achievementData.unlocked, ...achievementData.locked];
        logger.log('[practice] 🏆 成就数据加载完成:', {
          unlocked: this.unlockedAchievements.length,
          total: this.allAchievements.length
        });
      } catch (e) {
        logger.warn('[practice] 加载成就数据失败:', e);
        this.unlockedAchievements = [];
        this.allAchievements = [];
      }
    },

    // ✅ P1: 打开目标设置弹窗
    openGoalSetting() {
      this.showGoalSettingModal = true;
    },

    // ✅ P1: 目标保存回调
    onGoalSaved(value) {
      this.todayGoal = value;
      this.showGoalSettingModal = false;
    },

    // ✅ P2: 加载收藏数量
    async loadFavoriteCount() {
      try {
        const { getFavorites } = await import('../utils/question-favorite.js');
        const favorites = getFavorites();
        this.favoriteCount = favorites.length;
        logger.log('[practice] ⭐ 收藏数量:', this.favoriteCount);
      } catch (e) {
        logger.warn('[practice] 加载收藏数量失败:', e);
        this.favoriteCount = 0;
      }
    },

    // ✅ P1: 显示练习模式选择
    async showPracticeModes() {
      const { getAvailablePracticeModes } = await import('../utils/practice-mode-manager.js');
      this.practiceModes = getAvailablePracticeModes();
      this.showPracticeModesModal = true;
    },

    // ✅ P1: 选择练习模式
    async selectPracticeMode(mode) {
      const { requireLogin } = await import('@/utils/auth/loginGuard.js');
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      requireLogin(
        async () => {
          if (!this.hasBank) {
            this.showPracticeModesModal = false;
            return uni.showToast({ title: '请先导入题库', icon: 'none' });
          }

          try {
            const { startPracticeMode } = await import('../utils/practice-mode-manager.js');
            startPracticeMode(mode.id);
            this.showPracticeModesModal = false;

            safeNavigateTo('/pages/practice-sub/do-quiz', {
              complete: () => {
                setTimeout(() => {
                  this.isNavigating = false;
                }, 500);
              }
            });
          } catch (error) {
            logger.warn('[practice] 启动练习模式失败:', error);
            uni.showToast({
              title: error.message || '启动失败，请重试',
              icon: 'none'
            });
          }
        },
        {
          message: '请先登录后选择练习模式',
          loginUrl: '/pages/settings/index',
          onCancel: () => {
            this.isNavigating = false;
          }
        }
      );
    }
  }
};
