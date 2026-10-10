import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { emptyLearningState, applyLearningOperation } from '../../laf-backend/functions/_shared/learning-domain.js';
import { createNoticeQuestion } from '../../laf-backend/functions/_shared/learning-writing.js';
import {
  grammarScopeFor,
  GRAMMAR_CONTRACT,
  LANGUAGE_TOOL_SOURCE
} from '../../laf-backend/functions/_shared/learning-grammar-contract.js';
const mock = vi.hoisted(() => ({
  rows: [] as any[],
  allowed: true,
  queries: [] as any[],
  response: undefined as any,
  compute: vi.fn()
}));
vi.mock('@lafjs/cloud', () => ({
  default: {
    get res() {
      return mock.response;
    },
    database: () => ({
      collection: (name: string) => ({
        where: (query: any) => {
          mock.queries.push({ name, query });
          const find = () => mock.rows.filter((r) => Object.entries(query).every(([k, v]) => r[k] === v));
          return {
            get: async () => ({ data: structuredClone(find()) }),
            field: () => ({ get: async () => ({ data: find().map((r) => ({ revision: r.revision })) }) })
          };
        }
      })
    })
  }
}));
vi.mock('../../laf-backend/functions/_shared/api-response.js', () => ({
  unauthorized: (message: string) => ({ code: 401, success: false, message }),
  checkRateLimitDistributed: vi.fn(async () => ({ allowed: mock.allowed }))
}));
vi.mock('../../laf-backend/functions/_shared/learning-language-tool.js', () => ({
  checkGrammarReference: mock.compute
}));
import compute from '../../laf-backend/functions/learning-grammar';
const owner = 'grammar-owner';
const rowId = (who = owner) => `learning_sync_${createHash('sha256').update(who).digest('hex')}`;
function state() {
  let s = emptyLearningState(owner);
  for (const op of [
    { id: 'task', type: 'conversation.start', data: { goal: '解方程' } },
    { id: 'q-add', type: 'question.add', data: { question: createNoticeQuestion('q', 'task') } },
    { id: 'focus', type: 'question.focus', data: { conversationId: 'task', questionKey: 'q@1' } },
    {
      id: 'answer',
      type: 'attempt.submit',
      data: { conversationId: 'task', answer: 'She go to school every day.', explicit: true }
    }
  ])
    s = applyLearningOperation(s, op).state;
  return s;
}
function body() {
  return {
    contract: GRAMMAR_CONTRACT,
    action: 'grammar_reference',
    consent: true,
    epoch: 'view-1',
    ...grammarScopeFor(mock.rows[0].state, 'task')
  };
}
function ctx(data = body(), who = owner) {
  const h = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const p = Buffer.from(JSON.stringify({ userId: who, exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
  const sig = createHmac('sha256', 'compute-isolated-secret').update(`${h}.${p}`).digest('base64url');
  return { body: data, headers: { authorization: `Bearer ${h}.${p}.${sig}` } };
}
beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'compute-isolated-secret');
  vi.stubEnv('LEARNING_LANGUAGE_TOOL_ENABLED', 'true');
  vi.stubEnv('LEARNING_LANGUAGE_TOOL_URL', 'http://127.0.0.1:51740/v2/check');
  mock.rows = [{ _id: rowId(), user_id: owner, revision: 1, state: state() }];
  mock.queries = [];
  mock.allowed = true;
  mock.response = new EventEmitter();
  mock.compute.mockReset().mockImplementation(async (_scope, read, _runtime, signal) => {
    await read();
    if (signal.aborted) throw Object.assign(new Error(), { code: 'CANCELLED' });
    return {
      contract: 'grammar-reference-v1',
      requestId: 'a'.repeat(64),
      source: LANGUAGE_TOOL_SOURCE,
      result: { upstream: 'languagetool', version: '6.6', language: 'en-US', gradingAuthority: false, findings: [] }
    };
  });
});
afterEach(() => vi.unstubAllEnvs());
it('reads only authenticated stored originals and returns an unpersisted reference without facts or extra collections', async () => {
  const before = JSON.stringify(mock.rows);
  const result = await compute(ctx());
  expect(result).toMatchObject({
    success: true,
    data: {
      ownerId: owner,
      gradingAuthority: false,
      persisted: false,
      requiresHelpRecord: true,
      reference: { attemptId: 'answer' }
    }
  });
  expect(JSON.stringify(mock.rows)).toBe(before);
  expect(
    mock.queries.every((q) => q.name === 'learning_states' && q.query.user_id === owner && q.query._id === rowId())
  ).toBe(true);
  expect(mock.response.listenerCount('close')).toBe(0);
});
it('requires JWT and distributed rate admission before invoking the worker', async () => {
  expect((await compute({ body: body(), headers: {} })).code).toBe(401);
  mock.allowed = false;
  expect((await compute(ctx())).code).toBe(429);
  expect(mock.compute).not.toHaveBeenCalled();
});
it('never initializes missing state or borrows another owner’s synced original', async () => {
  const input = body();
  expect((await compute(ctx(input, 'different-owner'))).code).toBe(409);
  mock.rows = [];
  expect((await compute(ctx(input))).code).toBe(409);
  expect(mock.rows).toEqual([]);
  expect(mock.compute).not.toHaveBeenCalled();
});
it.each(['consent', 'path', 'answer', 'source', 'attempt', 'question', 'epoch'])(
  'rejects altered request %s',
  async (change) => {
    const b: any = body();
    if (change === 'consent') b.consent = false;
    if (change === 'path') b.python = '/tmp/program';
    if (change === 'answer') b.expected.attempt.answer = 'another';
    if (change === 'source') b.expected.question.source = { kind: 'forged' };
    if (change === 'attempt') b.attemptId = 'other';
    if (change === 'question') b.questionKey = 'q@2';
    if (change === 'epoch') b.epoch = {};
    expect((await compute(ctx(b))).success).toBe(false);
    expect(mock.compute).not.toHaveBeenCalled();
  }
);
it('default-disabled or damaged stored history fails without starting a worker', async () => {
  const input = body();
  vi.stubEnv('LEARNING_LANGUAGE_TOOL_ENABLED', 'false');
  expect((await compute(ctx(input))).code).toBe(503);
  vi.stubEnv('LEARNING_LANGUAGE_TOOL_ENABLED', 'true');
  mock.rows[0].state.owner = 'foreign';
  expect((await compute(ctx(input))).success).toBe(false);
  expect(mock.compute).not.toHaveBeenCalled();
});
it('response disconnection aborts its worker, and concurrency admission is released', async () => {
  let release: () => void;
  let signal: AbortSignal;
  const normal = mock.compute.getMockImplementation();
  mock.compute.mockImplementation(async (...args) => {
    signal = args[3];
    await new Promise<void>((r) => (release = r));
    return normal!(...args);
  });
  const input = ctx();
  const first = compute(input);
  await vi.waitFor(() => expect(release!).toBeTypeOf('function'));
  expect((await compute(input)).code).toBe(429);
  mock.response.emit('close');
  expect(signal!.aborted).toBe(true);
  release!();
  expect((await first).success).toBe(false);
  mock.compute.mockImplementation(normal!);
  expect((await compute(input)).success).toBe(true);
});
it('observes server-side stop/revision changes during work and aborts', async () => {
  let release: () => void;
  let signal: AbortSignal;
  mock.compute.mockImplementation(async (_scope, read, _runtime, s) => {
    signal = s;
    await new Promise<void>((r) => (release = r));
    return read();
  });
  const first = compute(ctx());
  await vi.waitFor(() => expect(release!).toBeTypeOf('function'));
  mock.rows[0].revision++;
  await vi.waitFor(() => expect(signal!.aborted).toBe(true), { timeout: 1000 });
  release!();
  expect((await first).success).toBe(false);
});
it('does not expose worker tracebacks, paths or an inflated grading response', async () => {
  mock.compute.mockRejectedValue(new Error('/private/credentials/secret'));
  expect(JSON.stringify(await compute(ctx()))).not.toContain('credentials');
  mock.compute.mockResolvedValue({
    contract: 'grammar-reference-v1',
    requestId: 'a'.repeat(64),
    source: LANGUAGE_TOOL_SOURCE,
    result: { gradingAuthority: true }
  });
  expect((await compute(ctx())).success).toBe(false);
});
