import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('do quiz result assist actions guard', () => {
  it('keeps secondary result actions inside the result surface', () => {
    const assistRowIndex = source.indexOf('class="result-assist-row"');
    const actionRowIndex = source.indexOf('class="result-action-row"');

    expect(assistRowIndex).toBeGreaterThan(-1);
    expect(actionRowIndex).toBeGreaterThan(assistRowIndex);
    expect(source).toContain('@tap.stop="handleResultOpenNote"');
    expect(source).toContain('@tap.stop="handleResultToggleFavorite"');
    expect(source).toContain('@tap.stop="handleOpenAnswerSheet"');
    expect(source).toContain('<text class="result-assist-label">笔记</text>');
    expect(source).toContain("{{ isCurrentFavorited ? '已收藏' : '收藏' }}");
    expect(source).toContain('<text class="result-assist-label">答题卡</text>');
  });

  it('locks background question actions while feedback is active', () => {
    expect(source).toContain('isQuestionActionLocked()');
    expect(source).toContain('return this.showResult || this.isAnalyzing || this.isNavigating');
    expect(source).toContain("'is-action-locked': isQuestionActionLocked");
    expect(source).toContain('if (this.isQuestionActionLocked && !options.allowDuringResult)');
    expect(source).toContain("toast.info('请先完成当前题目的反馈')");
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
    expect(source).toContain('class="note-tag-dot"');
    expect(source).toContain(':style="{ background: tag.color }"');
    expect(source).toContain('{{ tag.name }}');
  });
});
