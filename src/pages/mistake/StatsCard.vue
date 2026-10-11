<template>
  <view
    ><BaseStat :label="title" :value="Number(value) || 0" /><BaseTag v-if="change" tone="neutral">{{
      change
    }}</BaseTag></view
  >
</template>

<script setup>
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseTag from '@/components/base/base-tag/base-tag.vue';

defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  change: {
    type: String,
    default: ''
  },
  changeType: {
    type: String,
    default: 'neutral',
    validator: (value) => ['positive', 'negative', 'neutral'].includes(value)
  },
  icon: {
    type: String,
    required: true
  },
  isDark: {
    type: Boolean,
    default: false
  }
});
</script>
