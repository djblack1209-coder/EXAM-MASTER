import { assert } from './learning-domain.js';
import { createArithmeticQuestion, createAlgebraQuestion, createConditionQuestion } from './learning-tools.js';
import { createWritingQuestion, nextWritingTask } from '../../../laf-backend/functions/_shared/learning-writing.js';
import { createScienceQuestion } from '../../../laf-backend/functions/_shared/learning-science.js';
import { DENSITY_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-density.js';
import { PRESSURE_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-pressure.js';
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
      question = createArithmeticQuestion(id, `${a} ${moduleId === 'arithmetic-add' ? '+' : '×'} ${b}`);
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
      question = createScienceQuestion(id, conversationId, {
        template: DENSITY_TEMPLATE,
        target: 'density',
        massG: 120 + n * 10,
        volumeCm3: 50
      });
    } else if (moduleId === 'science-pressure') {
      question = createScienceQuestion(id, conversationId, {
        template: PRESSURE_TEMPLATE,
        target: 'pressure',
        uniformContact: true,
        normalForceN: 72 + n,
        areaCm2: 24
      });
    }
    assert(question, 'CAPABILITY_UNAVAILABLE', '当前模块无法生成可核对题面');
    questions.push(question);
    virtual.questions.push(question);
  }
  return questions;
}
