import { conditionPrompt, deriveConditionQuestion } from './learning-condition.js';

export const CONDITION_PROBE_CONTRACT = 'safe-condition-implication-v1';
const labels = { real: '实数', integer: '整数', positive: '正数' };
const fractionText = (r) => (r[1] === 1 ? String(r[0]) : `${r[0]}/${r[1]}`);

export function conditionProbePrompt(p, q, domain = 'real', excluded = '') {
  return `在${labels[domain]}范围内${excluded ? `（x≠${excluded}）` : ''}，检验蕴含P：${p} ⇒ Q：${q}；若成立回答“成立”，否则写一个精确反例x=整数或分数。`;
}
export function deriveConditionProbe(prompt) {
  if (typeof prompt !== 'string' || prompt.length > 800) return null;
  const match =
    /^在(实数|整数|正数)范围内(?:（x≠([^（）]+)）)?，检验蕴含P：(.+) ⇒ Q：(.+)；若成立回答“成立”，否则写一个精确反例x=整数或分数。$/.exec(
      prompt
    );
  if (!match) return null;
  const domain = Object.keys(labels).find((k) => labels[k] === match[1]);
  const derived = deriveConditionQuestion(conditionPrompt(match[3], match[4], domain, match[2] || ''));
  return {
    ...derived,
    validation: derived.validation
      ? {
          type: 'condition_implication',
          authority: 'executable',
          evidenceId: CONDITION_PROBE_CONTRACT,
          holds: derived.validation.sufficient,
          counterexample: derived.validation.pToQCounterexample,
          domain,
          excluded: derived.validation.excluded,
          cells: derived.validation.cells,
          premiseEmpty: derived.validation.premiseEmpty
        }
      : null
  };
}
export function normalizeConditionProbe(question) {
  const derived = deriveConditionProbe(question.prompt);
  if (!derived || question.rubric || question.options?.length) {
    if (question.validation?.type === 'condition_implication') question.validation = null;
    delete question.conditionProbeAnalysis;
    return question;
  }
  question.answerType = 'condition_implication';
  question.validation = derived.validation;
  question.conditionProbeAnalysis = {
    contract: CONDITION_PROBE_CONTRACT,
    status: derived.status,
    domain: derived.domain,
    reason: derived.reason || null
  };
  question.validationResult = {
    verified: derived.status === 'verified',
    wellPosed: derived.status === 'verified',
    solvable: derived.status === 'verified' ? true : null,
    evidenceId: CONDITION_PROBE_CONTRACT
  };
  return question;
}
export function createConditionProbe(id, p, q, domain = 'real', excluded = '') {
  return normalizeConditionProbe({
    id,
    version: 1,
    scope: 'generated',
    subject: '数学',
    knowledgePoint: '蕴含方向与精确反例',
    prompt: conditionProbePrompt(p, q, domain, excluded),
    source: { kind: 'executable', evidenceId: CONDITION_PROBE_CONTRACT },
    uncertainties: []
  });
}
export function conditionProbeAnswer(raw) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  const value = raw
    .trim()
    .replace(/^(?:我的答案是|我的答案[：:]|答案[是为：:]?)\s*/, '')
    .replace(/[。.]$/, '')
    .replace(/\s/g, '');
  if (value === '成立') return { holds: true };
  const match = /^(?:不成立[，,；;])?反例[：:]?x=([+-]?\d{1,10})(?:\/([+-]?\d{1,10}))?$/.exec(value);
  if (!match) return null;
  const numerator = Number(match[1]),
    denominator = Number(match[2] || 1);
  if (!denominator || Math.abs(numerator) > 1e9 || Math.abs(denominator) > 1e9) return null;
  return { holds: false, value: [denominator < 0 ? -numerator : numerator, Math.abs(denominator)] };
}
const compare = (a, b) => {
  if (a[0] < 0 !== b[0] < 0) return a[0] < 0 ? -1 : 1;
  // 连分数比较只用有界整数除法/余数，不交叉相乘溢出，也不要求设备支持BigInt。
  let an = Math.abs(a[0]),
    ad = a[1],
    bn = Math.abs(b[0]),
    bd = b[1],
    direction = a[0] < 0 ? -1 : 1;
  for (;;) {
    const aq = Math.floor(an / ad),
      bq = Math.floor(bn / bd);
    if (aq !== bq) return direction * (aq < bq ? -1 : 1);
    const ar = an % ad,
      br = bn % bd;
    if (!ar || !br) return direction * (ar ? 1 : br ? -1 : 0);
    [an, ad, bn, bd] = [ad, ar, bd, br];
    direction = -direction;
  }
};
export function gradeConditionProbe(question, raw) {
  const derived = deriveConditionProbe(question.prompt),
    actual = conditionProbeAnswer(raw);
  if (
    !derived?.validation ||
    question.rubric ||
    question.options?.length ||
    question.uncertainties?.some((x) => !x.resolved)
  )
    return { status: 'pending', outcome: null, basis: derived?.reason || 'condition_probe_unavailable' };
  if (!actual) return { status: 'pending', outcome: null, basis: 'ambiguous_condition_probe_answer' };
  const rule = derived.validation;
  let correct = actual.holds && rule.holds;
  if (!actual.holds && !rule.holds) {
    const x = actual.value;
    const inDomain = rule.domain !== 'integer' || x[0] % x[1] === 0;
    const cell =
      inDomain &&
      rule.cells.find((c) =>
        c.point
          ? compare(x, c.lower) === 0
          : (!c.lower || compare(x, c.lower) > 0) && (!c.upper || compare(x, c.upper) < 0)
      );
    correct = Boolean(cell && cell.truth[0] && !cell.truth[1]);
  }
  return {
    status: 'reliable',
    outcome: correct ? 'correct' : 'wrong',
    basis: CONDITION_PROBE_CONTRACT,
    evaluator: CONDITION_PROBE_CONTRACT,
    authority: 'executable'
  };
}
export function conditionProbeTeaching(question, method, level = 1) {
  const derived = deriveConditionProbe(question?.prompt);
  if (
    !derived?.validation ||
    question.rubric ||
    question.options?.length ||
    question.uncertainties?.some((x) => !x.resolved)
  )
    return null;
  const rule = derived.validation;
  const direct = rule.holds
    ? `P⇒Q成立：P的完整成立集包含于Q的成立集。${rule.premiseEmpty ? '前件成立集为空，按逻辑蕴含成立；不表示现实中出现了前件。' : ''}`
    : `P⇒Q不成立：x=${fractionText(rule.counterexample)}在共同范围内使P真而Q假，是精确反例。`;
  const first = '只检查P⇒Q；反例必须在共同范围内使P真而Q假。同真、同假或Q真P假都不能反驳这个方向。';
  const content = {
    explain: direct,
    steps: `①保留共同范围和排除值。②比较完整成立集。③检验反例方向。${direct}`,
    question: '要反驳P⇒Q，P和Q应分别是真还是假？',
    prerequisite: first,
    example: '例：x>3能推出x>1，反向可用x=2反驳。再独立检查当前小题。',
    analogy: '把P、Q看成同一全集的两个集合。检查每个P元素是否也在Q中，反例必须落在P中且在Q外。',
    diagram: '关系流程：共同范围 → P成立集 → 是否全部落在Q成立集 → 成立或精确反例。当前没有集合图形渲染。',
    check: '请无帮助检验这一方向，必要时给出一个精确反例；基础小题通过后仍需独立检验原题。',
    review: '开始蕴含复测；只有实际到期且无帮助的可靠作答才记为长期复习证据。'
  }[method];
  const hint =
    method === 'hint'
      ? level >= 3
        ? direct
        : level === 2
          ? '先排除不在数域或原定义域中的值，再检查P真Q假。仅写“不成立”没有给出要求的反例。'
          : first
      : content;
  return hint
    ? {
        method,
        content: hint,
        helped: !['check', 'review'].includes(method),
        level:
          method === 'hint'
            ? Math.min(3, Math.max(1, level))
            : ['explain', 'steps'].includes(method)
              ? 3
              : ['example', 'analogy', 'diagram'].includes(method)
                ? 2
                : 1,
        evidenceId: CONDITION_PROBE_CONTRACT
      }
    : null;
}
