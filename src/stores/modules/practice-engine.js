/**
 * Practice Engine Store — 练习相关后端调用网关
 *
 * 集中管理 practice.api.js 中需要 Store 层代理的后端调用。
 * 页面不应直接 import practice.api.js 的后端函数，而应通过本 Store 调用。
 *
 * 服务的页面:
 *   - practice-sub/import-data.vue → importAnkiDeck(), triggerRagIngest()
 *
 * @module stores/practice-engine
 */

import { defineStore } from 'pinia';
import { ankiImport as apiAnkiImport, ragIngest as apiRagIngest } from '@/services/api/domains/practice.api.js';
import { logger } from '@/utils/logger.js';

export const usePracticeEngineStore = defineStore('practiceEngine', () => {
  /**
   * 导入 Anki 牌组（.apkg 文件）
   * @param {string} base64Data - 文件的 base64 编码
   * @param {string} fileName - 文件名
   * @param {Object} [options] - 请求选项（timeout, maxRetries 等）
   * @returns {Promise<Object>} 后端响应
   */
  const importAnkiDeck = async (base64Data, fileName, options) => {
    try {
      return await apiAnkiImport(base64Data, fileName, options);
    } catch (err) {
      logger.error('[PracticeEngineStore] importAnkiDeck 失败:', err);
      throw err;
    }
  };

  /**
   * 触发 RAG 知识库向量索引（非阻塞，导入成功后后台执行）
   * @param {string} action - 索引动作，如 'index_questions'
   * @param {Object} data - 索引参数，如 { bankId: string }
   * @returns {Promise<Object>} 后端响应
   */
  const triggerRagIngest = async (action, data) => {
    try {
      return await apiRagIngest(action, data);
    } catch (err) {
      logger.error('[PracticeEngineStore] triggerRagIngest 失败:', err);
      throw err;
    }
  };

  return {
    importAnkiDeck,
    triggerRagIngest
  };
});
