<!-- REFACTOR: Modern invite modal with design system utilities -->
<template>
  <view class="modal-mask" :class="{ 'dark-mode': isDark }" @click.self="$emit('close')">
    <view class="modal-container ds-card" @tap.stop>
      <view class="close-btn ds-touchable ds-touch-target ds-flex-center" @click="$emit('close')">
        <text class="close-icon-text"> ✕ </text>
      </view>

      <view class="header-brand ds-flex-col ds-flex-center ds-gap-xs">
        <text class="brand-logo-text">
          <BaseIcon name="books" :size="48" />
        </text>
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
        <text class="wechat-icon-text">
          <BaseIcon name="comment" :size="32" />
        </text>
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

<script>
import { logger } from '@/utils/logger.js';
import config from '@/config';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: { BaseIcon },
  props: {
    inviteCode: {
      type: String,
      default: 'EXAM8888'
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'openPoster'],
  computed: {
    // 构造真实的 App 启动链接 (Schemes) 或 Web 链接
    inviteLink() {
      return `${config.deepLink.h5BaseUrl}/join?c=${this.inviteCode}`;
    },
    // 使用公开 API 动态生成二维码
    qrCodeUrl() {
      return `${config.externalCdn.qrServerBaseUrl}/create-qr-code/?size=150x150&data=${encodeURIComponent(this.inviteLink)}`;
    }
  },
  methods: {
    // 功能 2: 复制链接
    copyLink() {
      uni.setClipboardData({
        data: `考研神器 Exam-Master，我的邀请码是【${this.inviteCode}】，快来一起刷题！链接：${this.inviteLink}`,
        success: () => {
          uni.showToast({ title: '口令已复制', icon: 'none' });
        }
      });
    },
    // 功能 3: 分享
    shareToWechat() {
      // #ifdef MP-WEIXIN
      // 微信小程序环境：使用 wx.showShareMenu 或复制链接
      uni.showActionSheet({
        itemList: ['分享给好友', '复制邀请链接'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 触发页面分享
            // 注意：小程序需要在页面配置 onShareAppMessage
            uni.showToast({
              title: '请点击右上角"..."分享给好友',
              icon: 'none',
              duration: 2500
            });
          } else if (res.tapIndex === 1) {
            this.copyLink();
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
          href: this.inviteLink,
          title: 'Exam-Master 考研神器',
          summary: '输入我的邀请码 ' + this.inviteCode + ' 领取会员！',
          imageUrl: '/static/tabbar/practice-active.png',
          success: () => {
            uni.showToast({ title: '分享成功', icon: 'success' });
          },
          fail: (err) => {
            logger.log('分享失败:', err);
            // 降级到复制链接
            this.copyLink();
          }
        });
      } else {
        this.copyLink();
      }
      // #endif

      // #ifdef H5
      // H5 环境：使用 Web Share API 或复制链接
      if (navigator.share) {
        navigator
          .share({
            title: 'Exam-Master 考研神器',
            text: `输入我的邀请码【${this.inviteCode}】领取会员！`,
            url: this.inviteLink
          })
          .then(() => {
            uni.showToast({ title: '分享成功', icon: 'success' });
          })
          .catch(() => {
            this.copyLink();
          });
      } else {
        this.copyLink();
      }
      // #endif
    },
    // 功能 4: 打开海报生成
    openPoster() {
      this.$emit('openPoster');
    }
  }
};
</script>

<style lang="scss" scoped>
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
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
  width: 32px;
  height: 32px;
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
  color: #07c160;
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
  color: var(--ds-color-text-secondary, #666);
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Ticket Style */
.ticket-container {
  width: 100%;
  background-color: #07c160;
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
  color: white;
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
  color: var(--ds-color-text-tertiary, #999);
  font-weight: bold;
}

.brand-logo-text {
  font-size: 100rpx;
  margin-bottom: 8px;
  display: block;
}

.link-text {
  font-size: 24rpx;
  color: var(--ds-color-text-secondary, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-font-smoothing: antialiased;
}

.copy-btn {
  width: 70px;
  background-color: #07c160;
  color: white;
  border-radius: 0 20px 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 500;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;

  &:active {
    opacity: 0.85;
    background-color: #05a050;
  }
}

.wechat-btn {
  width: 100%;
  height: 44px;
  background-color: #07c160;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.85;
    transform: scale(0.98);
  }
}

.poster-btn {
  width: 100%;
  height: 44px;
  background-color: #ffd700;
  border: 1px solid #ffa500;
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
    background-color: #ffc107;
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
  color: white;
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
  color: var(--ds-color-text-tertiary, #999);
  margin-top: 4px;
  -webkit-font-smoothing: antialiased;
}

/* VISUAL: Dark mode styles */
.modal-mask.dark-mode {
  background: rgba(0, 0, 0, 0.8);

  .modal-container {
    background: var(--ds-color-surface-secondary, #1c1c1e);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .close-icon-text {
    color: #8e8e93;
  }

  .brand-name {
    color: var(--brand-color);
    /* Wise 绿色深色模式 */
  }

  .title {
    color: var(--ds-color-text-primary, var(--bg-card));
  }

  .subtitle {
    color: var(--ds-color-text-secondary, #8e8e93);
  }

  .ticket-container {
    background-color: var(--brand-color);
  }

  .ticket-inner {
    border-color: rgba(0, 0, 0, 0.3);
  }

  .code-label {
    color: #1c1c1e;
  }

  .code-desc {
    color: rgba(0, 0, 0, 0.7);
  }

  .link-box {
    background-color: #2c2c2e;
  }

  .link-text {
    color: #8e8e93;
  }

  .copy-btn {
    background-color: var(--brand-color);
    color: #1c1c1e;

    &:active {
      background-color: #8dd760;
    }
  }

  .qr-tip {
    color: #8e8e93;
  }

  .wechat-btn {
    background-color: var(--brand-color);
    box-shadow: 0 4px 12px rgba(159, 232, 112, 0.3);

    .btn-text {
      color: #1c1c1e;
    }

    &:active {
      background-color: #8dd760;
    }
  }

  .poster-btn {
    background-color: #ffa500;
    border-color: #ff8c00;
    box-shadow: 0 2px 8px rgba(255, 165, 0, 0.3);

    &:active {
      background-color: #ff8c00;
    }
  }
}
</style>
