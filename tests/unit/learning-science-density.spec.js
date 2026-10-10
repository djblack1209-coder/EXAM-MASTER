import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import {
  densityInput,
  densityResult,
  densityChoices,
  nextDensityInput,
  DENSITY_TEMPLATE
} from '../../laf-backend/functions/_shared/learning-density.js';
import {
  createScienceQuestion,
  scienceRetestReady,
  DENSITY_TRANSFER_CONTRACT
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
import { conversationStrategy } from '../../laf-backend/functions/_shared/learning-strategy.js';
import { visualRecipe } from '../../laf-backend/functions/_shared/learning-visual.js';
import DensityPractice from '@/components/business/learning/density-practice.vue';
const base = { template: DENSITY_TEMPLATE, target: 'density', massG: 120, volumeCm3: 50 };
const clone = (value) => JSON.parse(JSON.stringify(value));
const at = Date.parse('2026-10-07T18:00:00Z');
const stubs = { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' } };
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text() === label);
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
  const s = useConversationLearningStore();
  s.start('密度、质量与体积', { track: 'junior', stage: '八年级', edition: '' });
  return s;
}
const current = () =>
  applyLearningOperation(emptyLearningState('density-owner', 'America/Los_Angeles'), {
    id: 'c',
    type: 'conversation.start',
    at,
    data: { goal: '密度、质量与体积' }
  }).state;

