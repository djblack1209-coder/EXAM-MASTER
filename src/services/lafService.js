/**
 * lafService 统一入口
 * 从各 .api.js 域模块聚合所有后端接口，对外提供统一的 lafService 对象。
 *
 * 架构：
 *   _request-core.js  — 共享请求基础设施（双服务器切换、重试、缓存、签名等）
 *   ai.api.js         — 智能服务（代理请求、好友对话、智能组题、课堂、诊断等）
 *   auth.api.js       — 认证（登录、邮箱验证码）
 *   practice.api.js   — 题库与练习（题库查询、收藏管理、FSRS 优化）
 *   school.api.js     — 院校数据查询
 *   social.api.js     — 社交（排行榜、好友系统、邀请）
 *   study.api.js      — 学习数据与资源（统计、资源推荐、首页数据）
 *   user.api.js       — 用户服务（资料、注销、目标、成就）
 *   tools.api.js      — 工具服务（证件照、语音、文档转换）
 *   smart-study.api.js — 智能学习引擎（掌握度分析、错题聚类、深度矫正、冲刺优先级、AI学习计划）
 *
 * @module services/lafService
 */

import { request, abortRequest, getRequestKey } from './api/domains/_request-core.js';
import * as aiApi from './api/domains/ai.api.js';
import * as authApi from './api/domains/auth.api.js';
import * as practiceApi from './api/domains/practice.api.js';
import * as schoolApi from './api/domains/school.api.js';
import * as socialApi from './api/domains/social.api.js';
import * as studyApi from './api/domains/study.api.js';
import * as userApi from './api/domains/user.api.js';
import * as toolsApi from './api/domains/tools.api.js';
import * as smartStudyApi from './api/domains/smart-study.api.js';
import { offlineQueue } from '@/utils/core/offline-queue.js';

export { abortRequest, getRequestKey };

export const lafService = {
  // 基础请求方法（来自 _request-core.js）
  request,

  // 各域模块的业务方法
  ...aiApi,
  ...authApi,
  ...practiceApi,
  ...schoolApi,
  ...socialApi,
  ...studyApi,
  ...userApi,
  ...toolsApi,
  ...smartStudyApi
};

// 兼容旧代码：很多地方用 aiService 这个名字
export const aiService = lafService;

export default lafService;

// 注册离线队列请求重建函数
// app 重启后 requestFnMap 丢失，通过 requestData 重建请求
try {
  if (offlineQueue && typeof offlineQueue.registerRebuilder === 'function') {
    offlineQueue.registerRebuilder((requestData) => {
      const { path, data, options } = requestData || {};
      if (!path) {
        return Promise.reject(new Error('无法重建请求：缺少 path'));
      }
      return lafService.request(path, data || {}, options || {});
    });
  }
} catch (_e) {
  // 静默
}
