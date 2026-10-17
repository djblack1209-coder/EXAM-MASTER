import { captureSession } from '@/services/auth-storage.js';

let sequence = 0;
// Preinstalled legacy storage, never a production enqueue path. Each queue has one rebuilder.
export function seedLegacyTask(queue, { requestFn, ...fields } = {}) {
  const task = {
    id: `legacy-fixture-${Date.now()}-${++sequence}`,
    timestamp: Date.now(),
    retryCount: 0,
    priority: 'normal',
    state: 'pending',
    requestData: { fixture: true },
    session: captureSession(),
    ...fields
  };
  const key = 'EXAM_OFFLINE_QUEUE';
  uni.setStorageSync(key, [...(uni.getStorageSync(key) || []), task]);
  queue._loadFromStorage();
  if (requestFn) queue.registerRebuilder(requestFn);
  return task.id;
}
