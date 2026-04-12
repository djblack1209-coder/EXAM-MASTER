<!-- 分享弹窗组件：多平台分享、收藏动画、海报预览、复制文案 -->
<template>
  <view v-if="visible" class="share-modal-mask" @tap="handleClose">
    <view class="share-modal-content" :class="{ 'modal-dark': isDark }" @tap.stop>
      <view class="panel-handle" />

      <view class="modal-header">
        <view>
          <text class="modal-eyebrow"> Share Panel </text>
          <text class="modal-title">
            {{ title }}
          </text>
        </view>
        <view class="close-btn" @tap="handleClose">
          <text class="close-icon"> × </text>
        </view>
      </view>

      <view v-if="showPreview" class="preview-section">
        <view class="quote-preview" :class="{ 'preview-dark': isDark }">
          <text class="preview-label"> Quote Preview </text>
          <text class="preview-quote"> "{{ quote }}" </text>
          <text class="preview-author"> —— {{ author }} </text>
        </view>
      </view>

      <view class="favorite-section">
        <view
          class="favorite-btn"
          :class="{ 'is-favorite': isFavorite, 'animate-pop': isAnimating }"
          @tap="handleFavorite"
        >
          <text class="favorite-icon">
            {{ isFavorite ? '\u2764\uFE0F' : '\u2661' }}
          </text>
          <text class="favorite-text">
            {{ isFavorite ? '已收藏' : '收藏' }}
          </text>
        </view>
      </view>

      <view class="share-heading">
        <text class="share-heading-title"> 选择分享方式 </text>
        <text class="share-heading-subtitle"> 分享、生成海报或复制文案 </text>
      </view>

      <view class="share-options">
        <view class="option-item option-wechat" @tap="handleShare('wechat')">
          <view class="option-icon icon-wechat">
            <BaseIcon name="comment" :size="40" />
          </view>
          <text class="option-label"> 微信好友 </text>
        </view>

        <view class="option-item option-timeline" @tap="handleShare('timeline')">
          <view class="option-icon icon-timeline">
            <BaseIcon name="globe" :size="40" />
          </view>
          <text class="option-label"> 朋友圈 </text>
        </view>

        <view class="option-item option-poster" @tap="handleShare('poster')">
          <view class="option-icon icon-poster">
            <BaseIcon name="image" :size="40" />
          </view>
          <text class="option-label"> 生成海报 </text>
        </view>

        <view class="option-item option-copy" @tap="handleShare('copy')">
          <view class="option-icon icon-copy">
            <BaseIcon name="copy" :size="40" />
          </view>
          <text class="option-label"> 复制文案 </text>
        </view>
      </view>

      <view class="modal-footer">
        <text class="footer-hint"> 分享给朋友，一起进步 </text>
      </view>
    </view>

    <!-- 海报预览弹窗 -->
    <view v-if="showPosterPreview" class="poster-preview-modal" @tap.stop>
      <view class="poster-preview-content">
        <view class="poster-preview-header">
          <text class="poster-preview-title"> 海报预览 </text>
        </view>
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

