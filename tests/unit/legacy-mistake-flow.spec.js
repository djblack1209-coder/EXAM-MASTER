import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MistakeCard from '@/pages/mistake/MistakeCard.vue';
import MistakeReport from '@/pages/mistake/MistakeReport.vue';
import { captureSession } from '@/services/auth-storage.js';
import { storageService } from '@/services/storageService.js';
import { LEGACY_REVIEW_HANDOFF_KEY, readLegacyReviewHandoff } from '@/services/quiz-session-contract.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { recordQuizLearningAttempt } from '@/services/learning/quiz-learning-bridge.js';
import DoQuizPage from '@/pages/practice-sub/do-quiz.vue';
import { normalizeQuizQuestion } from '@/services/quiz-session-contract.js';
import MistakePage from '@/pages/mistake/index.vue';
import { modal } from '@/utils/modal.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';

vi.mock('@/composables/usePageDialog.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { usePageDialog: () => ({ ...actual.usePageDialog(), modal }) };
});

const hooks = vi.hoisted(() => ({ load: [], show: [] }));
vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback) => hooks.load.push(callback),
  onShow: (callback) => hooks.show.push(callback),
  onUnload: vi.fn(),
  onHide: vi.fn(),
  onBackPress: vi.fn()
}));

const canvas = vi.hoisted(() => ({ image: vi.fn(), label: vi.fn(), radar: vi.fn() }));
vi.mock('@/pages/mistake/canvas-report.js', () => ({
  getCanvasTheme: () => ({}),
  drawStyledCard: vi.fn(),
  drawWrappedText: vi.fn(),
  drawRadarChart: canvas.radar,
  drawDivider: vi.fn(),
  canvasToImage: canvas.image,
  drawLabel: canvas.label,
  drawReportBackground: vi.fn()
}));
const record = (id = 'original-multi') => ({
  id,
  question: '请选择原材料中两项。',
  options: ['A. 甲', 'B. 乙', 'C. 丙'],
  answer: 'AC',
  type: 'multi_choice',
  passage: '完整原材料',
  category: '数学',
  user_answer: 'B',
  wrong_count: 8,
  is_mastered: false,
  desc: '历史解析'
});
const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text().trim() === text);
const stubs = { BaseIcon: true, WdPopup: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' } };
it('history sync keeps failure/partial results visible and blocks repeated sends while loading', async () => {
  uni.setStorageSync('EXAM_USER_ID', 'feedback-owner');
  storageService.save('mistake_book', [{ ...record('local_feedback'), sync_status: 'pending' }], true);
  const get = vi.spyOn(storageService, 'getMistakes').mockResolvedValue({ list: [], hasMore: false, source: 'local' });
  const sync = vi
    .spyOn(storageService, 'syncPendingMistakes')
    .mockResolvedValueOnce({ success: false, synced: 0, error: '同步结果未确认，原待办保留' });
  const dialogs = [];
  vi.spyOn(modal, 'show').mockImplementation((dialog) => dialogs.push(dialog));
  const wrapper = mount(MistakePage, {
    global: {
      stubs: {
        ...stubs,
        LearningShell: { template: '<main><slot name="controls"/><slot /></main>' },
        LearningOverview: true,
        OfflineIndicator: true,
        MistakeReport: true,
        StatsCard: true
      }
    }
  });
  try {
    hooks.load.forEach((callback) => callback({}));
    await button(wrapper, '历史题库记录').trigger('tap');
    await flushPromises();
    await button(wrapper, '同步历史待办').trigger('tap');
    dialogs.at(-1).success({ confirm: true });
    await flushPromises();
    expect(wrapper.get('[data-test="legacy-sync-feedback"]').text()).toBe('同步结果未确认，原待办保留');
    let resolve;
    sync.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    await button(wrapper, '同步历史待办').trigger('tap');
    dialogs.at(-1).success({ confirm: true });
    await flushPromises();
    expect(button(wrapper, '同步历史待办').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-test="legacy-sync-feedback"]').text()).toBe('同步中…');
    expect(sync).toHaveBeenCalledTimes(2);
    const reads = get.mock.calls.length;
    resolve({ success: true, synced: 1, failed: 1, conflicts: 0 });
    await flushPromises();
    expect(wrapper.get('[data-test="legacy-sync-feedback"]').text()).toBe('已确认 1 条，还有 1 条未完成。');
    expect(get.mock.calls.length).toBeGreaterThan(reads);
    expect(button(wrapper, '同步历史待办').attributes('disabled')).toBeUndefined();
    sync.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    await button(wrapper, '同步历史待办').trigger('tap');
    dialogs.at(-1).success({ confirm: true });
    await flushPromises();
    const beforeLateReply = get.mock.calls.length;
    storageService.saveLoginSession({
      userId: 'feedback-owner',
      token: 'changed-test-session',
      userInfo: { id: 'feedback-owner' }
    });
    resolve({ success: true, synced: 1, failed: 0, conflicts: 0 });
    await flushPromises();
    expect(get.mock.calls.length).toBe(beforeLateReply);
    expect(wrapper.find('[data-test="legacy-sync-feedback"]').exists()).toBe(false);
    expect(button(wrapper, '同步历史待办').attributes('disabled')).toBeUndefined();
  } finally {
    wrapper.unmount();
  }
});
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.clearAllMocks();
  canvas.image.mockResolvedValue('owned-report.png');
  hooks.load.length = 0;
  hooks.show.length = 0;
});
it('filtered removal binds the displayed identity, and merely opening history sends no pending originals', async () => {
  const first = { ...record('first'), wrong_count: 1 },
    shownFirst = { ...record('shown-first'), wrong_count: 9 };
  storageService.save('mistake_book', [first, shownFirst], true);
  vi.spyOn(storageService, 'getMistakes').mockResolvedValue({
    list: [first, shownFirst],
    hasMore: false,
    source: 'local'
  });
  const remove = vi.spyOn(storageService, 'removeMistake').mockResolvedValue({ success: true, source: 'local' });
  const sync = vi.spyOn(storageService, 'syncPendingMistakes').mockResolvedValue({ synced: 0 });
  const dialogs = [];
  vi.spyOn(modal, 'show').mockImplementation((dialog) => {
    dialogs.push(dialog);
  });
  const wrapper = mount(MistakePage, {
    global: {
      stubs: {
        ...stubs,
        LearningShell: { template: '<main><slot name="controls"/><slot /></main>' },
        LearningOverview: true,
        OfflineIndicator: true,
        MistakeReport: true,
        StatsCard: true
      }
    }
  });
  try {
    hooks.load.forEach((callback) => callback({}));
    hooks.show.forEach((callback) => callback());
    await button(wrapper, '历史题库记录').trigger('tap');
    await flushPromises();
    expect(sync).not.toHaveBeenCalled();
    const card = wrapper.findAllComponents(MistakeCard)[0];
    expect(card.props('item').id).toBe('shown-first');
    await button(card, '移除').trigger('tap');
    dialogs.at(-1).success({ confirm: false });
    await flushPromises();
    expect(remove).not.toHaveBeenCalled();
    await button(card, '移除').trigger('tap');
    await dialogs.at(-1).success({ confirm: true });
    await flushPromises();
    expect(remove).toHaveBeenCalledExactlyOnceWith('shown-first', captureSession());
    expect(wrapper.findAllComponents(MistakeCard).map((component) => component.props('item').id)).toEqual(['first']);
    expect(storageService.get('mistake_book')).toEqual([first, shownFirst]);
    storageService.getMistakes.mockResolvedValue({ list: [], hasMore: false, source: 'local' });
    uni.setStorageSync('EXAM_USER_ID', 'visible-next-owner');
    useConversationLearningStore().refresh();
    await flushPromises();
    expect(wrapper.findAllComponents(MistakeCard)).toHaveLength(0);
  } finally {
    wrapper.unmount();
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});

it('legacy card labels every unprefixed option by its actual index', () => {
  const wrapper = mount(MistakeCard, {
    props: { item: { ...record(), options: ['甲', '乙', '丙', '丁'] }, index: 0, expectedOwnerId: '' },
    global: { stubs }
  });
  try {
    expect(wrapper.findAll('.base-option__key').map((option) => option.text())).toEqual(['A', 'B', 'C', 'D']);
  } finally {
    wrapper.unmount();
  }
});

it('single-item retry preserves the complete original in the guarded handoff and writes no mastery or review', async () => {
  const item = record();
  storageService.save('mistake_book', [item], true);
  storageService.save('v30_bank', [{ protected: 'bank' }], true);
  storageService.save('v30_bank_backup', [{ protected: 'rollback' }], true);
  const before = JSON.parse(JSON.stringify(global.__mockStorage));
  const wrapper = mount(MistakeCard, { props: { item, index: 0, expectedOwnerId: '' }, global: { stubs } });
  try {
    await button(wrapper, '重做此题').trigger('tap');
    const handoff = storageService.get(LEGACY_REVIEW_HANDOFF_KEY);
    const [saved] = readLegacyReviewHandoff(handoff, handoff.id, '');
    expect(saved).toMatchObject({
      id: item.id,
      passage: item.passage,
      options: item.options,
      answer: 'AC',
      scoringAuthority: false
    });
    expect(uni.navigateTo).toHaveBeenCalledOnce();
    expect(wrapper.find('.practice-area').exists()).toBe(false);
    expect(learningRepository.read().attempts).toEqual([]);
    expect(learningRepository.read().reviews).toEqual([]);
    for (const [key, value] of Object.entries(before)) expect(global.__mockStorage[key]).toEqual(value);
  } finally {
    wrapper.unmount();
  }
});
it.each(['missing', 'changed', 'owner', 'duplicate'])(
  'single-item retry rejects %s without replacing source records',
  async (change) => {
    const item = record();
    const shown = change === 'missing' ? { ...item, answer: '' } : item;
    storageService.save('mistake_book', [shown], true);
    const wrapper = mount(MistakeCard, { props: { item: shown, index: 0, expectedOwnerId: '' }, global: { stubs } });
    try {
      if (change === 'changed') storageService.save('mistake_book', [{ ...item, passage: '替换后的材料' }], true);
      if (change === 'duplicate') storageService.save('mistake_book', [item, item], true);
      if (change === 'owner') uni.setStorageSync('EXAM_USER_ID', 'another-owner');
      const before = JSON.stringify(global.__mockStorage);
      await button(wrapper, '重做此题').trigger('tap');
      expect(storageService.get(LEGACY_REVIEW_HANDOFF_KEY, null, { migrateLegacy: false })).toBeNull();
      expect(uni.navigateTo).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    } finally {
      wrapper.unmount();
    }
  }
);
it('record summary counts loaded rows and original categories, without bank-wide capability or diagnosis claims', async () => {
  const rows = [record(), { ...record('second'), wrong_count: 99 }, { id: 'unknown', category: '' }];
  const originalCanvas = uni.createCanvasContext;
  uni.createCanvasContext = undefined;
  const before = JSON.stringify(global.__mockStorage);
  const wrapper = mount(MistakeReport, { props: { mistakes: rows, expectedOwnerId: '' }, global: { stubs } });
  try {
    await wrapper.get('.export-btn').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('历史错题记录汇总');
    expect(wrapper.text()).toContain('当前已载入 3 条');
    expect(wrapper.text()).toContain('数学：2 条');
    expect(wrapper.text()).toContain('未分类：1 条');
    expect(wrapper.text()).not.toMatch(/智能诊断|深度诊断|能力模型|薄弱环节|已经掌握/);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(canvas.radar).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    uni.createCanvasContext = originalCanvas;
  }
});
it('late image export after a record or account change cannot reopen an old report', async () => {
  let resolveImage;
  canvas.image.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveImage = resolve;
      })
  );
  const originalCanvas = uni.createCanvasContext;
  uni.createCanvasContext = vi.fn(() => ({
    setFillStyle: vi.fn(),
    setFontSize: vi.fn(),
    draw: (_reserve, done) => done()
  }));
  const wrapper = mount(MistakeReport, { props: { mistakes: [record()], expectedOwnerId: '' }, global: { stubs } });
  try {
    await wrapper.get('.export-btn').trigger('tap');
    await flushPromises();
    expect(resolveImage).toBeTypeOf('function');
    uni.setStorageSync('EXAM_USER_ID', 'another-owner');
    await wrapper.setProps({ mistakes: [] });
    resolveImage('late-old-owner.png');
    await flushPromises();
    expect(wrapper.find('.report-modal').exists()).toBe(false);
    expect(canvas.radar).not.toHaveBeenCalled();
    expect(canvas.label.mock.calls.some((call) => /能力模型|智能深度诊断/.test(String(call[1])))).toBe(false);
  } finally {
    wrapper.unmount();
    uni.createCanvasContext = originalCanvas;
  }
});
it('saving a canvas image downloads PNG bytes through a temporary URL and releases it', async () => {
  canvas.image.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
  const originalCanvas = uni.createCanvasContext;
  const originalSaveImage = uni.saveImageToPhotosAlbum;
  uni.createCanvasContext = vi.fn(() => ({
    setFillStyle: vi.fn(),
    setFontSize: vi.fn(),
    draw: (_reserve, done) => done()
  }));
  uni.saveImageToPhotosAlbum = vi.fn();
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:owned-download');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    clicked.push({ href: this.href, download: this.download, attached: this.isConnected });
  });
  const wrapper = mount(MistakeReport, { props: { mistakes: [record()], expectedOwnerId: '' }, global: { stubs } });
  try {
    await wrapper.get('.export-btn').trigger('tap');
    await flushPromises();
    await button(wrapper, '保存图片').trigger('tap');
    expect(createUrl).toHaveBeenCalledOnce();
    const blob = createUrl.mock.calls[0][0];
    expect(blob.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(clicked).toEqual([{ href: 'blob:owned-download', download: 'yozi-history-records.png', attached: true }]);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:owned-download');
    expect(document.querySelector('a[download="yozi-history-records.png"]')).toBeNull();
  } finally {
    wrapper.unmount();
    uni.createCanvasContext = originalCanvas;
    uni.saveImageToPhotosAlbum = originalSaveImage;
  }
});
it('a fresh legacy launch cannot select, submit or overwrite progress after its owner changes', async () => {
  storageService.save(
    LEGACY_REVIEW_HANDOFF_KEY,
    { contract: 'legacy-review-handoff-v1', id: 'launch-own', ownerId: '', questions: [record()] },
    true
  );
  const page = {
    ...DoQuizPage.data(),
    mode: 'legacy_review',
    legacyReviewId: 'launch-own',
    startTimer: vi.fn(),
    startQuestionTimer: vi.fn(),
    saveCurrentProgress: vi.fn(),
    recordAnswerToAnalytics: vi.fn(),
    updateStudyStats: vi.fn(),
    clearComboFeedback: vi.fn(),
    buildQuestionBankFingerprint: DoQuizPage.methods.buildQuestionBankFingerprint
  };
  Object.defineProperty(page, 'currentQuestion', { get: () => page.questions[0] });
  Object.defineProperty(page, 'canSubmitChoice', { get: () => DoQuizPage.computed.canSubmitChoice.call(page) });
  await DoQuizPage.methods.loadQuestions.call(page);
  expect(page.questions).toHaveLength(1);
  uni.setStorageSync('EXAM_USER_ID', 'later-owner');
  storageService.save('quiz_progress', { protected: 'later-owner' }, true);
  const before = JSON.stringify(global.__mockStorage),
    choice = page.userChoice;
  DoQuizPage.methods.selectOption.call(page, 0);
  expect(page.userChoice).toEqual(choice);
  page.userChoice = [0, 2];
  expect(page.canSubmitChoice).toBe(false);
  await DoQuizPage.methods.submitChoice.call(page);
  page.hasAnswered = true;
  DoQuizPage.methods.saveCurrentProgress.call(page, true);
  expect(page.recordAnswerToAnalytics).not.toHaveBeenCalled();
  expect(JSON.stringify(global.__mockStorage)).toBe(before);
});
it('viewed historical reference is retained as help on the explicit pending answer and replay is exact', async () => {
  const q = { ...record(), legacyReviewContext: { contract: 'legacy-review-view-v1', referenceViewed: true } };
  const input = { currentQuestion: q, userAnswer: 'AC', sessionId: 'original_legacy', attemptId: 'quiz_answer_legacy' };
  await recordQuizLearningAttempt(input);
  const state = learningRepository.read();
  expect(state.attempts[0]).toMatchObject({ answer: 'AC', grade: { status: 'pending' } });
  expect(state.attempts[0].hints).toHaveLength(1);
  expect(state.attempts[0].hints[0].content).toContain('历史参考');
  expect(state.reviews).toEqual([]);
  const before = JSON.stringify(state);
  expect((await recordQuizLearningAttempt(input)).reused).toBe(true);
  expect(JSON.stringify(learningRepository.read())).toBe(before);
});
it('numeric zero keeps its original question identity through normalization and explicit answer storage', async () => {
  const q = { ...record(0), type: 'single_choice', answer: 0 };
  const normalized = normalizeQuizQuestion(q);
  expect(normalized.id).toBe(0);
  expect(
    (
      await recordQuizLearningAttempt({
        currentQuestion: normalized,
        userAnswer: 'A',
        sessionId: 'zero_original',
        attemptId: 'quiz_answer_zero'
      })
    ).success
  ).toBe(true);
  expect(learningRepository.read().questions[0].id).toBe('bank_legacy_0');
});
