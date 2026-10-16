import {
  captureQuizOriginal,
  quizOriginalIdentity,
  validateCapturedQuizOriginal,
  assertQuizOriginalDisplay,
  quizOriginalChoiceOptions
} from '../../laf-backend/functions/_shared/learning-quiz-original.js';
const FALLBACK_CHOICE_OPTIONS = ['选项A', '选项B', '选项C', '选项D'];

// Preserve old local fixtures, but never adopt them as real practice records.
export function isSeededPracticeRecord(record) {
  return [record, record?.quizOriginal?.fields].some(
    (item) => item && (item.source === 'guest_demo' || item.sourceType === 'guest_demo')
  );
}

export function isValidQuizSessionId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}

export function isValidQuizAttemptId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,160}$/.test(value);
}

// 接收回执只证明保存原答，不赋予评分权威。
export function parseQuizSubmissionReceipt(response, attemptId, submitted) {
  const receipt = response?.data;
  if (
    response?.success !== true ||
    response?.code !== 0 ||
    receipt?.submission_contract !== 'quiz-answer-submission-v1' ||
    receipt?.attempt_id !== attemptId ||
    !isValidQuizAttemptId(attemptId) ||
    typeof receipt?.record_id !== 'string' ||
    !/^ans_[a-f0-9]{64}$/.test(receipt.record_id) ||
    receipt.question_id !== submitted.question_id ||
    receipt.session_id !== submitted.session_id ||
    receipt.user_answer_raw !== submitted.user_answer ||
    receipt.user_answer !== submitted.user_answer.toUpperCase() ||
    receipt.duration !== Math.min(Math.floor(submitted.duration), 3600) ||
    receipt.practice_mode !== submitted.practice_mode ||
    !Number.isSafeInteger(receipt.received_at) ||
    receipt.received_at <= 0 ||
    receipt.grade?.status !== 'pending' ||
    receipt.isCorrect !== null
  )
    return null;
  return { status: 'received', recordId: receipt.record_id, receivedAt: receipt.received_at };
}

export function createQuizAttemptId() {
  const nonce =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  return `quiz_answer_${nonce}`;
}
const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const LEGACY_REVIEW_HANDOFF_KEY = 'legacy_review_handoff_v1';

// 旧条目只能重用完整原题；缺失资料不以样例选项或默认答案补齐。
export function normalizeLegacyReviewQuestion(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  if (isSeededPracticeRecord(record)) return null;
  const id = record.id ?? record._id;
  const question =
    record.question ?? record.question_content ?? record.questionContent ?? record.content ?? record.title;
  const reference = record.answer ?? record.correct_answer ?? record.correctAnswer;
  if (
    !['string', 'number'].includes(typeof id) ||
    !String(id).trim() ||
    (typeof id === 'number' && !Number.isSafeInteger(id)) ||
    typeof question !== 'string' ||
    !question.trim()
  )
    return null;
  let type = record.type;
  let answer;
  let options = record.options ?? record.choices ?? record.option_list;
  if (isEvidenceOnlyType(type)) {
    if (typeof reference !== 'string' || !reference.trim()) return null;
    answer = reference;
    options = [];
  } else {
    if (
      type &&
      !['单选', '单选题', 'single_choice', '多选', '多选题', 'multi_choice', 'multiple_choice'].includes(type)
    )
      return null;
    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      options.length > 26 ||
      quizOriginalChoiceOptions(options) === null
    )
      return null;
    if (typeof reference === 'number') {
      if (!Number.isInteger(reference) || reference < 0 || reference >= options.length) return null;
      answer = OPTION_LABELS[reference];
    } else if (typeof reference === 'string') {
      const compact = reference
        .trim()
        .toUpperCase()
        .replace(/[\s,，、;；/|]+/g, '');
      if (!compact || ![...compact].every((label) => OPTION_LABELS.slice(0, options.length).includes(label)))
        return null;
      answer = OPTION_LABELS.filter((label) => compact.includes(label)).join('');
    } else return null;
    const multi = ['多选', '多选题', 'multi_choice', 'multiple_choice'].includes(type);
    if (type && !multi && answer.length !== 1) return null;
    type = multi || answer.length > 1 ? 'multi_choice' : 'single_choice';
  }
  return {
    ...record,
    id,
    question,
    options: [...options],
    answer,
    type,
    isReview: true,
    scoringAuthority: false,
    quizOriginal: captureQuizOriginal(record)
  };
}

