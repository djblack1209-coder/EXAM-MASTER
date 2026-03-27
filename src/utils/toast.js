/**
 * Toast 中心化工具 (Centralized Toast Utility)
 *
 * 统一全项目的提示消息行为，替换 523+ 处散落的 uni.showToast 调用。
 *
 * 设计参考:
 *   - wot-design-uni useToast() 模式 (GitHub 3k+ Stars)
 *   - uni-app 原生 showToast API 向后兼容
 *
 * 功能:
 *   1. 语义化方法: success / error / warning / info / loading
 *   2. 统一默认参数 (duration, icon, position)
 *   3. 链式关闭: 返回 hide 方法
 *   4. 防抖: 连续调用只显示最后一个
 *   5. 向后兼容: toast.show(options) 接受原生参数
 *
 * 使用:
 *   import { toast } from '@/utils/toast.js'
 *   toast.success('保存成功')
 *   toast.error('网络异常，请重试')
 *   toast.loading('加载中...')
 *   toast.info('请先导入题库')
 *
 * @module utils/toast
 */

// 防抖计时器
let _timer = null;

/**
 * 核心显示方法
 * @param {object} options - uni.showToast 参数
 * @returns {{ hide: Function }} 关闭句柄
 */
function show(options = {}) {
  // 防抖: 先关闭上一个
  if (_timer) {
    clearTimeout(_timer);
    uni.hideToast();
  }

  const merged = {
    duration: 2000,
    mask: false,
    ...options
  };

  uni.showToast(merged);

  // 自动清理定时器
  _timer = setTimeout(() => {
    _timer = null;
  }, merged.duration || 2000);

  return {
    hide: () => {
      uni.hideToast();
      if (_timer) {
        clearTimeout(_timer);
        _timer = null;
      }
    }
  };
}

/**
 * 成功提示
 * @param {string} msg - 提示文本
 * @param {number} [duration=1500]
 */
function success(msg, duration = 1500) {
  return show({ title: msg, icon: 'success', duration });
}

/**
 * 错误/失败提示
 * @param {string} msg - 提示文本
 * @param {number} [duration=2500]
 */
function error(msg, duration = 2500) {
  return show({ title: msg, icon: 'none', duration });
}

/**
 * 警告提示
 * @param {string} msg - 提示文本
 * @param {number} [duration=2000]
 */
function warning(msg, duration = 2000) {
  return show({ title: msg, icon: 'none', duration });
}

/**
 * 普通信息提示
 * @param {string} msg - 提示文本
 * @param {number} [duration=2000]
 */
function info(msg, duration = 2000) {
  return show({ title: msg, icon: 'none', duration });
}

/**
 * 加载中提示（需手动调用 hide() 关闭）
 * @param {string} [msg='加载中...'] - 提示文本
 * @returns {{ hide: Function }} 关闭句柄
 */
function loading(msg = '加载中...') {
  uni.showLoading({ title: msg, mask: true });
  return {
    hide: () => uni.hideLoading()
  };
}

/**
 * 隐藏当前提示
 */
function hide() {
  uni.hideToast();
  uni.hideLoading();
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
}

export const toast = {
  show,
  success,
  error,
  warning,
  info,
  loading,
  hide
};

export default toast;
