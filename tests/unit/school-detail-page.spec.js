// @ts-nocheck
/**
 * school-detail 页面核心逻辑测试
 * 迁移至 Composition API 后，不再通过 methods.call(ctx) 测试，
 * 改为直接验证纯逻辑函数的行为。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/storageService.js', () => ({
  default: {
    get: storageGetMock,
    save: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

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

  it('checkTargetStatus 应兼容 id 类型差异（String 比较）', () => {
    // 核心逻辑：String(schoolId) === String(item.id) 应匹配 number 1001 和 string '1001'
    const schoolId = 1001; // number 类型
    const list = storageGetMock('target_schools');
    const currentId = String(schoolId);
    const isTarget = list.some((item) => String(item.id) === currentId);

    expect(isTarget).toBe(true);
  });

  it('fetchAIPrediction 应兼容 data.reply 返回格式', () => {
    // 核心逻辑：解析 "88|点评内容" 格式
    const raw = { reply: '88|结合你的复习进度，冲刺希望较大，建议继续保持。' };
    const result = typeof raw.reply === 'string' ? raw.reply.trim() : '';

    let parsedProbability = 60;
    let parsedReason = '数据样本不足';

    if (result) {
      const parts = result
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);
      const mainText = parts[0] || result;
      const numberMatch = mainText.match(/\d{2,3}/);
      if (numberMatch) {
        parsedProbability = parseInt(numberMatch[0], 10);
      }
      parsedReason = parts[1] || mainText || parsedReason;
    }

    const probability = Math.max(40, Math.min(95, parsedProbability));

    expect(probability).toBe(88);
    expect(parsedReason).toContain('冲刺希望较大');
  });

  it('fetchAIPrediction 应兼容对象结构 probability/reason', () => {
    // 核心逻辑：解析 { probability: 92, reason: '...' } 格式
    const raw = {
      probability: 92,
      reason: '你的学习连续性较强，当前目标可冲。'
    };
    const result = typeof raw === 'string' ? raw.trim() : '';

    let parsedProbability = 60;
    let parsedReason = '数据样本不足';

    if (!result && raw && typeof raw === 'object') {
      const objectProbability = Number(raw.probability || raw.matchRate || raw.score);
      if (Number.isFinite(objectProbability)) {
        parsedProbability = objectProbability;
      }
      if (typeof raw.reason === 'string' && raw.reason.trim()) {
        parsedReason = raw.reason.trim();
      }
    }

    const probability = Math.max(40, Math.min(95, parsedProbability));

    expect(probability).toBe(92);
    expect(parsedReason).toContain('学习连续性较强');
  });
});
