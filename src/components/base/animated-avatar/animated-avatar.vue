<template>
  <view
    ref="root"
    class="animated-avatar"
    :class="[
      `avatar-state-${displayState}`,
      {
        'is-motion-enabled': motionEnabled,
        'is-perceptible': perceptible,
        'is-motion-paused': motionPaused,
        'is-motion-reduced': state?.reduced
      }
    ]"
    :data-avatar-state="state?.current?.state || avatarStateFor(business || {})"
    :data-avatar-media="mediaStatus"
    :data-avatar-renderer="perceptible ? 'kitten-rig' : 'media'"
    :data-avatar-fallback="fallbackReason || undefined"
    :title="fallbackReason || undefined"
    :style="{ width: size + 'px', height: size + 'px' }"
    aria-hidden="true"
    @mouseenter="activate"
    @pointerenter="activate"
  >
    <view ref="body" class="animated-avatar__body" :class="{ 'is-procedural': !nativeMotion && perceptible }">
      <image
        v-if="!painted"
        class="animated-avatar__fallback"
        :src="fallback"
        mode="aspectFit"
        alt=""
        @error="fallback = AVATAR_STATIC"
      />
      <!-- #ifdef H5 -->
      <component
        :is="'canvas'"
        ref="currentCanvas"
        class="animated-avatar__layer"
        :class="{ 'is-leaving': state?.fading, 'is-static': state?.reduced }"
        :width="canvasSize"
        :height="canvasSize"
      />
      <component
        :is="'canvas'"
        v-if="state?.next"
        ref="nextCanvas"
        class="animated-avatar__layer animated-avatar__next"
        :class="{ 'is-visible': state.fading, 'is-static': state.reduced }"
        :width="canvasSize"
        :height="canvasSize"
      />
      <!-- #endif -->
    </view>
  </view>
</template>
<script setup>
import { computed, onMounted, onBeforeUnmount, shallowRef, ref, watch, nextTick } from 'vue';
import { AVATAR_MEDIA, AVATAR_STATIC, avatarStateFor } from '@/design/avatar-state.js';
// #ifdef H5
import { acquireAvatar } from '@/design/avatar-runtime.js';
// #endif
const props = defineProps({
  identity: { type: String, default: 'yozi' },
  size: { type: Number, default: 56 },
  autoplay: { type: Boolean, default: false },
  perceptible: { type: Boolean, default: false },
  business: { type: Object, default: null }
});
const emit = defineEmits(['state']);
const root = ref(null),
  body = ref(null),
  currentCanvas = ref(null),
  nextCanvas = ref(null),
  state = shallowRef(null);
