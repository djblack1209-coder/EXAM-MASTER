import {
  emptyLearningState,
  createLearningOperationBatch
} from '../../../laf-backend/functions/_shared/learning-domain.js';

// 自写隔离算例，标准答案来自整数加法；不进入公共题库或任何模型评测结论。
export function historyFixture(owner = 'u1', messages = 600, characters = 1400) {
  let state = emptyLearningState(owner, 'Asia/Shanghai');
  const at = Date.now() - 10000;
  let batch = createLearningOperationBatch(state),
    count = 0;
  const put = (id, type, data) => {
    if (count === 100) {
      state = batch.finish();
      batch = createLearningOperationBatch(state);
      count = 0;
    }
    state = batch.apply({ id, type, data, at }).state;
    count++;
  };
  put('history-c', 'conversation.start', { goal: '隔离历史：独立加法检验' });
  for (let i = 0; i < 6; i++)
    put(`history-q${i}`, 'question.add', {
      question: {
        id: `history-q${i}`,
        version: 1,
        scope: 'generated',
        prompt: `计算 ${i} + 10。`,
        source: { kind: 'executable' },
        validation: {
          type: 'number',
          answer: String(i + 10),
          authority: 'executable',
          evidenceId: 'integer-arithmetic-v1'
        }
      }
    });
  put('history-plan', 'plan.set', {
    tasks: Array.from({ length: 10 }, (_, i) => ({
      id: `history-t${i}`,
      title: '完成明确任务',
      questionKey: i < 6 ? `history-q${i}@1` : null,
      condition: i < 6 ? 'submitted' : 'manual'
    }))
  });
  for (let i = 0; i < 6; i++) {
    put(`history-f${i}`, 'question.focus', { conversationId: 'history-c', questionKey: `history-q${i}@1` });
    put(`history-a${i}`, 'attempt.submit', { conversationId: 'history-c', answer: i < 2 ? '999' : String(i + 10) });
  }
  put('history-hint', 'hint.add', { conversationId: 'history-c', content: '先拆分个位与十位。' });
  put('history-revision', 'attempt.submit', { conversationId: 'history-c', answer: '15' });
  for (let i = 0; i < messages; i++)
    put(`history-msg${i}`, 'message.add', {
      conversationId: 'history-c',
      role: 'user',
      content: `隔离消息${i}：${'学'.repeat(characters)}`
    });
  return batch.finish();
}
