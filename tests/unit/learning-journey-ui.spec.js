import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
vi.mock('@dcloudio/uni-app', () => ({ onShow: () => {}, onHide: () => {}, onLoad: () => {}, onBackPress: () => {} }));
import LearningJourney from '@/components/business/learning/learning-journey.vue';
import LearningMessage from '@/components/business/learning/learning-message.vue';
import LearningPage from '@/pages/learning/index.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
let wrapper;
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  for (const s of getActivePinia()?._s.values() || []) s.$dispose();
  learningWriteLease.release();
  vi.restoreAllMocks();
  vi.useRealTimers();
  uni.clearStorageSync();
});
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
describe('学习路线的明确操作与阅读', () => {
  it('从其他页面定位长会话旧日时不被当前题分页覆盖，较早日期可达且不改记录', async () => {
    const query = {
      select: () => query,
      boundingClientRect: () => query,
      selectViewport: () => query,
      scrollOffset: () => query,
      exec: (done) => done([{ top: 120 }, { scrollTop: 240 }])
    };
    vi.spyOn(uni, 'createSelectorQuery').mockReturnValue(query);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T10:00:00Z'));
    const s = useConversationLearningStore();
    s.commit('timezone.set', { timezone: 'Asia/Shanghai' });
    s.start('九日连续目标');
    const id = s.active.id;
    s.configureJourney(s.journeyContext(), {
      title: '九日连续目标',
      startDay: '2026-10-02',
      durationDays: 14,
      minutes: 30,
      mode: 'batch',
      moduleIds: ['arithmetic-add']
    });
    let firstGroup;
    for (let day = 2; day <= 10; day++) {
      vi.setSystemTime(new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00Z`));
      s.refresh();
      const group = s.startTraining(s.journeyContext(), 'arithmetic-add', 1);
      firstGroup ||= group;
      for (let message = 0; message < 8; message++)
        s.commit('message.add', {
          conversationId: id,
          role: message % 2 ? 'assistant' : 'user',
          content: `第${day}日讨论-${message}`
        });
    }
    s.commit('task.stop', { conversationId: id });
    s.start('另一目标');
    s.locateConversation(id, '2026-10-02', firstGroup.id);
    const before = s.exportData();
    wrapper = mount(LearningPage, { global: { stubs: { ...stubs, PrivacyPopup: true, LearningLab: true } } });
    await flushPromises();
    expect(wrapper.findAll('.message').some((m) => m.text() === '第2日讨论-0')).toBe(true);
    expect(wrapper.findAll('.message').length).toBeLessThanOrEqual(50);
    expect(wrapper.findAll('.directory-date').map((e) => e.text())).not.toContain('10 / 02');
    await wrapper.find('[data-test="earlier-learning-days"]').trigger('tap');
    expect(wrapper.findAll('.directory-date').map((e) => e.text())).toContain('10 / 02');
    expect(s.active.id).toBe(id);
    expect(s.active.stopped).toBe(true);
    expect(s.active.messages).toHaveLength(72);
    expect(s.exportData()).toBe(before);
  });
  it('模块目录定位同一完整会话，日进度在对话内，导航/展开不改原答或停止状态', async () => {
    const query = {
      select: () => query,
      boundingClientRect: () => query,
      selectViewport: () => query,
      scrollOffset: () => query,
      exec: (done) => done([{ top: 120 }, { scrollTop: 240 }])
    };
    const nativeQuery = vi.spyOn(uni, 'createSelectorQuery').mockReturnValue(query);
    const nativeScroll = vi.spyOn(uni, 'pageScrollTo');
    const s = useConversationLearningStore();
    s.start('运算与写作的连续目标');
    const id = s.active.id;
    s.configureJourney(s.journeyContext(), {
      title: '连续目标',
      startDay: s.todaySummary.day,
      durationDays: 7,
      minutes: 30,
      mode: 'batch',
      moduleIds: ['arithmetic-add', 'writing-notice']
    });
    const math = s.startTraining(s.journeyContext(), 'arithmetic-add', 1);
    s.commit('message.add', { conversationId: id, role: 'user', content: '完整数学讨论' });
    const writing = s.startTraining(s.journeyContext(), 'writing-notice', 1);
    s.commit('message.add', { conversationId: id, role: 'assistant', content: '完整写作讨论' });
    s.commit('task.stop', { conversationId: id });
    const before = s.exportData();
    wrapper = mount(LearningPage, { global: { stubs: { ...stubs, PrivacyPopup: true, LearningLab: true } } });
    const directory = wrapper.findAll('.directory-module').find((b) => b.text() === '整数加法');
    await directory.trigger('tap');
    await flushPromises();
    expect(s.active.id).toBe(id);
    expect(s.trainingGroup.id).toBe(math.id);
    expect(nativeScroll).toHaveBeenCalledWith({ scrollTop: 360, duration: 0 });
    expect(wrapper.findAll('.message')).toHaveLength(2);
    expect(wrapper.find('.conversation-area .learning-overview').exists()).toBe(true);
    expect(wrapper.find('.session-progress').exists()).toBe(false);
    expect(wrapper.find('.library-heading').exists()).toBe(false);
    expect(wrapper.findAll('.message-role')).toHaveLength(0);
    await wrapper.find('.conversation-area .learning-summary').trigger('tap');
    await flushPromises();
    s.locateConversation(id, s.journey.day, writing.id);
    expect(s.active.stopped).toBe(true);
    expect(s.exportData()).toBe(before);
    await flushPromises();
    nativeQuery.mockRestore();
    nativeScroll.mockRestore();
  });

  it('嵌入日进度只统计该目标，待核对原答不混进可靠正确数，空样本不生成百分比', async () => {
    const s = useConversationLearningStore();
    s.start('12 + 8');
    s.submit('20', true);
    s.start('英文说明写作');
    s.submit('An original pending explanation.', true);
    const before = s.exportData();
    wrapper = mount(LearningOverview, {
      props: { inline: true, conversationId: s.active.id, showNavigation: false },
      global: { stubs }
    });
    expect(wrapper.findAll('.summary-count').map((e) => e.text())).toEqual(['1', '0', '1']);
    expect(wrapper.text()).toContain('可靠正确 0 / 0');
    expect(wrapper.text()).not.toContain('%');
    expect(wrapper.find('[aria-label="学习统计范围"]').exists()).toBe(false);
    expect(wrapper.find('.answer-distribution').attributes('aria-label')).toContain('待核对1次');
    await wrapper.find('.learning-summary').trigger('tap');
    expect(s.exportData()).toBe(before);
  });
  it('选择节奏和模块仅改变草稿，明确保存后显示目标且可完成一次整批交卷', async () => {
    const s = useConversationLearningStore();
    s.start('自主学习');
    wrapper = mount(LearningJourney, { global: { stubs } });
    const before = s.exportData();
    await wrapper.find('button').trigger('tap');
    await wrapper.find('[aria-label="路线学习目标"]').setValue('清晰的运算目标');
    await wrapper.find('[aria-label="训练节奏"] button[aria-pressed="false"]').trigger('tap');
    expect(s.exportData()).toBe(before);
    // 重新明确选择整批训练。
    await wrapper
      .findAll('[aria-label="训练节奏"] button')
      .find((b) => b.text() === '整批训练')
      .trigger('tap');
    await wrapper.find('[data-test="journey-save"]').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('清晰的运算目标');
    expect(s.active.journey.mode).toBe('batch');
    const size = wrapper.findAll('[aria-label="每组题量"] button').find((b) => b.text() === '2题');
    await size.trigger('tap');
    await wrapper.find('[data-test="journey-module-arithmetic-add"]').trigger('tap');
    await flushPromises();
    const selected = s.exportData();
    await wrapper.find('[aria-label="训练第1题作答"]').setValue('12');
    await wrapper.find('[aria-label="训练第2题作答"]').setValue('16');
    expect(s.exportData()).toBe(selected);
    await wrapper.find('[data-test="training-submit"]').trigger('tap');
    await flushPromises();
    expect(s.state.attempts.map((a) => a.answer)).toEqual(['12', '16']);
    expect(wrapper.text()).toContain('整批原答已保存');
    expect(wrapper.findAll('[data-test="training-submit"]')).toHaveLength(0);
  });

  it('教学标题、要点和对照表可扫读，模型HTML和脚本仍作为普通文字', () => {
    wrapper = mount(LearningMessage, {
      props: {
        content:
          '## 本次结果\n\n- **先求一份**\n- 再求总数\n\n| 原答 | 参考 |\n| --- | --- |\n| 48 | 42 |\n\n<script>globalThis.__unsafe = true</script>'
      },
      global: { stubs }
    });
    expect(wrapper.find('[role="heading"]').text()).toBe('本次结果');
    expect(wrapper.find('[role="table"]').text()).toContain('48');
    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.text()).toContain('<script>globalThis.__unsafe = true</script>');
    expect(globalThis.__unsafe).toBeUndefined();
  });
});
