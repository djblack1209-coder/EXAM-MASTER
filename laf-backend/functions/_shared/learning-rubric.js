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
