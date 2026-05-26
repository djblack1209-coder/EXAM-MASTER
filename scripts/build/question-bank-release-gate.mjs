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

const SOURCE_EVIDENCE_POLICY = 'baidu_netdisk_official_paper_auto_pair_v1';
const VALID_MANIFEST_SOURCE_STATUSES = new Set(['discovered', 'verified', 'published']);
const VALID_SOURCE_ROLES = new Set(['paper', 'answer', 'paper_answer']);
const BLOCKING_SOURCE_RISK_FLAGS = new Set([
  'answer_missing',
  'brand_leak',
  'copyright_review_required',
  'ad_or_promo'
]);

function sourceLocation(item) {
  return firstNonEmpty(item?.remotePath, item?.sourceUrl, item?.provenanceUrl);
}

function sourceHash(item) {
  return firstNonEmpty(item?.contentHash, item?.sha256, item?.fileSha256, item?.sourceHash);
}

function normalizeSourceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function sourceFileName(item) {
  const location = sourceLocation(item);
  return (
    String(location || '')
      .split(/[\\/]/)
      .pop() || ''
  );
}

function hasSourcePattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function inferManifestSourceRole(item) {
  const explicitRole = String(item?.sourceRole || item?.source_role || '').trim();
  if (explicitRole) {
    return {
      explicitRole,
      inferredRole: VALID_SOURCE_ROLES.has(explicitRole) ? explicitRole : 'unknown',
      roleSource: 'explicit'
    };
  }

  const fileName = normalizeSourceText(sourceFileName(item));
  const fullPath = normalizeSourceText(sourceLocation(item));

  const partialPatterns = [/缺t?\d/i, /缺题/i, /缺少/i, /不完整/i, /未完整/i, /partial/i];
  const answerSheetPatterns = [/答题卡/i, /answersheet/i, /answer-sheet/i];
  const combinedPatterns = [
    /真题(?:及|和|与|、|\+)?(?:参考)?答案/i,
    /试题(?:及|和|与|、|\+)?(?:参考)?答案/i,
    /真题(?:及|和|与|、|\+)?解析/i,
    /试题(?:及|和|与|、|\+)?解析/i,
    /真题、?标准答案/i,
    /真题答案解析/i,
    /真题及答案速查/i,
    /真题及参考答案/i,
    /真题和答案/i,
    /真题与答案/i,
    /真题\+答案/i,
    /paper[-_+]?answer/i
  ];
  const answerPatterns = [/参考答案/i, /标准答案/i, /答案/i, /解析/i, /逐题细解/i, /answer/i];
  const paperPatterns = [/试题/i, /试卷/i, /真题/i, /paper/i, /全国硕士研究生招生考试/i];
  const yearOnlyPaperPattern = /^((19|20)\d{2}|[0-9]{2})\.?pdf$/i;

  if (hasSourcePattern(fileName, answerSheetPatterns)) {
    return { explicitRole, inferredRole: 'answer_sheet', roleSource: 'filename' };
  }
  if (hasSourcePattern(fileName, partialPatterns)) {
    return { explicitRole, inferredRole: 'partial_answer', roleSource: 'filename' };
  }
  if (hasSourcePattern(fileName, combinedPatterns)) {
    return { explicitRole, inferredRole: 'paper_answer', roleSource: 'filename' };
  }
  if (hasSourcePattern(fileName, answerPatterns)) {
    return { explicitRole, inferredRole: 'answer', roleSource: 'filename' };
  }
  if (hasSourcePattern(fullPath, combinedPatterns)) {
    return { explicitRole, inferredRole: 'paper_answer', roleSource: 'path' };
  }
  if (hasSourcePattern(fileName, paperPatterns) || yearOnlyPaperPattern.test(fileName)) {
    return { explicitRole, inferredRole: 'paper', roleSource: 'filename' };
  }

  if (hasSourcePattern(fullPath, answerSheetPatterns)) {
    return { explicitRole, inferredRole: 'answer_sheet', roleSource: 'path' };
  }
  if (hasSourcePattern(fullPath, partialPatterns)) {
    return { explicitRole, inferredRole: 'partial_answer', roleSource: 'path' };
  }
  if (hasSourcePattern(fullPath, answerPatterns)) {
    return { explicitRole, inferredRole: 'answer', roleSource: 'path' };
  }
  if (hasSourcePattern(fullPath, paperPatterns)) {
    return { explicitRole, inferredRole: 'paper', roleSource: 'path' };
  }

  return { explicitRole, inferredRole: 'unknown', roleSource: '' };
}

