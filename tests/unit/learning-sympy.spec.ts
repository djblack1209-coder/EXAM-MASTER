// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAlgebraQuestion } from '../../laf-backend/functions/_shared/learning-algebra.js';
import { applyLearningOperation, emptyLearningState } from '../../laf-backend/functions/_shared/learning-domain.js';
import {
  computeSympyReference,
  prepareSympyReference,
  runSympyWorker,
  validateSympyResult
} from '../../laf-backend/functions/_shared/learning-sympy';

const processes = vi.hoisted(() => ({ spawn: vi.fn(), execFile: vi.fn() }));
vi.mock('node:child_process', () => ({ ...processes, default: processes }));
const scope = { ownerId: 'sympy-owner', conversationId: 'task-a', questionKey: 'q@1', attemptId: 'answer-a' };
const runtime = { python: '/trusted/python', packages: '/trusted/packages' };
// This subprocess only checks rejection before the optional runtime loads. Allow OS startup contention;
// the adapter's independent 5s wall/3s CPU limits remain covered below and are not changed.
const validationProcessTimeoutMs = 10000;
function context(goal = '解方程 x^2-2=0', answer = 'sqrt(2)') {
  let state = emptyLearningState(scope.ownerId);
  for (const op of [
    { id: scope.conversationId, type: 'conversation.start', data: { goal: '解方程' } },
    {
      id: 'question-a',
      type: 'question.add',
      data: { conversationId: scope.conversationId, question: createAlgebraQuestion('q', goal) }
    },
    {
      id: 'focus-a',
      type: 'question.focus',
      data: { conversationId: scope.conversationId, questionKey: scope.questionKey }
    },
    {
      id: scope.attemptId,
      type: 'attempt.submit',
      data: { conversationId: scope.conversationId, answer, explicit: true }
    }
  ])
    state = applyLearningOperation(state, op).state;
  return { ownerId: scope.ownerId, conversationId: scope.conversationId, epoch: 'view-a', state };
}
const output = () => ({
  upstream: 'sympy',
  version: '1.14.0',
  domain: 'real',
  all: false,
  solutions: ['-sqrt(2)', 'sqrt(2)'],
  excluded: [],
  gradingAuthority: false
});

