import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import {
  learningInsights,
  insightCalendar,
  insightMonth,
  insightRadar
} from '@/services/learning/learning-insights.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { initI18n, setLanguage, publicError } from '@/i18n/index.js';
import LearningInsights from '@/components/business/learning/learning-insights.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: () => {}, onHide: () => {} }));
const wrappers = [];
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-18T12:30:00Z'));
  initI18n();
});
afterEach(() => {
  wrappers
    .splice(0)
    .reverse()
    .forEach((wrapper) => wrapper.unmount());
  for (const store of getActivePinia()?._s.values() || []) store.$dispose();
  learningWriteLease.release();
  setLanguage('zh-CN');
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function archive() {
  const state = emptyLearningState('archive', 'America/Los_Angeles');
  state.conversations.push({ id: 'c', goal: '数学', messages: [] }, { id: 'other', goal: '另一目标', messages: [] });
  state.questions.push({ id: 'q', version: 1, subject: '数学', knowledgePoint: '占比', prompt: '合成占比题' });
  state.attempts.push({
    id: 'a',
    questionKey: 'q@1',
    conversationId: 'c',
    answer: '保留原答',
    kind: 'first',
    hints: [],
    at: Date.parse('2026-10-18T06:30Z'),
    grade: { status: 'reliable', outcome: 'wrong' }
  });
  state.reviews.push({ id: 'r', questionKey: 'q@1', attemptId: 'a', due: Date.parse('2026-11-01T09:30Z') });
  return state;
}
async function storeWithAnswer() {
  const store = useConversationLearningStore();
  store.commit('timezone.set', { timezone: 'America/Los_Angeles' });
  store.start('1/2 + 1/3');
  await store.submit(store.activeQuestion.validation.answer, true, 'archive-original');
  return store;
}
function mountArchive(props = {}) {
  const wrapper = mount(LearningInsights, { props, global: { stubs: { BaseIcon: true } } });
  wrappers.push(wrapper);
  return wrapper;
}
function button(wrapper, label) {
  return wrapper.findAll('button').find((item) => item.text() === label);
}

describe('saved-date calendar and evidence', () => {
  it('keeps original dates, reliable outcomes and exact record identities without changing history', () => {
    const state = archive(),
      before = JSON.stringify(state);
    const result = learningInsights(state, Date.now(), 'c');
    expect(result.days.find((day) => day.day === '2026-10-17')).toMatchObject({ answers: 1, evidenceIds: ['a'] });
    expect(result.evidence[0]).toMatchObject({
      day: '2026-10-17',
      recordId: '["c","q@1","a"]',
      canOpen: true,
      grade: { outcome: 'wrong' }
    });
    expect(result.days.find((day) => day.day === '2026-11-01')).toMatchObject({ due: 1, reviewIds: ['r'] });
    expect(result.scheduled[0].due).toBe(state.reviews[0].due);
    expect(learningInsights(state, Date.now(), 'other').scheduled).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each([
    'cancelled',
    'completedBy',
    'resolvedBy',
    'missing-original',
    'missing-question',
    'missing-conversation',
    'pending'
  ])('excludes %s reviews without rewriting historical answers', (reason) => {
    const state = archive();
    if (reason === 'missing-original') state.reviews[0].attemptId = 'missing';
    else if (reason === 'missing-question') state.questions = [];
    else if (reason === 'missing-conversation') state.conversations = [];
    else if (reason === 'pending') state.attempts[0].grade = { status: 'pending' };
    else state.reviews[0][reason] = true;
    const original = JSON.stringify(state.attempts),
      result = learningInsights(state);
    expect(result.scheduled).toEqual([]);
    expect(result.days.every((day) => day.due === 0)).toBe(true);
    expect(JSON.stringify(state.attempts)).toBe(original);
  });
  it('does not schedule a review with a mismatched original question', () => {
    const state = archive();
    state.attempts[0].questionKey = 'different@1';
    expect(learningInsights(state).scheduled).toEqual([]);
  });
  it('uses Monday-first month grids, includes leap day, and crosses years and DST without changing saved dates', () => {
    const cells = insightCalendar('2026-10-18');
    expect(cells[0]).toMatchObject({ day: '2026-09-28', inMonth: false });
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(cells.find((cell) => cell.today).day).toBe('2026-10-18');
    expect(insightCalendar('2028-02-02').filter((cell) => cell.inMonth)).toHaveLength(29);
    expect(insightCalendar('2026-03-08', '2026-03', true).map((cell) => cell.day)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08'
    ]);
    expect(insightMonth('2026-12-20', 1)).toBe('2027-01');
    expect(insightMonth('2026-01-20', -1)).toBe('2025-12');
    expect(insightMonth('0001-01-01', -1)).toBe('0001-01');
    expect(insightMonth('9999-12-01', 1)).toBe('9999-12');
  });
  it('requires three reliable denominators for a radar and never interpolates user labels into SVG', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      label: '<script>user</script>',
      scope: String(i),
      reliable: i ? 2 : 0,
      independent: i % 2
    }));
    expect(insightRadar(rows.slice(0, 3))).toBeNull();
    const radar = insightRadar(rows, { brand: '" onload="bad' });
    expect(radar.rows).toHaveLength(6);
    const svg = decodeURIComponent(radar.src.split(',')[1]);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('onload');
    expect(svg).not.toContain('NaN');
  });
});

