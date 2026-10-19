import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { requestProviderToken } from '@/pages/login/provider-utils.js';
beforeEach(() => vi.stubEnv('VITE_ENABLE_US_LOGIN', 'true'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('native provider token boundary', () => {
  it.each([
    [
      'apple',
      {
        appleInfo: {
          identityToken: 'synthetic-id-token',
          email: 'fixture@example.invalid',
          fullName: { givenName: 'Fixture' }
        }
      }
    ],
    ['google', { authResult: { idToken: 'synthetic-id-token', access_token: 'synthetic-access-token' } }]
  ])('%s passes nonce and returns only the documented identity token', async (provider, result) => {
    const runtime = { login: vi.fn((options) => options.success(result)), getUserInfo: vi.fn() };
    expect(await requestProviderToken(provider, { nonce: 'synthetic-nonce' }, 'app', runtime)).toBe(
      'synthetic-id-token'
    );
    expect(runtime.login.mock.calls[0][0]).toMatchObject({ provider, nonce: 'synthetic-nonce' });
    expect(runtime.getUserInfo).not.toHaveBeenCalled();
  });
  it('user-info fallback consumes an ID token; timeout suppresses late personal-info lookup', async () => {
    vi.useFakeTimers();
    let late;
    const runtime = {
      login: vi.fn((options) => {
        late = options;
      }),
      getUserInfo: vi.fn((options) => options.success({ userInfo: { id_token: 'synthetic-id-token' } }))
    };
    const response = requestProviderToken('google', { nonce: 'synthetic-nonce' }, 'app', runtime);
    late.success({});
    expect(await response).toBe('synthetic-id-token');
    runtime.getUserInfo.mockClear();
    const expired = requestProviderToken('apple', { nonce: 'synthetic-nonce' }, 'app', runtime).catch(
      (error) => error.message
    );
    await vi.advanceTimersByTimeAsync(120000);
    expect(await expired).toBe('PROVIDER_UNAVAILABLE');
    late.success({});
    expect(runtime.getUserInfo).not.toHaveBeenCalled();
  });
  it('retired provider cannot load a script or start native auth', async () => {
    const runtime = { login: vi.fn() };
    await expect(requestProviderToken('qq', {}, 'app', runtime)).rejects.toThrow('PROVIDER_UNAVAILABLE');
    expect(runtime.login).not.toHaveBeenCalled();
  });
});
