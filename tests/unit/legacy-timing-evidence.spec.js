import { beforeEach, describe, expect, it } from 'vitest';
import storageService from '@/services/storageService.js';
import { questionTimer } from '@/pages/practice-sub/question-timer.js';
const Timer = questionTimer.constructor;
describe('legacy timing values never infer grading or learner ability', () => {
  beforeEach(() => uni.clearStorageSync());
  it('preserves original rows, includes zero, omits malformed values and refuses an ability trend', () => {
    const rows = [
      { timeSpent: 0, isCorrect: true },
      { timeSpent: 10, isCorrect: false, isTimeout: true },
      { timeSpent: -1 },
      { timeSpent: '2' }
    ];
    storageService.save('question_time_records', rows, true);
    const before = JSON.stringify(global.__mockStorage),
      timer = new Timer(),
      summary = timer.getTimeStats();
    expect(summary).toMatchObject({
      totalQuestions: 4,
      validValueCount: 2,
      omittedValueCount: 2,
      averageTime: 5,
      fastestTime: 0,
      reliableCount: 0,
      scoringAuthority: false,
      efficiencyScore: null,
      recentTrend: null
    });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(timer.recordTime({ questionId: 0, timeSpent: 8, isCorrect: true })).toMatchObject({ success: false });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });
  it('does not recommend a learning hour or derive a limit from unverified correctness marks', () => {
    storageService.save(
      'question_time_records',
      Array.from({ length: 12 }, () => ({ category: '英语', timeSpent: 1, isCorrect: true, timestamp: 1 })),
      true
    );
    const timer = new Timer();
    expect(timer.getBestTimeSlotAnalysis()).toMatchObject({
      hasEnoughData: false,
      recommendation: null,
      scoringAuthority: false
    });
    expect(timer.getRecommendedTimeLimit(2, '英语')).toBe(120);
  });
  it('keeps finite summaries for large finite legacy values without rewriting originals', () => {
    const timer = new Timer();
    timer.init();
    timer.timeRecords = Array.from({ length: 150000 }, () => ({ timeSpent: Number.MAX_VALUE }));
    expect(timer.getTimeStats()).toMatchObject({
      averageTime: Number.MAX_VALUE,
      fastestTime: Number.MAX_VALUE,
      slowestTime: Number.MAX_VALUE,
      validValueCount: 150000,
      scoringAuthority: false
    });
  });
});
