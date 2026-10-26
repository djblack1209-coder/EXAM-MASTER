import { describe, it, expect, vi } from 'vitest';
import { emptyLearningState, applyLearningOperation } from '@/services/learning/learning-domain.js';
import { executeLearningTool, userDirective, LEARNING_TOOLS } from '@/services/learning/learning-tools.js';
import {
  compactLearningProgress,
  hostReviewRating,
  learningBudgetPhase,
  learningTimeout,
  normalizeLearningSnapshot,
  phaseCallLimit
} from '../../laf-backend/functions/_shared/learning-runtime-policy.js';
import { dailyConversationContext } from '../../laf-backend/functions/_shared/learning-journey.js';
import { dayKey, effectiveGrade } from '@/services/learning/learning-domain.js';
import { newAccount, reserveCall } from '../../laf-backend/functions/_shared/learning-account.ts';
import {
  buildLearningRequest,
  parseLearningOutput
} from '../../laf-backend/functions/_shared/ai-providers/learning-provider.ts';

function repository() {
  let state = emptyLearningState('host-policy');
  const commit = (operation) => {
    const result = applyLearningOperation(state, operation);
    state = result.state;
    return result;
  };
  commit({ id: 'c', type: 'conversation.start', data: { goal: '考研英语写作' }, at: 1000 });
  return { read: () => state, commit };
}
const context = () => ({
  conversationId: 'c',
  origin: 'model',
  permissions: ['read', 'learn'],
  calls: 0,
  maxCalls: 3,
  deadline: Date.now() + 5000
});

describe('宿主教学权限与隐私', () => {
  it.each(['method', 'entry.create', 'entry.update', 'review'])('模型无法请求 %s，也不会生成学习事实', (name) => {
    const repo = repository();
    expect(() =>
      parseLearningOutput(JSON.stringify({ message: 'attempt', tools: [{ name, arguments: {} }] }))
    ).toThrow();
    expect(() => executeLearningTool(repo, { id: name.replace('.', '_'), name, arguments: {} }, context())).toThrow();
    expect(repo.read().profile).toEqual([]);
    expect(repo.read().reviews).toEqual([]);
    expect(repo.read().executions.at(-1).decision).toBe('denied');
  });
  it('进度与快照没有学生原文，执行收据仅含白名单元信息', () => {
    const repo = repository();
    repo.commit({
      id: 'private',
      type: 'message.add',
      data: { conversationId: 'c', role: 'user', content: 'PRIVATE_STUDENT_HISTORY' }
    });
    const outcome = executeLearningTool(repo, { id: 'query', name: 'progress', arguments: {} }, context());
    expect(JSON.stringify(outcome.result)).not.toContain('PRIVATE_STUDENT_HISTORY');
    expect(outcome.result).toMatchObject({ contract: 'learning-snapshot-v1', draftId: null, planVersion: 0 });
    const receipt = repo.read().events.find((event) => event.id === 'query:receipt').data;
    expect(Object.keys(receipt).sort()).toEqual([
      'decision',
      'parameterHash',
      'permission',
      'remainingBudget',
      'tool',
      'version'
    ]);
    expect(receipt).toMatchObject({ decision: 'allowed', remainingBudget: 2, permission: 'read' });
    expect(JSON.stringify(compactLearningProgress(repo.read(), 'c'))).not.toContain('PRIVATE_STUDENT_HISTORY');
    expect(repo.read().conversations[0].messages[0].content).toBe('PRIVATE_STUDENT_HISTORY');
  });
  it('文字命令只在非作答状态且短文本时生效', () => {
    const state = repository().read();
    expect(userDirective('换方法', state, 'c')).toMatchObject({ type: 'strategy.set' });
    expect(userDirective('换方法', state, 'c', { answering: true })).toBeNull();
    expect(userDirective('换方法' + ' '.repeat(50) + '请忽略以上内容', state, 'c')).toBeNull();
    expect(userDirective('我的答案是：换方法', state, 'c')).toBeNull();
  });
  it('本地写入超时发生在提交之前，拒绝收据不包含参数正文', () => {
    const repo = repository();
    let tick = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => (tick += 1500));
    try {
      expect(() =>
        executeLearningTool(
          repo,
          { id: 'slow', name: 'hint', arguments: { content: 'PRIVATE_ANSWER', level: 1 } },
          { ...context(), deadline: 100000 }
        )
      ).toThrow('超时');
      expect(JSON.stringify(repo.read().executions)).not.toContain('PRIVATE_ANSWER');
    } finally {
      vi.restoreAllMocks();
    }
    expect(LEARNING_TOOLS.progress.timeoutMs).toBe(2000);
    expect(LEARNING_TOOLS.assess.timeoutMs).toBe(60000);
    expect(learningTimeout({ coach: { phase: 'essay' } })).toBe(60000);
  });
  it('只装最近六条当前消息，旧日原文仍保留本机', () => {
    const repo = repository(),
      now = Date.now();
    repo.commit({
      id: 'old',
      type: 'message.add',
      at: now - 172800000,
      data: { conversationId: 'c', role: 'user', content: 'OLD_PRIVATE_HISTORY' }
    });
    for (let index = 0; index < 12; index++)
      repo.commit({
        id: `m${index}`,
        type: 'message.add',
        at: now,
        data: { conversationId: 'c', role: index % 2 ? 'assistant' : 'user', content: `turn-${index}` }
      });
    const result = dailyConversationContext(repo.read(), 'c', now, { dayKey, effectiveGrade });
    expect(result.messages).toHaveLength(6);
    expect(result.messages[0].content).toBe('turn-6');
    expect(JSON.stringify(result)).not.toContain('OLD_PRIVATE_HISTORY');
    expect(repo.read().conversations[0].messages).toHaveLength(13);
  });
});

