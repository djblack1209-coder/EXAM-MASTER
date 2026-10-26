// Hand-authored motions for the existing Lucide registry; no external animation data.
const weights = {
  plus: [1.08, 0],
  chat: [1.03, 1],
  'book-open': [1.02, 2],
  folder: [1.04, 0],
  settings: [1.02, 2],
  chart: [1.04, 1],
  'arrow-right': [1, 0],
  download: [1.03, 1],
  users: [1.02, 0],
  menu: [1.02, 0],
  'log-out': [1.01, 1],
  refresh: [1.03, 0],
  mail: [1.01, 0],
  phone: [1.02, 0],
  eye: [1.02, 0],
  'eye-off': [1.02, 1],
  wechat: [1, 0],
  google: [1, 0],
  apple: [1, 0]
};
export function motionFor(name, collapsed = false) {
  const [scale, startFrame] = weights[name] || [1.04, 0];
  const peak = Math.min(1.12, collapsed ? scale + 0.04 : scale);
  return {
    duration: 520,
    startFrame,
    frames: [
      { transform: 'scale(1) rotate(0deg)' },
      { transform: `scale(${peak}) rotate(${collapsed ? 0 : name === 'settings' ? 22 : -5}deg)`, offset: 0.45 },
      { transform: 'scale(1) rotate(0deg)' }
    ]
  };
}
