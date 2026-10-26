import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { knowledgeGraphSeed } from '../../src/services/learning/knowledge-graph-seed.js';
import { mathGraphFixture } from '../../tests/fixtures/knowledge-graph-math.js';
import { validateGraph } from '../../src/services/learning/knowledge-graph.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const MANIFEST_PATH = 'tests/fixtures/evaluation/engineering-v1.manifest.json';
export const FIXTURES = [
  ['quality-v1', 14],
  ['rubric-v1', 6],
  ['rubric-evidence-v2', 39],
  ['algebra-v1', 32],
  ['inequality-v1', 36],
  ['prerequisite-v2', 26],
  ['condition-v1', 30],
  ['condition-diagnosis-v1', 38],
  ['quadratic-inequality-v1', 40],
  ['quadratic-diagnosis-v1', 40],
  ['material-diagnosis-v1', 7]
];
export const TEST_FILES = [
  'tests/unit/writing-rubrics-foundation.spec.js',
  'tests/unit/engineering-eval-v1.spec.js',
  'tests/unit/knowledge-graph.spec.js',
  'tests/unit/learning-material-diagnosis.spec.js',
  'tests/unit/learning-rubric-evidence.spec.js',
  'tests/unit/feedback-material-fixture.spec.js',
  'tests/unit/writing-coach.spec.js',
  'tests/unit/writing-coach-violation-path.spec.js',
  'tests/unit/learning-argument-writing.spec.js',
  'tests/unit/learning-rubric.spec.js'
];

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
// Object key order is irrelevant; array order and string code units are significant.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
function requireValue(ok, message) {
  if (!ok) throw new Error(`ENGINEERING_MANIFEST_INVALID: ${message}`);
}
function read(root, relative) {
  const target = path.resolve(root, relative);
  requireValue(target.startsWith(path.resolve(root) + path.sep), `path outside repository: ${relative}`);
  requireValue(
    fs.realpathSync(target) === target && fs.statSync(target).isFile(),
    `not a regular in-repo file: ${relative}`
  );
  return fs.readFileSync(target);
}

function expectedFor(suite, collection, item) {
  if (suite === 'quality-v1') return { status: item.expectedStatus, outcome: item.expectedOutcome };
  if (suite.startsWith('rubric-'))
    return item.expectedError
      ? { status: 'rejected', errorCode: item.expectedError }
      : {
          status: 'ai_assisted',
          score: item.expectedScore,
          ...(Object.hasOwn(item, 'expectedSavedAnswer') ? { savedAnswer: item.expectedSavedAnswer } : {}),
          ...(item.expectedLocation ? { location: item.expectedLocation } : {})
        };
  if (suite === 'material-diagnosis-v1')
    return {
      original: { status: 'reliable', wrongOutcome: 'wrong', correctAnswer: item.correct },
      probe: { wrong: item.probeWrong, correct: item.probeCorrect, finalStatus: 'independent_correct' },
      transfer: { field: item.variantField, answer: item.variantAnswer, outcome: 'correct' }
    };
  const keys = [
    'status',
    'outcome',
    'relation',
    'counterexamples',
    'reference',
    'topic',
    'direction',
    'prompt',
    'diagnosticAnswer',
    'smallAnswer'
  ];
  const result = Object.fromEntries(keys.filter((key) => Object.hasOwn(item, key)).map((key) => [key, item[key]]));
  requireValue(Object.keys(result).length > 0, `${suite}/${collection}/${item.id} missing expectation`);
  return result;
}
function legacyId(suite, version, collection, id) {
  if (suite === 'material-diagnosis-v1') return null;
  if (suite === 'quality-v1' || suite === 'rubric-v1') return id;
  return `${version}:${suite === 'condition-diagnosis-v1' ? `${collection === 'probes' ? 'probe' : 'diagnosis'}:` : ''}${id}`;
}

