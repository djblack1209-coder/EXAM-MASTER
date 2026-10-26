import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import fixture from '../fixtures/learning/rubric-v1.json';
import evidenceFixture from '../fixtures/learning/rubric-evidence-v2.json';
import { applyLearningOperation, emptyLearningState, summarizeLearning } from '@/services/learning/learning-domain.js';
import { executeLearningTool } from '@/services/learning/learning-tools.js';
import { assessWithRubric } from '../../laf-backend/functions/_shared/learning-rubric.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { generateLearningTurn } from '@/services/api/domains/learning.api.js';
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  generateLearningTurn: vi.fn()
}));

const clone = (v) => structuredClone(v);
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());
function repository(answer = fixture.cases[0].answer, uncertainties = []) {
  let state = emptyLearningState('guest');
  const commit = (op) => {
    const result = applyLearningOperation(state, op);
    state = result.state;
    return result;
  };
  for (const op of [
    { id: 'c', type: 'conversation.start', data: { goal: '主观原答引用' } },
    { id: 'q', type: 'question.add', data: { question: { ...clone(fixture.question), uncertainties } } },
    { id: 'f', type: 'question.focus', data: { conversationId: 'c', questionKey: 'water-cycle@1' } },
    { id: 'a', type: 'attempt.submit', data: { conversationId: 'c', answer, explicit: true } }
  ])
    commit(op);
  return { read: () => state, commit };
}
function assess(repo, input = fixture.cases[0].assessment, id = 'score') {
  return executeLearningTool(
    repo,
    { id, name: 'assess', arguments: { ...clone(input), attemptId: 'a' } },
    {
      conversationId: 'c',
      permissions: ['learn'],
      calls: 0,
      maxCalls: 1,
      deadline: Date.now() + 5000,
      origin: 'model',
      model: 'isolated-contract-model'
    }
  );
}
describe('当前评分工具的原答定位与关键疑义', () => {
  it('宿主使用新合同，唯一原答引用产生可追溯的范围与上下文', () => {
    const repo = repository();
    assess(repo);
    const score = repo.read().attempts[0].assistance[0];
    expect(score.contract).toBe('subjective-rubric-v2');
    expect(score.dimensions[0].evidenceLocations[0]).toMatchObject({
      quote: '从液态变为气态',
      start: 4,
      end: 11,
      startCharacter: 5,
      endCharacter: 11,
      occurrence: 1,
      occurrences: 1
    });
    expect(summarizeLearning(repo.read()).first.denominator).toBe(0);
  });
  it('重复原文不能自动冒充唯一定位，工具拒绝且不写成功评分', () => {
    const repo = repository(fixture.cases[0].answer.repeat(2));
    expect(() => assess(repo)).toThrow(expect.objectContaining({ code: 'AMBIGUOUS_EVIDENCE' }));
    expect(repo.read().attempts[0].assistance).toBeUndefined();
    expect(repo.read().executions.at(-1).status).toBe('failed');
  });
  it('关键条件未校对时不保留任何确定维度分值', () => {
    const repo = repository(fixture.cases[0].answer, [{ field: '图中箭头', critical: true, resolved: false }]);
    const input = clone(fixture.cases[0].assessment);
    input.dimensions[1].score = null;
    input.dimensions[1].evidence = [];
    input.outcome = 'uncertain';
    expect(() => assess(repo, input)).toThrow(expect.objectContaining({ code: 'PRECONDITION' }));
    expect(repo.read().attempts[0].assistance).toBeUndefined();
  });
});

describe('独立固定原答引用集', () => {
  it.each(evidenceFixture.cases)('$id', (item) => {
    const run = () =>
      assessWithRubric(
        { ...clone(evidenceFixture.question), uncertainties: item.uncertainties || [] },
        { id: 'fixture-answer', answer: item.answer },
        clone(item.assessment)
      );
    if (item.expectedError) expect(run).toThrow(expect.objectContaining({ code: item.expectedError }));
    else {
      const result = run();
      expect(result.score).toBe(item.expectedScore);
      expect(result.contract).toBe(evidenceFixture.version);
      expect(result.attemptId).toBe('fixture-answer');
      if (item.expectedLocation) expect(result.dimensions[0].evidenceLocations[0]).toMatchObject(item.expectedLocation);
      for (const dimension of result.dimensions)
        for (const location of dimension.evidenceLocations) {
          expect(item.answer.slice(location.start, location.end)).toBe(location.quote);
          expect(dimension.evidence).toContain(location.quote);
        }
    }
  });
});

