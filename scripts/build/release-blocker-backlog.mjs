#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const DEFAULT_QUESTION_AUDIT = path.join(PROJECT_ROOT, 'data/question-bank-release-audit.json');
const DEFAULT_FLASHCARD_QUALITY = path.join(PROJECT_ROOT, 'data/flashcard-quality-report.json');
const DEFAULT_EXTERNAL_AUDIT = path.join(PROJECT_ROOT, 'data/release-external-audit.json');
const DEFAULT_WECHAT_SMOKE = path.join(PROJECT_ROOT, 'data/reports/wechat-devtools-release-smoke.json');
const DEFAULT_PROFESSIONAL_INDEX = path.join(PROJECT_ROOT, 'src/config/professional-source-index.json');
const DEFAULT_LOCAL_SOURCE_AUDIT = path.join(PROJECT_ROOT, 'data/raw-inbox/public-course-2025/source-audit.json');
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'data/release-blocker-backlog.json');
const DEFAULT_MARKDOWN = path.join(PROJECT_ROOT, 'data/reports/release-blocker-backlog.md');
const TRACK_ORDER = ['politics', 'english1', 'english2', 'math1', 'math2', 'math3'];
const TRACK_LABELS = {
  politics: '考研政治',
  english1: '英语一',
  english2: '英语二',
  math1: '数学一',
  math2: '数学二',
  math3: '数学三'
};