export function graphSources() {
  return [
    {
      id: 'english',
      source: 'src/services/learning/knowledge-graph-seed.js',
      graph: knowledgeGraphSeed,
      expectedCount: 52
    },
    { id: 'math', source: 'tests/fixtures/knowledge-graph-math.js', graph: mathGraphFixture(), expectedCount: 18 }
  ];
}

// Follow only reachable local imports. Never scan the repository or inspect private env/data.
function sourceVersions(root, entries) {
  const pending = [...entries];
  const seen = new Set();
  while (pending.length) {
    const relative = pending.pop();
    if (seen.has(relative)) continue;
    const text = read(root, relative).toString('utf8');
    seen.add(relative);
    if (!/\.(?:[cm]?js|ts|vue)$/.test(relative)) continue;
    for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      let local = specifier.startsWith('.')
        ? path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
        : specifier.startsWith('@/')
          ? `src/${specifier.slice(2)}`
          : null;
      if (!local) continue; // Third-party versions are pinned by package-lock.json.
      if (!fs.existsSync(path.join(root, local)) || !fs.statSync(path.join(root, local)).isFile())
        local = ['.js', '.ts', '.mjs', '.vue', '/index.js']
          .map((suffix) => local + suffix)
          .find(
            (candidate) => fs.existsSync(path.join(root, candidate)) && fs.statSync(path.join(root, candidate)).isFile()
          );
      requireValue(local, `unresolved local import: ${relative} -> ${specifier}`);
      pending.push(local);
    }
  }
  return [...seen].sort().map((file) => ({ path: file, sha256: sha256(read(root, file)) }));
}

