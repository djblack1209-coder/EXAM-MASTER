import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { toRaw } from 'vue';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  normalizePrivateSyncOperation,
  questionKey,
  LEARNING_START_TOPICS,
  gradeAnswer
} from '@/services/learning/learning-domain.js';
import { conversationStrategy } from '../../laf-backend/functions/_shared/learning-strategy.js';
import {
  SENTENCE_CONTRACT,
  SENTENCE_TASKS,
  SENTENCE_BASIS,
  createSentenceQuestion,
  sentenceAnswer,
  gradeSentenceAnswer,
  sentenceRetestReady
} from '../../laf-backend/functions/_shared/learning-sentence.js';
import SentenceBuilder from '@/components/business/learning/sentence-builder.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const start = () => {
  const s = useConversationLearningStore();
  s.start('英文句子组织');
  return s;
};
const order = (task) => task.pieces.map((_, i) => `t${i + 1}`);
const buttons = (w, label) => w.findAll('button').find((b) => b.text() === label);
function builderView(s, extra = {}) {
  return mount(SentenceBuilder, {
    props: {
      question: s.activeQuestion,
      state: s.state,
      context: s.writingContext(),
      submitOrder: s.submitSentence,
      recordHelp: s.recordSentenceHelp,
      nextTask: s.startSentenceTask,
      scheduleRetest: s.scheduleSentenceRetest,
      ...extra
    },
    global: {
      stubs: {
        view: { template: '<div><slot /></div>' },
        text: { template: '<span><slot /></span>' },
        BaseIcon: true
      }
    }
  });
}
const update = (w, s, extra = {}) =>
  w.setProps({ question: s.activeQuestion, state: s.state, context: s.writingContext(), ...extra });
