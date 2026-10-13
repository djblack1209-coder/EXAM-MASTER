// 有界纯函数解析器：无 eval、动态代码、网络或系统命令。精确整数运算越界即降级。
export const ALGEBRA_CONTRACT = 'safe-algebra-v1';
export const INEQUALITY_CONTRACT = 'safe-linear-inequality-v1';
export const QUADRATIC_INEQUALITY_CONTRACT = 'safe-quadratic-inequality-v1';
export const ALGEBRA_LIMITS = Object.freeze({
  characters: 256,
  tokens: 128,
  depth: 16,
  power: 6,
  degree: 6,
  rational: 1e9
});
class AlgebraError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = (code = 'unsupported_expression') => {
  throw new AlgebraError(code);
};
const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
};
const safe = (n) => {
  if (!Number.isSafeInteger(n)) fail('resource_limit');
  return n;
};
const rational = (n, d = 1) => {
  safe(n);
  safe(d);
  if (!d) fail('undefined_expression');
  const g = gcd(n, d),
    sign = d < 0 ? -1 : 1;
  n = (n / g) * sign;
  d = Math.abs(d / g);
  if (Math.abs(n) > ALGEBRA_LIMITS.rational || d > ALGEBRA_LIMITS.rational) fail('resource_limit');
  return [n || 0, d];
};
const zero = () => [0, 1];
const add = (a, b) => {
  const g = gcd(a[1], b[1]);
  return rational(safe(safe(a[0] * (b[1] / g)) + safe(b[0] * (a[1] / g))), safe(a[1] * (b[1] / g)));
};
const neg = (a) => [a[0] ? -a[0] : 0, a[1]];
const mul = (a, b) => {
  const g = gcd(a[0], b[1]),
    h = gcd(b[0], a[1]);
  return rational(safe((a[0] / g) * (b[0] / h)), safe((a[1] / h) * (b[1] / g)));
};
const div = (a, b) => {
  if (!b[0]) fail('undefined_expression');
  return mul(a, rational(b[1], b[0]));
};
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const fractionText = (a) => (a[1] === 1 ? String(a[0]) : `${a[0]}/${a[1]}`);
const trim = (p) => {
  while (p.length > 1 && !p.at(-1)[0]) p.pop();
  return p;
};
const polynomialAdd = (a, b) =>
  trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] || zero(), b[i] || zero())));
const polynomialNeg = (a) => a.map(neg);
const polynomialMul = (a, b) => {
  if (a.length + b.length - 2 > 2 * ALGEBRA_LIMITS.degree) fail('resource_limit');
  const result = Array.from({ length: a.length + b.length - 1 }, zero);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) result[i + j] = add(result[i + j], mul(a[i], b[j]));
  return trim(result);
};
const polynomialSame = (a, b) => a.length === b.length && a.every((v, i) => same(v, b[i]));
const isZero = (p) => p.length === 1 && !p[0][0];
const constant = (r) => ({ numerator: [r], denominator: [[1, 1]], restrictions: [] });
const combine = (a, b, operator) => {
  let numerator, denominator;
  const restrictions = [...a.restrictions, ...b.restrictions];
  if (operator === '+' || operator === '-') {
    numerator = polynomialAdd(
      polynomialMul(a.numerator, b.denominator),
      polynomialMul(operator === '-' ? polynomialNeg(b.numerator) : b.numerator, a.denominator)
    );
    denominator = polynomialMul(a.denominator, b.denominator);
  } else if (operator === '*') {
    numerator = polynomialMul(a.numerator, b.numerator);
    denominator = polynomialMul(a.denominator, b.denominator);
  } else {
    if (isZero(b.numerator)) fail('undefined_expression');
    restrictions.push(b.numerator);
    numerator = polynomialMul(a.numerator, b.denominator);
    denominator = polynomialMul(a.denominator, b.numerator);
  }
  if (numerator.length - 1 > ALGEBRA_LIMITS.degree || denominator.length - 1 > ALGEBRA_LIMITS.degree)
    fail('resource_limit');
  return { numerator, denominator, restrictions };
};

function notation(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > ALGEBRA_LIMITS.characters) fail('resource_limit');
  let input = raw
    .trim()
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
  if (input.startsWith('$') && input.endsWith('$')) input = input.slice(1, -1);
  let expansions = 0;
  const expand = (value, depth) => {
    if (depth > ALGEBRA_LIMITS.depth) fail('resource_limit');
    let result = '',
      position = 0;
    while (position < value.length) {
      if (!value.startsWith('\\frac', position)) {
        result += value[position++];
        continue;
      }
      if (++expansions > 12) fail('resource_limit');
      position += 5;
      const group = () => {
        while (/\s/.test(value[position] || '') && position < value.length) position++;
        if (value[position++] !== '{') fail();
        const start = position;
        let nesting = 1;
        while (position < value.length && nesting) {
          if (value[position] === '{') nesting++;
          if (value[position] === '}') nesting--;
          position++;
        }
        if (nesting) fail();
        return expand(value.slice(start, position - 1), depth + 1);
      };
      const numerator = group(),
        denominator = group();
      result += `((${numerator})/(${denominator}))`;
      if (result.length > 512) fail('resource_limit');
    }
    return result;
  };
  input = expand(input, 0);
  if (input.length > 512) fail('resource_limit');
  return input;
}

