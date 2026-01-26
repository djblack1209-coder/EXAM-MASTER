<!-- REFACTOR: Modern poster modal with design system utilities -->
<template>
  <view v-if="visible" class="poster-mask" :class="{ 'dark-mode': isDark }" @tap="handleClose">
    <view class="poster-card ds-card" @tap.stop>
      <view class="close-icon-container ds-touchable ds-touch-target ds-flex-center" @tap="handleClose">
        <image src="https://img.icons8.com/ios-glyphs/30/ffffff/multiply.png" style="width: 16px; height: 16px;">
        </image>
      </view>

      <view class="poster-bg"></view>

      <view class="poster-content ds-flex-col ds-flex-center">
        <view class="poster-header ds-flex ds-gap-xs">
          <image src="https://img.icons8.com/ios-filled/50/ffffff/open-book.png" class="poster-logo"></image>
          <text class="poster-app-name ds-font-semibold">Exam-Master</text>
        </view>

        <text class="poster-title ds-text-display ds-font-bold">考研备考神器</text>
        <text class="poster-subtitle ds-text-sm">AI助力，一战成硕！</text>

        <view class="white-ticket">
          <view class="ticket-dashed-box">
            <text class="ticket-code">EXAM2026</text>
            <text class="ticket-label">我的邀请码</text>
          </view>
        </view>

        <view class="qr-section">
          <view class="qr-circle">
            <image src="https://img.icons8.com/ios/100/000000/qr-code--v1.png" class="qr-img"></image>
            <view class="qr-badge">
              <image src="https://img.icons8.com/ios-filled/50/07C160/open-book.png" style="width:16px;height:16px;">
              </image>
            </view>
          </view>
          <text class="scan-text">扫码一起上岸</text>
        </view>
      </view>
    </view>

    <view class="bottom-actions">
      <view class="action-btn save-btn" @tap="handleSave">
        <text>保存到相册</text>
      </view>
      <view class="action-btn share-btn" @tap="handleShare">
        <text>分享给好友</text>
      </view>
    </view>
  </view>
</template>

<script setup>
// defineProps 和 defineEmits 是编译器宏，无需手动导入
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'close'])

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

const handleSave = () => {
  uni.showToast({
    title: '保存功能即将上线',
    icon: 'none'
  })
}

const handleShare = () => {
  uni.showToast({
    title: '分享功能即将上线',
    icon: 'none'
  })
}
</script>

<style lang="scss" scoped>
.poster-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
  box-sizing: border-box;
}

/* The Poster Card Size */
.poster-card {
  width: 320px;
  height: 520px;
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.close-icon-container {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 20;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  padding: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.7;
    background: rgba(0, 0, 0, 0.3);
  }
}

/* Rich Gradient Background */
.poster-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Reusing the "Fluid Wave" colors from splash screen */
  background: linear-gradient(135deg, #07C160 0%, #0052D4 50%, #FFC107 100%);
  z-index: 1;
}

.poster-content {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
  box-sizing: border-box;
}

.poster-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.poster-logo {
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.poster-app-name {
  color: white;
  font-size: 16px;
  font-weight: 600;
  -webkit-font-smoothing: antialiased;
}

.poster-title {
  font-size: 32px;
  font-weight: 800;
  color: white;
  margin-bottom: 8px;
  letter-spacing: 2px;
  -webkit-font-smoothing: antialiased;
}

.poster-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 30px;
  -webkit-font-smoothing: antialiased;
}

/* White Ticket */
.white-ticket {
  width: 260px;
  background-color: white;
  border-radius: 12px;
  padding: 10px 16px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.ticket-dashed-box {
  border: 2px dashed #07C160;
  border-radius: 8px;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ticket-code {
  font-size: 28px;
  font-weight: 800;
  color: #07C160;
  letter-spacing: 1px;
  -webkit-font-smoothing: antialiased;
}

.ticket-label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  -webkit-font-smoothing: antialiased;
}

/* QR Section */
.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-circle {
  width: 100px;
  height: 100px;
  background-color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 12px;
}

.qr-img {
  width: 70px;
  height: 70px;
  opacity: 0.8;
}

.qr-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  background-color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.scan-text {
  color: white;
  font-size: 12px;
  opacity: 0.9;
  -webkit-font-smoothing: antialiased;
}

/* Bottom Buttons */
.bottom-actions {
  width: 300px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.action-btn {
  flex: 1;
  height: 44px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;

  &:active {
    opacity: 0.85;
    transform: scale(0.98);
  }
}

.save-btn {
  background-color: #07C160;
  color: white;
}

.share-btn {
  background-color: rgba(255, 255, 255, 0.9);
  color: #07C160;
}

/* VISUAL: Dark mode styles */
.poster-mask.dark-mode {
  background: rgba(0, 0, 0, 0.9);

  .poster-card {
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  }

  /* 深色模式下渐变背景调整为更深的色调 */
  .poster-bg {
    background: linear-gradient(135deg, #05a050 0%, #003d99 50%, #e6a800 100%);
  }

  /* 票券在深色模式下使用浅色 */
  .white-ticket {
    background-color: #f5f5f5;
  }

  .ticket-dashed-box {
    border-color: var(--brand-color);
  }

  .ticket-code {
    color: var(--brand-color);
  }

  /* 二维码圆圈保持白色 */
  .qr-circle {
    background-color: #f5f5f5;
  }

  /* 底部按钮 */
  .save-btn {
    background-color: var(--brand-color);
    color: #1c1c1e;

    &:active {
      background-color: #8DD760;
    }
  }

  .share-btn {
    background-color: rgba(245, 245, 245, 0.95);
    color: #05a050;

    &:active {
      background-color: rgba(230, 230, 230, 0.95);
    }
  }
}
</style>
