import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const SCAN_TARGETS = [
  'src/pages',
  'src/components',
  'src/config/home-data.js',
  'src/config/bank-registry.js'
];

const FORBIDDEN_PUBLIC_COPY = [
  '清洗',
  '发布链路',
  'SourceEvidence',
  'OCR',
  '题源',
  '复核',
  '重新发布',
  '知识图谱',
  '神经图谱',
  '神经知识'
];

const ALLOWED_TECHNICAL_PATTERNS = [
  /location\.hash/g,
  /options\.hash/g,
  /hashMode/g,
  /hashPath/g,
  /hashQuery/g,
  /hashParams/g,
  /generateHash/g,
  /matchedHash/g,
  /seenHashes/g,
  /QuestionHash/g,
  /\bhash\b/g,
  /hashed/g
];

function collectFiles(target) {
  const absolute = resolve(ROOT, target);
  const stat = statSync(absolute);
  if (stat.isFile()) return [absolute];

  return readdirSync(absolute).flatMap((entry) => {
    const child = join(absolute, entry);
    const childStat = statSync(child);
    if (childStat.isDirectory()) return collectFiles(relative(ROOT, child));
    if (/\.(vue|js|json)$/.test(entry)) return [child];
    return [];
  });
}

function stripAllowedTechnicalTerms(source) {
  return ALLOWED_TECHNICAL_PATTERNS.reduce((text, pattern) => text.replace(pattern, ''), source);
}

describe('frontend public copy guard', () => {
  it('does not expose backend workflow terms in user-facing frontend files', () => {
    const offenders = [];
    for (const file of SCAN_TARGETS.flatMap(collectFiles)) {
      const source = stripAllowedTechnicalTerms(readFileSync(file, 'utf8'));
      for (const term of FORBIDDEN_PUBLIC_COPY) {
        if (source.includes(term)) {
          offenders.push(`${relative(ROOT, file)} -> ${term}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
