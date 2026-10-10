<template>
  <view class="callback-container" :class="{ 'dark-mode': isDark }">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="bg-circle bg-circle-1" />
      <view class="bg-circle bg-circle-2" />
    </view>

    <!-- 加载状态 -->
    <view v-if="isLoading" class="loading-section" role="status" aria-live="polite">
      <view class="loading-icon">
        <view class="spinner" />
      </view>
      <text class="loading-text"> 正在登录中... </text>
      <text class="loading-hint"> 请稍候，正在验证微信授权 </text>
    </view>

    <!-- 成功状态 -->
    <view v-else-if="loginSuccess" class="success-section" role="status" aria-live="polite">
      <view class="success-icon">
        <BaseIcon name="success" :size="64" />
      </view>
      <text class="success-text"> {{ desktopCompleted ? '授权已完成' : '登录成功' }} </text>
      <text class="success-hint"> {{ desktopCompleted ? '请返回Yozi AI桌面应用继续学习' : '即将跳转...' }} </text>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="loginError" class="error-section" role="alert">
      <view class="error-icon">
        <BaseIcon name="error" :size="64" />
      </view>
      <text class="error-text"> 登录失败 </text>
      <text class="error-hint">
        {{ errorMessage }}
      </text>
      <view
        class="retry-btn"
        role="button"
        tabindex="0"
        @tap="handleRetry"
        @keydown.enter="handleRetry"
        @keydown.space.prevent="handleRetry"
      >
        <text>重新登录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { storageService } from '@/services/storageService.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
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
const saveLoginInfo = (data) => {
  if (!data.token || !(data.userId || data._id)) throw new Error('登录结果不完整，请重新登录');
  const userInfo = {
    uid: data.userId || data._id,
    _id: data.userId || data._id,
    userId: data.userId || data._id,
    nickName: data.userInfo?.nickname || data.nickname || '学习者',
    avatarUrl: data.userInfo?.avatar_url || data.avatar_url || ''
  };

  storageService.save('userInfo', userInfo);
  storageService.save('EXAM_TOKEN', data.token, true);
  storageService.save('EXAM_USER_ID', userInfo.uid, true);

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
      saveLoginInfo(res.data);

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
    errorMessage.value = error.message || '登录失败，请重试';
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

<style lang="scss" scoped>
.callback-container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  position: relative;
  overflow: hidden;
}

.callback-container.dark-mode {
  background: var(--background);
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
}

.bg-circle-1 {
  width: 400rpx;
  height: 400rpx;
  background: var(--success);
  top: -100rpx;
  right: -100rpx;
}

.bg-circle-2 {
  width: 300rpx;
  height: 300rpx;
  background: var(--success-dark);
  bottom: 200rpx;
  left: -150rpx;
}

.dark-mode .bg-circle-1,
.dark-mode .bg-circle-2 {
  background: var(--success);
  opacity: 0.05;
}

/* 加载状态 */
.loading-section,
.success-section,
.error-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 24rpx; -- replaced for Android WebView compat */
}

.loading-icon {
  width: 120rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 80rpx;
  height: 80rpx;
  border: 6rpx solid rgba(7, 193, 96, 0.2);
  border-top-color: var(--success);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-main);
}

.dark-mode .loading-text {
  color: var(--text-inverse);
}

.loading-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.dark-mode .loading-hint {
  color: var(--text-tertiary);
}

/* 成功状态 */
.success-icon {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, var(--success) 0%, var(--success-dark) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: var(--text-inverse);
}

.success-text {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--success);
}

.success-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.dark-mode .success-hint {
  color: var(--text-tertiary);
}

/* 错误状态 */
.error-icon {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, var(--danger) 0%, var(--danger) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: var(--text-inverse);
}

.error-text {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--danger);
}

.error-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
  text-align: center;
  max-width: 500rpx;
}

.dark-mode .error-hint {
  color: var(--text-tertiary);
}

.retry-btn {
  margin-top: 40rpx;
  padding: 24rpx 80rpx;
  background: linear-gradient(135deg, var(--success) 0%, var(--success-dark) 100%);
  border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
}

.retry-btn text {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-inverse);
}

.retry-btn:active {
  transform: scale(0.95);
  opacity: 0.9;
}

/* Final polish: WeChat callback page unified with Apple / Liquid Glass */
.callback-container {
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 52%,
    var(--page-gradient-bottom) 100%
  );
}

.callback-container.dark-mode {
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-bottom) 48%,
    var(--page-gradient-top) 100%
  );
}

.bg-circle {
  opacity: 0.56;
  filter: blur(18rpx);
}

.bg-circle-1 {
  background: radial-gradient(circle, rgba(122, 87, 179, 0.2) 0%, transparent 72%);
}

.bg-circle-2 {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.24) 0%, transparent 72%);
}

.dark-mode .bg-circle-1 {
  background: radial-gradient(circle, rgba(122, 87, 179, 0.24) 0%, transparent 72%);
}

.dark-mode .bg-circle-2 {
  background: radial-gradient(circle, rgba(194, 170, 237, 0.16) 0%, transparent 72%);
  opacity: 0.42;
}

.loading-section,
.success-section,
.error-section {
  width: 100%;
  max-width: 640rpx;
  padding: 40rpx 32rpx;
  border-radius: 36rpx;
  background-color: var(--em3d-card-bg);
  border: 1rpx solid var(--em3d-border);
  box-shadow: 0 var(--em3d-depth-md) 0 var(--em3d-border-shadow);
}

.dark-mode .loading-section,
.dark-mode .success-section,
.dark-mode .error-section {
  background-color: var(--em3d-card-bg);
  border-color: rgba(255, 255, 255, 0.1);
}

.loading-icon,
.success-icon,
.error-icon {
  background: rgba(255, 255, 255, 0.7);
  border: 1rpx solid rgba(255, 255, 255, 0.46);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.dark-mode .loading-icon,
.dark-mode .success-icon,
.dark-mode .error-icon {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.spinner {
  border-color: var(--em3d-primary-light);
  border-top-color: var(--brand-color);
}

.dark-mode .spinner {
  border-color: rgba(194, 170, 237, 0.16);
  border-top-color: var(--brand-color);
}

.loading-text,
.success-text,
.error-text {
  color: var(--text-main);
}

.dark-mode .loading-text,
.dark-mode .success-text,
.dark-mode .error-text {
  color: var(--text-primary);
}

.loading-hint,
.success-hint,
.error-hint {
  color: var(--text-sub);
}

.dark-mode .loading-hint,
.dark-mode .success-hint,
.dark-mode .error-hint {
  color: rgba(255, 255, 255, 0.68);
}

.retry-btn {
  background: var(--cta-primary-bg);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.retry-btn text {
  color: var(--cta-primary-text);
}

.retry-btn:focus-visible {
  outline: 3rpx solid var(--brand-color);
  outline-offset: 8rpx;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
  .retry-btn:active {
    transform: none;
  }
}
</style>
