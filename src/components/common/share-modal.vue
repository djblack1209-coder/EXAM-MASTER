<!-- 分享弹窗组件：多平台分享、收藏动画、海报预览、复制文案 -->
<template>
  <view v-if="visible" class="share-modal-mask" @tap="handleClose">
    <view class="share-modal-content" :class="{ 'modal-dark': isDark }" @tap.stop>
      <!-- 头部 -->
      <view class="modal-header">
        <text class="modal-title">
          {{ title }}
        </text>
        <view class="close-btn" @tap="handleClose">
          <text class="close-icon">
            ×
          </text>
        </view>
      </view>

      <!-- 预览区域 -->
      <view v-if="showPreview" class="preview-section">
        <view class="quote-preview" :class="{ 'preview-dark': isDark }">
          <text class="preview-quote">
            "{{ quote }}"
          </text>
          <text class="preview-author">
            —— {{ author }}
          </text>
        </view>
      </view>

      <!-- 收藏按钮（带动画） -->
      <view class="favorite-section">
        <view
          class="favorite-btn"
          :class="{ 'is-favorite': isFavorite, 'animate-pop': isAnimating }"
          @tap="handleFavorite"
        >
          <text class="favorite-icon">
            {{ isFavorite ? '💖' : '🤍' }}
          </text>
          <text class="favorite-text">
            {{ isFavorite ? '已收藏' : '收藏' }}
          </text>
        </view>
      </view>

      <!-- 分享选项 -->
      <view class="share-options">
        <view class="option-item" @tap="handleShare('wechat')">
          <view class="option-icon icon-wechat">
            <text>💬</text>
          </view>
          <text class="option-label">
            微信好友
          </text>
        </view>

        <view class="option-item" @tap="handleShare('timeline')">
          <view class="option-icon icon-timeline">
            <text>🌐</text>
          </view>
          <text class="option-label">
            朋友圈
          </text>
        </view>

        <view class="option-item" @tap="handleShare('poster')">
          <view class="option-icon icon-poster">
            <text>🖼️</text>
          </view>
          <text class="option-label">
            生成海报
          </text>
        </view>

        <view class="option-item" @tap="handleShare('copy')">
          <view class="option-icon icon-copy">
            <text>📋</text>
          </view>
          <text class="option-label">
            复制文案
          </text>
        </view>
      </view>

      <!-- 底部提示 -->
      <view class="modal-footer">
        <text class="footer-hint">
          分享给朋友，一起进步
        </text>
      </view>
    </view>

    <!-- 海报预览弹窗 -->
    <view v-if="showPosterPreview" class="poster-preview-modal" @tap.stop>
      <view class="poster-preview-content">
        <canvas
          id="quote-poster-canvas"
          type="2d"
          class="poster-canvas"
          :style="{ width: '375px', height: '500px' }"
        ></canvas>
        <view class="poster-actions">
          <view class="poster-btn btn-cancel" @tap="showPosterPreview = false">
            <text>取消</text>
          </view>
          <view class="poster-btn btn-save" @tap="handleSavePoster">
            <text>保存到相册</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { quoteHandler } from '@/utils/helpers/quote-interaction-handler.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';

