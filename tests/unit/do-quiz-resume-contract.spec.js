import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import DoQuizPage from '@/pages/practice-sub/do-quiz.vue';
import storageService from '@/services/storageService.js';
import { toast } from '@/utils/toast.js';
import { stopTimer } from '@/pages/practice-sub/question-timer.js';
import { recordAnswerToAnalytics } from '@/pages/practice-sub/quiz-analytics-recorder.js';
import { saveToMistakes } from '@/pages/practice-sub/quiz-mistake-handler.js';
import { saveQuizProgress } from '@/composables/useQuizAutoSave.js';
import { LEGACY_REVIEW_HANDOFF_KEY } from '@/services/quiz-session-contract.js';
import { createSinglePracticeHandoff, normalizeQuizQuestion } from '@/services/quiz-session-contract.js';
import { useQuizEngine } from '@/pages/practice-sub/composables/useQuizEngine.js';

vi.mock('@/utils/toast.js', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn(() => ({ hide: vi.fn() })) }
}));
vi.mock('@/pages/practice-sub/quiz-analytics-recorder.js', () => ({
  recordAnswerToAnalytics: vi.fn(async () => null)
}));
vi.mock('@/pages/practice-sub/quiz-sound.js', () => ({
  destroySoundResources: vi.fn(),
  playClickSound: vi.fn(),
  playCompleteFanfare: vi.fn(),
  playFlipSound: vi.fn(),
  playQuizSound: vi.fn()
}));
vi.mock('@/pages/practice-sub/question-timer.js', () => ({
  startTimer: vi.fn(),
  stopTimer: vi.fn(() => ({ elapsed: 2 })),
  recordTime: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  getRemaining: vi.fn(() => ({ elapsedMs: 0, active: false }))
}));

const doQuizPath = resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue');

