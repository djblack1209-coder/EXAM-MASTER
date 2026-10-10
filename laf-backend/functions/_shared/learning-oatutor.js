import { oatutorContent } from './learning-oatutor-content.js';

export const OATUTOR_CONTRACT = 'oatutor-static-pathway-v1';
const pack = oatutorContent();
const clone = (v) => JSON.parse(JSON.stringify(v));
const keyOf = (q) => `${q.id}@${q.version}`;
const requireValue = (test, message, code = 'INVALID_INPUT') => {
  if (!test) throw Object.assign(new Error(message), { code });
};
const canonical = (v) =>
  JSON.stringify(v, function (_key, value) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, value[k]])
        )
      : value;
  });
export const OATUTOR_TASKS = Object.freeze(pack.items.map(({ id, label }) => Object.freeze({ id, label })));
export function oatutorItem(id, version = 1) {
  requireValue(version === pack.version, '内容版本暂不支持');
  const item = pack.items.find((v) => v.id === id);
  requireValue(item, '请选择已有函数任务');
  return clone(item);
}
export function oatutorAttribution() {
  return `${pack.attribution.problem}\n${pack.attribution.tutoring} · ${pack.license}\n${pack.attribution.adaptation}\nAccess for free at ${pack.attribution.url}\n${pack.licenseUrl}`;
}
function sourceFor(item) {
  const paths = Object.keys(pack.originals).filter(
    (p) => p.includes(`/${item.stepId}/`) || /\/a005bd5real2.json$/.test(p)
  );
  return {
    kind: 'licensed_oatutor',
    reference: OATUTOR_CONTRACT,
    packId: pack.id,
    packVersion: pack.version,
    revision: pack.revision,
    historicalRevision: pack.historicalRevision,
    attribution: clone(pack.attribution),
    license: pack.license,
    licenseUrl: pack.licenseUrl,
    licensingEvidence: clone(pack.licensingEvidence),
    gradingAuthority: false,
    files: paths.map((path) => ({
      path,
      sha256: pack.originals[path].sha256,
      priorSha256: pack.originals[path].priorSha256,
      url: `${pack.repository}/blob/${pack.revision}/${path}`
    })),
    exerciseSnapshot: clone(item)
  };
}
export function createOatutorQuestion(id, conversationId, itemId = 'sum', version = 1) {
  requireValue(
    typeof id === 'string' &&
      id.length > 0 &&
      id.length <= 100 &&
      typeof conversationId === 'string' &&
      conversationId.length > 0 &&
      conversationId.length <= 160,
    '题目或对话编号不合法'
  );
  const item = oatutorItem(itemId, version);
  return {
    id,
    version: 1,
    scope: 'generated',
    subject: '数学',
    knowledgePoint: item.label,
    prompt: item.prompt,
    answerType: 'subjective',
    validation: null,
    publishable: false,
    uncertainties: ['外部教学参考，作答待核对'],
    source: sourceFor(item),
    oatutorExercise: {
      contract: OATUTOR_CONTRACT,
      packId: pack.id,
      packVersion: version,
      itemId,
      conversationId,
      role: 'main'
    }
  };
}
function scaffoldQuestion(main, node) {
  return {
    ...clone(main),
    id: `${main.id}~step${node.id}`,
    prompt: `${main.prompt}\n${node.title}：${node.prompt}`,
    parentQuestionKey: keyOf(main),
    oatutorExercise: { ...clone(main.oatutorExercise), role: 'scaffold', nodeId: node.id }
  };
}
export function normalizeOatutorQuestion(q, state) {
  if (!q.oatutorExercise && q.source?.kind !== 'licensed_oatutor') return;
  const e = q.oatutorExercise;
  requireValue(
    e?.contract === OATUTOR_CONTRACT &&
      e.packId === pack.id &&
      state.conversations.some((c) => c.id === e.conversationId),
    '带练来源或对话不一致'
  );
  let expected;
  if (e.role === 'main') expected = createOatutorQuestion(q.id, e.conversationId, e.itemId, e.packVersion);
  else {
    const main = state.questions.find((v) => keyOf(v) === q.parentQuestionKey);
    requireValue(main?.oatutorExercise?.role === 'main', '脚手架缺少原题');
    normalizeOatutorQuestion(main, state);
    const node = oatutorItem(main.oatutorExercise.itemId, main.oatutorExercise.packVersion).nodes.find(
      (n) => n.id === e.nodeId
    );
    requireValue(node?.type === 'scaffold', '脚手架来源不一致');
    expected = scaffoldQuestion(main, node);
  }
  requireValue(canonical(q) === canonical(expected), '带练题面、来源或内容版本不一致');
}
function collectedHelp(state, main) {
  const session = state.conversations.find((c) => c.id === main.oatutorExercise.conversationId);
  const hints = [
    ...(session?.pendingHints || []),
    ...(session?.helpQueues || []).flatMap((v) => v.hints),
    ...state.attempts.filter((a) => a.conversationId === session?.id).flatMap((a) => a.hints)
  ].filter((h) => h.oatutorReference?.mainQuestionKey === keyOf(main));
  return [...new Map(hints.map((hint) => [hint.id, hint])).values()];
}
export function oatutorHelpForQuestion(state, question) {
  if (!question?.oatutorExercise) return [];
  normalizeOatutorQuestion(question, state);
  const main =
    question.oatutorExercise.role === 'main'
      ? question
      : state.questions.find((q) => keyOf(q) === question.parentQuestionKey);
  return clone(collectedHelp(state, main));
}
export function oatutorProgress(state, main) {
  if (main?.oatutorExercise?.role !== 'main') return [];
  normalizeOatutorQuestion(main, state);
  const help = collectedHelp(state, main);
  const nodes = oatutorItem(main.oatutorExercise.itemId, main.oatutorExercise.packVersion).nodes;
  const rows = nodes.map((node) => {
    const childKey = keyOf(scaffoldQuestion(main, node));
    const attempts =
      node.type === 'scaffold'
        ? state.attempts.filter(
            (a) => a.questionKey === childKey && a.conversationId === main.oatutorExercise.conversationId
          )
        : [];
    const opened = help.some((h) => h.oatutorReference.nodeId === node.id && h.oatutorReference.part === 'prompt');
    const referenceRead = help.some(
      (h) => h.oatutorReference.nodeId === node.id && h.oatutorReference.part === 'reference'
    );
    return {
      ...node,
      opened,
      referenceRead,
      attempts: clone(attempts),
      complete: node.type === 'hint' ? opened : attempts.length > 0
    };
  });
  return rows.map((row) => ({
    ...row,
    available: row.dependencies.every((id) => rows.find((n) => n.id === id)?.complete)
  }));
}
export function oatutorFinalReference(state, main) {
  if (!main?.oatutorExercise) return null;
  return collectedHelp(state, main).find((h) => h.oatutorReference.part === 'final')?.content || null;
}
function recordHelp(state, session, main, node, part, content, id, at) {
  const all = collectedHelp(state, main);
  const prior = all.find((h) => h.oatutorReference.nodeId === (node?.id || null) && h.oatutorReference.part === part);
  if (prior) return { reused: true, hintId: prior.id, content: prior.content };
  const reference = {
    contract: OATUTOR_CONTRACT,
    mainQuestionKey: keyOf(main),
    itemId: main.oatutorExercise.itemId,
    packId: pack.id,
    packVersion: pack.version,
    nodeId: node?.id || null,
    part,
    revision: pack.revision,
    license: pack.license,
    licenseUrl: pack.licenseUrl,
    attribution: clone(pack.attribution),
    changes: clone(main.source.exerciseSnapshot.changes),
    gradingAuthority: false
  };
  const hint = {
    id,
    level: part === 'prompt' ? 1 : 3,
    content,
    questionKey: keyOf(main),
    at,
    origin: 'oatutor_reference',
    oatutorReference: reference
  };
  session.pendingHints.push(hint);
  return { hintId: id, content };
}
export function applyOatutorOperation(state, operation) {
  const { data, type, id } = operation;
  const at = operation.at ?? Date.now();
  const session = state.conversations.find((c) => c.id === data.conversationId);
  requireValue(session && !session.stopped, '当前任务已停止或不存在', 'STOPPED');
  requireValue(session.activeQuestionKey === data.questionKey, '题目已切换，请回到原带练', 'CONTEXT_CHANGED');
  const main = state.questions.find((q) => keyOf(q) === data.questionKey);
  requireValue(
    main?.oatutorExercise?.role === 'main' && main.oatutorExercise.conversationId === session.id,
    '带练属于另一题或对话',
    'FORBIDDEN'
  );
  normalizeOatutorQuestion(main, state);
  const allowed =
    type === 'oatutor.scaffold.submit'
      ? ['conversationId', 'questionKey', 'nodeId', 'answer', 'explicit']
      : ['conversationId', 'questionKey', 'nodeId'];
  requireValue(
    Object.keys(data).every((k) => allowed.includes(k)),
    '带练操作含未知字段'
  );
  const item = oatutorItem(main.oatutorExercise.itemId, main.oatutorExercise.packVersion);
  if (type === 'oatutor.final.read') {
    requireValue(
      data.nodeId === undefined &&
        state.attempts.some((a) => a.conversationId === session.id && a.questionKey === keyOf(main)),
      '请先明确提交本题原答'
    );
    return recordHelp(state, session, main, null, 'final', `本题参考：${item.answer}\n${oatutorAttribution()}`, id, at);
  }
  const node = oatutorProgress(state, main).find((v) => v.id === data.nodeId);
  requireValue(node?.available, '请先完成前一步的阅读或作答');
  if (type === 'oatutor.node.open')
    return recordHelp(
      state,
      session,
      main,
      node,
      'prompt',
      `${node.title}\n${node.prompt}\nOATutor Project · ${pack.license}`,
      id,
      at
    );
  requireValue(node.type === 'scaffold' && node.opened, '请先打开本步');
  if (type === 'oatutor.reference.read') {
    requireValue(node.attempts.length > 0, '请先提交本步原答');
    return recordHelp(
      state,
      session,
      main,
      node,
      'reference',
      `本步参考：${node.reference}\nOATutor Project · ${pack.license} · Yozi AI 中文适配`,
      id,
      at
    );
  }
  requireValue(type === 'oatutor.scaffold.submit' && data.explicit === true, '请明确提交本步作答');
  requireValue(
    typeof data.answer === 'string' && data.answer.trim() && data.answer.length <= 1000,
    '本步作答限1000字符'
  );
  const child = scaffoldQuestion(main, node),
    childKey = keyOf(child);
  if (!state.questions.some((q) => keyOf(q) === childKey)) state.questions.push(child);
  const attempt = {
    id,
    conversationId: session.id,
    questionKey: childKey,
    answer: data.answer,
    at,
    kind: 'variant',
    parentAttemptId: null,
    hints: clone(collectedHelp(state, main)),
    grade: { status: 'pending', outcome: null, reason: 'no_independent_reference' },
    corrections: [],
    taskId: null
  };
  state.attempts.push(attempt);
  return { attemptId: id, questionKey: childKey, grade: clone(attempt.grade) };
}
