import crypto from 'crypto';

export class LoginError extends Error {
  constructor(
    public errorCode: string,
    public code = 400
  ) {
    super(errorCode);
  }
}
export const fail = (errorCode: string, code = 400) => ({ code, success: false, errorCode, message: errorCode });
const HEX = /^[a-f0-9]{64}$/;
const LIFETIME = 10 * 60_000;
export const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export function isOver13(year: unknown, month: unknown, now = new Date()) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    Number(year) < 1900 ||
    Number(month) < 1 ||
    Number(month) > 12
  )
    throw new LoginError('INVALID_BIRTH_MONTH');
  const months = now.getUTCFullYear() * 12 + now.getUTCMonth() - (Number(year) * 12 + Number(month) - 1);
  if (months < 0) throw new LoginError('INVALID_BIRTH_MONTH');
  // With no day collected, eligibility starts after the entire 13th birthday month.
  return months > 13 * 12;
}
export async function confirmAge(body: any, collection: any, now = Date.now()) {
  if (body.region !== 'US') return fail('INVALID_REGION');
  if (!isOver13(body.year, body.month, new Date(now))) return fail('AGE_BLOCKED', 403);
  const ticket = crypto.randomBytes(32).toString('hex');
  await collection.add({
    _id: digest(ticket),
    purpose: 'age13',
    over13: true,
    confirmedAt: now,
    deadline: now + LIFETIME,
    used: false,
    expires_at: new Date(now + LIFETIME)
  });
  return { code: 0, data: { ticket, over13: true, confirmedAt: now, expiresAt: now + LIFETIME } };
}
export async function registrationFields(body: any, collection: any, now = Date.now()) {
  if (!['US', 'CN'].includes(body?.region)) throw new LoginError('REGION_REQUIRED');
  if (body.region === 'CN') return { registration_region: 'CN' };
  if (typeof body.ageTicket !== 'string' || !HEX.test(body.ageTicket))
    throw new LoginError('AGE_CONFIRMATION_REQUIRED', 403);
  const id = digest(body.ageTicket);
  const record = (await collection.doc(id).get())?.data;
  if (
    !record ||
    record.purpose !== 'age13' ||
    record.over13 !== true ||
    record.used ||
    !Number.isFinite(record.deadline) ||
    record.deadline <= now ||
    !Number.isFinite(record.confirmedAt) ||
    record.confirmedAt > now
  )
    throw new LoginError('AGE_CONFIRMATION_REQUIRED', 403);
  const changed = await collection
    .where({ _id: id, purpose: 'age13', used: false, deadline: record.deadline })
    .update({ used: true });
  if (changed?.updated !== 1) throw new LoginError('AGE_CONFIRMATION_REQUIRED', 403);
  return { registration_region: 'US', age_over13: true, age_confirmed_at: record.confirmedAt };
}

