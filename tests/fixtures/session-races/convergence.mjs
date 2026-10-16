import { tab, shared, out } from './probe-lib.mjs';
function serialLocks() {
  let held = false;
  const queue = [];
  function next() {
    held = false;
    queue.shift()?.();
  }
  return {
    request(_name, _options, fn) {
      return new Promise((resolve, reject) => {
        const run = () => {
          held = true;
          try {
            Promise.resolve(fn()).then(resolve, reject).finally(next);
          } catch (e) {
            reject(e);
            next();
          }
        };
        if (held) queue.push(run);
        else run();
      });
    }
  };
}
const epochKey = '__exam_storage__:_enc_EXAM_SESSION_EPOCH';
for (const kind of ['profile', 'refresh', 'plaintext', 'legacy']) {
  const s = shared(),
    locks = serialLocks();
  const a = await tab(s, 'a', locks),
    b = await tab(s, 'b', locks);
  await a.login(1);
  await Promise.resolve();
  const original = a.auth.captureSession();
  if (kind === 'plaintext' || kind === 'legacy') {
    const record = a.cipher.deobfuscate(JSON.parse(s.map.get(epochKey)).value);
    s.map.delete(epochKey);
    s.map.delete('__exam_storage__:EXAM_SESSION_ENABLED');
    s.map.set(
      '__exam_storage__:EXAM_SESSION_EPOCH',
      JSON.stringify({ value: kind === 'plaintext' ? record : record.epoch })
    );
  }
  let peer;
  s.hooks.push({
    name: 'a',
    phase: 'beforeSet',
    key: epochKey,
    run() {
      peer = b.login(2);
    }
  });
  if (kind === 'profile') await a.storage.save('userInfo', { id: 'account-1', nickname: 'origin' }, true, original);
  if (kind === 'refresh') await a.storage.save('EXAM_TOKEN', 'fixture-refreshed', true, original);
  if (kind === 'plaintext' || kind === 'legacy') {
    a.storage.get('EXAM_SESSION_EPOCH');
    await a.storage.getSessionEpoch();
  }
  if (peer) await peer.catch(() => undefined);
  // Drain migrations scheduled by synchronous reads.
  await locks.request('exam-master:login-session-v1', {}, () => {});
  out(
    kind === 'profile'
      ? 'regress-1_order-1_profile-CAS'
      : kind === 'refresh'
        ? 'order-1_refresh-CAS'
        : `migrate-02_${kind}-CAS`,
    !!peer &&
      b.auth.captureSession()?.owner === 'account-2' &&
      a.auth.checkSession(original) === 'changed' &&
      b.storage.get('userInfo')?.id === 'account-2'
  );
  a.close();
  b.close();
}
{
  const s = shared(),
    locks = serialLocks();
  const a = await tab(s, 'a', locks),
    b = await tab(s, 'b', locks);
  await a.login(1);
  await Promise.resolve();
  let successor;
  s.hooks.push({
    name: 'a',
    phase: 'beforeSet',
    key: epochKey,
    run() {
      successor = b.login(3);
    }
  });
  const first = await a.login(2).then(
    () => true,
    () => false
  );
  const second = await successor.then(
    () => true,
    () => false
  );
  out('order-2_cancelled-login-successor', !first && second && a.auth.captureSession()?.owner === 'account-3');
  a.close();
  b.close();
}
