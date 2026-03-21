<template>
  <view class="file-manager-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 -->
    <view class="top-nav">
      <view class="nav-left" @tap="goBack">
        <text class="back-arrow"> ← </text>
        <text class="nav-title"> 文件管理 </text>
      </view>
      <view class="nav-right">
        <view v-if="files.length > 0" class="icon-btn danger" @tap="clearAll">
          <BaseIcon name="delete" :size="36" />
        </view>
      </view>
    </view>

    <!-- F018: 页面加载骨架屏 -->
    <view v-if="isPageLoading" class="skeleton-container">
      <view v-for="i in 3" :key="i" class="skeleton-file-item">
        <view class="skeleton-icon skeleton-pulse" />
        <view class="skeleton-details">
          <view class="skeleton-name skeleton-pulse" />
          <view class="skeleton-meta skeleton-pulse" />
          <view class="skeleton-tags skeleton-pulse" />
        </view>
      </view>
    </view>

    <!-- 文件列表 -->
    <view v-else-if="files.length > 0" class="file-list">
      <view v-for="(file, index) in files" :key="index" class="file-item">
        <view class="file-left">
          <view class="file-icon">
            <text class="emoji">
              {{ getFileIcon(file.name) }}
            </text>
          </view>
          <view class="file-details">
            <text class="file-name">
              {{ file.name }}
            </text>
            <view class="file-meta">
              <text class="file-size">
                {{ formatSize(file.size) }}
              </text>
              <text class="file-date">
                {{ file.date }}
              </text>
            </view>
            <view class="file-tags">
              <text class="file-source-tag">
                {{ file.source || '本地文件' }}
              </text>
              <text class="file-status-tag" :class="'status-' + file.status">
                {{ getStatusLabel(file.status) }}
              </text>
            </view>
          </view>
        </view>
        <view class="file-actions">
          <view class="action-btn view-btn" @tap="viewFile(file)">
            <text class="action-text"> 查看 </text>
          </view>
          <view class="action-btn delete-btn" @tap="deleteFile(index)">
            <text class="action-text"> 删除 </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BaseEmpty v-else icon="folder" title="暂无文件" desc="导入学习资料后，文件将显示在这里" />
  </view>
</template>

