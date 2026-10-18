function latestBasis(state, type, data) {
  return type === 'plan.set'
    ? state.plans.filter((plan) => plan.day === data.day).at(-1)?.id || null
    : state.profile.filter((entry) => entry.field === data.field && entry.scope === data.scope).at(-1)?.id || null;
}

export function normalizeLearningProposal(state, input, conversationId, now, { assert, dayKey, preview }) {
  assert(input && ['profile.set', 'plan.set'].includes(input.type), 'INVALID_INPUT', '建议类型不合法');
  assert(
    Object.keys(input).every((key) => ['type', 'data'].includes(key)),
    'INVALID_INPUT',
    '建议包含额外字段'
  );
  assert(input.data && typeof input.data === 'object' && !Array.isArray(input.data), 'INVALID_INPUT', '建议内容不合法');
  const allowed = input.type === 'plan.set' ? ['tasks', 'reason', 'day', 'timezone'] : ['field', 'value', 'scope'];
  assert(
    Object.keys(input.data).every((key) => allowed.includes(key)),
    'FORBIDDEN',
    '建议不能自动执行操作'
  );
  const data = { ...JSON.parse(JSON.stringify(input.data)), conversationId };
  if (input.type === 'plan.set') {
    if (data.timezone === undefined) data.timezone = state.timezone;
    try {
      if (data.day === undefined) data.day = dayKey(now, data.timezone);
    } catch {
      assert(false, 'INVALID_INPUT', '计划时区不合法');
    }
    assert(Array.isArray(data.tasks) && data.tasks.length <= 20, 'RESOURCE_LIMIT', '建议最多20项任务');
    assert(
      data.tasks.every(
        (task) => task && Object.keys(task).every((key) => ['id', 'title', 'questionKey', 'condition'].includes(key))
      ),
      'FORBIDDEN',
      '任务状态只能从实际作答取得'
    );
  } else {
    data.source = 'self_report';
    data.scope ||= '当前任务';
  }
  assert(JSON.stringify(data).length <= 16000, 'RESOURCE_LIMIT', '建议内容过长');
  // Validate with the existing reducer on a disposable copy. No facts are adopted here.
  preview(input.type, data);
  return {
    type: input.type,
    data,
    owner: state.owner,
    goal: state.conversations.find((item) => item.id === conversationId)?.goal,
    basis: latestBasis(state, input.type, data),
    timezone: state.timezone
  };
}

export function assertLearningProposalAcceptance(state, type, data, { assert, fingerprint }) {
  const session = state.conversations.find((item) => item.id === data.conversationId);
  assert(session && !session.stopped, 'STOPPED', '当前任务已停止，请先明确继续');
  const proposal = session?.messages.find((message) => message.id === data.proposalId)?.proposal;
  assert(
    data.explicit === true && proposal?.owner === state.owner && proposal.type === type,
    'PRECONDITION',
    '请先确认当前建议'
  );
  assert(!state.events.some((event) => event.id === `${data.proposalId}:dismiss`), 'CONTEXT_CHANGED', '建议已取消');
  assert(
    proposal.goal === session.goal &&
      proposal.timezone === state.timezone &&
      proposal.basis === latestBasis(state, type, proposal.data),
    'CONTEXT_CHANGED',
    '资料已更新，请重新查看建议'
  );
  const { proposalId: _id, explicit: _explicit, ...actual } = data;
  assert(fingerprint(actual) === fingerprint(proposal.data), 'CONTEXT_CHANGED', '建议内容已变化');
}

export function proposalStatus(state, id) {
  if (state.events.some((event) => event.id === `${id}:accept` && event.data?.proposalId === id)) return 'accepted';
  if (state.events.some((event) => event.id === `${id}:dismiss`)) return 'dismissed';
  return 'pending';
}
