import { normalizeRubric, assessWithRubric } from './learning-rubric.js';
import { HISTORY_LIMITS } from './learning-history.js';
import { matchesVisualSource, normalizeSavedVisualReading } from './learning-vision.js';
import { conversationStrategy, requestedTeachingMethod } from './learning-strategy.js';
import { validPrerequisiteQuestion } from './learning-prerequisite.js';
import {
  normalizeAlgebraQuestion,
  deriveAlgebraQuestion,
  gradeAlgebraAnswer,
  isAlgebraAnswer
} from './learning-algebra.js';
import {
  normalizeConditionQuestion,
  deriveConditionQuestion,
  gradeConditionAnswer,
  conditionAnswer
} from './learning-condition.js';
import {
  normalizeConditionProbe,
  deriveConditionProbe,
  gradeConditionProbe,
  conditionProbeAnswer
} from './learning-condition-probe.js';
export { normalizeRubric, RUBRIC_CONTRACT } from './learning-rubric.js';
// 所有入口共享的学习事实。纯函数，不访问网络，不执行模型给出的代码。
export const LEARNING_VERSION = 1;
export const METHODS = [
  'explain',
  'question',
  'hint',
  'example',
  'analogy',
  'diagram',
  'steps',
  'prerequisite',
  'variant',
  'challenge',
  'check',
  'review'
];
export class LearningError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
export function assert(condition, code, message) {
  if (!condition) throw new LearningError(code, message);
}
export function dayKey(time, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(time));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function emptyLearningState(owner, timezone = 'Asia/Shanghai') {
  dayKey(Date.now(), timezone);
  return {
    version: LEARNING_VERSION,
    owner,
    revision: 0,
    timezone,
    conversations: [],
    questions: [],
    materials: [],
    attempts: [],
    plans: [],
    events: [],
    executions: [],
    profile: [],
    strategy: { method: 'question', difficulty: 'self_report', stopped: false },
    reviews: []
  };
}
const clone = (value) => JSON.parse(JSON.stringify(value));
export function operationFingerprint(value) {
  const canonical = (v) =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .filter((key) => v[key] !== undefined)
              .map((key) => [key, canonical(v[key])])
          )
        : v;
  return JSON.stringify(canonical(value));
}
export function samePrivacyRedaction(a, b) {
  return (
    a?.type === 'privacy.redacted' &&
    b?.type === 'privacy.redacted' &&
    a.data?.materialId === b.data?.materialId &&
    operationFingerprint(a.data?.seed || null) === operationFingerprint(b.data?.seed || null)
  );
}
export function normalizePrivateSyncOperation(raw) {
  const op = clone(raw);
  if (op.type === 'question.add') {
    const q = op.data.question;
    assert(q && ['generated', 'private', 'legacy'].includes(q.scope), 'FORBIDDEN', '私人同步不能发布公共题库');
    const match = /^计算 ([+-]?\d{1,5}) ([+×*]) ([+-]?\d{1,5})。$/.exec(q.prompt || '');
    const combination = /^计算 \(([+-]?\d{1,5}) \+ ([+-]?\d{1,5})\) × (-2)。$/.exec(q.prompt || '');
    const inverse = /^已知一个数加 ([+-]?\d{1,5}) 得到 ([+-]?\d{1,10})，求这个数。$/.exec(q.prompt || '');
    const inverseMul = /^已知一个数乘 ([+-]?\d{1,5}) 得到 ([+-]?\d{1,10})，求这个数。$/.exec(q.prompt || '');
    const grouping =
      /^每组有 ([+-]?\d{1,5}) 个物品，共 ([+-]?\d{1,5}) 组。若重新分成 ([+-]?\d{1,5}) 组，每组有多少个？$/.exec(
        q.prompt || ''
      );
    const value = match
      ? match[2] === '+'
        ? Number(match[1]) + Number(match[3])
        : Number(match[1]) * Number(match[3])
      : combination
        ? (Number(combination[1]) + Number(combination[2])) * Number(combination[3])
        : inverse
          ? Number(inverse[2]) - Number(inverse[1])
          : inverseMul && Number(inverseMul[1]) !== 0 && Number(inverseMul[2]) % Number(inverseMul[1]) === 0
            ? Number(inverseMul[2]) / Number(inverseMul[1])
            : grouping && Number(grouping[2]) === Number(grouping[3]) && Number(grouping[2]) !== 0
              ? Number(grouping[1])
              : null;
    q.validation =
      value !== null && q.source?.kind === 'executable'
        ? {
            type: 'number',
            answer: String(value),
            authority: 'executable',
            evidenceId: combination ? 'integer-combination-v1' : 'integer-arithmetic-v1'
          }
        : null;
    q.publishable = false;
    normalizeAlgebraQuestion(q);
    normalizeConditionQuestion(q);
    normalizeConditionProbe(q);
  }
  if (op.type === 'assessment.review') op.type = 'assessment.correct';
  return op;
}
const text = (value, max = 8000) => {
  assert(typeof value === 'string' && value.trim() && value.length <= max, 'INVALID_INPUT', '内容为空或过长');
  return value.trim();
};
const questionKey = (q) => `${q.id}@${q.version}`;
const effectiveGrade = (a) => a.corrections?.at(-1)?.grade || a.grade;
export { effectiveGrade, questionKey };

