import { tab, shared, out } from './probe-lib.mjs';

const state = shared();
const tails = new Map();
const locks = {
  request(name, _options, operation) {
    const next = (tails.get(name) || Promise.resolve()).then(operation);
    tails.set(
      name,
      next.catch(() => {})
    );
    return next;
  }
};
const a = await tab(state, 'notes-a', locks, 'h5');
const b = await tab(state, 'notes-b', locks, 'h5');
let release;
try {
  await a.login(1);
  // H5 can have no global uni object; both runtimes must use the storage adapter.
  const firstModule = await a.load('pages/practice-sub/question-note.js');
  const secondModule = await b.load('pages/practice-sub/question-note.js');
  let reached;
  const started = new Promise((resolve) => (reached = resolve));
  const paused = new Promise((resolve) => (release = resolve));
  const save = a.storage.save.bind(a.storage);
  a.storage.save = (key, ...args) => {
    if (key !== 'question_notes') return save(key, ...args);
    reached();
    return paused.then(() => save(key, ...args));
  };
  const first = firstModule.addQuestionNote({ questionId: 'q1', content: 'first tab' });
  await started;
  const second = secondModule.addQuestionNote({ questionId: 'q2', content: 'second tab' });
  // Let the other runtime reach the shared lock before releasing the first write.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  release();
  const receipts = await Promise.all([first, second]);
  const rows = b.storage.get('question_notes', []);
  out(
    'independent H5 tabs retain and confirm both notes',
    receipts.every((receipt) => receipt.success) &&
      rows.length === 2 &&
      receipts.every((receipt) => rows.some((row) => row.id === receipt.note.id))
  );
} finally {
  release?.();
  a.close();
  b.close();
}