export default {
  name: 'ShareModal',

  props: {
    // 是否显示
    visible: {
      type: Boolean,
      default: false
    },
    // 标题
    title: {
      type: String,
      default: '分享金句'
    },
    // 金句内容
    quote: {
      type: String,
      default: ''
    },
    // 作者
    author: {
      type: String,
      default: '古人云'
    },
    // 是否显示预览
    showPreview: {
      type: Boolean,
      default: true
    },
    // 深色模式
    isDark: {
      type: Boolean,
      default: false
    }
  },

  emits: ['close', 'update:visible', 'favorite', 'share'],

  data() {
    return {
      isFavorite: false,
      isAnimating: false,
      showPosterPreview: false,
      posterTempPath: ''
    };
  },

  watch: {
    visible(val) {
      if (val) {
        this.checkFavoriteStatus();
      }
    },
    quote() {
      this.checkFavoriteStatus();
    }
  },

  methods: {
    // 检查收藏状态
    checkFavoriteStatus() {
      this.isFavorite = quoteHandler.isFavorite(this.quote);
    },

    // 关闭弹窗
    handleClose() {
      this.$emit('close');
      this.$emit('update:visible', false);
    },

    // 收藏/取消收藏
    async handleFavorite() {
      if (this.isAnimating) return;

      this.isAnimating = true;

      // 震动反馈
      try {
        uni.vibrateShort({ type: 'medium' });
      } catch (e) { logger.warn('[ShareModal] vibrateShort failed in handleFavorite', e); }

      const result = await quoteHandler.toggleFavorite(this.quote, this.author);
      this.isFavorite = result;

      // 动画结束
      setTimeout(() => {
        this.isAnimating = false;
      }, 600);

      this.$emit('favorite', { isFavorite: result, quote: this.quote });
    },

    // 分享处理
    async handleShare(platform) {
      // 震动反馈
      try {
        uni.vibrateShort({ type: 'light' });
      } catch (e) { logger.warn('[ShareModal] vibrateShort failed in handleShare', e); }

      switch (platform) {
        case 'wechat':
        case 'timeline':
          await this.shareToWechat(platform);
          break;
        case 'poster':
          await this.generatePoster();
          break;
        case 'copy':
          this.copyQuote();
          break;
      }

      this.$emit('share', { platform, quote: this.quote });
    },

    // 微信分享
    async shareToWechat(type) {
      // #ifdef MP-WEIXIN
      // 小程序环境：微信小程序不支持直接调用分享API，需要用户主动触发
      // 关闭当前弹窗，提示用户使用右上角分享按钮
      this.handleClose();

      if (type === 'wechat') {
        // 微信好友分享：设置分享数据，提示用户点击右上角
        uni.showModal({
          title: '分享到微信好友',
          content: '微信小程序需要点击右上角「...」按钮，选择「发送给朋友」进行分享',
          showCancel: false,
          confirmText: '我知道了'
        });
      } else {
        // 朋友圈分享：设置分享数据，提示用户点击右上角
        uni.showModal({
          title: '分享到朋友圈',
          content: '微信小程序需要点击右上角「...」按钮，选择「分享到朋友圈」进行分享',
          showCancel: false,
          confirmText: '我知道了'
        });
      }
      // #endif

      // #ifdef APP-PLUS
      try {
        await quoteHandler.shareQuote(this.quote, this.author, { platform: type });
      } catch (_e) {
        uni.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
      // #endif
    },

    // 生成海报
    async generatePoster() {
      uni.showLoading({ title: '生成中...' });

      try {
        const result = await quoteHandler.generatePoster(this.quote, this.author);

        if (result.needCanvas) {
          // 需要组件创建 canvas
          this.showPosterPreview = true;
          this.$nextTick(() => {
            this.drawPoster(result.config);
          });
        } else if (result.success) {
          this.posterTempPath = result.tempFilePath;
          this.showPosterPreview = true;
        }
      } catch (e) {
        logger.error('[ShareModal] 生成海报失败:', e);
        uni.showToast({
          title: '生成失败，请重试',
          icon: 'none'
        });
      } finally {
        uni.hideLoading();
      }
    },

    // 绘制海报
    drawPoster(config) {
      const query = uni.createSelectorQuery().in(this);
      query.select('#quote-poster-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return;

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = uni.getSystemInfoSync().pixelRatio;

          canvas.width = config.width * dpr / 2;
          canvas.height = config.height * dpr / 2;
          ctx.scale(dpr / 2, dpr / 2);

          // 绘制渐变背景
          const gradient = ctx.createLinearGradient(0, 0, config.width, config.height);
          gradient.addColorStop(0, '#667eea');
          gradient.addColorStop(1, '#764ba2');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, config.width, config.height);

          // 绘制装饰
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.arc(config.width - 100, 100, 150, 0, Math.PI * 2);
          ctx.fill();

          // 绘制金句
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';

          const lines = this.wrapText(ctx, `"${config.quote}"`, config.width - 100);
          let y = 350;
          lines.forEach((line) => {
            ctx.fillText(line, config.width / 2, y);
            y += 48;
          });

          // 绘制作者
          ctx.font = '24px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillText(`—— ${config.author}`, config.width / 2, y + 40);

          // 绘制日期
          ctx.font = '20px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText(config.date, config.width / 2, y + 90);

          // 绘制品牌
          ctx.font = 'bold 24px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('Exam-Master', config.width / 2, config.height - 80);

          ctx.font = '18px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillText('考研路上，与你同行', config.width / 2, config.height - 50);
        });
    },

    // 文字换行
    wrapText(ctx, text, maxWidth) {
      const lines = [];
      let line = '';

      for (let i = 0; i < text.length; i++) {
        const testLine = line + text[i];
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && i > 0) {
          lines.push(line);
          line = text[i];
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      return lines;
    },

    // 保存海报
    async handleSavePoster() {
      try {
        const query = uni.createSelectorQuery().in(this);
        query.select('#quote-poster-canvas')
          .fields({ node: true })
          .exec(async (res) => {
            if (!res[0]) return;

            const canvas = res[0].node;

            // #ifdef MP-WEIXIN
            try {
              const tempFilePath = await new Promise((resolve, reject) => {
                uni.canvasToTempFilePath({
                  canvas,
                  success: (res) => resolve(res.tempFilePath),
                  fail: reject
                });
              });

              const result = await quoteHandler.savePosterToAlbum(tempFilePath);
              if (result.success) {
                this.showPosterPreview = false;
              } else if (result.cancelled) {
                // 用户取消，不做任何处理
              } else if (result.permissionDenied) {
                // 权限被拒绝，已在 handler 中处理
              }
            } catch (_e) {
              logger.error('[ShareModal] 保存海报失败:', _e);
              uni.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
            // #endif

            // #ifdef H5
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `quote_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

            uni.showToast({
              title: '已下载',
              icon: 'success'
            });
            this.showPosterPreview = false;
            // #endif
          });
      } catch (e) {
        logger.error('[ShareModal] 保存海报失败:', e);
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    },

    // 复制文案
    copyQuote() {
      const content = `"${this.quote}"\n—— ${this.author}\n\n来自 Exam-Master，让学习更高效`;

      uni.setClipboardData({
        data: content,
        success: () => {
          uni.showToast({
            title: '已复制到剪贴板',
            icon: 'success'
          });
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.share-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10rpx);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.share-modal-content {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  animation: slideUp 0.3s ease;

  &.modal-dark {
    background: #1a1a1a;
  }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 700;

  .share-modal-content:not(.modal-dark) & { color: #1a1a1a; }
  .modal-dark & { color: #ffffff; }
}

.close-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.05);

  .modal-dark & { background: rgba(255, 255, 255, 0.1); }
}

.close-icon {
	font-size: 40rpx;
	color: var(--ds-color-text-tertiary);

	.modal-dark & { color: var(--ds-color-text-secondary); }
}

/* 预览区域 */
.preview-section {
  margin-bottom: 24rpx;
}

.quote-preview {
  padding: 32rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  &.preview-dark {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
}

.preview-quote {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.6;
  margin-bottom: 16rpx;
}

.preview-author {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

/* 收藏按钮 */
.favorite-section {
  display: flex;
  justify-content: center;
  margin-bottom: 32rpx;
}

.favorite-btn {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 32rpx;
  border-radius: 40rpx;
  background: rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;

  .modal-dark & { background: rgba(255, 255, 255, 0.1); }

  &.is-favorite {
    background: rgba(255, 107, 107, 0.1);
  }

  &.animate-pop {
    animation: pop 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:active {
    transform: scale(0.95);
  }
}

@keyframes pop {
  0% { transform: scale(1); }
  30% { transform: scale(1.2); }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.favorite-icon {
  font-size: 32rpx;
}

.favorite-text {
  font-size: 28rpx;
  font-weight: 500;

  .share-modal-content:not(.modal-dark) & { color: #1a1a1a; }
  .modal-dark & { color: #ffffff; }
}

/* 分享选项 */
.share-options {
  display: flex;
  justify-content: space-around;
  padding: 24rpx 0;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);

  .modal-dark & {
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.option-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;

  &:active {
    opacity: 0.7;
  }
}

.option-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}

.icon-wechat { background: #07C160; }
.icon-timeline { background: #576B95; }
.icon-poster { background: #FF6B6B; }
.icon-copy { background: #F59E0B; }

.option-label {
	font-size: 24rpx;

	.share-modal-content:not(.modal-dark) & { color: var(--ds-color-text-secondary); }
	.modal-dark & { color: rgba(255, 255, 255, 0.7); }
}

/* 底部提示 */
.modal-footer {
  text-align: center;
  padding-top: 24rpx;
}

.footer-hint {
	font-size: 24rpx;
	color: var(--ds-color-text-tertiary);
}

/* 海报预览 */
.poster-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.poster-preview-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.poster-canvas {
  border-radius: 16rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
}

.poster-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 32rpx;
}

.poster-btn {
  padding: 20rpx 48rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;

  &.btn-cancel {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  &.btn-save {
    background: #ffffff;
    color: #667eea;
  }

  &:active {
    opacity: 0.8;
  }
}
</style>
