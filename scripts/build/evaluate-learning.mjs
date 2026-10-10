import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { gradeAnswer } from '../../laf-backend/functions/_shared/learning-domain.js';
import { assessWithRubric } from '../../laf-backend/functions/_shared/learning-rubric.js';
import { createAlgebraQuestion, algebraReferenceText } from '../../laf-backend/functions/_shared/learning-algebra.js';
import { createArithmeticQuestion } from '../../src/services/learning/learning-tools.js';
import { createPrerequisiteQuestion } from '../../laf-backend/functions/_shared/learning-prerequisite.js';
import { createConditionQuestion } from '../../laf-backend/functions/_shared/learning-condition.js';
import { createConditionProbe } from '../../laf-backend/functions/_shared/learning-condition-probe.js';
const fixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/quality-v1.json', import.meta.url), 'utf8')
);
const results = fixture.cases.map((item) => {
  const start = performance.now();
  const grade = gradeAnswer(item, item.answer);
  return {
    id: item.id,
    category: item.category,
    evidenceId: item.validation.evidenceId,
    expected: { status: item.expectedStatus, outcome: item.expectedOutcome },
    actual: grade,
    passed: grade.status === item.expectedStatus && grade.outcome === item.expectedOutcome,
    durationMs: performance.now() - start
  };
});
const rubricFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/rubric-v1.json', import.meta.url), 'utf8')
);
for (const item of rubricFixture.cases) {
  const start = performance.now();
  let actual;
  try {
    const assessment = assessWithRubric(
      { ...rubricFixture.question, uncertainties: item.uncertainties || [] },
      { answer: item.answer },
      item.assessment
    );
    actual = { status: 'ai_assisted', score: assessment.score, maxScore: assessment.maxScore };
  } catch (error) {
    actual = { status: 'rejected', errorCode: error.code };
  }
  results.push({
    id: item.id,
    category: '主观评分合同与原答引用',
    evidenceId: rubricFixture.question.rubric.id,
    expected: item.expectedError ? { errorCode: item.expectedError } : { score: item.expectedScore },
    actual,
    passed: item.expectedError
      ? actual.errorCode === item.expectedError
      : actual.status === 'ai_assisted' && actual.score === item.expectedScore,
    durationMs: performance.now() - start
  });
}
const algebraFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/algebra-v1.json', import.meta.url), 'utf8')
);
const rubricEvidenceFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/rubric-evidence-v2.json', import.meta.url), 'utf8')
);
for (const item of rubricEvidenceFixture.cases) {
  const start = performance.now();
  let actual;
  try {
    const assessment = assessWithRubric(
      { ...rubricEvidenceFixture.question, uncertainties: item.uncertainties || [] },
      { id: 'fixture-answer', answer: item.answer },
      item.assessment
    );
    actual = {
      status: 'ai_assisted',
      score: assessment.score,
      maxScore: assessment.maxScore,
      location: assessment.dimensions[0].evidenceLocations[0] || null
    };
  } catch (error) {
    actual = { status: 'rejected', errorCode: error.code };
  }
  const matchesLocation =
    !item.expectedLocation ||
    Object.entries(item.expectedLocation).every(([key, value]) => actual.location?.[key] === value);
  results.push({
    id: `${rubricEvidenceFixture.version}:${item.id}`,
    category: '主观原答定位、疑义与攻击合同',
    learningStage: item.stage || null,
    evidenceId: rubricEvidenceFixture.question.rubric.id,
    expected: item.expectedError
      ? { errorCode: item.expectedError }
      : { score: item.expectedScore, location: item.expectedLocation || null },
    actual,
    passed: item.expectedError
      ? actual.errorCode === item.expectedError
      : actual.status === 'ai_assisted' && actual.score === item.expectedScore && matchesLocation,
    durationMs: performance.now() - start
  });
}
const inequalityFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/inequality-v1.json', import.meta.url), 'utf8')
);
for (const suite of [algebraFixture, inequalityFixture])
  for (const item of suite.cases) {
    const start = performance.now();
    const q = createAlgebraQuestion(item.id, item.goal);
    if (item.uncertainties) q.uncertainties = item.uncertainties;
    const actual = gradeAnswer(q, item.answer);
    results.push({
      id: `${suite.version}:${item.id}`,
      category: suite === algebraFixture ? '精确代数、解集与定义域' : '一次不等式、方向与区间边界',
      evidenceId: q.validation?.evidenceId || 'safe-algebra-v1:unavailable',
      expected: { status: item.status, outcome: item.outcome },
      actual,
      passed: actual.status === item.status && actual.outcome === item.outcome,
      durationMs: performance.now() - start
    });
  }
const prerequisiteFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/prerequisite-v2.json', import.meta.url), 'utf8')
);
for (const item of prerequisiteFixture.cases) {
  const start = performance.now();
  const question = createArithmeticQuestion(item.id, item.goal) || createAlgebraQuestion(item.id, item.goal);
  const grade = gradeAnswer(question, item.answer);
  const diagnostic = createPrerequisiteQuestion(
    `${item.id}:diagnostic`,
    question,
    [
      {
        id: `${item.id}:answer`,
        questionKey: `${question.id}@${question.version}`,
        conversationId: 'quality',
        answer: item.answer,
        grade
      }
    ],
    'quality'
  );
  const diagnosticGrade = diagnostic && gradeAnswer(diagnostic, item.diagnosticAnswer);
  const actual = {
    ...grade,
    topic: diagnostic?.prerequisite.topic || null,
    prompt: diagnostic?.prompt || null,
    diagnosticGrade
  };
  results.push({
    id: `${prerequisiteFixture.version}:${item.id}`,
    category: '原答差异、候选先修与独立小题判分',
    evidenceId: question.validation?.evidenceId || 'unavailable',
    expected: { status: item.status, outcome: item.outcome, topic: item.topic, prompt: item.prompt || null },
    actual,
    passed:
      grade.status === item.status &&
      grade.outcome === item.outcome &&
      actual.topic === item.topic &&
      (item.topic
        ? actual.prompt === item.prompt &&
          diagnosticGrade?.status === 'reliable' &&
          diagnosticGrade.outcome === 'correct'
        : diagnostic === null),
    durationMs: performance.now() - start
  });
}
const conditionFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/condition-v1.json', import.meta.url), 'utf8')
);
for (const item of conditionFixture.cases) {
  const start = performance.now();
  const question = createConditionQuestion(item.id, item.goal);
  if (item.uncertainties) question.uncertainties = item.uncertainties;
  const actual = gradeAnswer(question, item.answer);
  results.push({
    id: `${conditionFixture.version}:${item.id}`,
    category: '条件充分性、双向蕴含与共同定义域',
    evidenceId: question.validation?.evidenceId || 'safe-condition-relation-v1:unavailable',
    expected: { status: item.status, outcome: item.outcome, relation: item.relation || null },
    actual: { ...actual, relation: question.validation?.relation || null },
    passed:
      actual.status === item.status &&
      actual.outcome === item.outcome &&
      (!item.relation || question.validation?.relation === item.relation),
    durationMs: performance.now() - start
  });
}
const conditionDiagnosisFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/condition-diagnosis-v1.json', import.meta.url), 'utf8')
);
for (const item of conditionDiagnosisFixture.probes) {
  const start = performance.now();
  const question = createConditionProbe(item.id, item.p, item.q, item.domain || 'real', item.excluded || '');
  const actual = gradeAnswer(question, item.answer);
  results.push({
    id: `${conditionDiagnosisFixture.version}:probe:${item.id}`,
    category: '蕴含方向、精确反例与共同数域',
    evidenceId: question.validation?.evidenceId || 'unavailable',
    expected: { status: item.status, outcome: item.outcome },
    actual,
    passed: actual.status === item.status && actual.outcome === item.outcome,
    durationMs: performance.now() - start
  });
}
for (const item of conditionDiagnosisFixture.diagnoses) {
  const start = performance.now(),
    question = createConditionQuestion(item.id, item.goal),
    grade = gradeAnswer(question, item.answer);
  const diagnostic = createPrerequisiteQuestion(
    item.id + ':diagnostic',
    question,
    [
      {
        id: item.id + ':answer',
        questionKey: `${question.id}@1`,
        conversationId: 'quality',
        answer: item.answer,
        grade
      }
    ],
    'quality'
  );
  const diagnosticGrade = diagnostic && gradeAnswer(diagnostic, item.smallAnswer);
  const actual = {
    ...grade,
    topic: diagnostic?.prerequisite.topic || null,
    direction: diagnostic?.prerequisite.direction || null,
    diagnosticGrade
  };
  results.push({
    id: `${conditionDiagnosisFixture.version}:diagnosis:${item.id}`,
    category: '条件原答差异与候选方向小题',
    evidenceId: question.validation?.evidenceId || 'unavailable',
    expected: { topic: item.topic, direction: item.direction || null },
    actual,
    passed:
      actual.topic === item.topic &&
      (item.topic
        ? actual.direction === item.direction &&
          diagnosticGrade?.status === 'reliable' &&
          diagnosticGrade.outcome === 'correct'
        : diagnostic === null),
    durationMs: performance.now() - start
  });
}
const quadraticFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/quadratic-inequality-v1.json', import.meta.url), 'utf8')
);
for (const item of quadraticFixture.cases) {
  const start = performance.now();
  const question = createAlgebraQuestion(item.id, item.goal);
  if (item.uncertainties) question.uncertainties = item.uncertainties;
  const actual = { ...gradeAnswer(question, item.answer), reference: algebraReferenceText(question) };
  results.push({
    id: `${quadraticFixture.version}:${item.id}`,
    category: '二次完整区间、重根与安全降级',
    evidenceId: question.validation?.evidenceId || 'unavailable',
    expected: { status: item.status, outcome: item.outcome, reference: item.reference || null },
    actual,
    passed:
      actual.status === item.status &&
      actual.outcome === item.outcome &&
      (!item.reference || actual.reference === item.reference),
    durationMs: performance.now() - start
  });
}
const quadraticDiagnosisFixture = JSON.parse(
  fs.readFileSync(new URL('../../tests/fixtures/learning/quadratic-diagnosis-v1.json', import.meta.url), 'utf8')
);
for (const item of quadraticDiagnosisFixture.cases) {
  const start = performance.now(),
    question = createAlgebraQuestion(item.id, item.goal);
  if (item.uncertainties) question.uncertainties = item.uncertainties;
  const grade = gradeAnswer(question, item.answer);
  const diagnostic = createPrerequisiteQuestion(
    `${item.id}:diagnostic`,
    question,
    [
      {
        id: `${item.id}:answer`,
        questionKey: `${question.id}@1`,
        conversationId: 'quality',
        answer: item.answer,
        grade
      }
    ],
    'quality',
    quadraticDiagnosisFixture.version
  );
  const diagnosticGrade = diagnostic && gradeAnswer(diagnostic, item.diagnosticAnswer);
  const actual = {
    ...grade,
    topic: diagnostic?.prerequisite.topic || null,
    prompt: diagnostic?.prompt || null,
    diagnosticGrade
  };
  results.push({
    id: `${quadraticDiagnosisFixture.version}:${item.id}`,
    category: '二次原答差异、候选先修与完整原题边界',
    evidenceId: question.validation?.evidenceId || 'unavailable',
    expected: { status: item.status, outcome: item.outcome, topic: item.topic, prompt: item.prompt || null },
    actual,
    passed:
      grade.status === item.status &&
      grade.outcome === item.outcome &&
      actual.topic === item.topic &&
      (item.topic
        ? actual.prompt === item.prompt &&
          diagnosticGrade?.status === 'reliable' &&
          diagnosticGrade.outcome === 'correct'
        : diagnostic === null),
    durationMs: performance.now() - start
  });
}
const report = {
  version: fixture.version,
  at: new Date().toISOString(),
  environment: 'isolated-deterministic',
  provenance: fixture.provenance,
  rubricProvenance: rubricFixture.provenance,
  rubricEvidenceProvenance: rubricEvidenceFixture.provenance,
  rubricEvidenceClaims:
    'v2引用范围/重复原文/UTF-16与字符显示/疑义/攻击的确定性合同；原文真实不证明语义评分正确，模型准确率和因果仍待验。',
  algebraProvenance: algebraFixture.provenance,
  inequalityProvenance: inequalityFixture.provenance,
  quadraticProvenance: quadraticFixture.provenance,
  quadraticClaims: quadraticFixture.claims,
  quadraticDiagnosisProvenance: quadraticDiagnosisFixture.provenance,
  quadraticDiagnosisClaims: quadraticDiagnosisFixture.claims,
  prerequisiteProvenance: prerequisiteFixture.provenance,
  prerequisiteClaims: prerequisiteFixture.claims,
  conditionProvenance: conditionFixture.provenance,
  conditionClaims: conditionFixture.claims,
  conditionDiagnosisProvenance: conditionDiagnosisFixture.provenance,
  conditionDiagnosisClaims: conditionDiagnosisFixture.claims,
  rubricSemanticAccuracy: null,
  claims: fixture.claims,
  total: results.length,
  passed: results.filter((r) => r.passed).length,
  contractSuccessRate: results.filter((r) => r.passed).length / results.length,
  reliable: results.filter((r) => r.actual.status === 'reliable').length,
  manualReviewRequired: results.filter((r) => r.actual.status !== 'reliable').length,
  threshold: { expected: 1, reason: '确定性算例或必须安全降级的输入，任何误判均阻塞此有限能力。' },
  realModelCalls: 0,
  supplierCost: { value: null, status: 'not_called', reason: '本报告未调用外部模型；不能据此估计真实任务成本。' },
  structuredModelSuccessRate: null,
  citationAccuracy: null,
  realTaskCompletionRate: null,
  teachingCohorts: {
    strongFoundation: 'covered_by_strategy_tests_only',
    blockedAbstractConcept: 'covered_by_strategy_tests_only',
    longTermLearning: 'unverified'
  },
  results
};
fs.mkdirSync('tmp/adaptive-learning', { recursive: true });
fs.writeFileSync('tmp/adaptive-learning/quality-report.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    total: report.total,
    passed: report.passed,
    manualReviewRequired: report.manualReviewRequired,
    externalCalls: 0
  })
);
if (report.contractSuccessRate < report.threshold.expected) process.exitCode = 1;
