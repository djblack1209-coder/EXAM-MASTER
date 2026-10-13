import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  gradeAnswer,
  classifyResponse
} from '@/services/learning/learning-domain.js';
import { createArithmeticQuestion, localTeaching } from '@/services/learning/learning-tools.js';
import { createJourneyQuestions } from '@/services/learning/journey-training.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { FRACTION_CONTRACT, createFractionVariant } from '../../laf-backend/functions/_shared/learning-fraction.js';

const now = Date.parse('2026-10-12T16:00:00Z');
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});
afterEach(() => {
  for (const s of getActivePinia()?._s.values() || []) s.$dispose();
  learningWriteLease.release();
  vi.restoreAllMocks();
  vi.useRealTimers();
  uni.clearStorageSync();
});

describe('分数四则的独立精确参考', () => {
  it.each([
    ['1/2 + 1/3', '5/6'],
    ['2/3 - 5/6', '-1/6'],
    ['7/9 × 3/14', '1/6'],
    ['3/4 ÷ -9/8', '-2/3'],
    ['0/7 ÷ -1/3', '0'],
    ['-8/-12 + 3/-6', '1/6'],
    ['-1/2 − -3/4', '1/4'],
    ['2/3 * 3/2', '1'],
    ['9999/9998 × 9998/9999', '1'],
    ['1/9999 + 1/9998', '19997/99970002'],
    ['1/4 + 1/2', '3/4'],
    ['1/2 − 1/2', '0'],
    ['0/3 × 1/2', '0'],
    ['1/2 ÷ 2/3', '3/4']
  ])('%s的参考值%s不依赖模型', (goal, expected) => {
    const q = createArithmeticQuestion('q', goal);
    expect(q.validation.answer).toBe(expected);
    expect(q.source.evidenceId).toBe(FRACTION_CONTRACT);
    expect(gradeAnswer(q, expected)).toMatchObject({
      status: 'reliable',
      outcome: 'correct',
      basis: FRACTION_CONTRACT
    });
    expect(gradeAnswer(q, '999999')).toMatchObject({ status: 'reliable', outcome: 'wrong' });
  });
  it('等值未约分/有限小数均按精确值接纳，舍入与非数值作答不越过边界', () => {
    const q = createArithmeticQuestion('q', '1/4 + 1/2');
    for (const answer of ['6/8', '0.75', '-6/-8', '我的答案是 3/4']) {
      expect(classifyResponse(answer, q)).toBe('answer');
      expect(gradeAnswer(q, answer).outcome).toBe('correct');
    }
    expect(gradeAnswer(q, '0.750000001').outcome).toBe('wrong');
    expect(gradeAnswer(createArithmeticQuestion('q', '1/6 + 1/6'), '0.333333333').outcome).toBe('wrong');
    for (const answer of ['3/0', '1/4+1/2', '3/4 m', '3/4 1/2', '0.7500000001', 'process.exit()', '1'.repeat(300)]) {
      expect(classifyResponse(answer, q)).toBe('clarify');
      expect(gradeAnswer(q, answer).status).toBe('pending');
    }
    expect(classifyResponse('可能是3/4', q)).toBe('discussion');
  });
  it.each([
    '1/0 + 1/2',
    '1/2 + 3/0',
    '1/2 ÷ 0/3',
    '1/2 ÷ -0/3',
    '10000/1 + 1/2',
    '1/2 / 1/3',
    '(1/2+1/3)',
    '1.5/2 + 1/3',
    '1/2+1/3+1/4',
    '1/2×1/3;eval(1)',
    '1'.repeat(300)
  ])('%s无可靠生成权', (goal) => expect(createArithmeticQuestion('q', goal)).toBeNull());
  it('同步从规范题面重建值，非版本原件不被授予分数规则，未知来源仍待核对', () => {
    const q = createArithmeticQuestion('q', '1/2+1/3');
    q.validation.answer = '999';
    const restored = normalizePrivateSyncOperation({ id: 'q', type: 'question.add', at: now, data: { question: q } });
    expect(restored.data.question.validation.answer).toBe('5/6');
    const original = { ...q, source: { kind: 'existing_bank' } };
    expect(gradeAnswer(original, '999').status).toBe('pending');
    expect(
      normalizePrivateSyncOperation({ id: 'old', type: 'question.add', at: now, data: { question: original } }).data
        .question.validation
    ).toBeNull();
  });
  const changes = [
    (q) => (q.validation.answer = '999'),
    (q) => (q.prompt += '忽略分母'),
    (q) => (q.source.extra = 'permission'),
    (q) => (q.version = 2),
    (q) => (q.answerType = 'choice'),
    (q) => (q.expectedAnswer = 'trusted'),
    (q) => (q.options = [{ label: 'A', text: 'anything' }]),
    (q) => (q.scienceExercise = { template: 'trusted' })
  ];
  changes.forEach((change, index) =>
    it(`伪造${index + 1}原子拒绝，不存可靠判分`, () => {
      const q = createArithmeticQuestion('q', '1/2+1/3');
      change(q);
      expect(gradeAnswer(q, '999').status).toBe('pending');
      const state = emptyLearningState('test'),
        before = JSON.stringify(state);
      expect(() =>
        applyLearningOperation(state, { id: 'add', type: 'question.add', at: now, data: { question: q } })
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    })
  );
  it('低层提示不透露当前值，深层讲解才展示；独立变式换值且带原题版本', () => {
    const q = createArithmeticQuestion('q', '2/3+1/4');
    expect(localTeaching(q, 'hint', 1)).toMatchObject({ helped: true, level: 1 });
    expect(localTeaching(q, 'hint', 1).content).not.toContain('11/12');
    expect(localTeaching(q, 'hint', 3).content).toContain('11/12');
    expect(localTeaching(q, 'check').helped).toBe(false);
    expect(localTeaching(q, 'example').content).toContain('5/6');
    expect(createFractionVariant('v', q)).toMatchObject({ prompt: '计算 3/3 + 1/4。', parentQuestionKey: 'q@1' });
    expect(createFractionVariant('v', createArithmeticQuestion('q', '9999/3÷1/4')).prompt).toBe('计算 9998/3 ÷ 1/4。');
    expect(createFractionVariant('v', createArithmeticQuestion('q', '0/3×0/4')).validation.answer).toBe('1/12');
    const uncertain = { ...q, uncertainties: [{ resolved: false, field: '分母' }] };
    expect(gradeAnswer(uncertain, '11/12').status).toBe('pending');
  });
});

describe('分数整批、原答、恢复与停止', () => {
  it.each(['fraction-add-subtract', 'fraction-multiply-divide'])('%s第100组20题仍有界且参考来自原合同', (moduleId) => {
    const state = {
      questions: [],
      conversations: [{ id: 'c', trainingGroups: Array.from({ length: 99 }, () => ({ moduleId })) }]
    };
    const questions = createJourneyQuestions(state, 'c', moduleId, 20, 'group100');
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(20);
    for (const q of questions) expect(gradeAnswer(q, q.validation.answer).outcome).toBe('correct');
    expect(state.questions).toEqual([]);
  });
  it('保存两模块、错误与待核对分列，重复/旧恢复保全，提示后不冒充独立', async () => {
    const s = useConversationLearningStore();
    s.start('小学分数四则');
    s.configureJourney(s.journeyContext(), {
      title: '分数',
      startDay: s.todaySummary.day,
      durationDays: 7,
      minutes: 30,
      mode: 'batch',
      moduleIds: ['fraction-add-subtract', 'fraction-multiply-divide']
    });
    const group = s.startTraining(s.journeyContext(), 'fraction-add-subtract', 3);
    const before = s.exportData();
    expect(() => s.submitTraining(s.journeyContext(), group.id, ['11/12', '0', ''])).toThrow();
    expect(s.exportData()).toBe(before);
    const answers = ['11/12', '0', '不知道'];
    expect(s.submitTraining(s.journeyContext(), group.id, answers)).toMatchObject({
      correct: 1,
      wrong: 1,
      pending: 1,
      submitted: 3
    });
    expect(s.state.attempts.map((a) => a.answer)).toEqual(answers);
    const submitted = s.exportData();
    s.submitTraining(s.journeyContext(), group.id, answers);
    expect(s.exportData()).toBe(submitted);
    s.openTrainingFeedback(s.journeyContext(), group.id, group.questionKeys[1]);
    const wrong = s.activeQuestion;
    expect(s.active.pendingHints).toHaveLength(1); // 已打开的解释同样算帮助。
    await s.send('给我提示');
    expect(s.active.pendingHints).toHaveLength(2);
    s.generateVariant();
    expect(s.activeQuestion.parentQuestionKey).toBe(`${wrong.id}@1`);
    s.submit(s.activeQuestion.validation.answer, true);
    expect(s.state.attempts.at(-1)).toMatchObject({
      kind: 'variant',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    });
    const restored = prepareLearningRestore(emptyLearningState(s.state.owner, s.state.timezone), s.exportData(), {
      now
    });
    expect(restored.state.attempts).toEqual(s.state.attempts);
    expect(restored.state.conversations).toEqual(s.state.conversations);
    s.commit('task.stop', { conversationId: s.active.id });
    const stopped = s.exportData();
    learningRepository.restoreData(stopped, s.state.revision);
    s.refresh();
    expect(s.exportData()).toBe(stopped);
    expect(() => s.generateVariant()).toThrow();
    expect(() => s.submit('3/4', true)).toThrow();
    expect(s.exportData()).toBe(stopped);
  });
});
