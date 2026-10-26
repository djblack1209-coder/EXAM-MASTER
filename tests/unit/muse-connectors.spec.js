import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import Connectors from '@/components/business/learning/muse-ai-connectors.vue';
import {
  MODEL_CONNECTION_PRESETS,
  MODEL_API_KEY_MAX_LENGTH,
  visibleModelChoices
} from '../../laf-backend/functions/_shared/ai-providers/model-endpoints.js';
const harness = vi.hoisted(() => ({ store: null, desktop: false, token: 'synthetic-token', handoff: vi.fn() }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({ useConversationLearningStore: () => harness.store }));
vi.mock('@/services/auth-storage.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getToken: () => harness.token,
  getUserId: () => harness.store?.owner
}));
vi.mock('@/services/desktop/windows.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isDesktopSettingsWindow: () => harness.desktop,
  startDesktopModelIntake: (...args) => harness.handoff(...args)
}));
const modal = {
  props: ['visible', 'title'],
  template:
    '<section v-if="visible" role="dialog"><h2>{{title}}</h2><button class="test-close" @click="$emit(\'cancel\')">关闭</button><slot /></section>'
};
let wrapper;
beforeEach(() => {
  harness.desktop = false;
  harness.token = 'synthetic-token';
  harness.handoff.mockReset().mockResolvedValue(undefined);
  setActivePinia(createPinia());
  harness.store = reactive({
    owner: 'one',
    busy: false,
    models: [],
    modelPresets: [],
    loadModels: vi.fn().mockResolvedValue({ success: true }),
    saveModel: vi.fn(),
    selectedConversationId: null,
    beginModelIntake: vi.fn().mockResolvedValue({ success: true }),
    removeModel: vi.fn(),
    modelId: '',
    selectedMode: '',
    recordContext() {
      return this.owner;
    }
  });
  wrapper = mount(Connectors, { global: { stubs: { BaseIcon: true, CustomModal: modal } } });
});
afterEach(() => wrapper?.unmount());
const tap = async (name) => {
  if (name === 'DeepSeek deepseek-flash') {
    const row = wrapper.findAll('.connect-row').find((row) => row.text().includes('DeepSeek'));
    await row.get('button').trigger('tap');
    await flushPromises();
    return;
  }
  const node = wrapper.findAll('button').find((button) => button.text().replace(/\s/g, '') === name.replace(/\s/g, ''));
  expect(node).toBeTruthy();
  await node.trigger('tap');
  await flushPromises();
};
describe('Muse 原版式 AI 连接器', () => {
  it('中国九家未连接入口保留，外国和未知提供商仅显示已有配置且不按模型名归属', async () => {
    const names = [
      '智谱',
      '通义千问（阿里云百炼）',
      'DeepSeek',
      '豆包（火山方舟）',
      '腾讯混元',
      '月之暗面 Kimi',
      'MiniMax',
      '百川智能',
      'SiliconFlow'
    ];
    const displayed = () => wrapper.findAll('.connect-row').map((row) => row.text());
    for (const name of names) expect(displayed().some((row) => row.includes(name))).toBe(true);
    expect(displayed().some((row) => /OpenRouter|Groq|Z\.ai|Gemini/.test(row))).toBe(false);
    harness.store.modelPresets = [
      {
        id: 'unconnected-hosted',
        provider: 'OpenRouter',
        model: 'DeepSeek-GLM',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
      },
      {
        id: 'unknown-cn-domain',
        provider: '自定义未核实',
        model: 'Qwen-GLM',
        endpoint: 'https://unknown.example.cn/v1/chat/completions'
      }
    ];
    await nextTick();
    expect(displayed().some((row) => /OpenRouter|自定义未核实/.test(row))).toBe(false);
    const saved = {
      id: 'existing-router',
      provider: 'OpenRouter',
      model: 'DeepSeek-GLM',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      source: 'byok',
      configured: true,
      connectionStatus: 'untested',
      capabilities: { stream: false }
    };
    harness.store.models = [saved];
    harness.store.modelId = saved.id;
    const before = JSON.stringify({ models: harness.store.models, selected: harness.store.modelId });
    await nextTick();
    const row = wrapper.findAll('.connect-row').find((item) => item.text().includes('OpenRouter'));
    expect(row.text()).toContain('已配置 · 未验证');
    expect(visibleModelChoices(harness.store.modelPresets, [])).toEqual([]);
    expect(visibleModelChoices(MODEL_CONNECTION_PRESETS, []).some((item) => item.provider === 'Z.ai')).toBe(false);
    expect(visibleModelChoices([saved], harness.store.models)).toEqual([saved]);
    await row.get('button').trigger('tap');
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').text()).toContain(saved.model);
    await tap('正在使用');
    expect(harness.store.beginModelIntake).toHaveBeenCalledExactlyOnceWith(saved.id);
    expect(harness.store.saveModel).not.toHaveBeenCalled();
    expect(harness.store.removeModel).not.toHaveBeenCalled();
    expect(JSON.stringify({ models: harness.store.models, selected: harness.store.modelId })).toBe(before);
    harness.store.models[0].connectionStatus = 'connected';
    await nextTick();
    expect(displayed().find((item) => item.includes('OpenRouter'))).toContain('最近请求成功');
  });
  it('读取失败时给出重试，不把未读出的连接显示为暂无连接', async () => {
    harness.store.modelListState = { phase: 'error', message: '连接暂时未读出' };
    await tap('已连接');
    expect(wrapper.get('[role="alert"]').text()).toContain('连接暂时未读出');
    expect(wrapper.text()).not.toContain('暂无连接');
    const before = harness.store.loadModels.mock.calls.length;
    await tap('重新读取连接');
    expect(harness.store.loadModels).toHaveBeenCalledTimes(before + 1);
  });
  it('国内连接可无密钥明确添加并稍后填写，不选中、不开始建档、不进入已连接列表', async () => {
    const row = () => wrapper.findAll('.connect-row').find((item) => item.text().includes('智谱'));
    await row().get('button').trigger('tap');
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').text()).toContain('添加不会调用模型');
    harness.store.modelId = 'existing-selection';
    harness.store.saveModel.mockImplementation(async (profile) => {
      expect(profile.apiKey).toBe('');
      harness.store.models.push({ ...profile, apiKey: undefined, source: 'byok', configured: false });
      return { success: true, data: { keySaved: false } };
    });
    await wrapper.get('.connect-form button').trigger('tap');
    await flushPromises();
    expect(harness.store.saveModel).toHaveBeenCalledOnce();
    expect(harness.store.modelId).toBe('existing-selection');
    expect(harness.store.beginModelIntake).not.toHaveBeenCalled();
    expect(harness.handoff).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('已添加，可稍后填写密钥');
    expect(row().text()).toContain('未连接');
    await tap('已连接');
    expect(wrapper.findAll('.connect-row')).toHaveLength(0);
    await tap('可用');
    await row().get('button').trigger('tap');
    await flushPromises();
    expect(wrapper.get('input[type="password"]').element.value).toBe('');
    expect(wrapper.get('[role="dialog"]').text()).not.toContain('使用此模型');
    expect(wrapper.get('.connect-form').findAll('button').at(-1).attributes('disabled')).toBeDefined();
  });
  it('新智谱连接保留已声明的流式能力，选择后启用受支持的真实流式通道', async () => {
    await wrapper
      .findAll('.connect-row')
      .find((row) => row.text().includes('智谱'))
      .get('button')
      .trigger('tap');
    await flushPromises();
    expect(wrapper.get('.connect-form input[aria-label="模型"]').element.value).toBe('glm-5.3');
    expect(wrapper.get('input[type="password"]').attributes('autocomplete')).toBe('off');
    expect(wrapper.get('input[type="password"]').attributes('maxlength')).toBe(String(MODEL_API_KEY_MAX_LENGTH));
    harness.store.streamSupported = true;
    harness.store.saveModel.mockResolvedValue({ success: true });
    const syntheticLongKey = 'synthetic-only-'.padEnd(1207, 'x');
    await wrapper.get('input[type="password"]').setValue(syntheticLongKey);
    expect(wrapper.get('[role="dialog"]').text()).toContain('运维可解密');
    await wrapper
      .get('.connect-form')
      .findAll('button')
      .find((button) => button.text() === '连接')
      .trigger('tap');
    await flushPromises();
    expect(harness.store.saveModel.mock.calls[0][0]).toMatchObject({ model: 'glm-5.3', stream: true });
    expect(harness.store.saveModel.mock.calls[0][0].apiKey).toBe(syntheticLongKey);
    expect(harness.store.streamEnabled).toBe(true);
  });
  it('更换已有密钥时保留原来明确关闭的流式能力', async () => {
    harness.store.models = [
      {
        id: 'saved-zhipu',
        provider: '智谱',
        model: 'glm-4.7-flash',
        source: 'byok',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        configured: true,
        capabilities: { structured: true, stream: false }
      }
    ];
    await nextTick();
    await wrapper
      .findAll('.connect-row')
      .find((row) => row.text().includes('智谱'))
      .get('button')
      .trigger('tap');
    await flushPromises();
    await tap('更换密钥');
    expect(wrapper.findAll('.connect-form button').at(-1).text()).toBe('保存并连接');
    expect(wrapper.findAll('.connect-form button').at(-1).attributes('disabled')).toBeDefined();
    harness.store.saveModel.mockResolvedValue({ success: true });
    await wrapper.get('input[type="password"]').setValue('synthetic-key');
    await wrapper
      .get('.connect-form')
      .findAll('button')
      .find((button) => button.text() === '保存并连接')
      .trigger('tap');
    await flushPromises();
    expect(harness.store.saveModel.mock.calls[0][0].stream).toBe(false);
    expect(harness.store.streamEnabled).toBe(false);
  });
  it('未登录在输入密钥前说明登录要求，不静默跳转或保存连接', async () => {
    harness.token = '';
    await tap('DeepSeek deepseek-flash');
    expect(wrapper.get('[role="dialog"]').text()).toContain('登录后才能连接 AI 老师');
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(harness.store.saveModel).not.toHaveBeenCalled();
    expect(uni.navigateTo).not.toHaveBeenCalled();
  });
  it('跨窗口连接未收到成功回执时，保留管理窗口和失败说明', async () => {
    harness.desktop = true;
    harness.handoff.mockRejectedValue(new Error('主窗口连接失败'));
    await tap('DeepSeek deepseek-flash');
    await wrapper.get('input[type="password"]').setValue('synthetic-api-key');
    harness.store.saveModel.mockResolvedValue({ success: true });
    await wrapper
      .get('.connect-form')
      .findAll('button')
      .find((button) => button.text() === '连接')
      .trigger('tap');
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').text()).toContain('模型尚未启用');
    expect(wrapper.get('input[type="password"]').element.value).toBe('');
    expect(harness.store.beginModelIntake).not.toHaveBeenCalled();
  });
  it('原生设置窗口将首问交给主窗口，不在只读窗口写入学习事实或传递密钥', async () => {
    harness.desktop = true;
    await tap('DeepSeek deepseek-flash');
    await wrapper.get('input[type="password"]').setValue('synthetic-api-key');
    harness.store.saveModel.mockResolvedValue({ success: true });
    await wrapper
      .get('.connect-form')
      .findAll('button')
      .find((button) => button.text() === '连接')
      .trigger('tap');
    await flushPromises();
    expect(harness.store.saveModel).toHaveBeenCalledOnce();
    expect(harness.handoff).toHaveBeenCalledExactlyOnceWith('deepseek-flagship', 'one');
    expect(harness.store.beginModelIntake).not.toHaveBeenCalled();
    expect(harness.store.modelId).toBe('');
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
  });
  it('连接草稿只在明确授权后保存，关闭即清除密钥，保留用户模型并沿原选择路径建档', async () => {
    await tap('DeepSeek deepseek-flash');
    const input = wrapper.get('input[type="password"]');
    await input.setValue('synthetic-api-key');
    expect(harness.store.saveModel).not.toHaveBeenCalled();
    expect(wrapper.get('.connect-form').findAll('input')).toHaveLength(2);
    expect(wrapper.text()).not.toMatch(/请求地址|API端点|高级/);
    await wrapper.get('.test-close').trigger('click');
    await tap('DeepSeek deepseek-flash');
    expect(wrapper.get('input[type="password"]').element.value).toBe('');
    await wrapper.get('input[type="password"]').setValue('synthetic-api-key');
    await wrapper.get('.connect-form input[aria-label="模型"]').setValue('synthetic-owned-model');
    harness.store.saveModel.mockImplementation(async (profile, consent) => {
      expect(consent).toBe(true);
      harness.store.models.push({ ...profile, source: 'byok', configured: true, apiKey: undefined });
      return { success: true };
    });
    await wrapper
      .get('.connect-form')
      .findAll('button')
      .find((button) => button.text() === '连接')
      .trigger('tap');
    await flushPromises();
    expect(harness.store.saveModel).toHaveBeenCalledOnce();
    expect(harness.store.saveModel.mock.calls[0][0].model).toBe('synthetic-owned-model');
    expect(harness.store.modelId).toBe('deepseek-flagship');
    expect(harness.store.beginModelIntake).toHaveBeenCalledExactlyOnceWith('deepseek-flagship');
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('synthetic-api-key');
  });
  it('账户切换立即撤销旧连接草稿与密钥，不向新账户保存', async () => {
    await tap('DeepSeek deepseek-flash');
    await wrapper.get('input[type="password"]').setValue('synthetic-old-key');
    harness.store.owner = 'two';
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(harness.store.saveModel).not.toHaveBeenCalled();
    await tap('DeepSeek deepseek-flash');
    expect(wrapper.get('input[type="password"]').element.value).toBe('');
  });
});
