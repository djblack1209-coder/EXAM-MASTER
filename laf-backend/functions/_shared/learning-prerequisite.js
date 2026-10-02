import {
  createAlgebraQuestion,
  deriveAlgebraQuestion,
  gradeAlgebraAnswer,
  parseInequalityAnswer
} from './learning-algebra.js';
import { deriveConditionQuestion, conditionAnswer, gradeConditionAnswer } from './learning-condition.js';
import { createConditionProbe } from './learning-condition-probe.js';

export const LEGACY_PREREQUISITE_CONTRACT = 'prerequisite-diagnosis-v1';
export const PREREQUISITE_CONTRACT = 'prerequisite-diagnosis-v2';
export const CONDITION_PREREQUISITE_CONTRACT = 'prerequisite-condition-v1';
const contracts = [PREREQUISITE_CONTRACT, LEGACY_PREREQUISITE_CONTRACT, CONDITION_PREREQUISITE_CONTRACT];
const keyOf = (q) => `${q.id}@${q.version}`;
const gradeOf = (a) => a.corrections?.at(-1)?.grade || a.grade;

// v1题干与理由冻结，既有事件/备份继续按原合同重验。
function legacySpecification(original) {
  if (!original || original.prerequisite || original.uncertainties?.some((u) => !u.resolved)) return null;
  const match =
    original.source?.kind === 'executable' && /^计算 ([+-]?\d{1,5}) ([+×*]) ([+-]?\d{1,5})。$/.exec(original.prompt);
  if (match) {
    const negative = Number(match[1]) < 0 || Number(match[3]) < 0;
    const addition = match[2] === '+';
    return {
      topic: addition ? (negative ? 'signed-addition' : 'basic-addition') : 'signed-product',
      label: addition ? (negative ? '先修：有符号加法' : '先修：基本加法') : '先修：乘法符号',
      goal: addition ? (negative ? '0 + -3' : '2 + 3') : '-2 × 3',
      arithmetic: true,
      reason: addition
        ? '原题计算受阻，先用小数检查加法与符号；错答尚不能确定具体错因'
        : '原题乘法受阻，先用小数检查积的符号；错答尚不能确定具体错因'
    };
  }
  const derived = deriveAlgebraQuestion(original.prompt);
  if (derived?.task === 'inequality' && derived.status === 'verified')
    return {
      topic: 'negative-inequality',
      label: '先修：不等式负倍方向',
      goal: '解不等式 -x>0',
      reason: '原题完整解集受阻，先检查负倍运算与不等号方向；诊断小题不能证明原题已掌握'
    };
  return null;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function arithmetic(original) {
  const match =
    original.source?.kind === 'executable' && /^计算 ([+-]?\d{1,5}) ([+×*]) ([+-]?\d{1,5})。$/.exec(original.prompt);
  if (
    !match ||
    original.validation?.type !== 'number' ||
    original.validation.authority !== 'executable' ||
    original.validation.evidenceId !== 'integer-arithmetic-v1' ||
    original.validation.unit
  )
    return null;
  const a = Number(match[1]),
    b = Number(match[3]),
    addition = match[2] === '+';
  const expected = addition ? a + b : a * b;
  return Number(original.validation.answer) === expected ? { a, b, addition, expected } : null;
}
function integerAnswer(raw) {
  if (typeof raw !== 'string' || raw.length > 32) return null;
  const body = raw
    .trim()
    .replace(/^答案[是为：: ]*/, '')
    .replace(/^x\s*=\s*/i, '');
  if (!/^[+-]?\d{1,12}$/.test(body)) return null;
  const value = Number(body);
  return Number.isSafeInteger(value) ? value : null;
}
function supportedEvidence(original, attempt, contract) {
  const grade = gradeOf(attempt);
  if (grade?.status !== 'reliable') return false;
  if (contract === LEGACY_PREREQUISITE_CONTRACT) return grade.outcome === 'wrong';
  if (!['wrong', 'partial'].includes(grade.outcome) || original.rubric || original.options?.length) return false;
  if (contract === CONDITION_PREREQUISITE_CONTRACT) {
    const independent = gradeConditionAnswer(original, attempt.answer);
    return independent.status === 'reliable' && independent.outcome === 'wrong' && grade.outcome === 'wrong';
  }
  const calculation = arithmetic(original);
  if (calculation) {
    const actual = integerAnswer(attempt.answer);
    return grade.outcome === 'wrong' && actual !== null && actual !== calculation.expected;
  }
  const derived = deriveAlgebraQuestion(original.prompt);
  if (derived?.status !== 'verified') return false;
  const independent = gradeAlgebraAnswer(original, attempt.answer);
  return independent.status === 'reliable' && independent.outcome === grade.outcome;
}
function evidenceSpecification(original, attempt) {
  const calculation = arithmetic(original);
  if (calculation) {
    const { a, b, addition, expected } = calculation,
      actual = integerAnswer(attempt.answer);
    if (!addition)
      return {
        topic: 'signed-product',
        label: '先修：乘法符号',
        arithmetic: true,
        goal: a < 0 && b < 0 ? '-2 × -3' : '-2 × 3',
        reason:
          expected !== 0 && actual === -expected
            ? '原答与独立结果绝对值相同、符号相反，先检查乘法符号；这只是候选薄弱环节'
            : '原答未通过独立乘法检验，先用小整数检查符号；尚不能确定具体错因'
      };
    if (a < 0 || b < 0)
      return {
        topic: 'signed-addition',
        label: '先修：有符号加法',
        arithmetic: true,
        goal: a < 0 && b < 0 ? '-2 + -3' : '-5 + 3',
        reason:
          actual === Math.abs(a) + Math.abs(b)
            ? '原答等于两数绝对值之和，先检查有符号加法；不能据此确定用户采用了哪一步'
            : '原答未通过有符号加法检验，先用小整数区分同号与异号相加；尚不能确定具体错因'
      };
    if ((a % 10) + (b % 10) >= 10 && actual === expected - 10)
      return {
        topic: 'addition-carry',
        label: '先修：加法进位',
        arithmetic: true,
        goal: '8 + 7',
        reason: '原答比独立结果少十，且个位相加需要进位，先检查进位；此差异尚不能证明实际遗漏步骤'
      };
    return {
      topic: 'basic-addition',
      label: '先修：基本加法',
      arithmetic: true,
      goal: '2 + 3',
      reason: '原答未通过独立加法检验，先用小整数检查基本运算；尚不能确定具体错因'
    };
  }
  const derived = deriveAlgebraQuestion(original.prompt),
    rule = derived.validation;
  if (derived.task === 'inequality') {
    const actual = parseInequalityAnswer(attempt.answer),
      expected = rule.solution.intervals;
    if (expected.length === 1 && actual.length === 1) {
      const a = actual[0],
        e = expected[0];
      const lower = e.lower !== null && e.upper === null,
        upper = e.upper !== null && e.lower === null;
      const sameDirection =
        (lower && a.lower !== null && a.upper === null) || (upper && a.upper !== null && a.lower === null);
      const reversed =
        (lower && a.lower === null && a.upper !== null) || (upper && a.lower !== null && a.upper === null);
      const bound = lower ? e.lower : e.upper,
        actualBound = a.lower ?? a.upper;
      if ((lower || upper) && same(bound, actualBound)) {
        if (sameDirection) {
          const closed = lower ? e.lowerClosed : e.upperClosed;
          return {
            topic: 'inequality-boundary',
            label: '先修：不等式端点',
            goal: `解不等式 x-2${closed ? '>=' : '>'}0`,
            reason: '原答的方向与临界值一致，端点是否包含不同，先检查严格与非严格边界；尚不判断为稳定错因'
          };
        }
        if (reversed)
          return {
            topic: 'negative-inequality',
            label: '先修：不等式负倍方向',
            goal: '解不等式 -x>0',
            reason: '原答与独立解集的方向相反、临界值相同，先检查负倍运算与方向；仍需单独核对边界'
          };
      }
      if (sameDirection)
        return {
          topic: 'inequality-threshold',
          label: '先修：不等式临界值',
          goal: '解不等式 2*x+4>0',
          reason: '原答方向一致但临界值不同，先检查移项与求临界值；端点条件仍需独立核对'
        };
    }
    return {
      topic: 'inequality-solution-set',
      label: '先修：完整不等式解集',
      goal: '解不等式 -2*x+4>=0',
      reason: '原答解集未通过独立检验，多个条件可能同时不同，先检查方向、临界值和端点；不强行指定唯一错因'
    };
  }
  if (derived.task === 'equation') {
    if (gradeOf(attempt).outcome === 'partial')
      return {
        topic: 'equation-completeness',
        label: '先修：方程解集完整性',
        goal: '解方程 x^2=1',
        reason: '原答列出的解有效但未写全，先检查完整解集；部分正确单独保留，不转成可靠错题'
      };
    if (rule.excluded.length)
      return {
        topic: 'equation-domain',
        label: '先修：方程原定义域',
        goal: '解方程 (x^2-1)/(x-1)=0',
        reason: '原题含原定义域限制且原答未通过检验，先检查候选解代入与被排除值；尚不能确定唯一错因'
      };
    return {
      topic: 'equation-substitution',
      label: '先修：方程代入检验',
      goal: '解方程 2*x+3=7',
      reason: '原答未通过方程解集检验，先检查基础移项与代入；不能由一题推广整类能力'
    };
  }
  return rule.excluded.length
    ? {
        topic: 'equivalence-domain',
        label: '先修：化简原定义域',
        goal: '化简 (x^2-1)/(x-1)',
        reason: '原化简结果未通过等价与定义域检验，先检查约分和原限制；不能把缺条件的结果当完整等价'
      }
    : {
        topic: 'equivalence-distribution',
        label: '先修：分配律等价',
        goal: '化简 2*(x+1)',
        reason: '原化简结果未通过独立等价检验，先检查分配律；尚不能确定实际错误步骤'
      };
}

function conditionSpecification(original, attempt) {
  const derived = deriveConditionQuestion(original.prompt),
    actual = conditionAnswer(attempt.answer);
  if (!derived?.validation || !actual) return null;
  const flags = {
    sufficient: [true, false],
    necessary: [false, true],
    equivalent: [true, true],
    neither: [false, false]
  }[actual];
  const rule = derived.validation,
    suffDiff = flags[0] !== rule.sufficient,
    necessaryDiff = flags[1] !== rule.necessary;
  const direction = suffDiff ? 'p_to_q' : 'q_to_p',
    holds = suffDiff ? rule.sufficient : rule.necessary;
  return {
    topic:
      suffDiff && necessaryDiff
        ? 'condition-both-directions'
        : suffDiff
          ? 'condition-sufficient-direction'
          : 'condition-necessary-direction',
    label: suffDiff && necessaryDiff ? '先修：双向蕴含' : suffDiff ? '先修：充分方向与反例' : '先修：必要方向与反例',
    probe: true,
    domain: derived.domain,
    holds,
    direction,
    reason: `${suffDiff && necessaryDiff ? '原答分类对应的两个蕴含方向均与独立成立集不同，先检查充分方向P⇒Q，再独立核对必要方向Q⇒P' : suffDiff ? '原答分类的充分方向P⇒Q与独立成立集不同，先检查这一方向与反例' : '原答分类的必要方向Q⇒P与独立成立集不同，先检查这一方向与反例'}；基础阈值小题只检查候选薄弱环节，不能确定实际认知错因或代替原题完整分类`
  };
}
export function createPrerequisiteQuestion(id, original, attempts, conversationId, contract) {
  contract ??= deriveConditionQuestion(original?.prompt) ? CONDITION_PREREQUISITE_CONTRACT : PREREQUISITE_CONTRACT;
  if (
    !contracts.includes(contract) ||
    !original ||
    original.prerequisite ||
    original.uncertainties?.some((u) => !u.resolved)
  )
    return null;
  if (contract !== LEGACY_PREREQUISITE_CONTRACT) {
    let latest;
    for (let i = attempts.length - 1; i >= 0; i--) {
      if (attempts[i].questionKey === keyOf(original) && attempts[i].conversationId === conversationId) {
        latest = attempts[i];
        break;
      }
    }
    if (!latest || !supportedEvidence(original, latest, contract)) return null;
  }
  const evidence = [];
  for (let i = attempts.length - 1; i >= 0 && evidence.length < 2; i--) {
    const a = attempts[i];
    if (
      a.questionKey === keyOf(original) &&
      a.conversationId === conversationId &&
      supportedEvidence(original, a, contract)
    )
      evidence.unshift(a);
  }
  if (!evidence.length) return null;
  const spec =
    contract === LEGACY_PREREQUISITE_CONTRACT
      ? legacySpecification(original)
      : contract === CONDITION_PREREQUISITE_CONTRACT
        ? conditionSpecification(original, evidence.at(-1))
        : evidenceSpecification(original, evidence.at(-1));
  if (!spec) return null;
  const evidenceIds = evidence.map((a) => a.id);
  let question;
  if (spec.arithmetic) {
    const [a, operator, b] = spec.goal.split(' ');
    question = {
      id,
      version: 1,
      scope: 'generated',
      subject: '数学',
      prompt: `计算 ${spec.goal}。`,
      source: { kind: 'executable', evidenceId: 'integer-arithmetic-v1' },
      validation: {
        type: 'number',
        answer: String(operator === '+' ? Number(a) + Number(b) : Number(a) * Number(b)),
        authority: 'executable',
        evidenceId: 'integer-arithmetic-v1'
      },
      uncertainties: []
    };
  } else if (spec.probe)
    question = createConditionProbe(id, spec.holds ? 'x>3' : 'x>1', spec.holds ? 'x>1' : 'x>3', spec.domain);
  else question = createAlgebraQuestion(id, spec.goal);
  return {
    ...question,
    knowledgePoint: spec.label,
    prerequisite: {
      contract,
      originalQuestionKey: keyOf(original),
      topic: spec.topic,
      conversationId,
      evidenceIds,
      reason: spec.reason,
      ...(contract !== LEGACY_PREREQUISITE_CONTRACT
        ? { evidenceOutcomes: evidence.map((a) => gradeOf(a).outcome) }
        : {}),
      ...(spec.probe ? { direction: spec.direction } : {})
    }
  };
}

// 同步/备份/模型建题均在共享reducer重验关联，不能伪造诊断来源或扩大能力范围。
export function validPrerequisiteQuestion(question, state) {
  const data = question.prerequisite;
  if (!data) return true;
  if (
    !Array.isArray(data.evidenceIds) ||
    !data.evidenceIds.length ||
    data.evidenceIds.length > 2 ||
    new Set(data.evidenceIds).size !== data.evidenceIds.length ||
    !state.conversations.some((c) => c.id === data.conversationId)
  )
    return false;
  if (
    data.contract === CONDITION_PREREQUISITE_CONTRACT &&
    Object.keys(data).some(
      (k) =>
        ![
          'contract',
          'originalQuestionKey',
          'topic',
          'conversationId',
          'evidenceIds',
          'reason',
          'evidenceOutcomes',
          'direction'
        ].includes(k)
    )
  )
    return false;
  const original = state.questions.find((q) => keyOf(q) === data.originalQuestionKey);
  const expected =
    original &&
    createPrerequisiteQuestion(
      question.id,
      original,
      data.contract === CONDITION_PREREQUISITE_CONTRACT
        ? state.attempts
        : state.attempts.filter((a) => data.evidenceIds?.includes(a.id)),
      data.conversationId,
      data.contract
    );
  return Boolean(
    expected &&
    contracts.includes(data.contract) &&
    question.prompt === expected.prompt &&
    question.knowledgePoint === expected.knowledgePoint &&
    question.subject === original.subject &&
    question.source?.kind === 'executable' &&
    question.source.evidenceId === expected.source.evidenceId &&
    question.validation?.authority === 'executable' &&
    (expected.validation.type !== 'number' ||
      (Object.keys(question.validation).length === Object.keys(expected.validation).length &&
        Object.entries(expected.validation).every(([key, value]) => question.validation[key] === value))) &&
    !question.parentQuestionKey &&
    !question.rubric &&
    !question.options?.length &&
    !question.uncertainties?.some((u) => !u.resolved) &&
    same(expected.prerequisite.evidenceIds, data.evidenceIds) &&
    (data.contract === LEGACY_PREREQUISITE_CONTRACT ||
      same(expected.prerequisite.evidenceOutcomes, data.evidenceOutcomes)) &&
    data.topic === expected.prerequisite.topic &&
    data.reason === expected.prerequisite.reason &&
    (data.contract !== CONDITION_PREREQUISITE_CONTRACT || data.direction === expected.prerequisite.direction)
  );
}

// 方程诊断后仍以完整解集检验原题，避免仅验证化简而漏掉“全部解”的原任务。
export function createPrerequisiteVariant(id, original, diagnostic) {
  if (
    !original ||
    diagnostic?.prerequisite?.contract !== PREREQUISITE_CONTRACT ||
    diagnostic.prerequisite.originalQuestionKey !== keyOf(original) ||
    original.rubric ||
    original.options?.length ||
    original.uncertainties?.some((u) => !u.resolved)
  )
    return null;
  const derived = deriveAlgebraQuestion(original.prompt);
  if (derived?.task !== 'equation' || !derived.validation) return null;
  const [left, right] = derived.expression.split('='),
    domain = { real: '实数', integer: '整数', positive: '正数' }[derived.domain];
  const q = createAlgebraQuestion(id, `${domain}解方程 -2*(${right})=-2*(${left})`, original);
  if (
    !q?.validation ||
    !same(q.validation.solution, derived.validation.solution) ||
    !same(q.validation.excluded, derived.validation.excluded)
  )
    return null;
  q.variantChange = '交换左右并负倍缩放，保留原数域、定义域与全部解；独立检查原题解集，诊断小题结果不能替代';
  return q;
}

export function prerequisiteProgress(state, question) {
  const data = question?.prerequisite;
  if (!data) return null;
  const original = state.questions.find((q) => keyOf(q) === data.originalQuestionKey);
  const evidence = (data.evidenceIds || []).map((id) => state.attempts.find((a) => a.id === id));
  const expected =
    original &&
    createPrerequisiteQuestion(question.id, original, evidence.filter(Boolean), data.conversationId, data.contract);
  if (
    !expected ||
    !same(expected.prerequisite.evidenceIds, data.evidenceIds) ||
    expected.prerequisite.topic !== data.topic ||
    expected.prerequisite.reason !== data.reason ||
    (data.contract !== LEGACY_PREREQUISITE_CONTRACT &&
      !same(expected.prerequisite.evidenceOutcomes, data.evidenceOutcomes)) ||
    (data.contract === CONDITION_PREREQUISITE_CONTRACT && expected.prerequisite.direction !== data.direction)
  )
    return { status: 'pending', text: '原作答依据已变化，诊断关联待核对；本题作答仍保留' };
  const attempt = state.attempts
    .filter((a) => a.questionKey === keyOf(question) && a.conversationId === data.conversationId)
    .at(-1);
  if (!attempt) return { status: 'waiting', text: '先独立作答这个基础小题；尚未确定原题错因' };
  const grade = gradeOf(attempt);
  if (grade?.status !== 'reliable') return { status: 'pending', text: '基础小题尚待核对，不能据此诊断' };
  if (grade.outcome !== 'correct')
    return { status: 'blocked', text: '该基础小题仍受阻，可查看依据或请求提示；不推广为整科能力判断' };
  return attempt.hints.length
    ? { status: 'helped_correct', text: '基础小题提示后正确；仍需无帮助检验原题' }
    : { status: 'independent_correct', text: '该基础小题独立正确；原题仍需独立变式与到期复测' };
}
