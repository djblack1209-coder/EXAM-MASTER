/**
 * 复习 Store — MVP stub
 */
import { defineStore } from 'pinia';

export const useReviewStore = defineStore('review', {
  state: () => ({
    reviewQueue: [],
    reviewStats: { total: 0, completed: 0 }
  }),
  getters: {
    pendingCount: () => 0,
    hasReviewItems: () => false
  },
  actions: {
    async loadReviewQueue() {
      return [];
    },
    async submitReview() {
      return { success: false };
    },
    async getReviewStats() {
      return this.reviewStats;
    },
    clearQueue() {
      this.reviewQueue = [];
    }
  }
});
