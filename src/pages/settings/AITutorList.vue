<template>
  <!-- F002: AI 导师列表 — 从 settings/index.vue 提取 -->
  <div class="section">
    <div class="section-header ds-flex ds-flex-between">
      <h3 class="section-title ds-text-lg ds-font-semibold">AI 导师（在线）</h3>
      <div class="header-actions ds-flex ds-gap-xs">
        <span class="online-badge ds-text-xs ds-font-medium">支持语音对讲</span>
      </div>
    </div>
    <div class="tutor-list">
      <div v-for="(tutor, index) in tutorList" :key="index" class="tutor-item ds-flex">
        <image
          class="tutor-avatar ds-rounded-full"
          :src="tutor.avatar || '/static/images/default-avatar.png'"
          @error="
            (e) => {
              if (e.target) e.target.src = '/static/images/default-avatar.png';
            }
          "
        />
        <div class="tutor-info">
          <text class="tutor-name ds-text-sm ds-font-medium">
            {{ tutor.name }}
          </text>
          <text class="tutor-role ds-text-xs">
            {{ tutor.role }}
          </text>
        </div>
        <button class="chat-btn ds-touchable" @tap="$emit('start-chat', tutor)">交流</button>
      </div>
    </div>
  </div>
</template>

<script>
import storageService from '@/services/storageService.js';
import config from '@/config/index.js';

export default {
  name: 'AITutorList',
  props: {
    targetSchools: { type: Array, default: () => [] }
  },
  emits: ['start-chat'],
  data() {
    return {
      baseTutors: [
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
      ]
    };
  },
  computed: {
    tutorList() {
      const list = [...this.baseTutors];
      if (this.targetSchools.length > 0) {
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
    }
  }
};
</script>

<style lang="scss" scoped>
.tutor-list {
  background-color: var(--card-bg, var(--bg-card));
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.tutor-item {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border);
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
  font-weight: 500;
  color: var(--text-primary, var(--text-primary));
  margin-bottom: 4px;
  line-height: 1.5;
  letter-spacing: 0.3px;
}

.tutor-role {
  font-size: 28rpx;
  color: var(--text-secondary, #495057);
  line-height: 1.5;
  letter-spacing: 0.3px;
}

.chat-btn {
  background-color: transparent;
  border: 2px solid var(--brand-color);
  color: var(--brand-color, #00a96d);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 28rpx;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-btn:hover {
  background-color: var(--brand-color, #00a96d);
  color: white;
  transform: scale(1.05);
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
  background-color: var(--success-light);
  color: var(--brand-color, #00a96d);
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
}
</style>
