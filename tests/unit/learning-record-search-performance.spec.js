// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { beforeAll, expect, it } from 'vitest';
import { recordSearchFixture, benchmarkRecordSearch } from '../../scripts/build/benchmark-learning-record-search.mjs';
import { HISTORY_LIMITS } from '../../laf-backend/functions/_shared/learning-history.js';

let state;
beforeAll(() => {
  const started = performance.now();
  let previous = started,
    batch = 0;
  console.info(
    'record-search-setup',
    JSON.stringify({ phase: 'beforeAll', uptime: execFileSync('uptime', { encoding: 'utf8' }).trim() })
  );
  state = recordSearchFixture(5000, (phase) => {
    const now = performance.now();
    console.info(
      'record-search-setup',
      JSON.stringify({ phase, batch: batch++, elapsedMs: now - started, stageMs: now - previous })
    );
    previous = now;
  });
  console.info(
    'record-search-setup',
    JSON.stringify({ phase: 'ready', uptime: execFileSync('uptime', { encoding: 'utf8' }).trim() })
  );
}, 60000);

it('searches 5,000 canonical originals within a loose CI budget; dedicated local target is <100ms', () => {
  expect(state.attempts).toHaveLength(5000);
  expect(JSON.stringify(state).length).toBeGreaterThan(3600000);
  expect(JSON.stringify(state).length).toBeLessThan(3800000);
  expect(JSON.stringify(state).length).toBeLessThanOrEqual(HISTORY_LIMITS.stateCharacters);
  expect(state.events.length).toBeLessThanOrEqual(HISTORY_LIMITS.operations);
  const { coldMs, maxCachedMs } = benchmarkRecordSearch(state);
  // 10x the local target allows scheduler contention; the standalone benchmark records its CPU/OS/load and enforces 100ms.
  expect(coldMs).toBeLessThan(1000);
  expect(maxCachedMs).toBeLessThan(1000);
});