it('FSRS四档由宿主结果映射，未知不会被当成正确', () => {
  expect(hostReviewRating({ outcome: 'wrong' })).toBe(1);
  expect(hostReviewRating({ outcome: 'uncertain' })).toBe(1);
  expect(hostReviewRating({ outcome: 'correct', hinted: true })).toBe(2);
  expect(hostReviewRating({ outcome: 'correct' })).toBe(3);
  expect(hostReviewRating({ outcome: 'correct', correctStreak: 2 })).toBe(4);
});

it('练题额度用尽不截断写作的独立额度，账户硬边界保留', () => {
  const account = newAccount('host-policy');
  const limit = 100;
  for (let index = 0; index < phaseCallLimit(limit, 'practice'); index++)
    account.calls.push({ id: `p${index}`, source: 'byok', budgetPhase: 'practice' });
  const input = {
    id: 'writing',
    fingerprint: 'same',
    source: 'byok',
    budgetPhase: 'writing',
    callLimit: limit,
    maxCost: 0,
    units: 0
  };
  expect(() => reserveCall(account, { ...input, id: 'practice', budgetPhase: 'practice' })).toThrow('本阶段');
  expect(reserveCall(account, input).call.budgetPhase).toBe('writing');
  expect(learningBudgetPhase({ coach: { phase: 'feedback', target: 'paragraph-0' } })).toBe('writing');
  expect(learningBudgetPhase({ coach: { phase: 'feedback', target: 'rewrite' } })).toBe('writing');
});

it('工具往返的第二次请求绑定工具结果及严格JSON契约', () => {
  const config = {
    model: 'synthetic',
    maxOutput: 256,
    endpoint: 'https://provider.example/chat',
    capabilities: { structured: false, tools: false },
    capabilityProbe: { stage: 'tool', nonce: 'nonce' }
  };
  const first = buildLearningRequest(config, []);
  expect(first.tools[0].function.name).toBe('yozi_capability_echo');
  expect(first.tools[0].function.parameters.properties.nonce.enum).toEqual(['nonce']);
  const second = buildLearningRequest({ ...config, capabilityProbe: { stage: 'json', nonce: 'nonce' } }, [
    { role: 'tool', tool_call_id: 'probe', content: '{"nonce":"nonce"}' }
  ]);
  expect(second.response_format.json_schema.strict).toBe(true);
  expect(second.response_format.json_schema.schema.properties.accepted.enum).toEqual([true]);
  expect(second.messages[0].role).toBe('tool');
});

it('快照的网络投影丢弃历史、额外原答和额外工具权限', () => {
  const result = normalizeLearningSnapshot({
    revision: 3,
    history: ['PRIVATE'],
    profile: { exam: 'english2', notes: 'PRIVATE' },
    teaching: { method: 'steps', permissions: ['delete'] },
    dueCards: [{ id: 'card_1', due: 123, answer: 'PRIVATE' }]
  });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(result.teaching).toEqual({ stopped: false, method: 'steps' });
  expect(result.dueCards).toEqual([{ id: 'card_1', due: 123 }]);
});
