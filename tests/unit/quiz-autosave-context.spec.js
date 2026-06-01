import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

describe('quiz autosave context guard', () => {
  beforeEach(() => {
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  it('restores saved progress only for the same question session', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');

    const context = {
      mode: 'past_exam',
      paperId: 'english1-2025',
      questionIds: ['q1', 'q2', 'q3']
    };

    expect(
      saveQuizProgress(
        {
          currentIndex: 1,
          seconds: 90,
          hasAnswered: false,
          answeredQuestions: [{ questionId: 'q1', index: 0, isCorrect: true }]
        },
        true,
        context
      )
    ).toBe(true);

    expect(loadQuizProgress(context)).toEqual(
      expect.objectContaining({
        currentIndex: 1,
        seconds: 90,
        answeredQuestions: [expect.objectContaining({ questionId: 'q1' })]
      })
    );

    expect(
      loadQuizProgress({
        ...context,
        questionIds: ['other-q1', 'other-q2', 'other-q3']
      })
    ).toBeNull();
  });
});
