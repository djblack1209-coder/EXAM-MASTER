/**
 * 文件处理工具 - 文件预览与上传
 * 
 * 功能：
 * 1. 文件预览（PDF/Word/Excel/PPT）
 * 2. 文件上传（带进度条）
 * 3. 文件格式验证
 * 4. 文件大小限制
 * 
 * @version 1.0.0
 * @author Frontend Team
 */

import { logger } from './logger.js';

// 文件配置常量
const FILE_CONFIG = {
  // 支持预览的文件类型
  PREVIEW_TYPES: {
    pdf: 'pdf',
    doc: 'doc',
    docx: 'docx',
    xls: 'xls',
    xlsx: 'xlsx',
    ppt: 'ppt',
    pptx: 'pptx',
  },
  
  // 支持上传的文件类型
  UPLOAD_TYPES: {
    // 文档类
    pdf: { mime: 'application/pdf', category: 'document' },
    doc: { mime: 'application/msword', category: 'document' },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document' },
    xls: { mime: 'application/vnd.ms-excel', category: 'spreadsheet' },
    xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'spreadsheet' },
    ppt: { mime: 'application/vnd.ms-powerpoint', category: 'presentation' },
    pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: 'presentation' },
    // 文本类
    txt: { mime: 'text/plain', category: 'text' },
    md: { mime: 'text/markdown', category: 'text' },
    json: { mime: 'application/json', category: 'data' },
    // 图片类
    jpg: { mime: 'image/jpeg', category: 'image' },
    jpeg: { mime: 'image/jpeg', category: 'image' },
    png: { mime: 'image/png', category: 'image' },
    gif: { mime: 'image/gif', category: 'image' },
    webp: { mime: 'image/webp', category: 'image' },
  },
  
  // 默认文件大小限制（字节）
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  
  // 文件类型图标映射
  TYPE_ICONS: {
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    xls: '📗',
    xlsx: '📗',
    ppt: '📙',
    pptx: '📙',
    txt: '📄',
    md: '📝',
    json: '📋',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    webp: '🖼️',
    default: '📁',
  },
  
  // 不支持的危险文件类型
  BLOCKED_TYPES: ['exe', 'bat', 'cmd', 'sh', 'dll', 'so', 'dmg', 'pkg', 'msi', 'apk', 'ipa'],
};

/**
 * 文件处理类
 */
class FileHandler {
  constructor() {
    this.uploadTasks = new Map(); // 上传任务管理
  }

