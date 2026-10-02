import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  parsePastedMaterial,
  questionFromMaterial,
  correctMaterialQuestion,
  parserCapability,
  structureMaterialCandidate
} from '@/services/learning/material-intake.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { validateLocalConnector } from '@/services/learning/local-connector.js';
import { storageService } from '@/services/storageService.js';
import { parseConnectedMaterial } from '@/services/learning/material-connector.js';
import { activateLearningButton } from '@/services/learning/keyboard-controls.js';
import { mount, flushPromises } from '@vue/test-utils';
import LearningPage from '@/pages/learning/index.vue';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { learningRequest } from '@/services/api/domains/learning.api.js';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn() }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('私人资料和实际 Store 纵向闭环', () => {
  it('未可靠判分的明确作答继续请求辅助评估，模型判断不能增加可靠首答或错题', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'assist-owner');
    uni.setStorageSync('EXAM_TOKEN', 'isolated-placeholder-token');
    const store = useConversationLearningStore();
    store.start('理解函数');
    store.commit('question.add', {
      question: {
        id: 'generated',
        version: 1,
        prompt: '说明函数的含义',
        scope: 'generated',
        subject: '数学',
        knowledgePoint: '函数',
        source: { kind: 'generated', verified: false }
      }
    });
    store.focus('generated@1');
    store.modelId = 'explicit-model';
    store.selectedMode = 'cloud';
    store.sharingAllowed = true;
    const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
      const attempt = options.data.learningContext.attempt;
      options.success({
        data: {
          success: true,
          data: {
            message: '按唯一对应的维度给出辅助反馈，仍需要独立复核。',
            tools: [
              {
                name: 'assess',
                arguments: {
                  attemptId: attempt.id,
                  outcome: 'correct',
                  dimensions: [{ name: '对应关系', feedback: '明确唯一对应' }],
                  feedback: '待复核'
                }
              }
            ]
          }
        }
      });
      return { abort: vi.fn() };
    });
    try {
      await store.send('我的答案是每个输入对应唯一输出');
      expect(transport).toHaveBeenCalledOnce();
      expect(store.state.attempts).toHaveLength(1);
      expect(store.state.attempts[0].assistance[0]).toMatchObject({
        status: 'ai_assisted',
        basis: 'model_judgment_only',
        reviewRequired: true
      });
      expect(store.summary.first.denominator).toBe(0);
      expect(store.summary.mistakes).toHaveLength(0);
    } finally {
      transport.mockRestore();
    }
  });
  it('请求层在发送前再次核对账户，不用新账户令牌传输旧用户内容', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'owner-after');
    uni.setStorageSync('EXAM_TOKEN', 'isolated-placeholder-token');
    const transport = vi.spyOn(uni, 'request');
    try {
      const result = await learningRequest(
        '/learning-sync',
        { action: 'push', operations: [] },
        { expectedOwner: 'owner-before' }
      );
      expect(result).toMatchObject({ success: false, code: 409 });
      expect(transport).not.toHaveBeenCalled();
    } finally {
      transport.mockRestore();
    }
  });
  it('账户切换后的迟到用量响应不会泄露前一用户的费用记录', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'owner-before');
    uni.setStorageSync('EXAM_TOKEN', 'isolated-placeholder-token');
    const store = useConversationLearningStore();
    let request;
    const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
      request = options;
      return { abort: vi.fn() };
    });
    try {
      const result = store.loadUsage();
      const rejected = expect(result).rejects.toThrow('用户已切换');
      uni.setStorageSync('EXAM_USER_ID', 'owner-after');
      store.refresh();
      request.success({ data: { success: true, data: { cost: { spent: 123 } } } });
      await rejected;
      expect(store.state.owner).toBe('owner-after');
      expect(store.usage).toBeNull();
    } finally {
      transport.mockRestore();
    }
  });
  it('登录的通用旧键迁移不冒领游客学习记录，退出后原记录仍可读取', () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const original = JSON.parse(store.exportData());
    uni.setStorageSync('EXAM_USER_ID', 'signed-in-owner');
    storageService.migrateUserKeys();
    store.refresh();
    expect(store.state.owner).toBe('signed-in-owner');
    expect(store.state.conversations).toHaveLength(0);
    uni.removeStorageSync('EXAM_USER_ID');
    store.refresh();
    expect(JSON.parse(store.exportData())).toEqual(original);
  });
  // Full-page render + persistent records/FSRS, separate from the provider's network budget.
  it('实际页面写入失败保留答案，重试成功才清空，并只保存一次作答', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const wrapper = mount(LearningPage, {
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          'scroll-view': { template: '<div><slot /></div>' },
          LearningOverview: { template: '<aside />' }
        }
      }
    });
    const commit = vi.spyOn(learningRepository, 'commit');
    try {
      const input = wrapper.find('textarea');
      await input.setValue('19');
      const send = wrapper.findAll('button').find((button) => button.text() === '发送');
      commit.mockImplementationOnce(() => {
        throw new Error('另一窗口正在保存学习记录');
      });
      await send.trigger('tap');
      await flushPromises();
      expect(input.element.value).toBe('19');
      expect(wrapper.text()).toContain('另一窗口正在保存');
      expect(store.state.attempts).toHaveLength(0);
      await send.trigger('tap');
      await flushPromises();
      expect(input.element.value).toBe('');
      expect(store.state.attempts).toHaveLength(1);
      expect(store.state.attempts[0].grade.outcome).toBe('wrong');
    } finally {
      commit.mockRestore();
      wrapper.unmount();
    }
  }, 40000);
  it('H5 键盘只激活当前学习区域内的可用按钮一次，不能从输入框或禁用按钮误提交', () => {
    const root = document.createElement('div');
    const button = document.createElement('uni-button');
    button.setAttribute('role', 'button');
    const input = document.createElement('textarea');
    root.append(button, input);
    const click = vi.fn();
    button.addEventListener('click', click);
    const event = {
      key: 'Enter',
      target: button,
      currentTarget: root,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };
    activateLearningButton(event);
    expect(click).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    activateLearningButton({ ...event, target: input });
    button.setAttribute('disabled', '');
    activateLearningButton(event);
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('模型繁忙时仍执行用户停止意愿，而不是静默忽略', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.busy = true;
    await store.send('停止当前任务');
    expect(store.active.stopped).toBe(true);
    expect(store.active.messages.at(-1).content).toContain('已停止');
  });
  it('图示给出解题结果也属于提示，随后答对不冒充独立掌握', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    await store.send('19');
    await store.send('用图示讲解');
    await store.send('20');
    expect(store.state.attempts[1].hints).toHaveLength(1);
    expect(store.state.attempts[1].kind).toBe('revision');
    expect(store.summary.first.denominator).toBe(1);
    expect(store.summary.knowledge['数学 / 整数运算'].status).toBe('需提示');
  });
  it('已收到响应头但正文停滞时，解析预算仍然取消请求', async () => {
    vi.useFakeTimers();
    let aborted = false;
    vi.stubGlobal('fetch', async (_url, options) => ({
      ok: true,
      text: () =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(new Error('正文请求已取消'));
            },
            { once: true }
          );
        })
    }));
    const request = parseConnectedMaterial(
      {
        endpoint: 'http://127.0.0.1:8765/parse',
        allowedOrigins: ['http://127.0.0.1:8765'],
        token: 't'.repeat(32),
        consent: true
      },
      { size: 10, name: 'test.pdf', contentBase64: 'test' },
      { platform: 'h5' }
    );
    const rejection = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(35001);
    await rejection;
    expect(aborted).toBe(true);
  });
  it('只按明确标签提取题干/作答/批注/参考角色，未知区域仍待校对', () => {
    const candidate = structureMaterialCandidate({
      content: '题目：2+2是多少？\nA.3\nB.4\n我答：A\n教师批注：检查加法\n答案：B',
      reviewRequired: true
    });
    expect(candidate).toMatchObject({
      prompt: '2+2是多少？',
      userAnswer: 'A',
      annotation: '检查加法',
      reference: 'B',
      rolesConfirmed: false
    });
    expect(candidate.uncertainties).toHaveLength(1);
  });
  it('直接讲解实际执行并记录提示，修正与重做不同；调整目标影响后续任务', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    await store.send('19');
    await store.send('直接讲解');
    await store.send('20');
    expect(store.state.attempts[1].kind).toBe('revision');
    expect(store.state.attempts[1].parentAttemptId).toBe(store.state.attempts[0].id);
    expect(store.state.attempts[1].hints).toHaveLength(1);
    expect(store.summary.first.denominator).toBe(1);
    expect(store.summary.knowledge['数学 / 整数运算'].status).toBe('需提示');
    await store.send('调整目标：理解函数');
    expect(store.active.goal).toBe('理解函数');
  });
  it('材料、参考答案、手写作答、批注与校对版本分开；不自动公开或判错', () => {
    const m = parsePastedMaterial('题目：求速度。\n我答：3\n教师批注：单位\n答案：3m/s', 'm');
    const q = questionFromMaterial(
      m,
      {
        segmentId: m.segments[0].id,
        prompt: '求速度',
        type: 'number',
        reference: '3m/s',
        userAnswer: '3',
        annotation: '单位',
        uncertainties: [{ field: '单位', resolved: false }]
      },
      'q'
    );
    expect(q.validation).toBeNull();
    expect(q.reference.verified).toBe(false);
    expect(q.importedAnswer).toBe('3');
    const fixed = correctMaterialQuestion(q, { prompt: '求速度，单位 m/s', uncertainties: [] }, '原图单位已确认');
    expect(fixed.version).toBe(2);
    expect(fixed.source).toEqual(q.source);
    expect(q.prompt).toBe('求速度');
    expect(parserCapability('wechat').appleVision).toBe('unavailable');
  });
  it('不连接模型也可提出目标、工具出题、聊天作答、错题归档、重开、切换模型与变式', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    await store.send('19', { id: 'turn1' });
    expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
    expect(store.summary.mistakes).toHaveLength(1);
    expect(store.summary.tasks.rate).toBe(1);
    await store.send('19', { id: 'turn1' });
    expect(store.state.attempts).toHaveLength(1);
    const q = store.activeQuestion;
    store.generateVariant();
    expect(store.activeQuestion.parentQuestionKey).toBe(`${q.id}@1`);
    store.modelId = 'different';
    store.selectedMode = 'cloud';
    setActivePinia(createPinia());
    const reopened = useConversationLearningStore();
    expect(reopened.summary.mistakes).toHaveLength(1);
    expect(reopened.state.conversations).toHaveLength(1);
    expect(JSON.parse(reopened.exportData()).attempts[0].answer).toBe('19');
  });
  it('无资料或模型时保留真实目标，不伪造助手回复；明确指令改变持久状态', async () => {
    const store = useConversationLearningStore();
    await store.send('理解抽象函数');
    expect(store.active.goal).toBe('理解抽象函数');
    expect(store.active.messages.some((m) => m.role === 'assistant')).toBe(false);
    await store.send('直接讲解');
    expect(store.state.strategy.method).toBe('explain');
    await store.send('停止当前任务');
    expect(store.active.stopped).toBe(true);
  });
  it('本地连接需明确授权和目标白名单，密钥不进入学习导出', () => {
    expect(() => validateLocalConnector('http://127.0.0.1:8765/chat', ['http://127.0.0.1:8765'], false)).toThrow(
      '明确授权'
    );
    expect(() => validateLocalConnector('http://evil.local/chat', ['http://127.0.0.1:8765'], true)).toThrow('清单');
    const store = useConversationLearningStore();
    store.localConnection = { token: 'test-only-private-token' };
    store.start('目标');
    expect(store.exportData()).not.toContain('test-only-private-token');
    expect(storageService.get('conversation_learning_v1', {}).owner).toBe('guest');
  });
});

