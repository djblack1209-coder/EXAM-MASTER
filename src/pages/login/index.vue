<template>
  <view class="login-container" :class="{ 'dark-mode': isDark }">
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
      <view class="back-btn" hover-class="btn-hover" @tap="handleBack">
        <text class="back-icon"> ← </text>
      </view>
    </view>

    <!-- Logo区域 -->
    <view class="logo-section">
      <image class="app-logo" src="./static/logo.png" mode="aspectFit" />
      <text class="app-name"> Exam-Master </text>
      <text class="app-slogan"> 智能助力，一战成硕 </text>
    </view>

    <!-- 登录方式选择 -->
    <view class="login-methods">
      <!-- 微信登录 -->
      <!-- #ifdef MP-WEIXIN -->
      <view
        id="e2e-login-wechat-btn"
        class="login-btn wechat-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        @tap="handleWechatLogin"
      >
        <view class="btn-icon wechat-icon">
          <text>微信</text>
        </view>
        <text class="btn-text">
          {{ isLoading ? '登录中...' : '微信一键登录' }}
        </text>
        <text class="btn-arrow"> → </text>
      </view>
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <!-- 非微信小程序环境显示微信登录（App / H5微信浏览器） -->
      <!-- #ifdef APP-PLUS -->
      <!-- E007: 仅在检测到微信 OAuth provider 时显示按钮 -->
      <view
        v-if="hasWechatProvider"
        class="login-btn wechat-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        @tap="handleWechatLogin"
      >
        <view class="btn-icon wechat-icon">
          <text>微信</text>
        </view>
        <text class="btn-text"> 微信一键登录 </text>
        <text class="btn-arrow"> → </text>
      </view>
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <!-- E007: H5微信浏览器内显示微信登录按钮 -->
      <view
        v-if="isWeChatBrowser"
        class="login-btn wechat-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        @tap="handleWechatH5Login"
      >
        <view class="btn-icon wechat-icon">
          <text>微信</text>
        </view>
        <text class="btn-text">
          {{ isLoading ? '登录中...' : '微信授权登录' }}
        </text>
        <text class="btn-arrow"> → </text>
      </view>
      <!-- #endif -->
      <!-- #endif -->

      <view
        v-if="isE2EMode"
        id="e2e-login-mock-btn"
        class="login-btn e2e-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        @tap="handleE2EMockLogin"
      >
        <view class="btn-icon e2e-icon">
          <text>E2E</text>
        </view>
        <text class="btn-text"> 测试一键登录 </text>
        <text class="btn-arrow"> → </text>
      </view>

      <!-- #ifndef MP-WEIXIN -->
      <view
        class="login-btn qq-btn"
        hover-class="btn-hover"
        :class="{ 'btn-disabled': isLoading }"
        @tap="handleQQLogin"
      >
        <view class="btn-icon qq-icon">
          <text>QQ</text>
        </view>
        <text class="btn-text">
          {{ isLoading ? '登录中...' : 'QQ快捷登录' }}
        </text>
        <text class="btn-arrow"> → </text>
      </view>
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
            <text
              id="e2e-login-toggle-password"
              class="password-toggle-btn"
              @tap="showLoginPassword = !showLoginPassword"
            >
              {{ showLoginPassword ? '隐藏' : '显示' }}
            </text>
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
            <view
              id="e2e-login-send-code"
              class="send-code-btn"
              hover-class="btn-hover"
              :class="{ disabled: isSendingCode || codeCooldown > 0 || !isEmailValid }"
              @tap="sendVerifyCode"
            >
              <text>{{ isSendingCode ? '发送中...' : codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码' }}</text>
            </view>
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
            <text
              id="e2e-login-toggle-register-password"
              class="password-toggle-btn"
              @tap="showRegisterPassword = !showRegisterPassword"
            >
              {{ showRegisterPassword ? '隐藏' : '显示' }}
            </text>
          </view>
        </view>

        <view
          id="e2e-login-email-submit"
          class="login-btn email-submit-btn"
          hover-class="btn-hover"
          :class="{ 'btn-disabled': isLoading }"
          @tap="handleEmailLogin"
        >
          <text class="btn-text">
            {{ isLoading ? '登录中...' : isRegister ? '注册并登录' : '登录' }}
          </text>
        </view>

        <view class="form-switch">
          <text id="e2e-login-toggle-register" @tap="toggleRegister">
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </text>
        </view>
      </view>

      <!-- 邮箱登录入口 -->
      <view
        v-else
        class="login-btn email-btn"
        hover-class="btn-hover"
        @tap="showEmailForm = true"
        @click="showEmailForm = true"
      >
        <view class="btn-icon email-icon">
          <BaseIcon name="email" :size="36" />
        </view>
        <text class="btn-text"> 邮箱登录/注册 </text>
        <text class="btn-arrow"> → </text>
      </view>
    </view>

    <!-- 用户协议 -->
    <view class="agreement">
      <view id="e2e-login-agreement" class="checkbox-wrapper" @tap="toggleAgreement">
        <view class="checkbox" :class="{ checked: agreedToTerms }">
          <BaseIcon v-if="agreedToTerms" name="check" :size="24" />
        </view>
      </view>
      <text class="agreement-text">
        登录即表示同意
        <text class="link" @tap="openPrivacy"> 《隐私政策》 </text>
        和
        <text class="link" @tap="openTerms"> 《用户协议》 </text>
      </text>
    </view>

    <!-- 底部提示 -->
    <view class="footer-tip">
      <text>首次登录将自动创建账号</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { lafService } from '@/services/lafService.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { useUserStore } from '@/stores/modules/user';
import config from '@/config/index.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import { getRetryCooldownSeconds, normalizeEmailAddress, resolveEmailAuthErrorMessage } from './email-auth-utils.js';

// 主题状态
const isDark = ref(false);
const statusBarHeight = ref(44);
const capsuleSafeRight = ref(20);

// 登录状态
const isLoading = ref(false);
let emailLoginLock = false;
let lastEmailSubmitAt = 0;
const EMAIL_SUBMIT_COOLDOWN_MS = 2500;
const agreedToTerms = ref(false);
const isE2EMode = ref(false);
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

const enterCodeCooldownFallback = (seconds = 60) => {
  startCodeCooldown(seconds);
  uni.showToast({
    title: '验证码请求状态不确定，请先检查邮箱',
    icon: 'none',
    duration: 2200
  });
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
    uni.showLoading({ title: '发送中...' });

    const res = await lafService.sendEmailCode(normalizeEmailAddress(emailForm.value.email)).catch((err) => {
      logger.error('[Login] sendEmailCode Promise rejected:', err);
      return { code: -1, message: '网络请求失败' };
    });

    uni.hideLoading();

    if (res && res.code === 0) {
      const cooldown = res?.retryAfter || 60;
      uni.showToast({
        title: res?.alreadySent ? '验证码已发送，请稍候查收' : '验证码已发送，请查收邮箱',
        icon: 'success'
      });
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
      uni.showToast({ title: errorMsg, icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    logger.error('[Login] 发送验证码失败:', error);
    enterCodeCooldownFallback(60);
  } finally {
    uni.hideLoading();
    isSendingCode.value = false;
  }
};

// 切换协议同意状态
const toggleAgreement = () => {
  agreedToTerms.value = !agreedToTerms.value;
};

// 返回上一页
const handleBack = () => {
  uni.navigateBack({
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' });
    }
  });
};

const isNonReleaseEnv = () => {
  try {
    if (typeof uni === 'undefined' || typeof uni.getAccountInfoSync !== 'function') {
      return false;
    }
    const info = uni.getAccountInfoSync();
    const envVersion = info?.miniProgram?.envVersion;
    return envVersion !== 'release';
  } catch {
    return false;
  }
};

const detectE2EMode = () => {
  try {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const query = currentPage?.$page?.options || currentPage?.options || {};
    const e2eFlag = String(query.e2e || '').toLowerCase();
    isE2EMode.value = (e2eFlag === '1' || e2eFlag === 'true') && isNonReleaseEnv();
  } catch {
    isE2EMode.value = false;
  }
};

const handleE2EMockLogin = () => {
  if (!isE2EMode.value || isLoading.value) return;

  isLoading.value = true;
  saveLoginInfo({
    token: `e2e-token-${Date.now()}`,
    userId: 'e2e_user',
    userInfo: {
      nickname: 'E2E Tester',
      avatar_url: ''
    }
  });

  uni.showToast({ title: '测试登录成功', icon: 'success' });
  setTimeout(() => {
    isLoading.value = false;
    navigateAfterLogin();
  }, 300);
};

// 微信登录
const handleWechatLogin = async () => {
  if (!agreedToTerms.value) {
    uni.showToast({ title: '请先同意用户协议', icon: 'none' });
    return;
  }

  if (isLoading.value) return;
  isLoading.value = true;

  try {
    uni.showLoading({ title: '登录中...' });

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

    logger.log('[Login] 微信登录code:', loginRes.code);

    // 调用后端登录接口
    const res = await lafService
      .login({
        type: 'wechat',
        code: loginRes.code
      })
      .catch((err) => {
        logger.error('[Login] lafService.login failed:', err);
        return { code: -1, message: '登录请求失败' };
      });

    uni.hideLoading();

    if (res && res.code === 0 && res.data) {
      // 保存用户信息
      saveLoginInfo(res.data);
      uni.showToast({ title: '登录成功', icon: 'success' });

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
      uni.showToast({ title: errorMsg, icon: 'none' });
    }
    // #endif

    // #ifndef MP-WEIXIN
    // E007: APP-PLUS 环境使用微信 SDK 登录
    // #ifdef APP-PLUS
    if (!hasWechatProvider.value) {
      uni.hideLoading();
      uni.showToast({ title: '当前设备不支持微信登录', icon: 'none' });
      return;
    }

    try {
      const loginRes = await new Promise((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        });
      });

      logger.log('[Login] App微信登录结果:', loginRes);

      const userInfoRes = await new Promise((resolve, _reject) => {
        uni.getUserInfo({
          provider: 'weixin',
          success: resolve,
          fail: (_err) => resolve({ userInfo: {} }) // 用户可能拒绝授权头像昵称
        });
      });

      const res = await lafService
        .login({
          type: 'wechat',
          code: loginRes.code,
          accessToken: loginRes.authResult?.access_token,
          openid: loginRes.authResult?.openid,
          userInfo: userInfoRes.userInfo,
          platform: 'app'
        })
        .catch((err) => {
          logger.error('[Login] lafService.login (app-wechat) failed:', err);
          return { code: -1, message: '登录请求失败' };
        });

      uni.hideLoading();

      if (res && res.code === 0 && res.data) {
        saveLoginInfo(res.data);
        uni.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          navigateAfterLogin();
        }, 1500);
      } else {
        let errorMsg = '微信登录失败，请重试';
        if (res?.message) errorMsg = res.message;
        uni.showToast({ title: errorMsg, icon: 'none' });
      }
    } catch (appWechatErr) {
      uni.hideLoading();
      logger.error('[Login] App微信登录失败:', appWechatErr);
      let errorMsg = '微信登录失败，请重试';
      if (appWechatErr?.errMsg?.includes('cancel')) errorMsg = '已取消微信登录';
      uni.showToast({ title: errorMsg, icon: 'none' });
    }
    // #endif

    // #ifndef APP-PLUS
    // H5 环境下微信浏览器走 OAuth 网页授权（由 handleWechatH5Login 处理）
    // 非微信浏览器提示
    uni.hideLoading();
    uni.showToast({ title: '请在微信中打开或使用其他方式登录', icon: 'none' });
    // #endif
    // #endif
  } catch (error) {
    uni.hideLoading();
    logger.error('[Login] 微信登录失败:', error);
    uni.showToast({ title: error?.message || '登录失败，请重试', icon: 'none' });
  } finally {
    isLoading.value = false;
  }
};

