import { assert, dayKey, effectiveGrade, knowledgeScope, questionKey } from './learning-domain.js';

// 模型选模板和有界数值；宿主生成画面。没有代码、URL、文件或网络参数。
export const VISUAL_CONTRACT = 'learning-visual-v1';
export const SCIENCE_VISUAL_CONTRACT = 'learning-visual-v2';
export const MOTION_VISUAL_CONTRACT = 'learning-visual-v3';
export const GRAPH_VISUAL_CONTRACT = 'learning-visual-v4';
export const ENERGY_VISUAL_CONTRACT = 'learning-visual-v5';
export const ENERGY_TEMPLATE = 'work_kinetic_energy';
export const ENERGY_BASIS = Object.freeze({
  publisher: 'OpenStax',
  title: 'University Physics Volume 1 · Work-Energy Theorem',
  url: 'https://openstax.org/books/university-physics-volume-1/pages/7-3-work-energy-theorem',
  definitionUrl: 'https://openstax.org/books/university-physics-volume-1/pages/7-2-kinetic-energy',
  purpose: 'definition_reference',
  copiedTextOrMedia: false,
  scoringAuthority: false
});
export const VELOCITY_GRAPH_TEMPLATE = 'velocity_time_graph';
export const MOTION_TEMPLATES = Object.freeze(['accelerated_motion', 'changing_net_force']);

