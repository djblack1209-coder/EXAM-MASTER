import { observeLearningDialogs } from '../setup.js';
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
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('私人资料和实际 Store 纵向闭环', () => {
  it.each(['Answers: Bristol', 'Solutions: Bristol', 'Answer key\nDeparture city: Bristol'])(
    '新资料练习入口拒绝 %s，保留资料并不写空对话或可靠作答',
    async (content) => {
      const store = useConversationLearningStore();
      store.importText(content);
      const original = store.exportData();
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
      try {
        await wrapper
          .findAll('button')
          .find((b) => b.text().trim() === '资料')
          .trigger('tap');
        await wrapper
          .findAll('button')
          .find((b) => b.text().trim() === '用此资料练习')
          .trigger('tap');
        expect(wrapper.findAll('[data-test="objective-field-from"]')).toHaveLength(0);
        expect(wrapper.get('[data-test="objective-unavailable"]').text()).toMatch(/不能自动|非空行/);
        expect(wrapper.get('[data-test="start-objective"]').attributes('disabled')).toBeDefined();
        expect(store.exportData()).toBe(original);
        expect(store.state.questions).toHaveLength(0);
        expect(store.state.conversations).toHaveLength(0);
        expect(store.state.attempts).toHaveLength(0);
      } finally {
        wrapper.unmount();
        store.$dispose();
      }
    }
  );
  it('资料练习先显示可用字段，字段不足或任务停止不新建空对话；明确选择后进入题目', async () => {
    const store = useConversationLearningStore();
    store.importText('2024: 80\n2025: 100\n2026: 150');
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
    try {
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '资料')
        .trigger('tap');
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '用此资料练习')
        .trigger('tap');
      const start = () => wrapper.get('[data-test="start-objective"]');
      expect(start().attributes('disabled')).toBeDefined();
      expect(wrapper.findAll('[data-test="objective-field-from"]')).toHaveLength(3);
      await wrapper.get('[data-test="objective-kind-growth_percent"]').trigger('tap');
      await wrapper.findAll('[data-test="objective-field-from"]')[0].trigger('tap');
      expect(start().attributes('disabled')).toBeDefined();
      await wrapper.findAll('[data-test="objective-field-to"]')[0].trigger('tap');
      expect(start().attributes('disabled')).toBeDefined();
      expect(store.state.conversations).toHaveLength(0);
      await wrapper.findAll('[data-test="objective-field-to"]')[1].trigger('tap');
      expect(start().attributes('disabled')).toBeUndefined();
      await start().trigger('tap');
      await flushPromises();
      expect(store.state.conversations).toHaveLength(1);
      expect(store.activeQuestion.materialExercise).toMatchObject({ from: '2024', to: '2025', kind: 'growth_percent' });
      expect(wrapper.find('[data-test="material-objective"]').exists()).toBe(false);
      expect(uni.pageScrollTo).toHaveBeenCalledWith({ selector: '#active-learning-question', duration: 0 });
      store.commit('task.stop', { conversationId: store.active.id, source: 'self_report' });
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '资料')
        .trigger('tap');
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '用此资料练习')
        .trigger('tap');
      await wrapper.findAll('[data-test="objective-field-from"]')[0].trigger('tap');
      await wrapper.findAll('[data-test="objective-field-to"]')[1].trigger('tap');
      expect(start().attributes('disabled')).toBeDefined();
      expect(wrapper.get('[data-test="objective-unavailable"]').text()).toContain('继续学习任务');
      expect(store.state.conversations).toHaveLength(1);
      expect(store.active.stopped).toBe(true);
    } finally {
      wrapper.unmount();
      store.$dispose();
    }
  });

  it('同页重新提取与答案区域不沿用旧字段，不把数值或校对疑义升级为可信练习', async () => {
    const store = useConversationLearningStore();
    const material = parsePastedMaterial('2024: eighty\n2025: 100\n2026: 150', 'field-source');
    store.commit('material.add', { material });
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
    try {
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '资料')
        .trigger('tap');
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '用此资料练习')
        .trigger('tap');
      await wrapper.get('[data-test="objective-kind-growth_percent"]').trigger('tap');
      await wrapper.findAll('[data-test="objective-field-from"]')[0].trigger('tap');
      await wrapper.findAll('[data-test="objective-field-to"]')[1].trigger('tap');
      expect(wrapper.get('[data-test="start-objective"]').attributes('disabled')).toBeDefined();
      expect(wrapper.get('[data-test="objective-unavailable"]').text()).toContain('整数');
      const replacement = JSON.parse(JSON.stringify(material));
      replacement.extractionVersion = 'poppler-pdf-text-v3';
      replacement.segments[0].content = '2024: 80\n2025: 100\n2026: 150';
      replacement.segments[0].extractionVersion = 'poppler-pdf-text-v3';
      store.commit('material.add', { material: replacement });
      await flushPromises();
      expect(wrapper.get('[data-test="objective-unavailable"]').text()).toContain('重新选择');
      expect(wrapper.get('[data-test="start-objective"]').attributes('disabled')).toBeDefined();
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '片段 1')
        .trigger('tap');
      await wrapper.get('[data-test="objective-kind-literal"]').trigger('tap');
      await wrapper.findAll('[data-test="objective-field-from"]')[0].trigger('tap');
      expect(wrapper.get('[data-test="start-objective"]').attributes('disabled')).toBeUndefined();
      const answerRegion = JSON.parse(JSON.stringify(replacement));
      answerRegion.segments[0].content = '答案: 80\n批注: 100\n作答: 150';
      store.commit('material.add', { material: answerRegion });
      await flushPromises();
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '片段 1')
        .trigger('tap');
      expect(wrapper.findAll('[data-test="objective-field-from"]')).toHaveLength(0);
      expect(wrapper.get('[data-test="objective-unavailable"]').text()).toContain('不能自动');
      expect(store.state.conversations).toHaveLength(0);
      expect(store.state.materials[0].extractions).toHaveLength(3);
    } finally {
      wrapper.unmount();
      store.$dispose();
    }
  });

  it('资料分析从真实 Store 形成错题、提示修正、不同字段复测、复习与可恢复任务事实', async () => {
    const store = useConversationLearningStore();
    try {
      store.start('理解所给资料的增长率', { track: 'civil', edition: '用户提供的合成资料' });
      const material = store.importText('2024: 80\n2025: 100\n2026: 150');
      const materialId = material.materialId || store.state.materials[0].id;
      store.structureObjective(materialId, {
        segmentId: store.state.materials[0].segments[0].id,
        kind: 'growth_percent',
        from: '2024',
        to: '2025'
      });
      expect(store.taskContext).toMatchObject({ track: 'civil', evaluation: 'independent_rule', rule: 'number' });
      const first = store.submit('20%', true, 'civil-first');
      expect(first.grade.outcome).toBe('wrong');
      expect(store.summary.mistakes).toHaveLength(1);
      expect(store.summary.tasks.numerator).toBe(0);
      await store.send('直接讲解');
      const revision = store.submit('25%', true, 'civil-revision');
      expect(revision.hints.length).toBeGreaterThan(0);
      expect(store.summary.tasks.numerator).toBe(0);
      store.generateVariant();
      expect(store.activeQuestion.materialExercise).toMatchObject({ from: '2025', to: '2026' });
      expect(store.submit('50%', true, 'civil-independent')).toMatchObject({
        kind: 'variant',
        hints: [],
        grade: { outcome: 'correct' }
      });
      expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 2 });
      expect(store.state.reviews).toHaveLength(2);
      const exported = store.exportData();
      expect(exported).toContain('learning-task-v1');
      expect(exported).toContain('material-objective-v3');
      const preview = store.previewRestore(exported);
      store.restoreData(exported, preview);
      expect(store.state.conversations[0].task.track).toBe('civil');
      expect(store.activeQuestion.validation.evidenceId).toBe('material-objective-v3');
    } finally {
      store.$dispose();
    }
  });
  it('占比表单明确部分和整体，反选不建题，精确作答、帮助修正和不同字段复测可恢复', async () => {
    const store = useConversationLearningStore();
    store.importText('部分: 12.5\n整体: 50\n下一整体: 62.5');
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
    try {
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '资料')
        .trigger('tap');
      await wrapper
        .findAll('button')
        .find((b) => b.text().trim() === '用此资料练习')
        .trigger('tap');
      await wrapper.get('[data-test="objective-kind-share_percent"]').trigger('tap');
      expect(wrapper.find('input[aria-label="部分字段"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('部分字段');
      expect(wrapper.find('input[aria-label="整体字段"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('整体字段');
      await wrapper.findAll('[data-test="objective-field-from"]')[1].trigger('tap');
      await wrapper.findAll('[data-test="objective-field-to"]')[0].trigger('tap');
      expect(wrapper.get('[data-test="start-objective"]').attributes('disabled')).toBeDefined();
      expect(wrapper.get('[data-test="objective-unavailable"]').text()).toContain('部分不能大于整体');
      expect(store.state.conversations).toHaveLength(0);
      await wrapper.findAll('[data-test="objective-field-from"]')[0].trigger('tap');
      await wrapper.findAll('[data-test="objective-field-to"]')[1].trigger('tap');
      await wrapper.get('[data-test="start-objective"]').trigger('tap');
      await flushPromises();
      expect(store.submit('20%', true, 'decimal-share-first').grade.outcome).toBe('wrong');
      await store.send('直接讲解');
      expect(store.active.messages.at(-1).content).toContain('部分除以整体');
      expect(store.submit('25%', true, 'decimal-share-revision').hints.length).toBeGreaterThan(0);
      store.generateVariant();
      expect(store.activeQuestion.materialExercise.to).toBe('下一整体');
      expect(store.submit('20%', true, 'decimal-share-independent')).toMatchObject({
        kind: 'variant',
        hints: [],
        grade: { outcome: 'correct' }
      });
      const exported = store.exportData();
      store.restoreData(exported, store.previewRestore(exported));
      expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
      expect(store.state.attempts).toHaveLength(3);
      expect(store.state.attempts[2].kind).toBe('variant');
      expect(store.state.attempts[0].answer).toBe('20%');
      expect(store.state.reviews).toHaveLength(2);
    } finally {
      wrapper.unmount();
      store.$dispose();
    }
  });
  it('英语字面定位与资料修改后的候选反馈保持边界，不把同意或改题升级为可靠判分', () => {
    const store = useConversationLearningStore();
    try {
      store.start('按所给文本定位信息', { track: 'ielts' });
      store.importText('Departure city: Bristol\nArrival city: Oxford\nTravel day: Monday');
      const material = store.state.materials[0];
      store.structureObjective(material.id, {
        segmentId: material.segments[0].id,
        kind: 'literal',
        from: 'Departure city'
      });
      expect(store.submit('Bristol', true, 'literal-first').grade.outcome).toBe('correct');
      const question = store.activeQuestion;
      store.correctQuestion(question, { prompt: question.prompt + '\n解释旅行目的' }, '用户改变了题目含义');
      expect(store.activeQuestion.materialExercise).toBeUndefined();
      expect(store.taskContext.evaluation).toBe('pending_reference');
      expect(store.submit('Bristol', true, 'changed-question').grade.status).toBe('pending');
      expect(store.summary.first.denominator).toBe(1);
    } finally {
      store.$dispose();
    }
  });
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
      const send = wrapper.findAll('button').find((button) => button.attributes('aria-label') === '发送');
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
  it('无题干标签时保留原资料，候选题干与选项不混入明确答案、作答及批注区域', () => {
    const segment = {
      content:
        '求速度。\nA.3m/s\nB.4m/s\n答案：PRIVATE_ANSWER\nC.答案区域中的选项\n补充答案依据\n我答：PRIVATE_ATTEMPT\n教师批注：PRIVATE_ANNOTATION',
      reviewRequired: false
    };
    const original = segment.content;
    const candidate = structureMaterialCandidate(segment);
    expect(candidate).toMatchObject({
      prompt: '求速度。\nA.3m/s\nB.4m/s',
      options: ['A.3m/s', 'B.4m/s'],
      reference: 'PRIVATE_ANSWER',
      userAnswer: 'PRIVATE_ATTEMPT',
      annotation: 'PRIVATE_ANNOTATION',
      rolesConfirmed: false
    });
    expect(segment.content).toBe(original);
    expect(structureMaterialCandidate({ content: '答案：PRIVATE_ONLY' }).prompt).toBe('');
  });
  it.each(['', '题目：'])('候选%s题干发送边界保留来源，独立参考、导入作答和批注不进入模型请求', async (label) => {
    uni.setStorageSync('EXAM_USER_ID', 'material-context-owner');
    uni.setStorageSync('EXAM_TOKEN', 'isolated-placeholder-token');
    const store = useConversationLearningStore();
    store.start('理解速度');
    const text = `${label}求速度。\nA.3m/s\nB.4m/s\n答案：PRIVATE_ANSWER\n我答：PRIVATE_ATTEMPT\n教师批注：PRIVATE_ANNOTATION`;
    store.importText(text);
    const material = store.state.materials.at(-1);
    const segment = material.segments[0];
    const candidate = structureMaterialCandidate(segment);
    store.structureQuestion(material.id, { ...candidate, segmentId: segment.id, type: 'choice' });
    store.modelId = 'explicit-model';
    store.selectedMode = 'cloud';
    store.sharingAllowed = true;
    const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
      const payload = options.data;
      expect(payload.learningContext.question).toMatchObject({
        prompt: candidate.prompt,
        options: ['A.3m/s', 'B.4m/s'],
        source: { materialId: material.id, segmentId: segment.id, kind: 'private_material' }
      });
      expect(JSON.stringify(payload)).not.toContain('PRIVATE_');
      options.success({ data: { success: true, data: { message: '先确定时间与距离的单位。', tools: [] } } });
      return { abort: vi.fn() };
    });
    try {
      await store.send('讨论题意', { discussionOnly: true });
      expect(transport).toHaveBeenCalledOnce();
      expect(store.error).toBe('');
      expect(store.state.materials.at(-1).segments[0].content).toBe(text);
      expect(store.activeQuestion).toMatchObject({
        reference: { content: 'PRIVATE_ANSWER', verified: false },
        importedAnswer: 'PRIVATE_ATTEMPT',
        teacherAnnotation: 'PRIVATE_ANNOTATION',
        validation: null
      });
      expect(store.state.attempts).toHaveLength(0);
      expect(store.active.pendingHints).toHaveLength(1);
    } finally {
      transport.mockRestore();
      store.$dispose();
    }
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
    const modal = vi.fn((options) => options.success({ confirm: false, cancel: true }));
    const stopDialogs = observeLearningDialogs(wrapper, modal);
    const upload = vi.spyOn(store, 'importFile');
    try {
      await wrapper
        .findAll('button')
        .find((button) => button.text().trim() === '资料')
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
      stopDialogs();
      wrapper.unmount();
      store.$dispose();
    }
  });
});
