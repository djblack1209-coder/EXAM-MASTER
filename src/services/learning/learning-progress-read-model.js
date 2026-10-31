import { dayKey, effectiveGrade, questionKey } from './learning-domain.js';
import { knowledgeGraphSeed } from './knowledge-graph-seed.js';

// Display floor only. N3 must calibrate it with unseen, unprompted first answers.
export const MIN_PROGRESS_EVENTS = 5;
export const PROGRESS_CONTRACT = 'learning-progress-read-v1';
export const PROGRESS_RUBRIC_LABELS = Object.freeze(['需重练', '可改进', '达成本次要求']);
export const PROGRESS_DIMENSIONS = Object.freeze(['语法', '搭配', '表达', '任务完成']);

// Read-time mapping table. Exact labels only: never mine student quotes for keywords.
// Dimension anchors describe observations, not predictive mastery. 表达 has no
// equivalent generic seed node; only a named skill or task can locate it.
export const PROGRESS_NODE_RULES = Object.freeze(
  [
    { nodeId: 'sentence', dimension: '语法', labels: ['语法', '句子结构', '句子不完整', '构造完整句'] },
    { nodeId: 'agreement', dimension: '语法', labels: ['主谓一致', '主谓不一致'] },
    { nodeId: 'tense', dimension: '语法', labels: ['时态', '时态错误', '选择时间表达'] },
    { nodeId: 'articles', dimension: '语法', labels: ['冠词', '可数性', '冠词与可数性'] },
    { nodeId: 'clause', dimension: '语法', labels: ['从句结构', '连接主从句'] },
    { nodeId: 'collocation', dimension: '搭配', labels: ['搭配', '固定搭配', '介词搭配', '动词搭配', '使用固定搭配'] },
    { nodeId: 'register', dimension: '表达', labels: ['语域', '语气', '保持得体语域'] },
    { nodeId: 'paraphrase', dimension: '表达', labels: ['改写', '准确改写'] },
    { nodeId: 'linking', dimension: '表达', labels: ['逻辑衔接', '选择逻辑衔接'] },
    { nodeId: 'coherence', dimension: '表达', labels: ['段落连贯', '保持段落连贯'] },
    { nodeId: 'task', dimension: '任务完成', labels: ['任务完成', '任务覆盖', '提取任务要求'] },
    { nodeId: 'audience', dimension: '任务完成', labels: ['读者关系', '识别读者关系'] },
    { nodeId: 'purpose', dimension: '任务完成', labels: ['交际目的', '明确交际目的'] },
    { nodeId: 'genre', dimension: '任务完成', labels: ['体裁', '区分体裁要求'] },
    {
      nodeId: 'outline',
      dimension: '任务完成',
      labels: ['提纲', '组织写作提纲', '应用文审题'],
      kinds: ['writing_analysis']
    },
    { nodeId: 'translation', labels: ['中译英', '短句意义转写'], kinds: ['translation'] },
    { nodeId: 'sentence', labels: ['成分识别', '长难句拆分'], kinds: ['syntax', 'sentence_analysis'] },
    { nodeId: 'collocation', dimension: '搭配', labels: [], kinds: ['collocation', 'cloze'] },
    { nodeId: 'opening', dimension: '任务完成', labels: ['开篇直达目的'] },
    { nodeId: 'detail', dimension: '任务完成', labels: ['展开任务细节'] },
    { nodeId: 'closing', dimension: '任务完成', labels: ['结尾推动回应'] },
    { nodeId: 'claim', dimension: '任务完成', labels: ['形成明确观点'] },
    { nodeId: 'example', dimension: '任务完成', labels: ['用例子支持观点'] },
    { nodeId: 'revision-task', dimension: '任务完成', labels: ['检查任务覆盖'] },
    { nodeId: 'revision-language', dimension: '语法', labels: ['检查语言错误'] },
    { nodeId: 'timed-check', dimension: '任务完成', labels: ['限时检查排序'] }
  ].map((rule) =>
    Object.freeze({ ...rule, labels: Object.freeze(rule.labels), kinds: Object.freeze(rule.kinds || []) })
  )
);

const list = (value) => (Array.isArray(value) ? value : []);
const distinct = (values) => [...new Set(values)];
const order = (a, b) => a.at - b.at || String(a.id || '').localeCompare(String(b.id || ''));
const writingSubject = knowledgeGraphSeed.subject;
const questionTypes = Object.freeze({
  choice: '选择题',
  number: '填空题',
  text: '简答题',
  rubric: '写作',
  boolean: '判断题'
});
const subjectId = (subject) => (['考研英语写作', writingSubject].includes(subject) ? writingSubject : subject);

