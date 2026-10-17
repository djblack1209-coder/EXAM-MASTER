import { tab, shared, out } from './probe-lib.mjs';
const p = '__exam_storage__:';
for (const successor of ['logout', 'login']) {
  const s = shared();
  let tail = Promise.resolve();
  const locks = {
    request: (_name, _options, write) => {
      const next = tail.then(write);
      tail = next.catch(() => undefined);
      return next;
    }
  };
  const a = await tab(s, 'round6-a', locks),
    b = await tab(s, 'round6-b', locks);
  await a.login(1);
  const old = a.auth.captureSession();
  let next,
    reached = false;
  // The final alias snapshot is after the first attempt check, before the first commit mutation.
  s.hooks.push({
    name: a.name,
    phase: 'afterGet',
    key: p + '_enc_EXAM_TOKEN',
    run: () => {
      reached = true;
      if (successor === 'logout') b.logout();
      else next = b.login(3);
    }
  });
  let rejected = false;
  try {
    await a.login(2);
  } catch {
    rejected = true;
  }
  if (next) {
    try {
      await next;
    } catch {}
  }
  const c = await tab(s, 'round6-c', locks);
  out(
    successor === 'logout' ? 'order-01-logout-before-first-mutation' : 'order-02-newer-queued-before-first-mutation',
    reached &&
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
