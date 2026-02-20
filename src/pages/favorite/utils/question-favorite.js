/**
 * 题目收藏模块 - 收藏重要题目，方便复习
 *
 * 核心功能：
 * 1. 收藏/取消收藏题目
 * 2. 收藏分类管理
 * 3. 收藏夹同步
 * 4. 收藏统计分析
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEYS = {
  FAVORITES: 'question_favorites',
  FAVORITE_FOLDERS: 'favorite_folders',
  FAVORITE_SETTINGS: 'favorite_settings'
};

// 默认收藏夹
const DEFAULT_FOLDERS = [
  { id: 'default', name: '默认收藏', icon: '⭐', color: '#FFD700', isDefault: true },
  { id: 'important', name: '重点题目', icon: '🔥', color: '#FF5722', isDefault: false },
  { id: 'review', name: '待复习', icon: '📖', color: '#2196F3', isDefault: false },
  { id: 'difficult', name: '难题攻克', icon: '💪', color: '#9C27B0', isDefault: false }
];

/**
 * 题目收藏管理器
 */
class QuestionFavoriteManager {
  constructor() {
    this.favorites = [];
    this.folders = [...DEFAULT_FOLDERS];
    this.settings = {
      maxFavorites: 500,
      autoSync: true,
      showFavoriteHint: true
    };
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;
    this._loadFavorites();
    this._loadFolders();
    this._loadSettings();
    this.isInitialized = true;
    logger.log('[QuestionFavorite] 初始化完成，收藏数:', this.favorites.length);
  }

  /**
   * 收藏题目
   * @param {Object} question - 题目数据
   * @param {string} folderId - 收藏夹ID
   * @returns {Object} 收藏结果
   */
  addFavorite(question, folderId = 'default') {
    this.init();

    // 检查是否已收藏
    const existingIndex = this.favorites.findIndex(
      (f) => f.questionId === question.id || f.questionContent === question.question
    );

    if (existingIndex >= 0) {
      // 已收藏，更新收藏夹
      this.favorites[existingIndex].folderId = folderId;
      this.favorites[existingIndex].updatedAt = Date.now();
      this._saveFavorites();
      return { success: true, action: 'updated', id: this.favorites[existingIndex].id };
    }

    // 检查收藏数量限制
    if (this.favorites.length >= this.settings.maxFavorites) {
      return { success: false, error: '收藏数量已达上限' };
    }

    // 创建收藏记录
    const favorite = {
      id: this._generateId(),
      questionId: question.id || this._generateId(),
      questionContent: question.question || question.question_content,
      options: question.options || [],
      answer: question.answer || question.correct_answer,
      analysis: question.desc || question.analysis || '',
      category: question.category || '未分类',
      difficulty: question.difficulty || 2,
      folderId,
      tags: question.tags || [],
      note: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewCount: 0,
      lastReviewAt: null
    };

    this.favorites.unshift(favorite);
    this._saveFavorites();

    // 显示收藏成功提示
    if (this.settings.showFavoriteHint) {
      this._showToast('收藏成功');
    }

    return { success: true, action: 'added', id: favorite.id };
  }

  /**
   * 取消收藏
   * @param {string} questionId - 题目ID或收藏ID
   * @returns {Object} 操作结果
   */
  removeFavorite(questionId) {
    this.init();

    const index = this.favorites.findIndex(
      (f) => f.id === questionId || f.questionId === questionId || f.questionContent === questionId
    );

    if (index === -1) {
      return { success: false, error: '未找到收藏记录' };
    }

    this.favorites.splice(index, 1);
    this._saveFavorites();

    return { success: true, action: 'removed' };
  }

  /**
   * 切换收藏状态
   * @param {Object} question - 题目数据
   * @param {string} folderId - 收藏夹ID
   * @returns {Object} 操作结果
   */
  toggleFavorite(question, folderId = 'default') {
    this.init();

    if (this.isFavorited(question.id || question.question)) {
      return this.removeFavorite(question.id || question.question);
    } else {
      return this.addFavorite(question, folderId);
    }
  }

  /**
   * 检查是否已收藏
   * @param {string} questionId - 题目ID或内容
   * @returns {boolean} 是否已收藏
   */
  isFavorited(questionId) {
    this.init();

    return this.favorites.some(
      (f) => f.id === questionId || f.questionId === questionId || f.questionContent === questionId
    );
  }

