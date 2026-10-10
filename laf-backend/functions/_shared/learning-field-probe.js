// 只核验固定合成字段的对应关系，不评估语义理解、真实资料事实或官方等级。
export const FIELD_PROBE_CONTRACT = 'safe-field-locator-v1';
const pairs = {
  en: [
    { key: 'Shelf', value: 'Birch' },
    { key: 'Desk', value: 'Cedar' }
  ],
  zh: [
    { key: '书架', value: '桦木' },
    { key: '书桌', value: '雪松' }
  ]
};
function promptFor(language) {
  const fields = pairs[language];
  return `字段定位基础练习（合成资料）：\n${fields.map((f) => `${f.key}: ${f.value}`).join('\n')}\n\n值“${fields[1].value}”对应哪个字段？只填写字段名，不填写值。`;
}
export function deriveFieldProbe(prompt) {
  const language = Object.keys(pairs).find((key) => prompt === promptFor(key));
  if (!language) return null;
  const fields = pairs[language].map((f) => ({ ...f }));
  return {
    language,
    fields,
    validation: {
      type: 'field_key',
      authority: 'executable',
      evidenceId: FIELD_PROBE_CONTRACT,
      keys: fields.map((f) => f.key),
      answer: fields[1].key
    }
  };
}
export function normalizeFieldProbe(question) {
  const derived = deriveFieldProbe(question.prompt);
  if (
    !derived ||
    question.source?.kind !== 'executable' ||
    question.source.evidenceId !== FIELD_PROBE_CONTRACT ||
    question.rubric ||
    question.options?.length
  ) {
    if (question.validation?.type === 'field_key') question.validation = null;
    return question;
  }
  question.answerType = 'field_key';
  question.validation = derived.validation;
  return question;
}
export function createFieldProbe(id, language) {
  if (!Object.prototype.hasOwnProperty.call(pairs, language)) return null;
  return normalizeFieldProbe({
    id,
    version: 1,
    scope: 'generated',
    subject: '阅读',
    prompt: promptFor(language),
    source: { kind: 'executable', evidenceId: FIELD_PROBE_CONTRACT },
    uncertainties: []
  });
}
export function fieldProbeAnswer(question, raw) {
  if (typeof raw !== 'string' || raw.length > 100) return null;
  const derived = deriveFieldProbe(question?.prompt);
  const value = raw.trim().replace(/^(?:我的答案是|我的答案[：:]|答案是|字段[：:])\s*/u, '');
  return derived?.validation.keys.includes(value) ? value : null;
}
export function gradeFieldProbe(question, raw) {
  const derived = deriveFieldProbe(question.prompt);
  if (
    !derived ||
    question.source?.kind !== 'executable' ||
    question.source.evidenceId !== FIELD_PROBE_CONTRACT ||
    question.rubric ||
    question.options?.length ||
    question.uncertainties?.some((u) => !u.resolved)
  )
    return { status: 'pending', outcome: null, basis: 'field_probe_unavailable' };
  const actual = fieldProbeAnswer(question, raw);
  if (!actual) return { status: 'pending', outcome: null, basis: 'ambiguous_field_probe_answer' };
  return {
    status: 'reliable',
    outcome: actual === derived.validation.answer ? 'correct' : 'wrong',
    basis: FIELD_PROBE_CONTRACT,
    evaluator: FIELD_PROBE_CONTRACT,
    authority: 'executable'
  };
}
// 原资料题已由共享reducer完整核验；诊断再次从规范题干重建引用，拒绝借用客户端答案或旧合同。
export function deriveMaterialLiteral(question) {
  const exercise = question?.materialExercise;
  const rule = question?.validation;
  if (
    exercise?.contract !== 'material-objective-v3' ||
    exercise.kind !== 'literal' ||
    exercise.to !== null ||
    question.scope !== 'private' ||
    question.source?.kind !== 'private_material' ||
    !question.source.materialId ||
    !question.source.segmentId ||
    question.rubric ||
    question.options?.length ||
    question.uncertainties?.some((u) => !u.resolved) ||
    rule?.type !== 'source_text' ||
    rule.authority !== 'executable' ||
    rule.evidenceId !== exercise.contract ||
    typeof question.prompt !== 'string'
  )
    return null;
  const lines = question.prompt.split('\n');
  const match = /^([^：:\n]{1,80}): (.{1,300})$/u.exec(lines[1] || '');
  if (!match || lines.length !== 4 || lines[0] !== '根据所给原文完成练习：' || lines[2] !== '') return null;
  const field = { key: match[1], value: match[2] };
  if (
    exercise.from !== field.key ||
    lines[3] !== `字段“${field.key}”的值是什么？直接引用所给文本，不作推断。` ||
    rule.answer !== field.value ||
    rule.inputs?.from?.key !== field.key ||
    rule.inputs.from.value !== field.value
  )
    return null;
  return { ...field, language: /^[\x20-\x7e]+$/.test(field.key) ? 'en' : 'zh' };
}
export function materialLiteralOutcome(question, raw) {
  const derived = deriveMaterialLiteral(question);
  if (!derived || typeof raw !== 'string') return null;
  const value = raw.trim();
  return value === derived.value || value.replace(/^(?:我的答案是|我的答案[：:]|答案是)\s*/u, '') === derived.value
    ? 'correct'
    : 'wrong';
}
export function fieldProbeTeaching(question, method, level = 1) {
  const derived = deriveFieldProbe(question?.prompt);
  if (!derived || gradeFieldProbe(question, derived.validation.answer).status !== 'reliable') return null;
  if (['check', 'review'].includes(method))
    return { method, helped: false, content: '请独立找出指定值对应的字段名；这项基础检查不能代替原资料的复测。' };
  if (!['hint', 'explain', 'steps', 'prerequisite'].includes(method)) return null;
  const disclosed = method !== 'hint' || level >= 3;
  return {
    method,
    helped: true,
    level: disclosed ? 3 : Math.max(1, level),
    content: `冒号前是字段名，冒号后是值。先找题目指定的值，再读取同一行冒号前的字段名，不要把值当成字段名。${disclosed ? `合成资料中“${derived.fields[1].value}”对应字段“${derived.fields[1].key}”。` : ''}这里只检查字段与值的对应，不确定原题认知错因或完整阅读能力。`
  };
}
