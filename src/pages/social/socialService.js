import { logger } from '@/utils/logger.js';
import { lafService } from '@/services/lafService.js';
import storageService from '@/services/storageService.js';

/**
 * 社交服务（Module 7）
 * 架构原则：Cloud First, Local Fallback
 */
export const socialService = {
  /**
   * 搜索用户（通过昵称精确匹配）
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Object>} 搜索结果
   */
  async searchUser(keyword) {
    try {
      logger.log('[Social] 搜索用户:', keyword);

      const res = await lafService.socialService({
        action: 'search_user',
        keyword: keyword
      });

      logger.log('[Social] 搜索结果:', res);
      return res;
    } catch (err) {
      logger.error('[Social] 搜索用户失败:', err);
      return { code: -1, msg: '搜索失败', data: [] };
    }
  },

  /**
   * 发送好友请求
   * @param {string} targetUid - 目标用户ID
   * @param {string} message - 请求附言（可选）
   * @returns {Promise<Object>} 操作结果
   */
  async sendRequest(targetUid, message = '') {
    try {
      logger.log('[Social] 发送好友请求:', { targetUid, message });

      const res = await lafService.socialService({
        action: 'send_request',
        targetUid: targetUid,
        message: message
      });

      logger.log('[Social] 发送结果:', res);
      return res;
    } catch (err) {
      logger.error('[Social] 发送好友请求失败:', err);
      return { code: -1, msg: '发送失败' };
    }
  },

  /**
   * 处理好友请求（同意/拒绝）
   * @param {string} fromUid - 发送者用户ID
   * @param {string} action - 操作：'accept' 或 'reject'
   * @returns {Promise<Object>} 操作结果
   */
  async handleRequest(fromUid, action) {
    try {
      logger.log('[Social] 处理好友请求:', { fromUid, action });

      const res = await lafService.socialService({
        action: 'handle_request',
        fromUid: fromUid,
        requestAction: action
      });

      logger.log('[Social] 处理结果:', res);
      return res;
    } catch (err) {
      logger.error('[Social] 处理好友请求失败:', err);
      return { code: -1, msg: '操作失败' };
    }
  },

  /**
   * 获取好友列表（支持本地缓存）
   * @param {string} sortBy - 排序方式：'score'（分数）、'active'（活跃度）、'added'（添加时间）
   * @param {boolean} useCache - 是否使用缓存
   * @returns {Promise<Object>} 好友列表
   */
  async getFriendList(sortBy = 'score', useCache = true) {
    logger.log('[Social] 获取好友列表:', { sortBy, useCache });

    // 1. 尝试从本地缓存读取
    if (useCache) {
      const cached = storageService.get('friend_list_cache');
      const cacheTime = storageService.get('friend_list_cache_time');
      const now = Date.now();

      // 缓存有效期：5分钟
      if (cached && cacheTime && now - cacheTime < 5 * 60 * 1000) {
        logger.log('[Social] 使用缓存的好友列表');
        return { code: 0, msg: '获取成功（缓存）', data: cached };
      }
    }

    // 2. 从云端获取
    try {
      const res = await lafService.socialService({
        action: 'get_friend_list',
        sortBy: sortBy
      });

      logger.log('[Social] 云端获取结果:', res);

      // 3. 更新本地缓存
      if (res.code === 0 && res.data) {
        storageService.save('friend_list_cache', res.data);
        storageService.save('friend_list_cache_time', Date.now());
        logger.log('[Social] 已更新本地缓存');
      }

      return res;
    } catch (err) {
      logger.error('[Social] 获取好友列表失败:', err);

      // 4. 降级：返回缓存数据（即使过期）
      const cached = storageService.get('friend_list_cache');
      if (cached) {
        logger.warn('[Social] 云端失败，使用过期缓存');
        return { code: 0, msg: '获取成功（降级缓存）', data: cached };
      }

      return { code: -1, msg: '获取失败', data: [] };
    }
  },

  /**
   * 获取好友请求列表
   * @returns {Promise<Object>} 好友请求列表
   */
  async getFriendRequests() {
    try {
      logger.log('[Social] 获取好友请求列表');

      const res = await lafService.socialService({
        action: 'get_friend_requests'
      });

      logger.log('[Social] 好友请求列表:', res);
      return res;
    } catch (err) {
      logger.error('[Social] 获取好友请求失败:', err);
      return { code: -1, msg: '获取失败', data: [] };
    }
  },

  /**
   * 删除好友
   * @param {string} friendUid - 好友用户ID
   * @returns {Promise<Object>} 操作结果
   */
  async removeFriend(friendUid) {
    try {
      logger.log('[Social] 删除好友:', friendUid);

      const res = await lafService.socialService({
        action: 'remove_friend',
        friendUid: friendUid
      });

      // 删除成功后清除缓存
      if (res.code === 0) {
        storageService.remove('friend_list_cache');
        storageService.remove('friend_list_cache_time');
        logger.log('[Social] 已清除缓存');
      }

      logger.log('[Social] 删除结果:', res);
      return res;
    } catch (err) {
      logger.error('[Social] 删除好友失败:', err);
      return { code: -1, msg: '删除失败' };
    }
  },

  /**
   * 清除好友列表缓存
   */
  clearCache() {
    storageService.remove('friend_list_cache');
    storageService.remove('friend_list_cache_time');
    logger.log('[Social] 已清除好友列表缓存');
  }
};
