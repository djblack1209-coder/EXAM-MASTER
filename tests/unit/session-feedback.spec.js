import { describe, expect, it } from 'vitest';

import {
  buildComboFeedback,
  calculateCorrectStreak,
  getComboLevel,
  shouldShowCombo
} from '@/pages/practice-sub/utils/session-feedback.js';

describe('session feedback', () => {
  it('calculates the active correct streak from the answer tail', () => {
    expect(
      calculateCorrectStreak([
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: true }
      ])
    ).toBe(2);
  });

  it('resets streak when the latest answer is wrong', () => {
    expect(calculateCorrectStreak([{ isCorrect: true }, { isCorrect: false }])).toBe(0);
  });

  it('shows combo only at meaningful milestones', () => {
    expect(shouldShowCombo(2)).toBe(false);
    expect(shouldShowCombo(3)).toBe(true);
    expect(shouldShowCombo(4)).toBe(false);
    expect(shouldShowCombo(10)).toBe(true);
    expect(shouldShowCombo(40)).toBe(true);
  });

  it('maps streaks into compact product feedback copy', () => {
    expect(getComboLevel(4)).toBe(0);
    expect(getComboLevel(5)).toBe(1);
    expect(getComboLevel(10)).toBe(2);
    expect(getComboLevel(15)).toBe(3);
    expect(getComboLevel(30)).toBe(4);

    expect(buildComboFeedback(10)).toEqual({
      streak: 10,
      level: 2,
      title: '10 连对',
      desc: '进入高质量连续答题状态'
    });
  });
});
