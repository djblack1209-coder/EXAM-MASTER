import { tab, shared, out } from './probe-lib.mjs';
for (const successor of ['logout', 'login']) {
  const s = shared();
  let tail = Promise.resolve(),
    hold = false,
    release;
  const locks = {
    request: (_name, _options, write) => {
      const run = () => {
        const next = tail.then(write);
        tail = next.catch(() => undefined);
        return next;
      };
      if (hold) {
        hold = false;
        return new Promise((resolve, reject) => {
          release = () => run().then(resolve, reject);
        });
      }
      return run();
    }
  };
  const a = await tab(s, 'round6-a', locks, 'h5'),
    b = await tab(s, 'round6-b', locks, 'h5');
  await a.login(1);
  const old = a.auth.captureSession(),
    attempt = await a.storage.beginLoginAttempt();
  hold = true;
  const pending = a.storage
    .saveLoginSession({ userId: 'account-2', token: 'value-2', userInfo: { id: 'account-2' } }, attempt)
    .catch(() => false);
  if (successor === 'logout') await b.logout();
  else await b.login(3);
  release();
  const rejected = (await pending) === false;
  const c = await tab(s, 'round6-c', locks, 'h5');
  out(
    successor === 'logout' ? 'order-01-logout-before-first-mutation' : 'order-02-newer-queued-before-first-mutation',
    rejected &&
      (successor === 'logout'
        ? a.auth.checkSession(old) === 'changed' &&
          c.auth.captureSession()?.owner === 'guest' &&
          !a.storage.save('late', 1, true, old)
        : c.auth.captureSession()?.owner === 'account-3')
  );
  a.close();
  b.close();
  c.close();
}
