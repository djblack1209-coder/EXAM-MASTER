import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/api/domains/_request-core.js';

vi.mock('@/services/api/domains/_request-core.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, request: vi.fn().mockResolvedValue({ code: 0, success: true, data: {} }) };
});

describe('lafService.getReviewPlan', () => {
  beforeEach(async () => {
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  it('does not retry when ai-diagnosis returns 404', async () => {
    request.mockResolvedValue({
      code: 404,
      success: false,
      message: '请求的服务暂不可用'
    });

    const { lafService } = await import('@/services/lafService.js');

    const result = await lafService.getReviewPlan();

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.code).toBe(404);
    expect(result.message).toBe('请求的服务暂不可用');
  });
});
