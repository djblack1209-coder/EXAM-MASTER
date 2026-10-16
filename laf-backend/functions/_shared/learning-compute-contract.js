import { deriveAlgebraQuestionFor, parseAlgebraExpression } from './learning-algebra.js';

export const COMPUTE_CONTRACT = 'learning-compute-v1';
export const SYMPY_SOURCE = Object.freeze({
  name: 'SymPy',
  version: '1.14.0',
  license: 'BSD-3-Clause',
  url: 'https://github.com/sympy/sympy'
});
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
const same = (a, b) => {
  const sorted = (v) =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .filter((k) => v[k] !== undefined)
              .map((k) => [k, sorted(v[k])])
          )
        : v;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
};
export const sameComputeSnapshot = same;

export function computeScopeFor(state, conversationId) {
  const session = state.conversations.find((item) => item.id === conversationId);
  if (!session || session.stopped) fail('STOPPED', '当前任务已停止');
  const question = state.questions.find((item) => `${item.id}@${item.version}` === session.activeQuestionKey);
  const attempt = state.attempts
    .filter((item) => item.conversationId === conversationId && item.questionKey === session.activeQuestionKey)
    .at(-1);
  if (!question || !attempt) fail('PRECONDITION', '请先明确提交本题原答');
  const derived = deriveAlgebraQuestionFor(question);
  if (!derived || derived.task !== 'equation' || question.uncertainties?.some((item) => !item.resolved))
    fail('UNSUPPORTED_QUESTION', '本题暂不支持参考计算');
  try {
    const sides = derived.expression.split('=');
    if (sides.length !== 2) throw new Error();
    sides.forEach(parseAlgebraExpression);
  } catch {
    fail('UNSUPPORTED_QUESTION', '本题超出参考计算范围');
  }
  const expected = {
    question: {
      id: question.id,
      version: question.version,
      prompt: question.prompt,
      source: question.source || null,
      uncertainties: question.uncertainties || []
    },
    attempt: {
      id: attempt.id,
      conversationId,
      questionKey: attempt.questionKey,
      answer: attempt.answer,
      at: attempt.at,
      kind: attempt.kind
    }
  };
  if (JSON.stringify(expected).length > 16000) fail('RESOURCE_LIMIT', '本题资料超出计算范围');
  return { conversationId, questionKey: session.activeQuestionKey, attemptId: attempt.id, expected };
}

export function normalizeComputeReference(value, state, conversationId, questionKey) {
  if (
    !value ||
    Object.keys(value).sort().join(',') !== 'attemptId,contract,questionKey,requestId,result,source' ||
    value.contract !== 'sympy-reference-v1' ||
    !/^[a-f0-9]{64}$/.test(value.requestId) ||
    value.questionKey !== questionKey ||
    !same(value.source, SYMPY_SOURCE)
  )
    fail('INVALID_REFERENCE', '计算参考关联无效');
  const expected = computeScopeFor(state, conversationId);
  if (expected.questionKey !== questionKey || expected.attemptId !== value.attemptId)
    fail('CONTEXT_CHANGED', '原答已变化，未读取旧参考');
  const result = value.result;
  const list = (items, limit) =>
    Array.isArray(items) &&
    items.length <= limit &&
    new Set(items).size === items.length &&
    items.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 512 && !/[\r\n\0]/.test(s));
  const derived = deriveAlgebraQuestionFor(expected.expected.question);
  if (
    !result ||
    Object.keys(result).sort().join(',') !== 'all,domain,excluded,gradingAuthority,solutions,upstream,version' ||
    result.upstream !== 'sympy' ||
    result.version !== SYMPY_SOURCE.version ||
    result.domain !== derived.domain ||
    result.gradingAuthority !== false ||
    typeof result.all !== 'boolean' ||
    !list(result.solutions, 6) ||
    !list(result.excluded, 204) ||
    (result.all && result.solutions.length) ||
    result.solutions.some((s) => result.excluded.includes(s))
  )
    fail('INVALID_REFERENCE', '计算参考格式无效');
  const canonical = JSON.parse(JSON.stringify(value));
  if (computeReferenceText(canonical).length > 8000) fail('RESOURCE_LIMIT', '计算结果超出显示范围');
  return canonical;
}

export function computeReferenceText(reference) {
  const r = reference.result;
  const domain = { real: '实数', positive: '正数', integer: '整数' }[r.domain];
  const solutions = r.all ? `满足原式条件的全部${domain}` : r.solutions.length ? r.solutions.join('、') : '无解';
  return `计算参考：${solutions}。${r.excluded.length ? `原式不取：${r.excluded.join('、')}。` : ''}\n${SYMPY_SOURCE.name} ${SYMPY_SOURCE.version} · ${SYMPY_SOURCE.license}\n${SYMPY_SOURCE.url}\n已记为本题帮助，原答判分保持。`;
}