// E007: H5微信浏览器 OAuth 网页授权登录
const handleWechatH5Login = () => {
  if (!agreedToTerms.value) {
    uni.showToast({ title: '请先同意用户协议', icon: 'none' });
    return;
  }
  if (isLoading.value) return;
  isLoading.value = true;

  // #ifdef H5
  try {
    // I005: 从统一配置获取微信公众号 AppID
    const wxAppId = config.wx.gzhAppId || '';
    if (!wxAppId) {
      uni.showToast({ title: '微信公众号未配置', icon: 'none' });
      isLoading.value = false;
      return;
    }

    const currentOrigin = window.location.origin;
    const hashMode = window.location.href.includes('#');
    let callbackUrl;
    if (hashMode) {
      callbackUrl = `${currentOrigin}/#/pages/login/wechat-callback`;
    } else {
      callbackUrl = `${currentOrigin}/pages/login/wechat-callback`;
    }
    const redirectUri = encodeURIComponent(callbackUrl);

    // 生成安全的 state 防 CSRF
    let state;
    try {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      state = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      state = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 18);
    }

    storageService.save('wx_oauth_state', state);

    logger.log('[Login] 微信H5 OAuth配置:', {
      wxAppId,
      callbackUrl,
      state: state.substring(0, 20) + '...'
    });

    // 微信网页授权 URL（snsapi_userinfo 获取用户信息）
    const authUrl =
      'https://open.weixin.qq.com/connect/oauth2/authorize' +
      `?appid=${wxAppId}` +
      `&redirect_uri=${redirectUri}` +
      '&response_type=code' +
      '&scope=snsapi_userinfo' +
      `&state=${state}` +
      '#wechat_redirect';

    window.location.href = authUrl;
  } catch (err) {
    logger.error('[Login] 微信H5 OAuth跳转失败:', err);
    uni.showToast({ title: '微信授权跳转失败', icon: 'none' });
    isLoading.value = false;
  }
  // #endif

  // #ifndef H5
  isLoading.value = false;
  // #endif
};

