import { ref, computed } from 'vue';

/**
 * Lightweight virtual scroll composable for uni-app scroll-view.
 * Renders only visible items + buffer to keep DOM lean.
 *
 * @param {import('vue').Ref<Array>} items - reactive array of all items
 * @param {number} itemHeight - height of each item in rpx
 * @param {number} containerHeight - visible container height in rpx
 * @param {object} [opts]
 * @param {number} [opts.bufferSize=5] - extra items above/below viewport
 */
export function useVirtualScroll(items, itemHeight, containerHeight, opts = {}) {
  const bufferSize = opts.bufferSize ?? 5;
  const scrollTop = ref(0);

  // rpx → px ratio (750rpx design width)
  const rpxRatio = computed(() => {
    try {
      const info = uni.getSystemInfoSync();
      return info.windowWidth / 750;
    } catch {
      return 0.5;
    }
  });

  const itemHeightPx = computed(() => itemHeight * rpxRatio.value);

  const getList = () => (Array.isArray(items) ? items : items.value || []);

  const totalHeight = computed(() => {
    return getList().length * itemHeightPx.value;
  });

  const containerHeightPx = computed(() => containerHeight * rpxRatio.value);

  const visibleRange = computed(() => {
    const list = getList();
    const count = list.length;
    if (!count) return { start: 0, end: 0 };

    const h = itemHeightPx.value;
    if (h <= 0) return { start: 0, end: Math.min(count, 20) };

    const rawStart = Math.floor(scrollTop.value / h);
    const visibleCount = Math.ceil(containerHeightPx.value / h);

    const start = Math.max(0, rawStart - bufferSize);
    const end = Math.min(count, rawStart + visibleCount + bufferSize);
    return { start, end };
  });

  const visibleItems = computed(() => {
    const list = getList();
    const { start, end } = visibleRange.value;
    return list.slice(start, end).map((item, i) => ({
      ...item,
      _virtualIndex: start + i,
      _virtualKey: item.id || item._id || `v_${start + i}`
    }));
  });

  const containerStyle = computed(() => ({
    height: `${totalHeight.value}px`,
    position: 'relative'
  }));

  const listStyle = computed(() => ({
    transform: `translateY(${visibleRange.value.start * itemHeightPx.value}px)`,
    position: 'absolute',
    left: 0,
    right: 0
  }));

  function onScroll(e) {
    scrollTop.value = e.detail?.scrollTop ?? e.target?.scrollTop ?? 0;
  }

  return {
    visibleItems,
    containerStyle,
    listStyle,
    onScroll,
    scrollTop,
    visibleRange
  };
}