function manifestSourceBlockReasons(item) {
  const reasons = [];
  if (!item?.eligible) reasons.push('eligible=false');
  if (!VALID_MANIFEST_SOURCE_STATUSES.has(item?.status)) reasons.push(`status=${item?.status || 'missing'}`);
  if (item?.sourceType !== 'official_paper') reasons.push(`sourceType=${item?.sourceType || 'missing'}`);
  const role = inferManifestSourceRole(item);
  if (role.explicitRole && !VALID_SOURCE_ROLES.has(role.explicitRole)) reasons.push(`sourceRole=${role.explicitRole}`);
  if (role.inferredRole === 'answer_sheet') reasons.push('sourceRole=answer_sheet');
  if (role.inferredRole === 'partial_answer') reasons.push('sourceRole=partial_answer');
  if (role.inferredRole === 'unknown') reasons.push('sourceRole=unknown');

  const riskFlags = Array.isArray(item?.riskFlags) ? item.riskFlags : [];
  const blockedFlags = riskFlags.filter((flag) => BLOCKING_SOURCE_RISK_FLAGS.has(flag));
  if (blockedFlags.length) reasons.push(`riskFlags=${blockedFlags.join(',')}`);
  if (item?.legalReview?.publishBlocked) reasons.push('legalReview.publishBlocked=true');
  if (!sourceHash(item)) {
    reasons.push('sourceHash=missing');
  }
  if (!sourceLocation(item)) {
    reasons.push('sourceLocation=missing');
  }

  return reasons;
}

function manifestSourceAnalysis(item) {
  const role = inferManifestSourceRole(item);
  const blockReasons = manifestSourceBlockReasons(item);
  const autoPairEligible = blockReasons.length === 0 && ['paper', 'answer', 'paper_answer'].includes(role.inferredRole);

  return {
    ...role,
    blockReasons,
    autoPairEligible
  };
}

function isAutoPairableManifestSource(item) {
  return manifestSourceAnalysis(item).autoPairEligible;
}

function sourceCandidateSample(item, analysis) {
  return {
    sourceId: item.sourceId || item.id || '',
    status: item.status || '',
    sourceType: item.sourceType || '',
    sourceRole: item.sourceRole || item.source_role || '',
    inferredSourceRole: analysis.inferredRole || '',
    roleSource: analysis.roleSource || '',
    autoPairEligible: analysis.autoPairEligible === true,
    answerEvidenceStatus: item.answerEvidenceStatus || '',
    riskFlags: Array.isArray(item.riskFlags) ? item.riskFlags : [],
    publishBlocked: item.legalReview?.publishBlocked === true,
    blockReasons: analysis.blockReasons || [],
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
    paper: 1,
    answer: 2,
    '': 3,
    unknown: 4,
    partial_answer: 5,
    answer_sheet: 6
  };

  return [
    sample.sourceType === 'official_paper' ? 0 : 1,
    sample.autoPairEligible ? 0 : 1,
    sourceRoleRank[sample.inferredSourceRole || sample.sourceRole || ''] ?? 9,
    sample.publishBlocked ? 1 : 0,
    statusRank[sample.status] ?? 9,
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
        autoPairEligibleCandidateCount: 0,
        paperCandidateCount: 0,
        answerCandidateCount: 0,
        combinedCandidateCount: 0,
        blockReasons: {},
        sampleCandidates: []
      });
      const analysis = manifestSourceAnalysis(item);
      const reasons = analysis.blockReasons;
      slot.candidateCount += 1;
      if (item.sourceType === 'official_paper') slot.officialPaperCandidateCount += 1;
      if (item.legalReview?.publishBlocked) slot.publishBlockedCandidateCount += 1;
      if (analysis.autoPairEligible) slot.autoPairEligibleCandidateCount += 1;
      if (analysis.autoPairEligible && analysis.inferredRole === 'paper') slot.paperCandidateCount += 1;
      if (analysis.autoPairEligible && analysis.inferredRole === 'answer') slot.answerCandidateCount += 1;
      if (analysis.autoPairEligible && analysis.inferredRole === 'paper_answer') slot.combinedCandidateCount += 1;
      for (const reason of reasons) {
        slot.blockReasons[reason] = (slot.blockReasons[reason] || 0) + 1;
      }
      keepBestSourceCandidateSamples(slot.sampleCandidates, sourceCandidateSample(item, analysis));
    }
  }

  return diagnostics;
}

