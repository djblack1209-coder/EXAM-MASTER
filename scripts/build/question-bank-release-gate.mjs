#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicCourseCoverage, getAllBankMetas } from '../../src/config/bank-registry.js';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const DEFAULT_BANK_DIR = path.join(PROJECT_ROOT, 'src/config/flashcard-banks');
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'data/question-bank-release-audit.json');
const DEFAULT_SOURCE_MANIFEST = path.join(PROJECT_ROOT, 'data/source-manifest.json');
const DEFAULT_TRACKS = ['politics', 'english1', 'english2', 'math1', 'math2', 'math3'];

function parseArgs(argv) {
  const options = {
    minYear: 2010,
    maxYear: 2026,
    output: DEFAULT_OUTPUT,
    bankDir: DEFAULT_BANK_DIR,
    sourceManifest: DEFAULT_SOURCE_MANIFEST,
    tracks: DEFAULT_TRACKS,
    failOnBlockers: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.split('=');
    const nextValue = inlineValue ?? argv[index + 1];

    if (key === '--min-year') {
      options.minYear = Number(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--max-year') {
      options.maxYear = Number(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--output') {
      options.output = nextValue;
      if (inlineValue === undefined) index += 1;
    } else if (key === '--bank-dir') {
      options.bankDir = nextValue;
      if (inlineValue === undefined) index += 1;
    } else if (key === '--source-manifest') {
      options.sourceManifest = nextValue;
      if (inlineValue === undefined) index += 1;
    } else if (key === '--tracks') {
      options.tracks = String(nextValue)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (inlineValue === undefined) index += 1;
    } else if (arg === '--fail-on-blockers') {
      options.failOnBlockers = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  if (!Number.isInteger(options.minYear) || !Number.isInteger(options.maxYear) || options.minYear > options.maxYear) {
    throw new Error('--min-year and --max-year must be valid integers, with min <= max');
  }
  if (!options.tracks.length) {
    throw new Error('--tracks must include at least one track');
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function firstNonEmpty(...values) {
  return values.find((value) => String(value ?? '').trim() !== '');
}

function answerEvidenceStatus(card) {
  return firstNonEmpty(card.answerEvidenceStatus, card.answer_evidence_status) || '';
}

function sourceEvidenceId(card) {
  return firstNonEmpty(card.sourceEvidenceId, card.source_evidence_id, card.sourceEvidence?.evidenceId) || '';
}

function questionHash(card) {
  return firstNonEmpty(card.questionTextHash, card.question_text_hash, card.sourceEvidence?.questionTextHash) || '';
}

function answerHash(card) {
  return firstNonEmpty(card.answerTextHash, card.answer_text_hash, card.sourceEvidence?.answerTextHash) || '';
}

function cardId(card, index) {
  return firstNonEmpty(card.id, card.questionId, card.question_id, card.number) || `card-${index + 1}`;
}

function auditCardEvidence(card, index) {
  const missingFields = [];

  if (!String(card.question || card.stem || '').trim()) missingFields.push('question');
  if (!String(card.answer || '').trim()) missingFields.push('answer');
  if (!sourceEvidenceId(card)) missingFields.push('sourceEvidenceId');
  if (answerEvidenceStatus(card) !== 'matched') missingFields.push('answerEvidenceStatus=matched');
  if (!questionHash(card)) missingFields.push('questionTextHash');
  if (!answerHash(card)) missingFields.push('answerTextHash');

  return {
    cardId: String(cardId(card, index)),
    missingFields
  };
}

function loadPublishedBank(bank, bankDir) {
  const filePath = path.join(bankDir, `${bank.id}.json`);
  const data = readJson(filePath);
  const cards = Array.isArray(data.cards) ? data.cards : Array.isArray(data.questions) ? data.questions : [];
  return { filePath, cards };
}

function auditPublishedBanks({ banks, bankDir }) {
  const blockedBanks = [];
  let cardCount = 0;
  let answerEvidenceBlockerCount = 0;
  let gradingBlockerCount = 0;

  for (const bank of banks.filter((item) => item.enabled !== false)) {
    const bankReport = {
      bankId: bank.id,
      name: bank.name,
      track: bank.track,
      year: bank.year,
      filePath: path.relative(PROJECT_ROOT, path.join(bankDir, `${bank.id}.json`)),
      blockedCards: []
    };

    try {
      const { cards } = loadPublishedBank(bank, bankDir);
      cardCount += cards.length;

      if (!cards.length) {
        bankReport.blockedCards.push({ cardId: '__bank__', missingFields: ['cards'] });
      }

      cards.forEach((card, index) => {
        const cardReport = auditCardEvidence(card, index);
        if (cardReport.missingFields.length) {
          bankReport.blockedCards.push(cardReport);
          if (cardReport.missingFields.some((field) => ['question', 'answer', 'cards'].includes(field))) {
            gradingBlockerCount += 1;
          }
          if (
            cardReport.missingFields.some((field) =>
              ['sourceEvidenceId', 'answerEvidenceStatus=matched', 'questionTextHash', 'answerTextHash'].includes(field)
            )
          ) {
            answerEvidenceBlockerCount += 1;
          }
        }
      });
    } catch (error) {
      bankReport.blockedCards.push({
        cardId: '__bank__',
        missingFields: ['bankFile'],
        message: error instanceof Error ? error.message : String(error)
      });
      gradingBlockerCount += 1;
    }

    if (bankReport.blockedCards.length) {
      blockedBanks.push(bankReport);
    }
  }

  return {
    cardCount,
    answerEvidenceBlockerCount,
    gradingBlockerCount,
    blockedBanks
  };
}

function isPublishableManifestSource(item) {
  if (!item?.eligible) return false;
  if (!['verified', 'published'].includes(item.status)) return false;
  if (item.sourceType !== 'official_paper') return false;
  const blockingRiskFlags = new Set(['answer_missing', 'brand_leak', 'copyright_review_required', 'ad_or_promo']);
  if (Array.isArray(item.riskFlags) && item.riskFlags.some((flag) => blockingRiskFlags.has(flag))) return false;
  if (item.legalReview?.publishBlocked) return false;
  if (item.answerEvidenceStatus !== 'matched') return false;
  if (!firstNonEmpty(item.contentHash, item.sha256, item.fileSha256, item.sourceHash)) return false;
  if (!firstNonEmpty(item.remotePath, item.sourceUrl, item.provenanceUrl)) return false;
  return true;
}

function loadSourceManifestEvidence({ sourceManifest, tracks, minYear, maxYear }) {
  const requiredYears = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);

  if (!sourceManifest || !fs.existsSync(sourceManifest)) {
    return {
      status: 'missing',
      manifestPath: sourceManifest ? path.relative(PROJECT_ROOT, sourceManifest) : '',
      totalSources: 0,
      eligibleSources: 0,
      publishableOfficialPapers: 0,
      coverageGapCount: tracks.length * requiredYears.length,
      coverage: Object.fromEntries(
        tracks.map((track) => [track, { presentYears: [], missingYears: requiredYears, coverageRate: 0 }])
      )
    };
  }

  const manifest = readJson(sourceManifest);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const publishable = items.filter(isPublishableManifestSource);
  const coverage = {};

  for (const track of tracks) {
    const presentYears = [
      ...new Set(
        publishable
          .filter((item) => item.track === track || item.subject === track)
          .map((item) => Number(item.year))
          .filter((year) => Number.isInteger(year) && requiredYears.includes(year))
      )
    ].sort((a, b) => a - b);
    const presentSet = new Set(presentYears);
    const missingYears = requiredYears.filter((year) => !presentSet.has(year));
    coverage[track] = {
      presentYears,
      missingYears,
      coverageRate: requiredYears.length ? Number((presentYears.length / requiredYears.length).toFixed(4)) : 1
    };
  }

  return {
    status: 'present',
    manifestPath: path.relative(PROJECT_ROOT, sourceManifest),
    updatedAt: manifest.updatedAt || '',
    totalSources: items.length,
    eligibleSources: items.filter((item) => item?.eligible).length,
    publishableOfficialPapers: publishable.length,
    coverageGapCount: Object.values(coverage).reduce((sum, row) => sum + row.missingYears.length, 0),
    coverage
  };
}

export function buildQuestionBankReleaseReport(options = {}) {
  const banks = Array.isArray(options.banks) ? options.banks : getAllBankMetas();
  const tracks = options.tracks || DEFAULT_TRACKS;
  const minYear = options.minYear ?? 2010;
  const maxYear = options.maxYear ?? 2026;
  const coverage = buildPublicCourseCoverage({
    banks,
    tracks,
    minYear,
    maxYear
  });
  const evidence = auditPublishedBanks({
    banks,
    bankDir: options.bankDir || DEFAULT_BANK_DIR
  });
  const sourceEvidence = loadSourceManifestEvidence({
    sourceManifest: options.sourceManifest || DEFAULT_SOURCE_MANIFEST,
    tracks,
    minYear,
    maxYear
  });
  const coverageGapCount = coverage.summary.missingSlots;
  const canPublish =
    coverageGapCount === 0 &&
    sourceEvidence.coverageGapCount === 0 &&
    evidence.answerEvidenceBlockerCount === 0 &&
    evidence.gradingBlockerCount === 0;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    scope: {
      tracks,
      minYear,
      maxYear
    },
    summary: {
      enabledBankCount: banks.filter((item) => item.enabled !== false).length,
      pendingBankCount: banks.filter((item) => item.enabled === false).length,
      cardCount: evidence.cardCount,
      requiredSlots: coverage.summary.requiredSlots,
      publishedSlots: coverage.summary.publishedSlots,
      pendingSlots: coverage.summary.pendingSlots,
      coverageGapCount,
      sourceManifestStatus: sourceEvidence.status,
      sourceManifestTotalSources: sourceEvidence.totalSources,
      sourceManifestPublishableOfficialPapers: sourceEvidence.publishableOfficialPapers,
      sourceManifestCoverageGapCount: sourceEvidence.coverageGapCount,
      answerEvidenceBlockerCount: evidence.answerEvidenceBlockerCount,
      gradingBlockerCount: evidence.gradingBlockerCount
    },
    coverage,
    sourceEvidence,
    answerEvidence: {
      blockedBanks: evidence.blockedBanks
    },
    releaseReadiness: {
      canPublish,
      blockers: {
        coverage: coverageGapCount,
        sourceEvidence: sourceEvidence.coverageGapCount,
        answerEvidence: evidence.answerEvidenceBlockerCount,
        grading: evidence.gradingBlockerCount
      }
    }
  };
}

function printHelp() {
  console.log(`Usage:
  node scripts/build/question-bank-release-gate.mjs [options]

Options:
  --min-year=YYYY          First required public-course past-exam year
  --max-year=YYYY          Last required public-course past-exam year
  --tracks=a,b,c           Track ids to audit
  --output <path>          JSON report path
  --source-manifest <path> Source Manifest path used as real source evidence
  --fail-on-blockers       Exit 2 when release blockers exist
`);
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }

  const report = buildQuestionBankReleaseReport(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);

  const summary = report.summary;
  console.log(
    `[question-bank-release-gate] canPublish=${report.releaseReadiness.canPublish} ` +
      `coverageGaps=${summary.coverageGapCount} ` +
      `sourceEvidenceGaps=${summary.sourceManifestCoverageGapCount} ` +
      `answerEvidenceBlockers=${summary.answerEvidenceBlockerCount} ` +
      `gradingBlockers=${summary.gradingBlockerCount} ` +
      `report=${path.relative(PROJECT_ROOT, options.output)}`
  );

  return options.failOnBlockers && !report.releaseReadiness.canPublish ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(`[question-bank-release-gate] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
