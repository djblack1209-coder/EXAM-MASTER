<template>
  <view class="base-countup">
    <!-- #ifdef H5 -->
    <span ref="counterRef" class="base-countup__value" :style="valueStyle">0</span>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <text class="base-countup__value" :style="valueStyle">{{ displayValue }}</text>
    <!-- #endif -->

    <text v-if="suffix" class="base-countup__suffix" :style="suffixStyle">{{ suffix }}</text>
    <text v-if="prefix" class="base-countup__prefix" :style="prefixStyle">{{ prefix }}</text>
  </view>
</template>

<script setup>
/**
 * BaseCountup - 数字滚动动画组件
 *
 * H5 端使用 vue-countup-v3（基于 countUp.js，丝滑动画），
 * 小程序端使用纯 JS requestAnimationFrame 降级方案。
 *
 * 用法:
 *   <base-countup :end-val="1234" :duration="2" suffix="题" />
 *   <base-countup :end-val="98.5" :decimals="1" suffix="%" />
 */
import { ref, watch, onMounted, nextTick, computed } from 'vue';

const props = defineProps({
  /** 起始值 */
  startVal: {
    type: Number,
    default: 0
  },
  /** 目标值 */
  endVal: {
    type: Number,
    default: 0
  },
  /** 动画持续时间（秒） */
  duration: {
    type: Number,
    default: 2
  },
  /** 小数位数 */
  decimals: {
    type: Number,
    default: 0
  },
  /** 后缀文字 */
  suffix: {
    type: String,
    default: ''
  },
  /** 前缀文字 */
  prefix: {
    type: String,
    default: ''
  },
  /** 是否自动开始 */
  autoplay: {
    type: Boolean,
    default: true
  },
  /** 数值字体大小 */
  fontSize: {
    type: String,
    default: '48rpx'
  },
  /** 数值字体颜色 */
  color: {
    type: String,
    default: ''
  },
  /** 数值字重 */
  fontWeight: {
    type: [String, Number],
    default: 700
  },
  /** 千分位分隔符 */
  separator: {
    type: String,
    default: ','
  },
  /** 是否使用千分位 */
  useGrouping: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['ready', 'complete']);

// ---------- 内部状态 ----------
const counterRef = ref(null);
const displayValue = ref('0');
let countUpInstance = null;
let animationFrameId = null;

// ---------- 样式 ----------
const valueStyle = computed(() => ({
  fontSize: props.fontSize,
  fontWeight: String(props.fontWeight),
  color: props.color || 'var(--text-primary, #1a1d1f)',
  fontVariantNumeric: 'tabular-nums'
}));

const suffixStyle = computed(() => ({
  fontSize: `calc(${props.fontSize} * 0.6)`,
  color: props.color || 'var(--text-secondary, #6b7280)',
  marginLeft: '4rpx'
}));

const prefixStyle = computed(() => ({
  fontSize: `calc(${props.fontSize} * 0.6)`,
  color: props.color || 'var(--text-secondary, #6b7280)',
  marginRight: '4rpx'
}));

// ---------- H5 端：使用 countUp.js ----------
async function initH5CountUp() {
  try {
    const { CountUp } = await import('countup.js');
    if (!counterRef.value) return;

    countUpInstance = new CountUp(counterRef.value, props.endVal, {
      startVal: props.startVal,
      duration: props.duration,
      decimalPlaces: props.decimals,
      separator: props.useGrouping ? props.separator : '',
      useGrouping: props.useGrouping
    });

    if (countUpInstance.error) {
      console.warn('[BaseCountup] CountUp 初始化失败:', countUpInstance.error);
      // 降级直接显示
      counterRef.value.textContent = formatNumber(props.endVal);
      return;
    }

    emit('ready');
    if (props.autoplay) {
      countUpInstance.start(() => emit('complete'));
    }
  } catch (err) {
    // 缺少 countUp.js 时降级
    console.warn('[BaseCountup] H5 降级为纯数字:', err);
    if (counterRef.value) {
      counterRef.value.textContent = formatNumber(props.endVal);
    }
  }
}

// ---------- 小程序端：纯 JS 动画 ----------
function startMiniProgramAnimation() {
  const start = props.startVal;
  const end = props.endVal;
  const durationMs = props.duration * 1000;
  const startTime = Date.now();

  // 清除之前的动画
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);

    // 缓出动画曲线 (easeOutExpo)
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = start + (end - start) * eased;

    displayValue.value = formatNumber(current);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      displayValue.value = formatNumber(end);
      emit('complete');
    }
  }

  emit('ready');
  animate();
}

// ---------- 工具方法 ----------
/** 格式化数字（千分位 + 小数位） */
function formatNumber(num) {
  const fixed = num.toFixed(props.decimals);
  if (!props.useGrouping) return fixed;

  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, props.separator);
  return parts.join('.');
}

// ---------- 控制方法 ----------
/** 手动开始动画 */
function start() {
  // #ifdef H5
  if (countUpInstance) {
    countUpInstance.start(() => emit('complete'));
  }
  // #endif

  // #ifndef H5
  startMiniProgramAnimation();
  // #endif
}

/** 重置到起始值 */
function reset() {
  // #ifdef H5
  if (countUpInstance) {
    countUpInstance.reset();
  }
  // #endif

  // #ifndef H5
  displayValue.value = formatNumber(props.startVal);
  // #endif
}

/** 更新目标值 */
function update(newVal) {
  // #ifdef H5
  if (countUpInstance) {
    countUpInstance.update(newVal);
  }
  // #endif

  // #ifndef H5
  startMiniProgramAnimation();
  // #endif
}

// ---------- 监听 ----------
watch(
  () => props.endVal,
  (newVal) => {
    // #ifdef H5
    if (countUpInstance) {
      countUpInstance.update(newVal);
    }
    // #endif

    // #ifndef H5
    startMiniProgramAnimation();
    // #endif
  }
);

// ---------- 生命周期 ----------
onMounted(() => {
  nextTick(() => {
    // #ifdef H5
    initH5CountUp();
    // #endif

    // #ifndef H5
    if (props.autoplay) {
      startMiniProgramAnimation();
    } else {
      displayValue.value = formatNumber(props.startVal);
    }
    // #endif
  });
});

// 暴露控制方法
defineExpose({
  start,
  reset,
  update
});
</script>

<style lang="scss" scoped>
.base-countup {
  display: inline-flex;
  align-items: baseline;

  &__value {
    font-variant-numeric: tabular-nums;
  }

  &__suffix,
  &__prefix {
    white-space: nowrap;
  }
}
</style>
