import { tab, shared, out } from './probe-lib.mjs';
for (const kind of ['registration', 'logout']) {
  const s = shared(),
    a = await tab(s, 'round8-a', undefined, 'h5'),
    b = await tab(s, 'round8-b', undefined, 'h5');
  try {
    await a.login(1);
  } catch (error) {
    out(
      `order-08-${kind === 'registration' ? '02' : '03'} unsafe browser fails closed`,
      error.code === 'BROWSER_UPGRADE_REQUIRED' && a.auth.captureSession()?.owner === 'guest'
    );
    a.close();
    b.close();
    continue;
  }
  let next,
    reached = false;
  s.hooks.push({
    name: a.name,
    phase: 'beforeSet',
    key: '__exam_storage__:EXAM_LOGIN_ATTEMPT',
    run: () => {
      reached = true;
      next = kind === 'registration' ? b.storage.beginLoginAttempt() : b.login(2);
    }
  });
  if (kind === 'registration') {
    try {
      await a.storage.beginLoginAttempt();
    } catch {}
    out('order-08-02 late registration preserves newer', reached && b.storage.isLoginAttemptCurrent(await next));
  } else {
    try {
      await a.logout();
    } catch {}
    await next;
    out('order-08-03 late cleanup preserves newer', reached && b.auth.captureSession()?.owner === 'account-2');
  }
  a.close();
  b.close();
}
