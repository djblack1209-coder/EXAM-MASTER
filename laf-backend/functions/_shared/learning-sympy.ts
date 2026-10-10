/** Host-only reference adapter. It never writes learning facts or grades an answer. */
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAlgebraQuestion, parseAlgebraExpression } from './learning-algebra.js';

export const SYMPY_ADAPTER = Object.freeze({
  contract: 'sympy-reference-v1',
  version: '1.14.0',
  dependencyVersion: '1.3.0',
  license: 'BSD-3-Clause',
  source: 'https://github.com/sympy/sympy',
  wallMs: 5000,
  cpuSeconds: 3,
  rssBytes: 192 * 1024 * 1024,
  bytes: 16384
});

export class SympyAdapterError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const fail = (code: string): never => {
  throw new SympyAdapterError(code);
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 160;

// The host supplies authenticated identity and its current page/task epoch. Never take these from model output.
export type SympyContext = {
  ownerId: string;
  conversationId: string;
  epoch: string;
  state: any;
};
type Scope = { ownerId: string; conversationId: string; questionKey: string; attemptId: string };

export function prepareSympyReference(context: SympyContext, scope: Scope) {
  if (
    !context ||
    !scope ||
    Object.keys(scope).sort().join(',') !== 'attemptId,conversationId,ownerId,questionKey' ||
    !Object.values(scope).every(validId) ||
    !validId(context.epoch)
  )
    fail('INVALID_SCOPE');
  const { state } = context;
  if (context.ownerId !== scope.ownerId || state?.owner !== scope.ownerId) fail('OWNER_CHANGED');
  if (context.conversationId !== scope.conversationId) fail('CONTEXT_CHANGED');
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) fail('INVALID_STATE');
  const session = state.conversations.find((item: any) => item.id === scope.conversationId);
  if (!session || session.stopped) fail('STOPPED');
  if (session.activeQuestionKey !== scope.questionKey) fail('CONTEXT_CHANGED');
  const question = state.questions.find((item: any) => `${item.id}@${item.version}` === scope.questionKey);
  const attempts = state.attempts.filter(
    (item: any) => item.conversationId === scope.conversationId && item.questionKey === scope.questionKey
  );
  const attempt = attempts.find((item: any) => item.id === scope.attemptId);
  if (!question || !attempt || attempt !== attempts.at(-1)) fail('ORIGINAL_ANSWER_CHANGED');
  const derived = deriveAlgebraQuestion(question.prompt);
  if (!derived || derived.task !== 'equation') fail('UNSUPPORTED_QUESTION');
  if (question.uncertainties?.some((item: any) => !item.resolved)) fail('UNRESOLVED_QUESTION');
  const sides = derived.expression.split('=');
  if (sides.length !== 2) fail('UNSUPPORTED_QUESTION');
  let input;
  try {
    input = {
      left: parseAlgebraExpression(sides[0]),
      right: parseAlgebraExpression(sides[1]),
      domain: derived.domain
    };
  } catch {
    fail('UNSUPPORTED_QUESTION');
  }
  if (Buffer.byteLength(JSON.stringify(input)) > SYMPY_ADAPTER.bytes) fail('INPUT_LIMIT');
  // A change of source, answer, version, task epoch or stop/resume revision yields a different identity.
  const binding = {
    ...scope,
    epoch: context.epoch,
    revision: state.revision,
    questionDigest: digest(question),
    attemptDigest: digest(attempt)
  };
  return {
    contract: SYMPY_ADAPTER.contract,
    requestId: digest({ adapter: SYMPY_ADAPTER.contract, upstream: SYMPY_ADAPTER.version, binding, input }),
    binding,
    input
  };
}

export function validateSympyResult(value: any) {
  const texts = (list: unknown, max: number) =>
    Array.isArray(list) &&
    list.length <= max &&
    new Set(list).size === list.length &&
    list.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 512 && !/[\r\n\0]/.test(item));
  if (
    !value ||
    Object.keys(value).sort().join(',') !== 'all,domain,excluded,gradingAuthority,solutions,upstream,version' ||
    value.upstream !== 'sympy' ||
    value.version !== SYMPY_ADAPTER.version ||
    value.gradingAuthority !== false ||
    typeof value.all !== 'boolean' ||
    !['real', 'positive', 'integer'].includes(value.domain) ||
    !texts(value.solutions, 6) ||
    !texts(value.excluded, 204) ||
    (value.all && value.solutions.length) ||
    value.solutions.some((item: string) => value.excluded.includes(item))
  )
    fail('INVALID_RESULT');
  return value;
}