function parseArgs(argv) {
  const options = {
    questionAudit: DEFAULT_QUESTION_AUDIT,
    flashcardQuality: DEFAULT_FLASHCARD_QUALITY,
    externalAudit: DEFAULT_EXTERNAL_AUDIT,
    wechatSmoke: DEFAULT_WECHAT_SMOKE,
    professionalIndex: DEFAULT_PROFESSIONAL_INDEX,
    localSourceAudit: DEFAULT_LOCAL_SOURCE_AUDIT,
    output: DEFAULT_OUTPUT,
    markdown: DEFAULT_MARKDOWN,
    writeMarkdown: true,
    failOnBlockers: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.split('=');
    const nextValue = inlineValue ?? argv[index + 1];

    if (key === '--question-audit') {
      options.questionAudit = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--flashcard-quality') {
      options.flashcardQuality = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--external-audit') {
      options.externalAudit = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--wechat-smoke') {
      options.wechatSmoke = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--professional-index') {
      options.professionalIndex = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--local-source-audit') {
      options.localSourceAudit = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--output') {
      options.output = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--markdown') {
      options.markdown = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (arg === '--no-markdown') {
      options.writeMarkdown = false;
    } else if (arg === '--fail-on-blockers') {
      options.failOnBlockers = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function usage() {
  console.log(`Usage:
  node scripts/build/release-blocker-backlog.mjs [options]

Options:
  --question-audit <path>      question-bank-release-gate JSON report
  --flashcard-quality <path>   flashcard_quality JSON report
  --external-audit <path>      release-external-gate JSON report
  --wechat-smoke <path>        DevTools smoke JSON report
  --professional-index <path>  professional source index JSON report
  --local-source-audit <path>  local public-course source audit report
  --output <path>              machine-readable backlog JSON output
  --markdown <path>            human-readable backlog markdown output
  --no-markdown                skip writing the human-readable markdown report
  --fail-on-blockers           exit 2 when release blockers remain
`);
}

function existsFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function readJson(filePath, fallback = null) {
  if (!filePath || !existsFile(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function relative(filePath) {
  if (!filePath) return '';
  try {
    return path.relative(PROJECT_ROOT, filePath);
  } catch (_error) {
    return filePath;
  }
}

function trackSortValue(track) {
  const index = TRACK_ORDER.indexOf(track);
  return index === -1 ? 999 : index;
}

function unique(values) {
  return [...new Set(values.filter((value) => String(value ?? '').trim() !== ''))];
}

function sourceRoleSortValue(role) {
  const roleOrder = {
    paper: 0,
    paper_answer: 1,
    answer: 2
  };
  return roleOrder[role] ?? 99;
}

function compareSourceRoles(a, b) {
  const roleRank = sourceRoleSortValue(a) - sourceRoleSortValue(b);
  return roleRank || String(a || '').localeCompare(String(b || ''));
}

function buildSourceEvidenceLookup(questionAudit) {
  const coverage = questionAudit?.sourceEvidence?.coverage;
  const lookup = new Map();
  if (!coverage || typeof coverage !== 'object') return lookup;

  for (const [track, row] of Object.entries(coverage)) {
    for (const year of row?.presentYears || []) {
      lookup.set(`${track}:${year}`, {
        status: 'publishable_source_present',
        presentYears: row.presentYears || [],
        coverageRate: row.coverageRate || 0
      });
    }
    for (const year of row?.missingYears || []) {
      lookup.set(`${track}:${year}`, {
        status: 'missing_publishable_official_source',
        presentYears: row.presentYears || [],
        coverageRate: row.coverageRate || 0
      });
    }
  }

  return lookup;
}

function sourceEvidenceForSlot(sourceEvidenceLookup, track, year) {
  return (
    sourceEvidenceLookup.get(`${track}:${year}`) || {
      status: 'unknown',
      presentYears: [],
      coverageRate: 0
    }
  );
}

function sourceCandidateDiagnostics(questionAudit, track, year) {
  const coverageDiagnostics = questionAudit?.sourceEvidence?.coverage?.[track]?.missingYearDiagnostics?.[year];
  const globalDiagnostics = questionAudit?.sourceEvidence?.candidateDiagnostics?.[track]?.[year];
  return (
    coverageDiagnostics ||
    globalDiagnostics || {
      candidateCount: 0,
      officialPaperCandidateCount: 0,
      publishBlockedCandidateCount: 0,
      blockReasons: {},
      sampleCandidates: []
    }
  );
}

function summarizeSourceDiagnostics(diagnostics) {
  const reasons =
    diagnostics?.blockReasons && typeof diagnostics.blockReasons === 'object' ? diagnostics.blockReasons : {};
  const topReasons = Object.entries(reasons)
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([reason, count]) => `${reason}(${count})`);

  if ((diagnostics?.candidateCount || 0) === 0) {
    return 'source manifest 未发现该槽位候选文件；先同步或登记权威来源。';
  }

  return `source manifest 已发现 ${diagnostics.candidateCount} 个候选，其中 official_paper=${diagnostics.officialPaperCandidateCount || 0}；当前阻断: ${topReasons.join(', ') || '未命中可发布条件'}`;
}

function sourceCandidateSamples(diagnostics, limit = 3) {
  const samples = Array.isArray(diagnostics?.sampleCandidates) ? diagnostics.sampleCandidates : [];
  return samples.slice(0, limit).map((sample) => ({
    sourceId: sample.sourceId || sample.id || '',
    status: sample.status || '',
    sourceType: sample.sourceType || '',
    sourceRole: sample.sourceRole || sample.source_role || '',
    answerEvidenceStatus: sample.answerEvidenceStatus || '',
    riskFlags: Array.isArray(sample.riskFlags) ? sample.riskFlags : [],
    publishBlocked: sample.publishBlocked === true,
    blockReasons: Array.isArray(sample.blockReasons) ? sample.blockReasons : [],
    remotePath: sample.remotePath || '',
    sourceUrl: sample.sourceUrl || ''
  }));
}

function localSourceAuditSampleRank(sample) {
  const roleRank = {
    paper: 0,
    paper_answer: 1,
    answer: 2
  };
  const qualityRank = {
    ready: 0,
    needs_review: 1,
    needs_cleaning: 2,
    needs_passage: 3,
    needs_ocr: 4
  };

  return [
    roleRank[sample.role] ?? 9,
    sample.blockers.length ? 1 : 0,
    sample.textLayer === 'usable' ? 0 : 1,
    qualityRank[sample.quality] ?? 9,
    sample.localPath
  ];
}

function compareLocalSourceAuditSamples(a, b) {
  const aRank = localSourceAuditSampleRank(a);
  const bRank = localSourceAuditSampleRank(b);
  for (let index = 0; index < aRank.length; index += 1) {
    if (aRank[index] === bRank[index]) continue;
    if (typeof aRank[index] === 'number' && typeof bRank[index] === 'number') return aRank[index] - bRank[index];
    return String(aRank[index]).localeCompare(String(bRank[index]));
  }
  return 0;
}

function localSourceAuditSample(source) {
  return {
    id: source.id || '',
    role: source.role || '',
    localPath: source.localPath || '',
    sha256: source.sha256 || '',
    pageCount: Number(source.pageCount || 0),
    textLayer: source.textLayer || '',
    quality: source.quality || '',
    blockers: Array.isArray(source.blockers) ? source.blockers : []
  };
}

function buildLocalSourceAuditLookup(localSourceAudit) {
  const sources = Array.isArray(localSourceAudit?.sources) ? localSourceAudit.sources : [];
  const lookup = new Map();

  for (const source of sources) {
    const track = String(source?.track || '').trim();
    const year = Number(source?.year);
    if (!track || !Number.isInteger(year)) continue;

    const key = `${track}:${year}`;
    const sample = localSourceAuditSample(source);
    const slot = lookup.get(key) || {
      status: 'present',
      sourceCount: 0,
      usableTextLayerCount: 0,
      needsOcrCount: 0,
      blockedCount: 0,
      paperLikeCount: 0,
      answerLikeCount: 0,
      usablePaperLikeCount: 0,
      usableAnswerLikeCount: 0,
      blockedPaperLikeCount: 0,
      blockedAnswerLikeCount: 0,
      roleCounts: {},
      samples: []
    };
    const isPaperLike = ['paper', 'paper_answer'].includes(sample.role);
    const isAnswerLike = ['answer', 'paper_answer'].includes(sample.role);
    const isUsable = sample.textLayer === 'usable' && !sample.blockers.length;

    slot.sourceCount += 1;
    if (sample.textLayer === 'usable') slot.usableTextLayerCount += 1;
    if (sample.textLayer === 'missing_or_sparse' || sample.quality === 'needs_ocr') slot.needsOcrCount += 1;
    if (sample.blockers.length) slot.blockedCount += 1;
    if (isPaperLike) slot.paperLikeCount += 1;
    if (isAnswerLike) slot.answerLikeCount += 1;
    if (isPaperLike && isUsable) slot.usablePaperLikeCount += 1;
    if (isAnswerLike && isUsable) slot.usableAnswerLikeCount += 1;
    if (isPaperLike && sample.blockers.length) slot.blockedPaperLikeCount += 1;
    if (isAnswerLike && sample.blockers.length) slot.blockedAnswerLikeCount += 1;
    if (sample.role) slot.roleCounts[sample.role] = (slot.roleCounts[sample.role] || 0) + 1;
    slot.samples.push(sample);
    slot.samples.sort(compareLocalSourceAuditSamples);
    if (slot.samples.length > 3) slot.samples.length = 3;

    lookup.set(key, slot);
  }

  return lookup;
}

function localSourceAuditYears(localSourceAudit) {
  const years = new Set();
  const addYear = (value) => {
    const year = Number(value);
    if (Number.isInteger(year)) years.add(year);
  };

  for (const source of Array.isArray(localSourceAudit?.sources) ? localSourceAudit.sources : []) {
    addYear(source?.year);
  }

  for (const value of [localSourceAudit?.root, localSourceAudit?.scope, localSourceAudit?.auditRoot]) {
    const text = typeof value === 'string' ? value : '';
    const match = text.match(/(?:public-course-|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/);
    if (match) addYear(match[1]);
  }

  for (const year of Array.isArray(localSourceAudit?.years) ? localSourceAudit.years : []) {
    addYear(year);
  }

  return years;
}

function localSourceAuditForSlot(localSourceAuditLookup, track, year, auditLoaded = false) {
  return (
    localSourceAuditLookup.get(`${track}:${year}`) || {
      status: auditLoaded ? 'missing_for_slot' : 'not_available',
      sourceCount: 0,
      usableTextLayerCount: 0,
      needsOcrCount: 0,
      blockedCount: 0,
      paperLikeCount: 0,
      answerLikeCount: 0,
      usablePaperLikeCount: 0,
      usableAnswerLikeCount: 0,
      blockedPaperLikeCount: 0,
      blockedAnswerLikeCount: 0,
      roleCounts: {},
      samples: []
    }
  );
}

function summarizeLocalSourceCompanions(diagnostics) {
  if (
    !diagnostics ||
    diagnostics.status === 'not_available' ||
    diagnostics.status === 'missing_for_slot' ||
    !diagnostics.sourceCount
  )
    return '';
  const hasUsablePaper = diagnostics.usablePaperLikeCount > 0;
  const hasUsableAnswer = diagnostics.usableAnswerLikeCount > 0;

  if (hasUsablePaper && hasUsableAnswer) return '，companions=paper+answer可读';
  if (diagnostics.needsOcrCount > 0 && diagnostics.usableTextLayerCount === 0) return '，companions=需OCR';
  if (hasUsablePaper && diagnostics.blockedAnswerLikeCount > 0) return '，companions=answer有阻塞';
  if (diagnostics.blockedPaperLikeCount > 0 && hasUsableAnswer) return '，companions=paper有阻塞';
  if (hasUsablePaper && diagnostics.answerLikeCount === 0) return '，companions=缺answer';
  if (diagnostics.paperLikeCount === 0 && hasUsableAnswer) return '，companions=缺paper';
  if (diagnostics.paperLikeCount > 0 && diagnostics.answerLikeCount > 0) return '，companions=paper+answer待修复';
  return '，companions=未成对';
}

function summarizeLocalSourceAudit(diagnostics) {
  if (!diagnostics || diagnostics.status === 'not_available') return '';
  if (diagnostics.status === 'missing_for_slot' || !diagnostics.sourceCount) {
    return 'local source audit 已加载，但该槽位未登记本地 paper/answer 文件。';
  }
  const roles = Object.entries(diagnostics.roleCounts || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([role, count]) => `${role}=${count}`)
    .join(', ');
  return `local source audit 已有 ${diagnostics.sourceCount} 个本地文件，usableTextLayer=${diagnostics.usableTextLayerCount}，needsOcr=${diagnostics.needsOcrCount}，blocked=${diagnostics.blockedCount}${roles ? `，roles: ${roles}` : ''}${summarizeLocalSourceCompanions(diagnostics)}`;
}

function localSourceAuditSamples(diagnostics, limit = 3) {
  return Array.isArray(diagnostics?.samples) ? diagnostics.samples.slice(0, limit) : [];
}

const SOURCE_MANIFEST_REGISTRATION_FIELDS = [
  'eligible=true',
  'status=verified|published',
  'sourceType=official_paper',
  'contentHash|sha256|fileSha256|sourceHash',
  'remotePath|sourceUrl|provenanceUrl',
  'answerEvidenceStatus=matched',
  'legalReview.publishBlocked=false',
  'riskFlags excludes answer_missing,brand_leak,copyright_review_required,ad_or_promo'
];

const VERIFIED_SOURCE_REGISTRY_FIELDS = [
  'localPath',
  'sourceUrl',
  'track',
  'year',
  'sourceType=official_paper',
  'answerEvidenceStatus=matched',
  'expectedSha256',
  'verifiedBy',
  'evidenceNote'
];

const VERIFIED_SOURCE_REGISTRY_HUMAN_FIELDS = ['sourceUrl', 'verifiedBy', 'evidenceNote'];

function humanFieldSortValue(field) {
  const index = VERIFIED_SOURCE_REGISTRY_HUMAN_FIELDS.indexOf(field);
  return index === -1 ? 99 : index;
}

function compareVerifiedSourceRegistryHumanFields(a, b) {
  const fieldRank = humanFieldSortValue(a) - humanFieldSortValue(b);
  return fieldRank || String(a || '').localeCompare(String(b || ''));
}

const SOURCE_MANIFEST_HUMAN_VERIFICATION_STEPS = [
  '核验 localPath 对应文件与 track/year/科目一致，且 paper 与 answer 是同一套试卷。',
  '核验 answer 文件覆盖全部客观题/主观题参考答案；缺题或版本差异时不得标 matched。',
  '核验 sourceUrl/provenanceUrl/remotePath 指向权威或已授权来源，并与 SHA-256 文件一致。',
  '核验 legalReview.publishBlocked=false，riskFlags 不含 answer_missing/brand_leak/copyright_review_required/ad_or_promo。',
  '登记后重新运行 Source Manifest merge、manifest/question-bank/release backlog 门禁。'
];

const SOURCE_MANIFEST_POST_REGISTRATION_COMMANDS = [
  'npm run baidu:sources:verified',
  'npm run baidu:sources:merge',
  'npm run audit:release:backlog',
  'npm run audit:question-bank:release'
];

function subjectForTrack(track) {
  if (track === 'politics') return 'politics';
  if (String(track || '').startsWith('english')) return 'english';
  if (String(track || '').startsWith('math')) return 'math';
  return '';
}

function missingVerifiedSourceRegistryHumanFields(draft) {
  return VERIFIED_SOURCE_REGISTRY_HUMAN_FIELDS.filter((field) => {
    const value = String(draft?.[field] || '').trim();
    if (!value) return true;
    return field === 'evidenceNote' && value.startsWith('DRAFT:');
  });
}

function verifiedSourceRegistryDrafts(localSourceAudit, { track = '', year = '' } = {}) {
  return localSourceAuditSamples(localSourceAudit)
    .filter((sample) => {
      const role = String(sample.role || '');
      return (
        ['paper', 'answer', 'paper_answer'].includes(role) &&
        sample.textLayer === 'usable' &&
        !sample.blockers.length &&
        sample.localPath
      );
    })
    .map((sample) => {
      const draft = {
        id: `${track || 'track'}_${year || 'year'}_${sample.role || 'source'}_draft`,
        localPath: sample.localPath,
        sourceUrl: '',
        remotePath: '',
        expectedSha256: sample.sha256 || '',
        sourceRole: sample.role || '',
        subject: subjectForTrack(track),
        track,
        year,
        sourceType: 'official_paper',
        answerEvidenceStatus: 'matched',
        verifiedBy: '',
        evidenceNote: `DRAFT: human must verify ${sample.role || 'source'} file SHA-256 ${sample.sha256 || 'missing'} against an authorized source before registration.`,
        draftStatus: 'requires_human_verification'
      };
      const missingHumanFields = missingVerifiedSourceRegistryHumanFields(draft);
      return {
        ...draft,
        missingHumanFields,
        humanFieldStatus: missingHumanFields.length ? 'requires_human_input' : 'ready_for_merge'
      };
    });
}

function sourceManifestRegistrationChecklist(localSourceAudit, manifestSamples = [], slot = {}) {
  const diagnostics = localSourceAudit || {};
  const localFileCandidates = localSourceAuditSamples(diagnostics).map((sample) => ({
    role: sample.role || '',
    localPath: sample.localPath || '',
    sha256: sample.sha256 || '',
    textLayer: sample.textLayer || '',
    quality: sample.quality || '',
    blockers: Array.isArray(sample.blockers) ? sample.blockers : []
  }));
  const manifestCandidateIds = (Array.isArray(manifestSamples) ? manifestSamples : [])
    .map((sample) => sample.sourceId || sample.id || '')
    .filter(Boolean);
  const blockers = [];

  if (!localSourceAudit || diagnostics.status === 'not_available') {
    blockers.push('local_source_audit_not_available');
  } else if (diagnostics.status === 'missing_for_slot' || !diagnostics.sourceCount) {
    blockers.push('local_paper_answer_files_missing');
  } else {
    if (diagnostics.needsOcrCount > 0 && diagnostics.usableTextLayerCount === 0) {
      blockers.push('local_files_need_ocr');
    }
    if (diagnostics.usablePaperLikeCount === 0) {
      blockers.push(diagnostics.blockedPaperLikeCount > 0 ? 'local_paper_file_blocked' : 'local_paper_file_missing');
    }
    if (diagnostics.usableAnswerLikeCount === 0) {
      blockers.push(diagnostics.blockedAnswerLikeCount > 0 ? 'local_answer_file_blocked' : 'local_answer_file_missing');
    }
    if (diagnostics.blockedCount > 0 && !blockers.some((blocker) => blocker.includes('_blocked'))) {
      blockers.push('local_files_have_blockers');
    }
  }

  const readyForHumanVerification = blockers.length === 0;

  return {
    status: readyForHumanVerification ? 'ready_for_human_verification' : 'blocked_before_registration',
    readyForHumanVerification,
    requiredManifestFields: SOURCE_MANIFEST_REGISTRATION_FIELDS,
    verifiedSourceRegistryFields: VERIFIED_SOURCE_REGISTRY_FIELDS,
    humanVerificationSteps: readyForHumanVerification ? SOURCE_MANIFEST_HUMAN_VERIFICATION_STEPS : [],
    postRegistrationCommands: readyForHumanVerification ? SOURCE_MANIFEST_POST_REGISTRATION_COMMANDS : [],
    localFileCandidates,
    verifiedSourceRegistryDrafts: readyForHumanVerification ? verifiedSourceRegistryDrafts(diagnostics, slot) : [],
    manifestCandidateIds,
    blockers,
    note: readyForHumanVerification
      ? 'Local paper/answer files are readable and unblocked; human verification is still required before Source Manifest can be marked verified/published.'
      : 'Resolve listed local-source blockers before registering publishable official source evidence.'
  };
}

function sourceEvidenceNextAction(localSourceAudit, afterEvidenceAction = '') {
  const suffix = afterEvidenceAction || '';
  if (!localSourceAudit || localSourceAudit.status === 'not_available') {
    return `在 source manifest 中绑定 verified/published official_paper，补齐 contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched，并确认风险标记不阻断发布。${suffix}`;
  }

  if (localSourceAudit.status === 'missing_for_slot' || !localSourceAudit.sourceCount) {
    return `local source audit 已加载但该槽位没有本地 paper/answer 文件；先补齐本地文件或同步权威来源，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
  }

  if (localSourceAudit.needsOcrCount > 0 && localSourceAudit.usableTextLayerCount === 0) {
    return `local source audit 已有本地文件但缺少可用文本层；先对本地 PDF 做 OCR/文本抽取，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
  }

  if (localSourceAudit.usablePaperLikeCount > 0 && localSourceAudit.usableAnswerLikeCount === 0) {
    if (localSourceAudit.blockedAnswerLikeCount > 0) {
      return `local source audit 已有可读试卷，但答案文件仍有 ${localSourceAudit.blockedAnswerLikeCount} 个阻塞；先补齐或替换完整答案文件，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
    }
    return `local source audit 已有可读试卷但缺少可用答案文件；先补齐 answer/paper_answer companion，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
  }

  if (localSourceAudit.usablePaperLikeCount === 0 && localSourceAudit.usableAnswerLikeCount > 0) {
    if (localSourceAudit.blockedPaperLikeCount > 0) {
      return `local source audit 已有可读答案，但试卷文件仍有 ${localSourceAudit.blockedPaperLikeCount} 个阻塞；先修复试卷文本层或替换完整试卷，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
    }
    return `local source audit 已有可读答案但缺少可用试卷文件；先补齐 paper/paper_answer companion，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
  }

  if (localSourceAudit.blockedCount > 0) {
    return `local source audit 已有本地文件但仍有 ${localSourceAudit.blockedCount} 个阻塞；先处理本地文件 blockers，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
  }

  if (localSourceAudit.usablePaperLikeCount > 0 && localSourceAudit.usableAnswerLikeCount > 0) {
    return `local source audit 已有成对可读 paper/answer 文件；先人工核验文件内容，把 SHA-256 与来源位置登记到 source manifest，并设置 answerEvidenceStatus=matched。${suffix}`;
  }

  if (localSourceAudit.usableTextLayerCount > 0) {
    return `local source audit 已有可读本地文件但 paper/answer 未成对完整；先补齐 companion 文件，再登记 verified/published official_paper、contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched。${suffix}`;
  }

  return `在 source manifest 中绑定 verified/published official_paper，补齐 contentHash、remotePath/sourceUrl、answerEvidenceStatus=matched，并确认风险标记不阻断发布。${suffix}`;
}

function mergeSourceCandidateSamples(current, next, limit = 3) {
  const merged = [];
  const seen = new Set();
  for (const sample of [...(current || []), ...(next || [])]) {
    const key = [sample.sourceId, sample.remotePath, sample.sourceUrl].filter(Boolean).join('|');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(sample);
    if (merged.length >= limit) break;
  }
  return merged;
}

function formatSourceCandidateSample(samples) {
  const sample = Array.isArray(samples) ? samples[0] : null;
  if (!sample) return '';
  const location = sample.remotePath || sample.sourceUrl || '';
  const answerStatus = sample.answerEvidenceStatus || 'missing';
  const sourceRole = sample.sourceRole ? `, role=${sample.sourceRole}` : '';
  const reasons =
    Array.isArray(sample.blockReasons) && sample.blockReasons.length
      ? `, blockers=${sample.blockReasons.join(';')}`
      : '';
  return `${sample.sourceId || 'unknown'} (${sample.status || 'unknown'}/${sample.sourceType || 'unknown'}${sourceRole}, answerEvidenceStatus=${answerStatus}${reasons})${location ? `: ${location}` : ''}`;
}

function formatLocalSourceAuditSample(sample) {
  if (!sample) return '';
  const blockers =
    Array.isArray(sample.blockers) && sample.blockers.length ? `, blockers=${sample.blockers.join(';')}` : '';
  const hash = sample.sha256 ? `, sha256=${sample.sha256}` : '';
  return `${sample.id || 'unknown'} (${sample.role || 'unknown'}, ${sample.textLayer || 'unknown'}, quality=${sample.quality || 'unknown'}${blockers}${hash}): ${sample.localPath || ''}`;
}

function formatLocalSourceAuditSamples(samples) {
  if (!Array.isArray(samples) || !samples.length) return '';
  return samples.map(formatLocalSourceAuditSample).join('<br>');
}

function formatRegistrationChecklist(checklist) {
  if (!checklist) return '';
  const blockers =
    Array.isArray(checklist.blockers) && checklist.blockers.length ? checklist.blockers.join(';') : 'none';
  const steps = Array.isArray(checklist.humanVerificationSteps) ? checklist.humanVerificationSteps.slice(0, 2) : [];
  const commands = Array.isArray(checklist.postRegistrationCommands) ? checklist.postRegistrationCommands : [];
  const drafts = Array.isArray(checklist.verifiedSourceRegistryDrafts) ? checklist.verifiedSourceRegistryDrafts : [];
  return [
    `status=${checklist.status || 'unknown'}`,
    `blockers=${blockers}`,
    drafts.length ? `registryDrafts=${drafts.length}; fill sourceUrl/verifiedBy/evidenceNote before merge` : '',
    steps.length ? `verify=${steps.join(';')}` : '',
    commands.length ? `commands=${commands.join(' -> ')}` : ''
  ]
    .filter(Boolean)
    .join('; ');
}

function mergeLocalSourceAuditSamples(current, next, limit = 3) {
  const merged = [];
  const seen = new Set();
  for (const sample of [...(current || []), ...(next || [])]) {
    const key = [sample.id, sample.localPath, sample.sha256].filter(Boolean).join('|');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(sample);
  }
  merged.sort(compareLocalSourceAuditSamples);
  if (merged.length > limit) merged.length = limit;
  return merged;
}

function createItem({
  id,
  workstream,
  priority = 'P0',
  status = 'blocked',
  title,
  blockerCode,
  track = '',
  year = '',
  bankId = '',
  filePath = '',
  count = 0,
  nextAction,
  evidence = {}
}) {
  return {
    id,
    workstream,
    priority,
    status,
    title,
    blockerCode,
    track,
    trackLabel: TRACK_LABELS[track] || track,
    year,
    bankId,
    filePath,
    count,
    nextAction,
    evidence
  };
}

function buildCoverageItems(
  questionAudit,
  localSourceAuditLookup = new Map(),
  localSourceAuditScopedYears = new Set()
) {
  const tracks = questionAudit?.coverage?.tracks;
  if (!Array.isArray(tracks)) return [];

  const sourceEvidenceLookup = buildSourceEvidenceLookup(questionAudit);
  const items = [];
  for (const track of tracks) {
    const trackId = String(track.track || '');
    for (const year of track.missingYears || []) {
      const sourceEvidence = sourceEvidenceForSlot(sourceEvidenceLookup, trackId, year);
      const candidateDiagnostics = sourceCandidateDiagnostics(questionAudit, trackId, year);
      const localSourceAudit = localSourceAuditForSlot(
        localSourceAuditLookup,
        trackId,
        year,
        localSourceAuditScopedYears.has(Number(year))
      );
      const missingSource = sourceEvidence.status === 'missing_publishable_official_source';
      const candidateSamples = sourceCandidateSamples(candidateDiagnostics);
      items.push(
        createItem({
          id: `coverage_missing:${trackId}:${year}`,
          workstream: 'public_course_coverage',
          blockerCode: 'missing_public_course_bank',
          track: trackId,
          year,
          title: `${TRACK_LABELS[trackId] || trackId} ${year} 缺少可发布题库`,
          nextAction: missingSource
            ? sourceEvidenceNextAction(localSourceAudit, '再进入题卡清洗和 registry 注册。')
            : '已有可发布题源证据时，完成题卡清洗、答案匹配、证据哈希，再按 registry 规范注册题库。',
          evidence: {
            requiredYears: track.requiredYears || [],
            publishedYears: track.publishedYears || [],
            pendingYears: track.pendingYears || [],
            sourceEvidenceStatus: sourceEvidence.status,
            sourceEvidencePresentYears: sourceEvidence.presentYears || [],
            sourceEvidenceCoverageRate: sourceEvidence.coverageRate || 0,
            sourceCandidateSummary: summarizeSourceDiagnostics(candidateDiagnostics),
            sourceCandidateSamples: candidateSamples,
            sourceCandidateDiagnostics: candidateDiagnostics,
            localSourceAuditStatus: localSourceAudit.status,
            localSourceAuditSummary: summarizeLocalSourceAudit(localSourceAudit),
            localSourceAuditSamples: localSourceAuditSamples(localSourceAudit),
            localSourceAuditDiagnostics: localSourceAudit,
            sourceManifestRegistrationChecklist: sourceManifestRegistrationChecklist(
              localSourceAudit,
              candidateSamples,
              {
                track: trackId,
                year
              }
            )
          }
        })
      );
    }

    for (const year of track.pendingYears || []) {
      const sourceEvidence = sourceEvidenceForSlot(sourceEvidenceLookup, trackId, year);
      const candidateDiagnostics = sourceCandidateDiagnostics(questionAudit, trackId, year);
      const localSourceAudit = localSourceAuditForSlot(
        localSourceAuditLookup,
        trackId,
        year,
        localSourceAuditScopedYears.has(Number(year))
      );
      const missingSource = sourceEvidence.status === 'missing_publishable_official_source';
      const candidateSamples = sourceCandidateSamples(candidateDiagnostics);
      items.push(
        createItem({
          id: `coverage_pending:${trackId}:${year}`,
          workstream: 'public_course_coverage',
          blockerCode: 'pending_public_course_bank',
          track: trackId,
          year,
          title: `${TRACK_LABELS[trackId] || trackId} ${year} 有候选来源但未达到发布标准`,
          nextAction: missingSource
            ? sourceEvidenceNextAction(localSourceAudit, '再继续题卡清洗和 registry 发布状态核验。')
            : '沿用现有清洗队列推进，补齐题目结构、答案 evidence、source evidence 和注册状态；未通过前保持禁用或自用草稿。',
          evidence: {
            requiredYears: track.requiredYears || [],
            publishedYears: track.publishedYears || [],
            pendingYears: track.pendingYears || [],
            sourceEvidenceStatus: sourceEvidence.status,
            sourceEvidencePresentYears: sourceEvidence.presentYears || [],
            sourceEvidenceCoverageRate: sourceEvidence.coverageRate || 0,
            sourceCandidateSummary: summarizeSourceDiagnostics(candidateDiagnostics),
            sourceCandidateSamples: candidateSamples,
            sourceCandidateDiagnostics: candidateDiagnostics,
            localSourceAuditStatus: localSourceAudit.status,
            localSourceAuditSummary: summarizeLocalSourceAudit(localSourceAudit),
            localSourceAuditSamples: localSourceAuditSamples(localSourceAudit),
            localSourceAuditDiagnostics: localSourceAudit,
            sourceManifestRegistrationChecklist: sourceManifestRegistrationChecklist(
              localSourceAudit,
              candidateSamples,
              {
                track: trackId,
                year
              }
            )
          }
        })
      );
    }
  }

  return items.sort((a, b) => Number(a.year) - Number(b.year) || trackSortValue(a.track) - trackSortValue(b.track));
}

function buildSourceEvidenceItems(
  questionAudit,
  localSourceAuditLookup = new Map(),
  localSourceAuditScopedYears = new Set()
) {
  const coverage = questionAudit?.sourceEvidence?.coverage;
  if (!coverage || typeof coverage !== 'object') return [];

  const items = [];
  for (const track of TRACK_ORDER) {
    const row = coverage[track];
    if (!row) continue;
    for (const year of row.missingYears || []) {
      const candidateDiagnostics = sourceCandidateDiagnostics(questionAudit, track, year);
      const localSourceAudit = localSourceAuditForSlot(
        localSourceAuditLookup,
        track,
        year,
        localSourceAuditScopedYears.has(Number(year))
      );
      const candidateSamples = sourceCandidateSamples(candidateDiagnostics);
      items.push(
        createItem({
          id: `source_evidence_missing:${track}:${year}`,
          workstream: 'source_manifest_evidence',
          blockerCode: 'missing_publishable_official_source',
          track,
          year,
          title: `${TRACK_LABELS[track] || track} ${year} 缺少可发布官方题源证据`,
          nextAction: sourceEvidenceNextAction(localSourceAudit),
          evidence: {
            presentYears: row.presentYears || [],
            coverageRate: row.coverageRate || 0,
            sourceCandidateSummary: summarizeSourceDiagnostics(candidateDiagnostics),
            sourceCandidateSamples: candidateSamples,
            sourceCandidateDiagnostics: candidateDiagnostics,
            localSourceAuditStatus: localSourceAudit.status,
            localSourceAuditSummary: summarizeLocalSourceAudit(localSourceAudit),
            localSourceAuditSamples: localSourceAuditSamples(localSourceAudit),
            localSourceAuditDiagnostics: localSourceAudit,
            sourceManifestRegistrationChecklist: sourceManifestRegistrationChecklist(
              localSourceAudit,
              candidateSamples,
              {
                track,
                year
              }
            )
          }
        })
      );
    }
  }

  return items.sort((a, b) => Number(a.year) - Number(b.year) || trackSortValue(a.track) - trackSortValue(b.track));
}

function buildEnabledBankEvidenceItems(questionAudit) {
  const blockedBanks = questionAudit?.answerEvidence?.blockedBanks;
  if (!Array.isArray(blockedBanks)) return [];

  return blockedBanks.map((bank) => {
    const blockedCards = Array.isArray(bank.blockedCards) ? bank.blockedCards : [];
    const missingFields = unique(blockedCards.flatMap((card) => card.missingFields || []));
    return createItem({
      id: `enabled_bank_evidence:${bank.bankId}`,
      workstream: 'enabled_bank_evidence',
      blockerCode: 'enabled_bank_missing_card_evidence',
      track: bank.track || '',
      year: bank.year || '',
      bankId: bank.bankId || '',
      filePath: bank.filePath || '',
      count: blockedCards.length,
      title: `${bank.name || bank.bankId} 已开放但缺发布证据`,
      nextAction:
        '不要降级门禁；为每张题卡补 sourceEvidenceId、answerEvidenceStatus=matched、questionTextHash、answerTextHash，并能追溯到权威来源。',
      evidence: {
        missingFields,
        sampleBlockedCards: blockedCards.slice(0, 5)
      }
    });
  });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildInputReportItems({ questionAudit, flashcardQuality, externalAudit }) {
  const reports = [
    {
      id: 'input_report:question_audit',
      label: '题库发布审计报告',
      blockerCode: 'question_bank_release_audit_missing_or_incomplete',
      command: 'npm run audit:question-bank:report',
      reportPath: DEFAULT_QUESTION_AUDIT,
      ready:
        isObject(questionAudit?.summary) &&
        isObject(questionAudit?.releaseReadiness) &&
        Array.isArray(questionAudit?.coverage?.tracks),
      requiredFields: ['summary', 'releaseReadiness', 'coverage.tracks']
    },
    {
      id: 'input_report:flashcard_quality',
      label: '清洗题卡质量报告',
      blockerCode: 'flashcard_quality_report_missing_or_incomplete',
      command: 'npm run baidu:flashcards:quality',
      reportPath: DEFAULT_FLASHCARD_QUALITY,
      ready:
        isObject(flashcardQuality?.summary) &&
        isObject(flashcardQuality?.releaseReadiness) &&
        Array.isArray(flashcardQuality?.files),
      requiredFields: ['summary', 'releaseReadiness', 'files']
    },
    {
      id: 'input_report:external_audit',
      label: '外部发布审计报告',
      blockerCode: 'external_release_audit_missing_or_incomplete',
      command: 'npm run audit:release:external:report',
      reportPath: DEFAULT_EXTERNAL_AUDIT,
      ready:
        isObject(externalAudit?.summary) &&
        isObject(externalAudit?.releaseReadiness) &&
        isObject(externalAudit?.sections),
      requiredFields: ['summary', 'releaseReadiness', 'sections']
    }
  ];

  return reports
    .filter((report) => !report.ready)
    .map((report) =>
      createItem({
        id: report.id,
        workstream: 'release_audit_inputs',
        blockerCode: report.blockerCode,
        filePath: relative(report.reportPath),
        count: 1,
        title: `${report.label}缺失或结构不完整`,
        nextAction: `先运行 ${report.command} 生成完整输入报告，再运行 npm run audit:release:backlog；不要把缺失输入误判为 0/0 发布状态。`,
        evidence: {
          requiredFields: report.requiredFields,
          report: relative(report.reportPath)
        }
      })
    );
}

function buildFlashcardQualityItems(flashcardQuality) {
  const files = Array.isArray(flashcardQuality?.files) ? flashcardQuality.files : [];
  return files
    .filter((file) => file.status !== 'passed')
    .map((file) => {
      const blockedCards = Array.isArray(file.blockedCards) ? file.blockedCards : [];
      const missingFields = unique(blockedCards.flatMap((card) => card.missingFields || []));
      return createItem({
        id: `flashcard_quality:${file.filePath}`,
        workstream: 'cleaned_flashcard_quality',
        blockerCode: 'cleaned_flashcard_not_promotable',
        filePath: file.filePath || '',
        count: blockedCards.length,
        title: `${file.filePath} 不能提升为正式题库`,
        nextAction:
          '继续使用 answer_evidence_repair、english_passage_repair、flashcard_quality 的现有流程修复；证据状态为 candidate 时不得公开发布。',
        evidence: {
          cardCount: file.cardCount || 0,
          missingAnswerCount: file.missingAnswerCount || 0,
          sourceEvidenceBlockerCount: file.sourceEvidenceBlockerCount || 0,
          gradingBlockerCount: file.gradingBlockerCount || 0,
          publicationBlockers: file.publicationBlockers || [],
          missingFields,
          sampleBlockedCards: blockedCards.slice(0, 5)
        }
      });
    });
}

function buildExternalItems(externalAudit, wechatSmoke) {
  const items = [];
  const sections = externalAudit?.sections && typeof externalAudit.sections === 'object' ? externalAudit.sections : {};

  for (const [sectionName, section] of Object.entries(sections)) {
    const blockers = Array.isArray(section.blockers) ? section.blockers : [];
    blockers.forEach((blocker, index) => {
      items.push(
        createItem({
          id: `external:${sectionName}:${blocker.code || index}`,
          workstream: sectionName === 'wechatDevice' ? 'wechat_real_device_evidence' : 'external_release_evidence',
          blockerCode: blocker.code || `${sectionName}_blocked`,
          title: blocker.message || `${sectionName} release blocker`,
          filePath: blocker.path || '',
          count: 1,
          nextAction:
            sectionName === 'wechatDevice'
              ? '在真实手机微信扫码预览后记录设备型号、微信版本、登录/游客态、刷题闭环、结果页和预览码归档；保持 Status: partial，直到证据真实通过。'
              : '补齐该外部门禁要求的真实生产证据；不要把占位文本写成 passed。',
          evidence: {
            section: sectionName,
            blocker,
            devtoolsSmokeStatus: wechatSmoke?.status || '',
            devtoolsSmokeReport: existsFile(DEFAULT_WECHAT_SMOKE) ? relative(DEFAULT_WECHAT_SMOKE) : ''
          }
        })
      );
    });
  }

  return items;
}

function buildWechatDevtoolsSmokeItems(wechatSmoke) {
  if (wechatSmoke?.status === 'passed') return [];

  const blockedSteps = Array.isArray(wechatSmoke?.steps)
    ? wechatSmoke.steps.filter((step) => step?.status === 'blocked')
    : [];
  const sampleStep = blockedSteps[0] || null;
  const isMissing = !wechatSmoke;
  const errorText = String(sampleStep?.error || '').trim();

  return [
    createItem({
      id: isMissing ? 'wechat_devtools_smoke:missing_report' : 'wechat_devtools_smoke:not_passed',
      workstream: 'wechat_devtools_smoke',
      blockerCode: isMissing ? 'wechat_devtools_smoke_missing' : 'wechat_devtools_smoke_not_passed',
      title: isMissing
        ? '缺少 WeChat DevTools 自动化 smoke 报告'
        : `WeChat DevTools 自动化 smoke 未通过${sampleStep?.name ? `: ${sampleStep.name}` : ''}`,
      count: blockedSteps.length || 1,
      nextAction: errorText.includes('listen EPERM')
        ? '当前执行环境禁止本地端口监听；在允许 WeChat DevTools 自动化端口的本机环境重新运行 npm run smoke:wechat:devtools。'
        : '重新构建 mp-weixin 后运行 npm run smoke:wechat:devtools；若页面断言失败，按失败步骤修复小程序可用性。',
      evidence: {
        status: wechatSmoke?.status || 'missing',
        startedAt: wechatSmoke?.startedAt || '',
        finishedAt: wechatSmoke?.finishedAt || '',
        sampleBlockedSteps: blockedSteps.slice(0, 5),
        report: existsFile(DEFAULT_WECHAT_SMOKE) ? relative(DEFAULT_WECHAT_SMOKE) : ''
      }
    })
  ];
}

function buildProfessionalWorkstream(professionalIndex) {
  if (!professionalIndex?.summary) return null;
  const embeddedItems =
    professionalIndex.summary.embeddedItems ??
    (Array.isArray(professionalIndex.items) ? professionalIndex.items.length : 0);
  const fullIndexItems = professionalIndex.summary.eligibleIndexSources || embeddedItems;
  const summary = {
    ...professionalIndex.summary,
    publicationMode: professionalIndex.summary.publicationMode || 'index_only',
    embeddedItems,
    fullIndexItems
  };
  return {
    id: 'professional_course_index',
    status: 'index_only_ready',
    releaseBlocking: false,
    summary,
    nextAction: '按用户目标专业和机构选择继续清洗；本次发布仅承诺索引和筛选，不承诺 14250 个专业课来源全部题卡化。'
  };
}

function groupByWorkstream(items) {
  const grouped = {};
  for (const item of items) {
    grouped[item.workstream] ||= {
      status: 'blocked',
      itemCount: 0,
      p0Count: 0,
      sampleItems: []
    };
    grouped[item.workstream].itemCount += 1;
    if (item.priority === 'P0') grouped[item.workstream].p0Count += 1;
    if (grouped[item.workstream].sampleItems.length < 5) {
      grouped[item.workstream].sampleItems.push(item.id);
    }
  }
  return grouped;
}

function sortBacklogItems(items) {
  const workstreamOrder = {
    release_audit_inputs: 0,
    enabled_bank_evidence: 1,
    wechat_real_device_evidence: 2,
    wechat_devtools_smoke: 3,
    public_course_coverage: 4,
    source_manifest_evidence: 5,
    cleaned_flashcard_quality: 6,
    external_release_evidence: 7
  };
  return [...items].sort((a, b) => {
    const workstreamDelta = (workstreamOrder[a.workstream] ?? 99) - (workstreamOrder[b.workstream] ?? 99);
    if (workstreamDelta) return workstreamDelta;
    return Number(a.year || 9999) - Number(b.year || 9999) || trackSortValue(a.track) - trackSortValue(b.track);
  });
}

function publicCourseSlotKey(item) {
  if (!item?.track || !item?.year) return '';
  return `${item.track}:${item.year}`;
}

function publicCourseBlockerItems(items) {
  return items.filter(
    (item) => item.workstream === 'public_course_coverage' || item.workstream === 'source_manifest_evidence'
  );
}

function countUniquePublicCourseBlockedSlots(items) {
  return new Set(publicCourseBlockerItems(items).map(publicCourseSlotKey).filter(Boolean)).size;
}

function publicCourseCoverageItems(items) {
  return items.filter(
    (item) =>
      item.workstream === 'public_course_coverage' &&
      ['pending_public_course_bank', 'missing_public_course_bank'].includes(item.blockerCode)
  );
}

function publicCourseSlotStatus(item) {
  if (item?.blockerCode === 'pending_public_course_bank') return 'pending';
  if (item?.blockerCode === 'missing_public_course_bank') return 'missing';
  return 'source_evidence_missing';
}

function localSourceActionabilityRank(slot) {
  const diagnostics = slot?.localSourceAuditDiagnostics || {};
  if (diagnostics.usablePaperLikeCount > 0 && diagnostics.usableAnswerLikeCount > 0) return 0;
  if (diagnostics.usablePaperLikeCount > 0 && diagnostics.blockedAnswerLikeCount > 0) return 1;
  if (diagnostics.usablePaperLikeCount > 0 || diagnostics.usableAnswerLikeCount > 0) return 2;
  if (diagnostics.needsOcrCount > 0 || diagnostics.blockedCount > 0) return 3;
  if (slot?.localSourceAuditStatus === 'missing_for_slot') return 4;
  return 5;
}

function publicCourseRecommendationSort(a, b) {
  const blockerRank = {
    pending_public_course_bank: 0,
    pending: 0,
    missing_public_course_bank: 1,
    missing: 1,
    source_evidence_missing: 2,
    missing_publishable_official_source: 2
  };
  const aRankKey = a.blockerCode || a.slotStatus;
  const bRankKey = b.blockerCode || b.slotStatus;
  const blockerDelta = (blockerRank[aRankKey] ?? 99) - (blockerRank[bRankKey] ?? 99);
  if (blockerDelta) return blockerDelta;

  const actionabilityDelta = localSourceActionabilityRank(a) - localSourceActionabilityRank(b);
  if (actionabilityDelta) return actionabilityDelta;

  const bothPending =
    [a.blockerCode, a.slotStatus].includes('pending_public_course_bank') ||
    [a.blockerCode, a.slotStatus].includes('pending');
  const bothPendingB =
    [b.blockerCode, b.slotStatus].includes('pending_public_course_bank') ||
    [b.blockerCode, b.slotStatus].includes('pending');
  if (bothPending && bothPendingB) {
    return Number(b.year || 0) - Number(a.year || 0) || trackSortValue(a.track) - trackSortValue(b.track);
  }

  return Number(a.year || 9999) - Number(b.year || 9999) || trackSortValue(a.track) - trackSortValue(b.track);
}

function publicCourseRecommendationBucket(item) {
  const blockerRank = {
    pending_public_course_bank: 0,
    pending: 0,
    missing_public_course_bank: 1,
    missing: 1,
    source_evidence_missing: 2,
    missing_publishable_official_source: 2
  };
  const blockerBucket = blockerRank[item?.blockerCode || item?.slotStatus] ?? 99;
  return blockerBucket * 10 + localSourceActionabilityRank(item);
}

function balancedPublicCourseSlotRecommendations(slots, limit = 24) {
  const buckets = new Map();
  for (const slot of [...slots].sort(publicCourseRecommendationSort)) {
    const bucket = publicCourseRecommendationBucket(slot);
    const track = slot.track || '__unknown__';
    const tracks = buckets.get(bucket) || new Map();
    tracks.set(track, [...(tracks.get(track) || []), slot]);
    buckets.set(bucket, tracks);
  }

  const recommendations = [];
  for (const bucket of [...buckets.keys()].sort((a, b) => a - b)) {
    const tracks = buckets.get(bucket);
    const trackOrder = [
      ...TRACK_ORDER.filter((track) => tracks.has(track)),
      ...[...tracks.keys()].filter((track) => !TRACK_ORDER.includes(track)).sort()
    ];

    while (recommendations.length < limit && trackOrder.some((track) => (tracks.get(track) || []).length > 0)) {
      for (const track of trackOrder) {
        const rows = tracks.get(track) || [];
        if (!rows.length) continue;
        recommendations.push(rows.shift());
        if (recommendations.length >= limit) break;
      }
    }

    if (recommendations.length >= limit) break;
  }

  return recommendations;
}

function nextPublicCourseCoverageItems(items, limit = 24) {
  return publicCourseCoverageItems(items).sort(publicCourseRecommendationSort).slice(0, limit);
}

function buildPublicCourseSlotBacklogItems(items) {
  const slots = new Map();

  for (const item of publicCourseBlockerItems(items)) {
    const key = publicCourseSlotKey(item);
    if (!key) continue;

    const slot = slots.get(key) || {
      slotKey: key,
      track: item.track,
      trackLabel: item.trackLabel || TRACK_LABELS[item.track] || item.track,
      year: item.year,
      blockerCode: '',
      slotStatus: 'source_evidence_missing',
      blockers: [],
      blockerItemIds: [],
      sourceEvidenceStatus: 'unknown',
      sourceCandidateSummary: '',
      sourceCandidateSamples: [],
      localSourceAuditStatus: 'not_available',
      localSourceAuditSummary: '',
      localSourceAuditSamples: [],
      localSourceAuditDiagnostics: null,
      sourceManifestRegistrationChecklist: null,
      prerequisiteBlockers: [],
      coverageAction: '',
      sourceEvidenceAction: '',
      nextAction: ''
    };

    slot.blockers = unique([...slot.blockers, item.blockerCode]);
    slot.blockerItemIds = unique([...slot.blockerItemIds, item.id]);

    if (item.workstream === 'public_course_coverage') {
      slot.blockerCode = item.blockerCode;
      slot.slotStatus = publicCourseSlotStatus(item);
      slot.coverageAction = item.nextAction || slot.coverageAction;
      slot.sourceEvidenceStatus = item.evidence?.sourceEvidenceStatus || slot.sourceEvidenceStatus;
      slot.sourceCandidateSummary = item.evidence?.sourceCandidateSummary || slot.sourceCandidateSummary;
      slot.sourceCandidateSamples = mergeSourceCandidateSamples(
        slot.sourceCandidateSamples,
        item.evidence?.sourceCandidateSamples
      );
      slot.localSourceAuditStatus = item.evidence?.localSourceAuditStatus || slot.localSourceAuditStatus;
      slot.localSourceAuditSummary = item.evidence?.localSourceAuditSummary || slot.localSourceAuditSummary;
      slot.localSourceAuditSamples = mergeLocalSourceAuditSamples(
        slot.localSourceAuditSamples,
        item.evidence?.localSourceAuditSamples
      );
      slot.localSourceAuditDiagnostics = item.evidence?.localSourceAuditDiagnostics || slot.localSourceAuditDiagnostics;
      slot.sourceManifestRegistrationChecklist =
        item.evidence?.sourceManifestRegistrationChecklist || slot.sourceManifestRegistrationChecklist;
    }

    if (item.workstream === 'source_manifest_evidence') {
      slot.blockerCode ||= item.blockerCode;
      slot.sourceEvidenceStatus = 'missing_publishable_official_source';
      slot.sourceEvidenceAction = item.nextAction || slot.sourceEvidenceAction;
      slot.sourceCandidateSummary = item.evidence?.sourceCandidateSummary || slot.sourceCandidateSummary;
      slot.sourceCandidateSamples = mergeSourceCandidateSamples(
        slot.sourceCandidateSamples,
        item.evidence?.sourceCandidateSamples
      );
      slot.localSourceAuditStatus = item.evidence?.localSourceAuditStatus || slot.localSourceAuditStatus;
      slot.localSourceAuditSummary = item.evidence?.localSourceAuditSummary || slot.localSourceAuditSummary;
      slot.localSourceAuditSamples = mergeLocalSourceAuditSamples(
        slot.localSourceAuditSamples,
        item.evidence?.localSourceAuditSamples
      );
      slot.localSourceAuditDiagnostics = item.evidence?.localSourceAuditDiagnostics || slot.localSourceAuditDiagnostics;
      slot.sourceManifestRegistrationChecklist =
        item.evidence?.sourceManifestRegistrationChecklist || slot.sourceManifestRegistrationChecklist;
      slot.prerequisiteBlockers = unique([...slot.prerequisiteBlockers, item.blockerCode]);
    }

    if (slot.sourceEvidenceStatus === 'missing_publishable_official_source') {
      slot.prerequisiteBlockers = unique([...slot.prerequisiteBlockers, 'missing_publishable_official_source']);
    }
    slot.nextAction = slot.prerequisiteBlockers.length
      ? slot.sourceEvidenceAction || slot.coverageAction
      : slot.coverageAction || slot.sourceEvidenceAction;

    slots.set(key, slot);
  }

  return Array.from(slots.values()).sort(publicCourseRecommendationSort);
}

function localSourceReadinessStatus(slot) {
  const diagnostics = slot?.localSourceAuditDiagnostics || {};
  if (!slot || slot.localSourceAuditStatus === 'not_available') return 'not_available';
  if (slot.localSourceAuditStatus === 'missing_for_slot' || !diagnostics.sourceCount) return 'missing_local_files';
  if (diagnostics.usablePaperLikeCount > 0 && diagnostics.usableAnswerLikeCount > 0) return 'paired_readable';
  if (diagnostics.needsOcrCount > 0 && diagnostics.usableTextLayerCount === 0) return 'needs_ocr';
  if (diagnostics.usablePaperLikeCount > 0 && diagnostics.blockedAnswerLikeCount > 0) return 'answer_blocked';
  if (diagnostics.blockedPaperLikeCount > 0 && diagnostics.usableAnswerLikeCount > 0) return 'paper_blocked';
  if (diagnostics.usablePaperLikeCount > 0 && diagnostics.answerLikeCount === 0) return 'missing_answer';
  if (diagnostics.paperLikeCount === 0 && diagnostics.usableAnswerLikeCount > 0) return 'missing_paper';
  if (diagnostics.blockedCount > 0) return 'blocked_local_files';
  if (diagnostics.usableTextLayerCount > 0) return 'unpaired_readable';
  return 'unknown';
}

function summarizePublicCourseLocalSources(slots) {
  const summary = {
    totalBlockedSlots: slots.length,
    pairedReadableSlots: 0,
    answerBlockedSlots: 0,
    paperBlockedSlots: 0,
    missingAnswerSlots: 0,
    missingPaperSlots: 0,
    needsOcrSlots: 0,
    blockedLocalFileSlots: 0,
    unpairedReadableSlots: 0,
    missingLocalFileSlots: 0,
    notAvailableSlots: 0,
    unknownSlots: 0
  };

  for (const slot of slots) {
    const status = localSourceReadinessStatus(slot);
    if (status === 'paired_readable') summary.pairedReadableSlots += 1;
    else if (status === 'answer_blocked') summary.answerBlockedSlots += 1;
    else if (status === 'paper_blocked') summary.paperBlockedSlots += 1;
    else if (status === 'missing_answer') summary.missingAnswerSlots += 1;
    else if (status === 'missing_paper') summary.missingPaperSlots += 1;
    else if (status === 'needs_ocr') summary.needsOcrSlots += 1;
    else if (status === 'blocked_local_files') summary.blockedLocalFileSlots += 1;
    else if (status === 'unpaired_readable') summary.unpairedReadableSlots += 1;
    else if (status === 'missing_local_files') summary.missingLocalFileSlots += 1;
    else if (status === 'not_available') summary.notAvailableSlots += 1;
    else summary.unknownSlots += 1;
  }

  return summary;
}

function sourceManifestHumanRegistrationQueueItem(slot) {
  const checklist = slot?.sourceManifestRegistrationChecklist;
  const drafts = Array.isArray(checklist?.verifiedSourceRegistryDrafts) ? checklist.verifiedSourceRegistryDrafts : [];
  if (!checklist?.readyForHumanVerification || !drafts.length) return null;
  const registryDrafts = drafts.map((draft) => ({
    id: draft.id || '',
    sourceRole: draft.sourceRole || '',
    localPath: draft.localPath || '',
    expectedSha256: draft.expectedSha256 || '',
    sourceUrl: draft.sourceUrl || '',
    remotePath: draft.remotePath || '',
    verifiedBy: draft.verifiedBy || '',
    evidenceNote: draft.evidenceNote || '',
    draftStatus: draft.draftStatus || '',
    missingHumanFields: Array.isArray(draft.missingHumanFields)
      ? draft.missingHumanFields
      : missingVerifiedSourceRegistryHumanFields(draft),
    humanFieldStatus: draft.humanFieldStatus || ''
  }));
  const missingHumanFields = Array.from(new Set(registryDrafts.flatMap((draft) => draft.missingHumanFields))).sort(
    compareVerifiedSourceRegistryHumanFields
  );
  const missingHumanFieldInstances = registryDrafts.flatMap((draft) =>
    draft.missingHumanFields.map((field) => ({
      draftId: draft.id,
      sourceRole: draft.sourceRole,
      localPath: draft.localPath,
      field
    }))
  );

  return {
    slotKey: slot.slotKey,
    track: slot.track,
    trackLabel: slot.trackLabel,
    year: slot.year,
    slotStatus: slot.slotStatus,
    blockerCode: slot.blockerCode,
    draftCount: drafts.length,
    sourceRoles: Array.from(new Set(drafts.map((draft) => draft.sourceRole).filter(Boolean))).sort(compareSourceRoles),
    localPaths: drafts.map((draft) => draft.localPath).filter(Boolean),
    expectedSha256Values: drafts.map((draft) => draft.expectedSha256).filter(Boolean),
    registryDrafts,
    localFileDrafts: registryDrafts.map((draft) => ({
      sourceRole: draft.sourceRole,
      localPath: draft.localPath,
      expectedSha256: draft.expectedSha256
    })),
    requiredHumanFields: VERIFIED_SOURCE_REGISTRY_HUMAN_FIELDS,
    missingHumanFields,
    missingHumanFieldInstances,
    missingHumanFieldCount: missingHumanFieldInstances.length,
    manifestCandidateIds: Array.isArray(checklist.manifestCandidateIds) ? checklist.manifestCandidateIds : [],
    postRegistrationCommands: Array.isArray(checklist.postRegistrationCommands)
      ? checklist.postRegistrationCommands
      : [],
    nextAction:
      '人工核验 paper/answer 文件、授权来源与 SHA-256 后，补齐 verified source registry 草稿字段并重新运行 Source Manifest merge 与发布门禁。'
  };
}

function buildSourceManifestHumanRegistrationQueue(slots, limit = 12) {
  const readySlots = slots.map(sourceManifestHumanRegistrationQueueItem).filter(Boolean);
  const registryDraftCount = readySlots.reduce((total, slot) => total + slot.draftCount, 0);
  const missingHumanFieldCount = readySlots.reduce((total, slot) => total + (slot.missingHumanFieldCount || 0), 0);
  const missingHumanFieldInstances = readySlots.flatMap((slot) => slot.missingHumanFieldInstances || []);

  return {
    readySlotCount: readySlots.length,
    registryDraftCount,
    missingHumanFieldCount,
    missingHumanFieldInstances,
    nextReadySlot: readySlots[0] || null,
    slots: readySlots.slice(0, limit)
  };
}

function sourceManifestHumanRegistrationQueueSummary(queue) {
  const nextMissingHumanFieldInstances = (queue.nextReadySlot?.missingHumanFieldInstances || []).map(
    (item) => `${item.sourceRole || item.draftId || 'source'}.${item.field}`
  );
  return {
    readySlotCount: queue.readySlotCount,
    registryDraftCount: queue.registryDraftCount,
    missingHumanFieldCount: queue.missingHumanFieldCount,
    nextSlotKey: queue.nextReadySlot?.slotKey || '',
    nextDraftCount: queue.nextReadySlot?.draftCount || 0,
    nextSourceRoles: queue.nextReadySlot?.sourceRoles || [],
    nextMissingHumanFields: queue.nextReadySlot?.missingHumanFields || [],
    nextMissingHumanFieldInstances
  };
}

export function buildReleaseBlockerBacklog({
  questionAudit = null,
  flashcardQuality = null,
  externalAudit = null,
  wechatSmoke = null,
  professionalIndex = null,
  localSourceAudit = null,
  generatedAt = new Date().toISOString()
} = {}) {
  const localSourceAuditLookup = buildLocalSourceAuditLookup(localSourceAudit);
  const localSourceAuditScopedYears = localSourceAuditYears(localSourceAudit);
  const items = sortBacklogItems([
    ...buildInputReportItems({ questionAudit, flashcardQuality, externalAudit }),
    ...buildEnabledBankEvidenceItems(questionAudit),
    ...buildExternalItems(externalAudit, wechatSmoke),
    ...buildWechatDevtoolsSmokeItems(wechatSmoke),
    ...buildCoverageItems(questionAudit, localSourceAuditLookup, localSourceAuditScopedYears),
    ...buildSourceEvidenceItems(questionAudit, localSourceAuditLookup, localSourceAuditScopedYears),
    ...buildFlashcardQualityItems(flashcardQuality)
  ]);
  const professionalWorkstream = buildProfessionalWorkstream(professionalIndex);
  const questionCanPublish = questionAudit?.releaseReadiness?.canPublish === true;
  const flashcardCanPromote = flashcardQuality?.releaseReadiness?.canPromoteToPublic === true;
  const externalCanPublish = externalAudit?.releaseReadiness?.canPublish === true;
  const publicCourseBlockerItemCount = publicCourseBlockerItems(items).length;
  const publicCourseBlockedSlotCount = countUniquePublicCourseBlockedSlots(items);
  const publicCourseSlotBacklog = buildPublicCourseSlotBacklogItems(items);
  const publicCourseLocalSourceSummary = summarizePublicCourseLocalSources(publicCourseSlotBacklog);
  const sourceManifestHumanRegistrationQueue = buildSourceManifestHumanRegistrationQueue(publicCourseSlotBacklog);

  return {
    version: 1,
    generatedAt,
    verdict:
      items.length === 0 && questionCanPublish && flashcardCanPromote && externalCanPublish ? 'passed' : 'blocked',
    sources: {
      questionAudit: relative(DEFAULT_QUESTION_AUDIT),
      flashcardQuality: relative(DEFAULT_FLASHCARD_QUALITY),
      externalAudit: relative(DEFAULT_EXTERNAL_AUDIT),
      wechatSmoke: relative(DEFAULT_WECHAT_SMOKE),
      professionalIndex: relative(DEFAULT_PROFESSIONAL_INDEX),
      localSourceAudit: relative(DEFAULT_LOCAL_SOURCE_AUDIT)
    },
    summary: {
      canPublish: items.length === 0 && questionCanPublish && flashcardCanPromote && externalCanPublish,
      blockerItemCount: items.length,
      p0Count: items.filter((item) => item.priority === 'P0').length,
      publicCourseRequiredSlots: questionAudit?.summary?.requiredSlots || 0,
      publicCoursePublishedSlots: questionAudit?.summary?.publishedSlots || 0,
      publicCoursePendingSlots: questionAudit?.summary?.pendingSlots || 0,
      publicCoursePendingCoverageBlockers: questionAudit?.summary?.pendingCoverageBlockerCount || 0,
      publicCourseCoverageGaps: questionAudit?.summary?.coverageGapCount || 0,
      publicCourseBlockerItemCount,
      publicCourseBlockedSlotCount,
      publicCourseLocalSourceSummary,
      sourceManifestHumanRegistrationQueue: sourceManifestHumanRegistrationQueueSummary(
        sourceManifestHumanRegistrationQueue
      ),
      sourceManifestPublishableOfficialPapers: questionAudit?.summary?.sourceManifestPublishableOfficialPapers || 0,
      sourceEvidenceGaps: questionAudit?.summary?.sourceManifestCoverageGapCount || 0,
      enabledBankAnswerEvidenceBlockers: questionAudit?.summary?.answerEvidenceBlockerCount || 0,
      cleanedFlashcardBlockers: flashcardQuality?.summary?.blockerCount || 0,
      externalBlockers: externalAudit?.summary?.blockerCount || 0,
      wechatDevtoolsSmokeStatus: wechatSmoke?.status || 'missing',
      professionalIndexMode: professionalWorkstream?.summary?.publicationMode || 'not_available'
    },
    workstreams: {
      ...groupByWorkstream(items),
      ...(professionalWorkstream ? { professional_course_index: professionalWorkstream } : {})
    },
    publicCourseSlotBacklog,
    sourceManifestHumanRegistrationQueue,
    nextBalancedPublicCourseSlots: balancedPublicCourseSlotRecommendations(publicCourseSlotBacklog, 24).map(
      ({
        blockerItemIds,
        blockerCode,
        slotKey,
        slotStatus,
        track,
        trackLabel,
        year,
        sourceEvidenceStatus,
        sourceCandidateSummary,
        sourceCandidateSamples,
        localSourceAuditStatus,
        localSourceAuditSummary,
        localSourceAuditSamples,
        sourceManifestRegistrationChecklist,
        prerequisiteBlockers,
        nextAction
      }) => ({
        id: blockerItemIds.find((id) => id.startsWith('coverage_')) || blockerItemIds[0] || `slot:${slotKey}`,
        track,
        trackLabel,
        year,
        blockerCode,
        slotStatus,
        sourceEvidenceStatus,
        sourceCandidateSummary,
        sourceCandidateSamples,
        localSourceAuditStatus,
        localSourceAuditSummary,
        localSourceAuditSamples,
        sourceManifestRegistrationChecklist,
        prerequisiteBlockers,
        nextAction
      })
    ),
    items
  };
}

function markdownCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

function markdownPublicCourseTable(rows) {
  if (!rows.length) return '_None._';
  const header =
    '| # | Track | Year | Gap | Source candidates | Candidate sample | Local source audit | Local samples | Registration checklist | Next action |\n|---:|---|---:|---|---|---|---|---|---|---|';
  const body = rows
    .map((row, index) => {
      const candidateSamples = row.sourceCandidateSamples || row.evidence?.sourceCandidateSamples || [];
      const localSamples = row.localSourceAuditSamples || row.evidence?.localSourceAuditSamples || [];
      const checklist = row.sourceManifestRegistrationChecklist || row.evidence?.sourceManifestRegistrationChecklist;
      return `| ${index + 1} | ${markdownCell(row.trackLabel || row.track || '')} | ${markdownCell(row.year || '')} | ${markdownCell(row.blockerCode || '')} | ${markdownCell(row.sourceCandidateSummary || row.evidence?.sourceCandidateSummary || '')} | ${markdownCell(formatSourceCandidateSample(candidateSamples))} | ${markdownCell(row.localSourceAuditSummary || row.evidence?.localSourceAuditSummary || '')} | ${markdownCell(formatLocalSourceAuditSamples(localSamples))} | ${markdownCell(formatRegistrationChecklist(checklist))} | ${markdownCell(row.nextAction || '')} |`;
    })
    .join('\n');
  return `${header}\n${body}`;
}

function markdownBlockerTable(rows) {
  if (!rows.length) return '_None._';
  const header = '| # | Workstream | Blocker | Target | Count | Next action |\n|---:|---|---|---|---:|---|';
  const body = rows
    .map((row, index) => {
      const target = row.filePath || row.bankId || row.title || '';
      return `| ${index + 1} | ${markdownCell(row.workstream)} | ${markdownCell(row.blockerCode)} | ${markdownCell(target)} | ${markdownCell(row.count || 1)} | ${markdownCell(row.nextAction || '')} |`;
    })
    .join('\n');
  return `${header}\n${body}`;
}

function markdownSourceManifestHumanRegistrationQueue(queue) {
  const slots = Array.isArray(queue?.slots) ? queue.slots : [];
  if (!slots.length) return '_None._';

  const header =
    '| # | Slot | Track | Year | Drafts | Roles | Required human fields | Missing human fields | Missing field instances | Local file drafts | Next action |\n|---:|---|---|---:|---:|---|---|---|---|---|---|';
  const body = slots
    .map((slot, index) => {
      const localFileDrafts = Array.isArray(slot.localFileDrafts) ? slot.localFileDrafts : [];
      const missingHumanFieldInstances = Array.isArray(slot.missingHumanFieldInstances)
        ? slot.missingHumanFieldInstances
        : [];
      const missingHumanFieldInstanceSummary = missingHumanFieldInstances
        .map((item) => `${item.sourceRole || item.draftId || 'source'}.${item.field}`)
        .join('<br>');
      const localFileSummary = localFileDrafts
        .map((draft) =>
          [
            draft.sourceRole || 'source',
            draft.localPath || '',
            draft.expectedSha256 ? `sha256=${draft.expectedSha256}` : ''
          ]
            .filter(Boolean)
            .join(': ')
        )
        .join('<br>');
      return `| ${index + 1} | ${markdownCell(slot.slotKey || '')} | ${markdownCell(slot.trackLabel || slot.track || '')} | ${markdownCell(slot.year || '')} | ${markdownCell(slot.draftCount || 0)} | ${markdownCell((slot.sourceRoles || []).join(', '))} | ${markdownCell((slot.requiredHumanFields || []).join(', '))} | ${markdownCell((slot.missingHumanFields || []).join(', '))} | ${markdownCell(missingHumanFieldInstanceSummary)} | ${markdownCell(localFileSummary)} | ${markdownCell(slot.nextAction || '')} |`;
    })
    .join('\n');
  return `${header}\n${body}`;
}

export function renderBacklogMarkdown(backlog) {
  const summary = backlog.summary;
  const localSourceSummary = summary.publicCourseLocalSourceSummary || {};
  const registrationQueueSummary = summary.sourceManifestHumanRegistrationQueue || {};
  const enabled = backlog.items.filter((item) => item.workstream === 'enabled_bank_evidence');
  const inputReports = backlog.items.filter((item) => item.workstream === 'release_audit_inputs');
  const external = backlog.items.filter((item) => item.workstream === 'wechat_real_device_evidence');
  const devtoolsSmoke = backlog.items.filter((item) => item.workstream === 'wechat_devtools_smoke');
  const coverage = Array.isArray(backlog.nextBalancedPublicCourseSlots)
    ? backlog.nextBalancedPublicCourseSlots
    : nextPublicCourseCoverageItems(backlog.items, 24);
  const sourceEvidence = backlog.items.filter((item) => item.workstream === 'source_manifest_evidence').slice(0, 24);
  const flashcards = backlog.items.filter((item) => item.workstream === 'cleaned_flashcard_quality');

  return [
    '# Exam-Master 发布遗留阻塞 Backlog',
    '',
    `生成时间: ${backlog.generatedAt}`,
    '',
    `结论: ${backlog.verdict === 'passed' ? 'passed' : 'blocked'}`,
    '',
    '## Summary',
    '',
    `- canPublish: ${summary.canPublish}`,
    `- blockerItemCount: ${summary.blockerItemCount}`,
    `- 输入报告阻塞: ${inputReports.length}`,
    `- 公共课发布槽位: ${summary.publicCoursePublishedSlots}/${summary.publicCourseRequiredSlots}，pending=${summary.publicCoursePendingSlots}，pendingBlockers=${summary.publicCoursePendingCoverageBlockers}，coverageGaps=${summary.publicCourseCoverageGaps}`,
    `- 公共课阻塞槽位(去重): ${summary.publicCourseBlockedSlotCount}，publicCourseBlockerItems=${summary.publicCourseBlockerItemCount}（coverage/source evidence 可能描述同一槽位）`,
    `- 本地题源处理分布: pairedReadable=${localSourceSummary.pairedReadableSlots || 0}，answerBlocked=${localSourceSummary.answerBlockedSlots || 0}，paperBlocked=${localSourceSummary.paperBlockedSlots || 0}，missingAnswer=${localSourceSummary.missingAnswerSlots || 0}，missingPaper=${localSourceSummary.missingPaperSlots || 0}，needsOcr=${localSourceSummary.needsOcrSlots || 0}，blockedLocal=${localSourceSummary.blockedLocalFileSlots || 0}，unpairedReadable=${localSourceSummary.unpairedReadableSlots || 0}，missingLocalFiles=${localSourceSummary.missingLocalFileSlots || 0}，notAvailable=${localSourceSummary.notAvailableSlots || 0}`,
    `- Source Manifest 人工注册队列: readySlots=${registrationQueueSummary.readySlotCount || 0}，registryDrafts=${registrationQueueSummary.registryDraftCount || 0}，missingHumanFields=${registrationQueueSummary.missingHumanFieldCount || 0}，next=${registrationQueueSummary.nextSlotKey || 'none'}，nextDrafts=${registrationQueueSummary.nextDraftCount || 0}`,
    `- source manifest 可发布官方题源: ${summary.sourceManifestPublishableOfficialPapers}，sourceEvidenceGaps=${summary.sourceEvidenceGaps}`,
    `- 已开放题库证据阻塞题卡: ${summary.enabledBankAnswerEvidenceBlockers}`,
    `- 清洗题卡质量阻塞: ${summary.cleanedFlashcardBlockers}`,
    `- 外部门禁阻塞: ${summary.externalBlockers}`,
    `- WeChat DevTools smoke: ${summary.wechatDevtoolsSmokeStatus}`,
    '',
    '## 输入报告阻塞',
    '',
    markdownBlockerTable(inputReports),
    '',
    '## Source Manifest 人工注册队列',
    '',
    markdownSourceManifestHumanRegistrationQueue(backlog.sourceManifestHumanRegistrationQueue),
    '',
    '## 已开放题库证据阻塞',
    '',
    markdownBlockerTable(enabled),
    '',
    '## 微信真机证据阻塞',
    '',
    markdownBlockerTable(external),
    '',
    '## WeChat DevTools Smoke 阻塞',
    '',
    devtoolsSmoke.length
      ? devtoolsSmoke.map((item) => `- ${item.blockerCode}: ${item.title}；nextAction=${item.nextAction}`).join('\n')
      : '_None._',
    '',
    '## 下一批公共课覆盖/待发布槽位',
    '',
    markdownPublicCourseTable(coverage),
    '',
    '## 下一批来源证据缺口',
    '',
    markdownPublicCourseTable(sourceEvidence),
    '',
    '## 清洗题卡质量阻塞',
    '',
    flashcards.length
      ? flashcards
          .map(
            (item) =>
              `- ${item.filePath}: blockedCards=${item.count}, missing=${item.evidence.missingFields.join(', ')}`
          )
          .join('\n')
      : '_None._',
    '',
    '## 专业课索引',
    '',
    backlog.workstreams.professional_course_index
      ? `- status: ${backlog.workstreams.professional_course_index.status}\n- releaseBlocking: false\n- embeddedItems: ${backlog.workstreams.professional_course_index.summary.embeddedItems || 0}\n- fullIndexItems: ${backlog.workstreams.professional_course_index.summary.fullIndexItems || 0}\n- nextAction: ${backlog.workstreams.professional_course_index.nextAction}`
      : '- not_available',
    ''
  ].join('\n');
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    usage();
    return 0;
  }

  const backlog = buildReleaseBlockerBacklog({
    questionAudit: readJson(options.questionAudit),
    flashcardQuality: readJson(options.flashcardQuality),
    externalAudit: readJson(options.externalAudit),
    wechatSmoke: readJson(options.wechatSmoke),
    professionalIndex: readJson(options.professionalIndex),
    localSourceAudit: readJson(options.localSourceAudit)
  });

  writeText(options.output, `${JSON.stringify(backlog, null, 2)}\n`);
  if (options.writeMarkdown) {
    writeText(options.markdown, `${renderBacklogMarkdown(backlog)}\n`);
  }
  console.log(
    `[release-backlog] verdict=${backlog.verdict} blockers=${backlog.summary.blockerItemCount} publicCourseBlockedSlots=${backlog.summary.publicCourseBlockedSlotCount} output=${relative(options.output)} markdown=${options.writeMarkdown ? relative(options.markdown) : 'skipped'}`
  );
  return options.failOnBlockers && backlog.verdict !== 'passed' ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
