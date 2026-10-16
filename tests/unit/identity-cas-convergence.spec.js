import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
it('regress-1/order-1, order-2, migrate-02: shared identity serialization and CAS', () => {
  const child = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', 'tests/fixtures/session-races/convergence.mjs'],
    { encoding: 'utf8', timeout: 15000 }
  );
  expect(child.status, child.stderr).toBe(0);
  const cases = child.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(cases).toHaveLength(5);
  for (const item of cases) expect(item.ok, item.name).toBe(true);
});

it('order-01: no Web Locks cannot resurrect old identity after peer relogin or switch', () => {
  const child = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', 'tests/fixtures/session-races/threads.mjs', '--fallback'],
    { encoding: 'utf8', timeout: 15000 }
  );
  expect(child.status, child.stderr).toBe(0);
  const cases = child.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(cases).toHaveLength(2);
  for (const item of cases) expect(item.ok, item.name).toBe(true);
});
