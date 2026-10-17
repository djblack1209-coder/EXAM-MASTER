import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { tab, shared, out } from './probe-lib.mjs';
if (!isMainThread) {
  const signal = new Int32Array(workerData.buffer, 0, 2),
    bytes = new Uint8Array(workerData.buffer, 8);
  const rpc = (method, args = []) => {
    Atomics.store(signal, 0, 0);
    parentPort.postMessage({ kind: 'storage', method, args });
    Atomics.wait(signal, 0, 0);
    return JSON.parse(new TextDecoder().decode(bytes.subarray(0, Atomics.load(signal, 1))));
  };
  let sequence = 0;
  const grants = new Map();
  const locks = {
    request: (_name, _options, write) => {
      const id = ++sequence;
      return new Promise((resolve) => {
        grants.set(id, resolve);
        parentPort.postMessage({ kind: 'lock', id });
      })
        .then(write)
        .finally(() => parentPort.postMessage({ kind: 'unlock', id }));
    }
  };
  const s = shared();
  s.map = {
    get: (k) => rpc('get', [k]),
    set: (k, v) => rpc('set', [k, v]),
    delete: (k) => rpc('delete', [k]),
    keys: () => rpc('keys')[Symbol.iterator](),
    get size() {
      return rpc('size');
    }
  };
  const t = await tab(s, 'worker', locks, 'h5');
  let attempt, origin;
  parentPort.on('message', async (m) => {
    if (m.kind === 'grant') {
      grants.get(m.id)();
      grants.delete(m.id);
      return;
    }
    if (m.kind !== 'run') return;
    let result;
    try {
      if (m.command === 'login') {
        await t.login(m.account);
        origin = t.auth.captureSession();
        result = true;
      }
      if (m.command === 'register') {
        attempt = await t.storage.beginLoginAttempt();
        result = true;
      }
      if (m.command === 'commit') {
        await t.storage.saveLoginSession({ userId: `account-${m.account}`, token: `value-${m.account}` }, attempt);
        result = true;
      }
      if (m.command === 'profile')
        result = await t.storage.save('userInfo', { id: 'account-1', nickname: 'old' }, true, origin);
      if (m.command === 'logout') result = await t.logout();
      if (m.command === 'inspect') {
        const snap = t.auth.readSessionSnapshot();
        result = {
          owner: snap.session?.owner,
          generation: snap.generation,
          status: snap.status,
          old: origin ? t.auth.checkSession(origin) : null
        };
      }
    } catch {
      result = false;
    }
    parentPort.postMessage({ kind: 'result', id: m.id, result });
  });
  parentPort.postMessage({ kind: 'ready' });
} else {
  const map = new Map(),
    jobs = [],
    workers = [];
  let owner = null,
    id = 0;
  function grant() {
    if (owner || !jobs.length) return;
    owner = jobs.shift();
    owner.worker.postMessage({ kind: 'grant', id: owner.id });
  }
  function spawn() {
    const buffer = new SharedArrayBuffer(1024 * 1024),
      signal = new Int32Array(buffer, 0, 2),
      bytes = new Uint8Array(buffer, 8);
    const worker = new Worker(new URL(import.meta.url), { workerData: { buffer } });
    const t = { worker, pending: new Map(), holdNext: false, held: null };
    workers.push(t);
    t.ready = new Promise((resolve) => {
      t.readyResolve = resolve;
    });
    t.pause = () =>
      new Promise((resolve) => {
        t.holdNext = true;
        t.paused = resolve;
      });
    t.release = () => {
      jobs.push(t.held);
      t.held = null;
      grant();
    };
    t.run = (command, account) =>
      new Promise((resolve) => {
        const request = ++id;
        t.pending.set(request, resolve);
        worker.postMessage({ kind: 'run', id: request, command, account });
      });
    worker.on('message', (m) => {
      if (m.kind === 'ready') t.readyResolve();
      if (m.kind === 'result') {
        t.pending.get(m.id)(m.result);
        t.pending.delete(m.id);
      }
      if (m.kind === 'lock') {
        const job = { worker, id: m.id };
        if (t.holdNext) {
          t.holdNext = false;
          t.held = job;
          t.paused();
        } else {
          jobs.push(job);
          grant();
        }
      }
      if (m.kind === 'unlock') {
        if (owner?.worker === worker && owner.id === m.id) owner = null;
        grant();
      }
      if (m.kind === 'storage') {
        const [key, value] = m.args;
        let result = null;
        if (m.method === 'get') result = map.get(key) ?? null;
        if (m.method === 'set') {
          map.set(key, value);
          result = true;
        }
        if (m.method === 'delete') result = map.delete(key);
        if (m.method === 'keys') result = [...map.keys()];
        if (m.method === 'size') result = map.size;
        const encoded = new TextEncoder().encode(JSON.stringify(result));
        bytes.set(encoded);
        Atomics.store(signal, 1, encoded.length);
        Atomics.store(signal, 0, 1);
        Atomics.notify(signal, 0);
      }
    });
    return t;
  }
  const a = spawn(),
    b = spawn();
  try {
    await Promise.all([a.ready, b.ready]);
    for (const kind of ['register', 'logout', 'profile-same', 'profile-switch']) {
      await a.run('login', 1);
      const paused = a.pause();
      const old = a.run(kind.startsWith('profile') ? 'profile' : kind);
      await paused;
      const account = kind === 'profile-same' ? 1 : 2;
      const successor = await b.run('login', account);
      const middle = await b.run('inspect');
      a.release();
      const oldResult = await old,
        after = await b.run('inspect');
      const c = spawn();
      await c.ready;
      const reopened = await c.run('inspect');
      out(
        `order-08 ${kind} locked independent workers`,
        successor &&
          middle.owner === `account-${account}` &&
          oldResult === false &&
          after.owner === middle.owner &&
          reopened.owner === middle.owner &&
          after.generation === middle.generation
      );
      await c.worker.terminate();
    }
    await a.run('login', 1);
    const before = await a.run('inspect');
    const saved = await a.run('profile');
    const after = await a.run('inspect');
    out(
      'normal locked profile keeps binding and advances generation',
      saved && after.old === 'current' && after.generation === before.generation + 1
    );
  } finally {
    await Promise.all(workers.map((t) => t.worker.terminate()));
  }
}