// Compare the displayed original, not counters or mastery labels added later.
export function legacyReviewQuestionIdentity(record) {
  const q = normalizeLegacyReviewQuestion(record);
  if (!q) return null;
  return quizOriginalIdentity(q.quizOriginal);
}

// 选题入口共用：先核对原件，再生成显示数据。缺资料的指定题不补造。
export function prepareQuizQuestion(record, index = 0) {
  try {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    if (isSeededPracticeRecord(record)) return null;
    const original = captureQuizOriginal(record);
    validateCapturedQuizOriginal(original);
    const parsed = normalizeLegacyReviewQuestion({ ...original.fields, id: original.id, quizOriginal: original });
    if (!parsed) return null;
    const fields = original.fields;
    const originalPrompt =
      fields.question ?? fields.question_content ?? fields.questionContent ?? fields.content ?? fields.title;
    const originalOptions = fields.options ?? fields.choices ?? fields.option_list ?? [];
    if (
      String(record.id ?? record._id) !== String(original.id) ||
      (record.question ?? record.question_content ?? record.questionContent ?? record.content ?? record.title) !==
        originalPrompt ||
      ![originalOptions, quizOriginalChoiceOptions(originalOptions), parsed.options].some(
        (options) =>
          quizOriginalIdentity(record.options ?? record.choices ?? record.option_list ?? []) ===
          quizOriginalIdentity(options)
      ) ||
      ![fields.answer ?? fields.correct_answer ?? fields.correctAnswer ?? null, parsed.answer].some(
        (answer) =>
          quizOriginalIdentity(record.answer ?? record.correct_answer ?? record.correctAnswer ?? null) ===
          quizOriginalIdentity(answer)
      )
    )
      return null;
    assertQuizOriginalDisplay({ ...record, quizOriginal: original }, original);
    const displayed = normalizeQuizQuestion({ ...record, ...parsed, isReview: record.isReview }, index);
    assertQuizOriginalDisplay(displayed, displayed.quizOriginal);
    return displayed;
  } catch (_error) {
    return null;
  }
}

export function prepareQuizSelection(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const questions = records.map(prepareQuizQuestion);
  if (questions.some((q) => !q) || new Set(questions.map((q) => String(q.id))).size !== questions.length) return null;
  return questions;
}

export function selectQuizQuestionsById(bank, ids) {
  if (!Array.isArray(bank) || !Array.isArray(ids) || ids.length === 0) return null;
  const byId = new Map();
  for (const question of bank) {
    const id = question?.id ?? question?._id;
    // 重复编号仍拒绝；不能用首条命中掩盖冲突，也不改原题编号的类型。
    byId.set(id, byId.has(id) ? null : question);
  }
  const selected = ids.map((id) => byId.get(id));
  return prepareQuizSelection(selected);
}

export function createSinglePracticeHandoff(question, ownerId, id = createQuizAttemptId()) {
  if (typeof ownerId !== 'string' || !isValidQuizAttemptId(id) || !question?.quizOriginal) return null;
  const original = question.quizOriginal;
  const raw = {
    ...original.fields,
    id: original.id,
    quizOriginal: original,
    ...(question.legacyReviewContext?.referenceViewed === true
      ? {
          legacyReviewContext: { contract: 'legacy-review-view-v1', referenceViewed: true }
        }
      : {})
  };
  if (!prepareQuizQuestion(raw)) return null;
  return JSON.parse(JSON.stringify({ contract: 'quiz-single-handoff-v1', id, ownerId, question: raw }));
}

export function readSinglePracticeHandoff(value, id, ownerId) {
  if (value?.contract === 'quiz-single-handoff-v1') {
    if (!isValidQuizAttemptId(id) || value.id !== id || value.ownerId !== ownerId) return null;
    return prepareQuizSelection([value.question]);
  }
  // 兼容当前私有命名空间内的旧原题；带新跳转编号时绝不回退到旧临时值。
  return id || value?.contract ? null : prepareQuizSelection([value]);
}

export const QUIZ_REVIEW_HANDOFF_KEY = 'quiz_review_handoff_v1';
export function createQuizReviewHandoff(questions, ownerId, paperId = '', id = createQuizAttemptId()) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 200 || typeof paperId !== 'string')
    return null;
  const raw = questions.map((q) => createSinglePracticeHandoff(q, ownerId, id)?.question);
  if (raw.some((q) => !q) || !prepareQuizSelection(raw)) return null;
  if (paperId && raw.some((q) => q.paperId !== paperId)) return null;
  const result = JSON.stringify({ contract: 'quiz-review-handoff-v1', id, ownerId, paperId, questions: raw });
  return result.length <= 3600000 ? JSON.parse(result) : null;
}

