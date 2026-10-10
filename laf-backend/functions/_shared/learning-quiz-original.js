// Preserve source claims as private originals; they never grant grading or publication authority.
export const QUIZ_ORIGINAL_CONTRACT = 'quiz-original-v1';
export const QUIZ_ORIGINAL_MAX_CHARACTERS = 1800000;
const FIELDS = Object.freeze([
  'question',
  'question_content',
  'questionContent',
  'content',
  'title',
  'options',
  'choices',
  'option_list',
  'type',
  'passage',
  'reading_material',
  'readingMaterial',
  'context',
  'material',
  'article',
  'passageSegments',
  'passage_segments',
  'targetSegment',
  'target_segment',
  'questionImages',
  'question_images',
  'images',
  'sourcePageImages',
  'answerImages',
  'answer_images',
  'answerPageImages',
  'audio',
  'audio_url',
  'audioSrc',
  'answer',
  'correct_answer',
  'correctAnswer',
  'desc',
  'description',
  'explanation',
  'analysis',
  'source',
  'importContext',
  'paper',
  'paperMeta',
  'provenance',
  'sourceEvidenceId',
  'sourceSha256',
  'source_sha256',
  'fingerprint',
  'sourceLicense',
  'license',
  'version',
  'question_version',
  'sourceVersion',
  'answerEvidenceStatus',
  'answerSource',
  'bankId',
  'bankName',
  'subject',
  'chapter',
  'category',
  'knowledgePoint',
  'sub_category',
  'knowledge_points',
  'year',
  'paperId',
  'paper_id',
  'paperName',
  'paper_name',
  'section',
  'part',
  'fixedSequence',
  'fixed_sequence',
  'fixedParagraphs',
  'fixed_paragraphs',
  'sectionId',
  'questionNumber',
  'groupId',
  'group_id',
  'passageId'
]);
const check = (condition, code, message) => {
  if (!condition) throw Object.assign(new Error(message), { code });
};
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : record(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])])
        )
      : value;
export const quizOriginalIdentity = (original) => JSON.stringify(canonical(original));

// Only the display projection changes; labelled option objects stay in the original.
export function quizOriginalOptionText(option, index) {
  const label = record(option) ? option.label : undefined;
  if (label !== undefined && (typeof label !== 'string' || label.toUpperCase() !== 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index]))
    return null;
  const text =
    typeof option === 'string' ? option : record(option) ? (option.text ?? option.value ?? option.content) : null;
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) return null;
  const prefix = text.trim().match(/^([A-Z])\s*[.。:：、)\）-]\s*/i)?.[1];
  if (prefix && prefix.toUpperCase() !== 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index]) return null;
  return (
    text
      .trim()
      .replace(/^[A-Z]\s*[.。:：、)\）-]\s*/i, '')
      .trim() || null
  );
}

export function quizOriginalChoiceOptions(options) {
  if (!Array.isArray(options) || options.length > 26) return null;
  const display = options.map(quizOriginalOptionText);
  return display.some((text) => text === null) ? null : display;
}

function checkedOriginal(original) {
  check(
    record(original) &&
      original.contract === QUIZ_ORIGINAL_CONTRACT &&
      record(original.fields) &&
      Object.keys(original).every((key) => ['contract', 'id', 'namespace', 'fields'].includes(key)) &&
      Object.keys(original.fields).every((key) => FIELDS.includes(key)),
    'INVALID_INPUT',
    '原题资料合同不合法'
  );
  check(
    (typeof original.id === 'string' && original.id.trim() && original.id.length <= 160) ||
      (typeof original.id === 'number' && Number.isSafeInteger(original.id)),
    'INVALID_INPUT',
    '原题编号不合法'
  );
  check(
    typeof original.namespace === 'string' && original.namespace.trim() && original.namespace.length <= 160,
    'INVALID_INPUT',
    '原题范围不合法'
  );
  check(
    JSON.stringify(original).length <= QUIZ_ORIGINAL_MAX_CHARACTERS,
    'RESOURCE_LIMIT',
    '原题资料超过保存上限，请保留原件并分段处理'
  );
  const fields = original.fields;
  const prompt = fields.question || fields.question_content || fields.questionContent || fields.content || fields.title;
  check(typeof prompt === 'string' && prompt.trim() && prompt.length <= 8000, 'INVALID_INPUT', '原题题干为空或过长');
  const options = fields.options ?? fields.choices ?? fields.option_list;
  check(options === undefined || quizOriginalChoiceOptions(options) !== null, 'INVALID_INPUT', '原题选项不合法');
  validateQuizOriginalData(original.fields);
  return original;
}

export function validateQuizOriginalData(value) {
  let entries = 0;
  const visit = (value, depth = 0) => {
    check(depth <= 12 && ++entries <= 20000, 'RESOURCE_LIMIT', '原题资料结构超过保存上限');
    if (typeof value === 'string') {
      for (let url of value.match(/https?:\/\/[^\s]+/gi) || []) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            url = decodeURIComponent(url);
          } catch {
            break;
          }
        }
        check(
          !/[?&](?:token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|jwt|secret|password)=/i.test(
            url
          ) && !/^https?:\/\/[^/]*@/i.test(url),
          'FORBIDDEN',
          '原题来源不能包含访问凭据'
        );
      }
    } else if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1));
    else if (record(value))
      for (const [key, item] of Object.entries(value)) {
        check(
          !/^(?:token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|jwt|secret|password|headers|__proto__|constructor|prototype)$/i.test(
            key
          ),
          'FORBIDDEN',
          '原题来源不能包含访问凭据或程序属性'
        );
        visit(item, depth + 1);
      }
    else
      check(
        value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)),
        'INVALID_INPUT',
        '原题资料只能包含可保存的文字与数据'
      );
  };
  visit(value);
}

