import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { copyPwaIconAssets } from '../../scripts/build/pwa-assets.mjs';

describe('pwa assets', () => {
  it('declares the standard installable web app meta tag before H5 build', () => {
    const html = readFileSync('index.html', 'utf8');

    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes" />');
  });

  it('copies manifest icon assets into the H5 static output directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'exam-master-pwa-assets-'));
    try {
      const sourceDir = join(root, 'public/static/pwa-icons');
      const outDir = join(root, 'dist/build/h5');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(outDir, { recursive: true });

      writeFileSync(join(sourceDir, 'icon-192x192.png'), 'icon-192', 'utf8');
      writeFileSync(join(sourceDir, 'icon-512x512.png'), 'icon-512', 'utf8');
      writeFileSync(join(sourceDir, 'icon-512x512-maskable.png'), 'icon-maskable', 'utf8');

      const copied = copyPwaIconAssets({ sourceDir, outDir });

      expect(copied).toEqual([
        'icon-192x192.png',
        'icon-512x512-maskable.png',
        'icon-512x512.png'
      ]);
      expect(existsSync(join(outDir, 'static/pwa-icons/icon-192x192.png'))).toBe(true);
      expect(existsSync(join(outDir, 'static/pwa-icons/icon-512x512.png'))).toBe(true);
      expect(existsSync(join(outDir, 'static/pwa-icons/icon-512x512-maskable.png'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
