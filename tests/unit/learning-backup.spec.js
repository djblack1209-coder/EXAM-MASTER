import { describe, it, expect } from 'vitest';
import { createLearningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { emptyLearningState, applyLearningOperation, summarizeLearning } from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';

const at = Date.now() - 10000;
function fixture(authority = 'executable') {
  let state = emptyLearningState('u1', 'Asia/Shanghai');
  const ops = [
    ['conversation.start', { goal: '学习加法' }],
    [
      'question.add',
      {
        question: {
          id: 'q1',
          version: 1,
          prompt: '计算 12 + 8。',
          scope: 'generated',
          source: { kind: 'executable' },
          validation: { type: 'number', answer: '20', authority, evidenceId: 'ref' }
        }
      }
    ],
    ['question.focus', { conversationId: 'op0', questionKey: 'q1@1' }],
    ['plan.set', { tasks: [{ id: 't1', title: '独立检验', questionKey: 'q1@1', condition: 'independent_correct' }] }],
    ['attempt.submit', { conversationId: 'op0', answer: '19' }],
    ['hint.add', { conversationId: 'op0', content: '先算个位' }],
    ['attempt.submit', { conversationId: 'op0', answer: '20' }],
    ['review.schedule', { attemptId: 'op4', due: at + 86400000, rating: 1 }]
  ];
  for (const [i, [type, data]] of ops.entries())
    state = applyLearningOperation(state, { id: `op${i}`, type, data, at }).state;
  return state;
}
function repository(initial = emptyLearningState('u1')) {
  const records = new Map([[LEARNING_KEY, initial]]);
  const storage = {
    get: (key, fallback) => records.get(key) || fallback,
    save: (key, value) => {
      records.set(key, structuredClone(value));
      return true;
    },
    remove: (key) => records.delete(key)
  };
  return { repo: createLearningRepository(storage, () => 'u1'), records, storage };
}

describe('学习备份的安全恢复闭环', () => {
  it('预览不写入，合并重算首答、提示和计划，重复恢复不重复统计，可撤销', () => {
    const { repo } = repository();
    const content = JSON.stringify(fixture());
    const preview = repo.previewRestore(content);
    expect(preview).toMatchObject({ imported: 8, reused: 0, expectedRevision: 0 });
    expect(repo.read().events).toHaveLength(0);
    const outcome = repo.restoreData(content, preview.expectedRevision);
    expect(summarizeLearning(outcome.state).first).toMatchObject({ numerator: 1, denominator: 1 });
    expect(outcome.state.attempts[1]).toMatchObject({ kind: 'revision', hints: [{ content: '先算个位' }] });
    expect(outcome.state.plans[0].tasks[0].completedBy).toBeNull();
    const revision = repo.read().revision;
    expect(repo.restoreData(content, revision)).toMatchObject({ imported: 0, reused: 8 });
    expect(repo.read().revision).toBe(revision);
    expect(repo.rollback().events).toHaveLength(0);
    expect(repo.lifecycleRevision()).toBe(2);
  });
  it('忽略伪造的派生统计和作答判分，重算可执行答案', () => {
    const backup = fixture();
    backup.attempts[0].grade.outcome = 'correct';
    backup.attempts.push({ grade: { status: 'reliable', outcome: 'wrong' } });
    backup.events[1].data.question.validation.answer = '19';
    const result = prepareLearningRestore(emptyLearningState('u1'), JSON.stringify(backup));
    expect(result.state.attempts).toHaveLength(2);
    expect(result.state.attempts[0].grade.outcome).toBe('wrong');
    expect(result.state.questions[0].validation.answer).toBe('20');
  });
  it('没有独立验题器的私人答案降为待复核，复习暂停，第二次恢复仍幂等', () => {
    const backup = fixture();
    const q = backup.events[1].data.question;
    q.prompt = '解释一个抽象概念';
    q.scope = 'private';
    q.source = { kind: 'material' };
    q.validation = { type: 'number', answer: '20', authority: 'human_reviewed', evidenceId: 'untrusted-backup' };
    const { repo } = repository();
    const content = JSON.stringify(backup);
    expect(repo.previewRestore(content)).toMatchObject({ pendingReferences: 1, pendingReviews: 1 });
    const restored = repo.restoreData(content, 0).state;
    expect(summarizeLearning(restored).first.denominator).toBe(0);
    expect(restored.reviews).toHaveLength(0);
    expect(restored.executions[0].errorCode).toBe('BACKUP_REFERENCE_PENDING');
    expect(repo.restoreData(content, restored.revision).imported).toBe(0);
  });
  it('同标识不同内容拒绝覆盖，先预览后新增记录会使旧预览失效', () => {
    const original = fixture();
    const { repo } = repository(original);
    const backup = structuredClone(original);
    backup.events[4].data.answer = '18';
    expect(() => repo.previewRestore(JSON.stringify(backup))).toThrow('不同内容');
    expect(repo.read()).toEqual(original);
    const preview = repo.previewRestore(JSON.stringify(original));
    repo.commit({ id: 'new', type: 'conversation.start', data: { goal: '另一任务' }, at });
    expect(() => repo.restoreData(JSON.stringify(original), preview.expectedRevision)).toThrow('重新预览');
  });
  it.each([
    [
      '其他账户',
      (b) => {
        b.owner = 'u2';
      },
      '同一账户'
    ],
    [
      '未知版本',
      (b) => {
        b.version = 2;
      },
      '版本 1'
    ],
    [
      '密钥字段',
      (b) => {
        b.events[0].data.apiKey = 'test-not-a-key';
      },
      '敏感配置'
    ],
    [
      '原型字段',
      (b) => {
        b.events[0].data = JSON.parse('{"goal":"学习","__proto__":{"admin":true}}');
      },
      '不安全'
    ],
    [
      '未来时间',
      (b) => {
        b.events[0].at = Date.now() + 86400000;
      },
      '时间'
    ],
    [
      '重复操作',
      (b) => {
        b.events.push(b.events[0]);
      },
      '标识重复'
    ],
    [
      '未知根字段',
      (b) => {
        b.modelKeys = [];
      },
      '未知顶层'
    ]
  ])('拒绝%s并保留当前数据', (_name, change, message) => {
    const { repo } = repository();
    const backup = fixture();
    change(backup);
    expect(() => repo.restoreData(JSON.stringify(backup), 0)).toThrow(message);
    expect(repo.read().revision).toBe(0);
  });
  it('事实保存失败时保留前态和恢复副本、不宣称成功，撤销旧异步许可', () => {
    const { repo, storage, records } = repository();
    const save = storage.save;
    storage.save = (key, value) => (key === LEARNING_KEY ? false : save(key, value));
    expect(() => repo.restoreData(JSON.stringify(fixture()), 0)).toThrow('保存失败');
    expect(records.get(LEARNING_KEY).revision).toBe(0);
    expect(records.get(`${LEARNING_KEY}_recovery`).revision).toBe(0);
    expect(repo.lifecycleRevision()).toBe(1);
  });
  it('限制恢复资源并拒绝损坏 JSON', () => {
    expect(() => prepareLearningRestore(emptyLearningState('u1'), '{')).toThrow('JSON');
    expect(() => prepareLearningRestore(emptyLearningState('u1'), ' '.repeat(1500001))).toThrow('150 万');
    const backup = fixture();
    backup.events = Array.from({ length: 501 }, (_, i) => ({ ...backup.events[0], id: String(i) }));
    expect(() => prepareLearningRestore(emptyLearningState('u1'), JSON.stringify(backup))).toThrow('500');
    expect(() =>
      prepareLearningRestore(emptyLearningState('u1'), JSON.stringify(fixture()), { deadlineMs: -1 })
    ).toThrow('超时');
  });
});