export function readQuizReviewHandoff(value, id, ownerId, paperId = '') {
  if (
    value?.contract !== 'quiz-review-handoff-v1' ||
    !isValidQuizAttemptId(id) ||
    value.id !== id ||
    value.ownerId !== ownerId ||
    typeof value.paperId !== 'string' ||
    (paperId && value.paperId !== paperId) ||
    !Array.isArray(value.questions) ||
    value.questions.length > 200 ||
    value.questions.some((q) => !q?.quizOriginal)
  )
    return null;
  try {
    if (JSON.stringify(value).length > 3600000) return null;
    const selected = prepareQuizSelection(value.questions);
    return selected && (!value.paperId || selected.every((q) => q.paperId === value.paperId)) ? selected : null;
  } catch (_error) {
    return null;
  }
}

export function summarizeLegacyMistakeRecords(records) {
  if (!Array.isArray(records)) return null;
  const groups = new Map();
  const rows = records.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  for (const row of rows) {
    const label = row.category ?? row.subject;
    const category = typeof label === 'string' && label.trim() ? label.trim() : '未分类';
    groups.set(category, (groups.get(category) || 0) + 1);
  }
  return {
    contract: 'legacy-record-report-v1',
    scope: 'loaded_list',
    scoringAuthority: false,
    recordCount: rows.length,
    omittedInvalidRows: records.length - rows.length,
    categories: [...groups]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
  };
}

export function readLegacyReviewHandoff(handoff, id, ownerId) {
  if (
    handoff?.contract !== 'legacy-review-handoff-v1' ||
    !isValidQuizAttemptId(id) ||
    handoff.id !== id ||
    handoff.ownerId !== ownerId ||
    !Array.isArray(handoff.questions) ||
    handoff.questions.length === 0 ||
    handoff.questions.length > 200
  )
    return null;
  const questions = handoff.questions.map(normalizeLegacyReviewQuestion);
  if (
    questions.some((question) => !question) ||
    new Set(questions.map((question) => String(question.id))).size !== questions.length
  )
    return null;
  return JSON.parse(JSON.stringify(questions));
}
const QUESTION_TYPE_LABELS = {
  single_choice: '单选题',
  multi_choice: '多选题',
  analysis: '分析题',
  flashcard: '闪卡',
  translation: '翻译题',
  essay: '写作题',
  short_answer: '简答题'
};
const KNOWLEDGE_STATE_LABELS = {
  unknown: '待点亮',
  primed: '接近掌握',
  strong: '稳定掌握',
  watch: '需要观察',
  weak: '薄弱点'
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function splitPassageSegments(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const source = paragraphs.length > 1 ? paragraphs : [text];

  return source.flatMap((paragraph) => {
    if (paragraph.length <= 420) return [paragraph];
    const sentences = paragraph
      .replace(/([.!?。！？])\s+/g, '$1\n')
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (sentences.length <= 1) return [paragraph];

    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (next.length > 360 && current) {
        chunks.push(current);
        current = sentence;
      } else {
        current = next;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  });
}

function normalizeDifficulty(difficulty) {
  if (difficulty === 'easy' || difficulty === 1 || difficulty === '1') return 1;
  if (difficulty === 'hard' || difficulty === 3 || difficulty === '3') return 3;
  const numeric = Number(difficulty);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 2;
}

function isEvidenceOnlyType(type) {
  return ['analysis', 'flashcard', 'translation', 'essay', 'short_answer'].includes(type);
}

function isMultiChoiceType(type) {
  return type === 'multi_choice' || type === 'multiple_choice' || type === '多选';
}

function stripOptionLabel(option) {
  const text =
    typeof option === 'string'
      ? option
      : [option?.label, option?.text || option?.value || option?.content].filter(Boolean).join('. ');
  return String(text || '')
    .trim()
    .replace(/^[A-Z]\s*[.。:：、)\）-]\s*/i, '')
    .trim();
}

function normalizeImageList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const src = item.trim();
        return src ? { src, alt: '', caption: '' } : null;
      }
      const src = String(item?.src || item?.url || item?.path || '').trim();
      if (!src) return null;
      return {
        ...item,
        src,
        alt: item?.alt || item?.caption || '',
        caption: item?.caption || ''
      };
    })
    .filter(Boolean);
}

