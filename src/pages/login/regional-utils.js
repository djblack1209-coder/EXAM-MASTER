import { t } from '@/i18n/index.js';
export function availableLoginMethods(
  region,
  { platform = 'h5', os = '', providers = [], capabilities = {}, desktop = false } = {}
) {
  if (platform === 'mp-weixin') return [...(capabilities.wechat ? ['wechat'] : []), 'phone', 'email'];
  const app = platform === 'app';
  const apple =
    !desktop &&
    capabilities.apple &&
    (region === 'US' || (app && os === 'ios')) &&
    (!app || providers.includes('apple'));
  const google = !desktop && region === 'US' && capabilities.google && (!app || providers.includes('google'));
  const wechat = region === 'CN' && capabilities.wechat && (!app || providers.includes('weixin'));
  return region === 'US'
    ? [...(apple ? ['apple'] : []), ...(google ? ['google'] : []), 'email', 'phone']
    : ['phone', ...(wechat ? ['wechat'] : []), 'email', ...(apple ? ['apple'] : [])];
}
export function isAgeEligible(year, month, now = new Date()) {
  if (
    !/^\d{4}$/.test(String(year)) ||
    !/^\d{1,2}$/.test(String(month)) ||
    Number(year) < 1900 ||
    Number(month) < 1 ||
    Number(month) > 12
  )
    return null;
  const age = now.getUTCFullYear() * 12 + now.getUTCMonth() - (Number(year) * 12 + Number(month) - 1);
  if (age < 0) return null;
  return age > 156;
}
export function createAgeSession(runtime, now = Date.now) {
  const key = 'yozi_age_block',
    ttl = 24 * 60 * 60_000;
  let blocked = false;
  try {
    const record = runtime ? runtime.getStorageSync(key) : uni.getStorageSync(key);
    blocked = record?.blocked === true && Number.isFinite(record.expiresAt) && record.expiresAt > now();
  } catch {
    /* session latch still applies */
  }
  return {
    isBlocked: () => blocked,
    block() {
      blocked = true;
      try {
        const marker = { blocked: true, expiresAt: now() + ttl };
        if (runtime) runtime.setStorageSync(key, marker);
        else uni.setStorageSync(key, marker);
      } catch {
        /* never release the in-memory latch */
      }
    }
  };
}
export function loginErrorText(response) {
  const key = Object.assign(Object.create(null), {
    SMS_DISABLED: 'smsClosed',
    PROVIDER_DISABLED: 'providerClosed',
    PROVIDER_UNAVAILABLE: 'providerClosed',
    SMS_UNAVAILABLE: 'retry',
    RATE_LIMITED: 'rate',
    AGE_BLOCKED: 'blocked',
    AGE_CONFIRMATION_REQUIRED: 'confirmAgain',
    INVALID_BIRTH_MONTH: 'invalidBirth',
    INVALID_PHONE: 'invalidPhone',
    INVALID_PHONE_CODE: 'invalidCode',
    INVALID_IDENTITY_TOKEN: 'retry',
    IDENTITY_REPLAY: 'retry',
    REGION_REQUIRED: 'regionRequired',
    INVALID_REGION: 'regionRequired',
    UNSUPPORTED_LOGIN: 'unsupported'
  })[response?.errorCode || response?.message];
  return t(`login.${key || (response?.code === 429 ? 'rate' : 'retry')}`);
}
let ageSession;
export function getAgeSession() {
  return (ageSession ||= createAgeSession());
}