describe.skipIf(process.platform === 'win32')(
  'worker rejects invalid inputs before loading its optional runtime',
  () => {
    it.each([
      [
        'code coefficient',
        'rational_limit',
        (input: any) => {
          input.left.numerator[0][0] = '__import__("builtins").print("UNEXPECTED_EXECUTION")';
        }
      ],
      [
        'boolean coefficient',
        'rational_limit',
        (input: any) => {
          input.left.numerator[0][0] = true;
        }
      ],
      [
        'oversized coefficient',
        'rational_limit',
        (input: any) => {
          input.left.numerator[0][0] = 1000000001;
        }
      ],
      [
        'zero rational denominator',
        'rational_limit',
        (input: any) => {
          input.left.numerator[0][1] = 0;
        }
      ],
      [
        'degree limit',
        'polynomial_limit',
        (input: any) => {
          input.left.numerator = Array.from({ length: 8 }, () => [1, 1]);
        }
      ],
      [
        'restriction limit',
        'restriction_limit',
        (input: any) => {
          input.left.restrictions = Array.from({ length: 17 }, () => [[1, 1]]);
        }
      ],
      [
        'unknown domain',
        'request_shape',
        (input: any) => {
          input.domain = 'complex';
        }
      ]
    ])(
      'rejects %s with no installed SymPy dependency',
      async (_label, errorCode, change) => {
        const { spawnSync } = await vi.importActual<typeof import('node:child_process')>('node:child_process');
        const packages = mkdtempSync(join(tmpdir(), 'yozi-sympy-validation-'));
        const input = {
          left: {
            numerator: [
              [-2, 1],
              [0, 1],
              [1, 1]
            ],
            denominator: [[1, 1]],
            restrictions: []
          },
          right: { numerator: [[0, 1]], denominator: [[1, 1]], restrictions: [] },
          domain: 'real'
        };
        (change as (value: any) => void)(input);
        try {
          const result = spawnSync(
            '/usr/bin/python3',
            [
              '-I',
              '-S',
              '-B',
              fileURLToPath(new URL('../../laf-backend/functions/_shared/learning-sympy-worker.py', import.meta.url)),
              packages
            ],
            {
              input: JSON.stringify(input),
              encoding: 'utf8',
              env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
              timeout: validationProcessTimeoutMs,
              maxBuffer: 16384
            }
          );
          expect(result.error).toBeUndefined();
          expect(result.status).toBe(1);
          expect(result.stdout).toBe('');
          expect(result.stderr).toContain(`ValueError: ${errorCode}`);
          expect(result.stderr).not.toContain('ModuleNotFoundError');
        } finally {
          rmSync(packages, { recursive: true });
        }
      },
      15000
    );
  }
);
function child() {
  const c: any = new EventEmitter();
  Object.assign(c, {
    pid: 1234,
    exitCode: null,
    signalCode: null,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough()
  });
  c.kill = vi.fn((signal) => {
    queueMicrotask(() => {
      c.signalCode = signal;
      c.emit('close', null);
    });
    return true;
  });
  c.finish = (value = output(), code = 0) => {
    c.stdout.write(JSON.stringify(value));
    c.exitCode = code;
    c.emit('close', code);
  };
  processes.spawn.mockReturnValue(c);
  return c;
}
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('saved question and original-answer binding', () => {
  it('derives stable structured coefficients only from the current original question without changing pending facts', () => {
    const c = context();
    const before = JSON.stringify(c);
    const first = prepareSympyReference(c, scope);
    expect(prepareSympyReference(c, scope)).toEqual(first);
    expect(first.input.left.numerator).toEqual([
      [-2, 1],
      [0, 1],
      [1, 1]
    ]);
    expect(JSON.stringify(first.input)).not.toContain('sqrt');
    expect(c.state.attempts[0].grade.status).toBe('pending');
    expect(JSON.stringify(c)).toBe(before);
  });
  it('keeps the declared symbol and original answer in request binding while sending only canonical coefficients', () => {
    const named = context('解关于 t 的方程 2*t+3=9', 't=3');
    const canonical = context('解方程 2*x+3=9', 'x=3');
    const before = JSON.stringify(named);
    const prepared = prepareSympyReference(named, scope);
    expect(prepared.input).toEqual(prepareSympyReference(canonical, scope).input);
    expect(prepared.requestId).not.toBe(prepareSympyReference(canonical, scope).requestId);
    expect(JSON.stringify(prepared.input)).not.toMatch(/t=3|关于|symbol|ownerId/);
    expect(named.state.attempts[0].answer).toBe('t=3');
    expect(JSON.stringify(named)).toBe(before);
  });
  it('does not extend an unmarked historical question into the new named equation compute contract', () => {
    const legacy = context('解关于 t 的方程 2*t+3=9', 't=3');
    legacy.state.questions[0].source = { kind: 'model_generated' };
    delete legacy.state.questions[0].algebra;
    expect(() => prepareSympyReference(legacy, scope)).toThrow('UNSUPPORTED_QUESTION');
    expect(processes.spawn).not.toHaveBeenCalled();
  });
  it('does not expand the equation-only compute permission to named linear inequalities', () => {
    const named = context('解关于 t 的不等式 -2*t+6>0', 't<3');
    expect(() => prepareSympyReference(named, scope)).toThrow('UNSUPPORTED_QUESTION');
    expect(processes.spawn).not.toHaveBeenCalled();
  });
  it.each([
    [
      'owner',
      (c: any) => {
        c.ownerId = 'someone';
      },
      'OWNER_CHANGED'
    ],
    [
      'state owner',
      (c: any) => {
        c.state.owner = 'someone';
      },
      'OWNER_CHANGED'
    ],
    [
      'task',
      (c: any) => {
        c.conversationId = 'other';
      },
      'CONTEXT_CHANGED'
    ],
    [
      'question',
      (c: any) => {
        c.state.conversations[0].activeQuestionKey = 'other@1';
      },
      'CONTEXT_CHANGED'
    ],
    [
      'stopped',
      (c: any) => {
        c.state.conversations[0].stopped = true;
      },
      'STOPPED'
    ],
    [
      'missing answer',
      (c: any) => {
        c.state.attempts = [];
      },
      'ORIGINAL_ANSWER_CHANGED'
    ],
    [
      'newer answer',
      (c: any) => {
        c.state.attempts.push({ ...c.state.attempts[0], id: 'new' });
      },
      'ORIGINAL_ANSWER_CHANGED'
    ],
    [
      'new version',
      (c: any) => {
        c.state.questions[0].version++;
      },
      'ORIGINAL_ANSWER_CHANGED'
    ],
    [
      'uncertainty',
      (c: any) => {
        c.state.questions[0].uncertainties = [{ resolved: false }];
      },
      'UNRESOLVED_QUESTION'
    ],
    [
      'unsupported',
      (c: any) => {
        c.state.questions[0].prompt = '任意程序';
      },
      'UNSUPPORTED_QUESTION'
    ]
  ])('rejects %s', (_, change, code) => {
    const c = context();
    (change as Function)(c);
    expect(() => prepareSympyReference(c, scope)).toThrow(code as string);
  });
  it('question source, raw original, task epoch, and stop/resume revision change the request identity', () => {
    for (const change of [
      (c: any) => {
        c.state.questions[0].source = { kind: 'different' };
      },
      (c: any) => {
        c.state.attempts[0].answer = 'another original';
      },
      (c: any) => {
        c.epoch = 'view-b';
      },
      (c: any) => {
        c.state.revision += 2;
      }
    ]) {
      const c = context();
      const first = prepareSympyReference(c, scope);
      change(c);
      expect(prepareSympyReference(c, scope).requestId).not.toBe(first.requestId);
    }
  });
  it('rejects extra scope authority or incomplete scope', () => {
    expect(() => prepareSympyReference(context(), { ...scope, authority: true } as any)).toThrow('INVALID_SCOPE');
    const { attemptId: _, ...missing } = scope;
    expect(() => prepareSympyReference(context(), missing as any)).toThrow('INVALID_SCOPE');
  });
});

