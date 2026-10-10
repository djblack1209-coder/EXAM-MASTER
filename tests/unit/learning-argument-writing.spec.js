import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  normalizePrivateSyncOperation,
  emptyLearningState,
  questionKey,
  LEARNING_START_TOPICS
} from '@/services/learning/learning-domain.js';
import {
  ARGUMENT_WRITING_CONTRACT,
  ARGUMENT_WRITING_TASKS,
  ARGUMENT_WRITING_BASIS,
  CHINESE_MATERIAL_ARGUMENT_CONTRACT,
  CHINESE_MATERIAL_ARGUMENT_TASKS,
  createWritingQuestion,
  writingStepsForQuestion,
  writingDraftLimit,
  writingAnswerLimit,
  guidedSentenceFeedback,
  writingGenre
} from '../../laf-backend/functions/_shared/learning-writing.js';
import LearningLab from '@/components/business/learning/learning-lab.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const button = (w, label) => w.findAll('button').find((b) => b.text() === label);
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
describe('中文材料论证入口的最小行为', () => {
  it('共用主题明确开始中文材料论证，保留未指定方向', () => {
    const s = useConversationLearningStore();
    expect(LEARNING_START_TOPICS).toContain('中文材料论证');
    s.start('中文材料论证');
    expect(writingGenre(s.activeQuestion)).toBe('material_argument');
    expect(s.active.task).toBeUndefined();
    expect(s.state.attempts).toEqual([]);
  });
  it('创建完整原创中文材料和范围限制，不获得可靠语义判分', () => {
    const q = createWritingQuestion('q', 'c', 'material_argument');
    expect(q.subject).toBe('语文');
    expect(q.prompt).toContain('【材料1】');
    expect(q.prompt).toContain('【材料2】');
    expect(q.prompt).toContain('【材料3】');
    expect(q.prompt).toContain('合成观察');
    expect(q.validation).toBeNull();
    expect(q.source.kind).toBe('project_original');
  });
  it('中文论证段落允许2000字符，旧中文叙事240保持', () => {
    expect(writingDraftLimit('material_argument')).toBe(2000);
    expect(writingDraftLimit('narrative')).toBe(240);
  });
  it('现有带练体裁中可选中文材料论证，选择只改草稿', async () => {
    const s = start();
    const before = s.exportData();
    const w = mount(LearningLab, { props: props(s), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      await button(w, '逐句带练').trigger('tap');
      expect(button(w, '中文材料论证')).toBeDefined();
      await button(w, '中文材料论证').trigger('tap');
      expect(s.exportData()).toBe(before);
      expect(button(w, '开始带练')).toBeDefined();
    } finally {
      w.unmount();
    }
  });
});
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
  s.start('英文论证写作');
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
function startChinese() {
  const s = useConversationLearningStore();
  s.start('中文材料论证');
  return s;
}
describe('原创中文材料论证与原答边界', () => {
  for (const task of CHINESE_MATERIAL_ARGUMENT_TASKS)
    it(`${task.id}完整保留三份材料，当前段落提示关联本题`, () => {
      const q = createWritingQuestion('q', 'c', 'material_argument', task.id);
      expect(q.source.reference).toBe(CHINESE_MATERIAL_ARGUMENT_CONTRACT);
      expect(q.prompt).toContain(task.focus);
      for (const material of task.materials) expect(q.prompt).toContain(material);
      expect(task.materials).toHaveLength(3);
      expect(Object.isFrozen(task.materials)).toBe(true);
      expect(q.rubric.criteria.map((c) => c.id)).toEqual(['position', 'evidence', 'balance', 'organisation']);
      expect(q.rubric.source).toEqual(q.source);
      expect(JSON.stringify(q)).not.toMatch(/official_score|expectedAnswer|bandScore/);
      const steps = writingStepsForQuestion(q);
      expect(steps.map((step) => step.id)).toEqual(['position', 'evidence', 'balance', 'conclusion']);
      expect(steps.every((step) => step.prompt.includes(task.topic))).toBe(true);
    });
  for (const [name, change] of [
    ['材料中的观察数量', (q) => (q.prompt = q.prompt.replace('32名', '99名'))],
    ['删除范围限制', (q) => (q.prompt = q.prompt.replace('只覆盖一个午休', '覆盖全年'))],
    ['移走合成标记', (q) => (q.prompt = q.prompt.replace('合成观察，不是真实统计', '官方真实统计'))],
    ['另一任务标识', (q) => (q.writingExercise.taskId = 'community-garden')],
    ['叙事体裁', (q) => (q.writingExercise.genreId = 'narrative')],
    ['降级合同', (q) => (q.writingExercise.contract = 'guided-writing-v1')],
    ['伪造来源', (q) => (q.source = { kind: 'publisher_reference', reference: 'official-score' })],
    ['客观规则', (q) => (q.validation = { type: 'choice', answer: 'A', authority: 'executable' })],
    ['暗示标准答案', (q) => (q.expectedAnswer = '必须取消讨论区')],
    ['额外材料合同字段', (q) => (q.writingExercise.materialText = '新的未绑定材料')],
    ['换对话', (q) => (q.writingExercise.conversationId = 'foreign')],
    [
      '剥除写作合同与量表但保留原创来源',
      (q) => {
        delete q.writingExercise;
        delete q.rubric;
      }
    ]
  ])
    it(`${name}在新增和私人重放均原子拒绝`, () => {
      const s = useConversationLearningStore();
      s.start('练习');
      const q = createWritingQuestion('inject-q', s.active.id, 'material_argument');
      change(q);
      const operation = { id: 'inject', type: 'question.add', data: { conversationId: s.active.id, question: q } };
      const before = s.exportData();
      expect(() => applyLearningOperation(s.state, operation)).toThrow();
      expect(() => applyLearningOperation(s.state, normalizePrivateSyncOperation(operation))).toThrow();
      expect(s.exportData()).toBe(before);
    });
  it('没有指定学段时不推断；明确方向与教法保留', () => {
    const s = useConversationLearningStore();
    s.start('中文材料论证', { track: 'senior', stage: '高二', edition: '用户指定' });
    s.commit('strategy.set', {
      conversationId: s.active.id,
      method: 'explain',
      source: 'self_report',
      reason: '用户指定'
    });
    const oldKey = questionKey(s.activeQuestion);
    s.recordWritingHelp(s.writingContext(), '引用材料编号并说明范围。', 'material_argument');
    s.startWriting(s.writingContext(), 'material_argument');
    expect(s.active.task).toMatchObject({ track: 'senior', stage: '高二', edition: '用户指定' });
    expect(s.activeStrategy.method).toBe('explain');
    expect(s.active.pendingHints).toEqual([]);
    expect(s.activeQuestion.writingExercise.taskId).toBe('community-garden');
    expect(s.active.helpQueues.find((entry) => entry.questionKey === oldKey).hints).toHaveLength(1);
    expect(s.state.attempts).toEqual([]);
  });
  it('正式原答超过旧1000边界仍逐字保存并保持pending，不由字数/材料编号补分', () => {
    const s = startChinese();
    const raw = '  材料2记录一个午休的情况，  它不能代表所有同学的长期需要。\n\n'.repeat(40) + '\n ';
    expect(raw.length).toBeGreaterThan(1000);
    expect(writingAnswerLimit(s.activeQuestion)).toBe(8000);
    expect(s.submit(raw, false).clarification).toBe(true);
    expect(s.state.attempts).toEqual([]);
    const a = s.submit(raw, true, 'zh-original');
    expect(s.state.attempts[0]).toMatchObject({ id: a.id, answer: raw, grade: { status: 'pending' } });
    expect(s.summary.knowledge).toEqual({});
    expect(s.state.reviews).toEqual([]);
    const saved = s.exportData();
    learningRepository.restoreData(saved, s.state.revision);
    s.refresh();
    expect(s.exportData()).toBe(saved);
    let replayed = emptyLearningState(s.state.owner, s.state.timezone);
    for (const operation of s.state.events)
      replayed = applyLearningOperation(replayed, normalizePrivateSyncOperation(operation)).state;
    expect(replayed.questions).toEqual(s.state.questions);
    expect(replayed.attempts).toEqual(s.state.attempts);
  });
  it('8000字符精确原答边界，超界零事实；旧叙事1000边界仍拒绝', () => {
    const s = startChinese();
    s.submit('中'.repeat(7999) + '。', true);
    const saved = s.exportData();
    expect(() => s.submit('中'.repeat(8000) + '。', true)).toThrow('8000');
    expect(s.exportData()).toBe(saved);
    expect(writingAnswerLimit(createWritingQuestion('q', 'c', 'narrative'))).toBe(1000);
  });
  it('四组材料耗尽后拒绝复用，不把同一原答循环包装成新材料', () => {
    const s = startChinese();
    for (let i = 1; i < 4; i++) {
      s.submit('我的判断仍待核对。', true);
      s.startWriting(s.writingContext(), 'material_argument');
    }
    s.submit('最后一份原答仍待核对。', true);
    const saved = s.exportData();
    expect(() => s.startWriting(s.writingContext(), 'material_argument')).toThrow('已写完');
    expect(s.exportData()).toBe(saved);
    expect(new Set(s.state.questions.map((q) => q.writingExercise.taskId)).size).toBe(4);
  });
  it('明日任务换完整材料，按安排时原时区开答，重复安排不写新事实', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T06:40:00Z'));
    const s = startChinese();
    s.commit('timezone.set', { timezone: 'America/Los_Angeles' });
    const original = questionKey(s.activeQuestion);
    s.submit('我主张保留讨论区，同时调整两区距离。', true);
    const result = s.scheduleWritingRetest();
    const target = s.state.questions.find((q) => questionKey(q) === result.questionKey);
    expect(target).toMatchObject({
      parentQuestionKey: original,
      writingExercise: {
        taskId: 'community-garden',
        phase: 'retest',
        plannedDay: '2026-10-07',
        dueDay: '2026-10-08',
        plannedTimezone: 'America/Los_Angeles'
      }
    });
    expect(target.prompt).toContain(CHINESE_MATERIAL_ARGUMENT_TASKS[1].materials[2]);
    const saved = s.exportData();
    expect(s.scheduleWritingRetest()).toEqual(result);
    expect(s.exportData()).toBe(saved);
    s.focus(result.questionKey);
    s.commit('timezone.set', { timezone: 'Asia/Tokyo' });
    expect(s.writingCanSubmit()).toBe(false);
    const early = s.exportData();
    expect(() => s.submit('提前的原答。', true)).toThrow('复测日期');
    expect(s.exportData()).toBe(early);
    vi.setSystemTime(new Date('2026-10-08T07:00:00Z'));
    s.refresh();
    expect(s.writingCanSubmit()).toBe(true);
    s.submit('到期的判断仍待核对。', true);
    expect(s.state.attempts.at(-1)).toMatchObject({ kind: 'review', grade: { status: 'pending' } });
    expect(s.state.reviews).toEqual([]);
  });
  it('中文材料复测省略客户端类型仍按宿主阶段记review', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    const s = startChinese();
    s.submit('我的原答。', true);
    const result = s.scheduleWritingRetest();
    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
    s.commit('question.focus', { conversationId: s.active.id, questionKey: result.questionKey });
    s.submit('到期后的新材料原答。', true);
    expect(s.state.attempts.at(-1)).toMatchObject({ kind: 'review', grade: { status: 'pending' } });
    expect(s.state.reviews).toEqual([]);
  });
  it('中文材料复测不能通过客户端first字段增加首次原答', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    const s = startChinese();
    s.submit('我的原答。', true);
    const result = s.scheduleWritingRetest();
    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
    s.focus(result.questionKey);
    const saved = s.exportData();
    expect(() => s.submit('伪造首次原答。', true, 'fake-first', { kind: 'first' })).toThrow('复测');
    expect(s.exportData()).toBe(saved);
  });
  it('计划写失败重试复用已保存材料题，保留原答和旧任务', () => {
    const s = startChinese();
    s.submit('我的原答。', true);
    const commit = learningRepository.commit.bind(learningRepository);
    let fail = true;
    vi.spyOn(learningRepository, 'commit').mockImplementation((op) => {
      if (fail && op.type === 'plan.set') {
        fail = false;
        throw new Error('合成计划保存失败');
      }
      return commit(op);
    });
    expect(() => s.scheduleWritingRetest()).toThrow('合成计划保存失败');
    const retest = s.state.questions.find((q) => q.writingExercise?.phase === 'retest');
    expect(retest).toBeDefined();
    const questions = s.state.questions.length;
    expect(s.scheduleWritingRetest().questionKey).toBe(questionKey(retest));
    expect(s.state.questions).toHaveLength(questions);
    expect(s.state.attempts).toHaveLength(1);
  });
  it('明日100项上限拒绝安排且不遗留新材料题', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    const s = startChinese();
    s.commit('timezone.set', { timezone: 'America/Los_Angeles' });
    s.submit('我的原答。', true);
    s.commit('plan.set', {
      day: '2026-10-09',
      reason: '合成满计划',
      tasks: Array.from({ length: 100 }, (_, i) => ({
        id: `full-${i}`,
        title: '原任务',
        questionKey: questionKey(s.activeQuestion),
        condition: 'submitted'
      }))
    });
    const saved = s.exportData();
    expect(() => s.scheduleWritingRetest()).toThrow('已满');
    expect(s.exportData()).toBe(saved);
  });
  it('独立新材料切换后旧上下文不能检查、安排或添原答', () => {
    const s = startChinese();
    const context = s.writingContext();
    s.submit('我的第一份原答。', true);
    s.startWriting(context, 'material_argument');
    const saved = s.exportData();
    expect(() => s.recordWritingHelp(context, '迟到提示。', 'material_argument')).toThrow('切换');
    expect(() => s.startWriting(context, 'material_argument')).toThrow('切换');
    expect(s.exportData()).toBe(saved);
  });
  it('停止后原答、提示、独立题和明日安排均拒绝，明确恢复才重新开放', () => {
    const s = startChinese();
    s.submit('我的判断仍待核对。', true);
    const context = s.writingContext();
    s.commit('task.stop', { conversationId: s.active.id });
    const saved = s.exportData();
    expect(() => s.recordWritingHelp(context, '新的提示。', 'material_argument')).toThrow('停止');
    expect(() => s.startWriting(context, 'material_argument')).toThrow('停止');
    expect(() => s.scheduleWritingRetest()).toThrow('停止');
    expect(() => s.submit('迟到原答。', true)).toThrow('停止');
    expect(s.exportData()).toBe(saved);
    expect(() => s.commit('task.resume', { conversationId: s.active.id })).toThrow('明确要求');
    expect(s.exportData()).toBe(saved);
    s.commit('task.resume', { conversationId: s.active.id, source: 'self_report' });
    expect(s.active.stopped).toBe(false);
    expect(s.state.attempts).toHaveLength(1);
  });
  it('辅助引用只绑定最新未校对原答，重放幂等，仍不升级可靠等级', () => {
    const s = startChinese();
    const a = s.submit('材料2只记录一个午休。\n这不能代表长期需要。', true);
    const q = s.activeQuestion;
    const data = {
      conversationId: s.active.id,
      attemptId: a.id,
      rubricId: q.rubric.id,
      rubricContract: 'subjective-rubric-v2',
      outcome: 'uncertain',
      model: 'synthetic-no-provider',
      feedback: '合成引用定位，语义待核对。',
      dimensions: q.rubric.criteria.map((c) => ({
        criterionId: c.id,
        score: null,
        feedback: '待核对。',
        evidence: [{ quote: '材料2只记录一个午休。', start: 0, end: 11 }]
      }))
    };
    s.commit('assessment.assist', data, 'zh-feedback');
    expect(s.state.attempts[0].grade.status).toBe('pending');
    expect(s.state.reviews).toEqual([]);
    s.submit('我的新的原答。', true);
    const saved = s.exportData();
    expect(() => s.commit('assessment.assist', data, 'zh-late-feedback')).toThrow('原答');
    s.commit('assessment.assist', data, 'zh-feedback');
    expect(s.exportData()).toBe(saved);
  });
  it('原答校对后拒绝请求新模型反馈，既有原答仍保留', async () => {
    const s = startChinese();
    const a = s.submit('材料中的观察范围有限。', true);
    s.commit('assessment.correct', { attemptId: a.id, outcome: null, reason: '用户校对' });
    const saved = s.exportData();
    await expect(s.requestWritingFeedback()).rejects.toThrow('校对');
    expect(s.exportData()).toBe(saved);
    expect(s.state.executions).toEqual([]);
  });
  it('段落格式提示不检查立场和材料编号，不把格式通过叫论证正确', () => {
    const q = createWritingQuestion('q', 'c', 'material_argument');
    const raw = '这是一段完全没有材料编号的中文草稿。\n不同立场仍需进一步判断。';
    expect(guidedSentenceFeedback('material_argument', 'evidence', raw, q)).toEqual({
      ready: true,
      message: '草稿 · 表达待核对',
      kind: 'draft'
    });
    expect(guidedSentenceFeedback('material_argument', 'position', '', q)).toMatchObject({
      ready: false,
      kind: 'empty'
    });
    expect(guidedSentenceFeedback('material_argument', 'position', 'Only English.', q)).toMatchObject({
      ready: false,
      kind: 'language'
    });
    expect(guidedSentenceFeedback('material_argument', 'position', '<b>中文。</b>', q)).toMatchObject({
      ready: false,
      kind: 'format'
    });
    expect(guidedSentenceFeedback('material_argument', 'position', '中文草稿没有句末标点', q)).toMatchObject({
      ready: false,
      kind: 'punctuation'
    });
    expect(guidedSentenceFeedback('material_argument', 'position', '中'.repeat(1999) + '。', q)).toMatchObject({
      ready: true,
      kind: 'draft'
    });
    expect(() => guidedSentenceFeedback('material_argument', 'position', '中'.repeat(2000) + '。', q)).toThrow(
      '输入长度'
    );
    expect(() => guidedSentenceFeedback('narrative', 'position', '中文。', q)).toThrow('体裁');
  });
  it('中文段落控件沿现有体系，检查只存帮助，草稿和独立入口不添原答', async () => {
    const s = startChinese();
    const w = mount(LearningLab, { props: props(s), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      expect(w.find('textarea').attributes('aria-label')).toBe('第1段中文草稿');
      expect(w.find('textarea').attributes('placeholder')).toBe('写一段中文');
      expect(w.find('textarea').attributes('maxlength')).toBe('2000');
      expect(w.findAll('a')).toHaveLength(0);
      expect(w.text()).not.toContain('官方评分');
      const paragraphs = [
        '我建议保留讨论区。  两区应留出距离。\n这一方案仍需试行。',
        '材料2的记录只涉及一个午休，因此不能代表长期需要。',
        '安静阅读的需求也值得照顾，可以调整两区距离。',
        '因此先试行十天，记录两区使用情况后再决定。'
      ];
      for (let i = 0; i < paragraphs.length; i++) {
        const before = s.exportData();
        await w.find('textarea').setValue(paragraphs[i]);
        expect(s.exportData()).toBe(before);
        await button(w, '检查这一段').trigger('tap');
        expect(w.text()).toContain('表达待核对');
        expect(w.find('textarea').element.value).toBe(paragraphs[i]);
        expect(s.state.attempts).toEqual([]);
        await button(w, i === 3 ? '拼成我的草稿' : '继续下一段').trigger('tap');
      }
      expect(w.text()).toContain(paragraphs[0]);
      expect(s.active.pendingHints.length).toBeGreaterThan(0);
      await button(w, '独立写作').trigger('tap');
      expect(w.emitted('writing')).toEqual([[s.writingContext(), 'material_argument']]);
      expect(s.state.attempts).toEqual([]);
      expect(s.state.reviews).toEqual([]);
    } finally {
      w.unmount();
    }
  });
  it('停止与忙碌禁用体裁、检查和独立入口，伪触发不能写事实', async () => {
    const s = startChinese();
    const w = mount(LearningLab, { props: props(s), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      await w.find('textarea').setValue('我的中文草稿。');
      for (const state of [
        { stopped: true, busy: false },
        { stopped: false, busy: true }
      ]) {
        await w.setProps(state);
        const before = s.exportData();
        expect(button(w, '中文叙事').attributes('disabled')).toBeDefined();
        expect(button(w, '检查这一段').attributes('disabled')).toBeDefined();
        await button(w, '中文叙事').trigger('tap');
        await button(w, '检查这一段').trigger('tap');
        expect(s.exportData()).toBe(before);
        expect(w.find('textarea').attributes('aria-label')).toBe('第1段中文草稿');
      }
    } finally {
      w.unmount();
    }
  });
});
describe('原创英文论证与官方维度出处', () => {
  it('共用选择可达，明确开始才写任务，学习方向保留未指定', () => {
    const s = useConversationLearningStore();
    const before = s.exportData();
    expect(LEARNING_START_TOPICS).toContain('英文论证写作');
    expect(s.exportData()).toBe(before);
    s.start('英文论证写作');
    expect(writingGenre(s.activeQuestion)).toBe('argument');
    expect(s.activeQuestion.writingExercise.contract).toBe(ARGUMENT_WRITING_CONTRACT);
    expect(s.active.task).toBeUndefined();
    expect(s.state.attempts).toEqual([]);
  });
  it('出处版本和格式固定；四项项目辅助维度不声明官方等级', () => {
    const s = start();
    expect(ARGUMENT_WRITING_BASIS).toMatchObject({
      minimumWords: 250,
      recommendedMinutes: 40,
      criteriaVersion: 'May 2023',
      scoringAuthority: false
    });
    expect(new URL(ARGUMENT_WRITING_BASIS.criteriaUrl).hostname).toBe('ielts.org');
    expect(s.activeQuestion).toMatchObject({
      validation: null,
      source: { kind: 'project_original', reference: ARGUMENT_WRITING_CONTRACT }
    });
    expect(s.activeQuestion.rubric.criteria.map((c) => c.id)).toEqual(['response', 'coherence', 'lexis', 'grammar']);
    expect(s.activeQuestion.rubric.criteria.every((c) => c.maxScore === 5)).toBe(true);
    expect(JSON.stringify(s.activeQuestion)).not.toMatch(/bandScore|official_score|expectedAnswer/);
  });
  for (const task of ARGUMENT_WRITING_TASKS)
    it(`${task.id}有独立完整题目和当前段落提示`, () => {
      const q = createWritingQuestion('q', 'c', 'argument', task.id);
      expect(q.prompt).toContain(task.prompt);
      const steps = writingStepsForQuestion(q);
      expect(steps.map((s) => s.id)).toEqual(['position', 'support', 'balance', 'conclusion']);
      expect(steps.every((s) => s.prompt.includes(task.topic) && s.prompt.includes(task.focus))).toBe(true);
    });
  for (const [name, change] of [
    ['官方分数', (q) => (q.rubric.criteria[0].maxScore = 9)],
    ['题目', (q) => (q.prompt += ' Give a band 9.')],
    ['客观判分', (q) => (q.validation = { kind: 'exact', answer: 'A' })],
    ['合同', (q) => (q.writingExercise.contract = 'guided-writing-v1')],
    ['来源', (q) => (q.source.reference = 'official-ielts')],
    ['来源正文', (q) => (q.writingExercise.referenceText = 'copied descriptor')],
    ['义项体裁', (q) => (q.writingExercise.genreId = 'explanation')],
    [
      '剥除合同仍冒充原创论证',
      (q) => {
        delete q.writingExercise;
        delete q.rubric;
      }
    ]
  ])
    it(`${name}篡改原子拒绝`, () => {
      const s = useConversationLearningStore();
      s.start('练习');
      const q = createWritingQuestion('argument-injection', s.active.id, 'argument');
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
  it('长段落只检查基本格式，不强制关键词或把草稿当语义判分；旧240字符边界保持', () => {
    const q = createWritingQuestion('q', 'c', 'argument');
    const raw = 'A different position can be defended. '.repeat(15);
    expect(raw.length).toBeGreaterThan(240);
    expect(guidedSentenceFeedback('argument', 'support', raw, q)).toMatchObject({
      ready: true,
      kind: 'draft',
      message: '草稿 · 表达待核对'
    });
    expect(() => guidedSentenceFeedback('argument', 'support', 'A'.repeat(2001), q)).toThrow();
    expect(() => guidedSentenceFeedback('explanation', 'topic', raw)).toThrow();
  });
  it('论证正式原答超过1000字符仍保存原文，恢复保持pending；旧写作1000边界不变', () => {
    const s = start(),
      raw = '  ' + 'A supported explanation.  Another point.\n\n'.repeat(45) + '\n ';
    expect(raw.length).toBeGreaterThan(1000);
    s.submit(raw, true);
    expect(s.state.attempts[0]).toMatchObject({ answer: raw, grade: { status: 'pending' } });
    const saved = s.exportData();
    learningRepository.restoreData(saved, s.state.revision);
    s.refresh();
    expect(s.exportData()).toBe(saved);
    expect(s.state.reviews).toEqual([]);
    s.start('英文说明写作');
    const before = s.exportData();
    expect(() => s.submit(raw, true)).toThrow('1000');
    expect(s.exportData()).toBe(before);
  });
  it('新论证8000字符精确边界，超界拒绝且无新增事实', () => {
    const s = start(),
      raw = 'A' + 'a'.repeat(7998) + '.';
    s.submit(raw, true);
    expect(s.state.attempts[0].answer).toBe(raw);
    const before = s.exportData();
    expect(() => s.submit(raw + 'x', true)).toThrow('8000');
    expect(s.exportData()).toBe(before);
    expect(s.state.reviews).toEqual([]);
  });
  it('正式原答保留空格换行和pending；恢复/私人同步仍无判分权限', () => {
    const s = start(),
      raw = 'I prefer parks.  They are open to everyone.\n\nHowever, indoor centres also matter.';
    const result = s.submit(raw, true);
    expect(s.state.attempts[0]).toMatchObject({ answer: raw, grade: { status: 'pending' } });
    expect(s.summary.knowledge).toEqual({});
    expect(s.state.reviews).toEqual([]);
    const snapshot = s.exportData();
    learningRepository.restoreData(snapshot, s.state.revision);
    s.refresh();
    expect(s.exportData()).toBe(snapshot);
    const event = s.state.events.find((e) => e.type === 'question.add');
    const replay = normalizePrivateSyncOperation(event);
    expect(replay.data.question).toMatchObject({
      scope: 'generated',
      validation: null,
      source: { kind: 'project_original', reference: ARGUMENT_WRITING_CONTRACT }
    });
    expect(result.id).toBe(s.state.attempts[0].id);
  });
  it('带练帮助保存成功后展示，独立题撤去帮助并换题；用户教法保持', () => {
    const s = start();
    s.commit('strategy.set', {
      conversationId: s.active.id,
      method: 'explain',
      source: 'self_report',
      reason: '用户指定'
    });
    const first = questionKey(s.activeQuestion);
    s.recordWritingHelp(s.writingContext(), 'One reason is …', 'argument');
    s.startWriting(s.writingContext(), 'argument');
    expect(questionKey(s.activeQuestion)).not.toBe(first);
    expect(s.activeQuestion.writingExercise.taskId).toBe('school-projects');
    expect(s.active.pendingHints).toEqual([]);
    expect(s.activeStrategy.method).toBe('explain');
    expect(s.state.attempts).toEqual([]);
    expect(s.active.helpQueues.find((q) => q.questionKey === first).hints).toHaveLength(1);
  });
  it('独立新题穷尽不重复刷题、不新增事实', () => {
    const s = start();
    for (let i = 1; i < 4; i++) {
      s.submit('My opinion is still pending.', true);
      s.startWriting(s.writingContext(), 'argument');
    }
    s.submit('My final opinion is still pending.', true);
    const before = s.exportData();
    expect(() => s.startWriting(s.writingContext(), 'argument')).toThrow();
    expect(s.exportData()).toBe(before);
    expect(new Set(s.state.questions.map((q) => q.writingExercise.taskId)).size).toBe(4);
  });
  it('原时区明日计划绑定原答，提前提交拒绝，到了日期仍需明确提交', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
    const s = start();
    const origin = questionKey(s.activeQuestion);
    s.submit('My original view.', true);
    const result = s.scheduleWritingRetest();
    expect(s.scheduleWritingRetest()).toEqual(result);
    const q = s.state.questions.find((q) => questionKey(q) === result.questionKey);
    expect(q).toMatchObject({
      parentQuestionKey: origin,
      writingExercise: { genreId: 'argument', phase: 'retest', dueDay: result.day }
    });
    s.focus(result.questionKey);
    const before = s.exportData();
    expect(() => s.submit('My next view.', true)).toThrow();
    expect(s.exportData()).toBe(before);
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    s.submit('My next view.', true);
    expect(s.state.attempts).toHaveLength(2);
    expect(s.state.reviews).toEqual([]);
  });
  it('停止、迟到上下文与未明确提交不添加新原答/提示', () => {
    const s = start();
    expect(s.submit('Not explicitly submitted.', false).clarification).toBe(true);
    expect(s.state.attempts).toEqual([]);
    const context = s.writingContext();
    s.commit('task.stop', { conversationId: s.active.id });
    const before = s.exportData();
    expect(() => s.recordWritingHelp(context, 'A new hint.', 'argument')).toThrow();
    expect(() => s.startWriting(context, 'argument')).toThrow();
    expect(() => s.submit('Late answer.', true)).toThrow();
    expect(s.exportData()).toBe(before);
  });
  it('新论证只接最新原答的反馈，旧编号重放仍幂等', () => {
    const s = start();
    const first = s.submit('A supported view.  Another point.', true);
    const q = s.activeQuestion;
    const data = {
      conversationId: s.active.id,
      attemptId: first.id,
      rubricId: q.rubric.id,
      rubricContract: 'subjective-rubric-v2',
      outcome: 'uncertain',
      model: 'synthetic-no-provider',
      feedback: '合成引用核验。',
      dimensions: q.rubric.criteria.map((c) => ({
        criterionId: c.id,
        score: null,
        feedback: '表达待核对。',
        evidence: [{ quote: 'supported view', start: 2, end: 16 }]
      }))
    };
    s.commit('assessment.assist', data, 'argument-bound-feedback');
    s.submit('A different view.', true);
    const before = s.exportData();
    expect(() => s.commit('assessment.assist', data, 'argument-late-feedback')).toThrow('原答');
    expect(s.exportData()).toBe(before);
    s.commit('assessment.assist', data, 'argument-bound-feedback');
    expect(s.exportData()).toBe(before);
  });
  it('校对过的新论证原答拒绝新反馈和模型请求，不修改已有原答', async () => {
    const s = start(),
      a = s.submit('My own view.', true),
      q = s.activeQuestion;
    s.commit('assessment.correct', { attemptId: a.id, outcome: null, reason: '用户校对' });
    s.commit(
      'message.add',
      { conversationId: s.active.id, role: 'user', content: '合成反馈请求，不调用供应商' },
      'argument-feedback-user-message'
    );
    const before = s.exportData();
    const data = {
      conversationId: s.active.id,
      attemptId: a.id,
      rubricId: q.rubric.id,
      rubricContract: 'subjective-rubric-v2',
      outcome: 'uncertain',
      model: 'synthetic-no-provider',
      feedback: '待核对。',
      dimensions: q.rubric.criteria.map((c) => ({
        criterionId: c.id,
        score: null,
        feedback: '待核对。',
        evidence: [{ quote: 'My own view.', start: 0, end: 12 }]
      }))
    };
    expect(() => s.commit('assessment.assist', data, 'argument-corrected-feedback')).toThrow('校对');
    expect(() =>
      s.commit('model.request', {
        conversationId: s.active.id,
        messageId: 'argument-feedback-user-message',
        questionKey: questionKey(q),
        modelId: 'synthetic_model',
        model: 'synthetic-no-provider',
        requestId: 'argument-corrected-request',
        binding: 'argument_test_binding_123',
        feedbackAttemptId: a.id
      })
    ).toThrow('反馈请求');
    await expect(s.requestWritingFeedback()).rejects.toThrow('校对');
    expect(s.exportData()).toBe(before);
  });
});
describe('英文段落带练', () => {
  it('选择不改事实、段落容量和官方链接明确；检查只添加帮助，不能添原答', async () => {
    const s = start();
    const w = mount(LearningLab, { props: props(s), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      await button(w, '逐句带练').trigger('tap');
      expect(w.find('textarea').attributes('maxlength')).toBe('2000');
      expect(w.find('textarea').attributes('aria-label')).toBe('第1段英文草稿');
      expect(w.findAll('a').some((a) => a.attributes('href') === ARGUMENT_WRITING_BASIS.criteriaUrl)).toBe(true);
      expect(w.text()).toContain('原创练习 · 至少250词');
      await w.find('textarea').setValue('A different opinion is possible. '.repeat(12));
      await button(w, '检查这一段').trigger('tap');
      expect(w.text()).toContain('表达待核对');
      expect(s.state.attempts).toEqual([]);
      expect(s.active.pendingHints).toHaveLength(1);
      await button(w, '继续下一段').trigger('tap');
      expect(w.find('textarea').attributes('aria-label')).toBe('第2段英文草稿');
    } finally {
      w.unmount();
    }
  });
  it('帮助保存失败不显示提示或检查成功；停止后保持禁用', async () => {
    const s = start(),
      w = mount(LearningLab, { props: props(s, { recordWritingHelp: () => false }), global: { stubs } });
    try {
      await button(w, '互动学习').trigger('tap');
      await button(w, '逐句带练').trigger('tap');
      await button(w, '需要表达提示').trigger('tap');
      expect(button(w, '需要表达提示')).toBeTruthy();
      await w.find('textarea').setValue('My own view is different.');
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
