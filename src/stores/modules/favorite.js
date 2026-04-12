/**
 * Favorite Store — 收藏管理状态中心
 *
 * 架构：Page → Store(本文件) → API(favorite.api.js) → 后端(favorite-manager)
 *
 * 离线降级策略：
 *   - 已登录 → 走后端 API，数据存云端 MongoDB
 *   - 未登录 → 走本地 question-favorite.js，数据存 storageService
 *   - 首次登录 → 自动将本地收藏同步到云端（一次性迁移）
 *
 * @module stores/favorite
 */

import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import {
  addFavorite as apiAdd,
  getFavorites as apiGet,
  removeFavorite as apiRemove,
  checkFavorite as apiCheck,
  batchAddFavorites as apiBatchAdd,
  getFavoriteCategories as apiGetCategories
} from '@/services/api/domains/favorite.api.js';
import {
  addFavorite as localAdd,
  removeFavorite as localRemove,
  isFavorited as localIsFavorited,
  getFavorites as localGetFavorites,
  getFolders as localGetFolders,
  createFolder as localCreateFolder,
  moveToFolder as localMoveToFolder,
  updateNote as localUpdateNote,
  getFavoriteStats as localGetStats
} from '@/utils/favorite/question-favorite.js';
import { getToken } from '@/services/auth-storage.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

