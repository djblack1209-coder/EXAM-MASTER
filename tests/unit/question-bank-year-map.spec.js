import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/question-bank.vue'), 'utf8');

describe('question bank public-course year map', () => {
  it('renders the full release-scope year map with trustworthy slot states', () => {
    expect(source).toContain('2005-2026 整卷真题地图');
    expect(source).toContain('selectedYearSlots');
    expect(source).toContain('selectedYearSlot.clickable');
    expect(source).toContain('loadAndStartSlot');
    expect(source).toContain('status-organizing');
    expect(source).toContain('status-missing');
    expect(source).toContain('selectedYearSlot.disabledReason');
    expect(source).toContain('const organizingCount');
    expect(source).toContain('正式 ${ready} · 整理中 ${organizing} · 待入库 ${missing}');
  });

  it('keeps every track on the 2005-2026 map and marks disabled known banks as organizing', () => {
    const tree = getPracticeNavigationTree({ tracks: ['english2', 'math1'] });
    const tracks = tree.flatMap((subject) => subject.tracks);

    for (const track of tracks) {
      expect(track.yearSlots).toHaveLength(22);
      expect(track.yearSlots[0].year).toBe('2026');
      expect(track.yearSlots.at(-1).year).toBe('2005');
    }

    const english2 = tracks.find((track) => track.id === 'english2');
    expect(english2.slotSummary).toEqual({ total: 22, ready: 0, organizing: 1, missing: 21 });
    expect(english2.yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'english2-2025',
      status: 'organizing',
      statusLabel: '整理中',
      actionLabel: '整理中',
      clickable: false
    });
  });

  it('defaults a no-ready track to the newest known organizing slot instead of a missing slot', async () => {
    storageService.save('exam_profile', { tracks: ['english2'] });

    const wrapper = mount(QuestionBankPage, {
      global: {
        stubs: {
          BaseIcon: true
        }
      }
    });
    await nextTick();

    expect(wrapper.text()).toContain('2025考研英语二真题');
    expect(wrapper.text()).toContain('完整答案与篇章材料完善后开放整卷练习');
    expect(wrapper.text()).toContain('正式 0 · 整理中 1 · 待入库 21');
    expect(wrapper.find('.year-slot.active .slot-year').text()).toBe('2025');

    wrapper.unmount();
  });

  it('keeps only verified formal banks clickable in the operator-facing summary', async () => {
    storageService.save('exam_profile', { tracks: ['english1'] });

    const wrapper = mount(QuestionBankPage, {
      global: {
        stubs: {
          BaseIcon: true
        }
      }
    });
    await nextTick();

    expect(wrapper.text()).toContain('8');
    expect(wrapper.text()).toContain('正式');
    expect(wrapper.text()).toContain('1');
    expect(wrapper.text()).toContain('整理中');
    expect(wrapper.text()).toContain('正式 8 · 整理中 1 · 待入库 13');

    wrapper.unmount();
  });
});