  /**
   * 获取收藏详情
   * @param {string} questionId - 题目ID
   * @returns {Object|null} 收藏详情
   */
  getFavoriteDetail(questionId) {
    this.init();

    return (
      this.favorites.find(
        (f) => f.id === questionId || f.questionId === questionId || f.questionContent === questionId
      ) || null
    );
  }

  /**
   * 获取收藏列表
   * @param {Object} options - 筛选选项
   * @returns {Array} 收藏列表
   */
  getFavorites(options = {}) {
    this.init();

    let result = [...this.favorites];

    // 按收藏夹筛选
    if (options.folderId) {
      result = result.filter((f) => f.folderId === options.folderId);
    }

    // 按分类筛选
    if (options.category) {
      result = result.filter((f) => f.category === options.category);
    }

    // 按关键词搜索
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      result = result.filter(
        (f) =>
          f.questionContent.toLowerCase().includes(keyword) ||
          f.note.toLowerCase().includes(keyword) ||
          f.tags.some((t) => t.toLowerCase().includes(keyword))
      );
    }

    // 排序
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    result.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // 分页
    if (options.limit) {
      const offset = options.offset || 0;
      result = result.slice(offset, offset + options.limit);
    }

    return result;
  }

  /**
   * 移动到其他收藏夹
   * @param {string} favoriteId - 收藏ID
   * @param {string} targetFolderId - 目标收藏夹ID
   * @returns {Object} 操作结果
   */
  moveToFolder(favoriteId, targetFolderId) {
    this.init();

    const favorite = this.favorites.find((f) => f.id === favoriteId);
    if (!favorite) {
      return { success: false, error: '未找到收藏记录' };
    }

    favorite.folderId = targetFolderId;
    favorite.updatedAt = Date.now();
    this._saveFavorites();

    return { success: true };
  }

  /**
   * 更新收藏笔记
   * @param {string} favoriteId - 收藏ID
   * @param {string} note - 笔记内容
   * @returns {Object} 操作结果
   */
  updateNote(favoriteId, note) {
    this.init();

    const favorite = this.favorites.find((f) => f.id === favoriteId);
    if (!favorite) {
      return { success: false, error: '未找到收藏记录' };
    }

    favorite.note = note;
    favorite.updatedAt = Date.now();
    this._saveFavorites();

    return { success: true };
  }

  /**
   * 记录复习
   * @param {string} favoriteId - 收藏ID
   */
  recordReview(favoriteId) {
    this.init();

    const favorite = this.favorites.find((f) => f.id === favoriteId);
    if (favorite) {
      favorite.reviewCount++;
      favorite.lastReviewAt = Date.now();
      this._saveFavorites();
    }
  }

  // ==================== 收藏夹管理 ====================

  /**
   * 获取所有收藏夹
   * @returns {Array} 收藏夹列表
   */
  getFolders() {
    this.init();

    return this.folders.map((folder) => ({
      ...folder,
      count: this.favorites.filter((f) => f.folderId === folder.id).length
    }));
  }

  /**
   * 创建收藏夹
   * @param {Object} folderData - 收藏夹数据
   * @returns {Object} 创建结果
   */
  createFolder(folderData) {
    this.init();

    const folder = {
      id: this._generateId(),
      name: folderData.name,
      icon: folderData.icon || '📁',
      color: folderData.color || '#9E9E9E',
      isDefault: false,
      createdAt: Date.now()
    };

    this.folders.push(folder);
    this._saveFolders();

    return { success: true, folder };
  }

  /**
   * 删除收藏夹
   * @param {string} folderId - 收藏夹ID
   * @returns {Object} 删除结果
   */
  deleteFolder(folderId) {
    this.init();

    const folder = this.folders.find((f) => f.id === folderId);
    if (!folder) {
      return { success: false, error: '收藏夹不存在' };
    }

    if (folder.isDefault) {
      return { success: false, error: '默认收藏夹不能删除' };
    }

    // 将该收藏夹的题目移到默认收藏夹
    this.favorites.forEach((f) => {
      if (f.folderId === folderId) {
        f.folderId = 'default';
      }
    });

    // 删除收藏夹
    this.folders = this.folders.filter((f) => f.id !== folderId);

    this._saveFavorites();
    this._saveFolders();

    return { success: true };
  }

  // ==================== 统计分析 ====================

  /**
   * 获取收藏统计
   * @returns {Object} 统计数据
   */
  getStats() {
    this.init();

    const totalCount = this.favorites.length;
    const reviewedCount = this.favorites.filter((f) => f.reviewCount > 0).length;
    const withNoteCount = this.favorites.filter((f) => f.note && f.note.length > 0).length;

    // 按分类统计
    const categoryStats = {};
    for (const fav of this.favorites) {
      const cat = fav.category;
      if (!categoryStats[cat]) {
        categoryStats[cat] = 0;
      }
      categoryStats[cat]++;
    }

    // 按收藏夹统计
    const folderStats = {};
    for (const folder of this.folders) {
      folderStats[folder.id] = {
        ...folder,
        count: this.favorites.filter((f) => f.folderId === folder.id).length
      };
    }

    // 最近收藏
    const recentFavorites = [...this.favorites].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    // 待复习（超过7天未复习）
    const needReview = this.favorites.filter((f) => {
      if (!f.lastReviewAt) return true;
      const daysSinceReview = (Date.now() - f.lastReviewAt) / (1000 * 60 * 60 * 24);
      return daysSinceReview > 7;
    });

    return {
      totalCount,
      reviewedCount,
      withNoteCount,
      categoryStats,
      folderStats,
      recentFavorites,
      needReviewCount: needReview.length,
      needReview: needReview.slice(0, 10)
    };
  }

  // ==================== 私有方法 ====================

  _generateId() {
    return 'fav_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  _showToast(message) {
    try {
      if (typeof uni !== 'undefined') {
        uni.showToast({ title: message, icon: 'none', duration: 1500 });
      }
    } catch (e) {
      console.warn('[QuestionFavorite] 显示提示失败:', e);
    }
  }

  _loadFavorites() {
    try {
      if (typeof uni !== 'undefined') {
        this.favorites = storageService.get(STORAGE_KEYS.FAVORITES, []);
      }
    } catch (_e) {
      this.favorites = [];
    }
  }

  _saveFavorites() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.FAVORITES, this.favorites);
      }
    } catch (_e) {
      console.warn('[QuestionFavorite] 保存收藏失败:', _e);
    }
  }

  _loadFolders() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEYS.FAVORITE_FOLDERS);
        if (saved && saved.length > 0) {
          this.folders = saved;
        }
      }
    } catch (_e) {
      this.folders = [...DEFAULT_FOLDERS];
    }
  }

  _saveFolders() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.FAVORITE_FOLDERS, this.folders);
      }
    } catch (_e) {
      console.warn('[QuestionFavorite] 保存收藏夹失败:', _e);
    }
  }

  _loadSettings() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEYS.FAVORITE_SETTINGS);
        if (saved) {
          this.settings = { ...this.settings, ...saved };
        }
      }
    } catch (_e) {
      console.warn('[QuestionFavorite] 加载设置失败:', _e);
    }
  }
}