export function parseAlgebraExpression(raw) {
  const input = notation(raw),
    tokens = [];
  let position = 0;
  while (position < input.length) {
    if (/\s/.test(input[position])) {
      position++;
      continue;
    }
    const number = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(input.slice(position));
    if (number) {
      tokens.push(number[0]);
      position += number[0].length;
    } else if (/[x()+\-*/^]/.test(input[position])) tokens.push(input[position++]);
    else fail();
    if (tokens.length > ALGEBRA_LIMITS.tokens) fail('resource_limit');
  }
  let cursor = 0,
    depth = 0;
  const take = () => tokens[cursor++],
    peek = () => tokens[cursor];
  const atom = () => {
    if (++depth > ALGEBRA_LIMITS.depth) fail('resource_limit');
    let value;
    if (peek() === '(') {
      take();
      value = sum();
      if (take() !== ')') fail();
    } else if (peek() === 'x') {
      take();
      value = { numerator: [zero(), [1, 1]], denominator: [[1, 1]], restrictions: [] };
    } else if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(peek() || '')) {
      const decimal = take(),
        places = decimal.includes('.') ? decimal.split('.')[1].length : 0;
      if (places > 9) fail('resource_limit');
      value = constant(rational(Number(decimal.replace('.', '')), 10 ** places));
    } else fail();
    depth--;
    return value;
  };
  const power = () => {
    let base = atom();
    if (peek() === '^') {
      take();
      let sign = 1;
      if (peek() === '+' || peek() === '-') sign = take() === '-' ? -1 : 1;
      const token = take();
      if (!/^\d+$/.test(token || '') || Number(token) > ALGEBRA_LIMITS.power) fail('resource_limit');
      const exponent = sign * Number(token),
        restrictions = base.restrictions.slice();
      if (exponent <= 0) {
        if (isZero(base.numerator)) fail('undefined_expression');
        restrictions.push(base.numerator);
      }
      if (exponent < 0) base = { numerator: base.denominator, denominator: base.numerator, restrictions };
      let result = constant([1, 1]);
      for (let i = 0; i < Math.abs(exponent); i++) result = combine(result, base, '*');
      base = { ...result, restrictions };
    }
    return base;
  };
  const unary = () => {
    if (peek() === '+' || peek() === '-') {
      const sign = take();
      const value = unary();
      return sign === '-' ? { ...value, numerator: polynomialNeg(value.numerator) } : value;
    }
    return power();
  };
  const product = () => {
    let value = unary();
    let divided = false;
    while (peek() === '*' || peek() === '/' || peek() === 'x' || peek() === '(') {
      if (divided && (peek() === 'x' || peek() === '(')) fail('ambiguous_implicit_division');
      const operator = peek() === '*' || peek() === '/' ? take() : '*';
      divided = operator === '/';
      value = combine(value, unary(), operator);
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const operator = take();
      value = combine(value, product(), operator);
    }
    return value;
  };
  const result = sum();
  if (cursor !== tokens.length) fail();
  return result;
}

const inDomain = (r, domain) =>
  domain === 'real' || (domain === 'integer' && r[1] === 1) || (domain === 'positive' && r[0] > 0);
const unique = (values) =>
  values
    .filter((v, i) => !values.slice(0, i).some((other) => same(v, other)))
    .sort((a, b) => a[0] / a[1] - b[0] / b[1]);
function roots(polynomial) {
  if (polynomial.length === 1) return { all: !polynomial[0][0], values: [] };
  if (polynomial.length === 2) return { all: false, values: [div(neg(polynomial[0]), polynomial[1])] };
  if (polynomial.length !== 3) fail('unsupported_roots');
  const [c, b, a] = polynomial;
  const discriminant = add(mul(b, b), neg(mul([4, 1], mul(a, c))));
  if (discriminant[0] < 0) return { all: false, values: [] };
  const n = Math.round(Math.sqrt(discriminant[0])),
    d = Math.round(Math.sqrt(discriminant[1]));
  if (n * n !== discriminant[0] || d * d !== discriminant[1]) fail('unsupported_irrational_roots');
  const square = rational(n, d),
    denominator = mul([2, 1], a);
  return {
    all: false,
    values: unique([div(add(neg(b), square), denominator), div(add(neg(b), neg(square)), denominator)])
  };
}
function exclusions(expression, domain = 'real') {
  const excluded = [];
  for (const condition of expression.restrictions) {
    const result = roots(condition);
    if (result.all) fail('undefined_expression');
    excluded.push(...result.values.filter((v) => inDomain(v, domain)));
  }
  return unique(excluded);
}
const polynomialValue = (polynomial, x) =>
  polynomial.reduceRight((value, coefficient) => add(mul(value, x), coefficient), zero());
