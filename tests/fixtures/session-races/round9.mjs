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
const key = '__exam_offline_queue__:EXAM_OFFLINE_QUEUE';
const stored = () => JSON.parse(s.map.get(key) || '[]');
const seed = (host, id, value) => {
  s.map.set(
    key,
    JSON.stringify([
      ...stored(),
      {
        id,
        timestamp: Date.now(),
        retryCount: 0,
        priority: 'normal',
        session: host.auth.captureSession(),
        requestData: { value }
      }
    ])
  );
  return id;
};
const one = seed(a, 'legacy-one', 1),
  two = seed(b, 'legacy-two', 2);
const qa = new (await a.load('utils/core/offline-queue.js')).OfflineQueue();
const qb = new (await b.load('utils/core/offline-queue.js')).OfflineQueue();
await qa.dequeue(one);
out('migrate-09-02 locked id cancellation', stored().length === 1 && stored()[0].id === two);
await qb.clear();
let release;
seed(a, 'legacy-inflight', 3);
qa._loadFromStorage();
qa.registerRebuilder(
  () =>
    new Promise((resolve) => {
      release = resolve;
    })
);
const processing = qa.processQueue();
for (let i = 0; i < 60 && !release; i++) await Promise.resolve();
await b.login(1);
const newer = seed(b, 'legacy-new-account', 4);
release({ success: true });
for (let i = 0; i < 100; i++) {
  await Promise.resolve();
  a.flush();
}
await processing;
out(
  'inflight-18-02 locked late response preserves new task',
  stored().some((x) => x.id === newer)
);
qb._loadFromStorage();
await qb.clear();
await qa.clear();
const sent = [];
const canceledTask = seed(a, 'legacy-cancel', 7);
qa._loadFromStorage();
qa.registerRebuilder(async (body) => {
  sent.push(body.value);
  return { success: true };
});
qb._loadFromStorage();
const cancelBeforeClaim = qb.dequeue(canceledTask);
const canceledProcessing = qa.processQueue();
await cancelBeforeClaim;
for (let i = 0; i < 100; i++) {
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
