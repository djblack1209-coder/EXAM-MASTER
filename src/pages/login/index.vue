<template>
  <view ref="root" class="login-container" :class="{ 'dark-mode': isDark }">
    <!-- 微信隐私保护弹窗 -->
    <PrivacyPopup />
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="bg-circle bg-circle-1" />
      <view class="bg-circle bg-circle-2" />
      <view class="bg-circle bg-circle-3" />
    </view>

    <!-- 顶部返回按钮 -->
    <view class="top-bar" :style="{ paddingTop: statusBarHeight + 'px', paddingRight: capsuleSafeRight + 'px' }">
      <button
        class="back-btn"
        role="button"
        tabindex="0"
        aria-label="返回上一页"
        hover-class="btn-hover"
        @tap="handleBack"
      >
        <BaseIcon name="arrow-left" :size="32" class="back-icon" />
      </button>
    </view>

    <!-- Logo区域 -->
    <view class="logo-section">
      <image class="login-logo-mark" :src="BRAND.icon" mode="aspectFit" :alt="BRAND.name" />
      <view class="app-name-row">
        <text class="brand-exam">{{ BRAND.name }}</text>
      </view>
    </view>

    <!-- 登录方式选择 -->
    <view class="login-methods">
      <!-- 微信登录 -->
      <!-- #ifdef MP-WEIXIN -->
      <button
        id="e2e-login-wechat-btn"
        role="button"
        tabindex="0"
        class="login-btn wechat-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        :disabled="isLoading"
        :aria-disabled="isLoading"
        @tap="handleWechatLogin"
      >
        <view class="btn-icon wechat-icon">
          <text>微信</text>
        </view>
        <text class="btn-text">
          {{ isLoading ? '登录中...' : '微信一键登录' }}
        </text>
        <BaseIcon name="arrow-right" :size="24" class="btn-arrow" />
      </button>
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <!-- 非微信小程序环境显示微信登录（App / 网页） -->
      <!-- #ifdef APP-PLUS -->
      <!-- E007: 仅在检测到微信 OAuth provider 时显示按钮 -->
      <button
        v-if="hasWechatProvider"
        role="button"
        tabindex="0"
        class="login-btn wechat-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        :disabled="isLoading"
        :aria-disabled="isLoading"
        @tap="handleWechatLogin"
      >
        <view class="btn-icon wechat-icon">
          <text>微信</text>
        </view>
        <text class="btn-text"> 微信一键登录 </text>
        <BaseIcon name="arrow-right" :size="24" class="btn-arrow" />
      </button>
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <!-- 同一按钮保留公众号授权，并接普通浏览器网站扫码。 -->
      <button
        role="button"
        tabindex="0"
        class="login-btn wechat-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        :disabled="isLoading"
        :aria-disabled="isLoading"
        @tap="handleWechatH5Login"
      >
        <view class="btn-icon wechat-icon">
          <text>微信</text>
        </view>
        <text class="btn-text">
          {{ isLoading ? '登录中...' : isWeChatBrowser ? '微信授权登录' : '微信扫码登录' }}
        </text>
        <BaseIcon name="arrow-right" :size="24" class="btn-arrow" />
      </button>
      <!-- #endif -->
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <button
        role="button"
        tabindex="0"
        class="login-btn qq-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        :disabled="isLoading"
        :aria-disabled="isLoading"
        @tap="handleQQLogin"
      >
        <view class="btn-icon qq-icon">
          <text>QQ</text>
        </view>
        <text class="btn-text">
          {{ isLoading ? '登录中...' : 'QQ快捷登录' }}
        </text>
        <BaseIcon name="arrow-right" :size="24" class="btn-arrow" />
      </button>
      <!-- #endif -->

      <!-- 分割线 -->
      <view class="divider">
        <view class="divider-line" />
        <text class="divider-text"> 或 </text>
        <view class="divider-line" />
      </view>

      <!-- 邮箱登录表单 -->
      <view v-if="showEmailForm" class="email-form">
        <view class="form-item">
          <text class="form-label"> 邮箱地址 </text>
          <input
            id="e2e-login-email"
            v-model="emailForm.email"
            class="form-input"
            type="text"
            placeholder="请输入邮箱地址"
            placeholder-class="input-placeholder"
            @input="validateEmail"
          />
          <text v-if="emailError" class="form-error">
            {{ emailError }}
          </text>
        </view>

        <view v-if="!isRegister" class="form-item">
          <text class="form-label"> 密码 </text>
          <view class="password-input-shell">
            <input
              id="e2e-login-password"
              v-model="emailForm.password"
              :class="['form-input', { 'form-input-password': !showLoginPassword }]"
              type="text"
              :password="!showLoginPassword"
              maxlength="32"
              placeholder="请输入密码"
              placeholder-class="input-placeholder"
            />
            <button
              id="e2e-login-toggle-password"
              role="button"
              tabindex="0"
              :aria-label="showLoginPassword ? '隐藏登录密码' : '显示登录密码'"
              class="password-toggle-btn"
              @tap="showLoginPassword = !showLoginPassword"
            >
              {{ showLoginPassword ? '隐藏' : '显示' }}
            </button>
          </view>
        </view>

        <view v-if="isRegister" class="form-item">
          <text class="form-label"> 验证码 </text>
          <view class="code-input-wrapper">
            <input
              id="e2e-login-code"
              v-model="emailForm.code"
              class="form-input code-input"
              type="number"
              placeholder="请输入验证码"
              placeholder-class="input-placeholder"
              maxlength="6"
            />
            <button
              id="e2e-login-send-code"
              role="button"
              tabindex="0"
              class="send-code-btn"
              hover-class="btn-hover"
              :class="{ disabled: isSendingCode || codeCooldown > 0 || !isEmailValid }"
              :disabled="isSendingCode || codeCooldown > 0 || !isEmailValid"
              :aria-disabled="isSendingCode || codeCooldown > 0 || !isEmailValid"
              @tap="sendVerifyCode"
            >
              <text>{{ isSendingCode ? '发送中...' : codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码' }}</text>
            </button>
          </view>
        </view>

        <view v-if="isRegister" class="form-item">
          <text class="form-label"> 设置密码 </text>
          <view class="password-input-shell">
            <input
              id="e2e-login-register-password"
              v-model="emailForm.password"
              :class="['form-input', { 'form-input-password': !showRegisterPassword }]"
              type="text"
              :password="!showRegisterPassword"
              maxlength="32"
              placeholder="请设置8-32位密码（含大小写字母和数字）"
              placeholder-class="input-placeholder"
            />
            <button
              id="e2e-login-toggle-register-password"
              role="button"
              tabindex="0"
              :aria-label="showRegisterPassword ? '隐藏注册密码' : '显示注册密码'"
              class="password-toggle-btn"
              @tap="showRegisterPassword = !showRegisterPassword"
            >
              {{ showRegisterPassword ? '隐藏' : '显示' }}
            </button>
          </view>
        </view>

        <button
          id="e2e-login-email-submit"
          role="button"
          tabindex="0"
          class="login-btn email-submit-btn"
          hover-class="btn-hover"
          :class="{ 'btn-disabled': isLoading || emailSubmitting }"
          :disabled="isLoading || emailSubmitting"
          :aria-disabled="isLoading || emailSubmitting"
          @tap="handleEmailLogin"
        >
          <text class="btn-text">
            {{ isLoading || emailSubmitting ? '登录中...' : isRegister ? '注册并登录' : '登录' }}
          </text>
        </button>

        <view class="form-switch">
          <button
            id="e2e-login-toggle-register"
            class="form-switch-btn"
            role="button"
            tabindex="0"
            @tap="toggleRegister"
          >
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </button>
        </view>
      </view>

      <!-- 邮箱登录入口 -->
      <button
        v-else
        id="e2e-login-email-entry"
        role="button"
        tabindex="0"
        class="login-btn email-btn"
        hover-class="btn-hover"
        @tap="openEmailForm"
      >
        <view class="btn-icon email-icon">
          <BaseIcon name="email" :size="36" />
        </view>
        <text class="btn-text"> 邮箱登录/注册 </text>
        <BaseIcon name="arrow-right" :size="24" class="btn-arrow" />
      </button>
    </view>

    <!-- 用户协议 -->
    <view class="agreement">
      <view
        id="e2e-login-agreement"
        class="checkbox-wrapper"
        role="checkbox"
        aria-label="同意隐私政策与用户协议"
        :aria-checked="agreedToTerms"
        tabindex="0"
        @tap="toggleAgreement"
        @keydown.enter="toggleAgreement"
        @keydown.space.prevent="toggleAgreement"
      >
        <view class="checkbox" :class="{ checked: agreedToTerms }">
          <BaseIcon v-if="agreedToTerms" name="check" :size="24" />
        </view>
      </view>
      <view class="agreement-text">
        <text>登录即表示同意</text>
        <button class="link" role="button" tabindex="0" @tap="openPrivacy">《隐私政策》</button>
        <text>和</text>
        <button class="link" role="button" tabindex="0" @tap="openTerms">《用户协议》</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { BRAND } from '@/config/brand.js';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { storageService } from '@/services/storageService.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { useUserStore } from '@/stores/modules/user';
import { useAuthStore } from '@/stores/modules/auth';

// 初始化认证 Store
const authStore = useAuthStore();
import config from '@/config/index.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import { getRetryCooldownSeconds, normalizeEmailAddress, resolveEmailAuthErrorMessage } from './email-auth-utils.js';
import { beginWebOAuth, loginNativeWechat, loginNativeQQ } from './oauth-utils.js';
import { isDesktopRuntime } from '@/services/desktop/runtime.js';
import { loginDesktopOAuth } from '@/services/desktop/oauth.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
// 静态资源 CDN 映射（大图已迁出主包）

// 主题状态
const isDark = ref(false);
const root = ref(null);
let releaseKeyboard = () => undefined;
const statusBarHeight = ref(44);
const capsuleSafeRight = ref(20);

// 登录状态
const isLoading = ref(false);
let loginPageActive = true;
let loginPageVersion = 0;
let nativeLoginRedirectTimer;
const nativeLoginContext = () => {
  const account = { userId: getUserId(), token: getToken(), version: loginPageVersion };
  return () =>
    loginPageActive &&
    account.version === loginPageVersion &&
    account.userId === getUserId() &&
    account.token === getToken();
};
onShow(() => {
  loginPageActive = true;
});
onHide(() => {
  loginPageActive = false;
  loginPageVersion++;
  clearTimeout(nativeLoginRedirectTimer);
});
// 邮箱登录提交锁（响应式 ref，驱动按钮 disabled 样式，阻止并行点击）
const emailSubmitting = ref(false);
let lastEmailSubmitAt = 0;
const EMAIL_SUBMIT_COOLDOWN_MS = 2500;
const agreedToTerms = ref(false);
// E007: 检测微信 OAuth provider 是否可用（APP-PLUS）
const hasWechatProvider = ref(false);
// E007: 检测是否在微信内置浏览器中（H5）
const isWeChatBrowser = ref(false);

// 邮箱登录相关
const showEmailForm = ref(false);
const isRegister = ref(false);
const emailForm = ref({
  email: '',
  password: '',
  code: ''
});
const emailError = ref('');
const codeCooldown = ref(0);
const isSendingCode = ref(false);
const showLoginPassword = ref(false);
const showRegisterPassword = ref(false);
let cooldownTimer = null;

// 主题事件处理器（模块级声明，确保 onMounted/onUnmounted 都能访问）
let _themeHandler = null;

// 邮箱验证
const isEmailValid = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailForm.value.email);
});

