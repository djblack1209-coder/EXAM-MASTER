// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const verifyJWT = vi.fn(() => ({ userId: 'id_photo_visual_user' }));
  const checkRateLimitDistributed = vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    resetAt: Date.now() + 60 * 1000,
    source: 'memory'
  }));
  const segmentPortraitPic = vi.fn(async () => ({
    ResultImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  }));

  return {
    verifyJWT,
    checkRateLimitDistributed,
    segmentPortraitPic
  };
});

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: mocked.verifyJWT
}));

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }),
  checkRateLimitDistributed: mocked.checkRateLimitDistributed
}));

vi.mock('tencentcloud-sdk-nodejs', () => ({
  default: {
    bda: {
      v20200324: {
        Client: class {
          async SegmentPortraitPic() {
            return mocked.segmentPortraitPic();
          }
        }
      }
    }
  }
}));

import idPhotoHandler from '../../laf-backend/functions/id-photo-segment-base64';

describe('证件照流程模拟人工结果', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TENCENT_SECRET_ID = 'mock_secret_id';
    process.env.TENCENT_SECRET_KEY = 'mock_secret_key';
  });

  it('上传头像后可完成抠图并返回透明底图', async () => {
    const result = /** @type {any} */ (
      await idPhotoHandler({
        headers: { authorization: 'Bearer valid.mock.token' },
        body: {
          imageBase64: 'data:image/png;base64,AAAABBBBCCCC'
        }
      })
    );

    expect(result.code).toBe(0);
    expect(result.success).toBe(true);
    expect(result.data.imageBase64).toContain('iVBORw0KGgo');
    expect(result.data.tip).toContain('透明背景');
    expect(mocked.verifyJWT).toHaveBeenCalledTimes(1);
    expect(mocked.checkRateLimitDistributed).toHaveBeenCalledTimes(1);
    expect(mocked.segmentPortraitPic).toHaveBeenCalledTimes(1);
  });
});
