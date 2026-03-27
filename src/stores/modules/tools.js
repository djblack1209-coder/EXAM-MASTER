/**
 * Tools Store — 工具服务状态管理
 *
 * 集中管理证件照、文档转换等工具类后端调用，
 * 替代 tools/ 页面直接调用 lafService 的架构违规。
 *
 * 覆盖 6 个调用点:
 *   - getPhotoConfig, processIdPhoto
 *   - submitDocConvert, getDocConvertStatus, getDocConvertResult
 *   - photoSearch
 *
 * @module stores/tools
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';

export const useToolsStore = defineStore('tools', () => {
  // ==================== State ====================
  const photoConfig = ref(null);
  const activeDocJob = ref(null); // { jobId, status, fileName }

  // ==================== ID Photo ====================

  /** 获取证件照配置（颜色/尺寸选项） */
  const fetchPhotoConfig = async () => {
    try {
      const res = await lafService.getPhotoConfig();
      if (res.code === 0 && res.data) {
        photoConfig.value = res.data;
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取配置失败');
    } catch (error) {
      logger.error('[ToolsStore] fetchPhotoConfig:', error);
      return { success: false, error };
    }
  };

  /** 处理证件照（换底色/裁剪） */
  const processPhoto = async (imageBase64, color, size, options = {}) => {
    try {
      const res = await lafService.processIdPhoto(imageBase64, color, size, options);
      if (res.code === 0 && res.data) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '处理失败');
    } catch (error) {
      logger.error('[ToolsStore] processPhoto:', error);
      return { success: false, error };
    }
  };

  // ==================== Doc Convert ====================

  /** 提交文档转换任务 */
  const submitConvert = async (fileBase64, fileName, targetType) => {
    try {
      const res = await lafService.submitDocConvert(fileBase64, fileName, targetType);
      if (res.code === 0 && res.data) {
        activeDocJob.value = { jobId: res.data.jobId, status: 'processing', fileName };
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '提交转换失败');
    } catch (error) {
      logger.error('[ToolsStore] submitConvert:', error);
      return { success: false, error };
    }
  };

  /** 查询转换状态 */
  const pollConvertStatus = async (jobId) => {
    try {
      const res = await lafService.getDocConvertStatus(jobId);
      if (res.code === 0 && res.data) {
        if (activeDocJob.value?.jobId === jobId) {
          activeDocJob.value.status = res.data.status;
        }
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '查询状态失败');
    } catch (error) {
      logger.error('[ToolsStore] pollConvertStatus:', error);
      return { success: false, error };
    }
  };

  /** 获取转换结果 */
  const fetchConvertResult = async (jobId) => {
    try {
      const res = await lafService.getDocConvertResult(jobId);
      if (res.code === 0 && res.data) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取结果失败');
    } catch (error) {
      logger.error('[ToolsStore] fetchConvertResult:', error);
      return { success: false, error };
    }
  };

  // ==================== Photo Search ====================

  /** 拍照搜题 */
  const searchByPhoto = async (imageBase64, options = {}) => {
    try {
      const res = await lafService.request('/ai-photo-search', { imageBase64, ...options });
      if (res.code === 0 && res.data) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '搜题失败');
    } catch (error) {
      logger.error('[ToolsStore] searchByPhoto:', error);
      return { success: false, error };
    }
  };

  return {
    // state
    photoConfig,
    activeDocJob,
    // actions
    fetchPhotoConfig,
    processPhoto,
    submitConvert,
    pollConvertStatus,
    fetchConvertResult,
    searchByPhoto
  };
});