// 有界有理数；绘图可近似，出题依据始终保留约分后的精确值。
const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const exact = (n, d = 1) => {
  assert(Number.isSafeInteger(n) && Number.isSafeInteger(d) && d !== 0, 'RESOURCE_LIMIT', '计算超出精确数值范围');
  const g = gcd(n, d),
    sign = d < 0 ? -1 : 1;
  return [(n / g) * sign || 0, Math.abs(d / g)];
};
const addExact = (a, b) => {
  const g = gcd(a[1], b[1]);
  const first = a[0] * (b[1] / g),
    second = b[0] * (a[1] / g);
  assert(Number.isSafeInteger(first) && Number.isSafeInteger(second), 'RESOURCE_LIMIT', '计算超出精确数值范围');
  return exact(first + second, a[1] * (b[1] / g));
};
const negExact = (a) => [-a[0], a[1]];
const absExact = (a) => [Math.abs(a[0]), a[1]];
const mulExact = (a, b) => {
  const g = gcd(a[0], b[1]),
    h = gcd(b[0], a[1]);
  return exact((a[0] / g) * (b[0] / h), (a[1] / h) * (b[1] / g));
};
const divExact = (a, b) => mulExact(a, exact(b[1], b[0]));
const asNumber = (a) => a[0] / a[1];
const lessExact = (a, b) => {
  const g = gcd(a[1], b[1]),
    first = a[0] * (b[1] / g),
    second = b[0] * (a[1] / g);
  assert(Number.isSafeInteger(first) && Number.isSafeInteger(second), 'RESOURCE_LIMIT', '计算超出精确数值范围');
  return first < second;
};
export function exactMotionText(a) {
  const value = exact(a[0], a[1]);
  let denominator = value[1],
    twos = 0,
    fives = 0;
  while (denominator % 2 === 0) {
    denominator /= 2;
    twos++;
  }
  while (denominator % 5 === 0) {
    denominator /= 5;
    fives++;
  }
  if (denominator !== 1 || Math.max(twos, fives) > 6) return `${value[0]}/${value[1]}`;
  return String(Number(asNumber(value).toFixed(Math.max(twos, fives))));
}
function decimal(value, min, max) {
  assert(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      /^-?\d+(?:\.\d{1,2})?$/.test(String(value)) &&
      value >= min &&
      value <= max,
    'RESOURCE_LIMIT',
    '数值须在范围内，最多两位小数'
  );
  const parts = String(value).split('.'),
    scale = parts[1] ? 10 ** parts[1].length : 1;
  return exact(Math.round(value * scale), scale);
}
function forcePhase(input) {
  assert(
    input &&
      typeof input === 'object' &&
      !Array.isArray(input) &&
      Object.keys(input).length === 3 &&
      Object.keys(input).every((k) => ['seconds', 'netForceN', 'direction'].includes(k)),
    'FORBIDDEN',
    '每段只接受持续时间、合力与方向'
  );
  decimal(input.netForceN, 0, 12);
  assert(
    Number.isInteger(input.seconds) &&
      input.seconds >= 1 &&
      input.seconds <= 10 &&
      (input.netForceN === 0 ? input.direction === 'none' : ['left', 'right'].includes(input.direction)),
    'INVALID_INPUT',
    '每段限1–10整数秒，零合力无方向'
  );
  return Object.freeze({ seconds: input.seconds, netForceN: input.netForceN, direction: input.direction });
}
export function motionInput(recipe) {
  assert(MOTION_TEMPLATES.includes(recipe?.template), 'UNSUPPORTED_VISUAL', '运动模板不受支持');
  const common = { template: recipe.template, massKg: recipe.massKg, initialVelocityMps: recipe.initialVelocityMps };
  return recipe.template === 'accelerated_motion'
    ? { ...common, netForceN: recipe.netForceN, direction: recipe.direction, physicalSeconds: recipe.physicalSeconds }
    : { ...common, segments: recipe.segments.map((s) => ({ ...s })) };
}
function phases(recipe) {
  return recipe.template === 'accelerated_motion'
    ? [{ seconds: recipe.physicalSeconds, netForceN: recipe.netForceN, direction: recipe.direction }]
    : recipe.segments;
}
function motionAt(recipe, time, massMultiplier = 1) {
  const mass = mulExact(decimal(recipe.massKg, 0.1, 20), exact(massMultiplier));
  let velocity = decimal(recipe.initialVelocityMps, -10, 10),
    position = exact(0),
    distance = exact(0),
    remaining = time,
    acceleration = exact(0),
    phaseIndex = 0;
  const extrema = [0],
    schedule = phases(recipe);
  for (let i = 0; i < schedule.length; i++) {
    const phase = schedule[i],
      seconds = exact(phase.seconds);
    acceleration = divExact(
      mulExact(decimal(phase.netForceN, 0, 12), exact(phase.direction === 'left' ? -1 : 1)),
      mass
    );
    phaseIndex = i;
    const duration = lessExact(remaining, seconds) ? remaining : seconds;
    const shift = (t) => addExact(mulExact(velocity, t), divExact(mulExact(acceleration, mulExact(t, t)), exact(2)));
    const delta = shift(duration),
      nextPosition = addExact(position, delta);
    const turn = acceleration[0] ? divExact(negExact(velocity), acceleration) : null;
    if (turn && turn[0] > 0 && lessExact(turn, duration)) {
      const first = shift(turn);
      distance = addExact(distance, addExact(absExact(first), absExact(addExact(delta, negExact(first)))));
      extrema.push(asNumber(addExact(position, first)));
    } else distance = addExact(distance, absExact(delta));
    position = nextPosition;
    extrema.push(asNumber(position));
    velocity = addExact(velocity, mulExact(acceleration, duration));
    remaining = addExact(remaining, negExact(duration));
    // 分段边界采用右侧合力；终点采用最后一段。
    if (remaining[0] === 0 && (lessExact(duration, seconds) || i === schedule.length - 1)) break;
  }
  return { position, distance, velocity, acceleration, phaseIndex, extrema };
}
function motionRecipe(input) {
  const keys =
    input.template === 'accelerated_motion'
      ? ['template', 'massKg', 'initialVelocityMps', 'netForceN', 'direction', 'physicalSeconds']
      : ['template', 'massKg', 'initialVelocityMps', 'segments'];
  assert(
    Object.keys(input).length === keys.length && Object.keys(input).every((k) => keys.includes(k)),
    'FORBIDDEN',
    '运动只接受质量、初速度与已确认的合力时间段'
  );
  decimal(input.massKg, 0.1, 20);
  decimal(input.initialVelocityMps, -10, 10);
  let schedule;
  if (input.template === 'accelerated_motion')
    schedule = [forcePhase({ seconds: input.physicalSeconds, netForceN: input.netForceN, direction: input.direction })];
  else {
    assert(
      Array.isArray(input.segments) && input.segments.length >= 2 && input.segments.length <= 3,
      'RESOURCE_LIMIT',
      '分段合力限2–3段'
    );
    schedule = input.segments.map(forcePhase);
  }
  const physicalSeconds = schedule.reduce((sum, s) => sum + s.seconds, 0);
  assert(physicalSeconds <= 10, 'RESOURCE_LIMIT', '总观察时间最多10秒');
  const recipe = Object.freeze({
    ...input,
    ...(input.segments ? { segments: Object.freeze(schedule) } : {}),
    contract: MOTION_VISUAL_CONTRACT,
    physicalSeconds,
    duration: 6,
    steps: 24
  });
  // 接受前核对全部帧与双质量，越界不产生可自动判分的题目。
  for (let step = 0; step <= recipe.steps; step++)
    for (const multiplier of [1, 2]) motionAt(recipe, exact(physicalSeconds * step, recipe.steps), multiplier);
  return recipe;
}
export function motionResult(input) {
  const recipe = visualRecipe(input);
  assert(recipe.contract === MOTION_VISUAL_CONTRACT, 'INVALID_INPUT', '请使用当前运动版本');
  const result = motionAt(recipe, exact(recipe.physicalSeconds));
  return { distance: result.distance, displacement: result.position, velocity: result.velocity };
}
export function energyInput(recipe) {
  assert(recipe?.template === ENERGY_TEMPLATE, 'UNSUPPORTED_VISUAL', '请使用功与动能模板');
  return {
    template: recipe.template,
    massKg: recipe.massKg,
    initialVelocityMps: recipe.initialVelocityMps,
    netForceN: recipe.netForceN,
    direction: recipe.direction,
    physicalSeconds: recipe.physicalSeconds
  };
}
function energyMotion(input) {
  return { ...energyInput(input), template: 'accelerated_motion' };
}
function energyAt(recipe, time) {
  const result = motionAt(energyMotion(recipe), time),
    mass = decimal(recipe.massKg, 0.1, 20),
    initialVelocity = decimal(recipe.initialVelocityMps, -10, 10),
    initialKinetic = divExact(mulExact(mass, mulExact(initialVelocity, initialVelocity)), exact(2)),
    finalKinetic = divExact(mulExact(mass, mulExact(result.velocity, result.velocity)), exact(2)),
    work = mulExact(
      mulExact(decimal(recipe.netForceN, 0, 12), exact(recipe.direction === 'left' ? -1 : 1)),
      result.position
    ),
    kineticChange = addExact(finalKinetic, negExact(initialKinetic));
  assert(work[0] === kineticChange[0] && work[1] === kineticChange[1], 'INVALID_INPUT', '功与动能校验不一致');
  return {
    work,
    initialKinetic,
    finalKinetic,
    kineticChange,
    displacement: result.position,
    distance: result.distance,
    velocity: result.velocity
  };
}
function energyRecipe(input) {
  const keys = ['template', 'massKg', 'initialVelocityMps', 'netForceN', 'direction', 'physicalSeconds'];
  assert(
    Object.keys(input).length === keys.length && Object.keys(input).every((key) => keys.includes(key)),
    'FORBIDDEN',
    '功与动能只接受质量、初速度、恒定合力与时间'
  );
  const motion = motionRecipe(energyMotion(input)),
    recipe = Object.freeze({ ...energyInput(input), contract: ENERGY_VISUAL_CONTRACT, duration: 6, steps: 24 });
  for (let step = 0; step <= recipe.steps; step++) energyAt(recipe, exact(motion.physicalSeconds * step, recipe.steps));
  return recipe;
}
export function energyResult(input) {
  const recipe = visualRecipe(input);
  assert(recipe.contract === ENERGY_VISUAL_CONTRACT, 'INVALID_INPUT', '请使用当前功与动能版本');
  return energyAt(recipe, exact(recipe.physicalSeconds));
}
export function velocityGraphInput(recipe) {
  assert(recipe?.template === VELOCITY_GRAPH_TEMPLATE, 'UNSUPPORTED_VISUAL', '请使用速度—时间图');
  return { template: recipe.template, points: recipe.points.map((p) => ({ time: p.time, velocity: p.velocity })) };
}
function velocityGraphAt(recipe, time) {
  let positiveArea = exact(0),
    negativeArea = exact(0),
    velocity = decimal(recipe.points[0].velocity, -20, 20),
    acceleration = exact(0),
    phaseIndex = 0;
  const parts = [];
  for (let i = 1; i < recipe.points.length; i++) {
    const start = recipe.points[i - 1],
      end = recipe.points[i],
      startTime = decimal(start.time, 0, 10),
      endTime = decimal(end.time, 0, 10),
      startVelocity = decimal(start.velocity, -20, 20),
      endVelocity = decimal(end.velocity, -20, 20),
      duration = addExact(endTime, negExact(startTime));
    if (lessExact(time, startTime)) break;
    const remaining = addExact(time, negExact(startTime)),
      elapsed = lessExact(remaining, duration) ? remaining : duration;
    acceleration = divExact(addExact(endVelocity, negExact(startVelocity)), duration);
    velocity = addExact(startVelocity, mulExact(acceleration, elapsed));
    phaseIndex = i - 1;
    const finish = addExact(startTime, elapsed),
      zero = acceleration[0] ? divExact(negExact(startVelocity), acceleration) : null;
    const addPart = (from, to, first, last) => {
      if (!lessExact(from, to)) return;
      const area = divExact(mulExact(addExact(to, negExact(from)), addExact(first, last)), exact(2));
      if (area[0] >= 0) positiveArea = addExact(positiveArea, area);
      else negativeArea = addExact(negativeArea, negExact(area));
      parts.push({ from, to, first, last, sign: area[0] < 0 ? -1 : area[0] > 0 ? 1 : 0 });
    };
    if (zero && zero[0] > 0 && lessExact(zero, elapsed)) {
      const turnTime = addExact(startTime, zero);
      addPart(startTime, turnTime, startVelocity, exact(0));
      addPart(turnTime, finish, exact(0), velocity);
    } else addPart(startTime, finish, startVelocity, velocity);
    if (lessExact(time, endTime) || i === recipe.points.length - 1) break;
  }
  return {
    positiveArea,
    negativeArea,
    distance: addExact(positiveArea, negativeArea),
    displacement: addExact(positiveArea, negExact(negativeArea)),
    velocity,
    acceleration,
    phaseIndex,
    parts
  };
}
function velocityGraphRecipe(input) {
  assert(
    Object.keys(input).length === 2 && Object.keys(input).every((key) => ['template', 'points'].includes(key)),
    'FORBIDDEN',
    '速度图只接受时间和带符号速度坐标'
  );
  assert(
    Array.isArray(input.points) && input.points.length >= 2 && input.points.length <= 4,
    'RESOURCE_LIMIT',
    '速度图限2–4个折点'
  );
  const points = input.points.map((point, i) => {
    assert(
      point &&
        !Array.isArray(point) &&
        Object.keys(point).length === 2 &&
        Object.keys(point).every((key) => ['time', 'velocity'].includes(key)),
      'FORBIDDEN',
      '折点只接受时间和速度'
    );
    decimal(point.time, 0, 10);
    decimal(point.velocity, -20, 20);
    assert(
      i === 0 ? point.time === 0 : point.time > input.points[i - 1].time,
      'INVALID_INPUT',
      '时间须从0开始并严格递增'
    );
    return Object.freeze({ time: point.time, velocity: point.velocity });
  });
  const recipe = Object.freeze({
    contract: GRAPH_VISUAL_CONTRACT,
    template: VELOCITY_GRAPH_TEMPLATE,
    points: Object.freeze(points),
    physicalSeconds: points.at(-1).time,
    duration: 6,
    steps: 24
  });
  for (let step = 0; step <= recipe.steps; step++)
    velocityGraphAt(recipe, mulExact(decimal(recipe.physicalSeconds, 0, 10), exact(step, recipe.steps)));
  return recipe;
}
export function velocityGraphResult(input) {
  const recipe = visualRecipe(input);
  assert(recipe.contract === GRAPH_VISUAL_CONTRACT, 'INVALID_INPUT', '请使用当前速度图版本');
  const { distance, displacement, velocity, positiveArea, negativeArea } = velocityGraphAt(
    recipe,
    decimal(recipe.physicalSeconds, 0, 10)
  );
  return { distance, displacement, velocity, positiveArea, negativeArea };
}
export function assertVisualOutputCapability(output, capabilities) {
  for (const call of output.tools || []) {
    if (call.name !== 'visualize') continue;
    const recipe = visualRecipe(call.arguments);
    const versions = [
      VISUAL_CONTRACT,
      SCIENCE_VISUAL_CONTRACT,
      MOTION_VISUAL_CONTRACT,
      GRAPH_VISUAL_CONTRACT,
      ENERGY_VISUAL_CONTRACT
    ];
    assert(
      versions.indexOf(capabilities?.visualization) >= versions.indexOf(recipe.contract),
      'VISUAL_UNSUPPORTED',
      '当前客户端未声明动态演示能力，未采用新演示'
    );
  }
  return output;
}
export function visualRecipe(input = {}) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INPUT', '演示参数不合法');
  if (input.template === ENERGY_TEMPLATE) return energyRecipe(input);
  if (input.template === VELOCITY_GRAPH_TEMPLATE) return velocityGraphRecipe(input);
  if (MOTION_TEMPLATES.includes(input.template)) return motionRecipe(input);
  if (input.template === 'constant_net_force') {
    assert(
      Object.keys(input).every((key) => ['template', 'massKg', 'netForceN', 'direction'].includes(key)),
      'FORBIDDEN',
      '演示只接受质量、合力与方向'
    );
    assert(
      Number.isInteger(input.massKg) &&
        input.massKg >= 1 &&
        input.massKg <= 20 &&
        Number.isInteger(input.netForceN) &&
        input.netForceN >= 0 &&
        input.netForceN <= 12 &&
        (input.netForceN === 0 ? input.direction === 'none' : ['left', 'right'].includes(input.direction)),
      'RESOURCE_LIMIT',
      '质量限1–20整数kg，合力限0–12整数N；零合力无方向'
    );
    return Object.freeze({
      contract: SCIENCE_VISUAL_CONTRACT,
      template: input.template,
      massKg: input.massKg,
      netForceN: input.netForceN,
      direction: input.direction,
      initialVelocity: 0,
      forceConstant: true,
      physicalSeconds: 2,
      duration: 6,
      steps: 24
    });
  }
  assert(
    Object.keys(input).every((key) => ['template', 'outward', 'backward', 'direction'].includes(key)),
    'FORBIDDEN',
    '演示只接受模板和距离'
  );
  assert(
    input.direction === undefined || ['left', 'right'].includes(input.direction),
    'INVALID_INPUT',
    '请确认运动方向'
  );
  assert(input.template === 'distance_displacement', 'UNSUPPORTED_VISUAL', '这个概念尚无已校验的演示模板');
  const outward = input.outward ?? 6,
    backward = input.backward ?? 4;
  assert(
    Number.isInteger(outward) &&
      outward >= 1 &&
      outward <= 20 &&
      Number.isInteger(backward) &&
      backward >= 0 &&
      backward <= outward,
    'RESOURCE_LIMIT',
    '去程限1至20米，回程不超过去程'
  );
  return Object.freeze({
    contract: input.direction === undefined ? VISUAL_CONTRACT : SCIENCE_VISUAL_CONTRACT,
    template: input.template,
    outward,
    backward,
    ...(input.direction === undefined ? {} : { direction: input.direction }),
    duration: 6,
    steps: 24
  });
}
export function visualFrame(recipe, step) {
  assert(
    [
      VISUAL_CONTRACT,
      SCIENCE_VISUAL_CONTRACT,
      MOTION_VISUAL_CONTRACT,
      GRAPH_VISUAL_CONTRACT,
      ENERGY_VISUAL_CONTRACT
    ].includes(recipe?.contract),
    'INVALID_INPUT',
    '演示版本不受支持'
  );
  const canonical = visualRecipe(
    recipe.template === ENERGY_TEMPLATE
      ? energyInput(recipe)
      : recipe.template === VELOCITY_GRAPH_TEMPLATE
        ? velocityGraphInput(recipe)
        : MOTION_TEMPLATES.includes(recipe.template)
          ? motionInput(recipe)
          : recipe.template === 'constant_net_force'
            ? {
                template: recipe.template,
                massKg: recipe.massKg,
                netForceN: recipe.netForceN,
                direction: recipe.direction
              }
            : {
                template: recipe.template,
                outward: recipe.outward,
                backward: recipe.backward,
                ...(recipe.direction === undefined ? {} : { direction: recipe.direction })
              }
  );
  assert(canonical.contract === recipe.contract, 'INVALID_INPUT', '演示版本与参数不一致');
  assert(Number.isInteger(step) && step >= 0 && step <= canonical.steps, 'INVALID_INPUT', '演示步数超出范围');
  if (canonical.contract === ENERGY_VISUAL_CONTRACT) {
    const time = exact(canonical.physicalSeconds * step, canonical.steps),
      motion = motionAt(energyMotion(canonical), time),
      end = motionAt(energyMotion(canonical), exact(canonical.physicalSeconds)),
      result = energyAt(canonical, time),
      final = energyAt(canonical, exact(canonical.physicalSeconds));
    return {
      step,
      time: asNumber(time),
      position: asNumber(motion.position),
      displacement: asNumber(motion.position),
      distance: asNumber(motion.distance),
      speed: asNumber(motion.velocity),
      acceleration: asNumber(motion.acceleration),
      minimum: Math.min(0, ...end.extrema),
      maximum: Math.max(1, ...end.extrema),
      work: asNumber(result.work),
      initialKinetic: asNumber(result.initialKinetic),
      finalKinetic: asNumber(result.finalKinetic),
      kineticChange: asNumber(result.kineticChange),
      energyMaximum: Math.max(1, asNumber(final.initialKinetic), asNumber(final.finalKinetic)),
      exact: result,
      complete: step === canonical.steps
    };
  }
  if (canonical.contract === GRAPH_VISUAL_CONTRACT) {
    const time = mulExact(decimal(canonical.physicalSeconds, 0, 10), exact(step, canonical.steps)),
      result = velocityGraphAt(canonical, time);
    return {
      step,
      time: asNumber(time),
      position: asNumber(result.displacement),
      displacement: asNumber(result.displacement),
      distance: asNumber(result.distance),
      speed: asNumber(result.velocity),
      acceleration: asNumber(result.acceleration),
      phaseIndex: result.phaseIndex,
      areas: result.parts.map((part) => ({
        from: asNumber(part.from),
        to: asNumber(part.to),
        first: asNumber(part.first),
        last: asNumber(part.last),
        sign: part.sign
      })),
      exact: {
        distance: result.distance,
        displacement: result.displacement,
        velocity: result.velocity,
        positiveArea: result.positiveArea,
        negativeArea: result.negativeArea
      },
      complete: step === canonical.steps
    };
  }
  if (canonical.contract === MOTION_VISUAL_CONTRACT) {
    const time = exact(canonical.physicalSeconds * step, canonical.steps),
      result = motionAt(canonical, time),
      comparison = motionAt(canonical, time, 2),
      end = motionAt(canonical, exact(canonical.physicalSeconds)),
      heavyEnd = motionAt(canonical, exact(canonical.physicalSeconds), 2);
    const minimum = Math.min(0, ...end.extrema, ...heavyEnd.extrema),
      maximum = Math.max(1, ...end.extrema, ...heavyEnd.extrema);
    return {
      step,
      time: asNumber(time),
      position: asNumber(result.position),
      displacement: asNumber(result.position),
      distance: asNumber(result.distance),
      speed: asNumber(result.velocity),
      acceleration: asNumber(result.acceleration),
      comparisonPosition: asNumber(comparison.position),
      comparisonDistance: asNumber(comparison.distance),
      comparisonSpeed: asNumber(comparison.velocity),
      comparisonAcceleration: asNumber(comparison.acceleration),
      phaseIndex: result.phaseIndex,
      minimum,
      maximum,
      exact: { distance: result.distance, displacement: result.position, velocity: result.velocity },
      complete: step === canonical.steps
    };
  }
  if (canonical.template === 'constant_net_force') {
    const time = (canonical.physicalSeconds * step) / canonical.steps;
    const acceleration = ((canonical.direction === 'left' ? -1 : 1) * canonical.netForceN) / canonical.massKg;
    const position = (acceleration * time * time) / 2;
    return {
      step,
      time,
      acceleration,
      comparisonAcceleration: acceleration / 2,
      speed: acceleration * time,
      position,
      comparisonPosition: position / 2,
      distance: Math.abs(position),
      extent: Math.max(1, Math.abs(acceleration) * 2),
      complete: step === canonical.steps
    };
  }
  const travelled = ((canonical.outward + canonical.backward) * step) / canonical.steps;
  const position = travelled <= canonical.outward ? travelled : 2 * canonical.outward - travelled;
  return {
    step,
    position,
    distance: travelled,
    displacement: canonical.direction === 'left' ? -position : position,
    complete: step === canonical.steps
  };
}

