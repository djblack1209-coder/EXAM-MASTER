/**
 * Group Store — 学习小组状态中心
 *
 * 架构：Page → Store(本文件) → API(group.api.js) → 后端(group-service)
 *
 * @module stores/group
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  createGroup as apiCreate,
  joinGroup as apiJoin,
  getGroups as apiGetList,
  getGroupDetail as apiGetDetail,
  leaveGroup as apiLeave,
  shareResource as apiShare,
  getGroupResources as apiGetResources
} from '@/services/api/domains/group.api.js';
import { logger } from '@/utils/logger.js';

export const useGroupStore = defineStore('group', () => {
  // ==================== State ====================

  /** 我加入的小组列表 */
  const myGroups = ref([]);
  /** 发现页小组列表 */
  const allGroups = ref([]);
  /** 当前查看的小组详情 */
  const currentGroup = ref(null);
  /** 当前小组的资源列表 */
  const groupResources = ref([]);
  /** 加载状态 */
  const loading = ref(false);
  /** 总数 */
  const totalGroups = ref(0);

  // ==================== Actions ====================

  /**
   * 获取我加入的小组
   */
  async function fetchMyGroups(page = 1) {
    loading.value = true;
    try {
      const res = await apiGetList({ type: 'joined', page, pageSize: 20 });
      if (res?.code === 0) {
        myGroups.value = page === 1 ? res.data || [] : [...myGroups.value, ...(res.data || [])];
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[GroupStore] fetchMyGroups 失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 发现小组（全部，分页）
   */
  async function fetchAllGroups(page = 1) {
    loading.value = true;
    try {
      const res = await apiGetList({ type: 'all', page, pageSize: 20 });
      if (res?.code === 0) {
        allGroups.value = page === 1 ? res.data || [] : [...allGroups.value, ...(res.data || [])];
        totalGroups.value = res.total || 0;
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[GroupStore] fetchAllGroups 失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取小组详情
   */
  async function fetchGroupDetail(groupId) {
    loading.value = true;
    try {
      const res = await apiGetDetail(groupId);
      if (res?.code === 0 && res.data) {
        currentGroup.value = res.data;
        return res.data;
      }
      return null;
    } catch (err) {
      logger.warn('[GroupStore] fetchGroupDetail 失败:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建小组
   */
  async function createNewGroup(data) {
    try {
      const res = await apiCreate(data);
      if (res?.code === 0) {
        // 刷新列表
        await fetchMyGroups();
        return { success: true, groupId: res.data?.group_id, message: res.message };
      }
      return { success: false, message: res?.message || '创建失败' };
    } catch (err) {
      logger.warn('[GroupStore] createNewGroup 失败:', err);
      return { success: false, message: '网络异常' };
    }
  }

  /**
   * 加入小组
   */
  async function joinExistingGroup(groupId) {
    try {
      const res = await apiJoin(groupId);
      if (res?.code === 0) {
        await fetchMyGroups();
        return { success: true, message: res.message };
      }
      return { success: false, message: res?.message || '加入失败' };
    } catch (err) {
      logger.warn('[GroupStore] joinExistingGroup 失败:', err);
      return { success: false, message: '网络异常' };
    }
  }

  /**
   * 离开小组
   */
  async function leaveCurrentGroup(groupId) {
    try {
      const res = await apiLeave(groupId);
      if (res?.code === 0) {
        myGroups.value = myGroups.value.filter((g) => g._id !== groupId);
        if (currentGroup.value?._id === groupId) {
          currentGroup.value = null;
        }
        return { success: true, message: res.message };
      }
      return { success: false, message: res?.message || '离开失败' };
    } catch (err) {
      logger.warn('[GroupStore] leaveCurrentGroup 失败:', err);
      return { success: false, message: '网络异常' };
    }
  }

  /**
   * 分享资源到小组
   */
  async function shareToGroup(data) {
    try {
      const res = await apiShare(data);
      if (res?.code === 0) {
        return { success: true, resource: res.data, message: res.message };
      }
      return { success: false, message: res?.message || '分享失败' };
    } catch (err) {
      logger.warn('[GroupStore] shareToGroup 失败:', err);
      return { success: false, message: '网络异常' };
    }
  }

  /**
   * 获取小组资源列表
   */
  async function fetchGroupResources(groupId, page = 1) {
    try {
      const res = await apiGetResources({ groupId, page, pageSize: 20 });
      if (res?.code === 0) {
        groupResources.value = page === 1 ? res.data || [] : [...groupResources.value, ...(res.data || [])];
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[GroupStore] fetchGroupResources 失败:', err);
      return false;
    }
  }

  // ==================== Computed ====================

  /** 我加入的小组数量 */
  const myGroupCount = computed(() => myGroups.value.length);

  /** 当前用户在当前小组中的角色 */
  const myRole = computed(() => currentGroup.value?.member_role || null);

  /** 是否是当前小组成员 */
  const isMember = computed(() => currentGroup.value?.is_member || false);

  return {
    myGroups,
    allGroups,
    currentGroup,
    groupResources,
    loading,
    totalGroups,
    myGroupCount,
    myRole,
    isMember,
    fetchMyGroups,
    fetchAllGroups,
    fetchGroupDetail,
    createNewGroup,
    joinExistingGroup,
    leaveCurrentGroup,
    shareToGroup,
    fetchGroupResources
  };
});