type Provider = 'apple' | 'google';
const OFFICIAL = { apple: 'https://appleid.apple.com/auth/keys', google: 'https://www.googleapis.com/oauth2/v3/certs' };
const cache = new Map<string, { keys: any[]; until: number }>();
const pending = new Map<string, Promise<any[]>>();
export function providerConfig(provider: Provider, platform: unknown, env = process.env) {
  if (!Object.hasOwn(OFFICIAL, provider)) return null;
  if (!['h5', 'app'].includes(String(platform))) return null;
  const prefix = provider.toUpperCase();
  const clientId = env[`${prefix}_${platform === 'app' ? 'APP' : 'WEB'}_CLIENT_ID`] || '';
  if (!clientId || clientId.length > 256) return null;
  const redirectUri = provider === 'apple' && platform === 'h5' ? env.APPLE_WEB_REDIRECT_URI || '' : '';
  if (provider === 'apple' && platform === 'h5') {
    try {
      const url = new URL(redirectUri);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    } catch {
      return null;
    }
  }
  return { clientId, redirectUri };
}
export async function fetchOfficialKeys(provider: Provider, fetcher: (options: any) => Promise<any>, now = Date.now()) {
  if (!Object.hasOwn(OFFICIAL, provider)) throw new LoginError('UNSUPPORTED_LOGIN');
  if (cache.get(provider)?.until > now) return cache.get(provider)!.keys;
  if (pending.has(provider)) return pending.get(provider)!;
  const request = (async () => {
    // URL is fixed; no token jku/x5u/discovery URL or redirect is followed.
    const response = await fetcher({
      url: OFFICIAL[provider],
      method: 'GET',
      timeout: 5000,
      maxRedirects: 0,
      maxContentLength: 64 * 1024
    });
    const keys = response?.data?.keys;
    if ((response.status && response.status !== 200) || !Array.isArray(keys) || !keys.length || keys.length > 16)
      throw new LoginError('PROVIDER_UNAVAILABLE', 503);
    cache.set(provider, { keys, until: now + 5 * 60_000 });
    return keys;
  })();
  pending.set(provider, request);
  try {
    return await request;
  } catch {
    throw new LoginError('PROVIDER_UNAVAILABLE', 503);
  } finally {
    pending.delete(provider);
  }
}
export function verifyIdentityToken(
  token: unknown,
  provider: Provider,
  audience: string,
  nonce: string,
  keys: any[],
  now = Date.now()
) {
  const invalid = () => {
    throw new LoginError('INVALID_IDENTITY_TOKEN', 401);
  };
  if (!audience) throw new LoginError('PROVIDER_DISABLED', 503);
  if (typeof token !== 'string' || token.length > 16_384) return invalid();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return invalid();
  let header: any, claims: any;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return invalid();
  }
  if (
    !claims ||
    typeof claims !== 'object' ||
    Array.isArray(claims) ||
    !['RS256', 'ES256'].includes(header?.alg) ||
    typeof header.kid !== 'string' ||
    header.crit ||
    header.jku ||
    header.x5u
  )
    return invalid();
  const key = keys.find(
    (k) =>
      k &&
      typeof k === 'object' &&
      k.kid === header.kid &&
      (!k.alg || k.alg === header.alg) &&
      (!k.use || k.use === 'sig') &&
      (!k.key_ops || k.key_ops.includes('verify'))
  );
  if (!key || (header.alg === 'RS256' ? key.kty !== 'RSA' : key.kty !== 'EC' || key.crv !== 'P-256')) return invalid();
  try {
    const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
    if (
      !crypto.verify(
        'sha256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        { key: publicKey, ...(header.alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}) },
        Buffer.from(parts[2], 'base64url')
      )
    )
      return invalid();
  } catch {
    return invalid();
  }
  const issuers =
    provider === 'apple' ? ['https://appleid.apple.com'] : ['https://accounts.google.com', 'accounts.google.com'];
  const seconds = Math.floor(now / 1000);
  if (
    !issuers.includes(claims.iss) ||
    claims.aud !== audience ||
    (claims.azp !== undefined && claims.azp !== audience) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= seconds ||
    !Number.isFinite(claims.iat) ||
    claims.iat > seconds + 60 ||
    (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds)) ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    claims.sub.length > 256 ||
    claims.nonce !== nonce ||
    !nonce
  )
    return invalid();
  if (
    provider === 'google' &&
    (claims.email_verified !== true ||
      typeof claims.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email))
  )
    return invalid();
  return { sub: claims.sub }; // Email is deliberately not an identity/merge key.
}
export async function beginProvider(
  provider: Provider,
  platform: any,
  collection: any,
  env = process.env,
  now = Date.now()
) {
  const config = providerConfig(provider, platform, env);
  if (!config) return fail('PROVIDER_DISABLED', 503);
  const nonce = crypto.randomBytes(32).toString('hex');
  const session = crypto.randomBytes(32).toString('hex');
  await collection.add({
    _id: digest(session),
    purpose: provider,
    platform,
    nonce,
    clientId: config.clientId,
    used: false,
    deadline: now + LIFETIME,
    expires_at: new Date(now + LIFETIME)
  });
  return { code: 0, data: { session, nonce, ...config } };
}
export async function providerIdentity(body: any, collection: any, fetcher: any, env = process.env, now = Date.now()) {
  const provider = body.type as Provider;
  const config = providerConfig(provider, body.platform, env);
  if (!config) throw new LoginError('PROVIDER_DISABLED', 503);
  if (typeof body.session !== 'string' || !HEX.test(body.session)) throw new LoginError('INVALID_IDENTITY_TOKEN', 401);
  const record = (await collection.doc(digest(body.session)).get())?.data;
  if (
    !record ||
    record.purpose !== provider ||
    record.platform !== body.platform ||
    record.clientId !== config.clientId ||
    record.used ||
    !Number.isFinite(record.deadline) ||
    record.deadline <= now
  )
    throw new LoginError('IDENTITY_REPLAY', 401);
  const identity = verifyIdentityToken(
    body.identityToken,
    provider,
    config.clientId,
    record.nonce,
    await fetchOfficialKeys(provider, fetcher, now),
    now
  );
  if (
    (await collection.where({ _id: record._id, used: false, deadline: record.deadline }).update({ used: true }))
      ?.updated !== 1
  )
    throw new LoginError('IDENTITY_REPLAY', 401);
  return { [`${provider}_client_id`]: config.clientId, [`${provider}_sub`]: identity.sub };
}

