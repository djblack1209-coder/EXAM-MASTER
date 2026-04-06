<template>
  <!-- F002: 智能导师列表 — 从 settings/index.vue 提取 -->
  <view class="section">
    <view class="section-header ds-flex ds-flex-between">
      <view class="section-title ds-text-lg ds-font-semibold"> 智能导师（在线） </view>
    </view>
    <view class="header-actions ds-flex ds-gap-xs">
      <text class="online-badge ds-text-xs ds-font-medium"> 支持语音对讲 </text>
    </view>
    <view class="tutor-list apple-group-card">
      <view v-for="(tutor, index) in tutorList" :key="index" class="tutor-item ds-flex">
        <image
          class="tutor-avatar ds-rounded-full"
          :src="tutor.avatar || '/static/images/default-avatar.png'"
          alt="头像"
          mode="aspectFill"
          lazy-load
          @error="
            (e) => {
              if (e.target) e.target.src = '/static/images/default-avatar.png';
            }
          "
        />
        <view class="tutor-info">
          <text class="tutor-name ds-text-sm ds-font-medium">
            {{ tutor.name }}
          </text>
          <text class="tutor-role ds-text-xs">
            {{ tutor.role }}
          </text>
        </view>
        <button class="chat-btn apple-glass-pill ds-touchable" @tap="$emit('start-chat', tutor)">交流</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import storageService from '@/services/storageService.js';
import config from '@/config/index.js';

const props = defineProps({
  targetSchools: { type: Array, default: () => [] }
});
defineEmits(['start-chat']);

const baseTutors = ref([
  {
    name: 'Dr. Logic',
    role: '逻辑/数学',
    avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=Felix`
  },
  {
    name: 'Miss English',
    role: '英语名师',
    avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=Aneka`
  },
  {
    name: '知心姐姐',
    role: '心理疏导',
    avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=Liliana`
  }
]);

const tutorList = computed(() => {
  const list = [...baseTutors.value];
  if (props.targetSchools.length > 0) {
    const info = storageService.get('user_school_info', {});
    const major = info.major || '计算机科学与技术';
    list.push({
      name: `${major}专业导师`,
      role: '专业导师',
      avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=Professional`,
      prompt: `你是${major}的考研指导老师，专业知识丰富，擅长解答考研相关问题，特别是${major}专业的考研规划、复习方法和院校选择等方面的问题。`
    });
  }
  return list;
});
</script>

<style lang="scss" scoped>
.tutor-list {
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--apple-shadow-surface);
}

.tutor-item {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--apple-divider);
  transition: background-color 0.2s ease;
}

.tutor-item:last-child {
  border-bottom: none;
}

.tutor-item:hover {
  background-color: var(--success-light);
}

.tutor-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 16px;
  box-shadow: var(--shadow-sm);
}

.tutor-info {
  flex: 1;
}

.tutor-name {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1.5;
  letter-spacing: 0.3px;
}

.tutor-role {
  font-size: 28rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  letter-spacing: 0.3px;
}

.chat-btn {
  min-height: 88rpx;
  background-color: var(--info);
  border: none;
  color: var(--text-inverse);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 28rpx;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 6rpx 0 #1499d6;
}

.chat-btn:active {
  transform: translateY(3rpx);
  box-shadow: 0 3rpx 0 #1499d6;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  color: var(--text-primary, var(--text-primary));
}

.online-badge {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 48%),
    linear-gradient(160deg, var(--apple-glass-pill-bg) 0%, rgba(255, 255, 255, 0.58) 100%);
  color: var(--cta-primary-text);
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
  border: 1px solid var(--apple-divider);
}
</style>
