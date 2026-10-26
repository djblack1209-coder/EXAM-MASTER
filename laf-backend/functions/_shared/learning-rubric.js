/* global __YOZI_DEV_TEST__ */
import { historyChecksum } from './learning-history.js';
// 主观评分合同只约束维度、分数和原答引用，不证明模型语义判断正确。
export const RUBRIC_CONTRACT = 'subjective-rubric-v1';
export const RUBRIC_EVIDENCE_CONTRACT = 'subjective-rubric-v2';
export const WRITING_FEEDBACK_OUTPUT_CONTRACT = 'writing-feedback-output-v1';
function requireValue(condition, message, code = 'INVALID_INPUT') {
  if (!condition) throw Object.assign(new Error(message), { code });
}
function fields(value, allowed) {
  requireValue(
    value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((k) => allowed.includes(k)),
    '评分合同含有不支持的字段'
  );
}
function content(value, limit) {
  requireValue(typeof value === 'string' && value.trim() && value.length <= limit, '评分内容为空或过长');
  return value.trim();
}
function halfPoint(value) {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value * 2);
}
export function normalizeRubric(value) {
  fields(value, ['id', 'version', 'source', 'criteria']);
  requireValue(value.version === 1, '评分维度版本不支持');
  fields(value.source, ['kind', 'reference']);
  requireValue(
    ['user_defined', 'reference_candidate', 'model_generated', 'project_original'].includes(value.source.kind),
    '评分维度来源不支持，不能自行声明权威'
  );
  requireValue(
    Array.isArray(value.criteria) && value.criteria.length > 0 && value.criteria.length <= 6,
    '评分需要1至6个维度'
  );
  const criteria = value.criteria.map((criterion) => {
    fields(criterion, ['id', 'name', 'description', 'maxScore']);
    requireValue(
      halfPoint(criterion.maxScore) && criterion.maxScore > 0 && criterion.maxScore <= 10,
      '每个维度满分应为0.5至10分，按0.5分递增'
    );
    return {
      id: content(criterion.id, 80),
      name: content(criterion.name, 100),
      description: content(criterion.description, 500),
      maxScore: criterion.maxScore
    };
  });
  requireValue(new Set(criteria.map((c) => c.id)).size === criteria.length, '评分维度标识不能重复');
  requireValue(criteria.reduce((n, c) => n + c.maxScore, 0) <= 30, '评分维度合计最多30分');
  return {
    id: content(value.id, 160),
    version: 1,
    source: {
      kind: value.source.kind,
      reference: value.source.reference ? content(value.source.reference, 500) : null
    },
    criteria
  };
}
function assessLegacyRubric(question, attempt, input) {
  const rubric = normalizeRubric(question.rubric);
  requireValue(input.rubricId === rubric.id, '评估需绑定当前题目版本的评分维度', 'PRECONDITION');
  requireValue(
    Array.isArray(input.dimensions) && input.dimensions.length === rubric.criteria.length,
    '评估应逐一覆盖已定义维度'
  );
  requireValue(
    new Set(input.dimensions.map((d) => d?.criterionId)).size === rubric.criteria.length,
    '评估维度不能重复'
  );
  const dimensions = rubric.criteria.map((criterion) => {
    const dimension = input.dimensions.find((d) => d?.criterionId === criterion.id);
    fields(dimension, ['criterionId', 'score', 'feedback', 'evidence']);
    requireValue(
      dimension.score === null ||
        (halfPoint(dimension.score) && dimension.score >= 0 && dimension.score <= criterion.maxScore),
      '评分不能超出本维度满分；无法判断应使用null'
    );
    requireValue(Array.isArray(dimension.evidence) && dimension.evidence.length <= 3, '每个维度最多引用3段原答');
    const evidence = dimension.evidence.map((quote) => {
      const exact = content(quote, 250);
      requireValue(attempt.answer.includes(exact), '评估引用必须确实出现在绑定的用户原答中');
      return exact;
    });
    requireValue(dimension.score === null || evidence.length > 0, '给分需要原答引用，无法定位依据应保留待核对');
    return { ...criterion, score: dimension.score, feedback: content(dimension.feedback, 500), evidence };
  });
  const score = dimensions.some((d) => d.score === null) ? null : dimensions.reduce((n, d) => n + d.score, 0);
  const maxScore = rubric.criteria.reduce((n, c) => n + c.maxScore, 0);
  const outcome = score === null ? 'uncertain' : score === maxScore ? 'correct' : score === 0 ? 'wrong' : 'partial';
  requireValue(input.outcome === outcome, '辅助结果应按公开总分规则表达；缺分时为uncertain');
  requireValue(
    !question.uncertainties?.some((u) => !u.resolved) || score === null,
    '关键题目条件未校对，不能给出确定评分',
    'PRECONDITION'
  );
  return {
    contract: RUBRIC_CONTRACT,
    rubricId: rubric.id,
    questionKey: `${question.id}@${question.version}`,
    dimensions,
    score,
    maxScore,
    outcomePolicy: 'rubric-total-v1'
  };
}

