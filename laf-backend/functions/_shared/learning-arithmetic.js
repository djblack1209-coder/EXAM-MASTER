import { parseExactNumberAnswer } from './learning-algebra.js';

// 新版本只扩充减法和除法；旧加法、乘法与历史逆运算仍由原合同读取。
export const EXACT_ARITHMETIC_CONTRACT = 'integer-arithmetic-v2';
const expression = /^\s*([+-]?\d{1,5})\s*([-−÷/])\s*([+-]?\d{1,5})\s*[=？?]?\s*$/u;
const prompt = /^计算 ([+-]?\d{1,5}) ([−÷]) ([+-]?\d{1,5})。$/u;
const equal = (a, b) =>
  JSON.stringify(a, function (_key, value) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]])
        )
      : value;
  }) ===
  JSON.stringify(b, function (_key, value) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]])
        )
      : value;
  });
function requireArithmetic(ok) {
  if (!ok) throw Object.assign(new Error('减法或除法题面与校验依据不一致'), { code: 'INVALID_INPUT' });
}
export function createExactArithmeticQuestion(id, goal, difficulty = 'self_report', parent = null) {
  if (typeof goal !== 'string' || goal.length > 80) return null;
  const match = expression.exec(goal);
  if (!match) return null;
  const a = Number(match[1]),
    b = Number(match[3]);
  const subtract = ['-', '−'].includes(match[2]);
  if (!subtract && b === 0) return null;
  const result = subtract ? [a - b, 1] : parseExactNumberAnswer(`${a}/${b}`);
  if (!result) return null;
  const answer = result[1] === 1 ? String(result[0]) : `${result[0]}/${result[1]}`;
  return {
    id,
    version: 1,
    prompt: `计算 ${a} ${subtract ? '−' : '÷'} ${b}。`,
    scope: 'generated',
    subject: '数学',
    knowledgePoint: subtract ? '整数减法' : '整数除法与精确分数',
    answerType: 'number',
    difficulty,
    source: { kind: 'executable', evidenceId: EXACT_ARITHMETIC_CONTRACT },
    validation: { type: 'number', answer, authority: 'executable', evidenceId: EXACT_ARITHMETIC_CONTRACT },
    uncertainties: [],
    ...(parent
      ? {
          parentQuestionKey: typeof parent === 'string' ? parent : `${parent.id}@${parent.version}`,
          variantChange: '改变运算数，独立检验减法或精确除法'
        }
      : {})
  };
}
function canonicalQuestion(q) {
  const match = prompt.exec(q?.prompt || '');
  const expected =
    match &&
    createExactArithmeticQuestion(q.id, `${match[1]} ${match[2]} ${match[3]}`, q.difficulty, q.parentQuestionKey);
  requireArithmetic(
    expected &&
      ['version', 'prompt', 'scope', 'subject', 'knowledgePoint', 'answerType', 'variantChange'].every(
        (key) => q[key] === expected[key]
      )
  );
  requireArithmetic(
    q.source?.kind === expected.source.kind &&
      q.source.evidenceId === EXACT_ARITHMETIC_CONTRACT &&
      Object.keys(q.source).length === 2
  );
  requireArithmetic(
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
  requireArithmetic(!q.validation || equal(q.validation, expected.validation));
  return expected;
}
export function normalizeExactArithmeticQuestion(q) {
  if (q.source?.evidenceId !== EXACT_ARITHMETIC_CONTRACT && q.validation?.evidenceId !== EXACT_ARITHMETIC_CONTRACT)
    return;
  q.validation = canonicalQuestion(q).validation;
}
export function gradeExactArithmeticAnswer(q, answer) {
  try {
    const expected = canonicalQuestion(q);
    requireArithmetic(equal(q.validation, expected.validation) && !q.uncertainties?.some((v) => !v.resolved));
    const actual = parseExactNumberAnswer(answer),
      reference = parseExactNumberAnswer(expected.validation.answer);
    if (!actual) return { status: 'pending', outcome: null, basis: 'unsupported_expression_or_unit' };
    return {
      status: 'reliable',
      outcome: equal(actual, reference) ? 'correct' : 'wrong',
      basis: EXACT_ARITHMETIC_CONTRACT,
      evaluator: 'deterministic-exact-v1',
      authority: 'executable'
    };
  } catch {
    return { status: 'pending', outcome: null, basis: 'no_independent_reference' };
  }
}
export function createExactArithmeticVariant(id, parent, difficulty = 'self_report') {
  if (parent?.source?.evidenceId !== EXACT_ARITHMETIC_CONTRACT) return null;
  try {
    canonicalQuestion(parent);
    const match = prompt.exec(parent.prompt),
      a = Number(match[1]),
      b = Number(match[3]);
    const next = a < 99999 ? a + 1 : a - 1;
    return createExactArithmeticQuestion(id, `${next} ${match[2]} ${b}`, difficulty, parent);
  } catch {
    return null;
  }
}
export function exactArithmeticTeaching(q, method, level = 1) {
  if (q?.source?.evidenceId !== EXACT_ARITHMETIC_CONTRACT) return null;
  let expected;
  try {
    expected = canonicalQuestion(q);
  } catch {
    return null;
  }
  const subtract = q.prompt.includes(' − ');
  if (['check', 'review'].includes(method))
    return { method, helped: false, content: '请独立作答；原有帮助经历仍保留，可用不同运算数检验。' };
  if (!['explain', 'hint', 'steps', 'prerequisite', 'question', 'example'].includes(method)) return null;
  const hint = subtract
    ? '减去一个数等于加上它的相反数，先检查符号。'
    : '除数不能为零；先判断符号，再把商约成分数。不能用舍入小数代替精确值。';
  if (method === 'example')
    return {
      method,
      helped: true,
      level: 2,
      content: subtract
        ? '例如 5 − (-2) = 5 + 2 = 7。减去负数转为加正数，再回到原题独立检验。'
        : '例如 -6 ÷ 4 = -6/4 = -3/2。异号得负商，分子分母同除以2；再回到原题检验。'
    };
  if (method === 'question')
    return {
      method,
      helped: true,
      level: 1,
      content: subtract
        ? '被减去的数，它的相反数是多少？请先确定符号再运算。'
        : '除数是否为零，两个数是否同号？请先确定商的符号，再约分。'
    };
  const revealed = ['explain', 'steps'].includes(method) || (method === 'hint' && level >= 3);
  return {
    method,
    helped: true,
    level: revealed ? 3 : Math.min(2, Math.max(1, level)),
    content: revealed
      ? `${hint}\n${expected.prompt.slice(0, -1)} = ${expected.validation.answer}。用逆运算检查。`
      : hint
  };
}
