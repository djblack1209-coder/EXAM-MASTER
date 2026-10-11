<!-- Wot loading compatibility: one state renderer, no independent spinner. -->
<template><BaseEmpty state="loading" compact :mascot-size="size" :aria-label="t('ui.loading')" /></template>
<script setup>
import BaseEmpty from '../base-empty/base-empty.vue';
import { t } from '@/i18n/index.js';
defineProps({
  size: { type: [Number, String], default: 'small' },
  color: { type: String, default: '' },
  type: { type: String, default: '' }
});
</script>
