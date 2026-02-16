/**
 * 学习计时器 Mixin
 * 从 index/index.vue 提取的学习计时相关逻辑
 *
 * 提供：
 * - data: todayStudyTime, studyTimerInterval, sessionStartTime
 * - methods: initStudyTimer, startStudyTimer, stopStudyTimer, saveStudyTime, formatStudyTime, handleStudyTimeClick
 *
 * 依赖：
 * - this.userStore (来自宿主组件)
 * - logger (导入)
 * - safeNavigateTo (导入)
 */
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import storageService from '@/services/storageService.js';

export const studyTimerMixin = {
  data() {
    return {
      // 学习时长相关
      todayStudyTime: 0,
      studyTimerInterval: null,
      sessionStartTime: null
    };
  },

  methods: {
    /**
     * 初始化学习计时器
     * 检查日期变化、恢复今日时长、补偿未保存时间
     */
    initStudyTimer() {
      const savedDate = storageService.get('study_date');
      const today = new Date().toISOString().split('T')[0];

      if (savedDate !== today) {
        // 新的一天，重置今日时长
        this.todayStudyTime = 0;
        storageService.save('study_date', today);
        storageService.save('today_study_time', 0);
        storageService.remove('session_start_time');
        storageService.remove('last_active_time');
      } else {
        // 恢复今日时长（确保是数字类型）
        const savedTime = storageService.get('today_study_time');
        this.todayStudyTime = typeof savedTime === 'number' && savedTime >= 0 ? Math.floor(savedTime) : 0;

        // 检查是否有未保存的学习时间（应用异常退出时）
        const lastActiveTime = storageService.get('last_active_time');
        const sessionStartTime = storageService.get('session_start_time');
        if (lastActiveTime && sessionStartTime) {
          const unsavedMinutes = Math.floor((lastActiveTime - sessionStartTime) / 60000);
          if (unsavedMinutes > 0 && unsavedMinutes <= 5) {
            this.todayStudyTime += unsavedMinutes;
            logger.log('[StudyTimerMixin] 恢复未保存的学习时间:', unsavedMinutes, '分钟');
          }
          storageService.remove('last_active_time');
          storageService.remove('session_start_time');
        }
      }

      // 监听应用进入后台事件，保存当前时间
      uni.onAppHide && uni.onAppHide(() => {
        if (this.sessionStartTime) {
          storageService.save('last_active_time', Date.now());
          this.saveStudyTime();
        }
      });

      logger.log('[StudyTimerMixin] 初始化完成，今日:', this.todayStudyTime, '分钟');
    },

    /**
     * 开始计时（恢复时长 + 监听刷题页面事件）
     */
    startStudyTimer() {
      const savedTime = storageService.get('today_study_time');
      if (typeof savedTime === 'number' && savedTime >= 0) {
        this.todayStudyTime = Math.floor(savedTime);
      }

      // 监听刷题页面的计时事件
      this._studyTimeHandler = (data) => {
        if (data && typeof data.minutes === 'number') {
          this.todayStudyTime = Math.floor(data.minutes);
          logger.log('[StudyTimerMixin] 收到学习时长更新:', this.todayStudyTime, '分钟');
        }
      };
      uni.$on('studyTimeUpdate', this._studyTimeHandler);

      logger.log('[StudyTimerMixin] 计时器状态检查，今日:', this.todayStudyTime, '分钟');
    },

    /**
     * 停止计时（清除定时器 + 保存时间 + 移除事件监听）
     */
    stopStudyTimer() {
      if (this.studyTimerInterval) {
        clearInterval(this.studyTimerInterval);
        this.studyTimerInterval = null;
      }
      this.saveStudyTime();
      storageService.remove('session_start_time');
      storageService.remove('last_active_time');
      uni.$off('studyTimeUpdate', this._studyTimeHandler);
    },

    /**
     * 保存学习时长到本地存储
     */
    saveStudyTime() {
      const timeToSave = Math.max(0, Math.floor(this.todayStudyTime || 0));
      storageService.save('today_study_time', timeToSave);
      storageService.save('study_date', new Date().toISOString().split('T')[0]);
      logger.log('[StudyTimerMixin] 学习时长已保存:', timeToSave, '分钟');
    },

    /**
     * 格式化学习时长
     * @param {number} minutes - 分钟数
     * @returns {string} 格式化后的时长字符串
     */
    formatStudyTime(minutes) {
      if (!minutes || minutes <= 0) {
        return '0 分钟';
      }
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) {
        return `${hours}小时${mins}分钟`;
      }
      return `${mins}分钟`;
    },

    /**
     * 今日学习时长点击处理 - 跳转到学习详情页
     */
    handleStudyTimeClick() {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (_) { /* 非关键操作 */ }

      safeNavigateTo('/pages/study-detail/index', {
        fail: (err) => {
          logger.error('[StudyTimerMixin] 跳转学习详情失败:', err);
          uni.switchTab({
            url: '/pages/profile/index',
            fail: () => {
              uni.showToast({
                title: `今日学习 ${this.formatStudyTime(this.todayStudyTime)}`,
                icon: 'none',
                duration: 2000
              });
            }
          });
        }
      });
    }
  }
};

export default studyTimerMixin;