// 验证邮箱格式
const validateEmail = () => {
  if (!emailForm.value.email) {
    emailError.value = '';
    return;
  }
  if (!isEmailValid.value) {
    emailError.value = '请输入有效的邮箱地址';
  } else {
    emailError.value = '';
  }
};

// 切换注册/登录模式
const toggleRegister = () => {
  isRegister.value = !isRegister.value;
  emailForm.value.code = '';
  showLoginPassword.value = false;
  showRegisterPassword.value = false;
};

const openEmailForm = () => {
  showEmailForm.value = true;
};

const enterCodeCooldownFallback = (seconds = 60) => {
  startCodeCooldown(seconds);
  toast.info('验证码请求状态不确定，请先检查邮箱', 2200);
};

const startCodeCooldown = (seconds) => {
  const nextCooldown = getRetryCooldownSeconds(seconds);

  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }

  codeCooldown.value = nextCooldown;
  cooldownTimer = setInterval(() => {
    codeCooldown.value -= 1;
    if (codeCooldown.value <= 0) {
      codeCooldown.value = 0;
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
};

// 发送验证码
const sendVerifyCode = async () => {
  if (isSendingCode.value || codeCooldown.value > 0 || !isEmailValid.value) return;

  try {
    isSendingCode.value = true;
    toast.loading('发送中...');

    const res = await authStore.sendEmailCode(normalizeEmailAddress(emailForm.value.email)).catch((err) => {
      logger.error('[Login] sendEmailCode Promise rejected:', err);
      return { code: -1, message: '网络请求失败' };
    });

    toast.hide();

    if (res && res.code === 0) {
      const cooldown = res?.retryAfter || 60;
      toast.success(res?.alreadySent ? '验证码已发送，请稍候查收' : '验证码已发送，请查收邮箱');
      startCodeCooldown(cooldown);
    } else {
      // 根据错误类型给出更友好的提示
      let errorMsg = res?.message || '发送失败';
      if (res?.message?.includes('频繁')) {
        errorMsg = '验证码可能已发送，请先检查邮箱';
        startCodeCooldown(res?.retryAfter || 60);
      } else if (res?.message?.includes('网络') || res?.message?.includes('超时')) {
        enterCodeCooldownFallback(res?.retryAfter || 60);
        return;
      } else if (res?.message?.includes('邮箱')) {
        errorMsg = '邮箱格式不正确';
      }
      toast.info(errorMsg);
    }
  } catch (error) {
    toast.hide();
    logger.error('[Login] 发送验证码失败:', error);
    enterCodeCooldownFallback(60);
  } finally {
    isSendingCode.value = false;
  }
};

// 切换协议同意状态
const toggleAgreement = () => {
  agreedToTerms.value = !agreedToTerms.value;
};

// 返回上一页
const handleBack = () => {
  safeNavigateBack();
};

// 微信登录
const handleWechatLogin = async () => {
  if (!agreedToTerms.value) {
    toast.info('请先同意用户协议');
    return;
  }

  if (isLoading.value) return;
  isLoading.value = true;

  try {
    toast.loading('登录中...');

    // #ifdef MP-WEIXIN
    const loginRes = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: resolve,
        fail: reject
      });
    }).catch((err) => {
      logger.error('[Login] uni.login failed:', err);
      throw new Error('获取登录凭证失败');
    });

    // 调用后端登录接口
    const res = await authStore
      .loginByWechat({
        code: loginRes.code
      })
      .catch((err) => {
        logger.error('[Login] authStore.loginByWechat failed:', err);
        return { code: -1, message: '登录请求失败' };
      });

    toast.hide();

    if (res && res.code === 0 && res.data) {
      // 保存用户信息
      saveLoginInfo(res.data);
      toast.success('登录成功');

      setTimeout(() => {
        navigateAfterLogin();
      }, 1500);
    } else {
      // 根据错误码给出更友好的提示
      let errorMsg = '登录失败，请重试';
      if (res?.errcode === 40029) {
        errorMsg = '登录凭证已过期，请重新点击登录';
      } else if (res?.errcode === 45011) {
        errorMsg = '登录请求过于频繁，请稍后再试';
      } else if (res?.errcode === -1) {
        errorMsg = '微信服务繁忙，请稍后再试';
      } else if (res?.code === 500) {
        errorMsg = '服务器繁忙，请稍后再试';
      } else if (res?.message) {
        errorMsg = res.message;
      }
      toast.info(errorMsg);
    }
    // #endif

    // #ifndef MP-WEIXIN
    // E007: APP-PLUS 环境使用微信 SDK 登录
    // #ifdef APP-PLUS
    if (!hasWechatProvider.value) {
      toast.hide();
      toast.info('当前设备不支持微信登录');
      return;
    }

    try {
      const isCurrent = nativeLoginContext();
      const res = await loginNativeWechat(uni, authStore.loginByWechat, isCurrent);
      if (!isCurrent()) throw new Error('页面或账户已变化，请重新登录');

      toast.hide();

      if (res && res.code === 0 && res.data) {
        if (!res.data.token || !(res.data.userId || res.data._id)) {
          throw new Error('登录结果不完整，请重新登录');
        }
        saveLoginInfo(res.data);
        toast.success('登录成功');
        const acceptedUserId = getUserId();
        const acceptedToken = getToken();
        const acceptedVersion = loginPageVersion;
        clearTimeout(nativeLoginRedirectTimer);
        nativeLoginRedirectTimer = setTimeout(() => {
          if (
            loginPageActive &&
            loginPageVersion === acceptedVersion &&
            getUserId() === acceptedUserId &&
            getToken() === acceptedToken
          ) {
            navigateAfterLogin();
          }
        }, 1500);
      } else {
        let errorMsg = '微信登录失败，请重试';
        if (res?.message) errorMsg = res.message;
        toast.info(errorMsg);
      }
    } catch (appWechatErr) {
      toast.hide();
      logger.warn('[Login] App微信登录未完成');
      if (loginPageActive) toast.info(appWechatErr.message || '微信登录失败，请重试');
    }
    // #endif

    // #ifndef APP-PLUS
    // H5 环境下微信浏览器走 OAuth 网页授权（由 handleWechatH5Login 处理）
    // 非微信浏览器提示
    toast.hide();
    toast.info('请在微信中打开或使用其他方式登录');
    // #endif
    // #endif
  } catch (error) {
    toast.hide();
    logger.error('[Login] 微信登录失败:', error);
    toast.info(error?.message || '登录失败，请重试');
  } finally {
    isLoading.value = false;
  }
};

