import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const smokeSource = readFileSync(resolve(process.cwd(), 'scripts/build/live-cloud-smoke.mjs'), 'utf8');

describe('live cloud smoke checks', () => {
  it('checks invalid tokens with a protected question-bank action', () => {
    const checkStart = smokeSource.indexOf("runCheck('question-bank invalid token'");
    const checkEnd = smokeSource.indexOf('let token = DIRECT_TOKEN', checkStart);
    const checkSource = smokeSource.slice(checkStart, checkEnd);

    expect(checkStart).toBeGreaterThan(-1);
    expect(checkSource).toContain("action: 'get_stats'");
    expect(checkSource).not.toContain("action: 'random'");
  });

  it('supports release mode that fails when required smoke checks are skipped', () => {
    expect(smokeSource).toContain('--fail-on-skipped');
    expect(smokeSource).toContain('SMOKE_FAIL_ON_SKIPPED');
    expect(smokeSource).toContain('skipped > 0');
    expect(smokeSource).toContain('Cloud smoke skipped checks are release blockers');
  });

  it('supports token-mode release smoke without requiring email code checks', () => {
    expect(smokeSource).toContain('SMOKE_TOKEN');
    expect(smokeSource).toContain('SMOKE_USER_ID');
    expect(smokeSource).toContain('Token mode uses SMOKE_TOKEN; email code check not required');
    expect(smokeSource).toContain('userIdFromToken');
  });

  it('uses deployed user-stats actions for authenticated study smoke', () => {
    expect(smokeSource).toContain("'user-stats'");
    expect(smokeSource).toContain("action: 'getOverview'");
    expect(smokeSource).toContain("action: 'getDailyStats'");
    expect(smokeSource).toContain("action: 'getTrend'");
    expect(smokeSource).not.toContain("'study-stats'");
  });

  it('can write a machine-readable smoke report', () => {
    expect(smokeSource).toContain('--output');
    expect(smokeSource).toContain('releaseReadiness');
    expect(smokeSource).toContain('canPublish');
  });
});
