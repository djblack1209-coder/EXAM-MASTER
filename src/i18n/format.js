import { currentLanguage } from './index.js';

function intlFormat(type, value, options, fallback) {
  const locale = currentLanguage.value === 'en' ? 'en-US' : 'zh-CN';
  try {
    if (typeof Intl !== 'undefined' && typeof Intl[type] === 'function')
      return new Intl[type](locale, options).format(value);
  } catch {
    /* 微信旧运行时、Intl 选项不完整时使用明确后备。 */
  }
  return fallback(currentLanguage.value === 'en');
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

const pad = (value) => String(value).padStart(2, '0');
export function formatDate(value) {
  const date = asDate(value);
  if (!date) return '';
  return intlFormat('DateTimeFormat', date, { year: 'numeric', month: '2-digit', day: '2-digit' }, (english) =>
    english
      ? `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`
      : `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
  );
}

export function formatTime(value) {
  const date = asDate(value);
  if (!date) return '';
  return intlFormat(
    'DateTimeFormat',
    date,
    { hour: '2-digit', minute: '2-digit', hour12: currentLanguage.value === 'en' },
    (english) => {
      const hour = date.getHours();
      return english
        ? `${pad(hour % 12 || 12)}:${pad(date.getMinutes())} ${hour < 12 ? 'AM' : 'PM'}`
        : `${pad(hour)}:${pad(date.getMinutes())}`;
    }
  );
}

export function formatNumber(value, { minimumFractionDigits = 0, maximumFractionDigits = 3, useGrouping = true } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const min = Math.max(0, Math.min(20, Math.trunc(Number(minimumFractionDigits)) || 0));
  const max = Math.max(min, Math.min(20, Math.trunc(Number(maximumFractionDigits)) || 0));
  return intlFormat(
    'NumberFormat',
    number,
    { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping },
    () => {
      const [whole, rawFraction = ''] = number.toFixed(max).split('.');
      const fraction = rawFraction.replace(/0+$/, '').padEnd(min, '0');
      const integer = useGrouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
      return integer + (fraction ? `.${fraction}` : '');
    }
  );
}
