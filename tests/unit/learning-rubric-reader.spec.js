import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import RubricEvidence from '@/components/business/learning/rubric-evidence.vue';
import LearningPage from '@/pages/learning/index.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import { assessWithRubric } from '../../laf-backend/functions/_shared/learning-rubric.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import fixture from '../fixtures/learning/rubric-v1.json';
import evidenceFixture from '../fixtures/learning/rubric-evidence-v2.json';

vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const clone = (value) => JSON.parse(JSON.stringify(value));
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
const quote = '从液态变为气态';
const repeated = `开头🙂  ${quote}。\r\n对照：${quote}，凝结由气态变回液态。\n结尾 <img src=x onerror="alert(1)">`;
function data(answer = repeated) {
  const attempt = { id: 'reader-answer', conversationId: 'reader-conversation', questionKey: 'water-cycle@1', answer };
  const input = clone(fixture.cases[0].assessment);
  input.rubricContract = 'subjective-rubric-v2';
  input.dimensions[0].evidence = [
    { quote, start: answer.lastIndexOf(quote), end: answer.lastIndexOf(quote) + quote.length }
  ];
  const assessment = { id: 'reader-assessment', ...assessWithRubric(fixture.question, attempt, input) };
  return { attempt, assessment, contextKey: 'guest-records' };
}
function reader(props = data()) {
  return mount(RubricEvidence, { props, global: { stubs } });
}
const locateButton = (wrapper, name = '蒸发方向') => wrapper.find(`[aria-label="查看${name}引用1的原答位置"]`);
const fullButton = (wrapper) => wrapper.findAll('button').find((button) => /完整原答/.test(button.text()));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => vi.restoreAllMocks());

describe('主观引用的完整原答阅读', () => {
  it('定位第二处重复原文，完整保留换行、空格和文本，且只突出该处', async () => {
    const props = data();
    const before = clone(props);
    const wrapper = reader(props);
    expect(wrapper.text()).toContain('同文第2/2处');
    expect(wrapper.find('.answer-body').exists()).toBe(false);
    await locateButton(wrapper).trigger('tap');
    expect(wrapper.find('.answer-body').element.textContent).toBe(repeated);
    expect(wrapper.findAll('.evidence-highlight')).toHaveLength(1);
    expect(wrapper.find('.evidence-highlight').text()).toBe(quote);
    const segments = wrapper.find('.answer-body').element.children;
    expect(segments[0].textContent).toBe(repeated.slice(0, repeated.lastIndexOf(quote)));
    expect(wrapper.find('img').exists()).toBe(false);
    expect(props).toEqual(before);
    await locateButton(wrapper).trigger('tap');
    expect(locateButton(wrapper).attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('.answer-body').exists()).toBe(false);
    wrapper.unmount();
  });
  it('切换引用或完整原答只展开一个阅读区', async () => {
    const wrapper = reader();
    await locateButton(wrapper).trigger('tap');
    await locateButton(wrapper, '凝结方向').trigger('tap');
    expect(locateButton(wrapper).attributes('aria-expanded')).toBe('false');
    expect(wrapper.findAll('.answer-body')).toHaveLength(1);
    expect(wrapper.find('.evidence-highlight').text()).toBe('由气态变回液态');
    await fullButton(wrapper).trigger('tap');
    expect(wrapper.findAll('.answer-body')).toHaveLength(1);
    expect(wrapper.find('.answer-body').element.textContent).toBe(repeated);
    expect(wrapper.find('.evidence-highlight').exists()).toBe(false);
    await fullButton(wrapper).trigger('tap');
    expect(wrapper.find('.answer-body').exists()).toBe(false);
    wrapper.unmount();
  });
  it('一万字符原答仍完整读取，不把附近片段当作全文', async () => {
    const answer = `${'前'.repeat(9900)}${fixture.cases[0].answer}`.padEnd(10000, '后');
    const wrapper = reader(data(answer));
    await locateButton(wrapper).trigger('tap');
    expect(wrapper.find('.answer-body').element.textContent).toBe(answer);
    expect(wrapper.find('.evidence-highlight').text()).toBe(quote);
    wrapper.unmount();
  });
  it('旧合同可查看完整原答，保持未定位而不猜测重复引用位置', async () => {
    const props = data();
    props.assessment = {
      id: 'old-assessment',
      ...assessWithRubric(fixture.question, props.attempt, fixture.cases[0].assessment)
    };
    const wrapper = reader(props);
    expect(wrapper.text()).toContain('旧记录未定位 · 待核对');
    expect(locateButton(wrapper).exists()).toBe(false);
    await fullButton(wrapper).trigger('tap');
    expect(wrapper.find('.answer-body').element.textContent).toBe(repeated);
    expect(wrapper.find('.evidence-highlight').exists()).toBe(false);
    wrapper.unmount();
  });
  it('显示已有用户校对并保留原辅助记录', () => {
    const props = data();
    props.attempt.corrections = [{ id: 'correction', grade: { status: 'pending', outcome: 'partial' } }];
    const wrapper = reader(props);
    expect(wrapper.text()).toContain('历史 AI 评分待核对');
    expect(wrapper.text()).toContain('原答引用：从液态变为气态');
    wrapper.unmount();
  });
});

