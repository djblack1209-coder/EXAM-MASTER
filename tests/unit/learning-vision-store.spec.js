import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository, createLearningRepository } from '@/services/learning/learning-repository.js';
import { validateVisualReading } from '../../laf-backend/functions/_shared/learning-vision.js';
import { PAGE_PNG, PAGE_SOURCE, PAGE_READING } from '../fixtures/learning-vision.js';
const api = vi.hoisted(() => ({ generate: vi.fn(), result: vi.fn() }));
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  generateLearningTurn: api.generate,
  fetchLearningResult: api.result
}));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  uni.setStorageSync('EXAM_USER_ID', 'vision-owner');
  uni.setStorageSync('EXAM_TOKEN', 'fixture-only-token');
  api.generate.mockReset();
  api.result.mockReset();
});
afterEach(() => vi.restoreAllMocks());
function setup() {
  const store = useConversationLearningStore();
  store.start('学习图中关系');
  learningRepository.commit({
    id: PAGE_SOURCE.extractionEventId,
    type: 'material.add',
    at: Date.now(),
    data: {
      material: {
        id: PAGE_SOURCE.materialId,
        name: '合成页图',
        fingerprint: 'fixture-vision',
        kind: 'image',
        scope: 'private',
        extractionVersion: PAGE_SOURCE.extractionVersion,
        segments: [
          { id: PAGE_SOURCE.segmentId, page: 1, content: '待校对页图', preview: PAGE_PNG, role: 'source_text' }
        ]
      }
    }
  });
  store.refresh();
  store.structureQuestion(PAGE_SOURCE.materialId, {
    segmentId: PAGE_SOURCE.segmentId,
    prompt: '请核对图中关系',
    type: 'subjective'
  });
  store.models = [
    {
      id: 'fixture-vision',
      provider: 'fixture',
      model: 'explicit',
      source: 'byok',
      configured: true,
      capabilities: { vision: true },
      visionAdapter: 'openai-image-url-v1'
    }
  ];
  store.modelId = 'fixture-vision';
  store.selectedMode = 'cloud';
  store.sharingAllowed = true;
  api.generate.mockImplementation(async (body) => ({
    success: true,
    data: {
      message: '未信任的成功宣称',
      tools: [],
      question: null,
      model: 'explicit',
      modelId: body.modelId,
      requestId: body.requestId,
      requestBinding: body.requestBinding,
      visualReading: validateVisualReading(PAGE_READING, PAGE_SOURCE)
    }
  }));
  return store;
}
it('一次明确图像解读不提交作答或计错；角色与疑义保存在同一对话，刷新和备份保留', async () => {
  const store = setup(),
    plan = JSON.stringify(store.currentPlan);
  await store.interpretQuestionImage(true, { id: 'visual-turn' });
  const body = api.generate.mock.calls[0][0];
  expect(body.images).toEqual([{ dataUrl: PAGE_PNG, source: PAGE_SOURCE }]);
  expect(body.imageShareConsent).toBe(true);
  expect(store.state.attempts).toHaveLength(0);
  expect(JSON.stringify(store.currentPlan)).toBe(plan);
  expect(store.summary.first.denominator).toBe(0);
  const message = store.active.messages.find((m) => m.visualReading);
  expect(message.visualReading.regions.map((r) => r.role)).toContain('user_answer');
  expect(message.content).toContain('待校对');
  expect(message.content).not.toContain('未信任的成功宣称');
  expect(store.active.pendingHints).toHaveLength(1);
  store.refresh();
  expect(store.active.messages.find((m) => m.visualReading)).toEqual(message);
  await store.interpretQuestionImage(true, { id: 'visual-turn' });
  expect(api.generate).toHaveBeenCalledTimes(1);
  const event = store.state.events.find((e) => e.type === 'model.request');
  expect(event.data.visualSource).toEqual(PAGE_SOURCE);
  expect(JSON.stringify(event)).not.toContain('base64');
  const records = new Map();
  const other = createLearningRepository(
    {
      get: (key, fallback) => records.get(key) || fallback,
      save: (key, value) => {
        records.set(key, structuredClone(value));
        return true;
      },
      remove: (key) => records.delete(key)
    },
    () => 'vision-owner'
  );
  const exported = learningRepository.exportData(),
    preview = other.previewRestore(exported);
  other.restoreData(exported, preview.expectedRevision);
  expect(
    other
      .read()
      .conversations.find((c) => c.id === store.active.id)
      .messages.find((m) => m.visualReading)?.visualReading
  ).toEqual(message.visualReading);
});
it('缺授权、文本能力、本地模式、流式或旧提取版本都在发送前拒绝', async () => {
  const store = setup();
  await expect(store.interpretQuestionImage(false)).rejects.toThrow('允许');
  store.selectedMode = 'local';
  await expect(store.interpretQuestionImage(true)).rejects.toThrow('不会自动切换');
  store.selectedMode = 'cloud';
  store.streamEnabled = true;
  await expect(store.interpretQuestionImage(true)).rejects.toThrow('不会自动切换');
  store.streamEnabled = false;
  store.models[0].capabilities.vision = false;
  await expect(store.interpretQuestionImage(true)).rejects.toThrow();
  store.models[0].capabilities.vision = true;
  const material = JSON.parse(JSON.stringify(store.state.materials[0]));
  material.segments[0].content = '重新提取';
  learningRepository.commit({ id: 'new-extraction', type: 'material.add', at: Date.now(), data: { material } });
  store.refresh();
  await expect(store.interpretQuestionImage(true)).rejects.toThrow('提取版本已不可用');
  expect(api.generate).not.toHaveBeenCalled();
  expect(store.state.attempts).toHaveLength(0);
});
it('已有图片结果只读恢复可重开保存；资料删除移除解读正文和来源，不保留假错题', async () => {
  const store = setup();
  api.generate.mockResolvedValueOnce({ success: false, message: '合成断线' });
  await store.interpretQuestionImage(true, { id: 'recover-visual' });
  expect(store.recoverableRequest.visualSource).toEqual(PAGE_SOURCE);
  const request = store.recoverableRequest;
  api.result.mockResolvedValue({
    success: true,
    data: {
      requestId: request.requestId,
      requestBinding: request.binding,
      modelId: request.modelId,
      model: request.model,
      message: '合成恢复',
      tools: [],
      visualReading: validateVisualReading(PAGE_READING, PAGE_SOURCE)
    }
  });
  await store.recoverModelResult();
  expect(api.generate).toHaveBeenCalledTimes(1);
  expect(store.active.messages.filter((m) => m.visualReading)).toHaveLength(1);
  const preview = store.previewMaterialDeletion(PAGE_SOURCE.materialId);
  await store.deleteMaterial(preview, true);
  expect(JSON.stringify(store.state)).not.toContain(PAGE_READING.summary);
  expect(store.state.attempts).toHaveLength(0);
  expect(store.state.materials).toHaveLength(0);
});
it('越权图片响应未执行计划/判分；共享撤销后旧响应不写入', async () => {
  const store = setup();
  api.generate.mockResolvedValueOnce({
    success: true,
    data: {
      message: '成功',
      tools: [{ name: 'plan', arguments: { tasks: [] } }],
      visualReading: validateVisualReading(PAGE_READING, PAGE_SOURCE)
    }
  });
  await store.interpretQuestionImage(true);
  expect(store.error).toContain('未执行');
  let resolve;
  api.generate.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const pending = store.interpretQuestionImage(true);
  store.sharingAllowed = false;
  resolve({
    success: true,
    data: { message: '成功', tools: [], visualReading: validateVisualReading(PAGE_READING, PAGE_SOURCE) }
  });
  await pending;
  expect(store.error).toContain('共享授权');
  expect(store.active.messages.filter((m) => m.visualReading)).toHaveLength(0);
  expect(store.state.attempts).toHaveLength(0);
});
