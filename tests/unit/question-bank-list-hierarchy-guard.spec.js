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

function getListExpectation(profile, trackId) {
  const track = getTrack(profile, trackId);
  const recommendedSlot = (track?.yearSlots || []).find((slot) => slot.clickable);
  const secondaryBanks = (track?.banks || []).filter((bank) => bank.id !== recommendedSlot?.bankId);
  return {
    recommendedSlot,
    secondaryBanks
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

describe('question bank list hierarchy', () => {
  it('keeps the recommended paper out of the secondary ready list', async () => {
    const profile = { tracks: ['politics'] };
    const expected = getListExpectation(profile, 'politics');
    const wrapper = mountQuestionBank(profile);
    await nextTick();

    expect(wrapper.find('.recommended-panel').text()).toContain(expected.recommendedSlot.name);
    expect(wrapper.find('.paper-list-head').exists()).toBe(true);
    expect(wrapper.find('.paper-list-head').text()).toContain('更多可练整卷');
    expect(wrapper.find('.paper-list-head').text()).toContain('推荐卷之外的正式年份');
    expect(wrapper.find('.paper-list-head').text()).toContain(`${expected.secondaryBanks.length} 卷`);
    expect(wrapper.findAll('.paper-card')).toHaveLength(expected.secondaryBanks.length);
    expect(wrapper.find('.paper-list').text()).not.toContain(expected.recommendedSlot.name);
    expect(wrapper.find('.paper-list').text()).toContain(expected.secondaryBanks[0].name);
    expect(wrapper.find('.empty-state').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows the secondary list when a track has additional playable years', async () => {
    const profile = { tracks: ['english2'] };
    const expected = getListExpectation(profile, 'english2');
    const wrapper = mountQuestionBank(profile);
    await nextTick();

    expect(wrapper.find('.recommended-panel').text()).toContain(expected.recommendedSlot.name);
    expect(wrapper.find('.paper-list').exists()).toBe(true);
    expect(wrapper.find('.paper-list-head').text()).toContain(`${expected.secondaryBanks.length} 卷`);
    expect(wrapper.findAll('.paper-card')).toHaveLength(expected.secondaryBanks.length);
    expect(wrapper.find('.paper-list').text()).not.toContain(expected.recommendedSlot.name);
    expect(wrapper.find('.paper-list').text()).toContain(expected.secondaryBanks[0].name);
    expect(wrapper.find('.empty-state').exists()).toBe(false);

    wrapper.unmount();
  });

  it('guards secondary-list hierarchy and dark-mode styling', () => {
    expect(source).toContain('secondaryReadyBanks');
    expect(source).toContain('paper-list-head');
    expect(source).toContain('更多可练整卷');
    expect(source).toContain('推荐卷之外的正式年份');
    expect(source).toContain('v-else-if="!recommendedSlot"');
    expect(source).toContain('.dark-mode .paper-list-title');
    expect(source).toContain('.dark-mode .paper-list-sub');
  });
});
