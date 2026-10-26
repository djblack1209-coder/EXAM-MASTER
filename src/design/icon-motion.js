import { bindBusinessMotion } from './business-motion.js';

const played = new Set();
export function createOnceIconPlayer({
  key,
  element,
  load = () => import('./icon-motion-frames.js'),
  reduced = () => false,
  collapsed = () => false,
  registry = played
}) {
  let disposed = false,
    animation;
  async function trigger() {
    if (disposed || reduced() || registry.has(key)) return;
    registry.add(key); // Claim before loading, so repeated hover never queues or overlaps.
    try {
      const module = await load();
      if (disposed || reduced()) return;
      const spec = module.motionFor(key, collapsed());
      animation = element.animate(spec.frames, {
        duration: spec.duration,
        easing: 'ease-in-out',
        iterations: 1,
        fill: 'none'
      });
      animation.currentTime = spec.startFrame * (1000 / 60);
      await animation.finished;
    } catch {
      /* Static registry SVG is always present. */
    } finally {
      animation?.cancel();
      animation = null;
    }
  }
  return {
    trigger,
    dispose() {
      disposed = true;
      animation?.cancel();
    },
    stop() {
      animation?.cancel();
    }
  };
}
export function bindIconMotion(element, key) {
  if (!element?.animate) return () => undefined;
  let reduced = true;
  const player = createOnceIconPlayer({
    key,
    element,
    reduced: () => reduced,
    collapsed: () => Boolean(element.closest('.sidebar-collapsed'))
  });
  const target = element.closest('button, [role="button"], a') || element;
  target.addEventListener('pointerenter', player.trigger);
  target.addEventListener('mouseenter', player.trigger);
  target.addEventListener('focusin', player.trigger);
  const releaseMotion = bindBusinessMotion((value) => {
    reduced = value;
    if (reduced) player.stop();
  });
  return () => {
    player.dispose();
    target.removeEventListener('pointerenter', player.trigger);
    target.removeEventListener('mouseenter', player.trigger);
    target.removeEventListener('focusin', player.trigger);
    releaseMotion();
  };
}
