/**
 * 全链路测试 5: 智能对话 & 拍照搜题 & 社交模块
 * 智能代理请求 -> 好友对话 -> 拍照搜题 -> 社交服务 -> 排行榜
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

describe('全链路: 智能对话 & 拍照搜题 & 社交', () => {
  beforeEach(async () => {
    global.__mockStorage = {};
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, success: true, data: {} });
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
      mockRequest.mockResolvedValue({
        success: true,
        data: { reply: '智能回复内容' }
      });

      const result = await lafService.proxyAI('chat', { content: '你好' });
      expect(result.code).toBe(0);
      expect(result.success).toBe(true);
      expect(result.data.reply).toBe('智能回复内容');
    });

    it('proxyAI - 旧格式响应 (code: 0) 正常返回', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        data: { answer: '旧格式回复' }
      });

      const result = await lafService.proxyAI('chat', { content: '测试' });
      expect(result.code).toBe(0);
    });

    it('proxyAI - 超时返回友好提示', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 10);
        });
      });

      const result = await lafService.proxyAI('chat', { content: '超时测试' }, { timeout: 5 });
      expect(result.success).toBe(false);
      expect(result._timeout || result._fallback).toBeTruthy();
    });

    it('proxyAI - 网络错误返回离线提示', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('网络连接失败'));

      const result = await lafService.proxyAI('chat', { content: '离线测试' });
      expect(result.success).toBe(false);
      expect(result._offline).toBe(true);
    });

    it('proxyAI - 未知响应格式标记为异常', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        weird: 'format',
        noCodeNoSuccess: true
      });

      const result = await lafService.proxyAI('chat', { content: '未知格式' });
      expect(result.success).toBe(false);
      expect(result._fallback).toBe(true);
    });
  });

  describe('Phase 2: 智能好友对话', () => {
    it('aiFriendChat - 正常对话', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: { reply: '学霸回复' }
      });

      const result = await lafService.aiFriendChat('yan-cong', '我最近学习压力好大', {
        emotion: 'anxious',
        conversationCount: 5
      });

      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        '/proxy-ai',
        expect.objectContaining({
          action: 'friend_chat',
          content: '我最近学习压力好大',
          friendType: 'yan-cong',
          context: expect.objectContaining({ emotion: 'anxious' })
        }),
        expect.any(Object)
      );
    });

    it('aiFriendChat - 空消息拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.aiFriendChat('yan-cong', '');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('aiFriendChat - 默认好友类型', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: {}
      });

      await lafService.aiFriendChat(null, '测试默认类型');
      expect(mockRequest).toHaveBeenCalledWith(
        '/proxy-ai',
        expect.objectContaining({
          action: 'friend_chat',
          friendType: 'yan-cong'
        }),
        expect.any(Object)
      );
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
      mockRequest.mockResolvedValue({
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
    });

    it('photoSearch - 网络失败降级', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('网络错误'));

      const result = await lafService.photoSearch('base64_data');
      expect(result.success).toBe(false);
    });
  });

  // Phase 4 (materialUnderstand) 和 Phase 5 (deepMistakeAnalysis) 已在 Round 28 移除死代码时删除

  describe('Phase 6: 社交服务 & 排行榜', () => {
    it('socialService - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
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
    });

    it('socialService - 网络失败返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('timeout'));

      const result = await lafService.socialService({ action: 'search_user', keyword: 'test' });
      expect(result.success).toBe(false);
    });

    it('rankCenter - 正常请求', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: { rank: 1, score: 9999 }
      });

      const result = await lafService.rankCenter({
        action: 'getAll',
        userId: 'user_001'
      });

      expect(result.success).toBe(true);
    });

    it('rankCenter - 失败返回标准错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('服务器错误'));

      const result = await lafService.rankCenter({ action: 'getAll' });
      expect(result.success).toBe(false);
    });
  });

  describe('Phase 7: 登录 & 用户资料接口', () => {
    it('login - 正常登录', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
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
    });

    it('login - 失败返回友好错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('登录服务不可用'));

      const result = await lafService.login({ type: 'email', email: 'test@test.com' });
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });

    it('sendEmailCode - 正常发送', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        message: '验证码已发送'
      });

      const result = await lafService.sendEmailCode('test@example.com');
      expect(result.success).toBe(true);
    });

    // updateUserProfile 测试已在 Round 28 移除死代码时删除
  });
});
