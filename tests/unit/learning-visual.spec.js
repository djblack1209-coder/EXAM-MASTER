import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { emptyLearningState, learningCapabilitiesData } from '../../laf-backend/functions/_shared/learning-domain.js';
import {
  visualRecipe,
  assertVisualOutputCapability,
  visualFrame,
  manimVisualSource,
  noticeSentenceFeedback,
  noticeTransferFeedback,
  learningEvidenceMap
} from '../../laf-backend/functions/_shared/learning-visual.js';
import { parseLearningOutput } from '../../laf-backend/functions/_shared/ai-providers/learning-provider.ts';
import { executeLearningTool } from '@/services/learning/learning-tools.js';
import LearningLab from '@/pages/learning/components/learning-lab.vue';
import { createNoticeQuestion } from '../../laf-backend/functions/_shared/learning-writing.js';
import { safeRenderDirectory } from '../../scripts/build/render-learning-visual.mjs';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn() }));
const recipe = () => visualRecipe({ template: 'distance_displacement', outward: 6, backward: 4 });
const state = () => ({
  ...emptyLearningState('visual-user', 'Asia/Shanghai'),
  conversations: [{ id: 'c1', goal: '学习物理', stopped: false }]
});
const context = () => ({
  permissions: ['read'],
  calls: 0,
  maxCalls: 2,
  deadline: Date.now() + 1000,
  conversationId: 'c1',
  origin: 'model'
});
const visualCall = {
  id: 'visual-1',
  name: 'visualize',
  arguments: { template: 'distance_displacement', outward: 6, backward: 4 }
};
afterEach(() => vi.useRealTimers());
describe('有界演示与渲染合同', () => {
  it('旧客户端保持原能力形状，未声明或未知演示版本拒绝新工具', () => {
    const old = learningCapabilitiesData({ evaluation: 'pending_reference' });
    expect(old).not.toHaveProperty('visualization');
    expect(learningCapabilitiesData({ visualization: 'future-version' })).not.toHaveProperty('visualization');
    for (const capabilities of [undefined, old, { visualization: 'future-version' }]) {
      expect(() => assertVisualOutputCapability({ tools: [visualCall] }, capabilities)).toThrow('未声明');
    }
    expect(assertVisualOutputCapability({ message: '继续读原答。', tools: [] }, old)).toMatchObject({ tools: [] });
  });
  it('只有确切能力版本允许演示，其余能力与权限没有提升', () => {
    const capabilities = learningCapabilitiesData({
      evaluation: 'ai_assisted_only',
      visualization: 'learning-visual-v1'
    });
    expect(capabilities).toMatchObject({ evaluation: 'ai_assisted_only', visualization: 'learning-visual-v1' });
    const output = { message: '先预测。', tools: [visualCall] };
    expect(assertVisualOutputCapability(output, capabilities)).toBe(output);
  });
  it.each([
    { code: 'import os' },
    { url: 'http://127.0.0.1' },
    { file: '/etc/passwd' },
    { duration: 100000 },
    { html: '<script>' },
    JSON.parse('{"__proto__":{}}')
  ])('拒绝模型代码、URL、文件和资源提升 %j', (extra) => {
    expect(() => visualRecipe({ template: 'distance_displacement', ...extra })).toThrow();
  });
  it.each([
    { outward: 0 },
    { outward: 21 },
    { outward: 1.1 },
    { outward: '6' },
    { backward: -1 },
    { backward: 7 },
    { outward: Infinity },
    { backward: NaN }
  ])('拒绝不合法运动参数 %j', (params) => {
    expect(() => visualRecipe({ template: 'distance_displacement', ...params })).toThrow();
  });
  it('去程和回程分别保留，走过长度单调增加，终点位移正确', () => {
    const frames = Array.from({ length: 25 }, (_, i) => visualFrame(recipe(), i));
    expect(frames[0]).toMatchObject({ distance: 0, displacement: 0, complete: false });
    expect(frames.at(-1)).toMatchObject({ distance: 10, displacement: 2, complete: true });
    expect(frames.every((f, i) => !i || f.distance >= frames[i - 1].distance)).toBe(true);
    expect(frames.every((f) => f.position >= 0 && f.position <= 6)).toBe(true);
    expect(frames[15].position).toBeLessThan(frames[14].position);
  });
  it('没有回程和全部返回，位移分别为去程与零', () => {
    expect(visualFrame(visualRecipe({ template: 'distance_displacement', outward: 6, backward: 0 }), 24)).toMatchObject(
      { distance: 6, displacement: 6 }
    );
    expect(visualFrame(visualRecipe({ template: 'distance_displacement', outward: 6, backward: 6 }), 24)).toMatchObject(
      { distance: 12, displacement: 0 }
    );
    expect(() => visualFrame(recipe(), 25)).toThrow();
    expect(() => visualRecipe({ template: 'arbitrary_python' })).toThrow();
  });
  it('Manim 只得到固定场景，不导入网络或执行模型文本', () => {
    const source = manimVisualSource(visualCall.arguments);
    expect(source).toContain('class YoziDistance(Scene)');
    expect(source).toContain('distance: 10 m | displacement: 2 m');
    expect(source).not.toMatch(/import os|subprocess|eval\(|exec\(|https?:/);
    expect(() => manimVisualSource({ ...visualCall.arguments, text: '__import__("os")' })).toThrow();
  });
  it('服务端提前拒绝非法演示，允许固定模板', () => {
    expect(
      parseLearningOutput(JSON.stringify({ message: '先预测，再观察。', tools: [visualCall] })).tools[0].name
    ).toBe('visualize');
    expect(() =>
      parseLearningOutput(
        JSON.stringify({
          message: '演示',
          tools: [{ ...visualCall, arguments: { ...visualCall.arguments, code: 'x' } }]
        })
      )
    ).toThrow('只接受');
  });
  it('渲染输出不允许正式产物、系统路径和 tmp 自身', async () => {
    await expect(safeRenderDirectory('/tmp/yozi')).rejects.toThrow();
    await expect(safeRenderDirectory(`${process.cwd()}/dist/build/h5`)).rejects.toThrow();
    await expect(safeRenderDirectory(`${process.cwd()}/tmp`)).rejects.toThrow();
    await expect(safeRenderDirectory(`${process.cwd()}/tmp/visual-local-test`)).resolves.toContain(
      '/tmp/visual-local-test'
    );
  });
  it('受限工具只有执行收据，不修改题目、作答、统计或计划', () => {
    const current = state(),
      commit = vi.fn();
    const before = JSON.stringify(current);
    expect(executeLearningTool({ read: () => current, commit }, visualCall, context()).result).toEqual(recipe());
    expect(JSON.stringify(current)).toBe(before);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toMatchObject({
      type: 'execution.record',
      data: { tool: 'visualize', status: 'success' }
    });
  });
  it.each(['stop', 'expired', 'cancel', 'permission', 'method'])(
    '停止、预算、取消、权限与用户教法均保留：%s',
    (kind) => {
      const current = state(),
        ctx = context(),
        commit = vi.fn();
      if (kind === 'stop') current.conversations[0].stopped = true;
      if (kind === 'expired') ctx.deadline = 0;
      if (kind === 'cancel') ctx.signal = { aborted: true };
      if (kind === 'permission') ctx.permissions = [];
      if (kind === 'method') ctx.lockedMethod = 'steps';
      expect(() => executeLearningTool({ read: () => current, commit }, visualCall, ctx)).toThrow();
      expect(commit).not.toHaveBeenCalled();
    }
  );
});
describe('一句一个目标的写作草稿', () => {
  it('独立迁移使用新活动、时间、地点，仍只给草稿反馈', () => {
    expect(noticeTransferFeedback('Our school will hold a science event on Monday at 4 pm.')).toMatchObject({
      ready: false
    });
    expect(
      noticeTransferFeedback(
        'Our school will hold a reading club event on Friday at 3 pm in the classroom. Please bring a notebook.'
      )
    ).toMatchObject({ ready: true });
    expect(noticeTransferFeedback('Reading Friday 3 classroom bring notebook.').message).toContain('尚未证明');
    expect(() => noticeTransferFeedback('x'.repeat(1001))).toThrow();
  });
  it('先核对本步信息，再只纠正一个明确问题', () => {
    expect(noticeSentenceFeedback('time', 'It will start in 4 pm in Monday.')).toMatchObject({
      ready: false,
      kind: 'preposition'
    });
    expect(noticeSentenceFeedback('time', 'it will start at 4 pm on Monday.')).toMatchObject({
      ready: false,
      kind: 'capital'
    });
    expect(noticeSentenceFeedback('time', 'It will start at 4 pm on Monday')).toMatchObject({
      ready: false,
      kind: 'punctuation'
    });
    expect(noticeSentenceFeedback('time', 'It will start at 4 pm on Monday.')).toMatchObject({
      ready: true,
      kind: 'draft'
    });
    expect(noticeSentenceFeedback('place', 'It will take place in a classroom.')).toMatchObject({
      ready: false,
      kind: 'content'
    });
  });
  it('草稿检查不是语义评分，拒绝代码样式与无界正文', () => {
    expect(noticeSentenceFeedback('purpose', 'School science.').message).toContain('仍需核对');
    expect(noticeSentenceFeedback('purpose', '<b>School science.</b>').ready).toBe(false);
    expect(() => noticeSentenceFeedback('purpose', 'a'.repeat(241))).toThrow();
  });
});
describe('从实际原答派生关系与热力图', () => {
  it('账户内按对话筛选，待核对、帮助与可靠分别计数，不生成先修关系', () => {
    const current = state();
    current.questions = [{ id: 'q', version: 1, subject: '英语', knowledgePoint: '通知' }];
    current.attempts = [
      {
        id: 'a',
        conversationId: 'c1',
        questionKey: 'q@1',
        at: Date.parse('2026-10-04T16:30:00Z'),
        hints: ['h'],
        grade: { status: 'pending', outcome: 'uncertain' }
      },
      {
        id: 'b',
        conversationId: 'other',
        questionKey: 'q@1',
        at: Date.parse('2026-10-05T01:00:00Z'),
        hints: [],
        grade: { status: 'reliable', outcome: 'correct' }
      }
    ];
    const before = JSON.stringify(current),
      map = learningEvidenceMap(current, { conversationId: 'c1', now: Date.parse('2026-10-05T02:00:00Z') });
    expect(map.nodes[0]).toMatchObject({ reliable: 0, pending: 1, helped: 1 });
    expect(map.nodes[0].evidence.map((e) => e.id)).toEqual(['a']);
    expect(map.heat.at(-1)).toMatchObject({ day: '2026-10-05', reliable: 0, pending: 1 });
    expect(map.relationship).toBe('record_membership');
    expect(JSON.stringify(current)).toBe(before);
    current.attempts[0].corrections = [{ grade: { status: 'reliable', outcome: 'correct' } }];
    expect(learningEvidenceMap(current, { conversationId: 'c1' }).nodes[0]).toMatchObject({ reliable: 1, pending: 0 });
    current.questions = [];
    expect(learningEvidenceMap(current).nodes).toEqual([]);
  });
});
function lab(props = {}) {
  return mount(LearningLab, {
    props: { state: state(), context: 'owner/c1/q', conversationId: 'c1', ...props },
    global: {
      stubs: { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' }, BaseIcon: true }
    }
  });
}
const button = (wrapper, label) =>
  wrapper.findAll('button, [role="button"], [role="tab"]').find((b) => b.text() === label);
describe('演示生命周期与逐句交互', () => {
  it('不自动播放，先预测；暂停、停止与账户变更回收定时器', async () => {
    vi.useFakeTimers();
    const intervals = vi.spyOn(globalThis, 'setInterval'),
      clears = vi.spyOn(globalThis, 'clearInterval');
    const wrapper = lab();
    await button(wrapper, '互动学习').trigger('tap');
    expect(button(wrapper, '播放动画').attributes('disabled')).toBeDefined();
    expect(intervals).not.toHaveBeenCalled();
    await button(wrapper, '我猜不同').trigger('tap');
    await button(wrapper, '播放动画').trigger('tap');
    await vi.advanceTimersByTimeAsync(1500);
    expect(wrapper.text()).toContain('路程 2.5 m');
    const firstTimer = intervals.mock.results.at(-1).value;
    await button(wrapper, '暂停动画').trigger('tap');
    expect(clears).toHaveBeenCalledWith(firstTimer);
    await button(wrapper, '播放动画').trigger('tap');
    const secondTimer = intervals.mock.results.at(-1).value;
    await wrapper.setProps({ stopped: true });
    expect(clears).toHaveBeenCalledWith(secondTimer);
    await wrapper.setProps({ context: 'owner2/c2/q' });
    expect(wrapper.find('.lab-content').exists()).toBe(false);
    const lastScene = wrapper.text();
    await vi.advanceTimersByTimeAsync(6000);
    expect(wrapper.text()).toBe(lastScene);
    wrapper.unmount();
  });
  it('每步一个句子，改动撤销旧反馈，切账户清空未保存草稿', async () => {
    const wrapper = lab();
    await wrapper.setProps({ question: createNoticeQuestion('writing-fixture', 'c1') });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('Our school will hold a reading club event.');
    await button(wrapper, '检查这一句').trigger('tap');
    expect(button(wrapper, '继续下一句')).toBeTruthy();
    await wrapper.find('textarea').setValue('Changed');
    expect(button(wrapper, '继续下一句')).toBeUndefined();
    await wrapper.setProps({ context: 'other' });
    await button(wrapper, '互动学习').trigger('tap');
    expect(wrapper.find('textarea').element.value).toBe('');
    wrapper.unmount();
  });
});
