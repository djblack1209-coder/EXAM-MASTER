import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  emptyLearningState,
  gradeAnswer,
  normalizePrivateSyncOperation,
  questionKey
} from '@/services/learning/learning-domain.js';
import {
  createScienceQuestion,
  nextScienceInput,
  scienceRetestReady
} from '../../laf-backend/functions/_shared/learning-science.js';
import LearningLab from '@/components/business/learning/learning-lab.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onBackPress: vi.fn() }));
const distance = { template: 'distance_displacement', outward: 6, backward: 4, direction: 'right' };
const force = { template: 'constant_net_force', massKg: 2, netForceN: 4, direction: 'right' };
const at = Date.parse('2026-10-05T09:00:00Z');
const copy = (value) => JSON.parse(JSON.stringify(value));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(at);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup(input = distance) {
  const store = useConversationLearningStore();
  store.start('学习物理');
  store.startScience(store.writingContext(), input);
  return store;
}
const correct = (q) => q.validation.answer;
const current = () =>
  applyLearningOperation(emptyLearningState('science-user', 'Asia/Shanghai'), {
    id: 'c',
    type: 'conversation.start',
    at,
    data: { goal: '学习物理' }
  }).state;
const add = (state, q) =>
  applyLearningOperation(state, { id: `add-${q.id}`, type: 'question.add', at, data: { question: q } }).state;
