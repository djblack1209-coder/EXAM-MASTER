import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';
import { toast } from '@/utils/toast.js';

vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onUnload: vi.fn() }));

beforeEach(() => setActivePinia(createPinia()));

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

describe('question bank recommended start entry', () => {
  beforeEach(() => {
    loadBankData.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
  });

  it('surfaces the newest playable paper as the primary start recommendation', async () => {
    const wrapper = mountQuestionBank();
    await nextTick();

    const panel = wrapper.find('.slot-detail');
    expect(panel.exists()).toBe(true);
    expect(panel.text()).not.toContain('推荐开练');
    expect(panel.text()).toContain('2025考研政治真题');
    expect(panel.text()).not.toContain('当前方向最近可练整卷');
    expect(panel.text()).toContain('开始练习');
    expect(panel.text()).not.toContain('未同步');
    expect(panel.text()).not.toContain('待同步');

    wrapper.unmount();
  });

  it('switches recommendation copy when the recommended paper is already local', async () => {
    storageService.save('loaded_flashcard_banks', ['politics-2025']);
    storageService.save('v30_bank', [
      { id: 'politics-2025-001', paperId: 'politics-2025', question: '第一题题干内容足够长' },
      { id: 'politics-2025-002', paperId: 'politics-2025', question: '第二题题干内容足够长' }
    ]);

    const wrapper = mountQuestionBank();
    await nextTick();

    const panel = wrapper.find('.slot-detail');
    expect(panel.text()).toContain('开始练习');
    expect(panel.text()).not.toContain('已同步');
    expect(storageService.get('v30_bank')).toHaveLength(2);

    wrapper.unmount();
  });

  it('keeps the recommended action on the existing safe start flow', async () => {
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
    expect(storageService.get('smart_review_ids', [])).toEqual([]);
    const handoff = storageService.get('quiz_review_handoff_v1');
    expect(handoff.questions.map((q) => q.id)).toEqual(['politics-2025-001']);
    expect(handoff.questions[0].quizOriginal.fields.question).toBe('第一题题干内容足够长');
    expect(global.uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/pages/practice-sub/do-quiz?mode=smart_review&reviewId=${handoff.id}&paperId=politics-2025`
      })
    );

    wrapper.unmount();
  });

  it('guards recommendation wiring, dark-mode coverage, and user-facing wording', () => {
    expect(source).toContain('@tap="loadAndStartSlot(selectedYearSlot)"');
    expect(source).toContain('<LearningShell');
    expect(source).toContain('<BaseButton');
    for (const word of ['题库发布校验', 'SourceEvidence', '答案 hash', '复核']) expect(source).not.toContain(word);
  });
});
