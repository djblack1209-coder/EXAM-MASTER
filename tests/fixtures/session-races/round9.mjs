import * as Vue from 'vue';
import * as Pinia from 'pinia';
import { tab, shared, out } from './probe-lib.mjs';
const s = shared();
let tail = Promise.resolve();
const locks = {
  request: (_name, _options, fn) => {
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  }
};
const a = await tab(s, 'round9-a', locks, 'h5'),
  b = await tab(s, 'round9-b', locks, 'h5');
await a.login(1);
const origin = a.auth.captureSession();
let during,
  notifications = 0;
a.storage.onIdentityChange(() => {
  notifications++;
});
s.hooks.push({
  name: b.name,
  phase: 'afterSet',
  key: '__exam_storage__:_enc_EXAM_SESSION_EPOCH',
  run: () => {
    during = a.auth.checkSession(origin);
  }
});
await b.storage.beginLoginAttempt();
out(
  'order-09-01 intermediate record is unavailable then current',
  during === 'unavailable' && a.auth.checkSession(origin) === 'current'
);
a.deliver({ key: '__exam_storage__:EXAM_IDENTITY_GENERATION', oldValue: '1', newValue: '2' });
out('order-09-01 generation notifies subscribers', notifications > 0);
const first = a.storage.beginLoginAttempt().catch((e) => e),
  second = a.storage.beginLoginAttempt().catch((e) => e);
const old = await first;
await second;
out('order-09-02 newer queued intent fences older', !a.storage.isLoginAttemptCurrent(old));
for (const host of [a, b]) {
  host.context.uni = { $on() {}, $off() {}, $emit() {} };
  host.mock('vue', Vue);
  host.mock('pinia', Pinia);
  host.mock('@/config/index.js', { default: { storage: { cacheKeys: { userInfo: 'userInfo' } } } });
  host.mock(
    '../../services/api/domains/user.api.js',
    Object.fromEntries(
      ['requestAccountDeletion', 'getAccountDeletionStatus', 'cancelAccountDeletion', 'updateProfile'].map((k) => [
        k,
        () => {}
      ])
    )
  );
  const module = await host.load('stores/modules/profile.js');
  Pinia.setActivePinia(Pinia.createPinia());
  host.profile = module.useProfileStore();
  host.profile.userInfo = host.storage.get('userInfo');
}
s.events.length = 0;
await b.login(2);
for (const event of s.events.filter((event) => event.source === b.name)) a.deliver(event);
out('order-09-03 actual cross-window profile restore', a.profile.userInfo?.id === 'account-2');
a.profile.$dispose();
b.profile.$dispose();
const qa = new (await a.load('utils/core/offline-queue.js')).OfflineQueue();
const qb = new (await b.load('utils/core/offline-queue.js')).OfflineQueue();
const one = await qa.enqueue({ requestData: { value: 1 } });
const two = await qb.enqueue({ requestData: { value: 2 } });
const stored = () => JSON.parse(s.map.get('__exam_offline_queue__:EXAM_OFFLINE_QUEUE') || '[]');
out(
  'migrate-09-02 locked two-window enqueue',
  stored().some((x) => x.id === one) && stored().some((x) => x.id === two)
);
await qa.dequeue(one);
out('migrate-09-02 locked id cancellation', stored().length === 1 && stored()[0].id === two);
await qb.clear();
let release;
await qa.enqueue({
  requestData: { value: 3 },
  requestFn: () =>
    new Promise((resolve) => {
      release = resolve;
    })
});
const processing = qa.processQueue();
for (let i = 0; i < 30 && !release; i++) await Promise.resolve();
await b.login(1);
const newer = await qb.enqueue({ requestData: { value: 4 } });
release({ success: true });
for (let i = 0; i < 60; i++) {
  await Promise.resolve();
  a.flush();
}
await processing;
out(
  'inflight-18-02 locked late response preserves new task',
  stored().some((x) => x.id === newer)
);
await qb.clear();
await qa.clear();
const sent = [];
const olderTask = await qa.enqueue({
  requestData: { value: 5 },
  dedupeKey: 'claim-race',
  requestFn: async () => {
    sent.push(5);
    return { success: true };
  }
});
const replacement = qb.enqueue({
  requestData: { value: 6 },
  dedupeKey: 'claim-race',
  requestFn: async () => {
    sent.push(6);
    return { success: true };
  }
});
const staleProcessing = qa.processQueue();
await replacement;
for (let i = 0; i < 80; i++) {
  await Promise.resolve();
  a.flush();
}
await staleProcessing;
out(
  'same-class pending replacement before locked claim cannot consume newer body',
  !sent.includes(5) && stored().some((x) => x.id === olderTask && x.requestData.value === 6)
);
const latestProcessing = qb.processQueue();
for (let i = 0; i < 80; i++) {
  await Promise.resolve();
  b.flush();
}
await latestProcessing;
out('normal latest pending replacement still sends its own body', sent.includes(6));
const canceledTask = await qa.enqueue({
  requestData: { value: 7 },
  requestFn: async () => {
    sent.push(7);
    return { success: true };
  }
});
qb._loadFromStorage();
const cancelBeforeClaim = qb.dequeue(canceledTask);
const canceledProcessing = qa.processQueue();
await cancelBeforeClaim;
for (let i = 0; i < 80; i++) {
  await Promise.resolve();
  a.flush();
}
await canceledProcessing;
out(
  'same-class cancellation before locked claim cannot send a canceled task',
  !sent.includes(7) && !stored().some((x) => x.id === canceledTask)
);
a.close();
b.close();
