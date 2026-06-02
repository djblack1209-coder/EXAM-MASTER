import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/question-bank.vue'), 'utf8');

function mountQuestionBank() {
  storageService.save('exam_profile', { tracks: ['politics'] });
  return mount(QuestionBankPage, {
    global: {
      stubs: {
        BaseIcon: true
      }
    }
  });
}

describe('question bank local sync status', () => {
  it('shows local sync state and usable question count for loaded papers', async () => {
    storageService.save('loaded_flashcard_banks', ['politics-2025', 'politics-2024']);
    storageService.save('v30_bank', [
      { id: 'politics-2025-001', paperId: 'politics-2025', question: '第一题题干内容足够长' },
      { id: 'politics-2025-002', paperId: 'politics-2025', question: '第二题题干内容足够长' },
      { id: 'politics-2024-001', paperId: 'politics-2024', question: '2024第一题题干内容足够长' }
    ]);

    const wrapper = mountQuestionBank();
    await nextTick();

    expect(wrapper.find('.local-sync-strip').exists()).toBe(true);
    expect(wrapper.find('.local-sync-strip').text()).toContain('本地状态');
    expect(wrapper.find('.local-sync-strip').text()).toContain('已同步');
    expect(wrapper.find('.local-sync-strip').text()).toContain('可练题目');
    expect(wrapper.find('.local-sync-strip').text()).toContain('2 题');
    expect(wrapper.find('.paper-local-pill').classes()).toContain('synced');
    expect(wrapper.find('.paper-list').text()).toContain('1 题');
    expect(wrapper.text()).toContain('2 题');

    wrapper.unmount();
  });

  it('shows unsynced papers as explicit pending local sync', async () => {
    const wrapper = mountQuestionBank();
    await nextTick();

    expect(wrapper.find('.local-sync-strip').text()).toContain('未同步');
    expect(wrapper.find('.local-sync-strip').text()).toContain('待同步');
    expect(wrapper.find('.paper-local-row').text()).toContain('未同步');
    expect(wrapper.find('.paper-local-row').text()).toContain('待同步');

    wrapper.unmount();
  });

  it('guards local sync state wiring and dark-mode styling', () => {
    expect(source).toContain('localPaperStats');
    expect(source).toContain('buildLocalPaperStats');
    expect(source).toContain('refreshLocalPaperStats');
    expect(source).toContain('getPaperLocalState');
    expect(source).toContain('local-sync-strip');
    expect(source).toContain('paper-local-row');
    expect(source).toContain('.dark-mode .local-sync-strip');
    expect(source).toContain('.dark-mode .paper-local-pill.synced');
  });
});
