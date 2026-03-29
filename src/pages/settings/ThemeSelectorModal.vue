<template>
  <!-- F002: 主题选择器弹窗 — 从 settings/index.vue 提取 -->
  <view v-if="visible" class="modal-mask" @tap="$emit('close')">
    <view class="modal-content theme-selector" @tap.stop>
      <view class="modal-header">
        <text class="modal-title"> 选择主题风格 </text>
        <text class="close-btn" @tap="$emit('close')"> ✕ </text>
      </view>
      <view class="modal-body">
        <view class="theme-option" @tap="handleSelect('wise')">
          <view class="theme-preview wise-preview">
            <view class="preview-color" style="background: var(--gradient-primary)" />
          </view>
          <view class="theme-info">
            <text class="theme-name"> Wise 绿色主题 </text>
            <text class="theme-desc"> 清新自然，护眼舒适 </text>
          </view>
          <view v-if="currentTheme === 'wise'" class="theme-check">
            <BaseIcon name="check" :size="28" />
          </view>
        </view>
        <view class="theme-option" @tap="handleSelect('bitget')">
          <view class="theme-preview bitget-preview">
            <view
              class="preview-color"
              style="background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)"
            />
          </view>
          <view class="theme-info">
            <text class="theme-name"> Bitget Wallet 蓝色主题 </text>
            <text class="theme-desc"> 科技感十足，专业高效 </text>
          </view>
          <view v-if="currentTheme === 'bitget'" class="theme-check">
            <BaseIcon name="check" :size="28" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { toast } from '@/utils/toast.js';
import { useThemeStore } from '@/stores';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  visible: { type: Boolean, default: false }
});
const emit = defineEmits(['close']);

const currentTheme = computed(() => {
  const store = useThemeStore();
  return store.themeType;
});

function handleSelect(type) {
  const store = useThemeStore();
  store.setThemeType(type);
  emit('close');
  toast.success(`已切换到${type === 'wise' ? 'Wise' : 'Bitget Wallet'}主题`);
}
</script>

<style lang="scss" scoped>
.modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1500;
  background-color: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: var(--card-bg, var(--bg-card));
  border-radius: 24px;
  padding: 24px;
  width: 85%;
  max-width: 500px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  font-size: 48rpx;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.theme-selector {
  max-width: 500px;
}

.theme-option {
  display: flex;
  align-items: center;
  padding: 20px;
  margin-bottom: 16px;
  background-color: var(--card-bg, var(--bg-card));
  border: 2px solid var(--border);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.theme-option:hover {
  border-color: var(--brand-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow-brand);
}

.theme-option:last-child {
  margin-bottom: 0;
}

.theme-preview {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  margin-right: 16px;
  box-shadow: var(--shadow-sm);
}

.preview-color {
  width: 100%;
  height: 100%;
}

.theme-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 4px; -- replaced for Android WebView compat */
}

.theme-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.theme-desc {
  font-size: 26rpx;
  color: var(--text-secondary);
  opacity: 0.8;
}

.theme-check {
  font-size: 48rpx;
  color: var(--brand-color);
  font-weight: 700;
  margin-left: 12px;
}
</style>