// 固定 Manim 源码，仅插入已验证的整数。不执行模型给出的 Python。
export function manimVisualSource(input) {
  const recipe = visualRecipe(input);
  assert(
    recipe.template === 'distance_displacement' && recipe.direction !== 'left',
    'RENDERER_UNAVAILABLE',
    '当前离线视频适配只支持向右往返；新科学模板可逐步观察'
  );
  return `from manim import *\n\nclass YoziDistance(Scene):\n    def construct(self):\n        self.camera.background_color = "#282139"\n        title = Text("Distance and displacement", font_size=30).to_edge(UP)\n        start = LEFT * 4\n        turn = RIGHT * 4\n        finish = start + RIGHT * (8 * (${recipe.outward} - ${recipe.backward}) / ${recipe.outward})\n        axis = Line(start, turn, color=BLUE_B)\n        dot = Dot(start, color=PURPLE_B, radius=0.15)\n        trail = TracedPath(dot.get_center, stroke_color=PURPLE_B, stroke_width=5)\n        self.add(title, axis, dot, trail)\n        self.play(dot.animate.move_to(turn), run_time=${(6 * recipe.outward) / (recipe.outward + recipe.backward)}, rate_func=linear)\n        self.play(dot.animate.move_to(finish), run_time=${(6 * recipe.backward) / (recipe.outward + recipe.backward) || 0.01}, rate_func=linear)\n        caption = Text("distance: ${recipe.outward + recipe.backward} m | displacement: ${recipe.outward - recipe.backward} m", font_size=26).to_edge(DOWN)\n        self.add(caption)\n        self.wait(1)\n`;
}