function paperBank(paperId, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${paperId}-${String(index + 1).padStart(3, '0')}`,
    paperId,
    question: `原卷第${index + 1}题：请选择准确的选项。`,
    type: 'single_choice',
    options: ['A. 第一项', 'B. 第二项', 'C. 第三项', 'D. 第四项'],
    answer: 'A',
    source: 'isolated-original-paper',
    year: '2007',
    ...(index === 0
      ? {
          passageSegments: ['完整原材料[1]至[20]'],
          targetSegment: '原画线句',
          questionImages: [{ src: 'original.jpg' }]
        }
      : {})
  }));
}

function quizContext(paperId = 'english1-2007', mode = 'smart_review') {
  const page = {
    ...DoQuizPage.data(),
    paperId,
    mode,
    _smartReviewMode: mode === 'smart_review',
    startTimer: vi.fn(),
    startQuestionTimer: vi.fn(),
    updateFavoriteStatus: vi.fn(),
    applyEloMatching: (questions) => questions,
    buildQuestionBankFingerprint: DoQuizPage.methods.buildQuestionBankFingerprint
  };
  Object.defineProperty(page, 'quizProgressContext', {
    get() {
      return DoQuizPage.computed.quizProgressContext.call(this);
    }
  });
  return page;
}

it('the explicit continue button starts a fresh clock for the next original question', async () => {
  const page = {
    ...DoQuizPage.data(),
    quizOwnerId: '',
    questions: [{ id: 0 }, { id: 1 }],
    currentIndex: 0,
    hasAnswered: true,
    clearComboFeedback: vi.fn(),
    startQuestionTimer: vi.fn(),
    saveCurrentProgress: vi.fn(),
    _safeTimeout: vi.fn()
  };
  await DoQuizPage.methods.toNext.call(page);
  expect(page.currentIndex).toBe(1);
  expect(page.startQuestionTimer).toHaveBeenCalledWith();
  expect(page.saveCurrentProgress).toHaveBeenCalled();
  expect(DoQuizPage.methods.formatTime(116.998)).toBe('01:57');
});

it('exiting an old page addresses only its own clock token', () => {
  vi.mocked(stopTimer).mockClear();
  const page = { ...DoQuizPage.data(), questionTimerToken: 'owned-old-clock', saveCurrentProgress: vi.fn() };
  DoQuizPage.methods.handleExitConfirm.call(page);
  expect(stopTimer).toHaveBeenCalledWith('owned-old-clock');
});

describe('do quiz resume contract', () => {
  const source = readFileSync(doQuizPath, 'utf8');

  it.each(['single', 'temp_bank', 'smart_review', 'normal'])(
    'mode %s keeps raw aliases/id0/material before formatting and never makes fake choices',
    async (mode) => {
      uni.clearStorageSync();
      const raw = {
        id: 0,
        question_content: '原始题面请选择。',
        options: ['A.原选项', 'B.另一选项'],
        answer: 'B',
        type: '单选',
        passage: '完整原材料',
        source: { title: '原来源' }
      };
      storageService.save('v30_bank', [raw], true);
      storageService.save('temp_practice_question', raw, true);
      storageService.save('temp_practice_questions', [raw], true);
      storageService.save('smart_review_ids', [0], true);
      const page = quizContext('', mode === 'normal' ? '' : mode);
      if (mode === 'smart_review')
        page.smartReviewId = storageService.prepareQuizReview({ ids: [0], expectedOwner: '' }).id;
      page._singleMode = mode === 'single';
      page.smartPickerEnabled = false;
      page.isAdaptiveMode = false;
      await DoQuizPage.methods.loadQuestions.call(page);
      expect(page.questions).toHaveLength(1);
      expect(page.startQuestionTimer).toHaveBeenCalled();
      expect(page.questions[0].id).toBe(0);
      expect(page.questions[0].question).toBe(raw.question_content);
      expect(page.questions[0].options).toEqual(['原选项', '另一选项']);
      expect(page.questions[0].quizOriginal.fields).toEqual({
        question_content: raw.question_content,
        options: raw.options,
        answer: 'B',
        type: '单选',
        passage: raw.passage,
        source: raw.source
      });
      expect(storageService.get('v30_bank')).toEqual([raw]);
    }
  );
  it.each(['single', 'temp_bank', 'smart_review'])(
    'missing selected %s does not substitute an unrelated normal bank',
    async (mode) => {
      uni.clearStorageSync();
      storageService.save('v30_bank', paperBank('unrelated', 2), true);
      storageService.save('smart_review_ids', ['missing-original'], true);
      const page = quizContext('', mode);
      page._singleMode = mode === 'single';
      page.smartPickerEnabled = false;
      await DoQuizPage.methods.loadQuestions.call(page);
      expect(page.questions).toEqual([]);
      expect(page.resumeUnavailable).toBe(true);
      expect(storageService.get('smart_review_ids')).toEqual(['missing-original']);
    }
  );

  it.each([
    'partial',
    'duplicate-request',
    'duplicate-bank',
    'malformed',
    'missing-answer',
    'credentials',
    'stale-original'
  ])('rejects an unavailable %s selection atomically and preserves the handoff', async (damage) => {
    const bank = paperBank('selected', 2);
    let ids = bank.map((q) => q.id);
    if (damage === 'partial') ids.push('missing');
    if (damage === 'duplicate-request') ids = [ids[0], ids[0]];
    if (damage === 'duplicate-bank') bank.push({ ...bank[0] });
    if (damage === 'malformed') bank[1].options = 'not options';
    if (damage === 'missing-answer') delete bank[1].answer;
    if (damage === 'credentials') bank[1].source = { api_key: 'synthetic-secret' };
    if (damage === 'stale-original') {
      bank[1].quizOriginal = {
        contract: 'quiz-original-v1',
        id: bank[1].id,
        namespace: 'legacy',
        fields: { question: 'another original', options: bank[1].options, answer: 'A' }
      };
    }
    storageService.save('v30_bank', bank, true);
    storageService.save('smart_review_ids', ids, true);
    expect(storageService.prepareQuizReview({ ids, expectedOwner: '' }).success).toBe(false);
    const invalid = damage === 'partial' ? [...bank, null] : damage === 'duplicate-request' ? [bank[0], bank[0]] : bank;
    storageService.save(
      'quiz_review_handoff_v1',
      {
        contract: 'quiz-review-handoff-v1',
        id: 'invalid_launch',
        ownerId: '',
        paperId: '',
        questions: invalid
      },
      true
    );
    const before = JSON.stringify(global.__mockStorage);
    const page = quizContext('');
    page.smartReviewId = 'invalid_launch';
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions).toEqual([]);
    expect(page.resumeUnavailable).toBe(true);
    expect(page.startTimer).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('a normal quiz loaded by one owner cannot save or submit after switching owner', async () => {
    storageService.save('v30_bank', paperBank('normal', 1), true);
    const page = quizContext('', '');
    page.smartPickerEnabled = false;
    page.isAdaptiveMode = false;
    await DoQuizPage.methods.loadQuestions.call(page);
    page.currentQuestion = page.questions[0];
    page.userChoice = 0;
    page.saveCurrentProgress = DoQuizPage.methods.saveCurrentProgress.bind(page);
    page.recordAnswerToAnalytics = vi.fn(async () => null);
    page.updateStudyStats = vi.fn();
    page.clearComboFeedback = vi.fn();
    Object.defineProperty(page, 'canSubmitChoice', {
      get() {
        // 模拟 Vue 在存储账户变化后仍缓存之前计算出的按钮可用状态。
        return true;
      }
    });
    uni.setStorageSync('EXAM_USER_ID', 'different-owner');
    const before = JSON.stringify(global.__mockStorage);
    DoQuizPage.methods.saveCurrentProgress.call(page, true);
    await DoQuizPage.methods.submitChoice.call(page);
    expect(page.answeredQuestions).toEqual([]);
    expect(recordAnswerToAnalytics).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it.each(['single', 'temp_bank', 'smart_review', 'normal'])(
    'shared engine %s preserves original aliases and two choices',
    (mode) => {
      const raw = {
        id: 0,
        questionContent: '原题正文',
        choices: ['A.甲', 'B.乙'],
        correct_answer: 0,
        passage: '原材料'
      };
      storageService.save('v30_bank', [raw], true);
      storageService.save('temp_practice_question', raw, true);
      storageService.save('temp_practice_questions', [raw], true);
      storageService.save('smart_review_ids', [0], true);
      const engine = useQuizEngine({ smartPicker: false, adaptiveMode: false });
      const reviewId =
        mode === 'smart_review' ? storageService.prepareQuizReview({ ids: [0], expectedOwner: '' }).id : '';
      expect(engine.loadQuestions({ mode, reviewId })).toBe(true);
      expect(engine.questions.value[0]).toMatchObject({
        id: 0,
        question: '原题正文',
        options: ['甲', '乙'],
        answer: 'A'
      });
      expect(engine.questions.value[0].quizOriginal.fields).toEqual({
        questionContent: raw.questionContent,
        choices: raw.choices,
        correct_answer: 0,
        passage: raw.passage
      });
    }
  );

  it.each(['single', 'temp_bank', 'smart_review'])(
    'shared engine missing %s clears its old display and retains the requested handoff',
    (mode) => {
      storageService.save('v30_bank', paperBank('unrelated', 2), true);
      storageService.save('smart_review_ids', ['missing'], true);
      const engine = useQuizEngine({ smartPicker: false, adaptiveMode: false });
      expect(engine.loadQuestions()).toBe(true);
      const before = JSON.stringify(global.__mockStorage);
      expect(engine.loadQuestions({ mode })).toBe(false);
      expect(engine.questions.value).toEqual([]);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it.each(['valid', 'owner', 'route', 'replacement', 'read-failure'])(
    'bound favorite single handoff %s has an exact source and keeps rejected input',
    async (scenario) => {
      const raw = { ...paperBank('favorite', 1)[0], id: 0, passage: '完整收藏阅读原件' };
      const handoff = createSinglePracticeHandoff(normalizeQuizQuestion(raw), '', 'single-launch-original');
      if (scenario === 'owner') handoff.ownerId = 'another-owner';
      if (scenario === 'replacement') handoff.id = 'another-launch';
      storageService.save('temp_practice_question', handoff, true);
      const page = quizContext('', 'single');
      page._singleMode = true;
      page.singlePracticeId = scenario === 'route' ? 'wrong-launch' : 'single-launch-original';
      const before = JSON.stringify(global.__mockStorage);
      if (scenario === 'read-failure') {
        const get = storageService.get.bind(storageService);
        vi.spyOn(storageService, 'get').mockImplementation((key, ...args) => {
          if (key === 'temp_practice_question') throw Error('synthetic read failure');
          return get(key, ...args);
        });
      }
      try {
        await DoQuizPage.methods.loadQuestions.call(page);
        if (scenario === 'valid') {
          expect(page.questions[0]).toMatchObject({
            id: 0,
            passage: raw.passage,
            quizOriginal: handoff.question.quizOriginal
          });
          expect(page.quizProgressContext.handoffId).toBe('single-launch-original');
        } else {
          expect(page.questions).toEqual([]);
          expect(page.resumeUnavailable).toBe(true);
          expect(JSON.stringify(global.__mockStorage)).toBe(before);
        }
      } finally {
        vi.restoreAllMocks();
      }
    }
  );

  it('loads a complete legacy handoff with original multi-answer and never replaces the active bank or backup', async () => {
    uni.clearStorageSync();
    const original = paperBank('original', 2);
    const review = { ...original[0], type: 'multi_choice', answer: 'AC', passage: '原材料' };
    storageService.save('v30_bank', original, true);
    storageService.save('v30_bank_backup', [{ unique: 'rollback' }], true);
    storageService.save('is_review_mode', true, true);
    storageService.save(
      LEGACY_REVIEW_HANDOFF_KEY,
      { contract: 'legacy-review-handoff-v1', id: 'launch-original', ownerId: '', questions: [review] },
      true
    );
    const before = JSON.stringify(global.__mockStorage);
    const page = quizContext('', 'legacy_review');
    page.legacyReviewId = 'launch-original';
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions).toHaveLength(1);
    expect(page.questions[0]).toMatchObject({
      id: review.id,
      answer: 'AC',
      passage: '原材料',
      type: 'multi_choice',
      scoringAuthority: false
    });
    DoQuizPage.methods._restoreQuestionBankIfReview.call(page);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it.each(['owner', 'id', 'missing', 'empty-answer'])(
    'rejects changed legacy review %s without falling back to unrelated questions',
    async (change) => {
      uni.clearStorageSync();
      const question = paperBank('original', 1)[0];
      storageService.save('v30_bank', [question], true);
      const handoff = {
        contract: 'legacy-review-handoff-v1',
        id: 'launch-original',
        ownerId: '',
        questions: [question]
      };
      if (change === 'owner') handoff.ownerId = 'other-owner';
      if (change === 'id') handoff.id = 'launch-other';
      if (change === 'empty-answer') handoff.questions[0].answer = '';
      if (change !== 'missing') storageService.save(LEGACY_REVIEW_HANDOFF_KEY, handoff, true);
      const before = JSON.stringify(global.__mockStorage);
      const page = quizContext('', 'legacy_review');
      page.legacyReviewId = 'launch-original';
      await DoQuizPage.methods.loadQuestions.call(page);
      expect(page.questions).toEqual([]);
      expect(page.resumeUnavailable).toBe(true);
      expect(page.startTimer).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it('restores a saved legacy review snapshot after the temporary launch is replaced, without touching original banks', async () => {
    const questions = paperBank('legacy', 2);
    questions[0].type = 'multi_choice';
    questions[0].answer = 'AC';
    storageService.save('v30_bank', paperBank('daily', 1), true);
    storageService.save(
      LEGACY_REVIEW_HANDOFF_KEY,
      { contract: 'legacy-review-handoff-v1', id: 'launch-review', ownerId: '', questions },
      true
    );
    const first = quizContext('', 'legacy_review');
    first.legacyReviewId = 'launch-review';
    await DoQuizPage.methods.loadQuestions.call(first);
    first.currentIndex = 1;
    first.seconds = 35;
    DoQuizPage.methods.saveCurrentProgress.call(first, true);
    storageService.save(LEGACY_REVIEW_HANDOFF_KEY, { id: 'new-launch' }, true);
    const before = JSON.stringify(global.__mockStorage);
    const reopened = quizContext('', 'legacy_review');
    reopened.forceResumeProgress = true;
    await DoQuizPage.methods.loadQuestions.call(reopened);
    DoQuizPage.methods.checkUnfinishedProgress.call(reopened);
    expect(reopened.showResumeModal).toBe(true);
    DoQuizPage.methods.restoreProgress.call(reopened);
    expect(reopened.currentIndex).toBe(1);
    expect(reopened.questions[0]).toMatchObject({ id: questions[0].id, answer: 'AC', scoringAuthority: false });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('uses the actual onLoad arguments when the current page registry has no query', () => {
    const page = {
      ...DoQuizPage.data(),
      initSystemUI: vi.fn(),
      initSwipeGesture: vi.fn(),
      loadPassageAnnotations: vi.fn(),
      _safeTimeout: vi.fn()
    };
    DoQuizPage.onLoad.call(page, { resume: 'true', mode: 'smart_review', paperId: 'english1-2007' });
    expect(page.forceResumeProgress).toBe(true);
    expect(page.mode).toBe('smart_review');
    expect(page.paperId).toBe('english1-2007');
  });

  it('keeps a bounded timed group in original order and resumes its saved mode without fresh selection', async () => {
    uni.clearStorageSync();
    const bank = paperBank('timed-original', 23);
    storageService.save('v30_bank', bank, true);
    const page = {
      ...quizContext('', 'timed_sprint'),
      initSystemUI: vi.fn(),
      initSwipeGesture: vi.fn(),
      loadPassageAnnotations: vi.fn(),
      _safeTimeout: vi.fn(),
      applyEloMatching: vi.fn()
    };
    DoQuizPage.onLoad.call(page, { mode: 'timed_sprint' });
    expect(page).toMatchObject({ isAdaptiveMode: false, smartPickerEnabled: false, questionTimerEnabled: true });
    const before = JSON.stringify(global.__mockStorage);
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions.map((q) => q.id)).toEqual(bank.slice(0, 20).map((q) => q.id));
    expect(page.questions[0].quizOriginal.fields.passageSegments).toEqual(bank[0].passageSegments);
    expect(page.applyEloMatching).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(useQuizEngine().loadQuestions({ mode: 'timed_sprint' })).toBe(true);
    saveQuizProgress(
      { questions: page.questions, currentIndex: 1, seconds: 7, hasAnswered: false, answeredQuestions: [] },
      true,
      DoQuizPage.computed.quizProgressContext.call(page)
    );
    storageService.save('v30_bank', [bank[22]], true);
    const resumed = quizContext('', '');
    resumed.forceResumeProgress = true;
    await DoQuizPage.methods.loadQuestions.call(resumed);
    expect(resumed.mode).toBe('timed_sprint');
    expect(resumed.isAdaptiveMode).toBe(false);
    expect(resumed.smartPickerEnabled).toBe(false);
    expect(resumed.questions).toEqual(page.questions);
  });

  it('preserves explicit resume on an H5 route retry with missing framework query arguments', () => {
    const before = location.hash;
    try {
      location.hash = '#/pages/practice-sub/do-quiz?resume=true&paperId=english1-2007';
      const page = {
        ...DoQuizPage.data(),
        initSystemUI: vi.fn(),
        initSwipeGesture: vi.fn(),
        loadPassageAnnotations: vi.fn(),
        _safeTimeout: vi.fn()
      };
      DoQuizPage.onLoad.call(page);
      expect(page.forceResumeProgress).toBe(true);
      expect(page.paperId).toBe('english1-2007');
    } finally {
      location.hash = before;
    }
  });

  it('prefers supplied onLoad arguments over H5 URL and does not use query from another page', () => {
    const before = location.hash;
    const page = () => ({
      ...DoQuizPage.data(),
      initSystemUI: vi.fn(),
      initSwipeGesture: vi.fn(),
      loadPassageAnnotations: vi.fn(),
      _safeTimeout: vi.fn()
    });
    try {
      location.hash = '#/pages/practice-sub/do-quiz?resume=true&paperId=old';
      const direct = page();
      DoQuizPage.onLoad.call(direct, { resume: 'false', paperId: 'math3-2007' });
      expect(direct.forceResumeProgress).toBe(false);
      expect(direct.paperId).toBe('math3-2007');
      location.hash = '#/pages/learning/index?resume=true&paperId=foreign';
      const foreign = page();
      DoQuizPage.onLoad.call(foreign);
      expect(foreign.forceResumeProgress).toBe(false);
      expect(foreign.paperId).toBe('');
    } finally {
      location.hash = before;
    }
  });

  it('restores the saved session only after explicit confirmation and preserves old answers', async () => {
    const questions = paperBank('session-resume', 3);
    const record = { questionId: questions[0].id, index: 0, userChoice: 0, isCorrect: true };
    const snapshot = {
      questions,
      currentIndex: 1,
      seconds: 30,
      hasAnswered: false,
      answeredQuestions: [record],
      sessionId: 'quiz_original_session'
    };
    storageService.save('EXAM_QUIZ_PROGRESS', snapshot);
    storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
    const before = JSON.stringify(global.__mockStorage);
    const page = quizContext('', '');
    page.forceResumeProgress = true;
    page.sessionId = 'quiz_fresh_staged';
    await DoQuizPage.methods.loadQuestions.call(page);
    DoQuizPage.methods.checkUnfinishedProgress.call(page);
    expect(page.sessionId).toBe('quiz_fresh_staged');
    DoQuizPage.methods.restoreProgress.call(page);
    expect(page.sessionId).toBe('quiz_original_session');
    expect(page.answeredQuestions).toEqual([record]);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  beforeEach(() => {
    uni.clearStorageSync();
    vi.clearAllMocks();
  });

  it('loads the saved38 snapshot on an explicit generic resume before consulting the unrelated current bank', async () => {
    const saved = paperBank('politics-2024', 38);
    saveQuizProgress(
      { questions: saved, currentIndex: 17, seconds: 418, hasAnswered: false, answeredQuestions: [] },
      true,
      { mode: 'smart_review', paperId: 'politics-2024', questionBankFingerprint: 'original' }
    );
    const other = paperBank('math3-2007', 24);
    storageService.save('v30_bank', other);
    storageService.save('smart_review_ids', [other[1].id]);
    const before = JSON.stringify(global.__mockStorage);
    const page = quizContext('', '');
    page.forceResumeProgress = true;
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions).toEqual(saved);
    expect(page.currentIndex).toBe(0);
    expect(page.answeredQuestions).toEqual([]);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(page.mode).toBe('smart_review');
    expect(page.paperId).toBe('politics-2024');
    expect(page.questionBankFingerprint).toBe('original');
    DoQuizPage.methods.checkUnfinishedProgress.call(page);
    expect(page.showResumeModal).toBe(true);
    expect(page.answeredQuestions).toEqual([]);
    page.restoreProgress = DoQuizPage.methods.restoreProgress.bind(page);
    DoQuizPage.methods.handleResumeConfirm.call(page);
    expect(page.currentIndex).toBe(17);
    expect(page.questions).toEqual(saved);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it.each(['missing', 'malformed', 'expired'])(
    'fails closed for explicit resume with %s instead of silently starting the current20 group',
    async (damage) => {
      storageService.save('v30_bank', paperBank('other', 24));
      if (damage !== 'missing') {
        storageService.save('EXAM_QUIZ_PROGRESS', '{bad');
        storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now() - (damage === 'expired' ? 90000000 : 0)));
      }
      const before = JSON.stringify(global.__mockStorage);
      const page = quizContext('', '');
      page.forceResumeProgress = true;
      await DoQuizPage.methods.loadQuestions.call(page);
      expect(page.questions).toEqual([]);
      expect(page.resumeUnavailable).toBe(true);
      expect(page.showEmptyBankModal).toBe(true);
      expect(page.startTimer).not.toHaveBeenCalled();
      DoQuizPage.methods.saveCurrentProgress.call(page, true);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it.each(['confirm', 'restart'])(
    'rejects a replaced snapshot before %s and keeps the replacement untouched',
    async (action) => {
      const original = paperBank('original', 3);
      saveQuizProgress(
        { questions: original, currentIndex: 1, seconds: 60, hasAnswered: false, answeredQuestions: [] },
        true
      );
      const page = quizContext('', '');
      page.forceResumeProgress = true;
      await DoQuizPage.methods.loadQuestions.call(page);
      DoQuizPage.methods.checkUnfinishedProgress.call(page);
      saveQuizProgress(
        {
          questions: paperBank('replacement', 3),
          currentIndex: 2,
          seconds: 90,
          hasAnswered: false,
          answeredQuestions: []
        },
        true
      );
      const before = JSON.stringify(global.__mockStorage);
      if (action === 'confirm') DoQuizPage.methods.restoreProgress.call(page);
      else DoQuizPage.methods.handleResumeCancel.call(page);
      expect(page.resumeUnavailable).toBe(true);
      expect(page.questions).toEqual([]);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it.each(['confirm', 'restart'])(
    'rejects an account change before %s can read or migrate the anonymous snapshot',
    async (action) => {
      saveQuizProgress(
        {
          questions: paperBank('original', 3),
          currentIndex: 1,
          seconds: 60,
          hasAnswered: false,
          answeredQuestions: []
        },
        true
      );
      const page = quizContext('', '');
      page.forceResumeProgress = true;
      await DoQuizPage.methods.loadQuestions.call(page);
      DoQuizPage.methods.checkUnfinishedProgress.call(page);
      uni.setStorageSync('EXAM_USER_ID', 'different-owner');
      const before = JSON.stringify(global.__mockStorage);
      if (action === 'confirm') DoQuizPage.methods.restoreProgress.call(page);
      else DoQuizPage.methods.handleResumeCancel.call(page);
      expect(page.resumeUnavailable).toBe(true);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it('does not reclaim another review handoff while merely inspecting the saved snapshot', () => {
    storageService.save('is_review_mode', true);
    storageService.save('v30_bank', paperBank('active-other', 2));
    storageService.save('v30_bank_backup', paperBank('backup-other', 2));
    storageService.save('temp_review_questions', paperBank('chosen-other', 2));
    const before = JSON.stringify(global.__mockStorage);
    DoQuizPage.methods._restoreQuestionBankIfReview.call({ forceResumeProgress: true });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('offers and confirms the first answered question without adding another answer', async () => {
    const questions = paperBank('first-answer', 3);
    const record = { questionId: questions[0].id, index: 0, userChoice: 0, isCorrect: true };
    saveQuizProgress({ questions, currentIndex: 0, seconds: 30, hasAnswered: true, answeredQuestions: [record] }, true);
    const before = JSON.stringify(global.__mockStorage);
    const page = quizContext('', '');
    page.forceResumeProgress = true;
    await DoQuizPage.methods.loadQuestions.call(page);
    DoQuizPage.methods.checkUnfinishedProgress.call(page);
    expect(page.showResumeModal).toBe(true);
    DoQuizPage.methods.restoreProgress.call(page);
    expect(page.currentIndex).toBe(0);
    expect(page.answeredQuestions).toEqual([record]);
    expect(page.hasAnswered).toBe(false);
    expect(page.userChoice).toBeNull();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('loads the same complete52 paper without consuming an unowned old id array, preserving other stored records', async () => {
    const selected = paperBank('english1-2007', 52);
    const bank = [...selected, ...paperBank('math3-2007', 24)];
    storageService.save('v30_bank', bank);
    storageService.save(
      'smart_review_ids',
      selected.map((q) => q.id)
    );
    const before = JSON.stringify(storageService.get('v30_bank'));
    const first = quizContext();
    await DoQuizPage.methods.loadQuestions.call(first);
    expect(first.questions.map((q) => q.id)).toEqual(selected.map((q) => q.id));
    expect(storageService.get('smart_review_ids', [])).toEqual(selected.map((q) => q.id));
    const reopened = quizContext();
    await DoQuizPage.methods.loadQuestions.call(reopened);
    expect(reopened.questions.map((q) => q.id)).toEqual(selected.map((q) => q.id));
    expect(reopened.questionBankFingerprint).toBe(first.questionBankFingerprint);
    expect(reopened.questions[0]).toMatchObject({
      passageSegments: selected[0].passageSegments,
      targetSegment: '原画线句',
      questionImages: [{ src: 'original.jpg' }]
    });
    expect(JSON.stringify(storageService.get('v30_bank'))).toBe(before);
    expect(reopened.answeredQuestions).toEqual([]);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('uses the specified paper rather than an unrelated transient review selection and retains that selection', async () => {
    const selected = paperBank('english1-2007', 52);
    const other = paperBank('math3-2007', 24);
    storageService.save('v30_bank', [...selected, ...other]);
    const foreignIds = [other[2].id, other[0].id];
    storageService.save('smart_review_ids', foreignIds);
    const page = quizContext();
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions.map((q) => q.id)).toEqual(selected.map((q) => q.id));
    expect(storageService.get('smart_review_ids', [])).toEqual(foreignIds);
  });

  it('keeps a specified paper complete in the normal route as well', async () => {
    const selected = paperBank('english1-2007', 52);
    storageService.save('v30_bank', selected);
    const page = quizContext('english1-2007', '');
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions.map((q) => q.id)).toEqual(selected.map((q) => q.id));
    expect(page.answeredQuestions).toEqual([]);
  });

  it('does not replace a missing specified paper with unrelated questions or consume its transient review selection', async () => {
    const other = paperBank('math3-2007', 24);
    storageService.save('v30_bank', other);
    storageService.save('smart_review_ids', [other[0].id]);
    const page = quizContext();
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions).toEqual([]);
    expect(page.showEmptyBankModal).toBe(true);
    expect(page.startTimer).not.toHaveBeenCalled();
    expect(storageService.get('smart_review_ids', [])).toEqual([other[0].id]);
  });

  it('continues to honor the exact review selection order when no whole paper was requested', async () => {
    const bank = paperBank('english1-2007', 52);
    storageService.save('v30_bank', bank);
    const selectedIds = [bank[7].id, bank[2].id];
    storageService.save('smart_review_ids', selectedIds);
    const prepared = storageService.prepareQuizReview({ ids: selectedIds, expectedOwner: '' });
    expect(prepared.success).toBe(true);
    const page = quizContext('');
    page.smartReviewId = prepared.id;
    await DoQuizPage.methods.loadQuestions.call(page);
    expect(page.questions.map((q) => q.id)).toEqual(selectedIds);
    expect(storageService.get('smart_review_ids', [])).toEqual(selectedIds);
  });

  it.each(['duplicate_ids', 'missing_ids', 'empty_stem', 'malformed_bank'])(
    'rejects an incomplete or corrupted specified paper without mixing other papers: %s',
    async (damage) => {
      const selected = paperBank('english1-2007', 52);
      if (damage === 'duplicate_ids') selected[1].id = selected[0].id;
      if (damage === 'missing_ids') selected[1].id = '';
      if (damage === 'empty_stem') selected[1].question = ' ';
      storageService.save('v30_bank', damage === 'malformed_bank' ? {} : [...selected, ...paperBank('math3-2007', 24)]);
      const before = JSON.stringify(storageService.get('v30_bank'));
      const page = quizContext();
      page.questions = paperBank('math3-2007', 24);
      await DoQuizPage.methods.loadQuestions.call(page);
      expect(page.questions).toEqual([]);
      expect(page.questionBankFingerprint).toBe('');
      expect(page.showEmptyBankModal).toBe(true);
      expect(page.startTimer).not.toHaveBeenCalled();
      expect(JSON.stringify(storageService.get('v30_bank'))).toBe(before);
    }
  );

  it('keeps the full-paper progress context on refresh and restores the old position only after confirmation', async () => {
    const selected = paperBank('english1-2007', 52);
    storageService.save('v30_bank', selected);
    const first = quizContext();
    await DoQuizPage.methods.loadQuestions.call(first);
    first.currentIndex = 10;
    first.seconds = 75;
    DoQuizPage.methods.saveCurrentProgress.call(first, true);
    const saved = JSON.stringify(storageService.get('EXAM_QUIZ_PROGRESS'));
    const reopened = quizContext();
    await DoQuizPage.methods.loadQuestions.call(reopened);
    DoQuizPage.methods.checkUnfinishedProgress.call(reopened);
    expect(reopened.showResumeModal).toBe(true);
    expect(reopened.currentIndex).toBe(0);
    expect(reopened.answeredQuestions).toEqual([]);
    expect(JSON.stringify(storageService.get('EXAM_QUIZ_PROGRESS'))).toBe(saved);
    DoQuizPage.methods.restoreProgress.call(reopened);
    expect(reopened.currentIndex).toBe(10);
    expect(reopened.seconds).toBe(75);
    expect(reopened.questions.map((q) => q.id)).toEqual(selected.map((q) => q.id));
    expect(reopened.answeredQuestions).toEqual([]);
    expect(reopened.hasAnswered).toBe(false);
    expect(JSON.stringify(storageService.get('EXAM_QUIZ_PROGRESS'))).toBe(saved);
    const unrelated = quizContext('math3-2007');
    unrelated.questionBankFingerprint = 'other';
    DoQuizPage.methods.checkUnfinishedProgress.call(unrelated);
    expect(unrelated.showResumeModal).toBe(false);
    expect(JSON.stringify(storageService.get('EXAM_QUIZ_PROGRESS'))).toBe(saved);
  });

  it('honors resume=true by restoring the saved question snapshot without current-bank context filtering', () => {
    expect(source).toContain('forceResumeProgress');
    expect(source).toContain("query.resume === 'true'");
    expect(source).toContain('this.forceResumeProgress ? null : this.quizProgressContext');
  });
});

function choiceContext(type = 'single_choice', answer = 'A') {
  const page = {
    ...DoQuizPage.data(),
    sessionId: 'quiz_reference_observation',
    currentQuestion: normalizeQuizQuestion({
      id: 'draft-choice',
      question: '本轮合成原题',
      type,
      answer,
      options: ['第一项', '第二项', '第三项', '第四项']
    }),
    _safeTimeout: vi.fn(),
    saveCurrentProgress: vi.fn(),
    calculateSpeedScore: vi.fn(() => 75),
    updateQuestionElo: vi.fn(() => ({ userRating: 1500 })),
    recordAnswerToAnalytics: vi.fn(async () => null),
    updateStudyStats: vi.fn(),
    playCorrectEffect: vi.fn(),
    playWrongEffect: vi.fn(),
    showComboFeedbackIfNeeded: vi.fn(),
    clearComboFeedback: vi.fn(),
    saveToMistakes: vi.fn(async () => null),
    fetchAIDeepAnalysis: vi.fn(async () => null),
    _buildPersonalHint: vi.fn(() => '')
  };
  page.isCorrectOption = (index) => index === 0;
  page.selectOption = DoQuizPage.methods.selectOption.bind(page);
  page.submitChoice = DoQuizPage.methods.submitChoice?.bind(page);
  if (DoQuizPage.computed.canSubmitChoice) {
    Object.defineProperty(page, 'canSubmitChoice', { get: () => DoQuizPage.computed.canSubmitChoice.call(page) });
  }
  return page;
}

describe('practice choice requires explicit submission', () => {
  beforeEach(() => {
    uni.clearStorageSync();
    vi.clearAllMocks();
  });

  it('legacy next/rating never changes an accepted schedule or increments the optimizer counter', () => {
    storageService.save('fsrs_card_draft-choice', { due: 7, reps: 9, unique: '原卡片' }, true);
    uni.setStorageSync('fsrs_review_count', '49');
    const page = choiceContext();
    page.toNext = vi.fn();
    page.hasAnswered = true;
    page.resultStatus = 'correct';
    const before = JSON.stringify(global.__mockStorage);
    DoQuizPage.methods.rateAndNext.call(page, 3);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(page.toNext).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'smart_review', 'single'])(
    'leaving %s retains current bank, old backup and unresolved legacy flags',
    (mode) => {
      const page = choiceContext();
      page.mode = mode;
      storageService.save('v30_bank', [{ id: 'new-current', unique: '现原件' }], true);
      storageService.save('v30_bank_backup', [{ id: 'old-original', unique: '旧恢复资料' }], true);
      storageService.save('is_review_mode', true, true);
      storageService.save('temp_review_questions', [{ unique: '未决旧交接' }], true);
      const before = JSON.stringify(global.__mockStorage);
      DoQuizPage.methods._restoreQuestionBankIfReview.call(page);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it.each([1, 2, 3, 4])(
    'stores explicit self rating %s as neutral and durable without answer statistics or correctness awards',
    async (rating) => {
      const page = choiceContext('analysis', '参考');
      await DoQuizPage.methods.flipFlashcard.call(page);
      page.toNext = vi.fn();
      await DoQuizPage.methods.rateFlashcardAndNext.call(page, rating);
      expect(page.answeredQuestions[0]).toMatchObject({
        userChoice: `flashcard_rating_${rating}`,
        rating,
        isCorrect: null,
        source: 'self_rating',
        mode: 'flashcard'
      });
      expect(page.updateStudyStats).not.toHaveBeenCalled();
      expect(page.playCorrectEffect).not.toHaveBeenCalled();
      expect(page.recordAnswerToAnalytics).not.toHaveBeenCalled();
      expect(page.saveCurrentProgress).toHaveBeenCalledWith(true);
      expect(page.toNext).toHaveBeenCalledTimes(1);
    }
  );

  it.each([0, 5, '3', -1, 1.5])('rejects invalid self rating %s without a record or schedule change', (rating) => {
    const page = choiceContext('analysis', '参考');
    page.flashcardFlipped = true;
    page.toNext = vi.fn();
    const before = JSON.stringify(global.__mockStorage);
    DoQuizPage.methods.rateFlashcardAndNext.call(page, rating);
    expect(page.answeredQuestions).toEqual([]);
    expect(page.toNext).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('does not self-rate before reading or carry a reference reveal into the next task', () => {
    const page = choiceContext('analysis', '参考');
    page.toNext = vi.fn();
    DoQuizPage.methods.rateFlashcardAndNext.call(page, 3);
    expect(page.answeredQuestions).toEqual([]);
    page.flashcardFlipped = true;
    page.startQuestionTimer = vi.fn();
    page.updateQuestionNotes = vi.fn();
    DoQuizPage.methods.resetQuestionState.call(page);
    expect(page.flashcardFlipped).toBe(false);
    expect(page.flashcardFsrsPreview).toBeNull();
  });

  it('keeps a partially answered session at the last position and goes to its first unanswered question', async () => {
    const page = choiceContext();
    page.questions = paperBank('partial', 3);
    page.currentIndex = 2;
    page.hasAnswered = true;
    page.answeredQuestions = [{ questionId: page.questions[2].id, index: 2, userChoice: 0, isCorrect: true }];
    page.startQuestionTimer = vi.fn();
    page.updateQuestionNotes = vi.fn();
    page.resetQuestionState = DoQuizPage.methods.resetQuestionState.bind(page);
    page.saveCurrentProgress = DoQuizPage.methods.saveCurrentProgress.bind(page);
    page.quizProgressContext = { mode: 'normal', paperId: 'partial', questionBankFingerprint: '' };
    page.updateFavoriteStatus = vi.fn();
    page.autoDiagnose = vi.fn(async () => null);
    storageService.save('EXAM_QUIZ_PROGRESS', { retained: 'original partial' });
    await DoQuizPage.methods.toNext.call(page);
    expect(page.showCompleteModal).toBe(false);
    expect(page.currentIndex).toBe(0);
    expect(page.answeredQuestions).toHaveLength(1);
    page.saveCurrentProgress(true);
    expect(storageService.get('EXAM_QUIZ_PROGRESS')).toMatchObject({
      currentIndex: 0,
      hasAnswered: false,
      answeredQuestions: [{ questionId: page.questions[2].id, index: 2, userChoice: 0 }]
    });
    expect(page.autoDiagnose).not.toHaveBeenCalled();
  });
  it('keeps changing options as drafts with zero answer, analytics, statistics or storage until submit', async () => {
    uni.clearStorageSync();
    storageService.save('unrelated-retained', { value: 'keep' });
    const before = JSON.stringify(global.__mockStorage);
    const page = choiceContext();
    await page.selectOption(0);
    expect(page.hasAnswered).toBe(false);
    await page.selectOption(2);
    expect(page.userChoice).toBe(2);
    expect(page.answeredQuestions).toEqual([]);
    expect(page.showResult).toBe(false);
    expect(page.updateStudyStats).not.toHaveBeenCalled();
    expect(page.updateQuestionElo).not.toHaveBeenCalled();
    expect(page.recordAnswerToAnalytics).not.toHaveBeenCalled();
    expect(page.saveToMistakes).not.toHaveBeenCalled();
    expect(page.fetchAIDeepAnalysis).not.toHaveBeenCalled();
    expect(stopTimer).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it.each([0, 1])(
    'records choice %i without inferred grade, mistake, Elo, model or automatic review',
    async (choice) => {
      const page = choiceContext();
      await page.selectOption(choice);
      await page.submitChoice();
      expect(page.answeredQuestions[0]).toMatchObject({
        isCorrect: null,
        source: 'reference_match',
        grade: { status: 'pending' }
      });
      expect(page.resultStatus).toBe('pending');
      expect(page.updateQuestionElo).not.toHaveBeenCalled();
      expect(page.saveToMistakes).not.toHaveBeenCalled();
      expect(page.fetchAIDeepAnalysis).not.toHaveBeenCalled();
      expect(page.playCorrectEffect).not.toHaveBeenCalled();
      expect(page.playWrongEffect).not.toHaveBeenCalled();
      page.toNext = vi.fn();
      page.rateAndNext = vi.fn();
      DoQuizPage.methods.closeResult.call(page);
      expect(page.toNext).toHaveBeenCalledTimes(1);
      expect(page.rateAndNext).not.toHaveBeenCalled();
    }
  );

  it('requires the complete multi-choice draft and only records it once after explicit submit', async () => {
    const page = choiceContext('multi_choice', 'AC');
    await page.selectOption(2);
    await page.selectOption(0);
    expect(page.hasAnswered).toBe(false);
    expect(page.userChoice).toEqual([0, 2]);
    await page.submitChoice();
    expect(page.answeredQuestions).toHaveLength(1);
    expect(page.answeredQuestions[0]).toMatchObject({
      userChoice: [0, 2],
      isCorrect: null,
      referenceMatch: true,
      grade: { status: 'pending' }
    });
    await page.submitChoice();
    expect(page.answeredQuestions).toHaveLength(1);
    expect(page.recordAnswerToAnalytics).toHaveBeenCalledTimes(1);
    expect(page.updateStudyStats).toHaveBeenCalledTimes(1);
    expect(stopTimer).toHaveBeenCalledTimes(1);
  });

  it('records the last single-choice draft once, then prevents changes and repeated commits', async () => {
    const page = choiceContext();
    await page.selectOption(2);
    await page.selectOption(0);
    await page.submitChoice();
    await page.selectOption(3);
    await page.submitChoice();
    expect(page.userChoice).toBe(0);
    expect(page.answeredQuestions).toHaveLength(1);
    expect(page.answeredQuestions[0]).toMatchObject({
      userChoice: 0,
      isCorrect: null,
      referenceMatch: true,
      timeSpent: 2000
    });
    expect(page.updateStudyStats).toHaveBeenCalledTimes(1);
    expect(page.recordAnswerToAnalytics).toHaveBeenCalledTimes(1);
  });

  it('durably saves the submitted multi answer immediately, before next, hide, unload or a debounce can run', async () => {
    const page = choiceContext('multi_choice', 'AC');
    page.questions = [page.currentQuestion, { ...page.currentQuestion, id: 'another-question' }];
    page.quizProgressContext = { mode: 'normal', paperId: '', questionBankFingerprint: '' };
    page.saveCurrentProgress = DoQuizPage.methods.saveCurrentProgress.bind(page);
    await page.selectOption(2);
    await page.selectOption(0);
    expect(storageService.get('EXAM_QUIZ_PROGRESS', null)).toBeNull();
    await page.submitChoice();
    const saved = storageService.get('EXAM_QUIZ_PROGRESS', null);
    expect(saved).toMatchObject({
      currentIndex: 0,
      hasAnswered: true,
      userChoice: [0, 2],
      answeredQuestions: [{ questionId: 'draft-choice', userChoice: [0, 2], isCorrect: null, referenceMatch: true }]
    });
    const reopened = quizContext('', '');
    DoQuizPage.methods.restoreProgress.call(reopened);
    expect(reopened.answeredQuestions).toMatchObject([{ questionId: 'draft-choice', userChoice: [0, 2] }]);
    expect(reopened.userChoice).toEqual([0, 2]);
    expect(reopened.hasAnswered).toBe(true);
    expect(reopened.showResult).toBe(true);
    expect(reopened.startQuestionTimer).not.toHaveBeenCalled();
    DoQuizPage.methods.selectOption.call(reopened, 1);
    expect(reopened.userChoice).toEqual([0, 2]);
    expect(reopened.answeredQuestions).toEqual(saved.answeredQuestions);
    expect(reopened.recordAnswerToAnalytics).toBeUndefined();
  });

  it('toggles a multi-choice draft without granting a result for a subset', async () => {
    const page = choiceContext('multi_choice', 'AC');
    await page.selectOption(0);
    await page.selectOption(2);
    await page.selectOption(2);
    expect(page.userChoice).toEqual([0]);
    expect(page.answeredQuestions).toEqual([]);
    await page.submitChoice();
    expect(page.answeredQuestions[0]).toMatchObject({ userChoice: [0], isCorrect: null, referenceMatch: false });
    expect(page.saveToMistakes).not.toHaveBeenCalled();
    expect(page.fetchAIDeepAnalysis).not.toHaveBeenCalled();
  });

  it.each([null, [], -1, 4, '0', 1.5, NaN, [0, 0]])('rejects an empty or invalid explicit draft: %j', async (draft) => {
    const page = choiceContext(Array.isArray(draft) ? 'multi_choice' : 'single_choice');
    page.userChoice = draft;
    await page.submitChoice();
    expect(page.hasAnswered).toBe(false);
    expect(page.answeredQuestions).toEqual([]);
    expect(stopTimer).not.toHaveBeenCalled();
    expect(page.updateStudyStats).not.toHaveBeenCalled();
  });

  it.each(['isAnalyzing', 'isNavigating', 'showResult', 'hasAnswered', 'showResumeModal', 'resumeUnavailable'])(
    'guards both selection and explicit commit while %s',
    async (lock) => {
      const page = choiceContext();
      page.userChoice = 0;
      page[lock] = true;
      await page.selectOption(2);
      await page.submitChoice();
      expect(page.userChoice).toBe(0);
      expect(page.answeredQuestions).toEqual([]);
      expect(page.updateStudyStats).not.toHaveBeenCalled();
    }
  );

  it('does not create choice drafts or answers on translation/flashcard questions', async () => {
    const page = choiceContext('translation', '参考译文');
    await page.selectOption(0);
    expect(page.userChoice).toBeNull();
    page.userChoice = 0;
    await page.submitChoice();
    expect(page.answeredQuestions).toEqual([]);
    expect(stopTimer).not.toHaveBeenCalled();
  });

  it('clears an unsubmitted draft on question navigation without manufacturing an answer', () => {
    const page = choiceContext('multi_choice', 'AC');
    page.userChoice = [0, 2];
    page.startQuestionTimer = vi.fn();
    page.updateQuestionNotes = vi.fn();
    DoQuizPage.methods.resetQuestionState.call(page);
    expect(page.userChoice).toBeNull();
    expect(page.hasAnswered).toBe(false);
    expect(page.answeredQuestions).toEqual([]);
  });

  it('passes the complete canonical multi answer into the existing analytics adapter', async () => {
    const page = choiceContext('multi_choice', 'AC');
    page.userChoice = [0, 2];
    page.sessionId = 'isolated-session';
    page.answeredQuestions = [
      {
        index: 0,
        questionId: 'draft-choice',
        attemptId: 'quiz_answer_original',
        ownerId: '',
        userChoice: [0, 2],
        userAnswer: 'AC',
        timeSpent: 2000,
        referenceMatch: true
      }
    ];
    await DoQuizPage.methods.recordAnswerToAnalytics.call(page, true, 2000);
    const data = recordAnswerToAnalytics.mock.calls[0][0];
    expect(data.userChoice).toEqual([0, 2]);
    expect(data.getOptionLabel(data.userChoice)).toBe('AC');
    expect(data.attemptId).toBe('quiz_answer_original');
  });

  it('retries the saved original with one in-flight request, persists its receipt and never increments learning counts', async () => {
    const page = choiceContext('multi_choice', 'AC');
    page.sessionId = 'quiz_original_session';
    page.answeredQuestions = [
      {
        index: 0,
        questionId: 'draft-choice',
        attemptId: 'quiz_answer_original',
        ownerId: '',
        source: 'reference_match',
        userChoice: [0, 2],
        userAnswer: 'AC',
        timeSpent: 2300,
        referenceMatch: true,
        grade: { status: 'pending' },
        isCorrect: null
      }
    ];
    page.userChoice = [1];
    let finish;
    recordAnswerToAnalytics.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const request = DoQuizPage.methods.recordAnswerToAnalytics.call(page);
    await DoQuizPage.methods.recordAnswerToAnalytics.call(page);
    expect(recordAnswerToAnalytics).toHaveBeenCalledTimes(1);
    const payload = recordAnswerToAnalytics.mock.calls[0][0];
    expect(payload.userChoice).toEqual([0, 2]);
    expect(payload.timeSpent).toBe(2300);
    expect(payload.getOptionLabel()).toBe('AC');
    finish({ submission: { status: 'received', recordId: 'original-receipt', localSaved: true } });
    await request;
    expect(page.answeredQuestions).toHaveLength(1);
    expect(page.answeredQuestions[0]).toMatchObject({
      userAnswer: 'AC',
      isCorrect: null,
      grade: { status: 'pending' },
      submission: { recordId: 'original-receipt' }
    });
    expect(page.saveCurrentProgress).toHaveBeenCalledWith(true);
    expect(page.updateStudyStats).not.toHaveBeenCalled();
    expect(page.syncingAttemptIds).toEqual([]);
  });

  it.each([
    [{ status: 'received', localSaved: true }, '已同步，判分待核对'],
    [{ status: 'local_only', localSaved: true }, '仅保存在本机'],
    [{ status: 'unconfirmed', localSaved: true }, '已保存在本机，同步未完成'],
    [{ status: 'local_only', localSaved: false }, '保存状态待确认']
  ])('shows only the confirmed persistence state %j', (submission, expected) => {
    const page = choiceContext();
    page.currentAnswerRecord = { attemptId: 'stable-original', ownerId: '', userAnswer: 'A', submission };
    expect(DoQuizPage.computed.answerSyncText.call(page)).toBe(expected);
    expect(DoQuizPage.computed.canRetryAnswerSync.call(page)).toBe(false);
    page.syncingAttemptIds = ['stable-original'];
    expect(DoQuizPage.computed.answerSyncText.call(page)).toBe('正在同步…');
  });

  it('does not manufacture a retry identity for drafts or silently adopt an older account answer', async () => {
    const page = choiceContext();
    page.userChoice = 0;
    await DoQuizPage.methods.recordAnswerToAnalytics.call(page);
    page.answeredQuestions = [
      { index: 0, questionId: 'draft-choice', attemptId: 'old-attempt', userAnswer: 'A', ownerId: 'other-owner' }
    ];
    await DoQuizPage.methods.recordAnswerToAnalytics.call(page);
    expect(recordAnswerToAnalytics).not.toHaveBeenCalled();
  });

  it('saves a per-submission identity before analytics and gives a new explicit attempt a distinct identity', async () => {
    const page = choiceContext('single_choice', 'A');
    page.sessionId = 'quiz_original_session';
    page.currentQuestion.question = '原题';
    page.questions = [page.currentQuestion, { id: 'next', question: '下一题' }];
    page.saveCurrentProgress = DoQuizPage.methods.saveCurrentProgress.bind(page);
    page.selectOption(0);
    await page.submitChoice();
    const first = page.answeredQuestions[0].attemptId;
    expect(first).toMatch(/^quiz_answer_[a-zA-Z0-9_-]+$/);
    const saved = storageService.get('EXAM_QUIZ_PROGRESS');
    expect(saved.sessionId).toBe('quiz_original_session');
    expect(saved.answeredQuestions[0].attemptId).toBe(first);
    page.hasAnswered = false;
    page.showResult = false;
    page.selectOption(0);
    await page.submitChoice();
    expect(page.answeredQuestions[0].attemptId).not.toBe(first);
    expect(saved.answeredQuestions[0].attemptId).toBe(first);
  });

  it.each(['navigation', 'new_attempt', 'account', 'session', 'closed', 'token'])(
    'rejects stale analytics after %s and keeps the original answer binding',
    async (change) => {
      let finish;
      recordAnswerToAnalytics.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      const page = choiceContext('multi_choice', 'AC');
      page.sessionId = 'quiz_original_session';
      page.userChoice = [0, 2];
      page.answeredQuestions = [
        {
          index: 0,
          questionId: 'draft-choice',
          attemptId: 'quiz_answer_original',
          ownerId: '',
          userChoice: [0, 2],
          userAnswer: 'AC',
          timeSpent: 2000
        }
      ];
      const request = DoQuizPage.methods.recordAnswerToAnalytics.call(page, true, 2000);
      const submitted = recordAnswerToAnalytics.mock.calls[0][0];
      if (change === 'navigation') {
        page.currentIndex = 1;
        page.currentQuestion = { id: 'later-choice', type: 'single_choice', options: ['甲', '乙'], answer: 'A' };
        page.answeredQuestions.push({ index: 1, questionId: 'later-choice', attemptId: 'quiz_answer_later' });
      }
      if (change === 'new_attempt')
        page.answeredQuestions[0] = { index: 0, questionId: 'draft-choice', attemptId: 'quiz_answer_later' };
      if (change === 'account') uni.setStorageSync('EXAM_USER_ID', 'local-other');
      if (change === 'session') page.sessionId = 'quiz_other_session';
      if (change === 'closed') page.quizPageClosed = true;
      if (change === 'token') uni.setStorageSync('EXAM_TOKEN', 'later-token');
      const before = JSON.stringify(page.answeredQuestions);
      expect(submitted.getOptionLabel([0, 2])).toBe('AC');
      finish({ questionId: 'draft-choice', submission: { status: 'received', localSaved: true } });
      await request;
      expect(JSON.stringify(page.answeredQuestions)).toBe(before);
    }
  );

  it('legacy multi-reference mismatch cannot create or mutate a reliable mistake', async () => {
    const save = vi.spyOn(storageService, 'saveMistake').mockResolvedValue({ success: true, id: 'isolated' });
    try {
      const before = JSON.stringify(global.__mockStorage);
      const result = await saveToMistakes({
        currentQuestion: choiceContext('multi_choice', 'AC').currentQuestion,
        userChoice: [0, 3]
      });
      expect(result).toMatchObject({ success: false, code: 'RELIABLE_GRADE_REQUIRED' });
      expect(save).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    } finally {
      save.mockRestore();
    }
  });
});
