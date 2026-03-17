<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="header-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-back" @tap="goBack"> ← </text>
        <text class="nav-title"> 我的收藏 </text>
        <view class="nav-actions">
          <text class="nav-action" @tap="showFolderModal = true"> + </text>
        </view>
      </view>
    </view>

    <!-- ✅ F018: 加载状态 -->
    <view v-if="isLoading" class="loading-state" :style="{ paddingTop: statusBarHeight + 60 + 'px' }">
      <view class="loading-spinner" />
      <text class="loading-text"> 加载中... </text>
    </view>

    <scroll-view
      v-else
      scroll-y
      class="main-scroll"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
      @scrolltolower="loadMoreFavorites"
    >
      <!-- 统计卡片 -->
      <view class="stats-row apple-glass-card">
        <view class="stat-item">
          <text class="stat-value">
            {{ totalFavorites }}
          </text>
          <text class="stat-label"> 总收藏 </text>
        </view>
        <view class="stat-item">
          <text class="stat-value">
            {{ reviewedCount }}
          </text>
          <text class="stat-label"> 已复习 </text>
        </view>
        <view class="stat-item">
          <text class="stat-value">
            {{ needReviewCount }}
          </text>
          <text class="stat-label"> 待复习 </text>
        </view>
        <view class="stat-item">
          <text class="stat-value">
            {{ withNoteCount }}
          </text>
          <text class="stat-label"> 有笔记 </text>
        </view>
      </view>

      <!-- 收藏夹列表 -->
      <view class="folder-section">
        <view class="section-header">
          <text class="section-title"> 收藏夹 </text>
          <text class="section-action" @tap="showFolderModal = true"> + 新建 </text>
        </view>
        <view class="folder-grid">
          <!-- 全部收藏 -->
          <view
            class="folder-card apple-glass-card"
            :class="{ active: currentFolderId === null }"
            @tap="selectFolder(null)"
          >
            <BaseIcon name="books" :size="36" class="folder-icon" />
            <text class="folder-name"> 全部收藏 </text>
            <text class="folder-count"> {{ totalFavorites }} 题 </text>
          </view>
          <view
            v-for="folder in folders"
            :key="folder.id"
            class="folder-card apple-glass-card"
            :class="{ active: currentFolderId === folder.id }"
            @tap="selectFolder(folder.id)"
            @longpress="showFolderActions(folder)"
          >
            <BaseIcon :name="folder.icon" :size="36" class="folder-icon" />
            <text class="folder-name">
              {{ folder.name }}
            </text>
            <text class="folder-count"> {{ folder.count }} 题 </text>
            <view v-if="!folder.isDefault" class="folder-delete" @tap.stop="confirmDeleteFolder(folder)"> × </view>
          </view>
        </view>
      </view>

      <!-- 收藏题目列表 -->
      <view class="favorites-section">
        <view class="section-header">
          <text class="section-title">
            {{ currentFolderName }}
          </text>
          <view class="sort-btn apple-glass-pill" @tap="toggleSort">
            <text class="sort-icon"> ↕ </text>
            <text class="sort-text">
              {{ sortLabel }}
            </text>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="filteredFavorites.length === 0" class="empty-box">
          <BaseIcon name="star-outline" :size="80" class="empty-icon" />
          <text class="empty-title"> 暂无收藏 </text>
          <text class="empty-text"> 刷题时点击星标即可收藏题目 </text>
        </view>

        <!-- 题目列表 (F007: 增量渲染，避免一次性渲染全部DOM) -->
        <view v-for="item in displayedFavorites" :key="item.id" class="favorite-card apple-group-card">
          <view class="card-header">
            <view class="card-tag">
              {{ item.category }}
            </view>
            <view class="card-actions">
              <BaseIcon name="folder" :size="28" @tap.stop="moveToFolder(item)" />
              <BaseIcon name="delete" :size="28" @tap.stop="removeFavorite(item)" />
            </view>
          </view>

          <text class="question-text">
            {{ item.questionContent }}
          </text>

          <view v-if="showOptions[item.id]" class="options-list">
            <view
              v-for="(opt, i) in item.options"
              :key="i"
              class="option-row"
              :class="{ correct: ['A', 'B', 'C', 'D'][i] === item.answer }"
            >
              <text class="opt-idx">
                {{ ['A', 'B', 'C', 'D'][i] }}
              </text>
              <text class="opt-text">
                {{ opt }}
              </text>
            </view>
          </view>

          <view v-if="showOptions[item.id] && item.analysis" class="analysis-box">
            <text class="analysis-label"> 解析： </text>
            <text class="analysis-text">
              {{ item.analysis }}
            </text>
          </view>

          <view class="card-footer">
            <text class="time-text"> 收藏于 {{ formatDate(item.createdAt) }} </text>
            <view class="footer-actions">
              <button class="action-btn apple-glass-pill" @tap="toggleOptions(item.id)">
                {{ showOptions[item.id] ? '收起' : '查看答案' }}
              </button>
              <button class="action-btn primary apple-cta" @tap="practiceQuestion(item)">练习此题</button>
            </view>
          </view>

          <!-- 笔记区域 -->
          <view v-if="item.note" class="note-section">
            <text class="note-label"> <BaseIcon name="note" :size="22" /> 我的笔记 </text>
            <text class="note-content">
              {{ item.note }}
            </text>
          </view>
          <view v-else class="add-note" @tap="openNoteModal(item)">
            <text class="add-note-text"> + 添加笔记 </text>
          </view>
        </view>
      </view>

      <view class="safe-area" />
    </scroll-view>

    <!-- 新建收藏夹弹窗 -->
    <view v-if="showFolderModal" class="modal-overlay" @tap="showFolderModal = false">
      <view class="modal-content apple-glass-card" @tap.stop>
        <view class="modal-header">
          <text class="modal-title"> 新建收藏夹 </text>
          <text class="modal-close" @tap="showFolderModal = false"> × </text>
        </view>
        <view class="modal-body">
          <input v-model="newFolderName" class="modal-input" placeholder="输入收藏夹名称" maxlength="10" />
          <view class="icon-picker">
            <text class="picker-label"> 选择图标 </text>
            <view class="icon-grid">
              <view
                v-for="icon in folderIcons"
                :key="icon"
                class="icon-option"
                :class="{ selected: newFolderIcon === icon }"
                @tap="newFolderIcon = icon"
              >
                <BaseIcon :name="icon" :size="32" />
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn secondary" @tap="showFolderModal = false">取消</button>
          <button class="modal-btn primary" @tap="createFolder">创建</button>
        </view>
      </view>
    </view>

    <!-- 移动到收藏夹弹窗 -->
    <view v-if="showMoveModal" class="modal-overlay" @tap="showMoveModal = false">
      <view class="modal-content apple-glass-card" @tap.stop>
        <view class="modal-header">
          <text class="modal-title"> 移动到 </text>
          <text class="modal-close" @tap="showMoveModal = false"> × </text>
        </view>
        <view class="modal-body">
          <view
            v-for="folder in folders"
            :key="folder.id"
            class="folder-option"
            :class="{ disabled: folder.id === movingItem?.folderId }"
            @tap="confirmMove(folder.id)"
          >
            <BaseIcon :name="folder.icon" :size="36" class="folder-option-icon" />
            <text class="folder-option-name">
              {{ folder.name }}
            </text>
            <text class="folder-option-count"> {{ folder.count }} 题 </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 笔记编辑弹窗 -->
    <view v-if="showNoteModal" class="modal-overlay" @tap="showNoteModal = false">
      <view class="modal-content apple-glass-card" @tap.stop>
        <view class="modal-header">
          <text class="modal-title"> 添加笔记 </text>
          <text class="modal-close" @tap="showNoteModal = false"> × </text>
        </view>
        <view class="modal-body">
          <textarea
            v-model="noteContent"
            class="note-textarea"
            placeholder="记录你的学习心得..."
            maxlength="500"
          ></textarea>
        </view>
        <view class="modal-footer">
          <button class="modal-btn secondary" @tap="showNoteModal = false">取消</button>
          <button class="modal-btn primary" @tap="saveNote">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import {
  getFavorites,
  getFolders,
  createFolder as createFavoriteFolder,
  moveToFolder as moveFavoriteToFolder,
  removeFavorite as removeFromFavorites,
  updateNote,
  getFavoriteStats
} from '@/utils/favorite/question-favorite.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import questionFavoriteManager from '@/utils/favorite/question-favorite.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: { BaseIcon },
  data() {
    return {
      statusBarHeight: 44,
      isDark: false,
      isLoading: true, // ✅ F018: 加载状态

      // 收藏夹
      folders: [],
      currentFolderId: null,

      // 收藏列表
      favorites: [],
      showOptions: {},

      // 排序
      sortBy: 'createdAt',
      sortOrder: 'desc',

      // 弹窗状态
      showFolderModal: false,
      showMoveModal: false,
      showNoteModal: false,

      // 新建收藏夹
      newFolderName: '',
      newFolderIcon: 'folder',
      folderIcons: ['folder', 'star', 'flame', 'bulb', 'books', 'target', 'muscle', 'trophy', 'note', 'bookmark'],

      // 移动操作
      movingItem: null,

      // 笔记编辑
      editingItem: null,
      noteContent: '',

      // 统计数据
      stats: {
        totalCount: 0,
        reviewedCount: 0,
        needReviewCount: 0,
        withNoteCount: 0
      },

      // F007: 增量渲染 — 每次显示20条，滚动到底部加载更多
      displayCount: 20
    };
  },
  computed: {
    currentFolderName() {
      if (!this.currentFolderId) return '全部收藏';
      const folder = this.folders.find((f) => f.id === this.currentFolderId);
      return folder ? folder.name : '全部收藏';
    },
    filteredFavorites() {
      let result = [...this.favorites];

      if (this.currentFolderId) {
        result = result.filter((f) => f.folderId === this.currentFolderId);
      }

      result.sort((a, b) => {
        const aVal = a[this.sortBy] || 0;
        const bVal = b[this.sortBy] || 0;
        return this.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      return result;
    },
    // F007: 增量渲染 — 只渲染前 displayCount 条到 DOM
    displayedFavorites() {
      return this.filteredFavorites.slice(0, this.displayCount);
    },
    sortLabel() {
      if (this.sortBy === 'createdAt') {
        return this.sortOrder === 'desc' ? '最新' : '最早';
      }
      return '排序';
    },
    totalFavorites() {
      return this.stats.totalCount || this.favorites.length;
    },
    reviewedCount() {
      return this.stats.reviewedCount || 0;
    },
    needReviewCount() {
      return this.stats.needReviewCount || 0;
    },
    withNoteCount() {
      return this.stats.withNoteCount || 0;
    }
  },
  onLoad() {
    this.initSystemUI();
    this.loadData();

    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    // ✅ F024: 监听主题实时切换
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);
  },
  onShow() {
    this.loadData();
  },
  onUnload() {
    uni.$off('themeUpdate', this._themeHandler);
  },
  methods: {
    initSystemUI() {
      this.statusBarHeight = getStatusBarHeight();
    },

    loadData() {
      try {
        this.folders = getFolders();
        this.favorites = getFavorites();
        // 加载统计数据
        this.stats = getFavoriteStats();
        logger.log('[favorite] 数据加载完成:', {
          folders: this.folders.length,
          favorites: this.favorites.length,
          stats: this.stats
        });
      } catch (e) {
        logger.warn('[favorite] 加载数据失败:', e);
      } finally {
        this.isLoading = false; // ✅ F018
      }
    },

    goBack() {
      uni.navigateBack();
    },

    selectFolder(folderId) {
      this.currentFolderId = folderId;
      this.displayCount = 20; // F007: 切换收藏夹时重置增量渲染计数
    },

    toggleSort() {
      if (this.sortOrder === 'desc') {
        this.sortOrder = 'asc';
      } else {
        this.sortOrder = 'desc';
      }
      this.displayCount = 20; // F007: 切换排序时重置增量渲染计数
    },

    // F007: 滚动到底部时加载更多收藏
    loadMoreFavorites() {
      if (this.displayCount < this.filteredFavorites.length) {
        this.displayCount = Math.min(this.displayCount + 20, this.filteredFavorites.length);
      }
    },

    toggleOptions(itemId) {
      // Vue 3 reactivity handles dynamic property addition natively
      this.showOptions[itemId] = !this.showOptions[itemId];
    },

    formatDate(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    },

    // 显示收藏夹操作菜单
    showFolderActions(folder) {
      if (folder.isDefault) {
        uni.showToast({ title: '默认收藏夹不可操作', icon: 'none' });
        return;
      }
      uni.showActionSheet({
        itemList: ['重命名', '删除收藏夹'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.renameFolderPrompt(folder);
          } else if (res.tapIndex === 1) {
            this.confirmDeleteFolder(folder);
          }
        }
      });
    },

    // 重命名收藏夹
    renameFolderPrompt(folder) {
      // 简单实现：使用 modal 输入
      uni.showModal({
        title: '重命名收藏夹',
        editable: true,
        placeholderText: folder.name,
        success: (res) => {
          if (res.confirm && res.content && res.content.trim()) {
            // 更新收藏夹名称
            const idx = this.folders.findIndex((f) => f.id === folder.id);
            if (idx >= 0) {
              this.folders[idx].name = res.content.trim();
              storageService.save('favorite_folders', this.folders);
              uni.showToast({ title: '重命名成功', icon: 'success' });
              this.loadData();
            }
          }
        }
      });
    },

    // 确认删除收藏夹
    confirmDeleteFolder(folder) {
      uni.showModal({
        title: '删除收藏夹',
        content: `确定要删除"${folder.name}"吗？其中的收藏将移至默认收藏夹。`,
        success: (res) => {
          if (res.confirm) {
            const result = questionFavoriteManager.deleteFolder(folder.id);
            if (result.success) {
              uni.showToast({ title: '删除成功', icon: 'success' });
              this.loadData();
            } else {
              uni.showToast({ title: result.error || '删除失败', icon: 'none' });
            }
          }
        }
      });
    },

    // 创建收藏夹
    createFolder() {
      if (!this.newFolderName.trim()) {
        uni.showToast({ title: '请输入收藏夹名称', icon: 'none' });
        return;
      }

      const result = createFavoriteFolder({
        name: this.newFolderName.trim(),
        icon: this.newFolderIcon
      });

      if (result.success) {
        uni.showToast({ title: '创建成功', icon: 'success' });
        this.showFolderModal = false;
        this.newFolderName = '';
        this.newFolderIcon = 'folder';
        this.loadData();
      } else {
        uni.showToast({ title: result.error || '创建失败', icon: 'none' });
      }
    },

    // 移动到收藏夹
    moveToFolder(item) {
      this.movingItem = item;
      this.showMoveModal = true;
    },

    confirmMove(folderId) {
      if (!this.movingItem || folderId === this.movingItem.folderId) return;

      const result = moveFavoriteToFolder(this.movingItem.id, folderId);

      if (result.success) {
        uni.showToast({ title: '移动成功', icon: 'success' });
        this.showMoveModal = false;
        this.movingItem = null;
        this.loadData();
      } else {
        uni.showToast({ title: result.error || '移动失败', icon: 'none' });
      }
    },

    // 删除收藏
    removeFavorite(item) {
      uni.showModal({
        title: '确认取消收藏',
        content: '确定要取消收藏这道题吗？',
        success: (res) => {
          if (res.confirm) {
            const result = removeFromFavorites(item.id);
            if (result.success) {
              uni.showToast({ title: '已取消收藏', icon: 'success' });
              this.loadData();
            } else {
              uni.showToast({ title: result.message || '取消收藏失败', icon: 'none' });
            }
          }
        }
      });
    },

    // 笔记相关
    openNoteModal(item) {
      this.editingItem = item;
      this.noteContent = item.note || '';
      this.showNoteModal = true;
    },

    saveNote() {
      if (!this.editingItem) return;

      const result = updateNote(this.editingItem.id, this.noteContent.trim());

      if (result.success) {
        uni.showToast({ title: '保存成功', icon: 'success' });
        this.showNoteModal = false;
        this.editingItem = null;
        this.noteContent = '';
        this.loadData();
      } else {
        uni.showToast({ title: '保存失败', icon: 'none' });
      }
    },

    // 练习题目
    practiceQuestion(item) {
      try {
        // 将题目存入临时存储，跳转到答题页面
        storageService.save('temp_practice_question', {
          id: item.questionId,
          question: item.questionContent,
          options: item.options,
          answer: item.answer,
          desc: item.analysis,
          category: item.category
        });

        safeNavigateTo('/pages/practice-sub/do-quiz?mode=single');
      } catch (_error) {
        uni.showToast({ title: '跳转练习失败', icon: 'none' });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
}

.aurora-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 400rpx;
  background: var(--gradient-aurora);
  filter: blur(60px);
  z-index: 0;
}

/* 导航栏 */
.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx;
}

