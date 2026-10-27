// Live articulation follows the selected kitten-icon-master.png: round tilted
// face, large black eyes, pointed ears, white fur and tapered scan-line markings.
// The logo/assets stay untouched. Each gesture belongs to a business state.
const ease = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
function gesture(t, start, rise, hold, fall) {
  const a = t - start;
  if (a < 0 || a > rise + hold + fall) return 0;
  return a < rise ? ease(a / rise) : a < rise + hold ? 1 : 1 - ease((a - rise - hold) / fall);
}
export function kittenPoseAt(elapsed, state = 'idle', { reduced = false, age = elapsed } = {}) {
  const t = elapsed % 57100;
  const blink = [1700, 6400, 11900, 22400, 34100, 46200].reduce(
    (v, start) => Math.max(v, gesture(t, start, 130, 45, 260)),
    0
  );
  const ear = [2700, 14600, 38000].reduce((v, start) => Math.max(v, gesture(t, start, 110, 50, 250)), 0);
  const look = gesture(t, 8200, 650, 1600, 850) - gesture(t, 27800, 700, 1200, 900);
  const p = {
    head: 12,
    headY: 0,
    body: 1,
    earL: 0,
    earR: 0,
    tail: 0,
    tailTip: 0,
    pawL: 0,
    pawR: 0,
    pawTurnL: 0,
    pawTurnR: 0,
    blink,
    gazeX: 0,
    gazeY: 0,
    breath: 0
  };
  if (state === 'waiting')
    Object.assign(p, {
      head: 20,
      headY: 70 + gesture(t, 4800, 900, 900, 1500) * 12,
      body: 0.78,
      tail: 38,
      tailTip: look * 4,
      pawL: -5,
      pawR: -5,
      blink: 0.65 + blink * 0.35,
      gazeY: 7,
      earL: 10 + ear * 5,
      earR: -5
    });
  if (state === 'working')
    Object.assign(p, {
      head: 4 + look * 5,
      headY: -5,
      earL: -9,
      earR: 12 + ear * 12,
      tail: -12,
      pawL: 150,
      pawTurnL: 24,
      gazeX: -9,
      gazeY: -12,
      blink: blink * 0.55,
      tailTip: look * 7
    });
  if (state === 'making') {
    // Knead, settle, change paws: unequal timing and weight, with time to see
    // each press at 72px. No whole-image shake or constant-speed typing loop.
    const taps = [
      450, 1420, 2450, 3900, 5120, 6830, 8050, 9620, 11000, 12800, 14050, 15570, 17030, 18300, 20150, 21520, 23200,
      24750, 26400, 27980, 29700, 31110, 32850, 34020, 35770, 37140, 38700, 40520, 42000, 43570, 45300, 46750, 48520,
      49970, 51700, 52920, 54660, 55900
    ];
    const press = (start, i) =>
      gesture(t, start, 280 + (i % 3) * 55, 160 + (i % 2) * 80, 380) * (0.85 + (i % 3) * 0.08);
    const left = taps.reduce((v, start, i) => (i % 2 === 0 ? Math.max(v, press(start, i)) : v), 0);
    const right = taps.reduce((v, start, i) => (i % 2 ? Math.max(v, press(start, i)) : v), 0);
    Object.assign(p, {
      head: 7,
      headY: 24 + Math.max(left, right) * 8,
      body: 0.94,
      earL: -8,
      earR: 6,
      tail: -20,
      tailTip: ear * 9,
      pawL: 25 + left * 110,
      pawR: 28 + right * 105,
      pawTurnL: -8 + left * 9,
      pawTurnR: 8 - right * 9,
      gazeY: 15,
      blink: blink * 0.65
    });
  }
  if (state === 'celebrate') {
    const stretch = gesture(age, 70, 370, 450, 650);
    Object.assign(p, {
      head: 5,
      headY: -20 - stretch * 35,
      body: 1.04,
      earL: -12,
      earR: 12,
      tail: -30,
      tailTip: -8,
      pawL: 45 + stretch * 140,
      pawR: 45 + stretch * 140,
      pawTurnL: -stretch * 24,
      pawTurnR: stretch * 24,
      blink: Math.max(0.6, stretch)
    });
  }
  if (state === 'error')
    Object.assign(p, {
      head: -7,
      headY: 35,
      body: 0.92,
      earL: 40,
      earR: -38,
      tail: 65,
      pawL: 58,
      pawTurnL: 12,
      gazeX: 10,
      gazeY: 5,
      blink: blink * 0.6
    });
  if (state === 'resume') {
    const wake = gesture(age, 30, 260, 250, 480);
    Object.assign(p, {
      head: 12 - wake * 10,
      earL: -wake * 15,
      earR: wake * 15,
      tail: -18,
      pawR: wake * 115,
      pawTurnR: wake * 22,
      blink: age < 350 ? 1 - ease(age / 350) : blink * 0.5
    });
  }
  if (state === 'idle') Object.assign(p, { head: 12 + look * 2, earL: ear * 15, tailTip: look * 5 });
  if (!reduced) p.breath = Math.sin((elapsed / 5100) * Math.PI * 2) * 0.006;
  else {
    p.blink = state === 'waiting' ? 0.85 : state === 'celebrate' ? 0.72 : 0;
    p.head = { idle: 12, working: 4, making: 7, waiting: 20, celebrate: 5, error: -7, resume: 2 }[state] ?? 12;
    p.earL = state === 'error' ? 40 : state === 'working' ? -9 : 0;
    p.tailTip = 0;
    p.breath = 0;
  }
  return p;
}
function path(ctx, commands, { fill = '#fff', stroke = '#101113', width = 10 } = {}) {
  ctx.beginPath();
  for (const [op, ...args] of commands) ctx[op](...args);
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
const M = (...a) => ['moveTo', ...a],
  L = (...a) => ['lineTo', ...a],
  C = (...a) => ['bezierCurveTo', ...a],
  Q = (...a) => ['quadraticCurveTo', ...a],
  Z = () => ['closePath'];
function stripe(ctx, x, y, width, direction = 1) {
  path(
    ctx,
    [
      M(x, y),
      Q(x + direction * width, y - 4, x + direction * width, y),
      Q(x + direction * width, y + 4, x, y + 6),
      Z()
    ],
    { fill: '#101113', stroke: null }
  );
}
function paw(ctx, x, y, lift, turn) {
  ctx.save();
  ctx.translate(x, y - lift);
  ctx.rotate((turn * Math.PI) / 180);
  path(ctx, [M(-36, -95), C(-48, -42, -62, 15, -48, 45), C(-41, 69, 22, 75, 45, 51), C(64, 23, 41, -38, 30, -94)]);
  path(ctx, [M(-24, 36), Q(-12, 52, -20, 64), M(4, 38), Q(17, 53, 8, 67)], { fill: null, width: 7 });
  ctx.restore();
}
function ear(ctx, side, angle) {
  ctx.save();
  ctx.translate(side * 220, -203);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(side, 1);
  path(ctx, [M(-64, 40), Q(-99, -82, -27, -181), Q(34, -162, 112, 13), Z()]);
  path(ctx, [M(-34, -8), Q(-55, -70, -25, -126), Q(14, -108, 54, -28), Z()], { fill: '#101113', stroke: null });
  ctx.restore();
}
function eye(ctx, x, y, blink, gazeX, gazeY) {
  ctx.save();
  ctx.translate(x, y);
  if (blink > 0.92) path(ctx, [M(-48, 1), Q(0, 34, 48, 1)], { fill: null, width: 10 });
  else {
    ctx.scale(1, 1 - Math.min(0.88, blink) * 0.88);
    ctx.fillStyle = '#08090a';
    ctx.beginPath();
    ctx.ellipse(gazeX, gazeY, 55, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(gazeX - 13, gazeY - 30, 16, 21, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gazeX + 9, gazeY - 5, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
export function paintKittenRig(ctx, width, height, pose) {
  const p = pose;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(width / 1000, height / 1000);
  // Tail moves behind the haunch: a low dropped tail, a wrapped loaf and an
  // upright focused tail have distinct silhouettes even without motion.
  ctx.save();
  ctx.translate(630, 820);
  ctx.rotate(((p.tail + p.tailTip) * Math.PI) / 180);
  ctx.translate(-630, -820);
  path(ctx, [
    M(610, 860),
    C(810, 915, 863, 784, 837, 671),
    C(822, 607, 751, 626, 752, 693),
    C(758, 777, 720, 809, 615, 807),
    Z()
  ]);
  ctx.clip();
  for (let i = 0; i < 7; i++) stripe(ctx, 839 - i * 2, 677 + i * 23, 45 + (i % 3) * 7, -1);
  ctx.restore();
  ctx.save();
  ctx.translate(490, 898);
  ctx.scale(1, p.body + p.breath);
  ctx.translate(-490, -898);
  path(ctx, [
    M(371, 621),
    C(310, 677, 294, 775, 330, 863),
    C(350, 928, 600, 943, 654, 870),
    C(689, 807, 665, 698, 601, 636),
    Z()
  ]);
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    stripe(ctx, 337 - i * 3, 705 + i * 27, 90 - i * 9);
    stripe(ctx, 662 + i * 2, 726 + i * 26, 70 - i * 9, -1);
  }
  ctx.restore();
  paw(ctx, 421, 865, p.pawL, p.pawTurnL);
  paw(ctx, 550, 865, p.pawR, p.pawTurnR);
  ctx.save();
  ctx.translate(480, 443 + p.headY);
  ctx.rotate((p.head * Math.PI) / 180);
  ear(ctx, -1, p.earL);
  ear(ctx, 1, p.earR);
  const head = [
    M(-300, -132),
    C(-232, -239, -91, -260, 25, -242),
    C(160, -250, 278, -191, 318, -100),
    L(333, -67),
    L(322, -71),
    C(354, 2, 351, 106, 305, 163),
    L(309, 135),
    C(266, 215, 138, 251, 5, 247),
    C(-136, 261, -277, 214, -316, 131),
    L(-331, 106),
    L(-321, 111),
    C(-366, 31, -356, -38, -323, -88),
    L(-337, -74),
    Q(-338, -108, -300, -132),
    Z()
  ];
  path(ctx, head);
  ctx.save();
  ctx.clip();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    stripe(ctx, -350, -29 + i * 24, 74 + (i % 3) * 19);
    stripe(ctx, 348, 27 + i * 23, 82 - (i % 2) * 19, -1);
  }
  for (let i = 0; i < 5; i++) stripe(ctx, -270 + i * 11, -188 + i * 19, 61 - i * 5);
  ctx.restore();
  eye(ctx, -150, -4, p.blink, p.gazeX, p.gazeY);
  eye(ctx, 151, 2, p.blink, p.gazeX, p.gazeY);
  path(ctx, [M(-17, 84), Q(0, 76, 17, 84), Q(12, 97, 0, 104), Q(-13, 97, -17, 84), Z()], {
    fill: '#101113',
    stroke: null
  });
  path(ctx, [M(0, 103), Q(0, 145, -36, 131), M(0, 103), Q(0, 145, 37, 131)], { fill: null, width: 7 });
  ctx.restore();
  ctx.restore();
}
