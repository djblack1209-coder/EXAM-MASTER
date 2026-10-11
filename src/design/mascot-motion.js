import { ref, readonly } from 'vue';

const preference = ref(false);
export const mascotReducedMotion = readonly(preference);
export const MASCOT_MOTION_KEY = 'yozi_reduce_motion';
const entries = new Map();
const focusedInputs = new Set();
let serial = 0;
let systemReduced = false;
let appVisible = true;
let inputFocused = false;
let dispose = null;

export function setMascotReducedMotion(value, { persist = true } = {}) {
  if (persist) {
    try {
      uni.setStorageSync(MASCOT_MOTION_KEY, Boolean(value));
    } catch {
      return false;
    }
  }
  preference.value = Boolean(value);
  reconcile();
  return true;
}
export function setMascotInputFocused(id, focused) {
  if (focused) focusedInputs.add(id);
  else focusedInputs.delete(id);
  reconcile();
}
function reconcile() {
  const eligible = [...entries.values()].filter(
    (entry) =>
      entry.eligible &&
      appVisible &&
      !systemReduced &&
      !preference.value &&
      !(entry.loop && (inputFocused || focusedInputs.size))
  );
  const winner = eligible.sort((a, b) => b.order - a.order)[0];
  for (const entry of entries.values()) entry.apply(entry === winner);
}
function attach() {
  try {
    preference.value = uni.getStorageSync(MASCOT_MOTION_KEY) === true;
  } catch {
    /* default */
  }
  const releases = [];
  // #ifdef H5
  if (typeof document !== 'undefined') {
    const visibility = () => {
      appVisible = !document.hidden;
      reconcile();
    };
    const focus = () => {
      const active = document.activeElement;
      inputFocused = Boolean(
        active?.matches?.('input, textarea, uni-input, uni-textarea') || active?.closest?.('[data-yozi-answer-input]')
      );
      reconcile();
    };
    const blur = () => queueMicrotask(focus);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    visibility();
    focus();
    releases.push(() => {
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
    });
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      systemReduced = media.matches;
      reconcile();
    };
    media.addEventListener?.('change', apply);
    if (!media.addEventListener) media.addListener?.(apply);
    apply();
    releases.push(() => {
      media.removeEventListener?.('change', apply);
      if (!media.removeEventListener) media.removeListener?.(apply);
    });
  }
  // #endif
  const api = typeof uni === 'undefined' ? null : uni;
  const hide = () => {
    appVisible = false;
    reconcile();
  };
  const show = () => {
    appVisible = true;
    reconcile();
  };
  api?.onAppHide?.(hide);
  api?.onAppShow?.(show);
  releases.push(() => {
    api?.offAppHide?.(hide);
    api?.offAppShow?.(show);
  });
  return () => releases.forEach((release) => release());
}
// Registration order, not render order, decides the winner. Hidden instances relinquish it.
export function registerMascot(apply) {
  const id = ++serial;
  entries.set(id, { order: id, eligible: false, loop: false, apply });
  if (entries.size === 1) dispose = attach();
  return {
    update(eligible, loop) {
      const entry = entries.get(id);
      if (!entry) return;
      Object.assign(entry, { eligible, loop });
      reconcile();
    },
    release() {
      entries.delete(id);
      reconcile();
      if (!entries.size) {
        dispose?.();
        dispose = null;
        systemReduced = false;
        appVisible = true;
        inputFocused = false;
        focusedInputs.clear();
      }
    }
  };
}