export function progressNodeIds({ dimension, labels = [], kind = '', nodeIds = [] } = {}) {
  const valid = new Set(knowledgeGraphSeed.topics.map((node) => node.id));
  const mapped = PROGRESS_NODE_RULES.filter(
    (rule) =>
      (!rule.dimension || !dimension || rule.dimension === dimension) &&
      (rule.labels.some((label) => labels.includes(label)) || rule.kinds.includes(kind))
  ).map((rule) => rule.nodeId);
  return distinct([...nodeIds, ...mapped].filter((id) => valid.has(id)));
}

function modelOrigin(modelId = '') {
  // muse-ai-connectors creates byok_ IDs; the persisted request keeps that ID.
  // A historical arbitrary ID has no saved source/version: do not guess platform.
  return { source: modelId.startsWith('byok_') ? 'byok' : modelId ? 'unknown' : 'local', modelId: modelId || null };
}

function metric(evidence, select, kind = 'accuracy') {
  const rows = evidence.flatMap((event) => {
    const value = select(event);
    return value === null || value === undefined ? [] : [{ id: event.id, value }];
  });
  const denominatorEventIds = distinct(rows.map((row) => row.id));
  const numeratorEventIds = distinct(rows.filter((row) => row.value === true).map((row) => row.id));
  const denominator = denominatorEventIds.length;
  return {
    kind,
    status: denominator < MIN_PROGRESS_EVENTS ? 'insufficient' : 'available',
    numerator: numeratorEventIds.length,
    denominator,
    numeratorEventIds,
    denominatorEventIds,
    percentage: denominator < MIN_PROGRESS_EVENTS ? null : Math.round((numeratorEventIds.length / denominator) * 100)
  };
}

function aggregates(evidence) {
  const ids = distinct([writingSubject, ...evidence.map((event) => event.subject)]);
  return ids.map((id) => {
    const rows = evidence.filter((event) => event.subject === id);
    return {
      id,
      label: id === writingSubject ? '考研英语写作' : id,
      accuracy: metric(rows, (event) => (event.outcome === null ? null : event.outcome === 'correct')),
      attainment: metric(
        rows,
        (event) => (event.dimensions.length ? event.dimensions.every((dimension) => dimension.score === 2) : null),
        'rubric-attainment'
      ),
      dimensions: (id === writingSubject ? PROGRESS_DIMENSIONS : []).map((name) => ({
        id: name,
        label: name,
        ...metric(
          rows,
          (event) => {
            const dimension = event.dimensions.find((item) => item.name === name);
            return dimension ? dimension.score === 2 : null;
          },
          'rubric-attainment'
        )
      })),
      questionTypes: distinct(rows.map((event) => event.questionType)).map((type) => {
        const typed = rows.filter((event) => event.questionType === type);
        return {
          id: type,
          label: type,
          accuracy: metric(typed, (event) => (event.outcome === null ? null : event.outcome === 'correct')),
          attainment: metric(
            typed,
            (event) => (event.dimensions.length ? event.dimensions.every((d) => d.score === 2) : null),
            'rubric-attainment'
          )
        };
      })
    };
  });
}

function nodeProjection(evidence) {
  return knowledgeGraphSeed.topics.map((node) => {
    const rows = evidence.filter((event) => event.nodeObservations.some((item) => item.nodeId === node.id));
    const observed = rows.filter((event) =>
      event.nodeObservations.some((item) => item.nodeId === node.id && item.score !== null)
    );
    const status = observed.length < MIN_PROGRESS_EVENTS ? 'insufficient' : 'observed';
    const latest = observed.at(-1);
    const level =
      status === 'observed'
        ? Math.min(
            ...latest.nodeObservations
              .filter((item) => item.nodeId === node.id && item.score !== null)
              .map((item) => item.score)
          )
        : null;
    return {
      id: node.id,
      name: node.name,
      chapter: node.chapter,
      status,
      level,
      statusLabel: status === 'insufficient' ? '数据不足' : PROGRESS_RUBRIC_LABELS[level],
      // Even five correct objective answers are not a validated writing rubric level.
      sampleCount: observed.length,
      sampleEventIds: observed.map((event) => event.id),
      evidenceIds: rows.map((event) => event.id),
      levelEventIds: status === 'observed' ? [latest.id] : [],
      isWeakness: level !== null && level < 2,
      weaknessEventIds: (status === 'observed' ? rows : [])
        .filter((event) => event.nodeObservations.some((item) => item.nodeId === node.id && item.weakness))
        .map((event) => event.id),
      accuracy: metric(rows, (event) => (event.outcome === null ? null : event.outcome === 'correct'))
    };
  });
}

