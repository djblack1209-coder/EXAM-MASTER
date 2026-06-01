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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'exam-master-mp-main-'));
}

describe('mp-weixin main package usage audit', () => {
  it('blocks a main package larger than the WeChat 4MB upload limit', () => {
    const buildRoot = makeBuildRoot();
    try {
      fs.writeFileSync(path.join(buildRoot, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }));
      fs.mkdirSync(path.join(buildRoot, 'pages/index'), { recursive: true });
      fs.writeFileSync(path.join(buildRoot, 'app.js'), 'a'.repeat(4 * 1024 * 1024));
      fs.writeFileSync(path.join(buildRoot, 'pages/index/index.js'), 'b'.repeat(8));

      expect(() => assertMainPackageSourceBudget(buildRoot)).toThrow('主包源码体积');
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
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
      fs.writeFileSync(path.join(buildRoot, 'pages/practice-sub/flashcard-banks/english1-2011.js'), 'export default {}');

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

      expect(() => assertPracticeSubpackageBankDataRuntime(buildRoot)).toThrow('题库运行模块缺失');
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });

  it('allows a practice subpackage loader backed by a generated compressed bank table', () => {
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

      expect(() => assertPracticeSubpackageBankDataRuntime(buildRoot)).not.toThrow();
    } finally {
      fs.rmSync(buildRoot, { recursive: true, force: true });
    }
  });

  it('keeps main-package source modules free of flashcard bank data imports', () => {
    const registrySource = fs.readFileSync(path.resolve('src/config/bank-registry.js'), 'utf8');
    const flashcardComposableSource = fs.readFileSync(path.resolve('src/composables/useFlashcardBank.js'), 'utf8');

    expect(registrySource).not.toContain('flashcard-banks');
    expect(registrySource).not.toMatch(/\bloadBank\b/);
    expect(registrySource).not.toMatch(/\bloader\s*:/);
    expect(flashcardComposableSource).not.toMatch(/loadBank|bank-data-loader/);
  });
});