function evidenceLocation(answer, value) {
  const explicit = typeof value !== 'string';
  if (explicit) fields(value, ['quote', 'start', 'end']);
  const quote = explicit ? value.quote : value;
  requireValue(typeof quote === 'string' && quote.trim() && quote.length <= 250, '原答引用为空或过长');
  const starts = [];
  for (let from = 0; from <= answer.length;) {
    const found = answer.indexOf(quote, from);
    if (found < 0) break;
    starts.push(found);
    from = found + 1;
  }
  requireValue(starts.length > 0, '评估引用必须确实出现在绑定的用户原答中');
  if (!explicit) requireValue(starts.length === 1, '原答中有重复文字，请扩展引用或明确其范围', 'AMBIGUOUS_EVIDENCE');
  const start = explicit ? value.start : starts[0];
  const end = explicit ? value.end : start + quote.length;
  requireValue(
    Number.isSafeInteger(start) &&
      Number.isSafeInteger(end) &&
      start >= 0 &&
      end > start &&
      end <= answer.length &&
      end - start === quote.length,
    '原答引用范围不合法'
  );
  const boundary = (index) =>
    !(
      index > 0 &&
      index < answer.length &&
      answer.charCodeAt(index - 1) >= 0xd800 &&
      answer.charCodeAt(index - 1) <= 0xdbff &&
      answer.charCodeAt(index) >= 0xdc00 &&
      answer.charCodeAt(index) <= 0xdfff
    );
  requireValue(
    boundary(start) && boundary(end) && answer.slice(start, end) === quote,
    '原答引用范围与原文不匹配，不能截断字符'
  );
  return {
    quote,
    start,
    end,
    startCharacter: Array.from(answer.slice(0, start)).length + 1,
    endCharacter: Array.from(answer.slice(0, end)).length,
    occurrence: starts.indexOf(start) + 1,
    occurrences: starts.length,
    before: Array.from(answer.slice(0, start)).slice(-24).join(''),
    after: Array.from(answer.slice(end)).slice(0, 24).join('')
  };
}

