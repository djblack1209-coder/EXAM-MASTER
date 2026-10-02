import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import LearningPage from '@/pages/learning/index.vue';
import { createLearningRepository } from '@/services/learning/learning-repository.js';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onLoad: vi.fn(), onHide: vi.fn() }));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.stubGlobal('ReadableStream', class {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  uni.setStorageSync('EXAM_USER_ID', 'stream-store-owner');
  uni.setStorageSync('EXAM_TOKEN', 'fixture-only-token');
  const store = useConversationLearningStore();
  store.start('理解函数');
  store.models = [{ id: 'fixture', model: 'explicit', capabilities: { stream: true } }];
  store.modelId = 'fixture';
  store.selectedMode = 'cloud';
  store.sharingAllowed = true;
  store.streamEnabled = true;
  let request,
    waiting,
    closed = false;
  const queue = [];
  const push = (text) => {
    queue.push({ value: new TextEncoder().encode(text), done: false });
    if (waiting) {
      const next = waiting;
      waiting = null;
      next.resolve(queue.shift());
    }
  };
  const end = () => {
    closed = true;
    if (waiting) {
      waiting.resolve({ done: true });
      waiting = null;
    }
  };
  const frame = (name, id, data) => `event: ${name}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
  const fetch = vi.fn(async (_url, options) => {
    request = JSON.parse(options.body);
    options.signal.addEventListener('abort', () => {
      if (waiting) {
        waiting.reject(new Error('fixture abort'));
        waiting = null;
      }
      closed = true;
    });
    return {
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: {
        getReader: () => ({
          read: () =>
            queue.length
              ? Promise.resolve(queue.shift())
              : closed
                ? Promise.resolve({ done: true })
                : new Promise((resolve, reject) => (waiting = { resolve, reject })),
          cancel: vi.fn(),
          releaseLock: vi.fn()
        })
      }
    };
  });
  vi.stubGlobal('fetch', fetch);
  return {
    store,
    fetch,
    push,
    end,
    frame,
    get request() {
      return request;
    },
    preview() {
      push(
        frame('start', 1, { version: 1, requestId: request.requestId, modelId: 'fixture', model: 'explicit' }) +
          frame('preview', 2, { text: '先用一个映射的例子理解函数', provisional: true })
      );
    },
    complete() {
      push(
        frame('result', 3, {
          success: true,
          data: {
            requestId: request.requestId,
            requestBinding: request.requestBinding,
            modelId: 'fixture',
            model: 'explicit',
            message: '每个输入对应唯一输出。',
            tools: [
              {
                name: 'plan',
                arguments: { reason: '先理解再独立检验', tasks: [{ title: '独立说明唯一对应', condition: 'manual' }] }
              }
            ]
          }
        })
      );
      end();
    }
  };
}
it('预览只在临时区域出现，完整终止前无计划/工具/教学事实；重复消息不重扣', async () => {
  const harness = setup(),
    { store } = harness;
  const wrapper = mount(LearningPage, {
    global: {
      stubs: {
        view: { template: '<div><slot /></div>' },
        text: { template: '<span><slot /></span>' },
        LearningShell: { template: '<div><slot /></div>' },
        NumberLine: true,
        BaseIcon: true,
        LearningOverview: true
      }
    }
  });
  const send = store.send('请讲解函数', { id: 'stream-task' });
  await flushPromises();
  harness.preview();
  await flushPromises();
  expect(store.streamPreview).toContain('映射');
  expect(wrapper.text()).toContain('尚未校验，未执行工具');
  expect(store.state.plans).toHaveLength(0);
  expect(store.state.executions).toHaveLength(0);
  expect(store.active.messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
  harness.complete();
  await send;
  await flushPromises();
  expect(store.streamPreview).toBe('');
  expect(store.state.plans).toHaveLength(1);
  expect(store.active.messages.filter((m) => m.role === 'assistant')).toHaveLength(1);
  expect(store.summary.first.denominator).toBe(0);
  await store.send('请讲解函数', { id: 'stream-task' });
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(store.recoverableRequest).toBeNull();
  wrapper.unmount();
});
it('断流仅保存请求意图；重开读取绑定的原结果，两个动作都不重复调用模型', async () => {
  const harness = setup(),
    send = harness.store.send('请讲解函数', { id: 'lost-task' });
  await flushPromises();
  harness.preview();
  harness.end();
  await send;
  expect(harness.store.state.plans).toHaveLength(0);
  expect(harness.store.recoverableRequest.requestId).toBe('lost-task');
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  reopened.selectedMode = 'cloud';
  reopened.modelId = 'fixture';
  reopened.sharingAllowed = true;
  const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
    expect(options.data).toEqual({ action: 'result', requestId: 'lost-task' });
    options.success({
      data: {
        success: true,
        reused: true,
        data: {
          requestId: 'lost-task',
          requestBinding: harness.request.requestBinding,
          modelId: 'fixture',
          model: 'explicit',
          message: '已完成的原教学结果',
          tools: [{ name: 'progress', arguments: {} }]
        }
      }
    });
    return { abort: vi.fn() };
  });
  expect((await reopened.recoverModelResult()).reused).toBe(true);
  expect(reopened.active.messages.at(-1).content).toBe('已完成的原教学结果');
  expect(reopened.state.executions).toHaveLength(1);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(transport).toHaveBeenCalledOnce();
  await expect(reopened.recoverModelResult()).rejects.toThrow('没有');
});
it('上下文已调整、隐私删除/恢复或取消之后，拒绝迟到片段及旧工具', async () => {
  const harness = setup(),
    send = harness.store.send('请讲解函数');
  await flushPromises();
  harness.preview();
  await flushPromises();
  harness.store.sharingAllowed = false;
  harness.complete();
  await send;
  expect(harness.store.state.plans).toHaveLength(0);
  expect(harness.store.streamPreview).toBe('');
  harness.store.sharingAllowed = true;
  harness.store.commit('profile.set', {
    field: 'preference',
    value: '用另一种方法',
    source: 'self_report',
    scope: '当前任务',
    evidenceIds: []
  });
  await expect(harness.store.recoverModelResult()).rejects.toThrow('上下文已变化');
  expect(harness.fetch).toHaveBeenCalledOnce();
  const second = setup(),
    next = second.store.send('请讲解');
  await flushPromises();
  second.preview();
  await flushPromises();
  learningRepository.deleteData();
  second.complete();
  await next;
  expect(second.store.state.plans).toHaveLength(0);
  expect(second.store.state.conversations).toHaveLength(0);
});
it('取消清除临时预览并发送同账户服务端取消，不把取消当零成本成功', async () => {
  const harness = setup();
  const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
    options.success({ data: { success: true, data: { cancellationRecorded: true, status: 'reserved' } } });
    return { abort: vi.fn() };
  });
  const send = harness.store.send('请讲解', { id: 'cancel-task' });
  await flushPromises();
  harness.preview();
  await flushPromises();
  harness.store.cancel();
  await send;
  expect(harness.store.streamPreview).toBe('');
  expect(harness.store.recoverableRequest).toBeNull();
  expect(harness.store.state.plans).toHaveLength(0);
  expect(transport.mock.calls[0][0].data).toEqual({ action: 'cancel', requestId: 'cancel-task' });
  expect(harness.store.error).toContain('取消');
});

it('备份中的请求意图只重建历史；不恢复执行授权或导入密钥', async () => {
  const harness = setup(),
    pending = harness.store.send('请讲解', { id: 'history-only-task' });
  await flushPromises();
  harness.preview();
  harness.end();
  await pending;
  const exported = harness.store.exportData(),
    map = new Map();
  const repository = createLearningRepository(
    {
      get: (key, fallback) => (map.has(key) ? map.get(key) : fallback),
      save: (key, value) => {
        map.set(key, structuredClone(value));
        return true;
      },
      remove: (key) => {
        map.delete(key);
        return true;
      }
    },
    () => 'stream-store-owner'
  );
  const preview = repository.previewRestore(exported);
  repository.restoreData(exported, preview.expectedRevision);
  expect(repository.read().events.find((e) => e.type === 'model.request').data.historyOnly).toBe(true);
  expect(repository.read().attempts).toHaveLength(0);
  expect(repository.read().plans).toHaveLength(0);
  const hostile = JSON.parse(exported);
  hostile.events.find((e) => e.type === 'model.request').data.apiKey = 'fixture-only-secret';
  expect(() => repository.previewRestore(JSON.stringify(hostile))).toThrow('敏感');
  expect(emptyLearningState('stream-store-owner').revision).toBe(0);
});
