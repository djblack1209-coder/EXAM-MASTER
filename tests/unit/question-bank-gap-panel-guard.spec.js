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
describe('unavailable years remain visible in the year selector', () => {
  it.each(['politics', 'english1'])(
    'retains every blocked year for %s without internal workflow counters',
    async (id) => {
      const track = getPracticeNavigationTree({ tracks: [id] })
        .flatMap((s) => s.tracks)
        .find((t) => t.id === id);
      const wrapper = open([id]);
      await nextTick();
      const chips = wrapper.findAll('.year-slot');
      expect(chips).toHaveLength(track.yearSlots.length);
      expect(chips.filter((c) => c.text().includes('暂未开放'))).toHaveLength(
        track.yearSlots.filter((s) => !s.clickable).length
      );
      expect(wrapper.text()).not.toContain('整理中');
      expect(wrapper.text()).not.toContain('待入库');
      expect(wrapper.text()).not.toContain('待开放清单');
    }
  );
});
