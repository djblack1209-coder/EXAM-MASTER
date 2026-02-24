<!--
  微信小程序隐私保护弹窗组件
  当 __usePrivacyCheck__ 开启后，微信会在调用隐私敏感 API 时触发 onNeedPrivacyAuthorization
  此组件响应该事件，展示隐私弹窗，用户点击同意后通过 agreePrivacyAuthorization 授权
-->
<template>
  <!-- #ifdef MP-WEIXIN -->
  <view v-if="showPopup" class="privacy-mask">
    <view class="privacy-dialog">
      <view class="privacy-title">
        用户隐私保护提示
      </view>
      <view class="privacy-content">
        <text>在使用当前小程序服务之前，请仔细阅读</text>
        <text class="privacy-link" @tap="openPrivacyContract">
          {{ privacyContractName }}
        </text>
        <text>。如你同意，请点击"同意"开始使用。</text>
      </view>
      <view class="privacy-actions">
        <button class="privacy-btn privacy-btn-reject" @tap="handleReject">
          拒绝
        </button>
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
      wx.onNeedPrivacyAuthorization((resolve) => {
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
      });
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
  background: rgba(0, 0, 0, 0.5);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.privacy-dialog {
  width: 560rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx 36rpx;
  box-sizing: border-box;
}

.privacy-title {
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 24rpx;
}

.privacy-content {
  font-size: 28rpx;
  color: #666;
  line-height: 1.7;
  margin-bottom: 36rpx;
  text-align: justify;
}

.privacy-link {
  color: #4e6ef2;
  font-weight: 500;
}

.privacy-actions {
  display: flex;
  gap: 20rpx;
}

.privacy-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 500;
  border: none;
  padding: 0;
  margin: 0;
}

.privacy-btn::after {
  border: none;
}

.privacy-btn-reject {
  background: #f5f5f5;
  color: #999;
}

.privacy-btn-agree {
  background: #07c160;
  color: #fff;
}
</style>
