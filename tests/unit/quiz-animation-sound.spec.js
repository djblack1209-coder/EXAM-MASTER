// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('quiz animation sound preference', () => {
  beforeEach(() => {
    vi.resetModules();
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  it('defaults answer feedback sound to enabled for first-time users', async () => {
    uni.getStorageSync.mockReturnValue('');

    const { quizAnimationManager } = await import('@/pages/practice-sub/quiz-animation.js');

    expect(quizAnimationManager.settings.sound).toBe(true);
  });

  it('respects users who explicitly disabled answer feedback sound', async () => {
    uni.getStorageSync.mockImplementation((key) => (key === 'quiz_sound_enabled' ? false : ''));

    const { quizAnimationManager } = await import('@/pages/practice-sub/quiz-animation.js');

    expect(quizAnimationManager.settings.sound).toBe(false);
  });
});