describe('引用合同与事实兼容、权限及同步重建', () => {
  it('应用升级后旧评分工具重试保留原v1事件及1.1收据，新内容仍被拒绝', () => {
    const repo = repository();
    repo.commit({
      id: 'score',
      type: 'assessment.assist',
      data: {
        ...clone(fixture.cases[0].assessment),
        attemptId: 'a',
        conversationId: 'c',
        model: 'isolated-contract-model'
      }
    });
    repo.commit({
      id: 'score:receipt',
      type: 'execution.record',
      data: { tool: 'assess', version: '1.1', status: 'success', durationMs: 17 }
    });
    const original = clone(repo.read());
    expect(assess(repo).success).toBe(true);
    expect(repo.read()).toEqual(original);
    expect(() => assess(repo, { ...clone(fixture.cases[0].assessment), feedback: '改写旧版本' })).toThrow(
      expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' })
    );
    expect(repo.read().attempts[0].assistance[0].contract).toBe('subjective-rubric-v1');
    const fresh = repository();
    assess(fresh);
    expect(fresh.read().attempts[0].assistance[0].contract).toBe('subjective-rubric-v2');
  });
  it('相同评分重试耗时不同仍复用原成功收据，不重复事实或改变耗时', () => {
    const repo = repository();
    let clock = Date.now(),
      duration = 7;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const commit = repo.commit;
    repo.commit = (op) => {
      const result = commit(op);
      if (op.type === 'assessment.assist') clock += duration;
      return result;
    };
    assess(repo);
    const receipt = clone(repo.read().events.find((e) => e.id === 'score:receipt'));
    const revision = repo.read().revision;
    expect(receipt.data).toMatchObject({ decision: 'allowed', permission: 'learn', remainingBudget: 0 });
    expect(receipt.data.parameterHash).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
    expect(receipt.data).not.toHaveProperty('durationMs');
    duration = 99;
    expect(assess(repo).success).toBe(true);
    expect(repo.read().revision).toBe(revision);
    expect(repo.read().events.find((e) => e.id === 'score:receipt')).toEqual(receipt);
    expect(repo.read().attempts[0].assistance).toHaveLength(1);
  });
  it('相同评分ID更改内容仍冲突，原成功收据和评分保留', () => {
    const repo = repository();
    assess(repo);
    const receipt = clone(repo.read().events.find((e) => e.id === 'score:receipt'));
    const changed = { ...clone(fixture.cases[0].assessment), feedback: '改写第一次评估' };
    expect(() => assess(repo, changed)).toThrow(expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' }));
    expect(repo.read().events.find((e) => e.id === 'score:receipt')).toEqual(receipt);
    expect(repo.read().attempts[0].assistance).toHaveLength(1);
  });
  it('评分已写入但收据缺失的重试补齐收据，不新增评分', () => {
    const repo = repository();
    repo.commit({
      id: 'score',
      type: 'assessment.assist',
      data: {
        ...clone(fixture.cases[0].assessment),
        attemptId: 'a',
        conversationId: 'c',
        model: 'isolated-contract-model',
        rubricContract: 'subjective-rubric-v2'
      }
    });
    expect(assess(repo).success).toBe(true);
    expect(repo.read().events.filter((e) => e.id === 'score:receipt')).toHaveLength(1);
    expect(repo.read().attempts[0].assistance).toHaveLength(1);
  });
  it('多维度顺序改变仍定位到各自原文，不混用第一维位置', () => {
    const repo = repository();
    const input = clone(fixture.cases[0].assessment);
    input.dimensions.reverse();
    assess(repo, input);
    const dimensions = repo.read().attempts[0].assistance[0].dimensions;
    expect(dimensions[0].evidenceLocations[0].quote).toBe('从液态变为气态');
    expect(dimensions[1].evidenceLocations[0].quote).toBe('由气态变回液态');
  });
  it('原答标识、未知合同和伪造权限/旧版降级不能经当前工具写入', () => {
    const repo = repository();
    const v2 = { ...clone(fixture.cases[0].assessment), rubricContract: 'subjective-rubric-v2', attemptId: 'foreign' };
    expect(() => assessWithRubric(fixture.question, repo.read().attempts[0], v2)).toThrow(
      expect.objectContaining({ code: 'PRECONDITION' })
    );
    expect(() =>
      assessWithRubric(fixture.question, repo.read().attempts[0], { ...v2, rubricContract: 'unknown' })
    ).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    for (const field of [
      { rubricContract: 'subjective-rubric-v1' },
      { authority: 'human_reviewed' },
      { execute: 'delete' }
    ])
      expect(() => assess(repo, { ...clone(fixture.cases[0].assessment), ...field })).toThrow(
        expect.objectContaining({ code: 'FORBIDDEN' })
      );
    expect(repo.read().attempts[0].assistance).toBeUndefined();
  });
  it('null工具参数走明确校验，不产生评分或成功收据', () => {
    const repo = repository();
    expect(() =>
      executeLearningTool(
        repo,
        { name: 'assess', arguments: null },
        { permissions: ['learn'], calls: 0, maxCalls: 1, deadline: Date.now() + 1000 }
      )
    ).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(repo.read().executions).toHaveLength(1);
    expect(repo.read().executions[0].decision).toBe('denied');
  });
  it('旧v1重复引用与历史缺分规则冻结，备份不擅自升级定位或权威', () => {
    const repo = repository(fixture.cases[0].answer.repeat(2));
    repo.commit({
      id: 'legacy',
      type: 'assessment.assist',
      data: {
        ...clone(fixture.cases[0].assessment),
        conversationId: 'c',
        attemptId: 'a',
        model: 'old-isolated-model'
      }
    });
    const original = clone(repo.read().attempts[0].assistance[0]);
    expect(original.contract).toBe('subjective-rubric-v1');
    const restored = prepareLearningRestore(emptyLearningState('guest'), JSON.stringify(repo.read())).state;
    expect(restored.attempts[0].assistance[0]).toEqual(original);
    expect(restored.attempts[0].assistance[0].dimensions[0].evidenceLocations).toBeUndefined();
    expect(summarizeLearning(restored).first.denominator).toBe(0);
  });
  it('v2备份从实际事件重建原答位置，派生偏移/附近正文/可靠标签不能伪造', () => {
    const repo = repository();
    assess(repo);
    assess(repo, fixture.cases[0].assessment); // 同一opId只复用一次。
    const state = clone(repo.read());
    state.attempts[0].assistance[0].dimensions[0].evidenceLocations[0].start = 999;
    state.attempts[0].assistance[0].dimensions[0].evidenceLocations[0].before = '另一账户私密数据';
    state.attempts[0].grade = { status: 'reliable', outcome: 'correct' };
    const restored = prepareLearningRestore(emptyLearningState('guest'), JSON.stringify(state)).state;
    expect(restored.attempts[0].assistance).toHaveLength(1);
    expect(restored.attempts[0].assistance[0].dimensions[0].evidenceLocations[0].start).toBe(4);
    expect(JSON.stringify(restored)).not.toContain('另一账户私密数据');
    expect(restored.attempts[0].grade.status).toBe('pending');
    expect(restored.reviews).toEqual([]);
  });
  it('真实Store发送完整疑义并只写未定分v2意见，原答与可靠分母保持', async () => {
    const store = useConversationLearningStore();
    store.start('核对图中方向');
    const material = store.importText('题干：简述蒸发与凝结的区别。');
    store.structureQuestion(material.id, {
      segmentId: material.segments[0].id,
      type: 'subjective',
      prompt: fixture.question.prompt,
      uncertainties: [
        { field: '箭头', reason: '扫描模糊', critical: true, resolved: false, unrelatedPrivateField: '不共享' }
      ]
    });
    store.setRubric(fixture.question.rubric.criteria);
    const attempt = store.submit(fixture.cases[0].answer, true, 'unreadable-answer');
    store.selectedMode = 'cloud';
    store.modelId = 'isolated-profile';
    store.sharingAllowed = true;
    const input = clone(fixture.cases[0].assessment);
    input.rubricId = store.activeQuestion.rubric.id;
    input.outcome = 'uncertain';
    input.dimensions.forEach((d) => {
      d.score = null;
      d.evidence = [];
    });
    vi.mocked(generateLearningTurn).mockResolvedValueOnce({
      success: true,
      data: {
        model: 'isolated-model',
        message: '先核对箭头，分值保留未定。',
        tools: [{ name: 'assess', arguments: { ...input, attemptId: attempt.id } }]
      }
    });
    await store.send('请评价刚才的作答？', { id: 'unreadable-turn' });
    const background = vi.mocked(generateLearningTurn).mock.calls[0][0].learningContext;
    expect(background.question.uncertainties).toEqual([
      { field: '箭头', reason: '扫描模糊', critical: true, resolved: false }
    ]);
    expect(background.attempt.answer).toBe(fixture.cases[0].answer);
    expect(store.state.attempts[0].assistance[0]).toMatchObject({
      contract: 'subjective-rubric-v2',
      score: null,
      reviewRequired: true
    });
    expect(store.summary.first.denominator).toBe(0);
  });
  it('资料隐私删除清除范围与附近原文，任务分母及其他记录保留', async () => {
    const store = useConversationLearningStore();
    store.start('原答证据');
    const material = store.importText('题干：简述蒸发与凝结的区别。');
    store.structureQuestion(material.id, {
      segmentId: material.segments[0].id,
      type: 'subjective',
      prompt: fixture.question.prompt
    });
    store.setRubric(fixture.question.rubric.criteria);
    const attempt = store.submit(fixture.cases[0].answer, true, 'private-answer');
    const input = { ...clone(fixture.cases[0].assessment), rubricId: store.activeQuestion.rubric.id };
    executeLearningTool(
      learningRepository,
      { id: 'private-assessment', name: 'assess', arguments: { ...input, attemptId: attempt.id } },
      {
        conversationId: store.selectedConversationId,
        permissions: ['learn'],
        calls: 0,
        maxCalls: 1,
        deadline: Date.now() + 1000,
        origin: 'model'
      }
    );
    store.refresh();
    const denominator = store.summary.tasks.denominator;
    await store.deleteMaterial(store.previewMaterialDeletion(material.id), true);
    expect(JSON.stringify(store.state)).not.toContain('从液态变为气态');
    expect(JSON.stringify(store.state)).not.toContain('evidenceLocations');
    expect(store.summary.tasks.denominator).toBe(denominator);
  });
});
