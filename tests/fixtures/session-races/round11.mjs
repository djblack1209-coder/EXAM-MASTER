import * as Vue from 'vue';
import * as Pinia from 'pinia';
import { tab, shared, out } from './probe-lib.mjs';

for (const action of ['logout', 'successor-login', 'renewal']) {
  const s = shared();
  let tail = Promise.resolve(),
    arm = false,
    release,
    reached;
  const paused = new Promise((resolve) => {
    reached = resolve;
  });
  const locks = (canPause) => ({
    request: (_name, _options, fn) => {
      const pause = canPause && arm;
      if (pause) arm = false;
      const next = tail.then(fn);
      // Release the exclusive lock before pausing the caller's Promise continuation.
      tail = next.catch(() => {});
      return pause
        ? next.then((value) => {
            reached();
            return new Promise((resolve) => {
              release = () => resolve(value);
            });
          })
        : next;
    }
  });
  const a = await tab(s, 'round11-a', locks(true), 'h5');
  const b = await tab(s, 'round11-b', locks(false), 'h5');
  let auth;
  try {
    await a.login(1);
    const snapshot = a.auth.readSessionSnapshot();
    a.local.setItem(
      '__exam_storage__:_enc_EXAM_SESSION_EPOCH',
      JSON.stringify({
        value: a.cipher.obfuscate({ ...snapshot.record, generation: snapshot.generation + 1 })
      })
    );
    b.context.uni = { $on() {}, $off() {}, $emit() {} };
    b.mock('vue', Vue);
    b.mock('pinia', Pinia);
    b.mock('@/config/index.js', { default: { storage: { cacheKeys: { userInfo: 'userInfo' } } } });
    b.mock('@/i18n/index.js', { publicError: () => 'fixture' });
    b.mock('@/services/auth-region.js', { readLoginRegion: () => 'US' });
    b.mock('../../services/api/domains/auth.api.js', { sendEmailCode() {}, login() {}, desktopOAuth() {} });
    b.mock('@/utils/auth/token-refresh-plugin.js', { default: { stopPreCheckTimer() {} } });
    Pinia.setActivePinia(Pinia.createPinia());
    const authModule = await b.load('stores/modules/auth.js');
    arm = true;
    const pending = a.storage.beginLoginAttempt().catch((error) => error);
    await paused;
    auth = authModule.useAuthStore();
    if (action === 'logout') {
      const receipt = await auth.logout();
      if (!receipt.success || b.auth.captureSession()?.owner !== 'guest') throw new Error('logout fixture failed');
    } else if (action === 'successor-login') {
      await b.login(3);
    } else {
      if (!(await b.storage.save('EXAM_TOKEN', 'renewed-value', true))) throw new Error('renewal fixture failed');
    }
    const winner = b.auth.readSessionSnapshot();
    release();
    const attempt = await pending;
    let rejected = false;
    try {
      await a.storage.saveLoginSession({ userId: 'account-2', token: 'value-2' }, attempt);
    } catch {
      rejected = true;
    }
    const after = b.auth.readSessionSnapshot();
    out(
      `fixes-20-01 / order-20-01: recovery continuation preserves ${action}`,
      rejected &&
        after.generation === winner.generation &&
        after.token === winner.token &&
        after.session?.owner === winner.session?.owner
    );
  } finally {
    release?.();
    auth?.$dispose();
    a.close();
    b.close();
  }
}