.nav-back {
  font-size: 40rpx;
  color: var(--text-primary);
  padding: 10rpx 20rpx;
}

.nav-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-actions {
  padding: 10rpx 20rpx;
}

.nav-action {
  font-size: 44rpx;
  color: var(--primary);
}

/* 主滚动区域 */
.main-scroll {
  height: 100%;
  height: 100vh;
  padding: 0 20rpx;
  box-sizing: border-box;
}

/* 统计卡片 */
.stats-row {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-around;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28rpx;
  padding: 24rpx 16rpx;
  margin-bottom: 30rpx;
  box-shadow: var(--apple-shadow-card);
}

.stats-row::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 8rpx;
  }
}

.stat-value {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-sub);
}

/* 收藏夹区域 */
.folder-section {
  margin-bottom: 30rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-action {
  font-size: 24rpx;
  color: var(--text-secondary);
  padding: 8rpx 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.folder-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
}

.folder-card {
  flex: 0 0 calc(25% - 12rpx);
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 24rpx;
  padding: 20rpx 16rpx;
  text-align: center;
  transition: all 0.2s ease;
  position: relative;
  box-shadow: var(--apple-shadow-surface);
  overflow: hidden;
}

.folder-card.active {
  border-color: var(--cta-primary-border);
  background: var(--cta-primary-bg);
  box-shadow: var(--cta-primary-shadow);
}

.folder-delete {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 32rpx;
  height: 32rpx;
  font-size: 24rpx;
  color: var(--text-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 50%;
}

.folder-icon {
  font-size: 36rpx;
  display: block;
  margin-bottom: 8rpx;
}

.folder-name {
  font-size: 22rpx;
  color: var(--text-primary);
  display: block;
  margin-bottom: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: 20rpx;
  color: var(--text-sub);
}

/* 收藏列表区域 */
.favorites-section {
  margin-bottom: 30rpx;
}

/* F016: 移除重复的 .section-header（已在 line 782 定义） */

.sort-btn {
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 8rpx;
  }
  padding: 8rpx 16rpx;
  min-height: 72rpx;
  background: rgba(255, 255, 255, 0.68);
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}

.sort-icon {
  font-size: 24rpx;
  color: var(--text-sub);
}

.sort-text {
  font-size: 22rpx;
  color: var(--text-sub);
}

/* 空状态 */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  text-align: center;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12rpx;
}

