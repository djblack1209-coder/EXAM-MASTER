import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() }));
enableAutoUnmount(afterEach);
beforeEach(() => setActivePinia(createPinia()));
function open(tracks = ['politics']) {
  storageService.save('exam_profile', { tracks });
  return mount(QuestionBankPage, { global: { stubs: { BaseIcon: true } } });
}
describe('single paper detail hierarchy', () => {
  it.each(['politics', 'english2'])('shows one selected paper and every real year in %s', async (id) => {
    const track = getPracticeNavigationTree({ tracks: [id] })
      .flatMap((s) => s.tracks)
      .find((t) => t.id === id);
    const wrapper = open([id]);
    await nextTick();
    expect(wrapper.findAll('.slot-detail')).toHaveLength(1);
    expect(wrapper.get('.slot-detail').text()).toContain(track.yearSlots.find((s) => s.clickable).name);
    expect(wrapper.findAll('.year-slot')).toHaveLength(track.yearSlots.length);
    expect(wrapper.findAll('.slot-action')).toHaveLength(1);
    expect(wrapper.find('.recommended-panel').exists()).toBe(false);
    expect(wrapper.find('.paper-list').exists()).toBe(false);
  });
});
