import { defineStore } from 'pinia';

import {
  browseQuestions as apiBrowseQuestions,
  getQuestionBankRandom,
  getQuestionBankStats
} from '@/services/api/domains/practice.api.js';
import {
  buildQuestionBankStats,
  filterBankQuestions,
  sampleBankQuestions
} from '@/services/resource-intake-contract.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

function isOk(res) {
  return Boolean(res?.success === true || res?.code === 0 || res?.ok === true);
}

function localBank() {
  return storageService.get('v30_bank', []) || [];
}

const PRODUCTION_CATEGORY_ALLOWLIST = new Set(['政治', '英语', '数学']);

function filterCategoriesByAllowlist(categories) {
  if (!Array.isArray(categories)) return [];
  return categories.filter((c) => PRODUCTION_CATEGORY_ALLOWLIST.has(String(c.category || '').trim()));
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
      this.loading = true;
      this.lastError = null;
      try {
        const res = await getQuestionBankStats();
        if (isOk(res) && res.data) {
          this.questionBankStats = {
            total: Number(res.data.total || 0),
            categories: filterCategoriesByAllowlist(Array.isArray(res.data.categories) ? res.data.categories : [])
          };
          return { success: true, data: this.questionBankStats, source: 'remote' };
        }
      } catch (error) {
        this.lastError = error;
        logger.warn('[reviewStore] remote stats failed, using local bank:', error);
      } finally {
        this.loading = false;
      }

      this.questionBankStats = buildQuestionBankStats(localBank());
      return { success: true, data: this.questionBankStats, source: 'local' };
    },

    async browseQuestions(params = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        const res = await apiBrowseQuestions(params);
        if (isOk(res) && res.data) {
          const data = {
            list: Array.isArray(res.data.list) ? res.data.list : [],
            total: Number(res.data.total || 0),
            page: Number(res.data.page || params.page || 1),
            pageSize: Number(res.data.pageSize || params.pageSize || 20),
            hasMore: Boolean(res.data.hasMore)
          };
          this.questionBankList = data.list;
          return { success: true, data, source: 'remote' };
        }
      } catch (error) {
        this.lastError = error;
        logger.warn('[reviewStore] remote question browse failed, using local bank:', error);
      } finally {
        this.loading = false;
      }

      const data = filterBankQuestions(localBank(), params);
      this.questionBankList = data.list;
      return { success: true, data, source: 'local' };
    },

    async fetchQuestionBankRandom(params = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        const res = await getQuestionBankRandom(params);
        if (isOk(res) && Array.isArray(res.data)) {
          return { success: true, data: res.data, source: 'remote' };
        }
      } catch (error) {
        this.lastError = error;
        logger.warn('[reviewStore] remote random questions failed, using local bank:', error);
      } finally {
        this.loading = false;
      }

      return { success: true, data: sampleBankQuestions(localBank(), params), source: 'local' };
    }
  }
});