.empty-text {
  font-size: 26rpx;
  color: var(--text-sub);
}

/* 收藏卡片 */
.favorite-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--apple-shadow-card);
}

.favorite-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.card-tag {
  font-size: 20rpx;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.7);
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.card-actions {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
}

.action-icon {
  font-size: 28rpx;
  padding: 8rpx;
}

.question-text {
  font-size: 30rpx;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 20rpx;
  display: block;
}

/* 选项列表 */
.options-list {
  margin-bottom: 20rpx;
}

.option-row {
  display: flex;
  align-items: flex-start;
  padding: 16rpx;
  background: rgba(255, 255, 255, 0.58);
  border-radius: 20rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.44);
}

.option-row.correct {
  background: var(--success-light);
}

.opt-idx {
  width: 40rpx;
  font-weight: 600;
  color: var(--text-sub);
  flex-shrink: 0;
}

.option-row.correct .opt-idx {
  color: var(--success);
}

.opt-text {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-primary);
  line-height: 1.5;
}

/* 解析区域 */
.analysis-box {
  background: rgba(255, 255, 255, 0.54);
  border-radius: 20rpx;
  padding: 16rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.44);
}

.analysis-label {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8rpx;
  display: block;
}

.analysis-text {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

/* 卡片底部 */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.time-text {
  font-size: 22rpx;
  color: var(--text-sub);
}

.footer-actions {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 12rpx;
  }
}

