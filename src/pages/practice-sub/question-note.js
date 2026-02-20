/**
 * 题目笔记模块 - 在题目上添加个人笔记
 *
 * 核心功能：
 * 1. 添加/编辑/删除笔记
 * 2. 笔记标签管理
 * 3. 笔记搜索
 * 4. 笔记导出
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEYS = {
  NOTES: 'question_notes',
  NOTE_TAGS: 'question_note_tags'
};

// 预定义标签
const DEFAULT_TAGS = [
  { id: 'key_point', name: '重点', color: '#F44336', icon: '🔑' },
  { id: 'formula', name: '公式', color: '#2196F3', icon: '📐' },
  { id: 'trick', name: '技巧', color: '#4CAF50', icon: '💡' },
  { id: 'trap', name: '易错点', color: '#FF9800', icon: '⚠️' },
  { id: 'summary', name: '总结', color: '#9C27B0', icon: '📝' },
  { id: 'link', name: '关联', color: '#00BCD4', icon: '🔗' }
];

/**
 * 题目笔记管理器
 */
class QuestionNoteManager {
  constructor() {
    this.notes = [];
    this.tags = [...DEFAULT_TAGS];
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;
    this._loadNotes();
    this._loadTags();
    this.isInitialized = true;
    logger.log('[QuestionNote] 初始化完成，笔记数:', this.notes.length);
  }

  /**
   * 添加笔记
   * @param {Object} noteData - 笔记数据
   * @returns {Object} 添加结果
   */
  addNote(noteData) {
    this.init();

    const note = {
      id: this._generateId(),
      questionId: noteData.questionId,
      questionContent: noteData.questionContent || '',
      content: noteData.content,
      tags: noteData.tags || [],
      // 笔记类型：text | image | voice | link
      type: noteData.type || 'text',
      // 关联数据
      relatedQuestions: noteData.relatedQuestions || [],
      // 元数据
      category: noteData.category || '未分类',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // 复习相关
      reviewCount: 0,
      lastReviewAt: null,
      isImportant: noteData.isImportant || false
    };

    this.notes.unshift(note);
    this._saveNotes();

    return { success: true, note };
  }

  /**
   * 更新笔记
   * @param {string} noteId - 笔记ID
   * @param {Object} updates - 更新内容
   * @returns {Object} 更新结果
   */
  updateNote(noteId, updates) {
    this.init();

    const index = this.notes.findIndex((n) => n.id === noteId);
    if (index === -1) {
      return { success: false, error: '笔记不存在' };
    }

    this.notes[index] = {
      ...this.notes[index],
      ...updates,
      updatedAt: Date.now()
    };

    this._saveNotes();
    return { success: true, note: this.notes[index] };
  }

  /**
   * 删除笔记
   * @param {string} noteId - 笔记ID
   * @returns {Object} 删除结果
   */
  deleteNote(noteId) {
    this.init();

    const index = this.notes.findIndex((n) => n.id === noteId);
    if (index === -1) {
      return { success: false, error: '笔记不存在' };
    }

    this.notes.splice(index, 1);
    this._saveNotes();

    return { success: true };
  }

  /**
   * 获取题目的笔记
   * @param {string} questionId - 题目ID
   * @returns {Array} 笔记列表
   */
  getNotesByQuestion(questionId) {
    this.init();
    return this.notes.filter((n) => n.questionId === questionId);
  }

  /**
   * 获取所有笔记
   * @param {Object} options - 筛选选项
   * @returns {Array} 笔记列表
   */
  getNotes(options = {}) {
    this.init();

    let result = [...this.notes];

    // 按标签筛选
    if (options.tagId) {
      result = result.filter((n) => n.tags.includes(options.tagId));
    }

    // 按分类筛选
    if (options.category) {
      result = result.filter((n) => n.category === options.category);
    }

    // 只看重要笔记
    if (options.importantOnly) {
      result = result.filter((n) => n.isImportant);
    }

    // 关键词搜索
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      result = result.filter(
        (n) => n.content.toLowerCase().includes(keyword) || n.questionContent.toLowerCase().includes(keyword)
      );
    }

