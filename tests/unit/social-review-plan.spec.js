import { beforeEach, describe, expect, it, vi } from 'vitest';

const globalScope = /** @type {any} */ (globalThis);

describe('lafService.getReviewPlan', () => {
  beforeEach(() => {
    global.__mockStorage = {};
    vi.resetModules();
  });

  it('does not retry when ai-diagnosis returns 404', async () => {
    const requestSpy = vi.fn(({ success }) => {
      success?.({
        statusCode: 404,
        data: 'Function Not Found'
      });
      return { abort: vi.fn() };
    });

    globalScope.uni.getNetworkType = vi.fn(({ success }) => {
      success?.({ networkType: 'wifi' });
    });
    globalScope.uni.request = requestSpy;

    const { lafService } = await import('@/services/lafService.js');

    const result = await lafService.getReviewPlan();

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.code).toBe(404);
    expect(result.message).toBe('请求的服务暂不可用');
  });
});