// 微信内网页使用公众号，普通浏览器使用独立网站应用。
const handleWechatH5Login = async () => {
  if (!agreedToTerms.value) {
    toast.info('请先同意用户协议');
    return;
  }
  if (isLoading.value) return;
  isLoading.value = true;

  // #ifdef H5
  try {
    if (isDesktopRuntime()) {
      await handleDesktopLogin('wechat');
      isLoading.value = false;
      return;
    }
    const wechatMode = isWeChatBrowser.value ? 'h5' : 'website';
    const wxAppId = wechatMode === 'h5' ? config.wx.gzhAppId : config.wx.webAppId;
    if (!wxAppId) {
      toast.info(wechatMode === 'h5' ? '微信公众号未配置' : '微信网站应用未配置');
      isLoading.value = false;
      return;
    }

    location.href = beginWebOAuth('wechat', wxAppId, wechatMode === 'website' ? config.wx.webRedirectUri : '', {
      wechatMode
    });
  } catch (err) {
    logger.warn('[Login] 微信网页授权未发起');
    if (loginPageActive) toast.info(err?.message || '微信授权跳转失败');
    isLoading.value = false;
  }
  // #endif

  // #ifndef H5
  isLoading.value = false;
  // #endif
};

// QQ登录
const handleDesktopLogin = async (provider) => {
  const isCurrent = nativeLoginContext();
  const result = await loginDesktopOAuth(provider, authStore.desktopOAuth, isCurrent, () => {
    toast.info('请在系统浏览器完成授权，随后返回Yozi AI');
  });
  if (!isCurrent()) throw new Error('账户或页面已变化，请重新登录');
  saveLoginInfo(result.data);
  toast.success('登录成功');
  const acceptedUserId = getUserId();
  const acceptedToken = getToken();
  const acceptedVersion = loginPageVersion;
  clearTimeout(nativeLoginRedirectTimer);
  nativeLoginRedirectTimer = setTimeout(() => {
    if (
      loginPageActive &&
      loginPageVersion === acceptedVersion &&
      getUserId() === acceptedUserId &&
      getToken() === acceptedToken
    )
      navigateAfterLogin();
  }, 1500);
};

