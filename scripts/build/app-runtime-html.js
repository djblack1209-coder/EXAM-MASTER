import fs from 'node:fs';
import path from 'node:path';

const ABSOLUTE_STATIC_REF = /(["'])\/static\//g;
const CROSSORIGIN_ATTR = /\s+crossorigin(?=[\s>])/g;
const MODULE_SCRIPT_TAG = /<script\s+type="module"/g;
const STYLESHEET_HREF = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;

export function listAppRuntimeCssRefs(outDir) {
  const cssDir = path.resolve(outDir, 'static/css');

  if (!fs.existsSync(cssDir)) {
    return [];
  }

  return fs
    .readdirSync(cssDir)
    .filter((fileName) => fileName.endsWith('.css'))
    .sort()
    .map((fileName) => `./static/css/${fileName}`);
}

export function normalizeAppRuntimeHtml(html, cssRefs = []) {
  let normalized = html
    .replace(ABSOLUTE_STATIC_REF, '$1./static/')
    .replace(CROSSORIGIN_ATTR, '')
    .replace(MODULE_SCRIPT_TAG, '<script');

  const existingCssRefs = new Set(Array.from(normalized.matchAll(STYLESHEET_HREF), (match) => match[1]));
  const missingCssRefs = cssRefs.filter((ref) => !existingCssRefs.has(ref));

  if (missingCssRefs.length > 0) {
    const links = missingCssRefs.map((ref) => `    <link rel="stylesheet" href="${ref}" />`).join('\n');

    if (/<\/head>/i.test(normalized)) {
      normalized = normalized.replace(/<\/head>/i, `${links}\n  </head>`);
    } else {
      normalized = `${normalized}\n${links}`;
    }
  }

  return normalized;
}

export function normalizeAppRuntimeIndexFile(indexPath) {
  if (!fs.existsSync(indexPath)) {
    return false;
  }

  const html = fs.readFileSync(indexPath, 'utf8');
  const normalized = normalizeAppRuntimeHtml(html, listAppRuntimeCssRefs(path.dirname(indexPath)));

  if (normalized === html) {
    return false;
  }

  fs.writeFileSync(indexPath, normalized);
  return true;
}