export function normalizeQuizAnswer(question, type = question?.type) {
  const rawAnswer = question?.answer;
  if (isEvidenceOnlyType(type)) {
    return rawAnswer || '暂无答案';
  }

  const raw = (rawAnswer || 'A').toString().trim().toUpperCase();
  const optionCount = Array.isArray(question?.options) ? Math.max(question.options.length, 4) : 4;
  const allowedLabels = OPTION_LABELS.slice(0, optionCount).join('');
  const compact = raw.replace(/[\s,，、;；/|]+/g, '');

  if (isMultiChoiceType(type) && new RegExp(`^[${allowedLabels}]+$`).test(compact)) {
    const uniqueLabels = Array.from(new Set(compact.split('')));
    return OPTION_LABELS.filter((label) => uniqueLabels.includes(label)).join('');
  }

  const firstLabel = raw.match(new RegExp(`[${allowedLabels}]`))?.[0];
  return firstLabel || 'A';
}

export function normalizeQuizQuestion(question, index = 0, options = {}) {
  if (!question) return null;

  const type = question.type || options.defaultType || '单选';
  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const shouldFillOptions = Boolean(options.fillMissingChoiceOptions) && !isEvidenceOnlyType(type);
  const normalizedOptions =
    shouldFillOptions && rawOptions.length < Number(options.minOptions || 4)
      ? [...FALLBACK_CHOICE_OPTIONS]
      : rawOptions.map(stripOptionLabel);
  const knowledgeNodeIds = asArray(question.knowledgeNodeIds).length
    ? asArray(question.knowledgeNodeIds)
    : asArray(question.knowledge_points);
  const knowledgePoints = asArray(question.knowledge_points).length
    ? asArray(question.knowledge_points)
    : knowledgeNodeIds;
  const passage =
    question.passage ||
    question.reading_material ||
    question.readingMaterial ||
    question.context ||
    question.material ||
    question.article ||
    '';
  const passageSegments = Array.isArray(question.passageSegments)
    ? question.passageSegments
    : splitPassageSegments(passage);
  const eloRating =
    question.eloRating ??
    (typeof options.resolveEloRating === 'function' ? options.resolveEloRating(question) : question.eloRating);

  return {
    ...question,
    quizOriginal: captureQuizOriginal(question),
    id: question.id === 0 ? 0 : question.id || (question._id === 0 ? 0 : question._id || `q_${index}`),
    question:
      question.question ||
      question.question_content ||
      question.questionContent ||
      question.content ||
      question.title ||
      options.defaultQuestion ||
      `题目 ${index + 1}`,
    passage,
    passageSegments,
    context: question.context || passage,
    material: question.material || passage,
    questionImages: normalizeImageList(
      question.questionImages || question.question_images || question.images || question.sourcePageImages
    ),
    answerImages: normalizeImageList(question.answerImages || question.answer_images || question.answerPageImages),
    paperId: question.paperId || question.paper_id || '',
    paperName: question.paperName || question.paper_name || '',
    section: question.section || question.part || '',
    groupId: question.groupId || question.group_id || question.passageId || '',
    fixedSequence: Array.isArray(question.fixedSequence) ? question.fixedSequence : asArray(question.fixed_sequence),
    fixedParagraphs: Array.isArray(question.fixedParagraphs)
      ? question.fixedParagraphs
      : asArray(question.fixed_paragraphs),
    options: normalizedOptions,
    answer: normalizeQuizAnswer(question, type),
    desc: question.desc || question.description || question.explanation || question.analysis || '暂无解析',
    category: question.category || question.subject || '未分类',
    type,
    difficulty: normalizeDifficulty(question.difficulty),
    source: question.source || '',
    year: question.year || '',
    knowledgeNodeIds,
    knowledge_points: knowledgePoints,
    eloRating
  };
}

export function getQuizOptionLabel(question, index) {
  const option = question?.options?.[index] || '';
  const match = String(option)
    .trim()
    .match(/^([A-Z])[\s.。:：、-]/i);
  return match ? match[1].toUpperCase() : OPTION_LABELS[index] || 'A';
}

