/**
 * 触觉反馈工具 - 安全封装 uni.vibrateShort
 * 震动失败不影响业务逻辑，静默忽略错误
 *
 * @module haptic
 */

export const HAPTIC_STORAGE_KEY = 'quiz_haptic_enabled';

let _hapticEnabled = true;

try {
  const stored = uni.getStorageSync(HAPTIC_STORAGE_KEY);
  if (stored === false) {
    _hapticEnabled = false;
  }
} catch (_) {
  _hapticEnabled = true;
}

/**
 * 触发短震动反馈（安全调用，失败静默忽略）
 * @param {'light'|'medium'|'heavy'} [type='light'] - 震动强度
 */
export function vibrateLight(type = 'light') {
  if (!_hapticEnabled) return false;

  try {
    if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type });
      return true;
    }
  } catch (_) {
    // 震动反馈失败不影响业务逻辑
  }

  return false;
}

export function setHapticEnabled(enabled) {
  _hapticEnabled = !!enabled;
  try {
    uni.setStorageSync(HAPTIC_STORAGE_KEY, _hapticEnabled);
  } catch (_) {
    // 偏好保存失败不影响业务
  }
}

export function isHapticEnabled() {
  return _hapticEnabled;
}
