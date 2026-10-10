import { it, expect } from 'vitest';
import {
  emptyLearningState,
  applyLearningOperation,
  createLearningOperationBatch
} from '@/services/learning/learning-domain.js';
import { HISTORY_LIMITS } from '../../laf-backend/functions/_shared/learning-history.js';
import { parsePastedMaterial } from '@/services/learning/material-intake.js';
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

it.each([
  '1.0',
  '1e2',
  '1e-6',
  '9999999999999999',
  '-0',
  '"\\u4e2d"',
  '"\\/"',
  '0.0000001',
  '1e+21',
  '-0.0',
  '1E+2',
  '1e309',
  '9007199254740993',
  '-9007199254740993'
])('原始JSON标量 %s 仍按解析后的精确长度守容量边界', (literal) => {
  const original = applyLearningOperation(
    emptyLearningState('fixture-owner'),
    op('c', 'conversation.start', { goal: '边界' })
  ).state;
  original.legacy = { value: JSON.rawJSON(literal), padding: '' };
  const message = op('boundary', 'message.add', { conversationId: 'c', role: 'user', content: '独立检验' });
  const expected = applyLearningOperation(original, message).state;
  original.legacy.padding = '学'.repeat(HISTORY_LIMITS.stateCharacters - JSON.stringify(expected).length);
  const batch = createLearningOperationBatch(original);
  batch.apply(message);
  expect(JSON.stringify(batch.finish()).length).toBe(HISTORY_LIMITS.stateCharacters);
  original.legacy.padding += '学';
  expect(() => applyLearningOperation(original, message)).toThrow('上限');
  const rejected = createLearningOperationBatch(original);
  expect(() => rejected.apply(message)).toThrow('上限');
  expect(() => rejected.finish()).toThrow('失败');
});

it('连续消息的重试不重复作答事实，同标识改内容仍拒绝并关闭批次', () => {
  const original = applyLearningOperation(
    emptyLearningState('fixture-owner'),
    op('c', 'conversation.start', { goal: '检验' })
  ).state;
  const batch = createLearningOperationBatch(original);
  const first = op('m', 'message.add', { conversationId: 'c', role: 'user', content: '保留原文' });
  batch.apply(first);
  batch.apply(op('m2', 'message.add', { conversationId: 'c', role: 'user', content: '下一条' }));
  expect(batch.apply(first).reused).toBe(true);
  expect(() => batch.apply({ ...first, data: { ...first.data, content: '覆盖原文' } })).toThrow('同一操作标识');
  expect(() => batch.finish()).toThrow('失败');
  expect(original.conversations[0].messages).toHaveLength(0);
});

it('私人原题消息删除后旧标识不能借连续消息重试恢复，原副本保持隔离', () => {
  const marker = 'BATCH_PRIVATE_SYNTHETIC_原文';
  let original = emptyLearningState('fixture-owner');
  const put = (id, type, data) => {
    original = applyLearningOperation(original, op(id, type, data)).state;
  };
  put('material', 'material.add', { material: parsePastedMaterial(marker, 'batch-material') });
  put('c', 'conversation.start', { goal: marker });
  put('q', 'question.add', {
    question: {
      id: 'batch-q',
      version: 1,
      scope: 'private',
      answerType: 'subjective',
      prompt: marker,
      source: { materialId: 'batch-material' }
    }
  });
  put('focus', 'question.focus', { conversationId: 'c', questionKey: 'batch-q@1' });
  const before = JSON.stringify(original),
    batch = createLearningOperationBatch(original);
  const message = op('private-message', 'message.add', { conversationId: 'c', role: 'user', content: marker });
  batch.apply(message);
  const removed = batch.apply(
    op('delete', 'material.delete', { materialId: 'batch-material', questionKeys: ['batch-q@1'] })
  ).state;
  expect(JSON.stringify(removed)).not.toContain(marker);
  expect(() => batch.apply(message)).toThrow('已删除');
  expect(() => batch.finish()).toThrow('失败');
  expect(JSON.stringify(original)).toBe(before);
});

it('不同账户及不同批次可使用相同消息标识，各自原文不串用', () => {
  for (const owner of ['fixture-one', 'fixture-two']) {
    const state = applyLearningOperation(
      emptyLearningState(owner),
      op('c', 'conversation.start', { goal: owner })
    ).state;
    const batch = createLearningOperationBatch(state);
    batch.apply(op('m', 'message.add', { conversationId: 'c', role: 'user', content: owner }));
    expect(batch.finish().conversations[0].messages[0].content).toBe(owner);
    expect(state.conversations[0].messages).toHaveLength(0);
  }
});
