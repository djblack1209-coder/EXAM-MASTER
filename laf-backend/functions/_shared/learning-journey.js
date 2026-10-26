// 学习路线只组织已有任务与证据，不赋予题目来源、答案或模型额外权限。
export const JOURNEY_CONTRACT = 'learning-journey-v1';
export const TRAINING_MODES = Object.freeze([
  { id: 'guided', label: '单题带练' },
  { id: 'batch', label: '整批训练' },
  { id: 'timed', label: '限时训练' }
]);
export const JOURNEY_MODULES = Object.freeze([
  { id: 'arithmetic-add', subject: '数学', label: '整数加法', goal: '独立完成整数加法', minutes: 10 },
  { id: 'arithmetic-subtract', subject: '数学', label: '整数减法', goal: '独立检验减法与符号', minutes: 10 },
  { id: 'arithmetic-multiply', subject: '数学', label: '整数乘法', goal: '独立完成整数乘法', minutes: 10 },
  { id: 'arithmetic-divide', subject: '数学', label: '整数除法', goal: '给出精确商并检查除数', minutes: 15 },
  { id: 'fraction-add-subtract', subject: '数学', label: '分数加减', goal: '通分后精确计算并保留符号', minutes: 15 },
  { id: 'fraction-multiply-divide', subject: '数学', label: '分数乘除', goal: '检查除数并约分得到精确值', minutes: 15 },
  { id: 'algebra-equation', subject: '数学', label: '方程与定义域', goal: '给出原定义域内全部解', minutes: 15 },
  { id: 'algebra-inequality', subject: '数学', label: '不等式与区间', goal: '区分方向、边界与完整解集', minutes: 15 },
  { id: 'condition-relation', subject: '逻辑', label: '充分与必要条件', goal: '分别检查两个蕴含方向', minutes: 15 },
  { id: 'writing-notice', subject: '英语', label: '通知写作', goal: '表达活动、时间、地点与行动', minutes: 15 },
  { id: 'writing-explanation', subject: '英语', label: '说明写作', goal: '组织目的、要点与具体说明', minutes: 20 },
  { id: 'writing-argument', subject: '英语', label: '论证写作', goal: '用依据支撑观点并回应不同看法', minutes: 25 },
  { id: 'writing-email', subject: '英语', label: '邮件写作', goal: '面向收件人清楚表达来意与回应', minutes: 15 },
  { id: 'writing-discussion', subject: '英语', label: '学术讨论', goal: '提出看法并回应已有讨论', minutes: 15 },
  { id: 'writing-narrative', subject: '语文', label: '叙事写作', goal: '组织事件、细节与变化', minutes: 20 },
  {
    id: 'writing-material_argument',
    subject: '语文',
    label: '材料论证',
    goal: '围绕材料提出观点并分析依据',
    minutes: 25
  },
  { id: 'science-distance', subject: '物理', label: '路程与位移', goal: '区分总路程与有符号位移', minutes: 15 },
  { id: 'science-density', subject: '物理', label: '密度与单位', goal: '按原条件检验质量、体积与密度', minutes: 15 },
  { id: 'science-pressure', subject: '物理', label: '压强与单位', goal: '按受力与接触条件检验压强', minutes: 15 },
  { id: 'science-force', subject: '物理', label: '恒定合力', goal: '比较相同合力下质量与加速度', minutes: 15 },
  {
    id: 'science-motion',
    subject: '物理',
    label: '初速度与分段运动',
    goal: '按初速度与合力计算路程和位移',
    minutes: 20
  },
  {
    id: 'science-velocity-graph',
    subject: '物理',
    label: '速度—时间图',
    goal: '区分正负面积、路程与位移',
    minutes: 20
  },
  { id: 'science-energy', subject: '物理', label: '功与动能', goal: '按固定参考系比较总功与动能变化', minutes: 20 }
]);

export function journeyDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const at = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value ? at / 86400000 : null;
}

