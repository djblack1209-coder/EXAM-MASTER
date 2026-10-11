import { ref, readonly } from 'vue';
import shell, { PAGE_TITLE_KEYS } from './messages/shell.js';
import settings from './messages/settings.js';
import components from './messages/components.js';

export const LANGUAGE_KEY = 'yozi_language';
export const LANGUAGE_OPTIONS = Object.freeze([
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' }
]);
const language = ref('zh-CN');
export const currentLanguage = readonly(language);
const messages = {
  'zh-CN': { ...shell['zh-CN'], ...settings['zh-CN'], ...components['zh-CN'] },
  en: { ...shell.en, ...settings.en, ...components.en }
};
let listening = false;

export function normalizeLanguage(value) {
  if (typeof value !== 'string') return null;
  const tag = value.trim().replace(/_/g, '-').toLowerCase();
  if (/^en(?:-|$)/.test(tag)) return 'en';
  if (/^zh(?:-|$)/.test(tag)) return 'zh-CN';
  return null;
}

export function resolveLanguage(saved, system) {
  return normalizeLanguage(saved) || normalizeLanguage(system) || 'zh-CN';
}

export function t(key, params = {}) {
  const text = messages[language.value][key] ?? messages['zh-CN'][key] ?? key;
  return String(text).replace(/\{([\w]+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

export function syncNavigationTitle() {
  if (typeof getCurrentPages !== 'function' || typeof uni === 'undefined') return;
  let pages;
  try {
    pages = getCurrentPages();
  } catch {
    return;
  }
  const page = pages?.[pages.length - 1];
  const key = PAGE_TITLE_KEYS[(page?.route || page?.__route__ || '').replace(/^\//, '')];
  if (key) {
    try {
      uni.setNavigationBarTitle?.({ title: t(key) })?.catch?.(() => undefined);
    } catch {
      /* 页面尚未准备好时由 onShow 重试。 */
    }
  }
}

function applyLanguage(value) {
  language.value = value;
  // uni 内置简体中文标识为 zh-Hans；产品对外标识为 zh-CN。
  if (typeof uni !== 'undefined') uni.setLocale?.(value === 'en' ? 'en' : 'zh-Hans');
  // #ifdef H5
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  // #endif
  syncNavigationTitle();
}

export function setLanguage(value) {
  const normalized = normalizeLanguage(value);
  if (!normalized) return false;
  try {
    uni.setStorageSync(LANGUAGE_KEY, normalized);
  } catch {
    return false;
  }
  applyLanguage(normalized);
  return true;
}

export function initI18n() {
  let saved;
  try {
    saved = uni.getStorageSync(LANGUAGE_KEY);
  } catch {
    /* 默认中文。 */
  }
  // 中文为主：不跟随系统语言，只有用户明确选择 English 才切换。
  applyLanguage(resolveLanguage(saved));
  if (!listening && typeof uni !== 'undefined' && typeof uni.onLocaleChange === 'function') {
    uni.onLocaleChange(({ locale }) => {
      const normalized = normalizeLanguage(locale);
      if (normalized && normalized !== language.value) applyLanguage(normalized);
    });
    listening = true;
  }
  return language.value;
}

export function installI18n(app) {
  app.config.globalProperties.$t = t;
  app.mixin({
    onShow() {
      syncNavigationTitle();
    }
  });
}
