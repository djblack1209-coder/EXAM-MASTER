import { describe, expect, it } from 'vitest';
import { diagnose, validateGraph } from '@/services/learning/knowledge-graph.js';
import { knowledgeGraphSeed } from '@/services/learning/knowledge-graph-seed.js';
import { mathGraphFixture } from '../fixtures/knowledge-graph-math.js';

function errorCode(fn, code) {
  expect(fn).toThrowError(new RegExp(code));
  try {
    fn();
  } catch (error) {
    expect(error.code).toBe(code);
  }
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe('knowledge graph structure', () => {
  it('accepts the original math fixture and hard DAG with shared ancestors', () => {
    const graph = mathGraphFixture();
    graph.edges.push({ from: 'integer', to: 'divide', strength: 'hard' });
    expect(validateGraph(graph)).toBe(true);
  });

  it.each([
    ['missing graph', () => null],
    ['empty graph', (g) => ({ ...g, topics: [] })],
    ['missing version', (g) => ({ ...g, version: '' })],
    ['missing subject', (g) => ({ ...g, subject: null })],
    ['invalid edges', (g) => ({ ...g, edges: null })],
    [
      'duplicate ID',
      (g) => {
        g.topics[1].id = g.topics[0].id;
        return g;
      }
    ],
    [
      'blank ID',
      (g) => {
        g.topics[0].id = ' ';
        return g;
      }
    ],
    [
      'invalid topic type',
      (g) => {
        g.topics[0].type = 'unknown';
        return g;
      }
    ],
    [
      'empty mastery criteria',
      (g) => {
        g.topics[0].masteryCriteria = [];
        return g;
      }
    ],
    [
      'missing prompt',
      (g) => {
        g.topics[0].diagnostic.prompt = '';
        return g;
      }
    ],
    [
      'missing topic',
      (g) => {
        g.edges[0].from = 'missing';
        return g;
      }
    ],
    [
      'invalid strength',
      (g) => {
        g.edges[0].strength = 'required';
        return g;
      }
    ],
    [
      'self-loop',
      (g) => {
        g.edges[0].from = g.edges[0].to;
        return g;
      }
    ],
    [
      'duplicate edge',
      (g) => {
        g.edges.push({ ...g.edges[0] });
        return g;
      }
    ],
    [
      'same pair with different strength',
      (g) => {
        g.edges.push({ ...g.edges[0], strength: 'soft' });
        return g;
      }
    ],
    [
      'hard cycle',
      (g) => {
        g.edges.push({ from: 'equation', to: 'integer', strength: 'hard' });
        return g;
      }
    ],
    [
      'invalid choice key',
      (g) => {
        g.topics[0].diagnostic.answerIndex = 5;
        return g;
      }
    ],
    [
      'fractional choice key',
      (g) => {
        g.topics[0].diagnostic.answerIndex = 0.5;
        return g;
      }
    ],
    [
      'duplicate options',
      (g) => {
        g.topics[0].diagnostic.options = ['a', 'a'];
        return g;
      }
    ],
    [
      'blank option',
      (g) => {
        g.topics[0].diagnostic.options = ['a', ''];
        return g;
      }
    ],
    [
      'mixed question shape',
      (g) => {
        g.topics[0].diagnostic.rubric = [];
        return g;
      }
    ],
    [
      'unknown question kind',
      (g) => {
        g.topics[0].diagnostic.kind = 'text';
        return g;
      }
    ],
    [
      'bad lowered question',
      (g) => {
        g.topics[0].diagnostic.lowered.answerIndex = -1;
        return g;
      }
    ],
    [
      'recursive lowered question',
      (g) => {
        g.topics[0].diagnostic.lowered.lowered = g.topics[1].diagnostic;
        return g;
      }
    ]
  ])('rejects %s with GRAPH_INVALID', (_name, change) => {
    errorCode(() => validateGraph(change(mathGraphFixture())), 'GRAPH_INVALID');
  });

  it('allows a soft reverse link without imposing a prerequisite cycle', () => {
    const graph = mathGraphFixture();
    graph.edges.push({ from: 'equation', to: 'integer', strength: 'soft' });
    expect(validateGraph(graph)).toBe(true);
  });

  it('rejects sparse option and mastery-criteria arrays', () => {
    for (const field of ['options', 'masteryCriteria']) {
      const graph = mathGraphFixture();
      const target = field === 'options' ? graph.topics[0].diagnostic : graph.topics[0];
      target[field] = ['one', , 'three'];
      errorCode(() => validateGraph(graph), 'GRAPH_INVALID');
    }
  });

  it.each([
    (d) => {
      d.rubric[2].level = 1;
    },
    (d) => {
      d.rubric[1].criteria = [];
    },
    (d) => {
      d.rubric[0].label = '';
    },
    (d) => {
      d.options = ['mixed'];
    },
    (d) => {
      d.answerIndex = 0;
    }
  ])('rejects invalid rubric definitions', (change) => {
    const graph = structuredClone(knowledgeGraphSeed);
    change(graph.topics[0].diagnostic);
    errorCode(() => validateGraph(graph), 'GRAPH_INVALID');
  });
});

describe('adaptive diagnostic traversal', () => {
  it('starts at the target only; unknown prerequisites stay unknown', () => {
    const result = diagnose(mathGraphFixture(), { targetId: 'equation' });
    expect(result.visitedIds).toEqual(['equation']);
    expect(Object.values(result.statuses).every((state) => state === 'untested')).toBe(true);
    expect(result.nextTests).toMatchObject([{ topicId: 'equation', phase: 'main', requiresQuestion: false }]);
    expect(result.nextTests[0].diagnostic).toEqual({
      prompt: 'x/2 + x/3 = 5，x = ?',
      kind: 'choice',
      options: ['6', '5']
    });
    expect(result.complete).toBe(false);
    expect(result.rootCauses).toEqual([]);
  });

  it('prunes all hard ancestors on a correct target without claiming their mastery', () => {
    const result = diagnose(mathGraphFixture(), { targetId: 'equation', answers: { equation: [0] } });
    expect(result.statuses.equation).toBe('mastered');
    expect(result.prunedIds).toHaveLength(7);
    expect(result.prunedIds).not.toContain('ratio');
    expect(result.statuses.integer).toBe('untested');
    expect(result.learningPath).toEqual([]);
    expect(result.nextTests).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it('offers a distinct lowered trial after one wrong response before tracing prerequisites', () => {
    const result = diagnose(mathGraphFixture(), { targetId: 'equation', answers: { equation: [1] } });
    expect(result.statuses.equation).toBe('untested');
    expect(result.visitedIds).toEqual(['equation']);
    expect(result.nextTests).toMatchObject([
      { topicId: 'equation', phase: 'lowered', diagnostic: { prompt: 'x/2 = 3，x = ?' } }
    ]);
    expect(result.rootCauses).toEqual([]);
  });

  it('asks the caller for a lowered question when the optional template is missing', () => {
    const graph = mathGraphFixture();
    delete graph.topics.find((topic) => topic.id === 'equation').diagnostic.lowered;
    expect(diagnose(graph, { targetId: 'equation', answers: { equation: [1] } }).nextTests).toEqual([
      { topicId: 'equation', phase: 'lowered', diagnostic: null, requiresQuestion: true }
    ]);
    errorCode(() => diagnose(graph, { targetId: 'equation', answers: { equation: [1, 0] } }), 'DIAGNOSIS_INVALID');
  });

  it('backtracks on two wrong answers and leaves a provisional cause until prerequisites are resolved', () => {
    const result = diagnose(mathGraphFixture(), { targetId: 'equation', answers: { equation: [1, 1] } });
    expect(result.statuses.equation).toBe('weak');
    expect(result.statuses.linear).toBe('untested');
    expect(result.nextTests).toMatchObject([{ topicId: 'linear', phase: 'main' }]);
    expect(result.learningPath).toEqual(['linear', 'equation']);
    expect(result.rootCauses).toMatchObject([{ topicId: 'equation', provisional: true }]);
  });

  it('finds the deepest observed weak point and puts prerequisites first in a multi-step path', () => {
    const answers = Object.fromEntries(
      ['equation', 'linear', 'fraction-add', 'common-denom', 'fraction', 'divide'].map((id) => [id, [1, 1]])
    );
    answers.multiply = [0];
    const result = diagnose(mathGraphFixture(), { targetId: 'equation', answers });
    expect(result.rootCauses).toEqual([{ topicId: 'divide', provisional: false, blockers: [] }]);
    expect(result.learningPath).toEqual(['divide', 'fraction', 'common-denom', 'fraction-add', 'linear', 'equation']);
    expect(result.prunedIds).toEqual(['integer']);
    expect(result.complete).toBe(true);
  });

  it.each([
    [1, 0],
    [0, 1]
  ])('classifies a mixed pair %j as unstable without tracing deeper', (...attempts) => {
    const result = diagnose(mathGraphFixture(), { targetId: 'equation', answers: { equation: attempts } });
    expect(result.statuses.equation).toBe('unstable');
    expect(result.visitedIds).toEqual(['equation']);
    expect(result.nextTests).toEqual([]);
    expect(result.rootCauses).toEqual([]);
    expect(result.prunedIds).toEqual([]);
  });

  it('does not backtrack over soft links, even when soft-linked answers are supplied', () => {
    const result = diagnose(mathGraphFixture(), { targetId: 'equation', answers: { equation: [1, 1], ratio: [1, 1] } });
    expect(result.visitedIds).not.toContain('ratio');
    expect(result.statuses.ratio).toBe('untested');
    expect(result.softHints).toEqual([{ from: 'ratio', to: 'equation', strength: 'soft', reason: '仅为提示关系' }]);
  });

  it('skips prior verified mastery, but fresh contrary evidence overrides it', () => {
    const graph = mathGraphFixture();
    const answers = { equation: [1, 1] };
    const prior = diagnose(graph, { targetId: 'equation', answers, masteredIds: ['linear'] });
    expect(prior.statuses.linear).toBe('mastered');
    expect(prior.nextTests).toEqual([]);
    expect(prior.evidence.find((row) => row.topicId === 'linear').source).toBe('prior');
    const fresh = diagnose(graph, {
      targetId: 'equation',
      answers: { ...answers, linear: [1] },
      masteredIds: ['linear']
    });
    expect(fresh.statuses.linear).toBe('untested');
    expect(fresh.nextTests).toMatchObject([{ topicId: 'linear', phase: 'lowered' }]);
  });

  it('visits a shared prerequisite once and preserves evidence despite another mastered branch', () => {
    const graph = mathGraphFixture();
    graph.edges.push({ from: 'common-denom', to: 'equation', strength: 'hard' });
    const answers = { equation: [1, 1], linear: [0], 'common-denom': [1, 1], fraction: [0] };
    const result = diagnose(graph, { targetId: 'equation', answers });
    expect(result.statuses['common-denom']).toBe('weak');
    expect(result.prunedIds).not.toContain('common-denom');
    expect(result.evidence.filter((row) => row.topicId === 'common-denom')).toHaveLength(1);
    expect(result.learningPath).toEqual(['common-denom', 'equation']);
  });

  it('keeps multiple weak roots and topological paths across a prerequisite diamond', () => {
    const graph = mathGraphFixture();
    graph.edges.push({ from: 'ratio', to: 'linear', strength: 'hard' });
    const answers = { equation: [1, 1], linear: [1, 1], 'fraction-add': [1, 1], 'common-denom': [0], ratio: [1, 1] };
    const result = diagnose(graph, { targetId: 'equation', answers });
    expect(result.rootCauses.map((cause) => cause.topicId)).toEqual(['ratio', 'fraction-add']);
    const positions = new Map(result.learningPath.map((id, index) => [id, index]));
    for (const edge of graph.edges.filter((edge) => edge.strength === 'hard')) {
      if (positions.has(edge.from) && positions.has(edge.to))
        expect(positions.get(edge.from)).toBeLessThan(positions.get(edge.to));
    }
  });

  it('treats null/missing primary evidence as untested, even with a lowered response', () => {
    const result = diagnose(mathGraphFixture(), { targetId: 'equation', answers: { equation: [null, 0] } });
    expect(result.statuses.equation).toBe('untested');
    expect(result.nextTests[0].phase).toBe('main');
  });

  it.each([
    null,
    [],
    { targetId: 'missing' },
    { targetId: 'equation', answers: null },
    { targetId: 'equation', answers: [] },
    { targetId: 'equation', answers: { missing: [0] } },
    { targetId: 'equation', answers: { equation: [0, 0, 0] } },
    { targetId: 'equation', answers: { equation: [, 0] } },
    { targetId: 'equation', answers: { equation: [true] } },
    { targetId: 'equation', answers: { equation: ['0'] } },
    { targetId: 'equation', answers: { equation: [2] } },
    { targetId: 'equation', masteredIds: ['missing'] }
  ])('rejects malformed requests instead of guessing evidence: %j', (input) => {
    errorCode(() => diagnose(mathGraphFixture(), input), 'DIAGNOSIS_INVALID');
  });

  it('uses each phase’s own choice key and option range', () => {
    const graph = mathGraphFixture();
    const diagnostic = graph.topics.find((topic) => topic.id === 'equation').diagnostic;
    diagnostic.lowered.options.push('9');
    diagnostic.lowered.answerIndex = 2;
    expect(diagnose(graph, { targetId: 'equation', answers: { equation: [1, 2] } }).statuses.equation).toBe('unstable');
  });

  it('is deterministic with frozen inputs and returns no mutable aliases', () => {
    const graph = freeze(mathGraphFixture());
    const input = freeze({ targetId: 'equation', answers: { equation: [1, 1] }, masteredIds: [] });
    const before = JSON.stringify({ graph, input });
    const result = diagnose(graph, input);
    expect(diagnose(graph, input)).toEqual(result);
    result.softHints[0].reason = 'changed';
    result.nextTests[0].diagnostic.options.push('changed');
    result.evidence[0].scores.push(2);
    expect(JSON.stringify({ graph, input })).toBe(before);
    expect(diagnose(graph, input).nextTests[0].diagnostic.options).toHaveLength(2);
  });
});

describe('rubric adaptation and original writing seed', () => {
  it.each([
    [[], 'untested'],
    [[0], 'untested'],
    [[1], 'untested'],
    [[2], 'mastered'],
    [[0, 0], 'weak'],
    [[0, 1], 'untested'],
    [[1, 0], 'untested'],
    [[1, 1], 'untested'],
    [[0, 2], 'unstable'],
    [[2, 0], 'unstable'],
    [[1, 2], 'unstable'],
    [[2, 1], 'unstable'],
    [[2, 2], 'mastered']
  ])('maps rubric levels %j to %s without turning partial work into a binary failure', (attempts, state) => {
    const result = diagnose(knowledgeGraphSeed, { targetId: 'application', answers: { application: attempts } });
    expect(result.statuses.application).toBe(state);
    if (state !== 'weak') expect(result.visitedIds).toEqual(['application']);
    if (attempts.length === 2 && !attempts.includes(2) && attempts.includes(1)) {
      expect(result.insufficientEvidence).toEqual(['application']);
      expect(result.complete).toBe(false);
      expect(result.rootCauses).toEqual([]);
    }
  });

  it.each([-1, 3, 0.5, '2', NaN])('rejects invalid rubric level %s', (score) => {
    errorCode(
      () => diagnose(knowledgeGraphSeed, { targetId: 'application', answers: { application: [score] } }),
      'DIAGNOSIS_INVALID'
    );
  });

  it('has 26 original writing nodes, 36 edges and a real lowered diagnostic for every node', () => {
    expect(validateGraph(knowledgeGraphSeed)).toBe(true);
    expect(knowledgeGraphSeed.topics).toHaveLength(26);
    expect(knowledgeGraphSeed.edges).toHaveLength(36);
    expect(knowledgeGraphSeed.edges.filter((edge) => edge.strength === 'hard')).toHaveLength(29);
    expect(knowledgeGraphSeed.edges.filter((edge) => edge.strength === 'soft')).toHaveLength(7);
    expect(knowledgeGraphSeed.topics.filter((topic) => topic.diagnostic.kind === 'rubric')).toHaveLength(22);
    expect(knowledgeGraphSeed.topics.filter((topic) => topic.diagnostic.kind === 'choice')).toHaveLength(4);
    for (const topic of knowledgeGraphSeed.topics) {
      expect(topic.subject).toBe('kaoyan-english-writing');
      expect(topic.diagnostic.lowered.prompt).not.toBe(topic.diagnostic.prompt);
      if (topic.diagnostic.kind === 'rubric')
        expect(topic.diagnostic.rubric.map((row) => row.level)).toEqual([0, 1, 2]);
    }
  });

  it('traverses every original writing node without a missing prerequisite or path order violation', () => {
    const allWrong = Object.fromEntries(
      knowledgeGraphSeed.topics.map((topic) => [
        topic.id,
        topic.diagnostic.kind === 'rubric'
          ? [0, 0]
          : [
              (topic.diagnostic.answerIndex + 1) % topic.diagnostic.options.length,
              (topic.diagnostic.lowered.answerIndex + 1) % topic.diagnostic.lowered.options.length
            ]
      ])
    );
    for (const topic of knowledgeGraphSeed.topics) {
      const result = diagnose(knowledgeGraphSeed, { targetId: topic.id, answers: allWrong });
      expect(result.complete).toBe(true);
      const positions = new Map(result.learningPath.map((id, index) => [id, index]));
      for (const edge of knowledgeGraphSeed.edges.filter((edge) => edge.strength === 'hard')) {
        if (positions.has(edge.to)) expect(positions.get(edge.from)).toBeLessThan(positions.get(edge.to));
      }
      expect(result.rootCauses.every((cause) => !cause.provisional)).toBe(true);
    }
  });
});