// 隐私删除保留无正文的墓碑和计划分母。原始操作也要脱敏，否则导出、同步或恢复会重新带回资料。
export function inspectMaterialDeletion(state, materialId) {
  const deletion = (state.materialDeletions || []).find((d) => d.materialId === materialId);
  const material = state.materials.find((m) => m.id === materialId || m.aliases?.includes(materialId));
  const materialIds = new Set([materialId, ...(material?.aliases || []), ...(deletion?.materialIds || [])]);
  if (material) materialIds.add(material.id);
  // 旧快照没有 aliases；从同原件/同解析器的实际导入事件补齐，不推测其他资料归属。
  if (material)
    for (const event of state.events) {
      const source = event.type === 'material.add' && event.data?.material;
      if (
        source &&
        source.fingerprint === material.fingerprint &&
        source.original?.connectorOrigin === material.original?.connectorOrigin
      )
        materialIds.add(source.id);
    }
  const keys = new Set(deletion?.questionKeys || []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of state.questions)
      if (
        (materialIds.has(q.source?.materialId) ||
          keys.has(q.parentQuestionKey) ||
          keys.has(q.prerequisite?.originalQuestionKey)) &&
        !keys.has(questionKey(q))
      ) {
        keys.add(questionKey(q));
        changed = true;
      }
  }
  const conversations = new Set(
    state.conversations
      .filter((c) => keys.has(c.activeQuestionKey) || c.messages.some((m) => keys.has(m.questionKey)))
      .map((c) => c.id)
  );
  for (const a of state.attempts) if (keys.has(a.questionKey)) conversations.add(a.conversationId);
  for (const e of state.events)
    if (keys.has(e.data?.questionKey) && e.data.conversationId) conversations.add(e.data.conversationId);
  const attempts = state.attempts.filter((a) => keys.has(a.questionKey) || conversations.has(a.conversationId));
  const attemptIds = new Set(attempts.map((a) => a.id));
  return {
    materialId,
    materialIds: [...materialIds].sort(),
    questionKeys: [...keys].sort(),
    conversationIds: [...conversations].sort(),
    attemptIds: [...attemptIds].sort(),
    questions: state.questions.filter((q) => keys.has(questionKey(q))).length,
    attempts: attempts.length,
    conversations: conversations.size,
    messages: state.conversations.filter((c) => conversations.has(c.id)).reduce((n, c) => n + c.messages.length, 0),
    tasks: state.plans.flatMap((p) => p.tasks).filter((t) => keys.has(t.questionKey) || attemptIds.has(t.completedBy))
      .length
  };
}
function redactMaterial(state, data, deletionId, at) {
  const preview = inspectMaterialDeletion(state, data.materialId);
  const materialIds = new Set([...preview.materialIds, ...(data.materialIds || [])]);
  const keys = new Set([...preview.questionKeys, ...(data.questionKeys || [])]);
  const conversations = new Set(preview.conversationIds);
  const attempts = new Set(preview.attemptIds);
  const affectedTasks = new Set();
  const sanitizeTask = (task) => {
    if (!keys.has(task.questionKey) && !attempts.has(task.completedBy) && !affectedTasks.has(task.id)) return task;
    affectedTasks.add(task.id);
    return { ...task, title: '关联资料或作答已删除', questionKey: null, completedBy: null, privacyRemoved: true };
  };
  state.plans.forEach((plan) => (plan.tasks = plan.tasks.map(sanitizeTask)));
  const affected = (event) => {
    const d = event.data || {};
    return (
      (event.type === 'material.add' && materialIds.has(d.material?.id)) ||
      (event.type === 'question.add' && keys.has(d.question && questionKey(d.question))) ||
      keys.has(d.questionKey) ||
      attempts.has(event.id) ||
      attempts.has(d.attemptId) ||
      affectedTasks.has(d.taskId) ||
      (d.evidenceIds || []).some((id) => attempts.has(id)) ||
      conversations.has(d.conversationId) ||
      conversations.has(event.id)
    );
  };
  state.events = state.events.map((event) => {
    if (event.type === 'material.delete') return event;
    if (event.type === 'privacy.redacted') {
      if (event.data.seed?.kind === 'plan')
        event.data.seed.tasks = event.data.seed.tasks.map((task) => {
          const sanitized = sanitizeTask(task);
          const { completedBy: _removed, ...safe } = sanitized;
          return safe;
        });
      return event;
    }
    const plan = ['plan.set', 'plan.merge'].includes(event.type) && state.plans.find((p) => p.id === event.id);
    const planChanged = plan && plan.tasks.some((task) => affectedTasks.has(task.id));
    if (!affected(event) && !planChanged) {
      if (event.type === 'plan.merge') {
        const stored = state.plans.find((p) => p.id === event.id);
        if (stored) event.result = clone(stored);
      }
      return event;
    }
    const seed =
      event.type === 'conversation.start'
        ? { kind: 'conversation' }
        : planChanged
          ? {
              kind: 'plan',
              day: event.data.day || plan.day,
              tasks: (event.data.tasks || plan.tasks).map((task, index) => {
                const sanitized = sanitizeTask({ ...task, id: task.id || `${event.id}_${index}` });
                return {
                  id: sanitized.id,
                  title: sanitized.title,
                  questionKey: sanitized.questionKey || null,
                  condition: sanitized.condition,
                  ...(sanitized.privacyRemoved ? { privacyRemoved: true } : {})
                };
              })
            }
          : null;
    return {
      id: event.id,
      at: event.at,
      type: 'privacy.redacted',
      data: { materialId: data.materialId, deletionId, ...(seed ? { seed } : {}) },
      result: { redacted: true }
    };
  });
  state.materials = state.materials.filter((m) => !materialIds.has(m.id));
  state.questions = state.questions.filter((q) => !keys.has(questionKey(q)));
  state.attempts = state.attempts.filter((a) => !attempts.has(a.id));
  state.reviews = state.reviews.filter((r) => !keys.has(r.questionKey) && !attempts.has(r.attemptId));
  state.profile = state.profile.filter(
    (p) =>
      !(p.evidenceIds || []).some((id) => attempts.has(id)) &&
      !state.events.some((e) => e.id === p.id && e.type === 'privacy.redacted')
  );
  const redactedIds = new Set(state.events.filter((e) => e.type === 'privacy.redacted').map((e) => e.id));
  state.executions = state.executions.filter(
    (e) => !keys.has(e.questionKey) && !redactedIds.has(e.id) && !redactedIds.has(e.id.replace(/:execution$/, ''))
  );
  for (const c of state.conversations)
    if (conversations.has(c.id)) {
      c.goal = '关联资料已删除的对话';
      c.messages = [];
      c.activeQuestionKey = null;
      c.pendingHints = [];
      c.helpQueues = [];
      c.nextAttemptKind = null;
      c.stopped = true;
    }
  if ((state.strategy.evidenceIds || []).some((id) => attempts.has(id)) || conversations.size)
    state.strategy = { method: 'question', difficulty: 'self_report', stopped: true, reason: '关联资料已删除' };
  state.materialDeletions ||= [];
  const prior = state.materialDeletions.find((d) => d.materialId === data.materialId);
  if (prior) {
    prior.questionKeys = [...new Set([...prior.questionKeys, ...keys])].sort();
    prior.materialIds = [...new Set([...(prior.materialIds || [prior.materialId]), ...materialIds])].sort();
  } else
    state.materialDeletions.push({
      materialId: data.materialId,
      materialIds: [...materialIds].sort(),
      deletionId,
      at,
      questionKeys: [...keys].sort(),
      original: data.original || null,
      originalStatus: data.original ? 'pending' : 'not_applicable'
    });
  return preview;
}

export function enforceMaterialDeletions(state, source) {
  let result = clone(state);
  for (const event of source.events.filter((e) => e.type === 'material.delete')) {
    result = applyLearningOperation(result, { id: event.id, type: event.type, data: event.data, at: event.at }).state;
    redactMaterial(result, event.data, event.id, event.at);
  }
  return result;
}

export function knowledgeScope(question) {
  // 缺知识点时只描述当前题目，不能把无标签的所有学科合成一种能力。
  return `${question?.subject || '综合'} / ${question?.knowledgePoint || `当前题目 ${question ? questionKey(question) : '未知'}`}`;
}
function pendingHelp(state, key) {
  const hints = state.conversations.flatMap((session) => [
    ...(session.activeQuestionKey === key ? session.pendingHints : []),
    ...(session.helpQueues || []).filter((entry) => entry.questionKey === key).flatMap((entry) => entry.hints)
  ]);
  return [...new Map(hints.map((hint) => [hint.id, hint])).values()];
}
function rubricOrigins(state, question) {
  const keys = [];
  let key = question.rubricRevisionOf;
  if (!key) return keys;
  const questions = new Map(state.questions.map((q) => [questionKey(q), q]));
  const visited = new Set();
  while (key && !visited.has(key)) {
    visited.add(key);
    keys.push(key);
    key = questions.get(key)?.rubricRevisionOf;
  }
  return keys;
}

