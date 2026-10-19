import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { testMaterialConnector, parseConnectedMaterial } from '@/services/learning/material-connector.js';
import { questionFromMaterial } from '@/services/learning/material-intake.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import LearningPage from '@/pages/learning/index.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const apple = () => ({
  available: true,
  contract: 'wenli-apple-vision-v1',
  status: 'capabilities_verified',
  runtime: 'macos_connector',
  languages: ['zh-Hans', 'en-US'],
  recognitionState: 'not_tested'
});
const connection = () => ({
  endpoint: 'http://127.0.0.1:8765/parse',
  allowedOrigins: ['http://127.0.0.1:8765'],
  token: 'TEST_ONLY_APPLE_OCR_32_CHARACTER_TOKEN',
  consent: true,
  capabilities: { appleVision: apple() }
});
const input = { size: 4, contentBase64: 'dGVzdA==', allowRecognition: true, recognitionEngine: 'apple-vision' };
const material = (page = 1, nextPage = null) => ({
  id: 'a'.repeat(64),
  fingerprint: 'a'.repeat(64),
  kind: 'pdf',
  name: '合成扫描.pdf',
  scope: 'private',
  recognitionEngine: 'apple-vision',
  recognitionAllowed: true,
  extractionVersion: 'poppler-apple-vision-v1',
  original: { connectorFileId: 'a'.repeat(64) },
  segments: [
    {
      id: 'page-' + page,
      page,
      method: 'apple_vision',
      content: '题目候选 x > 0',
      extractionVersion: 'poppler-apple-vision-v1',
      reviewRequired: true
    }
  ],
  totalPages: 6,
  nextPage
});
function response(data, ok = true) {
  return { ok, text: async () => JSON.stringify({ success: ok, data }) };
}
beforeEach(() => {
  // 保留模块在明确开启时仍须通过原安全和恢复合同。
  vi.stubEnv('VITE_ENABLE_WRITING_COACH', 'false');
  vi.stubEnv('VITE_ENABLE_LEGACY_LEARNING', 'true');
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Apple识别选择与私人资料合同', () => {
  it.each(['preparing', 'failed'])('协议能力存在但%s时不接纳私人识别', async (status) => {
    const value = { ...apple(), readiness: { contract: 'wenli-apple-readiness-v1', status } };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ version: 'v2', ocrEngines: { appleVision: value } }))
    );
    const checked = await testMaterialConnector(connection(), { platform: 'h5' });
    expect(checked.ocrEngines.appleVision.available).toBe(false);
    expect(checked.ocrEngines.appleVision.readiness.status).toBe(status);
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    await expect(
      parseConnectedMaterial(
        { ...connection(), capabilities: { appleVision: checked.ocrEngines.appleVision } },
        input,
        { platform: 'h5' }
      )
    ).rejects.toMatchObject({ code: 'ENGINE_UNAVAILABLE' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([{ status: 'ready' }, { contract: 'wenli-apple-readiness-v1', status: 'unknown' }, 'ready'])(
    '畸形就绪声明不开放Apple：%j',
    async (readiness) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response({ version: 'v2', ocrEngines: { appleVision: { ...apple(), readiness } } }))
      );
      expect((await testMaterialConnector(connection(), { platform: 'h5' })).ocrEngines.appleVision.available).toBe(
        false
      );
    }
  );
  it('准备状态的真实页面禁用Apple选择并保留草稿与事实', async () => {
    const store = useConversationLearningStore();
    store.materialConnection = {
      ...connection(),
      capabilities: {
        appleVision: {
          ...apple(),
          available: false,
          readiness: { contract: 'wenli-apple-readiness-v1', status: 'preparing' }
        }
      }
    };
    const before = JSON.stringify(store.state);
    const wrapper = mount(LearningPage);
    try {
      await wrapper.get('#learning-composer [aria-label="导入资料"]').trigger('tap');
      await wrapper
        .findAll('button')
        .find((w) => w.text() === '解析设置')
        .trigger('tap');
      await wrapper
        .findAll('[role="checkbox"]')
        .find((w) => w.text().includes('识别图片文字'))
        .trigger('tap');
      expect(wrapper.get('[data-test="apple-readiness-status"]').text()).toContain('准备中');
      expect(
        wrapper
          .findAll('button')
          .find((w) => w.text() === 'Apple 识别')
          .attributes('disabled')
      ).toBeDefined();
      expect(JSON.stringify(store.state)).toBe(before);
    } finally {
      wrapper.unmount();
      store.$dispose();
    }
  });
  it('完整页保存只显示实际页数，真实失败页继续给出恢复入口', async () => {
    const store = useConversationLearningStore();
    store.materialConnection = connection();
    let value = { ...material(1), totalPages: 1 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(value))
    );
    const wrapper = mount(LearningPage);
    try {
      await wrapper.get('#learning-composer [aria-label="导入资料"]').trigger('tap');
      await store.importFile(input);
      await flushPromises();
      expect(wrapper.text()).toContain('已处理 1 / 1 页');
      expect(wrapper.text()).not.toContain('失败页仍需重试');
      value = {
        ...material(1),
        totalPages: 1,
        segments: [{ ...material(1).segments[0], content: '', status: 'failed' }]
      };
      await store.importFile(input);
      await flushPromises();
      expect(wrapper.text()).toContain('请继续未完成页，或重试失败页');
      expect(wrapper.findAll('button').some((w) => w.text() === '重试未解析页')).toBe(true);
      expect(store.state.questions).toHaveLength(0);
    } finally {
      wrapper.unmount();
      store.$dispose();
    }
  });
  it.each(['available', 'contract', 'status', 'runtime', 'languages'])('健康回执缺%s不能开放Apple', async (field) => {
    const value = apple();
    delete value[field];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ version: 'v2', ocrEngines: { appleVision: value } }))
    );
    expect((await testMaterialConnector(connection(), { platform: 'h5' })).ocrEngines.appleVision.available).toBe(
      false
    );
  });
  it('旧解析器兼容且能力存在不能宣称识别质量通过', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ version: 'v2', ocrBinaryAvailable: true }))
    );
    const value = await testMaterialConnector(connection(), { platform: 'h5' });
    expect(value.ocrEngines.appleVision.available).toBe(false);
    expect(value.ocrEngines.tesseract.recognitionState).toBe('not_tested');
  });
  it.each([false, 1, 'true', undefined])('Apple许可%s零HTTP', async (allowRecognition) => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    await expect(
      parseConnectedMaterial(connection(), { ...input, allowRecognition }, { platform: 'h5' })
    ).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('未检查当前解析器及未知引擎都零上传', async () => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    const c = connection();
    delete c.capabilities;
    await expect(parseConnectedMaterial(c, input, { platform: 'h5' })).rejects.toMatchObject({
      code: 'ENGINE_UNAVAILABLE'
    });
    await expect(
      parseConnectedMaterial(connection(), { ...input, recognitionEngine: 'cloud' }, { platform: 'h5' })
    ).rejects.toMatchObject({ code: 'ENGINE_UNSUPPORTED' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('批次、续页保留用户选择且只首次传原件', async () => {
    const transport = vi.fn(async (_url, o) =>
      response(material(JSON.parse(o.body).startPage, JSON.parse(o.body).startPage === 1 ? 6 : null))
    );
    vi.stubGlobal('fetch', transport);
    const result = await parseConnectedMaterial(connection(), input, { platform: 'h5' });
    const bodies = transport.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies).toHaveLength(2);
    bodies.forEach((b) => expect(b).toMatchObject({ allowOCR: true, ocrEngine: 'apple-vision' }));
    expect(bodies[0].contentBase64).toBe(input.contentBase64);
    expect(bodies[1].contentBase64).toBeUndefined();
    expect(result.results[1].recognitionEngine).toBe('apple-vision');
  });
  it('Apple失败不会重发或调用默认引擎', async () => {
    const transport = vi.fn(async () => response(null, false));
    vi.stubGlobal('fetch', transport);
    await expect(parseConnectedMaterial(connection(), input, { platform: 'h5' })).rejects.toMatchObject({
      code: 'PARSE_FAILED'
    });
    expect(transport).toHaveBeenCalledOnce();
    expect(JSON.parse(transport.mock.calls[0][1].body).ocrEngine).toBe('apple-vision');
  });
  it('静默换成Tesseract结果拒绝落事实', async () => {
    const value = material();
    value.segments[0].method = 'tesseract';
    const batch = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(value))
    );
    await expect(parseConnectedMaterial(connection(), input, { platform: 'h5', onBatch: batch })).rejects.toMatchObject(
      { code: 'INVALID_RESPONSE' }
    );
    expect(batch).not.toHaveBeenCalled();
  });
  it('默认文字PDF请求形状兼容旧解析器', async () => {
    const transport = vi.fn(async () => response({ ...material(), recognitionEngine: undefined }));
    vi.stubGlobal('fetch', transport);
    await parseConnectedMaterial(connection(), { size: 4, contentBase64: 'dGVzdA==' }, { platform: 'h5' });
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({
      contentBase64: 'dGVzdA==',
      startPage: 1,
      allowOCR: false
    });
  });
  it('同原件换引擎保留旧提取事件和每片段来源版本', async () => {
    const store = useConversationLearningStore();
    store.materialConnection = connection();
    const first = {
      ...material(1),
      recognitionEngine: 'tesseract',
      extractionVersion: 'tesseract-v2',
      segments: [{ id: 'page-1', page: 1, content: '旧片段', extractionVersion: 'tesseract-v2', method: 'tesseract' }]
    };
    let value = first;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(value))
    );
    await store.importFile({ ...input, recognitionEngine: 'tesseract' });
    value = material(6);
    await store.importFile({ ...input, fileId: 'a'.repeat(64), startPage: 6 });
    const saved = store.state.materials[0];
    expect(saved.recognitionEngine).toBe('apple-vision');
    expect(saved.extractions).toHaveLength(2);
    expect(saved.extractionVersion).toBe('poppler-apple-vision-v1');
    expect(saved.segments[0].content).toBe('旧片段');
    const question = questionFromMaterial(
      saved,
      { segmentId: 'page-1', prompt: '旧片段题', type: 'number' },
      'synthetic-q'
    );
    expect(question.source.extractionVersion).toBe('tesseract-v2');
    expect(store.state.events.find((e) => e.type === 'material.add').data.material.recognitionEngine).toBe('tesseract');
    store.$dispose();
  });
  it('续页换解析器拒绝发送原件标识', async () => {
    const store = useConversationLearningStore();
    const value = material(1, 6);
    value.original.connectorOrigin = 'http://127.0.0.1:8765';
    store.commit('material.add', { material: value });
    store.materialConnection = {
      ...connection(),
      endpoint: 'http://127.0.0.1:8766/parse',
      allowedOrigins: ['http://127.0.0.1:8766']
    };
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    await expect(
      store.importFile({ ...input, materialId: value.id, fileId: value.id, startPage: 6 })
    ).rejects.toMatchObject({ code: 'TARGET_MISMATCH' });
    expect(transport).not.toHaveBeenCalled();
    store.$dispose();
  });
  it('实际失败页可从失败位置重试，仍沿用原Apple许可与引擎', async () => {
    const store = useConversationLearningStore();
    store.materialConnection = connection();
    const value = material(3);
    value.segments[0].status = 'failed';
    value.segments[0].content = '';
    store.commit('material.add', { material: value });
    const wrapper = mount(LearningPage);
    const imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    try {
      await wrapper.get('#learning-composer [aria-label="导入资料"]').trigger('tap');
      await wrapper
        .findAll('button')
        .find((w) => w.text().trim() === '重试未解析页')
        .trigger('tap');
      await flushPromises();
      expect(imported).toHaveBeenCalledWith(
        expect.objectContaining({ startPage: 3, recognitionEngine: 'apple-vision', allowRecognition: true })
      );
    } finally {
      wrapper.unmount();
      store.$dispose();
    }
  });
  it('实际页面明确选择且续页沿用原引擎，不随新选择漂移', async () => {
    const store = useConversationLearningStore();
    store.materialConnection = connection();
    store.commit('material.add', { material: material(1, 6) });
    const wrapper = mount(LearningPage);
    const imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    try {
      await wrapper.get('#learning-composer [aria-label="导入资料"]').trigger('tap');
      await wrapper
        .findAll('button')
        .find((w) => w.text().trim() === '解析设置')
        .trigger('tap');
      const label = wrapper.findAll('[role="checkbox"]').find((w) => w.text().includes('识别图片文字'));
      await label.trigger('tap');
      const controls = wrapper.find('[data-test="ocr-engine-choice"]');
      controls.findAll('button').forEach((button) => expect(button.attributes('role')).toBe('button'));
      expect(controls.text()).toContain('Apple 识别');
      expect(controls.findAll('button')[1].attributes('disabled')).toBeUndefined();
      await wrapper
        .findAll('button')
        .find((w) => w.text() === '继续解析后续页')
        .trigger('tap');
      await flushPromises();
      expect(imported).toHaveBeenCalledWith(
        expect.objectContaining({ recognitionEngine: 'apple-vision', allowRecognition: true, startPage: 6 })
      );
      expect(store.state.questions).toHaveLength(0);
    } finally {
      wrapper.unmount();
      store.$dispose();
    }
  });
});
