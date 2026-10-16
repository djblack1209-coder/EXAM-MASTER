import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root = process.env.YOZI_SESSION_SOURCE_ROOT || process.cwd();
const noop = () => {};
const out = (name, ok) => process.stdout.write(JSON.stringify({ name, ok }) + '\n');
function shared() {
  return { map: new Map(), events: [], hooks: [], tabs: [] };
}
async function tab(shared, name, locks) {
  const listeners = new Map(),
    timers = new Map();
  let timerId = 0;
  const host = { name, close: () => timers.clear() };
  shared.tabs.push(host);
  const eventTarget = {
    addEventListener: (k, f) => {
      if (!listeners.has(k)) listeners.set(k, new Set());
      listeners.get(k).add(f);
    },
    removeEventListener: (k, f) => listeners.get(k)?.delete(f)
  };
  host.deliver = (e) => {
    for (const f of [...(listeners.get('storage') || [])]) f({ ...e, storageArea: local });
  };
  const runHook = (phase, key, value) => {
    const h = shared.hooks.find((h) => h.name === name && h.phase === phase && h.key === key);
    if (h) {
      shared.hooks.splice(shared.hooks.indexOf(h), 1);
      h.run(value);
    }
  };
  const local = {
    get length() {
      return shared.map.size;
    },
    key: (i) => [...shared.map.keys()][i] ?? null,
    getItem(k) {
      runHook('beforeGet', k);
      const v = shared.map.get(k) ?? null;
      runHook('afterGet', k, v);
      return v;
    },
    setItem(k, v) {
      runHook('beforeSet', k, v);
      const oldValue = shared.map.get(k) ?? null;
      shared.map.set(k, String(v));
      if (oldValue !== String(v)) shared.events.push({ source: name, key: k, oldValue, newValue: String(v) });
      runHook('afterSet', k, v);
    },
    removeItem(k) {
      runHook('beforeRemove', k);
      const oldValue = shared.map.get(k) ?? null;
      shared.map.delete(k);
      if (oldValue !== null) shared.events.push({ source: name, key: k, oldValue, newValue: null });
      runHook('afterRemove', k);
    },
    clear() {
      shared.map.clear();
      shared.events.push({ source: name, key: null, oldValue: null, newValue: null });
    }
  };
  host.local = local;
  const context = vm.createContext({
    console: { log: noop, warn: noop, error: noop },
    crypto,
    TextEncoder,
    TextDecoder,
    AbortController,
    URL,
    localStorage: local,
    window: { ...eventTarget, localStorage: local },
    navigator: locks ? { locks } : {},
    structuredClone,
    setTimeout: (f) => {
      timers.set(++timerId, f);
      return timerId;
    },
    clearTimeout: (i) => timers.delete(i),
    setInterval: () => ++timerId,
    clearInterval: noop
  });
  host.context = context;
  host.flush = () => {
    for (const [id, f] of [...timers]) {
      timers.delete(id);
      f();
    }
  };
  const mocks = new Map([
    ['@/utils/logger.js', { logger: { log: noop, warn: noop, error: noop, debug: noop, info: noop } }],
    ['@/utils/toast.js', { toast: { info: noop } }],
    ['@/utils/field-normalizer.js', { offlineMistakeToBackend: noop }],
    ['./learning/history-storage.js', { readLocalHistory: noop }],
    [
      './api/domains/practice.api.js',
      Object.fromEntries(
        [
          'addMistake',
          'getMistakes',
          'removeMistake',
          'batchRemoveMistakes',
          'updateMistakeFields',
          'batchSyncMistakes'
        ].map((k) => [k, noop])
      )
    ],
    [
      './quiz-session-contract.js',
      Object.fromEntries(
        ['QUIZ_REVIEW_HANDOFF_KEY', 'createQuizReviewHandoff', 'readQuizReviewHandoff', 'selectQuizQuestionsById'].map(
          (k) => [k, noop]
        )
      )
    ],
    [
      '../../laf-backend/functions/_shared/learning-quiz-original.js',
      { captureQuizOriginal: noop, quizOriginalIdentity: noop }
    ]
  ]);
  const modules = new Map();
  function synth(id, values) {
    if (!modules.has(id)) {
      const m = new vm.SyntheticModule(
        Object.keys(values),
        function () {
          for (const [k, v] of Object.entries(values)) this.setExport(k, v);
        },
        { context, identifier: id }
      );
      modules.set(id, m);
    }
    return modules.get(id);
  }
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    const m = new vm.SourceTextModule(await fs.readFile(file, 'utf8'), { context, identifier: file });
    modules.set(file, m);
    await m.link(async (spec, parent) => {
      if (mocks.has(spec)) return synth(spec, mocks.get(spec));
      if (parent.identifier.endsWith('/cipher.js') && spec.endsWith('/config/index.js'))
        return synth('config', { default: { security: { obfuscationKey: 'value-1' }, isProd: false, env: 'test' } });
      if (spec.endsWith('/logger.js'))
        return synth('logger', { logger: { log: noop, warn: noop, error: noop, debug: noop, info: noop } });
      return load(path.resolve(path.dirname(parent.identifier), spec));
    });
    return m;
  }
  const m = await load(root + '/src/services/storageService.js');
  await m.evaluate();
  host.storage = m.namespace.storageService;
  host.auth = modules.get(root + '/src/services/auth-storage.js').namespace;
  host.cipher = modules.get(root + '/src/utils/crypto/cipher.js').namespace;
  host.login = (n) =>
    host.storage.saveLoginSession({ userId: 'account-' + n, token: 'value-' + n, userInfo: { id: 'account-' + n } });
  host.logout = () => host.storage._clearRevokedCredentials();
  return host;
}

export { tab, shared, out };