function emptyCandidateDiagnostics() {
  return {
    candidateCount: 0,
    officialPaperCandidateCount: 0,
    publishBlockedCandidateCount: 0,
    autoPairEligibleCandidateCount: 0,
    paperCandidateCount: 0,
    answerCandidateCount: 0,
    combinedCandidateCount: 0,
    blockReasons: {},
    sampleCandidates: []
  };
}

function slotHasAutoPairedOfficialSource(items, track, year) {
  const slotSources = items.filter(
    (item) => candidateSlotMatches(item, track, [year]) && isAutoPairableManifestSource(item)
  );
  const roles = new Set(slotSources.map((item) => manifestSourceAnalysis(item).inferredRole));
  return roles.has('paper_answer') || (roles.has('paper') && roles.has('answer'));
}

function addSlotPairDiagnostics(diagnostics, coverage, tracks) {
  for (const track of tracks) {
    const trackDiagnostics = diagnostics[track] || {};
    const presentYears = new Set(coverage[track]?.presentYears || []);
    for (const [yearText, slot] of Object.entries(trackDiagnostics)) {
      if (presentYears.has(Number(yearText)) || !slot.candidateCount) continue;
      if (slot.autoPairEligibleCandidateCount === 0) continue;
      if (slot.combinedCandidateCount === 0 && slot.paperCandidateCount === 0) {
        slot.blockReasons['slotPair=missing_paper'] = (slot.blockReasons['slotPair=missing_paper'] || 0) + 1;
      }
      if (slot.combinedCandidateCount === 0 && slot.answerCandidateCount === 0) {
        slot.blockReasons['slotPair=missing_answer'] = (slot.blockReasons['slotPair=missing_answer'] || 0) + 1;
      }
    }
  }
}

function loadSourceManifestEvidence({ sourceManifest, tracks, minYear, maxYear }) {
  const requiredYears = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);

  if (!sourceManifest || !fs.existsSync(sourceManifest)) {
    return {
      status: 'missing',
      sourceEvidencePolicy: SOURCE_EVIDENCE_POLICY,
      manifestPath: sourceManifest ? path.relative(PROJECT_ROOT, sourceManifest) : '',
      totalSources: 0,
      eligibleSources: 0,
      publishableOfficialPapers: 0,
      autoPairedOfficialSourceSlots: 0,
      coverageGapCount: tracks.length * requiredYears.length,
      candidateDiagnostics: Object.fromEntries(tracks.map((track) => [track, {}])),
      coverage: Object.fromEntries(
        tracks.map((track) => [track, { presentYears: [], missingYears: requiredYears, coverageRate: 0 }])
      )
    };
  }

  const manifest = readJson(sourceManifest);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const autoPairable = items.filter(isAutoPairableManifestSource);
  const coverage = {};
  const candidateDiagnostics = buildCandidateDiagnostics(items, tracks, requiredYears);

  for (const track of tracks) {
    const presentYears = [
      ...new Set(requiredYears.filter((year) => slotHasAutoPairedOfficialSource(items, track, year)))
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

  addSlotPairDiagnostics(candidateDiagnostics, coverage, tracks);

  return {
    status: 'present',
    sourceEvidencePolicy: SOURCE_EVIDENCE_POLICY,
    manifestPath: path.relative(PROJECT_ROOT, sourceManifest),
    updatedAt: manifest.updatedAt || '',
    totalSources: items.length,
    eligibleSources: items.filter((item) => item?.eligible).length,
    autoPairableOfficialSources: autoPairable.length,
    publishableOfficialPapers: Object.values(coverage).reduce((sum, row) => sum + row.presentYears.length, 0),
    autoPairedOfficialSourceSlots: Object.values(coverage).reduce((sum, row) => sum + row.presentYears.length, 0),
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
      sourceEvidencePolicy: sourceEvidence.sourceEvidencePolicy,
      sourceManifestPublishableOfficialPapers: sourceEvidence.publishableOfficialPapers,
      sourceManifestAutoPairedOfficialSourceSlots: sourceEvidence.autoPairedOfficialSourceSlots,
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