  /**
   * 获取文件扩展名
   * @param {string} fileName - 文件名
   * @returns {string}
   */
  getFileExtension(fileName) {
    if (!fileName) return '';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  /**
   * 获取文件类型图标
   * @param {string} fileName - 文件名
   * @returns {string}
   */
  getFileIcon(fileName) {
    const ext = this.getFileExtension(fileName);
    return FILE_CONFIG.TYPE_ICONS[ext] || FILE_CONFIG.TYPE_ICONS.default;
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 验证文件格式
   * @param {string} fileName - 文件名
   * @param {Array} allowedTypes - 允许的文件类型数组（可选）
   * @returns {{valid: boolean, error?: string, ext?: string}}
   */
  validateFileType(fileName, allowedTypes = null) {
    const ext = this.getFileExtension(fileName);
    
    // 检查是否是危险文件类型
    if (FILE_CONFIG.BLOCKED_TYPES.includes(ext)) {
      return {
        valid: false,
        error: `不支持 .${ext} 格式的文件`,
        ext,
      };
    }
    
    // 如果指定了允许的类型，检查是否在列表中
    if (allowedTypes && allowedTypes.length > 0) {
      const normalizedAllowed = allowedTypes.map(t => t.toLowerCase().replace('.', ''));
      if (!normalizedAllowed.includes(ext)) {
        return {
          valid: false,
          error: `仅支持 ${allowedTypes.join('、')} 格式`,
          ext,
        };
      }
    }
    
    // 检查是否是已知的支持类型
    if (!FILE_CONFIG.UPLOAD_TYPES[ext]) {
      return {
        valid: false,
        error: `不支持 .${ext} 格式的文件`,
        ext,
      };
    }
    
    return { valid: true, ext };
  }

  /**
   * 验证文件大小
   * @param {number} fileSize - 文件大小（字节）
   * @param {number} maxSize - 最大允许大小（字节）
   * @returns {{valid: boolean, error?: string}}
   */
  validateFileSize(fileSize, maxSize = FILE_CONFIG.MAX_FILE_SIZE) {
    if (fileSize > maxSize) {
      return {
        valid: false,
        error: `文件大小不能超过 ${this.formatFileSize(maxSize)}`,
      };
    }
    return { valid: true };
  }

  /**
   * 完整的文件验证
   * @param {Object} file - 文件对象
   * @param {Object} options - 验证选项
   * @returns {{valid: boolean, errors: Array}}
   */
  validateFile(file, options = {}) {
    const {
      allowedTypes = null,
      maxSize = FILE_CONFIG.MAX_FILE_SIZE,
    } = options;
    
    const errors = [];
    
    // 验证文件类型
    const typeResult = this.validateFileType(file.name, allowedTypes);
    if (!typeResult.valid) {
      errors.push(typeResult.error);
    }
    
    // 验证文件大小
    const sizeResult = this.validateFileSize(file.size, maxSize);
    if (!sizeResult.valid) {
      errors.push(sizeResult.error);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      ext: typeResult.ext,
    };
  }

  /**
   * 预览文件
   * @param {Object} file - 文件对象 {name, path, url}
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async previewFile(file) {
    const ext = this.getFileExtension(file.name);
    const filePath = file.path || file.tempFilePath || file.url;
    
    if (!filePath) {
      uni.showToast({ title: '文件路径无效', icon: 'none' });
      return { success: false, error: 'invalid path' };
    }
    
    logger.log('[FileHandler] 预览文件:', file.name, ext);
    
    // 图片预览
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return this.previewImage(filePath);
    }
    
    // 文档预览
    if (Object.keys(FILE_CONFIG.PREVIEW_TYPES).includes(ext)) {
      return this.previewDocument(filePath, ext);
    }
    
    // 不支持的类型
    uni.showToast({ title: '暂不支持预览此类型文件', icon: 'none' });
    return { success: false, error: 'unsupported type' };
  }

  /**
   * 预览图片
   * @param {string} filePath - 图片路径
   * @returns {Promise<{success: boolean}>}
   */
  async previewImage(filePath) {
    return new Promise((resolve) => {
      uni.previewImage({
        urls: [filePath],
        current: filePath,
        success: () => {
          resolve({ success: true });
        },
        fail: (err) => {
          logger.error('[FileHandler] 图片预览失败:', err);
          uni.showToast({ title: '图片预览失败', icon: 'none' });
          resolve({ success: false, error: err });
        }
      });
    });
  }

  /**
   * 预览文档（PDF/Word/Excel/PPT）
   * @param {string} filePath - 文件路径
   * @param {string} fileType - 文件类型
   * @returns {Promise<{success: boolean}>}
   */
  async previewDocument(filePath, fileType) {
    // 如果是网络文件，先下载
    if (filePath.startsWith('http')) {
      return this.downloadAndPreview(filePath, fileType);
    }
    
    // 本地文件直接打开
    return this.openDocument(filePath, fileType);
  }

  /**
   * 下载并预览文件
   * @param {string} url - 文件 URL
   * @param {string} fileType - 文件类型
   * @returns {Promise<{success: boolean}>}
   */
  async downloadAndPreview(url, fileType) {
    uni.showLoading({ title: '加载中...', mask: true });
    
    return new Promise((resolve) => {
      uni.downloadFile({
        url: url,
        success: (res) => {
          uni.hideLoading();
          
          if (res.statusCode === 200) {
            this.openDocument(res.tempFilePath, fileType).then(resolve);
          } else {
            logger.error('[FileHandler] 文件下载失败:', res.statusCode);
            uni.showToast({ title: '文件加载失败', icon: 'none' });
            resolve({ success: false, error: `download failed: ${res.statusCode}` });
          }
        },
        fail: (err) => {
          uni.hideLoading();
          logger.error('[FileHandler] 文件下载失败:', err);
          uni.showToast({ title: '文件加载失败', icon: 'none' });
          resolve({ success: false, error: err });
        }
      });
    });
  }

  /**
   * 打开文档
   * @param {string} filePath - 文件路径
   * @param {string} fileType - 文件类型
   * @returns {Promise<{success: boolean}>}
   */
  async openDocument(filePath, fileType) {
    return new Promise((resolve) => {
      uni.openDocument({
        filePath: filePath,
        fileType: fileType, // 必须准确指定，否则安卓端可能无法打开
        showMenu: true, // 显示右上角菜单
        success: () => {
          logger.log('[FileHandler] 文档打开成功');
          resolve({ success: true });
        },
        fail: (err) => {
          logger.error('[FileHandler] 文档打开失败:', err);
          
          // 针对不同错误给出提示
          if (err.errMsg && err.errMsg.includes('not support')) {
            uni.showToast({ title: '当前设备不支持预览此文件', icon: 'none' });
          } else if (err.errMsg && err.errMsg.includes('fail')) {
            uni.showToast({ title: '文件打开失败，请检查文件是否损坏', icon: 'none' });
          } else {
            uni.showToast({ title: '文件打开失败', icon: 'none' });
          }
          
          resolve({ success: false, error: err });
        }
      });
    });
  }

  /**
   * 选择文件
   * @param {Object} options - 选择选项
   * @returns {Promise<{success: boolean, file?: Object}>}
   */
  async chooseFile(options = {}) {
    const {
      count = 1,
      allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'],
      maxSize = FILE_CONFIG.MAX_FILE_SIZE,
      source = 'all', // 'all' | 'album' | 'camera' | 'conversation'
    } = options;
    
    return new Promise((resolve) => {
      // #ifdef MP-WEIXIN
      // 微信小程序使用 chooseMessageFile
      wx.chooseMessageFile({
        count: count,
        type: 'file',
        extension: allowedTypes.map(t => t.startsWith('.') ? t.substring(1) : t),
        success: (res) => {
          const file = res.tempFiles[0];
          
          // 验证文件
          const validation = this.validateFile(file, { allowedTypes, maxSize });
          
          if (!validation.valid) {
            uni.showToast({ 
              title: validation.errors[0], 
              icon: 'none',
              duration: 2000
            });
            resolve({ success: false, errors: validation.errors });
            return;
          }
          
          resolve({ 
            success: true, 
            file: {
              name: file.name,
              path: file.path,
              size: file.size,
              type: file.type,
              ext: validation.ext,
            }
          });
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('cancel')) {
            resolve({ success: false, cancelled: true });
          } else {
            logger.error('[FileHandler] 文件选择失败:', err);
            uni.showToast({ title: '文件选择失败', icon: 'none' });
            resolve({ success: false, error: err });
          }
        }
      });
      // #endif

      // #ifndef MP-WEIXIN
      // 其他平台使用 uni.chooseFile
      uni.chooseFile({
        count: count,
        extension: allowedTypes.map(t => t.startsWith('.') ? t : `.${t}`),
        success: (res) => {
          const file = res.tempFiles[0];
          
          // 验证文件
          const validation = this.validateFile(file, { allowedTypes, maxSize });
          
          if (!validation.valid) {
            uni.showToast({ 
              title: validation.errors[0], 
              icon: 'none',
              duration: 2000
            });
            resolve({ success: false, errors: validation.errors });
            return;
          }
          
          resolve({ 
            success: true, 
            file: {
              name: file.name,
              path: file.path || file.tempFilePath,
              size: file.size,
              type: file.type,
              ext: validation.ext,
            }
          });
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('cancel')) {
            resolve({ success: false, cancelled: true });
          } else {
            logger.error('[FileHandler] 文件选择失败:', err);
            uni.showToast({ title: '文件选择失败', icon: 'none' });
            resolve({ success: false, error: err });
          }
        }
      });
      // #endif
    });
  }

