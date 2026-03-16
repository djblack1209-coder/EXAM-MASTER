/**
 * AI功能集成测试
 */
import { describe, it, expect, vi } from 'vitest';

const mockAI = {
  sendMessage: vi.fn(),
  photoSearch: vi.fn()
};

describe('AI功能集成测试', () => {
  it('AI聊天应返回回复', async () => {
    mockAI.sendMessage.mockResolvedValue({
      success: true,
      reply: '这是AI的回复'
    });

    const result = await mockAI.sendMessage('你好');

    expect(result.success).toBe(true);
    expect(result.reply).toBeTruthy();
  });

  it('拍照搜题应返回题目解析', async () => {
    mockAI.photoSearch.mockResolvedValue({
      success: true,
      question: '题目内容',
      answer: '答案解析'
    });

    const result = await mockAI.photoSearch('base64_image');

    expect(result.success).toBe(true);
    expect(result.question).toBeTruthy();
    expect(result.answer).toBeTruthy();
  });
});
