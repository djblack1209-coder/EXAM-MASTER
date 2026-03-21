import { aiService, abortRequest, getRequestKey } from './api/domains/ai.service.js';
import { schoolService } from './api/domains/school.service.js';
import { authService } from './api/domains/auth.service.js';
import { favoriteService } from './api/domains/favorite.service.js';
import { practiceService } from './api/domains/practice.service.js';
import { socialDomain } from './api/domains/social.service.js';

const { request } = aiService;

export { abortRequest, getRequestKey };

export const lafService = {
  request,
  ...aiService,
  ...schoolService,
  ...authService,
  ...favoriteService,
  ...practiceService,
  ...socialDomain,

  // ===== 引流工具 API =====
  // 证件照换底色
  getPhotoConfig() {
    return request('/photo-bg', { action: 'config' });
  },
  processIdPhoto(imageBase64, color, size, options = {}) {
    return request('/id-photo-segment-base64', {
      imageBase64,
      color,
      size,
      ...options
    });
  },

  // 文档格式转换
  getDocConvertTypes() {
    return request('/doc-convert', { action: 'types' });
  },
  submitDocConvert(fileBase64, fileName, targetType) {
    return request('/doc-convert', {
      action: 'convert',
      fileBase64,
      fileName,
      targetType
    });
  },
  getDocConvertStatus(jobId) {
    return request('/doc-convert', { action: 'status', jobId });
  },
  getDocConvertResult(jobId) {
    return request('/doc-convert', { action: 'result', jobId });
  }
};

export default lafService;
