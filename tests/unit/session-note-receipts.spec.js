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