type Runtime = { python: string; packages: string };
/** Trusted host configuration only; paths are not an API/model argument. No shell or inherited credentials. */
export function runSympyWorker(input: unknown, runtime: Runtime, signal?: AbortSignal): Promise<any> {
  if (!runtime || !isAbsolute(runtime.python) || !isAbsolute(runtime.packages)) fail('RUNTIME_UNAVAILABLE');
  if (!['darwin', 'linux'].includes(process.platform)) fail('RUNTIME_UNAVAILABLE');
  if (signal?.aborted) fail('CANCELLED');
  const payload = JSON.stringify(input);
  if (Buffer.byteLength(payload) > SYMPY_ADAPTER.bytes) fail('INPUT_LIMIT');
  return new Promise((resolve, reject) => {
    const child = spawn(
      runtime.python,
      ['-I', '-B', fileURLToPath(new URL('./learning-sympy-worker.py', import.meta.url)), runtime.packages],
      { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' } }
    );
    let output = Buffer.alloc(0);
    let errorCode = '';
    let finished = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    let monitorFailureTimer: ReturnType<typeof setTimeout> | undefined;
    let memoryProbe: ReturnType<typeof execFile> | undefined;
    const stop = (code: string) => {
      if (finished || errorCode) return;
      errorCode = code;
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => {
        if (!finished) child.kill('SIGKILL');
      }, 200);
    };
    const onAbort = () => stop('CANCELLED');
    signal?.addEventListener('abort', onAbort, { once: true });
    const wall = setTimeout(() => stop('TIME_LIMIT'), SYMPY_ADAPTER.wallMs);
    // RSS is sampled, not a hard memory sandbox. Linux additionally enforces RLIMIT_AS in the worker.
    const memory = setInterval(() => {
      if (!child.pid || finished || errorCode || memoryProbe) return;
      memoryProbe = execFile(
        '/bin/ps',
        ['-o', 'rss=', '-p', String(child.pid)],
        { timeout: 500, maxBuffer: 1024 },
        (error, stdout) => {
          memoryProbe = undefined;
          if (finished || errorCode || child.exitCode !== null || child.signalCode !== null) return;
          const rss = Number(stdout.trim());
          if (error || !Number.isFinite(rss) || rss <= 0) {
            // ps may observe process exit before Node delivers exit/close. Briefly await that event;
            // an ongoing process with an unavailable monitor still fails closed.
            monitorFailureTimer = setTimeout(() => {
              if (!finished && child.exitCode === null && child.signalCode === null) stop('RESOURCE_MONITOR_FAILED');
            }, 25);
            return;
          }
          if (rss * 1024 > SYMPY_ADAPTER.rssBytes) stop('MEMORY_LIMIT');
        }
      );
    }, 100);
    const settle = (error?: Error, value?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(wall);
      clearInterval(memory);
      clearTimeout(forceTimer);
      clearTimeout(monitorFailureTimer);
      signal?.removeEventListener('abort', onAbort);
      if (memoryProbe) memoryProbe.kill('SIGTERM');
      if (error) reject(error);
      else resolve(value);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      if (errorCode) return;
      if (output.length + chunk.length > SYMPY_ADAPTER.bytes) return stop('OUTPUT_LIMIT');
      output = Buffer.concat([output, chunk]);
    });
    // Drain stderr without retaining input, traceback or local paths in a response/log.
    child.stderr.resume();
    child.stdin.on('error', () => stop('WORKER_FAILED'));
    child.on('error', () => settle(new SympyAdapterError('RUNTIME_UNAVAILABLE')));
    child.on('close', (code, signal) => {
      if (errorCode || code !== 0)
        return settle(new SympyAdapterError(errorCode || (signal === 'SIGXCPU' ? 'TIME_LIMIT' : 'WORKER_FAILED')));
      try {
        settle(undefined, validateSympyResult(JSON.parse(output.toString('utf8'))));
      } catch {
        settle(new SympyAdapterError('INVALID_RESULT'));
      }
    });
    if (signal?.aborted) onAbort();
    child.stdin.end(payload);
  });
}

/** The caller must re-read its actual current identity/state, and record help before showing the reference. */
export async function computeSympyReference(
  scope: Scope,
  readContext: () => SympyContext | Promise<SympyContext>,
  runtime: Runtime,
  signal?: AbortSignal
) {
  const request = prepareSympyReference(await readContext(), scope);
  if (signal?.aborted) fail('CANCELLED');
  const result = await runSympyWorker(request.input, runtime, signal);
  if (signal?.aborted) fail('CANCELLED');
  const current = prepareSympyReference(await readContext(), scope);
  if (signal?.aborted) fail('CANCELLED');
  if (current.requestId !== request.requestId) fail('CONTEXT_CHANGED');
  if (result.domain !== request.input.domain) fail('INVALID_RESULT');
  return {
    contract: SYMPY_ADAPTER.contract,
    requestId: request.requestId,
    binding: request.binding,
    source: {
      name: 'SymPy',
      version: SYMPY_ADAPTER.version,
      license: SYMPY_ADAPTER.license,
      url: SYMPY_ADAPTER.source
    },
    result,
    gradingAuthority: false,
    persisted: false,
    requiresHelpRecord: true
  };
}
