/**
 * 收藏 Store — 极简版 MVP stub
 * 完整功能将在 APP 版本中实现
 */
import { defineStore } from 'pinia';

export const useFavoriteStore = defineStore('favorite', {
  state: () => ({
    favorites: []
  }),
  actions: {
    async toggleFavorite(/* question */) {
      // MVP stub — 收藏功能暂不实现
      return { success: false, message: '收藏功能即将上线' };
    },
    async checkIsFavorited(/* question */) {
      return false;
    }
  }
});
