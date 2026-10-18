import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequestSigningSalt } from '../../scripts/build/create-request-signing-salt.mjs';
import { buildPlatforms } from '../../scripts/build/build-all-platforms.mjs';

const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

describe('release scripts', () => {
  it('refuses unimplemented desktop packages and unknown flags before building', () => {
    const run = () => {
      throw new Error('Must not invoke a build');
    };
    expect(buildPlatforms(['--h5', '--mac'], { run })).toBe(1);
    expect(buildPlatforms(['--unsupported'], { run })).toBe(1);
  });

  it('reports a failed build as failure to its caller', () => {
    expect(
      buildPlatforms(['--h5'], {
        run: () => {
          throw new Error('Synthetic build failure');
        }
      })
    ).toBe(1);
    const commands = [];
    expect(buildPlatforms(['--h5'], { run: (_command, args) => commands.push(args) })).toBe(0);
    expect(commands).toEqual([['run', 'build:h5']]);
  });
  it('rebuilds release artifacts before running blocking release gates', () => {
    const reportScript = packageJson.scripts['release:gate:report'];
    const releaseScript = packageJson.scripts['release:gate'];

    expect(reportScript).toContain('npm run build:h5');
    expect(reportScript).toContain('npm run build:mp-weixin');
    expect(reportScript.indexOf('npm run build:mp-weixin')).toBeLessThan(
      reportScript.indexOf('npm run audit:wechat:artifacts')
    );

    expect(releaseScript).toContain('npm run build:h5');
    expect(releaseScript).toContain('npm run build:mp-weixin');
    expect(releaseScript.indexOf('npm run build:mp-weixin')).toBeLessThan(
      releaseScript.indexOf('npm run audit:wechat:artifacts')
    );
  });

  it('generates a request signing salt that satisfies the external release gate', () => {
    const first = createRequestSigningSalt();
    const second = createRequestSigningSalt();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it('exposes verified source evidence commands for release operators', () => {
    expect(packageJson.scripts['baidu:sources:verified']).toContain('scripts/baidu/verified_source_registry.py');
    expect(packageJson.scripts['baidu:sources:merge']).toContain('scripts/baidu/source_manifest.py');
    expect(packageJson.scripts['baidu:sources:merge']).toContain('verified-source-export.json');
  });

  it('keeps explicit retirement, public-build and external release checks', () => {
    expect(packageJson.scripts['audit:question-bank:release']).toContain('retired-bank-gate.mjs');
    expect(packageJson.scripts['release:gate']).toContain('audit:question-bank:release');
    expect(packageJson.scripts['release:gate']).toContain('audit:public-build');
    expect(packageJson.scripts['release:gate']).toContain('audit:release:external');
    expect(packageJson.scripts['release:gate']).not.toContain('baidu:flashcards:quality');
  });

  it('exposes a reproducible Baidu Python pipeline test entrypoint', () => {
    const pipelineScript = packageJson.scripts['test:baidu:pipeline'];

    expect(pipelineScript).toBeTypeOf('string');
    expect(pipelineScript).toContain('.venv-baidu/bin/python -m unittest');
    expect(pipelineScript).toContain('tests.unit.test_private_material_parser');
    expect(pipelineScript).not.toContain('tests.unit.test_baidu_cleaning_runner');
    expect(pipelineScript).not.toContain('tests.unit.test_flashcard_quality');
    expect(pipelineScript).toContain('tests.unit.test_material_upload_recovery');
  });

  it('generates a release blocker backlog in report and blocking gate modes', () => {
    expect(packageJson.scripts['audit:release:backlog']).toContain('scripts/build/release-blocker-backlog.mjs');
    expect(packageJson.scripts['audit:release:backlog:release']).toContain('--fail-on-blockers');
    expect(packageJson.scripts['release:gate:report']).toContain('npm run audit:release:backlog');
    expect(packageJson.scripts['release:gate']).toContain('npm run audit:release:backlog:release');
  });

  it('exposes a smoke jwt helper for authenticated cloud smoke', () => {
    expect(packageJson.scripts['smoke:jwt']).toContain('scripts/build/create-smoke-jwt.mjs');
  });
});
