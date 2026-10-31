<template>
  <view
    class="base-bubble"
    :class="[`base-bubble--${author}`, { 'base-bubble--rich': rich }]"
    :data-group="group || undefined"
    role="group"
    :aria-label="t(`ui.author.${author}`)"
  >
    <view v-if="$slots.time" class="base-bubble__time"><slot name="time"></slot></view>
    <view class="base-bubble__body">
      <view
        v-if="avatar && author === 'assistant'"
        class="base-bubble__avatar"
        :data-avatar-state="avatarStateFor(avatarBusiness || {})"
        aria-hidden="true"
      >
        <AnimatedAvatar
          v-if="avatarBusiness?.busy"
          :identity="avatarIdentity"
          :business="avatarBusiness"
          :size="48"
          autoplay
          perceptible
        />
        <image v-else :src="AVATAR_STATIC" mode="aspectFit" class="base-bubble__still" />
      </view>
      <view class="base-bubble__content"><slot></slot></view>
    </view>
  </view>
</template>
<script setup>
import { t } from '@/i18n/index.js';
import AnimatedAvatar from '../animated-avatar/animated-avatar.vue';
import { AVATAR_STATIC, avatarStateFor } from '@/design/avatar-state.js';
defineProps({
  author: { type: String, default: 'assistant', validator: (value) => ['user', 'assistant'].includes(value) },
  avatar: { type: Boolean, default: false },
  avatarBusiness: { type: Object, default: null },
  avatarIdentity: { type: String, default: 'message-reply' },
  rich: Boolean,
  group: { type: String, default: '', validator: (value) => ['', 'single', 'first', 'middle', 'last'].includes(value) }
});
</script>
<style scoped>
.base-bubble {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  color: var(--ink);
  font: var(--weight-regular) 16px/22px var(--font-ui);
}
.base-bubble__body {
  display: flex;
  align-items: flex-start;
  align-self: flex-start;
  gap: var(--s-3);
  max-width: 86%;
  min-height: 44px;
  padding: 11px 15px;
  border-radius: 22px;
  background: var(--paper);
}
.base-bubble__content {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.base-bubble__time {
  align-self: stretch;
  margin-bottom: 8px;
  color: var(--ink-3);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}
.base-bubble__avatar {
  display: flex;
  flex: none;
  width: 48px;
  height: 48px;
  background: transparent;
}
.base-bubble__still {
  width: 48px;
  height: 48px;
}
/* The shared player keeps its 1000ms dwell. The existing 2.2s thinking motion
   bridges its first idle frame so request feedback starts in the send tick. */
.base-bubble__avatar[data-avatar-state='working']
  :deep(.animated-avatar[data-avatar-state='idle'] .animated-avatar__body) {
  animation: message-prepare 2.2s ease-in-out infinite;
}
@keyframes message-prepare {
  0%,
  100% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(4deg) translateY(-1px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .base-bubble__avatar :deep(.animated-avatar__body) {
    animation: none !important;
    transform: none !important;
  }
}
.base-bubble--user .base-bubble__body {
  align-self: flex-end;
  max-width: 78%;
  background: var(--muse-user, var(--violet-soft));
  color: var(--muse-user-ink, var(--ink));
  font-size: 16px;
  line-height: 26px;
}
.base-bubble--rich .base-bubble__body {
  padding: 0;
  background: transparent;
  max-width: 100%;
}
.base-bubble__content :deep(.muse-rich-text) {
  font-size: inherit;
  line-height: inherit;
}
</style>