const handleQQLogin = async () => {
  if (!agreedToTerms.value) {
    toast.info('请先同意用户协议');
    return;
  }

  if (isLoading.value) return;
  isLoading.value = true;

  try {
    toast.loading('登录中...');

    // #ifdef MP-QQ
    // QQ小程序环境
    const loginRes = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'qq',
        success: resolve,
        fail: () => reject(new Error('QQ登录失败，请重试'))
      });
    });

    // 调用后端登录接口
    const res = await authStore.loginByQQ({
      code: loginRes.code,
      platform: 'mp-qq'
    });

    toast.hide();

    if (res.code === 0 && res.data) {
      saveLoginInfo(res.data);
      toast.success('登录成功');

      setTimeout(() => {
        navigateAfterLogin();
      }, 1500);
    } else {
      // 根据错误码给出更友好的提示
      let errorMsg = 'QQ登录失败，请重试';
      if (res.code === 500) {
        errorMsg = '服务器繁忙，请稍后再试';
      } else if (res.message) {
        errorMsg = res.message;
      }
      toast.info(errorMsg);
    }
    // #endif

    // #ifdef MP-WEIXIN
    // 微信小程序环境不支持QQ登录，提示用户使用其他方式
    toast.hide();
    modal.show({
      title: 'QQ登录',
      content: '微信小程序暂不支持QQ登录，请使用微信登录或邮箱登录',
      showCancel: false,
      confirmText: '知道了'
    });
    // #endif

    // #ifdef H5
    // H5环境：使用QQ OAuth网页授权
    toast.hide();

    if (isDesktopRuntime()) {
      await handleDesktopLogin('qq');
      return;
    }

    // QQ互联配置 — 从统一配置读取，支持环境变量覆盖
    const qqAppId = config.qq.appId;
    location.href = beginWebOAuth('qq', qqAppId, config.qq.redirectUri);
    // #endif

    // #ifdef APP-PLUS
    // App环境：SDK token 只用于服务端应用/身份校验。
    try {
      const isCurrent = nativeLoginContext();
      const res = await loginNativeQQ(uni, authStore.loginByQQ, isCurrent);
      if (!isCurrent()) throw new Error('页面或账户已变化，请重新登录');

      toast.hide();

      if (res && res.code === 0 && res.data) {
        if (!res.data.token || !(res.data.userId || res.data._id)) {
          throw new Error('登录结果不完整，请重新登录');
        }
        saveLoginInfo(res.data);
        toast.success('登录成功');
        const acceptedUserId = getUserId();
        const acceptedToken = getToken();
        const acceptedVersion = loginPageVersion;
        clearTimeout(nativeLoginRedirectTimer);
        nativeLoginRedirectTimer = setTimeout(() => {
          if (
            loginPageActive &&
            loginPageVersion === acceptedVersion &&
            getUserId() === acceptedUserId &&
            getToken() === acceptedToken
          ) {
            navigateAfterLogin();
          }
        }, 1500);
      } else {
        // 根据错误码给出更友好的提示
        let errorMsg = 'QQ登录失败，请重试';
        if (res?.code === 500) {
          errorMsg = '服务器繁忙，请稍后再试';
        } else if (res?.message) {
          errorMsg = res.message;
        }
        toast.info(errorMsg);
      }
    } catch (appError) {
      toast.hide();
      logger.warn('[Login] App QQ授权未完成');
      if (loginPageActive) toast.info(appError.message || 'QQ登录失败，请重试');
    }
    // #endif
  } catch (error) {
    toast.hide();
    logger.warn('[Login] QQ授权未完成');
    if (loginPageActive) toast.info(error?.message || '登录失败，请重试');
  } finally {
    isLoading.value = false;
  }
};

