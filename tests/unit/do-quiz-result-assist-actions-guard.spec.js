import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('do quiz result assist actions guard', () => {
  it('keeps secondary result actions inside the result surface', () => {
    const assist = source.indexOf('class="result-assist-row"');
    expect(assist).toBeGreaterThan(-1);
    expect(source.indexOf('class="result-action-row"')).toBeGreaterThan(assist);
    for (const event of ['handleResultOpenNote', 'handleResultToggleFavorite', 'handleOpenAnswerSheet'])
      expect(source).toContain('@tap.stop="' + event + '"');
    expect(source).toContain("t('quiz.copy36')");
    expect(source).toContain("t('quiz.copy39')");
  });

  it('locks background question actions while feedback is active', () => {
    expect(source).toContain('isQuestionActionLocked()');
    expect(source).toContain('return this.showResult || this.isAnalyzing || this.isNavigating');
    expect(source).toContain(':disabled="isQuestionActionLocked"');
    expect(source).toContain('if (this.isQuestionActionLocked && !options.allowDuringResult)');
    expect(source).toContain("toast.info(t('quiz.copy95'))");
  });

  it('only lets result-surface actions bypass the feedback lock', () => {
    expect(source).toContain('async handleToggleFavorite(options = {})');
    expect(source).toContain('handleResultToggleFavorite()');
    expect(source).toContain('return this.handleToggleFavorite({ allowDuringResult: true })');
    expect(source).toContain('handleOpenNote(options = {})');
    expect(source).toContain('handleResultOpenNote()');
    expect(source).toContain('this.handleOpenNote({ allowDuringResult: true })');
  });

  it('keeps note tag chips free of visible icon text', () => {
    expect(source).not.toContain('{{ tag.icon }} {{ tag.name }}');
    expect(source).toContain('<BaseChip');
    expect(source).toContain('selectedNoteTags.includes(tag.id)');
    expect(source).toContain('uiText(tag.name)');
    expect(source).not.toContain(':style="{ background: tag.color }"');
  });
});
