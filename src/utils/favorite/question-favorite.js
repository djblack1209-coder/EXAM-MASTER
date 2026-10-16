import { captureSession, checkSession, sessionUnavailable } from '@/services/auth-storage.js';
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
import { toast } from '@/utils/toast.js';
import { getUserId } from '@/services/auth-storage.js';
import {
  normalizeLegacyReviewQuestion,
  normalizeQuizQuestion,
  prepareQuizQuestion,
  createSinglePracticeHandoff,
  readSinglePracticeHandoff
} from '@/services/quiz-session-contract.js';
import {
  createQuizOriginal,
  assertQuizOriginalDisplay,
  quizOriginalIdentity
} from '../../../laf-backend/functions/_shared/learning-quiz-original.js';
const STORAGE_KEYS = {
  FAVORITES: 'question_favorites',
  FAVORITE_FOLDERS: 'favorite_folders',
  FAVORITE_SETTINGS: 'favorite_settings'
};

// 默认收藏夹
const DEFAULT_FOLDERS = [
  { id: 'default', name: '默认收藏', icon: 'fav-default', color: '#FFD700', isDefault: true },
  { id: 'important', name: '重点题目', icon: 'fav-important', color: '#FF5722', isDefault: false },
  { id: 'review', name: '待复习', icon: 'fav-review', color: '#2196F3', isDefault: false },
  { id: 'difficult', name: '难题攻克', icon: 'fav-difficult', color: '#9C27B0', isDefault: false }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const owner = () => getUserId() || '';
const failed = (error, code = 'FAVORITE_SAVE_FAILED') => ({ success: false, error, code });

// 原始题和已整理的显示题都需与保存的原件一致，不能按题干猜测版本。
function originalQuestion(question) {
  try {
    const current = normalizeLegacyReviewQuestion(question);
    if (!current) return null;
    const original = createQuizOriginal({ ...question, id: current.id });
    const restored = prepareQuizQuestion({ ...original.fields, id: original.id, quizOriginal: original });
    if (!restored) return null;
    const displayed = normalizeQuizQuestion(current);
    if (
      displayed.question !== restored.question ||
      displayed.answer !== restored.answer ||
      displayed.type !== restored.type ||
      quizOriginalIdentity(displayed.options) !== quizOriginalIdentity(restored.options)
    )
      return null;
    assertQuizOriginalDisplay(displayed, original);
    return restored;
  } catch (_error) {
    return null;
  }
}

class QuestionFavoriteManager {
  constructor() {
    this.favorites = [];
    this.folders = clone(DEFAULT_FOLDERS);
    this.settings = { maxFavorites: 500, autoSync: true, showFavoriteHint: true };
    this.isInitialized = false;
    this.ownerId = null;
    this.lastError = null;
  }

  init() {
    const session = captureSession();
    const expected = session?.owner === 'guest' ? '' : session?.owner;
    try {
      if (!session) throw sessionUnavailable();
      // 每次读取当前账户的真实保存值，返回独立副本，不认领访客或别人的缓存。
      const rows = storageService.get(STORAGE_KEYS.FAVORITES, [], {
        migrateLegacy: false,
        throwOnError: true,
        session
      });
      const folders = storageService.get(STORAGE_KEYS.FAVORITE_FOLDERS, null, {
        migrateLegacy: false,
        throwOnError: true,
        session
      });
      const settings = storageService.get(STORAGE_KEYS.FAVORITE_SETTINGS, null, {
        migrateLegacy: false,
        throwOnError: true,
        session
      });
      if (
        !Array.isArray(rows) ||
        rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row)) ||
        (folders !== null && !Array.isArray(folders)) ||
        owner() !== expected
      )
        throw Error('收藏资料暂不可读取，原记录已保留');
      this.favorites = clone(rows);
      this.folders = clone(folders?.length ? folders : DEFAULT_FOLDERS);
      this.settings = {
        maxFavorites: 500,
        autoSync: true,
        showFavoriteHint: true,
        ...(settings && typeof settings === 'object' ? clone(settings) : {})
      };
      this.ownerId = expected;
      this.isInitialized = true;
      this.lastError = null;
      return true;
    } catch (error) {
      if (error.code === 'SESSION_UNAVAILABLE') {
        this.lastError = error;
        return false;
      }
      this.favorites = [];
      this.folders = clone(DEFAULT_FOLDERS);
      this.ownerId = expected;
      this.isInitialized = false;
      this.lastError = error;
      return false;
    }
  }

  _edit(field, key, change, expectedOwner) {
    const session = expectedOwner && typeof expectedOwner === 'object' ? expectedOwner : captureSession();
    if (checkSession(session) !== 'current') return failed('登录状态已变化或暂不可读，请重试', 'CONTEXT_CHANGED');
    const expectedId =
      expectedOwner && typeof expectedOwner === 'object'
        ? expectedOwner.owner === 'guest'
          ? ''
          : expectedOwner.owner
        : expectedOwner;
    if (!this.init()) return failed(this.lastError.message, 'FAVORITE_UNAVAILABLE');
    if (expectedId !== undefined && expectedId !== this.ownerId)
      return failed('账户已变化，请重新选择', 'CONTEXT_CHANGED');
    const context = this.ownerId;
    try {
      const next = clone(this[field]);
      const result = change(next);
      if (!result.success) return result;
      if (checkSession(session) !== 'current' || owner() !== context)
        return failed('账户已变化，请重新选择', 'CONTEXT_CHANGED');
      if (storageService.save(key, clone(next), true, session) !== true) return failed('保存失败，原记录已保留');
      if (checkSession(session) !== 'current' || owner() !== context)
        return failed('账户已变化，请重新读取', 'CONTEXT_CHANGED');
      this[field] = next;
      return result;
    } catch (_error) {
      return failed('保存失败，原记录已保留');
    }
  }

  _matches(input) {
    if (input && typeof input === 'object') {
      const q = originalQuestion(input);
      return q
        ? this.favorites.filter(
            (f) => f.quizOriginal && quizOriginalIdentity(f.quizOriginal) === quizOriginalIdentity(q.quizOriginal)
          )
        : [];
    }
    const exact = this.favorites.filter((f) => f.id === input);
    return exact.length ? exact : this.favorites.filter((f) => f.questionId === input || f.questionContent === input);
  }

  addFavorite(question, folderId = 'default', expectedOwner) {
    const q = originalQuestion(question);
    if (!q) return failed('原题资料不完整，请返回重新选择', 'ORIGINAL_UNAVAILABLE');
    const result = this._edit(
      'favorites',
      STORAGE_KEYS.FAVORITES,
      (next) => {
        if (!this.folders.some((f) => f.id === folderId)) return failed('收藏夹已变化，请重新选择');
        const existing = next.find(
          (f) => f.quizOriginal && quizOriginalIdentity(f.quizOriginal) === quizOriginalIdentity(q.quizOriginal)
        );
        if (existing) {
          existing.folderId = folderId;
          existing.updatedAt = Date.now();
          return { success: true, action: 'updated', id: existing.id };
        }
        if (next.length >= Math.min(500, Number(this.settings.maxFavorites) || 500)) return failed('收藏数量已达上限');
        const favorite = {
          id: this._generateId(),
          questionId: q.id,
          quizOriginal: clone(q.quizOriginal),
          questionContent: q.question,
          options: clone(q.options),
          answer: q.answer,
          analysis: q.desc,
          category: q.category,
          difficulty: q.difficulty,
          folderId,
          tags: Array.isArray(question.tags) ? clone(question.tags) : [],
          note: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          reviewCount: 0,
          lastReviewAt: null
        };
        next.unshift(favorite);
        return { success: true, action: 'added', id: favorite.id };
      },
      expectedOwner
    );
    if (result.success && result.action === 'added' && this.settings.showFavoriteHint) this._showToast('收藏成功');
    return result;
  }

  removeFavorite(input, expectedOwner) {
    return this._edit(
      'favorites',
      STORAGE_KEYS.FAVORITES,
      (next) => {
        const matches = this._matches(input);
        if (matches.length !== 1) return failed('收藏记录已变化，请重新选择');
        next.splice(
          next.findIndex((f) => f.id === matches[0].id),
          1
        );
        return { success: true, action: 'removed' };
      },
      expectedOwner
    );
  }

  toggleFavorite(question, folderId = 'default', expectedOwner) {
    if (!this.init()) return failed(this.lastError.message, 'FAVORITE_UNAVAILABLE');
    const matches = this._matches(question);
    return matches.length
      ? this.removeFavorite(question, expectedOwner)
      : this.addFavorite(question, folderId, expectedOwner);
  }

  isFavorited(input) {
    if (!this.init()) return false;
    return this._matches(input).length > 0;
  }

  getFavoriteDetail(input) {
    if (!this.init()) return null;
    const matches = this._matches(input);
    return matches.length === 1 ? { ...clone(matches[0]), favoriteOwnerId: this.ownerId } : null;
  }

  getFavorites(options = {}) {
    if (!this.init()) throw this.lastError;
    let result = this.favorites.map((row) => ({
      ...clone(row),
      folderId: this.folders.some((f) => f.id === row.folderId) ? row.folderId : 'default',
      favoriteOwnerId: this.ownerId
    }));
    if (options.folderId) result = result.filter((f) => f.folderId === options.folderId);
    if (options.category) result = result.filter((f) => f.category === options.category);
    if (options.keyword) {
      const keyword = String(options.keyword).toLowerCase();
      result = result.filter((f) =>
        [f.questionContent, f.note, ...(Array.isArray(f.tags) ? f.tags : [])].some((text) =>
          String(text || '')
            .toLowerCase()
            .includes(keyword)
        )
      );
    }
    const sortBy = options.sortBy || 'createdAt',
      order = options.sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => order * ((a[sortBy] || 0) - (b[sortBy] || 0)));
    if (options.limit) result = result.slice(options.offset || 0, (options.offset || 0) + options.limit);
    return result;
  }

  moveToFolder(id, folderId, expectedOwner) {
    return this._edit(
      'favorites',
      STORAGE_KEYS.FAVORITES,
      (next) => {
        const f = next.find((row) => row.id === id);
        if (!f || !this.folders.some((row) => row.id === folderId)) return failed('收藏或收藏夹已变化，请重新选择');
        f.folderId = folderId;
        f.updatedAt = Date.now();
        return { success: true };
      },
      expectedOwner
    );
  }

  updateNote(id, note, expectedOwner) {
    return this._edit(
      'favorites',
      STORAGE_KEYS.FAVORITES,
      (next) => {
        const f = next.find((row) => row.id === id);
        if (!f) return failed('未找到收藏记录');
        if (typeof note !== 'string' || note.length > 2000) return failed('笔记最多2000字');
        f.note = note;
        f.updatedAt = Date.now();
        return { success: true };
      },
      expectedOwner
    );
  }

  recordReview() {
    return failed('请通过可靠作答记录复习', 'RELIABLE_REVIEW_REQUIRED');
  }

  getFolders() {
    const rows = this.getFavorites();
    return this.folders.map((folder) => ({
      ...clone(folder),
      favoriteOwnerId: this.ownerId,
      count: rows.filter((f) => f.folderId === folder.id).length
    }));
  }

  createFolder(data, expectedOwner) {
    return this._edit(
      'folders',
      STORAGE_KEYS.FAVORITE_FOLDERS,
      (next) => {
        if (typeof data?.name !== 'string' || !data.name.trim() || data.name.length > 50)
          return failed('收藏夹名称需在50字以内');
        const folder = {
          id: this._generateId(),
          name: data.name.trim(),
          icon: data.icon || 'folder',
          color: data.color || '#9E9E9E',
          isDefault: false,
          createdAt: Date.now()
        };
        next.push(folder);
        return { success: true, folder: clone(folder) };
      },
      expectedOwner
    );
  }

  renameFolder(id, name, expectedOwner) {
    return this._edit(
      'folders',
      STORAGE_KEYS.FAVORITE_FOLDERS,
      (next) => {
        const folder = next.find((f) => f.id === id);
        if (!folder || folder.isDefault || typeof name !== 'string' || !name.trim() || name.length > 50)
          return failed('收藏夹名称或记录已变化');
        folder.name = name.trim();
        return { success: true };
      },
      expectedOwner
    );
  }

  deleteFolder(id, expectedOwner) {
    // 只持久化收藏夹的删除；无归属的条目在读取时归入默认夹，原记录无需两次写入。
    return this._edit(
      'folders',
      STORAGE_KEYS.FAVORITE_FOLDERS,
      (next) => {
        const index = next.findIndex((f) => f.id === id);
        if (index < 0 || next[index].isDefault) return failed('收藏夹不存在或不可删除');
        next.splice(index, 1);
        return { success: true };
      },
      expectedOwner
    );
  }

  getStats() {
    const rows = this.getFavorites(),
      categoryStats = {},
      folderStats = {};
    for (const f of rows) categoryStats[f.category || '未分类'] = (categoryStats[f.category || '未分类'] || 0) + 1;
    for (const folder of this.folders)
      folderStats[folder.id] = { ...clone(folder), count: rows.filter((f) => f.folderId === folder.id).length };
    return {
      totalCount: rows.length,
      reviewedCount: rows.filter((f) => f.reviewCount > 0).length,
      withNoteCount: rows.filter((f) => f.note).length,
      categoryStats,
      folderStats,
      recentFavorites: clone(rows.slice(0, 5)),
      needReviewCount: 0,
      needReview: [],
      scoringAuthority: false,
      legacyReviewCount: rows.filter((f) => f.reviewCount > 0).length
    };
  }

  preparePractice(id, expectedOwner) {
    if (!this.init() || expectedOwner !== this.ownerId) return failed('账户已变化，请重新选择', 'CONTEXT_CHANGED');
    const matches = this.favorites.filter((f) => f.id === id);
    if (matches.length !== 1 || !matches[0].quizOriginal)
      return failed('原题资料不完整，请返回题库重新选择', 'ORIGINAL_UNAVAILABLE');
    const original = matches[0].quizOriginal;
    const question = prepareQuizQuestion({ ...original.fields, id: original.id, quizOriginal: original });
    const row = matches[0];
    if (
      !question ||
      row.questionContent !== question.question ||
      row.answer !== question.answer ||
      quizOriginalIdentity(row.options) !== quizOriginalIdentity(question.options)
    )
      return failed('原题资料已变化，请返回重新选择', 'ORIGINAL_UNAVAILABLE');
    return { success: true, question, ownerId: this.ownerId };
  }

  startPractice(id, expectedOwner, { referenceViewed = false } = {}) {
    const prepared = this.preparePractice(id, expectedOwner);
    if (!prepared.success) return prepared;
    if (referenceViewed === true)
      prepared.question.legacyReviewContext = { contract: 'legacy-review-view-v1', referenceViewed: true };
    const handoff = createSinglePracticeHandoff(prepared.question, expectedOwner);
    const session = captureSession();
    if (!handoff || owner() !== expectedOwner) return failed('账户已变化，请重新选择', 'CONTEXT_CHANGED');
    try {
      if (storageService.save('temp_practice_question', handoff, true, session) !== true)
        return failed('练习未保存，请重试');
      if (owner() !== expectedOwner) return failed('账户已变化，请重新选择', 'CONTEXT_CHANGED');
      const saved = storageService.get('temp_practice_question', null, {
        migrateLegacy: false,
        throwOnError: true,
        session
      });
      if (
        !readSinglePracticeHandoff(saved, handoff.id, expectedOwner) ||
        quizOriginalIdentity(saved) !== quizOriginalIdentity(handoff)
      )
        return failed('练习未确认保存，请重试');
      return { success: true, handoffId: handoff.id, ownerId: expectedOwner };
    } catch (_error) {
      return failed('练习未保存，请重试');
    }
  }

  _generateId() {
    return 'fav_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  _showToast(message) {
    try {
      toast.info(message, 1500);
    } catch (_e) {
      logger.warn('[QuestionFavorite] 显示提示失败');
    }
  }
}

// 创建单例
export const questionFavoriteManager = new QuestionFavoriteManager();

// 便捷函数
export function addFavorite(question, folderId) {
  return questionFavoriteManager.addFavorite(question, folderId);
}

export function removeFavorite(questionId, expectedOwner) {
  return questionFavoriteManager.removeFavorite(questionId, expectedOwner);
}

export function toggleFavorite(question, folderId, expectedOwner) {
  return questionFavoriteManager.toggleFavorite(question, folderId, expectedOwner);
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

export function createFolder(folderData, expectedOwner) {
  return questionFavoriteManager.createFolder(folderData, expectedOwner);
}

export function moveToFolder(favoriteId, targetFolderId, expectedOwner) {
  return questionFavoriteManager.moveToFolder(favoriteId, targetFolderId, expectedOwner);
}

export function updateNote(favoriteId, note, expectedOwner) {
  return questionFavoriteManager.updateNote(favoriteId, note, expectedOwner);
}

export function getFavoriteStats() {
  return questionFavoriteManager.getStats();
}

export function updateFavoriteNote(favoriteId, note) {
  return questionFavoriteManager.updateNote(favoriteId, note);
}

export default questionFavoriteManager;
