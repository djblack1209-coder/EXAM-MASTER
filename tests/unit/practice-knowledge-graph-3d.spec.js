import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice knowledge graph mode', () => {
  it('renders a mobile-ready 2D knowledge map instead of an experimental 3D scene', () => {
    expect(practiceSource).toContain("selectedModeId === 'knowledge_graph'");
    expect(practiceSource).toContain('knowledge-map-panel');
    expect(practiceSource).toContain('knowledge-module-card');
    expect(practiceSource).toContain('knowledge-topic-chip');
    expect(practiceSource).not.toContain('knowledge-graph-stage-3d');
    expect(practiceSource).not.toContain('knowledge-graph-node-3d');
    expect(practiceSource).not.toContain('perspective:');
    expect(practiceSource).not.toContain('translate3d(');
  });

  it('moves the scroll viewport to the graph when users switch into knowledge_graph mode', () => {
    expect(practiceSource).toContain(':scroll-into-view="scrollIntoViewId"');
    expect(practiceSource).toContain('id="knowledge-graph-section"');
    expect(practiceSource).toContain("this.scrollIntoViewId = 'knowledge-graph-section'");
  });
});