    // 排序
    const sortBy = options.sortBy || 'updatedAt';
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
   * 搜索笔记
   * @param {string} keyword - 搜索关键词
   * @returns {Array} 搜索结果
   */
  searchNotes(keyword) {
    this.init();

    if (!keyword || keyword.trim() === '') {
      return [];
    }

    const lowerKeyword = keyword.toLowerCase();

    return this.notes
      .filter((note) => {
        // 搜索笔记内容
        if (note.content.toLowerCase().includes(lowerKeyword)) return true;
        // 搜索题目内容
        if (note.questionContent.toLowerCase().includes(lowerKeyword)) return true;
        // 搜索标签
        const tagNames = note.tags.map((tagId) => {
          const tag = this.tags.find((t) => t.id === tagId);
          return tag ? tag.name.toLowerCase() : '';
        });
        if (tagNames.some((name) => name.includes(lowerKeyword))) return true;

        return false;
      })
      .map((note) => ({
        ...note,
        matchType: note.content.toLowerCase().includes(lowerKeyword)
          ? 'content'
          : note.questionContent.toLowerCase().includes(lowerKeyword)
            ? 'question'
            : 'tag'
      }));
  }

  /**
   * 标记为重要
   * @param {string} noteId - 笔记ID
   * @param {boolean} isImportant - 是否重要
   */
  toggleImportant(noteId, isImportant) {
    this.init();

    const note = this.notes.find((n) => n.id === noteId);
    if (note) {
      note.isImportant = isImportant !== undefined ? isImportant : !note.isImportant;
      note.updatedAt = Date.now();
      this._saveNotes();
    }
  }

  /**
   * 记录复习
   * @param {string} noteId - 笔记ID
   */
  recordReview(noteId) {
    this.init();

    const note = this.notes.find((n) => n.id === noteId);
    if (note) {
      note.reviewCount++;
      note.lastReviewAt = Date.now();
      this._saveNotes();
    }
  }

  // ==================== 标签管理 ====================

  /**
   * 获取所有标签
   * @returns {Array} 标签列表
   */
  getTags() {
    this.init();

    return this.tags.map((tag) => ({
      ...tag,
      count: this.notes.filter((n) => n.tags.includes(tag.id)).length
    }));
  }

  /**
   * 创建标签
   * @param {Object} tagData - 标签数据
   * @returns {Object} 创建结果
   */
  createTag(tagData) {
    this.init();

    // 检查是否已存在
    if (this.tags.some((t) => t.name === tagData.name)) {
      return { success: false, error: '标签已存在' };
    }

    const tag = {
      id: 'tag_' + Date.now().toString(36),
      name: tagData.name,
      color: tagData.color || '#9E9E9E',
      icon: tagData.icon || '🏷️',
      isCustom: true
    };

    this.tags.push(tag);
    this._saveTags();

    return { success: true, tag };
  }

  /**
   * 删除标签
   * @param {string} tagId - 标签ID
   * @returns {Object} 删除结果
   */
  deleteTag(tagId) {
    this.init();

    const tag = this.tags.find((t) => t.id === tagId);
    if (!tag) {
      return { success: false, error: '标签不存在' };
    }

    if (!tag.isCustom) {
      return { success: false, error: '系统标签不能删除' };
    }

    // 从所有笔记中移除该标签
    this.notes.forEach((note) => {
      note.tags = note.tags.filter((t) => t !== tagId);
    });

    // 删除标签
    this.tags = this.tags.filter((t) => t.id !== tagId);

    this._saveNotes();
    this._saveTags();

    return { success: true };
  }

  // ==================== 统计分析 ====================

  /**
   * 获取笔记统计
   * @returns {Object} 统计数据
   */
  getStats() {
    this.init();

    const totalCount = this.notes.length;
    const importantCount = this.notes.filter((n) => n.isImportant).length;
    const reviewedCount = this.notes.filter((n) => n.reviewCount > 0).length;

    // 按标签统计
    const tagStats = {};
    for (const tag of this.tags) {
      tagStats[tag.id] = {
        ...tag,
        count: this.notes.filter((n) => n.tags.includes(tag.id)).length
      };
    }

    // 按分类统计
    const categoryStats = {};
    for (const note of this.notes) {
      const cat = note.category;
      if (!categoryStats[cat]) {
        categoryStats[cat] = 0;
      }
      categoryStats[cat]++;
    }

    // 最近笔记
    const recentNotes = this.notes.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

    // 待复习笔记（超过7天未复习的重要笔记）
    const needReview = this.notes.filter((n) => {
      if (!n.isImportant) return false;
      if (!n.lastReviewAt) return true;
      const daysSinceReview = (Date.now() - n.lastReviewAt) / (1000 * 60 * 60 * 24);
      return daysSinceReview > 7;
    });

    return {
      totalCount,
      importantCount,
      reviewedCount,
      tagStats,
      categoryStats,
      recentNotes,
      needReviewCount: needReview.length
    };
  }

