/**
 * 数字平滑过渡 composable
 *
 * 当 actualValue 变化时，displayValue 会以缓动动画过渡到新值。
 *
 * @module composables/useAnimatedNumber
 *
 * @example
 * ```vue
 * <script setup>
 * import { ref } from 'vue';
 * import { useAnimatedNumber } from '@/composables/useAnimatedNumber';
 *
 * const xp = ref(0);
 * const { displayValue } = useAnimatedNumber(xp, { duration: 600 });
 * </script>
 * <template>
 *   <text>{{ displayValue }} XP</text>
 * </template>
 * ```
 */

import { ref, watch, onUnmounted } from 'vue';
import { animateNumber } from '@/utils/animations/micro-interactions';

/**
 * @param {import('vue').Ref<number>|import('vue').ComputedRef<number>} source - 实际数值（响应式）
 * @param {object} [options]
 * @param {number} [options.duration=800] - 动画时长 ms
 * @returns {{ displayValue: import('vue').Ref<number> }}
 */
export function useAnimatedNumber(source, options = {}) {
  const { duration = 800 } = options;
  const displayValue = ref(source.value ?? 0);

  let handle = null;

  const stop = watch(
    source,
    (newVal, oldVal) => {
      // 取消上一次未完成的动画
      if (handle) handle.cancel();

      const from = oldVal ?? displayValue.value;
      const to = newVal ?? 0;

      if (from === to) {
        displayValue.value = to;
        return;
      }

      handle = animateNumber(from, to, duration, (current) => {
        displayValue.value = current;
      });
    },
    { immediate: false }
  );

  onUnmounted(() => {
    stop();
    if (handle) handle.cancel();
  });

  return { displayValue };
}
