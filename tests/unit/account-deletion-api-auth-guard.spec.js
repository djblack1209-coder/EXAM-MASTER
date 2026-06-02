import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

vi.mock('@/services/api/domains/_request-core.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, request };
});

describe('account deletion api auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.__mockStorage = {};
    request.mockResolvedValue({ code: 0, success: true, data: { ok: true } });
  });

  it('blocks account deletion actions when no auth credential is present', async () => {
    const api = await import('@/services/api/domains/user.api.js');

    const actions = [
      api.requestAccountDeletion(),
      api.cancelAccountDeletion(),
      api.getAccountDeletionStatus()
    ];

    const results = await Promise.all(actions);

    expect(request).not.toHaveBeenCalled();
    expect(results).toEqual([
      expect.objectContaining({ code: 401, success: false, message: '请先登录', data: null }),
      expect.objectContaining({ code: 401, success: false, message: '请先登录', data: null }),
      expect.objectContaining({ code: 401, success: false, message: '请先登录', data: null })
    ]);
  });

  it('keeps the explicit account-delete action payloads when auth exists', async () => {
    global.__mockStorage.EXAM_TOKEN = 'token_abc';
    const api = await import('@/services/api/domains/user.api.js');

    await api.requestAccountDeletion();
    await api.cancelAccountDeletion();
    await api.getAccountDeletionStatus();

    expect(request).toHaveBeenNthCalledWith(1, '/account-delete', { action: 'request' });
    expect(request).toHaveBeenNthCalledWith(2, '/account-delete', { action: 'cancel' });
    expect(request).toHaveBeenNthCalledWith(3, '/account-delete', { action: 'status' });
  });

  it('accepts restored user id credentials as a login signal before backend verification', async () => {
    global.__mockStorage.EXAM_USER_ID = 'user_abc';
    const api = await import('@/services/api/domains/user.api.js');

    const result = await api.getAccountDeletionStatus();

    expect(result.success).toBe(true);
    expect(request).toHaveBeenCalledWith('/account-delete', { action: 'status' });
  });
});
