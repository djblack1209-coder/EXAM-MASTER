import { defineStore } from 'pinia';
import { captureSession, assertSession } from '@/services/auth-storage.js';
import { retiredBankResponse } from '@/services/retired-question-bank.js';
function retired() {
  assertSession(captureSession());
  return retiredBankResponse();
}
export const useReviewStore = defineStore('review', {
  state: () => ({
    reviewQueue: [],
    reviewStats: { total: 0, completed: 0 },
    questionBankStats: { total: 0, categories: [] },
    questionBankList: [],
    loading: false,
    lastError: null
  }),
  getters: {
    pendingCount: (state) => state.reviewQueue.length,
    hasReviewItems: (state) => state.reviewQueue.length > 0
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
    },
    async fetchQuestionBankStats() {
      return retired();
    },
    async browseQuestions() {
      return retired();
    },
    async fetchQuestionBankRandom() {
      return retired();
    }
  }
});
