/**
 * Resource Store — 学习资源状态中心
 *
 * 架构：Page → Store(本文件) → API(resource.api.js) → 后端(learning-resource)
 *
 * @module stores/resource
 */

import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import {
  getRecommendations as apiRecommend,
  getHotResources as apiHot,
  getByCategory as apiByCategory,
  searchResources as apiSearch,
  favoriteResource as apiFavorite,
  getCategories as apiCategories,
  getSubjects as apiSubjects
} from '@/services/api/domains/resource.api.js';
import { logger } from '@/utils/logger.js';

export const useResourceStore = defineStore('resource', () => {
  // ==================== State ====================

  /** 推荐资源 — shallowRef 避免大数组深度响应开销 */
  const recommendations = shallowRef([]);
  /** 热门资源 — shallowRef 避免大数组深度响应开销 */
  const hotResources = shallowRef([]);
  /** 分类浏览结果 — shallowRef 避免大数组深度响应开销 */
  const categoryResources = shallowRef([]);
  /** 搜索结果 — shallowRef 避免大数组深度响应开销 */
  const searchResults = shallowRef([]);
  /** 资源分类定义 */
  const categories = ref({});
  /** 学科定义 */
  const subjects = ref({});
  /** 加载状态 */
  const loading = ref(false);
  /** 搜索关键词 */
  const searchKeyword = ref('');
  /** 总数（分页用） */
  const totalResults = ref(0);
  /** 是否还有更多 */
  const hasMore = ref(false);

  // ==================== Actions ====================

  /**
   * 获取推荐资源
   */
  async function fetchRecommendations(params = {}) {
    loading.value = true;
    try {
      const res = await apiRecommend(params);
      if (res?.code === 0 && res.data) {
        recommendations.value = res.data.resources || res.data || [];
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[ResourceStore] fetchRecommendations 失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取热门资源
   */
  async function fetchHotResources(params = {}) {
    loading.value = true;
    try {
      const res = await apiHot(params);
      if (res?.code === 0) {
        hotResources.value = res.data || [];
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[ResourceStore] fetchHotResources 失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 按分类获取资源（分页）
   */
  async function fetchByCategory(params = {}) {
    loading.value = true;
    try {
      const res = await apiByCategory(params);
      if (res?.code === 0 && res.data) {
        const data = res.data;
        const list = data.resources || [];
        if ((params.page || 1) === 1) {
          categoryResources.value = list;
        } else {
          categoryResources.value = [...categoryResources.value, ...list];
        }
        totalResults.value = data.total || 0;
        hasMore.value = data.hasMore || false;
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[ResourceStore] fetchByCategory 失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 搜索资源
   */
  async function search(params = {}) {
    loading.value = true;
    searchKeyword.value = params.keyword || '';
    try {
      const res = await apiSearch(params);
      if (res?.code === 0 && res.data) {
        const data = res.data;
        const list = data.resources || [];
        if ((params.page || 1) === 1) {
          searchResults.value = list;
        } else {
          searchResults.value = [...searchResults.value, ...list];
        }
        totalResults.value = data.total || 0;
        hasMore.value = data.hasMore || false;
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[ResourceStore] search 失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 收藏/取消收藏资源
   */
  async function toggleFavorite(resourceId, isFav) {
    try {
      const action = isFav ? 'remove' : 'add';
      const res = await apiFavorite(resourceId, action);
      if (res?.code === 0) {
        return { success: true, isFavorite: res.data?.isFavorite };
      }
      return { success: false };
    } catch (err) {
      logger.warn('[ResourceStore] toggleFavorite 失败:', err);
      return { success: false };
    }
  }

  /**
   * 加载分类和学科定义
   */
  async function loadMetadata() {
    try {
      const [catRes, subRes] = await Promise.all([apiCategories(), apiSubjects()]);
      if (catRes?.code === 0) categories.value = catRes.data || {};
      if (subRes?.code === 0) subjects.value = subRes.data || {};
    } catch (err) {
      logger.warn('[ResourceStore] loadMetadata 失败:', err);
    }
  }

  return {
    recommendations,
    hotResources,
    categoryResources,
    searchResults,
    categories,
    subjects,
    loading,
    searchKeyword,
    totalResults,
    hasMore,
    fetchRecommendations,
    fetchHotResources,
    fetchByCategory,
    search,
    toggleFavorite,
    loadMetadata
  };
});
