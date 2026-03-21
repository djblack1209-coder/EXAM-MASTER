<template>
  <view v-if="visible" class="session-overlay" @tap.self="$emit('close')">
    <view class="session-panel" :class="{ 'dark-mode': isDark }">
      <!-- Header -->
      <view class="panel-header">
        <text class="panel-title">对话记录</text>
        <view class="new-chat-btn" hover-class="item-hover" @tap="$emit('create')">
          <text class="new-chat-text">+ 新对话</text>
        </view>
      </view>

      <!-- Session list -->
      <scroll-view class="session-scroll" scroll-y>
        <view
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === currentId }"
          @tap="$emit('select', session.id)"
          @longpress="onLongPress(session)"
        >
          <view class="session-info">
            <text class="session-title">{{ session.title || '新对话' }}</text>
            <text class="session-preview">{{ session.lastMessage || '暂无消息' }}</text>
          </view>
          <view class="session-meta">
            <text class="session-time">{{ formatTimeAgo(session.updatedAt) }}</text>
            <text class="session-count">{{ session.messageCount || 0 }}条</text>
          </view>
        </view>

        <view v-if="!sessions.length" class="empty-state">
          <text class="empty-text">暂无对话记录</text>
        </view>
      </scroll-view>
    </view>

    <!-- Long press action sheet -->
    <view v-if="actionSession" class="action-mask" @tap.self="actionSession = null">
      <view class="action-sheet" :class="{ 'dark-mode': isDark }">
        <view class="action-item" hover-class="item-hover" @tap="handleRename">
          <text>重命名</text>
        </view>
        <view class="action-item danger" hover-class="item-hover" @tap="handleDelete">
          <text>删除对话</text>
        </view>
        <view class="action-item cancel" hover-class="item-hover" @tap="actionSession = null">
          <text>取消</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { storageService } from '@/services/storageService.js';

defineProps({
  visible: { type: Boolean, default: false },
  sessions: { type: Array, default: () => [] },
  currentId: { type: String, default: '' }
});

const emit = defineEmits(['select', 'delete', 'create', 'close', 'rename']);

const isDark = ref(false);
const actionSession = ref(null);

const handleThemeUpdate = (mode) => {
  isDark.value = mode === 'dark';
};

onMounted(() => {
  isDark.value = storageService.get('theme_mode', 'light') === 'dark';
  uni.$on('themeUpdate', handleThemeUpdate);
});

onUnmounted(() => {
  uni.$off('themeUpdate', handleThemeUpdate);
});

function onLongPress(session) {
  actionSession.value = session;
}

function handleDelete() {
  if (actionSession.value) {
    emit('delete', actionSession.value.id);
    actionSession.value = null;
  }
}

function handleRename() {
  // uni-app 没有原生 prompt，用 showModal 的 editable 模式（H5/微信均支持）
  if (!actionSession.value) return;
  const s = actionSession.value;
  actionSession.value = null;
  uni.showModal({
    title: '重命名对话',
    content: s.title || '',
    editable: true,
    placeholderText: '输入新名称',
    success(res) {
      if (res.confirm && res.content?.trim()) {
        // 通过 select 事件外部处理重命名（保持单向数据流）
        emit('rename', s.id, res.content.trim());
      }
    }
  });
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
</script>

<style lang="scss" scoped>
.session-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: flex-start;
  animation: fadeIn 0.2s ease-out;
}
.session-panel {
  width: 580rpx;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(248, 248, 250, 0.92);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-right: 1rpx solid rgba(120, 120, 128, 0.12);
  animation: slideRight 0.28s ease-out;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 60rpx 32rpx 28rpx;
  border-bottom: 1rpx solid rgba(120, 120, 128, 0.1);
}
.panel-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}
.new-chat-btn {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--cta-primary-bg, linear-gradient(135deg, #34c759, #30d158));
  box-shadow: 0 4rpx 12rpx rgba(52, 199, 89, 0.3);
}
.new-chat-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 500;
}
.session-scroll {
  flex: 1;
  padding: 16rpx 0;
}
.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  margin: 0 16rpx;
  border-radius: 20rpx;
  transition: background 0.15s;
  &.active {
    background: rgba(120, 120, 128, 0.1);
  }
}
.session-info {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
}
.session-title {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.session-preview {
  font-size: 24rpx;
  color: var(--text-tertiary, #999);
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.session-meta {
  flex-shrink: 0;
  text-align: right;
}
.session-time {
  font-size: 22rpx;
  color: var(--text-tertiary, #999);
  display: block;
}
.session-count {
  font-size: 20rpx;
  color: var(--text-tertiary, #bbb);
  margin-top: 4rpx;
  display: block;
}
.empty-state {
  padding: 120rpx 0;
  text-align: center;
}
.empty-text {
  font-size: 28rpx;
  color: var(--text-tertiary, #999);
}

/* Action sheet */
.action-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.action-sheet {
  width: 92%;
  margin-bottom: calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 28rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.action-item {
  padding: 28rpx 0;
  text-align: center;
  font-size: 32rpx;
  color: var(--text-primary, #1a1a1a);
  border-bottom: 1rpx solid rgba(120, 120, 128, 0.1);
  &.danger {
    color: #ff3b30;
  }
  &.cancel {
    font-weight: 500;
    border-bottom: none;
    margin-top: 12rpx;
    border-radius: 28rpx;
  }
}

/* Dark mode */
.session-panel.dark-mode {
  background: rgba(28, 28, 30, 0.92);
  border-right-color: rgba(255, 255, 255, 0.08);
  .panel-title {
    color: var(--text-main, #f0f0f0);
  }
  .session-title {
    color: var(--text-main, #f0f0f0);
  }
  .session-item.active {
    background: rgba(255, 255, 255, 0.08);
  }
}
.action-sheet.dark-mode {
  background: rgba(44, 44, 46, 0.95);
  .action-item {
    color: var(--text-main, #f0f0f0);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
  .action-item.danger {
    color: #ff453a;
  }
}

.item-hover {
  opacity: 0.65;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes slideRight {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
</style>