describe('密度确定量关系与选项边界', () => {
  it.each([
    [base, [12, 5], 'g/cm³'],
    [{ template: DENSITY_TEMPLATE, target: 'mass', densityGcm3: 2.4, volumeCm3: 50 }, [120, 1], 'g'],
    [{ template: DENSITY_TEMPLATE, target: 'volume', massG: 120, densityGcm3: 2.4 }, [50, 1], 'cm³'],
    [{ ...base, target: 'density_si' }, [2400, 1], 'kg/m³'],
    [{ ...base, massG: 1, volumeCm3: 3 }, [1, 3], 'g/cm³'],
    [{ template: DENSITY_TEMPLATE, target: 'mass', densityGcm3: 0.03, volumeCm3: 0.07 }, [21, 10000], 'g'],
    [{ template: DENSITY_TEMPLATE, target: 'volume', massG: 0.29, densityGcm3: 0.1 }, [29, 10], 'cm³']
  ])('手算确定值、单位与保守选项判分 %j', (input, exact, unit) => {
    expect(densityResult(input)).toEqual({ exact, unit });
    const q = createScienceQuestion('q', 'c', input);
    expect(q.scienceExercise.contract).toBe(DENSITY_TRANSFER_CONTRACT);
    expect(new Set(q.options.map((v) => v.slice(3))).size).toBe(4);
    expect(gradeAnswer(q, q.validation.answer)).toMatchObject({
      status: 'reliable',
      outcome: 'correct',
      evaluator: 'deterministic-science-v5'
    });
    expect(gradeAnswer(q, 'ABCD'[('ABCD'.indexOf(q.validation.answer) + 1) % 4]).outcome).toBe('wrong');
    for (const answer of ['A或B', '材料一定是铁', '2.4g/cm³', '我大概会了'])
      expect(gradeAnswer(q, answer).status).toBe('pending');
  });
  it('独立BigInt有理数核对四任务180组边界，单位换算不靠浮点近似', () => {
    const frac = (n, d) => {
      let a = n < 0n ? -n : n,
        b = d;
      while (b) [a, b] = [b, a % b];
      return [n / a, d / a];
    };
    const num = (value) => {
      const [whole, decimal = ''] = String(value).split('.');
      return frac(BigInt(whole + decimal), 10n ** BigInt(decimal.length));
    };
    let count = 0;
    for (const target of ['density', 'density_si', 'mass', 'volume'])
      for (const a of [0.01, 0.29, 1.33, 9.99, 100])
        for (const b of [0.01, 0.07, 0.5, 1, 3, 19.99, 50, 99.99, 100]) {
          const raw =
            target === 'mass'
              ? { template: DENSITY_TEMPLATE, target, densityGcm3: a, volumeCm3: b }
              : target === 'volume'
                ? { template: DENSITY_TEMPLATE, target, massG: a, densityGcm3: b }
                : { template: DENSITY_TEMPLATE, target, massG: a, volumeCm3: b };
          const x = num(a),
            y = num(b);
          let expected = target === 'mass' ? frac(x[0] * y[0], x[1] * y[1]) : frac(x[0] * y[1], x[1] * y[0]);
          if (target === 'density_si') expected = frac(expected[0] * 1000n, expected[1]);
          expect(densityResult(raw).exact.map(BigInt)).toEqual(expected);
          expect(densityChoices(raw).options).toHaveLength(4);
          expect(nextDensityInput(raw)).not.toEqual(raw);
          count++;
        }
    expect(count).toBe(180);
  });
  it.each([
    { massG: 0 },
    { massG: -1 },
    { massG: 0.005 },
    { massG: 10000.01 },
    { massG: '120' },
    { massG: NaN },
    { massG: Infinity },
    { volumeCm3: 0 },
    { volumeCm3: 0.0001 },
    { volumeCm3: 10001 },
    { volumeCm3: 1.001 },
    { target: 'identify_material' },
    { template: 'exec()' },
    { url: 'http://127.0.0.1' },
    { massKg: 0.12 },
    { code: 'exec()' }
  ])('拒绝未知字段、单位混入或越界 %j', (patch) => expect(() => densityInput({ ...base, ...patch })).toThrow());
  it('计算本身不依赖后端或可视化能力，不扩大模型演示白名单', () => {
    expect(() => visualRecipe(base)).toThrow();
    expect(() =>
      densityInput({ template: DENSITY_TEMPLATE, target: 'mass', densityGcm3: 100.01, volumeCm3: 10 })
    ).toThrow();
    expect(() => densityInput({ template: DENSITY_TEMPLATE, target: 'volume', massG: 10 })).toThrow();
    const input = densityInput(base);
    input.massG = 1;
    expect(densityInput(base).massG).toBe(120);
  });
  it('连续四类任务改变条件，正确字母不固定，原条件没有被修改', () => {
    let input = clone(base);
    const kinds = new Set(),
      letters = new Set();
    for (let i = 0; i < 40; i++) {
      kinds.add(input.target);
      letters.add(densityChoices(input).answer);
      const next = nextDensityInput(input);
      expect(next.target).not.toBe(input.target);
      input = next;
    }
    expect(kinds.size).toBe(4);
    expect(letters.size).toBe(4);
    expect(base.massG).toBe(120);
  });
  it.each(['prompt', 'options', 'source', 'contract', 'extra', 'conversation', 'phase', 'condition', 'strip'])(
    '规范题整项拒绝伪造：%s',
    (field) => {
      const s = current(),
        before = clone(s),
        q = createScienceQuestion('q', 'c', base);
      if (field === 'prompt') q.prompt = '官方满分';
      if (field === 'options') q.options[0] = 'A. 已掌握';
      if (field === 'source') q.source.kind = 'official';
      if (field === 'contract') q.scienceExercise.contract = 'future';
      if (field === 'extra') q.scienceExercise.code = 'exec()';
      if (field === 'conversation') q.scienceExercise.conversationId = 'other';
      if (field === 'phase') q.scienceExercise.phase = 'mastered';
      if (field === 'condition') q.scienceExercise.input.massG = 0;
      if (field === 'strip') delete q.scienceExercise;
      expect(() =>
        applyLearningOperation(s, { id: 'bad-' + field, type: 'question.add', at, data: { question: q } })
      ).toThrow();
      expect(s).toEqual(before);
    }
  );
  it('宿主重建答案依据，不采纳客户端伪造正确字母', () => {
    const q = createScienceQuestion('q', 'c', base),
      answer = q.validation.answer;
    q.validation.answer = 'ABCD'[('ABCD'.indexOf(answer) + 1) % 4];
    const saved = applyLearningOperation(current(), { id: 'add', type: 'question.add', at, data: { question: q } })
      .state.questions[0];
    expect(saved.validation.answer).toBe(answer);
    expect(gradeAnswer(saved, answer).outcome).toBe('correct');
  });
});
describe('密度作答、帮助、独立与原时区复测', () => {
  it('主题明确开始才生成一题；普通发送只澄清，明确提交后事实可私人重放', () => {
    expect(LEARNING_START_TOPICS).toContain('密度、质量与体积');
    const s = setup();
    expect(s.state.attempts).toEqual([]);
    const questions = clone(s.state.questions),
      plans = clone(s.state.plans);
    expect(s.submit(s.activeQuestion.validation.answer, false, 'not-explicit').clarification).toBe(true);
    expect(s.state.attempts).toEqual([]);
    expect(s.state.questions).toEqual(questions);
    expect(s.state.plans).toEqual(plans);
    expect(s.summary.first.denominator).toBe(0);
    s.submit(s.activeQuestion.validation.answer, true, 'density-answer');
    expect(s.state.attempts.at(-1).grade.outcome).toBe('correct');
    let replay = emptyLearningState(s.state.owner, s.state.timezone);
    for (const event of s.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(clone(event))).state;
    expect(replay.attempts).toEqual(clone(s.state.attempts));
    expect(replay.questions).toEqual(clone(s.state.questions));
  });
  it('帮助归属与幂等，独立条件撤去帮助并保留原答和指定教法', () => {
    const s = setup();
    s.commit('strategy.set', {
      conversationId: s.active.id,
      method: 'steps',
      source: 'self_report',
      reason: '用户选择逐步'
    });
    const original = clone(s.activeQuestion),
      context = s.writingContext();
    s.recordScienceHelp(context, original.scienceExercise.input);
    const once = s.exportData();
    s.recordScienceHelp(context, original.scienceExercise.input);
    expect(s.exportData()).toBe(once);
    expect(s.active.pendingHints[0].questionKey).toBe(questionKey(original));
    s.submit(original.validation.answer, true, 'helped');
    const attempts = clone(s.state.attempts);
    s.startScience(s.writingContext(), original.scienceExercise.input);
    expect(s.activeQuestion.scienceExercise.input).toEqual(nextDensityInput(base));
    expect(s.active.pendingHints).toEqual([]);
    expect(s.state.attempts).toEqual(attempts);
    expect(conversationStrategy(s.state, s.active.id).method).toBe('steps');
    const stale = s.exportData();
    expect(() => s.recordScienceHelp(context, base)).toThrow();
    expect(s.exportData()).toBe(stale);
  });
  it('原时区次日计划幂等，提前不提交，不由后来时区变化提前放行', () => {
    const s = setup();
    s.commit('timezone.set', { timezone: 'Asia/Shanghai' });
    s.submit(s.activeQuestion.validation.answer, true, 'original');
    const result = s.scheduleScienceRetest(),
      planned = s.exportData();
    expect(s.scheduleScienceRetest()).toEqual(result);
    expect(s.exportData()).toBe(planned);
    const q = s.state.questions.find((q) => questionKey(q) === result.questionKey);
    expect(q.scienceExercise.plannedTimezone).toBe('Asia/Shanghai');
    s.focus(result.questionKey);
    s.commit('timezone.set', { timezone: 'Pacific/Kiritimati' });
    const before = s.exportData();
    expect(() => s.submit(q.validation.answer, true, 'early')).toThrow();
    expect(s.exportData()).toBe(before);
    const midnight = Date.parse(q.scienceExercise.dueDay + 'T00:00:00+08:00');
    expect(scienceRetestReady(q, midnight - 1)).toBe(false);
    expect(scienceRetestReady(q, midnight)).toBe(true);
    vi.setSystemTime(midnight);
    s.submit(q.validation.answer, true, 'due');
    expect(
      s.state.plans
        .filter((p) => p.day === result.day)
        .at(-1)
        .tasks.at(-1).completedBy
    ).toBe('due');
  });
  it('停止后新帮助/独立/复测/提交拒绝，旧事件重放幂等', () => {
    const s = setup();
    s.submit(s.activeQuestion.validation.answer, true, 'original');
    const event = clone(s.state.events.at(-1));
    s.commit('task.stop', { conversationId: s.active.id });
    const stopped = s.exportData();
    for (const action of [
      () => s.recordScienceHelp(s.writingContext(), base),
      () => s.startScience(s.writingContext(), base),
      () => s.scheduleScienceRetest(),
      () => s.submit('A', true, 'late')
    ])
      expect(action).toThrow();
    expect(s.exportData()).toBe(stopped);
    expect(applyLearningOperation(clone(s.state), event).state).toEqual(clone(s.state));
  });
});
describe('最小密度入口与功能隔离', () => {
  it.each(['id', 'version'])('仅题目标识或版本变化也撤去旧方法：%s', async (key) => {
    const s = setup(),
      w = mount(DensityPractice, {
        props: {
          question: s.activeQuestion,
          context: s.writingContext(),
          recordHelp: (ctx, input) => s.recordScienceHelp(ctx, input)
        },
        global: { stubs }
      });
    try {
      await button(w, '看计算方法').trigger('tap');
      expect(w.find('.density-method').exists()).toBe(true);
      const changed = clone(s.activeQuestion),
        saved = s.exportData();
      changed[key] = key === 'id' ? `${changed.id}-other` : changed.version + 1;
      await w.setProps({ question: changed });
      expect(w.find('.density-method').exists()).toBe(false);
      expect(s.exportData()).toBe(saved);
    } finally {
      w.unmount();
    }
  });
  it('帮助保存后的等值题目刷新不清展示，真正条件变化才撤去旧方法', async () => {
    const s = setup(),
      w = mount(DensityPractice, {
        props: {
          question: s.activeQuestion,
          context: s.writingContext(),
          recordHelp: (ctx, input) => s.recordScienceHelp(ctx, input)
        },
        global: { stubs }
      });
    try {
      await button(w, '看计算方法').trigger('tap');
      expect(w.find('.density-method').exists()).toBe(true);
      expect(s.active.pendingHints).toHaveLength(1);
      const saved = s.exportData();
      await w.setProps({ question: clone(s.activeQuestion) });
      expect(w.find('.density-method').exists()).toBe(true);
      expect(s.exportData()).toBe(saved);
      const changed = createScienceQuestion(s.activeQuestion.id, s.active.id, nextDensityInput(base));
      await w.setProps({ question: changed });
      expect(w.find('.density-method').exists()).toBe(false);
      expect(s.exportData()).toBe(saved);
    } finally {
      w.unmount();
    }
  });
  it('方法保存成功后才展示；保存失败提供恢复，独立动作绑定本题', async () => {
    const s = setup(),
      save = vi.fn(() => false),
      w = mount(DensityPractice, {
        props: { question: s.activeQuestion, context: s.writingContext(), recordHelp: save },
        global: { stubs }
      });
    try {
      expect(w.find('.density-method').exists()).toBe(false);
      await button(w, '看计算方法').trigger('tap');
      expect(w.text()).toContain('方法未保存');
      expect(w.find('.density-method').exists()).toBe(false);
      save.mockImplementation((ctx, input) => s.recordScienceHelp(ctx, input));
      await button(w, '看计算方法').trigger('tap');
      expect(w.text()).toContain('密度＝质量÷体积');
      expect(s.active.pendingHints).toHaveLength(1);
      await button(w, '换条件独立作答').trigger('tap');
      expect(w.emitted('science')[0]).toEqual([s.writingContext(), base]);
      await w.setProps({ context: 'other-context' });
      expect(w.find('.density-method').exists()).toBe(false);
    } finally {
      w.unmount();
    }
  });
  it.each([
    { stopped: true },
    { busy: true },
    { visible: false },
    { question: { scienceExercise: { contract: 'future', input: base } } }
  ])('停止/忙碌/隐藏/未知题目不写帮助或发起独立：%j', async (patch) => {
    const s = setup(),
      save = vi.fn(() => true),
      w = mount(DensityPractice, {
        props: { question: s.activeQuestion, context: s.writingContext(), recordHelp: save, ...patch },
        global: { stubs }
      });
    try {
      for (const label of ['看计算方法', '换条件独立作答']) {
        const b = button(w, label);
        if (b) await b.trigger('tap');
      }
      expect(save).not.toHaveBeenCalled();
      expect(w.emitted('science')).toBeUndefined();
    } finally {
      w.unmount();
    }
  });
});
