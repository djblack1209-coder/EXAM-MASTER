<!--
  微信小程序隐私保护弹窗组件
  当 __usePrivacyCheck__ 开启后，微信会在调用隐私敏感 API 时触发 onNeedPrivacyAuthorization
  此组件响应该事件，展示隐私弹窗，用户点击同意后通过 agreePrivacyAuthorization 授权
-->
<template>
  <!-- #ifdef MP-WEIXIN -->
  <view v-if="showPopup" class="privacy-mask">
    <view class="privacy-dialog">
      <view class="privacy-handle" />
      <text class="privacy-eyebrow"> Privacy </text>
      <view class="privacy-title"> 用户隐私保护提示 </view>
      <view class="privacy-content">
        <text>在使用当前小程序服务之前，请仔细阅读</text>
        <text class="privacy-link" @tap="openPrivacyContract">
          {{ privacyContractName }}
        </text>
        <text>。如你同意，请点击"同意"开始使用。</text>
      </view>
      <view class="privacy-actions">
        <button class="privacy-btn privacy-btn-reject" @tap="handleReject">拒绝</button>
        <button
          class="privacy-btn privacy-btn-agree"
          open-type="agreePrivacyAuthorization"
          @agreeprivacyauthorization="handleAgree"
        >
          同意
        </button>
      </view>
    </view>
  </view>
  <!-- #endif -->
</template>

<script>
export default {
  name: 'PrivacyPopup',
  data() {
    return {
      showPopup: false,
      privacyContractName: '《用户隐私保护指引》',
      resolvePrivacyAuthorization: null
    };
  },
  // #ifdef MP-WEIXIN
  mounted() {
    if (wx.onNeedPrivacyAuthorization) {
      this._privacyHandler = (resolve) => {
        this.resolvePrivacyAuthorization = resolve;
        // 获取隐私协议名称
        if (wx.getPrivacySetting) {
          wx.getPrivacySetting({
            success: (res) => {
              if (res.privacyContractName) {
                this.privacyContractName = `《${res.privacyContractName}》`;
              }
            }
          });
        }
        this.showPopup = true;
      };
      wx.onNeedPrivacyAuthorization(this._privacyHandler);
    }
  },
  beforeUnmount() {
    if (wx.offNeedPrivacyAuthorization && this._privacyHandler) {
      wx.offNeedPrivacyAuthorization(this._privacyHandler);
      this._privacyHandler = null;
    }
  },
  // #endif
  methods: {
    handleAgree() {
      this.showPopup = false;
      if (this.resolvePrivacyAuthorization) {
        this.resolvePrivacyAuthorization({ buttonId: 'agree-btn', event: 'agree' });
        this.resolvePrivacyAuthorization = null;
      }
    },
    handleReject() {
      this.showPopup = false;
      if (this.resolvePrivacyAuthorization) {
        this.resolvePrivacyAuthorization({ buttonId: 'reject-btn', event: 'disagree' });
        this.resolvePrivacyAuthorization = null;
      }
    },
    openPrivacyContract() {
      // #ifdef MP-WEIXIN
      if (wx.openPrivacyContract) {
        wx.openPrivacyContract({
          fail: () => {
            // 降级：跳转到本地隐私政策页面
            uni.navigateTo({ url: '/pages/settings/privacy' });
          }
        });
      }
      // #endif
    }
  }
};
</script>

<style scoped>
.privacy-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(9, 18, 12, 0.32);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.privacy-dialog {
  width: 620rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 36rpx;
  padding: 18rpx 34rpx 30rpx;
  box-sizing: border-box;
  box-shadow: var(--apple-shadow-card);
}

.privacy-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}

.privacy-eyebrow {
  display: block;
  text-align: center;
  margin-bottom: 8rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-sub);
}

.privacy-title {
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 22rpx;
}

.privacy-content {
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.7;
  margin-bottom: 36rpx;
  text-align: left;
}

.privacy-link {
  color: #22873a;
  font-weight: 600;
}

.privacy-actions {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}
.privacy-actions > view + view,
.privacy-actions > text + text,
.privacy-actions > view + text,
.privacy-actions > text + view {
  margin-left: 20rpx;
}

.privacy-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  padding: 0;
  margin: 0;
}

.privacy-btn::after {
  border: none;
}

.privacy-btn-reject {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.74) 0%, rgba(241, 248, 243, 0.52) 100%);
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}

.privacy-btn-agree {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* 暗色模式适配 */
.dark-mode .privacy-mask {
  background: rgba(3, 8, 14, 0.52);
}

.dark-mode .privacy-dialog {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .privacy-handle {
  background: rgba(255, 255, 255, 0.16);
}

.dark-mode .privacy-eyebrow,
.dark-mode .privacy-content {
  color: rgba(255, 255, 255, 0.68);
}

.dark-mode .privacy-title {
  color: #ffffff;
}

.dark-mode .privacy-link {
  color: #7bc0ff;
}

.dark-mode .privacy-btn-reject {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