// QQ登录
const handleQQLogin = async () => {
  if (!agreedToTerms.value) {
    uni.showToast({ title: '请先同意用户协议', icon: 'none' });
    return;
  }

  if (isLoading.value) return;
  isLoading.value = true;

  try {
    uni.showLoading({ title: '登录中...' });

    // #ifdef MP-QQ
    // QQ小程序环境
    const loginRes = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'qq',
        success: resolve,
        fail: reject
      });
    });

    logger.log('[Login] QQ小程序登录code:', loginRes.code);

    // 调用后端登录接口
    const res = await lafService.login({
      type: 'qq',
      code: loginRes.code,
      platform: 'mp-qq'
    });

    uni.hideLoading();

    if (res.code === 0 && res.data) {
      saveLoginInfo(res.data);
      uni.showToast({ title: '登录成功', icon: 'success' });

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
      uni.showToast({ title: errorMsg, icon: 'none' });
    }
    // #endif

    // #ifdef MP-WEIXIN
    // 微信小程序环境不支持QQ登录，提示用户使用其他方式
    uni.hideLoading();
    uni.showModal({
      title: 'QQ登录',
      content: '微信小程序暂不支持QQ登录，请使用微信登录或邮箱登录',
      showCancel: false,
      confirmText: '知道了'
    });
    // #endif

    // #ifdef H5
    // H5环境：使用QQ OAuth网页授权
    uni.hideLoading();

    // QQ互联配置 — 从统一配置读取，支持环境变量覆盖
    const qqAppId = config.qq.appId;
    if (!qqAppId) {
      uni.hideLoading();
      uni.showToast({ title: 'QQ登录未配置', icon: 'none' });
      isLoading.value = false;
      return;
    }
    const currentOrigin = window.location.origin;
    const hashMode = window.location.href.includes('#');
    const callbackUrl =
      config.qq.redirectUri ||
      (hashMode ? `${currentOrigin}/#/pages/login/qq-callback` : `${currentOrigin}/pages/login/qq-callback`);

    const redirectUri = encodeURIComponent(callbackUrl);
    // E007: 使用 crypto.getRandomValues() 生成安全的 OAuth state
    let state;
    try {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      state = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // 降级方案（极少数不支持 crypto 的环境）
      state = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 18);
    }

    // 保存state和回调信息用于验证
    storageService.save('qq_oauth_state', state);
    storageService.save('qq_oauth_origin', currentOrigin);

    logger.log('[Login] QQ OAuth配置:', {
      qqAppId,
      callbackUrl,
      state: state.substring(0, 20) + '...'
    });

    // 构建授权URL
    const authUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${qqAppId}&redirect_uri=${redirectUri}&state=${state}&scope=get_user_info`;

    // 直接跳转，不需要确认弹窗（更好的用户体验）
    window.location.href = authUrl;
    // #endif

    // #ifdef APP-PLUS
    // App环境：使用uni.login的QQ provider
    try {
      // 检查是否安装了QQ
      const providers = await new Promise((resolve) => {
        uni.getProvider({
          service: 'oauth',
          success: (res) => resolve(res.provider || []),
          fail: () => resolve([])
        });
      });

      if (!providers.includes('qq')) {
        uni.hideLoading();
        uni.showToast({ title: '请先安装QQ客户端', icon: 'none' });
        return;
      }

      const loginRes = await new Promise((resolve, reject) => {
        uni.login({
          provider: 'qq',
          success: resolve,
          fail: reject
        });
      });

      logger.log('[Login] App QQ登录结果:', loginRes);

      // 获取用户信息
      const userInfoRes = await new Promise((resolve, reject) => {
        uni.getUserInfo({
          provider: 'qq',
          success: resolve,
          fail: reject
        });
      });

      // 调用后端登录接口
      const res = await lafService.login({
        type: 'qq',
        code: loginRes.code,
        accessToken: loginRes.authResult?.access_token,
        openid: loginRes.authResult?.openid,
        userInfo: userInfoRes.userInfo,
        platform: 'app',
        redirectUri: config.qq.redirectUri
      });

      uni.hideLoading();

      if (res.code === 0 && res.data) {
        saveLoginInfo(res.data);
        uni.showToast({ title: '登录成功', icon: 'success' });

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
        uni.showToast({ title: errorMsg, icon: 'none' });
      }
    } catch (appError) {
      uni.hideLoading();
      logger.error('[Login] App QQ登录失败:', appError);

      // 根据错误类型给出提示
      let errorMsg = 'QQ登录失败，请重试';
      if (appError.errMsg?.includes('cancel')) {
        errorMsg = '已取消QQ登录';
      } else if (appError.errMsg?.includes('deny')) {
        errorMsg = '用户拒绝授权';
      }

      uni.showToast({ title: errorMsg, icon: 'none' });
    }
    // #endif
  } catch (error) {
    uni.hideLoading();
    logger.error('[Login] QQ登录失败:', error);
    uni.showToast({ title: '登录失败，请重试', icon: 'none' });
  } finally {
    isLoading.value = false;
  }
};

// 邮箱登录/注册
const handleEmailLogin = async () => {
  if (emailLoginLock || isLoading.value) return;
  emailLoginLock = true;

  try {
    if (!agreedToTerms.value) {
      uni.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }

    // 表单验证
    if (!isEmailValid.value) {
      uni.showToast({ title: '请输入有效的邮箱地址', icon: 'none' });
      return;
    }

    // ✅ 问题清单修复：密码校验与后端统一（8-32 位）
    const password = (emailForm.value.password || '').trim();
    if (!password || password.length < 8) {
      uni.showToast({ title: '密码至少8位', icon: 'none' });
      return;
    }
    if (password.length > 32) {
      uni.showToast({ title: '密码不能超过32位', icon: 'none' });
      return;
    }

    // 注册时额外校验（密码强度仅注册时强制，避免锁死使用旧密码的已有用户）
    if (isRegister.value) {
      // ✅ M17: 密码强度检查（仅注册时）：需包含大写字母、小写字母和数字
      if (!/[A-Z]/.test(password)) {
        uni.showToast({ title: '密码需包含大写字母', icon: 'none' });
        return;
      }
      if (!/[a-z]/.test(password)) {
        uni.showToast({ title: '密码需包含小写字母', icon: 'none' });
        return;
      }
      if (!/\d/.test(password)) {
        uni.showToast({ title: '密码需包含数字', icon: 'none' });
        return;
      }

      if (!emailForm.value.code) {
        uni.showToast({ title: '请输入验证码', icon: 'none' });
        return;
      }

      if (emailForm.value.code.length !== 6) {
        uni.showToast({ title: '验证码为6位数字', icon: 'none' });
        return;
      }
    }

    const now = Date.now();
    if (now - lastEmailSubmitAt < EMAIL_SUBMIT_COOLDOWN_MS) {
      return;
    }
    lastEmailSubmitAt = now;

    if (isLoading.value) return;
    isLoading.value = true;

    try {
      uni.showLoading({ title: isRegister.value ? '注册中...' : '登录中...' });

      const res = await lafService
        .login({
          type: 'email',
          email: normalizeEmailAddress(emailForm.value.email),
          password: emailForm.value.password,
          verifyCode: isRegister.value ? emailForm.value.code : undefined,
          isRegister: isRegister.value
        })
        .catch((err) => {
          logger.error('[Login] lafService.login (email) failed:', err);
          return { code: -1, message: '网络请求失败' };
        });

      uni.hideLoading();

      if (res && res.code === 0 && res.data) {
        saveLoginInfo(res.data);
        uni.showToast({ title: isRegister.value ? '注册成功' : '登录成功', icon: 'success' });

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
        uni.showToast({ title: errorMsg, icon: 'none' });
      }
    } catch (error) {
      uni.hideLoading();
      logger.error('[Login] 邮箱登录失败:', error);
      uni.showToast({ title: '网络错误，请重试', icon: 'none' });
    } finally {
      uni.hideLoading();
      isLoading.value = false;
    }
  } finally {
    emailLoginLock = false;
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

  logger.log('[Login] 用户信息已保存:', { uid: userInfo.uid, nickName: userInfo.nickName });
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
  statusBarHeight.value = getStatusBarHeight();
  capsuleSafeRight.value = getCapsuleSafeRight();

  detectE2EMode();

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
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8faf8 0%, #e8f5e9 100%);
  padding: 0 40rpx;
  position: relative;
  overflow: hidden;
}

.login-container.dark-mode {
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
  background: var(--brand-color);
  top: -100rpx;
  right: -100rpx;
}

.bg-circle-2 {
  width: 300rpx;
  height: 300rpx;
  background: var(--brand-hover, #5ac78f);
  bottom: 200rpx;
  left: -150rpx;
}

.bg-circle-3 {
  width: 200rpx;
  height: 200rpx;
  background: var(--brand-active, #7bc653);
  bottom: -50rpx;
  right: 100rpx;
}

.dark-mode .bg-circle-1,
.dark-mode .bg-circle-2,
.dark-mode .bg-circle-3 {
  background: var(--brand-color);
  opacity: 0.05;
}

/* 顶部栏 */
.top-bar {
  padding-bottom: 20rpx;
}

.back-btn {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  box-shadow: var(--apple-shadow-surface);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.dark-mode .back-btn {
  background: rgba(255, 255, 255, 0.1);
}

.back-icon {
  font-size: 36rpx;
  color: #333;
}

.dark-mode .back-icon {
  color: #fff;
}

/* Logo区域 */
.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 80rpx;
}

.app-logo {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
}

.app-name {
  font-size: 48rpx;
  font-weight: 700;
  color: var(--brand-color);
  margin-bottom: 12rpx;
}

.dark-mode .app-name {
  color: var(--brand-color);
}

.app-slogan {
  font-size: 28rpx;
  color: #666;
}

.dark-mode .app-slogan {
  color: #aaa;
}

/* 登录方式 */
.login-methods {
  padding: 0 20rpx;
}

.login-btn {
  display: flex;
  align-items: center;
  padding: 32rpx 36rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 36%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--apple-shadow-card);
  transition: all 0.3s ease;
  border: 1rpx solid var(--apple-glass-border-strong);
  position: relative;
  overflow: hidden;
}

.login-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
}

.dark-mode .login-btn {
  background: linear-gradient(160deg, rgba(16, 20, 28, 0.92) 0%, rgba(12, 15, 22, 0.98) 100%);
  box-shadow: var(--apple-shadow-card);
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
  color: #fff;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}

.wechat-icon {
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
}

.qq-icon {
  background: linear-gradient(135deg, #12b7f5 0%, #0099ff 100%);
}

.e2e-icon {
  background: linear-gradient(135deg, #5c6bc0 0%, #3949ab 100%);
}

.email-icon {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  font-size: 36rpx;
}

.btn-text {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.dark-mode .btn-text {
  color: #fff;
}

.btn-arrow {
  font-size: 32rpx;
  color: #777;
}

.dark-mode .btn-arrow {
  color: #666;
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
  background: #e0e0e0;
}

.dark-mode .divider-line {
  background: rgba(255, 255, 255, 0.1);
}

.divider-text {
  padding: 0 24rpx;
  font-size: 26rpx;
  color: #777;
}

/* 邮箱表单 */
.email-form {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 36%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: var(--apple-shadow-card);
  border: 1rpx solid var(--apple-glass-border-strong);
}

.dark-mode .email-form {
  background: linear-gradient(160deg, rgba(16, 20, 28, 0.92) 0%, rgba(12, 15, 22, 0.98) 100%);
}

.form-item {
  margin-bottom: 28rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.dark-mode .form-label {
  color: #aaa;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #333;
  box-sizing: border-box;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.68);
}

.form-input-password {
  -webkit-text-security: disc;
  padding-right: 110rpx;
}

.form-input-password::-ms-reveal,
.form-input-password::-ms-clear {
  display: none;
}

.dark-mode .form-input {
  background: rgba(16, 20, 28, 0.72);
  color: #fff;
  border-color: rgba(124, 176, 255, 0.18);
}

.input-placeholder {
  color: #888;
}

.form-error {
  font-size: 24rpx;
  color: #f44336;
  margin-top: 8rpx;
}

.code-input-wrapper {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
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
  font-weight: 600;
  color: var(--brand-color);
}

.dark-mode .password-toggle-btn {
  color: #7bc0ff;
}

.code-input {
  flex: 1;
}

.send-code-btn {
  min-width: 180rpx;
  height: 88rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
  box-shadow: var(--cta-primary-shadow);
}

.send-code-btn text {
  font-size: 26rpx;
  color: inherit;
  font-weight: 500;
}

.send-code-btn.disabled {
  background: #ccc;
}

.dark-mode .send-code-btn.disabled {
  background: rgba(255, 255, 255, 0.2);
}

.email-submit-btn {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  justify-content: center;
  margin-top: 16rpx;
}

.email-submit-btn .btn-text {
  color: inherit;
  flex: none;
}

.form-switch {
  text-align: center;
  padding-top: 24rpx;
}

.form-switch text {
  font-size: 26rpx;
  color: var(--brand-color);
}
.dark-mode .form-switch text {
  color: var(--brand-color);
}

/* 用户协议 */
.agreement {
  display: flex;
  align-items: flex-start;
  padding: 40rpx 20rpx;
  background: rgba(255, 255, 255, 0.28);
  border-radius: 24rpx;
  margin: 0 20rpx;
}

.checkbox-wrapper {
  padding: 4rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid rgba(16, 40, 26, 0.18);
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
}

.checkbox.checked {
  background: var(--brand-color);
  border-color: var(--brand-color);
}

.checkbox text {
  font-size: 24rpx;
  color: #fff;
}

.agreement-text {
  flex: 1;
  font-size: 24rpx;
  color: #777;
  line-height: 1.6;
}

.agreement-text .link {
  color: var(--brand-color);
}

/* 底部提示 */
.footer-tip {
  text-align: center;
  padding: 40rpx 0 80rpx;
}

.footer-tip text {
  font-size: 24rpx;
  color: #777;
  background: rgba(255, 255, 255, 0.22);
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
}

/* Dark mode: missing overrides */
.dark-mode .divider-text {
  color: #aaa;
}

.dark-mode .input-placeholder {
  color: #666;
}

.dark-mode .checkbox {
  border-color: rgba(124, 176, 255, 0.18);
}

.dark-mode .agreement-text {
  color: #aaa;
}

.dark-mode .agreement {
  background: rgba(16, 20, 28, 0.32);
}

.dark-mode .agreement-text .link {
  color: var(--brand-color);
}

.dark-mode .footer-tip text {
  color: #777;
  background: rgba(16, 20, 28, 0.28);
}

.dark-mode .form-error {
  color: #ff6b6b;
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

/* Checkbox touch target */
.checkbox-wrapper {
  padding: 12rpx;
  margin: -8rpx;
}

/* Final polish: login page unified with Apple / Liquid Glass */
.login-container {
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 52%,
    var(--page-gradient-bottom) 100%
  );
  padding: 0 32rpx;
  color: var(--text-main);
}

.login-container.dark-mode {
  background: linear-gradient(180deg, #04070d 0%, #0a1018 48%, #04070d 100%);
}

.bg-circle {
  opacity: 0.58;
  filter: blur(18rpx);
}

.bg-circle-1 {
  background: radial-gradient(circle, rgba(107, 208, 150, 0.34) 0%, transparent 72%);
}

.bg-circle-2 {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.28) 0%, transparent 72%);
}

.bg-circle-3 {
  background: radial-gradient(circle, rgba(72, 190, 128, 0.2) 0%, transparent 72%);
}

.dark-mode .bg-circle-1 {
  background: radial-gradient(circle, rgba(10, 132, 255, 0.26) 0%, transparent 72%);
}

.dark-mode .bg-circle-2 {
  background: radial-gradient(circle, rgba(95, 170, 255, 0.18) 0%, transparent 72%);
}

.dark-mode .bg-circle-3 {
  background: radial-gradient(circle, rgba(32, 83, 170, 0.18) 0%, transparent 72%);
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

.back-btn,
.logo-section,
.login-methods,
.login-btn,
.agreement,
.footer-tip text,
.form-input {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .back-btn,
.dark-mode .logo-section,
.dark-mode .login-methods,
.dark-mode .login-btn,
.dark-mode .agreement,
.dark-mode .footer-tip text,
.dark-mode .form-input {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.top-bar {
  padding-bottom: 24rpx;
}

.back-btn {
  box-shadow: var(--apple-shadow-surface);
}

.back-icon,
.btn-text,
.app-name,
.form-switch text {
  color: var(--text-main);
}

.dark-mode .back-icon,
.dark-mode .btn-text,
.dark-mode .app-name,
.dark-mode .form-switch text {
  color: #ffffff;
}

.logo-section {
  margin: 18rpx 12rpx 34rpx;
  padding: 36rpx 24rpx;
  border-radius: 38rpx;
}

.app-name {
  font-size: 52rpx;
}

.app-slogan,
.divider-text,
.form-label,
.agreement-text,
.footer-tip text,
.btn-arrow,
.input-placeholder {
  color: var(--text-sub);
}

.dark-mode .app-slogan,
.dark-mode .divider-text,
.dark-mode .form-label,
.dark-mode .agreement-text,
.dark-mode .footer-tip text,
.dark-mode .btn-arrow,
.dark-mode .input-placeholder {
  color: rgba(255, 255, 255, 0.68);
}

.login-methods {
  padding: 26rpx 20rpx 30rpx;
  border-radius: 38rpx;
}

.login-btn {
  padding: 26rpx 28rpx;
  margin-bottom: 18rpx;
  box-shadow: var(--apple-shadow-surface);
}

.login-btn:active {
  transform: scale(0.98);
  box-shadow: var(--apple-shadow-surface);
}

.btn-icon {
  width: 72rpx;
  height: 72rpx;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(255, 255, 255, 0.46);
}

.wechat-icon {
  background: rgba(52, 199, 89, 0.14);
  color: #1f7a33;
}

.qq-icon {
  background: rgba(10, 132, 255, 0.14);
  color: #0a84ff;
}

.e2e-icon {
  background: rgba(88, 86, 214, 0.14);
  color: #5856d6;
}

.email-icon {
  background: rgba(255, 159, 10, 0.14);
  color: #b56a00;
}

.dark-mode .wechat-icon,
.dark-mode .qq-icon,
.dark-mode .e2e-icon,
.dark-mode .email-icon {
  color: #ffffff;
}

.divider-line {
  background: var(--apple-divider);
}

.email-form {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.form-input {
  color: var(--text-main);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .form-input {
  color: #ffffff;
}

.form-error {
  color: #c53d35;
}

.dark-mode .form-error {
  color: #ff8e86;
}

.send-code-btn.disabled {
  background: rgba(255, 255, 255, 0.38);
  color: var(--text-sub);
  border-color: rgba(255, 255, 255, 0.24);
  box-shadow: none;
}

.dark-mode .send-code-btn.disabled {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.48);
}

.agreement {
  margin: 0 12rpx;
  border-radius: 28rpx;
}

.checkbox {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.5);
}

.dark-mode .checkbox {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.agreement-text .link {
  color: #22873a;
}

.dark-mode .agreement-text .link {
  color: #7bc0ff;
}

.footer-tip {
  padding: 36rpx 0 84rpx;
}

.footer-tip text {
  display: inline-block;
}
</style>
