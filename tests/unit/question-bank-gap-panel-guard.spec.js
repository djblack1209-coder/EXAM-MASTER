import { beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';

vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() }));

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/question-bank.vue'), 'utf8');

function getTrack(profile, trackId) {
  return getPracticeNavigationTree(profile)
    .flatMap((subject) => subject.tracks || [])
    .find((track) => track.id === trackId);
}

function getGapExpectation(profile, trackId) {
  const track = getTrack(profile, trackId);
  const gapSlots = (track?.yearSlots || []).filter((slot) => !slot.clickable);
  return {
    organizing: gapSlots.filter((slot) => slot.status === 'organizing').length,
    missing: gapSlots.filter((slot) => slot.status === 'missing').length,
    previewCount: Math.min(gapSlots.length, 6),
    years: gapSlots.map((slot) => slot.year)
  };
}

function mountQuestionBank(profile = { tracks: ['politics'] }) {
  storageService.save('exam_profile', profile);
  return mount(QuestionBankPage, {
    global: {
      stubs: {
        BaseIcon: true
      }
    }
  });
}

describe('question bank gap panel', () => {
  it('shows an understandable gap list for unavailable years in the selected track', async () => {
    const profile = { tracks: ['politics'] };
    const expected = getGapExpectation(profile, 'politics');
    const wrapper = mountQuestionBank(profile);
    await nextTick();

    const gapPanel = wrapper.find('.gap-panel');
    expect(gapPanel.exists()).toBe(true);
    expect(gapPanel.text()).toContain('待开放清单');
    expect(gapPanel.text()).not.toContain('优先展示当前方向最近年份');
    expect(gapPanel.text()).toContain(`整理中 ${expected.organizing} · 待入库 ${expected.missing}`);
    expect(wrapper.findAll('.gap-item')).toHaveLength(expected.previewCount);
    expect(gapPanel.text()).toContain(expected.years[0]);
    expect(gapPanel.text()).toContain(expected.years[1]);
    expect(gapPanel.text()).toContain('资料暂未入库');
    expect(gapPanel.text()).toContain('资料入库后开放');

    wrapper.unmount();
  });

  it('updates the gap summary when switching tracks', async () => {
    const profile = { tracks: ['english1'] };
    const expected = getGapExpectation(profile, 'english1');
    const wrapper = mountQuestionBank(profile);
    await nextTick();

    expect(wrapper.find('.gap-panel').text()).toContain(`整理中 ${expected.organizing} · 待入库 ${expected.missing}`);
    expect(wrapper.findAll('.gap-item')).toHaveLength(expected.previewCount);
    expect(wrapper.find('.gap-panel').text()).toContain(expected.years[0]);

    wrapper.unmount();
  });

  it('guards gap panel wiring without backend workflow wording', () => {
    for (const field of [
      'selectedGapSlots',
      'selectedGapPreview',
      'selectedGapSummary',
      'buildGapReason',
      'buildGapNextStep',
      'gap-panel'
    ])
      expect(source).toContain(field);
    expect(source).toContain('@/styles/yozi-pages.scss');
    for (const word of ['题库发布校验', 'SourceEvidence', '答案 hash', '复核']) expect(source).not.toContain(word);
  });
});

beforeEach(() => setActivePinia(createPinia()));
