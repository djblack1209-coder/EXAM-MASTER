<template>
  <view
    class="login-page"
    :class="{ 'dark-mode': themeStore.isDark, 'theme-light': !themeStore.isDark }"
    :style="$yoziInsets"
  >
    <PrivacyPopup />
    <view class="login-top">
      <BaseButton variant="quiet" icon="arrow-left" icon-only :label="t('login.back')" @tap="back" />
      <BaseSegmented
        :model-value="region"
        :options="regions"
        :label="t('login.region')"
        :disabled="busy"
        @update:model-value="changeRegion"
      />
      <BaseButton
        variant="quiet"
        :label="currentLanguage === 'en' ? t('login.chinese') : t('login.english')"
        @tap="setLanguage(currentLanguage === 'en' ? 'zh-CN' : 'en')"
        >{{ currentLanguage === 'en' ? t('login.chinese') : t('login.english') }}</BaseButton
      >
    </view>
    <view class="login-content">
      <view v-if="step === 'methods'" class="login-hero"
        ><YoziMascot pose="wave" play="auto" size="medium" /><text class="login-title">{{ t('login.title') }}</text
        ><text class="login-subtitle">{{ t('login.subtitle') }}</text></view
      >
      <BaseCard surface="glass" class="login-panel">
        <view v-if="step === 'methods'" class="login-stack">
          <BaseButton
            v-for="(method, index) in methods"
            :key="method"
            :class="`${method}-btn`"
            :variant="
              ['apple', 'google', 'wechat'].includes(method)
                ? method
                : index === 0
                  ? 'primary'
                  : method === 'email'
                    ? 'secondary'
                    : 'quiet'
            "
            :icon="method === 'phone' ? 'phone' : method === 'email' ? 'mail' : method"
            block
            :loading="busy"
            :disabled="busy || !agreedToTerms"
            @tap="selectMethod(method)"
            >{{ t(`login.${method}`) }}</BaseButton
          >
          <text v-if="!methods.length" role="status">{{ t('login.providerClosed') }}</text>
        </view>
        <view v-else-if="step === 'age'" class="login-stack age-form">
          <text class="login-title">{{ t('login.birth') }}</text
          ><text class="login-subtitle">{{ t('login.birthHelp') }}</text>
          <BaseInput v-model="year" :label="t('login.year')" :options="birthYears" />
          <BaseInput v-model="month" :label="t('login.month')" :options="birthMonths" />
          <text class="login-subtitle">{{ t('login.birthPrivacy') }}</text>
          <BaseButton variant="primary" block :loading="busy" :disabled="busy || !agreedToTerms" @tap="submitAge">{{
            t('login.continue')
          }}</BaseButton>
        </view>
        <view v-else-if="step === 'blocked'" class="login-stack age-blocked" role="alert">
          <YoziMascot pose="encourage" play="once" size="state" /><text class="login-title">{{
            t('login.blocked')
          }}</text
          ><text class="login-subtitle">{{ t('login.blockedHelp') }}</text>
          <BaseButton variant="quiet" block @tap="step = 'methods'">{{ t('login.back') }}</BaseButton>
        </view>
        <view v-else-if="step === 'phone'" class="login-stack phone-form">
          <text class="login-title">{{ t('login.phone') }}</text>
          <BaseInput v-model="phone" :prefix="prefix" :label="t('login.phoneNumber')" inputmode="tel" :maxlength="16" />
          <BaseInput
            v-model="phoneCode"
            :label="t('login.code')"
            verification
            inputmode="numeric"
            :maxlength="6"
            :disabled="busy || !agreedToTerms"
            :resend-seconds="phoneCooldown"
            :verification-sent="phoneSent"
            @resend="sendPhone"
          />
          <BaseButton variant="primary" block :loading="busy" :disabled="busy || !agreedToTerms" @tap="submitPhone">{{
            t('login.submit')
          }}</BaseButton>
          <BaseButton variant="quiet" block @tap="step = 'methods'">{{ t('login.other') }}</BaseButton>
        </view>
        <view v-else class="login-stack email-form">
          <text class="login-title">{{ isRegister ? t('login.create') : t('login.email') }}</text>
          <BaseInput v-model="emailForm.email" :label="t('login.emailAddress')" inputmode="email" :maxlength="254" />
          <BaseInput
            v-if="isRegister"
            v-model="emailForm.code"
            :label="t('login.code')"
            verification
            inputmode="numeric"
            :maxlength="6"
            :resend-seconds="emailCooldown"
            :disabled="busy || !agreedToTerms || !isEmailValid"
            @resend="sendEmail"
          />
          <BaseInput
            v-model="emailForm.password"
            :label="isRegister ? t('login.setPassword') : t('login.password')"
            :type="showPassword ? 'text' : 'password'"
            :maxlength="32"
            :help="isRegister ? t('login.passwordHelp') : ''"
            ><template #suffix
              ><BaseButton
                variant="quiet"
                icon-only
                :icon="showPassword ? 'eye-off' : 'eye'"
                :label="showPassword ? t('login.hidePassword') : t('login.showPassword')"
                @tap="showPassword = !showPassword" /></template
          ></BaseInput>
          <BaseButton variant="primary" block :loading="busy" :disabled="busy || !agreedToTerms" @tap="submitEmail">{{
            isRegister ? t('login.register') : t('login.submit')
          }}</BaseButton>
          <BaseButton variant="quiet" block @tap="toggleRegister">{{
            isRegister ? t('login.existing') : t('login.create')
          }}</BaseButton>
          <BaseButton variant="quiet" block @tap="step = 'methods'">{{ t('login.other') }}</BaseButton>
        </view>
        <text v-if="error" class="login-error" role="alert">{{ error }}</text>
        <BaseCheckbox
          v-if="!['age', 'blocked'].includes(step)"
          id="e2e-login-agreement"
          v-model="agreedToTerms"
          :disabled="busy"
          class="login-agreement"
          >{{ t('login.agree') }}
          <view
            role="link"
            tabindex="0"
            class="policy-link"
            @tap.stop="openPrivacy"
            @keydown.enter.stop="openPrivacy"
            @keydown.space.prevent.stop="openPrivacy"
            >{{ t('login.privacy') }}</view
          >
          {{ t('login.and') }}
          <view
            role="link"
            tabindex="0"
            class="policy-link"
            @tap.stop="openTerms"
            @keydown.enter.stop="openTerms"
            @keydown.space.prevent.stop="openTerms"
            >{{ t('login.terms') }}</view
          ></BaseCheckbox
        >
      </BaseCard>
      <view v-if="step === 'methods'" class="login-offline"
        ><text>{{ t('login.offline') }}</text
        ><BaseButton variant="quiet" @tap="openHomeTab()">{{ t('login.start') }}</BaseButton></view
      >
    </view>
  </view>
