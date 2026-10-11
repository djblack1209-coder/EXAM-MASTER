<!--
  微信小程序隐私保护弹窗组件
  当 __usePrivacyCheck__ 开启后，微信会在调用隐私敏感 API 时触发 onNeedPrivacyAuthorization
  此组件响应该事件，展示隐私弹窗，用户点击同意后通过 agreePrivacyAuthorization 授权
-->
<template>
  <CustomModal
    v-if="showPopup"
    :visible="showPopup"
    position="bottom"
    :is-dark="theme.isDark"
    :title="t('privacy.title')"
    :show-actions="false"
    :mask-closable="false"
    :escape-closable="false"
  >
    <text>{{ t('privacy.before') }}</text
    ><BaseButton variant="quiet" @tap="openPrivacyContract">{{ privacyContractName }}</BaseButton
    ><text>{{ t('privacy.after') }}</text>
    <template #footer
      ><view class="privacy-actions"
        ><BaseButton id="reject-btn" variant="secondary" @tap="handleReject">{{ t('privacy.reject') }}</BaseButton
        ><BaseButton id="agree-btn" open-type="agreePrivacyAuthorization" @agreeprivacyauthorization="handleAgree">{{
          t('privacy.agree')
        }}</BaseButton></view
      ></template
    >
  </CustomModal>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { t } from '@/i18n/index.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import CustomModal from './CustomModal.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
const theme = useThemeStore();

const showPopup = ref(false);
const privacyContractName = ref(t('privacy.contract'));
let resolvePrivacyAuthorization = null;
let _privacyHandler = null;

// #ifdef MP-WEIXIN
onMounted(() => {
  if (typeof wx !== 'undefined' && wx.onNeedPrivacyAuthorization) {
    _privacyHandler = (resolve) => {
      resolvePrivacyAuthorization = resolve;
      // 获取隐私协议名称
      if (wx.getPrivacySetting) {
        wx.getPrivacySetting({
          success: (res) => {
            if (res.privacyContractName) {
              // R411: 微信 API 返回的名称可能自带书名号，先去除再统一包裹
              const rawName = res.privacyContractName.replace(/^《|》$/g, '');
              privacyContractName.value = `《${rawName}》`;
            }
          }
        });
      }
      showPopup.value = true;
    };
    wx.onNeedPrivacyAuthorization(_privacyHandler);
  }
});

onBeforeUnmount(() => {
  handleReject();
  if (typeof wx !== 'undefined' && wx.offNeedPrivacyAuthorization && _privacyHandler) {
    wx.offNeedPrivacyAuthorization(_privacyHandler);
    _privacyHandler = null;
  }
});
// #endif

function handleAgree() {
  showPopup.value = false;
  if (resolvePrivacyAuthorization) {
    resolvePrivacyAuthorization({ buttonId: 'agree-btn', event: 'agree' });
    resolvePrivacyAuthorization = null;
  }
}

function handleReject() {
  showPopup.value = false;
  if (resolvePrivacyAuthorization) {
    resolvePrivacyAuthorization({ buttonId: 'reject-btn', event: 'disagree' });
    resolvePrivacyAuthorization = null;
  }
}

function openPrivacyContract() {
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
</script>

<style scoped>
.privacy-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--s-3);
}
</style>