describe('有界物理题的独立依据', () => {
  it.each([
    [7, 5, 'left', '路程12m，位移-2m'],
    [7, 5, 'right', '路程12m，位移2m'],
    [6, 0, 'left', '路程6m，位移-6m'],
    [6, 6, 'right', '路程12m，位移0m']
  ])('总路程与有符号位移：%s/%s/%s', (outward, backward, direction, expected) => {
    const q = createScienceQuestion('q', 'c', { template: distance.template, outward, backward, direction });
    const index = q.options.findIndex((text) => text.slice(3) === expected);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(new Set(q.options.map((text) => text.slice(3))).size).toBe(4);
    expect(gradeAnswer(q, 'ABCD'[index])).toMatchObject({
      status: 'reliable',
      outcome: 'correct',
      basis: 'science-transfer-v1'
    });
    expect(gradeAnswer(q, 'ABCD'[(index + 1) % 4]).outcome).toBe('wrong');
  });
  it.each([
    [1, 12, 'left'],
    [20, 1, 'right'],
    [2, 0, 'none']
  ])('同合力双质量，零合力不猜方向：%s/%s/%s', (massKg, netForceN, direction) => {
    const q = createScienceQuestion('q', 'c', { template: force.template, massKg, netForceN, direction });
    const expected = netForceN ? '大小减半，方向相同' : '两者加速度均为0';
    const index = q.options.findIndex((text) => text.slice(3) === expected);
    expect(gradeAnswer(q, 'ABCD'[index]).outcome).toBe('correct');
    expect(q.prompt).toContain(`${massKg * 2}kg`);
  });
  it('全部受支持整数参数的换题保持界限且改变条件，不固定正确字母', () => {
    const letters = new Set();
    for (let outward = 1; outward <= 20; outward++)
      for (let backward = 0; backward <= outward; backward++)
        for (const direction of ['left', 'right']) {
          const input = { template: distance.template, outward, backward, direction },
            next = nextScienceInput(input);
          expect(next).not.toEqual(input);
          expect(next.outward).toBeLessThanOrEqual(20);
          expect(next.backward).toBeLessThanOrEqual(next.outward);
          const q = createScienceQuestion('q', 'c', next);
          expect(new Set(q.options).size).toBe(4);
          letters.add(q.validation.answer);
        }
    for (let massKg = 1; massKg <= 20; massKg++)
      for (let netForceN = 0; netForceN <= 12; netForceN++) {
        const next = nextScienceInput({
          template: force.template,
          massKg,
          netForceN,
          direction: netForceN ? 'right' : 'none'
        });
        expect(next.massKg).toBeGreaterThanOrEqual(1);
        expect(next.massKg).toBeLessThanOrEqual(20);
        expect(next.netForceN).toBeLessThanOrEqual(12);
      }
    expect(letters.size).toBe(4);
  });
  for (const attack of [
    'prompt',
    'options',
    'source',
    'contract',
    'extra',
    'conversation',
    'phase',
    'mass',
    'parent',
    'rubric',
    'answer'
  ])
    it(`拒绝${attack}伪造，原状态逐字保持`, () => {
      const state = current(),
        q = createScienceQuestion('q', 'c', force),
        before = JSON.stringify(state);
      if (attack === 'prompt') q.prompt += '已经掌握';
      if (attack === 'options') q.options[0] = 'A. forged';
      if (attack === 'source') q.source.url = 'http://127.0.0.1';
      if (attack === 'contract') q.scienceExercise.contract = 'future';
      if (attack === 'extra') q.scienceExercise.code = 'exec()';
      if (attack === 'conversation') q.scienceExercise.conversationId = 'other';
      if (attack === 'phase') q.scienceExercise.phase = 'mastered';
      if (attack === 'mass') q.scienceExercise.input.massKg = 0;
      if (attack === 'parent') q.parentQuestionKey = 'missing@1';
      if (attack === 'rubric') q.rubric = { criteria: [] };
      if (attack === 'answer') q.expectedAnswer = 'A';
      expect(() => add(state, q)).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    });
  it('传来的答案权限不可信，客户端/私人同步均从条件重建', () => {
    const q = createScienceQuestion('q', 'c', force),
      expected = q.validation;
    q.validation = { type: 'choice', answer: 'Z', authority: 'human_reviewed', evidenceId: 'forged' };
    expect(add(current(), q).questions[0].validation).toEqual(expected);
    const op = normalizePrivateSyncOperation({ id: 'add-q', type: 'question.add', at, data: { question: q } });
    expect(op.data.question.validation).toBeNull();
    expect(applyLearningOperation(current(), op).state.questions[0].validation).toEqual(expected);
    expect(gradeAnswer(q, expected.answer).outcome).toBe('correct');
  });
  it.each(['A B', 'E', '我猜也许A', 'A<script>', ''])('含糊或非当前选项保持待核对：%s', (answer) => {
    expect(gradeAnswer(createScienceQuestion('q', 'c', force), answer).status).toBe('pending');
  });
});
describe('原答、计划、复测与停止', () => {
  it('探索不计事实，选择/普通发送不提交，正式正确才完成独立任务', () => {
    const store = setup();
    expect(store.state.attempts).toHaveLength(0);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.tasks.numerator).toBe(0);
    expect(store.activeQuestion.scienceExercise.input).toEqual({
      ...distance,
      outward: 7,
      backward: 5,
      direction: 'left'
    });
    expect(store.submit(correct(store.activeQuestion), false).clarification).toBe(true);
    expect(store.state.attempts).toHaveLength(0);
    store.submit(correct(store.activeQuestion), true, 'a');
    expect(store.state.attempts[0]).toMatchObject({
      answer: 'A',
      kind: 'first',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    });
    expect(store.summary.first).toMatchObject({ numerator: 0, denominator: 1 });
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 1 });
  });
  it('提示仍属于旧题，换新条件不迁帮助；提示后正确不完成独立任务', () => {
    const store = setup(),
      old = questionKey(store.activeQuestion);
    learningRepository.commit({
      id: 'hint-old',
      type: 'hint.add',
      at,
      data: { conversationId: store.active.id, content: '先区分走过长度与端点', level: 1 }
    });
    store.refresh();
    store.generateVariant();
    expect(store.activeQuestion.parentQuestionKey).toBe(old);
    expect(store.active.pendingHints).toEqual([]);
    expect(store.active.helpQueues.find((entry) => entry.questionKey === old).hints).toHaveLength(1);
    learningRepository.commit({
      id: 'hint-new',
      type: 'hint.add',
      at,
      data: { conversationId: store.active.id, content: '看一眼端点', level: 1 }
    });
    store.refresh();
    store.submit(correct(store.activeQuestion), true, 'a');
    expect(store.state.attempts[0].hints).toHaveLength(1);
    expect(store.summary.tasks.numerator).toBe(0);
    expect(store.summary.first.denominator).toBe(0);
  });
  it('复测保留今日/明日既有任务，重复安排不创建新题；提前看与提交不完成', () => {
    const store = setup(force);
    store.submit(correct(store.activeQuestion), true, 'a');
    const original = questionKey(store.activeQuestion);
    learningRepository.commit({
      id: 'tomorrow',
      type: 'plan.set',
      at,
      data: { day: '2026-10-06', tasks: [{ id: 'keep', title: '保留任务', condition: 'manual' }], reason: '已有安排' }
    });
    store.refresh();
    const result = store.scheduleScienceRetest(),
      before = store.exportData();
    expect(result.day).toBe('2026-10-06');
    expect(store.scheduleScienceRetest()).toEqual(result);
    expect(store.exportData()).toBe(before);
    expect(store.state.plans.at(-1).tasks[0].title).toBe('保留任务');
    expect(store.state.attempts).toHaveLength(1);
    store.focus(result.questionKey, result.conversationId);
    expect(store.activeQuestion.parentQuestionKey).toBe(original);
    expect(store.scienceCanSubmit()).toBe(false);
    const early = store.exportData();
    expect(() => store.submit(correct(store.activeQuestion), true)).toThrow('复测日期');
    expect(store.exportData()).toBe(early);
    vi.setSystemTime('2026-10-06T09:00:00Z');
    store.refresh();
    expect(store.scienceCanSubmit()).toBe(true);
    store.submit(correct(store.activeQuestion), true, 'retest-answer');
    expect(store.state.attempts.at(-1)).toMatchObject({
      kind: 'review',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    });
    expect(
      store.state.plans
        .filter((p) => p.day === result.day)
        .at(-1)
        .tasks.at(-1).completedBy
    ).toBe('retest-answer');
  });
  it('明日日期绑定安排时区，UTC跨日与之后时区变化不提前放行', () => {
    const q = createScienceQuestion('q', 'c', force, 'parent@1', { day: '2026-10-06', timezone: 'Asia/Shanghai' });
    expect(q.scienceExercise.dueDay).toBe('2026-10-07');
    expect(scienceRetestReady(q, Date.parse('2026-10-06T15:59:59Z'))).toBe(false);
    expect(scienceRetestReady(q, Date.parse('2026-10-06T16:00:00Z'))).toBe(true);
  });
  it('科学明日复测在计划中可查看；停止后查看不恢复任务或完成', async () => {
    const store = setup();
    store.submit(correct(store.activeQuestion), true, 'a');
    const planned = store.scheduleScienceRetest();
    await store.send('停止当前任务');
    const w = mount(LearningOverview, {
      props: { view: 'plan', showNavigation: false, initialExpanded: true },
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true
        }
      }
    });
    expect(w.text()).toContain('科学复测 · 10/06');
    const button = w.findAll('button').find((b) => b.text() === '回到复测题');
    expect(button).toBeTruthy();
    await button.trigger('tap');
    expect(store.active.activeQuestionKey).toBe(planned.questionKey);
    expect(store.active.stopped).toBe(true);
    expect(store.state.attempts).toHaveLength(1);
    expect(store.state.plans.at(-1).tasks.at(-1).completedBy).toBeNull();
    w.unmount();
  });
  it('计划写入失败重试复用原复测题，不丢原答', () => {
    const store = setup();
    store.submit(correct(store.activeQuestion), true, 'a');
    const original = learningRepository.commit,
      spy = vi.spyOn(learningRepository, 'commit');
    let once = true;
    spy.mockImplementation((op) => {
      if (op.type === 'plan.set' && once) {
        once = false;
        throw new Error('synthetic-storage-failure');
      }
      return original(op);
    });
    expect(() => store.scheduleScienceRetest()).toThrow('synthetic-storage-failure');
    const count = store.state.questions.length;
    expect(store.scheduleScienceRetest()).toBeTruthy();
    expect(store.state.questions).toHaveLength(count);
    expect(store.state.attempts).toHaveLength(1);
  });
  it('迟到上下文、跨对话与停止均拒绝写入；重开保留原答和复测', async () => {
    const store = setup(),
      context = store.writingContext();
    store.submit(correct(store.activeQuestion), true, 'a');
    const planned = store.scheduleScienceRetest();
    await store.send('停止当前任务');
    const before = store.exportData();
    expect(() => store.startScience(context, distance)).toThrow('停止');
    expect(() => store.scheduleScienceRetest()).toThrow('停止');
    store.focus(planned.questionKey);
    expect(store.active.stopped).toBe(true);
    expect(() => store.submit('A', true)).toThrow('停止');
    setActivePinia(createPinia());
    const reopened = useConversationLearningStore();
    reopened.refresh();
    expect(reopened.state.attempts).toHaveLength(1);
    expect(reopened.state.questions).toHaveLength(2);
    const old = reopened.writingContext();
    reopened.start('另一对话');
    const after = reopened.exportData();
    expect(() => reopened.startScience(old, distance)).toThrow('切换');
    expect(() => reopened.focus(planned.questionKey, reopened.active.id)).toThrow('另一对话');
    expect(reopened.exportData()).toBe(after);
    expect(before).toContain('science-transfer-v1');
  });
  it('私人事件重放重建相同题目、原答与计划，不能导入伪答案', () => {
    const store = setup();
    store.submit(correct(store.activeQuestion), true, 'a');
    store.scheduleScienceRetest();
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(copy(event))).state;
    expect(replay.questions).toEqual(store.state.questions);
    expect(replay.attempts).toEqual(store.state.attempts);
    expect(replay.plans).toEqual(store.state.plans);
  });
  it('完成观察后才有独立入口，点击只发当前上下文和有界条件，停止不发', async () => {
    const wrapper = mount(LearningLab, {
      props: { state: current(), conversationId: 'c', context: 'current-context' },
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true
        }
      }
    });
    const button = (label) => wrapper.findAll('button').find((item) => item.text() === label);
    await button('互动学习').trigger('tap');
    expect(button('独立检验')).toBeUndefined();
    await button('我猜不同').trigger('tap');
    for (let i = 0; i < 24; i++) await button('下一步').trigger('tap');
    await button('独立检验').trigger('tap');
    expect(wrapper.emitted('science')).toEqual([['current-context', distance]]);
    await wrapper.setProps({ stopped: true });
    await button('独立检验').trigger('tap');
    expect(wrapper.emitted('science')).toHaveLength(1);
    wrapper.unmount();
  });
  it('预测前不显示加速度答案，开始观察后才显示比较值', async () => {
    const wrapper = mount(LearningLab, {
      props: { state: current(), conversationId: 'c', context: 'current-context' },
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true
        }
      }
    });
    const button = (label) => wrapper.findAll('button').find((item) => item.text() === label);
    await button('互动学习').trigger('tap');
    await button('合力与加速度').trigger('tap');
    expect(wrapper.text()).not.toContain('m/s²');
    await button('减半').trigger('tap');
    expect(wrapper.text()).not.toContain('m/s²');
    await button('下一步').trigger('tap');
    expect(wrapper.text()).toContain('加速度 2 m/s²向右');
    expect(wrapper.text()).toContain('加速度 1 m/s²向右');
    wrapper.unmount();
  });
});
