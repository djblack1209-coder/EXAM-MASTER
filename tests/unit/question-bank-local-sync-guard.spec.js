import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() }));
enableAutoUnmount(afterEach);
beforeEach(() => setActivePinia(createPinia()));
function open(tracks = ['politics']) {
  storageService.save('exam_profile', { tracks });
  return mount(QuestionBankPage, { global: { stubs: { BaseIcon: true } } });
}
describe('question bank preserves local records without workflow labels', () => {
  it.each([true, false])('opening a paper with loaded=%s does not mutate its bank or sync markers', async (loaded) => {
    const records = loaded ? [{ id: 'keep', paperId: 'politics-2025', question: '原题保持' }] : [];
    const ids = loaded ? ['politics-2025'] : [];
    storageService.save('v30_bank', records);
    storageService.save('loaded_flashcard_banks', ids);
    const wrapper = open();
    await nextTick();
    expect(wrapper.get('.slot-action').text()).toBe('开始练习');
    expect(wrapper.text()).not.toContain('未同步');
    expect(wrapper.text()).not.toContain('已同步');
    expect(wrapper.text()).not.toContain('待同步');
    expect(storageService.get('v30_bank')).toEqual(records);
    expect(storageService.get('loaded_flashcard_banks')).toEqual(ids);
  });
});
