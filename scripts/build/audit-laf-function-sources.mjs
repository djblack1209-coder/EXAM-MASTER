#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const functionsDir = join(repoRoot, 'laf-backend', 'functions');

if (!existsSync(functionsDir)) {
  console.error(`Functions directory not found: ${functionsDir}`);
  process.exit(1);
}

function listTsRelativePaths(rootDir) {
  const results = [];

  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        results.push(relative(rootDir, nextPath).replace(/\\/g, '/'));
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

const files = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

const tsStems = new Set(files.filter((name) => name.endsWith('.ts')).map((name) => name.slice(0, -3)));
const jsStems = new Set(files.filter((name) => name.endsWith('.js')).map((name) => name.slice(0, -3)));
const jsEntries = files.filter((name) => name.endsWith('.js')).sort();

const pairedStems = Array.from(tsStems)
  .filter((stem) => jsStems.has(stem))
  .sort();

const contentDiffPairs = [];
for (const stem of pairedStems) {
  const tsContent = readFileSync(join(functionsDir, `${stem}.ts`), 'utf8');
  const jsContent = readFileSync(join(functionsDir, `${stem}.js`), 'utf8');
  if (tsContent !== jsContent) {
    contentDiffPairs.push(stem);
  }
}

let trackedFiles = new Set();
try {
  const output = execSync('git ls-files', {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  trackedFiles = new Set(output.split('\n').filter(Boolean));
} catch {
  // ignore git lookup failure
}

const untrackedTsFiles = Array.from(tsStems)
  .map((stem) => `laf-backend/functions/${stem}.ts`)
  .filter((path) => !trackedFiles.has(path))
  .sort();

const strictMode = process.argv.includes('--strict');
const pullFunctionsDir = process.env.LAF_PULL_DIR || join('/tmp', 'laf-pull-check', 'functions');

const localTsAll = listTsRelativePaths(functionsDir);

let remoteCompare = null;
if (existsSync(pullFunctionsDir)) {
  const remoteTsAll = listTsRelativePaths(pullFunctionsDir);
  const localSet = new Set(localTsAll);
  const remoteSet = new Set(remoteTsAll);

  const missingInLocal = remoteTsAll.filter((path) => !localSet.has(path));
  const missingInPull = localTsAll.filter((path) => !remoteSet.has(path));

  const common = localTsAll.filter((path) => remoteSet.has(path));
  const contentDiff = [];
  for (const relPath of common) {
    const localContent = readFileSync(join(functionsDir, relPath), 'utf8');
    const remoteContent = readFileSync(join(pullFunctionsDir, relPath), 'utf8');
    if (localContent !== remoteContent) {
      contentDiff.push(relPath);
    }
  }

  remoteCompare = {
    pullFunctionsDir,
    remoteTsCount: remoteTsAll.length,
    localTsCount: localTsAll.length,
    missingInLocal,
    missingInPull,
    contentDiff
  };
}

console.log('Laf function source audit');
console.log(`- Root TS entry files: ${tsStems.size}`);
console.log(`- Root JS entry files: ${jsStems.size}`);
console.log(`- Recursive TS files: ${localTsAll.length}`);
console.log(`- TS/JS pairs: ${pairedStems.length}`);
console.log(`- Pair content diffs: ${contentDiffPairs.length}`);
console.log(`- Untracked TS files: ${untrackedTsFiles.length}`);

if (jsEntries.length > 0) {
  console.log('\nLegacy JS entry files (TS-only target):');
  for (const fileName of jsEntries) {
    console.log(`- ${fileName}`);
  }
}

if (contentDiffPairs.length > 0) {
  console.log('\nPairs with TS/JS content drift:');
  for (const stem of contentDiffPairs) {
    console.log(`- ${stem}`);
  }
}

if (untrackedTsFiles.length > 0) {
  console.log('\nUntracked TS function files:');
  for (const path of untrackedTsFiles) {
    console.log(`- ${path}`);
  }
}

if (remoteCompare) {
  console.log('\nLocal vs pulled TS compare:');
  console.log(`- Pull dir: ${remoteCompare.pullFunctionsDir}`);
  console.log(`- Local TS count: ${remoteCompare.localTsCount}`);
  console.log(`- Pulled TS count: ${remoteCompare.remoteTsCount}`);
  console.log(`- Missing in local: ${remoteCompare.missingInLocal.length}`);
  console.log(`- Missing in pull: ${remoteCompare.missingInPull.length}`);
  console.log(`- Content diffs: ${remoteCompare.contentDiff.length}`);

  if (remoteCompare.missingInLocal.length > 0) {
    console.log('\nTS files missing in local:');
    for (const path of remoteCompare.missingInLocal) {
      console.log(`- ${path}`);
    }
  }

  if (remoteCompare.missingInPull.length > 0) {
    console.log('\nTS files missing in pulled source:');
    for (const path of remoteCompare.missingInPull) {
      console.log(`- ${path}`);
    }
  }

  if (remoteCompare.contentDiff.length > 0) {
    console.log('\nTS files with local/pull content diff:');
    for (const path of remoteCompare.contentDiff) {
      console.log(`- ${path}`);
    }
  }
}

const remoteCompareFailed =
  !!remoteCompare &&
  (remoteCompare.missingInLocal.length > 0 ||
    remoteCompare.missingInPull.length > 0 ||
    remoteCompare.contentDiff.length > 0);

if (strictMode && (contentDiffPairs.length > 0 || untrackedTsFiles.length > 0 || remoteCompareFailed)) {
  console.error('\nStrict mode failed: source drift or untracked TS files detected.');
  process.exit(1);
}

if (strictMode && jsEntries.length > 0) {
  console.error('\nStrict mode failed: legacy JS function entries detected; migrate to TS-only.');
  process.exit(1);
}
