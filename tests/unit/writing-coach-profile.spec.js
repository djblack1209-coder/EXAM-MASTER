import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
vi.mock('@dcloudio/uni-app', () => ({
  onShow: () => {},
  onHide: () => {},
  onLoad: () => {},
  onBackPress: () => {}
}));
import WritingCoach from '@/components/business/learning/writing-coach.vue';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { setLanguage } from '@/i18n/index.js';

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
  setLanguage('zh-CN');
  uni.clearStorageSync();
});
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};

// 建档卡片只有在 coach 已建立、profile 仍为空时出现。
async function profileCard() {
  const store = useConversationLearningStore();
  store.startCoach('考研英语写作');
  wrapper = mount(WritingCoach, { global: { stubs }, attachTo: document.body });
  await flushPromises();
  return { store, card: wrapper };
}

function byLabel(component, label) {
  return wrapper.findAllComponents(component).find((item) => item.props('label') === label);
}

function examPicker() {
  return byLabel(BaseSegmented, '英语一还是英语二？');
}

function subjectPicker() {
  return byLabel(BaseOptions, '你在准备什么？');
}

function skipButton() {
  return wrapper.findAll('button').find((item) => item.text().includes('跳过，按默认开始'));
}

function startButton() {
  return wrapper.findAll('button').find((item) => item.text().includes('开始建档'));
}

describe('建档「跳过」不覆盖用户已选的考试类型', () => {
  it('选了英语二再跳过，保存的仍是英语二', async () => {
    const { store } = await profileCard();
    expect(examPicker()).toBeTruthy();
    examPicker().vm.$emit('update:modelValue', 'english2');
    await flushPromises();
    skipButton().trigger('tap');
    await flushPromises();
    expect(store.active.coach.profile.exam).toBe('english2');
  });

  it('没选也没提英语二，跳过按英语一走默认值', async () => {
    const { store } = await profileCard();
    skipButton().trigger('tap');
    await flushPromises();
    expect(store.active.coach.profile).toMatchObject({
      exam: 'english1',
      minutes: 25,
      foundation: null
    });
  });

  it('入口点选的方向会一直带到跳过后保存的档案里', async () => {
    const store = useConversationLearningStore();
    wrapper = mount(WritingCoach, { global: { stubs }, attachTo: document.body });
    await flushPromises();
    subjectPicker().vm.$emit('update:modelValue', 'kaoyan_english');
    await flushPromises();
    startButton().trigger('tap');
    await flushPromises();
    skipButton().trigger('tap');
    await flushPromises();
    expect(store.active.coach.profile.subjects).toContain('kaoyan_english');
  });
});

describe('入口改为点选，不再让用户自己想该说什么', () => {
  it('没选方向时不能开始建档', async () => {
    const store = useConversationLearningStore();
    wrapper = mount(WritingCoach, { global: { stubs }, attachTo: document.body });
    await flushPromises();
    expect(subjectPicker()).toBeTruthy();
    expect(startButton().attributes('disabled')).toBeDefined();
    expect(store.active).toBeFalsy();
  });

  it('选了非考研英语方向不会假装开课', async () => {
    const store = useConversationLearningStore();
    wrapper = mount(WritingCoach, { global: { stubs }, attachTo: document.body });
    await flushPromises();
    subjectPicker().vm.$emit('update:modelValue', 'gongkao_shenlun');
    await flushPromises();
    startButton().trigger('tap');
    await flushPromises();
    expect(store.active).toBeFalsy();
    expect(wrapper.emitted('general')).toBeTruthy();
  });
});

describe('新一轮带练不继承上一轮的选择', () => {
  it('上一轮选英语二，这一轮重新建档后保存的是英语一', async () => {
    const store = await profileCard().then((r) => r.store);
    examPicker().vm.$emit('update:modelValue', 'english2');
    await flushPromises();
    skipButton().trigger('tap');
    await flushPromises();
    expect(store.active.coach.profile.exam).toBe('english2');

    // 结束会话让入口卡重现，草稿必须回到种子。
    store.selectedConversationId = null;
    await flushPromises();
    expect(subjectPicker()).toBeTruthy();
    subjectPicker().vm.$emit('update:modelValue', 'kaoyan_english');
    await flushPromises();
    startButton().trigger('tap');
    await flushPromises();
    expect(store.active.coach.profile).toBe(null);
    examPicker().vm.$emit('update:modelValue', 'english1');
    await flushPromises();
    skipButton().trigger('tap');
    await flushPromises();
    expect(store.active.coach.profile.exam).toBe('english1');
  });
});
