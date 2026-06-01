import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';
import { toast } from '@/utils/toast.js';

vi.mock('@/pages/practice-sub/bank-data-loader.js', () => ({
  loadBankData: vi.fn()
}));

vi.mock('@/utils/toast.js', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

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

describe('question bank start flow', () => {
  beforeEach(() => {
    loadBankData.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
  });

  it('routes loaded papers through safe navigation with a verified question id set', async () => {
    loadBankData.mockResolvedValue({
      id: 'politics-2025',
      name: '2025考研政治真题',
      subject: '政治',
      year: '2025',
      cards: [
        {
          id: 'politics-2025-001',
          question: '第一题题干内容足够长',
          options: ['A. A', 'B. B'],
          answer: 'A',
          type: 'single_choice'
        }
      ]
    });

    const wrapper = mountQuestionBank();
    await flushPromises();

    await wrapper.find('.slot-action').trigger('tap');
    await flushPromises();

    expect(loadBankData).toHaveBeenCalledWith('politics-2025');
    expect(storageService.get('smart_review_ids', [])).toEqual(['politics-2025-001']);
    expect(global.uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/pages/practice-sub/do-quiz?mode=smart_review&paperId=politics-2025'
      })
    );
    expect(toast.error).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('does not navigate when an imported paper has no usable questions', async () => {
    loadBankData.mockResolvedValue({
      id: 'politics-2025',
      name: '2025考研政治真题',
      subject: '政治',
      year: '2025',
      cards: []
    });

    const wrapper = mountQuestionBank();
    await flushPromises();

    await wrapper.find('.slot-action').trigger('tap');
    await flushPromises();

    expect(storageService.get('smart_review_ids', [])).toEqual([]);
    expect(global.uni.navigateTo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('本卷暂无可练题目');

    wrapper.unmount();
  });

  it('guards the source against direct navigation and unhandled load failures', () => {
    expect(source).toContain("import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate'");
    expect(source).toContain('safeNavigateTo(buildPracticeUrl(paper, ids))');
    expect(source).toContain("toast.error('本卷暂无可练题目')");
    expect(source).toContain('return null');
    expect(source).not.toContain('uni.navigateTo({ url: `/pages/practice-sub/do-quiz');
  });
});
