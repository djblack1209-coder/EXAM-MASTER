<template>
  <view class="playful-footer theme-light" :aria-label="landingPresentation.space" :style="$yoziInsets">
    <view class="playful-background" aria-hidden="true">
      <YoziMascot pose="wave" size="large" play="auto" />
    </view>
    <view class="playful-jobs">
      <text class="playful-badge">{{ landingPresentation.badge }}</text>
      <text class="playful-headline playful-job-title playful-job-title--english" role="heading" aria-level="1">{{
        landingPresentation.headline
      }}</text>
      <view class="playful-nav" :aria-label="landingPresentation.navigation">
        <BaseButton
          v-for="item in navigation"
          :key="item.id"
          variant="quiet"
          align="start"
          @tap="$emit('open', item.id)"
          >{{ landingPresentation[item.key] }}</BaseButton
        >
      </view>
    </view>
    <view class="playful-logo" role="img" :aria-label="BRAND.name">
      <image :src="BRAND.mark" mode="aspectFit" :alt="BRAND.name" />
      <text>{{ BRAND.english }}</text>
    </view>
    <view class="playful-contact">
      <BaseButton variant="secondary" @tap="$emit('open', 'desktop')">{{ landingPresentation.desktop }}</BaseButton>
      <view class="playful-contact-links">
        <BaseButton
          variant="primary"
          :label="landingPresentation.start"
          icon="arrow-right"
          @tap="$emit('open', 'start')"
          >{{ landingPresentation.start }}</BaseButton
        >
      </view>
      <view class="playful-socials">
        <BaseButton
          v-for="item in actions"
          :key="item.id"
          variant="quiet"
          icon-only
          :icon="item.icon"
          :label="landingPresentation[item.key]"
          @tap="$emit('open', item.id)"
        />
      </view>
    </view>
  </view>
</template>
<script setup>
import { BRAND } from '@/config/brand.js';
import { landingPresentation } from '@/i18n/messages/landing.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
defineEmits(['open']);
const navigation = [
  { id: 'start', key: 'learn' },
  { id: 'mistake', key: 'mistakes' },
  { id: 'plan', key: 'plan' },
  { id: 'study-detail', key: 'history' }
];
const actions = [
  { id: 'materials', key: 'materials', icon: 'folder' },
  { id: 'connections', key: 'connections', icon: 'settings' },
  { id: 'account', key: 'account', icon: 'users' }
];
</script>
<style scoped>
.playful-footer {
  position: relative;
  min-height: 100vh;
  padding-top: 6.54vw;
  isolation: isolate;
  overflow: hidden;
  color: var(--playful-ink);
  background: var(--playful-canvas);
  font-family: var(--font-ui);
  font-synthesis: none;
}
.playful-footer * {
  box-sizing: border-box;
}
.playful-jobs {
  margin-left: 8.65vw;
  width: 25vw;
}
.playful-badge {
  display: inline-flex;
  border-radius: var(--r-pill);
  background: var(--playful-badge);
  padding: var(--s-1) var(--s-2);
  font-size: var(--size-small);
  line-height: var(--leading-small);
}
.playful-headline {
  display: block;
  font: var(--weight-display) var(--size-display)/var(--leading-display) var(--font-display);
}
.playful-job-title {
  width: max-content;
  max-width: calc(100vw - var(--s-6) * 2);
  margin-top: 1.45vw;
  white-space: pre;
}
.playful-job-title--english {
  font-size: calc(var(--size-display) * 0.75);
  line-height: calc(var(--leading-display) * 0.75);
}
.playful-nav {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s-2);
  margin-top: var(--s-5);
}
.playful-logo {
  position: absolute;
  left: 40.33vw;
  top: 7.7vw;
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.playful-logo image {
  width: var(--touch-min);
  height: var(--touch-min);
  flex: none;
}
.playful-logo text {
  font: var(--weight-display) var(--size-display)/var(--leading-display) var(--font-display);
  letter-spacing: -0.035em;
}
.playful-contact {
  position: absolute;
  left: 74.3vw;
  top: 6.54vw;
  max-width: calc(25.7vw - var(--s-6));
}
.playful-contact-links {
  margin-top: var(--s-6);
}
.playful-socials {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-3);
  margin-top: var(--s-5);
}
.playful-background {
  position: absolute;
  inset: 42% 0 0;
  z-index: -1;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
@media (max-width: 900px) {
  .playful-job-title {
    font-size: var(--size-title-2);
    line-height: var(--leading-title-2);
  }
  .playful-job-title--english {
    font-size: var(--size-title-3);
    line-height: var(--leading-title-3);
  }
  .playful-logo text {
    font-size: var(--size-title-1);
    line-height: var(--leading-title-1);
  }
  .playful-contact {
    left: 69vw;
    max-width: calc(31vw - var(--s-4));
  }
}
@media (max-width: 700px) {
  .playful-footer {
    background: var(--playful-mobile-canvas);
    display: flex;
    flex-direction: column;
    gap: var(--s-8);
    min-height: 100svh;
    padding: var(--s-10) var(--s-6) var(--tabbar-reserve);
  }
  .playful-logo {
    position: static;
    order: 0;
    align-self: flex-start;
    max-width: 100%;
  }
  .playful-jobs {
    order: 1;
    margin: 0;
    width: 100%;
  }
  .playful-job-title {
    margin-top: var(--s-5);
    font-size: calc(var(--size-display) * 0.75);
    line-height: calc(var(--leading-display) * 0.75);
  }
  .playful-job-title--english {
    font-size: calc(var(--size-display) * 0.625);
    line-height: calc(var(--leading-display) * 0.625);
  }
  .playful-nav {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2) var(--s-6);
  }
  .playful-contact {
    position: static;
    order: 2;
    width: 100%;
    max-width: none;
  }
  .playful-background {
    position: relative;
    inset: auto;
    order: 3;
    z-index: auto;
    flex: none;
    align-self: center;
    width: 100%;
  }
}
</style>
