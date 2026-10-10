import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  emptyLearningState,
  questionKey,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import {
  createNoticeQuestion,
  NOTICE_TASKS,
  nextNoticeDay
} from '../../laf-backend/functions/_shared/learning-writing.js';
import LearningLab from '@/components/business/learning/learning-lab.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
const api = vi.hoisted(() => ({ generate: vi.fn(), result: vi.fn() }));
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  generateLearningTurn: api.generate,
  fetchLearningResult: api.result
}));
const answer =
  'Our reading club will meet on Friday at 3 pm in the classroom.\nPlease bring a notebook. Reading helps us share ideas.';
const clone = (v) => JSON.parse(JSON.stringify(v));
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  api.generate.mockReset();
  api.result.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup() {
  const store = useConversationLearningStore();
  store.start('英文通知写作', { track: 'junior', stage: '八年级', edition: '' });
  return store;
}
function cloud(store) {
  store.models = [{ id: 'notice-fixture', model: 'synthetic-not-a-real-model', source: 'byok', capabilities: {} }];
  store.modelId = 'notice-fixture';
  store.selectedMode = 'cloud';
  store.sharingAllowed = true;
}
function response(body) {
  const raw = body.learningContext.attempt.answer,
    start = raw.indexOf('reading');
  return {
    success: true,
    data: {
      requestId: body.requestId,
      requestBinding: body.requestBinding,
      modelId: body.modelId,
      model: 'synthetic-not-a-real-model',
      message: '先检查通知是否让同学知道下一步做什么。',
      tools: [
        {
          name: 'assess',
          arguments: {
            attemptId: body.learningContext.attempt.id,
            rubricId: body.learningContext.question.rubric.id,
            outcome: 'uncertain',
            feedback: '辅助反馈，仍待核对。',
            dimensions: body.learningContext.question.rubric.criteria.map((c) => ({
              criterionId: c.id,
              score: null,
              feedback: '已定位原答；本样例不判断语义。',
              evidence: [{ quote: 'reading', start, end: start + 7 }]
            }))
          }
        }
      ]
    }
  };
}
describe('原创通知的正式作答与撤去支架', () => {
  it('明确开始写作建立原创任务与四维量表，未提交时没有作答或掌握', () => {
    const store = setup(),
      q = store.activeQuestion;
    expect(q).toMatchObject({
      scope: 'generated',
      answerType: 'subjective',
      publishable: false,
      source: { kind: 'project_original', reference: 'english-notice-v1' },
      validation: null
    });
    expect(q.rubric.criteria.map((c) => c.id)).toEqual(['content', 'reader', 'organisation', 'language']);
    expect(q.rubric.criteria.reduce((n, c) => n + c.maxScore, 0)).toBe(20);
    expect(q.prompt).toContain('50–80词');
    expect(q.prompt).not.toContain('Our school');
    expect(store.currentPlan.tasks[0].condition).toBe('submitted');
    expect(store.state.attempts).toEqual([]);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.taskContext.track).toBe('junior');
  });
  it('草稿和普通发送不自动提交，明确提交才保存原答和提交任务', async () => {
    const store = setup();
    expect(store.submit(answer, false).clarification).toBe(true);
    await store.send(answer);
    expect(store.state.attempts).toHaveLength(0);
    expect(api.generate).not.toHaveBeenCalled();
    store.submit(answer, true, 'notice-answer');
    expect(store.state.attempts[0]).toMatchObject({ answer, kind: 'first', grade: { status: 'pending' } });
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 1 });
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.knowledge).toEqual({});
    expect(store.state.reviews).toEqual([]);
  });
  it('超长正文拒绝且不损坏原记录', () => {
    const store = setup(),
      before = store.exportData();
    expect(() => store.submit('x'.repeat(1001), true)).toThrow('1000');
    expect(store.exportData()).toBe(before);
  });
  it('先保存原答，再换四项条件；旧帮助留在原题，新题无支架', () => {
    const store = setup(),
      original = clone(store.activeQuestion);
    expect(() => store.generateVariant()).toThrow('提交');
    store.recordWritingHelp(store.writingContext(), '句型帮助');
    store.submit(answer, true, 'helped');
    store.generateVariant();
    const next = store.activeQuestion;
    expect(next.parentQuestionKey).toBe(questionKey(original));
    const first = NOTICE_TASKS[0],
      second = NOTICE_TASKS[1];
    for (const key of ['event', 'time', 'place', 'action']) {
      expect(first[key]).not.toBe(second[key]);
      expect(next.prompt).toContain(second[key]);
    }
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.attempts[0].hints).toHaveLength(1);
    store.submit('Art club will meet on Tuesday.', true);
    expect(store.state.attempts[1].kind).toBe('variant');
    expect(store.state.attempts[1].hints).toEqual([]);
    expect(store.summary.first.denominator).toBe(0);
  });
  it('带练后的独立入口换新任务，原未提交题与提示保留，草稿不冒充原答', () => {
    const store = setup(),
      oldKey = store.active.activeQuestionKey;
    store.recordWritingHelp(store.writingContext(), '逐句带练的句型帮助');
    store.startWriting(store.writingContext());
    expect(store.activeQuestion.writingExercise.taskId).toBe('art-circle');
    expect(store.active.activeQuestionKey).not.toBe(oldKey);
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.attempts).toEqual([]);
    expect(store.active.helpQueues.find((q) => q.questionKey === oldKey).hints).toHaveLength(1);
    store.focus(oldKey);
    expect(store.active.pendingHints).toHaveLength(1);
  });
  it('旧上下文、停止和记录忙碌拒绝新写作或帮助，切题不恢复停止', async () => {
    const store = setup(),
      context = store.writingContext();
    const second = store.start('其他学习');
    expect(() => store.startWriting(context)).toThrow('切换');
    expect(() => store.recordWritingHelp(context, '旧提示')).toThrow('切换');
    await store.send('停止当前任务');
    const before = store.exportData();
    expect(() => store.startWriting(store.writingContext())).toThrow('停止');
    expect(() => store.recordWritingHelp(store.writingContext(), '提示')).toThrow('停止');
    expect(store.exportData()).toBe(before);
    expect(store.active.id).toBe(second.id);
  });
});
describe('通知版本、归属和复测计划', () => {
  for (const [name, mutate] of [
    [
      '条件错配',
      (q) => {
        q.prompt += '答案是A';
      }
    ],
    [
      '来源错配',
      (q) => {
        q.source.kind = 'official';
      }
    ],
    [
      '能力注入',
      (q) => {
        q.writingExercise.code = 'print(1)';
      }
    ],
    [
      '客观权威',
      (q) => {
        q.validation = { authority: 'executable', type: 'exact', answer: 'A' };
      }
    ],
    [
      '答案注入',
      (q) => {
        q.expectedAnswer = 'A';
      }
    ],
    [
      '维度错配',
      (q) => {
        q.rubric.criteria[0].maxScore = 10;
      }
    ]
  ])
    it(`共享新建/私人同步拒绝${name}`, () => {
      const state = applyLearningOperation(emptyLearningState('guest'), {
        id: 'c',
        type: 'conversation.start',
        data: { goal: '写作' }
      }).state;
      const q = createNoticeQuestion('q', 'c');
      mutate(q);
      const op = { id: 'q-add', type: 'question.add', data: { question: q } };
      expect(() => applyLearningOperation(state, op)).toThrow();
      expect(() => applyLearningOperation(state, normalizePrivateSyncOperation(op))).toThrow();
      expect(state.questions).toEqual([]);
    });
  it('题目重复、跨对话焦点及伪造换题父原答拒绝', () => {
    const store = setup(),
      q = clone(store.activeQuestion),
      c = store.active.id;
    q.id = 'copy';
    expect(() => store.commit('question.add', { question: q })).toThrow('已存在');
    store.start('另一对话');
    const other = store.active.id;
    expect(() => store.focus(questionKey(store.state.questions[0]), other)).toThrow('另一对话');
    expect(() =>
      store.commit('question.focus', { conversationId: other, questionKey: questionKey(store.state.questions[0]) })
    ).toThrow('另一对话');
    const fake = createNoticeQuestion('fake', c, 'art-circle', questionKey(store.state.questions[0]));
    expect(() => store.commit('question.add', { question: fake })).toThrow('已保存');
  });
  it('明日计划保留已有任务；同一安排幂等，打开复测不提交或解除停止', async () => {
    const store = setup();
    store.submit(answer, true, 'a');
    const day = nextNoticeDay(store.summary.day);
    store.commit('plan.set', {
      day,
      tasks: [{ id: 'other-task', title: '阅读', condition: 'manual' }],
      reason: '合成计划'
    });
    const original = store.active.activeQuestionKey,
      result = store.scheduleWritingRetest();
    const planned = store.state.plans.filter((p) => p.day === day).at(-1);
    expect(planned.tasks.map((t) => t.id)).toContain('other-task');
    expect(planned.tasks[1].condition).toBe('submitted');
    expect(store.active.activeQuestionKey).toBe(original);
    expect(store.state.attempts).toHaveLength(1);
    const before = store.exportData();
    expect(store.scheduleWritingRetest()).toEqual(result);
    expect(store.exportData()).toBe(before);
    await store.send('停止当前任务');
    store.focus(result.questionKey);
    expect(store.active.stopped).toBe(true);
    expect(store.active.nextAttemptKind).toBe('review');
    expect(() => store.submit('Review', true)).toThrow('停止');
    expect(store.state.reviews).toHaveLength(0);
  });
  it('计划保存失败后重试复用已保存的新题', () => {
    const store = setup();
    store.submit(answer, true);
    const commit = learningRepository.commit.bind(learningRepository);
    let fail = true;
    vi.spyOn(learningRepository, 'commit').mockImplementation((op) => {
      if (fail && op.type === 'plan.set' && op.data.day) {
        fail = false;
        throw new Error('合成计划保存失败');
      }
      return commit(op);
    });
    expect(() => store.scheduleWritingRetest()).toThrow('保存失败');
    const count = store.state.questions.length;
    expect(store.writingRetest).toBeNull();
    expect(store.scheduleWritingRetest()).toBeTruthy();
    expect(store.state.questions).toHaveLength(count);
  });
  it('复测日期按日历跨月/年，不用24小时猜时区；未保存和停止无法安排', async () => {
    expect(nextNoticeDay('2026-12-31')).toBe('2027-01-01');
    expect(nextNoticeDay('2028-02-28')).toBe('2028-02-29');
    expect(() => nextNoticeDay('2026-02-30')).toThrow();
    const store = setup();
    expect(() => store.scheduleWritingRetest()).toThrow('提交');
    store.submit(answer, true);
    await store.send('停止当前任务');
    expect(() => store.scheduleWritingRetest()).toThrow('停止');
  });
  it('量表修订保留原版本和帮助；条件更正转普通候选，不沿用通知合同', () => {
    const store = setup(),
      original = clone(store.activeQuestion);
    store.recordWritingHelp(store.writingContext(), '已有提示');
    store.submit(answer, true);
    store.setRubric([{ id: 'communication', name: '沟通', description: '用户定义', maxScore: 4 }]);
    expect(store.activeQuestion.writingExercise).toEqual(original.writingExercise);
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.state.questions[0]).toEqual(original);
    store.correctQuestion(store.activeQuestion, { prompt: '用户修改后的私人通知' }, '合成条件更正');
    expect(store.activeQuestion.writingExercise).toBeUndefined();
    expect(store.activeQuestion.source.kind).toBe('user_corrected');
    expect(store.state.attempts).toHaveLength(1);
    expect(store.summary.first.denominator).toBe(0);
  });
  it('恢复与私人重放保留原答、复测、停止和归属', async () => {
    const store = setup();
    store.submit(answer, true);
    store.scheduleWritingRetest();
    await store.send('停止当前任务');
    const payload = store.exportData();
    let replay = emptyLearningState('guest', store.state.timezone);
    for (const e of store.state.events) replay = applyLearningOperation(replay, normalizePrivateSyncOperation(e)).state;
    expect(replay.attempts).toEqual(store.state.attempts);
    expect(replay.plans).toEqual(store.state.plans);
    let differentTimezone = emptyLearningState('guest', 'Pacific/Auckland');
    for (const e of store.state.events)
      differentTimezone = applyLearningOperation(differentTimezone, normalizePrivateSyncOperation(e)).state;
    expect(differentTimezone.questions.map((q) => q.writingExercise)).toEqual(
      store.state.questions.map((q) => q.writingExercise)
    );
    const preview = store.previewRestore(payload);
    expect(preview).toBeTruthy();
    expect(store.exportData()).toBe(payload);
  });
});
describe('仅评阅原答的辅助模型请求', () => {
  it('请求不新增作答；v2完整位置反馈、锁定教法、帮助和待核对口径保持', async () => {
    const store = setup();
    store.submit(answer, true, 'a');
    cloud(store);
    store.commit('strategy.set', {
      conversationId: store.active.id,
      method: 'explain',
      source: 'self_report',
      reason: '用户选择'
    });
    api.generate.mockImplementation(async (body) => response(body));
    await store.requestWritingFeedback();
    expect(store.error).toBe('');
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(store.state.attempts).toHaveLength(1);
    const assistance = store.state.attempts[0].assistance[0];
    expect(assistance).toMatchObject({
      contract: 'subjective-rubric-v2',
      status: 'ai_assisted',
      reviewRequired: true,
      score: null
    });
    expect(assistance.dimensions[0].evidenceLocations[0]).toMatchObject({ quote: 'reading', start: 4, end: 11 });
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.activeStrategy.method).toBe('explain');
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.reviews).toEqual([]);
  });
  it('未提交、离线或未授权不发送，也不创建假作答', async () => {
    const store = setup();
    await expect(store.requestWritingFeedback()).rejects.toThrow('提交');
    store.submit(answer, true);
    await expect(store.requestWritingFeedback()).rejects.toThrow('连接');
    cloud(store);
    store.sharingAllowed = false;
    await expect(store.requestWritingFeedback()).rejects.toThrow('流向');
    expect(api.generate).not.toHaveBeenCalled();
    expect(store.state.attempts).toHaveLength(1);
  });
  for (const attack of ['wrong-attempt', 'plan-first', 'no-assessment', 'fake-quote'])
    it(`拒绝${attack}且没有部分工具写入`, async () => {
      const store = setup();
      store.submit(answer, true, 'a');
      cloud(store);
      const plan = JSON.stringify(store.state.plans);
      api.generate.mockImplementation(async (body) => {
        const result = response(body);
        if (attack === 'wrong-attempt') result.data.tools[0].arguments.attemptId = 'other';
        if (attack === 'plan-first')
          result.data.tools.unshift({ name: 'plan', arguments: { tasks: [], reason: 'attack' } });
        if (attack === 'no-assessment') result.data.tools = [];
        if (attack === 'fake-quote') result.data.tools[0].arguments.dimensions[0].evidence[0].quote = 'forged!';
        return result;
      });
      await store.requestWritingFeedback();
      expect(store.error).toBeTruthy();
      expect(store.state.attempts[0].assistance).toBeUndefined();
      expect(JSON.stringify(store.state.plans)).toBe(plan);
      expect(store.state.attempts).toHaveLength(1);
    });
  it('原请求恢复保留目标绑定并幂等，不再次生成', async () => {
    const store = setup();
    store.submit(answer, true, 'a');
    cloud(store);
    let body;
    api.generate.mockImplementation(async (value) => {
      body = value;
      return { success: false, message: '合成断线' };
    });
    await store.requestWritingFeedback();
    expect(store.recoverableRequest.feedbackAttemptId).toBe('a');
    store.refresh();
    api.result.mockResolvedValue(response(body));
    await store.recoverModelResult();
    expect(store.state.attempts).toHaveLength(1);
    expect(store.state.attempts[0].assistance).toHaveLength(1);
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(store.recoverableRequest).toBeNull();
  });
  for (const change of ['cancel', 'stop', 'new-answer', 'question', 'account'])
    it(`迟到反馈在${change}后不写入`, async () => {
      const store = setup();
      store.submit(answer, true, 'a');
      cloud(store);
      let resolve, body;
      api.generate.mockImplementation((value) => {
        body = value;
        return new Promise((r) => {
          resolve = r;
        });
      });
      const pending = store.requestWritingFeedback();
      await Promise.resolve();
      expect(store.busy).toBe(true);
      if (change === 'cancel') store.cancel();
      if (change === 'stop') await store.send('停止当前任务');
      if (change === 'new-answer') store.submit('Another answer', true, 'b');
      if (change === 'question') store.start('其他学习');
      if (change === 'account') {
        uni.setStorageSync('EXAM_USER_ID', 'other-owner');
        store.refresh();
      }
      resolve(response(body));
      await pending;
      expect(store.state.attempts.find((a) => a.id === 'a')?.assistance).toBeUndefined();
    });
});
describe('带练和计划入口', () => {
  it('四句完成后明确进入正式入口，不把草稿复制为原答；未写入的帮助不展示', async () => {
    const helper = vi.fn(() => true),
      wrapper = mount(LearningLab, {
        props: {
          state: emptyLearningState('guest'),
          context: 'c',
          question: createNoticeQuestion('q', 'session'),
          recordWritingHelp: helper
        },
        global: { stubs }
      });
    const button = (label) => wrapper.findAll('button').find((b) => b.text() === label);
    await button('互动学习').trigger('tap');
    await button('逐句带练').trigger('tap');
    const sentences = [
      'Our school will hold a reading club event.',
      'It will start at 3 pm on Friday.',
      'It will take place in the classroom.',
      'Please bring a notebook.'
    ];
    for (let i = 0; i < 4; i++) {
      await wrapper.find('textarea').setValue(sentences[i]);
      await button('检查这一句').trigger('tap');
      await button(i === 3 ? '拼成我的通知' : '继续下一句').trigger('tap');
    }
    expect(wrapper.findAll('textarea')).toHaveLength(1);
    await button('独立写作').trigger('tap');
    expect(wrapper.emitted('writing')).toEqual([['c', 'notice']]);
    expect(wrapper.emitted('question')).toBeUndefined();
    await wrapper.setProps({ context: 'changed' });
    await button('互动学习').trigger('tap');
    helper.mockReturnValue(false);
    await button('需要一个句型').trigger('tap');
    expect(wrapper.text()).not.toContain('Our school will hold a …');
    wrapper.unmount();
  });
  it('计划显示未来写作复测，打开自动定位原对话而不提交', async () => {
    const store = setup();
    store.submit(answer, true);
    const target = store.scheduleWritingRetest();
    store.start('另一个目标');
    const wrapper = mount(LearningOverview, { props: { view: 'plan' }, global: { stubs } });
    await wrapper.find('[data-learning-toggle]').trigger('tap');
    expect(wrapper.text()).toContain('写作复测');
    expect(wrapper.text()).toContain(target.day.slice(5).replace('-', '/'));
    store.focus(target.questionKey);
    expect(store.selectedConversationId).toBe(target.conversationId);
    expect(store.active.nextAttemptKind).toBe('review');
    expect(store.state.attempts).toHaveLength(1);
    wrapper.unmount();
  });
});
