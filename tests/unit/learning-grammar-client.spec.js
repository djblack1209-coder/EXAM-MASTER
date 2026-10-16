import { storageService } from '@/services/storageService.js';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  normalizePrivateSyncOperation,
  emptyLearningState
} from '@/services/learning/learning-domain.js';
import {
  GRAMMAR_CONTRACT,
  LANGUAGE_TOOL_SOURCE
} from '../../laf-backend/functions/_shared/learning-grammar-contract.js';
const api = vi.hoisted(() => ({ compute: vi.fn() }));
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  requestLearningGrammar: api.compute
}));
let store;
const clone = (v) => JSON.parse(JSON.stringify(v));
function response(b) {
  return {
    success: true,
    data: {
      contract: GRAMMAR_CONTRACT,
      ownerId: 'grammar-owner',
      conversationId: b.conversationId,
      epoch: b.epoch,
      expected: b.expected,
      gradingAuthority: false,
      persisted: false,
      requiresHelpRecord: true,
      reference: {
        contract: 'grammar-reference-v1',
        requestId: 'a'.repeat(64),
        questionKey: b.questionKey,
        attemptId: b.attemptId,
        source: LANGUAGE_TOOL_SOURCE,
        result: {
          upstream: 'languagetool',
          version: '6.6',
          language: 'en-US',
          gradingAuthority: false,
          findings: [
            {
              offset: 4,
              length: 2,
              original: 'go',
              message: 'Use goes.',
              ruleId: 'HE_VERB_AGR',
              replacements: ['goes']
            }
          ]
        }
      }
    }
  };
}
beforeEach(() => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'grammar-owner');
  uni.setStorageSync('EXAM_TOKEN', 'synthetic-compute-token');
  setActivePinia(createPinia());
  api.compute.mockReset().mockImplementation(async (b) => response(b));
  store = useConversationLearningStore();
  store.start('英文通知写作');
  store.submit('She go to school every day.', true, 'original');
});
afterEach(() => {
  store.$dispose();
  vi.restoreAllMocks();
});
it('explicit computation saves one source-bound help message, preserves raw answer/pending, and repeats without a new call', async () => {
  const before = clone(store.state.attempts);
  const result = await store.requestGrammarHelp(true);
  expect(result.helped).toBe(true);
  expect(store.state.attempts).toEqual(before);
  expect(store.state.reviews).toEqual([]);
  const message = store.active.messages.find((m) => m.upstreamReference);
  expect(message.content).toContain('LanguageTool 6.6');
  expect(message.content).toContain('原答仍待核对');
  expect(store.active.pendingHints.at(-1).upstreamReference.attemptId).toBe('original');
  await store.requestGrammarHelp(true);
  expect(api.compute).toHaveBeenCalledOnce();
  expect(learningRepository.read().conversations.at(-1).messages).toEqual(clone(store.active.messages));
  store.submit('She goes to school every day.', true, 'next-original');
  expect(store.state.attempts.at(-1).hints.some((h) => h.upstreamReference)).toBe(true);
  expect(store.state.attempts.at(-1).grade.status).toBe('pending');
  let restored = emptyLearningState('grammar-owner', store.state.timezone);
  for (const event of clone(store.state.events))
    restored = applyLearningOperation(restored, normalizePrivateSyncOperation(event)).state;
  expect(restored.attempts).toEqual(clone(store.state.attempts));
  expect(restored.conversations.at(-1).messages.find((m) => m.upstreamReference)).toEqual(clone(message));
});
it('requires explicit consent and a logged-in owner', async () => {
  await expect(store.requestGrammarHelp(false)).rejects.toThrow('确认');
  expect(api.compute).not.toHaveBeenCalled();
  storageService.remove('EXAM_TOKEN', true);
  await expect(store.requestGrammarHelp(true)).rejects.toThrow('登录');
  expect(api.compute).not.toHaveBeenCalled();
});
it.each(['failed', 'owner', 'original', 'version', 'authority', 'question'])(
  'rejects bad receipt %s with no new fact',
  async (kind) => {
    const before = clone(store.state);
    api.compute.mockImplementation(async (b) => {
      const r = response(b);
      if (kind === 'failed') return { success: false, message: '请先同步本题和原答' };
      if (kind === 'owner') r.data.ownerId = 'someone';
      if (kind === 'original')
        r.data.expected = clone({ ...b.expected, attempt: { ...b.expected.attempt, answer: 'other' } });
      if (kind === 'version') r.data.reference.source = { ...LANGUAGE_TOOL_SOURCE, version: 'other' };
      if (kind === 'authority') r.data.reference.result.gradingAuthority = true;
      if (kind === 'question') r.data.reference.questionKey = 'other@1';
      return r;
    });
    await expect(store.requestGrammarHelp(true)).rejects.toThrow();
    expect(clone(store.state)).toEqual(before);
  }
);
it.each(['stop', 'cancel', 'token', 'owner', 'new-answer', 'switch-task'])(
  'rejects late %s changes and cancels the transport where observed',
  async (kind) => {
    let resolve;
    let sentSignal;
    let b;
    api.compute.mockImplementation((body, options) => {
      b = body;
      sentSignal = options.signal;
      return new Promise((r) => (resolve = r));
    });
    const promise = store.requestGrammarHelp(true);
    const rejected = expect(promise).rejects.toThrow();
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    if (kind === 'stop') store.commit('task.stop', { conversationId: store.active.id });
    if (kind === 'cancel') store.cancel();
    if (kind === 'token') storageService.save('EXAM_TOKEN', 'changed', true);
    if (kind === 'owner') {
      storageService.saveLoginSession({ userId: 'other', token: 'fixture-peer-token', userInfo: {} });
      store.refresh();
    }
    if (kind === 'new-answer') store.submit('other', true, 'other-answer');
    if (kind === 'switch-task') store.start('计算 2 + 2');
    const before = clone(store.state);
    resolve(response(b));
    await rejected;
    expect(clone(store.state)).toEqual(before);
    expect(store.busy).toBe(false);
    if (kind !== 'token') expect(sentSignal.aborted).toBe(true);
  }
);
it('failed local persistence never displays the fetched reference', async () => {
  const before = clone(store.state);
  const original = learningRepository.commit.bind(learningRepository);
  vi.spyOn(learningRepository, 'commit').mockImplementation((op) => {
    if (op.type === 'teaching.deliver') throw new Error('isolated storage failure');
    return original(op);
  });
  await expect(store.requestGrammarHelp(true)).rejects.toThrow('storage failure');
  expect(clone(store.state)).toEqual(before);
  expect(store.active.messages.some((m) => m.upstreamReference)).toBe(false);
});
