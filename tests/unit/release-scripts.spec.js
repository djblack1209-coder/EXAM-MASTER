import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

describe('release scripts', () => {
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
    const rotateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/rotate-secrets.sh'), 'utf8');
    const saltCommand = rotateScript
      .split('\n')
      .find((line) => line.includes('REQUEST_SIGN_SALT=') && line.includes('openssl rand'));

    expect(saltCommand).toBeTruthy();
    expect(saltCommand).toContain('openssl rand -hex 32');
  });

  it('exposes verified source evidence commands for release operators', () => {
    expect(packageJson.scripts['baidu:sources:verified']).toContain('scripts/baidu/verified_source_registry.py');
    expect(packageJson.scripts['baidu:sources:merge']).toContain('scripts/baidu/source_manifest.py');
    expect(packageJson.scripts['baidu:sources:merge']).toContain('verified-source-export.json');
  });

  it('blocks release promotion while cleaned flashcards are missing answer evidence', () => {
    expect(packageJson.scripts['baidu:flashcards:quality']).toContain('scripts/baidu/flashcard_quality.py');
    expect(packageJson.scripts['baidu:flashcards:quality:release']).toContain('--fail-on-blockers');
    expect(packageJson.scripts['release:gate:report']).toContain('npm run baidu:flashcards:quality');
    expect(packageJson.scripts['release:gate']).toContain('npm run baidu:flashcards:quality:release');
  });

  it('exposes a smoke jwt helper for authenticated cloud smoke', () => {
    expect(packageJson.scripts['smoke:jwt']).toContain('scripts/build/create-smoke-jwt.mjs');
  });
});
