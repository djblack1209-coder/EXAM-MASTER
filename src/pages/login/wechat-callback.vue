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
      <text class="loading-hint"> 请稍候，正在验证微信授权 </text>
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
      <view class="error-icon"> ✕ </view>
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
import { lafService } from '@/services/lafService.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

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
  };

  storageService.save('userInfo', userInfo);
  storageService.save('EXAM_TOKEN', data.token, true);
  storageService.save('EXAM_USER_ID', userInfo.uid, true);

  // ✅ 用户隔离：登录后迁移无前缀的旧数据到 u_${userId}_ 前缀
  storageService.migrateUserKeys();

  uni.$emit('loginStatusChanged', true);
  uni.$emit('userInfoUpdated', userInfo);

  logger.log('[WeChat-Callback] 用户信息已保存:', {
    uid: userInfo.uid,
    nickName: userInfo.nickName
  });
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
const handleWeChatCallback = async () => {
  try {
    // #ifdef H5
    // 从 URL 获取授权码
    const urlParams = new URLSearchParams(options);
    let code = urlParams.get('code');
    const state = urlParams.get('state');

    // Hash 模式下参数可能在 hash 后面
    if (!code && options.hash) {
      const hashQuery = options.hash;
      if (hashQuery) {
        const hashParams = new URLSearchParams(hashQuery);
        code = hashParams.get('code');
      }
    }

    logger.log('[WeChat-Callback] URL参数:', { code: !!code, state });

    // 验证 state（防止 CSRF 攻击）
    const savedState = storageService.get('wx_oauth_state');
    // 清除保存的 state（无论验证是否通过，都应清除，防止重放）
    storageService.remove('wx_oauth_state');

    // 安全修复：savedState 为空时也应拒绝（防止绕过 CSRF 检查）
    if (!savedState || state !== savedState) {
      logger.warn('[WeChat-Callback] State验证失败:', {
        received: state,
        hasSaved: !!savedState
      });
      throw new Error('安全验证失败，请重新登录');
    }

    if (!code) {
      throw new Error('未获取到微信授权码');
    }

    // 调用后端接口完成登录
    const res = await lafService.login({
      type: 'wechat_h5',
      code: code
    });

    if (res.code === 0 && res.data) {
      saveLoginInfo(res.data);

      isLoading.value = false;
      loginSuccess.value = true;

      setTimeout(() => {
        navigateAfterLogin();
      }, 1500);
    } else {
      throw new Error(res.message || '微信登录失败');
    }
    // #endif

    // #ifndef H5
    uni.redirectTo({ url: '/pages/login/index' });
    // #endif
  } catch (error) {
    logger.error('[WeChat-Callback] 登录失败:', error);
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
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  handleWeChatCallback();
});
</script>

<style lang="scss" scoped>
.callback-container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8faf8 0%, #e8f5e9 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  position: relative;
  overflow: hidden;
}

.callback-container.dark-mode {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
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
  background: #07c160;
  top: -100rpx;
  right: -100rpx;
}

.bg-circle-2 {
  width: 300rpx;
  height: 300rpx;
  background: #06ad56;
  bottom: 200rpx;
  left: -150rpx;
}

.dark-mode .bg-circle-1,
.dark-mode .bg-circle-2 {
  background: #07c160;
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
  border-top-color: #07c160;
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
  color: #333;
}

.dark-mode .loading-text {
  color: #fff;
}

.loading-hint {
  font-size: 28rpx;
  color: #666;
}

.dark-mode .loading-hint {
  color: #aaa;
}

/* 成功状态 */
.success-icon {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: #fff;
}

.success-text {
  font-size: 36rpx;
  font-weight: 600;
  color: #07c160;
}

.success-hint {
  font-size: 28rpx;
  color: #666;
}

.dark-mode .success-hint {
  color: #aaa;
}

/* 错误状态 */
.error-icon {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: #fff;
}

.error-text {
  font-size: 36rpx;
  font-weight: 600;
  color: #ef4444;
}

.error-hint {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  max-width: 500rpx;
}

.dark-mode .error-hint {
  color: #aaa;
}

.retry-btn {
  margin-top: 40rpx;
  padding: 24rpx 80rpx;
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
}

.retry-btn text {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

.retry-btn:active {
  transform: scale(0.95);
  opacity: 0.9;
}
</style>
