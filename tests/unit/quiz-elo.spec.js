import { describe, expect, it } from 'vitest';
import {
  calculateSpeedScore,
  getQuestionEloRating,
  rankQuestionsByEloMatch,
  updateEloRating
} from '@/utils/quiz-elo.js';

describe('quiz speed score and ELO matching', () => {
  it('rewards fast correct answers more than slow or wrong answers', () => {
    const fastCorrect = calculateSpeedScore({
      isCorrect: true,
      timeSpentMs: 12000,
      timeLimitMs: 60000,
      difficulty: 4
    });
    const slowCorrect = calculateSpeedScore({
      isCorrect: true,
      timeSpentMs: 55000,
      timeLimitMs: 60000,
      difficulty: 4
    });
    const fastWrong = calculateSpeedScore({
      isCorrect: false,
      timeSpentMs: 12000,
      timeLimitMs: 60000,
      difficulty: 4
    });

    expect(fastCorrect).toBeGreaterThan(slowCorrect);
    expect(slowCorrect).toBeGreaterThan(fastWrong);
    expect(fastCorrect).toBeLessThanOrEqual(100);
    expect(fastWrong).toBeGreaterThanOrEqual(0);
  });

  it('updates learner and question ratings in opposite directions', () => {
    const result = updateEloRating({
      userRating: 1500,
      questionRating: 1500,
      isCorrect: true,
      speedScore: 92
    });

    expect(result.userRating).toBeGreaterThan(1500);
    expect(result.questionRating).toBeLessThan(1500);
    expect(result.userDelta).toBeGreaterThan(0);
    expect(result.questionDelta).toBeLessThan(0);
  });

  it('orders questions by closest ELO match before falling back to declared difficulty', () => {
    const questions = [
      { id: 'too_easy', difficulty: 1 },
      { id: 'near_match', difficulty: 3 },
      { id: 'too_hard', difficulty: 5 }
    ];

    const ranked = rankQuestionsByEloMatch(questions, {
      userRating: 1520,
      questionRatings: {
        too_easy: 1100,
        near_match: 1510,
        too_hard: 1900
      }
    });

    expect(ranked.map((item) => item.id)).toEqual(['near_match', 'too_hard', 'too_easy']);
    expect(getQuestionEloRating({ difficulty: 5 })).toBeGreaterThan(getQuestionEloRating({ difficulty: 1 }));
  });
});
