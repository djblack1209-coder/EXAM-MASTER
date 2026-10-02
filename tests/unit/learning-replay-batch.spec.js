import { it, expect } from 'vitest';
import {
  emptyLearningState,
  applyLearningOperation,
  createLearningOperationBatch
} from '@/services/learning/learning-domain.js';
import { HISTORY_LIMITS } from '../../laf-backend/functions/_shared/learning-history.js';
const op = (id, type, data) => ({ id, type, data, at: Date.now() - 1000 });
it('同一批次逐操作校验且结果与纯单操作重放一致，原快照和操作不变', () => {
  const operations = [
    op('c', 'conversation.start', { goal: '检验' }),
    ...Array.from({ length: 12 }, (_, i) =>
      op(`m${i}`, 'message.add', {
        conversationId: 'c',
        role: i % 2 ? 'notice' : 'user',
        content: '  中文😀\n"\\\uD800  ',
        questionKey: i % 2 ? 'q@1' : null
      })
    ),
    op('pending', 'model.request', {
      conversationId: 'c',
      messageId: 'm10',
      questionKey: null,
      modelId: 'fixture',
      model: 'explicit',
      requestId: 'fixture-only',
      binding: 'fixture_binding'
    }),
    op('p', 'plan.set', { tasks: [{ title: '独立检验', condition: 'manual' }], reason: '准备下一步' }),
    op('done', 'execution.record', { tool: 'progress', version: 1, status: 'success' })
  ];
  const original = emptyLearningState('fixture-owner', 'Asia/Shanghai');
  original.revision = 995;
  const snapshot = JSON.stringify(original),
    inputs = JSON.stringify(operations),
    batch = createLearningOperationBatch(original);
  let reference = original;
  for (const operation of operations) {
    reference = applyLearningOperation(reference, operation).state;
    batch.apply(operation);
  }
  const result = batch.finish();
  expect(result).toEqual(reference);
  expect(JSON.stringify(original)).toBe(snapshot);
  expect(JSON.stringify(operations)).toBe(inputs);
  expect(() => batch.apply(operations[0])).toThrow('结束');
});
it('幂等重试保持原revision；后续失败使整个批次不能提交，原历史不变', () => {
  const first = op('c', 'conversation.start', { goal: '检验' });
  const original = applyLearningOperation(emptyLearningState('fixture-owner'), first).state;
  const snapshot = JSON.stringify(original),
    batch = createLearningOperationBatch(original);
  expect(batch.apply(first).reused).toBe(true);
  batch.apply(op('ok', 'message.add', { conversationId: 'c', role: 'user', content: '记录' }));
  expect(() => batch.apply(op('bad', 'question.focus', { conversationId: 'missing', questionKey: 'q@1' }))).toThrow();
  expect(() => batch.finish()).toThrow('失败');
  expect(JSON.stringify(original)).toBe(snapshot);
  const limited = createLearningOperationBatch(original, 1);
  limited.apply(first);
  expect(() => limited.apply(first)).toThrow('上限');
  expect(() => limited.finish()).toThrow('失败');
});
it('消息JSON精确增量在容量边界与纯reducer一致，不可通过先超限再删除来绕过', () => {
  const original = applyLearningOperation(
    emptyLearningState('fixture-owner'),
    op('c', 'conversation.start', { goal: '边界' })
  ).state;
  original.legacy = { padding: '' };
  original.legacy.padding = '学'.repeat(HISTORY_LIMITS.stateCharacters - JSON.stringify(original).length - 10);
  const message = op('message', 'message.add', { conversationId: 'c', role: 'user', content: '边界消息😀' });
  expect(() => applyLearningOperation(original, message)).toThrow('上限');
  const batch = createLearningOperationBatch(original);
  expect(() => batch.apply(message)).toThrow('上限');
  expect(() => batch.finish()).toThrow('失败');
  expect(original.conversations[0].messages).toHaveLength(0);
});