export function isCorrectQuizOption(question, index) {
  if (!question) return false;
  const correctAnswer = (question.answer || 'A').toString().trim().toUpperCase();
  const optionLabel = getQuizOptionLabel(question, index);
  if (/^[A-Z]{2,}$/.test(correctAnswer)) {
    return correctAnswer.includes(optionLabel);
  }
  if (OPTION_LABELS.slice(0, 4).includes(correctAnswer)) {
    return optionLabel === correctAnswer;
  }
  const optionText = String(question.options?.[index] || '');
  return Boolean(correctAnswer) && (optionText.startsWith(correctAnswer) || optionText.includes(correctAnswer));
}

export function isQuizFlashcardMode(question) {
  if (!question) return false;
  const type = question.type;
  return isEvidenceOnlyType(type) || !question.options?.length;
}

export function hasQuizSelectableOptions(question) {
  return Boolean(question?.options?.length) && !isQuizFlashcardMode(question);
}

export function isQuizMultiChoice(question) {
  return isMultiChoiceType(question?.type);
}

export function getQuizSelectionAnswer(question, selection) {
  if (!hasQuizSelectableOptions(question)) return '';
  const indices = isQuizMultiChoice(question) ? selection : [selection];
  if (!Array.isArray(indices) || !indices.length || new Set(indices).size !== indices.length) return '';
  if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= question.options.length)) return '';
  return [...indices]
    .sort((a, b) => a - b)
    .map((index) => getQuizOptionLabel(question, index))
    .join('');
}

export function isCorrectQuizSelection(question, selection) {
  const selected = getQuizSelectionAnswer(question, selection);
  if (!selected) return false;
  const raw = String(question.answer || '')
    .trim()
    .toUpperCase()
    .replace(/[\s,，、;；/|]+/g, '');
  const allowedLabels = OPTION_LABELS.slice(0, question.options.length).join('');
  if (!raw || !new RegExp(`^[${allowedLabels}]+$`).test(raw)) return false;
  if (!isQuizMultiChoice(question) && raw.length !== 1) return false;
  const expected = OPTION_LABELS.filter((label) => raw.includes(label)).join('');
  return selected === expected;
}

export function getQuizQuestionTypeLabel(question) {
  const type = question?.type;
  return QUESTION_TYPE_LABELS[type] || type || '单选题';
}

export function buildQuizAnswerRecord(input = {}) {
  const question = input.question || {};
  const now = input.now == null ? Date.now() : input.now;
  const record = {
    questionId: question.id ?? question._id ?? input.questionId ?? '',
    index: Number(input.index || 0),
    userChoice: input.userChoice,
    isCorrect: input.source === 'reference_match' ? null : input.isCorrect,
    timeSpent: Number(input.timeSpent || 0),
    answeredAt: now
  };

  [
    'speedScore',
    'elo',
    'rating',
    'source',
    'mode',
    'attemptId',
    'referenceMatch',
    'userAnswer',
    'ownerId',
    'observationId',
    'referenceId'
  ].forEach((key) => {
    if (input[key] !== undefined) {
      record[key] = input[key];
    }
  });

  if (input.source === 'reference_match') record.grade = { status: 'pending' };
  return record;
}

export function upsertQuizAnswerRecord(records = [], record = {}) {
  const normalized = {
    ...record,
    index: Number(record.index || 0),
    questionId: record.questionId ?? ''
  };
  const existingIndex = (records || []).findIndex((item) => {
    const sameIndex = Number(item.index || 0) === normalized.index;
    const sameQuestion = (item.questionId ?? '') === normalized.questionId;
    return sameIndex && sameQuestion;
  });

  if (existingIndex < 0) {
    return [...(records || []), normalized];
  }

  const next = [...records];
  next.splice(existingIndex, 1, {
    ...next[existingIndex],
    ...normalized
  });
  return next;
}

export function getQuizAnswerRecordOutcome(record) {
  if (record?.grade?.status === 'pending' || record?.source === 'reference_match') return 'pending';
  if (
    record?.mode === 'flashcard' ||
    record?.source === 'self_rating' ||
    /^flashcard_(?:flip|rating_)/.test(String(record?.userChoice || ''))
  )
    return 'reviewed';
  // 旧布尔值只能解释为旧判定，缓存中自称 reliable 的字段也不是校验依据。
  if (!record || ['grade', 'submission_contract'].some((key) => Object.prototype.hasOwnProperty.call(record, key)))
    return 'unclassified';
  if (
    Object.prototype.hasOwnProperty.call(record, 'isCorrect') &&
    Object.prototype.hasOwnProperty.call(record, 'correct') &&
    record.isCorrect !== record.correct
  )
    return 'unclassified';
  const value = Object.prototype.hasOwnProperty.call(record, 'isCorrect') ? record.isCorrect : record.correct;
  return value === true ? 'legacy_correct' : value === false ? 'legacy_wrong' : 'unclassified';
}

