<template>
  <view
    ref="stage"
    class="future-stage"
    :class="{ 'entrance-pending': entrancePending, 'motion-paused': !interactive }"
  >
    <!-- #ifdef H5 -->
    <view class="sky" aria-hidden="true">
      <component
        :is="'video'"
        ref="skyVideo"
        class="future-sky-video"
        aria-hidden="true"
        autoplay
        muted
        loop
        playsinline
        preload="auto"
        disablepictureinpicture
        tabindex="-1"
        :src="FUTURE_ASSETS.video"
      />
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="sky" aria-hidden="true" />
    <!-- #endif -->
    <view class="marquee" aria-hidden="true">
      <view class="marquee-track"
        ><view class="marquee-run"
          ><text>{{ ticker }}</text
          ><text>{{ ticker }}</text></view
        ></view
      >
    </view>
    <view class="scene-assembly" aria-hidden="true">
      <view class="skirt" />
      <!-- #ifdef H5 -->
      <img
        class="scene"
        :src="reference ? FUTURE_ASSETS.scene : '/static/brand/learning-projector.webp'"
        alt="A holographic desk projector showing a design workspace"
        draggable="false"
      />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <image
        class="scene"
        :src="reference ? FUTURE_ASSETS.scene : '/static/brand/learning-projector.webp'"
        mode="widthFix"
      />
      <!-- #endif -->
    </view>
    <view class="intro">
      <text v-if="reference" class="hi">Hi, I’m</text>
      <text class="name" :class="{ 'brand-wordmark': !reference }" role="heading" aria-level="1">{{
        reference ? 'Ayush' : BRAND.english
      }}</text>
      <view v-if="reference" class="role">
        <text>A Product Designer experienced in building products,</text>
        <text>with a problem solving and creative mindset.</text>
      </view>
    </view>
    <view class="future-nav" aria-label="主导航">
      <button class="nav-link home" role="button" tabindex="0" @tap="open('web')">
        {{ reference ? 'Home' : '首页' }}
      </button>
      <button class="nav-link n1" role="button" tabindex="0" @tap="open('start')">
        {{ reference ? 'Works' : '学习' }}
      </button>
      <button class="nav-link n2" role="button" tabindex="0" @tap="open('materials')">
        {{ reference ? 'About me' : '私人资料' }}
      </button>
      <button class="nav-link n3" role="button" tabindex="0" @tap="open('plan')">
        {{ reference ? 'Resume' : '复习计划' }}
      </button>
      <view class="mode">
        <text class="label">{{ reference ? 'Interactive\nMode' : '动效' }}</text>
        <button
          class="switch"
          data-learning-toggle
          role="switch"
          tabindex="0"
          :aria-checked="interactive"
          aria-label="交互动效"
          @tap="interactive = !interactive"
        >
          <text class="on">ON</text><text class="off">OFF</text><view class="knob" />
        </button>
      </view>
    </view>
  </view>
</template>
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { BRAND } from '@/config/brand.js';
import { FUTURE_ASSETS, bindFutureSky, runFutureEntrance } from '@/design/future-motion.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
const props = defineProps({ reference: { type: Boolean, default: false } });
const emit = defineEmits(['open']);
const stage = ref(null);
const skyVideo = ref(null);
const interactive = ref(true);
let useEntrance = false;
// #ifdef H5
useEntrance = true;
// #endif
const entrancePending = ref(useEntrance);
const ticker = computed(() => (props.reference ? 'BRANDING·PRODUCT·UI/UX·' : 'LEARNING·PRACTICE·REVIEW·').repeat(5));
let skyControl;
let stopEntrance = () => undefined;
let unbindKeyboard = () => undefined;
let disposed = false;
function open(target) {
  if (!props.reference) emit('open', target);
}
watch(interactive, (value) => skyControl?.setEnabled(value));
onMounted(async () => {
  // #ifdef H5
  await nextTick();
  if (disposed) return;
  const element = stage.value?.$el || stage.value;
  unbindKeyboard = bindLearningKeyboard(element);
  const video = skyVideo.value?.$el || skyVideo.value;
  if (video) {
    video.muted = true;
    skyControl = bindFutureSky(video);
  }
  if (element?.querySelector)
    stopEntrance = runFutureEntrance(element, () => {
      entrancePending.value = false;
    });
  // #endif
});
onUnmounted(() => {
  disposed = true;
  skyControl?.dispose();
  stopEntrance();
  unbindKeyboard();
});
</script>
<style src="./future-landing.css"></style>
