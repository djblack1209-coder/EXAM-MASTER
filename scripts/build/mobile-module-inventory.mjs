#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const DEFAULT_PAGES_JSON = path.join(PROJECT_ROOT, 'src/pages.json');
const DEFAULT_PAGES_DIR = path.join(PROJECT_ROOT, 'src/pages');
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'data/mobile-module-inventory.json');

const HISTORICAL_MODULES = {
  resource: ['pages/resource/'],
  plan: ['pages/plan/'],
  favorite: ['pages/favorite/'],
  studyDetail: ['pages/study-detail/'],
  practiceExtended: [
    'pages/practice-sub/file-manager',
    'pages/practice-sub/smart-review',
    'pages/practice-sub/error-clusters',
    'pages/practice-sub/mock-exam',
    'pages/practice-sub/sprint-mode'
  ]
};

function toPosix(value) {
  return String(value || '')
    .split(path.sep)
    .join('/');
}

export function normalizePagePath(input) {
  return toPosix(input)
    .replace(/^.*?src\/pages\//, 'pages/')
    .replace(/\.vue$/, '')
    .replace(/^\/+/, '');
}

function walkVueFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkVueFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      result.push(fullPath);
    }
  }
  return result;
}

function pushUnique(list, value) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function declaredRoutesFromPagesConfig(pagesConfig) {
  const routes = [];
  for (const page of pagesConfig.pages || []) {
    pushUnique(routes, normalizePagePath(page.path));
  }
  for (const pkg of pagesConfig.subPackages || []) {
    for (const page of pkg.pages || []) {
      pushUnique(routes, normalizePagePath(`${pkg.root}/${page.path}`));
    }
  }
  return routes;
}

function isPageRouteFile(pagePath) {
  const segments = pagePath.split('/');
  const basename = segments.at(-1) || '';
  return !segments.includes('components') && !/^[A-Z]/.test(basename);
}

function classifyHistoricalModules(hiddenPageFiles) {
  return Object.fromEntries(
    Object.entries(HISTORICAL_MODULES).map(([moduleName, prefixes]) => [
      moduleName,
      {
        pages: hiddenPageFiles.filter((pagePath) => prefixes.some((prefix) => pagePath.startsWith(prefix))).sort()
      }
    ])
  );
}

export function buildMobileModuleInventory({ pagesConfig, pageFiles }) {
  const exposedRoutes = declaredRoutesFromPagesConfig(pagesConfig);
  const exposedSet = new Set(exposedRoutes);
  const allPageFiles = Array.from(new Set(pageFiles.map(normalizePagePath).filter(isPageRouteFile))).sort();
  const hiddenPageFiles = allPageFiles.filter((pagePath) => !exposedSet.has(pagePath));
  const historicalModules = classifyHistoricalModules(hiddenPageFiles);
  const historicalSet = new Set(Object.values(historicalModules).flatMap((module) => module.pages));

  return {
    exposedRoutes,
    hiddenPageFiles,
    historicalModules,
    orphanedCommonPages: hiddenPageFiles.filter(
      (pagePath) => pagePath.startsWith('pages/common/') && !historicalSet.has(pagePath)
    )
  };
}

export function loadInventoryFromDisk({ pagesJsonPath = DEFAULT_PAGES_JSON, pagesDir = DEFAULT_PAGES_DIR } = {}) {
  const pagesConfig = JSON.parse(fs.readFileSync(pagesJsonPath, 'utf8'));
  const pageFiles = walkVueFiles(pagesDir);
  return buildMobileModuleInventory({ pagesConfig, pageFiles });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : DEFAULT_OUTPUT;
  const inventory = loadInventoryFromDisk();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(`[mobile-module-inventory] wrote ${path.relative(PROJECT_ROOT, output)}`);
}
