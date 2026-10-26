// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROOT,
  MANIFEST_PATH,
  FIXTURES,
  canonical,
  sha256,
  validateEngineeringManifest
} from '../../scripts/eval/engineering-v1-manifest.mjs';

const load = () => JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_PATH), 'utf8'));

describe('frozen engineering v1 manifest (no real-effect claim)', () => {
  it('pins all 11 JSON files, 308 rows and 52/18 graph questions with current source/test versions', () => {
    const m = load();
    expect(validateEngineeringManifest(m).real_effect).toBe('unavailable');
    expect(m.counts).toEqual({ jsonFiles: 11, jsonCases: 308, englishGraphQuestions: 52, mathGraphQuestions: 18 });
    expect(m.sources.map((s) => s.count)).toEqual(FIXTURES.map(([, count]) => count));
    expect(m.cases).toHaveLength(308);
    expect(m.graphQuestions.filter((c) => c.group.startsWith('graph-english/'))).toHaveLength(52);
    expect(m.graphQuestions.filter((c) => c.group.startsWith('graph-math/'))).toHaveLength(18);
    expect(m.cases.filter((c) => c.legacyRunnerId)).toHaveLength(301);
    expect(m.cases.find((c) => c.caseId === 'stage-toefl-summary').expected.savedAnswer).toBeTruthy();
    expect(m.cases.find((c) => c.id === 'condition-v1/cases/sufficient').expected.counterexamples).toEqual([null, '1']);
    expect(m.realEffectSamples).toEqual({ independentlyScoredEssays: 0, expertRootCauseTrajectories: 0 });
    expect(m.sourceVersions.some((s) => s.path === 'scripts/build/evaluate-learning.mjs')).toBe(true);
    expect(m.sourceVersions.some((s) => s.path === 'tests/unit/knowledge-graph.spec.js')).toBe(true);
    for (const item of [...m.cases, ...m.graphQuestions]) {
      expect(item.real_effect).toBe('unavailable');
      expect(item.provenance).toBeTruthy();
      expect(item.version).toBeTruthy();
      expect(item.expected).toBeTruthy();
      expect(item.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(item.leakageGroup).toBeTruthy();
    }
    const english = m.graphQuestions.filter((q) => q.group.startsWith('graph-english/'));
    expect(english.filter((q) => q.expected.kind === 'rubric')).toHaveLength(44);
    expect(english.filter((q) => q.expected.kind === 'choice')).toHaveLength(8);
  });

  it.each([
    [
      'missing case',
      (m) => {
        m.cases.pop();
      }
    ],
    [
      'duplicate id',
      (m) => {
        m.cases[1].id = m.cases[0].id;
      }
    ],
    [
      'case hash',
      (m) => {
        m.cases[0].sha256 = '0'.repeat(64);
      }
    ],
    [
      'file hash',
      (m) => {
        m.sources[0].sha256 = '0'.repeat(64);
      }
    ],
    [
      'source file missing',
      (m) => {
        m.sources[0].path = 'missing.json';
      }
    ],
    [
      'source version',
      (m) => {
        m.sourceVersions.pop();
      }
    ],
    [
      'expectation',
      (m) => {
        m.cases[0].expected.outcome = 'wrong';
      }
    ],
    [
      'group',
      (m) => {
        m.cases[0].group = 'real';
      }
    ],
    [
      'provenance',
      (m) => {
        m.cases[0].provenance = 'official';
      }
    ],
    [
      'graph answer',
      (m) => {
        m.graphQuestions.find((q) => q.expected.kind === 'choice').expected.answerIndex = 100;
      }
    ],
    [
      'real effect claim',
      (m) => {
        m.real_effect = 'passed';
      }
    ]
  ])('fails closed on %s drift without rewriting fixtures or manifest', (_, mutate) => {
    const m = load();
    mutate(m);
    expect(() => validateEngineeringManifest(m)).toThrow(/ENGINEERING_MANIFEST_INVALID/);
  });

  it('uses deterministic key ordering while retaining meaningful array order and null', () => {
    expect(sha256(canonical({ a: 1, b: null }))).toBe(sha256(canonical({ b: null, a: 1 })));
    expect(sha256(canonical([0, 1]))).not.toBe(sha256(canonical([1, 0])));
    expect(sha256(canonical(null))).not.toBe(sha256(canonical(0)));
  });
});
