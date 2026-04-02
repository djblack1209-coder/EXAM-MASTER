<template>
  <view class="callback-container" :class="{ 'dark-mode': isDark }">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="bg-circle bg-circle-1" />
      <view class="bg-circle bg-circle-2" />
    </view>

    <!-- 加载状态 -->
    <view v-if="isLoading" class="loading-section">
      <view class="loading-icon">
        <view class="spinner" />
      </view>
      <text class="loading-text"> 正在登录中... </text>
      <text class="loading-hint"> 请稍候，正在验证QQ授权 </text>
    </view>

    <!-- 成功状态 -->
    <view v-else-if="loginSuccess" class="success-section">
      <view class="success-icon">
        <BaseIcon name="success" :size="64" />
      </view>
      <text class="success-text"> 登录成功 </text>
      <text class="success-hint"> 即将跳转... </text>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="loginError" class="error-section">
      <view class="error-icon">
        <BaseIcon name="error" :size="64" />
      </view>
      <text class="error-text"> 登录失败 </text>
      <text class="error-hint">
        {{ errorMessage }}
      </text>
      <view class="retry-btn" @tap="handleRetry">
        <text>重新登录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import config from '@/config/index.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { useAuthStore } from '@/stores/modules/auth';

// 初始化认证 Store
const authStore = useAuthStore();

// 状态
const isDark = ref(false);
const isLoading = ref(true);
const loginSuccess = ref(false);
const loginError = ref(false);
const errorMessage = ref('');

// 保存登录信息
const saveLoginInfo = (data) => {
  const userInfo = {
    uid: data.userId || data._id,
    _id: data.userId || data._id,
    userId: data.userId || data._id,
    nickName: data.userInfo?.nickname || data.nickname || '考研人',
    avatarUrl: data.userInfo?.avatar_url || data.avatar_url || ''
    // ✅ B021-2: token 不再嵌入 userInfo，避免敏感数据冗余存储
  };

  // ✅ B021: 统一使用 storageService 保存敏感数据（自动加密）
  storageService.save('userInfo', userInfo);
  storageService.save('EXAM_TOKEN', data.token, true);
  storageService.save('EXAM_USER_ID', userInfo.uid, true);
  // ✅ B021-3: 移除明文 user_id 冗余存储，统一使用加密的 EXAM_USER_ID

  // ✅ 用户隔离：登录后迁移无前缀的旧数据到 u_${userId}_ 前缀
  storageService.migrateUserKeys();

  // 通知其他页面登录状态变化
  uni.$emit('loginStatusChanged', true);
  uni.$emit('userInfoUpdated', userInfo);

  logger.log('[QQ-Callback] 用户信息已保存:', { uid: userInfo.uid, nickName: userInfo.nickName });
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

// 处理QQ OAuth回调
const handleQQCallback = async () => {
  try {
    // #ifdef H5
    // 从URL获取授权码
    const urlParams = new URLSearchParams(options);
    let code = urlParams.get('code');
    let state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Hash 模式下参数可能存在于 hash 中
    if (!code && options.hash) {
      const hashQuery = options.hash;
      if (hashQuery) {
        const hashParams = new URLSearchParams(hashQuery);
        code = hashParams.get('code');
        state = state || hashParams.get('state');
      }
    }

    logger.log('[QQ-Callback] URL参数:', { code: !!code, state, error });

    // 检查是否有错误
    if (error) {
      throw new Error(errorDescription || '用户取消授权');
    }

    // 验证state（防止CSRF攻击）
    const savedState = storageService.get('qq_oauth_state');
    // 清除保存的state（无论验证是否通过，都应清除，防止重放）
    storageService.remove('qq_oauth_state');

    // 安全修复：savedState 为空时也应拒绝（防止绕过 CSRF 检查）
    if (!savedState || state !== savedState) {
      logger.warn('[QQ-Callback] State验证失败:', { received: state, hasSaved: !!savedState });
      throw new Error('安全验证失败，请重新登录');
    }

    if (!code) {
      throw new Error('未获取到授权码');
    }

    // 调用后端接口完成登录
    const callbackRedirectUri = config.qq.redirectUri || '';

    const res = await authStore.loginByQQH5({
      code,
      redirectUri: callbackRedirectUri
    });

    if (res.code === 0 && res.data) {
      // 登录成功
      saveLoginInfo(res.data);

      isLoading.value = false;
      loginSuccess.value = true;

      // 延迟跳转
      setTimeout(() => {
        navigateAfterLogin();
      }, 1500);
    } else {
      throw new Error(res.message || '登录失败');
    }
    // #endif

    // #ifndef H5
    // 非H5环境，直接返回登录页
    uni.redirectTo({ url: '/pages/login/index' });
    // #endif
  } catch (error) {
    logger.error('[QQ-Callback] 登录失败:', error);
    isLoading.value = false;
    loginError.value = true;
    errorMessage.value = error.message || '登录失败，请重试';
  }
};

// 重试登录
const handleRetry = () => {
  uni.redirectTo({ url: '/pages/login/index' });
};

// 初始化
onMounted(() => {
  // 获取主题状态
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  // 处理回调
  handleQQCallback();
});
</script>

<style lang="scss" scoped>
.callback-container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, var(--page-gradient-top) 0%, var(--page-gradient-bottom) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  position: relative;
  overflow: hidden;
}

