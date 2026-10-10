import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import FavoritePage from '@/pages/favorite/index.vue';
import { storageService } from '@/services/storageService.js';
import { useFavoriteStore } from '@/stores/modules/favorite.js';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
import { useStudyStore } from '@/stores/modules/study.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { emptyLearningState, applyLearningOperation } from '@/services/learning/learning-domain.js';
import questionFavoriteManager from '@/utils/favorite/question-favorite.js';
import { LEGACY_REVIEW_HANDOFF_KEY, readLegacyReviewHandoff } from '@/services/quiz-session-contract.js';
import { normalizeQuizQuestion } from '@/services/quiz-session-contract.js';
import { readSinglePracticeHandoff } from '@/services/quiz-session-contract.js';
import { recordQuizLearningAttempt } from '@/services/learning/quiz-learning-bridge.js';

// 普通 Vue 测试运行时不提供 uni-app 的 injectHook；页面控制器显式加载，平台生命周期在真实构建/浏览器验证。
vi.mock('@dcloudio/uni-app', () => ({ onLoad: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() }));

const question = {
  id: 'q_math_1',
  question: '设函数 f(x)=x²，求 f(2)。',
  options: ['A. 2', 'B. 4', 'C. 6', 'D. 8'],
  answer: 'B',
  category: '数学',
  subject: '数学',
  desc: '代入 x=2 可得 4。'
};

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('offline business closure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 23, 30));
    setActivePinia(createPinia());
    uni.clearStorageSync();
    questionFavoriteManager.isInitialized = false;
    questionFavoriteManager.favorites = [];
    questionFavoriteManager.folders = questionFavoriteManager.folders.slice(0, 4);
    storageService.save('v30_bank', [question], true);
    storageService.save(
      'mistake_book',
      [
        {
          id: 'm_math_1',
          question: question.question,
          options: question.options,
          correct_answer: 'B',
          user_answer: 'A',
          category: '数学',
          error_type: 'calculation_error',
          wrong_count: 2,
          created_at: Date.now() - 86400000
        }
      ],
      true
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('groups legacy tags without writing derived caches, inventing trends or default reference answers', async () => {
    const mistakes = Array.from({ length: 12 }, (_, index) => ({
      id: `old-${index}`,
      question: '完整旧题',
      category: '数学',
      error_type: 'calculation_error',
      wrong_count: 99,
      timestamp: Date.now() - index * 1000,
      ...(index === 0 ? { options: ['甲', '乙'], correct_answer: 'B' } : {})
    }));
    storageService.save('mistake_book', mistakes, true);
    storageService.save('error_clusters', { retained: 'old cache' }, true);
    const before = JSON.stringify(global.__mockStorage);
    const result = await useStudyEngineStore().getErrorClusters();
    expect(result.data).toMatchObject({
      contract: 'legacy-error-groups-v1',
      scoringAuthority: false,
      summary: { totalMistakes: 12, reviewableCount: 1 }
    });
    const group = result.data.clusters[0];
    expect(group).toMatchObject({ questionCount: 12, countBand: 'high', reviewableCount: 1 });
    for (const key of ['severity', 'trend', 'suggestion']) expect(group).not.toHaveProperty(key);
    expect(group.examples[1].referenceAnswer).toBe('');
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('launches only complete current-account legacy items without touching bank, backups or raw records', async () => {
    const records = [
      { ...question, id: 'multi', type: 'multi_choice', answer: 'AC' },
      { ...question, id: 'missing', options: [], answer: null },
      { ...question, id: 'duplicate' },
      { ...question, id: 'duplicate' }
    ];
    storageService.save('mistake_book', records, true);
    storageService.save('v30_bank_backup', [{ unique: 'rollback' }], true);
    storageService.save('is_review_mode', true, true);
    const before = JSON.parse(JSON.stringify(global.__mockStorage));
    const engine = useStudyEngineStore();
    const result = engine.prepareLegacyReview({ expectedOwnerId: '', recordIds: records.map((r) => r.id) });
    expect(result).toMatchObject({ success: true, count: 1, skipped: 3 });
    const handoff = storageService.get(LEGACY_REVIEW_HANDOFF_KEY);
    expect(readLegacyReviewHandoff(handoff, handoff.id, '')[0].answer).toBe('AC');
    expect(result.url).toContain(`reviewId=${handoff.id}`);
    for (const [key, value] of Object.entries(before)) expect(global.__mockStorage[key]).toEqual(value);
    const after = JSON.stringify(global.__mockStorage);
    expect(engine.prepareLegacyReview({ expectedOwnerId: 'former-owner' }).success).toBe(false);
    expect(JSON.stringify(global.__mockStorage)).toBe(after);
    vi.spyOn(storageService, 'save').mockReturnValue(false);
    expect(engine.prepareLegacyReview({ recordIds: ['multi'] })).toMatchObject({ success: false });
  });

  it('does not migrate guest legacy records or handoffs into a later account during read-only grouping', async () => {
    const guest = storageService.get('mistake_book');
    storageService.save(LEGACY_REVIEW_HANDOFF_KEY, { ownerId: '', retained: true }, true);
    uni.setStorageSync('EXAM_USER_ID', 'later-owner');
    const before = JSON.stringify(global.__mockStorage);
    expect((await useStudyEngineStore().getErrorClusters()).data.clusters).toEqual([]);
    expect(storageService.get(LEGACY_REVIEW_HANDOFF_KEY, null, { migrateLegacy: false })).toBeNull();
    expect(global.__mockStorage.mistake_book).toEqual(guest);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('bounds a large review without labelling complete deferred records as damaged', () => {
    storageService.save(
      'mistake_book',
      Array.from({ length: 201 }, (_, i) => ({ ...question, id: `bounded-${i}` })),
      true
    );
    expect(useStudyEngineStore().prepareLegacyReview()).toMatchObject({
      success: true,
      count: 200,
      skipped: 0,
      deferred: 1
    });
    expect(storageService.get('mistake_book')).toHaveLength(201);
  });

  it.each([
    [2026, 8, 13, 23, 30],
    [2026, 8, 13, 0, 30],
    [2026, 2, 7, 23, 30],
    [2026, 9, 31, 23, 30]
  ])('keeps plan dates on local calendar days at %j', async (...parts) => {
    vi.setSystemTime(new Date(...parts));
    const engine = useStudyEngineStore();
    const result = await engine.generateStudyPlan(dateAfter(3), 1);
    expect(result.data.plans.map((plan) => plan.date)).toEqual([dateAfter(0), dateAfter(1), dateAfter(2)]);
  });

  it('keeps question favorites usable without a backend', async () => {
    const store = useFavoriteStore();
    await store.loadFavorites();
    store.loadFolders();
    store.loadStats();

    const added = await store.toggleFavorite(question);
    expect(added).toMatchObject({ success: true, action: 'added', isFavorited: true });
    expect(await store.checkIsFavorited(question.id)).toBe(true);
    expect(store.favorites).toHaveLength(1);
    expect(store.stats.totalCount).toBe(1);

    const folder = store.createFolder({ name: '数学重点' });
    expect(folder.success).toBe(true);
    expect(store.moveToFolder(added.id, folder.folder.id).success).toBe(true);
    expect(store.favorites[0].folderId).toBe(folder.folder.id);

    const removed = await store.removeFromFavorite(question.id);
    expect(removed).toMatchObject({ success: true, action: 'removed' });
    expect(await store.checkIsFavorited(question.id)).toBe(false);
    expect(store.favorites).toHaveLength(0);
  });

  it('favorites preserve the full raw original and keep two same-id reading versions separate', () => {
    const raw = {
      ...question,
      id: 0,
      passage: '完整原材料',
      source: { title: '本轮原件' },
      questionImages: [{ src: '/original.png' }],
      audio: { transcript: '原音频' },
      sourceLicense: '本轮合成资料',
      question_version: 1
    };
    const displayed = normalizeQuizQuestion(raw);
    const a = questionFavoriteManager.addFavorite(displayed);
    expect(a.success).toBe(true);
    expect(storageService.get('question_favorites')[0]).toMatchObject({
      questionId: 0,
      quizOriginal: displayed.quizOriginal
    });
    const changed = normalizeQuizQuestion({ ...raw, passage: '另一份原文', question_version: 2 });
    expect(questionFavoriteManager.addFavorite(changed).action).toBe('added');
    expect(questionFavoriteManager.getFavorites()).toHaveLength(2);
    expect(questionFavoriteManager.isFavorited(displayed)).toBe(true);
    expect(questionFavoriteManager.isFavorited(normalizeQuizQuestion({ ...raw, passage: '未收藏原文' }))).toBe(false);
  });

  it('favorite singleton reloads each owner without migrating unscoped visitor records', () => {
    storageService.save('question_favorites', [{ id: 'guest-original', questionContent: '访客原件' }], true);
    uni.setStorageSync('EXAM_USER_ID', 'favorite-owner-a');
    expect(questionFavoriteManager.getFavorites()).toEqual([]);
    expect(questionFavoriteManager.addFavorite(question).success).toBe(true);
    uni.setStorageSync('EXAM_USER_ID', 'favorite-owner-b');
    expect(questionFavoriteManager.getFavorites()).toEqual([]);
    uni.setStorageSync('EXAM_USER_ID', 'favorite-owner-a');
    expect(questionFavoriteManager.getFavorites()).toHaveLength(1);
    expect(global.__mockStorage.question_favorites).toEqual([{ id: 'guest-original', questionContent: '访客原件' }]);
  });

  it.each(['add', 'remove', 'note', 'move', 'folder'])(
    'favorite %s save failure keeps accepted storage and memory unchanged',
    (action) => {
      const saved = questionFavoriteManager.addFavorite(question);
      const folder = questionFavoriteManager.createFolder({ name: '原收藏夹' });
      const before = JSON.stringify(global.__mockStorage);
      const beforeRows = questionFavoriteManager.getFavorites();
      const fail = vi.spyOn(storageService, 'save').mockReturnValue(false);
      let result;
      if (action === 'add') result = questionFavoriteManager.addFavorite({ ...question, id: 'new-original' });
      if (action === 'remove') result = questionFavoriteManager.removeFavorite(saved.id);
      if (action === 'note') result = questionFavoriteManager.updateNote(saved.id, '新笔记');
      if (action === 'move') result = questionFavoriteManager.moveToFolder(saved.id, folder.folder.id);
      if (action === 'folder') result = questionFavoriteManager.createFolder({ name: '新收藏夹' });
      fail.mockRestore();
      expect(result.success).toBe(false);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      expect(questionFavoriteManager.getFavorites()).toEqual(beforeRows);
    }
  );

  it('favorite results are detached and the legacy review counter does not create a new review', () => {
    const saved = questionFavoriteManager.addFavorite(question);
    const before = JSON.stringify(global.__mockStorage);
    const rows = questionFavoriteManager.getFavorites();
    rows[0].options[0] = '篡改返回副本';
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(questionFavoriteManager.recordReview(saved.id)).toMatchObject({
      success: false,
      code: 'RELIABLE_REVIEW_REQUIRED'
    });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('a broken favorite cache is retained instead of overwritten by a new favorite', () => {
    storageService.save('question_favorites', { unique: '保留损坏原件' }, true);
    const before = JSON.stringify(global.__mockStorage);
    expect(questionFavoriteManager.addFavorite(question).success).toBe(false);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('rejects stale owner edits even when the favorite id exists in both accounts', () => {
    uni.setStorageSync('EXAM_USER_ID', 'owner-a');
    const saved = questionFavoriteManager.addFavorite(question);
    const row = storageService.get('question_favorites')[0];
    uni.setStorageSync('EXAM_USER_ID', 'owner-b');
    storageService.save('question_favorites', [row], true);
    const before = JSON.stringify(global.__mockStorage);
    expect(questionFavoriteManager.updateNote(saved.id, '旧页笔记', 'owner-a')).toMatchObject({
      success: false,
      code: 'CONTEXT_CHANGED'
    });
    expect(questionFavoriteManager.removeFavorite(saved.id, 'owner-a').success).toBe(false);
    expect(questionFavoriteManager.startPractice(saved.id, 'owner-a').success).toBe(false);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('legacy incomplete favorites remain visible and unchanged but cannot create a full original or review', () => {
    const old = {
      id: 'old-favorite',
      questionId: 'old-q',
      questionContent: '旧正文',
      options: ['甲', '乙'],
      answer: 'A',
      reviewCount: 7,
      lastReviewAt: 1
    };
    storageService.save('question_favorites', [old], true);
    const before = JSON.stringify(global.__mockStorage);
    expect(questionFavoriteManager.getFavorites()[0].questionContent).toBe('旧正文');
    expect(questionFavoriteManager.startPractice(old.id, '')).toMatchObject({
      success: false,
      code: 'ORIGINAL_UNAVAILABLE'
    });
    expect(questionFavoriteManager.getStats()).toMatchObject({
      reviewedCount: 1,
      needReviewCount: 0,
      scoringAuthority: false
    });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('a favorite reference view stays separate from its raw answer and never schedules a reliable review', async () => {
    const saved = questionFavoriteManager.addFavorite(question);
    const start = questionFavoriteManager.startPractice(saved.id, '', { referenceViewed: true });
    const handoff = storageService.get('temp_practice_question');
    const q = readSinglePracticeHandoff(handoff, start.handoffId, '')[0];
    expect(q.legacyReviewContext.referenceViewed).toBe(true);
    expect(learningRepository.read().attempts).toHaveLength(0);
    await recordQuizLearningAttempt({
      currentQuestion: q,
      userAnswer: 'B',
      sessionId: 'favorite_reference',
      attemptId: 'favorite_reference_answer'
    });
    const state = learningRepository.read();
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].hints).toHaveLength(1);
    expect(state.attempts[0].grade.status).toBe('pending');
    expect(state.reviews).toHaveLength(0);
    expect(state.questions[0].quizOriginal).toEqual(handoff.question.quizOriginal);
  });

  it('folder delete uses one saved folder change and leaves all original favorite rows intact', () => {
    const saved = questionFavoriteManager.addFavorite(question);
    const folder = questionFavoriteManager.createFolder({ name: '临时收藏夹' });
    questionFavoriteManager.moveToFolder(saved.id, folder.folder.id);
    const rawBefore = storageService.get('question_favorites');
    const saves = vi.spyOn(storageService, 'save');
    expect(questionFavoriteManager.deleteFolder(folder.folder.id).success).toBe(true);
    expect(saves).toHaveBeenCalledTimes(1);
    expect(storageService.get('question_favorites')).toEqual(rawBefore);
    expect(questionFavoriteManager.getFavorites()[0].folderId).toBe('default');
  });

  it.each(['false', 'throw', 'stale-read'])('single handoff %s persistence is not reported as ready', (failure) => {
    const saved = questionFavoriteManager.addFavorite(question);
    const previous = { unique: '旧临时原件' };
    storageService.save('temp_practice_question', previous, true);
    const save = storageService.save.bind(storageService),
      get = storageService.get.bind(storageService);
    vi.spyOn(storageService, 'save').mockImplementation((key, ...args) => {
      if (key !== 'temp_practice_question') return save(key, ...args);
      if (failure === 'throw') throw Error('synthetic quota');
      return false;
    });
    if (failure === 'stale-read') {
      storageService.save.mockImplementation(() => true);
      vi.spyOn(storageService, 'get').mockImplementation((key, ...args) =>
        key === 'temp_practice_question' ? previous : get(key, ...args)
      );
    }
    expect(questionFavoriteManager.startPractice(saved.id, '').success).toBe(false);
    expect(get('temp_practice_question')).toEqual(previous);
  });

  it.each(['save-failure', 'changed-owner', 'complete'])(
    'actual favorite page %s starts only a confirmed owned full original',
    async (scenario) => {
      const raw = { ...question, id: 0, passage: '收藏的完整阅读原文', source: { title: '原来源' } };
      questionFavoriteManager.addFavorite(normalizeQuizQuestion(raw));
      const wrapper = mount(FavoritePage, { global: { stubs: { BaseIcon: true } } });
      try {
        await wrapper.vm.loadData();
        await flushPromises();
        const button = wrapper.findAll('button').find((b) => b.text() === '练习此题');
        expect(button).toBeTruthy();
        if (scenario === 'save-failure') vi.spyOn(storageService, 'save').mockReturnValue(false);
        if (scenario === 'changed-owner') uni.setStorageSync('EXAM_USER_ID', 'next-favorite-owner');
        const before = JSON.stringify(global.__mockStorage),
          navCount = uni.navigateTo.mock.calls.length;
        await button.trigger('tap');
        await flushPromises();
        if (scenario === 'complete') {
          const handoff = storageService.get('temp_practice_question');
          expect(handoff).toMatchObject({
            contract: 'quiz-single-handoff-v1',
            ownerId: '',
            question: { id: 0, passage: raw.passage }
          });
          expect(handoff.question.quizOriginal.fields.passage).toBe(raw.passage);
          expect(uni.navigateTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ url: expect.stringContaining('singleId=' + handoff.id) })
          );
        } else {
          expect(uni.navigateTo.mock.calls.length).toBe(navCount);
          expect(JSON.stringify(global.__mockStorage)).toBe(before);
        }
      } finally {
        wrapper.unmount();
      }
    }
  );

  it('preserves old attempts and mistake lists without turning their reference matches into mastery', async () => {
    const studyStore = useStudyStore();
    studyStore.recordQuestionAttempt({ question, isCorrect: false, timeSpent: 12000 });
    studyStore.recordQuestionAttempt({ question, isCorrect: true, timeSpent: 8000 });

    const engine = useStudyEngineStore();
    const mastery = await engine.analyzeMastery();
    expect(mastery).toMatchObject({ success: true, source: 'learning-core' });
    expect(mastery.data.mastery).toEqual([]);
    expect(mastery.data.summary.avgMastery).toBeNull();
    expect(mastery.data.legacyHistory).toMatchObject({
      legacyCorrectCount: 1,
      legacyWrongCount: 1,
      legacyAccuracy: 50,
      accuracy: null
    });

    const clusters = await engine.getErrorClusters();
    expect(clusters).toMatchObject({ success: true, source: 'legacy' });
    expect(clusters.data.summary.totalMistakes).toBe(1);
    expect(clusters.data.clusters[0]).toMatchObject({
      errorType: 'calculation_error',
      errorTypeName: '计算失误',
      knowledgePoints: ['数学']
    });

    const progress = await engine.getProgress();
    expect(progress).toMatchObject({ total: 2, completed: 2, correct: 1, mistakes: 1, source: 'local' });

    const plan = await engine.generateStudyPlan(dateAfter(3), 1);
    expect(plan).toMatchObject({ success: true, source: 'local' });
    expect(plan.data.plans.length).toBeGreaterThan(0);
    expect(plan.data.plans.length).toBeLessThanOrEqual(3);
    expect(plan.data.plan.plans).toEqual(plan.data.plans);
    expect(plan.data.plans[0].totalMinutes).toBeGreaterThan(0);
  });

  it('reads reliable task evidence and actual due reviews without overwriting legacy caches or planning stopped tasks', async () => {
    let state = emptyLearningState('fixture-owner', 'Asia/Shanghai');
    let serial = 0;
    const at = Date.now() - 10000;
    const apply = (type, data, id = `e_${++serial}`) => {
      const result = applyLearningOperation(state, { id, type, data, at });
      state = result.state;
      return result.result;
    };
    apply('conversation.start', { goal: '独立合成计算' }, 'c1');
    for (const [id, answer, validation] of [
      ['q_ok', '4', { type: 'number', answer: '4', authority: 'human_reviewed', evidenceId: 'synthetic-review' }],
      ['q_wrong', '5', { type: 'number', answer: '4', authority: 'human_reviewed', evidenceId: 'synthetic-review' }],
      ['q_pending', '4', null]
    ]) {
      apply('question.add', {
        question: {
          id,
          version: 1,
          prompt: '合成 2+2',
          scope: 'private',
          subject: '数学',
          knowledgePoint: id,
          validation,
          uncertainties: []
        }
      });
      apply('question.focus', { conversationId: 'c1', questionKey: `${id}@1` });
      apply('attempt.submit', { conversationId: 'c1', answer, explicit: true }, `answer_${id}`);
    }
    apply('review.schedule', { attemptId: 'answer_q_wrong', due: Date.now() - 1000, rating: 1 });
    const read = vi.spyOn(learningRepository, 'read').mockImplementation(() => state);
    storageService.save('knowledge_mastery', { original: 'keep-this-cache' }, true);
    const before = JSON.stringify(global.__mockStorage);
    const engine = useStudyEngineStore();
    const result = await engine.analyzeMastery();
    expect(result.data.summary).toMatchObject({
      reliableAnswers: 2,
      pending: 1,
      independentCount: 1,
      retestCount: 1,
      avgMastery: null
    });
    expect(result.data.mastery.map((x) => x.status)).toEqual(['可独立完成', '待复测']);
    expect(result.data.reviewTargets[0]).toMatchObject({ questionKey: 'q_wrong@1', evidenceIds: ['answer_q_wrong'] });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    const plan = await engine.generateStudyPlan(dateAfter(2), 1);
    expect(plan.data.plans[0].tasks[0]).toMatchObject({
      action: 'review',
      questionKey: 'q_wrong@1',
      reason: '已有复习安排到期'
    });
    expect(JSON.stringify(plan)).not.toContain('掌握度');
    expect(JSON.stringify(plan)).not.toContain('可提取性');
    apply('task.stop', { conversationId: 'c1', source: 'self_report' });
    const stopped = await engine.generateStudyPlan(dateAfter(2), 1);
    expect(stopped.data.plans.every((p) => p.tasks.every((t) => !t.evidenceIds && !t.questionKey))).toBe(true);
    expect(storageService.get('knowledge_mastery')).toEqual({ original: 'keep-this-cache' });
    read.mockRestore();
  });

  it('tracks local study sessions and refuses invalid plan dates', async () => {
    const engine = useStudyEngineStore();
    const started = await engine.startSession({ mode: 'review', questionCount: 1 });
    expect(started).toMatchObject({ success: true, source: 'local' });
    expect(engine.hasActiveSession).toBe(true);

    const ended = await engine.endSession({ answeredCount: 1, correctCount: 1 });
    expect(ended).toMatchObject({ success: true, source: 'local', data: { answeredCount: 1, correctCount: 1 } });
    expect(engine.hasActiveSession).toBe(false);
    expect(engine.sessionCount).toBe(1);

    const invalid = await engine.generateStudyPlan('not-a-date');
    expect(invalid).toMatchObject({ success: false, source: 'local' });
  });
});
