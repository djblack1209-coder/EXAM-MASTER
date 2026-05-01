import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const DEFAULT_FORBIDDEN_CLIENT_TOKENS = [
  'VITE_INVITE_SECRET',
  'WX_APP_SECRET',
  'WX_GZH_SECRET',
  'QQ_SECRET',
  'ZHIPU_API_KEY',
  'BAIDU_SECRET_KEY',
  'BAIDU_ACCESS_TOKEN',
  'BAIDU_REFRESH_TOKEN',
  'BAIDU_SIGN_KEY',
  'SMTP_PASS'
];

const SCANNED_EXTENSIONS = new Set([
  '.js',
  '.json',
  '.wxml',
  '.wxss',
  '.wxs',
  '.map',
  '.txt',
  '.html',
  '.css'
]);

function hasScannedExtension(filePath) {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex === -1) return false;
  return SCANNED_EXTENSIONS.has(filePath.slice(dotIndex));
}

function walkFiles(root, files = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (entry.isFile() && hasScannedExtension(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function scanForbiddenClientSecrets(root, forbiddenTokens = DEFAULT_FORBIDDEN_CLIENT_TOKENS) {
  const outputRoot = resolve(root);
  if (!existsSync(outputRoot) || !statSync(outputRoot).isDirectory()) {
    return [];
  }

  const findings = [];
  for (const filePath of walkFiles(outputRoot)) {
    const content = readFileSync(filePath, 'utf8');
    for (const token of forbiddenTokens) {
      if (content.includes(token)) {
        findings.push({
          file: relative(outputRoot, filePath),
          token
        });
      }
    }
  }
  return findings;
}

export function formatForbiddenClientSecretFindings(findings) {
  return findings.map((item) => `${item.file}: ${item.token}`).join('\n');
}
