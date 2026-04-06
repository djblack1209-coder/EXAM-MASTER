/**
 * 全链路测试 7: LafService 核心请求引擎 & 响应规范化
 * normalizeResponse -> normalizeError -> 友好错误映射 -> 限流 -> 缓存 -> 收藏/题库接口
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequest = vi.fn().mockResolvedValue({ code: 0, success: true, data: {} });

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));
vi.mock('@/services/api/domains/_request-core.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, request: mockRequest };
});

describe('全链路: LafService 核心请求引擎', () => {
  beforeEach(async () => {
    global.__mockStorage = {};
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, success: true, data: {} });
  });

  // Phase 1 (收藏管理 addFavorite/getFavorites/removeFavorite) 已在 Round 28 移除死代码时删除

  describe('Phase 2: 题库接口', () => {
    // [AUDIT R432] getQuestionBank 已删除（死代码清理），测试移除

    it('getRandomQuestions - 默认参数', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
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
    });

    it('getRandomQuestions - 自定义参数', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
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
    });
  });

  // Phase 3 (getStudyStats), Phase 4 (adaptiveQuestionPick/trendPredict), Phase 5 (getAiFriendMemory) 已在 Round 28 移除死代码时删除

  describe('Phase 6: 账号注销', () => {
    it('requestAccountDeletion - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: { cooldownDays: 7 }
      });

      const result = await lafService.requestAccountDeletion();
      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith('/account-delete', { action: 'request' });
    });

    it('cancelAccountDeletion - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        message: '已撤销'
      });

      const result = await lafService.cancelAccountDeletion();
      expect(result.success).toBe(true);
    });

    it('requestAccountDeletion - 网络失败', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('服务器错误'));

      const result = await lafService.requestAccountDeletion();
      expect(result.success).toBe(false);
    });
  });

  describe('Phase 7: 端到端场景 - 完整用户旅程', () => {
    it('新用户完整旅程: 登录 -> 刷题 -> 查看排行', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // Step 1: 登录
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: { userId: 'new_user_001', token: 'jwt_abc' }
      });

      const loginResult = await lafService.login({ type: 'wechat', code: 'wx_code' });
      expect(loginResult.success).toBe(true);

      // 模拟登录后存储 userId
      global.__mockStorage['EXAM_USER_ID'] = 'new_user_001';

      // Step 2: 获取随机题目（getQuestionBank 已在 R432 删除）
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: [
          { id: 'q1', question: '题目1', answer: 'A' },
          { id: 'q2', question: '题目2', answer: 'B' }
        ]
      });

      const bankResult = await lafService.getRandomQuestions({ count: 2 });
      expect(bankResult.success).toBe(true);

      // Step 3: 查看排行
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: { rank: 1, score: 100 }
      });

      const rankResult = await lafService.rankCenter({ action: 'getAll', userId: 'new_user_001' });
      expect(rankResult.success).toBe(true);

      // 验证总共发了 3 次请求
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('离线用户旅程: 所有接口优雅降级', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // 模拟所有请求失败
      mockRequest.mockRejectedValue(new Error('网络连接失败'));

      // 所有接口都不应该抛出未捕获异常（getQuestionBank 已在 R432 删除）
      const results = await Promise.all([
        lafService.getRandomQuestions(),
        lafService.getHotSchools(),
        lafService.rankCenter({ action: 'getAll' }),
        lafService.socialService({ action: 'get_friend_list' })
      ]);

      // 所有结果都应该是标准错误格式
      for (const result of results) {
        expect(result.success).toBe(false);
      }
    });
  });
});
