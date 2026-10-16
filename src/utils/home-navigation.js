import { logger } from '@/utils/logger.js';

export const HOME_TAB_URL = '/pages/index/index';
export const LEARNING_ENTRY_URL = '/pages/learning/index';

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
    learningEntry = false,
    verifyDelays = [350, 1200, 2500],
    schedule = (callback, delay) => setTimeout(callback, delay),
    isCurrent = () => true,
    onSuccess,
    onFail
  } = options;
  const destination = learningEntry ? LEARNING_ENTRY_URL : HOME_TAB_URL;
  let settled = false;
  let fallbackStarted = false;

  const cancelled = () => {
    if (settled) return true;
    if (!isCurrent()) {
      settled = true;
      return true;
    }
    return false;
  };

  const finishSuccess = () => {
    if (cancelled()) return;
    settled = true;
    onSuccess?.();
  };

  const finishFail = (error) => {
    if (cancelled()) return;
    settled = true;
    onFail?.(error);
  };

  const verifyRoute = (source, error) => {
    if (cancelled()) return;
    if (normalizeRoute(getCurrentRoute()) === normalizeRoute(destination)) {
      finishSuccess();
      return;
    }

    if (!fallbackStarted) {
      fallbackStarted = true;
      logger.warn('[home-navigation] [省略] did not land on home, trying reLaunch', error);
      uni.reLaunch({
        url: destination,
        success: () => scheduleVerification('reLaunch'),
        fail: (err2) => {
          if (cancelled()) return;
          logger.warn('[home-navigation] reLaunch failed, trying redirectTo', err2);
          uni.redirectTo({
            url: destination,
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

  const navigationOptions = {
    url: destination,
    success: () => scheduleVerification(learningEntry ? 'redirectTo' : 'switchTab'),
    fail: (err1) => {
      if (cancelled()) return;
      logger.warn('[home-navigation] [省略] failed, trying reLaunch', err1);
      uni.reLaunch({
        url: destination,
        success: () => scheduleVerification('reLaunch'),
        fail: (err2) => {
          if (cancelled()) return;
          logger.warn('[home-navigation] reLaunch failed, trying redirectTo', err2);
          uni.redirectTo({
            url: destination,
            success: () => scheduleVerification('redirectTo'),
            fail: (err3) => {
              logger.error('[home-navigation] all home navigation attempts failed', err3);
              finishFail(err3);
            }
          });
        }
      });
    }
  };
  // H5 imports uni APIs from static member access; computed access leaves an empty global uni object.
  if (learningEntry) uni.redirectTo(navigationOptions);
  else uni.switchTab(navigationOptions);
}

export function openLearningEntry(options = {}) {
  return openHomeTab({ ...options, learningEntry: true });
}

export default openHomeTab;