export function summarizeQuizProgress({ questions = [], answeredQuestions = [], currentIndex = 0 } = {}) {
  const byIndex = new Map();
  const deduped = [];
  for (const record of answeredQuestions || []) {
    const normalized = { ...record, index: Number(record.index || 0), questionId: record.questionId ?? '' };
    // 与 upsert 严格相等一致；旧 NaN 索引在后续查找中按0解释，NaN查询本身从不命中。
    const position =
      Number.isNaN(normalized.index) || Number.isNaN(normalized.questionId)
        ? undefined
        : byIndex.get(normalized.index)?.get(normalized.questionId);
    if (position === undefined) {
      const indexKey = Number(normalized.index || 0);
      if (!byIndex.has(indexKey)) byIndex.set(indexKey, new Map());
      const byQuestion = byIndex.get(indexKey);
      if (!Number.isNaN(normalized.questionId) && !byQuestion.has(normalized.questionId)) {
        byQuestion.set(normalized.questionId, deduped.length);
      }
      deduped.push(normalized);
    } else {
      deduped[position] = { ...deduped[position], ...normalized };
    }
  }
  const outcomes = deduped.map(getQuizAnswerRecordOutcome);
  const count = (value) => outcomes.filter((outcome) => outcome === value).length;
  const legacyCorrectCount = count('legacy_correct');
  const legacyWrongCount = count('legacy_wrong');
  const legacyGradedCount = legacyCorrectCount + legacyWrongCount;
  return {
    total: questions.length,
    currentIndex,
    answeredCount: deduped.length,
    // 当前题库缓存只有参考、旧判定和自评；可靠统计从学习核心读取。
    scoringAuthority: false,
    gradedCount: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracy: null,
    neutralCount: deduped.length,
    pendingCount: count('pending'),
    reviewedCount: count('reviewed'),
    unclassifiedCount: count('unclassified'),
    legacyCorrectCount,
    legacyWrongCount,
    legacyGradedCount,
    legacyAccuracy: legacyGradedCount ? Math.round((100 * legacyCorrectCount) / legacyGradedCount) : null,
    progressRate: questions.length > 0 ? deduped.length / questions.length : 0
  };
}

export function buildQuizCompletionContent({ questions = [], answeredQuestions = [] } = {}) {
  const summary = summarizeQuizProgress({ questions, answeredQuestions });
  if (summary.answeredCount && summary.reviewedCount === summary.answeredCount)
    return `本次查看或自评 ${summary.answeredCount} 题`;
  const parts = [`本次已记录 ${summary.answeredCount} 题`];
  if (summary.pendingCount) parts.push(`${summary.pendingCount} 题待核对`);
  if (summary.reviewedCount) parts.push(`${summary.reviewedCount} 题已查看/自评`);
  if (summary.legacyGradedCount) parts.push(`${summary.legacyGradedCount} 题旧记录`);
  if (summary.unclassifiedCount) parts.push(`${summary.unclassifiedCount} 题判分依据不明`);
  return parts.join('，');
}

export function buildQuizKnowledgeFeedback({
  activity = {},
  question = {},
  node = null,
  trail = [],
  visual = null,
  speedScore = 0
} = {}) {
  const nodeId = activity?.nodeIds?.[0] || '';
  const visualState = visual || { state: 'unknown', color: '#DDE8DD', mastery: 0 };
  const stateText = KNOWLEDGE_STATE_LABELS[visualState.state] || '已记录';
  const masteryText = `${visualState.mastery || 0}%`;
  const normalizedTrail = (trail || []).map((item) => ({
    id: item.id,
    label: item.label,
    type: item.type,
    tracks: item.tracks || []
  }));

  return {
    nodeId,
    label: node?.label || question.category || '公共课综合',
    color: visualState.color || '#DDE8DD',
    speedScore: activity?.speedScore ?? speedScore,
    tracks: node?.tracks || [],
    trail: normalizedTrail,
    chainText: normalizedTrail.length > 1 ? normalizedTrail.map((item) => item.label).join(' / ') : '',
    summary: `${stateText}，当前掌握 ${masteryText}，已记录到复习计划`
  };
}
