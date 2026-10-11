import { describe, it, expect } from 'vitest';
import { emptyLearningState, applyLearningOperation, summarizeLearning } from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { createLearningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';

const now = Date.parse('2026-10-10T10:00:00Z');
function fixture() {
  let state = emptyLearningState('journey-user', 'Asia/Shanghai');
  let sequence = 0;
  const apply = (type, data, at = now, id = `journey-${++sequence}`) => {
    const result = applyLearningOperation(state, { id, type, data, at });
    state = result.state;
    return result;
  };
  apply('conversation.start', { goal: '数学路线' }, now - 86400000, 'math');
  apply('conversation.start', { goal: '英语路线' }, now - 86400000, 'english');
  const answer = (id, conversationId, value, at = now) => {
    apply('question.add', {
      question: {
        id,
        version: 1,
        prompt: `计算 ${id === 'old' ? '1 + 2' : '2 + 3'}。`,
        scope: 'generated',
        subject: conversationId === 'math' ? '数学' : '英语',
        source: { kind: 'executable' },
        validation: {
          type: 'number',
          answer: id === 'old' ? '3' : '5',
          authority: 'executable',
          evidenceId: 'integer-arithmetic-v1'
        }
      }
    }, at);
    apply('question.focus', { conversationId, questionKey: `${id}@1` }, at);
    apply('attempt.submit', { conversationId, answer: value, explicit: true }, at);
  };
  return { apply, answer, read: () => state };
}

describe('学习路线与范围一致的统计', () => {
  it('今日当前目标排除昨日及其他对话，历史统计保留原口径且读取不改记录', () => {
    const f = fixture();
    f.answer('old', 'math', '4', now - 86400000);
    f.answer('today-wrong', 'math', '6');
    f.answer('today-correct', 'math', '5');
    f.answer('other', 'english', '5');
    const before = JSON.stringify(f.read());
    const today = summarizeLearning(f.read(), now, { range: 'day', conversationId: 'math' });
    expect(today.validAnswers).toBe(2);
    expect(today.first).toMatchObject({ numerator: 1, denominator: 2, rate: 0.5 });
    expect(today.mistakes).toHaveLength(1);
    expect(today.totalReliableAnswers).toBe(2);
    expect(summarizeLearning(f.read(), now).first).toMatchObject({ numerator: 2, denominator: 4 });
    expect(JSON.stringify(f.read())).toBe(before);
  });

  it('明确保存目标与整批节奏可恢复，非法日历日期不能改变已保存路线或停止状态', () => {
    const f = fixture();
    f.apply('journey.configure', {
      conversationId: 'math',
      title: '30天运算训练',
      startDay: '2026-10-10',
      durationDays: 30,
      minutes: 40,
      mode: 'batch',
      moduleIds: ['arithmetic-add', 'arithmetic-multiply']
    });
    f.apply('task.stop', { conversationId: 'math' });
    const before = f.read();
    expect(before.conversations[0].journey).toMatchObject({
      title: '30天运算训练', mode: 'batch', durationDays: 30,
      moduleIds: ['arithmetic-add', 'arithmetic-multiply']
    });
    expect(() => f.apply('journey.configure', {
      conversationId: 'math', title: '无效日期', startDay: '2026-02-30',
      durationDays: 30, minutes: 40, mode: 'batch', moduleIds: ['arithmetic-add']
    })).toThrow();
    expect(f.read()).toBe(before);
    const restored = prepareLearningRestore(emptyLearningState('journey-user', 'Asia/Shanghai'),
      JSON.stringify(before), { now: now + 1000 });
    expect(restored.state.conversations[0].journey).toEqual(before.conversations[0].journey);
    expect(restored.state.conversations[0].stopped).toBe(true);
  });

  it('整批最后一项非法时不保存任何原答，原编号重试只保存一次完整批次', () => {
    const f = fixture();
    for (const id of ['batch-a', 'batch-b']) f.apply('question.add', {
      question: { id, version: 1, prompt: '计算 2 + 3。', scope: 'generated',
        subject: '数学', source: { kind: 'executable' },
        validation: { type: 'number', answer: '5', authority: 'executable', evidenceId: 'integer-arithmetic-v1' } }
    });
    const data = { [LEARNING_KEY]: f.read() };
    const repository = createLearningRepository({
      get: (key, fallback) => data[key] ?? fallback,
      save: (key, value) => { data[key] = JSON.parse(JSON.stringify(value)); return true; },
      remove: (key) => { delete data[key]; return true; }
    }, () => 'journey-user');
    const operations = ['batch-a', 'batch-b'].flatMap((id) => [
      { id: `${id}:focus`, type: 'question.focus', at: now, data: { conversationId: 'math', questionKey: `${id}@1` } },
      { id: `${id}:answer`, type: 'attempt.submit', at: now, data: { conversationId: 'math', answer: '5', explicit: true } }
    ]);
    const before = JSON.stringify(data);
    expect(() => repository.commitBatch([...operations, {
      id: 'invalid-last', type: 'question.focus', at: now, data: { conversationId: 'math', questionKey: 'missing@1' }
    }], f.read().revision)).toThrow();
    expect(JSON.stringify(data)).toBe(before);
    repository.commitBatch(operations, f.read().revision);
    const accepted = repository.read();
    expect(accepted.attempts.map((a) => a.id)).toEqual(['batch-a:answer', 'batch-b:answer']);
    repository.commitBatch(operations, accepted.revision);
    expect(repository.read()).toEqual(accepted);
  });
});