const setSame = (a, b) => a.length === b.length && a.every((v) => b.some((other) => same(v, other)));
function exactConstant(raw) {
  const expression = parseAlgebraExpression(raw);
  if (expression.numerator.length !== 1 || expression.denominator.length !== 1) fail();
  exclusions(expression);
  return div(expression.numerator[0], expression.denominator[0]);
}
// 数值作答只接收一个整数/小数或分数，不把任意代数表达式当成数值答案。
// 沿同一有理数上限与安全整数运算，不能算准时返回 null，不转为近似比较。
export function parseExactNumberAnswer(raw, unit = '') {
  if (typeof raw !== 'string' || raw.length > ALGEBRA_LIMITS.characters || !['', '%'].includes(unit)) return null;
  let value = raw.trim().replace(/^(?:我的答案是|我的答案[：:]|答案[是为：:])\s*/, '');
  if (unit) {
    if (!value.endsWith(unit)) return null;
    value = value.slice(0, -unit.length).trim();
  }
  const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s*\/\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)))?$/.exec(value);
  if (!match) return null;
  try {
    return match[2] ? div(exactConstant(match[1]), exactConstant(match[2])) : exactConstant(match[1]);
  } catch {
    return null;
  }
}
// 模型计算验收显式使用；不用于学生作答分类、判分或历史事件重放。
// 规范带分数的符号作用于整体，仍受原精确有理数/字符上限约束。
export function parseExactModelNumberCheck(raw, unit = '') {
  if (
    typeof raw !== 'string' ||
    raw.length > ALGEBRA_LIMITS.characters ||
    /[\r\n\u2028\u2029]/u.test(raw) ||
    !['', '%'].includes(unit)
  )
    return null;
  const plain = parseExactNumberAnswer(raw, unit);
  if (plain) return plain;
  let value = raw.trim();
  if (unit) {
    if (!value.endsWith(unit)) return null;
    value = value.slice(0, -unit.length).trim();
  }
  const space = '[ \\t\\u00a0\\u202f]';
  // 先识别单个排版分数字符；整体NFKC会把“33⅓”拼成“331⁄3”，不能用来确定数值。
  const glyph = new RegExp('^([+-]?)(?:(\\d+)' + space + '*)?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅐⅑⅒])$', 'u').exec(value);
  if (glyph) {
    const fractions = {
      '½': [1, 2],
      '⅓': [1, 3],
      '⅔': [2, 3],
      '¼': [1, 4],
      '¾': [3, 4],
      '⅕': [1, 5],
      '⅖': [2, 5],
      '⅗': [3, 5],
      '⅘': [4, 5],
      '⅙': [1, 6],
      '⅚': [5, 6],
      '⅛': [1, 8],
      '⅜': [3, 8],
      '⅝': [5, 8],
      '⅞': [7, 8],
      '⅐': [1, 7],
      '⅑': [1, 9],
      '⅒': [1, 10]
    };
    try {
      const result = add(exactConstant(glyph[2] || '0'), rational(...fractions[glyph[3]]));
      return glyph[1] === '-' ? neg(result) : result;
    } catch {
      return null;
    }
  }
  const mixed = new RegExp(`^([+-]?)(\\d+)${space}+(\\d+)${space}*/${space}*(\\d+)$`, 'u').exec(value);
  if (!mixed) return null;
  try {
    const whole = exactConstant(mixed[2]),
      numerator = exactConstant(mixed[3]),
      denominator = exactConstant(mixed[4]);
    if (numerator[0] <= 0 || numerator[0] >= denominator[0]) return null;
    const result = add(whole, div(numerator, denominator));
    return mixed[1] === '-' ? neg(result) : result;
  } catch {
    return null;
  }
}
// 单独的最后核对行；标签和值不能跨行，也不能由正文片段或多个核对值推断。
export function extractExactModelNumberCheck(message, unit = '%') {
  if (typeof message !== 'string' || message.length > 8000 || /[\u2028\u2029]/u.test(message)) return null;
  const normalized = message.replace(/\r\n/g, '\n');
  if (normalized.includes('\r')) return null;
  const lines = normalized.split('\n');
  while (lines.length && /^[ \t\u00a0\u202f]*$/u.test(lines.at(-1))) lines.pop();
  const label = /^[ \t\u00a0\u202f]*计算核对[：:]/u;
  if (lines.filter((line) => label.test(line)).length !== 1) return null;
  const match = /^[ \t\u00a0\u202f]*计算核对[：:][ \t\u00a0\u202f]*(.*)$/u.exec(lines.at(-1) || '');
  if (!match) return null;
  const raw = match[1].trim(),
    exact = parseExactModelNumberCheck(raw, unit);
  return exact ? { raw, exact } : null;
}
export function exactMaterialNumber(kind, from, to) {
  if (!['difference', 'growth_percent', 'share_percent'].includes(kind)) fail();
  if (![from, to].every((value) => typeof value === 'string' && /^[+-]?\d{1,9}(?:\.\d{1,6})?$/.test(value)))
    fail('unsupported_material_number');
  const a = exactConstant(from),
    b = exactConstant(to);
  if (kind === 'growth_percent' && (a[0] <= 0 || b[0] < 0)) fail('invalid_growth_base');
  if (kind === 'share_percent' && (a[0] < 0 || b[0] <= 0 || compareRational(a, b) > 0)) fail('invalid_share_total');
  const value =
    kind === 'difference'
      ? add(b, neg(a))
      : kind === 'growth_percent'
        ? mul(div(add(b, neg(a)), a), [100, 1])
        : mul(div(a, b), [100, 1]);
  return fractionText(value);
}
function finiteSet(raw) {
  let value = raw.trim();
  if (value.startsWith('{') && value.endsWith('}')) value = value.slice(1, -1);
  if (!value || value === '无解' || value === '空集' || value === '∅') return [];
  value = value.replace(/^x\s*=\s*/, '');
  if (value.startsWith('±')) {
    const r = exactConstant(value.slice(1));
    return unique([r, neg(r)]);
  }
  const parts = value.split(/[,，、;；]|或/);
  if (parts.length > 12) fail('resource_limit');
  return unique(parts.map((part) => exactConstant(part.trim().replace(/^x\s*=\s*/, ''))));
}
function answerParts(raw) {
  if (typeof raw !== 'string' || raw.length > 512) fail('resource_limit');
  const value = raw
    .trim()
    .replace(/^(?:我的答案是|我的答案[：:]|答案[是为：:]|解为)\s*/, '')
    .replace(/[。]$/, '');
  const match = /^(.*?)[,，;；]\s*(?:且\s*)?x\s*(?:≠|!=)\s*(.+)$/.exec(value);
  return { body: match ? match[1].trim() : value, stated: match ? finiteSet(match[2]) : [] };
}
const domainLabels = { real: '实数', integer: '整数', positive: '正数' };
const comparisonNotation = (raw) =>
  raw
    .replace(/≤|\\leq?\b/g, '<=')
    .replace(/≥|\\geq?\b/g, '>=')
    .replace(/[−–]/g, '-');
const reverseComparison = (operator) => ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' })[operator];
const compareRational = (a, b) => Math.sign(safe(a[0] * b[1]) - safe(b[0] * a[1]));
const compareValue = (value, operator) =>
  operator === '<' ? value < 0 : operator === '<=' ? value <= 0 : operator === '>' ? value > 0 : value >= 0;
