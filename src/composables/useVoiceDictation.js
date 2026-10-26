import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { voiceCapability, startVoice, stopVoice, cancelVoice } from '@/services/desktop/voice.js';
import { readSessionSnapshot } from '@/services/auth-storage.js';
import { DEV_TEST } from '@/config/build-channel.js';

// Composer-local preview only. No partial transcript enters a draft or learning record.
export function useVoiceDictation(props, emit, getPosition) {
  const phase = ref('idle');
  const transcript = ref('');
  const error = ref('');
  const elapsed = ref(0);
  const capability = ref({ supported: false, available: false });
  const active = computed(() => phase.value !== 'idle');
  let epoch = 0,
    session = null,
    clock,
    finalTimeout;
  function context() {
    try {
      if (!DEV_TEST || !props.voiceLocale) return '';
      if (readSessionSnapshot().status === 'unavailable') return '';
      return props.getVoiceContext?.() || '';
    } catch {
      return '';
    }
  }
  function timers() {
    clearInterval(clock);
    clearTimeout(finalTimeout);
    clock = finalTimeout = undefined;
  }
  function current(value) {
    return value === session && value.epoch === epoch && value.context === context() && Boolean(value.context);
  }
  function close(keep = false, reason = '') {
    const value = session;
    try {
      if (keep && value && current(value) && !value.committed && value.text.trim()) {
        value.committed = true;
        const draft = props.modelValue;
        const position = draft === value.base ? value.position : draft.length;
        const left = draft.slice(0, position),
          right = draft.slice(position);
        const before = /[a-z0-9]$/i.test(left) && /^[a-z0-9]/i.test(value.text) ? ' ' : '';
        const after = /[a-z0-9]$/i.test(value.text) && /^[a-z0-9]/i.test(right) ? ' ' : '';
        emit('update:modelValue', left + before + value.text + after + right);
      }
    } finally {
      epoch++;
      session = null;
      phase.value = 'idle';
      transcript.value = '';
      error.value = reason;
      timers();
      if (value?.sid) void cancelVoice(value.sid).catch(() => undefined);
    }
  }
  async function refreshCapability() {
    const binding = context(),
      locale = props.voiceLocale;
    close();
    capability.value = { supported: false, available: false };
    if (!binding || !locale) return;
    try {
      const result = await voiceCapability(locale);
      if (binding === context() && locale === props.voiceLocale) capability.value = result;
    } catch {
      /* Unsupported native hosts retain the existing text input. */
    }
  }
  async function start() {
    if (active.value || props.disabled || !capability.value.available || !context()) return;
    const base = props.modelValue;
    const requested = getPosition?.();
    const value = {
      epoch: ++epoch,
      context: context(),
      base,
      position: Number.isSafeInteger(requested) ? Math.min(base.length, Math.max(0, requested)) : base.length,
      sid: null,
      seq: 0,
      text: '',
      committed: false
    };
    session = value;
    error.value = '';
    elapsed.value = 0;
    transcript.value = '';
    phase.value = 'starting';
    const onEvent = (event) => {
      if (session === value && !current(value)) {
        close();
        return;
      }
      if (
        !current(value) ||
        !event ||
        typeof event.sid !== 'string' ||
        !Number.isSafeInteger(event.seq) ||
        event.seq <= value.seq ||
        typeof event.text !== 'string' ||
        event.text.length > 10000 ||
        !['partial', 'final', 'ended', 'error'].includes(event.kind)
      )
        return;
      if (!value.sid) value.sid = event.sid;
      if (value.sid !== event.sid) return;
      value.seq = event.seq;
      value.text = event.text;
      transcript.value = event.text;
      if (event.reason === 'recording_started' && !clock) {
        const began = Date.now();
        clock = setInterval(() => {
          if (!current(value)) {
            if (session === value) close();
            return;
          }
          elapsed.value = Math.floor((Date.now() - began) / 1000);
        }, 250);
      }
      if (phase.value === 'starting') phase.value = 'listening';
      if (event.kind === 'ended') close(true);
      else if (event.kind === 'error')
        close(true, typeof event.reason === 'string' ? event.reason : 'recognition_failed');
    };
    try {
      const sid = await startVoice(props.voiceLocale, onEvent, () => {
        if (!current(value)) throw new Error('听写上下文已变化');
      });
      if (!current(value)) {
        if (session === value) close();
        void cancelVoice(sid).catch(() => undefined);
        return;
      }
      if (value.sid && value.sid !== sid) {
        close(false, 'session_changed');
        return;
      }
      value.sid = sid;
      if (phase.value === 'finishing')
        void stopVoice(sid).catch(() => {
          if (current(value)) close(true, 'finish_failed');
        });
    } catch {
      if (current(value)) close(true, 'start_failed');
    }
  }
  function stop() {
    if (!active.value || phase.value === 'finishing') return;
    phase.value = 'finishing';
    const value = session;
    finalTimeout = setTimeout(() => {
      if (current(value)) close(true, 'finish_timeout');
    }, 3000);
    if (value.sid)
      void stopVoice(value.sid).catch(() => {
        if (current(value)) close(true, 'finish_failed');
      });
  }
  watch(() => [context(), props.voiceLocale], refreshCapability, { immediate: true, flush: 'sync' });
  watch(
    () => props.disabled,
    (disabled) => {
      if (disabled) close();
    },
    { flush: 'sync' }
  );
  onBeforeUnmount(() => close());
  return reactive({ phase, active, transcript, error, elapsed, capability, start, stop, cancel: () => close() });
}
