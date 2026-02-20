<!--
  海报弹窗组件 - 使用 Canvas 2D 新接口

  功能：
  1. 使用微信 Canvas 2D 接口生成高清海报
  2. 完善的权限检查与引导
  3. Loading 状态管理
  4. 支持保存到相册和分享

  @version 2.0.0
  @author Frontend Team
-->
<template>
  <view v-if="visible" class="poster-mask" :class="{ 'dark-mode': isDark }" @tap="handleClose">
    <view class="poster-card ds-card" @tap.stop>
      <view class="close-icon-container ds-touchable ds-touch-target ds-flex-center" @tap="handleClose">
        <image :src="icons8('ios-glyphs', 30, 'ffffff', 'multiply')" style="width: 16px; height: 16px" />
      </view>

      <view class="poster-bg" />

      <view class="poster-content ds-flex-col ds-flex-center">
        <view class="poster-header ds-flex ds-gap-xs">
          <image :src="icons8('ios-filled', 50, 'ffffff', 'open-book')" class="poster-logo" />
          <text class="poster-app-name ds-font-semibold"> Exam-Master </text>
        </view>

        <text class="poster-title ds-text-display ds-font-bold"> 考研备考神器 </text>
        <text class="poster-subtitle ds-text-sm"> AI助力，一战成硕！ </text>

        <view class="white-ticket">
          <view class="ticket-dashed-box">
            <text class="ticket-code">
              {{ inviteCode }}
            </text>
            <text class="ticket-label"> 我的邀请码 </text>
          </view>
        </view>

        <view class="qr-section">
          <view class="qr-circle">
            <image :src="qrCodeUrl || icons8('ios', 100, '000000', 'qr-code--v1')" class="qr-img" />
            <view class="qr-badge">
              <image :src="icons8('ios-filled', 50, '07C160', 'open-book')" style="width: 16px; height: 16px" />
            </view>
          </view>
          <text class="scan-text"> 扫码一起上岸 </text>
        </view>
      </view>
    </view>

    <!-- Canvas 2D 用于生成海报图片（隐藏） -->
    <canvas
      id="posterCanvas"
      type="2d"
      class="poster-canvas-hidden"
      :style="{ width: '750px', height: '1000px' }"
    ></canvas>

    <view class="bottom-actions">
      <view class="action-btn save-btn" :class="{ disabled: isGenerating }" @tap="handleSave">
        <text>{{ isGenerating ? '生成中...' : '保存到相册' }}</text>
      </view>
      <view class="action-btn share-btn" @tap="handleShare">
        <text>分享给好友</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue';
import { posterGenerator } from './poster-generator.js';
import { permissionHandler } from './utils/permission-handler.js';
import config from '@/config';
import { logger } from '@/utils/logger.js';

// icons8 图标 URL 生成器
const icons8 = (style, size, color, name) =>
  `${config.externalCdn.icons8BaseUrl}/${style}/${size}/${color}/${name}.png`;

// defineProps 和 defineEmits 是编译器宏，无需手动导入
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isDark: {
    type: Boolean,
    default: false
  },
  inviteCode: {
    type: String,
    default: 'EXAM2026'
  },
  qrCodeUrl: {
    type: String,
    default: ''
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  nickname: {
    type: String,
    default: '考研人'
  }
});

const emit = defineEmits(['update:visible', 'close', 'saved', 'shared']);

// 获取组件实例
const instance = getCurrentInstance();

// 状态
const isGenerating = ref(false);
const generatedPosterPath = ref('');

// 关闭弹窗
const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};

// 保存到相册
const handleSave = async () => {
  if (isGenerating.value) return;

  isGenerating.value = true;

  try {
    // 1. 生成海报图片
    uni.showLoading({ title: '海报生成中...', mask: true });

    const posterPath = await posterGenerator.generateInvitePoster(
      {
        inviteCode: props.inviteCode,
        qrCodeUrl: props.qrCodeUrl,
        avatarUrl: props.avatarUrl,
        nickname: props.nickname
      },
      'posterCanvas',
      instance?.proxy
    );

    uni.hideLoading();

    if (!posterPath) {
      uni.showToast({ title: '海报生成失败', icon: 'none' });
      return;
    }

    generatedPosterPath.value = posterPath;

    // 2. 保存到相册（带权限检查）
    const result = await permissionHandler.saveImageToAlbum(posterPath, {
      showLoading: true,
      loadingText: '保存中...',
      successText: '已保存到相册'
    });

    if (result.success) {
      emit('saved', posterPath);
    }
  } catch (error) {
    uni.hideLoading();
    logger.error('[PosterModal] 保存失败:', error);

    // 提供预览选项作为备选
    if (generatedPosterPath.value) {
      uni.showModal({
        title: '保存失败',
        content: '无法直接保存，是否预览图片后长按保存？',
        confirmText: '预览图片',
        success: (res) => {
          if (res.confirm) {
            uni.previewImage({
              urls: [generatedPosterPath.value],
              current: generatedPosterPath.value
            });
          }
        }
      });
    } else {
      uni.showToast({ title: '生成失败，请重试', icon: 'none' });
    }
  } finally {
    isGenerating.value = false;
  }
};