// 邮箱登录/注册
const handleEmailLogin = async () => {
  // 防重复点击：时间戳锁位于最顶部，使用纯 JS 变量保证同步可靠性
  const now = Date.now();
  if (now - lastEmailSubmitAt < EMAIL_SUBMIT_COOLDOWN_MS) return;
  lastEmailSubmitAt = now;

  if (emailSubmitting.value || isLoading.value) return;
  emailSubmitting.value = true;

  try {
    if (!agreedToTerms.value) {
      toast.info('请先同意用户协议');
      return;
    }

    // 表单验证
    if (!isEmailValid.value) {
      toast.info('请输入有效的邮箱地址');
      return;
    }

    // ✅ 问题清单修复：密码校验与后端统一（8-32 位）
    const password = (emailForm.value.password || '').trim();
    if (!password || password.length < 8) {
      toast.info('密码至少8位');
      return;
    }
    if (password.length > 32) {
      toast.info('密码不能超过32位');
      return;
    }

    // 注册时额外校验（密码强度仅注册时强制，避免锁死使用旧密码的已有用户）
    if (isRegister.value) {
      // ✅ M17: 密码强度检查（仅注册时）：需包含大写字母、小写字母和数字
      if (!/[A-Z]/.test(password)) {
        toast.info('密码需包含大写字母');
        return;
      }
      if (!/[a-z]/.test(password)) {
        toast.info('密码需包含小写字母');
        return;
      }
      if (!/\d/.test(password)) {
        toast.info('密码需包含数字');
        return;
      }

      if (!emailForm.value.code) {
        toast.info('请输入验证码');
        return;
      }

      if (emailForm.value.code.length !== 6) {
        toast.info('验证码为6位数字');
        return;
      }
    }

    if (isLoading.value) return;
    isLoading.value = true;

    try {
      toast.loading(isRegister.value ? '注册中...' : '登录中...');

      const res = await authStore
        .loginByEmail({
          email: normalizeEmailAddress(emailForm.value.email),
          password: emailForm.value.password,
          verifyCode: isRegister.value ? emailForm.value.code : undefined,
          isRegister: isRegister.value
        })
        .catch((err) => {
          logger.error('[Login] authStore.loginByEmail failed:', err);
          return { code: -1, message: '网络请求失败' };
        });

      toast.hide();

      if (res && res.code === 0 && res.data) {
        saveLoginInfo(res.data);
        toast.success(isRegister.value ? '注册成功' : '登录成功');

        // 清空表单
        emailForm.value = { email: '', password: '', code: '' };

        setTimeout(() => {
          navigateAfterLogin();
        }, 1500);
      } else {
        const errorMsg = resolveEmailAuthErrorMessage(res?.message, isRegister.value);
        if (res?.message?.includes('已注册') || res?.message?.includes('已存在')) {
          isRegister.value = false; // 自动切换到登录模式
        } else if (res?.message?.includes('不存在') || res?.message?.includes('未注册')) {
          isRegister.value = true; // 自动切换到注册模式
        }
        toast.info(errorMsg);
      }
    } catch (error) {
      toast.hide();
      logger.error('[Login] 邮箱登录失败:', error);
      toast.info('网络错误，请重试');
    } finally {
      isLoading.value = false;
    }
  } finally {
    emailSubmitting.value = false;
  }
};

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

  // ✅ 用户隔离：登录后迁移无前缀的旧数据到 u_${userId}_ 前缀
  storageService.migrateUserKeys();

  // ✅ FIX: 同步写入 Pinia store，避免 store 与 storage 不一致
  try {
    const userStore = useUserStore();
    userStore.setUserInfo?.(userInfo);
    if (data.token) {
      userStore.setToken?.(data.token);
    }
  } catch (_e) {
    // store 可能未初始化，忽略
  }

  // 通知其他页面登录状态变化
  uni.$emit('loginStatusChanged', true);
  uni.$emit('userInfoUpdated', userInfo);

  logger.log('[Login] 用户信息已保存');
};

