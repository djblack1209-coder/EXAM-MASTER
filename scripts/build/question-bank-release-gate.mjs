#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPublicCourseCoverage,
  buildPublicCourseRequiredYearsForTrack,
  getAllBankMetas
} from '../../src/config/bank-registry.js';

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

// Frozen profiles from the existing source builders; callers cannot select a codec.
const LEGACY_CONTENT_HASH_GROUPS = {
  english_material: [
    'english1-2024',
    'english2-2010',
    'english2-2011',
    'english2-2012',
    'english2-2013',
    'english2-2014',
    'english2-2015',
    'english2-2016',
    'english2-2017',
    'english2-2018',
    'english2-2019',
    'english2-2020',
    'english2-2021',
    'english2-2022',
    'english2-2023',
    'english2-2024'
  ],
  english_pages: [
    'english1-2013',
    'english1-2014',
    'english1-2015',
    'english1-2016',
    'english1-2017',
    'english1-2018',
    'english1-2019',
    'english1-2020'
  ],
  english_text: ['english1-2022', 'english1-2023'],
  math_crops: [
    'math2-2015',
    'math2-2017',
    'math2-2018',
    'math2-2019',
    'math2-2020',
    'math3-2011',
    'math3-2012',
    'math3-2013',
    'math3-2014',
    'math3-2015',
    'math3-2016',
    'math3-2017',
    'math3-2018',
    'math3-2019',
    'math3-2020'
  ],
  math_history: [
    'math1-2005',
    'math1-2006',
    'math1-2007',
    'math1-2008',
    'math1-2009',
    'math1-2010',
    'math1-2011',
    'math1-2012',
    'math1-2013',
    'math1-2014',
    'math1-2015',
    'math1-2016',
    'math1-2017',
    'math1-2018',
    'math1-2019',
    'math1-2020',
    'math1-2021',
    'math1-2022',
    'math1-2023',
    'math1-2024'
  ],
  math_pages: [
    'math2-2005',
    'math2-2006',
    'math2-2007',
    'math2-2008',
    'math2-2009',
    'math2-2010',
    'math2-2011',
    'math2-2012',
    'math2-2013',
    'math2-2014',
    'math2-2024',
    'math2-2025',
    'math3-2005',
    'math3-2006',
    'math3-2007',
    'math3-2008',
    'math3-2009',
    'math3-2010',
    'math3-2024',
    'math3-2025'
  ],
  math_pages_detail: ['math1-2025'],
  politics_2022: ['politics-2022'],
  politics_2024: ['politics-2024'],
  politics_2025: ['politics-2025'],
  politics_pages: [
    'politics-2005',
    'politics-2006',
    'politics-2007',
    'politics-2008',
    'politics-2009',
    'politics-2010',
    'politics-2011',
    'politics-2012',
    'politics-2013',
    'politics-2014',
    'politics-2015',
    'politics-2016',
    'politics-2017',
    'politics-2018',
    'politics-2019',
    'politics-2020',
    'politics-2021'
  ]
};
const LEGACY_CONTENT_HASH_PROFILES = new Map(
  Object.entries(LEGACY_CONTENT_HASH_GROUPS).flatMap(([kind, ids]) => ids.map((id) => [id, kind]))
);

// Match the Python cleaning pipeline's Unicode whitespace rule, including
// U+0085/U+001C..U+001F and excluding U+FEFF (unlike JavaScript's \s).
function cleanedText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ')
    .replace(/^ +| +$/g, '');
}

function cleanedTextHash(value) {
  const text = cleanedText(value);
  return text ? `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}` : '';
}

