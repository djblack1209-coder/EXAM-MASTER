import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertMainPackageSourceBudget,
  assertNoFlashcardBanksInMainPackage,
  assertPracticeSubpackageBankDataRuntime
} from '../../scripts/build/check-mp-main-package-usage.mjs';

function makeBuildRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yozi-ai-mp-main-'));
}

describe('mp-weixin main package usage audit', () => {
  it('reserves at least 30 KiB without changing the 2 MiB hard ceiling', () => {
    const root = makeBuildRoot();
    try {
      const config = JSON.stringify({ pages: [] });
      fs.writeFileSync(path.join(root, 'app.json'), config);
      fs.writeFileSync(
        path.join(root, 'app.js'),
        Buffer.alloc(2 * 1024 * 1024 - 30 * 1024 - Buffer.byteLength(config))
      );
      expect(assertMainPackageSourceBudget(root, 30 * 1024).headroomBytes).toBe(30 * 1024);
      fs.appendFileSync(path.join(root, 'app.js'), 'x');
      expect(() => assertMainPackageSourceBudget(root, 30 * 1024)).toThrow('主包余量');
      expect(() => assertMainPackageSourceBudget(root)).not.toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  it('keeps the optional lab component inside the learning subpackage', () => {
    const page = fs.readFileSync('src/pages/learning/index.vue', 'utf8');
    expect(page).toContain("from './components/learning-lab.vue'");
    expect(fs.existsSync('src/pages/learning/components/learning-lab.vue')).toBe(true);
    expect(fs.existsSync('src/components/business/learning/learning-lab.vue')).toBe(false);
  });
  it('blocks a main package larger than the project 2MB budget', () => {
    const buildRoot = makeBuildRoot();
    try {
      fs.writeFileSync(path.join(buildRoot, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }));
      fs.mkdirSync(path.join(buildRoot, 'pages/index'), { recursive: true });
      fs.writeFileSync(path.join(buildRoot, 'app.js'), 'a'.repeat(2 * 1024 * 1024));
      fs.writeFileSync(path.join(buildRoot, 'pages/index/index.js'), 'b'.repeat(8));

      expect(() => assertMainPackageSourceBudget(buildRoot)).toThrow('主包源码体积');
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });
  it('includes media in the 2MB main budget and excludes subpackages', () => {
    const root = makeBuildRoot();
    try {
      fs.writeFileSync(
        path.join(root, 'app.json'),
        JSON.stringify({ pages: [], subPackages: [{ root: 'pages/learning', pages: ['index'] }] })
      );
      fs.mkdirSync(path.join(root, 'pages/learning'), { recursive: true });
      fs.writeFileSync(path.join(root, 'pages/learning/large.js'), 'x'.repeat(3 * 1024 * 1024));
      fs.writeFileSync(path.join(root, 'app.js'), 'x'.repeat(1024 * 1024));
      expect(() => assertMainPackageSourceBudget(root)).not.toThrow();
      fs.writeFileSync(path.join(root, 'image.png'), Buffer.alloc(1024 * 1024));
      expect(() => assertMainPackageSourceBudget(root)).toThrow('主包源码体积');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('counts root package source files beyond app and page entry files', () => {
    const buildRoot = makeBuildRoot();
    try {
      fs.writeFileSync(
        path.join(buildRoot, 'app.json'),
        JSON.stringify({
          pages: ['pages/index/index'],
          subPackages: [{ root: 'pages/practice-sub', pages: ['question-bank'] }]
        })
      );
      fs.mkdirSync(path.join(buildRoot, 'pages/index'), { recursive: true });
      fs.mkdirSync(path.join(buildRoot, 'utils'), { recursive: true });
      fs.mkdirSync(path.join(buildRoot, 'pages/practice-sub'), { recursive: true });
      fs.writeFileSync(path.join(buildRoot, 'app.js'), 'a'.repeat(8));
      fs.writeFileSync(path.join(buildRoot, 'pages/index/index.js'), 'b'.repeat(8));
      fs.writeFileSync(path.join(buildRoot, 'utils/large-main-module.js'), 'c'.repeat(4 * 1024 * 1024));
      fs.writeFileSync(path.join(buildRoot, 'pages/practice-sub/question-bank.js'), 'd'.repeat(4 * 1024 * 1024));

      expect(() => assertMainPackageSourceBudget(buildRoot)).toThrow('主包源码体积');
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });

  it('blocks flashcard bank data emitted into the main package', () => {
    const buildRoot = makeBuildRoot();
    try {
      fs.mkdirSync(path.join(buildRoot, 'config/flashcard-banks'), { recursive: true });
      fs.writeFileSync(path.join(buildRoot, 'config/flashcard-banks/english1-2011.js'), 'export default {}');

      expect(() => assertNoFlashcardBanksInMainPackage(buildRoot)).toThrow('flashcard-banks');
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });

  it('allows flashcard bank data inside the practice subpackage', () => {
    const buildRoot = makeBuildRoot();
    try {
      fs.mkdirSync(path.join(buildRoot, 'pages/practice-sub/flashcard-banks'), { recursive: true });
      fs.writeFileSync(
        path.join(buildRoot, 'pages/practice-sub/flashcard-banks/english1-2011.js'),
        'export default {}'
      );

      expect(() => assertNoFlashcardBanksInMainPackage(buildRoot)).not.toThrow();
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });

  it('blocks a practice subpackage loader whose generated bank files were dropped from the build output', () => {
    const buildRoot = makeBuildRoot();
    try {
      fs.mkdirSync(path.join(buildRoot, 'pages/practice-sub'), { recursive: true });
      fs.writeFileSync(
        path.join(buildRoot, 'pages/practice-sub/bank-data-loader.js'),
        'exports.loadBankData = () => require("./flashcard-banks/english1-2005.js");'
      );

      expect(() => assertPracticeSubpackageBankDataRuntime(buildRoot)).toThrow('退役题库不得进入任何分包');
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });

  it('blocks even a complete compressed bank after retirement', () => {
    const buildRoot = makeBuildRoot();
    try {
      fs.mkdirSync(path.join(buildRoot, 'pages/practice-sub'), { recursive: true });
      fs.writeFileSync(
        path.join(buildRoot, 'pages/practice-sub/bank-data-loader.js'),
        'const data = require("./bank-data-table.js"); exports.loadBankData = () => data.COMPRESSED_BANK_DATA_BY_ID["english1-2005"];'
      );
      fs.writeFileSync(
        path.join(buildRoot, 'pages/practice-sub/bank-data-table.js'),
        'exports.COMPRESSED_BANK_DATA_BY_ID = {"english1-2005":"compressed"};'
      );
      fs.writeFileSync(
        path.join(buildRoot, 'pages/practice-sub/bank-data-codec.js'),
        'exports.decodeBankData = () => ({});'
      );

      expect(() => assertPracticeSubpackageBankDataRuntime(buildRoot)).toThrow('退役题库不得进入任何分包');
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });

  it('removes the old registry and bundled-data loader from source', () => {
    expect(fs.existsSync(path.resolve('src/config/bank-registry.js'))).toBe(false);
    expect(fs.existsSync(path.resolve('src/pages/practice-sub/bank-data-table.js'))).toBe(false);
  });
});