.callback-container.dark-mode {
  background: linear-gradient(180deg, var(--page-gradient-top) 0%, var(--page-gradient-bottom) 100%);
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
  background: var(--info-blue);
  top: -100rpx;
  right: -100rpx;
}

.bg-circle-2 {
  width: 300rpx;
  height: 300rpx;
  background: var(--info-blue);
  bottom: 200rpx;
  left: -150rpx;
}

.dark-mode .bg-circle-1,
.dark-mode .bg-circle-2 {
  background: var(--info-blue);
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
  border: 6rpx solid rgba(18, 183, 245, 0.2);
  border-top-color: var(--info-blue);
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
  color: var(--text-primary);
}

.loading-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.dark-mode .loading-hint {
  color: var(--text-secondary);
}

/* 成功状态 */
.success-icon {
  width: 120rpx;
  height: 120rpx;
  background: var(--gradient-primary);
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
  color: var(--brand-color);
}

.success-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.dark-mode .success-hint {
  color: var(--text-secondary);
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
  color: var(--text-secondary);
}

.retry-btn {
  margin-top: 40rpx;
  padding: 24rpx 80rpx;
  background: linear-gradient(135deg, var(--info-blue) 0%, var(--info-blue) 100%);
  border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(18, 183, 245, 0.3);
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

/* Final polish: QQ callback page unified with Apple / Liquid Glass */
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
  background: radial-gradient(circle, rgba(107, 208, 150, 0.3) 0%, transparent 72%);
}

.bg-circle-2 {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.24) 0%, transparent 72%);
}

.dark-mode .bg-circle-1 {
  background: radial-gradient(circle, rgba(10, 132, 255, 0.24) 0%, transparent 72%);
}

.dark-mode .bg-circle-2 {
  background: radial-gradient(circle, rgba(95, 170, 255, 0.16) 0%, transparent 72%);
  opacity: 0.42;
}

.loading-section,
.success-section,
.error-section {
  width: 100%;
  max-width: 640rpx;
  padding: 40rpx 32rpx;
  border-radius: 36rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .loading-section,
.dark-mode .success-section,
.dark-mode .error-section {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.loading-icon,
.success-icon,
.error-icon {
  background: rgba(255, 255, 255, 0.7);
  border: 1rpx solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .loading-icon,
.dark-mode .success-icon,
.dark-mode .error-icon {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.spinner {
  border-color: rgba(52, 199, 89, 0.16);
  border-top-color: var(--success);
}

.dark-mode .spinner {
  border-color: rgba(10, 132, 255, 0.16);
  border-top-color: var(--primary);
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
</style>
