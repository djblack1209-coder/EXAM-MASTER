import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AnswerSheet from '@/pages/practice-sub/components/answer-sheet/answer-sheet.vue';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/answer-sheet/answer-sheet.vue'),
  'utf8'
);

describe('answer sheet experience guard', () => {
  it('keeps a compact review summary beyond answered count and accuracy', () => {
    for (const field of ['correctCount', 'wrongCount', 'reviewedCount', 'remainingCount'])
      expect(source).toContain(field);
    expect(source).toContain('<BaseStat');
    expect(source).toContain("t('quiz.copy154'");
  });

  it('does not count neutral flashcard reviews as wrong or graded accuracy', () => {
    expect(source).toContain('getQuizAnswerRecordOutcome(item)');
    expect(source).toContain('const gradedCount = computed(() => correctCount.value + wrongCount.value)');
    expect(source).toContain('return Math.round((correctCount.value / gradedCount.value) * 100)');
    expect(source).toContain(':class="cellClass(idx)"');
  });

  it('renders mixed historical self ratings as reviews and excludes them from accuracy', () => {
    const answers = [
      { index: 0, isCorrect: true, userChoice: 0 },
      { index: 1, isCorrect: true, userChoice: 'flashcard_rating_3' },
      { index: 2, isCorrect: false, userChoice: 'flashcard_rating_1' }
    ];
    const before = JSON.stringify(answers);
    const wrapper = mount(AnswerSheet, {
      global: { stubs: { WdPopup: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' } } },
      props: { visible: true, questions: [{}, {}, {}, {}], answeredQuestions: answers, currentIndex: 3 }
    });
    expect(wrapper.text()).toContain('旧记录 1（旧判对 1 / 旧判错 0）');
    expect(wrapper.text()).not.toContain('正确率 100%');
    expect(wrapper.text()).toContain('已记录 3/4');
    expect(wrapper.findAll('.cell-reviewed')).toHaveLength(2);
    expect(wrapper.findAll('.cell-wrong')).toHaveLength(0);
    expect(JSON.stringify(answers)).toBe(before);
    wrapper.unmount();
  });

  it('keeps reviewed status visible in the grid and legend', () => {
    expect(source).toContain("classes.push(status ? `cell-${status}` : 'cell-unanswered')");
    expect(source).toContain("t('quiz.copy157')");
    expect(source).toContain('quiz.state.');
  });

  it('keeps dark-mode coverage for answer-sheet review details', () => {
    expect(source).toContain('<CustomModal');
    expect(source).toContain('<BaseButton');
    expect(source).toContain('@/styles/yozi-pages.scss');
  });
});