// 登录成功后跳转
const navigateAfterLogin = () => {
  // 检查是否有需要返回的页面
  const redirectUrl = storageService.get('redirect_after_login');

  if (redirectUrl) {
    storageService.remove('redirect_after_login');
    // 安全修复：校验重定向 URL 必须是站内路径，防止开放重定向攻击
    if (typeof redirectUrl === 'string' && redirectUrl.startsWith('/pages/')) {
      uni.redirectTo({
        url: redirectUrl,
        fail: () => {
          uni.switchTab({ url: '/pages/index/index' });
        }
      });
    } else {
      uni.switchTab({ url: '/pages/index/index' });
    }
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
};

// 打开隐私政策
const openPrivacy = () => {
  safeNavigateTo('/pages/settings/privacy');
};

// 打开用户协议
const openTerms = () => {
  safeNavigateTo('/pages/settings/terms');
};

// 初始化
onMounted(() => {
  releaseKeyboard = bindLearningKeyboard(root.value);
  statusBarHeight.value = getStatusBarHeight();
  capsuleSafeRight.value = getCapsuleSafeRight();

  // 获取主题状态
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  // 监听主题变化（使用模块级变量，确保 onUnmounted 能正确移除）
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);

  // E007: 检测微信 OAuth provider 是否可用（APP-PLUS）
  // #ifdef APP-PLUS
  uni.getProvider({
    service: 'oauth',
    success: (res) => {
      const providers = res.provider || [];
      hasWechatProvider.value = providers.includes('weixin');
      logger.log('[Login] OAuth providers:', providers, 'hasWeChat:', hasWechatProvider.value);
    },
    fail: () => {
      hasWechatProvider.value = false;
    }
  });
  // #endif

  // E007: H5环境检测微信内置浏览器
  // #ifdef H5
  const ua = navigator.userAgent.toLowerCase();
  isWeChatBrowser.value = /micromessenger/i.test(ua);
  logger.log('[Login] H5环境检测:', { isWeChatBrowser: isWeChatBrowser.value });
  // #endif
});

// 清理事件监听和定时器
onUnmounted(() => {
  releaseKeyboard();
  loginPageActive = false;
  loginPageVersion++;
  clearTimeout(nativeLoginRedirectTimer);
  if (_themeHandler) {
    uni.$off('themeUpdate', _themeHandler);
    _themeHandler = null;
  }
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
});
</script>

<style lang="scss" scoped>
.login-container {
  font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  min-height: 100%;
  min-height: 100vh;
  background: var(--yozi-background);
  padding: 0 40rpx;
  position: relative;
  overflow: hidden;
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
  opacity: 0.18;
}

.bg-circle-1 {
  width: 400rpx;
  height: 400rpx;
  background: var(--brand-color);
  top: -100rpx;
  right: -100rpx;
}

.bg-circle-2 {
  width: 300rpx;
  height: 300rpx;
  background: var(--brand-hover, #65429e);
  bottom: 200rpx;
  left: -150rpx;
}

.bg-circle-3 {
  width: 200rpx;
  height: 200rpx;
  background: var(--brand-active, #573686);
  bottom: -50rpx;
  right: 100rpx;
}

/* 顶部栏 */
.top-bar {
  padding-bottom: 20rpx;
}

.back-btn {
  width: 80rpx;
  height: 80rpx;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--em3d-card-bg);
  border-radius: 50%;
  box-shadow: 0 4rpx 0 var(--em3d-border-shadow);
  border: 2rpx solid var(--em3d-border);
  transition: var(--em3d-ease-press);
}

.back-btn:active {
  transform: translateY(2rpx);
  box-shadow: 0 2rpx 0 var(--em3d-border-shadow);
}

.back-icon {
  font-size: 36rpx;
  color: var(--text-primary);
}

/* Logo区域 */
.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52rpx 0 62rpx;
}

/* 品牌标识 */
.login-logo-mark {
  width: 156rpx;
  height: 156rpx;
  margin: 0 auto 28rpx;
  display: block;
}

/* 品牌名 */
.app-name-row {
  display: flex;
  align-items: baseline;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  margin-bottom: 12rpx;
  letter-spacing: 1.5rpx;
}
.app-name-row > view + view {
  margin-left: 8rpx;
}

.brand-exam {
  font-size: 50rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.brand-master {
  font-size: 50rpx;
  font-weight: 800;
  color: var(--brand-color);
}

.app-name {
  font-size: 48rpx;
  font-weight: 800;
  color: #785bbc;
  margin-bottom: 12rpx;
  letter-spacing: 1.5px;
}

.proof-chip + .proof-chip {
  margin-left: 10rpx;
}

/* 登录方式 */
.login-methods {
  padding: 0 20rpx;
}

.login-btn {
  display: flex;
  align-items: center;
  padding: 32rpx 36rpx;
  background-color: var(--em3d-card-bg);
  border-radius: var(--em3d-radius-lg);
  margin-bottom: 24rpx;
  border: 2rpx solid var(--em3d-border);
  box-shadow: var(--yozi-shadow);
  transition: var(--em3d-ease-press);
  position: relative;
  overflow: hidden;
}

.login-btn:active {
  transform: translateY(3rpx);
  box-shadow: 0 1rpx 0 var(--em3d-border-shadow);
}

.btn-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--em3d-text-inv);
  border: none;
  box-shadow: 0 3rpx 0 rgba(0, 0, 0, 0.15);
}

.wechat-icon {
  background-color: var(--em3d-primary);
}

.qq-icon {
  background-color: var(--em3d-secondary);
}

.e2e-icon {
  background-color: var(--em3d-secondary);
}

.email-icon {
  background-color: var(--em3d-warning);
  font-size: 36rpx;
}

.demo-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  color: #332842;
  background: rgba(201, 177, 238, 0.32);
  box-shadow: inset 0 0 0 2rpx rgba(51, 40, 66, 0.08);
}

.btn-text {
  flex: 1;
  font-size: 32rpx;
  font-weight: 800;
  color: var(--em3d-text-1);
}

.btn-arrow {
  font-size: 32rpx;
  color: var(--em3d-text-3);
}

/* 分割线 */
.divider {
  display: flex;
  align-items: center;
  padding: 32rpx 0;
}

.divider-line {
  flex: 1;
  height: 2rpx;
  background: var(--em3d-border);
}

.divider-text {
  padding: 0 24rpx;
  font-size: 26rpx;
  color: var(--em3d-text-3);
}

/* 邮箱表单 */
.email-form {
  background-color: var(--em3d-card-bg);
  border-radius: var(--em3d-radius-lg);
  padding: 32rpx;
  box-shadow: 0 var(--em3d-depth-md) 0 var(--em3d-border-shadow);
  border: 2rpx solid var(--em3d-border);
}

