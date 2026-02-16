/**
 * 每日金句 Mixin
 * 从 index/index.vue 提取的每日金句相关逻辑
 *
 * 提供：
 * - data: isRefreshingQuote, quoteDate, dailyQuote, quoteAuthor, showQuotePoster, showShareModal
 * - methods: initDailyQuote, generateDailyQuote, refreshDailyQuote, openQuotePoster,
 *            saveQuotePoster, getCurrentDate, handleQuoteFavorite, handleQuoteShare
 *
 * 依赖：
 * - this.quoteLibrary, this.quoteAuthors (来自宿主组件 data)
 * - logger, quoteHandler (导入)
 */
import { logger } from '@/utils/logger.js';
import { quoteHandler } from '@/utils/helpers/quote-interaction-handler.js';
import storageService from '@/services/storageService.js';

export const dailyQuoteMixin = {
  data() {
    return {
      isRefreshingQuote: false,
      quoteDate: '',
      dailyQuote: '成功不是终点，失败也不是终结，唯有勇气才是永恒。',
      quoteAuthor: '丘吉尔',
      showQuotePoster: false,
      showShareModal: false
    };
  },

  methods: {
    /**
     * 初始化每日金句
     * 基于日期自动切换，每天显示不同的金句
     */
    initDailyQuote() {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
      this.quoteDate = dateStr;

      const cachedQuote = storageService.get('daily_quote_cache');
      const cachedDate = storageService.get('daily_quote_date');

      if (cachedDate === dateStr && cachedQuote) {
        this.dailyQuote = cachedQuote;
        logger.log('[DailyQuoteMixin] 使用缓存的每日金句');
      } else {
        this.generateDailyQuote();
      }
    },

    /**
     * 生成每日金句
     * 使用日期作为种子，确保每天的金句固定但每天不同
     */
    generateDailyQuote() {
      const today = new Date();
      const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);

      const index = dayOfYear % this.quoteLibrary.length;
      this.dailyQuote = this.quoteLibrary[index];
      this.quoteAuthor = this.quoteAuthors[this.dailyQuote] || '古人云';

      const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
      storageService.save('daily_quote_cache', this.dailyQuote);
      storageService.save('daily_quote_date', dateStr);

      logger.log('[DailyQuoteMixin] 生成新的每日金句:', this.dailyQuote);
    },

    /**
     * 刷新每日金句
     * 点击金句卡片时触发，随机显示一条新金句
     */
    refreshDailyQuote() {
      if (this.isRefreshingQuote) return;

      this.isRefreshingQuote = true;

      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (_) { /* 非关键操作 */ }

      let newIndex;
      const currentQuote = this.dailyQuote;
      do {
        newIndex = Math.floor(Math.random() * this.quoteLibrary.length);
      } while (this.quoteLibrary[newIndex] === currentQuote && this.quoteLibrary.length > 1);

      setTimeout(() => {
        this.dailyQuote = this.quoteLibrary[newIndex];
        this.isRefreshingQuote = false;
        storageService.save('daily_quote_cache', this.dailyQuote);
        logger.log('[DailyQuoteMixin] 刷新每日金句:', this.dailyQuote);
      }, 300);
    },

    /**
     * 打开每日金句海报弹窗
     */
    openQuotePoster() {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (_) { /* 非关键操作 */ }

      this.showShareModal = true;
    },

    /**
     * 获取当前日期（格式化）
     * @returns {string} 格式化的日期字符串
     */
    getCurrentDate() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      const weekDay = weekDays[now.getDay()];
      return `${year}年${month}月${day}日 星期${weekDay}`;
    },

    /**
     * 保存金句海报到相册
     */
    saveQuotePoster() {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (_) { /* 非关键操作 */ }

      quoteHandler.generatePoster(this.dailyQuote, this.quoteAuthor)
        .then((result) => {
          if (result.success) {
            quoteHandler.savePosterToAlbum(result.tempFilePath);
          }
        })
        .catch((err) => {
          logger.error('[DailyQuoteMixin] 生成海报失败:', err);
          uni.showToast({
            title: '生成失败，请重试',
            icon: 'none'
          });
        });
    },

    /**
     * 处理金句收藏
     * @param {Object} data - 收藏数据
     */
    handleQuoteFavorite(data) {
      logger.log('[DailyQuoteMixin] Quote favorite:', data);
    },

    /**
     * 处理金句分享
     * @param {Object} data - 分享数据
     */
    handleQuoteShare(data) {
      logger.log('[DailyQuoteMixin] Quote share:', data);
    }
  }
};

export default dailyQuoteMixin;