export function assessWithRubric(question, attempt, input) {
  requireValue(input && typeof input === 'object' && !Array.isArray(input), '评分输入不合法');
  requireValue(
    input.rubricContract === undefined || [RUBRIC_CONTRACT, RUBRIC_EVIDENCE_CONTRACT].includes(input.rubricContract),
    '评分引用合同版本不支持'
  );
  // 未声明新合同的历史事件保持原规则，不重写旧评分和引用。
  if (input.rubricContract !== RUBRIC_EVIDENCE_CONTRACT) return assessLegacyRubric(question, attempt, input);
  fields(input, [
    'rubricContract',
    'rubricId',
    'outcome',
    'dimensions',
    'feedback',
    'attemptId',
    'conversationId',
    'model'
  ]);
  requireValue(
    typeof attempt?.id === 'string' &&
      attempt.id.length > 0 &&
      typeof attempt.answer === 'string' &&
      attempt.answer.length > 0 &&
      attempt.answer.length <= 10000,
    '评分需要完整绑定的原答',
    'PRECONDITION'
  );
  requireValue(!input.attemptId || input.attemptId === attempt.id, '评分引用与原答标识不匹配', 'PRECONDITION');
  requireValue(
    Array.isArray(input.dimensions) && input.dimensions.length > 0 && input.dimensions.length <= 6,
    '评估需要1至6个已定义维度'
  );
  requireValue(
    !question.uncertainties?.some((u) => !u.resolved) || input.dimensions.every((d) => d?.score === null),
    '题目疑义未校对，各评分维度应保持未定分',
    'PRECONDITION'
  );
  const locations = input.dimensions.map((dimension) => {
    fields(dimension, ['criterionId', 'score', 'feedback', 'evidence']);
    requireValue(Array.isArray(dimension.evidence) && dimension.evidence.length <= 3, '每个维度最多引用3段原答');
    const values = dimension.evidence.map((value) => evidenceLocation(attempt.answer, value));
    requireValue(
      new Set(values.map((v) => `${v.start}:${v.end}`)).size === values.length,
      '同一评分维度不能重复引用同一处原答',
      'DUPLICATE_EVIDENCE'
    );
    return values;
  });
  const normalized = {
    ...input,
    dimensions: input.dimensions.map((d, i) => ({
      ...d,
      evidence: locations[i].map((v) => v.quote)
    }))
  };
  const assessment = assessLegacyRubric(question, attempt, normalized);
  return {
    ...assessment,
    contract: RUBRIC_EVIDENCE_CONTRACT,
    attemptId: attempt.id,
    evidencePolicy: 'original-answer-range-v1',
    dimensions: assessment.dimensions.map((dimension) => {
      const index = input.dimensions.findIndex((d) => d.criterionId === dimension.id);
      return { ...dimension, evidence: locations[index].map((v) => v.quote), evidenceLocations: locations[index] };
    })
  };
}

// Only the identity/policy travels with client results; teaching tables remain offline.
export const WRITING_BAND_RESULT_CONTRACT = 'writing-band-result-v1';
export const WRITING_BAND_PROMPT_VERSION = 'writing-band-observations-v1';
export const WRITING_BAND_GUIDED_PROMPT_VERSION = 'writing-band-guided-observations-v2';
export const WRITING_BAND_LOCATED_PROMPT_VERSION = 'writing-band-guided-observations-v3';
const nonempty = (s) => typeof s === 'string' && s.trim().length > 0;
export function writingBandRubric(exam, essayType) {
  requireValue(
    ['english1', 'english2'].includes(exam) && ['small', 'large'].includes(essayType),
    'English writing type required'
  );
  const section = essayType === 'large' ? 'B' : 'A';
  return Object.freeze({
    id: `kaoyan-${exam}-${section.toLowerCase()}-foundation-v1`,
    version: 1,
    section,
    sourceTier: exam === 'english1' ? 'unverified' : 'secondary_unverified'
  });
}
export function writingAnswerHash(value) {
  return `fnv1a32:${historyChecksum(value)}:${value.length}`;
}
export function normalizeWritingBandContext(value, request) {
  fields(value, [
    'contract',
    'requestId',
    'promptVersion',
    'submissionId',
    'answerHash',
    'taskId',
    'taskVersion',
    'rubricId',
    'rubricVersion'
  ]);
  const rubric = writingBandRubric(request.exam, request.essayType);
  requireValue(
    request.phase === 'essay' &&
      value.contract === WRITING_BAND_RESULT_CONTRACT &&
      (value.promptVersion === WRITING_BAND_PROMPT_VERSION ||
        (typeof __YOZI_DEV_TEST__ !== 'undefined' &&
          __YOZI_DEV_TEST__ === true &&
          [WRITING_BAND_GUIDED_PROMPT_VERSION, WRITING_BAND_LOCATED_PROMPT_VERSION].includes(value.promptVersion))) &&
      value.rubricId === rubric.id &&
      value.rubricVersion === rubric.version &&
      Number.isSafeInteger(value.taskVersion) &&
      value.taskVersion > 0 &&
      value.answerHash === writingAnswerHash(request.input),
    '全文观察需绑定原答、量规和提示版本'
  );
  return {
    contract: WRITING_BAND_RESULT_CONTRACT,
    requestId: content(value.requestId, 160),
    promptVersion: value.promptVersion,
    submissionId: content(value.submissionId, 160),
    answerHash: value.answerHash,
    taskId: content(value.taskId, 160),
    taskVersion: value.taskVersion,
    rubricId: rubric.id,
    rubricVersion: rubric.version
  };
}
export function writingBandBinding(context) {
  return Object.fromEntries(
    ['submissionId', 'answerHash', 'taskId', 'taskVersion', 'rubricId', 'rubricVersion', 'requestId'].map((key) => [
      key,
      context[key]
    ])
  );
}
export function writingBandExample(context, input) {
  const quote = Array.from(input).slice(0, 120).join('');
  return {
    contract: WRITING_BAND_RESULT_CONTRACT,
    binding: writingBandBinding(context),
    status: 'observation_only',
    nullReason: null,
    band: null,
    bandRange: null,
    scoreEstimate: null,
    maxScore: null,
    taskCoverage: [],
    observations: [{ key: 'language', evidenceSpans: [{ quote, start: 0, end: quote.length }], note: '' }],
    integrityFlags: []
  };
}
export const WRITING_BAND_NULL_REASONS = Object.freeze([
  'task_data_missing',
  'task_data_conflict',
  'model_output_invalid',
  'evidence_invalid'
]);

