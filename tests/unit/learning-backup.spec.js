import { describe, it, expect } from 'vitest';
import { createLearningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import {
  emptyLearningState,
  dayKey,
  applyLearningOperation,
  summarizeLearning
} from '@/services/learning/learning-domain.js';
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
  it.each([
    ...['plan.set', 'timezone.set'].flatMap((type) =>
      [
        ['array', ['UTC']],
        ['number', 24],
        ['null', null],
        ['empty', ''],
        ['overlong', 'U'.repeat(81)],
        ['unknown', 'Invalid/Zone']
      ].map(([label, timezone]) => ({ type, label, fields: { timezone } }))
    ),
    { type: 'timezone.set', label: 'missing', fields: {} }
  ])('全新时区操作拒绝非法输入 $type/$label，错误码为 INVALID_INPUT 且不写入', ({ type, label, fields }) => {
    const { repo } = repository();
    repo.commit({ id: `valid-zone-plan-${type}-${label}`, type: 'plan.set', at, data: { tasks: [] } });
    const before = repo.read();
    const snapshot = structuredClone(before);
    const operation = {
      id: `fresh-invalid-zone-${type}-${label}`,
      type,
      at,
      data: type === 'plan.set' ? { tasks: [], ...fields } : fields
    };
    const message = type === 'plan.set' ? '计划时区不合法' : '学习时区不合法';
    expect(() => applyLearningOperation(before, operation)).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT', message })
    );
    expect(before).toEqual(snapshot);
    expect(() => repo.commit({ ...operation, id: `repository-invalid-zone-${type}-${label}` })).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT', message })
    );
    expect(repo.read()).toEqual(snapshot);
  });
  it.each(['UTC', 'US/Pacific', '+23:00'])('账户与计划沿用相同的运行时时区接受范围 %s', (timezone) => {
    const initial = emptyLearningState('u1');
    const account = applyLearningOperation(initial, {
      id: 'account-zone',
      type: 'timezone.set',
      at,
      data: { timezone }
    });
    const plan = applyLearningOperation(account.state, {
      id: 'plan-zone',
      type: 'plan.set',
      at,
      data: { tasks: [], timezone }
    });
    expect(account.state.timezone).toBe(timezone);
    expect(plan.state.plans[0]).toMatchObject({ timezone, day: dayKey(at, timezone) });
    const inherited = applyLearningOperation(plan.state, {
      id: `plan-account-zone-${timezone}`,
      type: 'plan.set',
      at,
      data: { tasks: [] }
    });
    expect(inherited.state.timezone).toBe(timezone);
    expect(inherited.state.plans.at(-1)).toMatchObject({ timezone, day: dayKey(at, timezone) });
  });
  it.each(['UTC', 'Asia/Shanghai', 'America/New_York', 'America/Los_Angeles'])(
    '%s 安排后改时区，恢复仍保留原计划的日期、时区和幂等身份',
    (timezone) => {
      const { repo } = repository(emptyLearningState('u1', timezone));
      const at = Date.parse('2026-11-01T06:30:00Z');
      const plan = {
        id: 'origin-zone-plan',
        type: 'plan.set',
        at,
        data: { tasks: [{ id: 'origin-task', title: '保留原日历', condition: 'manual' }] }
      };
      repo.commit(plan);
      const original = structuredClone(repo.read().plans[0]);
      const changedTimezone = timezone === 'Asia/Shanghai' ? 'America/Los_Angeles' : 'Asia/Shanghai';
      repo.commit({ id: 'changed-zone', type: 'timezone.set', at: at + 1000, data: { timezone: changedTimezone } });
      expect(repo.commit(plan).reused).toBe(true);
      const facts = repo.read();
      const restored = prepareLearningRestore(emptyLearningState('u1', changedTimezone), JSON.stringify(facts), {
        now: at + 2000
      });
      expect(restored.state.plans[0]).toEqual(original);
      expect(restored.state).toEqual(facts);
      expect(() => repo.commit({ ...plan, data: { ...plan.data, timezone: 'Invalid/Zone' } })).toThrow();
      expect(repo.read()).toEqual(facts);
    }
  );
  it('整批计划捕获原时区；换时区后重复整批和旧无时区操作都不改身份', () => {
    const { repo } = repository(emptyLearningState('u1', 'America/New_York'));
    const operation = { id: 'batch-zone', type: 'plan.set', at: Date.now(), data: { tasks: [] } };
    repo.commitBatch([operation], 0);
    expect(repo.read().events[0].data.timezone).toBe('America/New_York');
    repo.commit({ id: 'batch-zone-change', type: 'timezone.set', data: { timezone: 'Asia/Shanghai' } });
    const before = repo.read();
    expect(repo.commitBatch([operation], before.revision).reused).toBe(true);
    expect(repo.read()).toEqual(before);
    expect(() => repo.commit({ ...operation, id: 'bad-zone', data: { tasks: [], timezone: null } })).toThrow();
    expect(repo.read()).toEqual(before);
    const legacy = applyLearningOperation(emptyLearningState('u1', 'UTC'), operation).state;
    const old = repository(legacy).repo;
    expect(old.commit(operation).reused).toBe(true);
    expect(old.read()).toEqual(legacy);
    expect(old.read().events[0].data).not.toHaveProperty('timezone');
  });
  it('确认绑定本次预览的完整正文，旧预览不能用于另一份有效备份', () => {
    const { repo } = repository();
    const a = JSON.stringify(fixture());
    const b = JSON.stringify(
      applyLearningOperation(fixture(), {
        id: 'different-backup',
        type: 'message.add',
        at,
        data: { conversationId: 'op0', role: 'user', content: '第二份备份的额外操作' }
      }).state
    );
    const preview = repo.previewRestore(a);
    expect(() => repo.restoreData(b, preview)).toThrow('预览');
    expect(repo.read().events).toHaveLength(0);
    expect(repo.restoreData(a, preview).imported).toBe(8);
    expect(repo.read().events.some((event) => event.id === 'different-backup')).toBe(false);
  });
  it('新预览和同版本记录重建使旧确认失效，新预览仍可完整恢复', () => {
    const { repo, storage, records } = repository();
    const content = JSON.stringify(fixture());
    const old = repo.previewRestore(content);
    const fresh = repo.previewRestore(content);
    expect(() => repo.restoreData(content, old)).toThrow('预览');
    storage.remove = (key) => {
      records.delete(key);
      return true;
    };
    repo.deleteData();
    storage.save(LEARNING_KEY, emptyLearningState('u1'));
    expect(() => repo.restoreData(content, fresh)).toThrow('预览');
    const current = repo.previewRestore(content);
    expect(repo.restoreData(content, current).imported).toBe(8);
  });
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
