import { defineStore } from 'pinia';

import { buildPublicCourseCoverage } from '@/config/bank-registry.js';
import {
  getByCategory,
  getHotResources,
  getRecommendations,
  searchResources
} from '@/services/api/domains/resource.api.js';
import {
  buildIntakeSnapshot,
  createImportRecord,
  normalizeImportRecord,
  updateImportRecordStatus
} from '@/services/resource-intake-contract.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

function isOk(res) {
  return Boolean(res?.success === true || res?.code === 0 || res?.ok === true);
}

function extractResourceList(res, key = 'resources') {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.[key])) return res.data[key];
  if (Array.isArray(res?.resources)) return res.resources;
  return [];
}

function extractPageInfo(res) {
  return {
    total: Number(res?.data?.total || res?.total || 0),
    hasMore: Boolean(res?.data?.hasMore || res?.hasMore)
  };
}

function getImportRecords() {
  return (storageService.get('imported_files', []) || []).map(normalizeImportRecord);
}

function saveImportRecords(records, debounced = false) {
  const normalized = (records || []).map(normalizeImportRecord);
  if (debounced) {
    storageService.saveDebounced('imported_files', normalized);
  } else {
    storageService.save('imported_files', normalized, true);
  }
  storageService.save('imported_files_backup', normalized, true);
  return normalized;
}

export const useResourceStore = defineStore('resource', {
  state: () => ({
    resources: [],
    recommendations: [],
    hotResources: [],
    categoryResources: [],
    searchResults: [],
    loading: false,
    hasMore: false,
    total: 0,
    lastError: null,
    intakeSnapshot: buildIntakeSnapshot()
  }),

  getters: {
    importRecords: (state) => state.intakeSnapshot.imports.records,
    intakeStatusLabel: (state) => state.intakeSnapshot.generation.label,
    releaseCoverageRate: (state) => state.intakeSnapshot.release.coverageRate
  },

  actions: {
    refreshIntakeSnapshot() {
      const records = getImportRecords();
      const bank = storageService.get('v30_bank', []) || [];
      const loadedBankIds = storageService.get('loaded_flashcard_banks', []) || [];
      const releaseCoverage = buildPublicCourseCoverage();
      this.intakeSnapshot = buildIntakeSnapshot({
        records,
        bank,
        loadedBankIds,
        releaseCoverage
      });
      return this.intakeSnapshot;
    },

    listImportRecords() {
      this.refreshIntakeSnapshot();
      return this.intakeSnapshot.imports.records;
    },

    replaceImportRecords(records, options = {}) {
      const normalized = saveImportRecords(records, Boolean(options.debounced));
      this.refreshIntakeSnapshot();
      return normalized;
    },

    addImportRecord(input, options = {}) {
      const records = getImportRecords();
      const record = createImportRecord(input, options);
      saveImportRecords([record, ...records], Boolean(options.debounced));
      this.refreshIntakeSnapshot();
      return record;
    },

    updateImportStatus(id, status, options = {}) {
      const records = updateImportRecordStatus(getImportRecords(), id, status, options);
      saveImportRecords(records, Boolean(options.debounced));
      this.refreshIntakeSnapshot();
      return records.find((record) => record.id === id) || null;
    },

    removeImportRecord(id) {
      const records = getImportRecords().filter((record) => record.id !== id);
      saveImportRecords(records);
      this.refreshIntakeSnapshot();
      return records;
    },

    clearImportRecords() {
      saveImportRecords([]);
      this.refreshIntakeSnapshot();
    },

    async fetchRecommendations(params = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        const res = await getRecommendations(params);
        const list = isOk(res) ? extractResourceList(res) : [];
        this.recommendations = list;
        return { success: isOk(res), data: list };
      } catch (error) {
        this.lastError = error;
        logger.warn('[resourceStore] fetchRecommendations failed:', error);
        this.recommendations = [];
        return { success: false, data: [] };
      } finally {
        this.loading = false;
      }
    },

    async fetchHotResources(params = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        const res = await getHotResources(params);
        const list = isOk(res) ? extractResourceList(res) : [];
        this.hotResources = list;
        return { success: isOk(res), data: list };
      } catch (error) {
        this.lastError = error;
        logger.warn('[resourceStore] fetchHotResources failed:', error);
        this.hotResources = [];
        return { success: false, data: [] };
      } finally {
        this.loading = false;
      }
    },

    async fetchByCategory(params = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        const res = await getByCategory({
          ...params,
          limit: params.limit || params.pageSize || 20
        });
        const list = isOk(res) ? extractResourceList(res) : [];
        const pageInfo = extractPageInfo(res);
        this.categoryResources = params.page && params.page > 1 ? [...this.categoryResources, ...list] : list;
        this.total = pageInfo.total;
        this.hasMore = pageInfo.hasMore;
        return { success: isOk(res), data: { resources: list, ...pageInfo } };
      } catch (error) {
        this.lastError = error;
        logger.warn('[resourceStore] fetchByCategory failed:', error);
        if (!params.page || params.page <= 1) this.categoryResources = [];
        return { success: false, data: { resources: [], total: 0, hasMore: false } };
      } finally {
        this.loading = false;
      }
    },

    async search(params = {}) {
      this.loading = true;
      this.lastError = null;
      try {
        const res = await searchResources({
          ...params,
          limit: params.limit || params.pageSize || 20
        });
        const list = isOk(res) ? extractResourceList(res) : [];
        const pageInfo = extractPageInfo(res);
        this.searchResults = params.page && params.page > 1 ? [...this.searchResults, ...list] : list;
        this.total = pageInfo.total;
        this.hasMore = pageInfo.hasMore;
        return { success: isOk(res), data: { resources: list, ...pageInfo, keyword: params.keyword || '' } };
      } catch (error) {
        this.lastError = error;
        logger.warn('[resourceStore] search failed:', error);
        if (!params.page || params.page <= 1) this.searchResults = [];
        return { success: false, data: { resources: [], total: 0, hasMore: false } };
      } finally {
        this.loading = false;
      }
    },

    async loadResources(params = {}) {
      return this.fetchByCategory(params);
    },

    async searchResources(params = {}) {
      return this.search(params);
    }
  }
});