<script>
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
// ✅ 文件处理工具
import { fileHandler } from './file-handler.js';
// F019: storageService
import storageService from '@/services/storageService.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: { BaseEmpty, BaseIcon },
  data() {
    return {
      isDark: false,
      files: [],
      isPageLoading: true // F018: 页面加载状态
    };
  },
  onLoad() {
    // 初始化主题
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    // 监听全局主题更新事件
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // E005: 不在 onLoad 调用 loadFiles，onShow 会覆盖
  },
  onShow() {
    this.loadFiles();
  },
  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate', this._themeHandler);
  },
  methods: {
    loadFiles() {
      // 从本地存储加载文件列表
      logger.log('[文件管理] 🔍 开始加载文件列表');
      try {
        let savedFiles = storageService.get('imported_files', []);

        // E005: 仅首次尝试备份恢复，避免每次 onShow 都执行
        if (savedFiles.length === 0 && !this._recoveryAttempted) {
          this._recoveryAttempted = true;
          logger.warn('[文件管理] ⚠️ 文件列表为空，尝试从备份恢复...');
          try {
            const backup = storageService.get('imported_files_backup');
            if (backup) {
              const restored = JSON.parse(backup);
              if (Array.isArray(restored) && restored.length > 0) {
                logger.log('[文件管理] 🔄 从备份恢复文件列表:', restored.length, '个文件');
                storageService.save('imported_files', restored);
                savedFiles = restored;
                uni.showToast({
                  title: '已从备份恢复文件列表',
                  icon: 'success',
                  duration: 2000
                });
              }
            }
          } catch (restoreErr) {
            logger.error('[文件管理] ❌ 恢复备份失败:', restoreErr);
          }
        }

        this.files = savedFiles;
      } catch (err) {
        logger.error('[文件管理] ❌ 加载文件列表异常:', err);
        this.files = [];
      } finally {
        this.isPageLoading = false;
      }
    },

    goBack() {
      safeNavigateBack();
    },

    /**
     * 获取文件图标
     */
    getFileIcon(fileName) {
      return fileHandler.getFileIcon(fileName);
    },

    /**
     * 查看文件 - 使用 fileHandler 统一处理
     */
    async viewFile(file) {
      logger.log('[文件管理] 📄 查看文件:', file.name);

      const fileName = file.name || '';
      const _ext = fileHandler.getFileExtension(fileName);
      const filePath = file.path || file.tempFilePath || file.url;

      // 如果有本地路径或 URL，尝试预览
      if (filePath) {
        // 显示 Loading
        uni.showLoading({ title: '加载中...', mask: true });

        try {
          const result = await fileHandler.previewFile({
            name: fileName,
            path: filePath
          });

          uni.hideLoading();

          if (!result.success && !result.error?.includes('unsupported')) {
            // 预览失败，显示文件信息
            this.showFileInfo(file);
          }
        } catch (err) {
          uni.hideLoading();
          logger.error('[文件管理] ❌ 文件预览失败:', err);
          this.showFileInfo(file);
        }
      } else {
        // 没有本地路径，显示文件信息
        this.showFileInfo(file);
      }
    },

    showFileInfo(file) {
      const ext = fileHandler.getFileExtension(file.name);
      const icon = fileHandler.getFileIcon(file.name);

      const info = `文件名：${file.name}\n类型：${ext.toUpperCase()}\n大小：${this.formatSize(file.size)}\n来源：${file.source || '本地文件'}\n状态：${this.getStatusLabel(file.status)}\n导入时间：${file.date || '未知'}`;

      uni.showModal({
        title: `${icon} 文件信息`,
        content: info,
        confirmText: '知道了',
        showCancel: false
      });
    },

    formatSize(size) {
      if (!size) return '0 KB';
      // 如果 size 已经是 KB 单位
      if (typeof size === 'number' && size < 10000) {
        return `${size} KB`;
      }
      // 如果 size 是字节单位
      return fileHandler.formatFileSize(size);
    },

    getStatusLabel(status) {
      const statusMap = {
        generating: '生成中',
        completed: '已完成',
        paused: '已暂停',
        failed: '失败',
        ready: '待处理',
        cancelled: '已取消'
      };
      return statusMap[status] || '待处理';
    },

    deleteFile(index) {
      uni.showModal({
        title: '确认删除',
        content: `确定要删除文件 "${this.files[index].name}" 吗？`,
        success: (res) => {
          if (res.confirm) {
            const file = this.files[index];
            this.files.splice(index, 1);
            storageService.save('imported_files', this.files);

            // 如果删除的文件正在生成，停止生成并清理题库
            if (file.status === 'generating') {
              // 清理题库中由该文件生成的题目
              const _bank = storageService.get('v30_bank', []);
              // 注意：这里简化处理，实际应该根据文件ID关联题目
              // 暂时不清空整个题库，只提示用户
              uni.showToast({
                title: '文件已删除，题库仍保留',
                icon: 'none',
                duration: 2000
              });
            } else {
              uni.showToast({ title: '删除成功', icon: 'success' });
            }
          }
        }
      });
    },

    clearAll() {
      if (this.files.length === 0) {
        uni.showToast({ title: '暂无文件可删除', icon: 'none' });
        return;
      }

      uni.showModal({
        title: '清空文件',
        content: '确定要删除所有文件吗？此操作不可恢复。',
        success: (res) => {
          if (res.confirm) {
            this.files = [];
            storageService.save('imported_files', []);
            uni.showToast({ title: '已清空所有文件', icon: 'success' });
          }
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
/* 基础样式 */
.file-manager-container {
  min-height: 100%;
  min-height: 100vh;
  background-color: var(--bg-body, var(--bg-card));
  padding: 20px;
  box-sizing: border-box;
  color: var(--text-secondary, #495057);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s ease;
}

/* 深色模式 */
.file-manager-container.dark-mode {
  --bg-body: var(--bg-body);
  --text-secondary: var(--text-secondary);
  --text-primary: var(--bg-card);
  --card-bg: var(--bg-glass);
  --card-border: var(--border-dark);
  --action-blue: var(--info-blue);
  --danger-red: var(--danger-red);
}

/* 顶部导航 */
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 40px;
  margin-bottom: 24px;
}

.nav-left {
  display: flex;
  align-items: center;
  /* gap: 8px; -- replaced for Android WebView compat */
}

.back-arrow {
  font-size: 48rpx;
  color: var(--text-primary, var(--text-primary));
}

.nav-title {
  font-size: 56rpx;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary));
}

.nav-right {
  display: flex;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--bg-info-light);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.icon-btn:active {
  background-color: var(--bg-info);
  transform: scale(1.05);
}

/* 文件列表 */
.file-list {
  background-color: var(--card-bg, var(--bg-card));
  border: 1px solid var(--card-border, var(--border-light));
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.file-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 20px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
  transition: background-color 0.2s ease;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:active {
  background-color: var(--bg-hover);
}

.file-left {
  display: flex;
  align-items: flex-start;
  /* gap: 16px; -- replaced for Android WebView compat */
  flex: 1;
  min-width: 0;
}

.file-icon {
  flex-shrink: 0;
}

.file-icon .emoji {
  font-size: 80rpx;
}

.file-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  /* gap: 8px; -- replaced for Android WebView compat */
}

.file-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
  line-height: 1.4;
  word-break: break-all;
  display: block;
}

.file-meta {
  display: flex;
  /* gap: 12px; -- replaced for Android WebView compat */
  font-size: 26rpx;
  color: var(--text-secondary, #495057);
}

.file-size,
.file-date {
  color: var(--text-tertiary);
}

.file-tags {
  display: flex;
  /* gap: 8px; -- replaced for Android WebView compat */
  flex-wrap: wrap;
}

.file-source-tag {
  padding: 4px 10px;
  border-radius: 12px;
  background-color: var(--bg-tag);
  color: var(--text-secondary);
  font-size: 24rpx;
  white-space: nowrap;
}

.file-status-tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 24rpx;
  font-weight: 500;
  white-space: nowrap;
}

.file-status-tag.status-generating {
  background-color: var(--bg-info-light);
  color: var(--info-blue);
}

.file-status-tag.status-completed {
  background-color: var(--bg-success-light);
  color: var(--success-green);
}

.file-status-tag.status-paused {
  background-color: var(--bg-warning-light);
  color: var(--warning);
}

.file-status-tag.status-failed {
  background-color: var(--bg-danger-light);
  color: var(--danger-red);
}

/* 文件操作 */
.file-actions {
  display: flex;
  flex-direction: column;
  /* gap: 8px; -- replaced for Android WebView compat */
  flex-shrink: 0;
  margin-left: 16px;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 26rpx;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  transition: all 0.2s ease;
  min-width: 60px;
}

.view-btn {
  background-color: var(--bg-info-light);
  color: var(--info-blue);
}

.view-btn:active {
  background-color: var(--bg-info);
}

.delete-btn {
  background-color: var(--bg-danger-light);
  color: var(--danger-red);
}

.delete-btn:active {
  background-color: var(--bg-danger);
}

/* F018: 骨架屏样式 */
.skeleton-container {
  background-color: var(--card-bg, var(--bg-card));
  border: 1px solid var(--card-border, var(--border-light));
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.skeleton-file-item {
  display: flex;
  align-items: flex-start;
  /* gap: 16px; -- replaced for Android WebView compat */
  padding: 24px 20px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
}

.skeleton-file-item:last-child {
  border-bottom: none;
}

.skeleton-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
}

.skeleton-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 10px; -- replaced for Android WebView compat */
}

.skeleton-name {
  height: 18px;
  width: 60%;
  border-radius: 4px;
}

.skeleton-meta {
  height: 14px;
  width: 40%;
  border-radius: 4px;
}

.skeleton-tags {
  height: 14px;
  width: 30%;
  border-radius: 4px;
}

.skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--bg-secondary, #f0f0f0) 25%,
    var(--bg-hover, #e0e0e0) 50%,
    var(--bg-secondary, #f0f0f0) 75%
  );
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.dark-mode .skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--bg-glass, #2a2a2a) 25%,
    var(--overlay, #3a3a3a) 50%,
    var(--bg-glass, #2a2a2a) 75%
  );
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary, #495057);
}

.empty-icon {
  font-size: 160rpx;
  display: block;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-title {
  font-size: 40rpx;
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
  margin: 0 0 8px 0;
}

.empty-desc {
  font-size: 28rpx;
  margin: 0;
  opacity: 0.7;
}
</style>
