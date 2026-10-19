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
import BaseInput from '@/components/base/base-input/base-input.vue';
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

function examPicker() {
  return wrapper
    .findAllComponents(BaseInput)
    .find((input) => input.props('label') === '英语一还是英语二？');
}

function skipButton() {
  return wrapper.findAll('button').find((item) => item.text().includes('跳过，按默认开始'));
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
});
