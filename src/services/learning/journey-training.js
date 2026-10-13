import { assert } from './learning-domain.js';
import { createArithmeticQuestion, createAlgebraQuestion, createConditionQuestion } from './learning-tools.js';
import { createWritingQuestion, nextWritingTask } from '../../../laf-backend/functions/_shared/learning-writing.js';
import { createScienceQuestion } from '../../../laf-backend/functions/_shared/learning-science.js';
import { DENSITY_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-density.js';
import { PRESSURE_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-pressure.js';
import { ENERGY_TEMPLATE, VELOCITY_GRAPH_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-visual.js';
import { JOURNEY_MODULES } from '../../../laf-backend/functions/_shared/learning-journey.js';

export function createJourneyQuestions(state, conversationId, moduleId, count, groupId) {
  const module = JOURNEY_MODULES.find((m) => m.id === moduleId);
  assert(module && Number.isInteger(count) && count >= 1 && count <= 20, 'INVALID_INPUT', '请选择1至20题');
  const session = state.conversations.find((c) => c.id === conversationId);
  const ordinal = (session?.trainingGroups || []).filter((g) => g.moduleId === moduleId).length;
  const virtual = { ...state, questions: [...state.questions] };
  const questions = [];
  for (let index = 0; index < count; index++) {
    const id = `${groupId}_q${index + 1}`;
    const n = ordinal * 20 + index;
    let question;
    if (moduleId.startsWith('arithmetic-')) {
      const a = 7 + n,
        b = 5 + (n % 7) * 3;
      const operator = {
        'arithmetic-add': '+',
        'arithmetic-subtract': '−',
        'arithmetic-multiply': '×',
        'arithmetic-divide': '÷'
      }[moduleId];
      question = createArithmeticQuestion(
        id,
        `${moduleId === 'arithmetic-subtract' && n % 2 ? -a : a} ${operator} ${n % 4 === 3 && ['arithmetic-subtract', 'arithmetic-divide'].includes(moduleId) ? -b : b}`
      );
    } else if (moduleId.startsWith('fraction-')) {
      const a = 2 + n,
        b = 3 + (n % 7),
        c = 1 + (n % 5),
        d = 4 + (n % 5);
      const operator = moduleId === 'fraction-add-subtract' ? (n % 2 ? '−' : '+') : n % 2 ? '÷' : '×';
      question = createArithmeticQuestion(id, `${n % 4 === 3 ? -a : a}/${b} ${operator} ${c}/${d}`);
    } else if (moduleId === 'algebra-equation') {
      const coefficient = 2 + (n % 3),
        solution = 2 + (n % 7);
      question = createAlgebraQuestion(id, `解方程 ${coefficient}*x+${n + 1}=${coefficient * solution + n + 1}`);
    } else if (moduleId === 'algebra-inequality') {
      const coefficient = (n % 2 ? -1 : 1) * (2 + (n % 3)),
        boundary = 1 + (n % 5);
      question = createAlgebraQuestion(id, `解不等式 ${coefficient}*x+${n + 1}>${coefficient * boundary + n + 1}`);
    } else if (moduleId === 'condition-relation') {
      const pairs = [
        [`x>${n + 2}`, `x>${n + 1}`],
        [`x>${n + 1}`, `x>${n + 2}`],
        [`x>${n + 2}`, `x>${n + 2}`],
        [`x>${n + 2}`, `x<${n + 1}`]
      ];
      question = createConditionQuestion(id, `判断条件 ${pairs[n % 4][0]} 是 ${pairs[n % 4][1]} 的什么条件`);
    } else if (moduleId.startsWith('writing-')) {
      const genre = moduleId.slice(8);
      question = createWritingQuestion(id, conversationId, genre, nextWritingTask(virtual, conversationId, genre));
    } else if (moduleId === 'science-distance') {
      question = createScienceQuestion(id, conversationId, {
        template: 'distance_displacement',
        outward: 6 + (n % 10),
        backward: 2 + (n % 4),
        direction: n % 2 ? 'left' : 'right'
      });
    } else if (moduleId === 'science-density') {
      const massG = 120 + (n % 100) * 10,
        densityGcm3 = 2 + (n % 5),
        tasks = [
          { target: 'density', massG, volumeCm3: 50 },
          { target: 'mass', densityGcm3, volumeCm3: 50 },
          { target: 'volume', massG, densityGcm3 },
          { target: 'density_si', massG, volumeCm3: 50 }
        ];
      question = createScienceQuestion(id, conversationId, { template: DENSITY_TEMPLATE, ...tasks[n % 4] });
    } else if (moduleId === 'science-pressure') {
      const normalForceN = 72 + (n % 100),
        pressurePa = 20000 + (n % 10) * 10000,
        tasks = [
          { target: 'pressure', normalForceN, areaCm2: 24 },
          { target: 'force', pressurePa, areaCm2: 24 },
          { target: 'area', normalForceN, pressurePa },
          { target: 'pressure_kpa', normalForceN, areaCm2: 24 }
        ];
      question = createScienceQuestion(id, conversationId, {
        template: PRESSURE_TEMPLATE,
        uniformContact: true,
        ...tasks[n % 4]
      });
    } else if (moduleId === 'science-force') {
      question = createScienceQuestion(id, conversationId, {
        template: 'constant_net_force',
        massKg: 1 + (n % 20),
        netForceN: 1 + (n % 12),
        direction: n % 2 ? 'left' : 'right'
      });
    } else if (moduleId === 'science-motion') {
      const common = { massKg: 2 + (n % 4), initialVelocityMps: n % 2 ? -2 : 2 };
      question = createScienceQuestion(
        id,
        conversationId,
        n % 2
          ? {
              template: 'changing_net_force',
              ...common,
              segments: [
                { seconds: 2, netForceN: 4 + (n % 6), direction: 'right' },
                { seconds: 2, netForceN: 2 + (n % 5), direction: 'left' }
              ]
            }
          : {
              template: 'accelerated_motion',
              ...common,
              netForceN: 4 + (n % 6),
              direction: 'left',
              physicalSeconds: 2 + (Math.floor(n / 12) % 3)
            }
      );
    } else if (moduleId === 'science-velocity-graph') {
      question = createScienceQuestion(id, conversationId, {
        template: VELOCITY_GRAPH_TEMPLATE,
        points: [
          { time: 0, velocity: 2 + (n % 8) },
          { time: 2, velocity: -(2 + (n % 6)) },
          { time: 4, velocity: 0 }
        ]
      });
    } else if (moduleId === 'science-energy') {
      question = createScienceQuestion(id, conversationId, {
        template: ENERGY_TEMPLATE,
        massKg: 2 + (n % 4),
        initialVelocityMps: 3 - (n % 3),
        netForceN: 2 + (n % 6),
        direction: n % 2 ? 'right' : 'left',
        physicalSeconds: 2 + (Math.floor(n / 12) % 3)
      });
    }
    assert(question, 'CAPABILITY_UNAVAILABLE', '当前模块无法生成可核对题面');
    questions.push(question);
    virtual.questions.push(question);
  }
  return questions;
}
