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
describe('unavailable paper recovery', () => {
  it('blocks start for an unavailable year and returns to a real available year without importing', async () => {
    const wrapper = open();
    await nextTick();
    const before = JSON.stringify(storageService.get('v30_bank', []));
    await wrapper.findAll('.year-slot')[0].trigger('tap');
    await nextTick();
    expect(wrapper.get('.year-slot.active .slot-year').text()).toBe('2026');
    expect(wrapper.find('.slot-action').exists()).toBe(false);
    expect(wrapper.get('.slot-detail').text()).toContain('这套试题暂未开放');
    await wrapper.get('.slot-detail .base-state .base-button').trigger('tap');
    await nextTick();
    expect(wrapper.get('.year-slot.active .slot-year').text()).toBe('2025');
    expect(wrapper.get('.slot-action').text()).toBe('开始练习');
    expect(JSON.stringify(storageService.get('v30_bank', []))).toBe(before);
  });
});