// Independent contract, not a v1/v2 adapter. The caller must supply the current guarded host/request.
// No semantic accuracy, official score, persistence or model invocation is implied by normalization.
export function normalizeWritingBandResult(
  value,
  { submission, task, rubric, request, promptVersion, modelTexts = [], systemNullReason = null }
) {
  const fields = (object, keys) =>
    requireValue(
      object &&
        typeof object === 'object' &&
        !Array.isArray(object) &&
        Object.keys(object).every((key) => keys.includes(key)),
      'unsupported result field'
    );
  const identity = writingBandRubric(request?.request?.exam, request?.request?.essayType);
  requireValue(
    rubric && ['id', 'version', 'section', 'sourceTier'].every((key) => rubric[key] === identity[key]),
    'English rubric binding'
  );
  requireValue(
    submission?.authorship === 'user_typed' &&
      nonempty(submission.submissionId) &&
      nonempty(submission.text) &&
      submission.text.length <= 12004 &&
      Number.isFinite(submission.submittedAt) &&
      submission.submittedAt >= 0 &&
      nonempty(submission.taskId) &&
      Number.isSafeInteger(submission.taskVersion) &&
      submission.taskVersion > 0 &&
      task?.taskId === submission.taskId &&
      task.taskVersion === submission.taskVersion &&
      nonempty(task.prompt) &&
      submission.answerHash === writingAnswerHash(submission.text),
    'explicit original submission and task binding required'
  );
  requireValue(
    request?.status === 'pending' &&
      nonempty(request.id) &&
      nonempty(request.binding) &&
      nonempty(request.modelId) &&
      request.request?.phase === 'essay' &&
      request.request.input === submission.text &&
      request.request.task === task.prompt &&
      rubric.id.includes(`-${request.request.exam}-`) &&
      ['small', 'large'].includes(request.request.essayType) &&
      rubric.section === (request.request.essayType === 'large' ? 'B' : 'A') &&
      nonempty(promptVersion),
    'current pending request binding required'
  );
  fields(value, [
    'contract',
    'binding',
    'status',
    'nullReason',
    'band',
    'bandRange',
    'scoreEstimate',
    'maxScore',
    'taskCoverage',
    'observations',
    'integrityFlags'
  ]);
  requireValue(value.contract === WRITING_BAND_RESULT_CONTRACT, 'result contract');
  const binding = {
    submissionId: submission.submissionId,
    answerHash: submission.answerHash,
    taskId: task.taskId,
    taskVersion: task.taskVersion,
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    requestId: request.id
  };
  fields(value.binding, Object.keys(binding));
  requireValue(
    Object.entries(binding).every(([key, expected]) => value.binding[key] === expected),
    'result binding'
  );
  requireValue(['observation_only', 'null'].includes(value.status), 'numeric assessment is unavailable');
  requireValue(
    ['band', 'bandRange', 'scoreEstimate', 'maxScore'].every((key) => value[key] === null),
    'numeric fields must be null'
  );
  requireValue(
    value.status === 'null'
      ? WRITING_BAND_NULL_REASONS.includes(value.nullReason) && value.nullReason === systemNullReason
      : value.nullReason == null,
    'only a program-confirmed system/task failure may produce null'
  );
  const data = rubric.section === 'B' ? task[request.request.exam === 'english1' ? 'visualFacts' : 'chartData'] : null;
  const hasData = Array.isArray(data) && data.length > 0 && data.every((datum) => nonempty(datum?.id));
  const conflict = task.dataConflict === true;
  if (value.status === 'null' && value.nullReason === 'task_data_missing')
    requireValue(rubric.section === 'B' && !hasData, 'task data is not missing');
  if (value.status === 'null' && value.nullReason === 'task_data_conflict')
    requireValue(conflict, 'task conflict not confirmed');
  const points = Array.isArray(task.taskPoints) ? task.taskPoints : [];
  requireValue(
    points.length <= 24 &&
      points.every((point) => nonempty(point?.id)) &&
      new Set(points.map((point) => point.id)).size === points.length,
    'task point identities'
  );
  const spans = (items, minimum = 1, locate = false) => {
    requireValue(Array.isArray(items) && items.length >= minimum && items.length <= 3, 'evidence spans');
    return items.map((span) => {
      requireValue(span && typeof span === 'object' && !Array.isArray(span), 'explicit UTF-16 evidence required');
      if (locate) fields(span, ['quote', 'start', 'end']);
      return evidenceLocation(submission.text, locate ? span.quote : span);
    });
  };
  requireValue(
    Array.isArray(value.taskCoverage) && value.taskCoverage.length === points.length,
    'no invented task points'
  );
  const taskCoverage = points.map((point) => {
    const entries = value.taskCoverage.filter((item) => item?.taskPointId === point.id);
    requireValue(entries.length === 1, 'task point coverage binding');
    const entry = entries[0];
    fields(entry, ['taskPointId', 'status', 'evidence', 'nullReason']);
    if (value.status === 'null') {
      requireValue(
        entry.status === null &&
          entry.nullReason === value.nullReason &&
          Array.isArray(entry.evidence) &&
          !entry.evidence.length,
        'system null cannot judge task coverage'
      );
      return { taskPointId: point.id, status: null, evidence: [], nullReason: value.nullReason };
    }
    const unavailable = rubric.section === 'B' && point.requiresData !== false && (!hasData || conflict);
    if (unavailable) {
      const reason = conflict ? 'task_data_conflict' : 'task_data_missing';
      requireValue(
        entry.status === null && entry.nullReason === reason && Array.isArray(entry.evidence) && !entry.evidence.length,
        'missing author data cannot judge the student'
      );
      return { taskPointId: point.id, status: null, evidence: [], nullReason: reason };
    }
    requireValue(
      ['covered', 'partial', 'absent'].includes(entry.status) && entry.nullReason == null,
      'task coverage status'
    );
    return {
      taskPointId: point.id,
      status: entry.status,
      evidence: spans(entry.evidence, entry.status === 'absent' ? 0 : 1),
      nullReason: null
    };
  });
  requireValue(Array.isArray(value.observations) && value.observations.length <= 5, 'observations');
  requireValue(
    Array.isArray(modelTexts) && modelTexts.length <= 64 && modelTexts.every((text) => typeof text === 'string'),
    'known model text'
  );
  const scaffolds = task.patterns?.flat() || [];
  const knownModelTexts = modelTexts.filter((text) => nonempty(text) && !scaffolds.includes(text));
  const copied = (span) => knownModelTexts.some((text) => span.quote.includes(text));
  const guided =
    typeof __YOZI_DEV_TEST__ !== 'undefined' &&
    __YOZI_DEV_TEST__ === true &&
    [WRITING_BAND_GUIDED_PROMPT_VERSION, WRITING_BAND_LOCATED_PROMPT_VERSION].includes(promptVersion);
  const hostCoordinates = guided && promptVersion === WRITING_BAND_LOCATED_PROMPT_VERSION;
  const allowed = [
    'language',
    'cohesion',
    ...(points.length && (rubric.section === 'A' || (hasData && !conflict)) ? ['content'] : []),
    ...(nonempty(task.genre) && nonempty(task.recipient) ? ['register', 'reader'] : [])
  ];
  const observations = value.observations.map((observation) => {
    fields(observation, ['key', 'evidenceSpans', 'note']);
    requireValue(
      allowed.includes(observation.key) && nonempty(observation.note) && observation.note.length <= 500,
      'observation authority'
    );
    const evidenceSpans = spans(observation.evidenceSpans, 1, hostCoordinates);
    requireValue(
      guided || evidenceSpans.every((span) => !copied(span)),
      'known model text cannot evidence the student'
    );
    return { key: observation.key, evidenceSpans, note: observation.note.trim() };
  });
  requireValue(new Set(observations.map((item) => item.key)).size === observations.length, 'duplicate observation');
  requireValue(Array.isArray(value.integrityFlags) && value.integrityFlags.length <= 8, 'integrity flags');
  const integrityFlags = value.integrityFlags.map((flag) => {
    fields(flag, ['kind', 'spans', 'taskDatumId']);
    requireValue(
      ['repetition', 'prompt_copy', 'model_text_overlap', 'data_contradiction', 'fabricated_data'].includes(flag.kind),
      'integrity kind'
    );
    const evidence = spans(flag.spans, flag.kind === 'repetition' ? 2 : 1);
    if (['data_contradiction', 'fabricated_data'].includes(flag.kind))
      requireValue(
        hasData && !conflict && data.some((datum) => datum.id === flag.taskDatumId),
        'no data conclusion without author data'
      );
    else {
      requireValue(flag.taskDatumId == null, 'unexpected task datum');
      if (flag.kind === 'prompt_copy')
        requireValue(
          evidence.every((span) => task.prompt.includes(span.quote)),
          'prompt copy evidence'
        );
      if (flag.kind === 'repetition')
        requireValue(
          new Set(evidence.map((span) => span.start)).size === evidence.length &&
            evidence.every((span) => span.quote === evidence[0].quote),
          'repeated text evidence'
        );
      if (flag.kind === 'model_text_overlap')
        requireValue(
          evidence.every((span) => knownModelTexts.includes(span.quote)),
          'known model text excluding practice scaffolds'
        );
    }
    return { kind: flag.kind, spans: evidence, ...(flag.taskDatumId ? { taskDatumId: flag.taskDatumId } : {}) };
  });
  requireValue(
    value.status !== 'null' || (!observations.length && !integrityFlags.length),
    'system null cannot retain student judgments'
  );
  const blockReasons = [
    'source_unverified',
    ...(!points.length ? ['task_points_unstructured'] : []),
    ...(rubric.section === 'B' && (conflict || !hasData)
      ? [conflict ? 'task_data_conflict' : 'task_data_missing']
      : []),
    ...(integrityFlags.some((flag) => flag.kind === 'model_text_overlap') ||
    observations.some((observation) => observation.evidenceSpans.some(copied))
      ? ['model_text_overlap']
      : [])
  ];
  return {
    contract: WRITING_BAND_RESULT_CONTRACT,
    binding,
    status: value.status,
    nullReason: value.nullReason ?? null,
    band: null,
    bandRange: null,
    scoreEstimate: null,
    maxScore: null,
    blockReasons,
    taskCoverage,
    observations,
    integrityFlags,
    length: {
      count: (submission.text.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*|\d+(?:[.,]\d+)*/g) || []).length,
      countRule: 'english-token-v1',
      requirementText: null,
      bounds: null
    },
    provenance: { kind: 'ai_assisted', modelId: request.modelId, promptVersion },
    reviewRequired: true,
    officialScore: false,
    sourceTier: rubric.sourceTier
  };
}
