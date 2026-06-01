import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const answerSheetSource = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/answer-sheet/answer-sheet.vue'),
  'utf8'
);
const doQuizSource = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('answer sheet jump guard', () => {
  it('keeps answer-sheet jumps locked during active feedback states', () => {
    expect(doQuizSource).toContain(':jump-locked="isAnswerSheetJumpLocked"');
    expect(doQuizSource).toContain('isAnswerSheetJumpLocked()');
    expect(doQuizSource).toContain('return this.showResult || this.isAnalyzing || this.isNavigating');
    expect(doQuizSource).toContain("toast.info('请先完成当前题目的反馈')");
  });

  it('does not let the jump handler reset an active result flow', () => {
    const handlerStart = doQuizSource.indexOf('handleJumpToQuestion(index)');
    const handlerBody = doQuizSource.slice(handlerStart, doQuizSource.indexOf("logger.log('[do-quiz] ✅ 跳转到题目:'", handlerStart));

    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerBody).toContain('if (this.isAnswerSheetJumpLocked)');
    expect(handlerBody).toContain('return;');
    expect(handlerBody).toContain('index < 0 || index >= this.questions.length || index === this.currentIndex');
  });

  it('keeps a visible locked state in the answer sheet surface', () => {
    expect(answerSheetSource).toContain('jumpLocked: { type: Boolean, default: false }');
    expect(answerSheetSource).toContain('lockText: { type: String, default: \'请先完成当前反馈\' }');
    expect(answerSheetSource).toContain('v-if="jumpLocked"');
    expect(answerSheetSource).toContain('class="sheet-lock-notice"');
    expect(answerSheetSource).toContain('if (props.jumpLocked) return;');
    expect(answerSheetSource).toContain('cell-locked');
  });
});
