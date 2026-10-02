import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import LearningLanding from '@/components/business/learning/learning-landing.vue';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import HomePage from '@/pages/index/index.vue';
import LearningPage from '@/pages/learning/index.vue';
import { BRAND } from '@/config/brand.js';
vi.mock('@dcloudio/uni-app', () => ({ onLoad: () => {}, onShow: () => {}, onHide: () => {} }));
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true,
  LearningOverview: true
};
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.clearAllMocks();
});
describe('学习空间的实际入口与目录', () => {
  it('品牌与恢复入口使用共享状态，校验预览不会再次提交作答', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.submit('19', true, 'backup-ui-answer');
    const content = store.exportData();
    const wrapper = mount(LearningPage, {
      global: {
        stubs: {
          ...stubs,
          LearningShell: { template: '<div><slot /><slot name="controls" /></div>' },
          NumberLine: true
        }
      }
    });
    const button = (label) => wrapper.findAll('button').find((node) => node.text().trim() === label);
    await button('记录与隐私').trigger('tap');
    await button('恢复备份').trigger('tap');
    await wrapper.find('[aria-label="学习记录 JSON 备份"]').setValue(content);
    await button('校验并预览').trigger('tap');
    expect(wrapper.text()).toContain('新增 0 个操作');
    expect(button('确认合并记录').attributes('disabled')).toBeDefined();
    expect(store.state.attempts).toHaveLength(1);
    wrapper.unmount();
    const shell = mount(LearningShell, { global: { stubs } });
    expect(shell.find('.brand-name').text()).toContain(BRAND.chinese);
    expect(shell.find('.brand-mark').attributes('src')).toBe(BRAND.markOnDark);
    shell.unmount();
  });
  it('首页默认只挂载学习空间，不同时加载旧仪表盘或第二套导航', () => {
    const wrapper = mount(HomePage, {
      global: { stubs: { ...stubs, LearningLanding: true, PrivacyPopup: true, CustomTabbar: true } }
    });
    expect(wrapper.findComponent({ name: 'LearningLanding' }).exists()).toBe(true);
    expect(wrapper.find('.page').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'CustomTabbar' }).exists()).toBe(false);
    wrapper.unmount();
  });
  it('首页直接开始真实学习、保留来源口径，私人资料入口进入校对面板', async () => {
    const wrapper = mount(LearningLanding, { global: { stubs } });
    const store = useConversationLearningStore();
    await wrapper.find('textarea').setValue('12 + 8');
    const start = wrapper.findAll('button').find((button) => button.text().trim() === '开始学习');
    await start.trigger('tap');
    await flushPromises();
    expect(store.active.goal).toBe('12 + 8');
    expect(store.activeQuestion.validation.type).toBe('number');
    expect(store.summary.validAnswers).toBe(0);
    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/learning/index' }));
    await wrapper.find('.library-materials').trigger('tap');
    expect(uni.navigateTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: '/pages/learning/index?panel=materials' })
    );
    wrapper.unmount();
  });
  it('目录打开聚焦搜索，Escape 关闭并恢复原按钮焦点', async () => {
    const wrapper = mount(LearningShell, { attachTo: document.body, global: { stubs } });
    await wrapper.find('.mobile-menu').trigger('tap');
    await flushPromises();
    expect(wrapper.find('.space-sidebar').classes()).toContain('sidebar-open');
    expect(document.activeElement).toBe(wrapper.find('.search-input').element);
    expect(wrapper.find('.space-main').attributes()).toHaveProperty('inert');
    await wrapper.find('.search-input').trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('.space-sidebar').classes()).not.toContain('sidebar-open');
    expect(document.activeElement).toBe(wrapper.find('.mobile-menu').element);
    wrapper.unmount();
  });
});
