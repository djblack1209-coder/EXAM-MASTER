import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const source = readFileSync(resolve('src/pages/practice/index.vue'), 'utf8');
const template = source.split('</template>')[0];
describe('practice availability presentation', () => {
  it('uses registry availability without repeating workflow counters', () => {
    expect(template).toContain("t('ui.bankAvailability'");
    expect(template).toContain('selectedTrack.slotSummary?.ready');
    expect(template).toContain('selectedTrack.yearSlots?.length');
    expect(template).not.toContain('<BaseStat');
    expect(template).not.toContain('readinessSummary.pendingSlots');
    expect(template).not.toContain('readinessSummary.missingSlots');
  });
  it('keeps the shared frame and explicit start action', () => {
    expect(template).toContain('<LearningShell');
    expect(template).toContain('goDoQuiz({ resume: true })');
    expect(template).toContain('chooseImportSource()');
    expect(source).toContain('@/styles/yozi-pages.scss');
  });
});
