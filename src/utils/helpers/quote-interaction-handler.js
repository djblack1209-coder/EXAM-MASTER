/**
 * 每日金句交互处理器
 * 解决检查点1.2：每日金句点击无响应或仅console.log问题
 *
 * 功能：
 * 1. 分享弹窗管理
 * 2. 收藏动画效果
 * 3. 海报生成
 * 4. 社交分享
 *
 * @version 2.0.0 - 使用新的权限处理工具
 */

import { permissionHandler } from './permission-handler.js';
import storageService from '@/services/storageService.js';

// 收藏状态存储键
const STORAGE_KEYS = {
  FAVORITE_QUOTES: 'favorite_quotes',
  SHARE_COUNT: 'quote_share_count',
  LAST_SHARE_TIME: 'last_quote_share_time'
};

/**
 * 金句交互处理类
 */
class QuoteInteractionHandler {
  constructor() {
    this.favoriteQuotes = [];
    this.isAnimating = false;
    this.shareCount = 0;
  }

  /**
   * 初始化
   */
  init() {
    try {
      this.favoriteQuotes = storageService.get(STORAGE_KEYS.FAVORITE_QUOTES, []);
      this.shareCount = storageService.get(STORAGE_KEYS.SHARE_COUNT, 0);
    } catch (e) {
      console.error('[QuoteHandler] 初始化失败:', e);
    }
  }

  /**
   * 检查金句是否已收藏
   */
  isFavorite(quote) {
    return this.favoriteQuotes.some((q) => q.text === quote);
  }

  /**
   * 收藏金句（带动画）
   */
  async toggleFavorite(quote, author = '古人云') {
    const isFav = this.isFavorite(quote);

    if (isFav) {
      // 取消收藏
      this.favoriteQuotes = this.favoriteQuotes.filter((q) => q.text !== quote);
      uni.showToast({
        title: '已取消收藏',
        icon: 'none',
        duration: 1500
      });
    } else {
      // 添加收藏
      const newFavorite = {
        text: quote,
        author,
        timestamp: Date.now(),
        id: `quote_${Date.now()}`
      };
      this.favoriteQuotes.unshift(newFavorite);

      // 触发收藏动画
      await this.playFavoriteAnimation();

      uni.showToast({
        title: '💖 已收藏',
        icon: 'none',
        duration: 1500
      });
    }

    // 保存到本地
    storageService.save(STORAGE_KEYS.FAVORITE_QUOTES, this.favoriteQuotes);

    return !isFav;
  }

  /**
   * 播放收藏动画
   */
  async playFavoriteAnimation() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // 震动反馈
    try {
      uni.vibrateShort({ type: 'medium' });
    } catch (_e) {}

    // 返回动画配置，由组件执行
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isAnimating = false;
        resolve({
          type: 'favorite',
          duration: 600,
          keyframes: [
            { scale: 1, opacity: 1 },
            { scale: 1.3, opacity: 0.8 },
            { scale: 1, opacity: 1 }
          ]
        });
      }, 600);
    });
  }

  /**
   * 获取所有收藏的金句
   */
  getFavorites() {
    this.init();
    return this.favoriteQuotes;
  }

  /**
   * 分享金句
   */
  async shareQuote(quote, author, options = {}) {
    const { platform = 'wechat', type = 'text' } = options;

    // 记录分享次数
    this.shareCount++;
    storageService.save(STORAGE_KEYS.SHARE_COUNT, this.shareCount);
    storageService.save(STORAGE_KEYS.LAST_SHARE_TIME, Date.now());

    // 震动反馈
    try {
      uni.vibrateShort({ type: 'light' });
    } catch (_e) {}

    if (type === 'poster') {
      // 生成海报分享
      return this.generatePoster(quote, author);
    }

    // 文字分享
    const shareContent = `"${quote}"\n—— ${author}\n\n来自 Exam-Master，让学习更高效`;

    // #ifdef MP-WEIXIN
    // 微信小程序分享
    return new Promise((resolve, reject) => {
      uni.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
        success: () => {
          resolve({ success: true, platform: 'wechat' });
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
    // #endif

    // #ifdef H5
    // H5 分享（复制到剪贴板）
    return new Promise((resolve) => {
      uni.setClipboardData({
        data: shareContent,
        success: () => {
          uni.showToast({
            title: '已复制，快去分享吧',
            icon: 'none'
          });
          resolve({ success: true, platform: 'clipboard' });
        }
      });
    });
    // #endif

    // #ifdef APP-PLUS
    // APP 分享
    return new Promise((resolve, reject) => {
      uni.share({
        provider: platform === 'wechat' ? 'weixin' : platform,
        type: 0,
        title: '每日金句',
        summary: shareContent,
        success: () => {
          resolve({ success: true, platform });
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
    // #endif
  }

  /**
   * 生成金句海报
   */
  async generatePoster(quote, author) {
    return new Promise((resolve, reject) => {
      // 获取 canvas 上下文
      const query = uni.createSelectorQuery();
      query.select('#quote-poster-canvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res[0]) {
            // 如果没有 canvas，返回配置让组件创建
            resolve({
              needCanvas: true,
              config: {
                width: 750,
                height: 1000,
                quote,
                author,
                date: this.formatDate(new Date()),
                theme: 'gradient' // gradient | dark | light
              }
            });
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = uni.getSystemInfoSync().pixelRatio;

          canvas.width = 750 * dpr;
          canvas.height = 1000 * dpr;
          ctx.scale(dpr, dpr);

          // 绘制背景渐变
          const gradient = ctx.createLinearGradient(0, 0, 750, 1000);
          gradient.addColorStop(0, '#667eea');
          gradient.addColorStop(1, '#764ba2');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 750, 1000);

          // 绘制装饰圆
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.arc(650, 100, 150, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(100, 900, 100, 0, Math.PI * 2);
          ctx.fill();

          // 绘制金句文字
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';

          // 文字换行处理
          const maxWidth = 600;
          const lineHeight = 54;
          const words = quote.split('');
          let line = '"';
          let y = 400;

          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && i > 0) {
              ctx.fillText(line, 375, y);
              line = words[i];
              y += lineHeight;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line + '"', 375, y);

          // 绘制作者
          ctx.font = '26px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillText(`—— ${author}`, 375, y + 80);

          // 绘制日期
          ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText(this.formatDate(new Date()), 375, y + 140);

          // 绘制品牌
          ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('Exam-Master', 375, 920);

          ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillText('考研路上，与你同行', 375, 960);

          // 导出图片
          try {
            const tempFilePath = canvas.toDataURL('image/png');
            resolve({
              success: true,
              tempFilePath,
              config: { width: 750, height: 1000 }
            });
          } catch (e) {
            reject(e);
          }
        });
    });
  }

  /**
   * 保存海报到相册 - 使用新的权限处理工具
   */
  async savePosterToAlbum(tempFilePath) {
    // 使用统一的权限处理工具
    return await permissionHandler.saveImageToAlbum(tempFilePath, {
      showLoading: true,
      loadingText: '保存中...',
      successText: '已保存到相册',
      failText: '保存失败'
    });
  }

  /**
   * 格式化日期
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[date.getDay()];
    return `${year}年${month}月${day}日 星期${weekDay}`;
  }

  /**
   * 获取分享统计
   */
  getShareStats() {
    return {
      totalShares: this.shareCount,
      totalFavorites: this.favoriteQuotes.length,
      lastShareTime: storageService.get(STORAGE_KEYS.LAST_SHARE_TIME)
    };
  }
}

// 导出单例
export const quoteHandler = new QuoteInteractionHandler();

// 初始化
quoteHandler.init();

export default quoteHandler;
