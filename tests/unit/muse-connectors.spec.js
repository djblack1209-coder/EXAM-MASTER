import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import Connectors from '@/components/business/learning/muse-ai-connectors.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import { MODEL_API_KEY_MAX_LENGTH } from '../../laf-backend/functions/_shared/ai-providers/model-endpoints.js';
const harness = vi.hoisted(() => ({ store: null, token: 'synthetic-token' }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({ useConversationLearningStore: () => harness.store }));
vi.mock('@/services/auth-storage.js', async (original) => ({ ...(await original()), getToken: () => harness.token }));
const modal = {
  props: ['visible', 'title'],
  template:
    '<section v-if="visible" role="dialog"><h2>{{title}}</h2><button class="test-close" @click="$emit(\'cancel\')">关闭</button><slot /></section>'
};
let wrapper;
const saved = (id = 'one', extra = {}) => ({
  id,
  provider: 'DeepSeek',
  endpoint: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-flash',
  source: 'byok',
  configured: true,
  capabilities: { structured: true, stream: false },
  connectionStatus: 'connected',
  ...extra
});
beforeEach(() => {
  harness.token = 'synthetic-token';
  setActivePinia(createPinia());
  harness.store = reactive({
    owner: 'owner-a',
    busy: false,
    intakeBusy: false,
    models: [],
    modelPresets: [],
    modelId: '',
    needsConnection: true,
    connectionGuide: { message: '请先连接自己的 API' },
    modelListState: { phase: 'ready' },
    loadModels: vi.fn().mockResolvedValue({ success: true }),
    selectModel: vi.fn().mockResolvedValue({ success: true }),
    testModel: vi.fn().mockResolvedValue({ success: true }),
    recoverConnectionTest: vi.fn().mockResolvedValue({ success: true }),
    beginModelIntake: vi.fn(),
    loadModelDiscovery: vi
      .fn()
      .mockResolvedValue({ success: true, data: { models: [{ modelId: 'live-model', displayName: '实时型号' }] } }),
    removeModel: vi.fn().mockResolvedValue({ success: true }),
    recordContext() {
      return this.owner;
    },
    saveModel: vi.fn(async (profile) => {
      const old = harness.store.models.find((model) => model.id === profile.id);
      harness.store.models = [
        ...harness.store.models.filter((model) => model.id !== profile.id),
        {
          ...saved(profile.id),
          ...profile,
          apiKey: undefined,
          configured: Boolean(profile.apiKey || old?.configured),
          capabilities: { structured: profile.structured, stream: profile.stream }
        }
      ];
      return { success: true };
    })
  });
  wrapper = mount(Connectors, { global: { stubs: { BaseIcon: true, CustomModal: modal } } });
});
afterEach(() => wrapper?.unmount());
async function tap(label) {
  const node = wrapper.findAll('button').find((button) => button.text().trim() === label);
  expect(node, label).toBeTruthy();
  await node.trigger('tap');
  await flushPromises();
}
async function add(provider = 'deepseek') {
  await wrapper.get(`[data-provider-id="${provider}"] button`).trigger('tap');
  await flushPromises();
}
async function manage(id = 'one') {
  await wrapper.get(`[data-connection-id="${id}"] button`).trigger('tap');
  await flushPromises();
}

describe('BYOK two-step connector UI', () => {
  it('offers provider choices, shows multiple saved connections and filters platform models', async () => {
    harness.store.models = [
      saved(),
      saved('two', {
        provider: 'OpenRouter',
        model: 'exact-free-model',
        connectionStatus: 'failed',
        lastError: 'KEY_INVALID'
      }),
      { ...saved('platform'), source: 'platform' }
    ];
    harness.store.modelId = 'one';
    await nextTick();
    expect(wrapper.findAll('[data-connection-id]')).toHaveLength(2);
    expect(wrapper.text()).toContain('正在使用');
    expect(wrapper.text()).toContain('密钥无效');
    expect(wrapper.find('[data-connection-id="platform"]').exists()).toBe(false);
    expect(wrapper.find('[data-provider-id="openrouter"]').exists()).toBe(true);
  });
  it('saves a key before discovery, requires an explicit model choice and never starts inference on selection', async () => {
    await add();
    expect(wrapper.get('input[type="password"]').attributes('maxlength')).toBe(String(MODEL_API_KEY_MAX_LENGTH));
    expect(wrapper.get('input[type="password"]').attributes('autocomplete')).toBe('off');
    await wrapper.get('input[type="password"]').setValue('fixture-only-private-key');
    await tap('保存并读取型号');
    const first = harness.store.saveModel.mock.calls[0][0];
    expect(first).toMatchObject({ model: '', requiresModelSelection: true, apiKey: 'fixture-only-private-key' });
    expect(harness.store.loadModelDiscovery).toHaveBeenCalledExactlyOnceWith({ profileId: first.id, refresh: true });
    expect(harness.store.selectModel).not.toHaveBeenCalled();
    await wrapper.get('select').setValue('live-model');
    await tap('保存并使用');
    expect(harness.store.saveModel.mock.calls[1][0]).toMatchObject({
      model: 'live-model',
      requiresModelSelection: false
    });
    expect(harness.store.saveModel.mock.calls[1][0]).not.toHaveProperty('apiKey');
    expect(harness.store.selectModel).toHaveBeenCalledWith(first.id);
    expect(harness.store.beginModelIntake).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('fixture-only-private-key');
  });
  it('maps discovery failure into safe Chinese feedback and keeps manual model entry', async () => {
    harness.store.models = [saved()];
    harness.store.loadModelDiscovery.mockResolvedValue({
      success: false,
      errorCode: 'UNSUPPORTED_DISCOVERY',
      message: 'untrusted upstream text'
    });
    await nextTick();
    await manage();
    await tap('换型号');
    expect(wrapper.text()).toContain('请手填型号');
    expect(wrapper.text()).not.toContain('untrusted upstream text');
    const field = wrapper.findAllComponents(BaseInput).find((input) => input.props('label') === '手填型号');
    await field.vm.$emit('update:modelValue', 'manual-id');
    await tap('保存型号');
    expect(harness.store.saveModel).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'one', model: 'manual-id' }),
      true
    );
  });
  it('retains a saved key when the replacement field is blank and preserves capabilities', async () => {
    harness.store.models = [saved()];
    await nextTick();
    await manage();
    await tap('换密钥');
    await tap('保存密钥');
    expect(harness.store.saveModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'one', apiKey: '', stream: false }),
      true
    );
    expect(harness.store.beginModelIntake).not.toHaveBeenCalled();
  });
  it('keeps testing and disconnecting explicit and displays safe failure actions', async () => {
    harness.store.models = [saved()];
    harness.store.testModel.mockResolvedValue({
      success: false,
      error: 'TIMEOUT',
      requestId: 'original-test-request',
      message: 'vendor message must not be rendered'
    });
    await nextTick();
    await manage();
    await tap('测试');
    expect(harness.store.testModel).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('请先查询原请求');
    expect(wrapper.text()).not.toContain('vendor message');
    await tap('查询原请求');
    expect(harness.store.testModel).toHaveBeenCalledOnce();
    expect(harness.store.recoverConnectionTest).toHaveBeenCalledWith('one', 'original-test-request');
    await tap('断开');
    expect(harness.store.removeModel).not.toHaveBeenCalled();
    wrapper
      .findAllComponents(modal)
      .find((item) => item.props('title') === '断开此连接？')
      .vm.$emit('confirm');
    await flushPromises();
    expect(harness.store.removeModel).toHaveBeenCalledWith('one');
  });
  it('blocks connection changes while teaching is busy', async () => {
    harness.store.busy = true;
    await nextTick();
    expect(wrapper.get('[data-provider-id="deepseek"] button').attributes('disabled')).toBeDefined();
    expect(harness.store.saveModel).not.toHaveBeenCalled();
  });
  it('revokes the key draft on identity change and asks for login before accepting credentials', async () => {
    await add();
    await wrapper.get('input[type="password"]').setValue('fixture-only-private-key');
    harness.store.owner = 'owner-b';
    await nextTick();
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(harness.store.saveModel).not.toHaveBeenCalled();
    harness.token = '';
    await add();
    expect(wrapper.text()).toContain('登录后连接自己的 API');
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
  });
});
