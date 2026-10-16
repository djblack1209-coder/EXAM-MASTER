import { beforeAll, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
const results = new Map();
beforeAll(() => {
  for (const name of ['probe', 'threads']) {
    const child = spawnSync(
      process.execPath,
      ['--experimental-vm-modules', `tests/fixtures/session-races/${name}.mjs`],
      { encoding: 'utf8', timeout: 15000 }
    );
    expect(child.status, child.stderr).toBe(0);
    for (const line of child.stdout.trim().split('\n')) {
      const item = JSON.parse(line);
      results.set(item.name, item.ok);
    }
  }
});
it.each([
  ['S1', 'R1-completed-peer-login-survives-loser'],
  ['inflight-1', 'A-revocation-during-commit-no-revival'],
  ['inflight-1', 'A-full-clear-during-commit-no-revival'],
  ['S2', 'migration-logout-keeps-revocation'],
  ['S3', 'migration-logout-old-epoch-recreated'],
  ['S3', 'S3-legacy-creation-cannot-revive'],
  ['inflight-2', 'A-latest-attempt-only'],
  ['S4', 'R1-two-real-login-transactions-profile'],
  ['S5', 'R1-foreign-profile-never-enters-origin-partition']
])('%s: %s', (_id, name) => expect(results.get(name)).toBe(true));
