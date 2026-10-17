import { performance } from 'node:perf_hooks';
import { cpus, loadavg, release } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyLearningState,
  createLearningOperationBatch
} from '../../laf-backend/functions/_shared/learning-domain.js';
import { HISTORY_LIMITS } from '../../laf-backend/functions/_shared/learning-history.js';
import { createLearningRecordSearch } from '../../laf-backend/functions/_shared/learning-record-search.js';

// Synthetic canonical facts, produced by the real operation reducer; no stored user data or model calls.
export function recordSearchFixture(count = 5000, onPhase = () => {}) {
  onPhase('start');
  let state = emptyLearningState('search-bench', 'America/Los_Angeles');
  let batch = createLearningOperationBatch(state, 500),
    operations = 0;
  const put = (id, type, data) => {
    if (operations === 500) {
      state = batch.finish();
      onPhase('batch-committed');
      batch = createLearningOperationBatch(state, 500);
      operations = 0;
    }
    batch.apply({ id, type, data, at: 1700000000000 });
    operations++;
  };
  put('c', 'conversation.start', { goal: '隔离搜索性能' });
  put('q', 'question.add', {
    question: {
      id: 'q',
      version: 1,
      prompt: '计算 12 + 8。',
      scope: 'generated',
      source: { kind: 'executable' },
      validation: { type: 'number', answer: '20', authority: 'executable', evidenceId: 'integer-arithmetic-v1' }
    }
  });
  put('f', 'question.focus', { conversationId: 'c', questionKey: 'q@1' });
  for (let i = 0; i < count; i++) put(`a${i}`, 'attempt.submit', { conversationId: 'c', answer: '19', explicit: true });
  const result = batch.finish();
  onPhase('complete');
  return result;
}

export function benchmarkRecordSearch(state) {
  const search = createLearningRecordSearch();
  const query = 'no-such-original-answer';
  const start = performance.now();
  const cold = search.search(state, query, {}, 'benchmark-lifecycle');
  const coldMs = performance.now() - start;
  const samplesMs = Array.from({ length: 20 }, (_, i) => {
    const before = performance.now();
    const result = search.search(state, `${query}-${i}`, {}, 'benchmark-lifecycle');
    if (result.total !== 0) throw new Error('Expected no matches');
    return performance.now() - before;
  });
  if (cold.total !== 0) throw new Error('Expected no matches');
  return { coldMs, samplesMs, maxCachedMs: Math.max(...samplesMs) };
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const state = recordSearchFixture();
  const characters = JSON.stringify(state).length;
  if (characters > HISTORY_LIMITS.stateCharacters || state.events.length > HISTORY_LIMITS.operations)
    throw new Error('Fixture exceeds canonical capacity');
  const measurement = benchmarkRecordSearch(state);
  const result = {
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      os: release(),
      cpu: cpus()[0]?.model,
      loadAverage: loadavg()
    },
    attempts: state.attempts.length,
    characters,
    operations: state.events.length,
    thresholdMs: 100,
    thresholdScope:
      'Dedicated local run; cold projection plus each cached no-match query. CI uses a separate loose limit.',
    ...measurement,
    passed: measurement.coldMs < 100 && measurement.maxCachedMs < 100
  };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.passed ? 0 : 1;
}
