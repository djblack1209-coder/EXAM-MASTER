// Only compiled uni-app App Service / WeChat logic bundles have one identity writer.
// H5 (including Tauri WKWebView/WebView2) always requires the origin-wide Web Lock.
export const singleIdentityContext = () => ['app', 'app-plus', 'mp-weixin'].includes(import.meta.env?.UNI_PLATFORM);
export const supportsIdentityWrites = () =>
  singleIdentityContext() || typeof globalThis.navigator?.locks?.request === 'function';
export const browserUpgradeRequired = () =>
  Object.assign(new Error('当前浏览器版本过旧，请升级后登录'), { code: 'BROWSER_UPGRADE_REQUIRED' });

export function withIdentityLock(write) {
  if (!supportsIdentityWrites()) throw browserUpgradeRequired();
  const locks = globalThis.navigator?.locks;
  return locks?.request ? locks.request('exam-master:login-session-v1', { mode: 'exclusive' }, write) : write();
}