describe('archive navigation uses current owner and explicit actions', () => {
  it('browses months and date evidence without writes, then opens the exact original', async () => {
    const store = await storeWithAnswer(),
      before = store.exportData();
    const wrapper = mountArchive({ all: true });
    await wrapper.find('button[data-day="2026-10-18"]').trigger('tap');
    expect(wrapper.find('[data-test="insight-evidence"]').text()).toContain(store.activeQuestion.prompt);
    expect(wrapper.text()).toContain('可靠判分：正确');
    await wrapper.find('button[aria-label="上个月"]').trigger('tap');
    expect(wrapper.text()).toContain('2026年9月');
    expect(wrapper.find('[data-test="insight-evidence"]').exists()).toBe(false);
    await button(wrapper, '回到本月').trigger('tap');
    expect(store.exportData()).toBe(before);
    await button(wrapper, '查看原答与对话').trigger('tap');
    await flushPromises();
    expect(store.locatedRecord.attemptId).toBe('archive-original');
    expect(store.locatedRecord.answer).toBe(store.state.attempts[0].answer);
    expect(store.state.attempts).toHaveLength(1);
  });
  it('starts a new focused conversation only after its action, preserving the old stopped task and answers', async () => {
    const store = await storeWithAnswer();
    const oldId = store.active.id;
    store.commit('task.stop', { conversationId: oldId });
    const original = JSON.stringify(store.state.attempts),
      before = store.exportData();
    const originalKey = store.active.activeQuestionKey;
    const startFocused = vi.spyOn(store, 'startFocusedStudy');
    const wrapper = mountArchive({ all: true });
    await wrapper.find('button[aria-label^="查看「"]').trigger('tap');
    expect(store.exportData()).toBe(before);
    await button(wrapper, '开始专项对话').trigger('tap');
    await flushPromises();
    if (startFocused.mock.results[0]?.type === 'throw') throw startFocused.mock.results[0].value;
    expect(store.state.conversations).toHaveLength(2);
    expect(store.active.id).not.toBe(oldId);
    expect(store.active.goal).toContain('分数');
    expect(store.active.activeQuestionKey).toBe(originalKey);
    expect(store.active.nextAttemptKind).toBe('redo');
    expect(store.state.conversations.find((c) => c.id === oldId).stopped).toBe(true);
    expect(JSON.stringify(store.state.attempts)).toBe(original);
    expect(store.busy).toBe(false);
    await store.submit('5/6', true, 'focused-redo');
    expect(store.state.attempts.at(-1).kind).toBe('redo');
    expect(learningInsights(store.state).units[0]).toMatchObject({ reliable: 2, independent: 1 });
  });
  it('keeps specialized task ownership and stopped state instead of cloning it into another conversation', async () => {
    const store = useConversationLearningStore();
    store.start('中文叙事写作');
    await store.submit('合成写作原答。', true, 'special-original');
    const originalId = store.active.id,
      key = store.active.activeQuestionKey;
    store.commit('task.stop', { conversationId: originalId });
    const before = JSON.stringify(store.state.attempts);
    store.startFocusedStudy(learningInsights(store.state).units[0].scope, store.recordContext());
    expect(store.state.conversations).toHaveLength(1);
    expect(store.active).toMatchObject({ id: originalId, activeQuestionKey: key, stopped: true });
    expect(JSON.stringify(store.state.attempts)).toBe(before);
  });
  it('never leaves a partial new goal when the atomic focused-study save fails', async () => {
    const store = await storeWithAnswer(),
      before = store.exportData();
    const save = vi.spyOn(learningRepository, 'commitBatch').mockImplementation(() => {
      throw Object.assign(new Error('storage failed'), { code: 'STORAGE_FAILED' });
    });
    expect(() =>
      store.startFocusedStudy(learningInsights(store.state).units[0].scope, store.recordContext())
    ).toThrow();
    save.mockRestore();
    expect(store.exportData()).toBe(before);
    expect(() =>
      learningRepository.commitBatch(
        [
          { id: 'partial-focused', type: 'conversation.start', at: Date.now(), data: { goal: '整数运算' } },
          {
            id: 'partial-focus',
            type: 'question.focus',
            at: Date.now(),
            data: { conversationId: 'partial-focused', questionKey: 'missing@1' }
          }
        ],
        store.state.revision
      )
    ).toThrow();
    expect(store.exportData()).toBe(before);
  });
  it('shows today’s tasks from this conversation only, without borrowing another goal’s plan', async () => {
    const store = await storeWithAnswer();
    store.start('7+5');
    const wrapper = mountArchive({ compact: true });
    expect(wrapper.text()).toContain('计算 7 + 5。');
    expect(wrapper.text()).not.toContain('计算 1/2 + 1/3。');
  });
  it('rejects stale archive actions on account switch and clears the old evidence', async () => {
    const store = await storeWithAnswer(),
      context = store.recordContext();
    const unit = learningInsights(store.state).units[0].scope;
    const wrapper = mountArchive({ all: true });
    await wrapper.find('button[data-day="2026-10-18"]').trigger('tap');
    uni.setStorageSync('EXAM_USER_ID', 'other-archive-owner');
    store.refresh();
    await flushPromises();
    expect(wrapper.find('[data-test="insight-evidence"]').exists()).toBe(false);
    expect(() => store.startFocusedStudy(unit, context)).toThrow();
    expect(() => store.openInsightReview('old-review', context)).toThrow();
    expect(store.state.attempts).toEqual([]);
    expect(store.state.conversations).toEqual([]);
  });
  it('rechecks due time, current evidence and stopped state before entering a review', async () => {
    const store = await storeWithAnswer(),
      original = store.state.attempts[0];
    const review = store.state.reviews.find((item) => item.attemptId === original.id);
    const due = review.due;
    store.commit('task.stop', { conversationId: store.active.id });
    const context = store.recordContext(),
      before = store.exportData();
    expect(() => store.openInsightReview(review.id, context)).toThrow('尚未到复习时间');
    expect(store.exportData()).toBe(before);
    vi.setSystemTime(due);
    store.openInsightReview(review.id, context);
    expect(store.active.activeQuestionKey).toBe(original.questionKey);
    expect(store.active.stopped).toBe(true);
    expect(store.state.attempts).toHaveLength(1);
    store.correctAssessment(original.id, '合成争议，需要重新核对');
    expect(() => store.openInsightReview(review.id, store.recordContext())).toThrow();
  });
  it('keeps weekly facts, month controls and evidence labels translated; unavailable storage hides old details', async () => {
    await storeWithAnswer();
    const wrapper = mountArchive({ compact: true });
    expect(wrapper.findAll('button[data-day]')).toHaveLength(7);
    expect(wrapper.text()).toContain('今日安排');
    expect(wrapper.text()).not.toContain('上个月');
    setLanguage('en');
    await flushPromises();
    expect(wrapper.text()).toContain('This week');
    expect(wrapper.text()).toContain('Today’s plan');
    const store = useConversationLearningStore();
    store.recordReadState = 'error';
    await flushPromises();
    expect(wrapper.find('[data-test="insight-calendar"]').exists()).toBe(false);
    expect(button(wrapper, 'Retry').attributes('disabled')).toBeUndefined();
  });
  it('rejects busy and deleted evidence instead of creating a new learning target', async () => {
    const store = await storeWithAnswer(),
      context = store.recordContext(),
      scope = learningInsights(store.state).units[0].scope;
    const before = store.exportData();
    store.busy = true;
    expect(() => store.startFocusedStudy(scope, context)).toThrow();
    store.busy = false;
    expect(() => store.startFocusedStudy('deleted scope', context)).toThrow();
    expect(store.exportData()).toBe(before);
  });
  it('explains a network safety rejection without exposing provider text or claiming an internet outage', () => {
    const error = { code: 'SSRF_BLOCKED', message: 'private provider https://example.test/internal' };
    expect(publicError(error)).toContain('网络安全检查');
    expect(publicError(error)).not.toContain('example.test');
    setLanguage('en');
    expect(publicError(error)).toContain('network safety check');
  });
});
