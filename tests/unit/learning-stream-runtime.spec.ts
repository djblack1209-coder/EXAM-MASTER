import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  controlLearningCall,
  cancelActiveLearningCall
} from '../../laf-backend/functions/_shared/learning-model-runtime.js';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function database(row = { calls: [{ id: 'same-id', status: 'reserved' }] } as any) {
  const queries: any[] = [];
  return {
    queries,
    row,
    collection: () => ({
      where: (query: any) => {
        queries.push(query);
        return { get: async () => ({ data: [row] }) };
      }
    })
  };
}
it('跨用户同ID、重复执行、主动取消均有独立生命周期，停止后不再轮询', async () => {
  const db = database(),
    a = controlLearningCall(db, 'owner-a', 'same-id'),
    b = controlLearningCall(db, 'owner-b', 'same-id');
  try {
    await a.start();
    await b.start();
    expect(() => controlLearningCall(db, 'owner-a', 'same-id')).toThrow('执行');
    cancelActiveLearningCall('owner-b', 'same-id');
    expect(b.signal.aborted).toBe(true);
    expect(a.signal.aborted).toBe(false);
    expect(db.queries.map((q) => q.user_id)).toEqual(['owner-a', 'owner-b']);
    a.stop();
    b.stop();
    const count = db.queries.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(db.queries).toHaveLength(count);
  } finally {
    a.stop();
    b.stop();
  }
});
it('其他进程写入取消标记后，下一次预算检查中断；数据库故障也停止执行', async () => {
  const db = database(),
    control = controlLearningCall(db, 'owner', 'same-id');
  try {
    await control.start();
    db.row.calls[0].cancelRequestedAt = 1;
    await vi.advanceTimersByTimeAsync(500);
    expect(control.signal.reason.code).toBe('CANCELLED');
  } finally {
    control.stop();
  }
  const failed = controlLearningCall(
    {
      collection: () => {
        throw new Error('fixture storage failure');
      }
    },
    'owner',
    'same-id'
  );
  try {
    await failed.start();
    expect(failed.signal.reason.code).toBe('ACCOUNT_UNAVAILABLE');
  } finally {
    failed.stop();
  }
});
it('响应仅正常结束不会取消已完成任务；中途断开则取消且释放监听器', async () => {
  const response: any = new EventEmitter();
  response.writableEnded = false;
  const control = controlLearningCall(database(), 'owner', 'same-id', response);
  try {
    await control.start();
    response.emit('close');
    expect(control.signal.reason.code).toBe('CANCELLED');
  } finally {
    control.stop();
  }
  expect(response.listenerCount('close')).toBe(0);
  const normal: any = new EventEmitter();
  normal.writableEnded = true;
  const completed = controlLearningCall(database(), 'owner', 'same-id', normal);
  try {
    normal.emit('close');
    expect(completed.signal.aborted).toBe(false);
  } finally {
    completed.stop();
  }
});
