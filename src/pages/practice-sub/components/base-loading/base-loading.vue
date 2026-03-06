<template>
  <view v-if="visible" class="base-loading" :class="{ 'dark-mode': isDark }">
    <view class="loading-spinner" />
    <text v-if="text" class="loading-text">
      {{ text }}
    </text>
  </view>
</template>

<script>
export default {
  props: {
    visible: { type: Boolean, default: false },
    text: { type: String, default: '' },
    isDark: { type: Boolean, default: false }
  }
};
</script>

<style scoped>
.base-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}
.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(52, 199, 89, 0.2);
  border-top-color: #34c759;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.loading-text {
  margin-top: 12px;
  font-size: 14px;
  color: #8e8e93;
}
.dark-mode .loading-text {
  color: #aeaeb2;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
