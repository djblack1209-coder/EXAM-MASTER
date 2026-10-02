import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { literalImports, resolveLocalReference, scanRepository } from '../../scripts/build/repository-health.mjs';

let fixture;
afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
  fixture = undefined;
});
describe('仓库引用审计', () => {
  it('JS/Vue/动态import/require是真实语法，注释和字符串夹具不误报', () => {
    const code = `// import './gone.js'\nconst fixture = "require('./absent.js')";\nimport './a.js'; export { x } from './b.js'; import('./c.js'); require('./d.js');`;
    expect(literalImports(code, 'a.js')).toEqual(['./a.js', './b.js', './c.js', './d.js']);
    expect(
      literalImports(
        `<template><text>import './fake.js'</text></template><script setup>import X from './X.vue';</script>`,
        'a.vue'
      )
    ).toEqual(['./X.vue']);
    expect(literalImports('#!/usr/bin/env node\nimport "./cli.js";', 'cli.mjs')).toEqual(['./cli.js']);
  });
  it('Node16 .js导入解析到TS/声明，忽略外部包，正确标出不存在文件', () => {
    fixture = mkdtempSync(join(tmpdir(), 'exam-references-'));
    writeFileSync(join(fixture, 'types.d.ts'), 'export interface X {}');
    expect(resolveLocalReference('entry.ts', './types.js', fixture)).toBe('types.d.ts');
    expect(resolveLocalReference('entry.ts', 'node:fs', fixture)).toBeNull();
    expect(resolveLocalReference('entry.ts', './missing.js', fixture)).toBe(false);
  });
  it('隔离Git夹具发现真实坏链/失效脚本/语法错误，忽略缓存且不删除文件', () => {
    fixture = mkdtempSync(join(tmpdir(), 'exam-audit-'));
    execFileSync('git', ['init', '-q'], { cwd: fixture });
    mkdirSync(join(fixture, 'src'));
    mkdirSync(join(fixture, 'tmp'));
    writeFileSync(join(fixture, '.gitignore'), 'tmp/\n');
    writeFileSync(join(fixture, 'README.md'), '[bad](missing.md)\n[invalid](bad%zz.md)');
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ scripts: { bad: 'node scripts/missing.mjs' } }));
    writeFileSync(join(fixture, 'src/broken.js'), 'const = ;');
    writeFileSync(join(fixture, 'src/entry.js'), "import './gone.js';");
    writeFileSync(join(fixture, 'tmp/secret.js'), 'const = ;');
    const report = scanRepository(fixture);
    expect(report.missingScripts).toHaveLength(1);
    expect(report.brokenLinks).toHaveLength(2);
    expect(report.parseErrors).toHaveLength(1);
    expect(report.missingImports).toEqual([{ file: 'src/entry.js', reference: './gone.js' }]);
    expect(report.counts.sources).toBe(2);
    expect(scanRepository(fixture).counts).toEqual(report.counts);
  });
});