describe('bounded worker and late result handling', () => {
  it('returns a bound unpersisted reference; does not send the original answer or inherit environment credentials', async () => {
    const c = context();
    const before = JSON.stringify(c);
    const p = child();
    const done = computeSympyReference(scope, () => c, runtime);
    await vi.waitFor(() => expect(processes.spawn).toHaveBeenCalledOnce());
    p.finish();
    const result = await done;
    expect(result).toMatchObject({
      gradingAuthority: false,
      persisted: false,
      requiresHelpRecord: true,
      binding: { attemptId: scope.attemptId },
      source: { version: '1.14.0', license: 'BSD-3-Clause' }
    });
    expect(JSON.stringify(c)).toBe(before);
    const [, args, opts] = processes.spawn.mock.calls[0];
    expect(args.slice(0, 2)).toEqual(['-I', '-B']);
    expect(opts.env).toEqual({ PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' });
    expect(opts.shell).toBeUndefined();
  });
  it.each(['epoch', 'stop', 'original', 'owner', 'revision'])('rejects late %s changes', async (change) => {
    const c = context();
    const p = child();
    const done = computeSympyReference(scope, () => c, runtime);
    const rejection = expect(done).rejects.toBeInstanceOf(Error);
    await vi.waitFor(() => expect(processes.spawn).toHaveBeenCalledOnce());
    if (change === 'epoch') c.epoch = 'later';
    if (change === 'stop') c.state.conversations[0].stopped = true;
    if (change === 'original') c.state.attempts[0].answer = 'later';
    if (change === 'owner') c.ownerId = 'other';
    if (change === 'revision') c.state.revision++;
    p.finish();
    await rejection;
  });
  it('pre-cancel never starts a process; in-flight cancellation terminates and awaits the child', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(computeSympyReference(scope, context, runtime, controller.signal)).rejects.toThrow('CANCELLED');
    expect(processes.spawn).not.toHaveBeenCalled();
    const p = child();
    const next = new AbortController();
    const done = runSympyWorker({}, runtime, next.signal);
    const rejected = expect(done).rejects.toThrow('CANCELLED');
    next.abort();
    await rejected;
    expect(p.kill).toHaveBeenCalledWith('SIGTERM');
  });
  it('rejects oversized output and stops its worker', async () => {
    const p = child();
    const done = runSympyWorker({}, runtime);
    const rejected = expect(done).rejects.toThrow('OUTPUT_LIMIT');
    p.stdout.write('x'.repeat(16385));
    await rejected;
    expect(p.kill).toHaveBeenCalledWith('SIGTERM');
  });
  it('time limit terminates and reaps a stalled worker', async () => {
    vi.useFakeTimers();
    const p = child();
    processes.execFile.mockImplementation(() => ({ kill: vi.fn() }));
    const done = runSympyWorker({}, runtime);
    const rejected = expect(done).rejects.toThrow('TIME_LIMIT');
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(p.kill).toHaveBeenCalledWith('SIGTERM');
  });
  it('keeps the resource monitor environment independent of host credentials', async () => {
    vi.useFakeTimers();
    const p = child();
    processes.execFile.mockImplementation((_a, _b, _c, callback) => {
      queueMicrotask(() => callback(null, '1024'));
      return { kill: vi.fn() };
    });
    const done = runSympyWorker({}, runtime);
    await vi.advanceTimersByTimeAsync(100);
    expect(processes.execFile.mock.calls[0][2].env).toEqual({ PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' });
    p.finish();
    await done;
  });
  it.each([
    ['999999', null, 'MEMORY_LIMIT'],
    ['bad', null, 'RESOURCE_MONITOR_FAILED'],
    ['', new Error('ps'), 'RESOURCE_MONITOR_FAILED']
  ])('monitors RSS and fails closed: %s', async (rss, error, code) => {
    vi.useFakeTimers();
    const p = child();
    processes.execFile.mockImplementation((_a, _b, _c, callback) => {
      queueMicrotask(() => callback(error, rss));
      return { kill: vi.fn() };
    });
    const done = runSympyWorker({}, runtime);
    const rejected = expect(done).rejects.toThrow(code as string);
    await vi.advanceTimersByTimeAsync(125);
    await rejected;
    expect(p.kill).toHaveBeenCalledWith('SIGTERM');
  });
  it('lets normal child close settle when ps observes its exit first', async () => {
    vi.useFakeTimers();
    const p = child();
    processes.execFile.mockImplementation((_a, _b, _c, callback) => {
      queueMicrotask(() => callback(new Error('already exited'), ''));
      return { kill: vi.fn() };
    });
    const done = runSympyWorker({}, runtime);
    await vi.advanceTimersByTimeAsync(100);
    p.finish();
    await expect(done).resolves.toEqual(output());
    await vi.advanceTimersByTimeAsync(50);
    expect(p.kill).not.toHaveBeenCalled();
  });
  it('reports the operating system CPU limit as a resource timeout', async () => {
    const p = child();
    const done = runSympyWorker({}, runtime);
    const rejected = expect(done).rejects.toThrow('TIME_LIMIT');
    p.emit('close', null, 'SIGXCPU');
    await rejected;
  });
  it.each([
    { version: 'other' },
    { gradingAuthority: true },
    { all: true },
    { solutions: ['2', '2'] },
    { excluded: ['sqrt(2)'] },
    { score: 100 },
    { solutions: [''] },
    { domain: 'complex' }
  ])('rejects mismatched or inflated worker output %j', (patch) => {
    expect(() => validateSympyResult({ ...output(), ...patch })).toThrow('INVALID_RESULT');
  });
});
