import { assert, questionKey } from './learning-domain.js';
import { inspectPageImage, visualSource } from './learning-vision.js';
import {
  visualRecipe,
  MOTION_TEMPLATES,
  motionInput,
  VELOCITY_GRAPH_TEMPLATE,
  ENERGY_TEMPLATE,
  energyInput
} from './learning-visual.js';

export const DIAGRAM_CONTRACT = 'learning-diagram-v1';
// 只绑定当前账户的原页；不将题干、OCR 或模型猜测当作已确认物理条件。
export function sourceDiagram(state, question, conversationId) {
  const session = state.conversations.find((c) => c.id === conversationId);
  if (!question || session?.activeQuestionKey !== questionKey(question)) return null;
  const q = state.questions.find((item) => questionKey(item) === questionKey(question));
  if (q?.source?.kind !== 'private_material') return null;
  const material = state.materials.find((item) => item.id === q.source.materialId);
  const segment = material?.segments.find((item) => item.id === q.source.segmentId);
  if (
    !segment?.preview ||
    material.extractionVersion !== q.source.extractionVersion ||
    (segment.extractionVersion || material.extractionVersion) !== q.source.extractionVersion ||
    segment.extractionEventId !== q.source.extractionEventId ||
    segment.page !== q.source.page ||
    (state.materialDeletions || []).some((d) => (d.materialIds || [d.materialId]).includes(material.id))
  )
    return null;
  try {
    const source = visualSource(
      Object.fromEntries(
        ['materialId', 'segmentId', 'page', 'extractionVersion', 'extractionEventId'].map((k) => [k, q.source[k]])
      )
    );
    inspectPageImage(segment.preview);
    const binding = Object.freeze({
      contract: DIAGRAM_CONTRACT,
      owner: state.owner,
      conversationId,
      questionKey: questionKey(q),
      ...source
    });
    return {
      binding,
      image: segment.preview,
      prompt: q.prompt,
      stamp: JSON.stringify([binding, q.prompt, segment.content])
    };
  } catch {
    return null;
  }
}
function integer(value) {
  assert(
    (typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^\d{1,5}$/.test(value)),
    'INVALID_INPUT',
    '请填写整数条件，不猜小数或单位'
  );
  return Number(value);
}
function quantity(value, unit, units) {
  assert(Object.prototype.hasOwnProperty.call(units, unit), 'INVALID_INPUT', '请确认原图单位');
  const result = integer(value) / units[unit];
  assert(Number.isInteger(result), 'UNSUPPORTED_VISUAL', '换算后不是受支持的整数，暂不能演示');
  return result;
}
function decimalQuantity(value, unit, units) {
  assert(Object.prototype.hasOwnProperty.call(units, unit), 'INVALID_INPUT', '请确认原图单位');
  assert(
    (typeof value === 'number' || typeof value === 'string') && /^\d{1,6}(?:\.\d{1,2})?$/.test(String(value)),
    'INVALID_INPUT',
    '请填写非负数值，最多两位小数'
  );
  const result = Number(value) / units[unit];
  assert(
    Number.isFinite(result) && /^\d+(?:\.\d{1,2})?$/.test(String(result)),
    'UNSUPPORTED_VISUAL',
    '换算后最多支持两位小数'
  );
  return result;
}
export function confirmedDiagramRecipe(input, source) {
  const binding = source?.binding;
  assert(input?.explicit === true && binding?.contract === DIAGRAM_CONTRACT, 'PRECONDITION', '请明确确认原图条件');
  assert(
    input.binding &&
      !Array.isArray(input.binding) &&
      Object.keys(input.binding).length === Object.keys(binding).length &&
      Object.keys(input.binding).every((key) => Object.prototype.hasOwnProperty.call(binding, key)) &&
      Object.entries(binding).every(([key, value]) => input.binding[key] === value),
    'CONTEXT_CHANGED',
    '原图或题目已变化，请重新确认'
  );
  assert(
    input.sourceSnapshot &&
      Object.keys(input.sourceSnapshot).length === 2 &&
      Object.keys(input.sourceSnapshot).every((key) => ['stamp', 'image'].includes(key)) &&
      input.sourceSnapshot.stamp === source.stamp &&
      input.sourceSnapshot.image === source.image,
    'CONTEXT_CHANGED',
    '原页内容已变化，请重新确认'
  );
  const fields =
    input.template === VELOCITY_GRAPH_TEMPLATE
      ? ['points', 'timeUnit', 'velocityUnit', 'positiveDirection', 'lineKind']
      : MOTION_TEMPLATES.includes(input.template) || input.template === ENERGY_TEMPLATE
        ? [
            'massKg',
            'massUnit',
            'initialVelocityMps',
            'velocityUnit',
            'velocityDirection',
            'initialState',
            'forceKind',
            ...(input.template === ENERGY_TEMPLATE ? ['massKind', 'motionKind', 'bodyKind', 'frameKind'] : []),
            ...(input.template === 'accelerated_motion' || input.template === ENERGY_TEMPLATE
              ? ['netForceN', 'forceUnit', 'direction', 'physicalSeconds', 'timeUnit']
              : ['segments'])
          ]
        : input.template === 'constant_net_force'
          ? ['massKg', 'massUnit', 'netForceN', 'forceUnit', 'direction', 'initialState', 'forceKind']
          : ['outward', 'outwardUnit', 'backward', 'backwardUnit', 'direction'];
  assert(
    Object.keys(input).every((key) => ['explicit', 'binding', 'sourceSnapshot', 'template', ...fields].includes(key)),
    'FORBIDDEN',
    '演示条件超出范围'
  );
  if (input.template === VELOCITY_GRAPH_TEMPLATE) {
    assert(input.lineKind === 'linear', 'UNSUPPORTED_VISUAL', '请确认相邻折点之间为直线；曲线不能按折线推算');
    assert(['left', 'right'].includes(input.positiveDirection), 'PRECONDITION', '请确认原图速度的正方向');
    assert(
      Array.isArray(input.points) && input.points.length >= 2 && input.points.length <= 4,
      'RESOURCE_LIMIT',
      '请确认2–4个速度图折点'
    );
    const points = input.points.map((p) => {
      assert(
        p &&
          !Array.isArray(p) &&
          Object.keys(p).length === 2 &&
          Object.keys(p).every((k) => ['time', 'velocity'].includes(k)),
        'FORBIDDEN',
        '折点只能包含时间与速度'
      );
      assert(
        (typeof p.velocity === 'string' || typeof p.velocity === 'number') &&
          /^-?\d{1,6}(?:\.\d{1,2})?$/.test(String(p.velocity)),
        'INVALID_INPUT',
        '请填写原图带符号速度，最多两位小数'
      );
      const v = decimalQuantity(String(p.velocity).replace(/^-/, ''), input.velocityUnit, { 'm/s': 1, 'cm/s': 100 });
      return {
        time: decimalQuantity(p.time, input.timeUnit, { s: 1, ms: 1000 }),
        velocity: v * (String(p.velocity).startsWith('-') ? -1 : 1) * (input.positiveDirection === 'left' ? -1 : 1)
      };
    });
    return visualRecipe({ template: input.template, points });
  }
  if (MOTION_TEMPLATES.includes(input.template) || input.template === ENERGY_TEMPLATE) {
    if (input.template === ENERGY_TEMPLATE)
      assert(
        input.massKind === 'constant' &&
          input.motionKind === 'linear' &&
          input.bodyKind === 'particle' &&
          input.frameKind === 'inertial',
        'UNSUPPORTED_VISUAL',
        '请确认质点、惯性参考系、质量不变和直线运动'
      );
    const velocity = decimalQuantity(input.initialVelocityMps, input.velocityUnit, { 'm/s': 1, 'cm/s': 100 });
    assert(
      (input.initialState === 'rest' && velocity === 0 && input.velocityDirection === 'none') ||
        (input.initialState === 'moving' && velocity > 0 && ['left', 'right'].includes(input.velocityDirection)),
      'PRECONDITION',
      '请确认初速度及方向；未知状态不能演示'
    );
    const common = {
      template: input.template,
      massKg: decimalQuantity(input.massKg, input.massUnit, { kg: 1, g: 1000 }),
      initialVelocityMps: (input.velocityDirection === 'left' ? -1 : 1) * velocity
    };
    if (input.template === 'accelerated_motion' || input.template === ENERGY_TEMPLATE) {
      assert(input.forceKind === 'net_constant', 'UNSUPPORTED_VISUAL', '此演示需要恒定合力，单个推力不能代替合力');
      return visualRecipe({
        ...common,
        netForceN: decimalQuantity(input.netForceN, input.forceUnit, { N: 1 }),
        direction: input.direction,
        physicalSeconds: decimalQuantity(input.physicalSeconds, input.timeUnit, { s: 1 })
      });
    }
    assert(
      input.forceKind === 'net_segments' &&
        Array.isArray(input.segments) &&
        input.segments.length >= 2 &&
        input.segments.length <= 3,
      'UNSUPPORTED_VISUAL',
      '请确认2–3段各自恒定的合力'
    );
    const segments = input.segments.map((s) => {
      assert(
        s &&
          !Array.isArray(s) &&
          Object.keys(s).length === 5 &&
          Object.keys(s).every((k) => ['seconds', 'timeUnit', 'netForceN', 'forceUnit', 'direction'].includes(k)),
        'FORBIDDEN',
        '分段条件超出范围'
      );
      return {
        seconds: decimalQuantity(s.seconds, s.timeUnit, { s: 1 }),
        netForceN: decimalQuantity(s.netForceN, s.forceUnit, { N: 1 }),
        direction: s.direction
      };
    });
    return visualRecipe({ ...common, segments });
  }
  if (input.template === 'constant_net_force') {
    assert(
      input.initialState === 'rest' && input.forceKind === 'net_constant',
      'UNSUPPORTED_VISUAL',
      '此演示需要初始静止、恒定合力；其他条件暂不支持'
    );
    assert(input.forceUnit === 'N', 'INVALID_INPUT', '请确认合力单位N');
    return visualRecipe({
      template: input.template,
      massKg: quantity(input.massKg, input.massUnit, { kg: 1, g: 1000 }),
      netForceN: integer(input.netForceN),
      direction: input.direction
    });
  }
  return visualRecipe({
    template: input.template,
    outward: quantity(input.outward, input.outwardUnit, { m: 1, cm: 100 }),
    backward: quantity(input.backward, input.backwardUnit, { m: 1, cm: 100 }),
    direction: input.direction
  });
}
export function diagramHelpContent(recipe, page) {
  if (recipe.template === ENERGY_TEMPLATE) {
    const value = energyInput(recipe);
    return `原图演示帮助${page ? `（第${page}页）` : ''}：按你确认的惯性参考系、质点、直线运动与不变质量${value.massKg}kg，初速度${value.initialVelocityMps}m/s（向右为正），恒定合力${value.netForceN}N${value.netForceN ? `向${value.direction === 'left' ? '左' : '右'}` : '无方向'}，观察${value.physicalSeconds}s；比较合力总功与动能变化。`;
  }
  if (recipe.template === VELOCITY_GRAPH_TEMPLATE)
    return `原图演示帮助${page ? `（第${page}页）` : ''}：按你确认的速度图折点，换算为s、m/s并统一向右为正；${recipe.points.map((p) => `${p.time}s时${p.velocity}m/s`).join('；')}；相邻折点间为直线。观察正负面积、路程与位移。`;
  if (MOTION_TEMPLATES.includes(recipe.template)) {
    const value = motionInput(recipe),
      schedule = value.segments || [
        { seconds: value.physicalSeconds, netForceN: value.netForceN, direction: value.direction }
      ];
    const description = schedule
      .map(
        (s, i) =>
          `第${i + 1}段${s.seconds}s，合力${s.netForceN}N${s.netForceN ? `向${s.direction === 'left' ? '左' : '右'}` : '无方向'}`
      )
      .join('；');
    return `原图演示帮助${page ? `（第${page}页）` : ''}：按你确认的条件，质量${value.massKg}kg，初速度${value.initialVelocityMps}m/s（向右为正）；${description}。另比较质量加倍。`;
  }
  const side = recipe.direction === 'left' ? '左' : '右';
  const conditions =
    recipe.template === 'constant_net_force'
      ? `初始静止，质量${recipe.massKg}kg，恒定合力${recipe.netForceN}N${recipe.netForceN ? `向${side}` : ''}；另比较质量加倍。`
      : `先向${side}${recipe.outward}m，再反向${recipe.backward}m。`;
  return `原图演示帮助${page ? `（第${page}页）` : ''}：按你确认的条件，${conditions}`;
}