let nativeMotion = false;
// #ifndef H5
nativeMotion = true;
// #endif
const fallback = ref(AVATAR_STATIC);
const painted = ref(false);
const mediaStatus = ref(nativeMotion ? 'fallback' : 'loading');
const displayState = computed(() => state.value?.current?.state || avatarStateFor(props.business || {}));
const motionEnabled = computed(() => nativeMotion || (props.perceptible && (props.autoplay || state.value?.activated)));
const motionPaused = computed(() => !nativeMotion && (!state.value?.visible || !state.value?.focused));
const fallbackReason = computed(() =>
  state.value?.reduced ? 'reduce-motion' : state.value?.current?.fallbackReason || (nativeMotion ? 'native-poster' : '')
);
const canvasSize = computed(() => Math.min(384, Math.max(96, props.size * 2)));
// #ifdef H5
fallback.value = AVATAR_MEDIA.idle.poster;
// #endif
let runtime, unsubscribe, releaseView, focusElement, pointerElement, observer;
let visible = true;
const node = (ref) => ref.value?.$el || ref.value;
function activate() {
  runtime?.activate();
}
watch(
  () => props.business,
  (value) => {
    if (value) runtime?.business(value);
  },
  { deep: true }
);
watch(
  () => props.autoplay,
  (value) => {
    if (value) activate();
  }
);
onMounted(() => {
  // #ifdef H5
  runtime = acquireAvatar(props.identity);
  unsubscribe = runtime.player.subscribe((value) => {
    state.value = value;
    emit('state', { state: value.current.state, focused: value.focused, visible: value.visible });
    nextTick(() => runtime?.paint());
  });
  releaseView = runtime.addView({
    current: () => node(currentCanvas),
    next: () => node(nextCanvas),
    visible: () => visible,
    perceptible: () => props.perceptible,
    pose: (transform) => {
      const element = node(body);
      if (element) element.style.transform = transform;
    },
    painted: (media) => {
      painted.value = true;
      mediaStatus.value = media;
    }
  });
  if (props.business) runtime.business(props.business);
  if (props.autoplay) activate();
  focusElement = node(root)?.closest?.('button, [role="button"], a');
  focusElement?.addEventListener('focusin', activate);
  pointerElement = node(root);
  pointerElement?.addEventListener('pointerenter', activate);
  pointerElement?.addEventListener('mouseenter', activate);
  if (typeof IntersectionObserver !== 'undefined' && pointerElement) {
    observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      runtime?.paint();
    });
    observer.observe(pointerElement);
  }
  // #endif
});
onBeforeUnmount(() => {
  focusElement?.removeEventListener('focusin', activate);
  pointerElement?.removeEventListener('pointerenter', activate);
  pointerElement?.removeEventListener('mouseenter', activate);
  observer?.disconnect();
  unsubscribe?.();
  releaseView?.();
  runtime?.release();
  runtime = null;
});
</script>
<style scoped>
.animated-avatar {
  position: relative;
  display: inline-block;
  flex: none;
  isolation: isolate;
  background: transparent;
}
.animated-avatar__body,
.animated-avatar__fallback,
.animated-avatar__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.animated-avatar__fallback {
  z-index: -1;
}
.animated-avatar__layer.is-leaving {
  opacity: 0;
  transition: opacity 500ms ease-in-out;
}
.animated-avatar__next {
  opacity: 0;
  transition: opacity 500ms ease-in-out;
}
.animated-avatar__next.is-visible {
  opacity: 1;
}
.animated-avatar__layer.is-static {
  transition: none;
}
.animated-avatar__body {
  transform-origin: 50% 75%;
}
.animated-avatar.is-motion-enabled.is-perceptible .animated-avatar__body {
  animation: none;
  transform: none;
}
.is-motion-enabled.avatar-state-idle .animated-avatar__body {
  animation: kitten-breathe 4s ease-in-out infinite;
}
.is-motion-enabled.is-perceptible.avatar-state-idle .animated-avatar__body {
  animation: kitten-idle 31s ease-in-out infinite;
}
.is-motion-enabled.avatar-state-working .animated-avatar__body {
  animation: kitten-think 2.2s ease-in-out infinite;
}
.is-motion-enabled.avatar-state-making .animated-avatar__body {
  animation: kitten-make 1.6s ease-in-out infinite;
}
.avatar-state-waiting .animated-avatar__body {
  animation: none;
}
.is-motion-enabled.avatar-state-celebrate .animated-avatar__body {
  animation: kitten-celebrate 900ms ease-out 1;
}
.is-motion-enabled.avatar-state-resume .animated-avatar__body {
  animation: kitten-resume 800ms ease-in-out 1;
}
@keyframes kitten-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-1px) scale(1.025);
  }
}
@keyframes kitten-idle {
  0%,
  2%,
  15%,
  34%,
  46%,
  74%,
  87%,
  100% {
    transform: none;
  }
  6%,
  10% {
    transform: rotate(-2.8deg);
  }
  38%,
  41% {
    transform: rotate(1.8deg);
  }
  78%,
  81% {
    transform: rotate(-2.1deg);
  }
}
@keyframes kitten-think {
  0%,
  100% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(4deg) translateY(-1px);
  }
}
@keyframes kitten-make {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-2px) rotate(-3deg);
  }
  70% {
    transform: translateY(1px) rotate(2deg);
  }
}
@keyframes kitten-celebrate {
  0%,
  100% {
    transform: none;
  }
  25% {
    transform: translateY(-5px) rotate(-6deg) scale(1.06);
  }
  50% {
    transform: translateY(0) rotate(5deg);
  }
  75% {
    transform: translateY(-2px) rotate(-2deg);
  }
}
@keyframes kitten-resume {
  0%,
  100% {
    transform: none;
  }
  30% {
    transform: rotate(-8deg) scale(1.04);
  }
  65% {
    transform: rotate(6deg);
  }
}
.animated-avatar.is-motion-paused .animated-avatar__body {
  animation-play-state: paused !important;
}
/* H5 / Tauri use the one shared foreground clock for pose and eyelids.
   Keep one-shot completion / resume feedback on its existing CSS path. */
.is-motion-enabled.is-perceptible:is(.avatar-state-idle, .avatar-state-working, .avatar-state-making)
  .animated-avatar__body.is-procedural {
  animation: none;
}
.is-motion-reduced .animated-avatar__body {
  animation: none !important;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .animated-avatar__body {
    animation: none !important;
  }
  .animated-avatar__layer {
    transition: none;
  }
}
</style>
