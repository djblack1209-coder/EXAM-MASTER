import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  emptyLearningState,
  knowledgeScope,
  normalizePrivateSyncOperation,
  questionKey
} from '@/services/learning/learning-domain.js';
import {
  createVocabularyQuestion,
  gradeVocabularyAnswer,
  normalizeVocabularyQuestion,
  vocabularyEvidence,
  adaptiveWritingWords,
  writingVocabularySense,
  createVocabularyReviewQuestion,
  gradeVocabularyReviewAnswer,
  vocabularyRetestReady
} from '../../laf-backend/functions/_shared/learning-vocabulary.js';
import LearningLab from '@/pages/learning/components/learning-lab.vue';
import { learningEvidenceMap } from '../../laf-backend/functions/_shared/learning-visual.js';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const clone = (value) => JSON.parse(JSON.stringify(value));
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
const button = (wrapper, label) => wrapper.findAll('button').find((item) => item.text() === label);
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});

describe('词义的日历复测与自由原答', () => {
  const at = Date.parse('2026-10-06T09:00:00Z');
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at);
  });
  function source() {
    const store = setup(),
      { q } = check(store, 'recycle');
    store.commit('timezone.set', { timezone: 'America/Los_Angeles' });
    return { store, q, key: questionKey(q), context: store.writingContext() };
  }
  it('3/7天计划各用新语境并保持明日v1与原答；重复安排复用而不换焦点', () => {
    const { store, q, key, context } = source();
    const tomorrow = store.startVocabularyTask(context, key, 'retest');
    const legacy = JSON.stringify(store.state.questions.at(-1));
    const attempts = clone(store.state.attempts);
    const three = store.startVocabularyTask(context, key, 'retest', 3);
    const week = store.startVocabularyTask(context, key, 'retest', 7);
    expect(three.day).toBe('2026-10-09');
    expect(week.day).toBe('2026-10-13');
    expect(three.questionKey).not.toBe(tomorrow.questionKey);
    expect(week.questionKey).not.toBe(three.questionKey);
    for (const [target, delayDays] of [
      [three, 3],
      [week, 7]
    ]) {
      const review = store.state.questions.find((item) => questionKey(item) === target.questionKey);
      expect(review.vocabularyReview).toMatchObject({
        contract: 'vocabulary-review-v2',
        delayDays,
        plannedDay: '2026-10-06',
        plannedTimezone: 'America/Los_Angeles',
        originAttemptId: attempts[0].id,
        dueDay: target.day
      });
      expect(review.prompt).not.toBe(q.prompt);
      expect(store.vocabularyTaskFor(key, 'retest', delayDays)).toEqual(target);
      expect(store.startVocabularyTask(context, key, 'retest', delayDays)).toEqual(target);
      expect(store.state.plans.filter((p) => p.day === target.day).at(-1).tasks).toMatchObject([
        { condition: 'independent_correct', completedBy: null, questionKey: target.questionKey }
      ]);
    }
    expect(JSON.stringify(store.state.questions.find((item) => questionKey(item) === tomorrow.questionKey))).toBe(
      legacy
    );
    expect(store.state.attempts).toEqual(attempts);
    expect(store.active.activeQuestionKey).toBe(q.parentQuestionKey);
  });
  it('未支持间隔和自由写句附带间隔均零写拒绝', () => {
    const { store, key, context } = source();
    const before = JSON.stringify(store.state);
    for (const delay of [0, 2, 8, 365, -1, 3.5, '3', NaN, Infinity]) {
      expect(() => store.startVocabularyTask(context, key, 'retest', delay)).toThrow();
      expect(JSON.stringify(store.state)).toBe(before);
    }
    for (const delay of [3, 7]) {
      expect(() => store.startVocabularyTask(context, key, 'usage', delay)).toThrow();
      expect(JSON.stringify(store.state)).toBe(before);
    }
  });
  it('同日到期的1/3/7天任务各自保留，完成一题不能替其他间隔完成', () => {
    const { store, key, context } = source();
    const week = store.startVocabularyTask(context, key, 'retest', 7);
    const originalWeek = JSON.stringify(store.state.questions.at(-1));
    vi.setSystemTime(at + 4 * 86400000);
    const three = store.startVocabularyTask(store.writingContext(), key, 'retest', 3);
    vi.setSystemTime(at + 6 * 86400000);
    const tomorrow = store.startVocabularyTask(store.writingContext(), key, 'retest');
    expect([week.day, three.day, tomorrow.day]).toEqual(['2026-10-13', '2026-10-13', '2026-10-13']);
    expect(new Set([week.questionKey, three.questionKey, tomorrow.questionKey]).size).toBe(3);
    expect(JSON.stringify(store.state.questions.find((q) => questionKey(q) === week.questionKey))).toBe(originalWeek);
    const tasks = store.state.plans.filter((p) => p.day === week.day).at(-1).tasks;
    expect(tasks).toHaveLength(3);
    expect(tasks.every((task) => task.completedBy === null)).toBe(true);
    vi.setSystemTime(at + 7 * 86400000);
    store.focus(week.questionKey);
    store.submit(store.activeQuestion.validation.answer, true, 'same-day-week');
    const currentTasks = store.state.plans.filter((p) => p.day === week.day).at(-1).tasks;
    expect(currentTasks.filter((task) => task.completedBy)).toMatchObject([
      { questionKey: week.questionKey, completedBy: 'same-day-week' }
    ]);
    expect(vocabularyEvidence(store.state, 'recycle-material').independentCorrect).toBe(1);
  });
  it('跨周经过夏令时结束仍按原时区日历到期，换时区不能提前提交', () => {
    vi.setSystemTime(Date.parse('2026-10-31T07:30:00Z'));
    const { store, key, context } = source();
    const target = store.startVocabularyTask(context, key, 'retest', 7);
    const review = store.state.questions.at(-1);
    expect(review.vocabularyReview).toMatchObject({ plannedDay: '2026-10-31', dueDay: '2026-11-07', delayDays: 7 });
    store.commit('timezone.set', { timezone: 'Asia/Shanghai' });
    store.focus(target.questionKey);
    vi.setSystemTime(Date.parse('2026-11-07T07:59:59Z'));
    expect(store.vocabularyCanSubmit()).toBe(false);
    const before = JSON.stringify(store.state);
    expect(() => store.submit(review.validation.answer, true)).toThrow('日期');
    expect(JSON.stringify(store.state)).toBe(before);
    vi.setSystemTime(Date.parse('2026-11-07T08:00:00Z'));
    expect(store.vocabularyCanSubmit()).toBe(true);
    expect(store.submit(review.validation.answer, true, 'week-due')).toMatchObject({
      kind: 'review',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct', basis: 'vocabulary-review-v2' }
    });
    expect(store.state.plans.filter((p) => p.day === target.day).at(-1).tasks[0].completedBy).toBe('week-due');
    expect(vocabularyEvidence(store.state, 'recycle-material').independentCorrect).toBe(1);
    expect(store.state.reviews).toEqual([]);
    expect(store.summary.first.denominator).toBe(0);
  });
  for (const [stamp, delayDays, plannedDay, dueDay] of [
    ['2028-02-29T07:30:00Z', 3, '2028-02-28', '2028-03-02'],
    ['2028-02-29T07:30:00Z', 7, '2028-02-28', '2028-03-06'],
    ['2026-12-30T07:30:00Z', 7, '2026-12-29', '2027-01-05']
  ])
    it(`跨月/年${plannedDay}+${delayDays}天保持原日历日期`, () => {
      vi.setSystemTime(Date.parse(stamp));
      const { store, key, context } = source();
      const target = store.startVocabularyTask(context, key, 'retest', delayDays);
      expect(target.day).toBe(dueDay);
      expect(store.state.questions.at(-1).vocabularyReview).toMatchObject({ plannedDay, dueDay, delayDays });
      expect(store.state.attempts).toHaveLength(1);
    });
  it('3天题有帮助的正确仍不完成独立任务，未来/停止/重复确认零补答', async () => {
    const { store, key, context } = source();
    const target = store.startVocabularyTask(context, key, 'retest', 3);
    store.focus(target.questionKey);
    const review = store.activeQuestion;
    expect(store.vocabularyCanSubmit()).toBe(false);
    const before = JSON.stringify(store.state);
    expect(() => store.submit(review.validation.answer, true)).toThrow('日期');
    expect(JSON.stringify(store.state)).toBe(before);
    vi.setSystemTime(at + 3 * 86400000);
    store.commit('hint.add', { conversationId: store.selectedConversationId, level: 1, content: '这是加工再利用。' });
    const result = store.submit(review.validation.answer, true, 'spaced-with-help');
    expect(result).toMatchObject({ kind: 'review', grade: { status: 'reliable', outcome: 'correct' } });
    expect(result.hints).toHaveLength(1);
    expect(store.state.plans.filter((p) => p.day === target.day).at(-1).tasks[0].completedBy).toBeNull();
    expect(() => store.submit(review.validation.answer, true)).toThrow('已有');
    expect(vocabularyEvidence(store.state, 'recycle-material').independentCorrect).toBe(1);
    await store.send('停止当前任务', { discussionOnly: true });
    const stopped = JSON.stringify(store.state);
    expect(() => store.startVocabularyTask(context, key, 'retest', 7)).toThrow();
    expect(() => store.submit('A', true)).toThrow('停止');
    expect(JSON.stringify(store.state)).toBe(stopped);
  });
  it('跨周计划失败重试只补缺失计划，其他间隔和原答不变；满计划零留题', () => {
    const { store, key, context } = source();
    const tomorrow = store.startVocabularyTask(context, key, 'retest');
    const week = store.startVocabularyTask(context, key, 'retest', 7);
    const commit = learningRepository.commit.bind(learningRepository);
    let fail = true;
    vi.spyOn(learningRepository, 'commit').mockImplementation((op) => {
      if (fail && op.type === 'plan.set' && op.data.day === '2026-10-09') {
        fail = false;
        throw new Error('合成跨周保存失败');
      }
      return commit(op);
    });
    expect(() => store.startVocabularyTask(context, key, 'retest', 3)).toThrow('保存失败');
    const question = clone(store.state.questions.at(-1));
    const count = store.state.questions.length;
    const plans = clone(store.state.plans);
    const target = store.startVocabularyTask(context, key, 'retest', 3);
    expect(target.questionKey).toBe(questionKey(question));
    expect(store.state.questions).toHaveLength(count);
    expect(store.state.plans.slice(0, plans.length)).toEqual(plans);
    expect(store.vocabularyTaskFor(key)).toEqual(tomorrow);
    expect(store.vocabularyTaskFor(key, 'retest', 7)).toEqual(week);
    store.commit('plan.set', {
      day: '2026-10-09',
      tasks: Array.from({ length: 100 }, (_, i) => ({ id: `full-spaced-${i}`, title: '保留任务', condition: 'manual' }))
    });
    const nextOrigin = store.openVocabulary(context, 'paper');
    store.submitVocabulary(context, questionKey(nextOrigin), nextOrigin.validation.answer);
    const before = JSON.stringify(store.state);
    expect(() => store.startVocabularyTask(context, questionKey(nextOrigin), 'retest', 3)).toThrow('已满');
    expect(JSON.stringify(store.state)).toBe(before);
  });
  for (const [name, mutate] of [
    ['间隔', (q) => (q.vocabularyReview.delayDays = 7)],
    ['缺间隔', (q) => delete q.vocabularyReview.delayDays],
    ['字符串间隔', (q) => (q.vocabularyReview.delayDays = '3')],
    ['降级v1', (q) => (q.vocabularyReview.contract = 'vocabulary-review-v1')],
    ['日期', (q) => (q.vocabularyReview.dueDay = '2026-10-07')],
    ['上下文', (q) => (q.vocabularyReview.contextId = 1)],
    ['正文', (q) => (q.prompt += '\nThe answer is A.')],
    ['选项', (q) => (q.options[0] = 'A. forged')],
    ['来源', (q) => (q.source.reference = 'vocabulary-review-v1')],
    ['剥除证明', (q) => delete q.vocabularyReview],
    ['主观伪装', (q) => (q.rubric = { criteria: [] })],
    ['执行授权', (q) => (q.vocabularyReview.run = true)]
  ])
    it(`跨周任务${name}篡改零写拒绝`, () => {
      const { store, q } = source();
      const review = createVocabularyReviewQuestion(
        'spaced-attack',
        q,
        store.state.attempts[0].id,
        'retest',
        {
          day: '2026-10-06',
          timezone: 'America/Los_Angeles'
        },
        0,
        3
      );
      mutate(review);
      const before = JSON.stringify(store.state);
      expect(() => store.commit('question.add', { question: review })).toThrow();
      expect(JSON.stringify(store.state)).toBe(before);
    });
  it('旧v1和新v2同卷完整公共/私人重放，已提交跨周计划和原时区不丢', () => {
    const { store, key, context } = source();
    store.startVocabularyTask(context, key, 'retest');
    store.startVocabularyTask(context, key, 'retest', 3);
    const week = store.startVocabularyTask(context, key, 'retest', 7);
    vi.setSystemTime(at + 7 * 86400000);
    store.focus(week.questionKey);
    store.submit(store.activeQuestion.validation.answer, true, 'spaced-replay');
    const facts = clone(store.state);
    delete facts.events;
    let privateState = emptyLearningState(store.state.owner, store.state.timezone);
    let localState = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events) {
      localState = applyLearningOperation(localState, event).state;
      privateState = applyLearningOperation(privateState, normalizePrivateSyncOperation(event)).state;
    }
    expect(localState).toEqual(store.state);
    delete privateState.events;
    expect(privateState).toEqual(facts);
    expect(applyLearningOperation(store.state, store.state.events.at(-1)).reused).toBe(true);
    expect(store.state.questions.filter((q) => q.vocabularyReview?.contract === 'vocabulary-review-v1')).toHaveLength(
      1
    );
  });
  it('新原句挂到明日原时区计划，只选择不新增原答或完成；安排不换焦点', () => {
    const { store, q, key, context } = source(),
      before = clone(store.state);
    const target = store.startVocabularyTask(context, key, 'retest');
    expect(store.state.attempts).toEqual(before.attempts);
    expect(store.active.activeQuestionKey).toBe(q.parentQuestionKey);
    const review = store.state.questions.at(-1);
    expect(review.prompt).not.toBe(q.prompt);
    expect(review.vocabularyReview).toMatchObject({
      plannedTimezone: store.state.timezone,
      plannedDay: '2026-10-06',
      dueDay: '2026-10-07',
      originAttemptId: before.attempts[0].id
    });
    expect(store.startVocabularyTask(context, key, 'retest')).toEqual(target);
    expect(store.state.questions).toHaveLength(before.questions.length + 1);
    expect(store.state.plans.filter((p) => p.day === '2026-10-07').at(-1).tasks).toMatchObject([
      { condition: 'independent_correct', completedBy: null }
    ]);
    store.focus(target.questionKey);
    expect(store.vocabularyCanSubmit()).toBe(false);
    const original = JSON.stringify(store.state);
    expect(() => store.submit(review.validation.answer, true)).toThrow('日期');
    expect(JSON.stringify(store.state)).toBe(original);
    vi.setSystemTime(at + 86400000);
    expect(vocabularyRetestReady(review)).toBe(true);
    expect(store.submit(review.validation.answer, false)).toMatchObject({ clarification: true });
    expect(store.state.attempts).toHaveLength(1);
    const result = store.submit(review.validation.answer, true, 'due-review');
    expect(result).toMatchObject({ kind: 'review', hints: [], grade: { status: 'reliable', outcome: 'correct' } });
    expect(store.state.plans.filter((p) => p.day === '2026-10-07').at(-1).tasks[0].completedBy).toBe('due-review');
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.reviews).toEqual([]);
    expect(() => store.submit(review.validation.answer, true)).toThrow('已有');
    expect(() => store.commit('review.schedule', { attemptId: 'due-review', due: Date.now() + 86400000 })).toThrow(
      '日历计划'
    );
  });
  it('提示后正确不能完成独立任务，错误/普通发送/重复确认不补成独立证据', () => {
    const { store, key, context } = source();
    const target = store.startVocabularyTask(context, key, 'retest');
    store.focus(target.questionKey);
    vi.setSystemTime(at + 86400000);
    store.commit('hint.add', { conversationId: store.selectedConversationId, level: 1, content: '这是回收加工的意思' });
    const result = store.submit(store.activeQuestion.validation.answer, true);
    expect(result.hints).toHaveLength(1);
    expect(store.state.plans.filter((p) => p.day === target.day).at(-1).tasks[0].completedBy).toBeNull();
    expect(vocabularyEvidence(store.state, 'recycle-material').independentCorrect).toBe(1);
    expect(() => store.submit(store.activeQuestion.validation.answer, true)).toThrow('已有');
  });
  it('自己写句不复制草稿，保存换行/空格；包含词、明显错用或没有词都保持待核对', () => {
    const { store, key, context } = source();
    const target = store.startVocabularyTask(context, key, 'usage');
    expect(store.activeQuestion.answerType).toBe('subjective');
    expect(store.activeQuestion.options).toEqual([]);
    expect(store.state.attempts).toHaveLength(1);
    expect(store.submit('I recycle  glass.\nWe can try.', false)).toMatchObject({ clarification: true });
    for (const [index, answer] of [
      'I recycle  glass.\nWe can try.',
      'I recycle my homework to the teacher.',
      'An unrelated sentence.'
    ].entries()) {
      const result = store.submit(answer, true, `usage-${index}`);
      expect(result.answer).toBe(answer);
      expect(result.kind).toBe('variant');
      expect(result.grade).toMatchObject({
        status: 'pending',
        outcome: null,
        basis: 'vocabulary_usage_needs_semantic_review'
      });
    }
    expect(store.state.reviews).toEqual([]);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.currentPlan.tasks.find((t) => t.questionKey === target.questionKey).completedBy).toBe('usage-0');
  });
  it('计划写入失败后复用同一新题，原计划/原答保持；已满计划不留新题', () => {
    const { store, key, context } = source(),
      commit = learningRepository.commit.bind(learningRepository);
    let fail = true;
    vi.spyOn(learningRepository, 'commit').mockImplementation((op) => {
      if (fail && op.type === 'plan.set' && op.data.day) {
        fail = false;
        throw new Error('合成保存失败');
      }
      return commit(op);
    });
    expect(() => store.startVocabularyTask(context, key, 'retest')).toThrow('保存失败');
    const count = store.state.questions.length,
      plans = clone(store.state.plans);
    store.startVocabularyTask(context, key, 'retest');
    expect(store.state.questions).toHaveLength(count);
    expect(store.state.plans.slice(0, plans.length)).toEqual(plans);
    store.commit('plan.set', {
      day: '2026-10-06',
      tasks: Array.from({ length: 100 }, (_, i) => ({ id: `full-${i}`, title: '保留任务', condition: 'manual' }))
    });
    const before = JSON.stringify(store.state);
    expect(() => store.startVocabularyTask(context, key, 'usage')).toThrow('已满');
    expect(JSON.stringify(store.state)).toBe(before);
  });
  it('跨月/闰日按原时区日历，账户后来换时区不提前开放', () => {
    vi.setSystemTime(Date.parse('2028-02-29T07:30:00Z'));
    const { store, key, context } = source();
    store.commit('timezone.set', { timezone: 'America/Los_Angeles' });
    const target = store.startVocabularyTask(context, key, 'retest');
    const review = store.state.questions.at(-1);
    expect(review.vocabularyReview).toMatchObject({ plannedDay: '2028-02-28', dueDay: '2028-02-29' });
    store.commit('timezone.set', { timezone: 'Asia/Shanghai' });
    store.focus(target.questionKey);
    expect(store.vocabularyCanSubmit()).toBe(false);
    vi.setSystemTime(Date.parse('2028-02-29T08:01:00Z'));
    expect(store.vocabularyCanSubmit()).toBe(true);
  });
  it('停止/跨对话/删除后不安排或提交，阅读复测不恢复任务', async () => {
    const { store, key, context } = source(),
      target = store.startVocabularyTask(context, key, 'retest'),
      originalId = store.selectedConversationId;
    await store.send('停止当前任务', { discussionOnly: true });
    store.focus(target.questionKey);
    expect(store.active.stopped).toBe(true);
    expect(() => store.submit('A', true)).toThrow('停止');
    expect(() => store.startVocabularyTask(context, key, 'usage')).toThrow();
    store.start('另一个对话');
    expect(() => store.focus(target.questionKey, store.selectedConversationId)).toThrow('另一对话');
    expect(() =>
      store.commit('question.focus', { conversationId: store.selectedConversationId, questionKey: target.questionKey })
    ).toThrow('另一对话');
    store.focus(target.questionKey, originalId);
    const old = store.writingContext();
    learningRepository.deleteData();
    expect(() => store.startVocabularyTask(old, key, 'usage')).toThrow('切换');
  });
  for (const [name, mutate] of [
    ['义项', (q) => (q.vocabularyReview.senseId = 'save-file')],
    ['原答', (q) => (q.vocabularyReview.originAttemptId = 'fake')],
    ['来源', (q) => (q.source.kind = 'official')],
    ['语境', (q) => (q.prompt += '选A')],
    ['选项', (q) => (q.options[0] = 'A. forged')],
    ['版本', (q) => (q.vocabularyReview.senseVersion = 2)],
    ['日期', (q) => (q.vocabularyReview.dueDay = '2026-10-06')],
    ['时区', (q) => (q.vocabularyReview.plannedTimezone = 'Asia/Shanghai')],
    ['对话', (q) => (q.vocabularyReview.conversationId = 'other')],
    ['授权', (q) => (q.vocabularyReview.run = true)],
    ['主观伪装', (q) => (q.rubric = { criteria: [] })]
  ])
    it(`拒绝词语任务${name}篡改，整批状态保持`, () => {
      const { store, q } = source();
      const review = createVocabularyReviewQuestion('attack', q, store.state.attempts[0].id, 'retest', {
        day: '2026-10-06',
        timezone: 'America/Los_Angeles'
      });
      mutate(review);
      const before = JSON.stringify(store.state);
      expect(() => store.commit('question.add', { question: review })).toThrow();
      expect(JSON.stringify(store.state)).toBe(before);
    });
  it('私人同步重建选择规则，自由使用没有客观权限；完整重放保持全部事实', () => {
    const { store, key, context } = source();
    store.startVocabularyTask(context, key, 'retest');
    store.startVocabularyTask(context, key, 'usage');
    store.submit('We recycle our old jars.', true, 'usage');
    let restored = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      restored = applyLearningOperation(restored, normalizePrivateSyncOperation(event)).state;
    const privateFacts = clone(restored),
      localFacts = clone(store.state);
    delete privateFacts.events;
    delete localFacts.events;
    expect(privateFacts).toEqual(localFacts);
    let publicRestored = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events) publicRestored = applyLearningOperation(publicRestored, event).state;
    expect(publicRestored).toEqual(store.state);
    const review = store.state.questions.find((q) => q.vocabularyReview?.phase === 'retest');
    const raw = clone(review);
    raw.validation = { type: 'choice', answer: 'Z', authority: 'human_reviewed', evidenceId: 'fake' };
    expect(gradeVocabularyReviewAnswer(raw, review.validation.answer, store.state)).toMatchObject({
      status: 'reliable',
      outcome: 'correct'
    });
    expect(applyLearningOperation(store.state, store.state.events.at(-1)).reused).toBe(true);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup() {
  const store = useConversationLearningStore();
  store.start('英文说明写作', { track: 'junior', stage: '八年级', edition: '' });
  return store;
}
function check(store, word, wrong = false) {
  const q = store.openVocabulary(store.writingContext(), word);
  const answer = wrong ? 'ABCD'[('ABCD'.indexOf(q.validation.answer) + 1) % 4] : q.validation.answer;
  return { q, result: store.submitVocabulary(store.writingContext(), questionKey(q), answer) };
}
describe('词义只判明确绑定的原创语境', () => {
  for (const [sense, meaning] of [
    ['recycle-material', '回收并加工再利用'],
    ['paper-material', '用于书写等用途的纸张'],
    ['reduce-amount', '使数量或程度减少'],
    ['waste-unwanted', '不再需要的废弃物'],
    ['collect-gather', '把分散的东西收集到一起'],
    ['bring-toward', '把东西带到说话者或约定地点'],
    ['save-resource', '节约资源，避免不必要的消耗'],
    ['exchange-swap', '用自己的东西换取别人的东西'],
    ['save-file', '把文件内容保存到存储设备'],
    ['waste-misuse', '不必要地消耗或使用']
  ]) {
    it(`${sense}两个不同原句的确定选择`, () => {
      const questions = [0, 1].map((id) => createVocabularyQuestion(`q${id}`, 'c', 'writing@1', sense, id));
      expect(questions[0].prompt).not.toBe(questions[1].prompt);
      for (const q of questions) {
        const answer = q.options.find((option) => option.endsWith(meaning))[0];
        expect(gradeVocabularyAnswer(q, `我选${answer}`)).toMatchObject({ status: 'reliable', outcome: 'correct' });
        expect(gradeVocabularyAnswer(q, 'AB')).toMatchObject({ status: 'pending', outcome: null });
        expect(q.publishable).toBe(false);
      }
    });
  }
  for (const [name, mutate] of [
    [
      '词义版本',
      (q) => {
        q.vocabularyExercise.senseVersion = 2;
      }
    ],
    [
      '来源',
      (q) => {
        q.source.kind = 'official';
      }
    ],
    [
      '词义',
      (q) => {
        q.vocabularyExercise.senseId = 'save-file';
      }
    ],
    [
      '原句',
      (q) => {
        q.prompt += '选A';
      }
    ],
    [
      '答案',
      (q) => {
        q.validation.answer = 'D';
      }
    ],
    [
      '选项',
      (q) => {
        q.options[0] = 'A. 随便写';
      }
    ],
    [
      '授权字段',
      (q) => {
        q.vocabularyExercise.allowExecute = true;
      }
    ],
    [
      '原写作',
      (q) => {
        q.parentQuestionKey = 'other@1';
      }
    ]
  ])
    it(`篡改${name}不能得到可靠判分`, () => {
      const store = setup(),
        q = store.openVocabulary(store.writingContext(), 'recycle');
      mutate(q);
      expect(gradeVocabularyAnswer(q, 'A')).toMatchObject({ status: 'pending', outcome: null });
      expect(() => normalizeVocabularyQuestion(q, store.state)).toThrow();
    });
  it('同词不同义、中文步骤和其他当前情境不会混用', () => {
    const store = setup();
    expect(writingVocabularySense(store.activeQuestion, 'save')).toBeNull();
    const water = createVocabularyQuestion('w', 'c', 'p@1', 'save-resource');
    const file = createVocabularyQuestion('f', 'c', 'p@1', 'save-file');
    expect(water.vocabularyExercise.senseId).not.toBe(file.vocabularyExercise.senseId);
    expect(water.prompt).toContain('save water');
    expect(file.prompt).toContain('document');
    expect(knowledgeScope(water)).toContain('节约资源');
    expect(knowledgeScope(file)).toContain('文件内容');
    expect(knowledgeScope(water)).not.toContain('save-resource');
    expect(knowledgeScope(water)).not.toBe(knowledgeScope(file));
    expect(() => store.openVocabulary(store.writingContext(), 'unknown')).toThrow('尚未');
  });
});
describe('认词和写作事实、帮助及生命周期', () => {
  it('打开、重复打开不写作答或换焦点；明确确认保存一次原答', () => {
    const store = setup(),
      parent = questionKey(store.activeQuestion),
      context = store.writingContext();
    const q = store.openVocabulary(context, 'recycle');
    expect(store.active.activeQuestionKey).toBe(parent);
    expect(store.writingContext()).toBe(context);
    expect(store.state.attempts).toEqual([]);
    expect(questionKey(store.openVocabulary(context, 'recycle'))).toBe(questionKey(q));
    expect(store.state.questions).toHaveLength(2);
    const revision = store.state.revision;
    expect(() =>
      store.commit('vocabulary.submit', {
        conversationId: store.selectedConversationId,
        questionKey: questionKey(q),
        answer: q.validation.answer
      })
    ).toThrow('确认');
    expect(store.state.revision).toBe(revision);
    const result = store.submitVocabulary(context, questionKey(q), q.validation.answer);
    const attempt = store.state.attempts[0];
    expect(attempt).toMatchObject({
      answer: q.validation.answer,
      kind: 'variant',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    });
    expect(result.feedback.message).toContain('本句选对');
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.reviews).toEqual([]);
    expect(learningEvidenceMap(store.state).nodes[0].label).toContain('回收并加工再利用');
    expect(learningEvidenceMap(store.state).nodes[0].label).not.toContain('recycle-material');
    expect(() => store.submitVocabulary(context, questionKey(q), q.validation.answer)).toThrow('已有');
    expect(store.state.attempts).toHaveLength(1);
    store.submit('Our school recycles paper.\nPlease bring  old paper.', true, 'answer');
    expect(store.state.attempts[1].grade.status).toBe('pending');
    expect(store.state.attempts[1].hints.length).toBeGreaterThanOrEqual(2);
  });
  it('前后展示的释义/句型帮助都进入词义原答；另一语境不凭提示正确折叠', () => {
    const store = setup();
    store.recordWritingHelp(store.writingContext(), 'Our school will …', 'explanation');
    const q = store.openVocabulary(store.writingContext(), 'recycle');
    store.recordWritingHelp(store.writingContext(), 'recycle：回收再利用', 'explanation');
    store.submitVocabulary(store.writingContext(), questionKey(q), q.validation.answer);
    expect(store.state.attempts[0].hints.map((h) => h.content)).toEqual(['Our school will …', 'recycle：回收再利用']);
    check(store, 'recycle');
    expect(vocabularyEvidence(store.state, 'recycle-material')).toMatchObject({
      contexts: 2,
      independentCorrect: 0,
      needsPractice: true
    });
    expect(adaptiveWritingWords(store.state, store.activeQuestion, ['recycle'])[0].folded).toBe(false);
  });
  it('实际教学交付也计入已打开词义题的帮助，不能遗漏模型或本地提示', () => {
    const store = setup(),
      q = store.openVocabulary(store.writingContext(), 'recycle');
    store.commit('teaching.deliver', {
      conversationId: store.selectedConversationId,
      questionKey: questionKey(store.activeQuestion),
      method: 'hint',
      origin: 'model_reply',
      content: '先看 into new glass，表示回收加工。',
      helped: true,
      level: 1
    });
    store.submitVocabulary(store.writingContext(), questionKey(q), q.validation.answer);
    expect(store.state.attempts.at(-1).hints).toMatchObject([
      { origin: 'model_reply', content: '先看 into new glass，表示回收加工。' }
    ]);
    expect(vocabularyEvidence(store.state, 'recycle-material').independentCorrect).toBe(0);
  });
  it('两个原句无提示正确只折叠该义项，重复句不增加覆盖；新错答或校对重新优先', () => {
    const store = setup();
    check(store, 'recycle');
    expect(vocabularyEvidence(store.state, 'recycle-material').independentCorrect).toBe(1);
    store.start('英文说明写作');
    check(store, 'recycle');
    expect(vocabularyEvidence(store.state, 'recycle-material').independentCorrect).toBe(2);
    expect(
      adaptiveWritingWords(store.state, store.activeQuestion, ['recycle', 'paper']).map((card) => card.word)
    ).toEqual(['paper', 'recycle']);
    expect(adaptiveWritingWords(store.state, store.activeQuestion, ['recycle'])[0].folded).toBe(true);
    expect(vocabularyEvidence(store.state, 'save-file').independentCorrect).toBe(0);
    store.start('英文说明写作');
    check(store, 'recycle', true);
    expect(vocabularyEvidence(store.state, 'recycle-material')).toMatchObject({
      contexts: 2,
      independentCorrect: 1,
      needsPractice: true
    });
    expect(adaptiveWritingWords(store.state, store.activeQuestion, ['paper', 'recycle'])[0]).toMatchObject({
      word: 'recycle',
      folded: false
    });
    const store2 = setup();
    check(store2, 'paper');
    store2.commit('assessment.correct', {
      attemptId: store2.state.attempts.at(-1).id,
      outcome: 'correct',
      reason: '重新校对'
    });
    expect(vocabularyEvidence(store2.state, 'paper-material').independentCorrect).toBe(0);
  });
  it('新操作标识和回放幂等，同标识换内容冲突；公开导出可完整重放', () => {
    const store = setup();
    check(store, 'recycle');
    const before = store.exportData(),
      last = store.state.events.at(-1);
    const replayed = applyLearningOperation(store.state, last);
    expect(replayed.reused).toBe(true);
    expect(() => applyLearningOperation(store.state, { ...last, data: { ...last.data, answer: 'D' } })).toThrow();
    let restored = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of JSON.parse(before).events) restored = applyLearningOperation(restored, event).state;
    expect(restored).toEqual(store.state);
    const stripped = clone(restored);
    stripped.events = stripped.events.filter((e) => e.type !== 'vocabulary.submit');
    expect(vocabularyEvidence(stripped, 'recycle-material').independentCorrect).toBe(0);
  });
  it('停止、跨对话、账户或恢复后的旧选择不保存；通用提交不能绕过绑定', () => {
    const store = setup(),
      context = store.writingContext(),
      q = store.openVocabulary(context, 'paper');
    const key = questionKey(q),
      oldConversation = store.selectedConversationId;
    store.start('英文说明写作');
    expect(() => store.submitVocabulary(context, key, q.validation.answer)).toThrow('切换');
    expect(() =>
      store.commit('vocabulary.submit', {
        conversationId: store.selectedConversationId,
        questionKey: key,
        answer: q.validation.answer,
        explicit: true
      })
    ).toThrow();
    expect(() =>
      store.commit('question.focus', { conversationId: store.selectedConversationId, questionKey: key })
    ).toThrow('另一对话');
    store.focus(key, oldConversation);
    expect(() =>
      store.commit('attempt.submit', { conversationId: oldConversation, answer: 'A', explicit: true })
    ).toThrow('原写作');
    store.commit('task.stop', { conversationId: oldConversation });
    expect(() =>
      store.commit('vocabulary.submit', {
        conversationId: oldConversation,
        questionKey: key,
        answer: 'A',
        explicit: true
      })
    ).toThrow('停止');
    store.focus(key, oldConversation);
    expect(() =>
      store.commit('attempt.submit', { conversationId: oldConversation, answer: 'A', explicit: true })
    ).toThrow();
    expect(store.state.attempts).toEqual([]);
    const current = store.writingContext();
    learningRepository.deleteData();
    expect(() => store.openVocabulary(current, 'paper')).toThrow('切换');
  });
});
describe('实际词卡交互和未保存的句子', () => {
  async function lab(store) {
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        conversationId: store.selectedConversationId,
        context: store.writingContext(),
        recordWritingHelp: store.recordWritingHelp,
        openVocabulary: store.openVocabulary,
        submitVocabulary: store.submitVocabulary,
        vocabularyTaskFor: store.vocabularyTaskFor,
        startVocabularyTask: store.startVocabularyTask
      },
      global: { stubs }
    });
    await wrapper.find('.lab-heading').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    return wrapper;
  }
  async function refresh(wrapper, store) {
    await wrapper.setProps({ state: store.state, question: store.activeQuestion, context: store.writingContext() });
  }
  it('间隔选择只改草稿，明确安排7天任务才写事实且原句草稿保持', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-08T15:00:00Z'));
    const store = setup(),
      wrapper = await lab(store);
    await wrapper.find('textarea').setValue('Keep my  draft.\nSecond line.');
    await button(wrapper, 'recycle').trigger('tap');
    await refresh(wrapper, store);
    const q = store.state.questions.at(-1);
    await button(wrapper, q.options['ABCD'.indexOf(q.validation.answer)]).trigger('tap');
    await button(wrapper, '确认词义').trigger('tap');
    await refresh(wrapper, store);
    expect(button(wrapper, '3天后')).toBeDefined();
    const before = JSON.stringify(store.state);
    await button(wrapper, '3天后').trigger('tap');
    expect(button(wrapper, '3天后').attributes('aria-pressed')).toBe('true');
    await button(wrapper, '7天后').trigger('tap');
    expect(JSON.stringify(store.state)).toBe(before);
    expect(wrapper.find('textarea').element.value).toBe('Keep my  draft.\nSecond line.');
    await button(wrapper, '7天后认词').trigger('tap');
    await refresh(wrapper, store);
    expect(store.state.questions.at(-1).vocabularyReview).toMatchObject({ delayDays: 7, dueDay: '2026-10-15' });
    expect(store.state.attempts).toHaveLength(1);
    expect(wrapper.find('textarea').element.value).toBe('Keep my  draft.\nSecond line.');
    expect(button(wrapper, '已安排 10/15').attributes('disabled')).toBeDefined();
    await button(wrapper, '明日').trigger('tap');
    expect(button(wrapper, '明日认词').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
  it('停止/忙碌阻止改间隔和安排，回到草稿及换词清除间隔草稿', async () => {
    const store = setup(),
      wrapper = await lab(store);
    await button(wrapper, 'recycle').trigger('tap');
    await refresh(wrapper, store);
    const q = store.state.questions.at(-1);
    await button(wrapper, q.options['ABCD'.indexOf(q.validation.answer)]).trigger('tap');
    await button(wrapper, '确认词义').trigger('tap');
    await refresh(wrapper, store);
    await button(wrapper, '3天后').trigger('tap');
    for (const props of [
      { stopped: true, busy: false },
      { stopped: false, busy: true }
    ]) {
      await wrapper.setProps(props);
      const before = JSON.stringify(store.state);
      expect(button(wrapper, '7天后').attributes('disabled')).toBeDefined();
      await button(wrapper, '7天后').trigger('tap');
      await button(wrapper, '3天后认词').trigger('tap');
      expect(button(wrapper, '3天后').attributes('aria-pressed')).toBe('true');
      expect(JSON.stringify(store.state)).toBe(before);
    }
    await wrapper.setProps({ stopped: false, busy: false });
    await button(wrapper, '回到草稿').trigger('tap');
    await button(wrapper, 'recycle').trigger('tap');
    await refresh(wrapper, store);
    expect(button(wrapper, '明日')).toBeUndefined();
    const nextQuestion = store.state.questions.at(-1);
    await button(wrapper, nextQuestion.options['ABCD'.indexOf(nextQuestion.validation.answer)]).trigger('tap');
    await button(wrapper, '确认词义').trigger('tap');
    await refresh(wrapper, store);
    expect(button(wrapper, '明日').attributes('aria-pressed')).toBe('true');
    wrapper.unmount();
  });
  it('确认后明日安排保留逐句草稿，明确自己写句才打开空独立任务', async () => {
    const store = setup(),
      wrapper = await lab(store);
    await wrapper.find('textarea').setValue('My unsaved  sentence.');
    expect(button(wrapper, '明日认词')).toBeUndefined();
    await button(wrapper, 'recycle').trigger('tap');
    await refresh(wrapper, store);
    const q = store.state.questions.at(-1);
    await button(wrapper, q.options['ABCD'.indexOf(q.validation.answer)]).trigger('tap');
    expect(store.state.attempts).toHaveLength(0);
    await button(wrapper, '确认词义').trigger('tap');
    await refresh(wrapper, store);
    await button(wrapper, '明日认词').trigger('tap');
    await refresh(wrapper, store);
    expect(wrapper.find('textarea').element.value).toBe('My unsaved  sentence.');
    expect(
      wrapper
        .findAll('button')
        .find((b) => b.text().startsWith('已安排'))
        .attributes('disabled')
    ).toBeDefined();
    expect(store.state.attempts).toHaveLength(1);
    await button(wrapper, '自己写一句').trigger('tap');
    await refresh(wrapper, store);
    expect(store.activeQuestion.vocabularyReview.phase).toBe('usage');
    expect(store.state.attempts).toHaveLength(1);
    expect(wrapper.find('textarea').exists()).toBe(false);
    wrapper.unmount();
  });
  it('点词和选项不提交；确认保留草稿并收起选择；释义先保存帮助', async () => {
    const store = setup(),
      wrapper = await lab(store);
    await wrapper.find('textarea').setValue('Our school recycles  paper.');
    await button(wrapper, 'recycle').trigger('tap');
    await refresh(wrapper, store);
    expect(wrapper.find('textarea').element.value).toBe('Our school recycles  paper.');
    expect(button(wrapper, '确认词义').attributes('disabled')).toBeDefined();
    const q = store.state.questions.at(-1);
    await button(wrapper, q.options['ABCD'.indexOf(q.validation.answer)]).trigger('tap');
    expect(store.state.attempts).toHaveLength(0);
    await button(wrapper, '确认词义').trigger('tap');
    await refresh(wrapper, store);
    expect(wrapper.text()).toContain('本句选对');
    expect(button(wrapper, '确认词义')).toBeUndefined();
    expect(wrapper.find('textarea').element.value).toBe('Our school recycles  paper.');
    await button(wrapper, '换句再认').trigger('tap');
    await refresh(wrapper, store);
    await button(wrapper, '看释义').trigger('tap');
    await refresh(wrapper, store);
    expect(wrapper.text()).toContain('recycle：回收');
    expect(store.state.attempts).toHaveLength(1);
    const nextQuestion = store.state.questions.at(-1);
    await button(wrapper, nextQuestion.options['ABCD'.indexOf(nextQuestion.validation.answer)]).trigger('tap');
    await button(wrapper, '确认词义').trigger('tap');
    await refresh(wrapper, store);
    expect(wrapper.findAll('.lab-feedback').filter((item) => item.text().includes('recycle：'))).toHaveLength(1);
    expect(wrapper.text()).toContain('有提示');
    await button(wrapper, '回到草稿').trigger('tap');
    expect(wrapper.find('textarea').element.value).toBe('Our school recycles  paper.');
    store.startWriting(store.writingContext(), 'explanation');
    await refresh(wrapper, store);
    expect(wrapper.find('textarea').exists()).toBe(false);
    wrapper.unmount();
  });
});
