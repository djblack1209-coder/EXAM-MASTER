<template>
  <view ref="landingElement" class="playful-footer" aria-label="Yozi AI学习空间">
    <!-- #ifdef H5 -->
    <view class="playful-background" aria-hidden="true">
      <component
        :is="'video'"
        ref="gazeVideo"
        class="playful-native-video"
        muted
        playsinline
        preload="auto"
        src="/public/visual/playful/footer-scrub.mp4"
      />
    </view>
    <!-- #endif -->
    <view class="playful-jobs">
      <text class="playful-headline playful-job-title">{{ '从一个问题\n到真正理解' }}</text>
      <view class="playful-nav" aria-label="学习导航">
        <button role="button" tabindex="0" @tap="$emit('open', 'start')">学习</button>
        <button role="button" tabindex="0" @tap="$emit('open', 'mistake')">错题</button>
        <button role="button" tabindex="0" @tap="$emit('open', 'plan')">复习计划</button>
        <button role="button" tabindex="0" @tap="$emit('open', 'study-detail')">学习足迹</button>
      </view>
    </view>
    <view class="playful-logo" role="img" :aria-label="BRAND.name">
      <image :src="BRAND.mark" mode="aspectFit" :alt="BRAND.name" />
      <text>{{ BRAND.english }}</text>
    </view>
    <view class="playful-contact">
      <button class="playful-tag" role="button" tabindex="0" @tap="$emit('open', 'desktop')">桌面体验</button>
      <view class="playful-headline playful-contact-links">
        <button role="button" tabindex="0" aria-label="开始学习" @tap="$emit('open', 'start')">让好奇心发芽</button>
        <text>开始学习</text>
      </view>
      <view class="playful-socials">
        <button
          v-for="item in actions"
          :key="item.id"
          role="button"
          tabindex="0"
          :aria-label="item.label"
          @tap="$emit('open', item.id)"
        >
          <!-- #ifdef H5 -->
          <img :src="item.icon" alt="" draggable="false" />
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <image :src="item.icon" mode="aspectFit" alt="" />
          <!-- #endif -->
        </button>
      </view>
    </view>
  </view>
