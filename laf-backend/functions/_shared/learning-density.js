import { exactMotionText } from './learning-visual.js';

export const DENSITY_TEMPLATE = 'mass_density';
export const DENSITY_BASIS = Object.freeze({
  title: 'NIST Guide to the SI · 8.6.7 Mass density',
  url: 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-8',
  purpose: 'definition_reference',
  copiedTextOrMedia: false,
  scoringAuthority: false
});
const targets = ['density', 'mass', 'volume', 'density_si'];
const fields = {
  density: ['massG', 'volumeCm3'],
  mass: ['densityGcm3', 'volumeCm3'],
  volume: ['massG', 'densityGcm3'],
  density_si: ['massG', 'volumeCm3']
};
function requireDensity(ok, message, code = 'INVALID_INPUT') {
  if (!ok) throw Object.assign(new Error(message), { code });
}
const fraction = (n, d = 1) => {
  requireDensity(Number.isSafeInteger(n) && Number.isSafeInteger(d) && d > 0, '计算超出精确范围', 'RESOURCE_LIMIT');
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return [n / a, d / a];
};
const number = (v) => fraction(Math.round(v * 100), 100);
const multiply = (a, b) => fraction(a[0] * b[0], a[1] * b[1]);
const divide = (a, b) => fraction(a[0] * b[1], a[1] * b[0]);

export function densityInput(input) {
  requireDensity(input && typeof input === 'object' && !Array.isArray(input), '密度条件不合法');
  requireDensity(input.template === DENSITY_TEMPLATE && targets.includes(input.target), '密度任务不支持');
  const keys = ['template', 'target', ...fields[input.target]];
  requireDensity(
    Object.keys(input).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(input, key)),
    '密度条件包含未知或遗漏字段'
  );
  const result = { template: DENSITY_TEMPLATE, target: input.target };
  for (const key of fields[input.target]) {
    const value = input[key];
    requireDensity(
      typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0.01 &&
        value <= (key === 'densityGcm3' ? 100 : 10000) &&
        value === Number(value.toFixed(2)),
      '质量/体积需0.01–10000，密度需0.01–100；最多两位小数'
    );
    result[key] = value;
  }
  return result;
}
export function densityResult(raw) {
  const input = densityInput(raw);
  if (input.target === 'mass')
    return { exact: multiply(number(input.densityGcm3), number(input.volumeCm3)), unit: 'g' };
  if (input.target === 'volume') return { exact: divide(number(input.massG), number(input.densityGcm3)), unit: 'cm³' };
  const exact = divide(number(input.massG), number(input.volumeCm3));
  return input.target === 'density_si'
    ? { exact: multiply(exact, [1000, 1]), unit: 'kg/m³' }
    : { exact, unit: 'g/cm³' };
}
function seed(input) {
  return fields[input.target].reduce((sum, key, index) => sum + Math.round(input[key] * 100) * (index + 1), 0) % 997;
}
export function nextDensityInput(raw) {
  const input = densityInput(raw),
    value = seed(input),
    target = targets[(targets.indexOf(input.target) + 1) % targets.length];
  const quantities = {
    massG: 50 + (value % 300),
    volumeCm3: 20 + (value % 80),
    densityGcm3: (100 + (value % 900)) / 100
  };
  return densityInput({
    template: DENSITY_TEMPLATE,
    target,
    ...Object.fromEntries(fields[target].map((key) => [key, quantities[key]]))
  });
}
export function densityHelpContent(raw) {
  const input = densityInput(raw);
  const method =
    input.target === 'mass'
      ? '质量＝密度×体积'
      : input.target === 'volume'
        ? '体积＝质量÷密度'
        : input.target === 'density_si'
          ? '先用质量÷体积求g/cm³，再乘1000换成kg/m³'
          : '密度＝质量÷体积';
  return `本题计算帮助：${method}；按题设单位计算，必要时保留分数。`;
}
export function densityChoices(raw) {
  const input = densityInput(raw),
    { exact, unit } = densityResult(input);
  const candidates = [
    exact,
    fraction(exact[1], exact[0]),
    multiply(exact, [1000, 1]),
    divide(exact, [1000, 1]),
    fraction(exact[0] + exact[1], exact[1])
  ];
  const values = [...new Map(candidates.map((v) => [v.join('/'), v])).values()].slice(0, 4);
  requireDensity(values.length === 4, '本题选项未完整生成', 'RESOURCE_LIMIT');
  const labels = values.map((value) => `${exactMotionText(value)}${unit}`),
    correct = labels[0],
    offset = (seed(input) + targets.indexOf(input.target)) % 4;
  const rotated = labels.slice(offset).concat(labels.slice(0, offset));
  const prompt =
    input.target === 'mass'
      ? `某样品的平均密度为${input.densityGcm3}g/cm³，体积为${input.volumeCm3}cm³。样品质量是多少g？`
      : input.target === 'volume'
        ? `某样品质量为${input.massG}g，平均密度为${input.densityGcm3}g/cm³。样品体积是多少cm³？`
        : `某样品质量为${input.massG}g，体积为${input.volumeCm3}cm³。样品平均密度是多少${unit}？`;
  return {
    prompt: `${prompt}请选择准确值，必要时保留分数。`,
    options: rotated.map((label, index) => `${'ABCD'[index]}. ${label}`),
    answer: 'ABCD'[rotated.indexOf(correct)]
  };
}