.action-btn {
  font-size: 22rpx;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.68);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}

.action-btn.primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.action-btn::after {
  border: none;
}

/* 笔记区域 */
.note-section {
  margin-top: 16rpx;
  padding: 16rpx;
  background: linear-gradient(160deg, rgba(255, 250, 234, 0.72), rgba(255, 244, 204, 0.58));
  border-radius: 20rpx;
  border: 1rpx solid rgba(255, 214, 102, 0.26);
}

.note-label {
  font-size: 22rpx;
  color: var(--warning);
  margin-bottom: 8rpx;
  display: block;
}

.note-content {
  font-size: 24rpx;
  color: var(--text-primary);
  line-height: 1.5;
}

.add-note {
  margin-top: 16rpx;
  padding: 12rpx;
  text-align: center;
  border: 1px dashed var(--apple-divider);
  border-radius: 20rpx;
}

.add-note-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.modal-content {
  width: 100%;
  max-width: 600rpx;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28rpx;
  overflow: hidden;
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  font-size: 40rpx;
  color: var(--text-sub);
  padding: 8rpx;
}

.modal-body {
  padding: 24rpx;
}

.modal-input {
  width: 100%;
  height: 80rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  box-sizing: border-box;
}

.icon-picker {
  margin-top: 24rpx;
}

