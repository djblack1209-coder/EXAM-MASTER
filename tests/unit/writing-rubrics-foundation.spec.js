import { describe, expect, it, vi } from 'vitest';
import {
  WRITING_RUBRICS,
  WRITING_SCORE_NOTICE,
  WRITING_ANTI_LENGTH_POLICY,
  WRITING_BAND_NULL_REASONS,
  WRITING_BAND_RESULT_CONTRACT,
  normalizeWritingBandResult,
  validateWritingRubric,
  writingScoreBand
} from '../../laf-backend/functions/_shared/writing-rubrics.js';
import {
  normalizeRubric,
  normalizeWritingBandContext,
  WRITING_BAND_PROMPT_VERSION,
  WRITING_BAND_GUIDED_PROMPT_VERSION,
  WRITING_BAND_LOCATED_PROMPT_VERSION,
  writingAnswerHash
} from '../../laf-backend/functions/_shared/learning-rubric.js';
import { WRITING_METHOD } from '../../laf-backend/functions/_shared/learning-writing-coach.js';
import { historyChecksum } from '../../laf-backend/functions/_shared/learning-history.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
const [small, large, chinese] = WRITING_RUBRICS;

function bandFixture(exam = 'english2', section = 'A') {
  const rubric = WRITING_RUBRICS.find((r) => r.id === `kaoyan-${exam}-${section.toLowerCase()}-foundation-v1`);
  const text = '😀 I can join.\n\nI will help.';
  const task = {
    taskId: 'synthetic-task',
    taskVersion: 1,
    prompt: 'Invite a friend to an event.',
    patterns: [['I am writing to...']]
  };
  const submission = {
    submissionId: 'synthetic-submission',
    taskId: task.taskId,
    taskVersion: 1,
    text,
    answerHash: `fnv1a32:${historyChecksum(text)}:${text.length}`,
    submittedAt: 1000,
    authorship: 'user_typed'
  };
  const request = {
    id: 'synthetic-band-request',
    binding: 'synthetic-binding',
    status: 'pending',
    modelId: 'synthetic-model',
    request: { phase: 'essay', input: text, task: task.prompt, exam, essayType: section === 'B' ? 'large' : 'small' }
  };
  const context = { submission, task, rubric, request, promptVersion: 'synthetic-band-prompt-v1' };
  const span = { quote: 'I can join.', start: 3, end: 14 };
  const value = {
    contract: WRITING_BAND_RESULT_CONTRACT,
    binding: {
      submissionId: submission.submissionId,
      answerHash: submission.answerHash,
      taskId: task.taskId,
      taskVersion: 1,
      rubricId: rubric.id,
      rubricVersion: 1,
      requestId: request.id
    },
    status: 'observation_only',
    nullReason: null,
    band: null,
    bandRange: null,
    scoreEstimate: null,
    maxScore: null,
    taskCoverage: [],
    observations: [{ key: 'language', evidenceSpans: [span], note: '该句表达参与意愿。' }],
    integrityFlags: []
  };
  return { context, value, span };
}