function pythonJson(value, sorted = true) {
  if (Array.isArray(value)) return `[${value.map((item) => pythonJson(item, sorted)).join(', ')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (sorted) keys.sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}: ${pythonJson(value[key], sorted)}`).join(', ')}}`;
  }
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Invalid payload');
  return JSON.stringify(value);
}

function imageReferences(images, bankId, mode = 'pages', allowQuestionCrop = false, allowEmpty = false) {
  if (!Array.isArray(images) || (!images.length && !allowEmpty) || images.length > 64)
    throw new Error('Missing page binding');
  return images.map((image) => {
    const prefix = `question-bank/${bankId}/`;
    if (typeof image?.src !== 'string' || !image.src.startsWith(prefix)) throw new Error('Wrong bank image');
    const name = image.src.slice(prefix.length);
    const page = name.match(/^(?:paper|answer)-page-(\d{1,3})\.jpg$/);
    if (page && mode !== 'crops' && Number(page[1]) > 0) return Number(page[1]);
    const maskedPage = name.match(/^paper-page-(\d{1,3})-question-crop\.jpg$/);
    if (maskedPage && allowQuestionCrop && mode === 'pages' && Number(maskedPage[1]) > 0)
      return `${maskedPage[1]}-question-crop`;
    const crop = name.match(/^question-(\d{2}(?:[a-z]|-[a-z0-9]+)?)\.jpg$/);
    if (crop && mode === 'crops') return crop[1];
    if (crop && mode === 'history') return `q${crop[1]}`;
    throw new Error('Unknown page reference');
  });
}

function cardContentHashes(card, bankId, normalizedDigest = (text) => cleanedTextHash(text)) {
  const kind = LEGACY_CONTENT_HASH_PROFILES.get(bankId);
  if (!kind)
    return {
      questionTextHash: cleanedTextHash(card.question || card.stem || ''),
      answerTextHash: cleanedTextHash(card.answer)
    };
  try {
    if (card.paperId !== bankId || typeof card.question !== 'string' || typeof card.answer !== 'string')
      throw new Error('Wrong content identity');
    const value = (key, fallback = null) => (Object.hasOwn(card, key) ? card[key] : fallback);
    const digest = (text, normalized = false) =>
      normalized ? normalizedDigest(text, bankId) : `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
    const json = (payload, normalized = false, sorted = true) => digest(pythonJson(payload, sorted), normalized);
    const refs = (key, mode) =>
      imageReferences(
        card[key],
        bankId,
        mode,
        key === 'questionImages' && kind.startsWith('math_'),
        key === 'questionImages' && kind === 'politics_pages'
      );
    const pyList = (list) =>
      `[${list.map((item) => (typeof item === 'number' ? String(item) : `'${item}'`)).join(', ')}]`;
    let question;
    let answer;
    if (kind.startsWith('math_')) {
      if (
        Array.isArray(card.options) &&
        card.options.some((option) => !['A', 'B', 'C', 'D'].includes(option.label) || option.text !== option.label)
      )
        throw new Error('Changed image-choice labels');
      const mode = kind === 'math_crops' ? 'crops' : kind === 'math_history' ? 'history' : 'pages';
      const label = kind === 'math_crops' ? 'crops' : kind === 'math_history' ? 'question-pages' : 'pages';
      question = digest(`${card.question}|${label}:${pyList(refs('questionImages', mode))}`);
      if (kind === 'math_pages_detail') {
        const speed = card.answerImages?.filter((image) => image.caption?.startsWith('答案速查'));
        const detail = card.answerImages?.filter((image) => image.caption?.startsWith('答案解析'));
        if (!speed || !detail || speed.length + detail.length !== card.answerImages.length)
          throw new Error('Missing answer roles');
        answer = digest(
          `${card.answer}|answer-pages:${pyList(imageReferences(speed, bankId))}|detail-pages:${pyList(imageReferences(detail, bankId))}`
        );
      } else answer = digest(`${card.answer}|answer-pages:${pyList(refs('answerImages'))}`);
    } else if (kind === 'english_pages' || kind === 'politics_pages') {
      const payload = { question: card.question, options: value('options', []), questionPages: refs('questionImages') };
      if (kind === 'english_pages') payload.passage = value('passage', '');
      question = json(payload);
      answer = json({ answer: card.answer, answerPages: refs('answerImages') });
    } else if (kind === 'english_material' || kind === 'english_text') {
      const payload = { question: card.question, passage: value('passage'), options: value('options', []) };
      if (kind === 'english_material') payload.material = value('material', '');
      const role = card.answerEvidence?.evidenceRole;
      if (typeof role !== 'string' || !role) throw new Error('Missing answer role');
      question = json(payload, true);
      answer = json({ answer: card.answer, role }, true);
    } else if (kind === 'politics_2022') {
      const choice = ['single_choice', 'multi_choice'].includes(card.type);
      question = choice ? json({ question: card.question, options: value('options', []) }) : digest(card.question);
      const payload = { answer: card.answer, answerPages: refs('answerImages') };
      if (choice) payload.explanation = value('explanation', '');
      answer = json(payload, false, false);
    } else if (kind === 'politics_2024') {
      const choice = ['single_choice', 'multi_choice'].includes(card.type);
      question = choice ? digest(`${card.question}|${pythonJson(value('options', []))}`) : digest(card.question);
      answer = choice ? digest(`${card.answer}|${value('explanation', '')}`) : digest(card.answer);
    } else if (kind === 'politics_2025') {
      const options = value('options', []);
      if (!Array.isArray(options) || options.some((option) => !option || typeof option !== 'object'))
        throw new Error('Invalid choices');
      question = digest(
        `${card.question}|${options.map((option) => `${option.label ?? ''}:${option.text ?? ''}`).join('|')}`
      );
      answer = digest(`${card.answer}|${value('explanation', '')}`);
    } else throw new Error('Unknown content contract');
    return { questionTextHash: question, answerTextHash: answer };
  } catch {
    return { questionTextHash: null, answerTextHash: null };
  }
}

