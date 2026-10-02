// Optional self-report. This changes teaching preference, never grades or mastery.
export const learningRhythms = Object.freeze([
  { id: 'focus', label: '专注推进', description: '独立检验，再校准难度', icon: 'target', method: 'check' },
  { id: 'gentle', label: '慢慢理解', description: '拆成小步，留出思考时间', icon: 'sun', method: 'steps' },
  { id: 'review', label: '巩固复习', description: '从已有错题与到期题开始', icon: 'refresh', method: 'review' }
]);

export function rhythmOperations(id, conversationId = null) {
  const rhythm = learningRhythms.find((item) => item.id === id);
  if (!rhythm) throw new Error('请选择有效的学习节奏');
  const scope = conversationId ? `对话 ${conversationId}` : '下一段学习';
  return [
    { type: 'profile.set', data: { field: 'preference', value: rhythm.label, source: 'self_report', scope } },
    {
      type: 'strategy.set',
      data: {
        method: rhythm.method,
        reason: `用户选择${rhythm.label}，可随时调整；不据此判断能力`,
        evidenceIds: [],
        source: 'self_report',
        ...(conversationId ? { conversationId } : {})
      }
    }
  ];
}

export function currentRhythm(profile, conversationId = null, method = null) {
  const scope = conversationId ? `对话 ${conversationId}` : '下一段学习';
  const entry = [...profile]
    .reverse()
    .find(
      (item) =>
        item.field === 'preference' &&
        item.source === 'self_report' &&
        (item.scope === scope || item.scope === '下一段学习')
    );
  return learningRhythms.find((item) => item.label === entry?.value && (!method || item.method === method))?.id || null;
}
