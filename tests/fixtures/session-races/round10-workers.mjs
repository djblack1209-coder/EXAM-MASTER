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
    request: (_n, _o, fn) => {
      const id = ++sequence;
      return new Promise((resolve) => {
        grants.set(id, resolve);
        parentPort.postMessage({ kind: 'lock', id });
      })
        .then(fn)
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
  const t = await tab(s, 'round10', locks, 'h5');
  parentPort.on('message', async (message) => {
    if (message.kind === 'grant') {
      grants.get(message.id)();
      grants.delete(message.id);
      return;
    }
    if (message.kind !== 'run') return;
    let result;
    try {
      if (message.command === 'login') {
        await t.login(message.account);
        result = true;
      }
      if (message.command === 'register') {
        await t.storage.beginLoginAttempt();
        result = true;
      }
      if (message.command === 'inspect') {
        const snap = t.auth.readSessionSnapshot();
        result = { status: snap.status, owner: snap.session?.owner, token: snap.token, generation: snap.generation };
      }
    } catch (error) {
      result = { code: error.code, failed: true };
    }
    parentPort.postMessage({ kind: 'result', id: message.id, result });
  });
  parentPort.postMessage({ kind: 'ready' });
} else {
  const map = new Map(),
    queue = [],
    workers = [];
  let owner,
    sequence = 0;
  const grant = () => {
    if (owner || !queue.length) return;
    owner = queue.shift();
    owner.host.worker.postMessage({ kind: 'grant', id: owner.id });
  };
  function spawn() {
    const buffer = new SharedArrayBuffer(1048576),
      signal = new Int32Array(buffer, 0, 2),
      bytes = new Uint8Array(buffer, 8);
    const host = { worker: new Worker(new URL(import.meta.url), { workerData: { buffer } }), pending: new Map() };
    workers.push(host);
    host.ready = new Promise((resolve) => {
      host.onReady = resolve;
    });
    host.run = (command, account) =>
      new Promise((resolve) => {
        const id = ++sequence;
        host.pending.set(id, resolve);
        host.worker.postMessage({ kind: 'run', id, command, account });
      });
    host.crashBoundary = () =>
      new Promise((resolve) => {
        host.crash = resolve;
      });
    host.worker.on('message', (m) => {
      if (m.kind === 'ready') host.onReady();
      if (m.kind === 'result') {
        host.pending.get(m.id)?.(m.result);
        host.pending.delete(m.id);
      }
      if (m.kind === 'lock') {
        queue.push({ host, id: m.id });
        grant();
      }
      if (m.kind === 'unlock') {
        if (owner?.host === host && owner.id === m.id) owner = null;
        grant();
      }
      if (m.kind !== 'storage') return;
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
      if (host.crash && m.method === 'set' && key === '__exam_storage__:_enc_EXAM_SESSION_EPOCH') {
        // Actual writer stops after durable record, before its generation commit and lock release.
        const resume = host.crash;
        host.crash = null;
        resume();
        return;
      }
      const encoded = new TextEncoder().encode(JSON.stringify(result));
      bytes.set(encoded);
      Atomics.store(signal, 1, encoded.length);
      Atomics.store(signal, 0, 1);
      Atomics.notify(signal, 0);
    });
    return host;
  }
  const terminate = async (host) => {
    await host.worker.terminate();
    for (const resolve of host.pending.values()) resolve({ terminated: true });
    host.pending.clear();
    if (owner?.host === host) owner = null;
    grant();
  };
  try {
    const a = spawn();
    await a.ready;
    await a.run('login', 1);
    const crash = a.crashBoundary(),
      write = a.run('register');
    await crash;
    await terminate(a);
    await write;
    const b = spawn();
    await b.ready;
    out('order-10-02 independent crash leaves unavailable record', (await b.run('inspect')).status === 'unavailable');
    const recovered = await b.run('register'),
      guest = await b.run('inspect');
    out(
      'order-10-02 new context revokes abandoned commit under lock',
      recovered === true && guest.status === 'current' && guest.owner === 'guest' && !guest.token
    );
    const loggedIn = await b.run('login', 2),
      c = spawn();
    await c.ready;
    const reopened = await c.run('inspect');
    out(
      'order-10-02 fresh login survives another reopen',
      loggedIn === true && reopened.status === 'current' && reopened.owner === 'account-2'
    );
  } finally {
    for (const host of workers) await terminate(host);
  }
}
