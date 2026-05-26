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
    minYear: 2005,
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

function isEvidenceOnlyType(type) {
  return ['analysis', 'flashcard', 'translation', 'essay', 'short_answer'].includes(type);
}

function hasPassageMaterial(card) {
  return Boolean(firstNonEmpty(card.passage, card.context, card.material, card.article));
}

function cardId(card, index) {
  return firstNonEmpty(card.id, card.questionId, card.question_id, card.number) || `card-${index + 1}`;
}

function auditCardEvidence(card, index, bank = {}) {
  const missingFields = [];

  if (!String(card.question || card.stem || '').trim()) missingFields.push('question');
  if (!String(card.answer || '').trim()) missingFields.push('answer');
  if (bank?.subjectKey === 'english' && !isEvidenceOnlyType(card.type) && !hasPassageMaterial(card)) {
    missingFields.push('passage');
  }
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

function auditBankFileInventory({ banks, bankDir }) {
  const registeredIds = new Set(banks.map((bank) => bank.id).filter(Boolean));
  const bankFiles = fs.existsSync(bankDir)
    ? fs
        .readdirSync(bankDir)
        .filter((fileName) => fileName.endsWith('.json'))
        .sort()
    : [];
  const bankFileIds = new Set(bankFiles.map((fileName) => path.basename(fileName, '.json')));
  const unregisteredBankFiles = bankFiles
    .map((fileName) => ({
      bankId: path.basename(fileName, '.json'),
      filePath: path.relative(PROJECT_ROOT, path.join(bankDir, fileName))
    }))
    .filter((file) => !registeredIds.has(file.bankId));
  const missingBankFiles = [...registeredIds]
    .filter((bankId) => !bankFileIds.has(bankId))
    .sort()
    .map((bankId) => ({
      bankId,
      filePath: path.relative(PROJECT_ROOT, path.join(bankDir, `${bankId}.json`))
    }));

  return {
    registeredBankCount: registeredIds.size,
    bankFileCount: bankFiles.length,
    unregisteredBankFileCount: unregisteredBankFiles.length,
    missingBankFileCount: missingBankFiles.length,
    blockerCount: unregisteredBankFiles.length + missingBankFiles.length,
    unregisteredBankFiles,
    missingBankFiles
  };
}

function isReleaseBank(bank) {
  return bank?.enabled !== false && bank?.usageScope !== 'self_study_draft';
}

function auditPublishedBanks({ banks, bankDir }) {
  const blockedBanks = [];
  let cardCount = 0;
  let answerEvidenceBlockerCount = 0;
  let gradingBlockerCount = 0;

  for (const bank of banks.filter(isReleaseBank)) {
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
        const cardReport = auditCardEvidence(card, index, bank);
        if (cardReport.missingFields.length) {
          bankReport.blockedCards.push(cardReport);
          if (cardReport.missingFields.some((field) => ['question', 'answer', 'cards'].includes(field))) {
            gradingBlockerCount += 1;
          }
          if (cardReport.missingFields.includes('passage')) {
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
  const sourceRole = String(item.sourceRole || item.source_role || '').trim();
  if (sourceRole && !['paper', 'paper_answer'].includes(sourceRole)) return false;
  const blockingRiskFlags = new Set(['answer_missing', 'brand_leak', 'copyright_review_required', 'ad_or_promo']);
  if (Array.isArray(item.riskFlags) && item.riskFlags.some((flag) => blockingRiskFlags.has(flag))) return false;
  if (item.legalReview?.publishBlocked) return false;
  if (item.answerEvidenceStatus !== 'matched') return false;
  if (!firstNonEmpty(item.contentHash, item.sha256, item.fileSha256, item.sourceHash)) return false;
  if (!firstNonEmpty(item.remotePath, item.sourceUrl, item.provenanceUrl)) return false;
  return true;
}

function manifestSourceBlockReasons(item) {
  const reasons = [];
  if (!item?.eligible) reasons.push('eligible=false');
  if (!['verified', 'published'].includes(item?.status)) reasons.push(`status=${item?.status || 'missing'}`);
  if (item?.sourceType !== 'official_paper') reasons.push(`sourceType=${item?.sourceType || 'missing'}`);
  const sourceRole = String(item?.sourceRole || item?.source_role || '').trim();
  if (sourceRole && !['paper', 'paper_answer'].includes(sourceRole)) {
    reasons.push(`sourceRole=${sourceRole}`);
  }

  const blockingRiskFlags = new Set(['answer_missing', 'brand_leak', 'copyright_review_required', 'ad_or_promo']);
  const riskFlags = Array.isArray(item?.riskFlags) ? item.riskFlags : [];
  const blockedFlags = riskFlags.filter((flag) => blockingRiskFlags.has(flag));
  if (blockedFlags.length) reasons.push(`riskFlags=${blockedFlags.join(',')}`);
  if (item?.legalReview?.publishBlocked) reasons.push('legalReview.publishBlocked=true');
  if (item?.answerEvidenceStatus !== 'matched') {
    reasons.push(`answerEvidenceStatus=${item?.answerEvidenceStatus || 'missing'}`);
  }
  if (!firstNonEmpty(item?.contentHash, item?.sha256, item?.fileSha256, item?.sourceHash)) {
    reasons.push('sourceHash=missing');
  }
  if (!firstNonEmpty(item?.remotePath, item?.sourceUrl, item?.provenanceUrl)) {
    reasons.push('sourceLocation=missing');
  }

  return reasons;
}

function sourceCandidateSample(item, blockReasons) {
  return {
    sourceId: item.sourceId || item.id || '',
    status: item.status || '',
    sourceType: item.sourceType || '',
    sourceRole: item.sourceRole || item.source_role || '',
    answerEvidenceStatus: item.answerEvidenceStatus || '',
    riskFlags: Array.isArray(item.riskFlags) ? item.riskFlags : [],
    publishBlocked: item.legalReview?.publishBlocked === true,
    blockReasons,
    remotePath: item.remotePath || '',
    sourceUrl: item.sourceUrl || ''
  };
}

function sourceCandidateSampleRank(sample) {
  const statusRank = {
    published: 0,
    verified: 1,
    discovered: 2
  };
  const sourceRoleRank = {
    paper_answer: 0,
    paper: 0,
    '': 0,
    answer: 1
  };

  return [
    sample.sourceType === 'official_paper' ? 0 : 1,
    sourceRoleRank[sample.sourceRole || ''] ?? 2,
    sample.publishBlocked ? 1 : 0,
    statusRank[sample.status] ?? 9,
    sample.answerEvidenceStatus === 'matched' ? 0 : 1,
    sample.blockReasons.length,
    sample.remotePath || sample.sourceUrl ? 0 : 1,
    sample.sourceId
  ];
}

function compareSourceCandidateSamples(a, b) {
  const aRank = sourceCandidateSampleRank(a);
  const bRank = sourceCandidateSampleRank(b);
  for (let index = 0; index < aRank.length; index += 1) {
    if (aRank[index] === bRank[index]) continue;
    if (typeof aRank[index] === 'number' && typeof bRank[index] === 'number') {
      return aRank[index] - bRank[index];
    }
    return String(aRank[index]).localeCompare(String(bRank[index]));
  }
  return 0;
}

function keepBestSourceCandidateSamples(samples, sample, limit = 3) {
  samples.push(sample);
  samples.sort(compareSourceCandidateSamples);
  if (samples.length > limit) samples.length = limit;
}

function candidateSlotMatches(item, track, requiredYears) {
  const itemTrack = item?.track || item?.subject;
  const year = Number(item?.year);
  return itemTrack === track && Number.isInteger(year) && requiredYears.includes(year);
}

function buildCandidateDiagnostics(items, tracks, requiredYears) {
  const diagnostics = Object.fromEntries(tracks.map((track) => [track, {}]));

  for (const item of items) {
    for (const track of tracks) {
      if (!candidateSlotMatches(item, track, requiredYears)) continue;

      const year = Number(item.year);
      const trackDiagnostics = diagnostics[track];
      const slot = (trackDiagnostics[year] ||= {
        candidateCount: 0,
        officialPaperCandidateCount: 0,
        publishBlockedCandidateCount: 0,
        blockReasons: {},
        sampleCandidates: []
      });
      const reasons = manifestSourceBlockReasons(item);
      slot.candidateCount += 1;
      if (item.sourceType === 'official_paper') slot.officialPaperCandidateCount += 1;
      if (item.legalReview?.publishBlocked) slot.publishBlockedCandidateCount += 1;
      for (const reason of reasons) {
        slot.blockReasons[reason] = (slot.blockReasons[reason] || 0) + 1;
      }
      keepBestSourceCandidateSamples(slot.sampleCandidates, sourceCandidateSample(item, reasons));
    }
  }

  return diagnostics;
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
      candidateDiagnostics: Object.fromEntries(tracks.map((track) => [track, {}])),
      coverage: Object.fromEntries(
        tracks.map((track) => [track, { presentYears: [], missingYears: requiredYears, coverageRate: 0 }])
      )
    };
  }

  const manifest = readJson(sourceManifest);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const publishable = items.filter(isPublishableManifestSource);
  const coverage = {};
  const candidateDiagnostics = buildCandidateDiagnostics(items, tracks, requiredYears);

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
      missingYearDiagnostics: Object.fromEntries(
        missingYears.map((year) => [
          year,
          candidateDiagnostics[track]?.[year] || {
            candidateCount: 0,
            officialPaperCandidateCount: 0,
            publishBlockedCandidateCount: 0,
            blockReasons: {},
            sampleCandidates: []
          }
        ])
      ),
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
    candidateDiagnostics,
    coverage
  };
}

export function buildQuestionBankReleaseReport(options = {}) {
  const banks = Array.isArray(options.banks) ? options.banks : getAllBankMetas();
  const releaseBanks = banks.filter(isReleaseBank);
  const tracks = options.tracks || DEFAULT_TRACKS;
  const minYear = options.minYear ?? 2005;
  const maxYear = options.maxYear ?? 2026;
  const coverage = buildPublicCourseCoverage({
    banks,
    tracks,
    minYear,
    maxYear
  });
  const evidence = auditPublishedBanks({
    banks: releaseBanks,
    bankDir: options.bankDir || DEFAULT_BANK_DIR
  });
  const bankFileInventory = auditBankFileInventory({
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
  const pendingCoverageBlockerCount = coverage.summary.pendingSlots;
  const canPublish =
    coverageGapCount === 0 &&
    pendingCoverageBlockerCount === 0 &&
    sourceEvidence.coverageGapCount === 0 &&
    evidence.answerEvidenceBlockerCount === 0 &&
    evidence.gradingBlockerCount === 0 &&
    bankFileInventory.blockerCount === 0;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    scope: {
      tracks,
      minYear,
      maxYear
    },
    summary: {
      enabledBankCount: releaseBanks.length,
      selfStudyDraftBankCount: banks.filter((item) => item.enabled !== false && item.usageScope === 'self_study_draft')
        .length,
      pendingBankCount: banks.filter((item) => item.enabled === false).length,
      cardCount: evidence.cardCount,
      requiredSlots: coverage.summary.requiredSlots,
      publishedSlots: coverage.summary.publishedSlots,
      pendingSlots: coverage.summary.pendingSlots,
      pendingCoverageBlockerCount,
      coverageGapCount,
      sourceManifestStatus: sourceEvidence.status,
      sourceManifestTotalSources: sourceEvidence.totalSources,
      sourceManifestPublishableOfficialPapers: sourceEvidence.publishableOfficialPapers,
      sourceManifestCoverageGapCount: sourceEvidence.coverageGapCount,
      registeredBankCount: bankFileInventory.registeredBankCount,
      bankFileCount: bankFileInventory.bankFileCount,
      unregisteredBankFileCount: bankFileInventory.unregisteredBankFileCount,
      missingBankFileCount: bankFileInventory.missingBankFileCount,
      answerEvidenceBlockerCount: evidence.answerEvidenceBlockerCount,
      gradingBlockerCount: evidence.gradingBlockerCount
    },
    coverage,
    sourceEvidence,
    answerEvidence: {
      blockedBanks: evidence.blockedBanks
    },
    bankFileInventory,
    releaseReadiness: {
      canPublish,
      blockers: {
        coverage: coverageGapCount,
        pendingCoverage: pendingCoverageBlockerCount,
        sourceEvidence: sourceEvidence.coverageGapCount,
        answerEvidence: evidence.answerEvidenceBlockerCount,
        grading: evidence.gradingBlockerCount,
        bankFileInventory: bankFileInventory.blockerCount
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
      `pendingCoverageBlockers=${summary.pendingCoverageBlockerCount} ` +
      `sourceEvidenceGaps=${summary.sourceManifestCoverageGapCount} ` +
      `answerEvidenceBlockers=${summary.answerEvidenceBlockerCount} ` +
      `gradingBlockers=${summary.gradingBlockerCount} ` +
      `bankFileInventoryBlockers=${report.releaseReadiness.blockers.bankFileInventory} ` +
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
