import { sameComputeSnapshot } from './learning-compute-contract.js';

export const GRAMMAR_CONTRACT = 'learning-grammar-v1';
export const LANGUAGE_TOOL_SOURCE = Object.freeze({
  name: 'LanguageTool',
  version: '6.6',
  license: 'LGPL-2.1-or-later',
  url: 'https://languagetool.org',
  distributionSha256: '53600506b399bb5ffe1e4c8dec794fd378212f14aaf38ccef9b6f89314d11631'
});
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
export function grammarScopeFor(state, conversationId) {
  const session = state.conversations.find((item) => item.id === conversationId);
  if (!session || session.stopped) fail('STOPPED', '当前任务已停止');
  const question = state.questions.find((item) => `${item.id}@${item.version}` === session.activeQuestionKey);
  const attempt = state.attempts
    .filter((item) => item.conversationId === conversationId && item.questionKey === session.activeQuestionKey)
    .at(-1);
  if (!question || !attempt) fail('PRECONDITION', '请先明确提交本题原答');
  if (
    question.subject !== '英语' ||
    question.answerType !== 'subjective' ||
    typeof attempt.answer !== 'string' ||
    !/[a-z]/i.test(attempt.answer)
  )
    fail('UNSUPPORTED_QUESTION', '请选择已提交的英文写作原答');
  if (!attempt.answer.trim() || attempt.answer.length > 2000) fail('RESOURCE_LIMIT', '本次检查最多2000字符，原答保持');
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
  if (JSON.stringify(expected).length > 16000) fail('RESOURCE_LIMIT', '本题资料超出检查范围');
  return { conversationId, questionKey: session.activeQuestionKey, attemptId: attempt.id, expected };
}
export function normalizeGrammarReference(value, state, conversationId, questionKey) {
  const scope = grammarScopeFor(state, conversationId);
  if (
    !value ||
    Object.keys(value).sort().join(',') !== 'attemptId,contract,questionKey,requestId,result,source' ||
    value.contract !== 'grammar-reference-v1' ||
    !/^[a-f0-9]{64}$/.test(value.requestId) ||
    value.questionKey !== questionKey ||
    value.attemptId !== scope.attemptId ||
    !sameComputeSnapshot(value.source, LANGUAGE_TOOL_SOURCE)
  )
    fail('INVALID_REFERENCE', '语法建议与原答关联无效');
  const result = value.result,
    original = scope.expected.attempt.answer;
  const plain = (v, limit) =>
    typeof v === 'string' && v.length > 0 && v.length <= limit && !/[\0-\x08\x0b\x0c\x0e-\x1f]/.test(v);
  if (
    !result ||
    Object.keys(result).sort().join(',') !== 'findings,gradingAuthority,language,upstream,version' ||
    result.upstream !== 'languagetool' ||
    result.version !== LANGUAGE_TOOL_SOURCE.version ||
    result.language !== 'en-US' ||
    result.gradingAuthority !== false ||
    !Array.isArray(result.findings) ||
    result.findings.length > 40
  )
    fail('INVALID_REFERENCE', '语法建议格式无效');
  for (const m of result.findings) {
    if (
      !m ||
      Object.keys(m).sort().join(',') !== 'length,message,offset,original,replacements,ruleId' ||
      !Number.isInteger(m.offset) ||
      !Number.isInteger(m.length) ||
      m.offset < 0 ||
      m.length < 0 ||
      m.offset + m.length > original.length ||
      m.original !== original.slice(m.offset, m.offset + m.length) ||
      !plain(m.message, 500) ||
      !plain(m.ruleId, 160) ||
      !Array.isArray(m.replacements) ||
      m.replacements.length > 8 ||
      !m.replacements.every((v) => plain(v, 200))
    )
      fail('INVALID_REFERENCE', '语法建议无法定位原答');
  }
  const canonical = JSON.parse(JSON.stringify(value));
  if (grammarReferenceText(canonical).length > 12000) fail('RESOURCE_LIMIT', '建议超出显示范围，原答保持');
  return canonical;
}
export function grammarReferenceText(reference) {
  const findings = reference.result.findings;
  const lines = findings.length
    ? findings.map(
        (m) => `「${m.original}」：${m.message}${m.replacements.length ? `\n可选：${m.replacements.join(' / ')}` : ''}`
      )
    : ['未发现基础规则问题。'];
  return `语法建议\n${lines.join('\n\n')}\n\n建议可能误报；请自行决定修改。原答仍待核对，不给作文打分。\nLanguageTool ${LANGUAGE_TOOL_SOURCE.version} · ${LANGUAGE_TOOL_SOURCE.license}\n${LANGUAGE_TOOL_SOURCE.url}`;
}
