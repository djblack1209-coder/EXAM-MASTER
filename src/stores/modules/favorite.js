/**
 * 题目收藏 Store
 *
 * 收藏属于用户的本地学习资产。离线时直接复用 questionFavoriteManager，
 * 不依赖云端 API，保证答题页、收藏页和题库数据在同一份本地状态上闭环。
 */
import { defineStore } from 'pinia';
import questionFavoriteManager, {
  toggleFavorite as toggleLocalFavorite,
  isFavorited as isLocalFavorited,
  getFavorites as getLocalFavorites,
  getFolders as getLocalFolders,
  createFolder as createLocalFolder,
  moveToFolder as moveLocalToFolder,
  removeFavorite as removeLocalFavorite,
  updateNote as updateLocalNote,
  getFavoriteStats as getLocalFavoriteStats
} from '@/utils/favorite/question-favorite.js';

function questionKey(questionOrId) {
  if (questionOrId && typeof questionOrId === 'object') {
    return questionOrId.id || questionOrId._id || questionOrId.question || questionOrId.question_content || '';
  }
  return questionOrId || '';
}

export const useFavoriteStore = defineStore('favorite', {
  state: () => ({
    favorites: [],
    folders: [],
    stats: {
      totalCount: 0,
      reviewedCount: 0,
      needReviewCount: 0,
      withNoteCount: 0
    },
    loading: false,
    lastError: null
  }),

  getters: {
    totalCount: (state) => state.stats.totalCount || state.favorites.length,
    hasFavorites: (state) => state.favorites.length > 0
  },

  actions: {
    syncState() {
      this.favorites = getLocalFavorites();
      this.folders = getLocalFolders();
      this.stats = getLocalFavoriteStats();
      return {
        favorites: this.favorites,
        folders: this.folders,
        stats: this.stats
      };
    },

    async loadFavorites(options = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        this.favorites = getLocalFavorites(options);
        return this.favorites;
      } catch (error) {
        this.lastError = error;
        this.favorites = [];
        return this.favorites;
      } finally {
        this.loading = false;
      }
    },

    loadFolders() {
      this.folders = getLocalFolders();
      return this.folders;
    },

    loadStats() {
      this.stats = getLocalFavoriteStats();
      return this.stats;
    },

    async toggleFavorite(question, folderId = 'default') {
      const result = toggleLocalFavorite(question, folderId);
      this.syncState();
      const isFavorite = isLocalFavorited(questionKey(question));
      return {
        ...result,
        // do-quiz uses this field to update the button immediately.
        isFavorited: isFavorite,
        message: result.success ? (isFavorite ? '收藏成功' : '已取消收藏') : result.error || '收藏失败'
      };
    },

    async checkIsFavorited(questionOrId) {
      return isLocalFavorited(questionKey(questionOrId));
    },

    async removeFromFavorite(questionOrId) {
      const result = removeLocalFavorite(questionKey(questionOrId));
      this.syncState();
      return {
        ...result,
        message: result.success ? '已取消收藏' : result.error || '取消收藏失败'
      };
    },

    createFolder(folderData = {}) {
      const result = createLocalFolder(folderData);
      this.syncState();
      return result;
    },

    moveToFolder(favoriteId, targetFolderId) {
      const result = moveLocalToFolder(favoriteId, targetFolderId);
      this.syncState();
      return result;
    },

    updateNote(favoriteId, note) {
      const result = updateLocalNote(favoriteId, note);
      this.syncState();
      return result;
    },

    deleteFolder(folderId) {
      const result = questionFavoriteManager.deleteFolder(folderId);
      this.syncState();
      return result;
    },

    recordReview(favoriteId) {
      questionFavoriteManager.recordReview(favoriteId);
      this.syncState();
      return { success: true };
    }
  }
});