export const useFavoriteStore = defineStore('favorite', () => {
  // ==================== State ====================

  /** 收藏列表（当前页） — shallowRef 避免大数组深度响应开销 */
  const favorites = shallowRef([]);
  /** 收藏夹列表（本地管理） — shallowRef 避免深度响应开销 */
  const folders = shallowRef([]);
  /** 分类统计 — shallowRef 避免深度响应开销 */
  const categories = shallowRef([]);
  /** 总收藏数 */
  const total = ref(0);
  /** 是否还有更多 */
  const hasMore = ref(false);
  /** 当前页码 */
  const currentPage = ref(1);
  /** 加载状态 */
  const loading = ref(false);
  /** 统计数据 */
  const stats = ref({
    totalCount: 0,
    reviewedCount: 0,
    needReviewCount: 0,
    withNoteCount: 0
  });

  // ==================== 内部工具 ====================

  /** 判断用户是否已登录 */
  function _isLoggedIn() {
    return !!getToken();
  }

  /** 标记本地收藏已同步到云端 */
  const SYNC_FLAG_KEY = 'favorite_cloud_synced';

  // ==================== Actions ====================

  /**
   * 加载收藏列表
   * 已登录 → 后端分页查询；未登录 → 本地全量读取
   */
  async function loadFavorites(params = {}) {
    loading.value = true;
    try {
      if (_isLoggedIn()) {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const res = await apiGet({
          page,
          limit,
          category: params.category,
          sortBy: params.sortBy || 'created_at',
          sortOrder: params.sortOrder || 'desc'
        });
        if (res?.code === 0) {
          // 后端数据字段映射为前端格式
          const mapped = (res.data || []).map(_mapBackendToLocal);
          if (page === 1) {
            favorites.value = mapped;
          } else {
            favorites.value = [...favorites.value, ...mapped];
          }
          total.value = res.total || 0;
          hasMore.value = res.hasMore || false;
          currentPage.value = page;
          // 同步更新统计
          stats.value.totalCount = res.total || 0;
        } else {
          // 后端失败，降级到本地
          _loadLocal();
        }
      } else {
        _loadLocal();
      }
    } catch (err) {
      logger.warn('[FavoriteStore] loadFavorites 失败，降级本地:', err);
      _loadLocal();
    } finally {
      loading.value = false;
    }
  }

  /** 从本地加载（降级路径） */
  function _loadLocal() {
    favorites.value = localGetFavorites();
    folders.value = localGetFolders();
    stats.value = localGetStats();
    total.value = stats.value.totalCount || favorites.value.length;
    hasMore.value = false;
    currentPage.value = 1;
  }

  /**
   * 加载更多（下一页）
   */
  async function loadMore() {
    if (!hasMore.value || loading.value) return;
    await loadFavorites({ page: currentPage.value + 1 });
  }

  /**
   * 添加收藏
   * @param {Object} questionData - 题目数据
   * @returns {Promise<{success:boolean, message?:string}>}
   */
  async function addToFavorite(questionData) {
    try {
      if (_isLoggedIn()) {
        const res = await apiAdd({
          questionId: questionData.questionId || questionData.id,
          question: questionData.question || questionData.questionContent,
          options: questionData.options,
          answer: questionData.answer || questionData.correctAnswer,
          analysis: questionData.analysis || questionData.desc,
          category: questionData.category || '综合',
          tags: questionData.tags,
          source: questionData.source || 'manual'
        });
        if (res?.code === 0) {
          // 同时写入本地（保证离线也能看到）
          localAdd(questionData);
          stats.value.totalCount++;
          return { success: true, message: res.message };
        }
        return { success: false, message: res?.message || '添加失败' };
      }
      // 未登录 → 仅本地
      const result = localAdd(questionData);
      if (result?.success !== false) {
        stats.value.totalCount++;
      }
      return { success: result?.success !== false, message: '已收藏到本地' };
    } catch (err) {
      logger.warn('[FavoriteStore] addToFavorite 失败:', err);
      // 降级到本地
      localAdd(questionData);
      return { success: true, message: '已收藏到本地（离线模式）' };
    }
  }

  /**
   * 取消收藏
   * @param {string} idOrQuestionId - 收藏记录ID 或 题目ID
   * @param {string} [type='id'] - 'id' 或 'questionId'
   * @returns {Promise<{success:boolean}>}
   */
  async function removeFromFavorite(idOrQuestionId, type = 'id') {
    try {
      if (_isLoggedIn()) {
        const data = type === 'questionId' ? { questionId: idOrQuestionId } : { id: idOrQuestionId };
        const res = await apiRemove(data);
        if (res?.code === 0) {
          // 同时从本地移除
          localRemove(idOrQuestionId);
          favorites.value = favorites.value.filter((f) => f.id !== idOrQuestionId && f.questionId !== idOrQuestionId);
          stats.value.totalCount = Math.max(0, stats.value.totalCount - 1);
          return { success: true };
        }
        return { success: false, message: res?.message };
      }
      // 未登录 → 仅本地
      const result = localRemove(idOrQuestionId);
      if (result?.success !== false) {
        favorites.value = favorites.value.filter((f) => f.id !== idOrQuestionId);
        stats.value.totalCount = Math.max(0, stats.value.totalCount - 1);
      }
      return { success: result?.success !== false };
    } catch (err) {
      logger.warn('[FavoriteStore] removeFromFavorite 失败:', err);
      localRemove(idOrQuestionId);
      return { success: true };
    }
  }

  /**
   * 切换收藏状态（答题页用）
   * @param {Object} questionData - 题目数据（必须含 id 或 questionId）
   * @returns {Promise<{success:boolean, isFavorited:boolean}>}
   */
  async function toggleFavorite(questionData) {
    const qId = questionData.questionId || questionData.id;
    const currentlyFavorited = await checkIsFavorited(qId);

    if (currentlyFavorited) {
      const res = await removeFromFavorite(qId, 'questionId');
      return { success: res.success, isFavorited: false };
    }
    const res = await addToFavorite(questionData);
    return { success: res.success, isFavorited: true };
  }

  /**
   * 检查题目是否已收藏
   * @param {string} questionId - 题目ID
   * @returns {Promise<boolean>}
   */
  async function checkIsFavorited(questionId) {
    try {
      if (_isLoggedIn()) {
        const res = await apiCheck({ questionId });
        if (res?.code === 0 && res.data) {
          return !!res.data.isFavorite;
        }
      }
      // 降级本地
      return localIsFavorited(questionId);
    } catch (_err) {
      return localIsFavorited(questionId);
    }
  }

  /**
   * 批量检查收藏状态
   * @param {Array<string>} questionIds - 题目ID数组
   * @returns {Promise<Object>} { questionId: boolean, ... }
   */
  async function batchCheckFavorited(questionIds) {
    try {
      if (_isLoggedIn()) {
        const res = await apiCheck({ questionIds });
        if (res?.code === 0 && res.data) {
          return res.data;
        }
      }
      // 降级本地
      const result = {};
      for (const qId of questionIds) {
        result[qId] = localIsFavorited(qId);
      }
      return result;
    } catch (_err) {
      const result = {};
      for (const qId of questionIds) {
        result[qId] = localIsFavorited(qId);
      }
      return result;
    }
  }

  /**
   * 获取分类统计
   */
  async function loadCategories() {
    try {
      if (_isLoggedIn()) {
        const res = await apiGetCategories();
        if (res?.code === 0 && res.data) {
          categories.value = res.data.categories || [];
          stats.value.totalCount = res.data.total || 0;
          return;
        }
      }
      // 降级本地
      stats.value = localGetStats();
    } catch (_err) {
      stats.value = localGetStats();
    }
  }

  // ==================== 本地操作代理（收藏夹/笔记管理） ====================
  // 收藏夹和笔记目前仅本地管理，后端 favorite-manager 不含此功能

  /** 加载收藏夹列表 */
  function loadFolders() {
    folders.value = localGetFolders();
  }

  /** 创建收藏夹 */
  function createFolder(folderData) {
    const result = localCreateFolder(folderData);
    if (result?.success) {
      loadFolders();
    }
    return result;
  }

  /** 移动到收藏夹 */
  function moveToFolder(favoriteId, folderId) {
    const result = localMoveToFolder(favoriteId, folderId);
    if (result?.success) {
      _loadLocal();
    }
    return result;
  }

  /** 更新笔记 */
  function updateNote(favoriteId, noteContent) {
    const result = localUpdateNote(favoriteId, noteContent);
    return result;
  }

  /** 加载统计 */
  function loadStats() {
    stats.value = localGetStats();
  }

  // ==================== 云端同步 ====================

  /**
   * 首次登录时，将本地收藏同步到云端（一次性迁移）
   * 页面无需手动调用，auth Store 登录成功后自动触发
   */
  async function syncLocalToCloud() {
    if (!_isLoggedIn()) return;
    const alreadySynced = storageService.get(SYNC_FLAG_KEY, false);
    if (alreadySynced) return;

    const localFavs = localGetFavorites();
    if (!localFavs || localFavs.length === 0) {
      storageService.save(SYNC_FLAG_KEY, true);
      return;
    }

    try {
      logger.log(`[FavoriteStore] 开始同步 ${localFavs.length} 条本地收藏到云端`);
      const questions = localFavs.map((f) => ({
        questionId: f.questionId || f.id,
        question: f.questionContent || f.question,
        options: f.options,
        answer: f.answer || f.correctAnswer,
        analysis: f.analysis || f.desc,
        category: f.category || '综合',
        tags: f.tags
      }));

      const res = await apiBatchAdd(questions);
      if (res?.code === 0) {
        logger.log('[FavoriteStore] 本地收藏同步完成:', res.data);
        storageService.save(SYNC_FLAG_KEY, true);
      }
    } catch (err) {
      logger.warn('[FavoriteStore] 本地收藏同步失败（将在下次登录重试）:', err);
    }
  }

  // ==================== 内部映射 ====================

  /** 后端字段 → 前端格式 */
  function _mapBackendToLocal(item) {
    return {
      id: item._id || item.id,
      questionId: item.question_id || item.questionId,
      questionContent: item.question_content || item.questionContent || '',
      options: item.options || [],
      answer: item.correct_answer || item.answer || '',
      analysis: item.analysis || '',
      category: item.category || '综合',
      tags: item.tags || [],
      source: item.source || 'manual',
      note: item.note || '',
      folderId: item.folderId || null,
      reviewCount: item.review_count || 0,
      lastReviewTime: item.last_review_time || null,
      createdAt: item.created_at || item.createdAt || Date.now(),
      updatedAt: item.updated_at || item.updatedAt || Date.now()
    };
  }

  // ==================== Computed ====================

  /** 收藏总数 */
  const totalCount = computed(() => stats.value.totalCount || total.value);

  return {
    // 状态
    favorites,
    folders,
    categories,
    total,
    hasMore,
    currentPage,
    loading,
    stats,
    totalCount,
    // 核心操作
    loadFavorites,
    loadMore,
    addToFavorite,
    removeFromFavorite,
    toggleFavorite,
    checkIsFavorited,
    batchCheckFavorited,
    loadCategories,
    // 本地操作
    loadFolders,
    createFolder,
    moveToFolder,
    updateNote,
    loadStats,
    // 云端同步
    syncLocalToCloud
  };
});
