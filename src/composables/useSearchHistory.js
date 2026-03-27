/**
 * 搜索历史持久化 composable
 *
 * 搬运参考:
 *   - 微信/淘宝/百度搜索历史交互模式
 *   - 考研场景: 用户反复搜索同一所学校、同一类题目
 *
 * 功能:
 *   - 本地持久化搜索历史 (uni.setStorageSync)
 *   - 自动去重 + 置顶最新
 *   - 可配置最大记录数
 *   - 支持多个独立搜索场景 (school / question / chat)
 *
 * 使用:
 *   const { history, add, remove, clear } = useSearchHistory('school', { maxItems: 10 })
 *   add('北京大学')
 *   // history.value → ['北京大学', ...]
 *
 * @module composables/useSearchHistory
 */

import { ref, onMounted } from 'vue';

const STORAGE_PREFIX = 'search_history_';

/**
 * @param {string} scope - 搜索场景标识 (e.g. 'school', 'question', 'chat')
 * @param {object} [options]
 * @param {number} [options.maxItems=15] - 最大保留条数
 * @returns {{ history: Ref<string[]>, add: Function, remove: Function, clear: Function }}
 */
export function useSearchHistory(scope, options = {}) {
  const { maxItems = 15 } = options;
  const storageKey = STORAGE_PREFIX + scope;
  const history = ref([]);

  function load() {
    try {
      const raw = uni.getStorageSync(storageKey);
      if (Array.isArray(raw)) {
        history.value = raw;
      } else if (typeof raw === 'string' && raw) {
        history.value = JSON.parse(raw);
      }
    } catch {
      history.value = [];
    }
  }

  function save() {
    try {
      uni.setStorageSync(storageKey, history.value);
    } catch {
      // silent
    }
  }

  /**
   * 添加搜索记录（自动去重 + 置顶）
   * @param {string} keyword
   */
  function add(keyword) {
    if (!keyword || !keyword.trim()) return;
    const kw = keyword.trim();
    // 去重: 如果已存在则先移除
    const filtered = history.value.filter((h) => h !== kw);
    // 置顶: 插入到最前面
    filtered.unshift(kw);
    // 限制最大数量
    history.value = filtered.slice(0, maxItems);
    save();
  }

  /**
   * 删除指定搜索记录
   * @param {string} keyword
   */
  function remove(keyword) {
    history.value = history.value.filter((h) => h !== keyword);
    save();
  }

  /**
   * 清空所有搜索历史
   */
  function clear() {
    history.value = [];
    save();
  }

  onMounted(load);

  return { history, add, remove, clear };
}
