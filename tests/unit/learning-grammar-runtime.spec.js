import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { emptyLearningState, applyLearningOperation } from '../../laf-backend/functions/_shared/learning-domain.js';
import { createNoticeQuestion } from '../../laf-backend/functions/_shared/learning-writing.js';
import {
  grammarScopeFor,
  normalizeGrammarReference,
  grammarReferenceText
} from '../../laf-backend/functions/_shared/learning-grammar-contract.js';
import { checkGrammarReference } from '../../laf-backend/functions/_shared/learning-language-tool.js';
let state, scope, read, fetchMock;
const runtime = { url: 'http://127.0.0.1:51740/v2/check' };
const reply = () => ({
  software: { version: '6.6', premium: false },
  matches: [{ offset: 11, length: 2, message: 'Use a.', rule: { id: 'EN_A_VS_AN' }, replacements: [{ value: 'a' }] }]
});
beforeEach(() => {
  state = emptyLearningState('grammar-owner');
  for (const op of [
    { id: 'c', type: 'conversation.start', data: { goal: '英文写作' } },
    { id: 'q', type: 'question.add', data: { question: createNoticeQuestion('q', 'c') } },
    { id: 'f', type: 'question.focus', data: { conversationId: 'c', questionKey: 'q@1' } },
    {
      id: 'a',
      type: 'attempt.submit',
      data: { conversationId: 'c', answer: '😀 This is an useful exercise.', explicit: true }
    }
  ])
    state = applyLearningOperation(state, { ...op, at: 1 }).state;
  scope = { ownerId: state.owner, ...grammarScopeFor(state, 'c') };
  read = async () => ({ ownerId: state.owner, state });
  fetchMock = vi.fn(async () => new Response(JSON.stringify(reply())));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('posts only the stored original to the loopback engine and validates UTF16 evidence', async () => {
  const before = structuredClone(state),
    r = await checkGrammarReference(scope, read, runtime);
  expect(state).toEqual(before);
  expect(r.result.findings[0]).toMatchObject({ offset: 11, length: 2, original: 'an', replacements: ['a'] });
  expect(grammarReferenceText(r)).toContain('不给作文打分');
  expect(grammarReferenceText(r)).not.toContain('完全正确');
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(runtime.url);
  expect(options.redirect).toBe('manual');
  expect(options.body.get('text')).toBe(scope.expected.attempt.answer);
  expect(options.body.get('language')).toBe('en-US');
});
it.each([
  'https://example.com/v2/check',
  'http://169.254.169.254/v2/check',
  'http://localhost:51740/v2/check',
  'http://127.0.0.1:51740/redirect',
  'http://x:y@127.0.0.1:51740/v2/check'
])('refuses unapproved engine address %s', async (url) => {
  await expect(checkGrammarReference(scope, read, { url })).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(['version', 'authority', 'offset', 'oversized', 'redirect'])(
  'rejects invalid output %s without learning writes',
  async (kind) => {
    const body = reply();
    if (kind === 'version') body.software.version = 'other';
    if (kind === 'authority') body.software.premium = true;
    if (kind === 'offset') body.matches[0].offset = 999;
    fetchMock.mockResolvedValue(
      kind === 'oversized'
        ? new Response('x'.repeat(65537))
        : kind === 'redirect'
          ? new Response('', { status: 302 })
          : new Response(JSON.stringify(body))
    );
    const before = structuredClone(state);
    await expect(checkGrammarReference(scope, read, runtime)).rejects.toThrow();
    expect(state).toEqual(before);
  }
);
it('rejects changed originals after the engine response', async () => {
  fetchMock.mockImplementation(async () => {
    state.attempts[0].answer = 'other';
    return new Response(JSON.stringify(reply()));
  });
  await expect(checkGrammarReference(scope, read, runtime)).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
});
it('requires supported submitted text and rejects forged source locations', async () => {
  const r = await checkGrammarReference(scope, read, runtime);
  r.result.findings[0].original = 'forged';
  expect(() => normalizeGrammarReference(r, state, 'c', 'q@1')).toThrow();
  state.attempts[0].answer = 'x'.repeat(2001);
  expect(() => grammarScopeFor(state, 'c')).toThrow('2000');
});
it('aborts transport on cancellation and does not wait for a late suggestion', async () => {
  const controller = new AbortController();
  let sent;
  fetchMock.mockImplementation(
    (_url, o) =>
      new Promise((_resolve, reject) => {
        sent = o.signal;
        o.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      })
  );
  const p = checkGrammarReference(scope, read, runtime, controller.signal);
  const rejection = expect(p).rejects.toMatchObject({ code: 'CANCELLED' });
  await vi.waitFor(() => expect(sent).toBeDefined());
  controller.abort();
  await rejection;
  expect(sent.aborted).toBe(true);
});