</template>
<script setup>
import './messages.js';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { t, currentLanguage, setLanguage } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { useThemeStore } from '@/stores/modules/theme.js';
import { useAuthStore } from '@/stores/modules/auth';
import { useUserStore } from '@/stores/modules/user';
import { storageService } from '@/services/storageService.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { readLoginRegion, chooseLoginRegion } from '@/services/auth-region.js';
import { availableLoginMethods, isAgeEligible, getAgeSession, loginErrorText } from './regional-utils.js';
import { normalizeEmailAddress } from './email-auth-utils.js';
import { beginWebOAuth, loginNativeWechat } from './oauth-utils.js';
import { requestProviderToken } from './provider-utils.js';
import { isDesktopRuntime } from '@/services/desktop/runtime.js';
import { loginDesktopOAuth } from '@/services/desktop/oauth.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { openHomeTab } from '@/utils/home-navigation.js';
import config from '@/config/index.js';
const authStore = useAuthStore(),
  themeStore = useThemeStore();
const region = ref(readLoginRegion()),
  agreedToTerms = ref(false),
  step = ref('methods'),
  busy = ref(false),
  error = ref('');
const birthYears = Array.from({ length: 121 }, (_, index) => {
  const value = new Date().getFullYear() - index;
  return { value: String(value), label: String(value) };
});
const birthMonths = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
const phoneSent = ref(false);
const year = ref(''),
  month = ref(''),
  phone = ref(''),
  phoneCode = ref(''),
  phoneCooldown = ref(0),
  emailCooldown = ref(0);
const emailForm = ref({ email: '', password: '', code: '' }),
  isRegister = ref(false),
  showPassword = ref(false);
const capabilities = ref({}),
  providers = ref([]),
  age = getAgeSession();
