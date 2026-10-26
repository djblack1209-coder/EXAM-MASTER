import { DEV_TEST } from '@/config/build-channel.js';
import { isDesktopRuntime } from './runtime.js';

let native;
async function bridge() {
  if (!DEV_TEST || !isDesktopRuntime()) return null;
  // #ifdef H5
  native ||= import('@tauri-apps/api/core');
  // #endif
  return native || null;
}
// No default language: the first fixed locale is a product decision.
export async function voiceCapability(locale) {
  if (!locale) return { supported: false, available: false, reason: 'locale_unselected' };
  const api = await bridge();
  return api
    ? api.invoke('voice_capability', { locale })
    : { supported: false, available: false, reason: 'platform_unsupported' };
}
export async function startVoice(locale, onEvent, assertCurrent) {
  const api = await bridge();
  if (!api || !locale) throw new Error('本机听写尚未开放');
  assertCurrent?.();
  const channel = new api.Channel();
  channel.onmessage = onEvent;
  return api.invoke('voice_start', { locale, onEvent: channel });
}
export async function stopVoice(sid) {
  const api = await bridge();
  if (api && sid) await api.invoke('voice_stop', { sid });
}
export async function cancelVoice(sid) {
  const api = await bridge();
  if (api && sid) await api.invoke('voice_cancel', { sid });
}
