import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../src');
const exts = new Set(['.vue', '.scss', '.css']);

const nestedPattern = /&\s*>\s*\*\s*\+\s*\*\s*\{([\s\S]*?)\}/g;
const nestedReplacement = (body) => `& > view + view,\n& > text + text,\n& > view + text,\n& > text + view {${body}}`;

const directPattern = /([^\n{]+)\s*>\s*\*\s*\+\s*\*\s*\{([\s\S]*?)\}/g;
const directReplacement = (selector, body) => {
  const base = selector.trim();
  return `${base} > view + view,\n${base} > text + text,\n${base} > view + text,\n${base} > text + view {${body}}`;
};

const results = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!exts.has(extname(fullPath))) {
      continue;
    }
    const content = readFileSync(fullPath, 'utf8');
    let changed = false;
    let updated = content.replace(nestedPattern, (match, body) => {
      changed = true;
      return nestedReplacement(body);
    });

    updated = updated.replace(directPattern, (match, selector, body) => {
      changed = true;
      return directReplacement(selector, body);
    });
    if (changed) {
      writeFileSync(fullPath, updated, 'utf8');
      results.push(fullPath);
    }
  }
};

walk(root);

console.log(`Updated ${results.length} file(s).`);
results.forEach((file) => console.log(`- ${file}`));
