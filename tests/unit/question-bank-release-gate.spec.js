import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'scripts/build/question-bank-release-gate.mjs');
const ownedTempDirs = [];

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  ownedTempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of ownedTempDirs.splice(0)) fs.rmSync(dir, { recursive: true });
});

const textDigest = (text) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

function runGate(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

function tempReportPath() {
  const dir = tempDir('exam-master-qb-gate-');
  return path.join(dir, 'report.json');
}

function tempManifestPath(items = []) {
  const dir = tempDir('exam-master-qb-manifest-');
  const manifest = path.join(dir, 'source-manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ version: 1, updatedAt: '2026-04-29T00:00:00Z', items }, null, 2));
  return manifest;
}

async function reportForCard(card, bankId = 'math1-2099', sources = []) {
  const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
  const bankDir = tempDir('exam-master-qb-digest-');
  fs.writeFileSync(path.join(bankDir, `${bankId}.json`), JSON.stringify({ cards: [card] }));
  return buildQuestionBankReleaseReport({
    minYear: 2099,
    maxYear: 2099,
    tracks: ['math1'],
    sourceManifest: tempManifestPath(sources),
    bankDir,
    banks: [
      {
        id: bankId,
        enabled: true,
        quality: 'ready',
        subjectKey: bankId.startsWith('english') ? 'english' : 'math',
        track: bankId.split('-')[0],
        year: bankId.split('-')[1],
        name: 'Synthetic'
      }
    ]
  });
}

function digestCard() {
  return {
    id: 'math1-2099-1',
    type: 'short_answer',
    question: 'Find 2 + 3.',
    answer: '5',
    sourceEvidenceId: 'synthetic-source',
    answerEvidenceStatus: 'matched',
    questionTextHash: textDigest('Find 2 + 3.'),
    answerTextHash: textDigest('5')
  };
}

function publicUseSource(overrides = {}) {
  const source = {
    sourceId: 'synthetic-public-use',
    eligible: true,
    status: 'verified',
    sourceType: 'official_paper',
    sourceRole: 'paper_answer',
    track: 'math1',
    year: 2099,
    sourceUrl: 'https://example.invalid/original.pdf',
    contentHash: textDigest('synthetic source bytes'),
    riskFlags: [],
    ...overrides
  };
  source.publicUseEvidence = {
    contract: 'public-course-public-use-v1',
    basis: 'permission',
    scope: 'public_course_redistribution',
    sourceHash: source.contentHash,
    sourceUrl: source.sourceUrl,
    evidenceUrl: 'https://example.invalid/permission',
    verifiedAt: '2020-01-01T00:00:00Z',
    verifiedBy: 'synthetic-verifier',
    note: 'Synthetic permission covers this exact file.'
  };
  return source;
}

describe('question bank release gate', () => {
  it('keeps the last release slot blocked when only automatic pairing and a licence label exist', async () => {
    const source = publicUseSource({ status: 'published', licenseStatus: 'public_use_verified' });
    delete source.publicUseEvidence;
    const report = await reportForCard(digestCard(), 'math1-2099', [source]);
    expect(report.summary.coverageGapCount).toBe(0);
    expect(report.summary.answerEvidenceBlockerCount).toBe(0);
    expect(report.summary.gradingBlockerCount).toBe(0);
    expect(report.summary.sourceManifestAutoPairedOfficialSourceSlots).toBe(1);
    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
    expect(report.releaseReadiness.blockers.sourcePublicUse).toBe(1);
    expect(report.releaseReadiness.canPublish).toBe(false);
  });

  it('accepts a complete declared public-use proof and rejects substitution or private-only scope', async () => {
    const source = publicUseSource();
    const accepted = await reportForCard(digestCard(), 'math1-2099', [source]);
    expect(accepted.summary.sourceManifestPublishableOfficialPapers).toBe(1);
    expect(accepted.releaseReadiness.canPublish, JSON.stringify(accepted.releaseReadiness)).toBe(true);
    for (const change of [
      { sourceHash: textDigest('another file') },
      { sourceUrl: 'https://example.invalid/another.pdf' },
      { scope: 'personal_use' },
      { evidenceUrl: 'javascript:alert(1)' },
      { evidenceUrl: ['https://example.invalid/permission'] },
      { verifiedBy: '' },
      { note: '' },
      { verifiedAt: 'not-a-date' },
      { contract: 'unknown' },
      { basis: 'downloadable' }
    ]) {
      const item = { ...source, publicUseEvidence: { ...source.publicUseEvidence, ...change } };
      const report = await reportForCard(digestCard(), 'math1-2099', [item]);
      expect(report.releaseReadiness.canPublish, JSON.stringify(change)).toBe(false);
      expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
    }
    const discovered = await reportForCard(digestCard(), 'math1-2099', [{ ...source, status: 'discovered' }]);
    expect(discovered.releaseReadiness.canPublish).toBe(false);
  });

  it('requires separate public-use proof for both files in a question/answer pair', async () => {
    const paper = publicUseSource({ sourceRole: 'paper' });
    const answer = publicUseSource({
      sourceId: 'synthetic-answer',
      sourceRole: 'answer',
      contentHash: textDigest('answer bytes')
    });
    const report = await reportForCard(digestCard(), 'math1-2099', [paper, answer]);
    expect(report.releaseReadiness.canPublish, JSON.stringify(report.releaseReadiness)).toBe(true);
    const mismatched = { ...answer, publicUseEvidence: paper.publicUseEvidence };
    expect((await reportForCard(digestCard(), 'math1-2099', [paper, mismatched])).releaseReadiness.canPublish).toBe(
      false
    );
    const branded = { ...paper, riskFlags: ['brand_leak'], sourceRole: 'paper_answer' };
    expect((await reportForCard(digestCard(), 'math1-2099', [branded])).releaseReadiness.canPublish).toBe(false);
  });
  it('keeps both supplemented references blocked even after rewriting their candidate evidence', async () => {
    const payload = JSON.parse(fs.readFileSync(path.resolve('data/flashcards/politics-2023.json'), 'utf8'));
    for (const number of [10, 11]) {
      const card = structuredClone(payload.cards[number - 1]);
      card.answerEvidenceStatus = 'matched';
      card.answerEvidence.status = 'matched';
      card.answerEvidence.referenceProof = undefined;
      expect((await reportForCard(card, 'politics-2023')).summary.answerEvidenceBlockerCount).toBe(1);
    }
  });
  it('keeps publisher-only politics references blocked after candidate flags and proof are stripped', async () => {
    const card = {
      ...digestCard(),
      id: 'politics-2023-003',
      number: 3,
      type: 'single_choice',
      options: ['A', 'B', 'C', 'D'],
      answer: 'C',
      answerTextHash: textDigest('C')
    };
    const report = await reportForCard(card, 'politics-2023');
    expect(report.summary.answerEvidenceBlockerCount).toBe(1);
  });
  it('rejects a missing cloze blank even when the complete payload proof is recalculated', async () => {
    for (const bankId of ['english1-2006', 'english1-2007', 'english1-2010']) {
      const card = JSON.parse(fs.readFileSync(path.resolve('src/config/flashcard-banks', `${bankId}.json`), 'utf8'))
        .cards[0];
      const damaged = structuredClone(card);
      for (const key of ['passage', 'context', 'material']) damaged[key] = damaged[key].replace('[1]', '');
      damaged.passageSegments = damaged.passageSegments.map((segment) => segment.replace('[1]', ''));
      const result = spawnSync(
        path.resolve('.venv-baidu/bin/python'),
        [
          '-c',
          'import sys,json,hashlib; c=json.load(sys.stdin); p=c["sourceEvidence"]["questionProof"]; fields=["id","number","question","passage","context","material","options","passageSegments","answer"]; body={k:c.get(k) for k in fields}|{k:v for k,v in p.items() if k!="contentHash"}; value=" ".join(json.dumps(body,ensure_ascii=False,sort_keys=True).split()); print("sha256:"+hashlib.sha256(value.encode()).hexdigest())'
        ],
        { input: JSON.stringify(damaged), encoding: 'utf8', timeout: 10000 }
      );
      expect(result.status).toBe(0);
      damaged.sourceEvidence.questionProof.contentHash = result.stdout.trim();
      expect((await reportForCard(damaged, bankId)).summary.answerEvidenceBlockerCount).toBe(1);
    }
  });
  it('binds restored translation underlines and fixed ordering positions; missing proof and number drift stay blocked', async () => {
    for (const [bankId, number] of [
      ['english1-2007', 46],
      ['english1-2010', 41],
      ['english1-2010', 48]
    ]) {
      const card = JSON.parse(
        fs.readFileSync(path.resolve('src/config/flashcard-banks', `${bankId}.json`), 'utf8')
      ).cards.find((value) => value.number === number);
      expect((await reportForCard(card, bankId)).summary.answerEvidenceBlockerCount).toBe(0);
      for (const change of [
        { targetSegment: 'changed' },
        { fixedSequence: ['41', 'E', '42'] },
        { passage: `${card.passage} changed` },
        { sourceEvidence: { ...card.sourceEvidence, questionProof: undefined } },
        { number: 99 }
      ])
        expect((await reportForCard({ ...card, ...change }, bankId)).summary.answerEvidenceBlockerCount).toBe(1);
    }
  });
  it('binds restored cloze content, answer, segments and actual PDF identity; stripping proof stays blocked', async () => {
    for (const bankId of ['english1-2006', 'english1-2007', 'english1-2010']) {
      const card = JSON.parse(fs.readFileSync(path.resolve('src/config/flashcard-banks', `${bankId}.json`), 'utf8'))
        .cards[0];
      expect((await reportForCard(card, bankId)).summary.answerEvidenceBlockerCount).toBe(0);
      const changes = [
        { passage: `${card.passage} changed` },
        { context: `${card.context} changed` },
        { answer: card.answer === 'A' ? 'B' : 'A' },
        { passageSegments: ['changed'] },
        { sourceEvidence: { ...card.sourceEvidence, questionProof: undefined } },
        {
          sourceEvidence: {
            ...card.sourceEvidence,
            questionProof: { ...card.sourceEvidence.questionProof, sourceFileSha256: textDigest('different') }
          }
        },
        {
          sourceEvidence: {
            ...card.sourceEvidence,
            questionProof: { ...card.sourceEvidence.questionProof, sourceFilePath: 'data/raw-inbox/../private.pdf' }
          }
        }
      ];
      for (const change of changes)
        expect((await reportForCard({ ...card, ...change }, bankId)).summary.answerEvidenceBlockerCount).toBe(1);
      expect(card.questionEvidenceHistory.length).toBeGreaterThan(0);
    }
  });
  it('binds composite options, passages, material and answer role rather than just the display prompt', async () => {
    const bankId = 'english2-2014';
    const card = JSON.parse(fs.readFileSync(path.resolve('src/config/flashcard-banks', `${bankId}.json`), 'utf8'))
      .cards[0];
    const changes = [
      { options: card.options.map((option, i) => (i ? option : { ...option, text: `${option.text} altered` })) },
      { passage: `${card.passage} altered` },
      { material: `${card.material} altered` },
      { answerEvidence: { ...card.answerEvidence, evidenceRole: 'different_role' } },
      { answerEvidence: { ...card.answerEvidence, answerTextHash: textDigest('different') } }
    ];
    for (const change of changes)
      expect((await reportForCard({ ...card, ...change }, bankId)).summary.answerEvidenceBlockerCount).toBe(1);
  });

  it('preserves split and masked page references while rejecting missing or cross-bank pages', async () => {
    for (const [bankId, number] of [
      ['math1-2023', 7],
      ['math2-2014', 22],
      ['math3-2010', 20],
      ['math1-2025', 1]
    ]) {
      const card = JSON.parse(
        fs.readFileSync(path.resolve('src/config/flashcard-banks', `${bankId}.json`), 'utf8')
      ).cards.find((row) => row.number === number);
      expect((await reportForCard(card, bankId)).summary.answerEvidenceBlockerCount).toBe(0);
      expect((await reportForCard({ ...card, questionImages: [] }, bankId)).summary.answerEvidenceBlockerCount).toBe(1);
      const changed = {
        ...card,
        questionImages: [{ ...card.questionImages[0], src: 'question-bank/other/paper-page-01.jpg' }]
      };
      expect((await reportForCard(changed, bankId)).summary.answerEvidenceBlockerCount).toBe(1);
    }
    const bankId = 'math3-2007';
    const missing = JSON.parse(
      fs.readFileSync(path.resolve('src/config/flashcard-banks', `${bankId}.json`), 'utf8')
    ).cards.find((row) => row.number === 24);
    expect((await reportForCard(missing, bankId)).summary.answerEvidenceBlockerCount).toBe(0);
    expect((await reportForCard({ ...missing, questionImages: [] }, bankId)).summary.answerEvidenceBlockerCount).toBe(
      1
    );
  });
  it.each([
    'math1-2013',
    'math3-2017',
    'english1-2013',
    'english2-2014',
    'english2-2015',
    'english1-2022',
    'english1-2024',
    'politics-2024'
  ])('checks the registered composite digest for %s rather than only its display string', async (bankId) => {
    const card = JSON.parse(fs.readFileSync(path.resolve('src/config/flashcard-banks', `${bankId}.json`), 'utf8'))
      .cards[0];
    const original = JSON.stringify(card);
    expect((await reportForCard(card, bankId)).summary.answerEvidenceBlockerCount).toBe(0);
    expect(JSON.stringify(card)).toBe(original);
    for (const field of ['question', 'answer']) {
      const changed = { ...card, [field]: `${card[field]} altered` };
      expect((await reportForCard(changed, bankId)).summary.answerEvidenceBlockerCount).toBe(1);
    }
  });
  it.each(['camel', 'snake', 'nested'])(
    'rejects conflicting %s digest aliases despite one valid declaration',
    async (location) => {
      const card = digestCard();
      if (location === 'camel') card.questionTextHash = 'sha256:placeholder';
      if (location === 'snake') card.question_text_hash = textDigest('Different question');
      card.sourceEvidence = {
        questionTextHash: location === 'nested' ? textDigest('Different question') : textDigest(card.question)
      };
      const before = JSON.stringify(card);
      const report = await reportForCard(card);
      expect(report.summary.answerEvidenceBlockerCount).toBe(1);
      expect(report.answerEvidence.blockedBanks[0].blockedCards[0].missingFields).toContain(
        'questionTextHash=content_mismatch'
      );
      expect(JSON.stringify(card)).toBe(before);
    }
  );

  it.each(['nested', 'snake'])(
    'accepts actual %s digests without introducing a new required declaration',
    async (location) => {
      const card = digestCard();
      if (location === 'nested')
        card.sourceEvidence = { questionTextHash: card.questionTextHash, answerTextHash: card.answerTextHash };
      else {
        card.question_text_hash = card.questionTextHash;
        card.answer_text_hash = card.answerTextHash;
      }
      delete card.questionTextHash;
      delete card.answerTextHash;
      const report = await reportForCard(card);
      expect(report.summary.answerEvidenceBlockerCount).toBe(0);
      expect(report.answerEvidence.blockedBanks).toEqual([]);
    }
  );

  it('keeps cleaning whitespace compatible while preserving BOM and punctuation as content', async () => {
    const card = digestCard();
    card.question = '\u001cFind\u00852\t+\n3.\u3000';
    expect((await reportForCard(card)).summary.answerEvidenceBlockerCount).toBe(0);
    for (const text of ['\ufeffFind 2 + 3.', 'Find 2 + 3?', 'Find 2 + 4.']) {
      card.question = text;
      expect((await reportForCard(card)).summary.answerEvidenceBlockerCount).toBe(1);
    }
  });

  it('uses the same Unicode edge policy for declared digests', async () => {
    const card = digestCard();
    card.questionTextHash = `\u0085${card.questionTextHash}\u3000`;
    expect((await reportForCard(card)).summary.answerEvidenceBlockerCount).toBe(0);
    card.answerTextHash = `\ufeff${card.answerTextHash}`;
    expect((await reportForCard(card)).summary.answerEvidenceBlockerCount).toBe(1);
  });

  it.each(['question', 'answer'])('blocks stale matched evidence after changing %s', async (field) => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const bankDir = tempDir('exam-master-qb-digest-');
    const card = {
      id: 'math1-2099-1',
      type: 'short_answer',
      question: 'Find 2 + 3.',
      answer: '5',
      sourceEvidenceId: 'synthetic-source',
      answerEvidenceStatus: 'matched',
      questionTextHash: textDigest('Find 2 + 3.'),
      answerTextHash: textDigest('5')
    };
    card[field] = field === 'question' ? 'Find 2 + 4.' : '6';
    fs.writeFileSync(path.join(bankDir, 'math1-2099.json'), JSON.stringify({ cards: [card] }));
    const report = buildQuestionBankReleaseReport({
      minYear: 2099,
      maxYear: 2099,
      tracks: ['math1'],
      sourceManifest: tempManifestPath(),
      bankDir,
      banks: [{ id: 'math1-2099', subjectKey: 'math', track: 'math1', year: '2099', name: 'Synthetic' }]
    });
    expect(report.summary.answerEvidenceBlockerCount).toBe(1);
    expect(report.answerEvidence.blockedBanks[0].blockedCards[0].missingFields).toContain(
      `${field}TextHash=content_mismatch`
    );
    expect(report.releaseReadiness.canPublish).toBe(false);
  });

  it('blocks published English papers when choice questions lack passage context', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const tmp = tempDir('exam-master-qb-bank-');
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
              questionTextHash: textDigest('Question 21'),
              answerTextHash: textDigest('A')
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

  it('auto-pairs Baidu Netdisk official paper and answer PDFs as source coverage', () => {
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
        riskFlags: []
      },
      {
        sourceId: 'src_eng1_2024_answer',
        eligible: true,
        status: 'discovered',
        sourceType: 'official_paper',
        track: 'english1',
        year: 2024,
        remotePath: '/apps/考研大师/raw-pdf/english1/2024英语一参考答案.pdf',
        contentHash: 'sha256:discovered-answer-source',
        riskFlags: []
      },
      {
        sourceId: 'src_eng2_2024_combined',
        eligible: true,
        status: 'discovered',
        sourceType: 'official_paper',
        track: 'english2',
        year: 2024,
        remotePath: '/apps/考研大师/raw-pdf/english2/2024英语二真题及答案.pdf',
        contentHash: 'sha256:combined-source',
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
    expect(report.summary.sourceEvidencePolicy).toBe('baidu_netdisk_official_paper_auto_pair_v1');
    expect(report.summary.sourceManifestTotalSources).toBe(3);
    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
    expect(report.summary.sourceManifestAutoPairedOfficialSourceSlots).toBe(2);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(16);
    expect(report.summary.pendingCoverageBlockerCount).toBe(0);
    expect(report.sourceEvidence.coverage.english1.presentYears).toEqual([2024]);
    expect(report.sourceEvidence.coverage.english2.presentYears).toEqual([2024]);
    expect(report.sourceEvidence.candidateDiagnostics.english1[2024]).toMatchObject({
      candidateCount: 2,
      officialPaperCandidateCount: 2,
      autoPairEligibleCandidateCount: 2,
      paperCandidateCount: 1,
      answerCandidateCount: 1,
      combinedCandidateCount: 0
    });
    expect(report.sourceEvidence.candidateDiagnostics.english2[2024].sampleCandidates[0]).toMatchObject({
      sourceId: 'src_eng2_2024_combined',
      sourceType: 'official_paper',
      inferredSourceRole: 'paper_answer',
      autoPairEligible: true,
      blockReasons: []
    });
    expect(report.summary.answerEvidenceBlockerCount).toBe(
      report.answerEvidence.blockedBanks.reduce((count, bank) => count + bank.blockedCards.length, 0)
    );
    expect(report.summary.enabledBankCount).toBeGreaterThan(0);
    expect(report.summary.selfStudyDraftBankCount).toBe(0);
    expect(report.summary.pendingBankCount).toBeGreaterThan(0);
    expect(report.coverage.tracks.find((track) => track.track === 'english2').releaseState).toBe('partial');
  });

  it('does not require English II source evidence before the first real exam year', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');

    const report = buildQuestionBankReleaseReport({
      minYear: 2005,
      maxYear: 2010,
      tracks: ['english2'],
      sourceManifest: tempManifestPath(),
      banks: []
    });

    expect(report.summary.requiredSlots).toBe(1);
    expect(report.summary.coverageGapCount).toBe(1);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(1);
    expect(report.coverage.tracks[0].requiredYears).toEqual([2010]);
    expect(report.sourceEvidence.coverage.english2.missingYears).toEqual([2010]);
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
      autoPairEligibleCandidateCount: 1,
      blockReasons: {
        'slotPair=missing_paper': 1
      }
    });
    expect(report.sourceEvidence.coverage.english1.missingYearDiagnostics[2099].sampleCandidates[0]).toMatchObject({
      sourceId: 'src_english1_2099_answer_only',
      sourceType: 'official_paper',
      sourceRole: 'answer',
      inferredSourceRole: 'answer',
      autoPairEligible: true,
      blockReasons: []
    });
  });

  it('counts historical math standard-answer-analysis PDFs as combined paper-answer evidence', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const manifest = tempManifestPath([
      {
        sourceId: 'src_math1_2099_standard_answer_analysis',
        eligible: true,
        status: 'discovered',
        sourceType: 'official_paper',
        track: 'math1',
        year: 2099,
        remotePath: '/raw/math1/2099-数一标准答案及解析.pdf',
        contentHash: 'sha256:math1-2099-paper-answer-source',
        riskFlags: []
      }
    ]);

    const report = buildQuestionBankReleaseReport({
      minYear: 2099,
      maxYear: 2099,
      tracks: ['math1'],
      sourceManifest: manifest,
      banks: []
    });

    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(0);
    expect(report.sourceEvidence.coverage.math1.presentYears).toEqual([2099]);
    expect(report.sourceEvidence.candidateDiagnostics.math1[2099]).toMatchObject({
      candidateCount: 1,
      officialPaperCandidateCount: 1,
      autoPairEligibleCandidateCount: 1,
      paperCandidateCount: 0,
      answerCandidateCount: 0,
      combinedCandidateCount: 1
    });
    expect(report.sourceEvidence.candidateDiagnostics.math1[2099].sampleCandidates[0]).toMatchObject({
      sourceId: 'src_math1_2099_standard_answer_analysis',
      inferredSourceRole: 'paper_answer',
      autoPairEligible: true,
      blockReasons: []
    });
  });

  it('does not count mismatched-year math standard-answer-analysis PDFs as combined source coverage', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const manifest = tempManifestPath([
      {
        sourceId: 'src_math2_2098_wrong_year_standard_answer_analysis',
        eligible: true,
        status: 'discovered',
        sourceType: 'official_paper',
        track: 'math2',
        year: 2098,
        remotePath: '/raw/math2/2097-数二标准答案及解析.pdf',
        contentHash: 'sha256:math2-wrong-year-source',
        riskFlags: []
      }
    ]);

    const report = buildQuestionBankReleaseReport({
      minYear: 2098,
      maxYear: 2098,
      tracks: ['math2'],
      sourceManifest: manifest,
      banks: []
    });

    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(1);
    expect(report.sourceEvidence.coverage.math2.presentYears).toEqual([]);
    expect(report.sourceEvidence.coverage.math2.missingYearDiagnostics[2098]).toMatchObject({
      candidateCount: 1,
      officialPaperCandidateCount: 1,
      autoPairEligibleCandidateCount: 1,
      answerCandidateCount: 1,
      combinedCandidateCount: 0,
      blockReasons: {
        'slotPair=missing_paper': 1
      }
    });
    expect(report.sourceEvidence.coverage.math2.missingYearDiagnostics[2098].sampleCandidates[0]).toMatchObject({
      sourceId: 'src_math2_2098_wrong_year_standard_answer_analysis',
      inferredSourceRole: 'answer',
      autoPairEligible: true,
      blockReasons: []
    });
  });

  it('does not count known mislabeled math2 2016 source as source coverage', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const manifest = tempManifestPath([
      {
        sourceId: 'src_97fdbcbd12d0815374fbe91f',
        eligible: true,
        status: 'discovered',
        sourceType: 'official_paper',
        track: 'math2',
        year: 2016,
        remotePath:
          '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/考研数学真题【真题及解析】（1987-2023）/【完整版】数学二真题答案解析/2016考研数学二真题 .pdf',
        contentHash: '5347d192as7e7e3d20fdf8d7db3fdd68',
        riskFlags: []
      }
    ]);

    const report = buildQuestionBankReleaseReport({
      minYear: 2016,
      maxYear: 2016,
      tracks: ['math2'],
      sourceManifest: manifest,
      banks: []
    });

    expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
    expect(report.summary.sourceManifestCoverageGapCount).toBe(1);
    expect(report.sourceEvidence.coverage.math2.presentYears).toEqual([]);
    expect(report.sourceEvidence.coverage.math2.missingYearDiagnostics[2016]).toMatchObject({
      candidateCount: 1,
      officialPaperCandidateCount: 1,
      autoPairEligibleCandidateCount: 0,
      blockReasons: {
        'riskFlags=manual_review_required,source_content_mismatch': 1,
        'legalReview.publishBlocked=true': 1,
        source_content_mismatch: 1
      }
    });
    expect(report.sourceEvidence.coverage.math2.missingYearDiagnostics[2016].sampleCandidates[0]).toMatchObject({
      sourceId: 'src_97fdbcbd12d0815374fbe91f',
      inferredSourceRole: 'paper_answer',
      autoPairEligible: false,
      publishBlocked: true,
      riskFlags: ['manual_review_required', 'source_content_mismatch']
    });
  });

  it('blocks the branded math2 2021 copy even after its release metadata is rewritten', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const base = {
      sourceId: 'renamed-copy',
      eligible: true,
      status: 'published',
      sourceType: 'official_paper',
      sourceRole: 'paper_answer',
      track: 'math2',
      year: 2021,
      remotePath: '/replacement/2021-math2-paper-answer.pdf',
      contentHash: 'different',
      answerEvidenceStatus: 'matched',
      riskFlags: [],
      legalReview: { publishBlocked: false }
    };
    const identities = [
      { sourceId: 'src_1b0fd1f2d5c9741193305511' },
      { contentHash: '46f076305pf181eb53d3f3c01172fdd7' },
      { sha256: 'a9db41a6703e349215044e39c980c99fecbb8386321bdf206ee002502e61c068' },
      { fileSha256: 'sha256:a9db41a6703e349215044e39c980c99fecbb8386321bdf206ee002502e61c068' },
      { remotePath: '/EXAM-MASTER/【完整版】数学二真题答案解析/2021考研数学二真题 .pdf' }
    ];
    for (const identity of identities) {
      const report = buildQuestionBankReleaseReport({
        minYear: 2021,
        maxYear: 2021,
        tracks: ['math2'],
        banks: [],
        sourceManifest: tempManifestPath([{ ...base, ...identity }])
      });
      expect(report.summary.sourceManifestPublishableOfficialPapers).toBe(0);
      expect(report.summary.sourceManifestCoverageGapCount).toBe(1);
      const diagnostics = report.sourceEvidence.coverage.math2.missingYearDiagnostics[2021];
      expect(diagnostics.autoPairEligibleCandidateCount).toBe(0);
      expect(diagnostics.blockReasons.branded_reference_rights_unverified).toBe(1);
      expect(diagnostics.sampleCandidates[0].publishBlocked).toBe(true);
    }
    const replacement = buildQuestionBankReleaseReport({
      minYear: 2021,
      maxYear: 2021,
      tracks: ['math2'],
      banks: [],
      sourceManifest: tempManifestPath([base])
    });
    expect(replacement.sourceEvidence.coverage.math2.presentYears).toEqual([2021]);
  });

  it('keeps self-study draft banks as pending release blockers even when source evidence is complete', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const tmp = tempDir('exam-master-qb-bank-');
    fs.writeFileSync(path.join(tmp, 'english1-2099.json'), JSON.stringify({ cards: [] }, null, 2));
    const manifest = tempManifestPath([
      {
        sourceId: 'src_english1_2099_verified',
        eligible: true,
        status: 'verified',
        sourceType: 'official_paper',
        track: 'english1',
        year: 2099,
        remotePath: '/raw/english1/2099真题及答案.pdf',
        contentHash: 'sha256:english1-2099-source',
        riskFlags: []
      }
    ]);

    const report = buildQuestionBankReleaseReport({
      minYear: 2099,
      maxYear: 2099,
      tracks: ['english1'],
      bankDir: tmp,
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
    expect(report.summary.unregisteredBankFileCount).toBe(0);
    expect(report.summary.missingBankFileCount).toBe(0);
    expect(report.releaseReadiness.blockers).toMatchObject({
      coverage: 0,
      pendingCoverage: 1,
      sourceEvidence: 0,
      answerEvidence: 0,
      grading: 0,
      bankFileInventory: 0
    });
    expect(report.coverage.tracks[0]).toMatchObject({
      publishedYears: [],
      pendingYears: [2099],
      missingYears: []
    });
  });

  it('blocks unregistered flashcard bank files and registered banks with missing JSON', async () => {
    const { buildQuestionBankReleaseReport } = await import('../../scripts/build/question-bank-release-gate.mjs');
    const tmp = tempDir('exam-master-qb-bank-');
    fs.writeFileSync(path.join(tmp, 'english1-2099.json'), JSON.stringify({ cards: [] }, null, 2));
    fs.writeFileSync(path.join(tmp, 'english-2099.json'), JSON.stringify({ cards: [] }, null, 2));

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
          name: '2099考研英语一真题',
          enabled: false
        },
        {
          id: 'english1-2100',
          subjectKey: 'english',
          track: 'english1',
          year: '2100',
          name: '2100考研英语一真题',
          enabled: false
        }
      ]
    });

    expect(report.releaseReadiness.canPublish).toBe(false);
    expect(report.summary.unregisteredBankFileCount).toBe(1);
    expect(report.summary.missingBankFileCount).toBe(1);
    expect(report.releaseReadiness.blockers.bankFileInventory).toBe(2);
    expect(report.bankFileInventory.unregisteredBankFiles).toEqual([
      {
        bankId: 'english-2099',
        filePath: expect.stringContaining('english-2099.json')
      }
    ]);
    expect(report.bankFileInventory.missingBankFiles).toEqual([
      {
        bankId: 'english1-2100',
        filePath: expect.stringContaining('english1-2100.json')
      }
    ]);
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
        remotePath: '/raw/math1/2024数学一真题.pdf',
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
        remotePath: '/raw/math1/2024数学一真题.pdf',
        contentHash: 'sha256:verified',
        riskFlags: []
      }
    ]);
    const result = runGate(['--min-year=2024', '--max-year=2024', '--output', output, '--source-manifest', manifest]);

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    const samples = report.sourceEvidence.candidateDiagnostics.math1[2024].sampleCandidates;

    expect(samples.map((sample) => sample.sourceId)).toEqual([
      'src_math1_2024_official_verified_missing_answer',
      'src_math1_2024_official_discovered',
      'src_math1_2024_answer_only_verified'
    ]);
    expect(samples[0]).toMatchObject({
      sourceType: 'official_paper',
      sourceRole: '',
      status: 'verified',
      inferredSourceRole: 'paper',
      autoPairEligible: true,
      blockReasons: []
    });
    expect(samples[2]).toMatchObject({
      sourceType: 'official_paper',
      sourceRole: 'answer',
      inferredSourceRole: 'answer',
      blockReasons: []
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
    expect(report.releaseReadiness.blockers.answerEvidence).toBe(report.summary.answerEvidenceBlockerCount);
  });
});
