import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import {
  pressureInput,
  pressureResult,
  pressureChoices,
  nextPressureInput,
  PRESSURE_TEMPLATE,
  PRESSURE_BASIS
} from '../../laf-backend/functions/_shared/learning-pressure.js';
import {
  createScienceQuestion,
  scienceRetestReady,
  PRESSURE_TRANSFER_CONTRACT
} from '../../laf-backend/functions/_shared/learning-science.js';
import {
  applyLearningOperation,
  emptyLearningState,
  gradeAnswer,
  questionKey,
  normalizePrivateSyncOperation,
  LEARNING_START_TOPICS
} from '@/services/learning/learning-domain.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { visualRecipe } from '../../laf-backend/functions/_shared/learning-visual.js';
import CalculationPractice from '@/components/business/learning/density-practice.vue';
const base = { template: PRESSURE_TEMPLATE, target: 'pressure', uniformContact: true, normalForceN: 72, areaCm2: 24 };
const raw = (target, quantities) => ({ template: PRESSURE_TEMPLATE, target, uniformContact: true, ...quantities });
const clone = (value) => JSON.parse(JSON.stringify(value));
const at = Date.parse('2026-10-07T18:00:00Z');
const stubs = { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' } };
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
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
function setup() {
  const store = useConversationLearningStore();
  store.start('压强、压力与接触面积', { track: 'junior', stage: '八年级', edition: '' });
  return store;
}
const current = () =>
  applyLearningOperation(emptyLearningState('pressure-owner', 'America/Los_Angeles'), {
    id: 'c',
    type: 'conversation.start',
    at,
    data: { goal: '压强、压力与接触面积' }
  }).state;

describe('垂直均匀接触的压强与单位', () => {
  it.each([
    [base, [30000, 1], 'Pa'],
    [raw('force', { pressurePa: 30000, areaCm2: 24 }), [72, 1], 'N'],
    [raw('area', { normalForceN: 72, pressurePa: 30000 }), [24, 1], 'cm²'],
    [{ ...base, target: 'pressure_kpa' }, [30, 1], 'kPa'],
    [{ ...base, normalForceN: 1, areaCm2: 3 }, [10000, 3], 'Pa'],
    [raw('force', { pressurePa: 0.13, areaCm2: 0.17 }), [221, 100000000], 'N'],
    [raw('force', { pressurePa: 999999.99, areaCm2: 9999.99 }), [99999899000001, 100000000], 'N']
  ])('手算与精确分数 %j', (input, exact, unit) => {
    expect(pressureResult(input)).toEqual({ exact, unit });
    const q = createScienceQuestion('q', 'c', input);
    expect(q.scienceExercise.contract).toBe(PRESSURE_TRANSFER_CONTRACT);
    expect(q.prompt).toContain('压力垂直接触面且压强均匀');
    expect(new Set(q.options.map((o) => o.slice(3))).size).toBe(4);
    expect(gradeAnswer(q, q.validation.answer)).toMatchObject({
      status: 'reliable',
      outcome: 'correct',
      evaluator: 'deterministic-science-v6'
    });
    expect(gradeAnswer(q, 'ABCD'[('ABCD'.indexOf(q.validation.answer) + 1) % 4]).outcome).toBe('wrong');
    for (const text of ['30000Pa', '30kPa', '压力就是质量', 'A或B', '整体物理已经掌握'])
      expect(gradeAnswer(q, text).status).toBe('pending');
  });
  it('四任务196组独立BigInt参考核对，平方面积换算和大分子不丢精度', () => {
    const reduce = (n, d) => {
      let a = n,
        b = d;
      while (b) [a, b] = [b, a % b];
      return [n / a, d / a];
    };
    const decimal = (value) => {
      const [w, f = ''] = String(value).split('.');
      return [BigInt(w + f), 10n ** BigInt(f.length)];
    };
    let count = 0;
    for (const target of ['pressure', 'pressure_kpa', 'force', 'area']) {
      const lefts =
        target === 'force'
          ? [0.01, 0.13, 1.21, 30000, 13001.33, 999999.99, 1000000]
          : [0.01, 0.17, 1.21, 72, 9999.99, 10, 10000];
      const rights =
        target === 'area'
          ? [0.01, 0.13, 1.21, 30000, 13001.33, 999999.99, 1000000]
          : [0.01, 0.17, 1.21, 24, 9999.99, 10, 10000];
      for (const a of lefts)
        for (const b of rights) {
          const input = raw(
            target,
            target === 'force'
              ? { pressurePa: a, areaCm2: b }
              : target === 'area'
                ? { normalForceN: a, pressurePa: b }
                : { normalForceN: a, areaCm2: b }
          );
          const x = decimal(a),
            y = decimal(b);
          const expected =
            target === 'force'
              ? reduce(x[0] * y[0], x[1] * y[1] * 10000n)
              : reduce(x[0] * y[1] * (target === 'pressure_kpa' ? 10n : 10000n), x[1] * y[0]);
          expect(pressureResult(input).exact.map(BigInt)).toEqual(expected);
          expect(new Set(pressureChoices(input).options).size).toBe(4);
          count++;
        }
    }
    expect(count).toBe(196);
  });
  it.each([
    { normalForceN: 0 },
    { normalForceN: -1 },
    { normalForceN: 0.005 },
    { normalForceN: 10000.01 },
    { normalForceN: '72' },
    { normalForceN: NaN },
    { normalForceN: Infinity },
    { areaCm2: 0 },
    { areaCm2: 10001 },
    { areaCm2: 1.001 },
    { uniformContact: false },
    { uniformContact: 'true' },
    { target: 'hydrostatic' },
    { template: 'exec()' },
    { massKg: 7.2 },
    { forceAngle: 30 },
    { url: 'http://127.0.0.1' }
  ])('条件、范围与量纲未知时拒绝 %j', (patch) => expect(() => pressureInput({ ...base, ...patch })).toThrow());
  it('不补缺失条件、不扩模型演示工具，也不复制教材或取得评分身份', () => {
    const missing = clone(base);
    delete missing.uniformContact;
    expect(() => pressureInput(missing)).toThrow();
    expect(() => pressureInput(raw('force', { pressurePa: 1000000.01, areaCm2: 10 }))).toThrow();
    expect(() => pressureInput(raw('area', { normalForceN: 10 }))).toThrow();
    expect(() => visualRecipe(base)).toThrow();
    expect(PRESSURE_BASIS).toMatchObject({
      purpose: 'si_unit_reference',
      copiedTextOrMedia: false,
      scoringAuthority: false
    });
  });
  it('独立题循环四任务、改变条件和答案位置，原输入保持', () => {
    let input = clone(base);
    const targets = new Set(),
      answers = new Set();
    for (let i = 0; i < 40; i++) {
      targets.add(input.target);
      answers.add(pressureChoices(input).answer);
      const next = nextPressureInput(input);
      expect(next.target).not.toBe(input.target);
      input = next;
    }
    expect(targets.size).toBe(4);
    expect(answers.size).toBe(4);
    expect(base.normalForceN).toBe(72);
  });
  it.each(['prompt', 'options', 'source', 'contract', 'extra', 'conversation', 'phase', 'condition', 'strip'])(
    '规范题拒绝整项伪造：%s',
    (field) => {
      const state = current(),
        before = clone(state),
        q = createScienceQuestion('q', 'c', base);
      if (field === 'prompt') q.prompt = '官方满分';
      if (field === 'options') q.options[0] = 'A. 全部掌握';
      if (field === 'source') q.source.kind = 'official';
      if (field === 'contract') q.scienceExercise.contract = 'future';
      if (field === 'extra') q.scienceExercise.code = 'exec()';
      if (field === 'conversation') q.scienceExercise.conversationId = 'other';
      if (field === 'phase') q.scienceExercise.phase = 'mastered';
      if (field === 'condition') q.scienceExercise.input.uniformContact = false;
      if (field === 'strip') delete q.scienceExercise;
      expect(() =>
        applyLearningOperation(state, { id: 'bad-' + field, type: 'question.add', at, data: { question: q } })
      ).toThrow();
      expect(state).toEqual(before);
    }
  );
  it('宿主重建正确字母；跨模板原题不能冒充本题独立来源', () => {
    const state = current(),
      q = createScienceQuestion('q', 'c', base),
      answer = q.validation.answer;
    q.validation.answer = 'ABCD'[('ABCD'.indexOf(answer) + 1) % 4];
    const next = applyLearningOperation(state, { id: 'add', type: 'question.add', at, data: { question: q } }).state;
    expect(next.questions[0].validation.answer).toBe(answer);
    const wrongChild = createScienceQuestion(
      'child',
      'c',
      { template: 'mass_density', target: 'mass', densityGcm3: 2.4, volumeCm3: 50 },
      'q@1'
    );
    expect(() =>
      applyLearningOperation(next, { id: 'cross', type: 'question.add', at, data: { question: wrongChild } })
    ).toThrow();
  });
});

describe('压强事实、独立与原时区复测', () => {
  it('同一上下文也拒绝异题条件或异模板帮助，失败不写事实', () => {
    const s = setup(),
      before = s.exportData();
    for (const input of [
      { ...base, normalForceN: 73 },
      nextPressureInput(base),
      { template: 'mass_density', target: 'density', massG: 120, volumeCm3: 50 }
    ]) {
      expect(() => s.recordScienceHelp(s.writingContext(), input)).toThrow();
      expect(s.exportData()).toBe(before);
    }
    s.recordScienceHelp(s.writingContext(), base);
    expect(s.active.pendingHints).toHaveLength(1);
  });

  it('明确开始/提交才写作答，私人重放保留规范题和原答', () => {
    expect(LEARNING_START_TOPICS).toContain('压强、压力与接触面积');
    const s = setup(),
      q = clone(s.activeQuestion),
      plans = clone(s.state.plans);
    expect(s.state.attempts).toEqual([]);
    expect(s.submit(q.validation.answer, false, 'draft').clarification).toBe(true);
    expect(s.state.attempts).toEqual([]);
    expect(s.state.plans).toEqual(plans);
    s.submit(q.validation.answer, true, 'answer');
    expect(s.state.attempts.at(-1).grade).toMatchObject({ outcome: 'correct', evaluator: 'deterministic-science-v6' });
    let replay = emptyLearningState(s.state.owner, s.state.timezone);
    for (const event of s.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(clone(event))).state;
    expect(replay.attempts).toEqual(clone(s.state.attempts));
    expect(replay.questions).toEqual(clone(s.state.questions));
  });
  it('本题帮助幂等，独立撤帮助、保留指定教法，旧上下文不能写新题', () => {
    const s = setup();
    s.commit('strategy.set', {
      conversationId: s.active.id,
      method: 'steps',
      source: 'self_report',
      reason: '用户选择逐步'
    });
    const original = clone(s.activeQuestion),
      context = s.writingContext();
    s.recordScienceHelp(context, base);
    const once = s.exportData();
    s.recordScienceHelp(context, base);
    expect(s.exportData()).toBe(once);
    expect(s.active.pendingHints[0].questionKey).toBe(questionKey(original));
    s.submit(original.validation.answer, true, 'helped');
    const attempts = clone(s.state.attempts);
    s.startScience(s.writingContext(), base);
    expect(s.activeQuestion.scienceExercise.input).toEqual(nextPressureInput(base));
    expect(s.active.pendingHints).toEqual([]);
    expect(s.state.attempts).toEqual(attempts);
    expect(s.activeStrategy.method).toBe('steps');
    const untouched = s.exportData();
    expect(() => s.recordScienceHelp(context, base)).toThrow();
    expect(s.exportData()).toBe(untouched);
  });
  it('次日保留安排时区，后来时区不能提前放行，到期真实运行提交断言', () => {
    const s = setup();
    s.commit('timezone.set', { timezone: 'America/Los_Angeles' });
    s.submit(s.activeQuestion.validation.answer, true, 'original');
    const planned = s.scheduleScienceRetest(),
      once = s.exportData();
    expect(s.scheduleScienceRetest()).toEqual(planned);
    expect(s.exportData()).toBe(once);
    const q = s.state.questions.find((q) => questionKey(q) === planned.questionKey);
    s.focus(planned.questionKey);
    s.commit('timezone.set', { timezone: 'Pacific/Kiritimati' });
    const before = s.exportData();
    expect(() => s.submit(q.validation.answer, true, 'early')).toThrow();
    expect(s.exportData()).toBe(before);
    const midnight = Date.parse(q.scienceExercise.dueDay + 'T00:00:00-07:00');
    expect(scienceRetestReady(q, midnight - 1)).toBe(false);
    expect(scienceRetestReady(q, midnight)).toBe(true);
    vi.setSystemTime(midnight);
    s.submit(q.validation.answer, true, 'due');
    expect(s.state.attempts.at(-1).grade.outcome).toBe('correct');
    expect(
      s.state.plans
        .filter((p) => p.day === planned.day)
        .at(-1)
        .tasks.at(-1).completedBy
    ).toBe('due');
  });
  it('停止后新帮助/独立/计划/提交拒绝，旧事实幂等', () => {
    const s = setup();
    s.submit(s.activeQuestion.validation.answer, true, 'original');
    const old = clone(s.state.events.at(-1));
    s.commit('task.stop', { conversationId: s.active.id });
    const stopped = s.exportData();
    for (const act of [
      () => s.recordScienceHelp(s.writingContext(), base),
      () => s.startScience(s.writingContext(), base),
      () => s.scheduleScienceRetest(),
      () => s.submit('A', true, 'late')
    ])
      expect(act).toThrow();
    expect(s.exportData()).toBe(stopped);
    expect(applyLearningOperation(clone(s.state), old).state).toEqual(clone(s.state));
  });
});

describe('压强复用计算面板', () => {
  it('保存成功才显示，等值题目刷新保留；切题/停止撤去方法并禁用操作', async () => {
    const s = setup(),
      w = mount(CalculationPractice, {
        props: {
          question: s.activeQuestion,
          context: s.writingContext(),
          recordHelp: (ctx, input) => s.recordScienceHelp(ctx, input)
        },
        global: { stubs }
      });
    try {
      await button(w, '看计算方法').trigger('tap');
      expect(w.text()).toContain('垂直压力÷面积');
      expect(w.text()).toContain('单位出处 · NIST');
      expect(w.find('a').attributes('href')).toBe(PRESSURE_BASIS.url);
      await w.setProps({ question: clone(s.activeQuestion) });
      expect(w.find('.density-method').exists()).toBe(true);
      await button(w, '换条件独立作答').trigger('tap');
      expect(w.emitted('science')[0]).toEqual([s.writingContext(), base]);
      await w.setProps({ stopped: true });
      expect(w.find('.density-method').exists()).toBe(false);
      const saved = s.exportData();
      for (const label of ['看计算方法', '换条件独立作答']) {
        expect(button(w, label).attributes('aria-disabled')).toBe('true');
        expect(button(w, label).attributes('tabindex')).toBe('-1');
        await button(w, label).trigger('tap');
      }
      expect(s.exportData()).toBe(saved);
      expect(w.emitted('science')).toHaveLength(1);
    } finally {
      w.unmount();
    }
  });
  it('缺物理条件不展示帮助或触发独立动作，失败提供短恢复', async () => {
    const s = setup(),
      save = vi.fn(() => false),
      w = mount(CalculationPractice, {
        props: { question: s.activeQuestion, context: s.writingContext(), recordHelp: save },
        global: { stubs }
      });
    try {
      await button(w, '看计算方法').trigger('tap');
      expect(w.text()).toContain('方法未保存');
      expect(w.find('.density-method').exists()).toBe(false);
      const invalid = clone(s.activeQuestion);
      delete invalid.scienceExercise.input.uniformContact;
      await w.setProps({ question: invalid });
      save.mockClear();
      await button(w, '看计算方法').trigger('tap');
      await button(w, '换条件独立作答').trigger('tap');
      expect(save).not.toHaveBeenCalled();
      expect(w.emitted('science')).toBeUndefined();
    } finally {
      w.unmount();
    }
  });
});
