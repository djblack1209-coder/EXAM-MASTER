/**
 * 触觉反馈工具 - 安全封装 uni.vibrateShort
 * 震动失败不影响业务逻辑，静默忽略错误
 *
 * @module haptic
 */

/**
 * 触发短震动反馈（安全调用，失败静默忽略）
 * @param {'light'|'medium'|'heavy'} [type='light'] - 震动强度
 */
export function vibrateLight(type = 'light') {
  try {
    if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type });
    }
  } catch (_) {
    // 震动反馈失败不影响业务逻辑
  }
}
