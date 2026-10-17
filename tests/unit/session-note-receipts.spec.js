import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DoQuiz from '@/pages/practice-sub/do-quiz.vue';
import { questionNoteManager } from '@/pages/practice-sub/question-note.js';
import storageService from '@/services/storageService.js';
import { captureSession, sessionUnavailable } from '@/services/auth-storage.js';
import { toast } from '@/utils/toast.js';

vi.mock('@dcloudio/uni-app', () => ({ onShow() {}, onHide() {}, onLoad() {}, onBackPress() {} }));
const wrappers = [];
const login = (n = 1) => storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}` });
const draft = (content) => ({ questionId: 'q1', questionContent: 'Question 1', content, tags: ['key_point'] });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

beforeEach(async () => {
  uni.clearStorageSync();
  await login();
  Object.assign(questionNoteManager, new questionNoteManager.constructor());
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function page() {
  const wrapper = mount({
    template: '<div />',
    data: () => ({
      questions: [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ],
      currentIndex: 0,
      boundLoginSession: captureSession(),
      noteDraftGeneration: 0,
      noteContent: '',
      selectedNoteTags: [],
      showNoteModal: false,
      currentQuestionNotes: [],
      quizPageClosed: false,
      pendingTimers: []
    }),
    computed: {
      currentQuestion() {
        return this.questions[this.currentIndex];
      }
    },
    watch: DoQuiz.watch,
    methods: {
      handleOpenNote: DoQuiz.methods.handleOpenNote,
      handleSaveNote: DoQuiz.methods.handleSaveNote,
      invalidateNoteDraftReceipt: DoQuiz.methods.invalidateNoteDraftReceipt,
      clearComboFeedback() {},
      saveCurrentProgress() {},
      _restoreQuestionBankIfReview() {}
    }
  });
  wrappers.push(wrapper);
  wrapper.vm.handleOpenNote();
  wrapper.vm.noteContent = 'original draft';
  wrapper.vm.selectedNoteTags = ['key_point'];
  return wrapper.vm;
}

it('note origin binding rejects an old account draft instead of capturing the successor', async () => {
  const origin = page();
  await login(2);
  const success = vi.spyOn(toast, 'success');
  await origin.handleSaveNote();
  expect(success).not.toHaveBeenCalled();
  expect(storageService.get('question_notes', [])).toEqual([]);
  expect(uni.getStorageSync('u_account-1_question_notes')).toBeFalsy();
  expect(origin.noteContent).toBe('original draft');
  expect(origin.showNoteModal).toBe(true);
});

it.each(['switch', 'reopen', 'unload', 'edit', 'switch-back', 'cancel-reopen'])(
  'late note receipt preserves successor state after %s, including an unreadable refresh',
  async (change) => {
    const origin = page();
    const release = deferred();
    const save = storageService.save.bind(storageService);
    vi.spyOn(storageService, 'save').mockImplementation((...args) => release.promise.then(() => save(...args)));
    const success = vi.spyOn(toast, 'success');
    const pending = origin.handleSaveNote();
    if (change === 'switch' || change === 'switch-back') {
      origin.currentIndex = 1;
      if (change === 'switch-back') origin.currentIndex = 0;
    } else if (change === 'reopen') origin.handleOpenNote();
    else if (change === 'cancel-reopen') {
      origin.showNoteModal = false;
      origin.showNoteModal = true;
    } else if (change === 'unload') DoQuiz.onUnload.call(origin);
    if (change !== 'switch-back' && change !== 'cancel-reopen') origin.noteContent = 'successor draft';
    if (change !== 'switch-back' && change !== 'cancel-reopen') origin.selectedNoteTags = ['formula'];
    const expected = {
      content: origin.noteContent,
      tags: [...origin.selectedNoteTags],
      visible: origin.showNoteModal,
      notes: [{ id: 'successor', questionId: origin.currentQuestion.id }]
    };
    origin.currentQuestionNotes = expected.notes;
    const refresh = vi.spyOn(questionNoteManager, 'getNotesByQuestion').mockImplementation(() => {
      throw sessionUnavailable();
    });
    release.resolve();
    await pending;
    expect(success).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(origin.noteContent).toBe(expected.content);
    expect(origin.selectedNoteTags).toEqual(expected.tags);
    expect(origin.showNoteModal).toBe(expected.visible);
    expect(origin.currentQuestionNotes).toEqual(expected.notes);
    expect(storageService.get('question_notes')).toMatchObject([
      { questionId: 'q1', content: 'original draft', tags: ['key_point'] }
    ]);
  }
);

it('two App pages serialize asynchronous additions and both confirmed notes survive a fresh read', async () => {
  const a = new questionNoteManager.constructor(),
    b = new questionNoteManager.constructor();
  a.init();
  b.init();
  const release = deferred();
  const save = storageService.save.bind(storageService);
  vi.spyOn(storageService, 'save').mockImplementationOnce((...args) => release.promise.then(() => save(...args)));
  const first = a.addNote(draft('first page'));
  const second = b.addNote(draft('second page'));
  release.resolve();
  const receipts = await Promise.all([first, second]);
  expect(receipts.map((result) => result.success)).toEqual([true, true]);
  const fresh = new questionNoteManager.constructor();
  expect(
    fresh
      .getNotes()
      .map((note) => note.id)
      .sort()
  ).toEqual(receipts.map((result) => result.note.id).sort());
  expect(fresh.notes.map((note) => note.content).sort()).toEqual(['first page', 'second page']);
});

it('two independent H5 tabs serialize the entire read-modify-confirm transaction', () => {
  const child = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', 'tests/fixtures/session-races/note-writes.mjs'],
    { encoding: 'utf8', timeout: 15000 }
  );
  expect(child.status, child.stderr).toBe(0);
  const rows = child.stdout.trim().split('\n').map(JSON.parse);
  expect(rows).toHaveLength(1);
  expect(rows[0].ok).toBe(true);
});

it.each(['false', 'reject', 'unconfirmed'])(
  'note write %s never announces success or clears the original draft',
  async (failure) => {
    const origin = page();
    const save = vi.spyOn(storageService, 'save');
    if (failure === 'reject') save.mockRejectedValue(new Error('fixture write failure'));
    else save.mockResolvedValue(failure === 'unconfirmed');
    const success = vi.spyOn(toast, 'success');
    await origin.handleSaveNote();
    expect(success).not.toHaveBeenCalled();
    expect(origin.noteContent).toBe('original draft');
    expect(origin.showNoteModal).toBe(true);
    expect(origin.currentQuestionNotes).toEqual([]);
    expect(storageService.get('question_notes', [])).toEqual([]);
    save.mockRestore();
    await origin.handleSaveNote();
    expect(success).toHaveBeenCalledTimes(1);
    expect(storageService.get('question_notes')).toHaveLength(1);
  }
);

function pauseNextNoteSave() {
  const release = deferred();
  const started = deferred();
  const save = storageService.save.bind(storageService);
  vi.spyOn(storageService, 'save').mockImplementationOnce((...args) => {
    started.resolve();
    return release.promise.then(() => save(...args));
  });
  return { started: started.promise, release: release.resolve };
}

const noteReceipts = (add) => Promise.all(add.mock.results.map((call) => call.value));

it.each(['runtime', 'web-lock'])('6G: delayed same-page double submit saves one draft under %s', async (lock) => {
  const origin = page();
  if (lock === 'web-lock') {
    vi.stubGlobal('navigator', {
      locks: { request: vi.fn((_name, _options, operation) => Promise.resolve().then(operation)) }
    });
  }
  const add = vi.spyOn(questionNoteManager, 'addNote');
  const success = vi.spyOn(toast, 'success');
  const gate = pauseNextNoteSave();
  const first = origin.handleSaveNote();
  await gate.started;
  const second = origin.handleSaveNote();
  gate.release();
  await Promise.all([first, second]);
  const receipts = await noteReceipts(add);
  expect(receipts).toHaveLength(2);
  expect(receipts[0].success).toBe(true);
  expect(receipts[1]).toEqual(receipts[0]);
  expect(storageService.get('question_notes')).toEqual([receipts[0].note]);
  expect(new questionNoteManager.constructor().getNotes()).toEqual([receipts[0].note]);
  expect(success).toHaveBeenCalledTimes(1);
  expect(origin.showNoteModal).toBe(false);
  expect(origin.noteContent).toBe('');
});

it('6G: direct manager double submit keeps the same id until the whole queue settles', async () => {
  const manager = new questionNoteManager.constructor();
  const gate = pauseNextNoteSave();
  const first = manager.addNote(draft('same draft'));
  await gate.started;
  const second = manager.addNote(draft('same draft'));
  gate.release();
  const receipts = await Promise.all([first, second]);
  expect(receipts[0].success).toBe(true);
  expect(receipts[1]).toEqual(receipts[0]);
  expect(new questionNoteManager.constructor().getNotes()).toEqual([receipts[0].note]);
  // A later intentional draft is independent once both submissions have settled.
  const next = await manager.addNote(draft('same draft'));
  expect(next.success).toBe(true);
  expect(next.note.id).not.toBe(receipts[0].note.id);
  expect(storageService.get('question_notes')).toHaveLength(2);
});

it.each(['false', 'reject', 'unconfirmed', 'lost-receipt'])(
  '6G: first %s write fails honestly and a double retry saves one note without a stuck lock',
  async (failure) => {
    const origin = page();
    const save = storageService.save.bind(storageService);
    vi.spyOn(storageService, 'save').mockImplementationOnce((...args) => {
      if (failure === 'reject') return Promise.reject(new Error('fixture failure'));
      if (failure === 'lost-receipt') save(...args);
      return Promise.resolve(failure === 'unconfirmed');
    });
    const success = vi.spyOn(toast, 'success');
    const add = vi.spyOn(questionNoteManager, 'addNote');
    await origin.handleSaveNote();
    expect((await noteReceipts(add))[0].success).toBe(false);
    expect(success).not.toHaveBeenCalled();
    expect(origin.showNoteModal).toBe(true);
    expect(origin.noteContent).toBe('original draft');
    const persisted = storageService.get('question_notes', []);
    expect(persisted).toHaveLength(failure === 'lost-receipt' ? 1 : 0);
    add.mockClear();
    const gate = pauseNextNoteSave();
    const first = origin.handleSaveNote();
    await gate.started;
    const second = origin.handleSaveNote();
    gate.release();
    await Promise.all([first, second]);
    const receipts = await noteReceipts(add);
    expect(receipts[0].success).toBe(true);
    expect(receipts[1]).toEqual(receipts[0]);
    expect(storageService.get('question_notes')).toEqual([receipts[0].note]);
    if (persisted.length) expect(receipts[0].note.id).toBe(persisted[0].id);
    expect(success).toHaveBeenCalledTimes(1);
    // Fresh work can enter and leave the same account queue after the failure.
    origin.handleOpenNote();
    origin.noteContent = 'next draft';
    await origin.handleSaveNote();
    expect(storageService.get('question_notes')).toHaveLength(2);
    expect(success).toHaveBeenCalledTimes(2);
  }
);

it.each(['other-question', 'switch-back', 'reopen', 'other-page'])(
  '6G: concurrent drafts stay distinct after %s even with identical text and duplicate submits',
  async (change) => {
    const origin = page();
    const add = vi.spyOn(questionNoteManager, 'addNote');
    const gate = pauseNextNoteSave();
    const first = origin.handleSaveNote();
    await gate.started;
    const firstDuplicate = origin.handleSaveNote();
    let successor = origin;
    if (change === 'other-page') successor = page();
    else {
      if (change === 'other-question' || change === 'switch-back') origin.currentIndex = 1;
      if (change === 'switch-back') origin.currentIndex = 0;
      origin.handleOpenNote();
      origin.noteContent = 'original draft';
      origin.selectedNoteTags = ['key_point'];
    }
    const second = successor.handleSaveNote();
    const secondDuplicate = successor.handleSaveNote();
    gate.release();
    await Promise.all([first, firstDuplicate, second, secondDuplicate]);
    const receipts = await noteReceipts(add);
    expect(receipts.map((receipt) => receipt.success)).toEqual([true, true, true, true]);
    expect(receipts[1]).toEqual(receipts[0]);
    expect(receipts[3]).toEqual(receipts[2]);
    expect(receipts[0].note.id).not.toBe(receipts[2].note.id);
    const rows = new questionNoteManager.constructor().getNotes();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id).sort()).toEqual([receipts[0].note.id, receipts[2].note.id].sort());
    expect(rows.map((row) => row.questionId).sort()).toEqual(change === 'other-question' ? ['q1', 'q2'] : ['q1', 'q1']);
    expect(successor.showNoteModal).toBe(false);
  }
);

it('6G: synchronous double submit before page receipt handling still saves one editor draft', async () => {
  const origin = page();
  const add = vi.spyOn(questionNoteManager, 'addNote');
  const first = origin.handleSaveNote();
  const second = origin.handleSaveNote();
  await Promise.all([first, second]);
  const receipts = await noteReceipts(add);
  expect(receipts[0].success).toBe(true);
  expect(receipts[1]).toEqual(receipts[0]);
  expect(storageService.get('question_notes')).toEqual([receipts[0].note]);
  origin.handleOpenNote();
  origin.noteContent = 'original draft';
  origin.selectedNoteTags = ['key_point'];
  await origin.handleSaveNote();
  expect(storageService.get('question_notes')).toHaveLength(2);
});
