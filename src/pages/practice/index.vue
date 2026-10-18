<template>
  <LearningShell><LearningOverview :initial-expanded="true" :show-navigation="false" /></LearningShell>
</template>
<script setup>
import LearningShell from '@/components/business/learning/learning-shell.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
</script>
