/**
 * @antv/f2 图表组合式函数
 * 封装 F2 图表初始化、更新、销毁，兼容 H5 与小程序 Canvas
 */

import { ref, onUnmounted } from 'vue';
import { Canvas as F2Canvas } from '@antv/f2';

/**
 * @param {Object} options
 * @param {import('vue').Ref<HTMLElement|null>} options.canvasRef - canvas 元素 ref
 * @param {Function} options.chartConfig - (data) => F2 JSX 配置的工厂函数
 * @param {Array} options.data - 初始数据
 * @param {number} options.width
 * @param {number} options.height
 * @returns {{ chartRef: import('vue').Ref, updateData: Function, isReady: import('vue').Ref<boolean>, init: Function, destroy: Function }}
 */
export function useF2Chart({ canvasRef, chartConfig, data = [], width = 300, height = 200 }) {
  const chartRef = ref(null);
  const isReady = ref(false);
  let currentData = [...data];

  function getCanvasContext(canvas) {
    // #ifdef MP-WEIXIN || MP-QQ
    return uni.createCanvasContext(canvas, this);
    // #endif

    // #ifndef MP-WEIXIN || MP-QQ
    return canvas.getContext('2d');
    // #endif
  }

  function init(el) {
    if (chartRef.value) destroy();
    const target = el || canvasRef?.value;
    if (!target) return;

    const context = getCanvasContext(target);
    const props = chartConfig(currentData);

    chartRef.value = new F2Canvas({
      context,
      pixelRatio: uni.getSystemInfoSync().pixelRatio || 2,
      width,
      height,
      children: props
    });
    chartRef.value.render();
    isReady.value = true;
  }

  function updateData(newData) {
    currentData = [...newData];
    if (!chartRef.value) return;
    const props = chartConfig(currentData);
    chartRef.value.update({ children: props });
  }

  function destroy() {
    if (chartRef.value) {
      chartRef.value.destroy();
      chartRef.value = null;
      isReady.value = false;
    }
  }

  onUnmounted(destroy);

  return { chartRef, updateData, isReady, init, destroy };
}
