/**
 * navigationMixin — 首页导航跳转 & 新手引导
 * F002-I5: 从 index/index.vue 提取
 *
 * 依赖父组件提供的 data:
 *   - isNavigating (Boolean)
 *   - showEmptyBankModal (Boolean)
 *   - showLoginModal (Boolean)
 */
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { logger } from '@/utils/logger.js';
import { DEMO_QUESTIONS } from '@/config/home-data.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';

export const navigationMixin = {
  methods: {
    // 显示登录引导弹窗
    openLoginModal() {
      this.showLoginModal = true;
    },

    navToPractice() {
      if (this.isNavigating) return;
      this.isNavigating = true;

      vibrateLight();

      const questionBank = storageService.get('v30_bank', []);
      if (questionBank.length === 0) {
        this.isNavigating = false;
        this.showEmptyBankModal = true;
      } else {
        uni.switchTab({
          url: '/pages/practice/index',
          success: () => {
            logger.log('[Index] 成功跳转到刷题页面');
          },
          fail: (err) => {
            logger.error('[Index] switchTab 失败:', err);
            uni.reLaunch({
              url: '/pages/practice/index',
              fail: (relaunchErr) => {
                logger.error('[Index] reLaunch 也失败:', relaunchErr);
                uni.showToast({ title: '页面跳转失败', icon: 'none' });
              }
            });
          },
          complete: () => {
            setTimeout(() => {
              this.isNavigating = false;
            }, 500);
          }
        });
      }
    },

    navToMockExam() {
      if (this.isNavigating) return;
      this.isNavigating = true;

      vibrateLight();

      const questionBank = storageService.get('v30_bank', []);
      if (questionBank.length === 0) {
        this.isNavigating = false;
        this.showEmptyBankModal = true;
      } else if (questionBank.length < 10) {
        this.isNavigating = false;
        uni.showModal({
          title: '⚠️ 题目数量不足',
          content: `当前题库仅有 ${questionBank.length} 道题，建议至少 10 道题目后再进行模拟考试。`,
          confirmText: '继续上传',
          cancelText: '先刷题',
          success: (res) => {
            if (res.confirm) {
              safeNavigateTo('/pages/practice-sub/import-data');
            } else {
              uni.switchTab({
                url: '/pages/practice/index',
                fail: () => uni.reLaunch({ url: '/pages/practice/index' })
              });
            }
          }
        });
      } else {
        safeNavigateTo('/pages/practice-sub/mock-exam', {
          success: () => {
            logger.log('[Index] 成功跳转到模拟考试页面');
          },
          complete: () => {
            this.isNavigating = false;
          }
        });
      }
    },

    navToStudyDetail() {
      requireLogin(() => safeNavigateTo('/pages/study-detail/index'), { message: '请先登录后查看学习详情' });
    },

    handleStatClick(type) {
      logger.log('[Index] Stat clicked:', type);

      const routes = {
        questions: '/pages/practice/index',
        accuracy: '/pages/mistake/index',
        streak: '/pages/study-detail/index',
        achievements: '/pages/profile/index'
      };

      if (routes[type]) {
        if (type === 'questions' || type === 'achievements') {
          // tabBar 页面
          uni.switchTab({
            url: routes[type],
            fail: () => uni.reLaunch({ url: routes[type] })
          });
        } else if (type === 'accuracy') {
          requireLogin(() => safeNavigateTo(routes[type]), { message: '请先登录后查看错题统计' });
        } else if (type === 'streak') {
          requireLogin(() => safeNavigateTo(routes[type]), { message: '请先登录后查看学习记录' });
        } else {
          safeNavigateTo(routes[type]);
        }
      }
    },

    // 快速开始（加载示例题库）
    handleQuickStart() {
      uni.showLoading({ title: '加载示例题库...' });

      try {
        storageService.save('v30_bank', DEMO_QUESTIONS);
      } catch (e) {
        uni.hideLoading();
        logger.error('[Index] 加载示例题库失败:', e);
        uni.showToast({ title: '加载失败，请重试', icon: 'none' });
        return;
      }

      uni.hideLoading();
      uni.showToast({ title: '示例题库已加载', icon: 'success' });

      setTimeout(() => {
        uni.switchTab({
          url: '/pages/practice/index',
          fail: (err) => {
            logger.error('[Index] switchTab 失败:', err);
            uni.reLaunch({ url: '/pages/practice/index' });
          }
        });
      }, 1500);
    },

    // 查看教程
    handleTutorial() {
      uni.showModal({
        title: '📖 快速上手教程',
        content:
          '1. 上传学习资料（PDF/Word/图片）\n2. 智能自动提取知识点生成题目\n3. 开始刷题，错题自动收录\n4. 查看学习报告，持续进步',
        confirmText: '开始上传',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            safeNavigateTo('/pages/practice-sub/import-data');
          }
        }
      });
    },

    // 尝试自动登录（应用启动时恢复登录状态）
    async tryAutoLogin() {
      try {
        this.userStore.restoreUserInfo();

        if (this.isLoggedIn) {
          logger.log('[Index] 用户已登录，跳过自动登录');
          return;
        }

        // silentLogin 只恢复本地缓存，不发起网络请求，无需重试
        const result = await this.userStore.silentLogin();
        if (result.success) {
          logger.log('[Index] 缓存恢复登录成功');
          uni.$emit('loginStatusChanged', true);
        }
        // 无缓存是新用户的正常状态，不输出警告
      } catch (error) {
        logger.warn('[Index] 自动登录失败:', error);
      }
    }
  }
};
