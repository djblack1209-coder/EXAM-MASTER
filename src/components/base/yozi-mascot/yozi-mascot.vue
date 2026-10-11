<template>
  <view
    ref="root"
    class="yozi-mascot"
    :class="[`yozi-mascot--${sizeName}`, `yozi-mascot-instance-${id}`]"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : alt || t(`mascot.${displayPose}`)"
    :data-pose="displayPose"
    :data-moving="moving"
    :data-paused="!running"
    :style="sizeStyle"
  >
    <view
      class="yozi-mascot__motion"
      :class="[`mx--${displayPose}`, { 'is-animated': animated }]"
      :style="{
        animationPlayState: running ? 'running' : 'paused',
        animationIterationCount: looping ? 'infinite' : '1'
      }"
      @animationend="finish($event, 'motion')"
    >
      <image class="yozi-mascot__frame" :src="source" mode="aspectFit" alt="" aria-hidden="true" />
      <image
        v-if="alternate"
        class="yozi-mascot__frame yozi-mascot__alt"
        :src="alternate"
        mode="aspectFit"
        alt=""
        aria-hidden="true"
        :style="{
          animationPlayState: running ? 'running' : 'paused',
          animationIterationCount: looping ? 'infinite' : '1'
        }"
        @animationend.stop="finish($event, 'frame')"
      />
    </view>
  </view>