</template>
<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { BRAND } from '@/config/brand.js';
import { getIconPath } from '@/components/base/base-icon/icons.js';
import { bindPlayfulGaze } from '@/design/playful-gaze.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
defineEmits(['open']);
const landingElement = ref(null);
const gazeVideo = ref(null);
const actions = [
  { id: 'materials', label: '私人资料', icon: getIconPath('folder', undefined, 'light', '#080909') },
  { id: 'connections', label: '模型连接', icon: getIconPath('settings', undefined, 'light', '#080909') },
  { id: 'account', label: '我的账户', icon: getIconPath('users', undefined, 'light', '#080909') }
];
let dispose = () => undefined;
let unbindKeyboard = () => undefined;
let disposed = false;
onMounted(async () => {
  // #ifdef H5
  await nextTick();
  if (disposed) return;
  unbindKeyboard = bindLearningKeyboard(landingElement.value);
  const video = gazeVideo.value?.$el || gazeVideo.value;
  if (video) {
    video.muted = true;
    dispose = bindPlayfulGaze(video);
  }
  // #endif
});
onUnmounted(() => {
  disposed = true;
  dispose();
  unbindKeyboard();
});
</script>
<style scoped>
.playful-footer {
  position: relative;
  min-height: 100vh;
  padding-top: 6.54vw;
  isolation: isolate;
  overflow: hidden;
  color: #080909;
  background: #dfe4f2;
  font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-synthesis: none;
}
.playful-footer * {
  box-sizing: border-box;
}
.playful-footer button {
  border: 0;
  border-radius: 0;
  padding: 0;
  margin: 0;
  font: inherit;
  line-height: inherit;
  color: inherit;
  display: block;
  background: none;
  cursor: pointer;
}
.playful-footer button::after {
  border: 0;
}
.playful-footer button:active {
  transform: none;
}
.playful-footer button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 6px;
}
.playful-footer button:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.playful-jobs {
  margin-left: 8.65vw;
  width: 25vw;
}
.playful-tag,
.playful-footer button.playful-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 100px;
  background: #f7f8fa;
  padding: 0.39vw 0.61vw;
  font-size: 0.88vw;
  line-height: 1.2;
  height: 1.9vw;
  white-space: nowrap;
}
.playful-headline {
  font-family: Epilogue, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-weight: 900;
  font-size: 1.66vw;
  line-height: 1.2;
  letter-spacing: 0;
}
.playful-job-title {
  display: block;
  margin-top: 1.45vw;
  white-space: pre-line;
}
.playful-nav {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.93vw;
  margin-top: 1.3vw;
  font-size: 1.075vw;
  line-height: 1.35;
}
.playful-logo {
  position: absolute;
  left: 40.33vw;
  top: 7.7vw;
  width: 17vw;
  height: 4.02vw;
  display: flex;
  align-items: center;
  gap: 0.5vw;
}
.playful-logo image,
.playful-logo :deep(uni-image) {
  width: 3.3vw;
  height: 3.3vw;
  flex: none;
  filter: none;
  opacity: 1;
}
.playful-logo text,
.playful-logo :deep(uni-text) {
  font-family: Epilogue, sans-serif;
  font-weight: 900;
  font-size: 3.4vw;
  line-height: 1;
  letter-spacing: -0.035em;
}
.playful-contact {
  position: absolute;
  left: 74.3vw;
  top: 6.54vw;
}
.playful-contact-links {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 1.45vw;
  white-space: nowrap;
}
.playful-note {
  display: block;
  margin: 1.05vw 0 0;
  font-size: 0.733vw;
  line-height: 1.4;
  white-space: nowrap;
}
.playful-socials {
  display: flex;
  align-items: center;
  gap: 1.43vw;
  margin-top: 1.61vw;
}
.playful-socials button,
.playful-socials img,
.playful-socials image,
.playful-socials :deep(uni-image) {
  display: block;
  width: 1.71vw;
  height: 1.71vw;
}
.playful-background {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
.playful-background :deep(.playful-native-video) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
@media (max-width: 700px) {
  .playful-footer {
    display: flex;
    flex-direction: column;
    gap: 36px;
    min-height: 100svh;
    padding: 40px 24px 0;
    background: #f0eefa;
  }
  .playful-logo {
    position: static;
    order: 0;
    align-self: flex-start;
    width: 210px;
    height: 50px;
    max-width: 75%;
    margin-bottom: 4px;
    gap: 8px;
  }
  .playful-logo image,
  .playful-logo :deep(uni-image) {
    width: 42px;
    height: 42px;
  }
  .playful-logo text,
  .playful-logo :deep(uni-text) {
    font-size: 42px;
  }
  .playful-jobs {
    order: 1;
    margin: 0;
    width: 100%;
  }
  .playful-tag,
  .playful-footer button.playful-tag {
    height: 30px;
    padding: 6px 11px;
    font-size: 14px;
  }
  .playful-headline {
    font-size: clamp(22px, 6.3vw, 30px);
    line-height: 1.25;
  }
  .playful-job-title,
  .playful-contact-links {
    margin-top: 19px;
  }
  .playful-nav {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 24px;
    margin-top: 20px;
    font-size: 17px;
    line-height: 1.4;
  }
  .playful-nav button {
    display: flex;
    align-items: center;
    min-height: 44px;
  }
  .playful-contact {
    position: static;
    order: 2;
    width: 100%;
  }
  .playful-contact-links {
    gap: 4px;
    white-space: normal;
  }
  .playful-note {
    max-width: 34ch;
    margin: 16px 0 0;
    font-size: 14px;
    line-height: 1.5;
    white-space: normal;
  }
  .playful-socials {
    gap: 18px;
    margin-top: 20px;
  }
  .playful-socials button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
  }
  .playful-socials img,
  .playful-socials image,
  .playful-socials :deep(uni-image) {
    width: 30px;
    height: 30px;
  }
  .playful-socials button:first-child {
    margin-left: -7px;
  }
  .playful-background {
    position: relative;
    inset: auto;
    order: 3;
    z-index: auto;
    flex: none;
    align-self: center;
    width: calc(100% + 48px);
    aspect-ratio: 4/3;
    margin-top: -16px;
  }
}
</style>