const UNITS = Object.freeze({
  m: ['length', 1],
  米: ['length', 1],
  cm: ['length', 0.01],
  厘米: ['length', 0.01],
  mm: ['length', 0.001],
  毫米: ['length', 0.001],
  km: ['length', 1000],
  千米: ['length', 1000],
  kg: ['mass', 1],
  千克: ['mass', 1],
  g: ['mass', 0.001],
  克: ['mass', 0.001],
  s: ['time', 1],
  秒: ['time', 1],
  min: ['time', 60],
  分钟: ['time', 60],
  h: ['time', 3600],
  小时: ['time', 3600]
});
// 受限常数/分数/十进制及公开单位白名单，不执行表达式；未知单位保留待复核。
export function parseNumberAnswer(raw, unit = '') {
  let input = String(raw)
    .trim()
    .replace(/^答案[是为：: ]*/, '')
    .replace(/^x\s*=\s*/i, '');
  if (unit) {
    const declared = UNITS[unit];
    const suffix = Object.keys(UNITS)
      .sort((a, b) => b.length - a.length)
      .find((u) => input.endsWith(u));
    if (declared && suffix) {
      if (declared[0] !== UNITS[suffix][0]) return null;
      const value = parseNumberAnswer(input.slice(0, -suffix.length));
      const converted = value === null ? null : (value * UNITS[suffix][1]) / declared[1];
      return converted !== null && Number.isFinite(converted) ? converted : null;
    }
    if (!input.endsWith(unit)) return null;
    input = input.slice(0, -unit.length).trim();
  }
  const match = /^([+-]?\d+(?:\.\d+)?)(?:\s*\/\s*([+-]?\d+(?:\.\d+)?))?$/.exec(input);
  if (!match || match[2] === '0') return null;
  const result = Number(match[1]) / (match[2] ? Number(match[2]) : 1);
  return Number.isFinite(result) ? result : null;
}
export function parseNumberSet(raw) {
  const input = String(raw)
    .trim()
    .replace(/^答案[是为：: ]*/, '')
    .replace(/^x\s*=\s*/i, '');
  const plusMinus = /^±\s*([+]?(?:\d+(?:\.\d+)?)(?:\s*\/\s*\d+(?:\.\d+)?)?)$/.exec(input);
  if (plusMinus) {
    const value = parseNumberAnswer(plusMinus[1]);
    return value === null ? null : value === 0 ? [0] : [-value, value];
  }
  const stripped = input.startsWith('{') && input.endsWith('}') ? input.slice(1, -1) : input;
  const parts = stripped.split(/[,，、;；]/);
  if (!parts.length || parts.length > 20) return null;
  const values = parts.map((part) => parseNumberAnswer(part));
  return values.some((v) => v === null) ? null : [...new Set(values)].sort((a, b) => a - b);
}
export function gradeAnswer(question, answer) {
  if (question.uncertainties?.some((item) => !item.resolved)) {
    return { status: 'pending', outcome: null, basis: 'critical_input_uncertain' };
  }
  if (deriveConditionProbe(question.prompt) && !question.rubric && !question.options?.length)
    return gradeConditionProbe(question, answer);
  if (deriveConditionQuestion(question.prompt) && !question.rubric && !question.options?.length)
    return gradeConditionAnswer(question, answer);
  if (deriveAlgebraQuestion(question.prompt) && !question.rubric && !question.options?.length)
    return gradeAlgebraAnswer(question, answer);
  const rule = question.validation;
  // 来自模型的 reference 不能自行提升为独立判分依据。
  if (!rule || !['executable', 'human_reviewed'].includes(rule.authority) || !rule.evidenceId) {
    return { status: 'pending', outcome: null, basis: 'no_independent_reference' };
  }
  let correct;
  if (rule.type === 'choice') {
    const match = /^(?:我(?:选|选择)|选择|答案[是为：:]?)?\s*([A-H](?:[、,\s]*[A-H])*)[。.]?$/i.exec(answer.trim());
    if (!match) return { status: 'pending', outcome: null, basis: 'ambiguous_answer' };
    const normalize = (value) => [...new Set(value.toUpperCase().match(/[A-H]/g) || [])].sort().join('');
    correct = normalize(match[1]) === normalize(rule.answer);
  } else if (rule.type === 'number') {
    const actual = parseNumberAnswer(answer, rule.unit || '');
    const expected = parseNumberAnswer(String(rule.answer));
    if (actual === null || expected === null)
      return { status: 'pending', outcome: null, basis: 'unsupported_expression_or_unit' };
    correct = Math.abs(actual - expected) <= Math.max(1e-10, Math.abs(expected) * 1e-10);
  } else if (rule.type === 'number_set') {
    const actual = parseNumberSet(answer);
    const expected = Array.isArray(rule.answers) ? [...new Set(rule.answers)].sort((a, b) => a - b) : null;
    const domains = {
      real: (n) => Number.isFinite(n),
      integer: (n) => Number.isInteger(n),
      positive: (n) => n > 0 && Number.isFinite(n)
    };
    const domain = Object.prototype.hasOwnProperty.call(domains, rule.domain || 'real')
      ? domains[rule.domain || 'real']
      : null;
    if (
      !actual ||
      !expected?.length ||
      expected.length > 20 ||
      !domain ||
      expected.some((n) => typeof n !== 'number' || !domain(n))
    )
      return { status: 'pending', outcome: null, basis: 'unsupported_set_or_reference_domain' };
    const equal = (a, b) => Math.abs(a - b) <= Math.max(1e-10, Math.abs(b) * 1e-10);
    correct = actual.length === expected.length && actual.every((a, i) => domain(a) && equal(a, expected[i]));
    if (
      !correct &&
      actual.length < expected.length &&
      actual.every((a) => domain(a) && expected.some((b) => equal(a, b)))
    )
      return {
        status: 'reliable',
        outcome: 'partial',
        basis: rule.evidenceId,
        evaluator: 'deterministic-v2',
        authority: rule.authority
      };
  } else {
    return { status: 'pending', outcome: null, basis: 'rubric_review_required' };
  }
  return {
    status: 'reliable',
    outcome: correct ? 'correct' : 'wrong',
    basis: rule.evidenceId,
    evaluator: 'deterministic-v2',
    authority: rule.authority
  };
}
export function classifyResponse(raw, question) {
  const value = raw.trim();
  if (!question || /[?？]|是不是|可能|也许|我猜|例如|题干|为什么|不知道|不确定/.test(value)) return 'discussion';
  if (question.answerType === 'condition_implication' || deriveConditionProbe(question.prompt))
    return conditionProbeAnswer(value)
      ? 'answer'
      : /^(?:我的答案是|我的答案[：:]|答案是)/.test(value)
        ? 'answer'
        : 'clarify';
  if (question.answerType === 'condition_relation' || deriveConditionQuestion(question.prompt))
    return conditionAnswer(value)
      ? 'answer'
      : /^(?:我的答案是|我的答案[：:]|答案是)/.test(value)
        ? 'answer'
        : 'clarify';
  if (question.answerType === 'algebra' || question.validation?.type === 'algebra')
    return isAlgebraAnswer(question, value)
      ? 'answer'
      : /^(?:我的答案是|我的答案[：:]|答案是)/.test(value)
        ? 'answer'
        : 'clarify';
  if ((question.validation?.type || question.answerType) === 'choice')
    return /^(?:我(?:选|选择)|选择|答案[是为：:]?)?\s*[A-H](?:[、,\s]*[A-H])*[。.]?$/i.test(value)
      ? 'answer'
      : 'clarify';
  if ((question.validation?.type || question.answerType) === 'number')
    return parseNumberAnswer(value, question.validation?.unit || '') !== null ? 'answer' : 'clarify';
  if ((question.validation?.type || question.answerType) === 'number_set')
    return parseNumberSet(value) !== null ? 'answer' : 'clarify';
  if (/^(?:我的答案是|我的答案[：:]|答案是|我认为)/.test(value)) return 'answer';
  return 'clarify';
}
export function summarizeLearning(state, time = Date.now(), options = {}) {
  const day = options.day || dayKey(time, state.timezone);
  const firstByQuestion = new Map();
  for (const attempt of state.attempts) {
    // 首次正式作答的口径不会因重做或更正新增分母。
    if (attempt.kind === 'first' && !firstByQuestion.has(attempt.questionKey))
      firstByQuestion.set(attempt.questionKey, attempt);
  }
  const first = [...firstByQuestion.values()].filter((attempt) => effectiveGrade(attempt).status === 'reliable');
  const wrong = first.filter((attempt) => effectiveGrade(attempt).outcome === 'wrong');
  const partial = first.filter((attempt) => effectiveGrade(attempt).outcome === 'partial');
  const plans = state.plans.filter((plan) => plan.day === day);
  const plan = options.planId ? plans.find((item) => item.id === options.planId) : plans.at(-1);
  const completed = plan?.tasks.filter((task) => task.completedBy).length || 0;
  const denominator = plan?.tasks.length || 0;
  const mistakes = state.attempts.filter(
    (attempt) => effectiveGrade(attempt).status === 'reliable' && effectiveGrade(attempt).outcome === 'wrong'
  );
  const knowledge = {};
  for (const attempt of state.attempts) {
    const question = state.questions.find((item) => questionKey(item) === attempt.questionKey);
    const key = knowledgeScope(question);
    if (effectiveGrade(attempt).status !== 'reliable') continue;
    const previous = knowledge[key];
    const outcome = effectiveGrade(attempt).outcome;
    const status =
      outcome !== 'correct'
        ? '待复测'
        : attempt.hints.length
          ? '需提示'
          : ['review', 'variant', 'redo'].includes(attempt.kind)
            ? '待复测'
            : '可独立完成';
    knowledge[key] = { status, evidenceIds: [...(previous?.evidenceIds || []), attempt.id] };
  }
  return {
    day,
    timezone: state.timezone,
    first: {
      numerator: wrong.length,
      denominator: first.length,
      partial: partial.length,
      rate: first.length ? wrong.length / first.length : null,
      evidenceIds: first.map((a) => a.id),
      smallSample: first.length < 20
    },
    tasks: {
      planId: plan?.id || null,
      version: plan?.version || 0,
      numerator: completed,
      denominator,
      rate: denominator ? completed / denominator : null
    },
    mistakes,
    pending: state.attempts.filter((a) => effectiveGrade(a).status !== 'reliable').length,
    validAnswers: state.attempts.filter(
      (a) => effectiveGrade(a).status === 'reliable' && dayKey(a.at, state.timezone) === day
    ).length,
    totalReliableAnswers: state.attempts.filter((a) => effectiveGrade(a).status === 'reliable').length,
    reliableCorrectAnswers: state.attempts.filter(
      (a) => effectiveGrade(a).status === 'reliable' && effectiveGrade(a).outcome === 'correct'
    ).length,
    knowledge,
    due: state.reviews.filter((r) => r.due <= time && !r.cancelled)
  };
}

