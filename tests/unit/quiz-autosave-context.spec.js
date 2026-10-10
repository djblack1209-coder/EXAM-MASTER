import { beforeEach, describe, expect, it, vi } from 'vitest';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

describe('quiz autosave context guard', () => {
  beforeEach(() => {
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  it('freezes delayed progress and drops it when its owner changes', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    vi.useFakeTimers();
    try {
      uni.setStorageSync('EXAM_USER_ID', 'timer-owner-a');
      const progress = {
        currentIndex: 0,
        questions: [{ id: 0, question: '原题' }],
        answeredQuestions: [],
        questionTiming: { index: 0, questionId: 0, elapsedMs: 1750 }
      };
      saveQuizProgress(progress);
      progress.questionTiming.elapsedMs = 99000;
      vi.advanceTimersByTime(500);
      expect(loadQuizProgress().questionTiming.elapsedMs).toBe(1750);
      const before = JSON.stringify(global.__mockStorage);
      saveQuizProgress(progress);
      uni.setStorageSync('EXAM_USER_ID', 'timer-owner-b');
      vi.advanceTimersByTime(500);
      expect(loadQuizProgress()).toBeNull();
      uni.setStorageSync('EXAM_USER_ID', 'timer-owner-a');
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
  it('does not acknowledge a failed save and preserves the earlier complete snapshot', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    expect(saveQuizProgress({ currentIndex: 0, seconds: 2, answeredQuestions: [] }, true)).toBe(true);
    const failure = vi.spyOn(storageService, 'save').mockReturnValue(false);
    expect(saveQuizProgress({ currentIndex: 0, seconds: 7, answeredQuestions: [] }, true)).toBe(false);
    failure.mockRestore();
    expect(loadQuizProgress().seconds).toBe(2);
  });
  it('does not adopt anonymous progress during authenticated reads or generic migration', async () => {
    const { loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    uni.setStorageSync('EXAM_USER_ID', '');
    storageService.save('EXAM_QUIZ_PROGRESS', {
      currentIndex: 1,
      seconds: 30,
      hasAnswered: false,
      answeredQuestions: []
    });
    storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
    uni.setStorageSync('EXAM_USER_ID', 'timer-private');
    const before = JSON.stringify(global.__mockStorage);
    expect(loadQuizProgress()).toBeNull();
    storageService.migrateUserKeys();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('preserves zero in snapshot identity, continuation and complete-progress checks', async () => {
    const { saveQuizProgress, loadQuizProgress, getRecoverableQuizProgress, isQuizProgressComplete } =
      await import('@/composables/useQuizAutoSave.js');
    const progress = {
      currentIndex: 1,
      questions: [
        { id: 0, question: '零号原题' },
        { id: 1, question: '下一原题' }
      ],
      answeredQuestions: [{ questionId: 0, index: 0, userChoice: 0 }],
      sessionId: 'quiz_zero_original'
    };
    const context = { mode: 'normal', questionIds: [0, 1] };
    expect(saveQuizProgress(progress, true, context)).toBe(true);
    const saved = loadQuizProgress(context);
    expect(saved.context.questionIds).toEqual(['0', '1']);
    expect(getRecoverableQuizProgress().answeredQuestions[0].questionId).toBe(0);
    expect(isQuizProgressComplete({ questions: [{ id: 0 }], answeredQuestions: [{ questionId: 0, index: 0 }] })).toBe(
      true
    );
    expect(isQuizProgressComplete({ questions: [{ id: 0 }], answeredQuestions: [{ questionId: '', index: 0 }] })).toBe(
      false
    );
  });

  it('a new single launch does not resume a prior launch even for the same question id', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    const context = { mode: 'single', questionBankFingerprint: '0', handoffId: 'original-launch' };
    saveQuizProgress(
      { currentIndex: 0, questions: [{ id: 0, question: '原题' }], answeredQuestions: [], seconds: 35 },
      true,
      context
    );
    const before = JSON.stringify(global.__mockStorage);
    expect(loadQuizProgress(context).context.handoffId).toBe('original-launch');
    expect(loadQuizProgress({ ...context, handoffId: 'new-launch' })).toBeNull();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('viewing a flashcard reference is recoverable and not silently completed before self assessment', async () => {
    const { saveQuizProgress, getRecoverableQuizProgress, isQuizProgressComplete } =
      await import('@/composables/useQuizAutoSave.js');
    const progress = {
      currentIndex: 0,
      hasAnswered: true,
      sessionId: 'quiz_view_pause',
      questions: [{ id: 0, question: '原卡片', type: 'analysis' }],
      answeredQuestions: [
        { index: 0, questionId: 0, source: 'reference_view', userChoice: 'flashcard_flip', observationId: 'saved-view' }
      ]
    };
    saveQuizProgress(progress, true);
    expect(isQuizProgressComplete(progress)).toBe(false);
    expect(getRecoverableQuizProgress().answeredQuestions[0].observationId).toBe('saved-view');
    expect(
      isQuizProgressComplete({
        ...progress,
        answeredQuestions: [{ index: 0, questionId: 0, source: 'self_rating', userChoice: 'flashcard_rating_3' }]
      })
    ).toBe(true);
  });

  it('retains a valid original session identity with a saved snapshot', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    const progress = {
      currentIndex: 1,
      seconds: 30,
      hasAnswered: false,
      answeredQuestions: [],
      sessionId: 'quiz_original_session'
    };
    expect(saveQuizProgress(progress, true)).toBe(true);
    expect(loadQuizProgress().sessionId).toBe('quiz_original_session');
  });

  it.each([null, {}, '', 'quiz bad', 'x'.repeat(65), 'quiz_$where'])(
    'rejects malformed saved session %j without deleting old data',
    async (sessionId) => {
      const { loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
      storageService.save('EXAM_QUIZ_PROGRESS', {
        currentIndex: 1,
        seconds: 30,
        hasAnswered: false,
        answeredQuestions: [],
        sessionId
      });
      storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
      const before = JSON.stringify(global.__mockStorage);
      expect(loadQuizProgress()).toBeNull();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it('preserves legacy absence and refuses invalid replacement without writing', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    const progress = { currentIndex: 1, seconds: 30, hasAnswered: false, answeredQuestions: [] };
    saveQuizProgress(progress, true);
    expect(loadQuizProgress()).not.toHaveProperty('sessionId');
    const before = JSON.stringify(global.__mockStorage);
    expect(saveQuizProgress({ ...progress, sessionId: 'quiz bad' }, true)).toBe(false);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(saveQuizProgress({ ...progress, sessionId: 'x'.repeat(64) }, true)).toBe(true);
    expect(loadQuizProgress().sessionId).toBe('x'.repeat(64));
  });

  it.each([null, {}, 'bad request id', 'x'.repeat(161)])(
    'preserves records with malformed attempt identity %j and refuses to consume them',
    async (attemptId) => {
      const { loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
      storageService.save('EXAM_QUIZ_PROGRESS', {
        currentIndex: 1,
        seconds: 30,
        hasAnswered: false,
        answeredQuestions: [{ index: 0, questionId: 'q1', attemptId }]
      });
      storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
      const before = JSON.stringify(global.__mockStorage);
      expect(loadQuizProgress()).toBeNull();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it('keeps malformed private content out of ordinary availability logs', async () => {
    const { loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    storageService.save('EXAM_QUIZ_PROGRESS', '{"question":"PRIVATE_CONTENT_MARKER');
    storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
    const before = JSON.stringify(global.__mockStorage);
    expect(loadQuizProgress()).toBeNull();
    expect(JSON.stringify([...logger.warn.mock.calls, ...logger.error.mock.calls])).not.toContain(
      'PRIVATE_CONTENT_MARKER'
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it.each(['bad_time', 'nan_index', 'negative_index', 'negative_seconds', 'malformed_json', 'wrong_shape'])(
    'rejects %s without deleting the original cached materials',
    async (damage) => {
      const { loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
      const progress = { currentIndex: 1, seconds: 30, hasAnswered: false, answeredQuestions: [] };
      if (damage === 'nan_index') progress.currentIndex = NaN;
      if (damage === 'negative_index') progress.currentIndex = -1;
      if (damage === 'negative_seconds') progress.seconds = -1;
      storageService.save(
        'EXAM_QUIZ_PROGRESS',
        damage === 'malformed_json' ? '{broken' : damage === 'wrong_shape' ? [] : progress
      );
      storageService.save('EXAM_QUIZ_PROGRESS_TIME', damage === 'bad_time' ? 'invalid' : String(Date.now()));
      const before = JSON.stringify(global.__mockStorage);
      expect(loadQuizProgress()).toBeNull();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it.each([
    'missing_questions',
    'empty_questions',
    'missing_id',
    'empty_stem',
    'past_end',
    'foreign_answer',
    'bad_index'
  ])('does not expose an incomplete resume snapshot: %s', async (damage) => {
    const { getRecoverableQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    const progress = {
      questions: [
        { id: 'q1', question: '第一题' },
        { id: 'q2', question: '第二题' }
      ],
      currentIndex: 1,
      seconds: 30,
      hasAnswered: false,
      answeredQuestions: []
    };
    if (damage === 'missing_questions') delete progress.questions;
    if (damage === 'empty_questions') progress.questions = [];
    if (damage === 'missing_id') delete progress.questions[0].id;
    if (damage === 'empty_stem') progress.questions[0].question = ' ';
    if (damage === 'past_end') progress.currentIndex = 2;
    if (damage === 'foreign_answer') progress.answeredQuestions = [{ questionId: 'foreign', index: 0 }];
    if (damage === 'bad_index') progress.answeredQuestions = [{ questionId: 'q1', index: -1 }];
    storageService.save('EXAM_QUIZ_PROGRESS', progress);
    storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
    const before = JSON.stringify(global.__mockStorage);
    expect(getRecoverableQuizProgress()).toBeNull();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('counts completion by original positions, preserving repeated adaptive review IDs and neutral flashcard facts', async () => {
    const { isQuizProgressComplete, getRecoverableQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    const progress = {
      questions: [
        { id: 'q1', question: '第一次' },
        { id: 'q1', question: '复习同题' }
      ],
      currentIndex: 1,
      seconds: 30,
      hasAnswered: true,
      answeredQuestions: [{ questionId: 'q1', index: 1, isCorrect: null }]
    };
    storageService.save('EXAM_QUIZ_PROGRESS', progress);
    storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
    expect(isQuizProgressComplete(progress)).toBe(false);
    expect(getRecoverableQuizProgress()).toEqual(progress);
    progress.answeredQuestions.push({ questionId: 'q1', index: 0, isCorrect: true });
    expect(isQuizProgressComplete(progress)).toBe(true);
    storageService.save('EXAM_QUIZ_PROGRESS', progress);
    expect(getRecoverableQuizProgress()).toBeNull();
  });

  it('offers continuation after the first explicit answer without requiring navigation to question two', async () => {
    const { saveQuizProgress, hasUnfinishedProgress } = await import('@/composables/useQuizAutoSave.js');
    saveQuizProgress(
      {
        questions: [
          { id: 'q1', question: '第一题' },
          { id: 'q2', question: '第二题' }
        ],
        currentIndex: 0,
        seconds: 30,
        hasAnswered: true,
        answeredQuestions: [{ questionId: 'q1', index: 0, userChoice: 0, isCorrect: true }]
      },
      true
    );
    expect(hasUnfinishedProgress()).toBe(true);
  });

  it('does not delete expired answer facts while reading availability', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/composables/useQuizAutoSave.js');
    saveQuizProgress({ currentIndex: 1, seconds: 30, hasAnswered: false, answeredQuestions: [] }, true);
    const expired = storageService.get('EXAM_QUIZ_PROGRESS');
    storageService.save('EXAM_QUIZ_PROGRESS', { ...expired, savedAt: Date.now() - 25 * 60 * 60 * 1000 });
    const before = JSON.stringify(global.__mockStorage);
    expect(loadQuizProgress()).toBeNull();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
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
