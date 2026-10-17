import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { storageService } from '@/services/storageService.js';
import {
  captureSession,
  checkSession,
  getToken,
  getLoginSessionEpoch,
  sessionUnavailable
} from '@/services/auth-storage.js';
import { questionNoteManager } from '@/pages/practice-sub/question-note.js';
import { questionTimer } from '@/pages/practice-sub/question-timer.js';
import DoQuiz from '@/pages/practice-sub/do-quiz.vue';
import JourneyReminders from '@/components/business/learning/journey-reminders.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { toast } from '@/utils/toast.js';
import { t } from '@/i18n/index.js';

vi.mock('@dcloudio/uni-app', () => ({ onShow() {}, onHide() {}, onLoad() {}, onBackPress() {} }));
const read = uni.getStorageSync.getMockImplementation();
const write = uni.setStorageSync.getMockImplementation();
const login = (n = 1) =>
  storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}`, userInfo: { id: `account-${n}` } });
let blocked, wrapper, timer;
beforeEach(() => {
  blocked = false;
  uni.getStorageSync.mockImplementation((key) => {
    if (blocked && key === '_enc_EXAM_SESSION_EPOCH') throw sessionUnavailable();
    return read(key);
  });
  uni.clearStorageSync();
  login();
  setActivePinia(createPinia());
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  Object.assign(questionNoteManager, new questionNoteManager.constructor());
});
afterEach(() => {
  blocked = false;
  uni.getStorageSync.mockImplementation(read);
  wrapper?.unmount();
  wrapper = null;
  if (timer) timer.stop(timer.token);
  timer = null;
  for (const store of getActivePinia()?._s.values() || []) store.$dispose();
  learningWriteLease.release();
  storageService.flushPendingWrites();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  uni.getStorageSync.mockImplementation(read);
  uni.setStorageSync.mockImplementation(write);
});
function setupJourney(store) {
  store.start('回归学习');
  store.configureJourney(store.journeyContext(), {
    title: '7天运算',
    startDay: store.todaySummary.day,
    durationDays: 7,
    minutes: 30,
    mode: 'batch',
    moduleIds: ['arithmetic-add']
  });
}
async function reminders() {
  const store = useConversationLearningStore();
  setupJourney(store);
  wrapper = mount(JourneyReminders, {
    global: { stubs: { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' } } }
  });
  await flushPromises();
  await wrapper.find('button').trigger('tap');
  return { store, actions: wrapper.vm.$.setupState };
}
const reminderEvents = (state) => (state?.events || []).filter((event) => event.type === 'reminder.set');
it('writes-10-01: cross-account save cancels the draft without writing Store or successor storage', async () => {
  const { store, actions } = await reminders();
  await login(2);
  setupJourney(store);
  actions.save();
  await flushPromises();
  expect(reminderEvents(store.state)).toEqual([]);
  expect(reminderEvents(read('u_account-2_conversation_learning_v1'))).toEqual([]);
  expect(wrapper.find('.reminder-form').exists()).toBe(false);
  expect(actions.form).toEqual({});
});
it.each(['relogin', 'conversation'])('writes-10-01: %s proactively discards the reminder draft', async (change) => {
  const { store, actions } = await reminders();
  if (change === 'relogin') await login();
  else setupJourney(store);
  await flushPromises();
  expect(wrapper.find('.reminder-form').exists()).toBe(false);
  expect(actions.form).toEqual({});
});
it('writes-10-01: renewal and unrelated revision preserve the reminder draft and original target', async () => {
  const { store, actions } = await reminders();
  actions.form.time = '14:00';
  const conversationId = store.selectedConversationId;
  await storageService.save('EXAM_TOKEN', 'renewed-fixture', true, captureSession());
  store.configureJourney(store.journeyContext(), {
    title: '7天运算',
    startDay: store.todaySummary.day,
    durationDays: 7,
    minutes: 40,
    mode: 'batch',
    moduleIds: ['arithmetic-add']
  });
  await flushPromises();
  expect(wrapper.find('.reminder-form').exists()).toBe(true);
  actions.save();
  await flushPromises();
  expect(reminderEvents(read('u_account-1_conversation_learning_v1'))).toHaveLength(1);
  expect(store.selectedConversationId).toBe(conversationId);
  expect(store.active.reminders[0].time).toBe('14:00');
});
it('writes-10-01: unavailable save preserves the draft and succeeds on retry', async () => {
  const { store, actions } = await reminders();
  actions.form.time = '08:00';
  blocked = true;
  actions.save();
  await flushPromises();
  expect(reminderEvents(store.state)).toEqual([]);
  expect(wrapper.find('.reminder-form').exists()).toBe(true);
  expect(actions.form.time).toBe('08:00');
  blocked = false;
  actions.save();
  await flushPromises();
  expect(store.active.reminders[0].time).toBe('08:00');
});
it('writes-10-01: unavailable identity does not open reminder editing', async () => {
  const { actions } = await reminders();
  actions.edit();
  blocked = true;
  actions.edit();
  await flushPromises();
  expect(wrapper.find('.reminder-form').exists()).toBe(false);
  expect(actions.message).toBeTruthy();
});
it('writes-10-01: stale reminder toggle cannot copy the old account reminder to its successor', async () => {
  const { store, actions } = await reminders();
  actions.save();
  await flushPromises();
  const oldReminder = store.active.reminders[0];
  await login(2);
  setupJourney(store);
  actions.toggle(oldReminder);
  await flushPromises();
  expect(reminderEvents(store.state)).toEqual([]);
  expect(reminderEvents(read('u_account-2_conversation_learning_v1'))).toEqual([]);
});

const draft = { questionId: 'q', questionContent: 'Question', content: 'Retained draft', tags: [] };
function failNoteSave() {
  const save = storageService.save.bind(storageService);
  return vi.spyOn(storageService, 'save').mockImplementation((key, ...args) => {
    if (key === 'question_notes') blocked = true;
    return save(key, ...args);
  });
}
it('writes-10-02: unavailable add returns failure, rolls back memory and retries exactly once', async () => {
  const manager = new questionNoteManager.constructor();
  manager.init();
  const session = captureSession();
  const save = failNoteSave();
  const result = await manager.addNote(draft, session);
  expect(result).toMatchObject({ success: false, code: 'SESSION_UNAVAILABLE', retryable: true });
  expect(manager.notes).toEqual([]);
  blocked = false;
  save.mockRestore();
  expect((await manager.addNote(draft, session)).success).toBe(true);
  const reopened = new questionNoteManager.constructor();
  reopened.init();
  expect(reopened.notes).toHaveLength(1);
  expect(reopened.notes[0].content).toBe(draft.content);
});
it('regress-10-01: failed page save keeps modal, tags and draft without success toast; retry saves once', async () => {
  questionNoteManager.init();
  const page = {
    currentQuestion: { id: 'q', question: 'Question' },
    boundLoginSession: captureSession(),
    noteContent: draft.content,
    selectedNoteTags: ['key_point'],
    showNoteModal: true
  };
  const success = vi.spyOn(toast, 'success'),
    info = vi.spyOn(toast, 'info');
  const save = failNoteSave();
  await DoQuiz.methods.handleSaveNote.call(page);
  expect(success).not.toHaveBeenCalled();
  expect(info).toHaveBeenCalled();
  expect(page).toMatchObject({ noteContent: draft.content, selectedNoteTags: ['key_point'], showNoteModal: true });
  blocked = false;
  save.mockRestore();
  await DoQuiz.methods.handleSaveNote.call(page);
  expect(page).toMatchObject({ noteContent: '', selectedNoteTags: [], showNoteModal: false });
  const reopened = new questionNoteManager.constructor();
  reopened.init();
  expect(reopened.notes).toHaveLength(1);
});
it.each([1, 2])(
  'writes-10-02: pending note is discarded after login to account %i with a new epoch',
  async (account) => {
    const manager = new questionNoteManager.constructor();
    manager.init();
    const session = captureSession(),
      save = failNoteSave();
    await manager.addNote(draft, session);
    blocked = false;
    save.mockRestore();
    await login(account);
    expect(await manager.addNote(draft, session)).toMatchObject({
      success: false,
      code: 'CONTEXT_CHANGED',
      retryable: false
    });
    storageService.flushPendingWrites();
    expect(storageService.get('question_notes', [])).toEqual([]);
    manager.init();
    expect(manager.notes).toEqual([]);
  }
);
it('writes-10-02: a lost save receipt reuses the pending note id on retry', async () => {
  const manager = new questionNoteManager.constructor();
  manager.init();
  const save = storageService.save.bind(storageService);
  const spy = vi.spyOn(storageService, 'save').mockImplementation((...args) => {
    save(...args);
    return false;
  });
  expect((await manager.addNote(draft)).success).toBe(false);
  spy.mockRestore();
  expect((await manager.addNote(draft)).success).toBe(true);
  expect(storageService.get('question_notes')).toHaveLength(1);
});
it.each(['updateNote', 'deleteNote', 'toggleImportant', 'recordReview', 'createTag', 'deleteTag'])(
  'writes-10-02: failed %s returns non-success and preserves persisted memory',
  async (action) => {
    const manager = new questionNoteManager.constructor();
    const tag = (await manager.createTag({ name: 'Custom' })).tag;
    const note = (await manager.addNote({ ...draft, tags: [tag.id] })).note;
    const before = JSON.stringify({ notes: manager.notes, tags: manager.tags });
    vi.spyOn(storageService, 'save').mockReturnValue(false);
    const args = {
      updateNote: [note.id, { content: 'changed' }],
      deleteNote: [note.id],
      toggleImportant: [note.id],
      recordReview: [note.id],
      createTag: [{ name: 'Another' }],
      deleteTag: [tag.id]
    };
    expect(await manager[action](...args[action])).toMatchObject({ success: false, retryable: true });
    expect(JSON.stringify({ notes: manager.notes, tags: manager.tags })).toBe(before);
  }
);
it.each([true, false])('writes-10-02: Promise save receipt %s controls note and page success', async (confirmed) => {
  questionNoteManager.init();
  const save = storageService.save.bind(storageService);
  vi.spyOn(storageService, 'save').mockImplementation((...args) =>
    Promise.resolve().then(() => (confirmed ? save(...args) : false))
  );
  const page = {
    currentQuestion: { id: 'q', question: 'Question' },
    boundLoginSession: captureSession(),
    noteContent: draft.content,
    selectedNoteTags: [],
    showNoteModal: true
  };
  const success = vi.spyOn(toast, 'success');
  await DoQuiz.methods.handleSaveNote.call(page);
  expect(success).toHaveBeenCalledTimes(confirmed ? 1 : 0);
  expect(page.showNoteModal).toBe(!confirmed);
  expect(questionNoteManager.notes).toHaveLength(confirmed ? 1 : 0);
});

it.each(['stop', 'pause'])('regress-10-02: unavailable %s tears down locally and freezes measured time', (action) => {
  timer = new questionTimer.constructor();
  const onTick = vi.fn(),
    onTimeout = vi.fn(),
    onWarning = vi.fn();
  const { token } = timer.start({ onTick, onTimeout, onWarning, customTimeLimit: 5 });
  vi.advanceTimersByTime(1550);
  onTick.mockClear();
  blocked = true;
  const result = timer[action](token);
  if (action === 'stop') {
    expect(result).toMatchObject({ success: false, code: 'SESSION_UNAVAILABLE', elapsedMs: 1550 });
    expect(timer.active).toBe(false);
  } else {
    expect(result).toBe(true);
    expect(timer.isPaused).toBe(true);
  }
  expect(timer.currentTimer).toBeNull();
  vi.advanceTimersByTime(20000);
  expect(onTick).not.toHaveBeenCalled();
  expect(onWarning).not.toHaveBeenCalled();
  expect(onTimeout).not.toHaveBeenCalled();
  blocked = false;
  expect(timer.stop(token)).toMatchObject({ success: true, elapsedMs: 1550 });
  vi.advanceTimersByTime(20000);
  expect(timer.stop(token).elapsedMs).toBe(1550);
});
it.each([false, true])('regress-10-02: old token cannot stop or pause its successor, unavailable=%s', (unavailable) => {
  timer = new questionTimer.constructor();
  const old = timer.start().token,
    current = timer.start().token;
  blocked = unavailable;
  expect(timer.stop(old).success).toBe(false);
  expect(timer.pause(old)).toBe(false);
  expect(timer.active).toBe(true);
  expect(timer.isPaused).toBe(false);
  expect(timer.token).toBe(current);
  expect(timer.currentTimer).not.toBeNull();
});
it('regress-10-02: omitted token still requires readable current identity', () => {
  timer = new questionTimer.constructor();
  timer.start();
  blocked = true;
  expect(timer.stop().success).toBe(false);
  expect(timer.pause()).toBe(false);
  expect(timer.active).toBe(true);
  expect(timer.currentTimer).not.toBeNull();
});

function interleaveSupplementalRead(change) {
  let failed = false,
    readRecord = false,
    interleaved = false;
  uni.getStorageSync.mockImplementation((key) => {
    if (key === '_enc_EXAM_SESSION_EPOCH') {
      if (!failed) {
        failed = true;
        throw sessionUnavailable();
      }
      if (!interleaved) readRecord = true;
    }
    if (key === 'EXAM_IDENTITY_GENERATION' && readRecord && !interleaved) {
      interleaved = true;
      change();
    }
    return read(key);
  });
}
it.each(['check', 'flush'])('order-10-01: renewal during supplemental %s preserves pending debounce', (action) => {
  const session = captureSession();
  storageService.saveDebounced('EXAM_QUIZ_PROGRESS', { value: 'pending' }, true, session, 10000);
  interleaveSupplementalRead(() =>
    expect(storageService.save('EXAM_TOKEN', 'renewed-fixture', true, session)).toBe(true)
  );
  if (action === 'check') expect(checkSession(session)).toBe('unavailable');
  else storageService.flushPendingWrites();
  uni.getStorageSync.mockImplementation(read);
  expect(checkSession(session)).toBe('current');
  storageService.flushPendingWrites();
  expect(storageService.get('EXAM_QUIZ_PROGRESS')).toEqual({ value: 'pending' });
});
it.each([1, 2])('order-10-01: interleaved login account %i confirms changed and discards pending write', (account) => {
  const session = captureSession();
  storageService.saveDebounced('EXAM_QUIZ_PROGRESS', { value: 'old' }, true, session, 10000);
  interleaveSupplementalRead(() => login(account));
  storageService.flushPendingWrites();
  uni.getStorageSync.mockImplementation(read);
  expect(checkSession(session)).toBe('changed');
  storageService.flushPendingWrites();
  expect(storageService.get('EXAM_QUIZ_PROGRESS')).toBeNull();
});

it('writes-10-02: same-epoch renewal keeps the failed note available for retry', async () => {
  const manager = new questionNoteManager.constructor();
  manager.init();
  const session = captureSession(),
    save = failNoteSave();
  expect((await manager.addNote(draft, session)).success).toBe(false);
  blocked = false;
  save.mockRestore();
  await storageService.save('EXAM_TOKEN', 'renewed-fixture', true, session);
  expect((await manager.addNote(draft, session)).success).toBe(true);
  expect(storageService.get('question_notes')).toHaveLength(1);
});
it('regress-10-01: session change before page acknowledgement retains the modal and draft', async () => {
  questionNoteManager.init();
  const add = questionNoteManager.addNote.bind(questionNoteManager);
  vi.spyOn(questionNoteManager, 'addNote').mockImplementation((...args) => {
    const result = add(...args);
    login(2);
    return result;
  });
  const page = {
    currentQuestion: { id: 'q', question: 'Question' },
    boundLoginSession: captureSession(),
    noteContent: draft.content,
    selectedNoteTags: [],
    showNoteModal: true
  };
  const success = vi.spyOn(toast, 'success');
  await DoQuiz.methods.handleSaveNote.call(page);
  expect(success).not.toHaveBeenCalled();
  expect(page).toMatchObject({ noteContent: draft.content, showNoteModal: true });
  expect(read('u_account-1_question_notes')).toHaveLength(1);
  expect(storageService.get('question_notes', [])).toEqual([]);
});
it('writes-10-02: rejected asynchronous save returns retryable failure without optimistic memory', async () => {
  const manager = new questionNoteManager.constructor();
  manager.init();
  vi.spyOn(storageService, 'save').mockRejectedValue(sessionUnavailable());
  expect(await manager.addNote(draft)).toMatchObject({ success: false, code: 'SESSION_UNAVAILABLE', retryable: true });
  expect(manager.notes).toEqual([]);
});
it('writes-10-02: late asynchronous note save cannot mutate a successor account', async () => {
  const manager = new questionNoteManager.constructor();
  manager.init();
  const save = storageService.save.bind(storageService);
  let finish;
  const spy = vi.spyOn(storageService, 'save').mockImplementation(
    (...args) =>
      new Promise((resolve) => {
        finish = () => resolve(save(...args));
      })
  );
  const pending = manager.addNote(draft);
  spy.mockRestore();
  await login(2);
  manager.init();
  finish();
  expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED', retryable: false });
  expect(manager.notes).toEqual([]);
  expect(storageService.get('question_notes', [])).toEqual([]);
});
it.each([false, true])(
  'writes-10-02: partial tag deletion keeps memory consistent, rollback fails=%s',
  async (rollbackFails) => {
    const manager = new questionNoteManager.constructor();
    const tag = (await manager.createTag({ name: 'Custom' })).tag;
    await manager.addNote({ ...draft, tags: [tag.id] });
    const save = storageService.save.bind(storageService);
    let noteWrites = 0;
    vi.spyOn(storageService, 'save').mockImplementation((key, ...args) => {
      if (key === 'question_note_tags') return false;
      if (key === 'question_notes' && ++noteWrites > 1 && rollbackFails) return false;
      return save(key, ...args);
    });
    expect((await manager.deleteTag(tag.id)).success).toBe(false);
    const reopened = new questionNoteManager.constructor();
    reopened.init();
    expect(manager.notes).toEqual(reopened.notes);
    expect(manager.tags).toEqual(reopened.tags);
  }
);
it('regress-10-02: revoked timer token still stops locally without authorizing submission', async () => {
  timer = new questionTimer.constructor();
  const { token } = timer.start();
  vi.advanceTimersByTime(1550);
  await login(2);
  expect(timer.stop(token)).toMatchObject({ success: false, code: 'TIMER_CONTEXT_CHANGED', elapsedMs: 1550 });
  expect(timer.active).toBe(false);
  expect(timer.currentTimer).toBeNull();
});
it.each(['epoch', 'token'])('order-10-01: direct %s reads reject renewal interleaved after the record', (kind) => {
  const session = captureSession();
  let readRecord = false,
    interleaved = false;
  uni.getStorageSync.mockImplementation((key) => {
    if (key === '_enc_EXAM_SESSION_EPOCH' && !interleaved) readRecord = true;
    if (key === 'EXAM_IDENTITY_GENERATION' && readRecord && !interleaved) {
      interleaved = true;
      storageService.save('EXAM_TOKEN', 'renewed-fixture', true, session);
    }
    return read(key);
  });
  expect(() => (kind === 'epoch' ? getLoginSessionEpoch() : getToken())).toThrow(
    expect.objectContaining({ code: 'SESSION_UNAVAILABLE' })
  );
  uni.getStorageSync.mockImplementation(read);
  expect(checkSession(session)).toBe('current');
});
it('order-10-01: guest supplemental revocation read is bracketed by generation', () => {
  storageService.remove('EXAM_TOKEN', true);
  const guest = captureSession();
  expect(guest.owner).toBe('guest');
  let failed = false,
    readRevocation = false,
    interleaved = false;
  uni.getStorageSync.mockImplementation((key) => {
    if (key === '_enc_EXAM_SESSION_EPOCH' && !failed) {
      failed = true;
      throw sessionUnavailable();
    }
    if (key === 'EXAM_SESSION_REVOCATION' && failed && !interleaved) readRevocation = true;
    if (key === 'EXAM_IDENTITY_GENERATION' && readRevocation && !interleaved) {
      interleaved = true;
      storageService.remove('EXAM_TOKEN', true);
    }
    return read(key);
  });
  expect(checkSession(guest)).toBe('unavailable');
  expect(interleaved).toBe(true);
  uni.getStorageSync.mockImplementation(read);
  expect(checkSession(guest)).toBe('changed');
});

function notePage() {
  return {
    currentQuestion: { id: 'q', question: 'Question' },
    boundLoginSession: captureSession(),
    noteContent: draft.content,
    selectedNoteTags: ['key_point'],
    showNoteModal: true,
    currentQuestionNotes: []
  };
}
it('audit-p1-01: confirmed save survives unavailable page acknowledgement and cannot duplicate on retry', async () => {
  const page = notePage();
  const add = questionNoteManager.addNote.bind(questionNoteManager);
  vi.spyOn(questionNoteManager, 'addNote').mockImplementation((...args) => {
    const result = add(...args);
    expect(result.success).toBe(true);
    blocked = true;
    return result;
  });
  const success = vi.spyOn(toast, 'success'),
    info = vi.spyOn(toast, 'info');
  await expect(DoQuiz.methods.handleSaveNote.call(page)).resolves.toBeUndefined();
  expect(success).toHaveBeenCalledWith(t('quiz.copy100'));
  expect(info).not.toHaveBeenCalled();
  expect(page).toMatchObject({ showNoteModal: false, noteContent: '', selectedNoteTags: [] });
  expect(page.currentQuestionNotes).toMatchObject([{ questionId: 'q', content: draft.content }]);
  blocked = false;
  await DoQuiz.methods.handleSaveNote.call(page);
  expect(read('u_account-1_question_notes')).toHaveLength(1);
});
it('audit-p1-01: confirmed origin save reports context change and retains its draft after relogin', async () => {
  const page = notePage();
  const add = questionNoteManager.addNote.bind(questionNoteManager);
  vi.spyOn(questionNoteManager, 'addNote').mockImplementation((...args) => {
    const result = add(...args);
    expect(result.success).toBe(true);
    login(2);
    return result;
  });
  const info = vi.spyOn(toast, 'info'),
    success = vi.spyOn(toast, 'success');
  await DoQuiz.methods.handleSaveNote.call(page);
  expect(info).toHaveBeenLastCalledWith(t('ui.contextChanged'));
  expect(success).not.toHaveBeenCalled();
  expect(page).toMatchObject({ showNoteModal: true, noteContent: draft.content, selectedNoteTags: ['key_point'] });
  expect(read('u_account-1_question_notes')).toHaveLength(1);
  expect(storageService.get('question_notes', [])).toEqual([]);
});

function timedPage() {
  Object.assign(questionTimer, new questionTimer.constructor());
  timer = questionTimer;
  const question = { id: 'q', question: 'Q', type: 'single_choice', options: ['A', 'B'], answer: 'A' };
  return {
    boundLoginSession: captureSession(),
    quizOwnerId: 'account-1',
    canSubmitChoice: true,
    currentQuestion: question,
    questions: [question],
    userChoice: 0,
    currentIndex: 0,
    questionTimerToken: timer.start().token,
    hasAnswered: false,
    answeredQuestions: [],
    saveCurrentProgress: vi.fn(),
    recordAnswerToAnalytics: vi.fn().mockResolvedValue(),
    updateStudyStats: vi.fn(),
    clearComboFeedback: vi.fn(),
    startTimer: vi.fn()
  };
}
it('audit-p1-02: unavailable submission retains the selected answer and records all 6550ms after recovery', async () => {
  const page = timedPage();
  vi.advanceTimersByTime(1550);
  const interval = timer.currentTimer,
    stop = timer.stop.bind(timer),
    info = vi.spyOn(toast, 'info');
  const spy = vi.spyOn(timer, 'stop').mockImplementation((...args) => {
    blocked = true;
    return stop(...args);
  });
  await DoQuiz.methods.submitChoice.call(page);
  expect(timer.active).toBe(true);
  expect(timer.currentTimer).toBe(interval);
  expect(timer.isPaused).toBe(false);
  expect(info).toHaveBeenLastCalledWith(t('ui.storageBusy'));
  expect(page).toMatchObject({ userChoice: 0, hasAnswered: false, answeredQuestions: [] });
  expect(page.saveCurrentProgress).not.toHaveBeenCalled();
  expect(page.recordAnswerToAnalytics).not.toHaveBeenCalled();
  blocked = false;
  spy.mockRestore();
  DoQuiz.methods.selectOption.call(page, 1);
  vi.advanceTimersByTime(5000);
  await DoQuiz.methods.submitChoice.call(page);
  expect(page.answeredQuestions).toMatchObject([{ timeSpent: 6550 }]);
  expect(timer.active).toBe(false);
});
it('audit-p1-02: unavailable reference view retains the timer without writing an observation or showing a toast', async () => {
  const page = timedPage();
  page.currentQuestion = { id: 'q', question: 'Q', type: 'flashcard', answer: 'A' };
  const stop = timer.stop.bind(timer);
  vi.spyOn(timer, 'stop').mockImplementation((...args) => {
    blocked = true;
    return stop(...args);
  });
  const info = vi.spyOn(toast, 'info');
  await DoQuiz.methods.flipFlashcard.call(page);
  expect(timer.active).toBe(true);
  expect(page.hasAnswered).toBe(false);
  expect(page.referenceSaved).not.toBe(true);
  expect(page.recordingObservation).toBe(false);
  expect(page.saveCurrentProgress).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
});
it('audit-p1-02-hide-show: unavailable onHide/onShow resumes local timing and excludes hidden time', () => {
  const page = timedPage();
  vi.advanceTimersByTime(1550);
  blocked = true;
  DoQuiz.onHide.call(page);
  expect(timer.isPaused).toBe(true);
  expect(timer.currentTimer).toBeNull();
  vi.advanceTimersByTime(20000);
  DoQuiz.onShow.call(page);
  expect(timer.active).toBe(true);
  expect(timer.isPaused).toBe(false);
  expect(page.questions).toHaveLength(1);
  vi.advanceTimersByTime(5000);
  blocked = false;
  expect(timer.stop(page.questionTimerToken)).toMatchObject({ success: true, elapsedMs: 6550 });
});
it.each([true, false])(
  'audit-p1-02-hide-show: explicit resume works while unavailable, notifications=%s',
  (enabled) => {
    timer = new questionTimer.constructor();
    const onTick = vi.fn(),
      token = timer.start({ notificationsEnabled: enabled, onTick }).token;
    vi.advanceTimersByTime(1550);
    blocked = true;
    expect(timer.pause(token)).toBe(true);
    vi.advanceTimersByTime(20000);
    expect(timer.resume(token)).toBe(true);
    expect(timer.isPaused).toBe(false);
    expect(timer.currentTimer !== null).toBe(enabled);
    onTick.mockClear();
    vi.advanceTimersByTime(2500);
    expect(onTick).not.toHaveBeenCalled();
    blocked = false;
    vi.advanceTimersByTime(2500);
    expect(timer.stop(token)).toMatchObject({ success: true, elapsedMs: 6550 });
  }
);
it.each([false, true])('audit-p1-02: stale token cannot resume its paused successor, unavailable=%s', (unavailable) => {
  timer = new questionTimer.constructor();
  const old = timer.start().token,
    current = timer.start().token;
  timer.pause(current);
  blocked = unavailable;
  expect(timer.resume(old)).toBe(false);
  expect(timer.token).toBe(current);
  expect(timer.active).toBe(true);
  expect(timer.isPaused).toBe(true);
  expect(timer.currentTimer).toBeNull();
});
it('audit-p1-02: omitted resume requires current identity and changed identity rejects explicit resume', () => {
  timer = new questionTimer.constructor();
  const token = timer.start().token;
  timer.pause(token);
  blocked = true;
  expect(timer.resume()).toBe(false);
  blocked = false;
  expect(timer.resume()).toBe(true);
  timer.pause(token);
  login(2);
  expect(timer.resume(token)).toBe(false);
  expect(timer.isPaused).toBe(true);
});
it.each(['current', 'unavailable', 'changed'])(
  'audit-p1-02: retain option preserves a paused timer only when unavailable; status=%s',
  (status) => {
    timer = new questionTimer.constructor();
    const token = timer.start().token;
    vi.advanceTimersByTime(1550);
    timer.pause(token);
    blocked = status === 'unavailable';
    if (status === 'changed') login(2);
    const result = timer.stop(token, { retainOnUnavailable: true });
    expect(result).toMatchObject({ success: status === 'current', elapsedMs: 1550 });
    expect(timer.active).toBe(status === 'unavailable');
    expect(timer.isPaused).toBe(true);
    expect(timer.currentTimer).toBeNull();
    if (status === 'unavailable') expect(result.code).toBe('SESSION_UNAVAILABLE');
    if (status === 'changed') expect(result.code).toBe('TIMER_CONTEXT_CHANGED');
  }
);

it.each(['native receipt', 'session confirmation'])(
  'audit-p1-03: committed tag deletion with lost %s confirms disk without restoring dangling references',
  async (lost) => {
    const manager = new questionNoteManager.constructor();
    const tag = (await manager.createTag({ name: 'Custom' })).tag;
    await manager.addNote({ ...draft, tags: [tag.id] });
    let unreadable = 0;
    uni.getStorageSync.mockImplementation((key) => {
      if (key === '_enc_EXAM_SESSION_EPOCH' && unreadable > 0) {
        unreadable--;
        throw sessionUnavailable();
      }
      return read(key);
    });
    uni.setStorageSync.mockImplementation((key, value) => {
      const result = write(key, value);
      if (key === 'u_account-1_question_note_tags') {
        if (lost === 'native receipt') throw new Error('synthetic lost native write receipt');
        unreadable = 2;
      }
      return result;
    });
    expect(await manager.deleteTag(tag.id)).toEqual({ success: true });
    const reopened = new questionNoteManager.constructor();
    reopened.init();
    expect(reopened.tags.some((row) => row.id === tag.id)).toBe(false);
    expect(reopened.notes[0].tags).not.toContain(tag.id);
    expect(manager.notes).toEqual(reopened.notes);
    expect(manager.tags).toEqual(reopened.tags);
  }
);
it('audit-p1-03: uncommitted tag deletion rolls back note references and returns the original failure', async () => {
  const manager = new questionNoteManager.constructor();
  const tag = (await manager.createTag({ name: 'Custom' })).tag;
  await manager.addNote({ ...draft, tags: [tag.id] });
  const save = storageService.save.bind(storageService);
  vi.spyOn(storageService, 'save').mockImplementation((key, ...args) =>
    key === 'question_note_tags' ? false : save(key, ...args)
  );
  expect(await manager.deleteTag(tag.id)).toMatchObject({ success: false, retryable: true });
  const reopened = new questionNoteManager.constructor();
  reopened.init();
  expect(reopened.tags.some((row) => row.id === tag.id)).toBe(true);
  expect(reopened.notes[0].tags).toContain(tag.id);
  expect(manager.notes).toEqual(reopened.notes);
  expect(manager.tags).toEqual(reopened.tags);
});
it.each(['unavailable', 'changed', 'tag read failure'])(
  'audit-p1-03: uncertain tag deletion never rolls back notes after %s',
  async (failure) => {
    const manager = new questionNoteManager.constructor();
    const tag = (await manager.createTag({ name: 'Custom' })).tag;
    await manager.addNote({ ...draft, tags: [tag.id] });
    const save = storageService.save.bind(storageService);
    let noteWrites = 0,
      failRead = false;
    uni.getStorageSync.mockImplementation((key) => {
      if ((blocked && key === '_enc_EXAM_SESSION_EPOCH') || (failRead && key === 'u_account-1_question_note_tags'))
        throw sessionUnavailable();
      return read(key);
    });
    vi.spyOn(storageService, 'save').mockImplementation((key, ...args) => {
      if (key === 'question_notes') noteWrites++;
      const result = save(key, ...args);
      if (key === 'question_note_tags') {
        if (failure === 'changed') login(2);
        else if (failure === 'unavailable') blocked = true;
        else failRead = true;
        return false;
      }
      return result;
    });
    expect(await manager.deleteTag(tag.id)).toMatchObject({ success: false, retryable: failure !== 'changed' });
    expect(noteWrites).toBe(1);
    expect(read('u_account-1_question_notes')[0].tags).not.toContain(tag.id);
    expect(read('u_account-1_question_note_tags').some((row) => row.id === tag.id)).toBe(false);
  }
);
