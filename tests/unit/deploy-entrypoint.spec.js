import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('H5 deployment entrypoint', () => {
  let root, script, calls, env;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'exam-deploy-'));
    mkdirSync(join(root, 'deploy/tencent/scripts'), { recursive: true });
    mkdirSync(join(root, 'bin'));
    script = join(root, 'deploy/tencent/scripts/deploy-h5.sh');
    copyFileSync(resolve('deploy/tencent/scripts/deploy-h5.sh'), script);
    calls = join(root, 'calls');
    env = { HOME: root, PATH: `${root}/bin:/usr/bin:/bin`, CALLS: calls };
    for (const command of ['npm', 'ssh', 'scp', 'rsync', 'curl', 'sudo', 'systemctl']) {
      writeFileSync(join(root, 'bin', command), '#!/bin/bash\necho "${0##*/}:$PWD:$*" >> "$CALLS"\nexit 99\n', { mode: 0o755 });
    }
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const run = (...args) => spawnSync('/bin/bash', [script, ...args], { cwd: '/', env, encoding: 'utf8', timeout: 5000 });

  it('blocks default deployment before any build or remote command', () => {
    expect(run().status).toBe(78);
    expect(existsSync(calls)).toBe(false);
  });
  it('does not allow flags or environment variables to bypass the block', () => {
    Object.assign(env, { FORCE: '1', DEPLOY_APPROVED: '1', DEPLOY_HOST: 'fixture.invalid' });
    for (const args of [['--force'], ['--deploy'], ['--build-only', '--force']]) {
      expect(run(...args).status).toBe(64);
    }
    expect(existsSync(calls)).toBe(false);
  });
  it('provides help without side effects', () => {
    expect(run('--help').status).toBe(0);
    expect(existsSync(calls)).toBe(false);
  });
  it('propagates a failed build without claiming success', () => {
    const result = run('--build-only');
    expect(result.status).toBe(99);
    expect(readFileSync(calls, 'utf8').trim().split('\n')).toHaveLength(1);
    expect(result.stdout).not.toContain('构建通过');
  });
  it('rejects a successful build command with no artifact', () => {
    writeFileSync(join(root, 'bin/npm'), '#!/bin/bash\nexit 0\n');
    expect(run('--build-only').status).not.toBe(0);
  });
  it('builds from the project root and checks the candidate without remote calls', () => {
    writeFileSync(join(root, 'bin/npm'), '#!/bin/bash\necho "npm:$PWD:$*" >> "$CALLS"\nmkdir -p dist/build/h5\necho fixture > dist/build/h5/index.html\n');
    const result = run('--build-only');
    expect(result.status).toBe(0);
    expect(readFileSync(calls, 'utf8').trim()).toBe(`npm:${root}:run build:h5`);
    expect(result.stdout).toContain('未发布到生产');
  });
});