export function normalizePhone(prefix: unknown, number: unknown) {
  if (!['+1', '+86'].includes(String(prefix)) || typeof number !== 'string') throw new LoginError('INVALID_PHONE');
  const national = number.replace(/[ -]/g, '');
  if (!(prefix === '+1' ? /^[2-9]\d{2}[2-9]\d{6}$/.test(national) : /^1[3-9]\d{9}$/.test(national)))
    throw new LoginError('INVALID_PHONE');
  return String(prefix) + national;
}
// Dormant transport boundary. Production has no SMS adapter and cannot send SMS.
export async function sendPhoneCode(
  body: any,
  deps: {
    collection: any;
    limit: any;
    secret: string;
    enabled: boolean;
    authorized: boolean;
    send?: (phone: string, code: string) => Promise<void>;
    now?: () => number;
  }
) {
  const phone = normalizePhone(body.prefix, body.phone);
  if ((body.region === 'US' ? '+1' : body.region === 'CN' ? '+86' : '') !== body.prefix) return fail('INVALID_REGION');
  if (typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(body.idempotencyKey))
    return fail('INVALID_IDEMPOTENCY_KEY');
  if (!deps.enabled || !deps.authorized || !deps.secret || !deps.send) return fail('SMS_DISABLED', 503);
  const now = deps.now?.() ?? Date.now(),
    id = digest(phone),
    requestHash = digest(body.idempotencyKey);
  const record = (await deps.collection.doc(id).get())?.data;
  if (record && record.requestHash === requestHash && record.deadline > now)
    return record.status === 'sent'
      ? { code: 0, data: { retryAfter: Math.max(1, Math.ceil((record.nextSendAt - now) / 1000)) }, alreadySent: true }
      : fail('SMS_UNAVAILABLE', 503);
  if (record?.nextSendAt > now || !(await deps.limit(`sms:${id}`, 5, 3600_000)).allowed)
    return fail('RATE_LIMITED', 429);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = crypto.createHmac('sha256', deps.secret).update(`${phone}:${salt}:${code}`).digest('hex');
  const next = {
    requestHash,
    salt,
    codeHash,
    attempts: 0,
    used: false,
    status: 'pending',
    deadline: now + 5 * 60_000,
    nextSendAt: now + 60_000,
    expires_at: new Date(now + 3600_000)
  };
  try {
    if (!record) await deps.collection.add({ _id: id, ...next });
    else if (
      (
        await deps.collection
          .where({ _id: id, requestHash: record.requestHash, nextSendAt: record.nextSendAt })
          .update(next)
      )?.updated !== 1
    )
      return fail('RATE_LIMITED', 429);
  } catch {
    return fail('RATE_LIMITED', 429);
  }
  try {
    await deps.send(phone, code);
    await deps.collection.where({ _id: id, requestHash, status: 'pending' }).update({ status: 'sent' });
  } catch {
    return fail('SMS_UNAVAILABLE', 503);
  }
  return { code: 0, data: { retryAfter: 60 } };
}
export async function verifyPhoneCode(body: any, collection: any, secret: string, now = Date.now()) {
  const phone = normalizePhone(body.prefix, body.phone),
    id = digest(phone);
  if (typeof body.verifyCode !== 'string' || !/^\d{6}$/.test(body.verifyCode))
    throw new LoginError('INVALID_PHONE_CODE', 401);
  const record = (await collection.doc(id).get())?.data;
  if (
    !record ||
    record.used ||
    record.status !== 'sent' ||
    !Number.isFinite(record.deadline) ||
    record.deadline <= now ||
    !Number.isInteger(record.attempts) ||
    record.attempts < 0 ||
    record.attempts >= 5
  )
    throw new LoginError('INVALID_PHONE_CODE', 401);
  const attempts = record.attempts;
  // Reserve one attempt atomically before testing the secret, including concurrent failures.
  if (
    (
      await collection
        .where({ _id: id, used: false, requestHash: record.requestHash, attempts })
        .update({ attempts: attempts + 1 })
    )?.updated !== 1
  )
    throw new LoginError('INVALID_PHONE_CODE', 401);
  const actual = crypto.createHmac('sha256', secret).update(`${phone}:${record.salt}:${body.verifyCode}`).digest('hex');
  if (
    typeof record.codeHash !== 'string' ||
    record.codeHash.length !== 64 ||
    !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(record.codeHash))
  )
    throw new LoginError('INVALID_PHONE_CODE', 401);
  if (
    (
      await collection
        .where({ _id: id, used: false, requestHash: record.requestHash, attempts: attempts + 1 })
        .update({ used: true })
    )?.updated !== 1
  )
    throw new LoginError('INVALID_PHONE_CODE', 401);
  return phone;
}
