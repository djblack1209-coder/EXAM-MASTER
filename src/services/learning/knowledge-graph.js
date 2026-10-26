// Experimental, in-memory only. Edges point from prerequisite to dependent.
const TYPES = new Set(['conceptual', 'procedural', 'reasoning', 'application', 'modeling']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const strings = (value) => Array.isArray(value) && value.length > 0 && Array.from(value).every(nonempty);

function invalid(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function diagnosticValid(diagnostic, allowLowered = true) {
  if (!diagnostic || !nonempty(diagnostic.prompt)) return false;
  if (diagnostic.kind === 'choice') {
    if (
      !strings(diagnostic.options) ||
      diagnostic.options.length < 2 ||
      new Set(diagnostic.options).size !== diagnostic.options.length ||
      !Number.isInteger(diagnostic.answerIndex) ||
      diagnostic.answerIndex < 0 ||
      diagnostic.answerIndex >= diagnostic.options.length ||
      diagnostic.rubric !== undefined
    )
      return false;
  } else if (diagnostic.kind === 'rubric') {
    if (
      !Array.isArray(diagnostic.rubric) ||
      diagnostic.rubric.length !== 3 ||
      diagnostic.options !== undefined ||
      diagnostic.answerIndex !== undefined ||
      ![0, 1, 2].every((level) => diagnostic.rubric.some((row) => row?.level === level)) ||
      !diagnostic.rubric.every((row) => nonempty(row.label) && strings(row.criteria))
    )
      return false;
  } else return false;
  if (diagnostic.lowered !== undefined) {
    return allowLowered && diagnostic.lowered?.kind === diagnostic.kind && diagnosticValid(diagnostic.lowered, false);
  }
  return true;
}

function indexGraph(graph) {
  const topics = new Map(graph.topics.map((topic) => [topic.id, topic]));
  const hard = new Map(graph.topics.map((topic) => [topic.id, []]));
  const children = new Map(graph.topics.map((topic) => [topic.id, []]));
  for (const edge of graph.edges) {
    if (edge.strength === 'hard') {
      hard.get(edge.to).push(edge.from);
      children.get(edge.from).push(edge.to);
    }
  }
  // Stable Kahn order; soft links are hints and impose no ordering constraints.
  const degrees = new Map([...hard].map(([id, parents]) => [id, parents.length]));
  const queue = [...degrees].filter(([, degree]) => degree === 0).map(([id]) => id);
  const order = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    order.push(id);
    for (const child of children.get(id)) {
      degrees.set(child, degrees.get(child) - 1);
      if (degrees.get(child) === 0) queue.push(child);
    }
  }
  return { topics, hard, order };
}

/** Throws an Error with code GRAPH_INVALID. Hard prerequisites must form a DAG. */
export function validateGraph(graph) {
  if (
    !graph ||
    !nonempty(graph.version) ||
    !nonempty(graph.subject) ||
    !Array.isArray(graph.topics) ||
    graph.topics.length === 0 ||
    !Array.isArray(graph.edges)
  )
    invalid('GRAPH_INVALID', 'graph metadata/topics/edges');
  const ids = new Set();
  for (const topic of graph.topics) {
    if (
      !topic ||
      !nonempty(topic.id) ||
      ids.has(topic.id) ||
      !nonempty(topic.subject) ||
      !nonempty(topic.name) ||
      !TYPES.has(topic.type) ||
      !strings(topic.masteryCriteria) ||
      (topic.chapter !== undefined && !nonempty(topic.chapter)) ||
      !diagnosticValid(topic.diagnostic)
    )
      invalid('GRAPH_INVALID', 'topic or diagnostic');
    ids.add(topic.id);
  }
  const pairs = new Map();
  for (const edge of graph.edges) {
    if (
      !edge ||
      !ids.has(edge.from) ||
      !ids.has(edge.to) ||
      edge.from === edge.to ||
      !['hard', 'soft'].includes(edge.strength) ||
      (edge.reason !== undefined && !nonempty(edge.reason)) ||
      pairs.get(edge.from)?.has(edge.to)
    )
      invalid('GRAPH_INVALID', 'edge reference/strength/duplicate/self-loop');
    if (!pairs.has(edge.from)) pairs.set(edge.from, new Set());
    pairs.get(edge.from).add(edge.to);
  }
  if (indexGraph(graph).order.length !== graph.topics.length) invalid('GRAPH_INVALID', 'hard prerequisite cycle');
  return true;
}

function ancestors(id, hard) {
  const seen = new Set();
  const stack = [...hard.get(id)];
  while (stack.length) {
    const parent = stack.pop();
    if (seen.has(parent)) continue;
    seen.add(parent);
    stack.push(...hard.get(parent));
  }
  return seen;
}

function scoresFor(topic, attempts) {
  return attempts.map((answer, index) => {
    if (answer === null) return null;
    const diagnostic = index === 1 ? topic.diagnostic.lowered : topic.diagnostic;
    if (!diagnostic) invalid('DIAGNOSIS_INVALID', 'lowered answer requires its own diagnostic');
    if (!Number.isInteger(answer)) invalid('DIAGNOSIS_INVALID', 'answer must be an integer or null');
    if (diagnostic.kind === 'rubric') {
      if (answer < 0 || answer > 2) invalid('DIAGNOSIS_INVALID', 'rubric level must be 0, 1 or 2');
      return answer;
    }
    if (answer < 0 || answer >= diagnostic.options.length) invalid('DIAGNOSIS_INVALID', 'choice index out of range');
    return answer === diagnostic.answerIndex ? 2 : 0;
  });
}

function statusFor(scores) {
  const [main, lowered] = scores;
  if (main === undefined || main === null) return 'untested';
  if (lowered === undefined || lowered === null) return main === 2 ? 'mastered' : 'untested';
  if (main === 0 && lowered === 0) return 'weak';
  if (main === 2 && lowered === 2) return 'mastered';
  if (main === 2 || lowered === 2) return 'unstable';
  // A partial rubric response (1) is insufficient to diagnose a weak prerequisite.
  return 'untested';
}

/**
 * answers: { [topicId]: [mainAnswer?, loweredAnswer?] }; choice = index, rubric = 0..2.
 * null means no evidence. masteredIds are caller-verified prior evidence, never inferred.
 * Returns a fresh projection, without storage, time, random, network or user-fact writes.
 */
export function diagnose(graph, request = {}) {
  validateGraph(graph);
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    invalid('DIAGNOSIS_INVALID', 'request must be an object');
  }
  const { targetId, answers = {}, masteredIds = [] } = request;
  const { topics, hard, order } = indexGraph(graph);
  if (
    !topics.has(targetId) ||
    !answers ||
    Array.isArray(answers) ||
    typeof answers !== 'object' ||
    !Array.isArray(masteredIds) ||
    masteredIds.some((id) => !topics.has(id))
  ) {
    invalid('DIAGNOSIS_INVALID', 'target/answers/masteredIds');
  }
  const known = new Set(masteredIds);
  const scored = new Map();
  for (const [id, attempts] of Object.entries(answers)) {
    if (
      !topics.has(id) ||
      !Array.isArray(attempts) ||
      attempts.length > 2 ||
      Array.from({ length: attempts.length }, (_, i) => i).some((i) => !(i in attempts))
    ) {
      invalid('DIAGNOSIS_INVALID', 'unknown topic or invalid attempt pair');
    }
    const scores = scoresFor(topics.get(id), attempts);
    // New evidence wins over a stale prior mastery claim, including partial evidence.
    if (scores.some((score) => score !== null)) known.delete(id);
    scored.set(id, scores);
  }
  const statuses = Object.fromEntries(order.map((id) => [id, known.has(id) ? 'mastered' : 'untested']));
  const visited = new Set();
  const pruningCandidates = new Set();
  const nextTests = [];
  const insufficientEvidence = [];
  const evidence = [];
  const stack = [targetId];
  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const topic = topics.get(id);
    const scores = scored.get(id) || [];
    const status = known.has(id) ? 'mastered' : statusFor(scores);
    statuses[id] = status;
    evidence.push({ topicId: id, scores: [...scores], source: known.has(id) ? 'prior' : 'answers' });
    if (status === 'mastered') {
      for (const parent of ancestors(id, hard)) pruningCandidates.add(parent);
    } else if (status === 'weak') {
      // Reverse push preserves the graph's declared prerequisite order.
      stack.push(...[...hard.get(id)].reverse());
    } else if (status === 'untested') {
      const noMain = scores[0] === undefined || scores[0] === null;
      const noLowered = scores[1] === undefined || scores[1] === null;
      if (noMain || noLowered) {
        const phase = noMain ? 'main' : 'lowered';
        const diagnostic = noMain ? topic.diagnostic : topic.diagnostic.lowered;
        // Never pretend that repeating the main question is a new lowered trial.
        nextTests.push({
          topicId: id,
          phase,
          diagnostic: diagnostic ? publicDiagnostic(diagnostic) : null,
          requiresQuestion: !diagnostic
        });
      } else insufficientEvidence.push(id);
    }
  }
  const scope = order.filter((id) => visited.has(id));
  const weak = scope.filter((id) => statuses[id] === 'weak');
  const rootCauses = weak
    .filter((id) => ![...ancestors(id, hard)].some((parent) => visited.has(parent) && statuses[parent] === 'weak'))
    .map((topicId) => {
      const unresolved = new Set();
      const pending = [...hard.get(topicId)];
      while (pending.length) {
        const id = pending.pop();
        if (statuses[id] === 'mastered' || unresolved.has(id)) continue;
        unresolved.add(id);
        pending.push(...hard.get(id));
      }
      const blockers = order.filter((id) => unresolved.has(id));
      return { topicId, provisional: blockers.length > 0, blockers };
    });
  return {
    graphVersion: graph.version,
    targetId,
    statuses,
    visitedIds: scope,
    prunedIds: order.filter((id) => pruningCandidates.has(id) && !visited.has(id) && !known.has(id)),
    nextTests,
    insufficientEvidence,
    rootCauses,
    // Includes pending prerequisites; this is a proposed path, not a completed-learning fact.
    learningPath: scope.filter((id) => statuses[id] !== 'mastered'),
    softHints: graph.edges
      .filter((edge) => edge.strength === 'soft' && visited.has(edge.to))
      .map((edge) => ({ ...edge })),
    complete: nextTests.length === 0 && insufficientEvidence.length === 0,
    evidence
  };
}

// A returned prompt can be displayed later without leaking a choice answer or rubric.
function publicDiagnostic(diagnostic) {
  return {
    prompt: diagnostic.prompt,
    kind: diagnostic.kind,
    ...(diagnostic.kind === 'choice' ? { options: [...diagnostic.options] } : {})
  };
}
