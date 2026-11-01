import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { dayKey, emptyLearningState } from '@/services/learning/learning-domain.js';
import {
  ideaDismissals,
  ideasBasisText,
  ideasModelContext,
  modelIdeas,
  museLearningIdeas,
  setIdeasModelEnabled
} from '@/services/learning/muse-learning-ideas.js';
import { normalizeIdeasContext } from '../../laf-backend/functions/_shared/learning-ideas.js';
import { workspaceDrafts } from '@/services/learning/workspace-drafts.js';
import MuseIdeas from '@/components/business/learning/muse-ideas.vue';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
vi.mock('@/utils/safe-navigate.js', () => ({ safeNavigateTo: vi.fn() }));

const harness = vi.hoisted(() => ({ store: null }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({ useConversationLearningStore: () => harness.store }));
const NOW = Date.parse('2026-11-01T04:00:00Z');
const feedback = (id) => ({
  id,
  weaknesses: ['冠词'],
  strengths: [],
  lines: [{ advice: '可数名词单数前别漏掉冠词' }]
});
function learningState() {
  const state = emptyLearningState('ideas-owner');
  state.conversations.push({
    id: 'coach-1',
    goal: '考研英语一大作文',
    at: 1,
    messages: [],
    coach: {
      profile: { exam: '英语一' },
      startedDay: '2026-10-30',
      diagnostic: null,
      library: [
        { id: 'p1', text: 'play a vital role in', due: NOW - 1000, reviews: [] },
        { id: 'p2', text: 'not only ... but also', due: NOW + 86400000, reviews: [] }
      ],
      days: [
        {
          day: '2026-10-31',
          answers: [{ cardId: 'c1' }],
          drafts: [],
          rewrites: [],
          feedback: { 'card-c1': feedback('f1') },
          completed: true
        }
      ]
    }
  });
  return state;
}
let wrapper;
beforeEach(() => {
  uni.clearStorageSync();
  vi.mocked(safeNavigateTo).mockClear();
  harness.store = reactive({
    state: learningState(),
    busy: false,
    selectedConversationId: 'coach-1',
    calendarTime: NOW,
    locateConversation: vi.fn(),
    tick: 0,
    recordContext() {
      // Like the real store, the context read also touches unrelated reactive state.
      void this.tick;
      return this.state.owner;
    }
  });
});
afterEach(() => wrapper?.unmount());

it('turns saved facts into one-step ideas and brings a dismissed step back only with newer evidence', () => {
  const state = learningState();
  const sections = museLearningIdeas(state, NOW);
  expect(sections.map((section) => section.id)).toEqual(['review', 'practice', 'resume']);
  const [review, practice, resume] = sections.map((section) => section.items[0]);
  expect(review).toMatchObject({ title: '复习 1 条到期句式', body: 'play a vital role in', conversationId: 'coach-1' });
  expect(practice).toMatchObject({ title: '专练「冠词」', body: '可数名词单数前别漏掉冠词' });
  expect(practice.reason).toContain('AI 评估');
  expect(practice.draft).toContain('冠词');
  expect(resume).toMatchObject({ title: '开始今天的写作带练', conversationId: 'coach-1' });
  const dismissed = new Set([practice.id]);
  expect(museLearningIdeas(state, NOW, dismissed).map((section) => section.id)).toEqual(['review', 'resume']);
  state.conversations[0].coach.days[0].feedback['card-c2'] = feedback('f2');
  expect(museLearningIdeas(state, NOW, dismissed)[1].items[0].title).toBe('专练「冠词」');
});

it('starts an idea by opening its conversation or only prefilling a new chat, never writing facts', async () => {
  const before = JSON.stringify(harness.store.state);
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  await wrapper.get('[aria-label="复习 1 条到期句式"]').trigger('tap');
  expect(harness.store.locateConversation).toHaveBeenCalledWith('coach-1');
  expect(safeNavigateTo).toHaveBeenLastCalledWith('/pages/learning/index');
  await wrapper.get('[aria-label="专练「冠词」"]').trigger('tap');
  expect(harness.store.selectedConversationId).toBe(null);
  expect(workspaceDrafts(harness.store).read('ideas-owner', 'chat:new').draft).toContain('专门练一下「冠词」');
  expect(JSON.stringify(harness.store.state)).toBe(before);
});

it('dismisses from the row menu for this account only and keeps it dismissed after reopening', async () => {
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  await wrapper.get('[aria-label="专练「冠词」 的选项"]').trigger('tap');
  expect(wrapper.get('.idea-menu').text()).toContain('1 次反馈提到这一点 · AI 评估');
  harness.store.tick++;
  await nextTick();
  expect(wrapper.find('.idea-menu').exists()).toBe(true);
  const dismiss = wrapper.findAll('.idea-menu button').find((node) => node.text() === '不感兴趣');
  await dismiss.trigger('tap');
  expect(wrapper.text()).not.toContain('专练「冠词」');
  wrapper.unmount();
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  expect(wrapper.text()).not.toContain('专练「冠词」');
  expect(ideaDismissals('someone-else').ids().size).toBe(0);
  harness.store.state = emptyLearningState('new-owner');
  await nextTick();
  expect(wrapper.get('.idea-empty').text()).toContain('暂时没有新的灵感');
});

const aiReply = {
  success: true,
  requestId: 'ideas_fixture',
  ideas: [{ title: '冠词十分钟', body: '三句话练冠词', draft: '我想先练冠词，请讲要点再出题。', basis: ['w1', 'p1'] }]
};
const aiStore = (suggest) => Object.assign(harness.store, { ideasModelReady: true, suggestIdeas: vi.fn(suggest) });
const today = () => dayKey(NOW, harness.store.state.timezone);

it('summarises saved facts for the model with local refs only and passes the server check', () => {
  const built = ideasModelContext(learningState(), NOW, ['旧标题']);
  expect(built.conversationId).toBe('coach-1');
  expect(built.context).toMatchObject({
    goal: '考研英语一大作文',
    today: 'not_started',
    weaknesses: [{ id: 'w1', label: '冠词', count: 1, advice: '可数名词单数前别漏掉冠词' }],
    phrases: [
      { id: 'p1', text: 'play a vital role in', due: true },
      { id: 'p2', text: 'not only ... but also', due: false }
    ],
    avoid: ['旧标题']
  });
  expect(normalizeIdeasContext(built.context)).toEqual(built.context);
  expect(ideasBasisText(['exam', 'minutes', 'w1'], built.context)).toBe(
    `AI 建议 · 依据${built.context.exam === 'english2' ? '英语二' : '英语一'}、每天的学习时长、薄弱点「冠词」`
  );
  expect(JSON.stringify(built.context)).not.toMatch(/coach-1|f1|card-c1/);
  expect(ideasModelContext(emptyLearningState('nobody'), NOW)).toBe(null);
});

it('asks the own API once a day, labels the reply as an AI suggestion and only prefills a draft', async () => {
  aiStore(async () => aiReply);
  const before = JSON.stringify(harness.store.state);
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  expect(wrapper.get('.idea-status').text()).toContain('正在用你的 API 生成建议');
  await flushPromises();
  expect(harness.store.suggestIdeas).toHaveBeenCalledTimes(1);
  expect(harness.store.suggestIdeas.mock.calls[0][0].weaknesses[0].label).toBe('冠词');
  expect(wrapper.get('.idea-section-title').text()).toBe('AI 建议');
  await wrapper.get('[aria-label="冠词十分钟 的选项"]').trigger('tap');
  expect(wrapper.get('.idea-menu').text()).toContain('AI 建议 · 依据薄弱点「冠词」、句式「play a vital role in」');
  wrapper.unmount();
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  await flushPromises();
  expect(harness.store.suggestIdeas).toHaveBeenCalledTimes(1);
  await wrapper.get('[aria-label="冠词十分钟"]').trigger('tap');
  expect(workspaceDrafts(harness.store).read('ideas-owner', 'chat:new').draft).toBe(aiReply.ideas[0].draft);
  expect(JSON.stringify(harness.store.state)).toBe(before);
  expect(modelIdeas('ideas-owner').recentTitles()).toEqual(['冠词十分钟']);
});

it('shows a failed or interrupted request with a manual retry and never resends on its own', async () => {
  aiStore(async () => ({ success: false, error: 'IDEAS_INVALID' }));
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  await flushPromises();
  expect(wrapper.get('.idea-status').text()).toContain('模型的建议没有通过检查，没有显示');
  wrapper.unmount();
  modelIdeas('ideas-owner').save(today(), { status: 'pending' });
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  await flushPromises();
  expect(harness.store.suggestIdeas).toHaveBeenCalledTimes(1);
  expect(wrapper.get('.idea-status').text()).toContain('上次生成没有完成');
  harness.store.suggestIdeas.mockImplementation(async () => aiReply);
  await wrapper.get('.idea-status button').trigger('tap');
  await flushPromises();
  expect(harness.store.suggestIdeas).toHaveBeenCalledTimes(2);
  expect(wrapper.find('.idea-status').exists()).toBe(false);
  expect(wrapper.text()).toContain('冠词十分钟');
});

it('sends nothing when switched off for this account or without a ready own connection', async () => {
  aiStore(async () => aiReply);
  setIdeasModelEnabled('ideas-owner', false);
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  await flushPromises();
  expect(wrapper.text()).not.toContain('AI 建议');
  setIdeasModelEnabled('ideas-owner', true);
  harness.store.ideasModelReady = false;
  wrapper.unmount();
  wrapper = mount(MuseIdeas, { global: { stubs: { BaseIcon: true } } });
  await flushPromises();
  expect(harness.store.suggestIdeas).not.toHaveBeenCalled();
  harness.store.ideasModelReady = true;
  await flushPromises();
  expect(harness.store.suggestIdeas).toHaveBeenCalledTimes(1);
});
