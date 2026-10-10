import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
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
  EMAIL_WRITING_CONTRACT,
  EMAIL_WRITING_TASKS,
  EMAIL_WRITING_BASIS,
  publicWritingReference,
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
function start() {
  const s = useConversationLearningStore();
  s.start('英文邮件写作');
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

describe('许可公共书信只作当前邮件写法参考', () => {
  const referenceId = 'mcmurrey-inquiry-letter-body-en-v1';
  it('保存完整正文范围、许可、改动与非判分权威', () => {
    const source = publicWritingReference(referenceId, 1);
    expect(createHash('sha256').update(source.excerpt).digest('hex')).toBe(
      '5ba95b8e183c4403b8ebbc0f2dc6bdc1519e3733bc8a9cdd4f6592b4f0e8f7e6'
    );
    expect(source).toMatchObject({
      genreId: 'email',
      license: 'CC BY 4.0',
      coverage: 'full_body',
      scoringAuthority: false
    });
    expect(source.excerpt).toContain('Dear Technical Support Department:');
    expect(source.excerpt).toContain('I appreciate any assistance that you are able to provide me.');
    expect(source.excerpt).toContain('Sincerely,');
    expect(source.excerpt).not.toMatch(/garyc@|\(512\)|4201 Research|0000 Paul/);
  });
  it('明确阅读只写当前邮件的帮助，重复读不新增且原题量表与教法保持', () => {
    const s = start();
    s.commit('strategy.set', {
      conversationId: s.active.id,
      method: 'steps',
      source: 'self_report',
      reason: '指定逐步'
    });
    const question = JSON.parse(JSON.stringify(s.activeQuestion));
    const beforeStrategy = conversationStrategy(s.state, s.active.id);
    const result = s.readWritingReference(s.writingContext(), referenceId, 1);
    expect(result.hintId).toBeTruthy();
    expect(s.active.pendingHints).toHaveLength(1);
    expect(s.activeQuestion).toEqual(question);
    expect(s.state.attempts).toHaveLength(0);
    expect(conversationStrategy(s.state, s.active.id)).toEqual(beforeStrategy);
    expect(s.readWritingReference(s.writingContext(), referenceId, 1).hintId).toBe(result.hintId);
    expect(s.active.pendingHints).toHaveLength(1);
  });
  it('当前邮件有明确读信入口；读前原稿保持且不提前写帮助', async () => {
    const s = start();
    const w = mount(LearningLab, {
      props: props(s, { visible: true, readWritingReference: s.readWritingReference }),
      global: { stubs }
    });
    await button(w, '互动学习').trigger('tap');
    await w.find('textarea').setValue('My  original draft.');
    expect(button(w, '读信件正文')).toBeDefined();
    expect(w.find('.public-writing-reference').exists()).toBe(false);
    expect(s.active.pendingHints).toHaveLength(0);
    await button(w, '读信件正文').trigger('tap');
    expect(w.find('.public-writing-reference').text()).toContain('CC BY 4.0');
    expect(w.find('textarea').element.value).toBe('My  original draft.');
    expect(s.active.pendingHints).toHaveLength(1);
    w.unmount();
  });

  it('返回副本不能改写正文或批注，独立邮件仍是原创待核对', () => {
    const source = publicWritingReference(referenceId, 1);
    source.excerpt = '官方满分';
    source.notes[0].text = '可靠判分';
    const original = publicWritingReference(referenceId, 1);
    expect(original.excerpt).not.toBe(source.excerpt);
    expect(original.notes[0].text).not.toBe(source.notes[0].text);
    const s = start();
    s.readWritingReference(s.writingContext(), referenceId, 1);
    s.submit('I am writing to ask about the library book.', true, 'public-email-independent');
    expect(s.state.attempts[0]).toMatchObject({ grade: { status: 'pending', outcome: null } });
    expect(s.state.attempts[0].hints).toHaveLength(1);
    expect(s.activeQuestion.source).toEqual({ kind: 'project_original', reference: EMAIL_WRITING_CONTRACT });
  });

  it.each(['英文通知写作', '英文说明写作', '中文叙事写作', '英文学术讨论'])('不把书信参考借给%s', (goal) => {
    const s = useConversationLearningStore();
    s.start(goal);
    const before = s.exportData();
    expect(() => s.readWritingReference(s.writingContext(), referenceId, 1)).toThrow('英文邮件');
    expect(s.exportData()).toBe(before);
  });

  it('拒绝停止、旧上下文和另一账户迟到阅读；原资料保持', () => {
    const s = start(),
      context = s.writingContext();
    s.commit('task.stop', { conversationId: s.active.id });
    const stopped = s.exportData();
    expect(() => s.readWritingReference(context, referenceId, 1)).toThrow();
    expect(s.exportData()).toBe(stopped);
    s.start('英文说明写作');
    expect(() => s.readWritingReference(context, referenceId, 1)).toThrow();
    const current = s.writingContext();
    uni.setStorageSync('EXAM_USER_ID', 'other-email-owner');
    expect(() => s.readWritingReference(current, referenceId, 1)).toThrow();
  });

  it.each([
    { referenceVersion: 2 },
    { referenceId: 'https://127.0.0.1/private' },
    { content: '官方高分范文' },
    { reference: { license: 'all rights reserved' } },
    { level: 3 },
    { questionKey: 'other@1' }
  ])('拒绝版本/正文/许可/题目注入且零写：%j', (extra) => {
    const s = start(),
      before = s.exportData();
    expect(() =>
      applyLearningOperation(s.state, {
        id: 'public-email-injection',
        type: 'hint.add',
        data: {
          conversationId: s.active.id,
          questionKey: questionKey(s.activeQuestion),
          referenceId,
          referenceVersion: 1,
          ...extra
        }
      })
    ).toThrow();
    expect(s.exportData()).toBe(before);
  });
});
function feedback(s, id, quote) {
  return {
    conversationId: s.active.id,
    attemptId: id,
    rubricId: s.activeQuestion.rubric.id,
    rubricContract: 'subjective-rubric-v2',
    outcome: 'uncertain',
    model: 'synthetic-no-provider',
    feedback: '合成引用核验，不判断邮件语义。',
    dimensions: s.activeQuestion.rubric.criteria.map((c) => ({
      criterionId: c.id,
      score: null,
      feedback: '表达待核对。',
      evidence: [{ quote, start: 0, end: quote.length }]
    }))
  };
}
describe('原创邮件与当前任务出处', () => {
  it('共享明确入口建题，方向不猜测，不复制官方示例或赋予官方分数', () => {
    const s = useConversationLearningStore(),
      before = s.exportData();
    expect(LEARNING_START_TOPICS).toContain('英文邮件写作');
    expect(s.exportData()).toBe(before);
    s.start('英文邮件写作');
    expect(s.activeQuestion).toMatchObject({
      source: { kind: 'project_original', reference: EMAIL_WRITING_CONTRACT },
      validation: null,
      writingExercise: { genreId: 'email' }
    });
    expect(s.active.task).toBeUndefined();
    expect(s.state.attempts).toEqual([]);
    expect(EMAIL_WRITING_BASIS).toMatchObject({
      recommendedMinutes: 7,
      minimumWords: null,
      sampleNumericScore: null,
      scoringAuthority: false
    });
    expect(new URL(EMAIL_WRITING_BASIS.sampleUrl).hostname).toBe('www.ets.org');
    expect(new URL(EMAIL_WRITING_BASIS.sampleUrl).hash).toBe('#page=15');
    expect(JSON.stringify(s.activeQuestion)).not.toMatch(/sunshinepoetry|officialScore|bandScore|referenceText|@/);
  });
  for (const task of EMAIL_WRITING_TASKS)
    it(`${task.id}收件对象、原情境与三项要求绑定当前四步`, () => {
      const q = createWritingQuestion('q', 'c', 'email', task.id),
        steps = writingStepsForQuestion(q);
      expect(q.prompt).toContain(task.recipient);
      expect(q.prompt).toContain(task.situation);
      for (const target of task.targets) expect(q.prompt).toContain(target);
      expect(steps.map((s) => s.id)).toEqual(['purpose', 'detail', 'action', 'closing']);
      expect(steps[0].prompt).toContain(task.recipient);
      expect(steps[0].prompt).toContain(task.situation);
      expect(steps[1].prompt).toContain(task.targets[0]);
      for (const target of task.targets.slice(1)) expect(steps[2].prompt).toContain(target);
      expect(q.rubric.criteria.map((c) => c.id)).toEqual(['purpose', 'detail', 'reader', 'language']);
      expect(q.rubric.criteria.every((c) => c.maxScore === 5)).toBe(true);
    });
  for (const [name, change] of [
    [
      '收件对象/正文',
      (q) => {
        q.prompt += ' Send the email now.';
      }
    ],
    [
      '外发收件地址字段',
      (q) => {
        q.writingExercise.address = 'person@example.invalid';
      }
    ],
    [
      '官方分数',
      (q) => {
        q.rubric.criteria[0].maxScore = 6;
      }
    ],
    [
      '讨论合同',
      (q) => {
        q.writingExercise.contract = 'english-discussion-v1';
      }
    ],
    [
      '其他体裁',
      (q) => {
        q.writingExercise.genreId = 'notice';
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
        q.validation = { kind: 'exact', answer: 'Dear' };
      }
    ],
    [
      '剥除合同仍冒充原创邮件',
      (q) => {
        delete q.writingExercise;
        delete q.rubric;
      }
    ]
  ])
    it(`${name}篡改原子拒绝`, () => {
      const s = useConversationLearningStore();
      s.start('练习');
      const q = createWritingQuestion('injection', s.active.id, 'email');
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
  for (const [step, raw] of [
    ['purpose', 'Dear Library Team,\n'],
    ['closing', 'Best regards,\nAlex'],
    ['closing', 'Thanks,\nAlex']
  ])
    it(`${step}邮件称呼/署名不被句末句号规则误拒绝`, () => {
      const q = createWritingQuestion('q', 'c', 'email');
      expect(guidedSentenceFeedback('email', step, raw, q)).toMatchObject({
        ready: true,
        kind: 'draft',
        message: '草稿 · 表达待核对'
      });
      expect(guidedSentenceFeedback('email', step, '纯中文', q)).toMatchObject({ ready: false, kind: 'language' });
    });
  it('草稿不要求关键词或猜语义，普通文本/容量保护与其他体裁格式保持', () => {
    const q = createWritingQuestion('q', 'c', 'email');
    expect(guidedSentenceFeedback('email', 'action', 'A different solution might be possible', q)).toMatchObject({
      ready: true,
      kind: 'draft'
    });
    expect(guidedSentenceFeedback('email', 'action', '<script>', q)).toMatchObject({ ready: false, kind: 'format' });
    expect(() => guidedSentenceFeedback('email', 'action', 'A'.repeat(2001), q)).toThrow();
    expect(
      guidedSentenceFeedback(
        'discussion',
        'support',
        'No final punctuation',
        createWritingQuestion('d', 'c', 'discussion')
      ).kind
    ).toBe('punctuation');
    expect(writingAnswerLimit(q)).toBe(4000);
    expect(writingAnswerLimit(createWritingQuestion('n', 'c', 'notice'))).toBe(1000);
  });
  it('4000字符原文含首尾/双空格/换行保持，超界拒绝，重放无评分权限', () => {
    const s = start(),
      prefix = '  Dear Team,\n\nMy  request is ',
      suffix = '\nAlex\n ',
      raw = prefix + 'a'.repeat(4000 - prefix.length - suffix.length) + suffix;
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
      source: { kind: 'project_original', reference: EMAIL_WRITING_CONTRACT }
    });
    expect(s.state.reviews).toEqual([]);
    expect(s.summary.knowledge).toEqual({});
  });
  it('明确原答与帮助后独立换题，旧停止及指定教法保持', () => {
    const s = useConversationLearningStore();
    s.start('12 + 8');
    const old = s.active.id;
    s.commit('task.stop', { conversationId: old });
    const strategy = conversationStrategy(s.state, old);
    s.start('英文邮件写作');
    s.commit('strategy.set', {
      conversationId: s.active.id,
      method: 'explain',
      source: 'self_report',
      reason: '用户指定'
    });
    const original = questionKey(s.activeQuestion);
    s.recordWritingHelp(s.writingContext(), 'Could you please …?', 'email');
    expect(s.submit('Dear Team,', false).clarification).toBe(true);
    expect(s.state.attempts).toEqual([]);
    s.startWriting(s.writingContext(), 'email');
    expect(s.activeQuestion.writingExercise.taskId).toBe('club-room');
    expect(s.active.pendingHints).toEqual([]);
    expect(s.active.helpQueues.find((q) => q.questionKey === original).hints).toHaveLength(1);
    expect(s.activeStrategy.method).toBe('explain');
    expect(conversationStrategy(s.state, old)).toEqual(strategy);
  });
  it('四情境穷尽不复用帮助题、不添事实', () => {
    const s = start();
    for (let i = 1; i < 4; i++) {
      s.submit('My own email.', true);
      s.startWriting(s.writingContext(), 'email');
    }
    s.submit('My last email.', true);
    const before = s.exportData();
    expect(() => s.startWriting(s.writingContext(), 'email')).toThrow('已写完');
    expect(s.exportData()).toBe(before);
  });
  it('明日新邮件按原时区安排一次、提前拒绝，到期仍pending而不推进FSRS', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T08:30:00Z'));
    const s = start();
    s.submit('My original email.', true);
    const original = questionKey(s.activeQuestion),
      next = s.scheduleWritingRetest();
    expect(s.scheduleWritingRetest()).toEqual(next);
    expect(next.day).toBe('2026-11-02');
    s.focus(next.questionKey);
    expect(s.activeQuestion).toMatchObject({
      parentQuestionKey: original,
      writingExercise: {
        genreId: 'email',
        taskId: 'club-room',
        plannedTimezone: 'America/Los_Angeles',
        dueDay: next.day
      }
    });
    const before = s.exportData();
    expect(() => s.submit('Early email.', true)).toThrow('复测日期');
    expect(s.exportData()).toBe(before);
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'));
    s.submit('My independent retest email.', true);
    expect(s.state.attempts.at(-1).grade.status).toBe('pending');
    expect(s.state.reviews).toEqual([]);
  });
  it('停止和迟到上下文拒绝帮助/新原答，不从导航隐式恢复', () => {
    const s = start(),
      context = s.writingContext();
    s.commit('task.stop', { conversationId: s.active.id });
    const before = s.exportData();
    expect(() => s.recordWritingHelp(context, 'A hint.', 'email')).toThrow();
    expect(() => s.startWriting(context, 'email')).toThrow();
    expect(() => s.submit('Late.', true)).toThrow();
    expect(s.exportData()).toBe(before);
  });
  it('仅接最新未校对原答的新反馈，合法旧编号幂等，原成绩不覆盖', () => {
    const s = start(),
      first = s.submit('My own email.', true),
      data = feedback(s, first.id, 'My own email.');
    s.commit('assessment.assist', data, 'email-feedback');
    s.submit('My new email.', true);
    const before = s.exportData();
    expect(() => s.commit('assessment.assist', data, 'email-late-feedback')).toThrow('原答');
    expect(s.exportData()).toBe(before);
    s.commit('assessment.assist', data, 'email-feedback');
    expect(s.exportData()).toBe(before);
    expect(s.state.attempts[0].grade.status).toBe('pending');
    expect(s.state.reviews).toEqual([]);
  });
  it('未连接与校对后拒绝新请求/反馈，保留原文', async () => {
    const s = start(),
      a = s.submit('My own email.', true),
      q = s.activeQuestion,
      offline = s.exportData();
    await expect(s.requestWritingFeedback()).rejects.toThrow();
    expect(s.exportData()).toBe(offline);
    s.commit('assessment.correct', { attemptId: a.id, outcome: null, reason: '用户校对' });
    s.commit(
      'message.add',
      { conversationId: s.active.id, role: 'user', content: '合成反馈请求，不调用供应商' },
      'email-user-message'
    );
    const before = s.exportData();
    expect(() => s.commit('assessment.assist', feedback(s, a.id, 'My own email.'), 'email-corrected-feedback')).toThrow(
      '校对'
    );
    expect(() =>
      s.commit('model.request', {
        conversationId: s.active.id,
        messageId: 'email-user-message',
        questionKey: questionKey(q),
        modelId: 'synthetic_model',
        model: 'synthetic-no-provider',
        requestId: 'email-corrected-request',
        binding: 'email_test_binding_12345',
        feedbackAttemptId: a.id
      })
    ).toThrow('反馈请求');
    await expect(s.requestWritingFeedback()).rejects.toThrow('校对');
    expect(s.exportData()).toBe(before);
  });
});
describe('当前邮件四步带练', () => {
  it('默认当前情境和出处，称呼与结尾可检查；草稿只记帮助，换体裁只改草稿', async () => {
    const s = start(),
      before = s.exportData(),
      w = mount(LearningLab, { props: props(s), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      expect(button(w, '逐句带练').attributes('aria-pressed')).toBe('true');
      expect(w.text()).toContain(EMAIL_WRITING_TASKS[0].recipient);
      expect(w.find('textarea').attributes('maxlength')).toBe('2000');
      expect(w.findAll('a').some((a) => a.attributes('href') === EMAIL_WRITING_BASIS.sampleUrl)).toBe(true);
      expect(s.exportData()).toBe(before);
      await w.find('textarea').setValue('Dear Library Team,\n');
      await button(w, '检查这一段').trigger('tap');
      expect(button(w, '继续下一段')).toBeTruthy();
      expect(s.state.attempts).toEqual([]);
      expect(s.active.pendingHints).toHaveLength(1);
      await button(w, '继续下一段').trigger('tap');
      expect(w.text()).toContain(EMAIL_WRITING_TASKS[0].targets[0]);
      const saved = s.exportData();
      await button(w, '英文讨论').trigger('tap');
      expect(button(w, '开始带练')).toBeTruthy();
      expect(s.exportData()).toBe(saved);
    } finally {
      w.unmount();
    }
  });
  it('保存失败不暴露支架或检查成功，停止后输入/检查禁用', async () => {
    const s = start(),
      w = mount(LearningLab, { props: props(s, { recordWritingHelp: () => false }), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      await button(w, '需要表达提示').trigger('tap');
      expect(button(w, '需要表达提示')).toBeTruthy();
      await w.find('textarea').setValue('Dear Team,');
      await button(w, '检查这一段').trigger('tap');
      expect(button(w, '继续下一段')).toBeUndefined();
      await w.setProps({ stopped: true });
      expect(w.find('textarea').attributes('disabled')).toBeDefined();
      expect(button(w, '检查这一段').attributes('disabled')).toBeDefined();
      expect(s.state.attempts).toEqual([]);
    } finally {
      w.unmount();
    }
  });
});