  /**
   * 导出笔记
   * @param {Object} options - 导出选项
   * @returns {string} 导出内容
   */
  exportNotes(options = {}) {
    this.init();

    const notes = this.getNotes(options);

    // 生成Markdown格式
    let markdown = '# 我的学习笔记\n\n';
    markdown += `> 导出时间: ${new Date().toLocaleString()}\n`;
    markdown += `> 笔记总数: ${notes.length}\n\n`;
    markdown += '---\n\n';

    // 按分类分组
    const grouped = {};
    for (const note of notes) {
      const cat = note.category;
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(note);
    }

    for (const [category, categoryNotes] of Object.entries(grouped)) {
      markdown += `## ${category}\n\n`;

      for (const note of categoryNotes) {
        markdown += `### ${note.questionContent.substring(0, 50)}...\n\n`;
        markdown += `**笔记内容:**\n${note.content}\n\n`;

        if (note.tags.length > 0) {
          const tagNames = note.tags.map((tagId) => {
            const tag = this.tags.find((t) => t.id === tagId);
            return tag ? tag.name : tagId;
          });
          markdown += `**标签:** ${tagNames.join(', ')}\n\n`;
        }

        markdown += `*创建时间: ${new Date(note.createdAt).toLocaleString()}*\n\n`;
        markdown += '---\n\n';
      }
    }

    return markdown;
  }

  // ==================== 私有方法 ====================

  _generateId() {
    return 'note_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  _loadNotes() {
    try {
      if (typeof uni !== 'undefined') {
        this.notes = storageService.get(STORAGE_KEYS.NOTES, []);
      }
    } catch (_e) {
      this.notes = [];
    }
  }

  _saveNotes() {
    try {
      if (typeof uni !== 'undefined') {
        // 只保留最近1000条
        if (this.notes.length > 1000) {
          this.notes = this.notes.slice(0, 1000);
        }
        storageService.save(STORAGE_KEYS.NOTES, this.notes);
      }
    } catch (_e) {
      logger.warn('[QuestionNote] 保存笔记失败:', _e);
    }
  }

  _loadTags() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEYS.NOTE_TAGS);
        if (saved && saved.length > 0) {
          // 合并默认标签和自定义标签
          const customTags = saved.filter((t) => t.isCustom);
          this.tags = [...DEFAULT_TAGS, ...customTags];
        }
      }
    } catch (_e) {
      this.tags = [...DEFAULT_TAGS];
    }
  }

  _saveTags() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.NOTE_TAGS, this.tags);
      }
    } catch (_e) {
      logger.warn('[QuestionNote] 保存标签失败:', _e);
    }
  }
}

// 创建单例
export const questionNoteManager = new QuestionNoteManager();

// 便捷函数
export function addQuestionNote(noteData) {
  return questionNoteManager.addNote(noteData);
}

export function updateQuestionNote(noteId, updates) {
  return questionNoteManager.updateNote(noteId, updates);
}

export function deleteQuestionNote(noteId) {
  return questionNoteManager.deleteNote(noteId);
}

export function getNotesByQuestion(questionId) {
  return questionNoteManager.getNotesByQuestion(questionId);
}

export function getAllNotes(options) {
  return questionNoteManager.getNotes(options);
}

export function searchNotes(keyword) {
  return questionNoteManager.searchNotes(keyword);
}

export function getNoteTags() {
  return questionNoteManager.getTags();
}

export function getNoteStats() {
  return questionNoteManager.getStats();
}

export function exportNotes(options) {
  return questionNoteManager.exportNotes(options);
}

export { DEFAULT_TAGS };
export default questionNoteManager;
