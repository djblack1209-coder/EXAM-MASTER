import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { dailyConversationContext } from '../../laf-backend/functions/_shared/learning-journey.js';
import { dayKey, effectiveGrade } from '@/services/learning/learning-domain.js';
import { generateLearningTurn } from '@/services/api/domains/learning.api.js';
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  generateLearningTurn: vi.fn()
}));

beforeEach(() => {
  uni.clearStorageSync();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T10:00:00Z'));
  setActivePinia(createPinia());
});
afterEach(() => {
  for (const store of getActivePinia()?._s.values() || []) store.$dispose();
  learningWriteLease.release();
  vi.useRealTimers();
  uni.clearStorageSync();
});
function setup(moduleIds = ['arithmetic-add'], timezone = null) {
  const store = useConversationLearningStore();
  if (timezone) store.commit('timezone.set', { timezone });
  store.start('自主学习路线');
  store.configureJourney(store.journeyContext(), {
    title: '7天模块训练',
    startDay: '2026-10-10',
    durationDays: 7,
    minutes: 30,
    mode: 'batch',
    moduleIds
  });
  return store;
}

describe('整批训练的实际学习记录', () => {
  it('跨日/模块目录仅定位完整会话，停止、原答、全部消息与恢复事实不变化', () => {
    const s = setup(['arithmetic-add', 'writing-notice']);
    const id = s.active.id;
    const math = s.startTraining(s.journeyContext(), 'arithmetic-add', 1);
    s.commit('message.add', { conversationId: id, role: 'user', content: '第一日的数学讨论' });
    s.submitTraining(s.journeyContext(), math.id, ['12']);
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
    s.refresh();
    const writing = s.startTraining(s.journeyContext(), 'writing-notice', 1);
    s.commit('message.add', { conversationId: id, role: 'user', content: '第二日的写作讨论' });
    s.commit('task.stop', { conversationId: id });
    const before = s.exportData();
    s.locateConversation(id, '2026-10-10', math.id);
    expect(s.active.id).toBe(id);
    expect(s.trainingGroup.id).toBe(math.id);
    expect(s.active.stopped).toBe(true);
    expect(s.timeline.map((c) => c.day)).toEqual(['2026-10-10', '2026-10-11']);
    expect(s.active.messages.map((m) => m.content)).toContain('第二日的写作讨论');
    s.locateConversation(id, '2026-10-11', writing.id);
    expect(s.exportData()).toBe(before);
    expect(() => s.locateConversation(id, '2026-10-10', writing.id)).toThrow('模块记录不存在');
    expect(s.exportData()).toBe(before);
  });

  it('真实模型请求只带当日消息和本目标的有依据跨日摘要，原始对话保留', async () => {
    const s = setup(['arithmetic-add', 'writing-notice']);
    const id = s.active.id;
    const math = s.startTraining(s.journeyContext(), 'arithmetic-add', 1);
    s.commit('message.add', { conversationId: id, role: 'user', content: '旧日正文不可加入新日窗口' });
    s.submitTraining(s.journeyContext(), math.id, ['13']);
    const oldEvidence = s.state.attempts[0].id;
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
    s.refresh();
    s.models = [{ id: 'fixture', model: 'fixture-model', capabilities: {} }];
    s.modelId = 'fixture';
    s.selectedMode = 'cloud';
    s.sharingAllowed = true;
    vi.mocked(generateLearningTurn).mockResolvedValue({ success: true, data: { message: '本日合成反馈', tools: [] } });
    await s.send('请继续今天的目标', { discussionOnly: true });
    const payload = vi.mocked(generateLearningTurn).mock.calls[0][0];
    expect(payload.messages).toEqual([{ role: 'user', content: '请继续今天的目标' }]);
    expect(payload.learningContext.summary.continuity).toMatchObject({
      day: '2026-10-11',
      goal: '7天模块训练',
      previous: { answers: 1, wrong: 1, pending: 0, evidenceIds: [oldEvidence] }
    });
    expect(s.active.id).toBe(id);
    expect(s.active.messages.some((m) => m.content === '旧日正文不可加入新日窗口')).toBe(true);
  });

  it('学习日按原安排时区切分，长日窗口有界且不裁剪保存正文或混入其他目标', () => {
    const s = setup(['arithmetic-add'], 'Asia/Shanghai');
    const id = s.active.id;
    for (let i = 0; i < 14; i++)
      s.commit('message.add', {
        conversationId: id,
        role: i % 2 ? 'assistant' : 'user',
        content: `${i}:` + '长'.repeat(2500)
      });
    const before = s.exportData();
    const context = dailyConversationContext(s.state, id, Date.now(), { dayKey, effectiveGrade });
    expect(context.messages.length).toBeLessThanOrEqual(10);
    expect(context.messages.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(8000);
    expect(context.messages.at(-1).content.startsWith('13:')).toBe(true);
    expect(s.active.messages.at(-1).content.length).toBe(2503);
    expect(s.exportData()).toBe(before);
    s.commit('timezone.set', { timezone: 'America/Los_Angeles' });
    const next = dailyConversationContext(s.state, id, Date.parse('2026-10-10T17:00:00Z'), { dayKey, effectiveGrade });
    expect(next.continuity.timezone).toBe('Asia/Shanghai');
    expect(next.continuity.day).toBe('2026-10-11');
    expect(next.messages).toEqual([]);
    s.start('另一目标');
    expect(
      dailyConversationContext(s.state, s.active.id, Date.now(), { dayKey, effectiveGrade }).continuity.previous.answers
    ).toBe(0);
  });
  it('缺答整批不写入，统一交卷保留各题帮助与原答、独立判分、调度及幂等恢复', () => {
    const s = setup();
    const group = s.startTraining(s.journeyContext(), 'arithmetic-add', 2);
    expect(s.state.attempts).toHaveLength(0);
    expect(group.questionKeys).toHaveLength(2);
    s.focus(group.questionKeys[0]);
    s.commit('hint.add', { conversationId: s.active.id, level: 1, content: '拆开个位再计算' });
    const before = s.exportData();
    expect(() => s.submit('12', true, 'not-a-batch-submit')).toThrow();
    expect(s.exportData()).toBe(before);
    expect(() => s.submitTraining(s.journeyContext(), group.id, ['12', ''])).toThrow();
    expect(s.exportData()).toBe(before);
    const report = s.submitTraining(s.journeyContext(), group.id, ['12', '17']);
    expect(report).toMatchObject({ submitted: 2, correct: 1, wrong: 1, pending: 0, helped: 1 });
    expect(s.state.attempts.map((a) => a.answer)).toEqual(['12', '17']);
    expect(s.state.attempts.map((a) => a.hints.length)).toEqual([1, 0]);
    expect(s.state.reviews).toHaveLength(2);
    const accepted = s.exportData();
    s.submitTraining(s.journeyContext(), group.id, ['12', '17']);
    expect(s.exportData()).toBe(accepted);
    expect(() => s.submitTraining(s.journeyContext(), group.id, ['13', '17'])).toThrow();
    const restored = prepareLearningRestore(emptyLearningState(s.state.owner, s.state.timezone), accepted);
    expect(restored.state.conversations.at(-1).trainingGroups).toEqual(s.active.trainingGroups);
    expect(restored.state.attempts.map((a) => a.answer)).toEqual(['12', '17']);
    expect(s.journey.completed).toBe(1);
    expect(s.journey.completedDays).toBe(0);
  });

  it.each([
    'arithmetic-multiply',
    'algebra-equation',
    'algebra-inequality',
    'condition-relation',
    'writing-notice',
    'writing-explanation',
    'writing-argument',
    'writing-email',
    'writing-discussion',
    'writing-narrative',
    'writing-material_argument',
    'science-distance',
    'science-density',
    'science-pressure'
  ])('%s模块沿现有题面合同创建且不预先写入原答', (moduleId) => {
    const s = setup([moduleId]);
    const group = s.startTraining(s.journeyContext(), moduleId, 1);
    expect(group.questionKeys).toHaveLength(1);
    expect(s.state.attempts).toHaveLength(0);
    const question = s.state.questions.at(-1);
    expect(question.prompt.length).toBeGreaterThan(8);
    expect(question.publishable).toBe(false);
    expect(question.validation === null).toBe(moduleId.startsWith('writing-'));
  });

  it('未来题组、停止及切换目标后的旧交卷拒绝写入', () => {
    const s = setup();
    const group = s.startTraining(s.journeyContext(), 'arithmetic-add', 2, '2026-10-11');
    const before = s.exportData();
    expect(() => s.submitTraining(s.journeyContext(), group.id, ['12', '16'])).toThrow();
    expect(s.exportData()).toBe(before);
    s.commit('task.stop', { conversationId: s.active.id });
    const stopped = s.exportData();
    expect(() => s.submitTraining(s.journeyContext(), group.id, ['12', '16'])).toThrow();
    expect(s.exportData()).toBe(stopped);
    const old = s.journeyContext();
    s.start('另一目标');
    const changed = s.exportData();
    expect(() => s.submitTraining(old, group.id, ['12', '16'])).toThrow();
    expect(s.exportData()).toBe(changed);
  });

  it('复盘从整批原答生成，未提交模块不完成学习日，主观原答保持待核对且不推进FSRS', () => {
    const s = setup(['arithmetic-add', 'writing-notice']);
    const math = s.startTraining(s.journeyContext(), 'arithmetic-add', 2);
    s.submitTraining(s.journeyContext(), math.id, ['12', '17']);
    expect(s.dailyRecap).toMatchObject({ complete: false, correct: 1, wrong: 1, pending: 0 });
    s.confirmRecap(s.journeyContext(), 'day');
    expect(s.journey.completedDays).toBe(0);
    const writing = s.startTraining(s.journeyContext(), 'writing-notice', 2);
    const first = 'Original writing.  Keep spaces.\nA second line.\n';
    s.submitTraining(s.journeyContext(), writing.id, [first, 'Another original notice.']);
    expect(s.dailyRecap).toMatchObject({ complete: true, correct: 1, wrong: 1, pending: 2, submitted: 4 });
    expect(s.state.attempts[2].answer).toBe(first);
    expect(s.state.reviews).toHaveLength(2);
    expect(s.journey.completedDays).toBe(0);
    s.confirmRecap(s.journeyContext(), 'day');
    expect(s.journey.completedDays).toBe(1);
    const before = s.exportData();
    s.confirmRecap(s.journeyContext(), 'day');
    expect(s.exportData()).toBe(before);
    expect(s.weeklyRecap).toMatchObject({ submitted: 4, pending: 2 });
  });
  it('两日对比只表达训练记录差异，巩固卡关联真实受阻原答并打开独立变式', () => {
    const s = setup();
    const day1 = s.startTraining(s.journeyContext(), 'arithmetic-add', 2);
    s.submitTraining(s.journeyContext(), day1.id, ['13', '17']);
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
    s.refresh();
    const day2 = s.startTraining(s.journeyContext(), 'arithmetic-add', 2);
    s.submitTraining(s.journeyContext(), day2.id, ['50', '33']);
    expect(s.journeyInsights.comparisons[0]).toMatchObject({
      previousDay: '2026-10-10',
      currentDay: '2026-10-11',
      previous: { correct: 0, reliable: 2 },
      current: { correct: 2, reliable: 2 },
      abilityChangeVerified: false
    });
    const weak = s.journeyInsights.consolidation.find((row) => row.kind === 'reliable');
    expect(weak.evidenceIds).toHaveLength(2);
    expect(weak.label).toContain('重复受阻');
    const before = s.state.attempts.length;
    s.startWeakness(s.journeyContext(), weak.evidenceIds[0]);
    expect(s.activeQuestion.parentQuestionKey).toBe(day1.questionKeys[0]);
    expect(s.state.attempts).toHaveLength(before);
    expect(s.active.pendingHints).toEqual([]);
  });
});