export const WRITING_SOURCE = Object.freeze({
  title: 'Cambridge English B1 写作评价指南',
  url: 'https://www.cambridgeenglish.org/images/231794-cambridge-english-assessing-writing-performance-at-level-b1.pdf',
  status: '评价维度参考；练习为本项目原创，不是官方满分作文'
});
export const NOTICE_STEPS = Object.freeze([
  {
    id: 'purpose',
    label: '先让读者知道什么事',
    prompt: '学校周一要举行科学社团活动。先写一句说明活动。',
    scaffold: 'Our school will hold a …',
    words: ['school', 'hold', 'science', 'club'],
    needs: [/\b(?:science|club)\b/i],
    hint: '先交代活动，读者才能理解后面的时间和地点。'
  },
  {
    id: 'time',
    label: '把时间写清楚',
    prompt: '活动在周一下午4点。只写时间这一句。',
    scaffold: 'It will start at … on …',
    words: ['start', 'Monday', 'at', 'on'],
    needs: [/\bMonday\b/i, /(?:\b4\b|\bfour\b)/i],
    hint: '几点前用 at，星期前用 on。'
  },
  {
    id: 'place',
    label: '告诉读者去哪里',
    prompt: '地点在图书馆。写一句地点说明。',
    scaffold: 'It will take place in …',
    words: ['place', 'library', 'in'],
    needs: [/\blibrary\b/i],
    hint: '地点可以用 in the library；不用增加难词。'
  },
  {
    id: 'action',
    label: '给出明确的下一步',
    prompt: '请同学带笔记本。写一句参加要求。',
    scaffold: 'Please bring …',
    words: ['please', 'bring', 'notebook'],
    needs: [/\bbring\b/i, /\bnotebook\b/i],
    hint: '用 Please + 动词，让读者知道下一步做什么。'
  }
]);
export function noticeSentenceFeedback(stepId, raw) {
  const step = NOTICE_STEPS.find((item) => item.id === stepId);
  assert(step && typeof raw === 'string' && raw.length <= 240, 'INVALID_INPUT', '请选择当前写作步骤并保持一句话');
  const text = raw.trim();
  if (!text) return { ready: false, message: '先用你会的词写一句，可以保留不会的词。', kind: 'empty' };
  if (/[<>]/.test(text)) return { ready: false, message: '请写普通文本的一句话。', kind: 'format' };
  if (step.needs.some((pattern) => !pattern.test(text))) return { ready: false, message: step.prompt, kind: 'content' };
  if (/\bin\s+Monday\b/i.test(text) || /\bin\s+(?:4|four)\s*(?:p\.?m\.?|o'clock)/i.test(text))
    return { ready: false, message: '这句信息找到了。只改介词：on Monday、at 4 pm。', kind: 'preposition' };
  if (!/^[A-Z]/.test(text))
    return { ready: false, message: '信息找到了。把句首字母改成大写，再读一遍。', kind: 'capital' };
  if (!/[.!?]$/.test(text)) return { ready: false, message: '给这句话补一个句末标点。', kind: 'punctuation' };
  return {
    ready: true,
    message: '这句已有本步要点，表达仍需核对。',
    kind: 'draft'
  };
}

export function noticeTransferFeedback(raw) {
  assert(typeof raw === 'string' && raw.length <= 1000, 'INVALID_INPUT', '独立草稿限1000字符');
  const checks = [
    [/\b(?:reading|book)\b/i, '先让读者知道这是阅读社团活动。'],
    [/\bFriday\b/i, '请补齐星期五的时间信息。'],
    [/(?:\b3\b|\bthree\b)/i, '请补齐下午3点的具体时刻。'],
    [/\bclassroom\b/i, '请让读者知道地点在教室。'],
    [/\bbring\b[\s\S]*\bnotebook\b/i, '请给读者明确的行动：带笔记本。']
  ];
  const missing = checks.find(([pattern]) => !pattern.test(raw));
  if (missing) return { ready: false, message: missing[1] };
  return {
    ready: true,
    message: '新任务所需信息已找到。对照读者、语气、组织和语言再读一遍；这是草稿信息检查，尚未证明语法正确或独立掌握。'
  };
}

// 关系是「目标 → 知识点 → 原答」，不将同现关系冒充先修或因果。
export function learningEvidenceMap(state, { conversationId = null, now = Date.now() } = {}) {
  const attempts = state.attempts.filter((a) => !conversationId || a.conversationId === conversationId);
  const questions = new Map(state.questions.map((q) => [questionKey(q), q]));
  const nodes = new Map();
  for (const attempt of attempts) {
    const q = questions.get(attempt.questionKey);
    if (!q) continue;
    const scope = knowledgeScope(q);
    const node = nodes.get(scope) || {
      scope,
      label: q.vocabularyExercise ? scope : `${q.subject || '综合'} / ${q.knowledgePoint || q.prompt || '当前题目'}`,
      reliable: 0,
      pending: 0,
      helped: 0,
      correct: 0,
      evidence: []
    };
    const grade = effectiveGrade(attempt);
    if (grade.status === 'reliable') {
      node.reliable++;
      if (grade.outcome === 'correct') node.correct++;
    } else node.pending++;
    if (attempt.hints?.length) node.helped++;
    node.evidence.push({
      id: attempt.id,
      questionKey: attempt.questionKey,
      conversationId: attempt.conversationId,
      at: attempt.at,
      status: grade.status
    });
    nodes.set(scope, node);
  }
  const today = dayKey(now, state.timezone);
  const end = Date.parse(`${today}T12:00:00Z`);
  const heat = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(end - (13 - index) * 86400000).toISOString().slice(0, 10);
    const rows = attempts.filter((a) => questions.has(a.questionKey) && dayKey(a.at, state.timezone) === day);
    return {
      day,
      reliable: rows.filter((a) => effectiveGrade(a).status === 'reliable').length,
      pending: rows.filter((a) => effectiveGrade(a).status !== 'reliable').length
    };
  });
  return {
    nodes: [...nodes.values()].slice(-40),
    totalNodes: nodes.size,
    heat,
    timezone: state.timezone,
    relationship: 'record_membership',
    goal: state.conversations.find((c) => c.id === conversationId)?.goal || '已有学习记录'
  };
}