.form-item {
  margin-bottom: 28rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: var(--text-sub);
  margin-bottom: 16rpx;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background-color: var(--em3d-card-bg);
  border-radius: var(--em3d-radius-md);
  padding: 0 24rpx;
  font-size: 30rpx;
  color: var(--em3d-text-1);
  box-sizing: border-box;
  border: 2rpx solid var(--em3d-border);
  box-shadow: inset 0 2rpx 4rpx var(--em3d-inset);
  transition: var(--em3d-ease-smooth);
}

.form-input:focus {
  border-color: var(--em3d-primary);
  box-shadow:
    inset 0 2rpx 4rpx var(--em3d-inset),
    0 0 0 6rpx var(--em3d-primary-light);
}

.form-input-password {
  -webkit-text-security: disc;
  padding-right: 110rpx;
}

.form-input-password::-ms-reveal,
.form-input-password::-ms-clear {
  display: none;
}

.input-placeholder {
  color: var(--text-tertiary);
}

.form-error {
  font-size: 24rpx;
  color: var(--danger);
  margin-top: 8rpx;
}

.code-input-wrapper {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}

.password-input-shell {
  position: relative;
}

.password-toggle-btn {
  position: absolute;
  top: 50%;
  right: 24rpx;
  transform: translateY(-50%);
  min-width: 56rpx;
  text-align: center;
  font-size: 24rpx;
  font-weight: 700;
  color: #785bbc;
}

.dark-mode .password-toggle-btn {
  color: var(--info-blue);
}

.code-input {
  flex: 1;
}

.send-code-btn {
  min-width: 180rpx;
  height: 88rpx;
  background: #785bbc;
  color: #ffffff;
  border: none;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
  box-shadow: 0 6rpx 0 #46a302;
}

.send-code-btn:active {
  transform: translateY(3rpx);
  box-shadow: 0 3rpx 0 #46a302;
}

.send-code-btn text {
  font-size: 26rpx;
  color: inherit;
  font-weight: 500;
}

.send-code-btn.disabled {
  background: var(--bg-tertiary);
}

.email-submit-btn {
  background: #785bbc;
  color: #ffffff;
  border: none;
  box-shadow: 0 8rpx 0 #46a302;
  justify-content: center;
  margin-top: 16rpx;
}

.email-submit-btn:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #46a302;
}

.email-submit-btn .btn-text {
  color: inherit;
  flex: none;
}

.login-demo-entry {
  display: flex;
  align-items: center;
  padding: 26rpx 28rpx;
  margin-top: 4rpx;
  margin-bottom: 18rpx;
  border-radius: var(--em3d-radius-lg);
  background: linear-gradient(135deg, rgba(201, 177, 238, 0.26), rgba(255, 255, 255, 0.94));
  border: 2rpx solid rgba(51, 40, 66, 0.1);
  box-shadow: 0 var(--em3d-depth-sm) 0 rgba(51, 40, 66, 0.12);
}

.login-demo-entry:active {
  transform: translateY(3rpx);
  box-shadow: 0 var(--em3d-depth-press) 0 rgba(51, 40, 66, 0.12);
}

.demo-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.demo-title {
  font-size: 30rpx;
  font-weight: 800;
  color: #332842;
}

.demo-subtitle {
  margin-top: 6rpx;
  font-size: 23rpx;
  line-height: 1.35;
  color: #62576d;
}

.form-switch {
  text-align: center;
  padding-top: 24rpx;
}

.form-switch text {
  font-size: 26rpx;
  color: #785bbc;
}

/* 用户协议 */
.agreement {
  display: flex;
  align-items: flex-start;
  padding: 40rpx 20rpx;
  background-color: var(--em3d-card-bg);
  border-radius: var(--em3d-radius-lg);
  margin: 0 20rpx;
  border: 2rpx solid var(--em3d-border);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.checkbox-wrapper {
  padding: 4rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid var(--em3d-border);
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
  background-color: var(--em3d-card-bg);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
  transition: var(--em3d-ease-bounce);
}

.checkbox.checked {
  background: var(--em3d-primary);
  border-color: var(--em3d-primary-shadow);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-primary-shadow);
}

.checkbox text {
  font-size: 24rpx;
  color: var(--em3d-text-inv);
}

.agreement-text {
  flex: 1;
  font-size: 24rpx;
  color: #afafaf;
  line-height: 1.6;
}

.agreement-text .link {
  color: #785bbc;
}

/* 底部提示 */
.footer-tip {
  text-align: center;
  padding: 40rpx 0 80rpx;
}

.footer-tip text {
  font-size: 24rpx;
  color: var(--text-tertiary);
  background-color: var(--em3d-card-bg);
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--em3d-border);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

/* Hover feedback for mini program */
.btn-hover {
  opacity: 0.8;
  transform: scale(0.98);
}

/* Disabled state */
.btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Checkbox touch target — 最小点击区域 44px（88rpx） */
.checkbox-wrapper {
  min-height: 88rpx;
  min-width: 88rpx;
  padding: 12rpx;
  margin: -8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 3D 立体风格统一调整 */
.login-container {
  background: var(--yozi-background);
  padding: 0 32rpx;
  color: var(--em3d-text-1);
}

.bg-circle {
  opacity: 0.58;
  filter: blur(18rpx);
}

.bg-circle-1 {
  background: radial-gradient(circle, rgba(120, 91, 188, 0.2) 0%, transparent 72%);
}

.bg-circle-2 {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.18) 0%, transparent 72%);
}

.bg-circle-3 {
  background: radial-gradient(circle, rgba(120, 91, 188, 0.12) 0%, transparent 72%);
}

