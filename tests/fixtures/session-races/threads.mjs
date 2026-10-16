import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { tab, shared, out } from './probe-lib.mjs';
if (!isMainThread) {
  const words = new Int32Array(workerData.buffer, 0, 2),
    bytes = new Uint8Array(workerData.buffer, 8),
    decoder = new TextDecoder();
  const rpc = (method, args = []) => {
    Atomics.store(words, 0, 0);
    parentPort.postMessage({ kind: 'operation', method, args });
    Atomics.wait(words, 0, 0);
    return JSON.parse(decoder.decode(bytes.subarray(0, Atomics.load(words, 1))));
  };
  const s = shared();
  s.map = {
    get: (k) => rpc('get', [k]),
    set: (k, v) => rpc('set', [k, v]),
    delete: (k) => rpc('delete', [k]),
    has: (k) => rpc('has', [k]),
    clear: () => rpc('clear'),
    keys: () => rpc('keys')[Symbol.iterator](),
    get size() {
      return rpc('size');
    }
  };
  const a = await tab(s, workerData.name);
  parentPort.on('message', async ({ command, id }) => {
    let result;
    try {
      if (command === 'login' || command === 'login-same') {
        result = { accepted: !!a.login(command === 'login-same' ? 1 : workerData.number) };
        a.origin = a.auth.captureSession();
      }
      if (command === 'save-profile')
        result = { saved: a.storage.save('userInfo', { id: 'account-1', nickname: 'old' }, true, a.origin) };
      if (command === 'session-status') result = { status: a.auth.checkSession(a.origin) };
      if (command === 'inspect') {
        const snap = a.auth.readSessionSnapshot();
        const info = a.storage.get('userInfo', null);
        const session = a.auth.captureSession();
        const persisted = a.storage.save('account_profile_v1', info, true, session);
        result = {
          accepted: snap.status === 'current',
          credentialsConsistent: snap.session?.owner === 'account-1' && snap.token === 'value-1',
          profileConsistent: info?.id === 'account-1',
          persisted
        };
      }
    } catch {
      result = { accepted: false };
    }
    parentPort.postMessage({ kind: 'result', id, result });
  });
  parentPort.postMessage({ kind: 'ready' });
} else {
  const map = new Map(),
    tabs = [];
  let nextId = 0;
  function spawn(number) {
    const buffer = new SharedArrayBuffer(1024 * 1024),
      words = new Int32Array(buffer, 0, 2),
      bytes = new Uint8Array(buffer, 8);
    const w = new Worker(new URL(import.meta.url), { workerData: { name: 'window-' + number, number, buffer } });
    const t = { w, hold: null, pending: null, requests: new Map() };
    tabs.push(t);
    t.ready = new Promise((resolve) => {
      t.onReady = resolve;
    });
    function service(op) {
      let result = null;
      const [k, v] = op.args;
      if (op.method === 'get') result = map.get(k) ?? null;
      if (op.method === 'set') {
        map.set(k, v);
        result = true;
      }
      if (op.method === 'delete') result = map.delete(k);
      if (op.method === 'has') result = map.has(k);
      if (op.method === 'clear') {
        map.clear();
        result = true;
      }
      if (op.method === 'keys') result = [...map.keys()];
      if (op.method === 'size') result = map.size;
      const encoded = new TextEncoder().encode(JSON.stringify(result));
      bytes.set(encoded);
      Atomics.store(words, 1, encoded.length);
      Atomics.store(words, 0, 1);
      Atomics.notify(words, 0);
    }
    t.release = () => {
      const p = t.pending;
      t.pending = null;
      service(p);
    };
    t.until = (predicate) =>
      new Promise((resolve) => {
        t.hold = { predicate, resolve };
      });
    t.run = (command) =>
      new Promise((resolve) => {
        const id = ++nextId;
        t.requests.set(id, resolve);
        w.postMessage({ command, id });
      });
    w.on('message', (m) => {
      if (m.kind === 'ready') t.onReady();
      if (m.kind === 'result') {
        t.requests.get(m.id)(m.result);
        t.requests.delete(m.id);
      }
      if (m.kind === 'operation') {
        if (t.hold?.predicate(m)) {
          t.pending = m;
          const r = t.hold.resolve;
          t.hold = null;
          r();
        } else service(m);
      }
    });
    return t;
  }
  const a = spawn(1),
    b = spawn(2);
  await Promise.all([a.ready, b.ready]);
  try {
    if (process.argv.includes('--fallback')) {
      for (const command of ['login-same', 'login']) {
        await a.run('login');
        const paused = a.until((m) => m.method === 'set' && m.args[0] === '__exam_storage__:_enc_EXAM_SESSION_EPOCH');
        const oldWrite = a.run('save-profile');
        await paused;
        const successor = await b.run(command);
        const invalidBefore = await b.run('session-status');
        a.release();
        await oldWrite;
        const old = await a.run('session-status');
        out(
          'order-01_fallback_' + command,
          successor.accepted && invalidBefore.status === 'current' && old.status === 'changed'
        );
      }
    } else {
      const pausedProfile = b.until((m) => m.method === 'set' && m.args[0] === '__exam_storage__:_enc_userInfo');
      const second = b.run('login');
      await pausedProfile;
      const first = await a.run('login');
      const pausedToken = b.until((m) => m.method === 'set' && m.args[0] === '__exam_storage__:_enc_EXAM_TOKEN');
      b.release();
      await Promise.race([pausedToken, second]);
      const inspected = await a.run('inspect');
      out(
        'R1-two-real-login-transactions-credentials',
        first.accepted && inspected.accepted && inspected.credentialsConsistent
      );
      out('R1-two-real-login-transactions-profile', inspected.profileConsistent);
      const data = JSON.parse(map.get('__exam_storage__:u_account-1_account_profile_v1') || 'null')?.value;
      out('R1-foreign-profile-never-enters-origin-partition', !(inspected.persisted && data?.id === 'account-2'));
      if (b.pending) b.release();
      await second;
    }
  } finally {
    await Promise.all(tabs.map((t) => t.w.terminate()));
  }
}
