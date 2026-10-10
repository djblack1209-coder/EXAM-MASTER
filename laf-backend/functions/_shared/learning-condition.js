import { partitionAlgebraPredicates } from './learning-algebra.js';

export const CONDITION_CONTRACT = 'safe-condition-relation-v1';
const labels = { real: '实数', integer: '整数', positive: '正数' };
const relations = {
  sufficient: '充分不必要条件',
  necessary: '必要不充分条件',
  equivalent: '充要条件',
  neither: '既不充分也不必要条件'
};
const fractionText = (r) => (r[1] === 1 ? String(r[0]) : `${r[0]}/${r[1]}`);
export function conditionPrompt(p, q, domain = 'real', excluded = '') {
  return `在${labels[domain]}范围内${excluded ? `（x≠${excluded}）` : ''}，判断条件P：${p} 是条件Q：${q} 的什么条件。`;
}
export function deriveConditionQuestion(prompt) {
  if (typeof prompt !== 'string' || prompt.length > 800) return null;
  const match = /^在(实数|整数|正数)范围内(?:（x≠([^（）]+)）)?，判断条件P：(.+) 是条件Q：(.+) 的什么条件。$/.exec(
    prompt
  );
  if (!match) return null;
  const domain = Object.keys(labels).find((k) => labels[k] === match[1]);
  const base = { domain, excludedText: match[2] || '', premise: match[3], consequence: match[4] };
  try {
    const partition = partitionAlgebraPredicates([base.premise, base.consequence], domain, base.excludedText);
    const pToQCounterexample = partition.cells.find((c) => c.truth[0] && !c.truth[1]);
    const qToPCounterexample = partition.cells.find((c) => c.truth[1] && !c.truth[0]);
    const sufficient = !pToQCounterexample,
      necessary = !qToPCounterexample;
    const relation = sufficient ? (necessary ? 'equivalent' : 'sufficient') : necessary ? 'necessary' : 'neither';
    return {
      ...base,
      status: 'verified',
      validation: {
        type: 'condition_relation',
        authority: 'executable',
        evidenceId: CONDITION_CONTRACT,
        relation,
        sufficient,
        necessary,
        domain,
        excluded: partition.excluded,
        pToQCounterexample: pToQCounterexample?.witness || null,
        qToPCounterexample: qToPCounterexample?.witness || null,
        premiseEmpty: !partition.cells.some((c) => c.truth[0]),
        consequenceEmpty: !partition.cells.some((c) => c.truth[1]),
        cells: partition.cells
      }
    };
  } catch (error) {
    if (!error.code) throw error;
    return { ...base, status: 'pending', reason: error.code, validation: null };
  }
}
export function normalizeConditionQuestion(question) {
  const derived = deriveConditionQuestion(question.prompt);
  if (!derived || question.rubric || question.options?.length) {
    if (question.validation?.type === 'condition_relation') question.validation = null;
    delete question.conditionAnalysis;
    return question;
  }
  question.answerType = 'condition_relation';
  question.validation = derived.validation;
  question.conditionAnalysis = {
    contract: CONDITION_CONTRACT,
    status: derived.status,
    domain: derived.domain,
    reason: derived.reason || null
  };
  question.validationResult = {
    verified: derived.status === 'verified',
    wellPosed: derived.status === 'verified',
    solvable: derived.status === 'verified' ? true : null,
    evidenceId: CONDITION_CONTRACT
  };
  return question;
}
export function createConditionQuestion(id, goal, parent = null) {
  if (typeof goal !== 'string' || goal.length > 800) return null;
  let prompt = deriveConditionQuestion(goal) ? goal : null;
  const match =
    /^(?:(实数|整数|正数)范围(?:内)?(?:[，,]x(?:≠|!=)([^；;]+))?[；;]\s*)?判断条件\s+(.+)\s+是\s+(.+)\s+的什么条件[。？?]?$/.exec(
      goal.trim()
    );
  if (match)
    prompt = conditionPrompt(
      match[3],
      match[4],
      match[1] ? Object.keys(labels).find((k) => labels[k] === match[1]) : 'real',
      match[2] || ''
    );
  if (!prompt) return null;
  return normalizeConditionQuestion({
    id,
    version: 1,
    scope: 'generated',
    prompt,
    subject: '数学',
    knowledgePoint: '充分必要条件与蕴含',
    source: { kind: 'executable', evidenceId: CONDITION_CONTRACT },
    uncertainties: [],
    ...(parent ? { parentQuestionKey: `${parent.id}@${parent.version}` } : {})
  });
}
export function conditionAnswer(raw) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  const value = raw
    .trim()
    .replace(/^(?:我的答案是|我的答案[：:]|答案[是为：:]?)\s*/, '')
    .replace(/[。.]$/, '')
    .replace(/\s/g, '');
  return (
    {
      充分不必要: 'sufficient',
      充分不必要条件: 'sufficient',
      必要不充分: 'necessary',
      必要不充分条件: 'necessary',
      充要: 'equivalent',
      充要条件: 'equivalent',
      充分必要条件: 'equivalent',
      既不充分也不必要: 'neither',
      既不充分也不必要条件: 'neither'
    }[value] || null
  );
}
export function gradeConditionAnswer(question, answer) {
  const derived = deriveConditionQuestion(question.prompt),
    actual = conditionAnswer(answer);
  if (!derived?.validation || question.rubric || question.options?.length)
    return { status: 'pending', outcome: null, basis: derived?.reason || 'condition_reference_unavailable' };
  if (!actual) return { status: 'pending', outcome: null, basis: 'ambiguous_condition_answer' };
  return {
    status: 'reliable',
    outcome: actual === derived.validation.relation ? 'correct' : 'wrong',
    basis: CONDITION_CONTRACT,
    evaluator: CONDITION_CONTRACT,
    authority: 'executable'
  };
}
export function createConditionVariant(id, parent) {
  const derived = deriveConditionQuestion(parent?.prompt);
  if (!derived?.validation || parent.rubric || parent.options?.length || parent.uncertainties?.some((x) => !x.resolved))
    return null;
  const q = createConditionQuestion(
    id,
    conditionPrompt(derived.consequence, derived.premise, derived.domain, derived.excludedText),
    parent
  );
  q.variantChange = '交换P与Q，独立检查两个蕴含方向；共同数域和原排除条件保留';
  return q;
}
export function conditionTeaching(question, method, level = 1) {
  const derived = deriveConditionQuestion(question?.prompt);
  if (
    !derived?.validation ||
    question.rubric ||
    question.options?.length ||
    question.uncertainties?.some((x) => !x.resolved)
  )
    return null;
  const rule = derived.validation;
  const direction = (name, holds, counterexample) =>
    holds ? `${name}成立` : `${name}不成立：x=${fractionText(counterexample)}是精确反例`;
  const direct = `${direction('P⇒Q', rule.sufficient, rule.pToQCounterexample)}；${direction('Q⇒P', rule.necessary, rule.qToPCounterexample)}。所以P是Q的${relations[rule.relation]}。${rule.premiseEmpty || rule.consequenceEmpty ? '存在空成立集，按集合包含与逻辑蕴含判定；不表示条件在现实中发生。' : ''}`;
  const firstHint = '充分检查P⇒Q，必要检查Q⇒P。分别找使前件成立而后件不成立的值；单个同真例子不能证明蕴含。';
  const content = {
    explain: direct,
    steps: `①核对共同数域/定义域。②分别比较P、Q的完整成立集。③检查两个方向及反例：${direct}`,
    question: '应先核对哪个蕴含方向？一个值让P和Q都真，足够证明所有P都推出Q吗？',
    prerequisite: firstHint,
    example: '例：x>3能推出x>1，但x=2使后者真而前者假，所以前者是充分不必要条件。再独立处理当前题。',
    analogy: '把P、Q当作同一全集中的两个集合。P包含在Q内对应充分；Q包含在P内对应必要。一个重合点不足以确定集合包含。',
    diagram:
      '用关系流程辅助：共同数域 → P的成立集/Q的成立集 → 两向包含 → 分类。当前没有集合图形渲染，流程不等于图形证明。',
    check: '请独立判断两个蕴含方向并给出完整分类；已有帮助保留，不以提示后答案宣称独立掌握。',
    review: '开始条件关系复测；只有实际到期且无提示的可靠作答才进入长期复习证据。'
  }[method];
  const hint =
    method === 'hint'
      ? level >= 3
        ? direct
        : level === 2
          ? `先保留共同${labels[derived.domain]}范围与排除值，再区分“P真Q假”和“Q真P假”两个反例方向。`
          : firstHint
      : content;
  if (!hint) return null;
  return {
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
    evidenceId: CONDITION_CONTRACT
  };
}
