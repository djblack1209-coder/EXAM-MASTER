// Public provider SDKs are loaded only after an explicit sign-in action.
const scripts = new Map();
function loadScript(provider) {
  const urls = {
    apple: 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    google: 'https://accounts.google.com/gsi/client'
  };
  if (!scripts.has(provider))
    scripts.set(
      provider,
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timer = setTimeout(() => {
          script.remove();
          scripts.delete(provider);
          reject(new Error('PROVIDER_UNAVAILABLE'));
        }, 10_000);
        script.src = urls[provider];
        script.async = true;
        script.referrerPolicy = 'no-referrer';
        script.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        script.onerror = () => {
          clearTimeout(timer);
          script.remove();
          scripts.delete(provider);
          reject(new Error('PROVIDER_UNAVAILABLE'));
        };
        document.head.append(script);
      })
    );
  return scripts.get(provider);
}
export async function requestProviderToken(
  provider,
  challenge,
  platform,
  runtime = { login: (params) => uni.login(params), getUserInfo: (params) => uni.getUserInfo(params) }
) {
  if (!['apple', 'google'].includes(provider)) throw new Error('PROVIDER_UNAVAILABLE');
  if (platform === 'app')
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (token) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        typeof token === 'string' && token.length < 16_384 ? resolve(token) : reject(new Error('PROVIDER_UNAVAILABLE'));
      };
      const timer = setTimeout(() => finish(), 120_000);
      runtime.login({
        provider,
        nonce: challenge.nonce,
        success: (result) => {
          if (finished) return;
          const token =
            result?.appleInfo?.identityToken ||
            result?.authResult?.identityToken ||
            result?.authResult?.id_token ||
            result?.authResult?.idToken;
          if (token) return finish(token);
          runtime.getUserInfo({
            provider,
            success: (info) =>
              finish(info?.userInfo?.identityToken || info?.userInfo?.idToken || info?.userInfo?.id_token),
            fail: () => finish()
          });
        },
        fail: () => finish()
      });
    });
  await loadScript(provider);
  if (provider === 'apple') {
    globalThis.AppleID.auth.init({
      clientId: challenge.clientId,
      redirectURI: challenge.redirectUri,
      scope: 'email',
      nonce: challenge.nonce,
      state: challenge.session,
      usePopup: true
    });
    const result = await globalThis.AppleID.auth.signIn();
    if (result?.authorization?.state !== challenge.session) throw new Error('INVALID_IDENTITY_TOKEN');
    return result.authorization.id_token;
  }
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (token) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      token ? resolve(token) : reject(new Error('PROVIDER_UNAVAILABLE'));
    };
    const timer = setTimeout(() => finish(), 120_000);
    globalThis.google.accounts.id.initialize({
      client_id: challenge.clientId,
      nonce: challenge.nonce,
      auto_select: false,
      callback: (result) => finish(result?.credential)
    });
    globalThis.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) finish();
    });
  });
}