// 全部有理零点/分母零点划分实轴，二次及以下多项式在每个开区间内符号不变。
// 代表点用于确定该整段符号，不是以几个随机试值推断恒真。
export function partitionAlgebraPredicates(predicates, domain = 'real', excludedText = '') {
  if (!Array.isArray(predicates) || predicates.length !== 2 || !['real', 'integer', 'positive'].includes(domain))
    fail();
  if (typeof excludedText !== 'string' || excludedText.length > ALGEBRA_LIMITS.characters) fail('resource_limit');
  const excludedParts = excludedText ? excludedText.split(/[,，、]/) : [];
  if (excludedParts.length > 12) fail('resource_limit');
  const excluded = unique(excludedParts.map((part) => exactConstant(part.trim())));
  const parsed = predicates.map((raw) => {
    if (typeof raw !== 'string' || raw.length > ALGEBRA_LIMITS.characters) fail('resource_limit');
    const parts = comparisonNotation(raw)
      .replace(/≠/g, '!=')
      .split(/(<=|>=|!=|<|>|=)/);
    if (parts.length !== 3) fail('unsupported_condition');
    const expression = combine(parseAlgebraExpression(parts[0]), parseAlgebraExpression(parts[2]), '-');
    if (
      expression.numerator.length > 3 ||
      expression.denominator.length > 3 ||
      expression.restrictions.some((p) => p.length > 3)
    )
      fail('unsupported_condition_degree');
    const poles = exclusions(expression, domain);
    if (poles.some((p) => !excluded.some((x) => same(x, p)))) fail('missing_shared_domain');
    return { expression, operator: parts[1] };
  });
  const boundaries = unique([
    ...excluded,
    ...(domain === 'positive' ? [[0, 1]] : []),
    ...parsed.flatMap((p) => [...roots(p.expression.numerator).values, ...roots(p.expression.denominator).values])
  ]);
  const evaluate = (p, x) => {
    const e = p.expression;
    if (!polynomialValue(e.denominator, x)[0] || e.restrictions.some((r) => !polynomialValue(r, x)[0]))
      fail('reference_check_failed');
    const value = div(polynomialValue(e.numerator, x), polynomialValue(e.denominator, x))[0];
    return p.operator === '=' ? value === 0 : p.operator === '!=' ? value !== 0 : compareValue(value, p.operator);
  };
  const cells = [];
  const addCell = (lower, upper, point = false) => {
    let witness;
    if (point) witness = lower;
    else if (domain === 'integer') {
      const n = lower ? Math.floor(lower[0] / lower[1]) + 1 : upper ? Math.ceil(upper[0] / upper[1]) - 1 : 0;
      witness = rational(n);
      if (upper && compareRational(witness, upper) >= 0) return;
    } else
      witness = !lower
        ? upper
          ? add(upper, [-1, 1])
          : zero()
        : !upper
          ? add(lower, [1, 1])
          : div(add(lower, upper), [2, 1]);
    if (!inDomain(witness, domain) || (point && excluded.some((x) => same(x, witness)))) return;
    cells.push({ lower, upper, point, witness, truth: parsed.map((p) => evaluate(p, witness)) });
  };
  for (let i = 0; i <= boundaries.length; i++) {
    addCell(boundaries[i - 1] || null, boundaries[i] || null);
    if (i < boundaries.length) addCell(boundaries[i], boundaries[i], true);
  }
  return { domain, excluded, cells };
}
const allRealInterval = () => ({ lower: null, upper: null, lowerClosed: false, upperClosed: false });
function halfLine(operator, threshold) {
  const lower = operator.startsWith('>');
  return {
    lower: lower ? threshold : null,
    upper: lower ? null : threshold,
    lowerClosed: lower && operator.endsWith('='),
    upperClosed: !lower && operator.endsWith('=')
  };
}
function canonicalIntervals(intervals) {
  for (const interval of intervals) {
    if ((!interval.lower && interval.lowerClosed) || (!interval.upper && interval.upperClosed))
      fail('invalid_infinite_boundary');
    if (interval.lower && interval.upper && compareRational(interval.lower, interval.upper) > 0)
      fail('reversed_interval');
  }
  const nonempty = intervals.filter(
    (v) => !v.lower || !v.upper || compareRational(v.lower, v.upper) < 0 || (v.lowerClosed && v.upperClosed)
  );
  const sorted = nonempty.sort((a, b) =>
    a.lower === null ? (b.lower === null ? 0 : -1) : b.lower === null ? 1 : compareRational(a.lower, b.lower)
  );
  const result = [];
  for (const next of sorted) {
    const prior = result.at(-1);
    const distance = prior && prior.upper && next.lower ? compareRational(prior.upper, next.lower) : 1;
    if (
      !prior ||
      (prior.upper && next.lower && (distance < 0 || (!distance && !prior.upperClosed && !next.lowerClosed)))
    ) {
      result.push({ ...next });
      continue;
    }
    if (prior.lower === null ? next.lower === null : next.lower && same(prior.lower, next.lower))
      prior.lowerClosed ||= next.lowerClosed;
    if (prior.upper === null) continue;
    if (next.upper === null) {
      prior.upper = null;
      prior.upperClosed = false;
    } else {
      const compared = compareRational(next.upper, prior.upper);
      if (compared > 0) {
        prior.upper = next.upper;
        prior.upperClosed = next.upperClosed;
      } else if (!compared) prior.upperClosed ||= next.upperClosed;
    }
  }
  return result;
}
export function parseInequalityAnswer(raw) {
  const { body, stated } = answerParts(raw);
  if (stated.length) fail('unsupported_inequality_domain');
  let input = comparisonNotation(body)
    .replace(/\\infty\b/g, '∞')
    .replace(/\\cup\b/g, '∪')
    .trim();
  input = input.replace(/^x\s*(?:∈|\\in\b)\s*/, '');
  if (['无解', '空集', '∅', '{}'].includes(input)) return [];
  if (['任意实数', '所有实数', '全体实数', 'ℝ', 'R'].includes(input)) return [allRealInterval()];
  const parts = input.split('∪');
  if (parts.length > 4) fail('resource_limit');
  const intervals = parts.map((part) => {
    const value = part.trim();
    if (['(', '['].includes(value[0]) && [')', ']'].includes(value.at(-1))) {
      const endpoints = value
        .slice(1, -1)
        .split(/[,，]/)
        .map((v) => v.trim());
      if (endpoints.length !== 2) fail('unsupported_interval');
      const boundary = (v, side) => {
        if (v === (side === 'lower' ? '-∞' : '∞') || (side === 'upper' && v === '+∞')) return null;
        return exactConstant(v);
      };
      return {
        lower: boundary(endpoints[0], 'lower'),
        upper: boundary(endpoints[1], 'upper'),
        lowerClosed: value[0] === '[',
        upperClosed: value.at(-1) === ']'
      };
    }
    const comparison = value.split(/(<=|>=|<|>)/).map((v) => v.trim());
    if (comparison.length === 3 && comparison[0] === 'x') return halfLine(comparison[1], exactConstant(comparison[2]));
    if (comparison.length === 3 && comparison[2] === 'x')
      return halfLine(reverseComparison(comparison[1]), exactConstant(comparison[0]));
    if (comparison.length === 5 && comparison[2] === 'x') {
      const first = halfLine(reverseComparison(comparison[1]), exactConstant(comparison[0]));
      const last = halfLine(comparison[3], exactConstant(comparison[4]));
      if ((first.lower && last.lower) || (first.upper && last.upper)) fail('ambiguous_interval');
      return {
        lower: first.lower || last.lower,
        upper: first.upper || last.upper,
        lowerClosed: first.lowerClosed || last.lowerClosed,
        upperClosed: first.upperClosed || last.upperClosed
      };
    }
    fail('unsupported_interval');
  });
  return canonicalIntervals(intervals);
}
function deriveLinearInequality(expression) {
  if (expression.length > ALGEBRA_LIMITS.characters) fail('resource_limit');
  const parts = comparisonNotation(expression).split(/(<=|>=|<|>)/);
  if (parts.length !== 3) fail('unsupported_inequality');
  const difference = combine(parseAlgebraExpression(parts[0]), parseAlgebraExpression(parts[2]), '-');
  if (difference.denominator.length !== 1 || difference.restrictions.some((p) => p.length !== 1))
    fail('unsupported_inequality_domain');
  if (difference.numerator.length > 2) fail('unsupported_nonlinear_inequality');
  const a = div(difference.numerator[1] || zero(), difference.denominator[0]);
  const b = div(difference.numerator[0], difference.denominator[0]);
  let intervals;
  if (!a[0]) intervals = compareValue(b[0], parts[1]) ? [allRealInterval()] : [];
  else intervals = [halfLine(a[0] > 0 ? parts[1] : reverseComparison(parts[1]), div(neg(b), a))];
  return {
    type: 'algebra',
    authority: 'executable',
    evidenceId: INEQUALITY_CONTRACT,
    task: 'inequality',
    expression,
    domain: 'real',
    excluded: [],
    solution: { intervals }
  };
}
function deriveQuadraticInequality(expression) {
  if (expression.length > ALGEBRA_LIMITS.characters) fail('resource_limit');
  const parts = comparisonNotation(expression).split(/(<=|>=|<|>)/);
  if (parts.length !== 3) fail('unsupported_inequality');
  const difference = combine(parseAlgebraExpression(parts[0]), parseAlgebraExpression(parts[2]), '-');
  if (difference.denominator.length !== 1 || difference.restrictions.some((p) => p.length !== 1))
    fail('unsupported_inequality_domain');
  if (difference.numerator.length !== 3) fail('unsupported_quadratic_degree');
  // 复用条件关系的完整零点分段。开区间与零点分别核验，再合并邻接解段；不以近似根或随机样本推断。
  const partition = partitionAlgebraPredicates([expression, '0=0']);
  const intervals = canonicalIntervals(
    partition.cells
      .filter((cell) => cell.truth[0])
      .map((cell) => ({
        lower: cell.lower,
        upper: cell.upper,
        lowerClosed: cell.point,
        upperClosed: cell.point
      }))
  );
  return {
    type: 'algebra',
    authority: 'executable',
    evidenceId: QUADRATIC_INEQUALITY_CONTRACT,
    task: 'inequality',
    expression,
    domain: 'real',
    excluded: [],
    solution: { intervals }
  };
}
const intervalsSame = (a, b) =>
  a.length === b.length &&
  a.every(
    (v, i) =>
      (v.lower === null ? b[i].lower === null : b[i].lower && same(v.lower, b[i].lower)) &&
      (v.upper === null ? b[i].upper === null : b[i].upper && same(v.upper, b[i].upper)) &&
      v.lowerClosed === b[i].lowerClosed &&
      v.upperClosed === b[i].upperClosed
  );