describe('原创句子与有界组合核对', () => {
  it('共享明确主题，原任务不猜测考试方向、不授予官方分数', () => {
    const s = start();
    expect(LEARNING_START_TOPICS).toContain('英文句子组织');
    expect(sentenceRetestReady(s.activeQuestion)).toBe(true);
    expect(s.active.task).toBeUndefined();
    expect(s.state.attempts).toEqual([]);
    expect(s.activeQuestion).toMatchObject({
      source: { kind: 'project_original', reference: SENTENCE_CONTRACT },
      answerType: 'sentence_order'
    });
    expect(SENTENCE_BASIS.scoringAuthority).toBe(false);
    expect(new URL(SENTENCE_BASIS.teachingUrl).hostname).toBe('www.ets.org');
  });
  for (const task of SENTENCE_TASKS) {
    it(`${task.id}原情境/固定文字/唯一词块和审定组合保持`, () => {
      const q = createSentenceQuestion('q', 'c', task.id),
        ids = order(task),
        answer = sentenceAnswer(q, ids);
      expect(q.prompt).toContain(task.context);
      expect(q.sentenceExercise).toMatchObject({ slots: ids.length, prefix: task.prefix, suffix: task.suffix });
      expect(new Set(q.sentenceExercise.tiles.map((t) => t.id)).size).toBe(ids.length + 1);
      expect(gradeSentenceAnswer(q, answer)).toMatchObject({
        status: 'reliable',
        outcome: 'correct',
        basis: SENTENCE_CONTRACT
      });
      expect(gradeAnswer(q, '  ' + answer.replaceAll(' ', '  ') + '\n')).toMatchObject({
        status: 'reliable',
        outcome: 'correct'
      });
      const wrong = [...ids];
      wrong[0] = `t${ids.length + 1}`;
      expect(gradeSentenceAnswer(q, sentenceAnswer(q, wrong))).toMatchObject({ status: 'reliable', outcome: 'wrong' });
      expect(gradeSentenceAnswer(q, answer + ' invented')).toMatchObject({ status: 'pending' });
      expect(() => sentenceAnswer(q, [...ids.slice(1), ids[1]])).toThrow('不重复');
    });
  }
  it('时间短语的另一审定语序接纳，未审定完整排列保留待核对', () => {
    const q = createSentenceQuestion('q', 'c');
    expect(gradeSentenceAnswer(q, sentenceAnswer(q, ['t1', 't3', 't2']))).toMatchObject({
      status: 'reliable',
      outcome: 'correct'
    });
    expect(gradeSentenceAnswer(q, sentenceAnswer(q, ['t2', 't1', 't3']))).toMatchObject({
      status: 'pending',
      basis: 'sentence_combination_review_required'
    });
  });
  it.each([
    ['library-hours', ['t3', 't1', 't2'], 'The library every morning opens at eight.'],
    ['camera-helper', ['t1', 't4', 't5', 't2', 't3'], 'The student who is in our club lent me the camera.'],
    ['read-report', ['t1', 't4', 't2', 't3'], 'Has the tutor yet read your report?']
  ])('%s另一有效组合不会误判或强制唯一词序', (id, ids, expected) => {
    const q = createSentenceQuestion('q', 'c', id);
    expect(sentenceAnswer(q, ids)).toBe(expected);
    expect(gradeSentenceAnswer(q, expected)).toMatchObject({ status: 'reliable', outcome: 'correct' });
  });
  it('有多余词块的未知组合仍待核对，不把可能的主动表达误判为语法错误', () => {
    const q = createSentenceQuestion('q', 'c', 'telescope-storage');
    const answer = 'The telescope is storing in the science room.';
    expect(sentenceAnswer(q, ['t1', 't5', 't3', 't4'])).toBe(answer);
    expect(gradeSentenceAnswer(q, answer)).toEqual({
      status: 'pending',
      outcome: null,
      basis: 'sentence_combination_review_required'
    });
  });
  const tamper = [
    (q) => (q.prompt += 'changed'),
    (q) => (q.sentenceExercise.prefix = 'Forged'),
    (q) => q.sentenceExercise.slots++,
    (q) => (q.sentenceExercise.tiles[0].text = 'forged'),
    (q) => (q.sentenceExercise.taskId = 'unknown'),
    (q) => (q.source.reference = 'official-ETS'),
    (q) => (q.sentenceExercise.extra = true),
    (q) => (q.validation.answer = 'forged'),
    (q) => (q.sentenceExercise.phase = 'unsupported'),
    (q) => {
      delete q.sentenceExercise;
      q.validation = null;
    },
    (q) => (q.subject = '数学'),
    (q) => (q.expectedAnswer = 'hidden')
  ];
  tamper.forEach((change, index) =>
    it(`规范来源篡改${index + 1}原子拒绝，不能取得判分权`, () => {
      const s = start(),
        q = createSentenceQuestion('tampered', s.active.id, 'meeting-room');
      change(q);
      const before = s.exportData();
      expect(() => s.commit('question.add', { question: q })).toThrow();
      expect(s.exportData()).toBe(before);
      expect(gradeSentenceAnswer(q, 'Anything.').status).toBe('pending');
    })
  );
  it('私人重放不采信传入校验，宿主重新核对规范题', () => {
    const s = start(),
      q = s.activeQuestion,
      op = s.state.events.find((e) => e.type === 'question.add');
    const normalized = normalizePrivateSyncOperation(op);
    expect(normalized.data.question.validation).toBeNull();
    expect(normalized.data.question.sentenceExercise).toEqual(q.sentenceExercise);
    s.submitSentence(s.writingContext(), ['t1', 't2', 't3']);
    const exported = s.exportData();
    learningRepository.restoreData(exported, s.state.revision);
    s.refresh();
    expect(s.exportData()).toBe(exported);
  });
});
describe('明确原答、帮助、独立与原时区复测', () => {
  it('未明确提交先澄清，正文超界、重复/缺少词块均不写事实', () => {
    const s = start(),
      raw = sentenceAnswer(s.activeQuestion, ['t1', 't2', 't3']);
    expect(s.submit(raw, false).clarification).toBe(true);
    expect(s.state.attempts).toEqual([]);
    for (const ids of [['t1', 't1', 't2'], ['t1'], ['t1', 't2', 'other']]) {
      const before = s.exportData();
      expect(() => s.submitSentence(s.writingContext(), ids)).toThrow();
      expect(s.exportData()).toBe(before);
    }
    const before = s.exportData();
    expect(() => s.submit('x'.repeat(501), true)).toThrow('500');
    expect(s.exportData()).toBe(before);
  });
  it('帮助重复展示去重，新原答后再看归下一尝试，独立新题撤去支架', () => {
    const s = start(),
      context = s.writingContext(),
      key = questionKey(s.activeQuestion);
    s.recordSentenceHelp(context);
    s.recordSentenceHelp(context);
    expect(s.active.pendingHints).toHaveLength(1);
    s.submitSentence(context, ['t1', 't2', 't3']);
    expect(s.state.attempts[0].hints).toHaveLength(1);
    s.recordSentenceHelp(context);
    expect(s.active.pendingHints).toHaveLength(1);
    s.startSentenceTask(context);
    expect(s.activeQuestion.sentenceExercise.taskId).toBe('meeting-room');
    expect(s.active.pendingHints).toEqual([]);
    expect(s.active.helpQueues.find((h) => h.questionKey === key).hints).toHaveLength(1);
    expect(s.state.plans.at(-1).tasks.at(-1).condition).toBe('independent_correct');
  });
  it('保留旧停止和明确教法，另一对话不能聚焦/提交句子', () => {
    const s = useConversationLearningStore();
    s.start('12 + 8');
    const old = s.active.id;
    s.commit('task.stop', { conversationId: old });
    const strategy = conversationStrategy(s.state, old);
    s.start('英文句子组织');
    const id = s.active.id,
      key = questionKey(s.activeQuestion),
      context = s.writingContext();
    s.commit('strategy.set', { conversationId: id, method: 'explain', source: 'self_report', reason: '用户明确指定' });
    s.submitSentence(context, ['t1', 't2', 't3']);
    s.startSentenceTask(context);
    expect(s.activeStrategy.method).toBe('explain');
    expect(conversationStrategy(s.state, old)).toEqual(strategy);
    s.start('其他问题');
    const before = s.exportData();
    expect(() => s.focus(key)).toThrow('另一对话');
    expect(s.exportData()).toBe(before);
    expect(() => s.submitSentence(context, ['t1', 't2', 't3'])).toThrow('已切换');
  });
  it('停止/切题后的迟到回调拒绝；导航不恢复', () => {
    const s = start(),
      context = s.writingContext();
    s.commit('task.stop', { conversationId: s.active.id });
    const before = s.exportData();
    for (const fn of [
      () => s.submitSentence(context, ['t1', 't2', 't3']),
      () => s.recordSentenceHelp(context),
      () => s.startSentenceTask(context),
      () => s.scheduleSentenceRetest(context)
    ])
      expect(fn).toThrow('停止');
    s.refresh();
    expect(s.active.stopped).toBe(true);
    expect(s.exportData()).toBe(before);
  });
  it('十二情境用完不复用旧帮助题，也不偷偷新增事实', () => {
    const s = start();
    for (let i = 1; i < SENTENCE_TASKS.length; i++) s.startSentenceTask(s.writingContext());
    const before = s.exportData();
    expect(() => s.startSentenceTask(s.writingContext())).toThrow('已练完');
    expect(s.exportData()).toBe(before);
  });
  it('明日原时区/DST、提前拒绝和幂等，到期的独立正确才完成计划', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T08:30:00Z'));
    const s = start(),
      context = s.writingContext();
    s.submitSentence(context, ['t1', 't2', 't3']);
    const reviews = structuredClone(toRaw(s.state.reviews));
    const next = s.scheduleSentenceRetest(context);
    expect(s.scheduleSentenceRetest(context)).toEqual(next);
    expect(next.day).toBe('2026-11-02');
    s.focus(next.questionKey);
    expect(s.activeQuestion.sentenceExercise).toMatchObject({
      plannedTimezone: 'America/Los_Angeles',
      plannedDay: '2026-11-01',
      dueDay: '2026-11-02',
      taskId: 'meeting-room'
    });
    s.commit('timezone.set', { timezone: 'Asia/Shanghai' });
    expect(s.sentenceCanSubmit()).toBe(false);
    const before = s.exportData();
    expect(() => s.submitSentence(s.writingContext(), ['t1', 't2', 't3'])).toThrow('复测日期');
    expect(s.exportData()).toBe(before);
    expect(s.state.reviews).toEqual(reviews);
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'));
    expect(s.sentenceCanSubmit()).toBe(true);
    s.submitSentence(s.writingContext(), ['t1', 't2', 't3']);
    expect(s.state.attempts.at(-1).grade.outcome).toBe('correct');
    expect(
      s.state.plans
        .filter((p) => p.day === next.day)
        .at(-1)
        .tasks.at(-1).completedBy
    ).toBe(s.state.attempts.at(-1).id);
  });
  it('看过提示的到期正确不能完成independent_correct，原题和用户校对仍保留', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T20:00:00Z'));
    const s = start();
    s.submitSentence(s.writingContext(), ['t1', 't2', 't3']);
    const next = s.scheduleSentenceRetest(s.writingContext());
    s.focus(next.questionKey);
    s.recordSentenceHelp(s.writingContext());
    vi.setSystemTime(new Date('2026-10-07T07:00:00Z'));
    s.submitSentence(s.writingContext(), ['t1', 't2', 't3']);
    expect(s.state.attempts.at(-1).hints).toHaveLength(1);
    expect(
      s.state.plans
        .filter((p) => p.day === next.day)
        .at(-1)
        .tasks.at(-1).completedBy
    ).toBeFalsy();
  });
  it('未知语序pending不写可靠成绩或复习，原题不能通过辅助assess变成官方评分', () => {
    const s = start();
    s.submitSentence(s.writingContext(), ['t2', 't1', 't3']);
    expect(s.state.attempts[0].grade.status).toBe('pending');
    expect(s.summary.first.denominator).toBe(0);
    expect(s.state.reviews).toEqual([]);
    const before = s.exportData();
    expect(() =>
      s.commit('assessment.assist', {
        conversationId: s.active.id,
        attemptId: s.state.attempts[0].id,
        outcome: 'correct',
        feedback: 'official',
        model: 'synthetic'
      })
    ).toThrow();
    expect(s.exportData()).toBe(before);
  });
});
describe('实际词块组件', () => {
  it('词块选择/移位/撤回/清空只改草稿，明确提交才保存完整句子', async () => {
    const s = start(),
      w = builderView(s),
      before = s.exportData();
    try {
      await buttons(w, 'at eight').trigger('tap');
      await buttons(w, 'opens').trigger('tap');
      await buttons(w, 'every morning').trigger('tap');
      await w.get('[aria-label="第2个词块：opens"]').trigger('tap');
      await w.get('[aria-label="词块向左移"]').trigger('tap');
      expect(s.exportData()).toBe(before);
      await buttons(w, '撤回词块').trigger('tap');
      expect(buttons(w, '提交句子').attributes('disabled')).toBeDefined();
      await buttons(w, '重新排列').trigger('tap');
      for (const text of ['opens', 'at eight', 'every morning']) await buttons(w, text).trigger('tap');
      expect(s.exportData()).toBe(before);
      await buttons(w, '提交句子').trigger('tap');
      expect(s.state.attempts).toHaveLength(1);
      expect(s.state.attempts[0]).toMatchObject({
        answer: 'The library opens at eight every morning.',
        grade: { outcome: 'correct' }
      });
      await update(w, s);
      expect(buttons(w, '提交句子').attributes('disabled')).toBeDefined();
    } finally {
      w.unmount();
    }
  });
  it('帮助保存失败不展示；成功后才显示；新题清掉旧词块和提示', async () => {
    const s = start(),
      fail = vi.fn(() => {
        throw new Error('未保存');
      }),
      w = builderView(s, { recordHelp: fail });
    try {
      await buttons(w, '看句子提示').trigger('tap');
      expect(w.text()).toContain('操作未完成，请重试。');
      expect(w.text()).not.toContain('先找主语后的谓语');
      await w.setProps({ recordHelp: s.recordSentenceHelp });
      await buttons(w, '看句子提示').trigger('tap');
      expect(w.text()).toContain('先找主语后的谓语');
      await buttons(w, 'opens').trigger('tap');
      await buttons(w, '独立新句子').trigger('tap');
      await update(w, s);
      expect(w.text()).not.toContain('先找主语后的谓语');
      expect(w.find('[aria-label="第1个词块：opens"]').exists()).toBe(false);
    } finally {
      w.unmount();
    }
  });
  it('未来题允许草稿和提示但禁止原答；停止只读，隐藏收回临时选择', async () => {
    const s = start(),
      w = builderView(s, { ready: false });
    try {
      for (const text of ['opens', 'at eight', 'every morning']) await buttons(w, text).trigger('tap');
      expect(buttons(w, '提交句子').attributes('disabled')).toBeDefined();
      await buttons(w, '提交句子').trigger('tap');
      expect(s.state.attempts).toEqual([]);
      await w.setProps({ stopped: true });
      const before = s.exportData();
      await buttons(w, '重新排列').trigger('tap');
      expect(w.findAll('.sentence-frame button')).toHaveLength(3);
      expect(s.exportData()).toBe(before);
      await w.setProps({ visible: false });
      expect(w.findAll('.sentence-frame button')).toHaveLength(0);
    } finally {
      w.unmount();
    }
  });
});
