import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { verifyAppArtifacts } from '../../scripts/build/verify-app-artifacts.mjs';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-app-artifacts-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

describe('app artifact verifier', () => {
  it('accepts uni-app native app artifacts with relative runtime assets', () => {
    writeFixture({
      '__uniappview.html': '<script src="uni-app-view.umd.js"></script><link rel="stylesheet" href="app.css">',
      'manifest.json': '{"name":"Yozi AI"}',
      'app-config-service.js': 'const __uniRoutes=[]',
      'app-service.js': 'console.log("ok")',
      'app.css': 'body{color:#132618}',
      'uni-app-view.umd.js': 'console.log("view")'
    });

    expect(verifyAppArtifacts(tmpDir)).toEqual({ ok: true, blockerCount: 0, blockers: [] });
  });

  it('blocks absolute runtime asset paths and server-only env names', () => {
    writeFixture({
      '__uniappview.html': '<script src="/static/js/index.js"></script>',
      'manifest.json': '{"name":"Yozi AI"}',
      'app-config-service.js': 'const __uniRoutes=[]',
      'app-service.js': 'const secretName="JWT_SECRET"'
    });

    const result = verifyAppArtifacts(tmpDir);
    expect(result.ok).toBe(false);
    expect(result.blockers.map((item) => item.code)).toContain('absolute_runtime_asset_path');
    expect(result.blockers.map((item) => item.code)).toContain('server_secret_name_in_app_artifact');
  });
});
