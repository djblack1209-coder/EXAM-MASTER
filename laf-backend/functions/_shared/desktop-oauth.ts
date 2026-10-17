import { getClientIp, clientIpUnavailable } from './client-ip.js';
import crypto from 'crypto';
import { isIP } from 'net';

const CONTRACT = 'wenli-desktop-oauth-v1';
const LIFETIME = 10 * 60 * 1000;
const POLL_INTERVAL = 3000;
const HEX = /^[a-f0-9]{64}$/;
const STATES = ['pending', 'exchanging', 'ready', 'failed', 'cancelled', 'consumed'];

type Provider = 'wechat';
type ProviderConfig = { appId: string; redirectUri: string };
type Dependencies = {
  collection: any;
  enabled: boolean;
  secret: string;
  nativeOrigins: string[];
  config: (provider: Provider) => ProviderConfig | null;
  exchange: (provider: Provider, code: string, redirectUri: string) => Promise<any>;
  issue: (userId: string, isNewUser: boolean) => Promise<any>;
  pollAllowed: (ip: string) => Promise<boolean>;
  retentionConfigured: () => Promise<boolean>;
  now?: () => number;
};

export function desktopCallbackOrigin(provider: Provider, value: unknown): string | null {
  try {
    if (typeof value !== 'string' || value.length > 2048) return null;
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      url.pathname !== `/oauth/${provider}.html` ||
      !url.hostname.includes('.') ||
      isIP(url.hostname) ||
      /^(localhost|.*\.localhost|\[.*\])$/.test(url.hostname)
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function desktopAuthorizationUrl(provider: Provider, config: ProviderConfig, id: string): string {
  if (
    !HEX.test(id) ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(config.appId) ||
    !desktopCallbackOrigin(provider, config.redirectUri)
  )
    throw new Error('desktop configuration invalid');
  const url = new URL('https://open.weixin.qq.com/connect/qrconnect');
  url.searchParams.set('appid', config.appId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', `desktop_${id}`);
  url.searchParams.set('scope', 'snsapi_login');
  if (provider === 'wechat') url.hash = 'wechat_redirect';
  return url.href;
}

export async function handleDesktopOAuth(ctx: any, deps: Dependencies) {
  const now = deps.now || Date.now;
  const fail = (code: number, message = '桌面授权未完成，请重新登录') => ({ code, success: false, message });
  const body = ctx.body || {};
  if (ctx.method !== 'POST' || !['begin', 'complete', 'poll', 'cancel'].includes(body.action)) {
    return fail(400, '桌面授权参数无效');
  }
  if (!deps.enabled || !deps.secret) return fail(503, '桌面授权未配置，请使用邮箱登录');
  const action = body.action;
  const fields: Record<string, string[]> = {
    begin: ['type', 'action', 'provider', 'challenge'],
    complete: ['type', 'action', 'provider', 'state', 'code', 'error'],
    poll: ['type', 'action', 'sessionId', 'verifier'],
    cancel: ['type', 'action', 'sessionId', 'verifier']
  };
  if (Object.keys(body).some((key) => !fields[action].includes(key))) return fail(400, '桌面授权参数无效');
  const origin = ctx.headers?.origin || ctx.headers?.Origin;
  const native =
    typeof origin === 'string' &&
    deps.nativeOrigins.includes(origin) &&
    ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'].includes(origin);
  if (action !== 'complete' && !native) return fail(403, '桌面授权来源无效');
  // Bound unauthenticated proof attempts before any session read as well.
  if (['poll', 'cancel'].includes(action)) {
    const ip = getClientIp(ctx);
    if (!ip) return clientIpUnavailable();
    if (!(await deps.pollAllowed(ip))) return fail(429, '请求过于频繁，请稍后再试');
  }
  if (action === 'begin') {
    if (!['wechat'].includes(body.provider) || typeof body.challenge !== 'string' || !HEX.test(body.challenge)) {
      return fail(400, '桌面授权参数无效');
    }
    const provider = body.provider as Provider;
    const config = deps.config(provider);
    if (!config || !desktopCallbackOrigin(provider, config.redirectUri))
      return fail(503, '桌面授权未配置，请使用邮箱登录');
    if (!(await deps.retentionConfigured())) return fail(503, '桌面授权未配置，请使用邮箱登录');
    const id = crypto.randomBytes(32).toString('hex');
    const authorizationUrl = desktopAuthorizationUrl(provider, config, id);
    await deps.collection.add({
      _id: id,
      contract: CONTRACT,
      provider,
      appId: config.appId,
      redirectUri: config.redirectUri,
      nativeOrigin: origin,
      challenge: body.challenge,
      phase: 'pending',
      deadline: now() + LIFETIME,
      expires_at: new Date(now() + LIFETIME),
      pollAfter: 0
    });
    return {
      code: 0,
      data: { sessionId: id, authorizationUrl, expiresIn: LIFETIME / 1000, interval: POLL_INTERVAL / 1000 }
    };
  }
  const id =
    action === 'complete' && typeof body.state === 'string' && /^desktop_[a-f0-9]{64}$/.test(body.state)
      ? body.state.slice(8)
      : body.sessionId;
  if (typeof id !== 'string' || !HEX.test(id)) return fail(400, '桌面授权参数无效');
  const record = (await deps.collection.doc(id).get())?.data;
  if (
    !record ||
    record.contract !== CONTRACT ||
    !STATES.includes(record.phase) ||
    !Number.isFinite(record.deadline) ||
    record.deadline <= now()
  )
    return fail(401, '桌面授权已过期，请重新登录');
  const where = (phase: string) => ({ _id: id, contract: CONTRACT, phase, deadline: record.deadline });
  const change = async (phase: string, patch: any) =>
    (await deps.collection.where(where(phase)).update(patch))?.updated === 1;
  if (action === 'complete') {
    const config = deps.config(record.provider);
    if (
      body.provider !== record.provider ||
      !config ||
      config.appId !== record.appId ||
      config.redirectUri !== record.redirectUri ||
      origin !== desktopCallbackOrigin(record.provider, record.redirectUri)
    ) {
      return fail(403, '桌面授权来源或应用不一致');
    }
    if (record.phase !== 'pending') return fail(409, '本次桌面授权已处理，请返回桌面');
    if (!(await change('pending', { phase: 'exchanging' }))) return fail(409, '本次桌面授权已处理，请返回桌面');
    if (body.error !== undefined || typeof body.code !== 'string' || !/^[a-zA-Z0-9_-]{6,200}$/.test(body.code)) {
      await change('exchanging', { phase: 'failed', reason: body.error === 'access_denied' ? 'cancelled' : 'invalid' });
      return fail(
        body.error === 'access_denied' ? 401 : 400,
        body.error === 'access_denied' ? '用户取消授权' : '桌面授权参数无效'
      );
    }
    try {
      const result = await deps.exchange(record.provider, body.code, record.redirectUri);
      const userId = result?.code === 0 && result.data?.userId;
      if (typeof userId !== 'string' || userId.length > 128 || !userId || now() >= record.deadline) {
        await change('exchanging', { phase: 'failed', reason: 'exchange' });
        return fail(401);
      }
      // Store only an encrypted account reference; browser and Mongo never get a JWT.
      const key = crypto.createHmac('sha256', deps.secret).update(`${CONTRACT}:result`).digest();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(`${id}:${record.challenge}:${record.deadline}`));
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify({ userId, isNewUser: result.data.isNewUser === true })),
        cipher.final()
      ]);
      if (
        !(await change('exchanging', {
          phase: 'ready',
          result: { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), body: encrypted.toString('hex') }
        }))
      )
        return fail(409, '本次桌面授权已取消，请重新登录');
      return { code: 0, data: { desktopReady: true }, message: '授权已完成，请返回Yozi AI桌面应用' };
    } catch {
      await change('exchanging', { phase: 'failed', reason: 'exchange' });
      return fail(500);
    }
  }
  if (!native || origin !== record.nativeOrigin || typeof body.verifier !== 'string' || !HEX.test(body.verifier)) {
    return fail(403, '桌面授权校验失败');
  }
  const challenge = crypto.createHash('sha256').update(body.verifier).digest('hex');
  if (
    typeof record.challenge !== 'string' ||
    !HEX.test(record.challenge) ||
    !crypto.timingSafeEqual(Buffer.from(challenge, 'hex'), Buffer.from(record.challenge, 'hex'))
  )
    return fail(403, '桌面授权校验失败');
  if (action === 'cancel') {
    if (['pending', 'exchanging', 'ready'].includes(record.phase))
      await change(record.phase, { phase: 'cancelled', result: null });
    return { code: 0, data: { cancelled: true } };
  }
  if (record.phase === 'cancelled' || record.phase === 'failed')
    return fail(401, record.reason === 'cancelled' ? '用户取消授权' : '桌面授权未完成，请重新登录');
  if (record.phase === 'consumed') return fail(409, '本次桌面授权已领取，请重新登录');
  if (record.phase !== 'ready') {
    const pollAfter = Number(record.pollAfter) || 0;
    if (pollAfter <= now())
      await deps.collection.where({ ...where(record.phase), pollAfter }).update({ pollAfter: now() + POLL_INTERVAL });
    return { code: 0, data: { status: 'pending', interval: Math.max(3, Math.ceil((pollAfter - now()) / 1000)) } };
  }
  // Only the initiating desktop can atomically claim this reference once.
  if (!(await change('ready', { phase: 'consumed', result: null }))) return fail(409, '本次桌面授权已领取，请重新登录');
  try {
    const sealed = record.result;
    if (
      !sealed ||
      !/^[a-f0-9]{24}$/.test(sealed.iv) ||
      !/^[a-f0-9]{32}$/.test(sealed.tag) ||
      !/^[a-f0-9]{2,1024}$/.test(sealed.body)
    )
      return fail(401);
    const key = crypto.createHmac('sha256', deps.secret).update(`${CONTRACT}:result`).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'hex'));
    decipher.setAAD(Buffer.from(`${id}:${record.challenge}:${record.deadline}`));
    decipher.setAuthTag(Buffer.from(sealed.tag, 'hex'));
    const result = JSON.parse(
      Buffer.concat([decipher.update(Buffer.from(sealed.body, 'hex')), decipher.final()]).toString('utf8')
    );
    if (
      typeof result.userId !== 'string' ||
      !result.userId ||
      result.userId.length > 128 ||
      typeof result.isNewUser !== 'boolean'
    )
      return fail(401);
    if (now() >= record.deadline) return fail(401, '桌面授权已过期，请重新登录');
    const response = await deps.issue(result.userId, result.isNewUser);
    return now() < record.deadline ? response : fail(401, '桌面授权已过期，请重新登录');
  } catch {
    return fail(401);
  }
}
