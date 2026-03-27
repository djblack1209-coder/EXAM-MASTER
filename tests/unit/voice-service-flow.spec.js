// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/api/domains/_request-core.js';

vi.mock('@/services/api/domains/_request-core.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, request: vi.fn().mockResolvedValue({ code: 0, success: true, data: {} }) };
});

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: {
    trackApi: vi.fn(),
    trackRender: vi.fn(),
    getReport: vi.fn(() => ({}))
  }
}));

describe('语音链路模拟人工流程', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    global.__mockStorage = {};
  });

  it('语音转文字：可返回识别文本和置信度', async () => {
    const { lafService } = await import('@/services/lafService.js');

    request.mockResolvedValue({
      code: 0,
      success: true,
      data: {
        text: '马克思主义基本原理第1章重点是实践观点。',
        confidence: 0.94,
        durationMs: 1860
      }
    });

    const result = await lafService.speechToText('base64_audio_data', 'mp3', {
      hotwords: ['马克思主义', '实践观点']
    });

    expect(result.code).toBe(0);
    expect(result.data.text).toContain('实践观点');
    expect(result.data.confidence).toBeGreaterThan(0.9);
    expect(request).toHaveBeenCalledWith(
      '/voice-service',
      expect.objectContaining({
        action: 'speech_to_text',
        audioBase64: 'base64_audio_data',
        audioFormat: 'mp3'
      }),
      expect.objectContaining({ timeout: 60000, maxRetries: 1 })
    );
  });

  it('文字转语音：可返回可播放音频地址', async () => {
    const { lafService } = await import('@/services/lafService.js');

    request.mockResolvedValue({
      code: 0,
      success: true,
      data: {
        audioUrl: 'https://example.com/tts/result-001.mp3',
        format: 'mp3',
        durationMs: 3250
      }
    });

    const result = await lafService.textToSpeech('请开始今天的政治高频考点复习。', {
      voice: 'female_1',
      speed: 1.0
    });

    expect(result.code).toBe(0);
    expect(result.data.audioUrl).toContain('https://example.com/tts/');
    expect(result.data.format).toBe('mp3');
    expect(request).toHaveBeenCalledWith(
      '/voice-service',
      expect.objectContaining({
        action: 'text_to_speech',
        text: '请开始今天的政治高频考点复习。',
        voice: 'female_1',
        speed: 1.0
      }),
      expect.objectContaining({ timeout: 60000, maxRetries: 1 })
    );
  });

  it('音色列表：可返回可选语音角色', async () => {
    const { lafService } = await import('@/services/lafService.js');

    request.mockResolvedValue({
      code: 0,
      success: true,
      data: [
        { id: 'female_1', name: '温柔女声' },
        { id: 'male_1', name: '沉稳男声' }
      ]
    });

    const result = await lafService.getVoiceOptions();

    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('female_1');
    expect(request).toHaveBeenCalledWith('/voice-service', { action: 'get_voices' });
  });
});
