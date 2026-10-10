import { invoke } from '@tauri-apps/api/core';
import { isDesktopRuntime } from './runtime.js';

const HEX = /^[a-f0-9]{64}$/;
const message = '账户或页面已变化，请重新登录';

export async function loginDesktopOAuth(provider, exchange, isCurrent = () => true, onOpened) {
  if (!isDesktopRuntime() || !['qq', 'wechat'].includes(provider)) throw new Error('此操作需要Yozi AI桌面应用');
  if (!isCurrent()) throw new Error(message);
  const proof = await invoke('create_desktop_oauth_proof').catch(() => {
    throw new Error('当前环境不支持安全授权，请使用邮箱登录');
  });
  if (
    typeof proof?.verifier !== 'string' ||
    !HEX.test(proof.verifier) ||
    typeof proof?.challenge !== 'string' ||
    !HEX.test(proof.challenge)
  ) {
    throw new Error('当前环境不支持安全授权，请使用邮箱登录');
  }
  const { verifier, challenge } = proof;
  let sessionId;
  let finished = false;
  let interval = 3;
  try {
    if (!isCurrent()) throw new Error(message);
    const start = await exchange({ action: 'begin', provider, challenge });
    if (start?.code !== 0) throw new Error(start?.message || '桌面授权未完成，请重新登录');
    sessionId = start.data?.sessionId;
    if (
      !HEX.test(sessionId || '') ||
      typeof start.data?.authorizationUrl !== 'string' ||
      !Number.isInteger(start.data?.expiresIn) ||
      start.data.expiresIn < 1 ||
      start.data.expiresIn > 600 ||
      !Number.isInteger(start.data?.interval) ||
      start.data.interval < 3 ||
      start.data.interval > 30
    ) {
      throw new Error('桌面授权结果无效，请重新登录');
    }
    interval = start.data.interval;
    const deadline = Date.now() + start.data.expiresIn * 1000;
    if (!isCurrent()) throw new Error(message);
    await invoke('open_desktop_oauth', { provider, url: start.data.authorizationUrl }).catch(() => {
      throw new Error('无法打开系统浏览器，请重新登录');
    });
    if (!isCurrent()) throw new Error(message);
    onOpened?.();
    while (Date.now() < deadline) {
      // Bounded checks let page/account changes stop polling promptly.
      const next = Date.now() + interval * 1000;
      while (Date.now() < next) {
        if (!isCurrent()) throw new Error(message);
        await new Promise((resolve) => setTimeout(resolve, Math.min(200, next - Date.now())));
      }
      if (Date.now() >= deadline) break;
      if (!isCurrent()) throw new Error(message);
      const result = await exchange({ action: 'poll', sessionId, verifier });
      if (!isCurrent()) throw new Error(message);
      if (Date.now() >= deadline) throw new Error('桌面授权已超时，请重新登录');
      if (result?.code !== 0) throw new Error(result?.message || '桌面授权未完成，请重新登录');
      if (result.data?.status === 'pending') {
        if (!Number.isInteger(result.data.interval) || result.data.interval < 3 || result.data.interval > 30) {
          throw new Error('桌面授权结果无效，请重新登录');
        }
        interval = result.data.interval;
        continue;
      }
      if (!result.data?.token || !(result.data?.userId || result.data?._id))
        throw new Error('登录结果不完整，请重新登录');
      finished = true;
      await invoke('focus_desktop_after_oauth').catch(() => undefined);
      if (!isCurrent()) throw new Error(message);
      return result;
    }
    throw new Error('桌面授权已超时，请重新登录');
  } finally {
    if (!finished && typeof sessionId === 'string' && HEX.test(sessionId)) {
      // A failed cancellation still expires server-side; never reopen or replay.
      await exchange({ action: 'cancel', sessionId, verifier }).catch(() => undefined);
    }
  }
}
