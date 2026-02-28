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
    <view class="top-bar">
      <view class="back-btn" hover-class="btn-hover" @tap="handleBack">
        <text class="back-icon"> ← </text>
      </view>
    </view>

    <!-- Logo区域 -->
    <view class="logo-section">
      <image class="app-logo" src="./static/logo.png" mode="aspectFit" />
      <text class="app-name"> Exam-Master </text>
      <text class="app-slogan"> AI助力，一战成硕 </text>
    </view>

    <!-- 登录方式选择 -->
    <view class="login-methods">
      <!-- 微信登录 -->
      <!-- #ifdef MP-WEIXIN -->
      <view
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
          <input
            v-model="emailForm.password"
            class="form-input"
            type="password"
            placeholder="请输入密码"
            placeholder-class="input-placeholder"
          />
        </view>

        <view v-if="isRegister" class="form-item">
          <text class="form-label"> 验证码 </text>
          <view class="code-input-wrapper">
            <input
              v-model="emailForm.code"
              class="form-input code-input"
              type="number"
              placeholder="请输入验证码"
              placeholder-class="input-placeholder"
              maxlength="6"
            />
            <view
              class="send-code-btn"
              hover-class="btn-hover"
              :class="{ disabled: codeCooldown > 0 || !isEmailValid }"
              @tap="sendVerifyCode"
            >
              <text>{{ codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码' }}</text>
            </view>
          </view>
        </view>

        <view v-if="isRegister" class="form-item">
          <text class="form-label"> 设置密码 </text>
          <input
            v-model="emailForm.password"
            class="form-input"
            type="password"
            placeholder="请设置8-32位密码（含大小写字母和数字）"
            placeholder-class="input-placeholder"
          />
        </view>

        <view
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
          <text @tap="toggleRegister">
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </text>
        </view>
      </view>

      <!-- 邮箱登录入口 -->
      <view v-else class="login-btn email-btn" hover-class="btn-hover" @tap="showEmailForm = true">
        <view class="btn-icon email-icon">
          <BaseIcon name="email" :size="36" />
        </view>
        <text class="btn-text"> 邮箱登录/注册 </text>
        <text class="btn-arrow"> → </text>
      </view>
    </view>

    <!-- 用户协议 -->
    <view class="agreement">
      <view class="checkbox-wrapper" @tap="toggleAgreement">
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

// 主题状态
const isDark = ref(false);

// 登录状态
const isLoading = ref(false);
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
};

// 发送验证码
const sendVerifyCode = async () => {
  if (codeCooldown.value > 0 || !isEmailValid.value) return;

  try {
    uni.showLoading({ title: '发送中...' });

    const res = await lafService.sendEmailCode(emailForm.value.email).catch((err) => {
      logger.error('[Login] sendEmailCode Promise rejected:', err);
      return { code: -1, message: '网络请求失败' };
    });

    uni.hideLoading();

    if (res && res.code === 0) {
      uni.showToast({ title: '验证码已发送，请查收邮箱', icon: 'success' });
      // 开始倒计时
      codeCooldown.value = 60;
      cooldownTimer = setInterval(() => {
        codeCooldown.value--;
        if (codeCooldown.value <= 0) {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
        }
      }, 1000);
    } else {
      // 根据错误类型给出更友好的提示
      let errorMsg = res?.message || '发送失败';
      if (res?.message?.includes('频繁')) {
        errorMsg = '发送太频繁，请稍后再试';
      } else if (res?.message?.includes('邮箱')) {
        errorMsg = '邮箱格式不正确';
      }
      uni.showToast({ title: errorMsg, icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    logger.error('[Login] 发送验证码失败:', error);
    uni.showToast({ title: '网络错误，请重试', icon: 'none' });
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

  if (isLoading.value) return;
  isLoading.value = true;

  try {
    uni.showLoading({ title: isRegister.value ? '注册中...' : '登录中...' });

    const res = await lafService
      .login({
        type: 'email',
        email: emailForm.value.email.trim().toLowerCase(),
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
      // 根据错误类型给出更友好的提示
      let errorMsg = res?.message || '操作失败';
      if (res?.message?.includes('密码')) {
        errorMsg = '邮箱或密码错误';
      } else if (res?.message?.includes('验证码')) {
        errorMsg = '验证码错误或已过期';
      } else if (res?.message?.includes('已注册') || res?.message?.includes('已存在')) {
        errorMsg = '该邮箱已注册，请直接登录';
        isRegister.value = false; // 自动切换到登录模式
      } else if (res?.message?.includes('不存在') || res?.message?.includes('未注册')) {
        errorMsg = '该邮箱未注册，请先注册';
        isRegister.value = true; // 自动切换到注册模式
      }
      uni.showToast({ title: errorMsg, icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    logger.error('[Login] 邮箱登录失败:', error);
    uni.showToast({ title: '网络错误，请重试', icon: 'none' });
  } finally {
    isLoading.value = false;
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
  background: #4caf50;
  top: -100rpx;
  right: -100rpx;
}

.bg-circle-2 {
  width: 300rpx;
  height: 300rpx;
  background: #81c784;
  bottom: 200rpx;
  left: -150rpx;
}

.bg-circle-3 {
  width: 200rpx;
  height: 200rpx;
  background: #a5d6a7;
  bottom: -50rpx;
  right: 100rpx;
}

.dark-mode .bg-circle-1,
.dark-mode .bg-circle-2,
.dark-mode .bg-circle-3 {
  background: #4caf50;
  opacity: 0.05;
}

/* 顶部栏 */
.top-bar {
  padding-top: 88rpx;
  padding-bottom: 20rpx;
}

.back-btn {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
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
  color: #2e7d32;
  margin-bottom: 12rpx;
}

.dark-mode .app-name {
  color: #81c784;
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
  background: #fff;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.login-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
}

.dark-mode .login-btn {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
}

.btn-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}

.wechat-icon {
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
}

.qq-icon {
  background: linear-gradient(135deg, #12b7f5 0%, #0099ff 100%);
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
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.dark-mode .email-form {
  background: rgba(255, 255, 255, 0.1);
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
  background: #f5f5f5;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #333;
  box-sizing: border-box;
}

.dark-mode .form-input {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
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
  gap: 16rpx;
}

.code-input {
  flex: 1;
}

.send-code-btn {
  min-width: 180rpx;
  height: 88rpx;
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
}

.send-code-btn text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 500;
}

.send-code-btn.disabled {
  background: #ccc;
}

.dark-mode .send-code-btn.disabled {
  background: rgba(255, 255, 255, 0.2);
}

.email-submit-btn {
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  justify-content: center;
  margin-top: 16rpx;
}

.email-submit-btn .btn-text {
  color: #fff;
  flex: none;
}

.form-switch {
  text-align: center;
  padding-top: 24rpx;
}

.form-switch text {
  font-size: 26rpx;
  color: #4caf50;
}
.dark-mode .form-switch text {
  color: #81c784;
}

/* 用户协议 */
.agreement {
  display: flex;
  align-items: flex-start;
  padding: 40rpx 20rpx;
}

.checkbox-wrapper {
  padding: 4rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ccc;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
}

.checkbox.checked {
  background: #4caf50;
  border-color: #4caf50;
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
  color: #4caf50;
}

/* 底部提示 */
.footer-tip {
  text-align: center;
  padding: 40rpx 0 80rpx;
}

.footer-tip text {
  font-size: 24rpx;
  color: #777;
}

/* Dark mode: missing overrides */
.dark-mode .divider-text {
  color: #aaa;
}

.dark-mode .input-placeholder {
  color: #666;
}

.dark-mode .checkbox {
  border-color: #555;
}

.dark-mode .agreement-text {
  color: #aaa;
}

.dark-mode .agreement-text .link {
  color: #81c784;
}

.dark-mode .footer-tip text {
  color: #777;
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
</style>