export const validateCapturedQuizOriginal = (original) => checkedOriginal(original);

export function captureQuizOriginal(question) {
  if (question.quizOriginal) return JSON.parse(JSON.stringify(question.quizOriginal));
  const fields = Object.fromEntries(
    FIELDS.filter((key) => question[key] !== undefined).map((key) => [key, question[key]])
  );
  return JSON.parse(
    JSON.stringify({
      contract: QUIZ_ORIGINAL_CONTRACT,
      id: question.id ?? question._id ?? null,
      namespace: String(question.bankId || question.subject || 'legacy'),
      fields
    })
  );
}
export function createQuizOriginal(question) {
  const captured = captureQuizOriginal(question);
  check(String(captured.id) === String(question.id), 'SOURCE_MISMATCH', '题目编号与保存的原件不一致');
  return checkedOriginal({ ...captured, namespace: String(question.bankId || question.subject || 'legacy') });
}

export function assertQuizOriginalDisplay(question, original) {
  if (!question.quizOriginal) return;
  const fields = original.fields;
  const reading = (value) =>
    value.passage ||
    value.reading_material ||
    value.readingMaterial ||
    value.context ||
    value.material ||
    value.article ||
    '';
  const images = (value) =>
    value.questionImages || value.question_images || value.images || value.sourcePageImages || [];
  const normalizeImages = (value) =>
    Array.isArray(value)
      ? value
          .map((item) =>
            typeof item === 'string'
              ? { src: item.trim(), alt: '', caption: '' }
              : {
                  ...item,
                  src: String(item?.src || item?.url || item?.path || '').trim(),
                  alt: item?.alt || item?.caption || '',
                  caption: item?.caption || ''
                }
          )
          .filter((item) => item.src)
      : [];
  const same = (a, b) => quizOriginalIdentity(a ?? null) === quizOriginalIdentity(b ?? null);
  check(
    same(reading(question), reading(fields)) &&
      same(question.targetSegment ?? question.target_segment, fields.targetSegment ?? fields.target_segment) &&
      same(question.source || '', fields.source || '') &&
      same(
        question.audio ?? question.audio_url ?? question.audioSrc,
        fields.audio ?? fields.audio_url ?? fields.audioSrc
      ) &&
      (same(images(question), images(fields)) || same(images(question), normalizeImages(images(fields)))) &&
      [
        'sourceEvidenceId',
        'sourceSha256',
        'source_sha256',
        'sourceLicense',
        'license',
        'version',
        'question_version',
        'sourceVersion'
      ].every((key) => same(question[key], fields[key])),
    'SOURCE_MISMATCH',
    '显示的资料或来源与保存的原件不一致'
  );
}

export function validateQuizOriginalQuestion(question) {
  if (!question?.quizOriginal) return;
  const original = checkedOriginal(question.quizOriginal),
    fields = original.fields;
  check(
    question.scope === 'legacy' && question.source?.kind === 'existing_bank' && !question.validation,
    'FORBIDDEN',
    '历史原题不授予判分或发布权限'
  );
  check(
    question.id === `bank_${original.namespace}_${original.id}` &&
      question.prompt ===
        (fields.question || fields.question_content || fields.questionContent || fields.content || fields.title) &&
      [
        fields.options ?? fields.choices ?? fields.option_list ?? [],
        quizOriginalChoiceOptions(fields.options ?? fields.choices ?? fields.option_list ?? []),
        ...(['analysis', 'flashcard', 'translation', 'essay', 'short_answer'].includes(fields.type) ? [[]] : [])
      ].some((options) => quizOriginalIdentity(question.options || []) === quizOriginalIdentity(options)) &&
      question.source.sourceEvidenceId === (fields.sourceEvidenceId || null),
    'SOURCE_MISMATCH',
    '题目与保存的原题资料不一致'
  );
}

export function quizOriginalReading(question) {
  const fields = question?.quizOriginal?.fields;
  if (!fields) return { readings: [], target: '', source: '', license: '', images: [], audio: null };
  const readings = [];
  for (const [key, label] of [
    ['passage', '阅读材料'],
    ['reading_material', '阅读材料'],
    ['readingMaterial', '阅读材料'],
    ['context', '原题背景'],
    ['material', '原题材料'],
    ['article', '原题正文']
  ]) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim() && !readings.some((item) => item.text === value))
      readings.push({ label, text: value });
  }
  if (!readings.length) {
    const segments = fields.passageSegments ?? fields.passage_segments;
    if (Array.isArray(segments))
      for (const segment of segments) {
        const text = typeof segment === 'string' ? segment : (segment?.content ?? segment?.text);
        if (typeof text === 'string' && text.trim()) readings.push({ label: '原题段落', text });
      }
  }
  const media = fields.questionImages ?? fields.question_images ?? fields.images ?? fields.sourcePageImages ?? [];
  return {
    readings,
    target: fields.targetSegment ?? fields.target_segment ?? '',
    source:
      typeof (fields.source ?? fields.importContext?.source) === 'string'
        ? (fields.source ?? fields.importContext?.source)
        : ((fields.source ?? fields.importContext?.source)?.title ??
          (fields.source ?? fields.importContext?.source)?.name ??
          ''),
    license:
      fields.sourceLicense ??
      fields.license ??
      fields.importContext?.sourceLicense ??
      fields.importContext?.license ??
      '',
    images: Array.isArray(media) ? media : [media],
    audio: fields.audio ?? fields.audio_url ?? fields.audioSrc ?? null
  };
}
