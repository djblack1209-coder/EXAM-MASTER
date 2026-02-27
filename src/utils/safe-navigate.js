/**
 * 安全导航工具函数
 * 封装 uni.navigateTo，自动处理导航失败（页面栈满、路径错误等）
 *
 * ✅ F014 增强：
 * - 自动检测 tabBar 页面，使用 switchTab 跳转
 * - switchTab 失败时降级为 reLaunch
 * - 普通页面失败时降级为 redirectTo
 */

import { logger } from '@/utils/logger.js';

// tabBar 页面路径列表（与 pages.json 中 tabBar.list 保持一致）
const TAB_BAR_PAGES = ['/pages/index/index', '/pages/practice/index', '/pages/school/index', '/pages/profile/index'];

/**
 * 判断 URL 是否为 tabBar 页面
 * @param {string} url - 页面路径（可能带查询参数）
 * @returns {boolean}
 */
function isTabBarPage(url) {
  // 去掉查询参数
  const path = url.split('?')[0];
  return TAB_BAR_PAGES.some((tab) => path === tab || path === tab.slice(1));
}

/**
 * 安全跳转页面
 * @param {string} url - 目标页面路径
 * @param {Object} [options] - 额外选项
 * @param {Function} [options.success] - 成功回调
 * @param {Function} [options.fail] - 自定义失败处理（传入则不执行默认降级）
 * @param {Function} [options.complete] - 完成回调
 * @param {boolean} [options.silent=false] - 失败时是否静默（不显示toast）
 */
export function safeNavigateTo(url, options = {}) {
  if (!url || typeof url !== 'string') {
    logger.warn('[safeNavigate] invalid url:', url);
    return;
  }

  const { success, fail, complete, silent = false, ...rest } = options;

  // ✅ F014: tabBar 页面自动使用 switchTab
  if (isTabBarPage(url)) {
    // switchTab 不支持查询参数，取纯路径
    const tabUrl = url.split('?')[0];
    uni.switchTab({
      url: tabUrl,
      success(res) {
        success && success(res);
      },
      fail(err) {
        if (fail) {
          fail(err);
          return;
        }
        logger.warn('[safeNavigate] switchTab failed, fallback to reLaunch:', tabUrl, err);
        uni.reLaunch({
          url: tabUrl,
          fail(err2) {
            logger.warn('[safeNavigate] reLaunch also failed:', tabUrl, err2);
            if (!silent) {
              uni.showToast({ title: '页面跳转失败', icon: 'none', duration: 2000 });
            }
          }
        });
      },
      complete(res) {
        complete && complete(res);
      }
    });
    return;
  }

  // 普通页面：navigateTo -> redirectTo 降级
  uni.navigateTo({
    url,
    ...rest,
    success(res) {
      success && success(res);
    },
    fail(err) {
      if (fail) {
        fail(err);
        return;
      }

      logger.warn('[safeNavigate] navigateTo failed, fallback to redirectTo:', url, err);

      uni.redirectTo({
        url,
        fail(err2) {
          logger.warn('[safeNavigate] redirectTo also failed:', url, err2);
          if (!silent) {
            uni.showToast({ title: '页面跳转失败', icon: 'none', duration: 2000 });
          }
        }
      });
    },
    complete(res) {
      complete && complete(res);
    }
  });
}

export default safeNavigateTo;
