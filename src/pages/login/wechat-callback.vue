<template>
  <view class="callback-container" :class="{ 'dark-mode': isDark, 'theme-light': !isDark }">
    <BaseCard class="callback-card">
      <BaseEmpty
        v-if="isLoading"
        state="loading"
        mascot-size="large"
        :title="t('login.verifying')"
        :desc="t('login.verifyingHelp')"
      />
      <view v-else-if="loginSuccess" class="callback-success" role="status" aria-live="polite">
        <YoziMascot pose="celebrate" play="once" size="large" />
        <text class="callback-title">{{ t(desktopCompleted ? 'login.authorized' : 'login.signedIn') }}</text>
        <text class="callback-hint">{{ t(desktopCompleted ? 'login.returnDesktop' : 'login.redirecting') }}</text>
      </view>
      <BaseEmpty
        v-else-if="loginError"
        state="error"
        mascot-size="large"
        :title="t('login.failed')"
        :desc="errorMessage === '安全验证失败或授权已过期，请重新登录' ? t('login.authorizationExpired') : errorMessage"
        show-button
        :button-text="t('login.signInAgain')"
        @action="handleRetry"
      />
    </BaseCard>
  </view>
</template>

<script setup>
import { assertSession } from '@/services/auth-storage.js';
import { ref, computed, onUnmounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { storageService } from '@/services/storageService.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { logger } from '@/utils/logger.js';
import './messages.js';
import { publicError, t } from '@/i18n/index.js';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import { useAuthStore } from '@/stores/modules/auth';
import { useThemeStore } from '@/stores/modules/theme.js';
import { consumeWebOAuth, consumeDesktopOAuth } from './oauth-utils.js';

// 初始化认证 Store
const authStore = useAuthStore();

// 状态
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);
const isLoading = ref(true);
const loginSuccess = ref(false);
const desktopCompleted = ref(false);
const loginError = ref(false);
const errorMessage = ref('');
let active = true;
let requestStarted = false;
let redirectTimer;

// 保存登录信息
const saveLoginInfo = async (data) => {
  if (!data.token || !(data.userId || data._id)) throw new Error('登录结果不完整，请重新登录');
  const userInfo = {
    uid: data.userId || data._id,
    _id: data.userId || data._id,
    userId: data.userId || data._id,
    nickName: data.userInfo?.nickname || data.nickname || '学习者',
    avatarUrl: data.userInfo?.avatar_url || data.avatar_url || ''
  };

  const session = await storageService.saveLoginSession({ userId: userInfo.uid, token: data.token, userInfo });
  assertSession(session);

  // ✅ 用户隔离：登录后迁移无前缀的旧数据到 u_${userId}_ 前缀
  storageService.migrateUserKeys();

  uni.$emit('loginStatusChanged', true);
  uni.$emit('userInfoUpdated', userInfo);
};

// 登录成功后跳转
const navigateAfterLogin = () => {
  const redirectUrl = storageService.get('redirect_after_login');

  if (redirectUrl) {
    storageService.remove('redirect_after_login');
    uni.redirectTo({
      url: redirectUrl,
      fail: () => {
        uni.switchTab({ url: '/pages/index/index' });
      }
    });
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
};

// 处理微信 OAuth 回调
const handleWeChatCallback = async (options = {}) => {
  if (requestStarted) return;
  requestStarted = true;
  const account = { userId: getUserId(), token: getToken() };
  try {
    // #ifdef H5
    const desktop = consumeDesktopOAuth('wechat', options);
    if (desktop) {
      const receipt = await authStore.desktopOAuth({ action: 'complete', provider: 'wechat', ...desktop });
      if (!active) return;
      if (receipt?.code !== 0 || receipt.data?.desktopReady !== true)
        throw new Error(receipt?.message || '桌面授权未完成，请重新登录');
      isLoading.value = false;
      desktopCompleted.value = true;
      loginSuccess.value = true;
      return;
    }
    const { code, wechatMode } = consumeWebOAuth('wechat', options);
    const res =
      wechatMode === 'website' ? await authStore.loginByWechatWeb(code) : await authStore.loginByWechatH5(code);
    if (!active) return;
    if (account.userId !== getUserId() || account.token !== getToken()) {
      throw new Error('账户已变化，请重新登录');
    }

    if (res.code === 0 && res.data) {
      await saveLoginInfo(res.data);

      isLoading.value = false;
      loginSuccess.value = true;

      redirectTimer = setTimeout(() => {
        navigateAfterLogin();
      }, 1500);
    } else {
      throw new Error(res.message || '微信登录失败');
    }
    return;
    // #endif

    // #ifndef H5
    uni.redirectTo({ url: '/pages/login/index' });
    // #endif
  } catch (error) {
    if (!active) return;
    logger.warn('[WeChat-Callback] 授权未完成');
    isLoading.value = false;
    loginError.value = true;
    errorMessage.value = publicError(error, t('login.retry'));
  }
};

// 重试登录
const handleRetry = () => {
  active = false;
  clearTimeout(redirectTimer);
  uni.redirectTo({ url: '/pages/login/index' });
};

onLoad(handleWeChatCallback);
onUnmounted(() => {
  active = false;
  clearTimeout(redirectTimer);
});
</script>

<style scoped>
.callback-container {
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--s-6);
  color: var(--ink);
  background: var(--canvas);
  font: var(--weight-regular) var(--size-body)/var(--leading-body) var(--font-ui);
}
.callback-card {
  width: 100%;
  max-width: calc(var(--dialog-width) + var(--s-14) * 3);
  background: transparent;
  border: 0;
  box-shadow: none;
}
.callback-card :deep(.base-state) {
  gap: var(--s-6);
  padding: var(--s-8) 0;
}
.callback-card :deep(.base-state__halo) {
  width: auto;
  height: auto;
}
.callback-card :deep(.base-state__title) {
  font-size: var(--size-title-1);
  line-height: var(--leading-title-1);
  text-wrap: balance;
}
.callback-card :deep(.base-state__description) {
  font-size: var(--size-body);
  line-height: var(--leading-body);
}
.callback-card :deep(.base-button) {
  min-width: 220px;
  min-height: var(--control-height);
  font-size: var(--size-body);
}
.callback-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-6);
  text-align: center;
  padding: var(--s-3);
}
.callback-title {
  font: var(--weight-ui-emphasis) var(--size-title-1)/var(--leading-title-1) var(--font-ui);
}
.callback-hint {
  color: var(--ink-3);
  font-size: var(--size-small);
  line-height: var(--leading-small);
}
@media (max-width: 767px) {
  .callback-card :deep(.yozi-mascot) {
    width: 200px;
    height: 200px;
  }
}
</style>
