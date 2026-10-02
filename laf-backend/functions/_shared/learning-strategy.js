// 教法是对话内的选择；复用已保存的事件，不从最后一个全局标签推测其他对话。
export function conversationStrategy(state, conversationId) {
  const session = (state.conversations || []).find((c) => c.id === conversationId);
  if (!conversationId) return { ...state.strategy };
  const events = state.events || [];
  const start = events.findIndex((e) => e.type === 'conversation.start' && e.id === conversationId);
  let index = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (!['strategy.set', 'strategy.auto'].includes(e.type)) continue;
    if (e.data?.conversationId === conversationId || (!e.data?.conversationId && start >= 0 && i < start)) {
      index = i;
      break;
    }
  }
  const event = events[index];
  const fallback =
    !events.some((e) => ['strategy.set', 'strategy.auto'].includes(e.type)) &&
    (!state.strategy?.conversationId || state.strategy.conversationId === conversationId)
      ? state.strategy
      : null;
  let strategy = {
    method: 'question',
    difficulty: 'self_report',
    ...(event?.result || fallback || {}),
    conversationId,
    stopped: Boolean(session?.stopped)
  };
  // 更正发生在选择之后才撤销自动判断；保留当时的事件与用户选择。
  if (strategy.source === 'observed')
    for (let i = index + 1; i < events.length; i++) {
      const e = events[i];
      if (
        ['assessment.correct', 'assessment.review'].includes(e.type) &&
        strategy.evidenceIds?.includes(e.data?.attemptId)
      ) {
        strategy = {
          ...strategy,
          method: 'check',
          difficulty: 'calibrated',
          reason: '相关判分依据已更正，撤销旧策略判断；等待重新检验',
          evidenceIds: [],
          at: e.at
        };
        break;
      }
    }
  return strategy;
}

export function requestedTeachingMethod(state, conversationId) {
  const strategy = conversationStrategy(state, conversationId);
  return strategy.source === 'self_report' && !strategy.stopped ? strategy.method : null;
}
