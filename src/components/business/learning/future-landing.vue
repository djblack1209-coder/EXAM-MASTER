<template>
  <view
    ref="stage"
    class="future-stage theme-light"
    :class="[{ 'entrance-pending': entrancePending, 'motion-paused': !interactive || mascotReducedMotion }]"
    :style="$yoziInsets"
  >
    <!-- #ifdef H5 -->
    <view class="sky" aria-hidden="true" :style="{ backgroundImage: `url(${FUTURE_ASSETS.still})` }">
      <component
        :is="'video'"
        ref="skyVideo"
        class="future-sky-video"
        aria-hidden="true"
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
      <img class="scene" :src="'/static/brand/learning-projector.webp'" alt="" draggable="false" />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <image class="scene" :src="'/static/brand/learning-projector.webp'" mode="widthFix" />
      <!-- #endif -->
    </view>
    <view class="intro">
      <text class="name brand-wordmark" role="heading" aria-level="1">{{ BRAND.english }}</text>
      <view class="future-mascot"
        ><YoziMascot pose="wave" size="medium" play="auto" :reduced-motion="!interactive"
      /></view>
    </view>
    <BaseCard class="future-nav" surface="glass" padding="small" :aria-label="landingPresentation.navigation">
      <view class="future-nav-items"
        ><BaseButton class="nav-link home" variant="quiet" align="start" @tap="open('web')">{{
          landingPresentation.home
        }}</BaseButton>
        <BaseButton
          class="nav-link n1"
          variant="primary"
          :label="landingPresentation.start"
          icon="arrow-right"
          @tap="open('start')"
          >{{ landingPresentation.start }}</BaseButton
        >
        <BaseButton class="nav-link n2" variant="quiet" align="start" @tap="open('materials')">{{
          landingPresentation.materials
        }}</BaseButton>
        <BaseButton class="nav-link n3" variant="quiet" align="start" @tap="open('plan')">{{
          landingPresentation.plan
        }}</BaseButton>
        <view class="mode"
          ><BaseChip v-model="interactive" :disabled="mascotReducedMotion">{{
            landingPresentation.motion
          }}</BaseChip></view
        >
      </view></BaseCard
    >
  </view>
</template>
<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { BRAND } from '@/config/brand.js';
import { FUTURE_ASSETS, bindFutureSky, runFutureEntrance } from '@/design/future-motion.js';
import { landingPresentation } from '@/i18n/messages/landing.js';
import { mascotReducedMotion } from '@/design/mascot-motion.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
const emit = defineEmits(['open']);
const stage = ref(null);
const skyVideo = ref(null);
const interactive = ref(true);
let useEntrance = false;
// #ifdef H5
useEntrance = true;
// #endif
const entrancePending = ref(useEntrance);
const ticker = landingPresentation.ticker.repeat(5);
let skyControl;
let stopEntrance = () => undefined;
let disposed = false;
function open(target) {
  emit('open', target);
}
watch([interactive, mascotReducedMotion], ([value, reduced]) => {
  skyControl?.setEnabled(value && !reduced);
  if (!value || reduced) stopEntrance();
});
onMounted(async () => {
  // #ifdef H5
  await nextTick();
  if (disposed) return;
  const element = stage.value?.$el || stage.value;
  const video = skyVideo.value?.$el || skyVideo.value;
  if (video) {
    video.muted = true;
    skyControl = bindFutureSky(video);
    skyControl.setEnabled(interactive.value && !mascotReducedMotion.value);
  }
  if (element?.querySelector)
    stopEntrance = runFutureEntrance(element, () => {
      entrancePending.value = false;
    });
  if (mascotReducedMotion.value) stopEntrance();
  // #endif
});
onUnmounted(() => {
  disposed = true;
  skyControl?.dispose();
  stopEntrance();
});
</script>
<style src="./future-landing.css"></style>
