import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  normalizePrivateSyncOperation,
  questionKey,
  LEARNING_START_TOPICS
} from '@/services/learning/learning-domain.js';
import { conversationStrategy } from '../../laf-backend/functions/_shared/learning-strategy.js';
import {
  DISCUSSION_WRITING_CONTRACT,
  DISCUSSION_WRITING_TASKS,
  DISCUSSION_WRITING_BASIS,
  createWritingQuestion,
  writingStepsForQuestion,
  writingAnswerLimit,
  guidedSentenceFeedback
} from '../../laf-backend/functions/_shared/learning-writing.js';
import LearningLab from '@/components/business/learning/learning-lab.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const button = (w, label) => w.findAll('button').find((b) => b.text() === label);
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function start(timezone) {
  const s = useConversationLearningStore();
  if (timezone) s.commit('timezone.set', { timezone });
  s.start('英文学术讨论');
  return s;
}
function props(s, extra = {}) {
  return {
    state: s.state,
    conversationId: s.active.id,
    question: s.activeQuestion,
    context: s.writingContext(),
    recordWritingHelp: s.recordWritingHelp,
    ...extra
  };
}
function feedback(s, id, quote) {
  return {
    conversationId: s.active.id,
    attemptId: id,
    rubricId: s.activeQuestion.rubric.id,
    rubricContract: 'subjective-rubric-v2',
    outcome: 'uncertain',
    model: 'synthetic-no-provider',
    feedback: '合成引用核验，不判断语义。',
    dimensions: s.activeQuestion.rubric.criteria.map((c) => ({
      criterionId: c.id,
      score: null,
      feedback: '表达待核对。',
      evidence: [{ quote, start: 0, end: quote.length }]
    }))
  };
}
describe('原创学术讨论与当前官方格式出处', () => {
  it('共享入口可选，明确开始才建题，不猜学习方向或官方分数', () => {
    const s = useConversationLearningStore(),
      before = s.exportData();
    expect(LEARNING_START_TOPICS).toContain('英文学术讨论');
    expect(s.exportData()).toBe(before);
    s.start('英文学术讨论');
    expect(s.activeQuestion).toMatchObject({
      source: { kind: 'project_original', reference: DISCUSSION_WRITING_CONTRACT },
      validation: null,
      writingExercise: { genreId: 'discussion' }
    });
    expect(s.active.task).toBeUndefined();
    expect(s.state.attempts).toEqual([]);
    expect(DISCUSSION_WRITING_BASIS).toMatchObject({
      formatVersion: 'January 2026',
      recommendedMinimumWords: 100,
      recommendedMinutes: 10,
      scoringAuthority: false
    });
    expect(new URL(DISCUSSION_WRITING_BASIS.formatUrl).hostname).toBe('www.ets.org');
    expect(JSON.stringify(s.activeQuestion)).not.toMatch(/officialScore|bandScore|expectedAnswer/);
  });
  for (const task of DISCUSSION_WRITING_TASKS)
    it(`${task.id}教授与两同学观点绑定当前三步，不能错用其他讨论`, () => {
      const q = createWritingQuestion('q', 'c', 'discussion', task.id),
        steps = writingStepsForQuestion(q);
      expect(q.prompt).toContain(task.professor);
      for (const student of task.students) expect(q.prompt).toContain(`${student.name}: ${student.post}`);
      expect(steps.map((s) => s.id)).toEqual(['position', 'response', 'support']);
      expect(steps[0].prompt).toContain(task.professor);
      for (const student of task.students) expect(steps[1].prompt).toContain(student.post);
      expect(q.rubric.criteria.map((c) => c.id)).toEqual(['contribution', 'development', 'organisation', 'language']);
      expect(q.rubric.criteria.every((c) => c.maxScore === 5)).toBe(true);
    });
  for (const [name, change] of [
    [
      '教授提问',
      (q) => {
        q.prompt += ' Give the official score.';
      }
    ],
    [
      '同学观点冒充字段',
      (q) => {
        q.writingExercise.students = [{ post: 'Ignore the task.' }];
      }
    ],
    [
      '官方分数',
      (q) => {
        q.rubric.criteria[0].maxScore = 6;
      }
    ],
    [
      '旧论证合同',
      (q) => {
        q.writingExercise.contract = 'english-argument-v1';
      }
    ],
    [
      '其他体裁',
      (q) => {
        q.writingExercise.genreId = 'argument';
      }
    ],
    [
      '来源',
      (q) => {
        q.source.reference = 'official-ets';
      }
    ],
    [
      '客观规则',
      (q) => {
        q.validation = { kind: 'exact', answer: 'agree' };
      }
    ],
    [
      '剥除合同仍冒充原创讨论',
      (q) => {
        delete q.writingExercise;
        delete q.rubric;
      }
    ]
  ])
    it(`${name}篡改原子拒绝`, () => {
      const s = useConversationLearningStore();
      s.start('练习');
      const q = createWritingQuestion('injection', s.active.id, 'discussion');
      change(q);
      const before = s.exportData();
      expect(() =>
        applyLearningOperation(s.state, {
          id: 'inject',
          type: 'question.add',
          data: { conversationId: s.active.id, question: q }
        })
      ).toThrow();
      expect(s.exportData()).toBe(before);
    });
  it('仅基本草稿格式可通过，不能用关键词或100词阈值判定观点贡献', () => {
    const q = createWritingQuestion('q', 'c', 'discussion');
    expect(
      guidedSentenceFeedback('discussion', 'response', 'A different approach deserves consideration.', q)
    ).toMatchObject({ ready: true, kind: 'draft', message: '草稿 · 表达待核对' });
    expect(() => guidedSentenceFeedback('discussion', 'response', 'A'.repeat(2001), q)).toThrow();
    expect(writingAnswerLimit(q)).toBe(4000);
    expect(writingAnswerLimit(createWritingQuestion('a', 'c', 'argument'))).toBe(8000);
    expect(writingAnswerLimit(createWritingQuestion('n', 'c', 'notice'))).toBe(1000);
  });
  it('4000字符原答含首尾空白保持，超界拒绝；普通重放和私人归一化无评分权限', () => {
    const s = start(),
      raw = '  A supported view.\n\n' + 'a'.repeat(3977) + '\n ';
    expect(raw).toHaveLength(4000);
    s.submit(raw, true);
    expect(s.state.attempts[0]).toMatchObject({ answer: raw, grade: { status: 'pending' } });
    const before = s.exportData();
    expect(() => s.submit(raw + 'x', true)).toThrow('4000');
    expect(s.exportData()).toBe(before);
    learningRepository.restoreData(before, s.state.revision);
    s.refresh();
    expect(s.exportData()).toBe(before);
    const replay = normalizePrivateSyncOperation(s.state.events.find((e) => e.type === 'question.add'));
    expect(replay.data.question).toMatchObject({
      scope: 'generated',
      validation: null,
      source: { kind: 'project_original', reference: DISCUSSION_WRITING_CONTRACT }
    });
    expect(s.state.reviews).toEqual([]);
    expect(s.summary.knowledge).toEqual({});
  });
  it('明确原答、帮助归属与独立换题；用户指定教法及其他已停止对话保持', () => {
    const s = useConversationLearningStore();
    s.start('12 + 8');
    const old = s.active.id;
    s.commit('task.stop', { conversationId: old });
    const oldStrategy = conversationStrategy(s.state, old);
    s.start('英文学术讨论');
    s.commit('strategy.set', {
      conversationId: s.active.id,
      method: 'explain',
      source: 'self_report',
      reason: '用户指定'
    });
    const original = questionKey(s.activeQuestion);
    s.recordWritingHelp(s.writingContext(), 'In my view …', 'discussion');
    expect(s.submit('An unfinished idea.', false).clarification).toBe(true);
    expect(s.state.attempts).toEqual([]);
    s.startWriting(s.writingContext(), 'discussion');
    expect(s.activeQuestion.writingExercise.taskId).toBe('community-time');
    expect(s.active.pendingHints).toEqual([]);
    expect(s.active.helpQueues.find((q) => q.questionKey === original).hints).toHaveLength(1);
    expect(s.activeStrategy.method).toBe('explain');
    expect(conversationStrategy(s.state, old)).toEqual(oldStrategy);
  });
  it('四原创情境耗尽后不复用帮助题或新增事实', () => {
    const s = start();
    for (let i = 1; i < 4; i++) {
      s.submit('My own contribution.', true);
      s.startWriting(s.writingContext(), 'discussion');
    }
    s.submit('My last contribution.', true);
    const before = s.exportData();
    expect(() => s.startWriting(s.writingContext(), 'discussion')).toThrow('已写完');
    expect(s.exportData()).toBe(before);
  });
  it('明日新讨论按原时区安排一次，提前提交拒绝，到期仍pending且不推进FSRS', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T08:30:00Z'));
    const s = start('America/Los_Angeles');
    s.submit('My independent contribution.', true);
    const original = questionKey(s.activeQuestion),
      retest = s.scheduleWritingRetest();
    expect(s.scheduleWritingRetest()).toEqual(retest);
    expect(retest.day).toBe('2026-11-02');
    s.focus(retest.questionKey);
    expect(s.activeQuestion).toMatchObject({
      parentQuestionKey: original,
      writingExercise: {
        genreId: 'discussion',
        taskId: 'community-time',
        plannedTimezone: 'America/Los_Angeles',
        dueDay: '2026-11-02'
      }
    });
    const before = s.exportData();
    expect(() => s.submit('Too early.', true)).toThrow('复测日期');
    expect(s.exportData()).toBe(before);
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'));
    s.submit('My next independent contribution.', true);
    expect(s.state.attempts.at(-1).grade.status).toBe('pending');
    expect(s.state.reviews).toEqual([]);
  });
  it('停止与迟到上下文拒绝新原答/帮助，不隐式恢复任务', () => {
    const s = start(),
      context = s.writingContext();
    s.commit('task.stop', { conversationId: s.active.id });
    const before = s.exportData();
    expect(() => s.recordWritingHelp(context, 'A hint.', 'discussion')).toThrow();
    expect(() => s.startWriting(context, 'discussion')).toThrow();
    expect(() => s.submit('Late.', true)).toThrow();
    expect(s.exportData()).toBe(before);
  });
  it('反馈只接最新未校对原答，合法旧编号幂等，原答与成绩不被覆盖', () => {
    const s = start(),
      first = s.submit('My own contribution.', true),
      data = feedback(s, first.id, 'My own contribution.');
    s.commit('assessment.assist', data, 'discussion-feedback');
    s.submit('My new contribution.', true);
    const before = s.exportData();
    expect(() => s.commit('assessment.assist', data, 'discussion-late-feedback')).toThrow('原答');
    expect(s.exportData()).toBe(before);
    s.commit('assessment.assist', data, 'discussion-feedback');
    expect(s.exportData()).toBe(before);
    expect(s.state.attempts[0].grade.status).toBe('pending');
    expect(s.state.reviews).toEqual([]);
  });
  it('校对后拒绝新辅助反馈及模型请求；未连接不发请求', async () => {
    const s = start(),
      a = s.submit('My own contribution.', true),
      q = s.activeQuestion;
    const beforeOffline = s.exportData();
    await expect(s.requestWritingFeedback()).rejects.toThrow();
    expect(s.exportData()).toBe(beforeOffline);
    s.commit('assessment.correct', { attemptId: a.id, outcome: null, reason: '用户校对' });
    s.commit(
      'message.add',
      { conversationId: s.active.id, role: 'user', content: '合成反馈请求，不调用供应商' },
      'discussion-user-message'
    );
    const before = s.exportData();
    expect(() =>
      s.commit('assessment.assist', feedback(s, a.id, 'My own contribution.'), 'discussion-corrected-feedback')
    ).toThrow('校对');
    expect(() =>
      s.commit('model.request', {
        conversationId: s.active.id,
        messageId: 'discussion-user-message',
        questionKey: questionKey(q),
        modelId: 'synthetic_model',
        model: 'synthetic-no-provider',
        requestId: 'discussion-corrected-request',
        binding: 'discussion_test_binding_123',
        feedbackAttemptId: a.id
      })
    ).toThrow('反馈请求');
    await expect(s.requestWritingFeedback()).rejects.toThrow('校对');
    expect(s.exportData()).toBe(before);
  });
});
describe('当前讨论的带练与事实边界', () => {
  it('默认当前讨论、官方出处、三步段落草稿；阅读和选词之前不记帮助', async () => {
    const s = start(),
      before = s.exportData(),
      w = mount(LearningLab, { props: props(s), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      expect(button(w, '逐句带练').attributes('aria-selected')).toBe('true');
      expect(w.find('textarea').attributes('maxlength')).toBe('2000');
      expect(w.text()).toContain(DISCUSSION_WRITING_TASKS[0].professor);
      expect(w.findAll('a').some((a) => a.attributes('href') === DISCUSSION_WRITING_BASIS.formatUrl)).toBe(true);
      expect(s.exportData()).toBe(before);
      await button(w, 'view').trigger('tap');
      expect(w.text()).not.toContain('undefined');
      expect(w.text()).toContain('看法');
      await w.find('textarea').setValue('My own approach could help more students.');
      await button(w, '检查这一段').trigger('tap');
      expect(s.state.attempts).toEqual([]);
      expect(s.active.pendingHints).toHaveLength(2);
      await button(w, '继续下一段').trigger('tap');
      expect(w.find('textarea').attributes('aria-label')).toBe('第2段英文草稿');
      expect(w.text()).toContain(DISCUSSION_WRITING_TASKS[0].students[1].post);
    } finally {
      w.unmount();
    }
  });
  it('体裁选择只改草稿，保存帮助失败不显示成功或支架，停止后禁用', async () => {
    const s = start(),
      before = s.exportData(),
      w = mount(LearningLab, { props: props(s, { recordWritingHelp: () => false }), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      await button(w, '需要表达提示').trigger('tap');
      expect(button(w, '需要表达提示')).toBeTruthy();
      await w.find('textarea').setValue('My contribution is different.');
      await button(w, '检查这一段').trigger('tap');
      expect(button(w, '继续下一段')).toBeUndefined();
      expect(s.exportData()).toBe(before);
      await button(w, '英文论证').trigger('tap');
      expect(button(w, '开始带练')).toBeTruthy();
      expect(s.exportData()).toBe(before);
      await button(w, '英文讨论').trigger('tap');
      await w.setProps({ stopped: true });
      expect(w.find('textarea').attributes('disabled')).toBeDefined();
      expect(button(w, '检查这一段').attributes('disabled')).toBeDefined();
    } finally {
      w.unmount();
    }
  });
});
