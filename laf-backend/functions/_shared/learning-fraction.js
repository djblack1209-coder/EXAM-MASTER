import { exactNumberOperation, parseExactNumberAnswer } from './learning-algebra.js';

export const FRACTION_CONTRACT = 'fraction-arithmetic-v1';
const expression =
  /^\s*([+-]?\d{1,4})\s*\/\s*([+-]?\d{1,4})\s*([+−\-×*÷])\s*([+-]?\d{1,4})\s*\/\s*([+-]?\d{1,4})\s*[=？?]?\s*$/u;
const operators = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '÷': '/' };
const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const sameObject = (actual, expected) =>
  actual &&
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(([key, value]) => actual[key] === value);
const requireFraction = (ok) => {
  if (!ok) throw Object.assign(new Error('分数题面与校验依据不一致'), { code: 'INVALID_INPUT' });
};

export function createFractionQuestion(id, goal, difficulty = 'self_report', parent = null) {
  if (typeof goal !== 'string' || goal.length > 80) return null;
  const match = expression.exec(goal);
  if (!match) return null;
  const a = Number(match[1]),
    b = Number(match[2]),
    c = Number(match[4]),
    d = Number(match[5]),
    operator = operators[match[3]];
  if (!b || !d || (operator === '/' && !c)) return null;
  const result = exactNumberOperation(`${a}/${b}`, operator, `${c}/${d}`);
  if (!result) return null;
  return {
    id,
    version: 1,
    prompt: `计算 ${a}/${b} ${symbols[operator]} ${c}/${d}。`,
    scope: 'generated',
    subject: '数学',
    knowledgePoint: ['+', '-'].includes(operator) ? '分数加减与通分' : '分数乘除与约分',
    answerType: 'number',
    difficulty,
    source: { kind: 'executable', evidenceId: FRACTION_CONTRACT },
    validation: {
      type: 'number',
      answer: result[1] === 1 ? String(result[0]) : `${result[0]}/${result[1]}`,
      authority: 'executable',
      evidenceId: FRACTION_CONTRACT
    },
    uncertainties: [],
    ...(parent
      ? {
          parentQuestionKey: typeof parent === 'string' ? parent : `${parent.id}@${parent.version}`,
          variantChange: '改变分数数值，独立检验通分或乘除'
        }
      : {})
  };
}
function canonicalQuestion(q) {
  const match = /^计算 (.+)。$/u.exec(q?.prompt || '');
  const expected = match && createFractionQuestion(q.id, match[1], q.difficulty, q.parentQuestionKey);
  requireFraction(
    expected &&
      ['version', 'prompt', 'scope', 'subject', 'knowledgePoint', 'answerType', 'variantChange'].every(
        (key) => q[key] === expected[key]
      )
  );
  requireFraction(sameObject(q.source, expected.source));
  requireFraction(
    !q.options?.length &&
      !q.rubric &&
      !q.materialExercise &&
      !q.writingExercise &&
      !q.scienceExercise &&
      !q.sentenceExercise &&
      !q.vocabularyExercise &&
      !q.vocabularyReview &&
      !q.prerequisite &&
      !q.oatutorExercise &&
      q.expectedAnswer == null
  );
  requireFraction(!q.validation || sameObject(q.validation, expected.validation));
  return expected;
}
export function normalizeFractionQuestion(q) {
  if (q.source?.evidenceId !== FRACTION_CONTRACT && q.validation?.evidenceId !== FRACTION_CONTRACT) return;
  q.validation = canonicalQuestion(q).validation;
}
export function gradeFractionAnswer(q, answer) {
  try {
    const expected = canonicalQuestion(q);
    requireFraction(sameObject(q.validation, expected.validation) && !q.uncertainties?.some((v) => !v.resolved));
    const actual = parseExactNumberAnswer(answer),
      reference = parseExactNumberAnswer(expected.validation.answer);
    if (!actual) return { status: 'pending', outcome: null, basis: 'unsupported_expression_or_unit' };
    return {
      status: 'reliable',
      outcome: actual[0] === reference[0] && actual[1] === reference[1] ? 'correct' : 'wrong',
      basis: FRACTION_CONTRACT,
      evaluator: 'deterministic-exact-v1',
      authority: 'executable'
    };
  } catch {
    return { status: 'pending', outcome: null, basis: 'no_independent_reference' };
  }
}
export function createFractionVariant(id, parent, difficulty = 'self_report') {
  if (parent?.source?.evidenceId !== FRACTION_CONTRACT) return null;
  try {
    canonicalQuestion(parent);
    const m = expression.exec(parent.prompt.slice(3, -1)),
      a = Number(m[1]),
      c = Number(m[4]);
    return createFractionQuestion(
      id,
      `${a < 9999 ? a + 1 : a - 1}/${m[2]} ${m[3]} ${m[3] === '×' && c === 0 ? 1 : c}/${m[5]}`,
      difficulty,
      parent
    );
  } catch {
    return null;
  }
}
export function fractionTeaching(q, method, level = 1) {
  if (q?.source?.evidenceId !== FRACTION_CONTRACT) return null;
  let expected;
  try {
    expected = canonicalQuestion(q);
  } catch {
    return null;
  }
  if (['check', 'review'].includes(method))
    return { method, helped: false, content: '请独立作答；原有帮助经历保留，再用不同分数检验。' };
  if (!['explain', 'hint', 'steps', 'prerequisite', 'question', 'example'].includes(method)) return null;
  const additive = ['+', '−'].some((operator) => q.prompt.includes(` ${operator} `));
  const hint = additive
    ? '加减先通分，再对分子运算并约分；不能把分子和分母分别相加。'
    : '乘法将分子、分母分别相乘并约分；除法先检查除数非零，再乘以它的倒数。';
  if (method === 'example')
    return {
      method,
      helped: true,
      level: 2,
      content: additive
        ? '例如 1/2 + 1/3 = 3/6 + 2/6 = 5/6。先统一分母，再回原题检验。'
        : '例如 2/3 ÷ 4/5 = 2/3 × 5/4 = 5/6。除法乘倒数，再约分。'
    };
  if (method === 'question')
    return {
      method,
      helped: true,
      level: 1,
      content: additive
        ? '两个分母是否相同？能用哪个共同分母保留原分数的值？'
        : '这是乘法还是除法？若是除法，除数是否非零，它的倒数是什么？'
    };
  return {
    method,
    helped: true,
    level,
    content:
      method === 'hint' && level < 3
        ? hint
        : `${hint} 本题精确结果为 ${expected.validation.answer}；等值分数可以，舍入小数不能替代精确值。`
  };
}