describe('阅读位置拒绝伪造与陈旧上下文', () => {
  it.each([
    [
      '负数',
      (location) => {
        location.start = -1;
      }
    ],
    [
      '超出原答',
      (location) => {
        location.end = 10001;
      }
    ],
    [
      '小数',
      (location) => {
        location.start += 0.5;
      }
    ],
    [
      '反向范围',
      (location) => {
        location.end = location.start;
      }
    ],
    [
      '错误文本',
      (location) => {
        location.start = 0;
        location.end = quote.length;
      }
    ],
    [
      '另一引用',
      (location) => {
        location.quote = '模型编写的引用';
      }
    ],
    [
      '缺少位置',
      (_, dimension) => {
        dimension.evidenceLocations = [];
      }
    ]
  ])('%s不提供定位按钮，完整原答仍可核对', async (_, mutate) => {
    const props = data();
    const dimension = props.assessment.dimensions[0];
    mutate(dimension.evidenceLocations[0], dimension);
    const wrapper = reader(props);
    expect(locateButton(wrapper).exists()).toBe(false);
    expect(wrapper.text()).toContain('引用未定位 · 待核对');
    await fullButton(wrapper).trigger('tap');
    expect(wrapper.find('.answer-body').element.textContent).toBe(repeated);
    expect(wrapper.find('.evidence-highlight').exists()).toBe(false);
    wrapper.unmount();
  });
  it('不信任伪造的次数、字位或附近原文，按原答重新生成', () => {
    const props = data();
    Object.assign(props.assessment.dimensions[0].evidenceLocations[0], {
      occurrence: 1,
      occurrences: 99,
      startCharacter: 999,
      endCharacter: 999,
      before: '伪造前文',
      after: '伪造后文'
    });
    const wrapper = reader(props);
    expect(wrapper.text()).toContain('同文第2/2处');
    expect(wrapper.text()).not.toContain('999');
    expect(wrapper.text()).not.toContain('伪造');
    wrapper.unmount();
  });
  it('Unicode代理对不能被拆开，即使半段与引用恰好一致', () => {
    const props = data();
    const start = repeated.indexOf('🙂');
    const dimension = props.assessment.dimensions[0];
    dimension.evidence = [repeated.slice(start + 1, start + 2)];
    dimension.evidenceLocations = [{ quote: dimension.evidence[0], start: start + 1, end: start + 2 }];
    const wrapper = reader(props);
    expect(locateButton(wrapper).exists()).toBe(false);
    expect(wrapper.text()).toContain('引用未定位 · 待核对');
    wrapper.unmount();
  });
  it.each(['attemptId', 'questionKey', 'contract'])('错误%s不显示另一作答，查看禁用', async (field) => {
    const props = data();
    props.assessment[field] = 'different';
    const wrapper = reader(props);
    expect(fullButton(wrapper).attributes('disabled')).toBeDefined();
    await fullButton(wrapper).trigger('tap');
    expect(wrapper.find('.answer-body').exists()).toBe(false);
    expect(wrapper.text()).toContain('原答不可用');
    wrapper.unmount();
  });
  it.each(['contextKey', 'conversationId', 'answer', 'id', 'questionKey', 'assessment'])(
    '%s变化先收起原答',
    async (field) => {
      const props = data();
      const wrapper = reader(props);
      await locateButton(wrapper).trigger('tap');
      if (field === 'contextKey') await wrapper.setProps({ contextKey: 'recreated-owner-records' });
      else if (field === 'assessment')
        await wrapper.setProps({ assessment: { ...props.assessment, id: 'new-assessment' } });
      else await wrapper.setProps({ attempt: { ...props.attempt, [field]: `${props.attempt[field]} changed` } });
      expect(wrapper.find('.answer-body').exists()).toBe(false);
      wrapper.unmount();
    }
  );
});