// 日期与模块是同一目标下的阅读目录，不生成子会话或改写原始记录。
export function conversationTimeline(state, conversationId, { dayKey }) {
  const session = state.conversations.find((c) => c.id === conversationId);
  if (!session) return [];
  const timezone = session.journey?.timezone || state.timezone;
  const days = new Map();
  const ensureDay = (day) => {
    if (!days.has(day)) days.set(day, { day, messages: [], groups: [] });
    return days.get(day);
  };
  for (const [index, message] of session.messages.entries())
    ensureDay(dayKey(message.at, timezone)).messages.push({ ...message, index });
  for (const group of session.trainingGroups || []) {
    const module = JOURNEY_MODULES.find((m) => m.id === group.moduleId);
    ensureDay(group.day).groups.push({ ...group, label: module?.label || '训练' });
  }
  ensureDay(dayKey(session.at, timezone));
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// 模型窗口与完整记录分开：只发送当日有界消息，跨日接续由真实原答生成。
export function dailyConversationContext(state, conversationId, at, { dayKey, effectiveGrade }) {
  const session = state.conversations.find((c) => c.id === conversationId);
  if (!session) return { messages: [], continuity: null };
  const timezone = session.journey?.timezone || state.timezone;
  const day = dayKey(at, timezone);
  const today = session.messages.filter(
    (m) => ['user', 'assistant'].includes(m.role) && dayKey(m.at, timezone) === day
  );
  const messages = [];
  let characters = 0;
  for (const message of today.slice(-6).reverse()) {
    const content = message.content.slice(0, 1800);
    if (characters + content.length > 6000) break;
    messages.unshift({ role: message.role, content });
    characters += content.length;
  }
  const history = state.attempts.filter((a) => a.conversationId === conversationId && dayKey(a.at, timezone) < day);
  const reliable = history.filter((a) => effectiveGrade(a).status === 'reliable');
  const pending = history.length - reliable.length;
  const modules = (session.journey?.moduleIds || []).map((moduleId) => {
    const keys = new Set(
      (session.trainingGroups || []).filter((g) => g.moduleId === moduleId).flatMap((g) => g.questionKeys)
    );
    const attempts = history.filter((a) => keys.has(a.questionKey));
    const checked = attempts.filter((a) => effectiveGrade(a).status === 'reliable');
    return {
      moduleId,
      label: JOURNEY_MODULES.find((m) => m.id === moduleId)?.label || '训练',
      answers: attempts.length,
      reliable: checked.length,
      correct: checked.filter((a) => effectiveGrade(a).outcome === 'correct').length,
      pending: attempts.length - checked.length
    };
  });
  return {
    messages,
    continuity: {
      contract: 'learning-daily-context-v1',
      day,
      timezone,
      goal: (session.journey?.title || session.goal).slice(0, 160),
      stopped: session.stopped,
      previous: {
        studyDays: new Set(history.map((a) => dayKey(a.at, timezone))).size,
        answers: history.length,
        reliable: reliable.length,
        correct: reliable.filter((a) => effectiveGrade(a).outcome === 'correct').length,
        wrong: reliable.filter((a) => effectiveGrade(a).outcome === 'wrong').length,
        partial: reliable.filter((a) => effectiveGrade(a).outcome === 'partial').length,
        pending,
        helped: history.filter((a) => a.hints.length).length,
        evidenceIds: history.slice(-3).map((a) => a.id)
      },
      modules,
      boundary: '历史摘要仅是作答记录，不代表掌握；原答与完整对话保留，缺少原文时先询问，不猜测。'
    }
  };
}

export function describeJourney(state, conversationId, at, { dayKey, effectiveGrade }) {
  const session = state.conversations.find((c) => c.id === conversationId);
  if (!session?.journey) return null;
  const program = session.journey;
  const day = dayKey(at, program.timezone);
  const elapsed = journeyDate(day) - journeyDate(program.startDay);
  const groups = (session.trainingGroups || []).filter((g) => g.day === day);
  const modules = program.moduleIds.map((id) => {
    const module = JOURNEY_MODULES.find((m) => m.id === id);
    const rows = groups.filter((g) => g.moduleId === id);
    const group = rows.at(-1);
    const attempts = group?.attemptIds?.map((key) => state.attempts.find((a) => a.id === key)).filter(Boolean) || [];
    const reliable = attempts.filter((a) => effectiveGrade(a).status === 'reliable');
    return {
      ...module,
      group: group || null,
      status: group?.submittedBy ? '已提交' : group ? '进行中' : '待开始',
      completed: rows.some((g) => g.submittedBy),
      correct: reliable.filter((a) => effectiveGrade(a).outcome === 'correct').length,
      reliable: reliable.length,
      pending: attempts.length - reliable.length
    };
  });
  return {
    ...program,
    day,
    dayIndex: elapsed < 0 ? 0 : Math.min(program.durationDays, elapsed + 1),
    elapsedDays: Math.max(0, elapsed + 1),
    startsLater: elapsed < 0,
    ended: elapsed >= program.durationDays,
    modules,
    completed: modules.filter((m) => m.completed).length,
    current: modules.find((m) => !m.completed) || null,
    completedDays: new Set((session.recaps || []).filter((r) => r.kind === 'day' && r.complete).map((r) => r.day)).size
  };
}

export function trainingReport(state, conversationId, groupId, { effectiveGrade }) {
  const session = state.conversations.find((c) => c.id === conversationId);
  const group = session?.trainingGroups?.find((g) => g.id === groupId);
  if (!group) return null;
  const rows = group.questionKeys.map((key, index) => {
    const question = state.questions.find((q) => `${q.id}@${q.version}` === key);
    const attempt = group.submittedBy ? state.attempts.find((a) => a.id === group.attemptIds[index]) : null;
    const grade = attempt ? effectiveGrade(attempt) : null;
    return { question, attempt, grade, questionKey: key, index };
  });
  const attempts = rows.filter((r) => r.attempt);
  const reliable = attempts.filter((r) => r.grade.status === 'reliable');
  return {
    ...group,
    rows,
    submitted: attempts.length,
    correct: reliable.filter((r) => r.grade.outcome === 'correct').length,
    wrong: reliable.filter((r) => r.grade.outcome === 'wrong').length,
    partial: reliable.filter((r) => r.grade.outcome === 'partial').length,
    pending: attempts.length - reliable.length,
    helped: attempts.filter((r) => r.attempt.hints.length).length,
    independentCorrect: reliable.filter((r) => r.grade.outcome === 'correct' && !r.attempt.hints.length).length,
    module: JOURNEY_MODULES.find((m) => m.id === group.moduleId)
  };
}

export function journeyRecap(state, conversationId, kind, day, groupId, helpers) {
  const session = state.conversations.find((c) => c.id === conversationId);
  if (!session?.journey) return null;
  const groups = (session.trainingGroups || []).filter((g) =>
    kind === 'module'
      ? g.id === groupId
      : kind === 'week'
        ? journeyDate(g.day) >= journeyDate(day) - 6 && g.day <= day
        : g.day === day
  );
  const reports = groups.map((g) => trainingReport(state, conversationId, g.id, helpers));
  const rows = reports.flatMap((r) => r.rows).filter((r) => r.attempt);
  const reliable = rows.filter((r) => r.grade.status === 'reliable');
  const evidenceIds = rows.map((r) => r.attempt.id);
  const signature = JSON.stringify(
    groups.map((g) => [
      g.id,
      g.submittedBy,
      g.attemptIds.map((id) => {
        const a = state.attempts.find((a) => a.id === id);
        return [id, a?.questionKey, a ? helpers.effectiveGrade(a) : null, a?.hints.map((h) => h.id)];
      })
    ])
  );
  const modules = session.journey.moduleIds.map((id) => {
    const related = reports.filter((r) => r.moduleId === id);
    const completed = related.some((r) => r.submittedBy);
    const pending = related.reduce((n, r) => n + r.pending, 0);
    const wrong = related.reduce((n, r) => n + r.wrong + r.partial, 0);
    const helped = related.reduce((n, r) => n + r.helped, 0);
    const independent = related.reduce((n, r) => n + r.independentCorrect, 0);
    const count = related.reduce((n, r) => n + r.submitted, 0);
    return {
      ...JOURNEY_MODULES.find((m) => m.id === id),
      completed,
      pending,
      wrong,
      helped,
      evidenceIds: related.flatMap((r) => r.attemptIds),
      next: !completed
        ? '先完成原定模块'
        : pending
          ? '原答待核对，继续独立表达练习'
          : wrong
            ? '围绕本组受阻点换条件检验'
            : helped
              ? '撤去提示后独立检验'
              : count >= 5 && independent === count
                ? '增加组合条件并限时检验'
                : '样本较少，换题继续检验',
      suggestedSize: id.startsWith('writing-')
        ? 1
        : Math.max(
            1,
            Math.min(
              10,
              Math.floor(session.journey.minutes / session.journey.moduleIds.length / (wrong || helped ? 3 : 2))
            )
          )
    };
  });
  const complete =
    kind === 'module'
      ? Boolean(groups.length && groups.every((g) => g.submittedBy))
      : kind === 'day' && modules.every((m) => m.completed) && groups.every((g) => g.submittedBy);
  const confirmed = (session.recaps || []).find(
    (r) => r.kind === kind && r.day === day && (r.groupId || null) === (groupId || null) && r.signature === signature
  );
  return {
    kind,
    day,
    groupId: groupId || null,
    groupIds: groups.map((g) => g.id),
    modules,
    complete,
    evidenceIds,
    signature,
    confirmed: confirmed || null,
    submitted: rows.length,
    correct: reliable.filter((r) => r.grade.outcome === 'correct').length,
    wrong: reliable.filter((r) => r.grade.outcome === 'wrong').length,
    partial: reliable.filter((r) => r.grade.outcome === 'partial').length,
    pending: rows.length - reliable.length,
    independentCorrect: reliable.filter((r) => r.grade.outcome === 'correct' && !r.attempt.hints.length).length
  };
}

export function deriveJourneyInsights(state, conversationId, day, { effectiveGrade, dayKey }) {
  const session = state.conversations.find((c) => c.id === conversationId);
  if (!session?.journey) return { comparisons: [], consolidation: [], handoff: '' };
  const groups = (session.trainingGroups || []).filter((g) => g.day <= day && g.submittedBy);
  const comparisons = session.journey.moduleIds
    .map((moduleId) => {
      const related = groups.filter((g) => g.moduleId === moduleId);
      const days = [...new Set(related.map((g) => g.day))].sort().slice(-2);
      if (days.length < 2) return null;
      const metric = (date) => {
        const reports = related
          .filter((g) => g.day === date)
          .map((g) => trainingReport(state, conversationId, g.id, { effectiveGrade }));
        return {
          correct: reports.reduce((n, r) => n + r.correct, 0),
          reliable: reports.reduce((n, r) => n + r.submitted - r.pending, 0),
          pending: reports.reduce((n, r) => n + r.pending, 0),
          helped: reports.reduce((n, r) => n + r.helped, 0),
          questions: reports.reduce((n, r) => n + r.questionKeys.length, 0),
          minutes: reports.reduce((n, r) => n + r.minutes, 0),
          modes: [...new Set(reports.map((r) => r.mode))],
          evidenceIds: reports.flatMap((r) => r.attemptIds)
        };
      };
      const previous = metric(days[0]),
        current = metric(days[1]);
      return {
        moduleId,
        label: JOURNEY_MODULES.find((m) => m.id === moduleId)?.label || '训练',
        previousDay: days[0],
        currentDay: days[1],
        previous,
        current,
        abilityChangeVerified: false,
        percentagePointDelta:
          previous.reliable && current.reliable
            ? (current.correct / current.reliable - previous.correct / previous.reliable) * 100
            : null,
        conditions:
          previous.questions === current.questions &&
          previous.minutes === current.minutes &&
          JSON.stringify(previous.modes) === JSON.stringify(current.modes)
            ? '题量、模式与建议时长相同；题面与难度仍可能不同'
            : '题量、模式或建议时长不同，不直接比较能力'
      };
    })
    .filter(Boolean);
  const recent = state.attempts.filter(
    (a) =>
      a.conversationId === conversationId &&
      dayKey(a.at, session.journey.timezone) <= day &&
      journeyDate(dayKey(a.at, session.journey.timezone)) >= journeyDate(day) - 6
  );
  const latest = new Map(recent.map((a) => [a.questionKey, a])),
    clusters = new Map();
  for (const attempt of latest.values()) {
    const grade = effectiveGrade(attempt);
    if (grade.status === 'reliable' && grade.outcome === 'correct' && !attempt.hints.length) continue;
    const question = state.questions.find((q) => `${q.id}@${q.version}` === attempt.questionKey);
    if (!question) continue;
    const moduleId = (session.trainingGroups || []).find((g) => g.questionKeys.includes(attempt.questionKey))?.moduleId;
    const kind = grade.status !== 'reliable' ? 'pending' : grade.outcome === 'correct' ? 'helped' : 'reliable';
    const name = question.knowledgePoint || JOURNEY_MODULES.find((m) => m.id === moduleId)?.label || question.prompt;
    const key = `${moduleId || question.subject}:${name}:${kind}`;
    const row = clusters.get(key) || {
      id: key,
      name,
      kind,
      moduleId: moduleId || null,
      evidenceIds: [],
      questionKeys: [],
      wrong: 0,
      partial: 0
    };
    row.evidenceIds.push(attempt.id);
    row.questionKeys.push(attempt.questionKey);
    row.wrong += grade.outcome === 'wrong' && grade.status === 'reliable' ? 1 : 0;
    row.partial += grade.outcome === 'partial' && grade.status === 'reliable' ? 1 : 0;
    clusters.set(key, row);
  }
  const consolidation = [...clusters.values()]
    .map((row) => ({
      ...row,
      label:
        row.kind === 'pending'
          ? '待核对反馈'
          : row.kind === 'helped'
            ? '提示后完成，需独立检验'
            : row.evidenceIds.length >= 2
              ? '重复受阻，集中巩固'
              : row.partial
                ? '部分正确，补全后独立检验'
                : '本题需巩固',
      priority: row.kind === 'pending' ? 0 : row.kind === 'helped' ? 1 : row.evidenceIds.length + 1
    }))
    .sort((a, b) => b.priority - a.priority);
  const completed = new Set((session.recaps || []).filter((r) => r.kind === 'day' && r.complete).map((r) => r.day))
    .size;
  const mode = TRAINING_MODES.find((m) => m.id === session.journey.mode)?.label || '';
  const handoff =
    `${session.journey.title}\n截至 ${day} · ${session.journey.timezone}\n已完成学习日 ${completed}/${session.journey.durationDays}\n固定偏好：${mode}，每日${session.journey.minutes}分钟，原答明确提交。\n` +
    comparisons
      .map(
        (r) =>
          `${r.label}：${r.previousDay} ${r.previous.correct}/${r.previous.reliable}，${r.currentDay} ${r.current.correct}/${r.current.reliable}；当前待核对${r.current.pending}。`
      )
      .join('\n') +
    `\n当前重点：${
      consolidation
        .slice(0, 6)
        .map((r) => `${r.name}（${r.label}，${r.evidenceIds.length}份原答）`)
        .join('；') || '尚无受阻依据'
    }\n不同题面记录差异不等同能力变化；主观反馈仍待核对。`;
  return { comparisons, consolidation, handoff };
}

export function applyJourneyOperation(state, operation, helpers) {
  const { assert, dayKey, questionKey } = helpers;
  const { data, id, at } = operation;
  const session = state.conversations.find((c) => c.id === data.conversationId);
  assert(session, 'NOT_FOUND', '学习目标不存在');
  if (operation.type === 'journey.configure') {
    assert(
      Object.keys(data).every((key) =>
        ['conversationId', 'title', 'startDay', 'durationDays', 'minutes', 'mode', 'moduleIds'].includes(key)
      ),
      'INVALID_INPUT',
      '学习路线包含未知字段'
    );
    assert(
      typeof data.title === 'string' && data.title.trim() && data.title.length <= 160,
      'INVALID_INPUT',
      '请填写160字以内的学习目标'
    );
    assert(journeyDate(data.startDay) !== null, 'INVALID_INPUT', '请选择有效的开始日期');
    assert(
      Number.isInteger(data.durationDays) && data.durationDays >= 1 && data.durationDays <= 365,
      'INVALID_INPUT',
      '计划周期须为1至365天'
    );
    assert(
      Number.isInteger(data.minutes) && data.minutes >= 5 && data.minutes <= 720,
      'INVALID_INPUT',
      '每日学习时间须为5至720分钟'
    );
    assert(
      TRAINING_MODES.some((m) => m.id === data.mode),
      'INVALID_INPUT',
      '请选择学习节奏'
    );
    assert(
      Array.isArray(data.moduleIds) &&
        data.moduleIds.length >= 1 &&
        data.moduleIds.length <= 8 &&
        new Set(data.moduleIds).size === data.moduleIds.length &&
        data.moduleIds.every((key) => JOURNEY_MODULES.some((m) => m.id === key)),
      'INVALID_INPUT',
      '请选择1至8个已支持的训练模块'
    );
    session.journey = {
      contract: JOURNEY_CONTRACT,
      id,
      version: (session.journey?.version || 0) + 1,
      title: data.title.trim(),
      startDay: data.startDay,
      durationDays: data.durationDays,
      minutes: data.minutes,
      mode: data.mode,
      moduleIds: [...data.moduleIds],
      timezone: session.journey?.timezone || state.timezone,
      at,
      savedDay: dayKey(at, session.journey?.timezone || state.timezone)
    };
    return session.journey;
  }
  const program = session.journey;
  assert(program, 'PRECONDITION', '请先保存学习路线');
  assert(!session.stopped, 'STOPPED', '当前学习已停止');
  if (operation.type === 'training.open') {
    assert(
      Object.keys(data).every((key) => ['conversationId', 'moduleId', 'questionKeys', 'day', 'minutes'].includes(key)),
      'INVALID_INPUT',
      '题组包含未知字段'
    );
    assert(program.moduleIds.includes(data.moduleId), 'INVALID_INPUT', '模块不属于当前学习路线');
    const day = data.day || dayKey(at, program.timezone);
    assert(
      journeyDate(day) !== null && journeyDate(day) >= journeyDate(program.startDay),
      'INVALID_INPUT',
      '题组日期不合法或早于路线开始'
    );
    assert(
      Array.isArray(data.questionKeys) &&
        data.questionKeys.length >= 1 &&
        data.questionKeys.length <= 20 &&
        new Set(data.questionKeys).size === data.questionKeys.length,
      'INVALID_INPUT',
      '题组须含1至20道不同题目'
    );
    assert(
      Number.isInteger(data.minutes) && data.minutes >= 1 && data.minutes <= 180,
      'INVALID_INPUT',
      '题组时间须为1至180分钟'
    );
    const questions = data.questionKeys.map((key) => state.questions.find((q) => questionKey(q) === key));
    assert(
      questions.every(Boolean) && data.questionKeys.every((key) => !state.attempts.some((a) => a.questionKey === key)),
      'PRECONDITION',
      '题组须绑定已保存且未作答的题目'
    );
    assert(
      questions.every((q) =>
        [q.writingExercise, q.scienceExercise].every((exercise) => !exercise || exercise.conversationId === session.id)
      ),
      'FORBIDDEN',
      '题目属于另一目标'
    );
    const groups = session.trainingGroups || [];
    assert(groups.length < 100, 'RESOURCE_LIMIT', '本目标题组已达100组，请导出记录');
    assert(
      !groups.some((g) => !g.submittedBy && g.moduleId === data.moduleId && g.day === day),
      'PRECONDITION',
      '请先继续已有未交卷题组'
    );
    assert(
      !groups.some((g) => g.questionKeys.some((key) => data.questionKeys.includes(key))),
      'CONFLICT',
      '题目已属于其他题组'
    );
    const group = {
      id,
      contract: JOURNEY_CONTRACT,
      moduleId: data.moduleId,
      questionKeys: [...data.questionKeys],
      day,
      timezone: program.timezone,
      mode: program.mode,
      minutes: data.minutes,
      configVersion: program.version,
      at,
      submittedBy: null,
      attemptIds: []
    };
    session.trainingGroups = [...groups, group];
    return group;
  }
  if (operation.type === 'training.complete') {
    assert(
      Object.keys(data).every((key) => ['conversationId', 'groupId', 'attemptIds', 'explicit'].includes(key)) &&
        data.explicit === true,
      'INVALID_INPUT',
      '整批交卷需要明确提交'
    );
    const group = session.trainingGroups?.find((g) => g.id === data.groupId);
    assert(group && !group.submittedBy, 'PRECONDITION', '题组不存在或已交卷');
    assert(dayKey(at, group.timezone) >= group.day, 'NOT_DUE', '此题组尚未到安排日期');
    assert(
      Array.isArray(data.attemptIds) &&
        data.attemptIds.length === group.questionKeys.length &&
        new Set(data.attemptIds).size === data.attemptIds.length,
      'INVALID_INPUT',
      '整批作答不完整'
    );
    assert(
      data.attemptIds.every((key, index) =>
        state.attempts.some(
          (a) =>
            a.id === key &&
            a.conversationId === session.id &&
            a.questionKey === group.questionKeys[index] &&
            a.at >= group.at
        )
      ),
      'PRECONDITION',
      '整批原答与题目或目标不匹配'
    );
    group.submittedBy = id;
    group.attemptIds = [...data.attemptIds];
    return { groupId: group.id, attemptIds: group.attemptIds };
  }
  if (operation.type === 'recap.confirm') {
    assert(
      Object.keys(data).every((key) =>
        ['conversationId', 'kind', 'day', 'groupId', 'signature', 'explicit'].includes(key)
      ) &&
        data.explicit === true &&
        ['module', 'day', 'week'].includes(data.kind),
      'INVALID_INPUT',
      '请选择并确认本次复盘'
    );
    assert(journeyDate(data.day) !== null && data.day <= dayKey(at, program.timezone), 'NOT_DUE', '不能完成未来复盘');
    const recap = journeyRecap(state, session.id, data.kind, data.day, data.groupId, helpers);
    assert(
      recap.submitted > 0 && recap.signature === data.signature,
      'CONTEXT_CHANGED',
      '学习依据已变化，请重新查看复盘'
    );
    assert((session.recaps || []).length < 500, 'RESOURCE_LIMIT', '复盘已达保存上限，请导出记录');
    const saved = {
      id,
      kind: data.kind,
      day: data.day,
      groupId: data.groupId || null,
      groupIds: recap.groupIds,
      evidenceIds: recap.evidenceIds,
      signature: recap.signature,
      complete: recap.complete,
      moduleIds: [...program.moduleIds],
      at
    };
    session.recaps = [...(session.recaps || []), saved];
    return saved;
  }
  assert(false, 'UNKNOWN_TOOL', '学习路线操作不支持');
}
