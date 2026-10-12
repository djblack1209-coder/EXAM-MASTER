import { tokens } from '@/design/tokens.js';

// Native APIs require raw colors; they come from the same build-time token source.
export function applyNativeTheme(theme) {
  if (typeof uni === 'undefined') return;
  const dark = theme === 'dark';
  const color = tokens[dark ? 'dark' : 'light']['--canvas'];
  const quiet = () => undefined;
  try {
    uni
      .setNavigationBarColor?.({ frontColor: dark ? '#ffffff' : '#000000', backgroundColor: color, fail: quiet })
      ?.catch?.(quiet);
    uni
      .setBackgroundColor?.({
        backgroundColor: color,
        backgroundColorTop: color,
        backgroundColorBottom: color,
        fail: quiet
      })
      ?.catch?.(quiet);
    uni.setBackgroundTextStyle?.({ textStyle: dark ? 'light' : 'dark', fail: quiet })?.catch?.(quiet);
  } catch {
    /* Old native clients keep the declarative theme fallback. */
  }
}

export function readNativeInsets() {
  const result = {};
  // #ifdef MP-WEIXIN
  if (typeof uni === 'undefined') return result;
  try {
    const info = uni.getWindowInfo?.() || uni.getSystemInfoSync();
    const capsule = uni.getMenuButtonBoundingClientRect?.();
    const status = Number(info.statusBarHeight) || 0;
    result['--yozi-status-top'] = `${status}px`;
    result['--yozi-nav-top'] = `${Math.max(status, Number(capsule?.bottom) || status)}px`;
    if (capsule?.left > 0 && info.windowWidth > capsule.left)
      result['--yozi-capsule-right'] = `${info.windowWidth - capsule.left}px`;
  } catch {
    /* CSS safe-area fallback remains available. */
  }
  // #endif
  return result;
}