// Explicit authoring operation; validation never rewrites the frozen manifest.
export function buildEngineeringManifest(root = ROOT) {
  const sources = [],
    cases = [];
  for (const [suite, expectedCount] of FIXTURES) {
    const source = `tests/fixtures/learning/${suite}.json`;
    const bytes = read(root, source),
      data = JSON.parse(bytes);
    const collections = suite === 'condition-diagnosis-v1' ? ['probes', 'diagnoses'] : ['cases'];
    requireValue(typeof data.version === 'string' && typeof data.provenance === 'string', `${source} metadata`);
    requireValue(
      Object.keys(data)
        .filter((key) => Array.isArray(data[key]))
        .every((key) => collections.includes(key)),
      `${source} unexpected collection`
    );
    const groups = {};
    for (const collection of collections) {
      requireValue(Array.isArray(data[collection]), `${source} ${collection}`);
      const group = `${suite}/${collection}`;
      groups[group] = data[collection].length;
      for (const [index, item] of data[collection].entries()) {
        requireValue(typeof item.id === 'string' && item.id.length > 0, `${group} case id`);
        cases.push({
          id: `${group}/${item.id}`,
          caseId: item.id,
          source,
          selector: { collection, index },
          version: data.version,
          provenance: data.provenance,
          group,
          leakageGroup: suite, // Conservatively keep the entire authored suite together.
          kind: 'synthetic_engineering_regression',
          real_effect: 'unavailable',
          sha256: sha256(canonical(item)),
          expected: expectedFor(suite, collection, item),
          legacyRunnerId: legacyId(suite, data.version, collection, item.id),
          verification: suite === 'material-diagnosis-v1' ? 'material_flow_unit_tests' : 'deterministic_legacy_runner'
        });
      }
    }
    requireValue(Object.values(groups).reduce((a, b) => a + b, 0) === expectedCount, `${source} count drift`);
    sources.push({
      path: source,
      version: data.version,
      provenance: data.provenance,
      sha256: sha256(bytes),
      count: expectedCount,
      groups
    });
  }
  const graphs = [],
    graphQuestions = [];
  for (const { id, source, graph, expectedCount } of graphSources()) {
    validateGraph(graph);
    let count = 0;
    for (const topic of graph.topics)
      for (const phase of ['main', 'lowered']) {
        const diagnostic = phase === 'main' ? { ...topic.diagnostic } : topic.diagnostic.lowered;
        if (phase === 'main') delete diagnostic.lowered;
        requireValue(diagnostic, `${id}/${topic.id}/${phase}`);
        const group = `graph-${id}/${phase}`;
        graphQuestions.push({
          id: `${group}/${topic.id}`,
          caseId: `${topic.id}:${phase}`,
          source,
          selector: { topicId: topic.id, phase },
          version: graph.version,
          provenance: 'project_original_synthetic_unreviewed',
          group,
          leakageGroup: `graph-${id}/${topic.id}`,
          kind: 'synthetic_engineering_regression',
          real_effect: 'unavailable',
          sha256: sha256(canonical(diagnostic)),
          expected:
            diagnostic.kind === 'choice'
              ? { kind: 'choice', answerIndex: diagnostic.answerIndex }
              : { kind: 'rubric', rubric: diagnostic.rubric, semanticScoring: 'unavailable' },
          verification: 'frozen_content_and_graph_engine_unit_tests_not_student_diagnosis'
        });
        count++;
      }
    requireValue(count === expectedCount, `${id} graph question count drift`);
    graphs.push({
      id,
      source,
      version: graph.version,
      provenance: 'project_original_synthetic_unreviewed',
      sha256: sha256(read(root, source)),
      graphSha256: sha256(canonical(graph)),
      nodes: graph.topics.length,
      edges: graph.edges.length,
      questions: count
    });
  }
  const all = [...cases, ...graphQuestions];
  requireValue(new Set(all.map((r) => r.id)).size === all.length, 'duplicate namespaced case id');
  const runnerIds = cases.map((c) => c.legacyRunnerId).filter(Boolean);
  requireValue(runnerIds.length === 301 && new Set(runnerIds).size === runnerIds.length, 'legacy coverage');
  return {
    contract: 'engineering-eval-manifest-v1',
    id: 'yozi-engineering-regression-v1',
    version: 1,
    frozenFor: '2026-10-22',
    kind: 'synthetic_engineering_regression',
    notice: '合成工程回归，不是真实效果集',
    real_effect: 'unavailable',
    realEffectSamples: { independentlyScoredEssays: 0, expertRootCauseTrajectories: 0 },
    claims: [
      '数量是固定工程条目和图题数量，不是独立学生样本；不合并成真实效果分母。',
      '可靠/AI辅助/待核对按每条原始期望保留；结构和引用校验不证明语义、诊断或教学效果。',
      '当前工作树引用以内容哈希冻结，须与这些文件一同版本保存；仅有HEAD或manifest不能恢复缺失源码。',
      '同组不得拆为校准/验收样本；图主测和降阶属于同一能力点；此集没有真实效果切分。'
    ],
    hashPolicy: {
      files: 'SHA-256 of raw bytes',
      records: 'SHA-256 of canonical JSON (sorted object keys, array order retained)'
    },
    counts: { jsonFiles: 11, jsonCases: 308, englishGraphQuestions: 52, mathGraphQuestions: 18 },
    sources,
    graphs,
    cases,
    graphQuestions,
    sourceVersions: sourceVersions(root, [
      'scripts/eval/engineering-v1-manifest.mjs',
      'scripts/eval/run-engineering-v1.mjs',
      'scripts/build/evaluate-learning.mjs',
      'laf-backend/functions/_shared/writing-rubrics.js',
      'src/services/learning/knowledge-graph-seed.js',
      'tests/fixtures/knowledge-graph-math.js',
      'vitest.config.js',
      'tests/setup.js',
      'package.json',
      'package-lock.json',
      ...TEST_FILES
    ])
  };
}

export function validateEngineeringManifest(manifest = JSON.parse(read(ROOT, MANIFEST_PATH)), root = ROOT) {
  const current = buildEngineeringManifest(root);
  requireValue(
    isDeepStrictEqual(manifest, current),
    'frozen data/expectations/groups or source versions drifted; review and create a new version, do not silently rebaseline v1'
  );
  return { counts: current.counts, pinnedFiles: current.sourceVersions.length, real_effect: current.real_effect };
}
