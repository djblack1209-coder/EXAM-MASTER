import { tab, shared, out } from './probe-lib.mjs';
for (const locked of [false, true]) {
  const s = shared();
  let tail = Promise.resolve();
  const locks = locked
    ? {
        request: (_n, _o, write) => {
          const next = tail.then(write);
          tail = next.catch(() => {});
          return next;
        }
      }
    : undefined;
  const a = await tab(s, 'round7-a', locks),
    b = await tab(s, 'round7-b', locks);
  await a.login(1);
  let reached = false;
  s.hooks.push({
    name: a.name,
    phase: 'beforeSet',
    key: '__exam_storage__:EXAM_LOGIN_ATTEMPT',
    run: () => {
      reached = true;
      b.logout();
    }
  });
  let rejected = false;
  try {
    await a.login(1);
  } catch {
    rejected = true;
  }
  const c = await tab(s, 'round7-c', locks);
  out(
    `order-07-01 registration cannot adopt logout fence locks=${locked}`,
    reached && rejected && c.auth.captureSession()?.owner === 'guest'
  );
  await b.login(2);
  const d = await tab(s, 'round7-d', locks);
  out(`normal login after logout locks=${locked}`, d.auth.captureSession()?.owner === 'account-2');
  for (const t of [a, b, c, d]) t.close();
}
