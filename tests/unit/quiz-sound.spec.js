import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('quiz sound feedback profile', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    global.__mockStorage = {};
  });

  it('documents the complete audio interaction map', async () => {
    const { getAudioFeedbackProfile } = await import('@/pages/practice-sub/utils/quiz-sound.js');

    expect(getAudioFeedbackProfile()).toEqual({
      tap: '20-40ms low-volume touch cue',
      correct: '120-180ms bright two-note cue',
      wrong: '120-180ms soft low cue',
      combo: 'short rising motif throttled at combo milestones',
      flip: 'short paper-like flip cue',
      complete: 'warm 1.2-1.8s completion phrase',
      achievement: 'ascending flourish distinct from completion'
    });
  });

  it('respects the stored sound switch and throttles repeated events', async () => {
    vi.useFakeTimers();
    global.__mockStorage = { quiz_sound_enabled: false };
    const muted = await import('@/pages/practice-sub/utils/quiz-sound.js');

    expect(muted.isSoundEnabled()).toBe(false);
    expect(muted.playClickSound()).toBe(false);
    expect(uni.vibrateShort).not.toHaveBeenCalled();

    vi.resetModules();
    global.__mockStorage = {};
    const sound = await import('@/pages/practice-sub/utils/quiz-sound.js');
    sound.resetSoundThrottle();

    expect(sound.playClickSound()).toBe(true);
    expect(sound.playClickSound()).toBe(false);

    vi.advanceTimersByTime(50);
    expect(sound.playClickSound()).toBe(true);
  });
});
