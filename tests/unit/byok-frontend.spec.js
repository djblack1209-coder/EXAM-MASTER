import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import Control from '@/components/business/learning/muse-model-control.vue';
import Feedback from '@/components/business/learning/muse-model-feedback.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
const mock = vi.hoisted(() => ({ learning: null }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({ useConversationLearningStore: () => mock.learning }));
let wrapper;
beforeEach(() => {
  setActivePinia(createPinia());
  mock.learning = reactive({
    busy: false,
    intakeBusy: false,
    modelId: 'one',
    sharingAllowed: true,
    needsConnection: false,
    models: [
      { id: 'one', provider: 'A', model: 'model-a', source: 'byok', configured: true, connectionStatus: 'connected' },
      { id: 'two', provider: 'B', model: 'model-b', source: 'byok', configured: true, connectionStatus: 'connected' },
      { id: 'platform', provider: 'Platform', model: 'platform-model', source: 'platform', configured: true }
    ],
    selectModel: vi.fn().mockResolvedValue({ success: true }),
    setSharingAllowed: vi.fn().mockResolvedValue({ success: true }),
    recordContext: () => 'fixture-owner'
  });
});
afterEach(() => wrapper?.unmount());
it('shows the current provider/model and switches only through the saved connection action', async () => {
  wrapper = mount(Control);
  expect(wrapper.text()).toContain('A · model-a');
  expect(wrapper.getComponent(BaseInput).props('options')).toHaveLength(2);
  await wrapper.get('select').setValue('two');
  await flushPromises();
  expect(mock.learning.selectModel).toHaveBeenCalledExactlyOnceWith('two');
  expect(mock.learning.modelId).toBe('one');
});
it('restores the sharing checkbox and persists explicit changes through its Store action', async () => {
  wrapper = mount(Control);
  expect(wrapper.getComponent(BaseCheckbox).props('modelValue')).toBe(true);
  wrapper.getComponent(BaseCheckbox).vm.$emit('update:modelValue', false);
  await flushPromises();
  expect(mock.learning.setSharingAllowed).toHaveBeenCalledExactlyOnceWith(false);
});
it('disables switching while busy and offers a connector entry for an unavailable model', async () => {
  mock.learning.busy = true;
  mock.learning.models[0].connectionStatus = 'failed';
  mock.learning.models[0].lastError = 'MODEL_UNAVAILABLE';
  wrapper = mount(Control);
  expect(wrapper.get('select').attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('型号不存在或已下线');
  mock.learning.busy = false;
  await nextTick();
  await wrapper
    .findAll('button')
    .find((button) => button.text().trim() === 'AI 连接器')
    .trigger('tap');
  expect(wrapper.emitted('connect')).toHaveLength(1);
});
it('does not present unselected models as usable choices', () => {
  mock.learning.models[1].requiresModelSelection = true;
  wrapper = mount(Control);
  expect(
    wrapper
      .getComponent(BaseInput)
      .props('options')
      .map((option) => option.value)
  ).toEqual(['one']);
});
it.each([
  ['NEEDS_CONNECTION', '打开 AI 连接器', 'open_connectors'],
  ['TIMEOUT', '查询原请求', 'query_result'],
  ['COACH_INVALID', '重新评估', 'retry'],
  ['UNSUPPORTED_DISCOVERY', '手填型号', 'manual_model']
])('maps %s into safe text and a working action', async (error, label, type) => {
  wrapper = mount(Feedback, { props: { failure: { error, message: 'untrusted provider response' } } });
  expect(wrapper.text()).not.toContain('untrusted provider response');
  if (error === 'NEEDS_CONNECTION') expect(wrapper.attributes('role')).toBe('status');
  await wrapper.find('button').trigger('tap');
  expect(wrapper.get('button').text().trim()).toBe(label);
  expect(wrapper.emitted('action')[0][0]).toMatchObject({ type });
});
it('shows running, success and failure feedback without exposing raw response text', async () => {
  wrapper = mount(Feedback, { props: { state: { phase: 'running' } } });
  expect(wrapper.text()).toContain('正在处理');
  await wrapper.setProps({ state: { phase: 'succeeded' } });
  expect(wrapper.text()).toContain('已收到结果');
  await wrapper.setProps({ state: { phase: 'failed', errorCode: 'KEY_INVALID' } });
  expect(wrapper.text()).toContain('密钥无效');
});
