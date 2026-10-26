import { AVATAR_FADE, AVATAR_MIN_STAY, AVATAR_STATES } from './avatar-state.js';

// A single controller owns both layers, the latest target, and the shared media clock.
export function createAvatarPlayer({
  initial,
  load,
  now = Date.now,
  timer = setTimeout,
  cancel = clearTimeout,
  frame = (fn) => timer(fn, 16),
  dispose = (layer) => layer?.dispose?.()
}) {
  const listeners = new Set();
  let current = { ...initial, state: 'idle', enteredAt: now() },
    next = null;
  let desired = 'idle',
    resting = 'idle',
    activated = false,
    fading = false,
    loading = false;
  let visible = true,
    focused = true,
    reduced = false,
    destroyed = false,
    generation = 0;
  let dwellTimer = null,
    fadeTimer = null,
    stillTimer = null,
    completionKey = null;
  const consumed = new Set();
  const snapshot = () => ({ current, next, fading, visible, focused, reduced, activated });
  const notify = () => {
    for (const fn of listeners) fn(snapshot());
  };
  const playing = () => visible && focused && !reduced && activated;
  function reconcileMedia() {
    for (const layer of [current, next]) {
      if (!layer?.video) continue;
      if (playing() && !layer.video.ended)
        layer.video.play()?.catch?.((error) => {
          // A later pause (hidden or switching) aborts this play() but leaves the clip usable.
          if (error?.name !== 'AbortError') layer.video?.avatarFailed?.(error);
        });
      else layer.video.pause();
    }
  }
  function clearDwell() {
    if (dwellTimer !== null) cancel(dwellTimer);
    dwellTimer = null;
  }
  function staticOneShot() {
    if (stillTimer !== null) cancel(stillTimer);
    stillTimer = null;
    if (current.video || !['celebrate', 'resume'].includes(current.state)) return;
    const layer = current;
    stillTimer = timer(
      () => {
        stillTimer = null;
        ended(layer);
      },
      Math.max(0, AVATAR_MIN_STAY - (now() - current.enteredAt))
    );
  }
  function atRest() {
    return desired === current.state && (!playing() || current.video || !current.canAnimate);
  }
  async function schedule() {
    clearDwell();
    if (destroyed || next || loading || atRest()) return;
    // A poster becoming the same animated pose is not a business state change.
    const remaining = desired === current.state ? 0 : AVATAR_MIN_STAY - (now() - current.enteredAt);
    if (remaining > 0) {
      dwellTimer = timer(schedule, remaining);
      return;
    }
    const state = desired,
      token = ++generation;
    loading = true;
    let layer;
    try {
      layer = await load(state, { video: playing() && state !== 'waiting' });
    } catch {
      if (token === generation) {
        loading = false;
        if (state !== desired) schedule();
      }
      return;
    }
    if (destroyed || token !== generation || state !== desired) {
      dispose(layer);
      if (token === generation) {
        loading = false;
        schedule();
      }
      return;
    }
    loading = false;
    next = { ...layer, state, enteredAt: 0 };
    fading = false;
    reconcileMedia();
    notify();
    frame(() =>
      frame(() => {
        if (destroyed || token !== generation || !next) return;
        fading = true;
        notify();
        fadeTimer = timer(
          () => {
            fadeTimer = null;
            const previous = current;
            current = { ...next, enteredAt: now() };
            next = null;
            fading = false;
            dispose(previous);
            reconcileMedia();
            staticOneShot();
            notify();
            schedule();
          },
          reduced ? 0 : AVATAR_FADE
        );
      })
    );
  }
  function request(state, { activate = false, key = null, base = 'idle' } = {}) {
    if (destroyed || !AVATAR_STATES.includes(state)) return;
    activated ||= activate || ['working', 'making', 'celebrate', 'resume'].includes(state);
    resting = ['celebrate', 'resume'].includes(base) ? 'idle' : base;
    if (['celebrate', 'resume'].includes(state)) {
      const identity = key || state;
      if (!visible || consumed.has(identity)) state = resting;
      else completionKey = identity;
    }
    desired = state;
    schedule();
    reconcileMedia();
    notify();
  }
  function ended(layer) {
    if (destroyed || ![current, next].some((item) => item?.id === layer.id)) return;
    if (['celebrate', 'resume'].includes(layer.state)) {
      consumed.add(completionKey || layer.state);
      desired = resting;
      schedule();
    }
  }
  function failed(layer) {
    if (destroyed) return;
    if (current.id === layer.id) {
      dispose(current);
      current = {
        ...current,
        fallbackReason: layer.fallbackReason,
        video: null,
        canAnimate: false,
        dispose: undefined
      };
      staticOneShot();
    }
    if (next?.id === layer.id) {
      dispose(next);
      next = { ...next, fallbackReason: layer.fallbackReason, video: null, canAnimate: false, dispose: undefined };
    }
    reconcileMedia();
    notify();
  }
  function gate(values) {
    const wasVisible = visible;
    visible = values.visible ?? visible;
    focused = values.focused ?? focused;
    reduced = values.reduced ?? reduced;
    if (!visible && (['celebrate', 'resume'].includes(desired) || ['celebrate', 'resume'].includes(current.state))) {
      consumed.add(completionKey || desired);
      desired = resting;
      generation++;
      loading = false;
      clearDwell();
      if (fadeTimer !== null) cancel(fadeTimer);
      if (stillTimer !== null) cancel(stillTimer);
      stillTimer = null;
      fadeTimer = null;
      dispose(next);
      next = null;
      fading = false;
      // Hidden one-shots are consumed. Returning never replays them.
      if (['celebrate', 'resume'].includes(current.state)) {
        dispose(current);
        current = { ...initial, state: 'idle', enteredAt: now(), video: null, dispose: undefined };
      }
    }
    reconcileMedia();
    notify();
    if (visible && focused && (!wasVisible || !reduced)) schedule();
  }
  return {
    request,
    activate() {
      if (destroyed || activated) return;
      activated = true;
      schedule();
      reconcileMedia();
      notify();
    },
    gate,
    ended,
    failed,
    snapshot,
    subscribe(fn) {
      listeners.add(fn);
      fn(snapshot());
      return () => listeners.delete(fn);
    },
    destroy() {
      destroyed = true;
      generation++;
      clearDwell();
      if (fadeTimer !== null) cancel(fadeTimer);
      if (stillTimer !== null) cancel(stillTimer);
      dispose(current);
      dispose(next);
      listeners.clear();
    }
  };
}
