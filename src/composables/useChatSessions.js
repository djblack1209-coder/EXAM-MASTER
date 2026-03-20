/**
 * 聊天会话管理 Composable
 *
 * 管理多个聊天会话（对话），支持创建、切换、删除、重命名。
 * 通过 storageService 持久化到 localStorage，最多保留 50 个会话。
 *
 * @module composables/useChatSessions
 */

import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';

const STORAGE_KEY = 'chat_sessions';
const MAX_SESSIONS = 50;

/** 全局单例状态 */
const sessions = ref([]);
const currentSessionId = ref('');
let _initialized = false;

function _load() {
  if (_initialized) return;
  sessions.value = storageService.get(STORAGE_KEY, []);
  _initialized = true;
}

function _persist() {
  storageService.save(STORAGE_KEY, sessions.value, true);
}

function _genId() {
  return `s_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function _autoTitle(text) {
  if (!text || typeof text !== 'string') return '新对话';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 20 ? clean.slice(0, 20) + '…' : clean;
}

function _prune() {
  if (sessions.value.length > MAX_SESSIONS) {
    // 按 updatedAt 升序，移除最旧的
    const sorted = sessions.value.slice().sort((a, b) => a.updatedAt - b.updatedAt);
    const removeIds = new Set(sorted.slice(0, sessions.value.length - MAX_SESSIONS).map((s) => s.id));
    sessions.value = sessions.value.filter((s) => !removeIds.has(s.id));
  }
}

export function useChatSessions() {
  _load();

  /**
   * 创建新会话
   * @param {Object} [persona] - 角色信息 { name }
   * @returns {string} 新会话 id
   */
  function createSession(persona) {
    const id = _genId();
    const now = Date.now();
    sessions.value.unshift({
      id,
      title: persona?.name ? `与${persona.name}的对话` : '新对话',
      lastMessage: '',
      updatedAt: now,
      messageCount: 0
    });
    currentSessionId.value = id;
    _prune();
    _persist();
    return id;
  }

  /**
   * 切换当前会话
   * @param {string} id
   */
  function switchSession(id) {
    const exists = sessions.value.find((s) => s.id === id);
    if (exists) currentSessionId.value = id;
  }

  /**
   * 删除会话
   * @param {string} id
   */
  function deleteSession(id) {
    sessions.value = sessions.value.filter((s) => s.id !== id);
    // 同时清理该会话的消息存储
    storageService.remove(`chat_msg_${id}`, true);
    if (currentSessionId.value === id) {
      currentSessionId.value = sessions.value.length > 0 ? sessions.value[0].id : '';
    }
    _persist();
  }

  /**
   * 重命名会话
   * @param {string} id
   * @param {string} title
   */
  function renameSession(id, title) {
    const s = sessions.value.find((s) => s.id === id);
    if (s && title?.trim()) {
      s.title = title.trim();
      _persist();
    }
  }

  /**
   * 更新会话元数据（发送消息后调用）
   * @param {string} id
   * @param {Object} meta - { lastMessage, messageCount, firstUserMessage }
   */
  function updateSession(id, meta) {
    const s = sessions.value.find((s) => s.id === id);
    if (!s) return;
    s.updatedAt = Date.now();
    if (meta.lastMessage !== undefined) s.lastMessage = _autoTitle(meta.lastMessage);
    if (meta.messageCount !== undefined) s.messageCount = meta.messageCount;
    // 首条用户消息自动生成标题
    if (meta.firstUserMessage && (s.title === '新对话' || s.title.startsWith('与'))) {
      s.title = _autoTitle(meta.firstUserMessage);
    }
    _persist();
  }

  /**
   * 获取所有会话（按 updatedAt 降序）
   * @returns {Array}
   */
  function getSessions() {
    return sessions.value.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return {
    sessions,
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    updateSession,
    getSessions
  };
}
