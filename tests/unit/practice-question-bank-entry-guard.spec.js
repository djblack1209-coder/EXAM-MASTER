import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice question bank entry handoff', () => {
  it('routes bank cards into the question-bank detail flow instead of owning import semantics', () => {
    expect(practiceSource).toContain('@tap="openBankDetail(bank.id)"');
    expect(practiceSource).toContain('openBankDetail(bankId)');
    expect(practiceSource).toContain('this.openQuestionBank?.(bankId)');
    expect(practiceSource).toContain("t('ui.startPractice')");
    expect(practiceSource).toContain(':loading="loadingBankId === bank.id"');
    expect(practiceSource).not.toContain('@tap="handleLoadBank(bank.id)"');
    expect(practiceSource).not.toContain("{{ loadingBankId === bank.id ? '加载中' : '加载' }}");
    expect(practiceSource).not.toContain('class="bank-loaded"');
  });

  it('keeps dark-mode styling for both detail and continue entry buttons', () => {
    expect(practiceSource).toContain('<LearningShell');
    expect(practiceSource).toContain('variant="secondary"');
    expect(practiceSource).toContain('<BaseButton');
    expect(practiceSource).toContain('useThemeStore');
  });
});
