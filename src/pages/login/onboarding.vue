<template>
  <LearningLanding welcome @start="completeOnboarding"
    ><PrivacyPopup />
    <BaseEmpty v-if="saveError" state="error" :title="saveError" show-button @action="completeOnboarding" />
  </LearningLanding>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { DEV_TEST } from '@/config/build-channel.js';
import LearningLanding from '@/components/business/learning/learning-landing.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { storageService } from '@/services/storageService.js';
import { openLearningEntry } from '@/utils/home-navigation.js';
import { t } from '@/i18n/index.js';
const saveError = ref('');
let active = true;
const timers = new Set();
onMounted(() => {
  if (DEV_TEST) openLearningEntry({ isCurrent: () => active });
});
onBeforeUnmount(() => {
  active = false;
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
});
function completeOnboarding() {
  if (!active) return;
  saveError.value = '';
  if (storageService.save('onboarding_completed', true) !== true) {
    saveError.value = t('tutor.welcome.saveError');
    return;
  }
  openLearningEntry({
    isCurrent: () => active,
    schedule(callback, delay) {
      if (!active) return;
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (active) callback();
      }, delay);
      timers.add(timer);
    }
  });
}
</script>