function declaredTextHashesMatch(card, field, expected) {
  const snakeField = field === 'questionTextHash' ? 'question_text_hash' : 'answer_text_hash';
  const values = [
    card[field],
    card[snakeField],
    card.sourceEvidence?.[field],
    field === 'answerTextHash' ? card.answerEvidence?.[field] : null
  ].filter((value) => value !== undefined && value !== null && cleanedText(String(value)) !== '');
  return expected !== null && values.every((value) => typeof value === 'string' && cleanedText(value) === expected);
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

const CLOZE_SOURCE_BANKS = new Set(['english1-2006', 'english1-2007', 'english1-2010']);

function clozeSourceProofMatches(card, bankId) {
  const idNumber = Number(
    String(card.id || '')
      .split('-')
      .at(-1)
  );
  const section =
    (bankId === 'english1-2007' &&
      ((card.number >= 46 && card.number <= 50) || (idNumber >= 46 && idNumber <= 50) || card.groupId === 'part-c')) ||
    (bankId === 'english1-2010' &&
      ((card.number >= 41 && card.number <= 50) ||
        (idNumber >= 41 && idNumber <= 50) ||
        ['part-b', 'part-c'].includes(card.groupId)));
  if (
    !section &&
    (!CLOZE_SOURCE_BANKS.has(bankId) ||
      !(
        card.number <= 20 ||
        (idNumber >= 1 && idNumber <= 20) ||
        card.groupId === 'cloze' ||
        /完形填空第/.test(card.question || '')
      ))
  )
    return true;
  try {
    const proof = card.sourceEvidence?.questionProof;
    const keys = ['contract', 'bankId', 'sourceId', 'sourceFilePath', 'sourceFileSha256', 'sourceType', 'contentHash'];
    if (!proof || Object.keys(proof).length !== keys.length || keys.some((key) => !Object.hasOwn(proof, key)))
      return false;
    if (
      proof.contract !== (section ? 'english-section-source-v1' : 'cloze-source-v1') ||
      proof.bankId !== bankId ||
      proof.sourceType !== 'paper_answer_pdf'
    )
      return false;
    if (
      !Number.isInteger(card.number) ||
      (section && (card.number < (bankId === 'english1-2007' ? 46 : 41) || card.number > 50)) ||
      (!section && (card.number < 1 || card.number > 20)) ||
      card.id !== `${bankId}-${String(card.number).padStart(3, '0')}`
    )
      return false;
    const prompt = !section
      ? `完形填空第 ${card.number} 空：阅读全文后选择最合适的选项。`
      : card.number >= 46
        ? `翻译第 ${card.number} 处画线句：请先阅读 Part C 全文，再翻译该标注片段。`
        : `新题型第 ${card.number} 空：请先阅读完整文章，再从 A-G 中选择最合适的段落。`;
    if (card.question !== prompt) return false;
    if (
      !section &&
      JSON.stringify(Array.from(String(card.passage || '').matchAll(/\[(\d+)\]/g), (m) => m[1])) !==
        JSON.stringify(Array.from({ length: 20 }, (_, i) => String(i + 1)))
    )
      return false;
    const sourceProfile =
      bankId === 'english1-2006'
        ? ['src_9ec7d1d38e6f1d22108b63ac', 'sha256:0bf28e07ed34cbc33af0b79f620ac31c8897e91859a70748c3a55de3e5e9e9d4']
        : bankId === 'english1-2007'
          ? ['src_e148ece4fffe3713d05b40f8', 'sha256:44d08043b1e76a0fe935d1d46ffc3ccfeec36bff3e73091a55246975c6dc6a53']
          : ['src_bff66c7d8434bb36d89117d9', 'sha256:75eb0f30f453a0c518b2731ba33894f59af2dd808d227168762ebf919bdd5bbc'];
    if (proof.sourceId !== sourceProfile[0] || proof.sourceFileSha256 !== sourceProfile[1]) return false;
    if (section) {
      const profile =
        bankId === 'english1-2007'
          ? ['src_e148ece4fffe3713d05b40f8', 'sha256:44d08043b1e76a0fe935d1d46ffc3ccfeec36bff3e73091a55246975c6dc6a53']
          : ['src_bff66c7d8434bb36d89117d9', 'sha256:75eb0f30f453a0c518b2731ba33894f59af2dd808d227168762ebf919bdd5bbc'];
      if (proof.sourceId !== profile[0] || proof.sourceFileSha256 !== profile[1]) return false;
      if (card.number >= 46) {
        if (
          card.type !== 'translation' ||
          card.targetSegmentNumber !== card.number ||
          !card.targetSegment ||
          !card.passage?.includes(card.targetSegment) ||
          /Writing|[\u4e00-\u9fff]/.test(card.passage)
        )
          return false;
      } else if (
        JSON.stringify(card.fixedSequence) !== JSON.stringify(['41', '42', '43', '44', 'E', '45']) ||
        JSON.stringify(card.fixedParagraphs) !== '["E"]' ||
        card.options?.length !== 7
      )
        return false;
    }
    if (!/^src_[a-f0-9]{24}$/.test(proof.sourceId) || !/^sha256:[a-f0-9]{64}$/.test(proof.sourceFileSha256))
      return false;
    const prefix = 'data/raw-inbox/';
    if (
      typeof proof.sourceFilePath !== 'string' ||
      !proof.sourceFilePath.startsWith(`${prefix}${proof.sourceId}-`) ||
      !proof.sourceFilePath.endsWith('.pdf')
    )
      return false;
    const name = proof.sourceFilePath.slice(prefix.length);
    if (name.includes('/') || name.includes('\\') || !name.includes(bankId.split('-')[1])) return false;
    const file = path.join(PROJECT_ROOT, proof.sourceFilePath);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024 || fs.realpathSync(file) !== file)
      return false;
    const bytes = fs.readFileSync(file);
    const after = fs.statSync(file);
    if (
      bytes.subarray(0, 5).toString() !== '%PDF-' ||
      after.ino !== stat.ino ||
      after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs
    )
      return false;
    if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== proof.sourceFileSha256) return false;
    const payload = {};
    const fields = [
      'id',
      'number',
      'question',
      'passage',
      'context',
      'material',
      'options',
      'passageSegments',
      'answer'
    ];
    if (section) fields.push('targetSegment', 'targetSegmentNumber', 'fixedSequence', 'fixedParagraphs');
    for (const key of fields) payload[key] = card[key] ?? null;
    for (const key of keys.filter((key) => key !== 'contentHash')) payload[key] = proof[key];
    return cleanedTextHash(pythonJson(payload)) === proof.contentHash;
  } catch {
    return false;
  }
}

