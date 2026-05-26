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
  it('blocks published English papers when choice questions lack passage context', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-master-qb-bank-'));
    fs.writeFileSync(
      path.join(tmp, 'english1-2099.json'),
      JSON.stringify(
        {
          cards: [
            {
              id: 'english1-2099-021',
              type: 'single_choice',
              question: 'Question 21',
              options: ['A. One', 'B. Two', 'C. Three', 'D. Four'],
              answer: 'A',
              sourceEvidenceId: 'src_ev_english_2099_021',
              answerEvidenceStatus: 'matched',
              questionTextHash: 'sha256:q21',
              answerTextHash: 'sha256:a21'
            }
          ]
        },
        null,
        2
      )
    );

    const report = buildQuestionBankReleaseReport({
      minYear: 2099,
      maxYear: 2099,
      tracks: ['english1'],
      bankDir: tmp,
      sourceManifest: tempManifestPath(),
      banks: [
        {
          id: 'english1-2099',
          subjectKey: 'english',
          track: 'english1',
          year: '2099',
          name: '2099考研英语一真题'
        }
      ]
    });

    expect(report.releaseReadiness.canPublish).toBe(false);
    expect(report.answerEvidence.blockedBanks[0].blockedCards[0].missingFields).toContain('passage');
  });

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
      },
      {
        sourceId: 'src_eng2_2024_discovered',
        eligible: true,
        status: 'discovered',
        sourceType: 'official_paper',
        track: 'english2',
        year: 2024,
        remotePath: '/apps/考研大师/raw-pdf/english2/2024英语二真题-待核验.pdf',
        contentHash: 'sha256:discovered-source',
        answerEvidenceStatus: 'matched',
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
    expect(report.summary.sourceManifestTotalSources).toBe(3);
    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(1);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(17);
    expect(report.summary.pendingCoverageBlockerCount).toBeGreaterThan(0);
    expect(report.sourceEvidence.coverage.english1.presentYears).toEqual([2024]);
    expect(report.sourceEvidence.coverage.english2.presentYears).toEqual([]);
    expect(report.sourceEvidence.coverage.english2.missingYearDiagnostics[2024]).toMatchObject({
      candidateCount: 2,
      officialPaperCandidateCount: 2,
      blockReasons: {
        'answerEvidenceStatus=missing': 1,
        'status=discovered': 1
      }
    });
    expect(report.sourceEvidence.coverage.english2.missingYearDiagnostics[2024].sampleCandidates[0]).toMatchObject({
      sourceId: 'src_eng2_2024_without_answer_evidence',
      status: 'verified',
      sourceType: 'official_paper',
      blockReasons: ['answerEvidenceStatus=missing']
    });
    expect(report.summary.answerEvidenceBlockerCount).toBe(0);
    expect(report.summary.enabledBankCount).toBeGreaterThan(0);
    expect(report.summary.selfStudyDraftBankCount).toBeGreaterThan(0);
    expect(report.summary.pendingBankCount).toBeGreaterThan(0);
    expect(report.coverage.tracks.find((track) => track.track === 'english2').releaseState).toBe('empty');
    expect(report.answerEvidence.blockedBanks).toEqual([]);
  });

  it('does not count answer-only official sources as publishable paper coverage', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const manifest = tempManifestPath([
      {
        sourceId: 'src_english1_2099_answer_only',
        eligible: true,
        status: 'verified',
        sourceType: 'official_paper',
        sourceRole: 'answer',
        track: 'english1',
        year: 2099,
        remotePath: '/raw/english1/2099-answer.pdf',
        contentHash: 'sha256:english1-2099-answer-source',
        answerEvidenceStatus: 'matched',
        riskFlags: []
      }
    ]);

    const report = buildQuestionBankReleaseReport({
      minYear: 2099,
      maxYear: 2099,
      tracks: ['english1'],
      sourceManifest: manifest,
      banks: []
    });

    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(1);
    expect(report.sourceEvidence.coverage.english1.presentYears).toEqual([]);
    expect(report.sourceEvidence.coverage.english1.missingYearDiagnostics[2099]).toMatchObject({
      candidateCount: 1,
      officialPaperCandidateCount: 1,
      blockReasons: {
        'sourceRole=answer': 1
      }
    });
    expect(report.sourceEvidence.coverage.english1.missingYearDiagnostics[2099].sampleCandidates[0]).toMatchObject({
      sourceId: 'src_english1_2099_answer_only',
      sourceType: 'official_paper',
      sourceRole: 'answer',
      answerEvidenceStatus: 'matched',
      blockReasons: ['sourceRole=answer']
    });
  });

  it('keeps self-study draft banks as pending release blockers even when source evidence is complete', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const manifest = tempManifestPath([
      {
        sourceId: 'src_english1_2099_verified',
        eligible: true,
        status: 'verified',
        sourceType: 'official_paper',
        track: 'english1',
        year: 2099,
        remotePath: '/raw/english1/2099-official.pdf',
        contentHash: 'sha256:english1-2099-source',
        answerEvidenceStatus: 'matched',
        riskFlags: []
      }
    ]);

    const report = buildQuestionBankReleaseReport({
      minYear: 2099,
      maxYear: 2099,
      tracks: ['english1'],
      sourceManifest: manifest,
      banks: [
        {
          id: 'english1-2099',
          subjectKey: 'english',
          track: 'english1',
          year: '2099',
          name: '2099考研英语一真题',
          usageScope: 'self_study_draft'
        }
      ]
    });

    expect(report.releaseReadiness.canPublish).toBe(false);
    expect(report.summary.coverageGapCount).toBe(0);
    expect(report.summary.pendingSlots).toBe(1);
    expect(report.summary.pendingCoverageBlockerCount).toBe(1);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(0);
    expect(report.releaseReadiness.blockers).toMatchObject({
      coverage: 0,
      pendingCoverage: 1,
      sourceEvidence: 0,
      answerEvidence: 0,
      grading: 0
    });
    expect(report.coverage.tracks[0]).toMatchObject({
      publishedYears: [],
      pendingYears: [2099],
      missingYears: []
    });
  });

  it('prioritizes actionable official source samples in missing-year diagnostics', () => {
    const output = tempReportPath();
    const manifest = tempManifestPath([
      {
        sourceId: 'src_math1_2024_institution',
        eligible: false,
        status: 'discovered',
        sourceType: 'institution_candidate',
        track: 'math1',
        year: 2024,
        remotePath: '/raw/math1/2024-practice-book.pdf',
        riskFlags: ['copyright_review_required'],
        legalReview: { publishBlocked: true }
      },
      {
        sourceId: 'src_math1_2024_official_discovered',
        eligible: true,
        status: 'discovered',
        sourceType: 'official_paper',
        track: 'math1',
        year: 2024,
        remotePath: '/raw/math1/2024-official-discovered.pdf',
        contentHash: 'sha256:discovered',
        riskFlags: []
      },
      {
        sourceId: 'src_math1_2024_answer_only_verified',
        eligible: true,
        status: 'verified',
        sourceType: 'official_paper',
        sourceRole: 'answer',
        track: 'math1',
        year: 2024,
        remotePath: '/raw/math1/2024-answer-only.pdf',
        contentHash: 'sha256:answer-only',
        answerEvidenceStatus: 'matched',
        riskFlags: []
      },
      {
        sourceId: 'src_math1_2024_official_verified_missing_answer',
        eligible: true,
        status: 'verified',
        sourceType: 'official_paper',
        track: 'math1',
        year: 2024,
        remotePath: '/raw/math1/2024-official-verified.pdf',
        contentHash: 'sha256:verified',
        riskFlags: []
      }
    ]);
    const result = runGate(['--min-year=2024', '--max-year=2024', '--output', output, '--source-manifest', manifest]);

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    const samples = report.sourceEvidence.coverage.math1.missingYearDiagnostics[2024].sampleCandidates;

    expect(samples.map((sample) => sample.sourceId)).toEqual([
      'src_math1_2024_official_verified_missing_answer',
      'src_math1_2024_official_discovered',
      'src_math1_2024_answer_only_verified'
    ]);
    expect(samples[0]).toMatchObject({
      sourceType: 'official_paper',
      sourceRole: '',
      status: 'verified',
      publishBlocked: false,
      blockReasons: ['answerEvidenceStatus=missing']
    });
    expect(samples[2]).toMatchObject({
      sourceType: 'official_paper',
      sourceRole: 'answer',
      blockReasons: ['sourceRole=answer']
    });
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
