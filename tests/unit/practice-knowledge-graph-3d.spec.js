import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice knowledge graph mode', () => {
  it('keeps the knowledge graph mode removed from the public practice center', () => {
    expect(practiceSource).not.toContain("selectedModeId === 'knowledge_graph'");
    expect(practiceSource).not.toContain('knowledge-map-panel');
    expect(practiceSource).not.toContain('knowledge-module-card');
    expect(practiceSource).not.toContain('knowledge-topic-chip');
    expect(practiceSource).not.toContain('knowledge-graph-stage-3d');
    expect(practiceSource).not.toContain('knowledge-graph-node-3d');
    expect(practiceSource).not.toContain('perspective:');
    expect(practiceSource).not.toContain('translate3d(');
  });

  it('does not scroll to a hidden graph section', () => {
    expect(practiceSource).not.toContain(':scroll-into-view="scrollIntoViewId"');
    expect(practiceSource).not.toContain('id="knowledge-graph-section"');
    expect(practiceSource).not.toContain("this.scrollIntoViewId = 'knowledge-graph-section'");
  });
});
