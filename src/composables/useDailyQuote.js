/**
 * 每日金句 composable（从 dailyQuoteMixin 迁移）
 * 提供每日金句的初始化、刷新、收藏、分享、海报生成等功能
 *
 * @module composables/useDailyQuote
 * @param {Object} options
 * @param {import('vue').Ref<string[]>} options.quoteLibrary - 金句库（ref 或 reactive）
 * @param {import('vue').Ref<Object>} options.quoteAuthors  - 金句→作者映射
 */
import { ref } from 'vue';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import { quoteHandler } from '@/utils/helpers/quote-interaction-handler.js';
import storageService from '@/services/storageService.js';

export function useDailyQuote({ quoteLibrary, quoteAuthors } = {}) {
  // ---- data → ref ----
  const isRefreshingQuote = ref(false);
  const quoteDate = ref('');
  const dailyQuote = ref('成功不是终点，失败也不是终结，唯有勇气才是永恒。');
  const quoteAuthor = ref('丘吉尔');
  const showQuotePoster = ref(false);
  const showShareModal = ref(false);

  // ---- 辅助：安全获取金句库（兼容 ref 和普通数组） ----
  function _getLibrary() {
    const lib = quoteLibrary?.value ?? quoteLibrary;
    return Array.isArray(lib) ? lib : [];
  }
  function _getAuthors() {
    const map = quoteAuthors?.value ?? quoteAuthors;
    return map && typeof map === 'object' ? map : {};
  }

  // ---- methods → 普通函数 ----

  /**
   * 初始化每日金句
   * 基于日期自动切换，每天显示不同的金句
   */
  function initDailyQuote() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    quoteDate.value = dateStr;

    const cachedQuote = storageService.get('daily_quote_cache');
    const cachedDate = storageService.get('daily_quote_date');

    if (cachedDate === dateStr && cachedQuote) {
      dailyQuote.value = cachedQuote;
      logger.log('[useDailyQuote] 使用缓存的每日金句');
    } else {
      generateDailyQuote();
    }
  }

  /**
   * 生成每日金句
   * 使用日期作为种子，确保每天的金句固定但每天不同
   */
  function generateDailyQuote() {
    const library = _getLibrary();
    if (!library.length) return;

    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24
    );

    const index = dayOfYear % library.length;
    dailyQuote.value = library[index];
    quoteAuthor.value = _getAuthors()[dailyQuote.value] || '古人云';

    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    storageService.save('daily_quote_cache', dailyQuote.value);
    storageService.save('daily_quote_date', dateStr);

    logger.log('[useDailyQuote] 生成新的每日金句:', dailyQuote.value);
  }

  /**
   * 刷新每日金句
   * 点击金句卡片时触发，随机显示一条新金句
   */
  function refreshDailyQuote() {
    if (isRefreshingQuote.value) return;

    isRefreshingQuote.value = true;

    try {
      if (typeof uni.vibrateShort === 'function') {
        uni.vibrateShort();
      }
    } catch (_) {
      /* 非关键操作 */
    }

    const library = _getLibrary();
    let newIndex;
    const currentQuote = dailyQuote.value;
    do {
      newIndex = Math.floor(Math.random() * library.length);
    } while (library[newIndex] === currentQuote && library.length > 1);

    setTimeout(() => {
      dailyQuote.value = library[newIndex];
      isRefreshingQuote.value = false;
      storageService.save('daily_quote_cache', dailyQuote.value);
      logger.log('[useDailyQuote] 刷新每日金句:', dailyQuote.value);
    }, 300);
  }

  /**
   * 打开每日金句分享弹窗
   */
  function openQuotePoster() {
    try {
      if (typeof uni.vibrateShort === 'function') {
        uni.vibrateShort();
      }
    } catch (_) {
      /* 非关键操作 */
    }

    showShareModal.value = true;
  }

  /**
   * 获取当前日期（格式化）
   * @returns {string} 格式化的日期字符串
   */
  function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[now.getDay()];
    return `${year}年${month}月${day}日 星期${weekDay}`;
  }

  /**
   * 保存金句海报到相册
   */
  function saveQuotePoster() {
    try {
      if (typeof uni.vibrateShort === 'function') {
        uni.vibrateShort();
      }
    } catch (_) {
      /* 非关键操作 */
    }

    quoteHandler
      .generatePoster(dailyQuote.value, quoteAuthor.value)
      .then((result) => {
        if (result.success) {
          quoteHandler.savePosterToAlbum(result.tempFilePath);
        }
      })
      .catch((err) => {
        logger.error('[useDailyQuote] 生成海报失败:', err);
        toast.info('生成失败，请重试');
      });
  }

  /**
   * 处理金句收藏 — 保存到本地收藏列表
   * @param {Object} data - 收藏数据
   */
  function handleQuoteFavorite(data) {
    logger.log('[useDailyQuote] Quote favorite:', data);
    try {
      const favorites = storageService.get('favorite_quotes', []);
      const quote = data?.quote || dailyQuote.value;
      const author = data?.author || quoteAuthor.value;
      const already = favorites.some((q) => q.text === quote);
      if (already) {
        toast.info('已在收藏中');
        return;
      }
      favorites.unshift({ text: quote, author, date: new Date().toISOString() });
      // 最多保留 100 条
      if (favorites.length > 100) favorites.splice(100);
      storageService.save('favorite_quotes', favorites);
      toast.success('收藏成功');
    } catch (e) {
      logger.error('[useDailyQuote] 收藏失败:', e);
      toast.info('收藏失败');
    }
  }

  /**
   * 处理金句分享 — 复制到剪贴板并提示
   * @param {Object} data - 分享数据
   */
  function handleQuoteShare(data) {
    logger.log('[useDailyQuote] Quote share:', data);
    try {
      const quote = data?.quote || dailyQuote.value;
      const author = data?.author || quoteAuthor.value;
      const text = `「${quote}」\n—— ${author}\n\n来自 Exam-Master 考研备考`;
      uni.setClipboardData({
        data: text,
        success: () => {
          toast.success('已复制，快去分享吧');
        },
        fail: () => {
          toast.info('复制失败');
        }
      });
    } catch (e) {
      logger.error('[useDailyQuote] 分享失败:', e);
    }
  }

  // ---- 返回所有响应式数据和方法 ----
  return {
    // 响应式数据
    isRefreshingQuote,
    quoteDate,
    dailyQuote,
    quoteAuthor,
    showQuotePoster,
    showShareModal,
    // 方法
    initDailyQuote,
    generateDailyQuote,
    refreshDailyQuote,
    openQuotePoster,
    getCurrentDate,
    saveQuotePoster,
    handleQuoteFavorite,
    handleQuoteShare
  };
}

export default useDailyQuote;
