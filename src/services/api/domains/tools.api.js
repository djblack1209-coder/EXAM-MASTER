/**
 * 工具类服务 API
 * 职责：证件照处理（去背景/换底色）、文档格式转换、语音识别/合成、音色列表
 *
 * @module services/api/domains/tools
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

// ==================== 证件照服务 ====================

/**
 * 获取证件照配置（支持的底色、尺寸等）
 * @returns {Promise} 返回配置信息
 */
export async function getPhotoConfig() {
  try {
    return await request('/photo-bg', { action: 'config' });
  } catch (error) {
    logger.warn('[LafService] 获取证件照配置失败:', error);
    return normalizeError(error, '获取证件照配置');
  }
}

/**
 * 证件照换底色（抠图+换背景色+裁剪尺寸）
 * @param {string} imageBase64 - 图片 base64
 * @param {string} color - 背景颜色（如 '#438EDB'）
 * @param {string} size - 目标尺寸（如 '295x413'）
 * @param {Object} options - 额外参数
 * @returns {Promise} 返回处理后的图片
 */
export async function processIdPhoto(imageBase64, color, size, options = {}) {
  try {
    return await request('/id-photo-segment-base64', {
      imageBase64,
      color,
      size,
      ...options
    });
  } catch (error) {
    logger.warn('[LafService] 证件照处理失败:', error);
    return normalizeError(error, '证件照处理');
  }
}

// ==================== 语音服务 ====================

/**
 * 语音转文字
 * @param {string} audioBase64 - 音频 base64
 * @param {string} audioFormat - 音频格式（默认 mp3）
 * @param {object} options - 额外参数（hotwords/prompt）
 */
export async function speechToText(audioBase64, audioFormat = 'mp3', options = {}) {
  try {
    return await request(
      '/voice-service',
      {
        action: 'speech_to_text',
        audioBase64,
        audioFormat,
        ...options
      },
      { timeout: 60000, maxRetries: 1 }
    );
  } catch (error) {
    logger.warn('[LafService] 语音识别失败:', error);
    return normalizeError(error, '语音识别');
  }
}

/**
 * 文字转语音
 * @param {string} text - 待合成文本
 * @param {object} options - 额外参数（voice/speed/volume/format）
 */
export async function textToSpeech(text, options = {}) {
  try {
    return await request(
      '/voice-service',
      {
        action: 'text_to_speech',
        text,
        ...options
      },
      { timeout: 60000, maxRetries: 1 }
    );
  } catch (error) {
    logger.warn('[LafService] 语音合成失败:', error);
    return normalizeError(error, '语音合成');
  }
}

/**
 * 获取可用音色列表
 */
export async function getVoiceOptions() {
  try {
    return await request('/voice-service', { action: 'get_voices' });
  } catch (error) {
    logger.warn('[LafService] 获取音色列表失败:', error);
    return normalizeError(error, '获取音色列表');
  }
}

// ==================== 文档格式转换 ====================

/**
 * 提交文档格式转换任务
 * @param {string} fileBase64 - 文件 base64
 * @param {string} fileName - 原文件名
 * @param {string} targetType - 目标格式
 * @returns {Promise} 返回转换任务信息
 */
export async function submitDocConvert(fileBase64, fileName, targetType) {
  try {
    return await request('/doc-convert', {
      action: 'convert',
      fileBase64,
      fileName,
      targetType
    });
  } catch (error) {
    logger.warn('[LafService] 提交文档转换失败:', error);
    return normalizeError(error, '提交文档转换');
  }
}

/**
 * 查询文档转换状态
 * @param {string} jobId - 转换任务ID
 * @returns {Promise} 返回转换状态
 */
export async function getDocConvertStatus(jobId) {
  try {
    return await request('/doc-convert', { action: 'status', jobId });
  } catch (error) {
    logger.warn('[LafService] 查询转换状态失败:', error);
    return normalizeError(error, '查询转换状态');
  }
}

/**
 * 获取文档转换结果
 * @param {string} jobId - 转换任务ID
 * @returns {Promise} 返回转换后的文件
 */
export async function getDocConvertResult(jobId) {
  try {
    return await request('/doc-convert', { action: 'result', jobId });
  } catch (error) {
    logger.warn('[LafService] 获取转换结果失败:', error);
    return normalizeError(error, '获取转换结果');
  }
}