// 每个修改具有稳定 opId。所有修改先在副本中完成，再由 repository 原子保存。
function reduceLearningOperation(original, operation, owned = false, budget = null) {
  assert(original.version === LEARNING_VERSION, 'SCHEMA_VERSION', '学习数据版本不支持');
  const opId = text(operation.id, 160);
  const previousEvent = original.events.find((event) => event.id === opId);
  if (previousEvent) {
    assert(
      previousEvent.type !== 'privacy.redacted' || operation.type === 'privacy.redacted',
      'DELETED_DATA',
      '该操作的关联资料已删除，旧请求不会恢复内容'
    );
    assert(
      previousEvent.type === operation.type &&
        (samePrivacyRedaction(previousEvent, operation) ||
          !previousEvent.data ||
          operationFingerprint(previousEvent.data) === operationFingerprint(operation.data || {})),
      'IDEMPOTENCY_CONFLICT',
      '同一操作标识对应不同内容'
    );
    return { state: original, reused: true, result: previousEvent.result };
  }
  const state = owned ? original : clone(original);
  const previousRevision = state.revision;
  const now = operation.at ?? Date.now();
  assert(Number.isFinite(now), 'INVALID_INPUT', '时间不合法');
  const data = operation.data || {};
  let result = {};
  const current = () => {
    const session = state.conversations.find((item) => item.id === data.conversationId);
    assert(session, 'NOT_FOUND', '对话不存在');
    return session;
  };
  switch (operation.type) {
    case 'conversation.start': {
      const goal = text(data.goal, 1000);
      const conversation = {
        id: opId,
        goal,
        at: now,
        messages: [],
        activeQuestionKey: null,
        pendingHints: [],
        stopped: false
      };
      state.conversations.push(conversation);
      result = conversation;
      break;
    }
    case 'message.add': {
      const session = current();
      assert(['user', 'assistant', 'tool', 'notice'].includes(data.role), 'INVALID_INPUT', '消息角色不合法');
      session.messages.push({
        id: opId,
        role: data.role,
        content: text(data.content),
        at: now,
        questionKey: data.questionKey || session.activeQuestionKey,
        attemptId: data.attemptId || null,
        executionId: data.executionId || null
      });
      result = { messageId: opId };
      break;
    }
    case 'model.request': {
      const session = current();
      assert(
        session.messages.filter((m) => m.role === 'user').at(-1)?.id === data.messageId,
        'PRECONDITION',
        '模型请求必须绑定明确的最近用户消息'
      );
      assert(
        (session.activeQuestionKey || null) === data.questionKey &&
          typeof data.modelId === 'string' &&
          /^[a-zA-Z0-9_-]{1,60}$/.test(data.modelId) &&
          typeof data.model === 'string' &&
          data.model.length > 0 &&
          data.model.length <= 120 &&
          typeof data.requestId === 'string' &&
          /^[a-zA-Z0-9_:-]{1,150}$/.test(data.requestId) &&
          typeof data.binding === 'string' &&
          /^[a-zA-Z0-9_-]{8,100}$/.test(data.binding),
        'INVALID_INPUT',
        '模型请求关联不合法'
      );
      assert(
        Object.keys(data).every((k) =>
          [
            'conversationId',
            'messageId',
            'questionKey',
            'modelId',
            'model',
            'requestId',
            'binding',
            'historyOnly',
            'lockedMethod',
            'visualSource'
          ].includes(k)
        ),
        'INVALID_INPUT',
        '模型请求不保存消息正文或密钥'
      );
      if (data.visualSource) {
        const q = state.questions.find((q) => questionKey(q) === data.questionKey);
        assert(
          matchesVisualSource(data.visualSource, q?.source),
          'IMAGE_SOURCE_MISMATCH',
          '图片请求必须关联当前题目的资料版本'
        );
      }
      result = { requestId: data.requestId, recorded: true, modelExecuted: false };
      break;
    }
    case 'question.add': {
      const q = clone(data.question);
      assert(q && q.id && Number.isInteger(q.version) && q.version > 0, 'INVALID_INPUT', '题目版本不合法');
      text(q.prompt);
      assert(
        !(state.materialDeletions || []).some(
          (d) =>
            (d.materialIds || [d.materialId]).includes(q.source?.materialId) ||
            d.questionKeys.includes(q.parentQuestionKey) ||
            d.questionKeys.includes(q.prerequisite?.originalQuestionKey) ||
            d.questionKeys.includes(questionKey(q))
        ),
        'DELETED_DATA',
        '题目关联资料已删除，旧结果不会写入'
      );
      assert(['private', 'generated', 'official', 'legacy'].includes(q.scope), 'INVALID_INPUT', '题目范围不合法');
      assert(!state.questions.some((item) => questionKey(item) === questionKey(q)), 'CONFLICT', '题目版本已存在');
      q.publishable = false; // 私人学习入口永远不能发布旧公共库。
      if (q.scope === 'generated' && q.validation?.authority !== 'executable') q.validation = null;
      normalizeAlgebraQuestion(q);
      normalizeConditionQuestion(q);
      normalizeConditionProbe(q);
      assert(
        validPrerequisiteQuestion(q, state),
        'INVALID_INPUT',
        '先修诊断必须关联真实错答或未完整作答和受支持的基础小题'
      );
      if (q.rubric) {
        assert(q.answerType === 'subjective' && !q.validation, 'INVALID_INPUT', '主观评分维度不能替代客观校验规则');
        q.rubric = normalizeRubric(q.rubric);
      }
      if (q.rubricRevisionOf) {
        const previous = state.questions.find((item) => questionKey(item) === q.rubricRevisionOf);
        assert(
          q.rubric &&
            previous?.id === q.id &&
            previous.version < q.version &&
            previous.prompt === q.prompt &&
            previous.answerType === 'subjective',
          'PRECONDITION',
          '维度修订必须关联同一道主观题的原版本'
        );
      }
      state.questions.push(q);
      result = { questionKey: questionKey(q) };
      break;
    }
    case 'question.focus': {
      const session = current();
      assert(
        state.questions.some((q) => questionKey(q) === data.questionKey),
        'NOT_FOUND',
        '题目不存在'
      );
      // 导航不结束一次尝试。按题目暂存帮助，跨页面/对话返回仍参与下一次作答。
      session.helpQueues ||= [];
      if (session.activeQuestionKey) {
        session.helpQueues = session.helpQueues.filter((entry) => entry.questionKey !== session.activeQuestionKey);
        if (session.pendingHints.length)
          session.helpQueues.push({ questionKey: session.activeQuestionKey, hints: session.pendingHints });
      }
      session.pendingHints = [];
      session.activeQuestionKey = data.questionKey;
      session.pendingHints = pendingHelp(state, data.questionKey);
      const focused = state.questions.find((q) => questionKey(q) === data.questionKey);
      if (focused.rubricRevisionOf) {
        const origins = rubricOrigins(state, focused);
        const inherited = [
          ...origins.flatMap((key) => pendingHelp(state, key)),
          ...state.attempts.filter((a) => origins.includes(a.questionKey)).flatMap((a) => a.hints)
        ];
        session.pendingHints = [...new Map([...session.pendingHints, ...inherited].map((h) => [h.id, h])).values()];
      }
      session.helpQueues = session.helpQueues.filter((entry) => entry.questionKey !== data.questionKey);
      assert(!data.kind || ['review', 'redo'].includes(data.kind), 'INVALID_INPUT', '继续作答类型不合法');
      session.nextAttemptKind = data.kind || null;
      result = { questionKey: data.questionKey };
      break;
    }
    case 'hint.add': {
      const session = current();
      assert(session.activeQuestionKey && !session.stopped, 'PRECONDITION', '没有进行中的题目');
      assert(
        !data.level || (Number.isInteger(data.level) && data.level >= 1 && data.level <= 3),
        'INVALID_INPUT',
        '提示层级须为1至3'
      );
      session.pendingHints.push({
        id: opId,
        level: data.level || 1,
        content: text(data.content),
        questionKey: session.activeQuestionKey,
        at: now
      });
      result = { hintId: opId };
      break;
    }
    case 'teaching.deliver': {
      const session = current();
      assert(
        !session.stopped && session.activeQuestionKey === data.questionKey,
        'CONTEXT_CHANGED',
        '题目已切换，教学结果未写入'
      );
      assert(
        state.questions.some((q) => questionKey(q) === data.questionKey),
        'NOT_FOUND',
        '教学须绑定已有题目'
      );
      assert(
        METHODS.includes(data.method) && ['local_tool', 'model_reply'].includes(data.origin),
        'INVALID_INPUT',
        '教学方法或来源不合法'
      );
      assert(
        typeof data.helped === 'boolean' &&
          (!data.helped || (Number.isInteger(data.level) && data.level >= 1 && data.level <= 3)),
        'INVALID_INPUT',
        '教学帮助标记不合法'
      );
      assert(data.origin !== 'model_reply' || data.helped, 'INVALID_INPUT', '模型回复不能自行证明没有帮助');
      const content = text(data.content);
      const visualReading = data.visualReading
        ? (() => {
            const q = state.questions.find((q) => questionKey(q) === data.questionKey);
            assert(
              data.origin === 'model_reply' && matchesVisualSource(data.visualReading.source, q?.source),
              'IMAGE_SOURCE_MISMATCH',
              '图片解读须关联本题资料来源'
            );
            return normalizeSavedVisualReading(data.visualReading, data.visualReading.source);
          })()
        : null;
      const executionId = `${opId}:execution`;
      session.messages.push({
        id: opId,
        role: data.origin === 'model_reply' ? 'assistant' : 'tool',
        content,
        at: now,
        questionKey: data.questionKey,
        method: data.method,
        executionId,
        ...(visualReading ? { visualReading } : {})
      });
      if (data.helped)
        session.pendingHints.push({
          id: opId,
          level: data.level,
          content,
          questionKey: data.questionKey,
          origin: data.origin,
          at: now
        });
      state.executions.push({
        id: executionId,
        tool: 'teaching',
        version: '1.0',
        status: data.historyOnly ? 'cancelled' : 'success',
        ...(data.historyOnly ? { errorCode: 'BACKUP_HISTORY_ONLY' } : {}),
        method: data.method,
        questionKey: data.questionKey,
        at: now
      });
      result = { messageId: opId, executionId, helped: data.helped };
      break;
    }
    case 'attempt.submit': {
      const session = current();
      assert(!session.stopped, 'STOPPED', '当前任务已停止');
      const q = state.questions.find((item) => questionKey(item) === session.activeQuestionKey);
      assert(q, 'PRECONDITION', '作答需要绑定明确题目');
      const answer = text(data.answer);
      if (!data.explicit && classifyResponse(answer, q) !== 'answer') {
        result = { clarification: true, message: '这句话是你的正式作答吗？确认后保存；不会直接记错。' };
        break;
      }
      const prior = state.attempts.filter((a) => a.questionKey === questionKey(q));
      const origins = new Set(rubricOrigins(state, q));
      const previousRubricAttempt = state.attempts.some((a) => origins.has(a.questionKey));
      const hints = pendingHelp(state, questionKey(q));
      const kind =
        data.kind ||
        session.nextAttemptKind ||
        (q.parentQuestionKey
          ? 'variant'
          : prior.length
            ? hints.length
              ? 'revision'
              : 'redo'
            : previousRubricAttempt
              ? 'redo'
              : 'first');
      const parentAttemptId = data.parentAttemptId || (kind === 'revision' ? prior.at(-1)?.id : null);
      assert(['first', 'redo', 'revision', 'variant', 'review'].includes(kind), 'INVALID_INPUT', '作答类型不合法');
      assert(
        kind !== 'first' || (!prior.length && !previousRubricAttempt),
        'CONFLICT',
        '已有首次作答，修改维度不新增首答'
      );
      if (kind === 'revision')
        assert(
          prior.some((a) => a.id === parentAttemptId),
          'PRECONDITION',
          '修正需要原始作答'
        );
      const attempt = {
        id: opId,
        conversationId: session.id,
        questionKey: questionKey(q),
        answer,
        at: now,
        kind,
        parentAttemptId,
        hints: clone(hints),
        grade: gradeAnswer(q, answer),
        corrections: [],
        taskId: data.taskId || null
      };
      state.attempts.push(attempt);
      for (const conversation of state.conversations) {
        if (conversation.activeQuestionKey === attempt.questionKey) conversation.pendingHints = [];
        if (conversation.helpQueues)
          conversation.helpQueues = conversation.helpQueues.filter(
            (entry) => entry.questionKey !== attempt.questionKey
          );
      }
      session.nextAttemptKind = null;
      for (const plan of state.plans)
        for (const task of plan.tasks) {
          if (
            task.questionKey === attempt.questionKey &&
            !task.completedBy &&
            (task.condition === 'submitted' ||
              (task.condition === 'independent_correct' &&
                attempt.grade.status === 'reliable' &&
                attempt.grade.outcome === 'correct' &&
                !attempt.hints.length))
          ) {
            task.completedBy = attempt.id;
          }
        }
      result = attempt;
      break;
    }
    case 'assessment.correct': {
      const a = state.attempts.find((item) => item.id === data.attemptId);
      assert(a, 'NOT_FOUND', '作答不存在');
      assert(['correct', 'wrong', 'partial', null].includes(data.outcome), 'INVALID_INPUT', '评估结果不合法');
      const reason = text(data.reason, 1000);
      a.corrections.push({
        id: opId,
        at: now,
        reason,
        grade: {
          status: 'pending',
          outcome: data.outcome,
          basis: opId,
          evaluator: 'user_correction',
          reviewRequired: true
        }
      });
      // 用户争议立即撤销可靠错题结论和调度，等待有依据的复核。
      state.reviews
        .filter((r) => r.attemptId === a.id)
        .forEach((r) => {
          r.cancelled = true;
        });
      for (const plan of state.plans)
        for (const task of plan.tasks) {
          if (task.completedBy === a.id && task.condition === 'independent_correct') task.completedBy = null;
        }
      if (state.strategy.source === 'observed' && state.strategy.evidenceIds?.includes(a.id))
        state.strategy = {
          ...state.strategy,
          method: 'check',
          difficulty: 'calibrated',
          reason: '相关作答已提出纠正，撤销旧策略判断；等待重新检验',
          evidenceIds: [],
          at: now
        };
      result = { attemptId: a.id, reviewRequired: true };
      break;
    }
    case 'assessment.assist': {
      const session = current();
      const attempt = state.attempts.find((a) => a.id === data.attemptId);
      assert(
        attempt?.conversationId === session.id && attempt.questionKey === session.activeQuestionKey,
        'FORBIDDEN',
        '辅助评估必须绑定当前对话的明确作答'
      );
      assert(
        ['correct', 'wrong', 'partial', 'uncertain'].includes(data.outcome),
        'INVALID_INPUT',
        '辅助评估结果不合法'
      );
      assert(
        Array.isArray(data.dimensions) && data.dimensions.length > 0 && data.dimensions.length <= 6,
        'INVALID_INPUT',
        '辅助评估需要明确评分维度'
      );
      const question = state.questions.find((q) => questionKey(q) === attempt.questionKey);
      const rubricAssessment = question.rubric ? assessWithRubric(question, attempt, data) : null;
      if (!rubricAssessment) {
        assert(!data.rubricContract, 'PRECONDITION', '当前题目没有可定位评分引用的维度');
        assert(!data.rubricId, 'PRECONDITION', '当前题目没有匹配的评分维度');
        assert(
          data.dimensions.every((d) => d && Object.keys(d).every((key) => ['name', 'feedback'].includes(key))),
          'PRECONDITION',
          '未定义评分维度时只能给文字反馈，不能自行给分'
        );
      }
      const dimensions =
        rubricAssessment?.dimensions ||
        data.dimensions.map((d) => ({
          name: text(d.name, 100),
          feedback: text(d.feedback, 500)
        }));
      const assessment = {
        id: opId,
        at: now,
        status: 'ai_assisted',
        outcome: data.outcome,
        dimensions,
        ...(rubricAssessment || { contract: 'unscored-feedback-v1' }),
        feedback: text(data.feedback, 2000),
        evaluator: text(data.model || 'model', 160),
        basis: 'model_judgment_only',
        reviewRequired: true
      };
      (attempt.assistance ||= []).push(assessment);
      // 模型评估不覆盖可靠判分、不升级掌握、不创建可靠错题。
      result = { attemptId: attempt.id, assessmentId: opId, status: 'ai_assisted' };
      break;
    }
    case 'assessment.review': {
      const a = state.attempts.find((item) => item.id === data.attemptId);
      assert(a, 'NOT_FOUND', '作答不存在');
      assert(
        ['correct', 'wrong', 'partial'].includes(data.outcome) && data.evidenceId && data.reason,
        'PRECONDITION',
        '复核需要结果、理由和独立证据'
      );
      a.corrections.push({
        id: opId,
        at: now,
        reason: text(data.reason, 1000),
        grade: {
          status: 'reliable',
          outcome: data.outcome,
          basis: text(data.evidenceId, 160),
          evaluator: 'human_review'
        }
      });
      if (state.strategy.source === 'observed' && state.strategy.evidenceIds?.includes(a.id))
        state.strategy = {
          ...state.strategy,
          method: 'check',
          difficulty: 'calibrated',
          reason: '相关判分依据已更正，撤销旧策略判断；等待重新检验',
          evidenceIds: [],
          at: now
        };
      for (const plan of state.plans)
        for (const task of plan.tasks) {
          if (task.questionKey === a.questionKey && task.condition === 'independent_correct') {
            const valid = state.attempts.find(
              (other) =>
                other.questionKey === task.questionKey &&
                effectiveGrade(other).status === 'reliable' &&
                effectiveGrade(other).outcome === 'correct' &&
                !other.hints.length
            );
            task.completedBy = valid?.id || null;
          }
        }
      result = { attemptId: a.id };
      break;
    }
    case 'plan.set': {
      assert(Array.isArray(data.tasks) && data.tasks.length <= 100, 'INVALID_INPUT', '计划最多 100 个任务');
      const day = data.day || dayKey(now, state.timezone);
      assert(/^\d{4}-\d{2}-\d{2}$/.test(day), 'INVALID_INPUT', '日期不合法');
      const previous = state.plans.filter((p) => p.day === day).at(-1);
      const tasks = data.tasks.map((task, index) => {
        assert(
          ['submitted', 'independent_correct', 'manual'].includes(task.condition),
          'INVALID_INPUT',
          '任务完成条件不合法'
        );
        return {
          id: task.id || `${opId}_${index}`,
          title: text(task.title, 500),
          questionKey: task.questionKey || null,
          condition: task.condition,
          ...(task.privacyRemoved ? { privacyRemoved: true } : {}),
          completedBy:
            previous?.tasks.find(
              (t) => t.id === task.id && t.condition === task.condition && t.questionKey === (task.questionKey || null)
            )?.completedBy || null
        };
      });
      assert(new Set(tasks.map((t) => t.id)).size === tasks.length, 'INVALID_INPUT', '任务标识重复');
      result = {
        id: opId,
        day,
        timezone: state.timezone,
        version: (previous?.version || 0) + 1,
        replaces: previous?.id || null,
        reason: text(data.reason || '用户调整计划', 1000),
        tasks,
        at: now
      };
      state.plans.push(result);
      break;
    }
    case 'plan.merge': {
      assert(Array.isArray(data.planIds) && data.planIds.length === 2, 'INVALID_INPUT', '合并需要两份已有计划');
      const plans = data.planIds.map((id) => state.plans.find((p) => p.id === id));
      assert(plans.every(Boolean) && plans[0].day === plans[1].day, 'PRECONDITION', '只能合并同一天的已有计划');
      const tasks = new Map();
      for (const plan of plans)
        for (const task of plan.tasks) {
          const prior = tasks.get(task.id);
          assert(
            !prior || (prior.condition === task.condition && prior.questionKey === task.questionKey),
            'CONFLICT',
            '同一任务标识对应不同条件，原计划保留'
          );
          tasks.set(task.id, prior ? { ...prior, completedBy: prior.completedBy || task.completedBy } : clone(task));
        }
      assert(tasks.size <= 100, 'RESOURCE_LIMIT', '合并后的计划不能超过 100 项任务');
      const previous = state.plans.filter((p) => p.day === plans[0].day).at(-1);
      result = {
        id: opId,
        day: plans[0].day,
        timezone: state.timezone,
        version: previous.version + 1,
        replaces: previous.id,
        sourcePlanIds: [...data.planIds],
        reason: text(data.reason, 1000),
        tasks: [...tasks.values()],
        at: now
      };
      state.plans.push(result);
      break;
    }
    case 'task.complete': {
      const task = state.plans.find((p) => p.id === data.planId)?.tasks.find((t) => t.id === data.taskId);
      assert(!task?.privacyRemoved, 'DELETED_DATA', '关联资料已删除的任务不能标为完成');
      assert(task?.condition === 'manual', 'PRECONDITION', '此任务需要实际作答完成');
      task.completedBy = opId;
      result = { taskId: task.id };
      break;
    }
    case 'profile.set': {
      assert(['self_report', 'observed', 'inferred'].includes(data.source), 'INVALID_INPUT', '画像依据类型不合法');
      assert(
        ['goal', 'foundation', 'difficulty', 'minutes', 'preference'].includes(data.field),
        'INVALID_INPUT',
        '画像字段不合法'
      );
      const entry = {
        id: opId,
        field: data.field,
        value: text(String(data.value), 1000),
        scope: text(data.scope || '当前任务', 160),
        source: data.source,
        evidenceIds: data.evidenceIds || [],
        at: now
      };
      if (entry.source !== 'self_report')
        assert(
          entry.evidenceIds.every((id) => state.attempts.some((a) => a.id === id)) && entry.evidenceIds.length,
          'PRECONDITION',
          '观察和推测需要实际作答证据'
        );
      state.profile.push(entry);
      if (data.field === 'goal' && data.conversationId) current().goal = entry.value;
      result = entry;
      break;
    }
    case 'strategy.set': {
      assert(METHODS.includes(data.method), 'INVALID_INPUT', '教学方法不支持');
      assert(
        !data.source || ['self_report', 'observed', 'model'].includes(data.source),
        'INVALID_INPUT',
        '策略依据类型不合法'
      );
      if (data.conversationId) current();
      const previous = conversationStrategy(state, data.conversationId);
      const locked = requestedTeachingMethod(state, data.conversationId);
      if (locked && data.source && data.source !== 'self_report') {
        assert(data.method === locked, 'USER_PREFERENCE', '本轮应遵循用户明确指定的方法');
        result = previous;
        break;
      }
      assert(
        ['self_report', 'easier', 'harder', 'calibrated'].includes(data.difficulty || 'self_report'),
        'INVALID_INPUT',
        '难度不合法'
      );
      const evidenceIds = data.evidenceIds || [];
      assert(
        Array.isArray(evidenceIds) &&
          (!data.source || evidenceIds.length <= 6) &&
          evidenceIds.every((id) => state.attempts.some((a) => a.id === id)),
        'INVALID_INPUT',
        '策略证据不存在'
      );
      state.strategy = {
        method: data.method,
        difficulty: data.difficulty || previous.difficulty,
        reason: text(data.reason, 1000),
        evidenceIds,
        ...(data.source ? { source: data.source } : {}),
        ...(data.conversationId ? { conversationId: data.conversationId } : {}),
        stopped: previous.stopped,
        at: now
      };
      result = state.strategy;
      // 兼容旧事件；新宿主只在教学实际交付时记录帮助，失败不制造成功事实。
      if (data.method === 'diagram' && data.conversationId && !data.deliveryManaged) {
        const session = current();
        const q = state.questions.find((q) => questionKey(q) === session.activeQuestionKey);
        if (q?.source?.kind === 'executable' && /^计算 [+-]?\d{1,5} \+ [+-]?\d{1,5}。$/.test(q.prompt))
          session.pendingHints.push({
            id: `${opId}:diagram`,
            level: 1,
            content: '有限整数数轴图形与结果提示',
            at: now
          });
      }
      break;
    }
    case 'strategy.auto': {
      const session = current();
      assert(data.source === 'self_report', 'FORBIDDEN', '恢复自动教法须由用户明确要求');
      state.strategy = {
        method: 'question',
        difficulty: 'self_report',
        reason: '用户明确恢复自动教法；后续按本对话的可靠作答调整',
        evidenceIds: [],
        conversationId: session.id,
        stopped: session.stopped,
        at: now
      };
      result = state.strategy;
      break;
    }
    case 'task.resume': {
      const session = current();
      assert(data.source === 'self_report', 'FORBIDDEN', '继续任务须由用户明确要求');
      session.stopped = false;
      state.strategy = conversationStrategy(state, session.id);
      result = { stopped: false };
      break;
    }
    case 'task.stop': {
      current().stopped = true;
      state.strategy = conversationStrategy(state, data.conversationId);
      result = { stopped: true };
      break;
    }
    case 'material.add': {
      assert(
        !(state.materialDeletions || []).some((d) => (d.materialIds || [d.materialId]).includes(data.material?.id)),
        'DELETED_DATA',
        '资料已删除，旧解析结果不会恢复；重新导入需使用新资料标识'
      );
      assert(data.material?.id && Array.isArray(data.material.segments), 'INVALID_INPUT', '资料结构不合法');
      assert(
        typeof data.material.id === 'string' &&
          data.material.id.length <= 160 &&
          typeof data.material.fingerprint === 'string' &&
          data.material.fingerprint.length <= 160 &&
          data.material.segments.every(
            (segment) =>
              typeof segment.id === 'string' &&
              segment.id.length <= 160 &&
              typeof segment.content === 'string' &&
              segment.content.length <= 20000 &&
              (!segment.preview || /^data:image\/(?:png|jpeg|jpg);base64,[A-Za-z0-9+/=\s]+$/.test(segment.preview))
          ),
        'INVALID_INPUT',
        '资料标识、片段或页图结构不合法'
      );
      assert(data.material.segments.length <= 100, 'RESOURCE_LIMIT', '请分段导入资料');
      const material = clone(data.material);
      material.scope = 'private';
      material.publishable = false;
      material.segments = material.segments.map((segment) => ({ ...segment, extractionEventId: opId }));
      const extraction = {
        eventId: opId,
        at: now,
        version: material.extractionVersion,
        segmentIds: material.segments.map((segment) => segment.id)
      };
      material.extractions = [extraction];
      material.aliases = [];
      const duplicate = state.materials.find(
        (m) =>
          m.fingerprint === material.fingerprint && m.original?.connectorOrigin === material.original?.connectorOrigin
      );
      assert(
        !state.materials.some((m) => m.id === material.id && m !== duplicate),
        'CONFLICT',
        '同一资料标识对应不同原件或解析器，原记录保留'
      );
      if (duplicate) {
        if (duplicate.id !== material.id) duplicate.aliases = [...new Set([...(duplicate.aliases || []), material.id])];
        const segments = new Map(duplicate.segments.map((s) => [s.id, s]));
        material.segments.forEach((s) => segments.set(s.id, s));
        duplicate.segments = [...segments.values()];
        duplicate.status = material.status;
        duplicate.nextPage = material.nextPage;
        duplicate.recognitionAllowed = material.recognitionAllowed;
        duplicate.recognitionEngine = material.recognitionEngine;
        duplicate.extractionVersion = material.extractionVersion;
        (duplicate.extractions ||= []).push(extraction);
        result = duplicate;
        break;
      }
      state.materials.push(material);
      result = material;
      break;
    }
    case 'material.delete': {
      text(data.materialId, 160);
      assert(
        Object.keys(data).every((key) => ['materialId', 'materialIds', 'questionKeys', 'original'].includes(key)),
        'INVALID_INPUT',
        '删除操作只能包含关联标识和原件定位'
      );
      assert(
        !data.materialIds ||
          (Array.isArray(data.materialIds) &&
            data.materialIds.length <= 501 &&
            data.materialIds.every((id) => typeof id === 'string' && id.length <= 160)),
        'INVALID_INPUT',
        '资料别名结构不合法'
      );
      assert(
        Array.isArray(data.questionKeys) &&
          data.questionKeys.length <= 500 &&
          data.questionKeys.every((key) => typeof key === 'string' && key.length <= 160),
        'INVALID_INPUT',
        '删除关联标识不合法'
      );
      if (data.original) {
        assert(
          Object.keys(data.original).every((key) => ['fileId', 'connectorOrigin'].includes(key)),
          'INVALID_INPUT',
          '原件删除任务不能保存密钥或原始资料'
        );
        assert(
          /^[a-f0-9]{64}$/.test(data.original.fileId) &&
            (data.original.connectorOrigin === null || /^https?:\/\/[^/]+$/.test(data.original.connectorOrigin)),
          'INVALID_INPUT',
          '原件删除目标不合法'
        );
      }
      result = redactMaterial(state, data, opId, now);
      break;
    }
    case 'privacy.redacted': {
      assert(
        state.events.some(
          (e) => e.type === 'material.delete' && e.id === data.deletionId && e.data.materialId === data.materialId
        ),
        'PRECONDITION',
        '脱敏操作需要已记录的资料删除'
      );
      assert(
        Object.keys(data).every((key) => ['materialId', 'deletionId', 'seed'].includes(key)),
        'INVALID_INPUT',
        '脱敏操作不能包含原始资料'
      );
      if (data.seed) {
        const seed = data.seed;
        if (seed.kind === 'conversation') {
          assert(Object.keys(seed).length === 1, 'INVALID_INPUT', '删除对话只能保留空骨架');
          if (!state.conversations.some((c) => c.id === opId))
            state.conversations.push({
              id: opId,
              goal: '关联资料已删除的对话',
              at: now,
              messages: [],
              activeQuestionKey: null,
              pendingHints: [],
              stopped: true
            });
        } else {
          assert(
            seed.kind === 'plan' && Object.keys(seed).every((k) => ['kind', 'day', 'tasks'].includes(k)),
            'INVALID_INPUT',
            '脱敏计划结构不合法'
          );
          assert(
            Array.isArray(seed.tasks) &&
              seed.tasks.length <= 100 &&
              seed.tasks.every(
                (task) =>
                  task &&
                  Object.keys(task).every((k) =>
                    ['id', 'title', 'questionKey', 'condition', 'privacyRemoved'].includes(k)
                  ) &&
                  (!task.privacyRemoved || (task.title === '关联资料或作答已删除' && !task.questionKey))
              ),
            'INVALID_INPUT',
            '脱敏任务不能保存原始资料或多余字段'
          );
          if (!state.plans.some((p) => p.id === opId)) {
            const seeded = applyLearningOperation(state, {
              id: opId,
              type: 'plan.set',
              at: now,
              data: { day: seed.day, tasks: seed.tasks, reason: '关联资料已删除，保留计划分母' }
            }).state;
            state.plans = seeded.plans;
          }
        }
      }
      result = { redacted: true };
      break;
    }
    case 'material.original-deleted': {
      const deletionEvent = state.events.find((e) => e.type === 'material.delete' && e.id === data.deletionId);
      const deletion = (state.materialDeletions || []).find((d) => d.materialId === deletionEvent?.data.materialId);
      assert(deletion?.original && deletion.original.fileId === data.fileId, 'PRECONDITION', '原件删除任务不匹配');
      deletion.originalStatus = data.historyOnly ? 'pending' : 'deleted';
      result = { deleted: true, fileId: data.fileId };
      break;
    }
    case 'review.rebuild':
    case 'review.schedule': {
      const a = state.attempts.find((item) => item.id === data.attemptId);
      assert(
        a && effectiveGrade(a).status === 'reliable' && Number.isFinite(data.due) && data.due > now,
        'PRECONDITION',
        '只有可靠判分的作答可以调度复习'
      );
      const rebuilding = operation.type === 'review.rebuild';
      if (rebuilding)
        assert(
          state.events.some(
            (event) =>
              event.id === data.correctionId &&
              event.type === 'assessment.correct' &&
              state.attempts.find((attempt) => attempt.id === event.data.attemptId)?.questionKey === a.questionKey
          ),
          'PRECONDITION',
          '重建复习需要同题的实际更正事件'
        );
      if (!rebuilding && state.reviews.some((r) => r.attemptId === a.id)) {
        result = { reused: true };
        break;
      }
      if (data.policy) {
        assert(data.policy === 'reliable-due-v1', 'INVALID_INPUT', '复习调度规则版本不支持');
        const preceding = state.reviews
          .filter((review) => {
            const origin = state.attempts.find((attempt) => attempt.id === review.attemptId);
            return review.questionKey === a.questionKey && origin && effectiveGrade(origin).status === 'reliable';
          })
          .at(-1);
        assert(
          rebuilding || !preceding || (a.kind === 'review' && a.at >= preceding.due),
          'PRECONDITION',
          '即时重做或提前复测不能增长复习间隔'
        );
        assert(
          Array.isArray(data.evidenceIds) &&
            data.evidenceIds.includes(a.id) &&
            data.evidenceIds.every((id) =>
              state.attempts.some(
                (attempt) =>
                  attempt.id === id &&
                  attempt.questionKey === a.questionKey &&
                  effectiveGrade(attempt).status === 'reliable'
              )
            ),
          'INVALID_INPUT',
          '复习调度证据不合法'
        );
      }
      state.reviews
        .filter((r) => r.questionKey === a.questionKey)
        .forEach((r) => {
          r.cancelled = true;
        });
      result = {
        id: opId,
        questionKey: a.questionKey,
        attemptId: a.id,
        due: data.due,
        rating: data.rating,
        scheduler: 'ts-fsrs',
        ...(rebuilding ? { rebuiltFrom: data.correctionId } : {}),
        ...(data.policy ? { policy: data.policy, evidenceIds: data.evidenceIds || [] } : {}),
        notificationSent: false
      };
      state.reviews.push(result);
      break;
    }
    case 'execution.record': {
      assert(['success', 'failed', 'cancelled'].includes(data.status), 'INVALID_INPUT', '执行状态不合法');
      result = {
        id: opId,
        tool: data.tool,
        version: data.version,
        status: data.status,
        errorCode: data.errorCode || null,
        at: now,
        durationMs: data.durationMs || 0
      };
      state.executions.push(result);
      break;
    }
    case 'timezone.set':
      dayKey(now, data.timezone);
      state.timezone = data.timezone;
      result = { timezone: data.timezone };
      break;
    default:
      throw new LearningError('UNKNOWN_TOOL', '不支持的学习操作');
  }
  const receipt = operation.type === 'material.add' ? { id: result.id, fingerprint: result.fingerprint } : result;
  state.events.push({ id: opId, type: operation.type, at: now, data: clone(data), result: clone(receipt) });
  // 先重放删除墓碑，再重放脱敏骨架；即使首次同步/恢复也不需要已删除的正文。
  if (operation.type === 'material.delete')
    state.events = [
      ...state.events.filter((e) => e.type === 'material.delete'),
      ...state.events.filter((e) => e.type !== 'material.delete')
    ];
  state.revision += 1;
  if (budget) {
    if (operation.type === 'message.add') {
      const messages = current().messages;
      // message.add只追加两份明确对象和revision；精确JSON长度增量，仍逐操作守上限。
      budget.characters +=
        JSON.stringify(messages.at(-1)).length +
        JSON.stringify(state.events.at(-1)).length +
        (messages.length > 1 ? 1 : 0) +
        (state.events.length > 1 ? 1 : 0) +
        String(state.revision).length -
        String(previousRevision).length;
    } else budget.characters = JSON.stringify(state).length;
  }
  assert(
    state.events.length <= HISTORY_LIMITS.operations &&
      (budget ? budget.characters : JSON.stringify(state).length) <= HISTORY_LIMITS.stateCharacters,
    'RESOURCE_LIMIT',
    '学习历史达到配置上限，请导出记录；不会自动删除旧记录'
  );
  return { state, result, reused: false };
}

// 普通写入仍先复制；同一有界重放批次持有一个隔离副本，成功后才交给原子保存。
export function applyLearningOperation(original, operation) {
  return reduceLearningOperation(original, operation);
}
export function createLearningOperationBatch(original, maximum = 100) {
  assert(Number.isInteger(maximum) && maximum >= 1 && maximum <= 500, 'RESOURCE_LIMIT', '重放批次最多500操作');
  let state = clone(original),
    count = 0,
    closed = false;
  const budget = { characters: JSON.stringify(state).length };
  return {
    apply(operation) {
      try {
        assert(!closed && count < maximum, 'PRECONDITION', '重放批次已结束、失败或超过上限');
        count++;
        const outcome = reduceLearningOperation(state, operation, true, budget);
        state = outcome.state;
        return outcome;
      } catch (error) {
        closed = true;
        throw error;
      }
    },
    finish() {
      assert(!closed, 'PRECONDITION', '失败批次不能提交');
      closed = true;
      return state;
    }
  };
}
