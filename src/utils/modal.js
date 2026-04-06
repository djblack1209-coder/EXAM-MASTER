/**
 * Modal 中心化工具 (Programmatic Modal Utility)
 *
 * 统一全项目的弹窗行为，替换 83+ 处散落的 uni.showModal 调用。
 * 提供语义化 API，向后兼容 uni.showModal 原生参数。
 *
 * 设计参考:
 *   - 与 toast.js 保持一致的 API 设计风格
 *   - 返回 Promise 替代回调，简化 async/await 使用
 *
 * 使用:
 *   import { modal } from '@/utils/modal.js'
 *
 *   // 确认弹窗（双按钮: 取消 + 确定）
 *   const { confirm } = await modal.confirm('确认删除？', '删除后不可恢复')
 *   if (confirm) { ... }
 *
 *   // 纯提示弹窗（单按钮: 确定）
 *   await modal.alert('操作成功')
 *
 *   // 警告确认
 *   const { confirm } = await modal.warning('此操作不可撤销')
 *
 *   // 完整参数
 *   const { confirm } = await modal.confirm({
 *     title: '提示', content: '确认退出？',
 *     confirmText: '退出', cancelText: '留下'
 *   })
 *
 * @module utils/modal
 */

/**
 * 参数归一化：支持 (title, content) 或 ({ title, content, ... }) 两种调用方式
 * @param {string|object} titleOrOptions
 * @param {string} [content]
 * @returns {object}
 */
function _normalize(titleOrOptions, content) {
  if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
    return titleOrOptions;
  }
  // modal.confirm('标题', '内容') 简写
  if (content !== undefined) {
    return { title: String(titleOrOptions), content: String(content) };
  }
  // modal.confirm('仅内容') — 标题默认"提示"
  return { content: String(titleOrOptions || '') };
}

/**
 * 核心显示方法
 * @param {object} options
 * @param {string} [options.title='提示']
 * @param {string} [options.content='']
 * @param {boolean} [options.showCancel=true]
 * @param {string} [options.confirmText='确定']
 * @param {string} [options.cancelText='取消']
 * @param {string} [options.confirmColor]
 * @param {string} [options.cancelColor]
 * @returns {Promise<{confirm: boolean, cancel: boolean}>}
 */
function show(options = {}) {
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title || '提示',
      content: options.content || '',
      showCancel: options.showCancel !== false,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      confirmColor: options.confirmColor || '#34C759',
      cancelColor: options.cancelColor || '#8E8E93',
      success: (res) => {
        resolve({
          confirm: !!res.confirm,
          cancel: !!res.cancel
        });
      },
      fail: () => {
        resolve({ confirm: false, cancel: true });
      }
    });
  });
}

/**
 * 确认弹窗（双按钮: 取消 + 确定）
 * @param {string|object} titleOrOptions - 标题或完整选项
 * @param {string} [content] - 内容（当第一参数为标题时）
 * @returns {Promise<{confirm: boolean, cancel: boolean}>}
 */
function confirm(titleOrOptions, content) {
  const opts = _normalize(titleOrOptions, content);
  return show({ ...opts, showCancel: true });
}

/**
 * 纯提示弹窗（单按钮: 确定）
 * @param {string|object} titleOrOptions
 * @param {string} [content]
 * @returns {Promise<{confirm: boolean}>}
 */
function alert(titleOrOptions, content) {
  const opts = _normalize(titleOrOptions, content);
  return show({ ...opts, showCancel: false });
}

/**
 * 成功提示弹窗
 */
function success(titleOrOptions, content) {
  const opts = _normalize(titleOrOptions, content);
  return show({
    title: opts.title || '成功',
    ...opts,
    showCancel: false
  });
}

/**
 * 警告确认弹窗（橙色确认按钮）
 */
function warning(titleOrOptions, content) {
  const opts = _normalize(titleOrOptions, content);
  return show({
    title: opts.title || '警告',
    ...opts,
    showCancel: true,
    confirmColor: '#FF9500'
  });
}

/**
 * 错误提示弹窗（红色确认按钮）
 */
function error(titleOrOptions, content) {
  const opts = _normalize(titleOrOptions, content);
  return show({
    title: opts.title || '出错了',
    ...opts,
    showCancel: false,
    confirmColor: '#FF3B30'
  });
}

export const modal = {
  show,
  confirm,
  alert,
  success,
  warning,
  error
};

export default modal;
