import { exactMotionText } from './learning-visual.js';

export const PRESSURE_TEMPLATE = 'normal_contact_pressure';
export const PRESSURE_BASIS = Object.freeze({
  title: 'NIST Guide to the SI · 4.2.1 Table 3 · pascal',
  url: 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes',
  purpose: 'si_unit_reference',
  copiedTextOrMedia: false,
  scoringAuthority: false
});
const targets = ['pressure', 'force', 'area', 'pressure_kpa'];
const fields = {
  pressure: ['normalForceN', 'areaCm2'],
  force: ['pressurePa', 'areaCm2'],
  area: ['normalForceN', 'pressurePa'],
  pressure_kpa: ['normalForceN', 'areaCm2']
};
function requirePressure(ok, message, code = 'INVALID_INPUT') {
  if (!ok) throw Object.assign(new Error(message), { code });
}
function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}
const fraction = (n, d = 1) => {
  requirePressure(Number.isSafeInteger(n) && Number.isSafeInteger(d) && d > 0, '计算超出精确范围', 'RESOURCE_LIMIT');
  const common = gcd(Math.abs(n), d);
  return [n / common, d / common];
};
const number = (value) => fraction(Math.round(value * 100), 100);
function multiply(a, b) {
  const left = gcd(Math.abs(a[0]), b[1]),
    right = gcd(Math.abs(b[0]), a[1]);
  return fraction((a[0] / left) * (b[0] / right), (a[1] / right) * (b[1] / left));
}
const divide = (a, b) => multiply(a, [b[1], b[0]]);

export function pressureInput(input) {
  requirePressure(input && typeof input === 'object' && !Array.isArray(input), '压强条件不合法');
  requirePressure(input.template === PRESSURE_TEMPLATE && targets.includes(input.target), '压强任务不支持');
  requirePressure(input.uniformContact === true, '需明确垂直接触面且压强均匀的条件');
  const keys = ['template', 'target', 'uniformContact', ...fields[input.target]];
  requirePressure(
    Object.keys(input).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(input, key)),
    '压强条件包含未知或遗漏字段'
  );
  const result = { template: PRESSURE_TEMPLATE, target: input.target, uniformContact: true };
  for (const key of fields[input.target]) {
    const value = input[key];
    requirePressure(
      typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0.01 &&
        value <= (key === 'pressurePa' ? 1000000 : 10000) &&
        value === Number(value.toFixed(2)),
      '压力/面积需0.01–10000，压强需0.01–1000000；最多两位小数'
    );
    result[key] = value;
  }
  return result;
}
export function pressureResult(raw) {
  const input = pressureInput(raw);
  if (input.target === 'force')
    return { exact: divide(multiply(number(input.pressurePa), number(input.areaCm2)), [10000, 1]), unit: 'N' };
  if (input.target === 'area')
    return { exact: multiply(divide(number(input.normalForceN), number(input.pressurePa)), [10000, 1]), unit: 'cm²' };
  const exact = multiply(divide(number(input.normalForceN), number(input.areaCm2)), [10000, 1]);
  return input.target === 'pressure_kpa' ? { exact: divide(exact, [1000, 1]), unit: 'kPa' } : { exact, unit: 'Pa' };
}
function seed(input) {
  return fields[input.target].reduce((sum, key, index) => sum + Math.round(input[key] * 100) * (index + 1), 0) % 997;
}
export function nextPressureInput(raw) {
  const input = pressureInput(raw),
    value = seed(input),
    target = targets[(targets.indexOf(input.target) + 1) % targets.length];
  const quantities = {
    normalForceN: 10 + (value % 200),
    areaCm2: 20 + (value % 80),
    pressurePa: 10000 + (value % 900) * 100
  };
  return pressureInput({
    template: PRESSURE_TEMPLATE,
    target,
    uniformContact: true,
    ...Object.fromEntries(fields[target].map((key) => [key, quantities[key]]))
  });
}
export function pressureHelpContent(raw) {
  const input = pressureInput(raw);
  const method =
    input.target === 'force'
      ? '面积从cm²除以10000换成m²，再用压强×面积求垂直压力'
      : input.target === 'area'
        ? '垂直压力÷压强得到m²，再乘10000换成cm²'
        : input.target === 'pressure_kpa'
          ? '面积从cm²除以10000换成m²，用垂直压力÷面积得到Pa，再除以1000换成kPa'
          : '面积从cm²除以10000换成m²，再用垂直压力÷面积求Pa';
  return `本题计算帮助：${method}；接触面压强均匀，必要时保留分数。`;
}
export function pressureChoices(raw) {
  const input = pressureInput(raw),
    { exact, unit } = pressureResult(input);
  const candidates = [
    exact,
    fraction(exact[1], exact[0]),
    divide(exact, [10000, 1]),
    multiply(exact, [1000, 1]),
    fraction(exact[0] + exact[1], exact[1])
  ];
  const values = [...new Map(candidates.map((value) => [value.join('/'), value])).values()].slice(0, 4);
  requirePressure(values.length === 4, '本题选项未完整生成', 'RESOURCE_LIMIT');
  const labels = values.map((value) => `${exactMotionText(value)}${unit}`),
    correct = labels[0],
    offset = (seed(input) + targets.indexOf(input.target)) % 4;
  const rotated = labels.slice(offset).concat(labels.slice(0, offset));
  const prompt =
    input.target === 'force'
      ? `接触面积为${input.areaCm2}cm²，压强为${input.pressurePa}Pa。垂直压力是多少N？`
      : input.target === 'area'
        ? `垂直压力为${input.normalForceN}N，压强为${input.pressurePa}Pa。接触面积是多少cm²？`
        : `垂直压力为${input.normalForceN}N，接触面积为${input.areaCm2}cm²。压强是多少${unit}？`;
  return {
    prompt: `压力垂直接触面且压强均匀。${prompt}请选择准确值，必要时保留分数。`,
    options: rotated.map((label, index) => `${'ABCD'[index]}. ${label}`),
    answer: 'ABCD'[rotated.indexOf(correct)]
  };
}