// 分享
const handleShare = () => {
  // #ifdef MP-WEIXIN
  uni.showActionSheet({
    itemList: ['分享给好友', '复制邀请信息'],
    success: (res) => {
      if (res.tapIndex === 0) {
        uni.showToast({
          title: '请点击右上角"..."分享',
          icon: 'none',
          duration: 2500
        });
      } else if (res.tapIndex === 1) {
        copyInviteInfo();
      }
    }
  });
  // #endif

  // #ifdef APP-PLUS
  if (typeof uni.share !== 'undefined') {
    uni.share({
      provider: 'weixin',
      scene: 'WXSceneSession',
      type: 5, // 小程序类型
      title: 'Exam-Master 考研神器',
      summary: `输入邀请码 ${props.inviteCode} 领取会员！`,
      imageUrl: '/static/tabbar/practice-active.png',
      success: () => {
        uni.showToast({ title: '分享成功', icon: 'success' });
        emit('shared');
      },
      fail: () => {
        copyInviteInfo();
      }
    });
  } else {
    copyInviteInfo();
  }
  // #endif

  // #ifdef H5
  if (navigator.share) {
    navigator
      .share({
        title: 'Exam-Master 考研神器',
        text: `输入邀请码 ${props.inviteCode} 领取会员！AI助力，一战成硕！`,
        url: `${config.deepLink.h5BaseUrl}/join?c=${props.inviteCode}`
      })
      .then(() => {
        emit('shared');
      })
      .catch(() => {
        copyInviteInfo();
      });
  } else {
    copyInviteInfo();
  }
  // #endif
};

// 复制邀请信息
const copyInviteInfo = () => {
  uni.setClipboardData({
    data: `【Exam-Master 考研神器】\n邀请码：${props.inviteCode}\nAI助力，一战成硕！\n下载链接：${config.deepLink.h5BaseUrl}/join?c=${props.inviteCode}`,
    success: () => {
      uni.showToast({ title: '邀请信息已复制', icon: 'success' });
    }
  });
};
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

/* 隐藏的 Canvas */
.poster-canvas-hidden {
  position: fixed;
  left: -9999px;
  top: -9999px;
  opacity: 0;
  pointer-events: none;
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
  background: linear-gradient(135deg, #07c160 0%, #0052d4 50%, #ffc107 100%);
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
  font-size: 32rpx;
  font-weight: 600;
  -webkit-font-smoothing: antialiased;
}

.poster-title {
  font-size: 64rpx;
  font-weight: 800;
  color: white;
  margin-bottom: 8px;
  letter-spacing: 2px;
  -webkit-font-smoothing: antialiased;
}

.poster-subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 30px;
  -webkit-font-smoothing: antialiased;
}

/* White Ticket */
.white-ticket {
  width: 260px;
  background-color: var(--bg-card);
  border-radius: 12px;
  padding: 10px 16px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.ticket-dashed-box {
  border: 2px dashed #07c160;
  border-radius: 8px;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ticket-code {
  font-size: 56rpx;
  font-weight: 800;
  color: #07c160;
  letter-spacing: 1px;
  -webkit-font-smoothing: antialiased;
}

.ticket-label {
  font-size: 24rpx;
  color: var(--text-sub);
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
  background-color: var(--bg-card);
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
  background-color: var(--bg-card);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.scan-text {
  color: white;
  font-size: 24rpx;
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
  font-size: 28rpx;
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  transition: all 0.2s ease;

  &:active {
    opacity: 0.85;
    transform: scale(0.98);
  }

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.save-btn {
  background-color: #07c160;
  color: white;
}

.share-btn {
  background-color: rgba(255, 255, 255, 0.9);
  color: #07c160;
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
    background-color: var(--bg-secondary);
  }

  .ticket-dashed-box {
    border-color: var(--brand-color);
  }

  .ticket-code {
    color: var(--brand-color);
  }

  /* 二维码圆圈保持白色 */
  .qr-circle {
    background-color: var(--bg-secondary);
  }

  /* 底部按钮 */
  .save-btn {
    background-color: var(--brand-color);
    color: #1c1c1e;

    &:active {
      background-color: #8dd760;
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
