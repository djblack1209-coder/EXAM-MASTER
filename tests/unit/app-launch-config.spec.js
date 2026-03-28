import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const inputDir = path.join(rootDir, 'src');
const pagesJson = JSON.parse(fs.readFileSync(path.join(inputDir, 'pages.json'), 'utf8'));
const manifestJson = JSON.parse(fs.readFileSync(path.join(inputDir, 'manifest.json'), 'utf8'));

describe('app-plus launch config', () => {
  it('launches splash page before tab pages', () => {
    expect(pagesJson.pages[0]?.path).toBe('pages/splash/index');
  });

  it('does not keep splash page inside subpackages', () => {
    const splashSubpackage = (pagesJson.subPackages || []).find((pkg) => pkg.root === 'pages/splash');
    expect(splashSubpackage).toBeUndefined();
  });

  it('lets native splashscreen autoclose to avoid indefinite startup hangs', () => {
    expect(manifestJson['app-plus']?.splashscreen?.autoclose).toBe(true);
    // 注意: 'plus' 是 'app-plus' 的遗留重复键，已在第九轮审计中清理
    expect(manifestJson.plus).toBeUndefined();
  });
});