// 创建单例
export const questionFavoriteManager = new QuestionFavoriteManager();

// 便捷函数
export function addFavorite(question, folderId) {
  return questionFavoriteManager.addFavorite(question, folderId);
}

export function removeFavorite(questionId) {
  return questionFavoriteManager.removeFavorite(questionId);
}

export function toggleFavorite(question, folderId) {
  return questionFavoriteManager.toggleFavorite(question, folderId);
}

export function isFavorited(questionId) {
  return questionFavoriteManager.isFavorited(questionId);
}

export function getFavorites(options) {
  return questionFavoriteManager.getFavorites(options);
}

export function getFolders() {
  return questionFavoriteManager.getFolders();
}

export function getFavoriteFolders() {
  return questionFavoriteManager.getFolders();
}

export function createFolder(folderData) {
  return questionFavoriteManager.createFolder(folderData);
}

export function moveToFolder(favoriteId, targetFolderId) {
  return questionFavoriteManager.moveToFolder(favoriteId, targetFolderId);
}

export function updateNote(favoriteId, note) {
  return questionFavoriteManager.updateNote(favoriteId, note);
}

export function getFavoriteStats() {
  return questionFavoriteManager.getStats();
}

export function updateFavoriteNote(favoriteId, note) {
  return questionFavoriteManager.updateNote(favoriteId, note);
}

export default questionFavoriteManager;