let platform = 'h5',
  os = '',
  active = true,
  version = 0,
  pendingMethod = '',
  ageTicket = '',
  ageExpiresAt = 0,
  redirectTimer;
// #ifdef MP-WEIXIN
platform = 'mp-weixin';
// #endif
// #ifdef APP-PLUS
platform = 'app';
// #endif
// #ifdef H5
platform = 'h5';
// #endif
try {
  const info = uni.getSystemInfoSync();
  os = String(info.osName || info.platform || '').toLowerCase();
} catch {
  /* capability fallback */
}
const desktop = isDesktopRuntime();
const isWeChatBrowser = typeof navigator !== 'undefined' && /micromessenger/i.test(navigator.userAgent);
const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.value.email));
const prefix = computed(() => (region.value === 'US' ? '+1' : '+86'));
const regions = computed(() => [
  { value: 'US', label: t('login.us') },
  { value: 'CN', label: t('login.cn') }
]);
const methods = computed(() =>
  availableLoginMethods(region.value, {
    platform,
    os,
    providers: providers.value,
    capabilities: capabilities.value,
    desktop
  })
);
const current = () => {
  const captured = { version, userId: getUserId(), token: getToken() };
  return () =>
    active && captured.version === version && captured.userId === getUserId() && captured.token === getToken();
};
onShow(() => {
  active = true;
});
onHide(() => {
  active = false;
  version++;
  clearTimeout(redirectTimer);
  year.value = '';
  month.value = '';
});
onUnmounted(() => {
  active = false;
  version++;
  clearTimeout(redirectTimer);
  year.value = '';
  month.value = '';
  ageTicket = '';
});
const registration = () => ({ region: region.value, ...(region.value === 'US' && ageTicket ? { ageTicket } : {}) });
function consent() {
  if (!agreedToTerms.value) {
    error.value = t('login.consent');
    return false;
  }
  return true;
}
function changeRegion(value) {
  if (busy.value || !chooseLoginRegion(value)) return;
  region.value = value;
  version++;
  clearDrafts();
  step.value = 'methods';
}
function clearDrafts() {
  year.value = '';
  month.value = '';
  phone.value = '';
  phoneSent.value = false;
  phoneCode.value = '';
  emailForm.value = { email: '', password: '', code: '' };
  ageTicket = '';
  ageExpiresAt = 0;
  error.value = '';
}
function back() {
  if (busy.value) return;
  if (step.value !== 'methods') {
    year.value = '';
    month.value = '';
    step.value = 'methods';
    error.value = '';
  } else safeNavigateBack();
}
function needsAge() {
  return region.value === 'US' && !getToken() && (!ageTicket || ageExpiresAt <= Date.now());
}
async function selectMethod(method) {
  if (!consent() || busy.value || !methods.value.includes(method)) return;
  error.value = '';
  if (region.value === 'US' && age.isBlocked()) {
    clearDrafts();
    step.value = 'blocked';
    return;
  }
  pendingMethod = method;
  if (needsAge()) {
    step.value = 'age';
    return;
  }
  await proceed(method);
}
async function submitAge() {
  if (!consent() || busy.value) return;
  if (age.isBlocked()) {
    step.value = 'blocked';
    return;
  }
  const eligible = isAgeEligible(year.value, month.value);
  if (eligible === null) {
    error.value = t('login.invalidBirth');
    return;
  }
  if (!eligible) {
    age.block();
    clearDrafts();
    step.value = 'blocked';
    return;
  }
  const birth = { year: Number(year.value), month: Number(month.value) };
  ageTicket = '';
  ageExpiresAt = 0;
  year.value = '';
  month.value = '';
  const response = await run(() => authStore.regionalLogin({ type: 'age_confirm', region: 'US', ...birth }));
  if (response?.errorCode === 'AGE_BLOCKED') {
    age.block();
    clearDrafts();
    step.value = 'blocked';
    return;
  }
  if (response?.code === 0 && response.data?.ticket) {
    ageTicket = response.data.ticket;
    ageExpiresAt = response.data.expiresAt;
  }
  if (ageTicket && active) await proceed(pendingMethod);
}
async function proceed(method) {
  if (['email', 'phone'].includes(method)) {
    step.value = method;
    return;
  }
  if (method === 'wechat') return wechat();
  await run(async () => {
    const valid = current();
    const challenge = await authStore.regionalLogin({ type: method, action: 'begin', platform, ...registration() });
    if (!valid()) return null;
    if (challenge.code !== 0) return challenge;
    const identityToken = await requestProviderToken(method, challenge.data, platform);
    if (!valid()) return null;
    return authStore.regionalLogin({
      type: method,
      identityToken,
      session: challenge.data.session,
      platform,
      ...registration()
    });
  }, true);
}
async function run(action, accept = false) {
  if (!consent() || busy.value) return;
  const valid = current();
  busy.value = true;
  error.value = '';
  try {
    const response = await action();
    if (!valid() || !response) return;
    if (response.code !== 0) {
      error.value = loginErrorText(response);
      if (response.errorCode === 'AGE_CONFIRMATION_REQUIRED' && region.value === 'US') {
        ageTicket = '';
        ageExpiresAt = 0;
        year.value = '';
        month.value = '';
        step.value = 'age';
      }
    } else if (accept && response.data) saveLoginInfo(response.data);
    return response;
  } catch {
    if (valid()) error.value = t('login.retry');
  } finally {
    busy.value = false;
  }
}
async function sendPhone() {
  if (needsAge()) {
    pendingMethod = 'phone';
    step.value = 'age';
    return;
  }
  const response = await run(() =>
    authStore.regionalLogin({
      type: 'phone',
      action: 'send',
      phone: phone.value,
      prefix: prefix.value,
      idempotencyKey: randomRequestId(),
      ...registration()
    })
  );
  if (response?.code === 0) {
    phoneSent.value = true;
    phoneCooldown.value = response.data?.retryAfter || 60;
  }
}
function randomRequestId() {
  const bytes = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues) return `${Date.now()}_phone_request`;
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function submitPhone() {
  if (needsAge()) {
    pendingMethod = 'phone';
    step.value = 'age';
    return;
  }
  await run(
    () =>
      authStore.regionalLogin({
        type: 'phone',
        phone: phone.value,
        prefix: prefix.value,
        verifyCode: phoneCode.value,
        ...registration()
      }),
    true
  );
}
async function sendEmail() {
  if (needsAge()) {
    pendingMethod = 'email';
    step.value = 'age';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.value.email)) {
    error.value = t('login.invalidEmail');
    return;
  }
  const response = await run(() => authStore.sendEmailCode(normalizeEmailAddress(emailForm.value.email)));
  if (response?.code === 0) {
    emailCooldown.value = response.retryAfter || 60;
    error.value = t('login.sent');
  } else if (response?.code === -1) {
    emailCooldown.value = 60;
    error.value = t('login.networkCode');
  }
}
async function submitEmail() {
  if (isRegister.value && needsAge()) {
    pendingMethod = 'email';
    step.value = 'age';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.value.email)) {
    error.value = t('login.invalidEmail');
    return;
  }
  if (
    emailForm.value.password.length < 8 ||
    emailForm.value.password.length > 32 ||
    (isRegister.value &&
      (!/[A-Z]/.test(emailForm.value.password) ||
        !/[a-z]/.test(emailForm.value.password) ||
        !/\d/.test(emailForm.value.password)))
  ) {
    error.value = t('login.passwordHelp');
    return;
  }
  if (isRegister.value && !/^\d{6}$/.test(emailForm.value.code)) {
    error.value = t('login.invalidCode');
    return;
  }
  await run(
    () =>
      authStore.loginByEmail({
        email: normalizeEmailAddress(emailForm.value.email),
        password: emailForm.value.password,
        verifyCode: isRegister.value ? emailForm.value.code : undefined,
        ...registration()
      }),
    true
  );
}
function toggleRegister() {
  isRegister.value = !isRegister.value;
  emailForm.value.code = '';
  showPassword.value = false;
  error.value = '';
}
async function wechat() {
  await run(async () => {
    if (desktop)
      return loginDesktopOAuth('wechat', authStore.desktopOAuth, current(), () => {
        error.value = t('login.browser');
      });
    if (platform === 'app')
      return loginNativeWechat(uni, (params) => authStore.loginByWechat({ ...params, ...registration() }), current());
    if (platform === 'mp-weixin') {
      const valid = current();
      const result = await new Promise((resolve, reject) =>
        uni.login({ provider: 'weixin', success: resolve, fail: reject })
      );
      if (!valid()) return null;
      return authStore.loginByWechat({ code: result.code, ...registration() });
    }
    const mode = isWeChatBrowser ? 'h5' : 'website';
    location.href = beginWebOAuth(
      'wechat',
      mode === 'h5' ? config.wx.gzhAppId : config.wx.webAppId,
      mode === 'website' ? config.wx.webRedirectUri : '',
      { wechatMode: mode }
    );
    return null;
  }, true);
}
function saveLoginInfo(data) {
  if (!data.token || !data.userId) {
    error.value = t('login.retry');
    return;
  }
  const userInfo = {
    uid: data.userId,
    _id: data.userId,
    userId: data.userId,
    nickName: data.userInfo?.nickname || t('login.learner'),
    avatarUrl: data.userInfo?.avatar_url || ''
  };
  storageService.save('userInfo', userInfo);
  storageService.save('EXAM_TOKEN', data.token, true);
  storageService.save('EXAM_USER_ID', data.userId, true);
  storageService.migrateUserKeys();
  const userStore = useUserStore();
  userStore.setUserInfo?.(userInfo);
  userStore.setToken?.(data.token);
  uni.$emit('loginStatusChanged', true);
  uni.$emit('userInfoUpdated', userInfo);
  emailForm.value = { email: '', password: '', code: '' };
  phone.value = '';
  phoneSent.value = false;
  phoneCode.value = '';
  ageTicket = '';
  const valid = current();
  clearTimeout(redirectTimer);
  redirectTimer = setTimeout(() => {
    if (valid()) navigateAfterLogin();
  }, 1500);
}
function navigateAfterLogin() {
  const redirect = storageService.get('redirect_after_login');
  storageService.remove('redirect_after_login');
  if (typeof redirect === 'string' && /^\/pages\/[a-zA-Z0-9_/-]+$/.test(redirect))
    uni.redirectTo({ url: redirect, fail: () => openHomeTab() });
  else openHomeTab();
}
function openPrivacy() {
  safeNavigateTo('/pages/settings/privacy');
}
function openTerms() {
  safeNavigateTo('/pages/settings/terms');
}
onMounted(async () => {
  if (platform === 'app')
    uni.getProvider({
      service: 'oauth',
      success: (result) => {
        if (active) providers.value = result.provider || [];
      }
    });
  const valid = current();
  try {
    const response = await authStore.regionalLogin({
      type: 'capabilities',
      platform,
      wechatMode: isWeChatBrowser ? 'h5' : 'website'
    });
    if (valid() && response.code === 0) capabilities.value = response.data || {};
  } catch {
    /* hide unavailable providers */
  }
});
</script>
<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: var(--s-4) var(--s-5) var(--s-8);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
}
.login-top {
  display: flex;
  gap: var(--s-2);
  align-items: center;
  justify-content: space-between;
  max-width: 960px;
  margin: 0 auto;
  padding-top: max(var(--yozi-nav-top, 0px), env(safe-area-inset-top));
  flex-wrap: wrap;
}
.login-content {
  max-width: 420px;
  margin: var(--s-8) auto 0;
}
.login-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-3);
  text-align: center;
  margin-bottom: var(--s-6);
}
.login-title {
  display: block;
  font-size: var(--size-title-1);
  font-weight: var(--weight-bold);
  line-height: var(--leading-title-1);
}
.login-subtitle,
.login-offline {
  color: var(--ink-3);
  font-size: var(--size-small);
  line-height: var(--leading-body);
}
.login-stack {
  display: grid;
  gap: var(--s-4);
}
.login-agreement {
  margin-top: var(--s-6);
}
.policy-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-min);
  color: var(--violet);
  cursor: pointer;
}
.policy-link:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: var(--focus-offset);
}
.login-error {
  display: block;
  color: var(--coral);
  font-size: var(--size-small);
  line-height: var(--leading-body);
  margin-top: var(--s-4);
}
.login-offline {
  display: grid;
  gap: var(--s-2);
  text-align: center;
  margin-top: var(--s-6);
}
@media (max-width: 480px) {
  .login-top {
    flex-wrap: wrap;
  }
  .login-content {
    margin-top: var(--s-6);
  }
}
</style>
