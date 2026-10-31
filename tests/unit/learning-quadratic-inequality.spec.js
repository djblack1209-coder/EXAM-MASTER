import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import NumberLine from '@/components/business/learning/number-line.vue';
import fixture from '../fixtures/learning/quadratic-inequality-v1.json';
import {
  createAlgebraQuestion,
  createAlgebraVariant,
  algebraReferenceText,
  inequalityDiagram,
  INEQUALITY_CONTRACT,
  QUADRATIC_INEQUALITY_CONTRACT
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
import { createPrerequisiteQuestion } from '../../laf-backend/functions/_shared/learning-prerequisite.js';
import { localTeaching } from '@/services/learning/learning-tools.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('有界二次不等式的独立固定期望', () => {
  it.each(fixture.cases)('$id', (item) => {
    const question = createAlgebraQuestion(item.id, item.goal);
    expect(question).not.toBeNull();
    if (item.uncertainties) question.uncertainties = item.uncertainties;
    expect(gradeAnswer(question, item.answer)).toMatchObject({ status: item.status, outcome: item.outcome });
    if (item.reference) expect(algebraReferenceText(question)).toBe(item.reference);
  });
  it('完整原式重算依据；模型、导入和额外条件不能伪造解集', () => {
    const question = createAlgebraQuestion('proof', '解二次不等式 x^2-4<0');
    question.validation.solution.intervals = [];
    question.source = { kind: 'model_generated', reference: '无解' };
    const operation = { id: 'proof', type: 'question.add', data: { question } };
    const normalized = normalizePrivateSyncOperation(operation).data.question;
    expect(normalized.validation.solution.intervals).toEqual([
      { lower: [-2, 1], upper: [2, 1], lowerClosed: false, upperClosed: false }
    ]);
    expect(normalized.algebra.contract).toBe(QUADRATIC_INEQUALITY_CONTRACT);
    expect(normalized.publishable).toBe(false);
    expect(gradeAnswer(question, '(-2,2)').basis).toBe(QUADRATIC_INEQUALITY_CONTRACT);
    expect(gradeAnswer({ ...question, prompt: question.prompt + '且x>0' }, '(-2,2)').status).toBe('pending');
    expect(createAlgebraQuestion('integer', '整数解二次不等式 x^2-4<0')).toBeNull();
    expect(gradeAnswer({ ...question, options: ['无解'] }, '(-2,2)').status).toBe('pending');
  });
  it('旧一次式与原二次待核对题重放保持合同、状态与幂等内容', () => {
    for (const [goal, status] of [
      ['解不等式 -2*x+6>0', 'verified'],
      ['解不等式 x^2-4<0', 'pending']
    ]) {
      const question = createAlgebraQuestion('legacy', goal);
      expect(question.algebra).toEqual({
        contract: INEQUALITY_CONTRACT,
        task: 'inequality',
        domain: 'real',
        status,
        reason: status === 'pending' ? 'unsupported_nonlinear_inequality' : null
      });
      const operation = normalizePrivateSyncOperation({ id: 'legacy', type: 'question.add', data: { question } });
      expect(normalizePrivateSyncOperation(operation)).toEqual(operation);
      const first = applyLearningOperation(emptyLearningState('guest'), operation);
      expect(applyLearningOperation(first.state, operation).reused).toBe(true);
      expect(first.state.questions[0].algebra).toEqual(question.algebra);
    }
  });
  it('完整自然答案能绑定，讨论不强行判错；不借用旧线性先修诊断', () => {
    const question = createAlgebraQuestion('binding', '解二次不等式 x^2-4>0');
    for (const answer of ['x<-2∪x>2', '(-∞,-2)∪(2,∞)', '我的答案是(-∞,-2)∪(2,∞)'])
      expect(classifyResponse(answer, question)).toBe('answer');
    for (const answer of ['也许x>2', '是不是x>2？', '题干是x^2>4'])
      expect(classifyResponse(answer, question)).toBe('discussion');
    const attempts = [
      {
        id: 'first',
        questionKey: questionKey(question),
        conversationId: 'c',
        answer: 'x>2',
        grade: gradeAnswer(question, 'x>2')
      }
    ];
    for (const contract of ['prerequisite-diagnosis-v1', 'prerequisite-diagnosis-v2'])
      expect(createPrerequisiteQuestion('d', question, attempts, 'c', contract)).toBeNull();
  });
  it('双段、单点、全体与空集的负倍变式重验；初级提示不泄露完整解集', () => {
    for (const [goal, answer] of [
      ['解二次不等式 x^2-4>0', '(-∞,-2)∪(2,∞)'],
      ['解二次不等式 (x-1)^2<=0', '[1,1]'],
      ['解二次不等式 (x-1)^2>=0', '任意实数'],
      ['解二次不等式 x^2+1<0', '无解']
    ]) {
      const parent = createAlgebraQuestion('parent', goal),
        variant = createAlgebraVariant('variant', parent);
      expect(variant.parentQuestionKey).toBe('parent@1');
      expect(variant.algebra.contract).toBe(QUADRATIC_INEQUALITY_CONTRACT);
      expect(gradeAnswer(variant, answer).outcome).toBe('correct');
      expect(variant.prompt).not.toBe(parent.prompt);
      for (const level of [1, 2]) expect(localTeaching(parent, 'hint', level).content).not.toContain(answer);
      expect(localTeaching(parent, 'hint', 3).content).toContain(answer);
      expect(localTeaching(parent, 'check').helped).toBe(false);
    }
  });
});
describe('二次完整解集图形和对话事实', () => {
  it.each([
    ['解二次不等式 x^2-4<0', 2, 0, [''], '(-2,2)'],
    ['解二次不等式 x^2-4>=0', 2, 2, ['←', '→'], '(-∞,-2]∪[2,∞)'],
    ['解二次不等式 (x-1)^2>0', 1, 0, ['←', '→'], '(-∞,1)∪(1,∞)'],
    ['解二次不等式 (x-1)^2<=0', 1, 1, [''], '[1,1]']
  ])('图示 %s', (goal, points, closed, directions, label) => {
    const wrapper = mount(NumberLine, {
      props: { question: createAlgebraQuestion('diagram', goal) },
      global: { stubs: { view: { template: '<div><slot/></div>' }, text: { template: '<span><slot/></span>' } } }
    });
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toContain(label);
    expect(wrapper.findAll('.boundary')).toHaveLength(points);
    expect(wrapper.findAll('.boundary.closed')).toHaveLength(closed);
    expect(wrapper.findAll('.movement').map((v) => v.text())).toEqual(directions);
    wrapper.unmount();
  });
  it('无根、无解和未校对条件不画错误单半直线', () => {
    expect(inequalityDiagram(createAlgebraQuestion('all', '解二次不等式 x^2+1>0')).kind).toBe('all');
    expect(inequalityDiagram(createAlgebraQuestion('empty', '解二次不等式 x^2+1<0')).kind).toBe('empty');
    const question = createAlgebraQuestion('uncertain', '解二次不等式 x^2-4<0');
    question.uncertainties = [{ resolved: false }];
    expect(inequalityDiagram(question)).toBeNull();
    expect(inequalityDiagram(createAlgebraQuestion('unknown', '解二次不等式 x^2<2'))).toBeNull();
  });
  it('错答、帮助后修正、独立变式、停止、重开与备份共用事实，首答不重复', async () => {
    const store = useConversationLearningStore();
    store.start('解二次不等式 x^2-4>=0');
    const request = vi.spyOn(uni, 'request');
    try {
      await store.send('x>=2', { id: 'first' });
      await store.send('x>=2', { id: 'first' });
      expect(store.state.attempts).toHaveLength(1);
      expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
      expect(store.summary.mistakes).toHaveLength(1);
      await store.send('用图示', { discussionOnly: true, id: 'diagram-help' });
      await store.send('(-∞,-2]∪[2,∞)', { id: 'revision' });
      expect(store.state.attempts[1]).toMatchObject({ kind: 'revision', grade: { outcome: 'correct' } });
      expect(store.state.attempts[1].hints).toHaveLength(1);
      const parent = questionKey(store.activeQuestion);
      store.generateVariant();
      expect(store.activeQuestion.parentQuestionKey).toBe(parent);
      await store.send('x<=-2∪x>=2', { id: 'variant' });
      expect(store.state.attempts[2]).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
      expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
      expect(store.summary.tasks).toMatchObject({ numerator: 2, denominator: 2 });
      store.commit('task.stop', { conversationId: store.active.id });
      const restored = prepareLearningRestore(
        emptyLearningState('guest', store.state.timezone),
        store.exportData()
      ).state;
      expect(summarizeLearning(restored).first).toEqual(store.summary.first);
      expect(summarizeLearning(restored).tasks).toEqual(store.summary.tasks);
      let replay = emptyLearningState('guest', store.state.timezone);
      for (const event of store.state.events)
        replay = applyLearningOperation(
          replay,
          normalizePrivateSyncOperation({ id: event.id, type: event.type, at: event.at, data: event.data })
        ).state;
      expect(summarizeLearning(replay).first).toEqual(store.summary.first);
      expect(replay.conversations.find((c) => c.id === store.active.id).stopped).toBe(true);
      setActivePinia(createPinia());
      const reopened = useConversationLearningStore();
      expect(reopened.active.stopped).toBe(true);
      expect(reopened.state.attempts).toHaveLength(3);
      expect(request).not.toHaveBeenCalled();
    } finally {
      request.mockRestore();
    }
  });
});
