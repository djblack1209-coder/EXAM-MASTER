import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import Insights from '@/components/business/learning/muse-saved-library.vue';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
const harness = vi.hoisted(() => ({ store: null }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({ useConversationLearningStore: () => harness.store }));
const modal = {
  props: ['visible', 'title'],
  template: '<section v-if="visible" role="dialog"><h2>{{title}}</h2><slot /></section>'
};
let wrapper;
beforeEach(() => {
  setActivePinia(createPinia());
  const state = emptyLearningState('insight-owner');
  state.conversations.push({
    id: 'c',
    goal: '写作目标',
    at: Date.now(),
    coach: {
      days: [],
      startedDay: '2026-10-20',
      library: [],
      diagnostic: {
        answers: [{ answer: 'Unique original answer.' }],
        feedback: {
          id: 'feedback',
          target: 'diagnostic',
          lines: [
            { original: 'Unique original answer.', advice: '先找主语，再核对动词。', rewrite: 'A suggested rewrite.' }
          ],
          weaknesses: ['主谓一致'],
          strengths: ['目的明确'],
          dimensions: [],
          phrases: []
        }
      }
    }
  });
  harness.store = reactive({
    state,
    calendarTime: Date.now(),
    busy: false,
    recordContext() {
      return this.state.owner;
    },
    observeCalendar: () => ({ show: vi.fn(), dispose: vi.fn() }),
    locateConversation: vi.fn()
  });
  wrapper = mount(Insights, { global: { stubs: { BaseIcon: true, CustomModal: modal } } });
});
afterEach(() => wrapper?.unmount());
describe('Ideas 展开保存反馈而非生成新判断', () => {
  it('薄弱点、优点及建议可展开到原答；查看不改写事实，账户切换立即撤下旧原答', async () => {
    const before = JSON.stringify(harness.store.state);
    expect(wrapper.text()).toContain('目的明确');
    expect(wrapper.text()).toContain('先找主语，再核对动词。');
    await wrapper.get('[aria-label="展开 主谓一致"]').trigger('tap');
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').text()).toContain('Unique original answer.');
    expect(wrapper.get('[role="dialog"]').text()).toContain('AI 评估');
    expect(JSON.stringify(harness.store.state)).toBe(before);
    harness.store.state = emptyLearningState('other-owner');
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Unique original answer.');
    expect(wrapper.text()).not.toContain('主谓一致');
    expect(wrapper.text()).toContain('暂无优点记录');
  });
});
