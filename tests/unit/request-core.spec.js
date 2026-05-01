import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('request core', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.__mockStorage = {
      EXAM_USER_ID: 'user_123'
    };

    global.uni.getNetworkType = vi.fn(({ success }) => {
      success?.({ networkType: 'wifi' });
    });

    global.uni.request = vi.fn(({ data, success }) => {
      success?.({
        statusCode: 200,
        data: {
          code: 0,
          success: true,
          data: { receivedUserId: data.userId }
        }
      });
      return { abort: vi.fn() };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds fallback userId to the outbound request without mutating caller payload', async () => {
    const { request } = await import('@/services/api/domains/_request-core.js');
    const payload = { action: 'submit', answer: 'A' };

    const result = await request('/answer-submit', payload, { skipRateLimit: true, skipCache: true });

    expect(result.success).toBe(true);
    expect(payload).toEqual({ action: 'submit', answer: 'A' });
    expect(global.uni.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { action: 'submit', answer: 'A', userId: 'user_123' }
      })
    );
  });
});
