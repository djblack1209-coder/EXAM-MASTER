import {
  captureQuizOriginal,
  validateCapturedQuizOriginal,
  validateQuizOriginalData,
  assertQuizOriginalDisplay,
  quizOriginalIdentity
} from './learning-quiz-original.js';

export const LEGACY_IMPORT_CONTRACT = 'legacy-mistake-import-v1';
const stateFields = [
  'wrong_count',
  'wrongCount',
  'review_count',
  'reviewCount',
  'is_mastered',
  'isMastered',
  'mastered_at',
  'last_practice_time',
  'last_review_time',
  'lastReviewTime',
  'next_review_time',
  'nextReviewTime',
  'ease_factor',
  'easeFactor',
  'interval_days',
  'intervalDays',
  'due',
  'stability',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
  'state',
  'last_review'
];
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const check = (condition, code, message) => {
  if (!condition) throw Object.assign(new Error(message), { code });
};
const present = (value) => value !== undefined && value !== null && value !== '';
const prompt = (value) =>
  value.question_content ?? value.questionContent ?? value.question ?? value.content ?? value.title;
const answer = (value) => value.user_answer ?? value.userAnswer ?? value.userChoice ?? '';

export function prepareLegacyMistakeImport(data) {
  check(record(data), 'INVALID_INPUT', '历史记录必须是对象');
  const input = data.legacy_raw ?? data;
  check(record(input), 'INVALID_INPUT', '历史原件必须是对象');
  check(JSON.stringify(input).length <= 1800000, 'RESOURCE_LIMIT', '历史原件超过保存上限，请保留原件后分段处理');
  validateQuizOriginalData(input);
  const raw = JSON.parse(JSON.stringify(input));
  const localId = data._local_id ?? raw.id ?? raw._id;
  const importKey = raw.import_key ?? localId ?? 'content';
  check(
    (typeof importKey === 'string' && importKey.trim() && importKey.length <= 160) ||
      (typeof importKey === 'number' && Number.isSafeInteger(importKey)),
    'INVALID_INPUT',
    '历史记录编号不合法'
  );
  const questionId = [raw.question_id, raw.questionId, raw.id, raw._id].find(present) ?? 'legacy-import';
  // Preserve raw aliases before the transport/display normalization. A generated archive ID grants no source authority.
  const source = { ...raw, id: questionId };
  const question = validateCapturedQuizOriginal(captureQuizOriginal(source));
  assertQuizOriginalDisplay(source, question);
  check(typeof answer(raw) === 'string' && answer(raw).length <= 8000, 'INVALID_INPUT', '历史原答必须是有界文字');
  if (data.legacy_raw) {
    check(
      (data.question_content === undefined || data.question_content === prompt(raw)) &&
        (data.user_answer === undefined || data.user_answer === answer(raw)),
      'SOURCE_MISMATCH',
      '发送内容与历史原件不一致'
    );
  }
  const state = {};
  for (const key of stateFields)
    if (raw[key] !== undefined) {
      const value = raw[key];
      check(
        value === null ||
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
          (typeof value === 'string' && value.length <= 100),
        'INVALID_INPUT',
        '历史状态格式不合法'
      );
      state[key] = value;
    }
  const metadata = {};
  for (const key of ['created_at', 'createdAt', 'addTime', 'updated_at'])
    if (raw[key] !== undefined) {
      check(
        typeof raw[key] === 'number' && Number.isFinite(raw[key]) && raw[key] >= 0,
        'INVALID_INPUT',
        '历史时间格式不合法'
      );
      metadata[key] = raw[key];
    }
  if (raw.tags !== undefined) {
    check(
      Array.isArray(raw.tags) &&
        raw.tags.length <= 20 &&
        raw.tags.every((tag) => typeof tag === 'string' && tag.length <= 50),
      'INVALID_INPUT',
      '历史标签超过保存范围'
    );
    metadata.tags = raw.tags;
  }
  const notes = raw.notes !== undefined ? raw.notes : raw.note;
  if (notes !== undefined) {
    check(
      notes === null || (typeof notes === 'string' && notes.length <= 2000),
      'INVALID_INPUT',
      '历史笔记超过保存范围'
    );
    metadata.notes = notes;
  }
  const original = { contract: LEGACY_IMPORT_CONTRACT, question, answer: answer(raw), state, metadata };
  const content = { question, answer: original.answer };
  const fields = question.fields;
  const display = {
    ...fields,
    question_content:
      fields.question_content ?? fields.questionContent ?? fields.question ?? fields.content ?? fields.title,
    options: fields.options ?? fields.choices ?? fields.option_list ?? [],
    user_answer: original.answer,
    correct_answer: fields.correct_answer ?? fields.correctAnswer ?? fields.answer ?? '',
    analysis: fields.analysis ?? fields.desc ?? fields.description ?? fields.explanation ?? ''
  };
  for (const [key, alias] of [
    ['wrong_count', 'wrongCount'],
    ['review_count', 'reviewCount'],
    ['is_mastered', 'isMastered']
  ]) {
    if (state[key] !== undefined || state[alias] !== undefined) display[key] = state[key] ?? state[alias];
  }
  for (const key of ['error_type', 'difficulty'])
    if (raw[key] !== undefined) {
      check(typeof raw[key] === 'string' && raw[key].length <= 50, 'INVALID_INPUT', '历史分类格式不合法');
      display[key] = raw[key];
    }
  return { original, content, display, metadata, importKey: String(importKey), localId, targetId: raw._id ?? raw.id };
}

export const sameLegacyOriginalContent = (left, right) =>
  quizOriginalIdentity({ question: left.question, answer: left.answer }) ===
  quizOriginalIdentity({ question: right.question, answer: right.answer });
export const sameLegacyOriginalState = (left, right) =>
  quizOriginalIdentity(left.state) === quizOriginalIdentity(right.state);
