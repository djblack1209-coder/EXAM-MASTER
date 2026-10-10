import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import storageService from '@/services/storageService.js';
import DoQuizPage from '@/pages/practice-sub/do-quiz.vue';
import { useQuizEngine } from '@/pages/practice-sub/composables/useQuizEngine.js';
import { saveQuizProgress, loadQuizProgress } from '@/composables/useQuizAutoSave.js';

const key = 'quiz_review_handoff_v1';
const bank = () => [
  {
    id: 0,
    question: '原题零号',
    type: 'single_choice',
    options: ['A.甲', 'B.乙'],
    answer: 'B',
    paperId: 'paper',
    passage: '整段原文',
    source: { title: '原来源' },
    sourceLicense: { status: 'unknown' }
  },
  { id: 'two', question: '原题二号', type: 'flashcard', answer: '完整参考', paperId: 'paper' }
];
function page(id, owner = 'owner-a', paperId = '') {
  return {
    ...DoQuizPage.data(),
    mode: 'smart_review',
    _smartReviewMode: true,
    smartReviewId: id,
    paperId,
    quizOwnerId: owner,
    startTimer: vi.fn(),
    startQuestionTimer: vi.fn(),
    buildQuestionBankFingerprint: DoQuizPage.methods.buildQuestionBankFingerprint
  };
}
describe('owned complete review selection', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    uni.clearStorageSync();
    uni.setStorageSync('EXAM_USER_ID', 'owner-a');
    storageService.save('v30_bank', bank(), true);
    storageService.save('smart_review_ids', ['old-global'], true);
  });
  it('freezes the exact selected order and originals; refresh retains the handoff without learning writes', async () => {
    const result = storageService.prepareQuizReview({ ids: ['two', 0], expectedOwner: 'owner-a' });
    expect(result.success).toBe(true);
    const saved = storageService.get(key, null, { migrateLegacy: false });
    expect(saved.ownerId).toBe('owner-a');
    expect(saved.questions.map((q) => q.id)).toEqual(['two', 0]);
    storageService.save('v30_bank', [{ ...bank()[0], answer: 'A' }], true);
    const before = JSON.stringify(global.__mockStorage);
    for (let i = 0; i < 2; i++) {
      const context = page(result.id);
      await DoQuizPage.methods.loadQuestions.call(context);
      expect(context.questions.map((q) => q.id)).toEqual(['two', 0]);
      expect(context.questions[1].quizOriginal.fields).toMatchObject({
        answer: 'B',
        passage: '整段原文',
        source: { title: '原来源' }
      });
    }
    const engine = useQuizEngine();
    expect(engine.loadQuestions({ mode: 'smart_review', reviewId: result.id })).toBe(true);
    expect(engine.questions.value.map((q) => q.id)).toEqual(['two', 0]);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });
  it.each(['missing', 'duplicate', 'incomplete', 'stale-owner'])(
    'rejects %s before writing or replacing a prior launch',
    (damage) => {
      const first = storageService.prepareQuizReview({ ids: [0], expectedOwner: 'owner-a' });
      expect(first.success).toBe(true);
      let ids = [0],
        owner = 'owner-a';
      if (damage === 'missing') ids = [0, 'missing'];
      if (damage === 'duplicate') ids = [0, 0];
      if (damage === 'incomplete') storageService.save('v30_bank', [{ ...bank()[0], answer: '' }], true);
      if (damage === 'stale-owner') owner = 'owner-b';
      const before = JSON.stringify(global.__mockStorage);
      expect(storageService.prepareQuizReview({ ids, expectedOwner: owner }).success).toBe(false);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );
  it.each(['save', 'read', 'readback'])('does not claim a usable launch after %s failure', (failure) => {
    const prior = storageService.save.bind(storageService),
      read = storageService.get.bind(storageService);
    if (failure === 'save')
      vi.spyOn(storageService, 'save').mockImplementation((k, ...args) => (k === key ? false : prior(k, ...args)));
    else
      vi.spyOn(storageService, 'get').mockImplementation((k, ...args) => {
        if (k === key) {
          if (failure === 'read') throw new Error('isolated read failure');
          return { contract: 'corrupted' };
        }
        return read(k, ...args);
      });
    expect(storageService.prepareQuizReview({ ids: [0], expectedOwner: 'owner-a' }).success).toBe(false);
    vi.restoreAllMocks();
  });
  it('rejects a different account, superseded launch and mismatched paper without consuming any selection', async () => {
    const old = storageService.prepareQuizReview({ ids: [0], expectedOwner: 'owner-a', paperId: 'paper' });
    const current = storageService.prepareQuizReview({ ids: ['two'], expectedOwner: 'owner-a', paperId: 'paper' });
    expect(current.success).toBe(true);
    for (const context of [page(old.id), page(current.id, 'owner-a', 'other')]) {
      const before = JSON.stringify(global.__mockStorage);
      await DoQuizPage.methods.loadQuestions.call(context);
      expect(context.questions).toEqual([]);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
    uni.setStorageSync('EXAM_USER_ID', 'owner-b');
    storageService.save('v30_bank', bank(), true);
    const before = JSON.stringify(global.__mockStorage),
      context = page(current.id, 'owner-b');
    await DoQuizPage.methods.loadQuestions.call(context);
    expect(context.questions).toEqual([]);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });
  it('does not treat an old global id array as account authority', async () => {
    storageService.save('smart_review_ids', [0], true);
    const context = page('');
    const before = JSON.stringify(global.__mockStorage);
    await DoQuizPage.methods.loadQuestions.call(context);
    expect(context.questions).toEqual([]);
    expect(useQuizEngine().loadQuestions({ mode: 'smart_review' })).toBe(false);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });
  it('requires both the saved body owner and exact launch id, not only a private storage key', async () => {
    const launch = storageService.prepareQuizReview({ ids: [0], expectedOwner: 'owner-a' });
    const saved = storageService.get(key);
    for (const damage of [
      { ownerId: 'owner-b' },
      { id: 'other-launch' },
      { questions: [bank()[0]] },
      { questions: [{ ...saved.questions[0], answer: 'A' }] }
    ]) {
      storageService.save(key, { ...saved, ...damage }, true);
      const before = JSON.stringify(global.__mockStorage),
        context = page(launch.id);
      await DoQuizPage.methods.loadQuestions.call(context);
      expect(context.questions).toEqual([]);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  });
  it('keeps progress from two launches separate, while explicit resume retains the original snapshot', async () => {
    const first = storageService.prepareQuizReview({ ids: [0, 'two'], expectedOwner: 'owner-a' });
    const context = page(first.id);
    await DoQuizPage.methods.loadQuestions.call(context);
    const scope = DoQuizPage.computed.quizProgressContext.call(context);
    saveQuizProgress({ questions: context.questions, currentIndex: 1, answeredQuestions: [], seconds: 5 }, true, scope);
    expect(loadQuizProgress(scope)).not.toBeNull();
    const second = storageService.prepareQuizReview({ ids: [0, 'two'], expectedOwner: 'owner-a' });
    const next = page(second.id);
    await DoQuizPage.methods.loadQuestions.call(next);
    expect(loadQuizProgress(DoQuizPage.computed.quizProgressContext.call(next))).toBeNull();
    const resumed = page('');
    resumed.forceResumeProgress = true;
    await DoQuizPage.methods.loadQuestions.call(resumed);
    expect(resumed.smartReviewId).toBe(first.id);
    expect(resumed.singlePracticeId).toBe('');
    expect(resumed.questions[0].quizOriginal).toEqual(context.questions[0].quizOriginal);
  });
});
