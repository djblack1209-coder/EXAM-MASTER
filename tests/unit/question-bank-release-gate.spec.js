import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'scripts/build/question-bank-release-gate.mjs');

function runGate(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

function tempReportPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-master-qb-gate-'));
  return path.join(dir, 'report.json');
}

function tempManifestPath(items = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-master-qb-manifest-'));
  const manifest = path.join(dir, 'source-manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ version: 1, updatedAt: '2026-04-29T00:00:00Z', items }, null, 2));
  return manifest;
}

describe('question bank release gate', () => {
  it('requires verified source provenance and matched answer evidence before source coverage counts', () => {
    const output = tempReportPath();
    const manifest = tempManifestPath([
      {
        sourceId: 'src_eng1_2024',
        eligible: true,
        status: 'verified',
        sourceType: 'official_paper',
        track: 'english1',
        year: 2024,
        remotePath: '/apps/考研大师/raw-pdf/english1/2024英语一真题.pdf',
        contentHash: 'sha256:verified-source-hash',
        answerEvidenceStatus: 'matched',
        riskFlags: []
      },
      {
        sourceId: 'src_eng2_2024_without_answer_evidence',
        eligible: true,
        status: 'verified',
        sourceType: 'official_paper',
        track: 'english2',
        year: 2024,
        remotePath: '/apps/考研大师/raw-pdf/english2/2024英语二真题.pdf',
        contentHash: 'sha256:missing-answer-evidence',
        riskFlags: []
      }
    ]);
    const result = runGate(['--min-year=2024', '--max-year=2026', '--output', output, '--source-manifest', manifest]);

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(fs.existsSync(output)).toBe(true);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.releaseReadiness.canPublish).toBe(false);
    expect(report.summary.requiredSlots).toBe(18);
    expect(report.summary.coverageGapCount).toBeGreaterThan(0);
    expect(report.summary.sourceManifestStatus).toBe('present');
    expect(report.summary.sourceManifestTotalSources).toBe(2);
    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(1);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(17);
    expect(report.sourceEvidence.coverage.english1.presentYears).toEqual([2024]);
    expect(report.sourceEvidence.coverage.english2.presentYears).toEqual([]);
    expect(report.summary.answerEvidenceBlockerCount).toBe(0);
    expect(report.summary.enabledBankCount).toBe(0);
    expect(report.summary.pendingBankCount).toBeGreaterThan(0);
    expect(report.coverage.tracks.find((track) => track.track === 'english2').releaseState).toBe('empty');
    expect(report.answerEvidence.blockedBanks).toEqual([]);
  });

  it('fails release mode while public-course coverage is incomplete', () => {
    const output = tempReportPath();
    const manifest = tempManifestPath();
    const result = runGate([
      '--min-year=2024',
      '--max-year=2026',
      '--output',
      output,
      '--source-manifest',
      manifest,
      '--fail-on-blockers'
    ]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('canPublish=false');

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.releaseReadiness.blockers.coverage).toBeGreaterThan(0);
    expect(report.releaseReadiness.blockers.sourceEvidence).toBeGreaterThan(0);
    expect(report.releaseReadiness.blockers.answerEvidence).toBe(0);
  });
});
