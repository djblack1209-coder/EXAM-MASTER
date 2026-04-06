<template>
  <view class="section">
    <button
      class="logout-btn ds-font-medium ds-touchable"
      :disabled="isLoggingOut"
      :class="{ 'btn-disabled': isLoggingOut }"
      @tap="handleLogout"
    >
      {{ isLoggingOut ? '退出中...' : '退出登录' }}
    </button>
  </view>
</template>

<script setup>
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { ref } from 'vue';
// [AUDIT FIX] storageService 使用 default export，需用默认导入
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { useUserStore } from '@/stores/modules/user';

const emit = defineEmits(['logged-out']);

const isLoggingOut = ref(false);

const handleLogout = () => {
  if (isLoggingOut.value) return;
  modal.show({
    title: '提示',
    content: '确定要退出当前账号吗？',
    confirmColor: '#EF4444',
    success: async (res) => {
      if (res.confirm) {
        isLoggingOut.value = true;
        try {
          const userStore = useUserStore();
          userStore.logout();

          // 清除本地存储的用户信息
          storageService.remove('userInfo');
          storageService.remove('EXAM_USER_ID');
          // ✅ B021-3: 不再存储明文 user_id，无需清理
          storageService.remove('EXAM_TOKEN');

          // 通知父组件重置状态
          emit('logged-out');

          // 通知其他页面登录状态变化
          uni.$emit('loginStatusChanged', false);

          toast.success('已退出登录');

          // 延迟回到首页刷新
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/index/index' });
          }, 1000);
        } catch (error) {
          logger.error('[Settings] 退出登录失败:', error);
          toast.info('退出失败，请重试');
          isLoggingOut.value = false;
        }
      }
    }
  });
};
</script>

<style lang="scss" scoped>
/* 退出登录按钮 */
.logout-btn {
  width: 100%;
  background-color: transparent;
  border: 2px solid var(--danger);
  color: var(--danger);
  border-radius: 16px;
  padding: 16px;
  font-size: 32rpx;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.logout-btn:hover {
  background-color: var(--danger);
  color: var(--text-inverse);
  transform: translateY(-2px);
  box-shadow: var(--shadow-danger);
}
</style>
