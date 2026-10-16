// @vitest-environment node
import { beforeAll, expect, it } from 'vitest';
import { recordSearchFixture, benchmarkRecordSearch } from '../../scripts/build/benchmark-learning-record-search.mjs';
import { HISTORY_LIMITS } from '../../laf-backend/functions/_shared/learning-history.js';

let state;
beforeAll(() => {
  state = recordSearchFixture();
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
