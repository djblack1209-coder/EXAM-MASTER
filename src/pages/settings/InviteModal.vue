<!-- REFACTOR: Modern invite modal with design system utilities -->
<template>
  <view class="modal-mask" :class="{ 'dark-mode': isDark }" @click.self="$emit('close')">
    <view class="modal-container ds-card" @tap.stop>
      <view class="close-btn ds-touchable ds-touch-target ds-flex-center" @click="$emit('close')">
        <text class="close-icon-text">
          <BaseIcon name="close" :size="24" />
        </text>
      </view>

      <view class="header-brand ds-flex-col ds-flex-center ds-gap-xs">
        <!-- 品牌Logo -->
        <image
          class="brand-logo-img"
          src="/static/images/logo-full.png"
          mode="aspectFit"
          lazy-load
          alt="Exam Master 品牌标志"
        />
        <text class="brand-name ds-text-lg ds-font-bold"> Exam-Master </text>
      </view>
      <text class="title ds-text-xl ds-font-bold ds-text-primary"> 邀请好友，研途有你 </text>
      <text class="subtitle ds-text-sm ds-text-secondary"> 送TA一份备考神器，并肩作战，一战成硕！ </text>

      <view class="ticket-container">
        <view class="ticket-inner">
          <text class="code-label">
            {{ inviteCode }}
          </text>
          <text class="code-desc"> 我的邀请码 (真实可用) </text>
        </view>
      </view>

      <view class="link-row">
        <view class="link-box">
          <text class="link-icon-text">
            <BaseIcon name="link" :size="28" />
          </text>
          <text class="link-text">
            {{ inviteLink }}
          </text>
        </view>
        <view class="copy-btn" @click="copyLink">
          <text>复制</text>
        </view>
      </view>

      <view class="qr-preview">
        <image
          :src="qrCodeUrl || '/static/images/logo.png'"
          alt="Exam Master"
          mode="aspectFit"
          style="width: 100px; height: 100px"
          @error="
            (e) => {
              if (e.target) e.target.src = '/static/images/logo.png';
            }
          "
        />
        <text class="qr-tip"> 微信扫一扫，立刻加入 </text>
      </view>

      <view class="wechat-btn" @click="shareToWechat">
        <!-- 卡通分享图标装饰 -->
        <image
          class="feature-cartoon-icon"
          src="./static/icons/share-arrow.png"
          mode="aspectFit"
          style="width: 56rpx; height: 56rpx; margin-right: 8px"
        />
        <text class="btn-text"> 分享给微信好友 </text>
      </view>

      <view class="poster-btn" @click="openPoster">
        <text class="poster-icon-text">
          <BaseIcon name="image" :size="32" />
        </text>
        <text class="btn-text"> 生成分享海报 </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import config from '@/config';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
// 静态资源 CDN 映射（大图已迁出主包）
import { ASSETS } from '@/config/static-assets.js';

const props = defineProps({
  inviteCode: {
    type: String,
    default: 'EXAM8888'
  },
  isDark: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'openPoster']);

// 构造真实的 App 启动链接 (Schemes) 或 Web 链接
const inviteLink = computed(() => {
  return `${config.deepLink.h5BaseUrl}/join?c=${props.inviteCode}`;
});

// 使用公开 API 动态生成二维码
const qrCodeUrl = computed(() => {
  return `${config.externalCdn.qrServerBaseUrl}/create-qr-code/?size=150x150&data=${encodeURIComponent(inviteLink.value)}`;
});

// 功能 2: 复制链接
function copyLink() {
  uni.setClipboardData({
    data: `考研神器 Exam-Master，我的邀请码是【${props.inviteCode}】，快来一起刷题！链接：${inviteLink.value}`,
    success: () => {
      toast.info('口令已复制');
    }
  });
}

// 功能 3: 分享
function shareToWechat() {
  // #ifdef MP-WEIXIN
  // 微信小程序环境：使用 wx.showShareMenu 或复制链接
  uni.showActionSheet({
    itemList: ['分享给好友', '复制邀请链接'],
    success: (res) => {
      if (res.tapIndex === 0) {
        // 触发页面分享
        // 注意：小程序需要在页面配置 onShareAppMessage
        toast.info('请点击右上角"..."分享给好友', 2500);
      } else if (res.tapIndex === 1) {
        copyLink();
      }
    }
  });
  // #endif

  // #ifdef APP-PLUS
  // App 环境：使用 uni.share
  if (typeof uni.share !== 'undefined') {
    uni.share({
      provider: 'weixin',
      scene: 'WXSceneSession',
      type: 0,
      href: inviteLink.value,
      title: 'Exam-Master 考研神器',
      summary: '输入我的邀请码 ' + props.inviteCode + ' 领取会员！',
      imageUrl: ASSETS.appShareCover,
      success: () => {
        toast.success('分享成功');
      },
      fail: (err) => {
        logger.log('分享失败:', err);
        toast.info('分享失败，已复制邀请链接');
        // 降级到复制链接
        copyLink();
      }
    });
  } else {
    copyLink();
  }
  // #endif

  // #ifdef H5
  // H5 环境：使用 Web Share API 或复制链接
  if (navigator.share) {
    navigator
      .share({
        title: 'Exam-Master 考研神器',
        text: `输入我的邀请码【${props.inviteCode}】领取会员！`,
        url: inviteLink.value
      })
      .then(() => {
        toast.success('分享成功');
      })
      .catch(() => {
        toast.info('分享失败，已复制邀请链接');
        copyLink();
      });
  } else {
    copyLink();
  }
  // #endif
}

