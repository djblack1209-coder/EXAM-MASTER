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
      try {
        this.favorites = getLocalFavorites();
        this.folders = getLocalFolders();
        this.stats = getLocalFavoriteStats();
        this.lastError = null;
      } catch (error) {
        if (error.code === 'SESSION_UNAVAILABLE') {
          this.lastError = error;
          return { favorites: this.favorites, folders: this.folders, stats: this.stats };
        }
        this.favorites = [];
        this.folders = [];
        this.stats = { totalCount: 0, reviewedCount: 0, needReviewCount: 0, withNoteCount: 0 };
        this.lastError = error;
      }
      return { favorites: this.favorites, folders: this.folders, stats: this.stats };
    },

    async loadFavorites(options = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        this.favorites = getLocalFavorites(options);
        return this.favorites;
      } catch (error) {
        this.lastError = error;
        if (error.code !== 'SESSION_UNAVAILABLE') this.favorites = [];
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

    async toggleFavorite(question, folderId = 'default', expectedOwner) {
      const result = toggleLocalFavorite(question, folderId, expectedOwner);
      this.syncState();
      const isFavorite = isLocalFavorited(question);
      return {
        ...result,
        // do-quiz uses this field to update the button immediately.
        isFavorited: isFavorite,
        message: result.success ? (isFavorite ? '收藏成功' : '已取消收藏') : result.error || '收藏失败'
      };
    },

    async checkIsFavorited(questionOrId) {
      return isLocalFavorited(questionOrId);
    },

    async removeFromFavorite(questionOrId, expectedOwner) {
      const result = removeLocalFavorite(questionOrId, expectedOwner);
      this.syncState();
      return {
        ...result,
        message: result.success ? '已取消收藏' : result.error || '取消收藏失败'
      };
    },

    createFolder(folderData = {}, expectedOwner) {
      const result = createLocalFolder(folderData, expectedOwner);
      this.syncState();
      return result;
    },

    moveToFolder(favoriteId, targetFolderId, expectedOwner) {
      const result = moveLocalToFolder(favoriteId, targetFolderId, expectedOwner);
      this.syncState();
      return result;
    },

    updateNote(favoriteId, note, expectedOwner) {
      const result = updateLocalNote(favoriteId, note, expectedOwner);
      this.syncState();
      return result;
    },

    deleteFolder(folderId, expectedOwner) {
      const result = questionFavoriteManager.deleteFolder(folderId, expectedOwner);
      this.syncState();
      return result;
    },

    renameFolder(folderId, name, expectedOwner) {
      const result = questionFavoriteManager.renameFolder(folderId, name, expectedOwner);
      this.syncState();
      return result;
    },

    preparePractice(favoriteId, expectedOwner) {
      return questionFavoriteManager.preparePractice(favoriteId, expectedOwner);
    },

    startPractice(favoriteId, expectedOwner, options) {
      return questionFavoriteManager.startPractice(favoriteId, expectedOwner, options);
    },

    recordReview(favoriteId) {
      const result = questionFavoriteManager.recordReview(favoriteId);
      this.syncState();
      return result;
    }
  }
});
