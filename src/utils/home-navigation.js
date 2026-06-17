import { logger } from '@/utils/logger.js';

export const HOME_TAB_URL = '/pages/index/index';

function normalizeRoute(route) {
  return String(route || '')
    .replace(/^\//, '')
    .split('?')[0];
}

export function getCurrentRoute() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const current = pages.length > 0 ? pages[pages.length - 1] : null;
    return normalizeRoute(current?.route || current?.__route__ || '');
  } catch (_error) {
    return '';
  }
}

export function isHomeRoute(route = getCurrentRoute()) {
  return normalizeRoute(route) === normalizeRoute(HOME_TAB_URL);
}

export function openHomeTab(options = {}) {
  const {
    verifyDelays = [350, 1200, 2500],
    schedule = (callback, delay) => setTimeout(callback, delay),
    onSuccess,
    onFail
  } = options;
  let settled = false;
  let fallbackStarted = false;

  const finishSuccess = () => {
    if (settled) return;
    settled = true;
    onSuccess?.();
  };

  const finishFail = (error) => {
    if (settled) return;
    settled = true;
    onFail?.(error);
  };

  const verifyRoute = (source, error) => {
    if (settled) return;
    if (isHomeRoute()) {
      finishSuccess();
      return;
    }

    if (!fallbackStarted) {
      fallbackStarted = true;
      logger.warn(`[home-navigation] ${source} did not land on home, trying reLaunch`, error);
      uni.reLaunch({
        url: HOME_TAB_URL,
        success: () => scheduleVerification('reLaunch'),
        fail: (err2) => {
          logger.warn('[home-navigation] reLaunch failed, trying redirectTo', err2);
          uni.redirectTo({
            url: HOME_TAB_URL,
            success: () => scheduleVerification('redirectTo'),
            fail: (err3) => {
              logger.error('[home-navigation] all home navigation attempts failed', err3);
              finishFail(err3);
            }
          });
        }
      });
      return;
    }

    finishFail(error || new Error(`Home navigation stuck on ${getCurrentRoute() || 'unknown route'}`));
  };

  const scheduleVerification = (source, error) => {
    for (const delay of verifyDelays) {
      schedule(() => verifyRoute(source, error), delay);
    }
  };

  uni.switchTab({
    url: HOME_TAB_URL,
    success: () => scheduleVerification('switchTab'),
    fail: (err1) => {
      logger.warn('[home-navigation] switchTab failed, trying reLaunch', err1);
      uni.reLaunch({
        url: HOME_TAB_URL,
        success: () => scheduleVerification('reLaunch'),
        fail: (err2) => {
          logger.warn('[home-navigation] reLaunch failed, trying redirectTo', err2);
          uni.redirectTo({
            url: HOME_TAB_URL,
            success: () => scheduleVerification('redirectTo'),
            fail: (err3) => {
              logger.error('[home-navigation] all home navigation attempts failed', err3);
              finishFail(err3);
            }
          });
        }
      });
    }
  });
}

export default openHomeTab;
