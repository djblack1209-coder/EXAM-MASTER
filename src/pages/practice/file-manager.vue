<template>
  <view class="file-manager-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 -->
    <view class="top-nav">
      <view class="nav-left" @tap="goBack">
        <text class="back-arrow">←</text>
        <text class="nav-title">文件管理</text>
      </view>
      <view class="nav-right">
        <view class="icon-btn danger" @tap="clearAll" v-if="files.length > 0">
          <text style="font-size: 18px;">🗑️</text>
        </view>
      </view>
    </view>

    <!-- 文件列表 -->
    <view class="file-list" v-if="files.length > 0">
      <view 
        v-for="(file, index) in files" 
        :key="index" 
        class="file-item"
      >
        <view class="file-left">
          <view class="file-icon">
            <text class="emoji">📄</text>
          </view>
          <view class="file-details">
            <text class="file-name">{{ file.name }}</text>
            <view class="file-meta">
              <text class="file-size">{{ formatSize(file.size) }}</text>
              <text class="file-date">{{ file.date }}</text>
            </view>
            <view class="file-tags">
              <text class="file-source-tag">{{ file.source || '本地文件' }}</text>
              <text class="file-status-tag" :class="'status-' + file.status">{{ getStatusLabel(file.status) }}</text>
            </view>
          </view>
        </view>
        <view class="file-actions">
          <view class="action-btn view-btn" @tap="viewFile(file)">
            <text class="action-text">查看</text>
          </view>
          <view class="action-btn delete-btn" @tap="deleteFile(index)">
            <text class="action-text">删除</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <text class="empty-icon">📁</text>
      <h3 class="empty-title">暂无文件</h3>
      <p class="empty-desc">导入学习资料后，文件将显示在这里</p>
    </view>
  </view>
</template>

<script>
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

export default {
  data() {
    return {
      isDark: false,
      files: []
    };
  },
  onLoad() {
    // 初始化主题
    const savedTheme = uni.getStorageSync('theme_mode') || 'light';
    this.isDark = savedTheme === 'dark';
    
    // 监听全局主题更新事件
    uni.$on('themeUpdate', (mode) => {
      this.isDark = mode === 'dark';
    });
    
    // 加载文件列表
    this.loadFiles();
  },
  onShow() {
    this.loadFiles();
  },
  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate');
  },
  methods: {
    loadFiles() {
      // 从本地存储加载文件列表
      logger.log('[文件管理] 🔍 开始加载文件列表');
      let savedFiles = uni.getStorageSync('imported_files') || [];
      
      // 如果主数据为空，尝试从备份恢复
      if (savedFiles.length === 0) {
        logger.warn('[文件管理] ⚠️ 文件列表为空，尝试从备份恢复...');
        try {
          const backup = uni.getStorageSync('imported_files_backup');
          if (backup) {
            const restored = JSON.parse(backup);
            if (Array.isArray(restored) && restored.length > 0) {
              logger.log('[文件管理] 🔄 从备份恢复文件列表:', restored.length, '个文件');
              uni.setStorageSync('imported_files', restored);
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
      
      logger.log('[文件管理] 📋 从存储读取到的文件:', {
        count: savedFiles.length,
        files: savedFiles
      });
      this.files = savedFiles;
      logger.log('[文件管理] ✅ 文件列表已加载到页面，当前显示:', this.files.length, '个文件');
    },
    goBack() {
      uni.navigateBack();
    },
    viewFile(file) {
      uni.showToast({ title: '文件预览即将上线', icon: 'none' });
    },
    formatSize(size) {
      if (!size) return '0 KB';
      return `${size} KB`;
    },
    getStatusLabel(status) {
      if (status === 'generating') return '生成中';
      if (status === 'completed') return '已完成';
      if (status === 'paused') return '已暂停';
      if (status === 'failed') return '失败';
      return '待处理';
    },
    deleteFile(index) {
      uni.showModal({
        title: '确认删除',
        content: `确定要删除文件 "${this.files[index].name}" 吗？`,
        success: (res) => {
          if (res.confirm) {
            const file = this.files[index];
            this.files.splice(index, 1);
            uni.setStorageSync('imported_files', this.files);
            
            // 如果删除的文件正在生成，停止生成并清理题库
            if (file.status === 'generating') {
              // 清理题库中由该文件生成的题目
              const bank = uni.getStorageSync('v30_bank') || [];
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
            uni.setStorageSync('imported_files', []);
            uni.showToast({ title: '已清空所有文件', icon: 'success' });
          }
        }
      });
    }
  }
};
</script>

<style scoped>
/* 基础样式 */
.file-manager-container {
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
  gap: 8px;
}

.back-arrow {
  font-size: 24px;
  color: var(--text-primary, var(--text-primary));
}

.nav-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary));
}

.nav-right {
  display: flex;
  gap: 12px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--bg-info-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
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

.file-item:hover {
  background-color: var(--bg-hover);
}

.file-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  flex-shrink: 0;
}

.file-icon .emoji {
  font-size: 40px;
}

.file-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
  line-height: 1.4;
  word-break: break-all;
  display: block;
}

.file-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary, #495057);
}

.file-size,
.file-date {
  color: var(--text-tertiary);
}

.file-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.file-source-tag {
  padding: 4px 10px;
  border-radius: 12px;
  background-color: var(--bg-tag);
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.file-status-tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
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
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
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

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary, #495057);
}

.empty-icon {
  font-size: 80px;
  display: block;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
  margin: 0 0 8px 0;
}

.empty-desc {
  font-size: 14px;
  margin: 0;
  opacity: 0.7;
}
</style>