describe('七阶段合成原答的完整阅读', () => {
  function stageStore(item) {
    const commit = (id, type, value) => learningRepository.commit({ id, type, data: value });
    commit('stage-session', 'conversation.start', { goal: '七阶段原答合同核验' });
    commit('stage-question', 'question.add', { question: clone(evidenceFixture.question) });
    commit('stage-focus', 'question.focus', { conversationId: 'stage-session', questionKey: 'evidence-question@1' });
    commit('fixture-answer', 'attempt.submit', {
      conversationId: 'stage-session',
      answer: item.answer,
      explicit: true
    });
    commit('stage-assessment', 'assessment.assist', {
      ...clone(item.assessment),
      conversationId: 'stage-session',
      attemptId: 'fixture-answer'
    });
    const store = useConversationLearningStore();
    store.selectedConversationId = 'stage-session';
    return store;
  }
  for (const item of evidenceFixture.cases.filter((entry) => entry.stage && !entry.expectedError))
    it(`${item.stage}中英文引用使用独立给定范围，不改变辅助性质`, async () => {
      const store = stageStore(item);
      const attempt = store.state.attempts[0];
      const assessment = attempt.assistance[0];
      expect(assessment.dimensions[0].evidenceLocations[0]).toMatchObject(item.expectedLocation);
      expect(assessment.reviewRequired).toBe(true);
      const before = clone(store.state);
      const wrapper = reader({ attempt, assessment, contextKey: 'stage-reader-records' });
      const expectedAnswer = item.expectedSavedAnswer || item.answer;
      await locateButton(wrapper, '解释与依据').trigger('tap');
      expect(wrapper.find('.answer-body').element.textContent).toBe(expectedAnswer);
      expect(wrapper.find('.evidence-highlight').element.textContent).toBe(
        item.assessment.dimensions[0].evidence[0].quote
      );
      expect(wrapper.text()).toContain('同文第2/2处');
      await fullButton(wrapper).trigger('tap');
      expect(wrapper.find('.answer-body').element.textContent).toBe(expectedAnswer);
      expect(wrapper.find('.evidence-highlight').exists()).toBe(false);
      expect(store.state).toEqual(before);
      expect(store.summary.first.denominator).toBe(0);
      expect(store.state.attempts[0].grade.status).toBe('pending');
      wrapper.unmount();
    });

  it('原答中的指令和标签只作阅读文字，不恢复停止、解除教法或升级可靠判分', async () => {
    const item = evidenceFixture.cases.find((entry) => entry.id === 'answer-directive-is-data');
    const store = stageStore(item);
    const commit = (id, type, value) => learningRepository.commit({ id, type, data: value });
    commit('data-method', 'strategy.set', {
      conversationId: 'stage-session',
      method: 'explain',
      reason: '合成用户明确指定教法',
      source: 'self_report',
      evidenceIds: []
    });
    commit('data-stop', 'task.stop', { conversationId: 'stage-session' });
    store.refresh();
    const before = clone(store.state);
    const attempt = store.state.attempts[0];
    const wrapper = reader({ attempt, assessment: attempt.assistance[0], contextKey: 'data-session-records' });
    await locateButton(wrapper, '解释与依据').trigger('tap');
    expect(wrapper.find('.answer-body').element.textContent).toBe(item.answer);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('恢复自动教法');
    expect(store.state).toEqual(before);
    expect(store.active.stopped).toBe(true);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.attempts[0].grade.status).toBe('pending');
    wrapper.unmount();
  });
});

