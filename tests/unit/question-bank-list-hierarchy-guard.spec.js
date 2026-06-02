import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/question-bank.vue'), 'utf8');

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
    const wrapper = mountQuestionBank();
    await nextTick();

    expect(wrapper.find('.recommended-panel').text()).toContain('2025考研政治真题');
    expect(wrapper.find('.paper-list-head').exists()).toBe(true);
    expect(wrapper.find('.paper-list-head').text()).toContain('更多可练整卷');
    expect(wrapper.find('.paper-list-head').text()).toContain('推荐卷之外的正式年份');
    expect(wrapper.find('.paper-list-head').text()).toContain('19 卷');
    expect(wrapper.findAll('.paper-card')).toHaveLength(19);
    expect(wrapper.find('.paper-list').text()).not.toContain('2025考研政治真题');
    expect(wrapper.find('.paper-list').text()).toContain('2024考研政治真题');
    expect(wrapper.find('.empty-state').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows no secondary list when a track only has one playable recommendation', async () => {
    const wrapper = mountQuestionBank({ tracks: ['english2'] });
    await nextTick();

    expect(wrapper.find('.recommended-panel').text()).toContain('2025考研英语二真题');
    expect(wrapper.find('.paper-list').exists()).toBe(false);
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
