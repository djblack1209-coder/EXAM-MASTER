import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/modules/auth.js';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/services/api/domains/_request-core.js', () => ({
  request: mocks.request,
  normalizeError: () => ({ code: -1, message: '登录请求失败，请重试' })
}));

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  uni.setStorageSync('yozi_login_region', 'CN');
});

describe('网站微信沿现有认证 Store 与 API 登录', () => {
  it('真实 Store 导出网站 action，只发送网站类型和一次性 code，不携带旧身份或自动重试', async () => {
    const response = { code: 0, data: { userId: 'isolated-user', token: 'isolated-session' } };
    mocks.request.mockResolvedValueOnce(response);
    const store = useAuthStore();
    expect(await store.loginByWechatWeb('isolated-web-code')).toEqual(response);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(
      '/login',
      { type: 'wechat_web', code: 'isolated-web-code', region: 'CN' },
      { skipAuth: true, maxRetries: 0, coldStartRetries: 0, redactErrors: true, suppressAuthFailure: true }
    );
    expect(store.token).toBe('');
    expect(store.isLogin).toBe(false);
  });
  it('失败沿现有错误回执返回，未重放授权码或保存登录身份', async () => {
    mocks.request.mockRejectedValueOnce(new Error('private-provider-error'));
    const store = useAuthStore();
    const response = await store.loginByWechatWeb('isolated-web-code');
    expect(response.code).toBe(-1);
    expect(JSON.stringify(response)).not.toContain('private-provider-error');
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(store.token).toBe('');
  });
});
