<template>
  <view class="base-lottie" :style="containerStyle">
    <!-- #ifdef MP-WEIXIN -->
    <canvas :id="canvasId" type="2d" class="base-lottie__canvas" :style="canvasStyle"></canvas>
    <!-- #endif -->

    <!-- #ifdef H5 -->
    <view :id="canvasId" class="base-lottie__canvas" :style="canvasStyle"></view>
    <!-- #endif -->
  </view>
</template>

<script setup>
/**
 * BaseLottie - Lottie 动画通用封装组件
 *
 * 小程序端使用 lottie-miniprogram（canvas 2d），
 * H5 端使用 lottie-web（DOM 渲染）。
 *
 * 用法:
 *   <base-lottie
 *     src="/static/lottie/success.json"
 *     width="200rpx"
 *     height="200rpx"
 *     :autoplay="true"
 *     :loop="true"
 *   />
 *
 * src 可以是:
 *   - 本地 JSON 路径（static 目录下）
 *   - 远程 URL（http/https）
 *   - 直接传入 JSON 对象（animationData prop）
 */
import { computed, onMounted, onBeforeUnmount, getCurrentInstance, nextTick, watch } from 'vue';

const props = defineProps({
  /** Lottie JSON 文件路径（本地或远程 URL） */
  src: {
    type: String,
    default: ''
  },
  /** 直接传入 Lottie JSON 数据对象（优先于 src） */
  animationData: {
    type: Object,
    default: null
  },
  /** 宽度（支持 rpx/px） */
  width: {
    type: String,
    default: '200rpx'
  },
  /** 高度（支持 rpx/px） */
  height: {
    type: String,
    default: '200rpx'
  },
  /** 是否自动播放 */
  autoplay: {
    type: Boolean,
    default: true
  },
  /** 是否循环 */
  loop: {
    type: Boolean,
    default: true
  },
  /** 播放速度（1 = 正常） */
  speed: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['ready', 'complete', 'error']);

const instance = getCurrentInstance();
const canvasId = `base-lottie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
let animationInstance = null;

// ---------- 计算样式 ----------
const containerStyle = computed(() => ({
  width: props.width,
  height: props.height
}));

const canvasStyle = computed(() => ({
  width: '100%',
  height: '100%'
}));

// ---------- 小程序端初始化 ----------
async function initMiniprogram() {
  try {
    const lottie = (await import('lottie-miniprogram')).default;
    const query = uni.createSelectorQuery().in(instance.proxy);

    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          console.warn('[BaseLottie] 未找到 canvas 节点');
          emit('error', new Error('canvas 节点未就绪'));
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = uni.getSystemInfoSync().pixelRatio || 1;

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        lottie.setup(canvas);

        const opts = {
          loop: props.loop,
          autoplay: props.autoplay,
          rendererSettings: {
            context: ctx
          }
        };

        // 数据源：animationData 优先，否则用 path
        if (props.animationData) {
          opts.animationData = props.animationData;
        } else if (props.src) {
          opts.path = props.src;
        } else {
          console.warn('[BaseLottie] 未提供 src 或 animationData');
          return;
        }

        animationInstance = lottie.loadAnimation(opts);
        animationInstance.setSpeed(props.speed);

        animationInstance.addEventListener('complete', () => emit('complete'));
        emit('ready', animationInstance);
      });
  } catch (err) {
    console.warn('[BaseLottie] 小程序端初始化失败:', err);
    emit('error', err);
  }
}

// ---------- H5 端初始化 ----------
async function initH5() {
  try {
    // H5 使用 lottie-web（动态导入避免小程序端报错）
    const lottieWeb = (await import('lottie-web')).default;

    // 等待 DOM 就绪
    await nextTick();
    const container = document.getElementById(canvasId);
    if (!container) {
      console.warn('[BaseLottie] H5 容器未找到');
      emit('error', new Error('H5 容器未就绪'));
      return;
    }

    const opts = {
      container,
      renderer: 'svg',
      loop: props.loop,
      autoplay: props.autoplay
    };

    if (props.animationData) {
      opts.animationData = props.animationData;
    } else if (props.src) {
      opts.path = props.src;
    } else {
      return;
    }

    animationInstance = lottieWeb.loadAnimation(opts);
    animationInstance.setSpeed(props.speed);

    animationInstance.addEventListener('complete', () => emit('complete'));
    emit('ready', animationInstance);
  } catch (err) {
    // H5 端没有 lottie-web 依赖时降级为静态
    console.warn('[BaseLottie] H5 端初始化失败（可能缺少 lottie-web 依赖）:', err);
    emit('error', err);
  }
}

// ---------- 控制方法 ----------
/** 播放动画 */
function play() {
  animationInstance && animationInstance.play();
}

/** 暂停动画 */
function pause() {
  animationInstance && animationInstance.pause();
}

/** 停止动画 */
function stop() {
  animationInstance && animationInstance.stop();
}

/** 跳转到指定帧 */
function goToAndStop(frame) {
  animationInstance && animationInstance.goToAndStop(frame, true);
}

/** 设置播放速度 */
function setSpeed(speed) {
  animationInstance && animationInstance.setSpeed(speed);
}

// ---------- 监听 ----------
watch(
  () => props.speed,
  (val) => {
    setSpeed(val);
  }
);

// ---------- 生命周期 ----------
onMounted(() => {
  // 延迟初始化，确保 DOM/canvas 已渲染
  setTimeout(() => {
    // #ifdef MP-WEIXIN
    initMiniprogram();
    // #endif

    // #ifdef H5
    initH5();
    // #endif
  }, 100);
});

onBeforeUnmount(() => {
  if (animationInstance) {
    animationInstance.destroy();
    animationInstance = null;
  }
});

// 暴露控制方法
defineExpose({
  play,
  pause,
  stop,
  goToAndStop,
  setSpeed,
  getInstance: () => animationInstance
});
</script>

<style lang="scss" scoped>
.base-lottie {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  &__canvas {
    width: 100%;
    height: 100%;
  }
}
</style>