describe('资料重试、来源版本与真正取消', () => {
  it('相同批次重试去重，重新提取的新内容保留历史证据并更新当前片段', async () => {
    const store = useConversationLearningStore();
    store.materialConnection = {
      endpoint: 'http://127.0.0.1:8765/parse',
      allowedOrigins: ['http://127.0.0.1:8765'],
      token: 'TEST_ONLY_retry_token_32_characters',
      consent: true
    };
    let content = '最初提取的文本';
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            id: 'retry-material',
            fingerprint: 'retry-fingerprint',
            kind: 'pdf',
            name: '合成资料',
            scope: 'private',
            extractionVersion: 'isolated-parser-v1',
            segments: [{ id: 'page-1', page: 1, content }],
            totalPages: 1,
            nextPage: null,
            status: 'ready'
          }
        })
    }));
    try {
      const input = { size: 10, contentBase64: 'TEST_ONLY', name: '合成资料' };
      await store.importFile(input);
      const revision = store.state.revision;
      await store.importFile(input);
      expect(store.state.revision).toBe(revision);
      content = '重新提取后明确的文本';
      await store.importFile(input);
      expect(store.state.materials).toHaveLength(1);
      expect(store.state.materials[0].segments[0].content).toBe(content);
      expect(store.state.materials[0].extractions).toHaveLength(2);
      const events = store.state.events.filter((e) => e.type === 'material.add');
      expect(events[0].data.material.segments[0].content).toBe('最初提取的文本');
      expect(store.state.materials[0].segments[0].extractionEventId).toBe(events[1].id);
    } finally {
      transport.mockRestore();
      store.$dispose();
    }
  });
  it('解析器页图不能引导浏览器请求未经授权的第三方 URL', () => {
    const store = useConversationLearningStore();
    const material = parsePastedMaterial('合成资料', 'image-source');
    material.segments[0].preview = 'https://untrusted.invalid/private-data';
    expect(() => store.commit('material.add', { material })).toThrow('页图结构不合法');
    expect(store.state.materials).toHaveLength(0);
    store.$dispose();
  });
  it('文件已选后取消确认，文件不会上传或形成资料记录', async () => {
    const store = useConversationLearningStore();
    store.start('合成取消流程');
    store.materialConnection = { endpoint: 'http://127.0.0.1:8765/parse', consent: true };
    const wrapper = mount(LearningPage, {
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          LearningShell: { template: '<div><slot /></div>' },
          LearningOverview: true,
          NumberLine: true
        }
      }
    });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      if (this.type !== 'file') return;
      Object.defineProperty(this, 'files', { value: [new File(['TEST_ONLY'], 'synthetic.pdf')] });
      this.onchange();
    });
    const modal = vi
      .spyOn(uni, 'showModal')
      .mockImplementation((options) => options.success({ confirm: false, cancel: true }));
    const upload = vi.spyOn(store, 'importFile');
    try {
      await wrapper
        .findAll('button')
        .find((button) => button.text().trim() === '导入与校对资料')
        .trigger('tap');
      await wrapper
        .findAll('button')
        .find((button) => button.text().trim() === '选择 PDF / 作答图片')
        .trigger('tap');
      expect(modal).toHaveBeenCalledOnce();
      expect(upload).not.toHaveBeenCalled();
      expect(store.state.materials).toHaveLength(0);
    } finally {
      click.mockRestore();
      modal.mockRestore();
      wrapper.unmount();
      store.$dispose();
    }
  });
});