<script setup>
import { ref, watch, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { quoteHandler } from '@/utils/helpers/quote-interaction-handler.js';
// 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { getPixelRatio } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// --- 属性定义 ---
const props = defineProps({
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
});

// --- 事件定义 ---
const emit = defineEmits(['close', 'update:visible', 'favorite', 'share']);

// --- 组件实例（用于 uni.createSelectorQuery） ---
const instance = getCurrentInstance();

// --- 响应式状态 ---
const isFavorite = ref(false);
const isAnimating = ref(false);
const showPosterPreview = ref(false);
const posterTempPath = ref('');

// 非响应式：动画定时器引用
let _animTimer = null;

// --- 侦听器 ---
watch(
  () => props.visible,
  (val) => {
    if (val) {
      checkFavoriteStatus();
    }
  }
);

watch(
  () => props.quote,
  () => {
    checkFavoriteStatus();
  }
);

// --- 生命周期 ---
onBeforeUnmount(() => {
  if (_animTimer) {
    clearTimeout(_animTimer);
    _animTimer = null;
  }
});

// --- 方法 ---

// 检查收藏状态
function checkFavoriteStatus() {
  isFavorite.value = quoteHandler.isFavorite(props.quote);
}

// 关闭弹窗
function handleClose() {
  emit('close');
  emit('update:visible', false);
}

// 收藏/取消收藏
async function handleFavorite() {
  if (isAnimating.value) return;

  isAnimating.value = true;

  // 震动反馈
  try {
    uni.vibrateShort({ type: 'medium' });
  } catch (e) {
    logger.warn('[ShareModal] vibrateShort failed in handleFavorite', e);
  }

  const result = await quoteHandler.toggleFavorite(props.quote, props.author);
  isFavorite.value = result;

  // 动画结束
  _animTimer = setTimeout(() => {
    _animTimer = null;
    isAnimating.value = false;
  }, 600);

  emit('favorite', { isFavorite: result, quote: props.quote });
}

// 分享处理
async function handleShare(platform) {
  // 震动反馈
  try {
    uni.vibrateShort({ type: 'light' });
  } catch (e) {
    logger.warn('[ShareModal] vibrateShort failed in handleShare', e);
  }

  switch (platform) {
    case 'wechat':
    case 'timeline':
      await shareToWechat(platform);
      break;
    case 'poster':
      await generatePoster();
      break;
    case 'copy':
      copyQuote();
      break;
  }

  emit('share', { platform, quote: props.quote });
}

// 微信分享
async function shareToWechat(type) {
  // #ifdef MP-WEIXIN
  // 小程序环境：微信小程序不支持直接调用分享API，需要用户主动触发
  // 关闭当前弹窗，提示用户使用右上角分享按钮
  handleClose();

  if (type === 'wechat') {
    // 微信好友分享：设置分享数据，提示用户点击右上角
    modal.show({
      title: '分享到微信好友',
      content: '微信小程序需要点击右上角「...」按钮，选择「发送给朋友」进行分享',
      showCancel: false,
      confirmText: '我知道了'
    });
  } else {
    // 朋友圈分享：设置分享数据，提示用户点击右上角
    modal.show({
      title: '分享到朋友圈',
      content: '微信小程序需要点击右上角「...」按钮，选择「分享到朋友圈」进行分享',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
  // #endif

  // #ifdef APP-PLUS
  try {
    await quoteHandler.shareQuote(props.quote, props.author, { platform: type });
  } catch (_e) {
    toast.info('分享失败');
  }
  // #endif
}

// 生成海报
async function generatePoster() {
  toast.loading('生成中...');

  try {
    const result = await quoteHandler.generatePoster(props.quote, props.author);

    if (result.needCanvas) {
      // 需要组件创建 canvas
      showPosterPreview.value = true;
      nextTick(() => {
        drawPoster(result.config);
      });
    } else if (result.success) {
      posterTempPath.value = result.tempFilePath;
      showPosterPreview.value = true;
    }
  } catch (e) {
    logger.error('[ShareModal] 生成海报失败:', e);
    toast.info('生成失败，请重试');
  } finally {
    toast.hide();
  }
}

// 绘制海报
function drawPoster(config) {
  const query = uni.createSelectorQuery().in(instance.proxy);
  query
    .select('#quote-poster-canvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0]) return;

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = getPixelRatio();

      canvas.width = (config.width * dpr) / 2;
      canvas.height = (config.height * dpr) / 2;
      ctx.scale(dpr / 2, dpr / 2);

      // 绘制品牌渐变背景
      const gradient = ctx.createLinearGradient(0, 0, config.width, config.height);
      if (props.isDark) {
        gradient.addColorStop(0, '#07111c');
        gradient.addColorStop(1, '#0a84ff');
      } else {
        gradient.addColorStop(0, '#6bd096');
        gradient.addColorStop(1, '#d8f2df');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, config.width, config.height);

      // 绘制装饰
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(config.width - 100, 100, 150, 0, Math.PI * 2);
      ctx.fill();

      // 绘制金句
      ctx.fillStyle = props.isDark ? '#ffffff' : '#13301c';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';

      const lines = wrapText(ctx, `"${config.quote}"`, config.width - 100);
      let y = 350;
      lines.forEach((line) => {
        ctx.fillText(line, config.width / 2, y);
        y += 48;
      });

      // 绘制作者
      ctx.font = '24px sans-serif';
      ctx.fillStyle = props.isDark ? 'rgba(255, 255, 255, 0.82)' : 'rgba(19, 48, 28, 0.72)';
      ctx.fillText(`—— ${config.author}`, config.width / 2, y + 40);

      // 绘制日期
      ctx.font = '20px sans-serif';
      ctx.fillStyle = props.isDark ? 'rgba(255, 255, 255, 0.64)' : 'rgba(19, 48, 28, 0.56)';
      ctx.fillText(config.date, config.width / 2, y + 90);

      // 绘制品牌
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = props.isDark ? '#ffffff' : '#13301c';
      ctx.fillText('Exam-Master', config.width / 2, config.height - 80);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = props.isDark ? 'rgba(255, 255, 255, 0.74)' : 'rgba(19, 48, 28, 0.64)';
      ctx.fillText('考研路上，与你同行', config.width / 2, config.height - 50);
    });
}

// 文字换行
function wrapText(ctx, text, maxWidth) {
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
}

// 保存海报
async function handleSavePoster() {
  try {
    const query = uni.createSelectorQuery().in(instance.proxy);
    query
      .select('#quote-poster-canvas')
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
            showPosterPreview.value = false;
          } else if (result.cancelled) {
            // 用户取消，不做任何处理
          } else if (result.permissionDenied) {
            // 权限被拒绝，已在 handler 中处理
          }
        } catch (_e) {
          logger.error('[ShareModal] 保存海报失败:', _e);
          toast.info('保存失败');
        }
        // #endif

        // #ifdef APP-PLUS
        try {
          const tempFilePath = await new Promise((resolve, reject) => {
            uni.canvasToTempFilePath({
              canvas,
              success: (res) => resolve(res.tempFilePath),
              fail: reject
            });
          });

          uni.saveImageToPhotosAlbum({
            filePath: tempFilePath,
            success: () => {
              toast.success('已保存到相册');
              showPosterPreview.value = false;
            },
            fail: (err) => {
              if (err?.errMsg && err.errMsg.includes('deny')) {
                modal.show({
                  title: '权限提示',
                  content: '需要相册权限才能保存图片，请在设置中开启',
                  confirmText: '去设置',
                  success: (res) => {
                    if (res.confirm) {
                      plus.runtime.openURL('app-settings:');
                    }
                  }
                });
              } else {
                toast.info('保存失败');
              }
            }
          });
        } catch (_e) {
          logger.error('[ShareModal] App端保存海报失败:', _e);
          toast.info('保存失败');
        }
        // #endif

        // #ifdef H5
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `quote_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        toast.success('已下载');
        showPosterPreview.value = false;
        // #endif
      });
  } catch (e) {
    logger.error('[ShareModal] 保存海报失败:', e);
    toast.info('保存失败');
  }
}

// 复制文案
function copyQuote() {
  const content = `"${props.quote}"\n—— ${props.author}\n\n来自 Exam-Master，让学习更高效`;

  uni.setClipboardData({
    data: content,
    success: () => {
      toast.success('已复制到剪贴板');
    }
  });
}
</script>

<style lang="scss" scoped>
.share-modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(9, 18, 12, 0.32);
}

.share-modal-content {
  width: 100%;
  padding: 14rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 38rpx 38rpx 0 0;
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  box-shadow: 0 -20rpx 70rpx rgba(21, 49, 28, 0.18);
  animation: slideUp 0.26s ease;
}

.panel-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}

.modal-header,
.favorite-btn,
.option-item,
.poster-btn,
.close-btn {
  display: flex;
  align-items: center;
}

.modal-header {
  justify-content: space-between;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-bottom: 22rpx;
}

.modal-eyebrow,
.modal-title,
.preview-label,
.preview-quote,
.preview-author,
.favorite-text,
.share-heading-title,
.share-heading-subtitle,
.option-label,
.footer-hint,
.poster-preview-title {
  display: block;
}

.modal-eyebrow {
  margin-bottom: 6rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.modal-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main);
}

.close-btn {
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.62);
  border: 2rpx solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.close-icon {
  font-size: 40rpx;
  color: var(--text-sub);
}

.preview-section {
  margin-bottom: 20rpx;
}

.quote-preview {
  padding: 28rpx;
  border-radius: 28rpx;
  background-color: var(--em3d-card-bg);
  border: 2rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: 0 var(--em3d-depth-md) 0 var(--em3d-border-shadow);
}

.quote-preview.preview-dark {
  background-color: var(--em3d-card-bg);
  border-color: rgba(255, 255, 255, 0.1);
}

.preview-label {
  margin-bottom: 10rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: rgba(19, 48, 28, 0.58);
}

.preview-dark .preview-label {
  color: rgba(255, 255, 255, 0.58);
}

.preview-quote {
  font-size: 32rpx;
  line-height: 1.6;
  font-weight: 650;
  color: var(--foreground);
}

.preview-dark .preview-quote {
  color: var(--foreground);
}

.preview-author {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: rgba(19, 48, 28, 0.7);
}

.preview-dark .preview-author {
  color: rgba(255, 255, 255, 0.74);
}

.favorite-section {
  display: flex;
  justify-content: center;
  margin-bottom: 22rpx;
}

.favorite-btn {
  /* gap: 12rpx; -- replaced for Android WebView compat */
  justify-content: center;
  padding: 18rpx 30rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.58);
  border: 2rpx solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.favorite-btn.is-favorite {
  background: rgba(255, 99, 90, 0.12);
  border-color: rgba(255, 99, 90, 0.24);
}

.favorite-btn.animate-pop {
  animation: pop 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.favorite-icon {
  font-size: 32rpx;
}

.favorite-text {
  font-size: 28rpx;
  font-weight: 620;
  color: var(--text-main);
}

.share-heading {
  margin-bottom: 18rpx;
}

.share-heading-title {
  font-size: 28rpx;
  font-weight: 660;
  color: var(--text-main);
}

.share-heading-subtitle {
  margin-top: 6rpx;
  font-size: 23rpx;
  color: var(--text-sub);
}

.share-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  /* gap: 16rpx; -- replaced for Android WebView compat */
}
.share-options > view:nth-child(even) {
  margin-left: 16rpx;
}
.share-options > view:nth-child(n + 3) {
  margin-top: 16rpx;
}

.option-item {
  flex-direction: column;
  justify-content: center;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  min-height: 188rpx;
  padding: 24rpx 16rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.58);
  border: 2rpx solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}
.option-item > view + view {
  margin-top: 12rpx;
}

.option-icon {
  width: 92rpx;
  height: 92rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main);
}

.icon-wechat {
  background: var(--em3d-primary-light);
}

.icon-timeline {
  background: color-mix(in srgb, var(--info) 14%, transparent);
}

.icon-poster {
  background: rgba(255, 200, 0, 0.15);
}

.icon-copy {
  background: rgba(142, 142, 147, 0.14);
}

.option-label {
  font-size: 24rpx;
  color: var(--text-main);
}

.modal-footer {
  padding-top: 22rpx;
  text-align: center;
}

.footer-hint {
  font-size: 22rpx;
  color: var(--text-sub);
}

.poster-preview-modal {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10000;
  background: rgba(9, 18, 12, 0.34);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 32rpx 24rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
}

.poster-preview-content {
  width: 100%;
  max-width: 680rpx;
  padding: 26rpx;
  border-radius: 30rpx;
  background-color: var(--em3d-card-bg);
  border: 2rpx solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.poster-preview-header {
  width: 100%;
  margin-bottom: 18rpx;
}

.poster-preview-title {
  font-size: 28rpx;
  font-weight: 660;
  color: var(--text-inverse);
  text-align: center;
}

.poster-canvas {
  border-radius: 22rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.34);
}

.poster-actions {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  width: 100%;
  margin-top: 26rpx;
}

.poster-btn {
  flex: 1;
  justify-content: center;
  padding: 20rpx 24rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 620;
}

.poster-btn.btn-cancel {
  background-color: var(--em3d-card-bg);
  color: var(--foreground);
  border: 2rpx solid rgba(255, 255, 255, 0.1);
}

.poster-btn.btn-save {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 2rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.share-modal-content.modal-dark,
.share-modal-content.modal-dark .favorite-btn,
.share-modal-content.modal-dark .option-item,
.share-modal-content.modal-dark .close-btn {
  background-color: var(--em3d-card-bg);
  border-color: rgba(255, 255, 255, 0.1);
}

.share-modal-content.modal-dark .option-icon {
  background: rgba(10, 132, 255, 0.14);
  border: 2rpx solid rgba(10, 132, 255, 0.18);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.share-modal-content.modal-dark .icon-wechat {
  background: rgba(10, 132, 255, 0.14);
}

.share-modal-content.modal-dark .icon-timeline {
  background: rgba(95, 170, 255, 0.16);
}

.share-modal-content.modal-dark .icon-poster {
  background: rgba(10, 132, 255, 0.18);
}

.share-modal-content.modal-dark .icon-copy {
  background: rgba(80, 120, 190, 0.16);
}

.close-btn:active,
.favorite-btn:active,
.option-item:active,
.poster-btn:active {
  transform: scale(0.97);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}

@keyframes pop {
  0% {
    transform: scale(1);
  }

  30% {
    transform: scale(1.14);
  }

  60% {
    transform: scale(0.92);
  }

  100% {
    transform: scale(1);
  }
}
</style>
