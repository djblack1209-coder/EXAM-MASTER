<template>
  <view v-if="visible" class="quote-poster-modal" @tap="$emit('close')">
    <view class="quote-poster-content" @tap.stop>
      <view class="panel-handle" />
      <view class="poster-card" :class="{ 'poster-dark': isDark }">
        <view class="poster-decoration">
          <view class="poster-circle poster-circle-1" />
          <view class="poster-circle poster-circle-2" />
        </view>
        <view class="poster-body">
          <text class="poster-eyebrow"> Daily Quote </text>
          <text class="poster-quote"> "{{ quote }}" </text>
          <text class="poster-author"> —— {{ author }} </text>
          <view class="poster-date">
            <text class="poster-date-text">
              {{ currentDate }}
            </text>
          </view>
          <view class="poster-brand">
            <text class="brand-name"> Exam-Master </text>
            <text class="brand-slogan"> 考研路上，与你同行 </text>
          </view>
        </view>
      </view>
      <view class="poster-actions">
        <view class="poster-btn poster-btn-secondary" @tap="$emit('close')">
          <text>关闭</text>
        </view>
        <view class="poster-btn poster-btn-primary" @tap="$emit('save')">
          <text>保存图片</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'QuotePosterModal',
  props: {
    visible: { type: Boolean, default: false },
    quote: { type: String, default: '' },
    author: { type: String, default: '' },
    isDark: { type: Boolean, default: false }
  },
  emits: ['close', 'save'],
  computed: {
    currentDate() {
      const now = new Date();
      return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    }
  }
};
</script>

<style lang="scss" scoped>
.quote-poster-modal {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 30rpx 24rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
  background: rgba(9, 18, 12, 0.36);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.quote-poster-content {
  width: 100%;
  max-width: 720rpx;
}

.panel-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.34);
  margin: 0 auto 18rpx;
}

.poster-card {
  position: relative;
  overflow: hidden;
  padding: 58rpx 44rpx;
  border-radius: 34rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 42%),
    linear-gradient(160deg, rgba(245, 255, 248, 0.86) 0%, rgba(221, 242, 228, 0.68) 100%);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.poster-card.poster-dark {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: var(--apple-shadow-card);
}

.poster-decoration {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

.poster-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.24;
}

.poster-circle-1 {
  width: 300rpx;
  height: 300rpx;
  background: rgba(255, 255, 255, 0.8);
  top: -110rpx;
  right: -90rpx;
}

.poster-circle-2 {
  width: 220rpx;
  height: 220rpx;
  background: rgba(255, 255, 255, 0.4);
  bottom: -60rpx;
  left: -50rpx;
}

.poster-body,
.poster-brand {
  position: relative;
  z-index: 1;
}

.poster-eyebrow,
.poster-quote,
.poster-author,
.brand-name,
.brand-slogan {
  display: block;
  text-align: center;
}

.poster-eyebrow {
  margin-bottom: 18rpx;
  font-size: 20rpx;
  letter-spacing: 4rpx;
  text-transform: uppercase;
  color: rgba(19, 48, 28, 0.58);
}

.poster-dark .poster-eyebrow {
  color: rgba(255, 255, 255, 0.58);
}

.poster-quote {
  font-size: 36rpx;
  line-height: 1.8;
  font-weight: 650;
  color: #13301c;
}

.poster-dark .poster-quote {
  color: #ffffff;
}

.poster-author {
  margin-top: 26rpx;
  font-size: 26rpx;
  color: rgba(19, 48, 28, 0.72);
}

.poster-dark .poster-author {
  color: rgba(255, 255, 255, 0.78);
}

.poster-date {
  display: flex;
  justify-content: center;
  margin: 42rpx 0;
}

.poster-date-text {
  font-size: 22rpx;
  color: rgba(19, 48, 28, 0.66);
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.42);
}

.poster-dark .poster-date-text {
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.12);
}

.poster-brand {
  border-top: 1rpx solid rgba(255, 255, 255, 0.34);
  padding-top: 30rpx;
}

.brand-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #13301c;
}

.brand-slogan {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(19, 48, 28, 0.64);
}

.poster-dark .brand-name,
.poster-dark .brand-slogan {
  color: #ffffff;
}

.poster-actions {
  display: flex;
  /* gap: 14rpx; -- replaced for Android WebView compat */
margin-top: 24rpx;
}

.poster-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 620;
}

.poster-btn-secondary {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.72) 0%, rgba(241, 248, 243, 0.5) 100%);
  border: 1px solid rgba(255, 255, 255, 0.42);
  color: var(--text-main);
  box-shadow: var(--apple-shadow-surface);
}

.poster-btn-primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.poster-dark .poster-btn-primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
}

.poster-dark .poster-btn-secondary {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.poster-btn:active {
  transform: scale(0.97);
}
</style>
