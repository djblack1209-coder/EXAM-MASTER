import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ProgressOverview from '@/components/business/learning/progress/progress-overview.vue';
import ProgressMindMap from '@/components/business/learning/progress/progress-mind-map.vue';
import Knowledge from '@/pages/learning/knowledge.vue';
import { learningProgressReadModel } from '@/services/learning/learning-progress-read-model.js';
import { progressFixture } from '../fixtures/learning-progress.js';
const harness = vi.hoisted(() => ({ learning: null }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({ useConversationLearningStore: () => harness.learning }));
vi.mock('@dcloudio/uni-app', () => ({ onLoad: vi.fn(), onShow: vi.fn(), onResize: vi.fn() }));
const button = {
  props: ['label', 'selected', 'disabled'],
  emits: ['tap'],
  template: '<button :aria-label="label" :disabled="disabled" @click="$emit(\'tap\')"><slot /></button>'
};
const modal = { props: ['visible'], template: '<section v-if="visible" role="dialog"><slot /></section>' };
const global = { stubs: { BaseButton: button, BaseIcon: true, CustomModal: modal } };
beforeEach(() => {
  setActivePinia(createPinia());
});

describe('progress presentation shares one read model without writing learning facts', () => {
  it('empty and four-event panels display 数据不足 without percentages; sufficient metrics expand exact sources', async () => {
    const wrapper = mount(ProgressOverview, {
      props: { model: learningProgressReadModel(progressFixture(4, 4)) },
      global
    });
    expect(wrapper.text()).toContain('数据不足');
    expect(wrapper.text()).not.toContain('%');
    await wrapper.setProps({ model: learningProgressReadModel(progressFixture()) });
    expect(wrapper.get('[data-metric="语法"]').text()).toContain('67%');
    await wrapper.get('[data-metric="语法"]').trigger('click');
    expect(wrapper.findAll('[data-event-id]')).toHaveLength(6);
    expect(wrapper.get('[data-event-id="receipt-5"]').text()).toContain('合成短句题 6');
    expect(wrapper.get('[data-event-id="receipt-5"]').text()).toContain('BYOK');
    await wrapper.setProps({ model: learningProgressReadModel({ owner: 'other' }) });
    expect(wrapper.find('.progress-trace').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('合成短句题');
    wrapper.unmount();
  });
  it('framework and mind map show the same rubric status; record opens the exact saved original and clears on account change', async () => {
    const state = progressFixture(),
      before = JSON.stringify(state);
    harness.learning = reactive({
      state,
      recordReadState: 'ready',
      recordContext() {
        return this.state.owner;
      },
      refresh: vi.fn()
    });
    const wrapper = mount(Knowledge, { global });
    expect(wrapper.get('[data-node-id="sentence"]').text()).toContain('可改进');
    expect(wrapper.get('[data-node-id="sentence"]').text()).toContain('薄弱点');
    expect(wrapper.get('[data-node-id="sentence"]').classes()).toContain('is-weakness');
    await wrapper.get('[data-node-id="sentence"]').trigger('click');
    expect(wrapper.get('#knowledge-detail').findAll('[data-event-id]')).toHaveLength(6);
    await wrapper.get('#knowledge-detail [data-event-id="receipt-5"] button').trigger('click');
    expect(wrapper.get('[role="dialog"]').text()).toContain('Synthetic answer 5');
    expect(wrapper.get('[data-record-id]').attributes('data-record-id')).toBe(
      '["writing",null,"coach:writing-answer-5"]'
    );
    const mindButton = wrapper.findAll('button').find((item) => item.text() === '思维导图');
    await mindButton.trigger('click');
    expect(wrapper.get('[data-mind-node="sentence"]').text()).toContain('可改进');
    expect(wrapper.find('[draggable="true"]').exists()).toBe(false);
    expect(JSON.stringify(harness.learning.state)).toBe(before);
    harness.learning.state = { ...progressFixture(0, 0), owner: 'other' };
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Synthetic answer 5');
    wrapper.unmount();
  });
  it('mind map only emits selection and has no editing or exercise control', async () => {
    const model = learningProgressReadModel(progressFixture()),
      before = JSON.stringify(model);
    const wrapper = mount(ProgressMindMap, { props: { model }, global });
    expect(wrapper.findAll('[data-mind-node]')).toHaveLength(26);
    await wrapper.get('[data-mind-node="agreement"]').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['agreement']]);
    expect(wrapper.find('input,textarea,[contenteditable],[draggable]').exists()).toBe(false);
    expect(JSON.stringify(model)).toBe(before);
    wrapper.unmount();
  });
});