describe('writing-band-result-v1 independent S2 contract, no model calls or storage', () => {
  it('binds a frozen explicit original and UTF-16 quote without changing its input', () => {
    const { context, value } = bandFixture();
    const before = JSON.stringify({ context, value });
    const result = normalizeWritingBandResult(value, context);
    expect(result).toMatchObject({
      contract: WRITING_BAND_RESULT_CONTRACT,
      status: 'observation_only',
      band: null,
      bandRange: null,
      scoreEstimate: null,
      maxScore: null,
      reviewRequired: true,
      officialScore: false,
      sourceTier: 'secondary_unverified',
      length: { count: 6, countRule: 'english-token-v1', bounds: null },
      provenance: { kind: 'ai_assisted', modelId: 'synthetic-model', promptVersion: 'synthetic-band-prompt-v1' }
    });
    expect(result.observations[0].evidenceSpans[0]).toMatchObject({ start: 3, end: 14, quote: 'I can join.' });
    expect(result.blockReasons).toEqual(['source_unverified', 'task_points_unstructured']);
    expect(JSON.stringify({ context, value })).toBe(before);
    for (const mutate of [
      (c) => {
        c.submission.authorship = 'model_generated';
      },
      (c) => {
        delete c.submission.submittedAt;
      },
      (c) => {
        c.task.taskVersion++;
      },
      (c) => {
        c.request.status = 'closed';
      },
      (c) => {
        c.request.request.essayType = 'unrecognized';
      },
      (c) => {
        c.submission.answerHash = 'forged';
      }
    ]) {
      const invalid = copy(context);
      mutate(invalid);
      expect(() => normalizeWritingBandResult(value, invalid)).toThrow();
    }
    for (const invalid of [
      { ...copy(value), status: 'zero', band: 0 },
      { ...copy(value), scoreEstimate: 0 },
      { ...copy(value), maxScore: 10 },
      { ...copy(value), binding: { ...value.binding, requestId: 'old-request' } },
      {
        ...copy(value),
        observations: [{ key: 'language', evidenceSpans: [{ quote: '\ud83d', start: 0, end: 1 }], note: '截断字符' }]
      },
      { ...copy(value), observations: [{ ...value.observations[0], score: 5 }] }
    ])
      expect(() => normalizeWritingBandResult(invalid, context)).toThrow();
  });

  it('missing English1 picture or English2 chart data never becomes a student content/data judgment', () => {
    for (const exam of ['english1', 'english2']) {
      const { context, value, span } = bandFixture(exam, 'B');
      context.task.taskPoints = [{ id: 'author-point' }];
      value.taskCoverage = [
        { taskPointId: 'author-point', status: null, evidence: [], nullReason: 'task_data_missing' }
      ];
      expect(normalizeWritingBandResult(value, context)).toMatchObject({
        status: 'observation_only',
        band: null,
        taskCoverage: [{ status: null, nullReason: 'task_data_missing' }],
        blockReasons: ['source_unverified', 'task_data_missing']
      });
      const covered = copy(value);
      covered.taskCoverage[0] = { taskPointId: 'author-point', status: 'covered', evidence: [span], nullReason: null };
      expect(() => normalizeWritingBandResult(covered, context)).toThrow();
      const dataFlag = copy(value);
      dataFlag.integrityFlags = [{ kind: 'fabricated_data', spans: [span], taskDatumId: 'guessed-datum' }];
      expect(() => normalizeWritingBandResult(dataFlag, context)).toThrow();
      const content = copy(value);
      content.observations[0].key = 'content';
      expect(() => normalizeWritingBandResult(content, context)).toThrow();
      const unstructured = copy(context);
      delete unstructured.task.taskPoints;
      expect(() => normalizeWritingBandResult(value, unstructured)).toThrow();
    }
  });

  it('new dev guided observations keep valid coaching text without admitting forged evidence or mastery', () => {
    vi.stubGlobal('__YOZI_DEV_TEST__', true);
    try {
      const { context, value, span } = bandFixture();
      context.modelTexts = [span.quote];
      const before = JSON.stringify({ context, value });
      expect(() => normalizeWritingBandResult(value, context)).toThrow();
      const guided = { ...context, promptVersion: WRITING_BAND_GUIDED_PROMPT_VERSION };
      const result = normalizeWritingBandResult(value, guided);
      expect(result).toMatchObject({
        status: 'observation_only',
        band: null,
        scoreEstimate: null,
        officialScore: false,
        reviewRequired: true,
        provenance: { kind: 'ai_assisted', promptVersion: WRITING_BAND_GUIDED_PROMPT_VERSION }
      });
      expect(result.observations).toHaveLength(1);
      expect(result.blockReasons).toContain('model_text_overlap');
      for (const mutate of [
        (v) => {
          v.observations[0].evidenceSpans[0].quote = 'forged evidence';
        },
        (v) => {
          v.observations[0].evidenceSpans[0].start++;
        },
        (v) => {
          v.binding.taskId = 'another task';
        }
      ]) {
        const invalid = copy(value);
        mutate(invalid);
        expect(() => normalizeWritingBandResult(invalid, guided)).toThrow();
      }
      const binding = {
        ...value.binding,
        contract: WRITING_BAND_RESULT_CONTRACT,
        promptVersion: WRITING_BAND_GUIDED_PROMPT_VERSION
      };
      expect(normalizeWritingBandContext(binding, context.request.request).promptVersion).toBe(
        WRITING_BAND_GUIDED_PROMPT_VERSION
      );
      expect(JSON.stringify({ context, value })).toBe(before);
      vi.stubGlobal('__YOZI_DEV_TEST__', false);
      expect(() => normalizeWritingBandResult(value, guided)).toThrow();
      expect(() => normalizeWritingBandContext(binding, context.request.request)).toThrow();
      expect(
        normalizeWritingBandContext({ ...binding, promptVersion: WRITING_BAND_PROMPT_VERSION }, context.request.request)
          .promptVersion
      ).toBe(WRITING_BAND_PROMPT_VERSION);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('new host coordinates locate only unique exact UTF-16 quotes while old bad ranges stay rejected', () => {
    vi.stubGlobal('__YOZI_DEV_TEST__', true);
    try {
      const { context, value, span } = bandFixture();
      context.promptVersion = WRITING_BAND_LOCATED_PROMPT_VERSION;
      context.modelTexts = [span.quote];
      value.observations[0].evidenceSpans[0] = { quote: span.quote, start: 0, end: 0 };
      const before = JSON.stringify({ context, value });
      const result = normalizeWritingBandResult(value, context);
      expect(result.observations[0].evidenceSpans[0]).toMatchObject({ quote: span.quote, start: 3, end: 14 });
      expect(result.provenance.kind).toBe('ai_assisted');
      expect(result.officialScore).toBe(false);
      expect(result.scoreEstimate).toBeNull();
      expect(result.blockReasons).toContain('model_text_overlap');
      const missing = copy(value);
      missing.observations[0].evidenceSpans[0].quote = 'not present';
      expect(() => normalizeWritingBandResult(missing, context)).toThrow('确实出现在');
      const duplicate = copy(context);
      duplicate.submission.text += '\n' + span.quote;
      duplicate.submission.answerHash = writingAnswerHash(duplicate.submission.text);
      duplicate.request.request.input = duplicate.submission.text;
      const ambiguous = copy(value);
      ambiguous.binding.answerHash = duplicate.submission.answerHash;
      expect(() => normalizeWritingBandResult(ambiguous, duplicate)).toThrow('重复文字');
      const wrongTask = copy(value);
      wrongTask.binding.taskId = 'another task';
      expect(() => normalizeWritingBandResult(wrongTask, context)).toThrow('result binding');
      expect(() =>
        normalizeWritingBandResult(value, { ...context, promptVersion: WRITING_BAND_GUIDED_PROMPT_VERSION })
      ).toThrow();
      expect(JSON.stringify({ context, value })).toBe(before);
      vi.stubGlobal('__YOZI_DEV_TEST__', false);
      expect(() => normalizeWritingBandResult(value, context)).toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('known AI sentences are not student evidence; scaffolds are exempt and system null stays program-confirmed', () => {
    const { context, value, span } = bandFixture();
    context.modelTexts = [span.quote];
    expect(() => normalizeWritingBandResult(value, context)).toThrow();
    value.observations = [];
    value.integrityFlags = [{ kind: 'model_text_overlap', spans: [span] }];
    expect(normalizeWritingBandResult(value, context).blockReasons).toContain('model_text_overlap');
    context.task.patterns = [[span.quote]];
    expect(() => normalizeWritingBandResult(value, context)).toThrow();
    value.integrityFlags = [];
    value.status = 'null';
    value.nullReason = 'model_output_invalid';
    expect(() => normalizeWritingBandResult(value, context)).toThrow();
    expect(normalizeWritingBandResult(value, { ...context, systemNullReason: 'model_output_invalid' })).toMatchObject({
      status: 'null',
      nullReason: 'model_output_invalid',
      observations: []
    });
    expect(() =>
      normalizeWritingBandResult(
        { ...value, nullReason: 'answer_too_short' },
        { ...context, systemNullReason: 'answer_too_short' }
      )
    ).toThrow();
  });
});

describe('independent writing rubric foundation (data contracts, not semantic scoring)', () => {
  it('has immutable, explicitly unreviewed three-part sets with honest source versions', () => {
    expect(WRITING_RUBRICS.map((r) => r.maxScore)).toEqual([10, 15, 60, null, null]);
    for (const r of WRITING_RUBRICS) {
      expect(validateWritingRubric(r)).toBe(true);
      expect(r.notice).toBe(WRITING_SCORE_NOTICE);
      expect(r.status).toBe('draft_unreviewed');
      expect(r.source.officialOriginalVerified).toBe(false);
      expect(r.source.version).toBeTruthy();
      if (r.sourceTier === 'unverified') {
        expect(r.source.location).toBeNull();
        expect(r.source.url).toBeNull();
      } else {
        expect(r.source.location).toBeTruthy();
        expect(r.source.url).toMatch(/^https:\/\//);
      }
      expect(Object.isFrozen(r.dimensions[0])).toBe(true);
      if (r.scoring.mode === 'holistic_band') {
        expect(r.dimensions.every((d) => !Object.hasOwn(d, 'weight'))).toBe(true);
        expect(r.dimensions.every((d) => Number.isInteger(d.focusPriority))).toBe(true);
      } else expect(r.dimensions.reduce((total, d) => total + d.weight, 0)).toBeCloseTo(1);
      for (const point of r.scorePoints) {
        expect(point.explanation).toBeTruthy();
        expect(r.microExercises.some((e) => e.pointId === point.id && e.acceptance.length > 0)).toBe(true);
      }
      expect(r.microExercises.every((e) => e.provenance === 'project_original_synthetic')).toBe(true);
    }
  });

  it('keeps English1 A/B separate with no borrowed numbers or chart exercise', () => {
    const english1 = WRITING_RUBRICS.slice(3);
    expect(english1.map((r) => r.id)).toEqual(['kaoyan-english1-a-foundation-v1', 'kaoyan-english1-b-foundation-v1']);
    for (const rubric of english1) {
      expect(rubric.maxScore).toBeNull();
      expect(rubric.scoring.scoreBands).toBeNull();
      expect(rubric.scoring.display).toBe('observation_only');
      expect(validateWritingRubric(rubric)).toBe(true);
      expect(writingScoreBand(rubric, null)).toBeNull();
      expect(() => writingScoreBand(rubric, 0)).toThrow(/no numeric bands/);
      for (const mutate of [
        (r) => {
          r.maxScore = 15;
        },
        (r) => {
          r.scoring.scoreBands = copy(large.scoring.scoreBands);
        },
        (r) => {
          r.scoring.display = 'score';
        }
      ]) {
        const invalid = copy(rubric);
        mutate(invalid);
        expect(() => validateWritingRubric(invalid)).toThrow(/WRITING_RUBRIC_INVALID/);
      }
    }
    expect(english1[1].microExercises[0].prompt).toContain('原创画面要点');
    expect(english1[1].microExercises.every((e) => !e.prompt.includes('合成图表'))).toBe(true);
  });

  it.each([
    [small, [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]],
    [large, [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]]
  ])('covers every integer English score without gaps', (r, expected) => {
    expect(expected.map((_, score) => writingScoreBand(r, score))).toEqual(expected);
    expect(r.scoring.mode).toBe('holistic_band');
    expect(r.dimensions.map((d) => d.id)).toEqual(['content', 'language', 'cohesion', 'register', 'reader']);
    expect(r.dimensions.every((d) => d.priorityAuthority === 'project_provisional')).toBe(true);
    expect(writingScoreBand(r, null)).toBeNull();
    for (const bad of [-1, r.maxScore + 1, 0.5, NaN, undefined, '5']) expect(() => writingScoreBand(r, bad)).toThrow();
  });

  it('keeps Chinese 40+20 and four holistic development facets, with explicit component boundaries', () => {
    expect(chinese.scoring.baseMaxScore).toBe(40);
    expect(chinese.scoring.developmentMaxScore).toBe(20);
    expect(chinese.dimensions.map((d) => d.maxScore)).toEqual([20, 20, 20]);
    const development = chinese.dimensions.find((d) => d.id === 'development');
    expect(development.facets.map((d) => d.name)).toEqual(['深刻', '丰富', '有文采', '有创意']);
    expect(development.facets.every((d) => d.weight === null && d.maxScore === null)).toBe(true);
    expect(chinese.applicability).toEqual({ region: null, examYear: null, currentOfficialRulesVerified: false });
    for (const d of chinese.dimensions) {
      for (let score = 0; score <= 20; score++)
        expect(writingScoreBand(chinese, score, d.id)).toBe(score <= 5 ? 4 : score <= 10 ? 3 : score <= 15 ? 2 : 1);
      expect(writingScoreBand(chinese, null, d.id)).toBeNull();
      expect(() => writingScoreBand(chinese, 21, d.id)).toThrow();
    }
    expect(() => writingScoreBand(chinese, 60)).toThrow(/component required/);
  });

  it('keeps English numbers hidden and only permits task or system null reasons', () => {
    expect(small.dimensions.map((d) => d.focusPriority)).toEqual([1, 2, 3, 3, 4]);
    expect(large.dimensions.map((d) => d.focusPriority)).toEqual([1, 2, 3, 4, 4]);
    expect(WRITING_BAND_NULL_REASONS).toEqual([
      'task_data_missing',
      'task_data_conflict',
      'model_output_invalid',
      'evidence_invalid'
    ]);
    for (const rubric of [small, large]) {
      expect(rubric.sourceTier).toBe('secondary_unverified');
      expect(rubric.scoring.display).toBe('observation_only');
      expect(rubric.evidence).not.toHaveProperty('handwriting');
      for (const mutate of [
        (r) => {
          r.scoring.display = 'score';
        },
        (r) => {
          r.evidence.nullReasons.push('answer_too_short');
        },
        (r) => {
          r.dimensions[0].focusPriority = 0.5;
        }
      ]) {
        const invalid = copy(rubric);
        mutate(invalid);
        expect(() => validateWritingRubric(invalid)).toThrow(/WRITING_RUBRIC_INVALID/);
      }
    }
    expect(chinese.dimensions.every((d) => d.weight > 0)).toBe(true);
  });

  it('does not use student-side uncertainty as English null policy or change Chinese policy', () => {
    for (const rubric of WRITING_RUBRICS.filter((r) => r.scoring.mode === 'holistic_band')) {
      expect(rubric.antiLength.rules.find((r) => r.id === 'unknown-null').text).toContain('原答短、差、离题');
      const invalid = copy(rubric);
      invalid.antiLength.rules = copy(WRITING_ANTI_LENGTH_POLICY.rules);
      expect(() => validateWritingRubric(invalid)).toThrow(/anti-length rules/);
    }
    expect(chinese.antiLength).toBe(WRITING_ANTI_LENGTH_POLICY);
  });

  it('requires evidence, no length bonus, no offsetting facts/tasks and unknown=null as policy only', () => {
    expect(WRITING_ANTI_LENGTH_POLICY.status).toBe('policy_only_semantic_resistance_unverified');
    expect(WRITING_ANTI_LENGTH_POLICY.lengthBonus).toBe(0);
    expect(WRITING_ANTI_LENGTH_POLICY.unknownScore).toBeNull();
    expect(WRITING_ANTI_LENGTH_POLICY.requiredPairChecks).toHaveLength(6);
    for (const r of WRITING_RUBRICS) {
      expect(r.evidence.binding).toEqual([
        'taskId',
        'taskVersion',
        'attemptId',
        'answerHash',
        'rubricId',
        'rubricVersion'
      ]);
      expect(r.evidence.totalWhenAnyComponentUnknown).toBeNull();
      expect(r.antiLength.rules.map((rule) => rule.id)).toEqual([
        'no-new-content',
        'facts-not-offset',
        'task-not-offset',
        'evidence-first',
        'unknown-null',
        'task-length-only'
      ]);
      for (const rule of r.antiLength.rules) {
        const bad = copy(r);
        bad.antiLength.rules = bad.antiLength.rules.filter((candidate) => candidate.id !== rule.id);
        expect(() => validateWritingRubric(bad)).toThrow(/anti-length rules/);
      }
    }
  });

  it('rejects malformed totals, weights, bands, empty evidence and uncovered score points', () => {
    for (const mutate of [
      (r) => {
        r.dimensions[0].weight = 0;
      },
      (r) => {
        r.dimensions[0].weight += 0.1;
      },
      (r) => {
        r.dimensions[0].evidence = '';
      },
      (r) => {
        r.dimensions[0].id = r.dimensions[1].id;
      },
      (r) => {
        r.scoring.scoreBands[1].min = 2;
      },
      (r) => {
        r.scoring.scoreBands.at(-1).max += 1;
      },
      (r) => {
        r.microExercises.pop();
      },
      (r) => {
        r.scorePoints[0].dimensionId = 'unknown';
      },
      (r) => {
        r.antiLength.lengthBonus = 1;
      },
      (r) => {
        r.evidence.totalWhenAnyComponentUnknown = 0;
      },
      (r) => {
        r.source.officialOriginalVerified = true;
      },
      (r) => {
        r.compatibility.automaticConversion = true;
      },
      (r) => {
        r.antiLength.status = 'verified';
      },
      (r) => {
        r.antiLength.requiredPairChecks.pop();
      },
      (r) => {
        r.evidence.binding.pop();
      },
      (r) => {
        r.dimensions[0].weightAuthority = 'official';
      }
    ]) {
      const bad = copy(small);
      mutate(bad);
      expect(() => validateWritingRubric(bad)).toThrow(/WRITING_RUBRIC_INVALID/);
    }
    const bad = copy(chinese);
    bad.dimensions[0].maxScore = 19;
    expect(() => validateWritingRubric(bad)).toThrow(/component total/);
    const incomplete = copy(chinese);
    const lastPoint = incomplete.scorePoints.pop();
    incomplete.microExercises = incomplete.microExercises.filter((e) => e.pointId !== lastPoint.id);
    expect(() => validateWritingRubric(incomplete)).toThrow(/facet without point/);
  });

  it('leaves the legacy 0–30 contract and four auxiliary coach observations intact', () => {
    expect(() =>
      normalizeRubric({
        id: 'illegal-60',
        version: 1,
        source: { kind: 'project_original' },
        criteria: Array.from({ length: 6 }, (_, i) => ({
          id: String(i),
          name: 'test',
          description: 'test',
          maxScore: 10
        }))
      })
    ).toThrow(/最多30分/);
    expect(WRITING_METHOD.feedback).toEqual(['语法', '搭配', '表达', '任务完成']);
    for (const r of WRITING_RUBRICS)
      expect(r.compatibility).toMatchObject({
        adapter: null,
        automaticConversion: false,
        coachDimensions: { role: 'auxiliary_only', scoreConversion: null }
      });
  });
});