// 功能 4: 打开海报生成
function openPoster() {
  emit('openPoster');
}
</script>

<style lang="scss" scoped>
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mask-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-container {
  width: 320px;
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px 20px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.6;
  }
}

.header-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.brand-logo {
  width: 50px;
  height: 50px;
  margin-bottom: 8px;
}

.brand-name {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--success);
  -webkit-font-smoothing: antialiased;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-main);
  text-align: center;
  margin-bottom: 8px;
  -webkit-font-smoothing: antialiased;
}

.subtitle {
  font-size: 26rpx;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Ticket Style */
.ticket-container {
  width: 100%;
  background-color: var(--success);
  border-radius: 12px;
  padding: 8px;
  /* Outer spacing for dashed border */
  margin-bottom: 20px;
}

.ticket-inner {
  border: 2px dashed rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
}

.code-label {
  font-size: 64rpx;
  font-weight: 800;
  color: var(--text-inverse);
  letter-spacing: 1px;
  -webkit-font-smoothing: antialiased;
}

.code-desc {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 4px;
  -webkit-font-smoothing: antialiased;
}

/* Link Row */
.link-row {
  width: 100%;
  display: flex;
  margin-bottom: 20px;
}

.link-box {
  flex: 1;
  background-color: var(--bg-secondary);
  border-radius: 20px 0 0 20px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  height: 40px;
  min-width: 0;
}

.link-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  opacity: 0.5;
  flex-shrink: 0;
}

.link-icon-text {
  font-size: 32rpx;
  margin-right: 8px;
  opacity: 0.5;
  flex-shrink: 0;
}

.close-icon-text {
  font-size: 40rpx;
  color: var(--text-tertiary);
  font-weight: bold;
}

.brand-logo-text {
  font-size: 100rpx;
  margin-bottom: 8px;
  display: block;
}

/* 品牌Logo图片 */
.brand-logo-img {
  width: 80rpx;
  height: 80rpx;
}

.link-text {
  font-size: 24rpx;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-font-smoothing: antialiased;
}

.copy-btn {
  width: 70px;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-left: 1px solid var(--cta-primary-border);
  border-radius: 0 20px 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 500;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  box-shadow: var(--cta-primary-shadow);

  &:active {
    opacity: 0.85;
  }
}

.wechat-btn {
  width: 100%;
  height: 44px;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: var(--cta-primary-shadow);
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.85;
    transform: scale(0.98);
  }
}

.poster-btn {
  width: 100%;
  height: 44px;
  background-color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.9;
    transform: scale(0.98);
    background-color: var(--warning);
  }
}

.poster-icon-text {
  font-size: 40rpx;
  margin-right: 8px;
  flex-shrink: 0;
}

.poster-btn .btn-text {
  color: var(--text-main);
  font-weight: 600;
}

.wechat-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  flex-shrink: 0;
}

.wechat-icon-text {
  font-size: 48rpx;
  margin-right: 8px;
  flex-shrink: 0;
}

.btn-text {
  color: inherit;
  font-size: 30rpx;
  font-weight: 600;
  -webkit-font-smoothing: antialiased;
}

.qr-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.qr-tip {
  font-size: 20rpx;
  color: var(--text-tertiary);
  margin-top: 4px;
  -webkit-font-smoothing: antialiased;
}
/* 卡通图标通用样式 */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}

/* VISUAL: Dark mode styles */
.modal-mask.dark-mode {
  background: rgba(0, 0, 0, 0.8);

  .modal-container {
    background: var(--bg-secondary);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .close-icon-text {
    color: var(--text-tertiary);
  }

  .brand-name {
    color: var(--brand-color);
    /* Wise 绿色深色模式 */
  }

  .title {
    color: var(--ds-color-text-primary, var(--bg-card));
  }

  .subtitle {
    color: var(--text-secondary);
  }

  .ticket-container {
    background-color: var(--brand-color);
  }

  .ticket-inner {
    border-color: rgba(0, 0, 0, 0.3);
  }

  .code-label {
    color: var(--background);
  }

  .code-desc {
    color: rgba(0, 0, 0, 0.7);
  }

  .link-box {
    background-color: var(--bg-tertiary);
  }

  .link-text {
    color: var(--text-tertiary);
  }

  .copy-btn {
    background: var(--cta-primary-bg);
    color: var(--cta-primary-text);

    &:active {
      opacity: 0.85;
    }
  }

  .qr-tip {
    color: var(--text-tertiary);
  }

  .wechat-btn {
    background: var(--cta-primary-bg);
    box-shadow: var(--cta-primary-shadow);

    .btn-text {
      color: var(--cta-primary-text);
    }

    &:active {
      opacity: 0.85;
    }
  }

  .poster-btn {
    background-color: var(--warning);
    border-color: var(--warning);
    box-shadow: 0 2px 8px rgba(255, 165, 0, 0.3);

    &:active {
      background-color: var(--warning);
    }
  }
}
</style>
