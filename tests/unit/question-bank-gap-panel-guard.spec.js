import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';

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
    expect(gapPanel.text()).toContain('优先展示当前方向最近年份');
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

    expect(wrapper.find('.gap-panel').text()).toContain(
      `整理中 ${expected.organizing} · 待入库 ${expected.missing}`
    );
    expect(wrapper.findAll('.gap-item')).toHaveLength(expected.previewCount);
    expect(wrapper.find('.gap-panel').text()).toContain(expected.years[0]);

    wrapper.unmount();
  });

  it('guards gap panel wiring without backend workflow wording', () => {
    expect(source).toContain('selectedGapSlots');
    expect(source).toContain('selectedGapPreview');
    expect(source).toContain('selectedGapSummary');
    expect(source).toContain('buildGapReason');
    expect(source).toContain('buildGapNextStep');
    expect(source).toContain('gap-panel');
    expect(source).toContain('.dark-mode .gap-panel');
    expect(source).not.toContain('题库发布校验');
    expect(source).not.toContain('SourceEvidence');
    expect(source).not.toContain('答案 hash');
    expect(source).not.toContain('复核');
  });
});