export function algebraPrompt(task, expression, domain = 'real') {
  if (task === 'quadratic_inequality') return `在实数范围内解二次不等式 ${expression}，写出完整解集。`;
  if (task === 'inequality') return `在实数范围内解不等式 ${expression}，写出完整解集。`;
  return task === 'equivalence'
    ? `在实数范围内化简 ${expression}，并保留定义域。`
    : `在${domainLabels[domain]}范围内解方程 ${expression}，写出全部精确解。`;
}
export function deriveAlgebraQuestion(prompt) {
  const equivalence = /^在实数范围内化简 (.+)，并保留定义域。$/.exec(prompt || '');
  const equation = /^在(实数|整数|正数)范围内解方程 (.+)，写出全部精确解。$/.exec(prompt || '');
  const inequality = /^在实数范围内解(二次)?不等式 (.+)，写出完整解集。$/.exec(prompt || '');
  if (inequality) {
    const quadratic = Boolean(inequality[1]);
    try {
      return {
        task: 'inequality',
        domain: 'real',
        ...(quadratic ? { quadratic: true } : {}),
        expression: inequality[2],
        status: 'verified',
        validation: quadratic ? deriveQuadraticInequality(inequality[2]) : deriveLinearInequality(inequality[2])
      };
    } catch (error) {
      if (!(error instanceof AlgebraError)) throw error;
      return {
        task: 'inequality',
        ...(quadratic ? { quadratic: true } : {}),
        expression: inequality[2],
        domain: 'real',
        status: 'pending',
        reason: error.code,
        validation: null
      };
    }
  }
  if (!equivalence && !equation) return null;
  const task = equivalence ? 'equivalence' : 'equation',
    domain = equivalence ? 'real' : Object.keys(domainLabels).find((key) => domainLabels[key] === equation[1]);
  const expression = equivalence ? equivalence[1] : equation[2];
  try {
    let reference,
      excluded,
      solution = null;
    if (task === 'equivalence') {
      reference = parseAlgebraExpression(expression);
      excluded = exclusions(reference);
    } else {
      const sides = expression.split('=');
      if (sides.length !== 2) fail();
      reference = combine(parseAlgebraExpression(sides[0]), parseAlgebraExpression(sides[1]), '-');
      excluded = exclusions(reference, domain);
      const result = roots(reference.numerator);
      solution = {
        all: result.all,
        values: result.values.filter((r) => inDomain(r, domain) && !excluded.some((other) => same(r, other)))
      };
      for (const x of solution.values)
        if (
          polynomialValue(reference.numerator, x)[0] ||
          !polynomialValue(reference.denominator, x)[0] ||
          reference.restrictions.some((p) => !polynomialValue(p, x)[0])
        )
          fail('reference_check_failed');
    }
    return {
      task,
      expression,
      domain,
      status: 'verified',
      validation: {
        type: 'algebra',
        authority: 'executable',
        evidenceId: ALGEBRA_CONTRACT,
        task,
        expression,
        domain,
        excluded,
        solution
      }
    };
  } catch (error) {
    if (!(error instanceof AlgebraError)) throw error;
    return { task, expression, domain, status: 'pending', reason: error.code, validation: null };
  }
}
export function normalizeAlgebraQuestion(question) {
  const derived = deriveAlgebraQuestion(question.prompt);
  if (!derived || question.rubric || question.options?.length) {
    if (question.validation?.type === 'algebra') question.validation = null;
    delete question.algebra;
    return question;
  }
  question.answerType = 'algebra';
  question.validation = derived.validation;
  const contract = derived.quadratic
    ? QUADRATIC_INEQUALITY_CONTRACT
    : derived.task === 'inequality'
      ? INEQUALITY_CONTRACT
      : ALGEBRA_CONTRACT;
  question.algebra = {
    contract,
    ...(derived.quadratic ? { quadratic: true } : {}),
    task: derived.task,
    domain: derived.domain,
    status: derived.status,
    reason: derived.reason || null
  };
  question.validationResult = {
    verified: derived.status === 'verified',
    wellPosed: derived.status === 'verified',
    solvable:
      derived.status === 'verified'
        ? derived.task === 'inequality'
          ? derived.validation.solution.intervals.length > 0
          : derived.task !== 'equation' ||
            derived.validation.solution.all ||
            derived.validation.solution.values.length > 0
        : null,
    evidenceId: contract
  };
  return question;
}
const pending = (basis) => ({ status: 'pending', outcome: null, basis });
export function gradeAlgebraAnswer(question, raw) {
  if (question.uncertainties?.some((item) => !item.resolved)) return pending('critical_input_uncertain');
  const reference = deriveAlgebraQuestion(question.prompt);
  if (!reference?.validation || question.rubric || question.options?.length)
    return pending(reference?.reason || 'no_independent_reference');
  try {
    const { body, stated } = answerParts(raw),
      rule = reference.validation;
    let outcome;
    if (reference.task === 'inequality') {
      outcome = intervalsSame(parseInequalityAnswer(raw), rule.solution.intervals) ? 'correct' : 'wrong';
    } else if (reference.task === 'equivalence') {
      if (notation(body).replace(/\s/g, '') === notation(reference.expression).replace(/\s/g, ''))
        return pending('original_expression_repeated');
      const actual = parseAlgebraExpression(body),
        expected = parseAlgebraExpression(reference.expression);
      const actualDomain = unique([...exclusions(actual), ...stated]);
      if (!setSame(actualDomain, rule.excluded)) {
        if (actualDomain.every((r) => rule.excluded.some((v) => same(r, v))))
          return pending('missing_domain_condition');
        outcome = 'wrong';
      } else
        outcome = polynomialSame(
          polynomialMul(actual.numerator, expected.denominator),
          polynomialMul(expected.numerator, actual.denominator)
        )
          ? 'correct'
          : 'wrong';
    } else {
      const allDomains = {
        任意实数: 'real',
        所有实数: 'real',
        ℝ: 'real',
        R: 'real',
        任意整数: 'integer',
        所有整数: 'integer',
        ℤ: 'integer',
        Z: 'integer',
        任意正数: 'positive',
        所有正数: 'positive'
      };
      const all = Object.prototype.hasOwnProperty.call(allDomains, body) ? allDomains[body] : null;
      if (all) {
        if (
          rule.solution.all &&
          all === rule.domain &&
          !setSame(stated, rule.excluded) &&
          stated.every((r) => rule.excluded.some((v) => same(r, v)))
        )
          return pending('missing_domain_condition');
        outcome = rule.solution.all && all === rule.domain && setSame(stated, rule.excluded) ? 'correct' : 'wrong';
      } else {
        const actual = finiteSet(body),
          expected = rule.solution.values;
        if (stated.length) return pending('ambiguous_solution_domain');
        outcome =
          !rule.solution.all && setSame(actual, expected)
            ? 'correct'
            : !rule.solution.all &&
                actual.length > 0 &&
                actual.length < expected.length &&
                actual.every((r) => expected.some((v) => same(r, v)))
              ? 'partial'
              : 'wrong';
      }
    }
    return {
      status: 'reliable',
      outcome,
      basis: rule.evidenceId,
      evaluator: rule.evidenceId,
      authority: 'executable'
    };
  } catch (error) {
    if (!(error instanceof AlgebraError)) throw error;
    return pending(error.code);
  }
}
export function isAlgebraAnswer(question, raw) {
  const reference = deriveAlgebraQuestion(question.prompt);
  if (!reference) return false;
  try {
    const { body } = answerParts(raw);
    if (reference.task === 'inequality') parseInequalityAnswer(raw);
    else if (reference.task === 'equation') {
      if (/^(?:任意|所有)(?:实数|整数|正数)$|^[ℝℤRZ]$/.test(body)) return true;
      finiteSet(body);
    } else parseAlgebraExpression(body);
    return true;
  } catch (error) {
    if (!(error instanceof AlgebraError)) throw error;
    return false;
  }
}
export function createAlgebraQuestion(id, goal, parent = null) {
  let prompt = deriveAlgebraQuestion(goal) ? goal : null;
  const simplify = /^化简\s+(.+)$/.exec(goal.trim());
  const solve = /^(?:(实数|整数|正数)(?:范围内)?\s*)?解方程\s+(.+)$/.exec(goal.trim());
  const inequality = /^(?:实数(?:范围内)?\s*)?解不等式\s+(.+)$/.exec(goal.trim());
  const quadratic = /^(?:实数(?:范围内)?\s*)?解二次不等式\s+(.+)$/.exec(goal.trim());
  if (inequality) prompt = algebraPrompt('inequality', inequality[1]);
  if (quadratic) prompt = algebraPrompt('quadratic_inequality', quadratic[1]);
  if (simplify) prompt = algebraPrompt('equivalence', simplify[1]);
  if (solve)
    prompt = algebraPrompt(
      'equation',
      solve[2],
      solve[1] ? Object.keys(domainLabels).find((key) => domainLabels[key] === solve[1]) : 'real'
    );
  if (!prompt) return null;
  const derived = deriveAlgebraQuestion(prompt),
    task = derived?.task;
  return normalizeAlgebraQuestion({
    id,
    version: 1,
    scope: 'generated',
    prompt,
    subject: '数学',
    knowledgePoint: derived?.quadratic
      ? '二次不等式与完整解集'
      : task === 'inequality'
        ? '一次不等式与解集'
        : solve || task === 'equation'
          ? '方程与定义域'
          : '代数等价与定义域',
    source: {
      kind: 'executable',
      evidenceId: derived?.quadratic
        ? QUADRATIC_INEQUALITY_CONTRACT
        : task === 'inequality'
          ? INEQUALITY_CONTRACT
          : ALGEBRA_CONTRACT
    },
    uncertainties: [],
    ...(parent ? { parentQuestionKey: `${parent.id}@${parent.version}` } : {})
  });
}
function polynomialText(polynomial) {
  return (
    polynomial
      .map((r, i) =>
        r[0]
          ? `${r[0] < 0 ? '-' : '+'}${fractionText([Math.abs(r[0]), r[1]])}${i ? `*x${i > 1 ? `^${i}` : ''}` : ''}`
          : ''
      )
      .reverse()
      .join('')
      .replace(/^\+/, '') || '0'
  );
}
function exactQuotient(numerator, denominator) {
  let remainder = numerator.map((r) => [...r]);
  const quotient = Array.from({ length: Math.max(1, numerator.length - denominator.length + 1) }, zero);
  while (!isZero(remainder) && remainder.length >= denominator.length) {
    const position = remainder.length - denominator.length,
      coefficient = div(remainder.at(-1), denominator.at(-1));
    quotient[position] = coefficient;
    remainder = polynomialAdd(
      remainder,
      polynomialNeg([...Array.from({ length: position }, zero), ...denominator.map((r) => mul(r, coefficient))])
    );
  }
  return isZero(remainder) ? trim(quotient) : null;
}
export function algebraReferenceText(question) {
  const derived = deriveAlgebraQuestion(question.prompt);
  if (!derived?.validation) return null;
  const rule = derived.validation,
    domain = rule.excluded.length ? `，x≠${rule.excluded.map(fractionText).join('、')}` : '';
  if (derived.task === 'inequality') {
    if (derived.quadratic) return intervalSetText(rule.solution.intervals);
    const interval = rule.solution.intervals[0];
    if (!interval) return '无解';
    if (!interval.lower && !interval.upper) return '任意实数';
    return interval.lower
      ? `x${interval.lowerClosed ? '≥' : '>'}${fractionText(interval.lower)}`
      : `x${interval.upperClosed ? '≤' : '<'}${fractionText(interval.upper)}`;
  }
  if (derived.task === 'equation')
    return rule.solution.all
      ? `任意${domainLabels[rule.domain]}${domain}`
      : rule.solution.values.length
        ? rule.solution.values.map(fractionText).join('、')
        : '无解';
  const expression = parseAlgebraExpression(derived.expression);
  let quotient = null;
  try {
    quotient = exactQuotient(expression.numerator, expression.denominator);
  } catch (error) {
    if (!(error instanceof AlgebraError)) throw error;
  }
  return `${quotient ? polynomialText(quotient) : `(${polynomialText(expression.numerator)})/(${polynomialText(expression.denominator)})`}${domain}`;
}
function intervalSetText(intervals) {
  if (!intervals.length) return '无解';
  if (intervals.length === 1 && !intervals[0].lower && !intervals[0].upper) return '任意实数';
  return intervals
    .map(
      (v) =>
        `${v.lowerClosed ? '[' : '('}${v.lower ? fractionText(v.lower) : '-∞'},${v.upper ? fractionText(v.upper) : '∞'}${v.upperClosed ? ']' : ')'}`
    )
    .join('∪');
}
function intervalSetDiagram(intervals) {
  const values = unique(intervals.flatMap((v) => [v.lower, v.upper].filter(Boolean)));
  const position = (value) => (values.length === 1 ? 50 : 30 + 40 * values.findIndex((v) => same(v, value)));
  const boundaries = values.map((value) => ({
    position: position(value),
    value: fractionText(value),
    closed: intervals.some(
      (v) => (v.lower && same(v.lower, value) && v.lowerClosed) || (v.upper && same(v.upper, value) && v.upperClosed)
    )
  }));
  const segments = intervals.map((v) => {
    const left = v.lower ? position(v.lower) : 10;
    const right = v.upper ? position(v.upper) : 90;
    return { left, width: right - left, direction: !v.lower ? '←' : !v.upper ? '→' : '' };
  });
  return {
    kind: 'intervals',
    segments,
    boundaries,
    description: `完整解集：${intervalSetText(intervals)}。${boundaries.map((v) => `边界${v.value}${v.closed ? '包含，用实心点' : '不包含，用空心点'}`).join('；')}。标记全部满足条件的区间或孤立点，未标记部分不属于解集。`
  };
}
export function inequalityDiagram(question) {
  if (
    !question ||
    question.rubric ||
    question.options?.length ||
    question.uncertainties?.some((item) => !item.resolved)
  )
    return null;
  const derived = deriveAlgebraQuestion(question.prompt);
  if (derived?.task !== 'inequality' || !derived.validation) return null;
  const interval = derived.validation.solution.intervals[0];
  if (!interval) return { kind: 'empty', description: '解集为空，数轴上没有满足条件的点。' };
  if (!interval.lower && !interval.upper)
    return { kind: 'all', description: '全部实数都满足条件，整条数轴均属于解集。' };
  if (derived.quadratic) return intervalSetDiagram(derived.validation.solution.intervals);
  const right = interval.lower !== null;
  const boundary = fractionText(right ? interval.lower : interval.upper);
  const closed = right ? interval.lowerClosed : interval.upperClosed;
  return {
    kind: 'half_line',
    right,
    boundary,
    closed,
    description: `边界${boundary}${closed ? '包含，用实心点' : '不包含，用空心点'}；${right ? '右' : '左'}侧全部属于解集，向${right ? '正' : '负'}无穷延伸。`
  };
}
export function createAlgebraVariant(id, parent) {
  if (!parent || parent.rubric || parent.options?.length) return null;
  const derived = deriveAlgebraQuestion(parent?.prompt);
  if (!derived?.validation || parent.uncertainties?.some((item) => !item.resolved)) return null;
  if (derived.task === 'inequality') {
    const [left, operator, right] = comparisonNotation(derived.expression).split(/(<=|>=|<|>)/);
    // 同时负倍缩放和左右对调，关系方向保留；再由原式独立重算验证。
    const q = createAlgebraQuestion(
      id,
      `解${derived.quadratic ? '二次' : ''}不等式 -2*(${right})${operator}-2*(${left})`,
      parent
    );
    if (!q?.validation || !intervalsSame(q.validation.solution.intervals, derived.validation.solution.intervals))
      return null;
    q.variantChange = '改变两边表达、乘以负数并对调左右，检验不等号方向和边界；不是机械换数字';
    return q;
  }
  if (derived.task === 'equation' && derived.domain !== 'real') {
    const q = createAlgebraQuestion(id, `解方程 ${derived.expression}`, parent);
    if (!q?.validation) return null;
    q.variantChange = `从${domainLabels[derived.domain]}解集改为实数解集，检验数域改变对解的筛选，原式条件保留`;
    return q;
  }
  // 改变任务方向：等价式转解集，方程转左右差的等价式，保留原条件与关系。
  const expression =
    derived.task === 'equivalence'
      ? `${derived.expression}=0`
      : derived.expression
          .split('=')
          .map((side) => `(${side})`)
          .join('-');
  const q = createAlgebraQuestion(
    id,
    derived.task === 'equivalence' ? `解方程 ${expression}` : `化简 ${expression}`,
    parent
  );
  if (!q?.validation) return null;
  q.variantChange =
    derived.task === 'equivalence'
      ? '由等价表达转为零点与全部解，检验定义域及解集迁移'
      : '由求解转为恒等表达，检验两边移项及原定义域';
  return q;
}
export function algebraTeaching(question, method, level = 1) {
  if (!question || question.rubric || question.options?.length) return null;
  const derived = deriveAlgebraQuestion(question?.prompt);
  if (!derived?.validation || question.uncertainties?.some((item) => !item.resolved)) return null;
  if (derived.task === 'inequality')
    return derived.quadratic
      ? quadraticInequalityTeaching(question, method, level)
      : inequalityTeaching(question, method, level);
  const equation = derived.task === 'equation',
    reference = algebraReferenceText(question);
  const direct = `有界精确代数工具给出的${equation ? '完整解集' : '等价表达'}：${reference}。${equation ? '结果已代回原条件并排除分母为零的值。' : '这是精确恒等校验，未承诺最简形式。'}`;
  const segments = {
    explain: { content: direct, level: 3 },
    hint: {
      content:
        level >= 3
          ? direct
          : level === 2
            ? equation
              ? '把两边移到同一侧；先求分子零点，再排除原分母零点。不要漏掉第二个根。'
              : '按幂次收集系数；约分前先记录原分母不能为零的条件。'
            : '先写出原式的定义域，再进行等价变形。',
      level: Math.min(3, Math.max(1, level))
    },
    question: {
      content: equation
        ? '哪些 x 值使原方程无定义？移项后应找分子的零点还是分母的零点？'
        : '原分母在哪些值为零？展开后同次幂的系数应怎样合并？',
      level: 1
    },
    steps: {
      content: `① 标记原式不能取的值。② ${equation ? '移项求分子零点并列出所有根' : '展开并合并同类项'}。③ 对照原式核验：${reference}。`,
      level: 3
    },
    prerequisite: {
      content: '先检查先修概念：除数必须非零；等价变形必须保留原定义域。移项改变符号，解集要包含全部满足原条件的值。',
      level: 1
    },
    example: {
      content: equation
        ? '例题 x^2-1=0 可写为 (x-1)(x+1)=0，两个实根为 -1 和 1；逐个代回原式。再独立处理当前题。'
        : '例题 (x^2-1)/(x-1) 等价于 x+1，但必须保留 x≠1。约掉的因子不会恢复原先被排除的值。再独立处理当前题。',
      level: 2
    },
    analogy: {
      content: '定义域像可用输入清单：把算式写短不会扩大这份清单。等价式要逐项对应；方程只选出使两边相等的输入。',
      level: 1
    },
    diagram: {
      content: '本工具没有函数图形渲染能力。可先用结构流程辅助：原条件 → 合并同类项 → 检查分母 → 等价式或完整解集。',
      level: 1
    },
    check: { content: '请独立作答；已使用的帮助保留。新变式的通过仍需后续复测。', helped: false },
    review: { content: '开始原题复测。可靠作答与实际到期条件共同决定复习调度。', helped: false }
  };
  return segments[method] ? { helped: true, method, ...segments[method] } : null;
}
function quadraticInequalityTeaching(question, method, level) {
  const reference = algebraReferenceText(question);
  const direct = `有界二次不等式工具给出的完整实数解集：${reference}。合并两边并求全部精确零点，把实轴分段核验符号，零点是否包含单独检查；重根两侧不一定变号。`;
  const segments = {
    explain: { content: direct, level: 3 },
    hint: {
      content:
        level >= 3
          ? direct
          : level === 2
            ? '先求两边之差等于0的全部根，按顺序划分实轴；检查每一段符号，再决定零点能否取到。没有实根时仍要检查整体符号。'
            : '先把两边移到同一侧，区分严格与非严格不等号。不要只列方程的根，题目要完整区间。',
      level: Math.min(3, Math.max(1, level))
    },
    question: { content: '二次项系数为正还是负？有两个实根、重根还是没有实根？各段符号怎样，零点能否包含？', level: 1 },
    steps: {
      content: `① 合并两边。② 求全部精确零点并分段；重根和无实根单独检查。③ 结合不等号核验每段与零点，完整解集为${reference}。`,
      level: 3
    },
    prerequisite: {
      content:
        '先检查乘积符号和完整解集：同号相乘为正，异号为负；平方非负，重根两侧不变号。严格不等号不包含零点；零点不是整个解集。',
      level: 1
    },
    example: {
      content:
        '另看例题 (x-1)(x-3)<0：零点为1、3；两段外侧因子同号，中间异号，解集为(1,3)。如果改为≤0，零点也要包含。回到当前题独立检验。',
      level: 2
    },
    analogy: {
      content:
        '把零点看成分段标记，逐段判断乘积符号，再合并满足条件的段。标记本身是否属于解集要另查，不能只凭“里外”口诀。',
      level: 1
    },
    diagram: {
      content: `数轴解集：${reference}。${inequalityDiagram(question).description}位置为示意，标签值精确；完整图示按帮助记录，随后需要独立变式检验。`,
      level: 3
    },
    check: {
      content:
        '请独立给出完整解集，可使用-2<x<2、区间或∪并集；仅有一个零点的解集可写[1,1]。已有帮助保留，新变式不继承提示。',
      helped: false
    },
    review: {
      content: '开始二次不等式复测；检查全部分段、重根与开闭边界。仅符合实际到期条件的可靠作答进入复习调度。',
      helped: false
    }
  };
  return segments[method] ? { helped: true, method, ...segments[method] } : null;
}
function inequalityTeaching(question, method, level) {
  const reference = algebraReferenceText(question);
  const direct = `有界一次不等式工具给出的完整实数解集：${reference}。使用精确有理数合并两边；除以负数时反向，严格/非严格边界分别保留。`;
  const segments = {
    explain: { content: direct, level: 3 },
    hint: {
      content:
        level >= 3
          ? direct
          : level === 2
            ? '把两边相减写成 a*x+b 与0比较；若a为负数，除以a时不等号反向。若a为0，直接判断常数关系。'
            : '先区分严格与非严格不等号，再检查移项后x的系数符号。',
      level: Math.min(3, Math.max(1, level))
    },
    question: { content: '移项后x的系数是正、负还是0？除以这个数会不会改变不等号方向？边界值是否允许取到？', level: 1 },
    steps: {
      content: `① 合并同类项。② 检查x系数，零系数单独判断；除以负数反向。③ 保留开闭边界，精确核验结果：${reference}。`,
      level: 3
    },
    prerequisite: {
      content:
        '先检查先修概念：不等式两边乘除同一正数方向不变，同一负数方向反转；严格不等号排除边界。若x系数抵消，可能全体实数或无解，不能除以0。',
      level: 1
    },
    example: {
      content:
        reference === 'x≤2'
          ? '例题 -2*x+8>0：移项为 -2*x>-8，除以-2时反向，得到x<4；4不能取到。回到当前题，独立检查系数和边界。'
          : '例题 -3*x+6≥0：移项为 -3*x≥-6，除以-3时反向，得到x≤2；2可以取到。回到当前题，独立检查系数和边界。',
      level: 2
    },
    analogy: {
      content: '把不等式看成数轴上谁在右边：乘以负数相当于沿0翻转数轴，左右关系交换。类比后仍需按原式检验。',
      level: 1
    },
    diagram: {
      content: `数轴解集：${reference}。${inequalityDiagram(question).description}图形展示当前解集，按完整帮助记录；随后需要独立变式检验。`,
      level: 3
    },
    check: {
      content: '请独立给出完整解集，可使用x<3或(-∞,3)这样的形式；已有提示保留，新变式不会继承原题提示。',
      helped: false
    },
    review: {
      content: '开始一次不等式复测。检查系数符号与开闭边界；仅符合实际到期条件的可靠作答进入复习调度。',
      helped: false
    }
  };
  return segments[method] ? { helped: true, method, ...segments[method] } : null;
}
