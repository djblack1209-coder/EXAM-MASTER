/**
 * 全链路测试 7: LafService 核心请求引擎 & 响应规范化
 * normalizeResponse -> normalizeError -> 友好错误映射 -> 限流 -> 缓存 -> 收藏/题库接口
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('全链路: LafService 核心请求引擎', () => {
  beforeEach(() => {
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  describe('Phase 1: 收藏管理接口', () => {
    it('addFavorite - 未登录时返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = {};

      const result = await lafService.addFavorite({ questionId: 'q1' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('登录');
    });

    it('getFavorites - 未登录时返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = {};

      const result = await lafService.getFavorites();
      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
    });

    it('removeFavorite - 未登录时返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = {};

      const result = await lafService.removeFavorite('fav_001');
      expect(result.success).toBe(false);
    });

    it('addFavorite - 登录后正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = { EXAM_USER_ID: 'user_fav' };

      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { id: 'fav_new' }
      });

      const result = await lafService.addFavorite({ questionId: 'q1', type: 'question' });
      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        '/favorite-manager',
        expect.objectContaining({
          action: 'add',
          userId: 'user_fav'
        })
      );

      mockRequest.mockRestore();
    });

    it('getFavorites - 登录后正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = { EXAM_USER_ID: 'user_fav' };

      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: [
          { id: 'fav_1', questionId: 'q1' },
          { id: 'fav_2', questionId: 'q2' }
        ]
      });

      const result = await lafService.getFavorites({ type: 'question' });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      mockRequest.mockRestore();
    });
  });

  describe('Phase 2: 题库接口', () => {
    it('getQuestionBank - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { questions: [], total: 0 }
      });

      const result = await lafService.getQuestionBank('user_001');
      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith('/question-bank', {
        action: 'get',
        userId: 'user_001'
      });

      mockRequest.mockRestore();
    });

    it('getQuestionBank - 网络失败返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('网络错误'));

      const result = await lafService.getQuestionBank('user_001');
      expect(result.success).toBe(false);

      vi.restoreAllMocks();
    });

    it('getRandomQuestions - 默认参数', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: []
      });

      await lafService.getRandomQuestions();
      expect(mockRequest).toHaveBeenCalledWith(
        '/question-bank',
        expect.objectContaining({
          action: 'random',
          data: expect.objectContaining({ count: 20 })
        })
      );

      mockRequest.mockRestore();
    });

    it('getRandomQuestions - 自定义参数', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: []
      });

      await lafService.getRandomQuestions({ count: 10, category: '政治', difficulty: 'hard' });
      expect(mockRequest).toHaveBeenCalledWith(
        '/question-bank',
        expect.objectContaining({
          data: expect.objectContaining({ count: 10, category: '政治', difficulty: 'hard' })
        })
      );

      mockRequest.mockRestore();
    });
  });

  describe('Phase 3: 学习统计接口', () => {
    it('getStudyStats - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { totalQuestions: 500, studyDays: 30 }
      });

      const result = await lafService.getStudyStats('user_001');
      expect(result.success).toBe(true);
      expect(result.data.totalQuestions).toBe(500);

      mockRequest.mockRestore();
    });

    it('getStudyStats - 网络失败降级到本地数据', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('网络错误'));

      // 预设本地数据
      global.__mockStorage = {
        study_stats: { '2024-01-01': { correct: 10, total: 15 } },
        v30_bank: [{ id: 1 }, { id: 2 }],
        mistake_book: [{ id: 'm1' }]
      };

      const result = await lafService.getStudyStats('user_001');
      expect(result.code).toBe(0);
      expect(result.data._source).toBe('local_fallback');
      expect(result.data.totalQuestions).toBe(2);
      expect(result.data.totalMistakes).toBe(1);

      vi.restoreAllMocks();
    });
  });

  describe('Phase 4: 智能组题 & 考点预测', () => {
    it('adaptiveQuestionPick - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockProxyAI = vi.spyOn(lafService, 'proxyAI').mockResolvedValue({
        code: 0,
        success: true,
        data: { questions: [{ id: 'q1' }] }
      });

      const result = await lafService.adaptiveQuestionPick(
        { targetSchool: '清华大学', questionCount: 10 },
        { totalMistakes: 50 },
        { lastAccuracy: 70 }
      );

      expect(result.success).toBe(true);
      expect(mockProxyAI).toHaveBeenCalledWith(
        'adaptive_pick',
        expect.objectContaining({
          content: expect.any(String),
          userProfile: expect.objectContaining({ targetSchool: '清华大学' })
        })
      );

      mockProxyAI.mockRestore();
    });

    it('trendPredict - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockProxyAI = vi.spyOn(lafService, 'proxyAI').mockResolvedValue({
        code: 0,
        success: true,
        data: { predictions: [] }
      });

      const result = await lafService.trendPredict({ topicFrequency: {} }, 2025, '政治');

      expect(result.success).toBe(true);
      expect(mockProxyAI).toHaveBeenCalledWith(
        'trend_predict',
        expect.objectContaining({
          examYear: 2025,
          subject: '政治'
        })
      );

      mockProxyAI.mockRestore();
    });
  });

  describe('Phase 5: 智能好友记忆', () => {
    it('getAiFriendMemory - 未登录返回空数组', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = {};

      const result = await lafService.getAiFriendMemory('yan-cong');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('getAiFriendMemory - 登录后正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = { EXAM_USER_ID: 'user_mem' };

      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: [{ role: 'user', content: '你好' }]
      });

      const result = await lafService.getAiFriendMemory('yan-cong');
      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        '/ai-friend-memory',
        expect.objectContaining({
          action: 'get',
          friendType: 'yan-cong'
        })
      );

      mockRequest.mockRestore();
    });

    it('getAiFriendMemory - 网络失败返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      global.__mockStorage = { EXAM_USER_ID: 'user_mem' };

      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('timeout'));

      const result = await lafService.getAiFriendMemory('yan-shi');
      expect(result.success).toBe(false);

      vi.restoreAllMocks();
    });
  });

  describe('Phase 6: 账号注销', () => {
    it('requestAccountDeletion - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { cooldownDays: 7 }
      });

      const result = await lafService.requestAccountDeletion();
      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith('/account-delete', { action: 'request' });

      mockRequest.mockRestore();
    });

    it('cancelAccountDeletion - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        message: '已撤销'
      });

      const result = await lafService.cancelAccountDeletion();
      expect(result.success).toBe(true);

      mockRequest.mockRestore();
    });

    it('requestAccountDeletion - 网络失败', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('服务器错误'));

      const result = await lafService.requestAccountDeletion();
      expect(result.success).toBe(false);

      vi.restoreAllMocks();
    });
  });

  describe('Phase 7: 端到端场景 - 完整用户旅程', () => {
    it('新用户完整旅程: 登录 -> 刷题 -> 收藏 -> 查看统计', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // Step 1: 登录
      const mockRequest = vi.spyOn(lafService, 'request');
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: { userId: 'new_user_001', token: 'jwt_abc' }
      });

      const loginResult = await lafService.login({ type: 'wechat', code: 'wx_code' });
      expect(loginResult.success).toBe(true);

      // 模拟登录后存储 userId
      global.__mockStorage['EXAM_USER_ID'] = 'new_user_001';

      // Step 2: 获取题库
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: [
          { id: 'q1', question: '题目1', answer: 'A' },
          { id: 'q2', question: '题目2', answer: 'B' }
        ]
      });

      const bankResult = await lafService.getQuestionBank('new_user_001');
      expect(bankResult.success).toBe(true);

      // Step 3: 收藏题目
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: { id: 'fav_001' }
      });

      const favResult = await lafService.addFavorite({ questionId: 'q1', type: 'question' });
      expect(favResult.success).toBe(true);

      // Step 4: 获取学习统计
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: { totalQuestions: 2, studyDays: 1 }
      });

      const statsResult = await lafService.getStudyStats('new_user_001');
      expect(statsResult.success).toBe(true);

      // 验证总共发了 4 次请求
      expect(mockRequest).toHaveBeenCalledTimes(4);

      mockRequest.mockRestore();
    });

    it('离线用户旅程: 所有接口优雅降级', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // 模拟所有请求失败
      const mockRequest = vi.spyOn(lafService, 'request').mockRejectedValue(new Error('网络连接失败'));

      // 所有接口都不应该抛出未捕获异常
      const results = await Promise.all([
        lafService.getQuestionBank('user_001'),
        lafService.getRandomQuestions(),
        lafService.getHotSchools(),
        lafService.getProvinces(),
        lafService.rankCenter({ action: 'getAll' }),
        lafService.socialService({ action: 'get_friend_list' })
      ]);

      // 所有结果都应该是标准错误格式
      for (const result of results) {
        expect(result.success).toBe(false);
      }

      mockRequest.mockRestore();
    });
  });
});
