import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import NumberLine from '@/components/business/learning/number-line.vue';
import fixture from '../fixtures/learning/inequality-v1.json';
import {
  createAlgebraQuestion,
  createAlgebraVariant,
  algebraReferenceText,
  parseInequalityAnswer,
  INEQUALITY_CONTRACT
} from '../../laf-backend/functions/_shared/learning-algebra.js';
import {
  gradeAnswer,
  classifyResponse,
  normalizePrivateSyncOperation,
  applyLearningOperation,
  emptyLearningState,
  summarizeLearning,
  questionKey
} from '@/services/learning/learning-domain.js';
import { localTeaching } from '@/services/learning/learning-tools.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('独立一次不等式与区间固定集', () => {
  it.each(fixture.cases)('$id', (item) => {
    const q = createAlgebraQuestion(item.id, item.goal);
    expect(q).not.toBeNull();
    if (item.uncertainties) q.uncertainties = item.uncertainties;
    expect(gradeAnswer(q, item.answer)).toMatchObject({ status: item.status, outcome: item.outcome });
  });
  it('有界区间、负方向链和无限端点，语法歧义和资源攻击不执行', () => {
    expect(parseInequalityAnswer('3>x≥1')).toEqual(parseInequalityAnswer('[1,3)'));
    expect(parseInequalityAnswer('(3,3]')).toEqual([]);
    for (const value of [
      '[-∞,∞)',
      '(0,-∞)',
      '(+∞,3)',
      '3<x>4',
      'x<3∪x<4∪x<5∪x<6∪x<7',
      'x<' + '('.repeat(17) + '1' + ')'.repeat(17),
      'x<999999999^6',
      'x<' + '1'.repeat(513),
      'x<require("fs")'
    ])
      expect(() => parseInequalityAnswer(value)).toThrow();
  });
  it('不把讨论、引用或不明确集合强制判错；自然答案可自动绑定', () => {
    const q = createAlgebraQuestion('bind', '解不等式 x<3');
    for (const answer of ['x<3', '(-∞,3)', '3>x', '我的答案是(-∞,3)'])
      expect(classifyResponse(answer, q)).toBe('answer');
    for (const answer of ['是不是x<3？', '也许x<3', '题干是x<3'])
      expect(classifyResponse(answer, q)).toBe('discussion');
    for (const answer of ['大概在左边', '(-∞,3', 'x<sqrt(2)']) expect(classifyResponse(answer, q)).toBe('clarify');
  });
  it('新合同重建独立依据，不信任导入/模型答案，不绕过公共题源门禁', () => {
    const q = createAlgebraQuestion('proof', '解不等式 -2*x+6>0');
    q.validation.solution.intervals[0].upper = [999, 1];
    q.source = { kind: 'model_generated', reference: 'x<999' };
    const normalized = normalizePrivateSyncOperation({ id: 'proof', type: 'question.add', data: { question: q } });
    expect(normalized.data.question.validation.solution.intervals[0].upper).toEqual([3, 1]);
    expect(normalized.data.question.publishable).toBe(false);
    expect(gradeAnswer(q, 'x<999').outcome).toBe('wrong');
    expect(gradeAnswer(q, 'x<3').basis).toBe(INEQUALITY_CONTRACT);
    expect(createAlgebraQuestion('integer', '整数解不等式 x<3')).toBeNull();
    const modified = { ...q, prompt: q.prompt + '且x>0' };
    expect(gradeAnswer(modified, 'x<3').status).toBe('pending');
  });
  it('变式改变符号/表达方式，答案重新验证；层级提示不泄露原题阈值', () => {
    const parent = createAlgebraQuestion('parent', '解不等式 -2*x+6>0');
    const variant = createAlgebraVariant('variant', parent);
    expect(variant.parentQuestionKey).toBe('parent@1');
    expect(variant.variantChange).toContain('负数');
    expect(variant.prompt).not.toContain('答案');
    expect(gradeAnswer(variant, '(-∞,3)').outcome).toBe('correct');
    expect(algebraReferenceText(parent)).toBe('x<3');
    for (const level of [1, 2]) expect(localTeaching(parent, 'hint', level).content).not.toContain('x<3');
    expect(localTeaching(parent, 'hint', 3).content).toContain('x<3');
    expect(localTeaching(parent, 'check').helped).toBe(false);
    expect(localTeaching(parent, 'prerequisite').content).toContain('不能除以0');
    expect(createAlgebraVariant('none', createAlgebraQuestion('nonlinear', '解不等式 x^2<4'))).toBeNull();
  });
});
describe('对话、错题、计划、帮助和恢复的一次不等式闭环', () => {
  it('实际数轴区分开闭点、方向、全体和空集；不确定条件不渲染可靠解集', () => {
    for (const [goal, label, closed, direction] of [
      ['解不等式 x<3', '不包含', false, '←'],
      ['解不等式 3*x≥1', '包含', true, '→'],
      ['解不等式 0<2', '全部实数', false, '← 全部实数 →'],
      ['解不等式 0>2', '解集为空', false, null]
    ]) {
      const wrapper = mount(NumberLine, {
        props: { question: createAlgebraQuestion('diagram', goal) },
        global: { stubs: { view: { template: '<div><slot/></div>' }, text: { template: '<span><slot/></span>' } } }
      });
      expect(wrapper.find('[role="img"]').attributes('aria-label')).toContain(label);
      expect(wrapper.find('.boundary.closed').exists()).toBe(closed);
      if (direction) expect(wrapper.find('.movement').text()).toBe(direction);
      else expect(wrapper.find('.axis').exists()).toBe(false);
      wrapper.unmount();
    }
    const q = createAlgebraQuestion('uncertain', '解不等式 x<3');
    q.uncertainties = [{ resolved: false }];
    const wrapper = mount(NumberLine, { props: { question: q } });
    expect(wrapper.find('[role="img"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('无模型即可正式作答，提示修正和独立变式不重记原首答；刷新/恢复/同步共享事实', async () => {
    const store = useConversationLearningStore();
    store.start('解不等式 -2*x+6>0');
    const request = vi.spyOn(uni, 'request');
    try {
      await store.send('x>3', { id: 'first' });
      await store.send('x>3', { id: 'first' });
      expect(store.state.attempts).toHaveLength(1);
      expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
      expect(store.summary.mistakes).toHaveLength(1);
      await store.send('直接讲解', { id: 'explain' });
      await store.send('(-∞,3)', { id: 'revision' });
      expect(store.state.attempts[1]).toMatchObject({ kind: 'revision', grade: { outcome: 'correct' } });
      expect(store.state.attempts[1].hints).toHaveLength(1);
      const parent = questionKey(store.activeQuestion);
      store.generateVariant();
      expect(store.activeQuestion.parentQuestionKey).toBe(parent);
      await store.send('3>x', { id: 'variant-answer' });
      expect(store.state.attempts[2]).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
      expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
      expect(store.summary.tasks).toMatchObject({ numerator: 2, denominator: 2 });
      expect(store.summary.knowledge['数学 / 一次不等式与解集'].status).toBe('待复测');
      expect(request).not.toHaveBeenCalled();
      setActivePinia(createPinia());
      const reopened = useConversationLearningStore();
      expect(reopened.state.attempts).toHaveLength(3);
      const restored = prepareLearningRestore(
        emptyLearningState('guest', store.state.timezone),
        store.exportData()
      ).state;
      expect(summarizeLearning(restored).first).toEqual(store.summary.first);
      let replay = emptyLearningState('guest', store.state.timezone);
      for (const event of store.state.events)
        replay = applyLearningOperation(
          replay,
          normalizePrivateSyncOperation({ id: event.id, type: event.type, at: event.at, data: event.data })
        ).state;
      expect(summarizeLearning(replay).tasks).toEqual(store.summary.tasks);
      store.correctAssessment(store.state.attempts[0].id, '原作答有争议');
      expect(store.summary.first.denominator).toBe(0);
      expect(store.summary.mistakes).toHaveLength(0);
    } finally {
      request.mockRestore();
    }
  });
  it('识别未校对/一般有理式仅保留尝试，不制造可靠错题或独立掌握', async () => {
    const store = useConversationLearningStore();
    store.start('解不等式 1/x>0');
    await store.send('x>0', { id: 'unverified' });
    expect(store.state.attempts[0].grade.status).toBe('pending');
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.mistakes).toHaveLength(0);
    expect(store.summary.knowledge['数学 / 一次不等式与解集']).toBeUndefined();
  });
});