  /**
   * 上传文件（带进度）
   * @param {Object} file - 文件对象
   * @param {Object} options - 上传选项
   * @returns {Promise<{success: boolean, data?: any}>}
   */
  async uploadFile(file, options = {}) {
    const {
      url,
      name = 'file',
      formData = {},
      header = {},
      onProgress = null,
      timeout = 60000,
    } = options;
    
    if (!url) {
      return { success: false, error: 'upload url is required' };
    }
    
    const taskId = `upload_${Date.now()}`;
    
    return new Promise((resolve) => {
      const uploadTask = uni.uploadFile({
        url: url,
        filePath: file.path,
        name: name,
        formData: {
          ...formData,
          fileName: file.name,
          fileSize: file.size,
        },
        header: header,
        timeout: timeout,
        success: (res) => {
          this.uploadTasks.delete(taskId);
          
          if (res.statusCode === 200) {
            let data = res.data;
            try {
              data = JSON.parse(res.data);
            } catch (e) {}
            
            logger.log('[FileHandler] 文件上传成功:', file.name);
            resolve({ success: true, data });
          } else {
            logger.error('[FileHandler] 文件上传失败:', res.statusCode);
            resolve({ success: false, error: `upload failed: ${res.statusCode}` });
          }
        },
        fail: (err) => {
          this.uploadTasks.delete(taskId);
          logger.error('[FileHandler] 文件上传失败:', err);
          resolve({ success: false, error: err });
        }
      });
      
      // 保存上传任务
      this.uploadTasks.set(taskId, uploadTask);
      
      // 监听上传进度
      if (onProgress && typeof onProgress === 'function') {
        uploadTask.onProgressUpdate((res) => {
          onProgress({
            progress: res.progress,
            totalBytesSent: res.totalBytesSent,
            totalBytesExpectedToSend: res.totalBytesExpectedToSend,
          });
        });
      }
    });
  }

  /**
   * 取消上传
   * @param {string} taskId - 任务 ID
   */
  cancelUpload(taskId) {
    const task = this.uploadTasks.get(taskId);
    if (task) {
      task.abort();
      this.uploadTasks.delete(taskId);
      logger.log('[FileHandler] 上传已取消:', taskId);
    }
  }

  /**
   * 取消所有上传
   */
  cancelAllUploads() {
    this.uploadTasks.forEach((task, taskId) => {
      task.abort();
      logger.log('[FileHandler] 上传已取消:', taskId);
    });
    this.uploadTasks.clear();
  }

  /**
   * 读取文本文件内容
   * @param {string} filePath - 文件路径
   * @param {string} encoding - 编码
   * @returns {Promise<{success: boolean, content?: string}>}
   */
  async readTextFile(filePath, encoding = 'utf8') {
    return new Promise((resolve) => {
      const fs = uni.getFileSystemManager();
      fs.readFile({
        filePath: filePath,
        encoding: encoding,
        success: (res) => {
          resolve({ success: true, content: res.data });
        },
        fail: (err) => {
          logger.error('[FileHandler] 文件读取失败:', err);
          resolve({ success: false, error: err });
        }
      });
    });
  }
}

// 导出单例
export const fileHandler = new FileHandler();

// 导出配置
export { FILE_CONFIG };

export default fileHandler;