function restoredQuestionAssetsMatch(card, bankId) {
  if (bankId !== 'math3-2007' || card.number !== 24) return true;
  try {
    const names = [12, 13].map((page) => `question-bank/${bankId}/paper-page-${page}-question-crop.jpg`);
    const hashes = card.sourceEvidence?.questionAssetHashes;
    if (!hashes || Object.keys(hashes).length !== 2 || card.questionImages?.length !== 2) return false;
    for (let index = 0; index < 2; index += 1) {
      const name = names[index];
      if (card.questionImages[index]?.src !== name || !/^sha256:[a-f0-9]{64}$/.test(hashes[name])) return false;
      const file = path.join(PROJECT_ROOT, 'cdn-assets', name);
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(file) !== file || stat.size > 200 * 1024)
        return false;
      const bytes = fs.readFileSync(file);
      if (
        bytes[0] !== 0xff ||
        bytes[1] !== 0xd8 ||
        `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== hashes[name]
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

function auditCardEvidence(card, index, bank = {}, normalizedDigest) {
  const missingFields = [];
  const hashes = cardContentHashes(card, bank.id, normalizedDigest);

  if (!String(card.question || card.stem || '').trim()) missingFields.push('question');
  if (!String(card.answer || '').trim()) missingFields.push('answer');
  if (bank?.subjectKey === 'english' && !isEvidenceOnlyType(card.type) && !hasPassageMaterial(card)) {
    missingFields.push('passage');
  }
  if (!sourceEvidenceId(card)) missingFields.push('sourceEvidenceId');
  if (answerEvidenceStatus(card) !== 'matched') missingFields.push('answerEvidenceStatus=matched');
  if (!questionHash(card)) missingFields.push('questionTextHash');
  if (!answerHash(card)) missingFields.push('answerTextHash');
  if (!declaredTextHashesMatch(card, 'questionTextHash', hashes.questionTextHash)) {
    missingFields.push('questionTextHash=content_mismatch');
  }
  if (!declaredTextHashesMatch(card, 'answerTextHash', hashes.answerTextHash)) {
    missingFields.push('answerTextHash=content_mismatch');
  }
  if (!clozeSourceProofMatches(card, bank.id)) missingFields.push('questionTextHash=source_payload_mismatch');
  if (!restoredQuestionAssetsMatch(card, bank.id)) missingFields.push('questionTextHash=asset_payload_mismatch');
  // Registered politics sources provide publisher references only;
  // changing or stripping candidate flags must not grant public scoring authority.
  if (bank.id === 'politics-2023') missingFields.push('answerTextHash=reference_only_authority');

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

  const loaded = new Map();
  const requests = new Map();
  const digestKey = (text, bankId) => `${bankId}:${createHash('sha256').update(text).digest('hex')}`;
  for (const bank of banks.filter(isReleaseBank)) {
    try {
      const data = loadPublishedBank(bank, bankDir);
      loaded.set(bank.id, data);
      for (const card of data.cards)
        cardContentHashes(card, bank.id, (text, bankId) => {
          requests.set(digestKey(text, bankId), { bankId, text });
          return '';
        });
    } catch (error) {
      loaded.set(bank.id, { error });
    }
  }
  const hashes = new Map();
  if (requests.size) {
    const input = JSON.stringify([...requests.values()]);
    if (requests.size > 2048 || Buffer.byteLength(input) > 8 * 1024 * 1024)
      throw new Error('Content digest batch exceeds limit');
    const localPython = path.join(PROJECT_ROOT, '.venv-baidu/bin/python');
    const python = fs.existsSync(localPython) ? localPython : 'python3';
    const result = spawnSync(
      python,
      [path.join(PROJECT_ROOT, 'scripts/baidu/flashcard_quality.py'), '--legacy-hash-batch'],
      {
        input,
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024
      }
    );
    if (result.status !== 0) throw new Error('Registered content digest runtime unavailable');
    const values = JSON.parse(result.stdout);
    if (
      !Array.isArray(values) ||
      values.length !== requests.size ||
      values.some((value) => !/^sha256:[a-f0-9]{64}$/.test(value))
    )
      throw new Error('Invalid registered digest receipt');
    [...requests.keys()].forEach((key, index) => hashes.set(key, values[index]));
  }
  const normalizedDigest = (text, bankId) => hashes.get(digestKey(text, bankId)) ?? null;

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
      const data = loaded.get(bank.id);
      if (data.error) throw data.error;
      const { cards } = data;
      cardCount += cards.length;

      if (!cards.length) {
        bankReport.blockedCards.push({ cardId: '__bank__', missingFields: ['cards'] });
      }

      cards.forEach((card, index) => {
        const cardReport = auditCardEvidence(card, index, bank, normalizedDigest);
        if (cardReport.missingFields.length) {
          bankReport.blockedCards.push(cardReport);
          if (cardReport.missingFields.some((field) => ['question', 'answer', 'cards'].includes(field))) {
            gradingBlockerCount += 1;
          }
          if (cardReport.missingFields.includes('passage')) {
            gradingBlockerCount += 1;
          }
          if (
            cardReport.missingFields.some(
              (field) =>
                ['sourceEvidenceId', 'answerEvidenceStatus=matched'].includes(field) ||
                field.startsWith('questionTextHash') ||
                field.startsWith('answerTextHash')
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
const PUBLIC_USE_EVIDENCE_POLICY = 'public-course-public-use-v1';
const VALID_MANIFEST_SOURCE_STATUSES = new Set(['discovered', 'verified', 'published']);
const VALID_SOURCE_ROLES = new Set(['paper', 'answer', 'paper_answer']);
const BLOCKING_SOURCE_RISK_FLAGS = new Set([
  'answer_missing',
  'brand_leak',
  'copyright_review_required',
  'ad_or_promo',
  'manual_review_required',
  'source_content_mismatch'
]);
const KNOWN_SOURCE_QUALITY_OVERRIDES = [
  {
    sourceIds: new Set(['src_97fdbcbd12d0815374fbe91f']),
    contentHashes: new Set([
      '5347d192as7e7e3d20fdf8d7db3fdd68',
      '6fd3ad9e10d9fc6043a5dea007843f8ea2fb06ff6dc7e9e6ffb970fe202633e5'
    ]),
    remotePathContains: ['/【完整版】数学二真题答案解析/2016考研数学二真题 .pdf'],
    riskFlags: ['source_content_mismatch', 'manual_review_required'],
    blockReason: 'source_content_mismatch'
  },
  {
    sourceIds: new Set(['src_1b0fd1f2d5c9741193305511']),
    contentHashes: new Set([
      '46f076305pf181eb53d3f3c01172fdd7',
      'a9db41a6703e349215044e39c980c99fecbb8386321bdf206ee002502e61c068',
      'sha256:a9db41a6703e349215044e39c980c99fecbb8386321bdf206ee002502e61c068'
    ]),
    remotePathContains: ['/【完整版】数学二真题答案解析/2021考研数学二真题 .pdf'],
    riskFlags: ['brand_leak', 'copyright_review_required', 'manual_review_required'],
    blockReason: 'branded_reference_rights_unverified'
  }
];

function sourceLocation(item) {
  return firstNonEmpty(item?.remotePath, item?.sourceUrl, item?.provenanceUrl);
}

function sourceHash(item) {
  return firstNonEmpty(item?.contentHash, item?.sha256, item?.fileSha256, item?.sourceHash);
}

function sourceQualityOverrideForItem(item) {
  const sourceId = String(item?.sourceId || item?.id || '').trim();
  const location = sourceLocation(item) || '';
  const hashes = [item?.contentHash, item?.sha256, item?.fileSha256, item?.sourceHash, item?.hash].map((value) =>
    String(value || '').trim()
  );

  return (
    KNOWN_SOURCE_QUALITY_OVERRIDES.find(
      (override) =>
        (sourceId && override.sourceIds.has(sourceId)) ||
        hashes.some((hash) => hash && override.contentHashes.has(hash)) ||
        override.remotePathContains.some((fragment) => location.includes(fragment))
    ) || null
  );
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

function matchesMathStandardAnswerAnalysis(item, text) {
  const match = String(text || '').match(/((?:19|20)\d{2})[-_、.]?数[一二三]标准答案及解析/i);
  if (!match) return false;
  const sourceYear = Number(match[1]);
  const itemYear = Number(item?.year);
  return Number.isInteger(sourceYear) && Number.isInteger(itemYear) && sourceYear === itemYear;
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
  if (matchesMathStandardAnswerAnalysis(item, fileName)) {
    return { explicitRole, inferredRole: 'paper_answer', roleSource: 'filename' };
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
  if (matchesMathStandardAnswerAnalysis(item, fullPath)) {
    return { explicitRole, inferredRole: 'paper_answer', roleSource: 'path' };
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

  const qualityOverride = sourceQualityOverrideForItem(item);
  const riskFlags = [
    ...new Set([...(Array.isArray(item?.riskFlags) ? item.riskFlags : []), ...(qualityOverride?.riskFlags || [])])
  ];
  const blockedFlags = riskFlags.filter((flag) => BLOCKING_SOURCE_RISK_FLAGS.has(flag)).sort();
  if (blockedFlags.length) reasons.push(`riskFlags=${blockedFlags.join(',')}`);
  if (item?.legalReview?.publishBlocked || qualityOverride) reasons.push('legalReview.publishBlocked=true');
  if (qualityOverride?.blockReason) reasons.push(qualityOverride.blockReason);
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
    autoPairEligible,
    sourceQualityBlocked: Boolean(sourceQualityOverrideForItem(item))
  };
}

function isAutoPairableManifestSource(item) {
  return manifestSourceAnalysis(item).autoPairEligible;
}

function publicUseBlockReasons(item) {
  const proof = item?.publicUseEvidence;
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return ['publicUseEvidence=missing'];
  const reasons = [];
  if (!['verified', 'published'].includes(item.status)) reasons.push('publicUseEvidence.sourceStatus=unverified');
  if (proof.contract !== PUBLIC_USE_EVIDENCE_POLICY) reasons.push('publicUseEvidence.contract=unsupported');
  if (proof.scope !== 'public_course_redistribution') reasons.push('publicUseEvidence.scope=not_public_redistribution');
  if (!['public_domain', 'open_license', 'permission'].includes(proof.basis))
    reasons.push('publicUseEvidence.basis=unverified');
  const hash = sourceHash(item);
  if (!/^sha256:[a-f0-9]{64}$/.test(hash || '') || proof.sourceHash !== hash)
    reasons.push('publicUseEvidence.sourceHash=mismatch_or_missing');
  const sourceUrl = String(item.sourceUrl || '').trim();
  if (proof.sourceUrl !== sourceUrl) reasons.push('publicUseEvidence.sourceUrl=mismatch');
  for (const [field, value] of [
    ['sourceUrl', sourceUrl],
    ['evidenceUrl', proof.evidenceUrl]
  ]) {
    try {
      if (typeof value !== 'string') throw new Error('invalid');
      const url = new URL(value);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('invalid');
    } catch {
      reasons.push(`publicUseEvidence.${field}=invalid`);
    }
  }
  for (const field of ['verifiedBy', 'note']) {
    if (typeof proof[field] !== 'string' || !proof[field].trim()) reasons.push(`publicUseEvidence.${field}=missing`);
  }
  if (
    typeof proof.verifiedAt !== 'string' ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(proof.verifiedAt) ||
    !Number.isFinite(Date.parse(proof.verifiedAt))
  )
    reasons.push('publicUseEvidence.verifiedAt=invalid');
  return reasons;
}

function sourceCandidateSample(item, analysis) {
  const qualityOverride = sourceQualityOverrideForItem(item);
  return {
    sourceId: item.sourceId || item.id || '',
    status: item.status || '',
    sourceType: item.sourceType || '',
    sourceRole: item.sourceRole || item.source_role || '',
    inferredSourceRole: analysis.inferredRole || '',
    roleSource: analysis.roleSource || '',
    autoPairEligible: analysis.autoPairEligible === true,
    publicUseVerified: analysis.autoPairEligible === true && publicUseBlockReasons(item).length === 0,
    publicUseBlockReasons: publicUseBlockReasons(item),
    answerEvidenceStatus: item.answerEvidenceStatus || '',
    riskFlags: [
      ...new Set([...(Array.isArray(item.riskFlags) ? item.riskFlags : []), ...(qualityOverride?.riskFlags || [])])
    ].sort(),
    publishBlocked: item.legalReview?.publishBlocked === true || analysis.sourceQualityBlocked === true,
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

function requiredYearsForTrack(requiredYearsByTrack, track) {
  return requiredYearsByTrack[track] || [];
}

function buildRequiredYearsByTrack(tracks, minYear, maxYear) {
  return Object.fromEntries(
    tracks.map((track) => [track, buildPublicCourseRequiredYearsForTrack(track, minYear, maxYear)])
  );
}

function buildCandidateDiagnostics(items, tracks, requiredYearsByTrack) {
  const diagnostics = Object.fromEntries(tracks.map((track) => [track, {}]));

  for (const item of items) {
    for (const track of tracks) {
      const requiredYears = requiredYearsForTrack(requiredYearsByTrack, track);
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
  const requiredYearsByTrack = buildRequiredYearsByTrack(tracks, minYear, maxYear);

  if (!sourceManifest || !fs.existsSync(sourceManifest)) {
    return {
      status: 'missing',
      sourceEvidencePolicy: SOURCE_EVIDENCE_POLICY,
      manifestPath: sourceManifest ? path.relative(PROJECT_ROOT, sourceManifest) : '',
      totalSources: 0,
      eligibleSources: 0,
      publishableOfficialPapers: 0,
      autoPairedOfficialSourceSlots: 0,
      publicUseEvidencePolicy: PUBLIC_USE_EVIDENCE_POLICY,
      publicUseCoverageGapCount: Object.values(requiredYearsByTrack).reduce((sum, years) => sum + years.length, 0),
      publicUseCoverage: Object.fromEntries(
        tracks.map((track) => [
          track,
          {
            presentYears: [],
            missingYears: requiredYearsForTrack(requiredYearsByTrack, track),
            coverageRate: 0
          }
        ])
      ),
      coverageGapCount: Object.values(requiredYearsByTrack).reduce(
        (sum, requiredYears) => sum + requiredYears.length,
        0
      ),
      candidateDiagnostics: Object.fromEntries(tracks.map((track) => [track, {}])),
      coverage: Object.fromEntries(
        tracks.map((track) => [
          track,
          { presentYears: [], missingYears: requiredYearsForTrack(requiredYearsByTrack, track), coverageRate: 0 }
        ])
      )
    };
  }

  const manifest = readJson(sourceManifest);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const autoPairable = items.filter(isAutoPairableManifestSource);
  const publicUseSources = autoPairable.filter((item) => publicUseBlockReasons(item).length === 0);
  const coverage = {};
  const publicUseCoverage = {};
  const candidateDiagnostics = buildCandidateDiagnostics(items, tracks, requiredYearsByTrack);

  for (const track of tracks) {
    const requiredYears = requiredYearsForTrack(requiredYearsByTrack, track);
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
    const publicYears = requiredYears.filter((year) => slotHasAutoPairedOfficialSource(publicUseSources, track, year));
    const publicMissingYears = requiredYears.filter((year) => !publicYears.includes(year));
    publicUseCoverage[track] = {
      presentYears: publicYears,
      missingYears: publicMissingYears,
      coverageRate: requiredYears.length ? Number((publicYears.length / requiredYears.length).toFixed(4)) : 1,
      missingYearDiagnostics: Object.fromEntries(
        publicMissingYears.map((year) => {
          const slot = candidateDiagnostics[track]?.[year] || {
            candidateCount: 0,
            blockReasons: {},
            sampleCandidates: []
          };
          const blockReasons = { ...slot.blockReasons };
          for (const item of autoPairable.filter((value) => candidateSlotMatches(value, track, [year]))) {
            for (const reason of publicUseBlockReasons(item)) blockReasons[reason] = (blockReasons[reason] || 0) + 1;
          }
          // A valid licence for the answer cannot cover a different question file (or vice versa).
          blockReasons['publicUseEvidence.completePair=missing'] = 1;
          return [year, { ...slot, blockReasons }];
        })
      )
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
    publishableOfficialPapers: Object.values(publicUseCoverage).reduce((sum, row) => sum + row.presentYears.length, 0),
    autoPairedOfficialSourceSlots: Object.values(coverage).reduce((sum, row) => sum + row.presentYears.length, 0),
    coverageGapCount: Object.values(coverage).reduce((sum, row) => sum + row.missingYears.length, 0),
    publicUseEvidencePolicy: PUBLIC_USE_EVIDENCE_POLICY,
    publicUseCoverageGapCount: Object.values(publicUseCoverage).reduce((sum, row) => sum + row.missingYears.length, 0),
    publicUseCoverage,
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
    sourceEvidence.publicUseCoverageGapCount === 0 &&
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
      sourceManifestPublicUseCoverageGapCount: sourceEvidence.publicUseCoverageGapCount,
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
        sourcePublicUse: sourceEvidence.publicUseCoverageGapCount,
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
      `sourcePublicUseGaps=${summary.sourceManifestPublicUseCoverageGapCount} ` +
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