.dark-mode .bg-circle-1 {
  background: radial-gradient(circle, rgba(120, 91, 188, 0.15) 0%, transparent 72%);
}

.dark-mode .bg-circle-2 {
  background: radial-gradient(circle, rgba(28, 176, 246, 0.12) 0%, transparent 72%);
}

.dark-mode .bg-circle-3 {
  background: radial-gradient(circle, rgba(120, 91, 188, 0.1) 0%, transparent 72%);
  opacity: 0.46;
}

.top-bar,
.logo-section,
.login-methods,
.agreement,
.footer-tip {
  position: relative;
  z-index: 1;
}

/* Existing login groups use frosted materials. */
.back-btn,
.logo-section,
.login-methods,
.login-btn:not(.email-submit-btn),
.agreement,
.footer-tip text,
.form-input {
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  box-shadow: 0 var(--em3d-depth-md) 0 var(--em3d-border-shadow);
}

.top-bar {
  padding-bottom: 24rpx;
}

.back-btn {
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.back-icon,
.btn-text {
  color: var(--em3d-text-1);
}

/* P1修复: 提交按钮白色文字不被通用.btn-text覆盖 */
.email-submit-btn .btn-text {
  color: var(--yozi-button-ink);
}

.logo-section {
  margin: 18rpx 12rpx 34rpx;
  padding: 36rpx 24rpx;
  border-radius: var(--em3d-radius-lg);
}

.app-name {
  font-size: 52rpx;
  color: #785bbc;
}

.form-switch text {
  color: #785bbc;
}

.dark-mode .form-switch text {
  color: var(--em3d-secondary);
}

.app-slogan,
.divider-text,
.form-label,
.agreement-text,
.footer-tip text,
.btn-arrow,
.input-placeholder {
  color: var(--em3d-text-2);
}

.login-methods {
  padding: 26rpx 20rpx 30rpx;
  border-radius: var(--em3d-radius-lg);
}

.login-btn:not(.email-submit-btn) {
  padding: 26rpx 28rpx;
  margin-bottom: 18rpx;
  box-shadow: 0 var(--em3d-depth-md) 0 var(--em3d-border-shadow);
}

.login-btn:active {
  transform: translateY(3rpx);
  box-shadow: 0 var(--em3d-depth-press) 0 var(--em3d-border-shadow);
}

/* Tactile primary action. */
.email-submit-btn {
  background: var(--yozi-button);
  color: var(--yozi-button-ink);
  border: none;
  box-shadow: var(--yozi-button-shadow);
  padding: 26rpx 28rpx;
  margin-bottom: 18rpx;
}

.email-submit-btn:active {
  transform: translateY(4rpx);
  box-shadow:
    inset 0 2px 4px rgba(30, 15, 65, 0.16),
    0 2px 0 var(--yozi-button-edge);
}

.btn-icon {
  width: 72rpx;
  height: 72rpx;
  color: var(--em3d-text-inv);
  background-color: var(--em3d-primary);
  border: none;
  box-shadow: 0 3rpx 0 rgba(0, 0, 0, 0.15);
}

.wechat-icon {
  background-color: var(--em3d-primary);
}

.qq-icon {
  background-color: var(--em3d-secondary);
  font-size: 24rpx;
  font-weight: 800;
}

.e2e-icon {
  background-color: var(--em3d-purple);
}

.email-icon {
  background-color: var(--em3d-warning);
}

.dark-mode .wechat-icon,
.dark-mode .qq-icon,
.dark-mode .e2e-icon,
.dark-mode .email-icon,
.dark-mode .demo-icon {
  color: var(--em3d-text-inv);
}

.dark-mode .login-demo-entry {
  background: rgba(34, 48, 34, 0.92);
  border-color: var(--em3d-border);
}

.dark-mode .demo-title {
  color: var(--em3d-text-1);
}

.dark-mode .demo-subtitle {
  color: var(--em3d-text-2);
}

.divider-line {
  background: var(--em3d-border);
}

.email-form {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.form-input {
  color: var(--em3d-text-1);
  box-shadow: inset 0 2rpx 4rpx var(--em3d-inset);
}

.form-error {
  color: var(--em3d-danger);
}

.send-code-btn.disabled {
  background-color: var(--em3d-bg);
  color: var(--em3d-text-3);
  border: 2rpx solid var(--em3d-border);
  box-shadow: none;
}

.agreement {
  margin: 0 12rpx;
  border-radius: var(--em3d-radius-lg);
}

.checkbox {
  background-color: var(--em3d-card-bg);
  border-color: var(--em3d-border);
}

.agreement-text .link {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.footer-tip {
  padding: 36rpx 0 84rpx;
}

.footer-tip text {
  display: inline-block;
}
.login-container .login-methods {
  background: var(--yozi-floating);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 0;
}
.login-container .logo-section,
.login-container .agreement,
.login-container .footer-tip text {
  background: transparent;
  border: 0;
  box-shadow: none;
}
.login-container .login-btn {
  min-height: 44px;
  border-radius: 12px;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}
.login-container button {
  font-family: inherit;
  line-height: 1.6;
  text-align: left;
}
.login-container button::after {
  border: 0;
}
.login-container button:focus-visible,
.login-container .checkbox-wrapper:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.login-container .back-btn {
  margin: 0;
  padding: 0;
}
.login-container .link,
.login-container .form-switch-btn,
.login-container .password-toggle-btn {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  margin: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--primary);
  font-size: inherit;
}
.login-container .form-switch-btn {
  font-size: 26rpx;
}
.login-container .password-toggle-btn {
  font-size: 24rpx;
}
.login-container .login-btn:active {
  transition-duration: 100ms;
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .login-container .login-methods {
    background: var(--yozi-solid);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .login-container .login-btn {
    transition: none !important;
    transform: none !important;
  }
}
</style>