</template>
<script setup>
import { computed, getCurrentInstance, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import { t } from '@/i18n/index.js';
import { registerMascot } from '@/design/mascot-motion.js';
import large from './mascot-large.js';
import small from './mascot-frames.js';

const frames = {
  idle: '00-reference-front',
  wave: '01-wave',
  think: '02-think',
  celebrate: '03-celebrate',
  encourage: '04-encourage',
  read: '05-read',
  sleep: '06-sleep',
  point: '07-point',
  curious: '08-curious'
};
const oneShots = new Set(['wave', 'celebrate', 'encourage', 'curious']);
const props = defineProps({
  pose: {
    type: String,
    default: 'idle',
    validator: (value) =>
      ['idle', 'wave', 'think', 'celebrate', 'encourage', 'read', 'sleep', 'point', 'curious'].includes(value)
  },
  size: { type: [String, Number], default: 'medium' },
  play: { type: String, default: 'auto', validator: (value) => ['auto', 'once', 'loop', 'none'].includes(value) },
  decorative: { type: Boolean, default: true },
  alt: { type: String, default: '' },
  reducedMotion: { type: Boolean, default: false }
});
const emit = defineEmits(['complete']);
const root = ref(null);
const instance = getCurrentInstance();
const id = instance.uid;
const owner = ref(false);
const visible = ref(false);
const pageVisible = ref(true);
const done = ref(false);
const displayPose = computed(() =>
  done.value && props.pose === 'wave' && props.play === 'auto' ? 'idle' : props.pose in frames ? props.pose : 'idle'
);
const looping = computed(() => props.play === 'loop' || (props.play === 'auto' && !oneShots.has(displayPose.value)));
const wanted = computed(() => props.play !== 'none' && !(done.value && !looping.value));
const animated = computed(() => owner.value && wanted.value && !props.reducedMotion);
const running = computed(() => animated.value && visible.value && pageVisible.value);
const moving = computed(() => running.value);
const sizeName = computed(() => (['small', 'state', 'medium', 'large'].includes(props.size) ? props.size : 'custom'));
const sizeStyle = computed(() =>
  sizeName.value === 'custom'
    ? {
        width: typeof props.size === 'number' ? `${props.size}px` : props.size,
        height: typeof props.size === 'number' ? `${props.size}px` : props.size
      }
    : {}
);
const highResolution = computed(() => props.size === 'large' || (typeof props.size === 'number' && props.size > 124));
function asset(name) {
  return highResolution.value && large[name] ? large[name] : small[name];
}
const source = computed(() => asset(frames[displayPose.value]));
const alternate = computed(() =>
  displayPose.value === 'idle' ? asset('09-blink') : displayPose.value === 'wave' ? asset('10-wave-b') : ''
);
let registration;
let observer;
const sync = () =>
  registration?.update(wanted.value && visible.value && pageVisible.value && !props.reducedMotion, looping.value);
watch([() => props.pose, () => props.play], () => {
  done.value = false;
});
watch([wanted, looping, visible, pageVisible, () => props.reducedMotion], sync, { flush: 'sync' });
function finish(event, origin) {
  const expected = {
    idle: 'yozi-float',
    wave: 'yozi-wave',
    think: 'yozi-sway',
    celebrate: 'yozi-jump',
    encourage: 'yozi-nod',
    read: 'yozi-float',
    sleep: 'yozi-breathe',
    point: 'yozi-nudge',
    curious: 'yozi-tilt'
  }[displayPose.value];
  // Vue scopes keyframe names; uni's normalized H5 event may omit the name.
  // The frame has its own stopped handler, so blink events cannot finish a float.
  const animationName = event.animationName || event.detail?.animationName || '';
  if (!running.value || looping.value) return;
  if (animationName) {
    if (!(animationName === expected || animationName.startsWith(`${expected}-`))) return;
  } else if (event.type !== 'animationend' || origin !== (displayPose.value === 'wave' ? 'frame' : 'motion')) return;
  done.value = true;
  emit('complete', props.pose);
  sync();
}
// onHide/onShow are page lifecycles; also handle cached page components.
if (import.meta.env.MODE !== 'test') {
  onHide(() => {
    pageVisible.value = false;
  });
  onShow(() => {
    pageVisible.value = true;
  });
}
onMounted(() => {
  registration = registerMascot((value) => {
    owner.value = value;
  });
  // #ifdef H5
  const element = root.value?.$el || root.value;
  if (typeof IntersectionObserver !== 'undefined' && element) {
    observer = new IntersectionObserver(
      (entries) => {
        visible.value = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(element);
  } else visible.value = true;
  // #endif
  // #ifndef H5
  if (import.meta.env.MODE !== 'test') {
    if (typeof uni?.createIntersectionObserver === 'function') {
      observer = uni.createIntersectionObserver(instance.proxy, { thresholds: [0], initialRatio: 0 });
      observer.relativeToViewport().observe(`.yozi-mascot-instance-${id}`, (result) => {
        visible.value = result.intersectionRatio > 0;
      });
    } else visible.value = true;
  }
  // #endif
  sync();
});
onBeforeUnmount(() => {
  observer?.disconnect();
  registration?.release();
});
</script>
<style scoped lang="scss">
.yozi-mascot {
  position: relative;
  flex: none;
  display: inline-block;
  width: var(--mascot-medium);
  height: var(--mascot-medium);
}
.yozi-mascot--small {
  width: var(--mascot-small);
  height: var(--mascot-small);
}
.yozi-mascot--state {
  width: var(--mascot-state);
  height: var(--mascot-state);
}
.yozi-mascot--large {
  width: var(--mascot-large);
  height: var(--mascot-large);
}
.yozi-mascot__motion {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: var(--mx-origin);
}
.yozi-mascot__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.yozi-mascot__alt {
  opacity: 0;
}
.is-animated.mx--idle {
  animation: yozi-float var(--mx-idle-time) var(--ease);
}
.is-animated.mx--idle .yozi-mascot__alt {
  animation: yozi-blink var(--mx-blink-time);
}
.is-animated.mx--wave .yozi-mascot__alt {
  animation: yozi-wave var(--mx-wave-time);
}
.is-animated.mx--think {
  animation: yozi-sway var(--mx-think-time) ease-in-out;
}
.is-animated.mx--celebrate {
  animation: yozi-jump var(--mx-celebrate-time) var(--ease);
}
.is-animated.mx--encourage {
  animation: yozi-nod var(--mx-encourage-time) ease-in-out;
}
.is-animated.mx--read {
  animation: yozi-float var(--mx-read-time) ease-in-out;
}
.is-animated.mx--sleep {
  animation: yozi-breathe var(--mx-sleep-time) ease-in-out;
}
.is-animated.mx--point {
  animation: yozi-nudge var(--mx-point-time) ease-in-out;
  animation-direction: alternate;
}
.is-animated.mx--curious {
  animation: yozi-tilt var(--mx-curious-time) var(--ease);
}
@keyframes yozi-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(var(--mx-float-y));
  }
}
@keyframes yozi-blink {
  0%,
  95.9% {
    opacity: 0;
  }
  96%,
  98.6% {
    opacity: 1;
  }
  98.7%,
  100% {
    opacity: 0;
  }
}
@keyframes yozi-wave {
  0%,
  7.4% {
    opacity: 0;
  }
  7.5%,
  14.9% {
    opacity: 1;
  }
  15%,
  22.4% {
    opacity: 0;
  }
  22.5%,
  29.9% {
    opacity: 1;
  }
  30%,
  37.4% {
    opacity: 0;
  }
  37.5%,
  44.9% {
    opacity: 1;
  }
  45%,
  100% {
    opacity: 0;
  }
}
@keyframes yozi-sway {
  0%,
  100% {
    transform: rotate(calc(-1 * var(--mx-sway-angle)));
  }
  50% {
    transform: rotate(var(--mx-sway-angle));
  }
}
@keyframes yozi-jump {
  0% {
    transform: none;
  }
  12% {
    transform: scale(1.06, 0.92);
  }
  34% {
    transform: translateY(var(--mx-jump-y)) scale(0.96, 1.06);
  }
  56% {
    transform: translateY(0) scale(1.05, 0.95);
  }
  70%,
  100% {
    transform: none;
  }
}
@keyframes yozi-nod {
  0%,
  40%,
  100% {
    transform: none;
  }
  10%,
  30% {
    transform: rotate(var(--mx-nod-angle));
  }
  20% {
    transform: rotate(var(--mx-nod-return));
  }
}
@keyframes yozi-breathe {
  0%,
  100% {
    transform: none;
  }
  50% {
    transform: scale(1.025, 0.985);
  }
}
@keyframes yozi-nudge {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(var(--mx-nudge-x));
  }
}
@keyframes yozi-tilt {
  0%,
  100% {
    transform: none;
  }
  25%,
  70% {
    transform: rotate(var(--mx-tilt-angle));
  }
}
@media (prefers-reduced-motion: reduce) {
  .yozi-mascot__motion,
  .yozi-mascot__alt {
    animation: none !important;
    transform: none !important;
  }
  .yozi-mascot__alt {
    opacity: 0 !important;
  }
}
</style>
