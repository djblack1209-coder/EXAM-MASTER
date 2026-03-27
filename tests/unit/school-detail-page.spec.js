// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyAIMock = vi.hoisted(() => vi.fn());
const storageGetMock = vi.hoisted(() => vi.fn());
const storageSaveMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/lafService.js', () => ({
  lafService: {
    proxyAI: proxyAIMock,
    getSchoolDetail: vi.fn()
  }
}));

// B2 迁移：detail 页面现通过 schoolStore 调用，需 mock store
vi.mock('@/stores/modules/school', () => ({
  useSchoolStore: vi.fn(() => ({
    aiPredict: proxyAIMock,
    fetchSchoolDetail: vi.fn().mockResolvedValue({ code: 0, data: null }),
    aiRecommend: vi.fn(),
    fetchHotSchools: vi.fn(),
    crawlSchoolData: vi.fn(),
    searchSchools: vi.fn()
  }))
}));

vi.mock('@/services/storageService.js', () => ({
  default: {
    get: storageGetMock,
    save: storageSaveMock,
    remove: vi.fn()
  }
}));

vi.mock('@/config/index.js', () => ({
  default: {
    isDev: true,
    externalCdn: {
      dicebearBaseUrl: 'https://example.com'
    },
    deepLink: {
      h5BaseUrl: 'https://example.com'
    }
  }
}));

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/utils/core/system.js', () => ({
  getStatusBarHeight: vi.fn(() => 44)
}));

import SchoolDetailPage from '@/pages/school-sub/detail.vue';

describe('school-detail 页面行为', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGetMock.mockImplementation((key, defaultValue = null) => {
      if (key === 'target_schools') return [{ id: '1001' }];
      if (key === 'study_stats') return { '2026-03-01': 10 };
      if (key === 'v30_bank') return new Array(80).fill({});
      if (key === 'mistake_book') return new Array(20).fill({});
      return defaultValue;
    });
  });

  it('checkTargetStatus 应兼容 id 类型差异', () => {
    const ctx = {
      schoolId: 1001,
      isTarget: false
    };

    SchoolDetailPage.methods.checkTargetStatus.call(ctx);

    expect(ctx.isTarget).toBe(true);
  });

  it('fetchAIPrediction 应兼容 data.reply 返回格式', async () => {
    proxyAIMock.mockResolvedValue({
      code: 0,
      data: {
        reply: '88|结合你的复习进度，冲刺希望较大，建议继续保持。'
      }
    });

    const ctx = {
      schoolId: '1001',
      schoolInfo: {
        id: '1001',
        name: '北京大学',
        matchRate: 75
      },
      probability: 75,
      aiReason: '',
      isAnalyzing: false,
      // B2 迁移：提供 schoolStore mock
      schoolStore: { aiPredict: proxyAIMock }
    };

    await SchoolDetailPage.methods.fetchAIPrediction.call(ctx);

    expect(proxyAIMock).toHaveBeenCalledTimes(1);
    expect(ctx.probability).toBe(88);
    expect(ctx.aiReason).toContain('冲刺希望较大');
    expect(ctx.isAnalyzing).toBe(false);
  });

  it('fetchAIPrediction 应兼容对象结构 probability/reason', async () => {
    proxyAIMock.mockResolvedValue({
      code: 0,
      data: {
        probability: 92,
        reason: '你的学习连续性较强，当前目标可冲。'
      }
    });

    const ctx = {
      schoolId: '1001',
      schoolInfo: {
        id: '1001',
        name: '清华大学',
        matchRate: 70
      },
      probability: 70,
      aiReason: '',
      isAnalyzing: false,
      // B2 迁移：提供 schoolStore mock
      schoolStore: { aiPredict: proxyAIMock }
    };

    await SchoolDetailPage.methods.fetchAIPrediction.call(ctx);

    expect(ctx.probability).toBe(92);
    expect(ctx.aiReason).toContain('学习连续性较强');
  });
});