.picker-label {
  font-size: 24rpx;
  color: var(--text-sub);
  margin-bottom: 12rpx;
  display: block;
}

.icon-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
}

.icon-option {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  background: rgba(255, 255, 255, 0.66);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 18rpx;
}

.icon-option.selected {
  border-color: var(--cta-primary-border);
  background: var(--cta-primary-bg);
}

.modal-footer {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
  padding: 24rpx;
  border-top: 1px solid var(--apple-divider);
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  border: none;
}

.modal-btn.secondary {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.modal-btn.primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.modal-btn::after {
  border: none;
}

/* 收藏夹选项 */
.folder-option {
  display: flex;
  align-items: center;
  padding: 20rpx;
  border-bottom: 1px solid var(--apple-divider);
}

.folder-option:last-child {
  border-bottom: none;
}

.folder-option.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.folder-option-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}

.folder-option-name {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary);
}

.folder-option-count {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 笔记输入框 */
.note-textarea {
  width: 100%;
  height: 200rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24rpx;
  padding: 16rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  box-sizing: border-box;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid var(--border, #e0e0e0);
  border-top-color: var(--primary, #4f46e5);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 20rpx;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 26rpx;
  color: var(--text-sub, #999);
}

.safe-area {
  height: 100rpx;
}

/* 暗黑模式覆盖 */
.dark-mode .aurora-bg {
  opacity: 0.3;
}

.dark-mode .note-section {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.05), rgba(255, 152, 0, 0.05));
}
</style>
