#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatForbiddenClientSecretFindings,
  scanForbiddenClientSecrets
} from './wechat-artifact-secret-scan.mjs';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const DEFAULT_APP_DIR = path.join(PROJECT_ROOT, 'dist/build/app');
const APP_SERVER_ONLY_TOKEN_NAMES = [
  'JWT_SECRET',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'LAF_APP_SECRET',
  'LAF_APPID',
  'LAF_APP_ID',
  'MONGODB_URI',
  'DATABASE_URL',
  'SMTP_PASS'
];

function requireFile(appDir, relativePath, blockers) {
  if (!fs.existsSync(path.join(appDir, relativePath))) {
    blockers.push({ code: 'missing_app_artifact', path: relativePath });
  }
}

function findExistingHtmlEntries(appDir) {
  return ['__uniappview.html', 'index.html'].filter((relativePath) =>
    fs.existsSync(path.join(appDir, relativePath))
  );
}

export function verifyAppArtifacts(appDir = DEFAULT_APP_DIR) {
  const blockers = [];
  requireFile(appDir, 'manifest.json', blockers);
  requireFile(appDir, 'app-config-service.js', blockers);
  requireFile(appDir, 'app-service.js', blockers);
  requireFile(appDir, '__uniappview.html', blockers);

  for (const htmlEntry of findExistingHtmlEntries(appDir)) {
    const html = fs.readFileSync(path.join(appDir, htmlEntry), 'utf8');
    if (/\s(?:src|href)="\/static\//.test(html)) {
      blockers.push({ code: 'absolute_runtime_asset_path', path: htmlEntry });
    }
  }

  if (fs.existsSync(appDir)) {
    const secretFindings = [
      ...scanForbiddenClientSecrets(appDir),
      ...scanForbiddenClientSecrets(appDir, APP_SERVER_ONLY_TOKEN_NAMES)
    ];
    if (secretFindings.length > 0) {
      blockers.push({
        code: 'server_secret_name_in_app_artifact',
        detail: formatForbiddenClientSecretFindings(secretFindings)
      });
    }
  }

  return { ok: blockers.length === 0, blockerCount: blockers.length, blockers };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = verifyAppArtifacts(DEFAULT_APP_DIR);
  if (!result.ok) {
    console.error(`[app:verify] FAIL\n${JSON.stringify(result.blockers, null, 2)}`);
    process.exit(1);
  }
  console.log('[app:verify] OK: App artifacts are valid.');
}