// Pure projection: current canonical originals/feedback only; never replay historical
// payloads to resurrect deleted or superseded student records, or issue any writes.
export function learningProgressReadModel(state = {}) {
  const sessions = new Map(list(state.conversations).map((session) => [session.id, session]));
  const questions = new Map(list(state.questions).map((question) => [questionKey(question), question]));
  const events = new Map(list(state.events).map((event) => [event.id, event]));
  const evidence = new Map();
  const timezone = state.timezone || 'Asia/Shanghai';
  const append = (row) => {
    if (!row.id || !Number.isFinite(row.at) || evidence.has(row.id)) return;
    evidence.set(row.id, { ...row, day: dayKey(row.at, timezone) });
  };
  const independentQuestions = new Set();
  for (const attempt of [...list(state.attempts)].sort(order)) {
    const question = questions.get(attempt.questionKey),
      session = sessions.get(attempt.conversationId);
    if (!question || !session || !['first', 'variant', 'review'].includes(attempt.kind) || list(attempt.hints).length)
      continue;
    const identity = JSON.stringify([session.id, attempt.questionKey]);
    if (independentQuestions.has(identity)) continue;
    independentQuestions.add(identity);
    const grade = effectiveGrade(attempt);
    if (grade?.status !== 'reliable' || !['correct', 'wrong', 'partial'].includes(grade.outcome)) continue;
    const correction = list(attempt.corrections).at(-1);
    const requestEvent = list(state.events).find(
      (event) => event.type === 'model.request' && event.data?.feedbackAttemptId === attempt.id
    );
    const subject = subjectId(question.subject || session.studyProfile?.subject || '未归类');
    const ids =
      subject === writingSubject
        ? progressNodeIds({ labels: [question.knowledgePoint], nodeIds: list(question.knowledgeNodeIds) })
        : [];
    append({
      id: attempt.id,
      at: attempt.at,
      conversationId: session.id,
      subject,
      questionType: questionTypes[question.answerType || question.validation?.type] || '练习',
      prompt: question.prompt || '',
      goal: session.goal || '',
      recordId: JSON.stringify([session.id, attempt.questionKey, attempt.id]),
      kind: 'answer',
      learningEventIds: [attempt.id],
      receiptEventIds: correction?.id ? [correction.id] : [],
      outcome: grade.outcome,
      conclusion: { correct: '正确', wrong: '错误', partial: '部分正确' }[grade.outcome],
      model: modelOrigin(requestEvent?.data?.modelId || ''),
      dimensions: [],
      nodeObservations: ids.map((nodeId) => ({ nodeId, score: null, weakness: grade.outcome !== 'correct' }))
    });
  }
  for (const session of sessions.values()) {
    const coach = session.coach;
    if (!coach || (coach.profile?.track && coach.profile.track !== writingSubject)) continue;
    const collect = (feedback, target, day, answers, cards, recordKey) => {
      if (!feedback || !answers.length) return;
      const request = [...list(coach.requests)]
        .reverse()
        .find(
          (req) =>
            req.status === 'completed' &&
            req.request?.target === target &&
            req.request.day === day &&
            ['feedback', 'essay'].includes(req.request.phase) &&
            (!feedback.id || feedback.id === req.resultId)
        );
      const receipt = request && events.get(request.resultId);
      if (
        !request ||
        receipt?.type !== 'coach.result' ||
        receipt.data?.requestId !== request.id ||
        receipt.data?.conversationId !== session.id ||
        feedback.feedbackVersion !== 2 ||
        request.request.dimensionContract !== 'writing-dimensions-v1'
      )
        return;
      const dimensions = list(feedback.dimensions).filter(
        (dimension) =>
          PROGRESS_DIMENSIONS.includes(dimension.name) &&
          [0, 1, 2].includes(dimension.score) &&
          list(dimension.evidence).some((quote) => typeof quote === 'string' && quote.trim())
      );
      if (!dimensions.length) return;
      const nodeObservations = [];
      for (const dimension of dimensions) {
        const errors = list(feedback.errors).filter((error) => error.dimension === dimension.name);
        const labels = [
          ...errors.map((error) => error.label),
          // Canonical, post-verification evidence only. Summary labels, prior
          // feedback and verification internals cannot restore deleted errors.
          ...list(feedback.weaknessEvidence)
            .filter((item) => item.classification === 'error')
            .map((item) => item.label)
        ];
        const ids = progressNodeIds({ dimension: dimension.name, labels: [dimension.name, ...labels] });
        // A mixed diagnostic is one observation; it does not establish a score on
        // every card's specific skill. Only single-task feedback gets a task map.
        if (cards.length === 1)
          ids.push(...progressNodeIds({ dimension: dimension.name, kind: cards[0].kind, labels: [cards[0].title] }));
        for (const nodeId of distinct(ids))
          nodeObservations.push({
            nodeId,
            dimension: dimension.name,
            score: dimension.score,
            weakness: dimension.score < 2
          });
      }
      const key = recordKey || answers.at(-1).id;
      append({
        id: receipt.id,
        at: receipt.at,
        conversationId: session.id,
        subject: writingSubject,
        questionType:
          cards.length === 1 ? cards[0].title || cards[0].kind || '写作' : target === 'diagnostic' ? '摸底' : '写作',
        prompt: cards
          .map((card) => card.prompt)
          .filter(Boolean)
          .join('\n'),
        goal: session.goal || '',
        recordId: key ? JSON.stringify([session.id, null, `coach:${key}`]) : null,
        kind: 'writing-feedback',
        learningEventIds: distinct(answers.map((answer) => answer.id).filter(Boolean)),
        receiptEventIds: [receipt.id],
        outcome: null,
        conclusion: dimensions
          .map((dimension) => `${dimension.name} · ${PROGRESS_RUBRIC_LABELS[dimension.score]}`)
          .join('；'),
        model: modelOrigin(request.modelId),
        dimensions: dimensions.map(({ name, score }) => ({ name, score })),
        nodeObservations
      });
    };
    collect(
      coach.diagnostic?.feedback,
      'diagnostic',
      coach.startedDay,
      list(coach.diagnostic?.answers),
      list(coach.diagnostic?.cards)
    );
    for (const day of list(coach.days)) {
      for (const [target, feedback] of Object.entries(day.feedback || {})) {
        const card = list(day.pack?.cards).find((item) => `card-${item.id}` === target);
        const answers = card
          ? list(day.answers).filter((answer) => answer.cardId === card.id)
          : target.startsWith('paragraph-')
            ? list(day.drafts).filter((_, index) => index === Number(target.slice(10)))
            : target === 'analysis' && day.analysis
              ? [
                  {
                    id: list(state.events).find(
                      (event) =>
                        event.type === 'coach.analysis' &&
                        event.data?.conversationId === session.id &&
                        dayKey(event.at, timezone) === day.day
                    )?.id
                  }
                ]
              : [];
        collect(
          feedback,
          target,
          day.day,
          answers,
          card ? [card] : [day.pack?.writing || {}],
          target === 'analysis' ? `analysis:${day.day}` : null
        );
      }
      collect(day.essay, 'essay', day.day, list(day.rewrites).filter(Boolean), [day.pack?.writing || {}]);
    }
  }
  const rows = [...evidence.values()].sort(order);
  const nodes = nodeProjection(rows);
  return {
    contract: PROGRESS_CONTRACT,
    owner: state.owner || null,
    minimumEvents: MIN_PROGRESS_EVENTS,
    evidence: [...rows].reverse(),
    subjects: aggregates(rows),
    nodes,
    weaknesses: nodes.filter((node) => node.isWeakness),
    sources: distinct(rows.map((event) => JSON.stringify(event.model))).map((key) => {
      const model = JSON.parse(key),
        sourceRows = rows.filter((event) => JSON.stringify(event.model) === key);
      return {
        ...model,
        evidenceIds: sourceRows.map((event) => event.id),
        subjects: aggregates(sourceRows),
        nodes: nodeProjection(sourceRows)
      };
    }),
    // No selected/frozen platform reference model or predictive validation yet.
    // Personal BYOK observations, unknown IDs and local grades never enter it.
    platformReference: { status: 'insufficient', percentage: null, evidenceIds: [] },
    mindMap: {
      id: writingSubject,
      label: '考研英语写作',
      branches: distinct(nodes.map((node) => node.chapter)).map((chapter) => ({
        id: chapter,
        label: chapter,
        nodeIds: nodes.filter((node) => node.chapter === chapter).map((node) => node.id)
      }))
    }
  };
}