describe('学习页与概览共同沿用原答阅读', () => {
  it('当前对话正确绑定作答；只读展开、校对历史、停止、切题和重开不改变事实', async () => {
    const store = useConversationLearningStore();
    const commit = (id, type, value) => learningRepository.commit({ id, type, data: value });
    commit('reader-session', 'conversation.start', { goal: '主观原答核对' });
    commit('reader-question', 'question.add', { question: clone(fixture.question) });
    commit('reader-focus', 'question.focus', { conversationId: 'reader-session', questionKey: 'water-cycle@1' });
    commit('reader-attempt', 'attempt.submit', { conversationId: 'reader-session', answer: repeated, explicit: true });
    const input = clone(fixture.cases[0].assessment);
    input.rubricContract = 'subjective-rubric-v2';
    input.dimensions[0].evidence = [
      { quote, start: repeated.lastIndexOf(quote), end: repeated.lastIndexOf(quote) + quote.length }
    ];
    commit('reader-assess', 'assessment.assist', {
      ...input,
      conversationId: 'reader-session',
      attemptId: 'reader-attempt'
    });
    commit('reader-correct', 'assessment.correct', {
      attemptId: 'reader-attempt',
      outcome: 'partial',
      reason: '保留原答待核对'
    });
    commit('reader-stop', 'task.stop', { conversationId: 'reader-session' });
    store.refresh();
    store.selectedConversationId = 'reader-session';
    const before = clone(store.state);
    const pageOptions = {
      global: {
        stubs: {
          ...stubs,
          LearningShell: { template: '<div><slot /></div>' },
          LearningOverview: true,
          NumberLine: true
        }
      }
    };
    let page = mount(LearningPage, pageOptions);
    await flushPromises();
    await locateButton(page).trigger('tap');
    expect(page.find('.answer-body').element.textContent).toBe(repeated);
    expect(page.text()).toContain('历史 AI 评分待核对');
    expect(store.state).toEqual(before);
    expect(store.active.stopped).toBe(true);
    expect(store.summary.first.denominator).toBe(0);
    const overview = mount(LearningOverview, {
      props: { initialExpanded: true, view: 'study-detail' },
      global: { stubs }
    });
    await locateButton(overview).trigger('tap');
    expect(overview.find('.answer-body').element.textContent).toBe(repeated);
    expect(overview.text()).toContain('AI 评分 · 待核对 4 / 4');
    expect(store.state).toEqual(before);
    overview.unmount();
    commit('reader-other-session', 'conversation.start', { goal: '另一对话保留同题' });
    commit('reader-other-focus', 'question.focus', {
      conversationId: 'reader-other-session',
      questionKey: 'water-cycle@1'
    });
    commit('reader-other-attempt', 'attempt.submit', {
      conversationId: 'reader-other-session',
      answer: '不同原答',
      explicit: true
    });
    store.refresh();
    store.selectedConversationId = 'reader-other-session';
    await flushPromises();
    expect(page.find('.rubric-evidence').exists()).toBe(false);
    store.selectedConversationId = 'reader-session';
    await flushPromises();
    expect(page.text()).toContain('原答引用：从液态变为气态');
    expect(page.find('.answer-body').exists()).toBe(false);
    page.unmount();
    page = mount(LearningPage, pageOptions);
    await flushPromises();
    expect(page.find('.answer-body').exists()).toBe(false);
    expect(store.active.stopped).toBe(true);
    expect(store.state.attempts[0].answer).toBe(repeated);
    page.unmount();
  });
});
