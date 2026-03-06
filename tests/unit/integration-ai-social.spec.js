/**
 * 全链路测试 5: 智能对话 & 拍照搜题 & 社交模块
 * 智能代理请求 -> 好友对话 -> 拍照搜题 -> 社交服务 -> 排行榜
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('全链路: 智能对话 & 拍照搜题 & 社交', () => {
  beforeEach(() => {
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  describe('Phase 1: proxyAI 核心接口', () => {
    it('proxyAI - payload 为空时拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.proxyAI('chat', null);
      expect(result.success).toBe(false);
      expect(result.message).toContain('payload');
    });

    it('proxyAI - content 为空时拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.proxyAI('chat', { content: '' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('proxyAI - content 仅空格时拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.proxyAI('chat', { content: '   ' });
      expect(result.success).toBe(false);
    });

    it('proxyAI - 成功响应 (success: true) 自动注入 code: 0', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        success: true,
        data: { reply: '智能回复内容' }
      });

      const result = await lafService.proxyAI('chat', { content: '你好' });
      expect(result.code).toBe(0);
      expect(result.success).toBe(true);
      expect(result.data.reply).toBe('智能回复内容');

      mockRequest.mockRestore();
    });

    it('proxyAI - 旧格式响应 (code: 0) 正常返回', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        data: { answer: '旧格式回复' }
      });

      const result = await lafService.proxyAI('chat', { content: '测试' });
      expect(result.code).toBe(0);

      mockRequest.mockRestore();
    });

    it('proxyAI - 超时返回友好提示', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 10);
        });
      });

      const result = await lafService.proxyAI('chat', { content: '超时测试' }, { timeout: 5 });
      expect(result.success).toBe(false);
      expect(result._timeout || result._fallback).toBeTruthy();

      mockRequest.mockRestore();
    });

    it('proxyAI - 网络错误返回离线提示', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockRejectedValue(new Error('网络连接失败'));

      const result = await lafService.proxyAI('chat', { content: '离线测试' });
      expect(result.success).toBe(false);
      expect(result._offline).toBe(true);

      mockRequest.mockRestore();
    });

    it('proxyAI - 未知响应格式标记为异常', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        weird: 'format',
        noCodeNoSuccess: true
      });

      const result = await lafService.proxyAI('chat', { content: '未知格式' });
      expect(result.success).toBe(false);
      expect(result._fallback).toBe(true);

      mockRequest.mockRestore();
    });
  });

  describe('Phase 2: 智能好友对话', () => {
    it('aiFriendChat - 正常对话', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockProxyAI = vi.spyOn(lafService, 'proxyAI').mockResolvedValue({
        code: 0,
        success: true,
        data: { reply: '学霸回复' }
      });

      const result = await lafService.aiFriendChat('yan-cong', '我最近学习压力好大', {
        emotion: 'anxious',
        conversationCount: 5
      });

      expect(result.success).toBe(true);
      expect(mockProxyAI).toHaveBeenCalledWith(
        'friend_chat',
        expect.objectContaining({
          content: '我最近学习压力好大',
          friendType: 'yan-cong',
          context: expect.objectContaining({ emotion: 'anxious' })
        })
      );

      mockProxyAI.mockRestore();
    });

    it('aiFriendChat - 空消息拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.aiFriendChat('yan-cong', '');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('aiFriendChat - 默认好友类型', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockProxyAI = vi.spyOn(lafService, 'proxyAI').mockResolvedValue({
        code: 0,
        success: true,
        data: {}
      });

      await lafService.aiFriendChat(null, '测试默认类型');
      expect(mockProxyAI).toHaveBeenCalledWith(
        'friend_chat',
        expect.objectContaining({
          friendType: 'yan-cong'
        })
      );

      mockProxyAI.mockRestore();
    });
  });

  describe('Phase 3: 拍照搜题', () => {
    it('photoSearch - 空图片拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.photoSearch('');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('photoSearch - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { question: '识别到的题目', matches: [] }
      });

      const result = await lafService.photoSearch('base64_image_data', { subject: 'math' });
      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        '/ai-photo-search',
        expect.objectContaining({
          imageBase64: 'base64_image_data',
          subject: 'math'
        })
      );

      mockRequest.mockRestore();
    });

    it('photoSearch - 网络失败降级', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('网络错误'));

      const result = await lafService.photoSearch('base64_data');
      expect(result.success).toBe(false);

      vi.restoreAllMocks();
    });
  });

  describe('Phase 4: 资料理解出题', () => {
    it('materialUnderstand - 空资料拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.materialUnderstand('');
      expect(result.success).toBe(false);
    });

    it('materialUnderstand - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockProxyAI = vi.spyOn(lafService, 'proxyAI').mockResolvedValue({
        code: 0,
        success: true,
        data: { questions: [] }
      });

      const result = await lafService.materialUnderstand('马克思主义基本原理...', {
        materialType: '教材',
        difficulty: 3,
        topicFocus: '唯物辩证法'
      });

      expect(result.success).toBe(true);
      expect(mockProxyAI).toHaveBeenCalledWith(
        'material_understand',
        expect.objectContaining({
          content: '马克思主义基本原理...',
          materialType: '教材',
          difficulty: 3
        })
      );

      mockProxyAI.mockRestore();
    });
  });

  describe('Phase 5: 错题深度分析', () => {
    it('deepMistakeAnalysis - 空数据拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.deepMistakeAnalysis(null);
      expect(result.success).toBe(false);
      expect(result.message).toContain('不完整');
    });

    it('deepMistakeAnalysis - 缺少 question 字段拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.deepMistakeAnalysis({ options: ['A', 'B'] });
      expect(result.success).toBe(false);
    });

    it('deepMistakeAnalysis - 正常分析', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockProxyAI = vi.spyOn(lafService, 'proxyAI').mockResolvedValue({
        code: 0,
        success: true,
        data: { analysis: '知识点薄弱' }
      });

      const result = await lafService.deepMistakeAnalysis(
        {
          question: '唯物辩证法的核心？',
          options: ['A', 'B', 'C', 'D'],
          userAnswer: 'B',
          correctAnswer: 'A',
          category: '马原'
        },
        { topicAccuracy: 60 }
      );

      expect(result.success).toBe(true);
      mockProxyAI.mockRestore();
    });
  });

  describe('Phase 6: 社交服务 & 排行榜', () => {
    it('socialService - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: [{ userId: 'friend_1', nickname: '好友A' }]
      });

      const result = await lafService.socialService({
        action: 'get_friend_list',
        userId: 'user_001'
      });

      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        '/social-service',
        expect.objectContaining({
          action: 'get_friend_list'
        })
      );

      mockRequest.mockRestore();
    });

    it('socialService - 网络失败返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('timeout'));

      const result = await lafService.socialService({ action: 'search_user', keyword: 'test' });
      expect(result.success).toBe(false);

      vi.restoreAllMocks();
    });

    it('rankCenter - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { rank: 1, score: 9999 }
      });

      const result = await lafService.rankCenter({
        action: 'getAll',
        userId: 'user_001'
      });

      expect(result.success).toBe(true);
      mockRequest.mockRestore();
    });

    it('rankCenter - 失败返回标准错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('服务器错误'));

      const result = await lafService.rankCenter({ action: 'getAll' });
      expect(result.success).toBe(false);

      vi.restoreAllMocks();
    });
  });

  describe('Phase 7: 登录 & 用户资料接口', () => {
    it('login - 正常登录', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { userId: 'new_user', isNewUser: false, token: 'jwt_token' }
      });

      const result = await lafService.login({ type: 'wechat', code: 'wx_code' });
      expect(result.success).toBe(true);
      expect(result.data.userId).toBe('new_user');
      expect(mockRequest).toHaveBeenCalledWith('/login', expect.objectContaining({ type: 'wechat' }), {
        skipAuth: true
      });

      mockRequest.mockRestore();
    });

    it('login - 失败返回友好错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockRejectedValue(new Error('登录服务不可用'));

      const result = await lafService.login({ type: 'email', email: 'test@test.com' });
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();

      vi.restoreAllMocks();
    });

    it('sendEmailCode - 正常发送', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        message: '验证码已发送'
      });

      const result = await lafService.sendEmailCode('test@example.com');
      expect(result.success).toBe(true);

      mockRequest.mockRestore();
    });

    it('updateUserProfile - 未登录时返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      // 确保无 userId
      global.__mockStorage = {};

      const result = await lafService.updateUserProfile({ nickname: '新昵称' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('未登录');
    });
  });
});
