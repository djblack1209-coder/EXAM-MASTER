<template>
    <view class="subject-pie-chart" :class="{ 'is-interactive': interactive }">
        <!-- 标题 -->
        <view class="chart-header">
            <text class="header-title">{{ title }}</text>
            <text class="header-subtitle">{{ subtitle }}</text>
        </view>

        <!-- 3D饼图容器 -->
        <view class="chart-container">
            <view class="chart-scene">
                <!-- 饼图切片 -->
                <view v-for="(slice, index) in slicesData" :key="index" class="pie-slice" :class="[
                    `slice-${slice.subject}`,
                    { 'slice-active': activeIndex === index }
                ]" :style="getSliceStyle(slice, index)" @click="handleSliceClick(slice, index)">
                    <!-- 切片顶部 -->
                    <view class="slice-top"></view>

                    <!-- 切片侧面 -->
                    <view class="slice-side"></view>

                    <!-- 切片标签 -->
                    <view class="slice-label" v-if="showLabels">
                        <text class="label-name">{{ slice.name }}</text>
                        <text class="label-value">{{ slice.percentage }}%</text>
                    </view>
                </view>

                <!-- 中心圆柱 -->
                <view class="center-cylinder">
                    <view class="cylinder-top"></view>
                    <view class="cylinder-side"></view>
                </view>
            </view>
        </view>

        <!-- 数据列表 -->
        <view class="chart-legend" v-if="showLegend">
            <view v-for="(slice, index) in slicesData" :key="index" class="legend-item"
                :class="{ 'item-active': activeIndex === index }" @click="handleSliceClick(slice, index)">
                <view class="legend-color" :class="`color-${slice.subject}`"></view>
                <view class="legend-info">
                    <text class="legend-name">{{ slice.name }}</text>
                    <text class="legend-stats">{{ slice.hours }}h · {{ slice.percentage }}%</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    // 标题
    title: {
        type: String,
        default: '科目学习分布'
    },
    // 副标题
    subtitle: {
        type: String,
        default: '3D可视化展示各科目学习时长占比'
    },
    // 数据
    data: {
        type: Array,
        default: () => []
    },
    // 是否显示标签
    showLabels: {
        type: Boolean,
        default: true
    },
    // 是否显示图例
    showLegend: {
        type: Boolean,
        default: true
    },
    // 是否可交互
    interactive: {
        type: Boolean,
        default: true
    }
})

const emit = defineEmits(['slice-click'])

// 当前激活的切片索引
const activeIndex = ref(-1)

// 科目配置
const subjectConfig = {
    politics: { color: '#FF6B6B', gradient: 'linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%)' },
    english: { color: '#4ECDC4', gradient: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)' },
    math: { color: '#FFB84D', gradient: 'linear-gradient(135deg, #FFB84D 0%, #F77062 100%)' },
    major: { color: '#9FE870', gradient: 'linear-gradient(135deg, #9FE870 0%, #7BC74D 100%)' }
}

// 处理数据
const slicesData = computed(() => {
    if (props.data.length > 0) {
        const total = props.data.reduce((sum, item) => sum + item.hours, 0)
        return props.data.map(item => ({
            ...item,
            percentage: Math.round((item.hours / total) * 100)
        }))
    }

    // 默认数据（示例）
    return [
        { name: '政治', subject: 'politics', hours: 45, percentage: 25 },
        { name: '英语', subject: 'english', hours: 54, percentage: 30 },
        { name: '数学', subject: 'math', hours: 36, percentage: 20 },
        { name: '专业课', subject: 'major', hours: 45, percentage: 25 }
    ]
})

// 获取切片样式
const getSliceStyle = (slice, index) => {
    // 计算起始角度
    let startAngle = 0
    for (let i = 0; i < index; i++) {
        startAngle += (slicesData.value[i].percentage / 100) * 360
    }

    const angle = (slice.percentage / 100) * 360
    const isActive = activeIndex.value === index

    return {
        transform: `
            rotateZ(${startAngle}deg) 
            translateZ(${isActive ? '20px' : '0'})
            scale(${isActive ? '1.05' : '1'})
        `,
        '--slice-angle': `${angle}deg`,
        '--start-angle': `${startAngle}deg`,
        animationDelay: `${index * 0.1}s`,
        zIndex: isActive ? 10 : index
    }
}

// 处理切片点击
const handleSliceClick = (slice, index) => {
    if (props.interactive) {
        activeIndex.value = activeIndex.value === index ? -1 : index
        emit('slice-click', slice, index)
    }
}
</script>

<style lang="scss" scoped>
.subject-pie-chart {
    width: 100%;
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.chart-header {
    margin-bottom: var(--spacing-lg);
    text-align: center;

    .header-title {
        display: block;
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: var(--spacing-xs);
    }

    .header-subtitle {
        display: block;
        font-size: var(--font-sm);
        color: var(--text-secondary);
    }
}

.chart-container {
    width: 100%;
    height: 400rpx;
    perspective: 1200px;
    perspective-origin: 50% 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.chart-scene {
    position: relative;
    width: 300rpx;
    height: 300rpx;
    transform-style: preserve-3d;
    transform: rotateX(60deg) rotateZ(0deg);
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);

    .is-interactive & {
        &:hover {
            transform: rotateX(55deg) rotateZ(10deg);
        }
    }
}

// 饼图切片
.pie-slice {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
    cursor: pointer;
    animation: sliceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

    &.slice-active {
        .slice-top {
            box-shadow: var(--shadow-glow-brand-strong);
        }
    }
}

// 切片顶部
.slice-top {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    transform: translateZ(30px);
    clip-path: polygon(50% 50%,
            50% 0%,
            calc(50% + 50% * cos(var(--start-angle))) calc(50% - 50% * sin(var(--start-angle))),
            calc(50% + 50% * cos(calc(var(--start-angle) + var(--slice-angle)))) calc(50% - 50% * sin(calc(var(--start-angle) + var(--slice-angle)))));
    transition: box-shadow 0.3s ease;
}

// 切片侧面
.slice-side {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    transform: translateZ(0);
    clip-path: polygon(50% 50%,
            50% 0%,
            calc(50% + 50% * cos(var(--start-angle))) calc(50% - 50% * sin(var(--start-angle))),
            calc(50% + 50% * cos(calc(var(--start-angle) + var(--slice-angle)))) calc(50% - 50% * sin(calc(var(--start-angle) + var(--slice-angle)))));
    opacity: 0.8;
}

// 切片标签
.slice-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) translateZ(50px) rotateX(-60deg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;

    .slice-active & {
        opacity: 1;
    }

    .label-name {
        font-size: var(--font-sm);
        font-weight: 600;
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .label-value {
        font-size: var(--font-lg);
        font-weight: 700;
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
}

// 科目颜色
.slice-politics {

    .slice-top,
    .slice-side {
        background: linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%);
    }
}

.slice-english {

    .slice-top,
    .slice-side {
        background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
    }
}

.slice-math {

    .slice-top,
    .slice-side {
        background: linear-gradient(135deg, #FFB84D 0%, #F77062 100%);
    }
}

.slice-major {

    .slice-top,
    .slice-side {
        background: linear-gradient(135deg, #9FE870 0%, #7BC74D 100%);
    }
}

// 中心圆柱
.center-cylinder {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 80rpx;
    height: 80rpx;
    transform: translate(-50%, -50%);
    transform-style: preserve-3d;
}

.cylinder-top {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg,
            var(--bg-tertiary) 0%,
            var(--bg-secondary) 100%);
    border-radius: 50%;
    transform: translateZ(30px);
    box-shadow: var(--shadow-md);
}

.cylinder-side {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-tertiary);
    border-radius: 50%;
    transform: translateZ(0);
    opacity: 0.8;
}

// 图例
.chart-legend {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-top: var(--spacing-xl);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-color);

    .legend-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-md);
        background: var(--bg-tertiary);
        cursor: pointer;
        transition: all 0.3s ease;

        .is-interactive & {
            &:hover {
                background: var(--bg-hover);
                transform: translateX(4px);
            }
        }

        &.item-active {
            background: var(--bg-hover);
            box-shadow: var(--shadow-glow-brand);
        }
    }

    .legend-color {
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        flex-shrink: 0;

        &.color-politics {
            background: linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%);
        }

        &.color-english {
            background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
        }

        &.color-math {
            background: linear-gradient(135deg, #FFB84D 0%, #F77062 100%);
        }

        &.color-major {
            background: linear-gradient(135deg, #9FE870 0%, #7BC74D 100%);
        }
    }

    .legend-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .legend-name {
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--text-primary);
    }

    .legend-stats {
        font-size: var(--font-sm);
        color: var(--text-secondary);
    }
}

// 动画
@keyframes sliceSlideIn {
    from {
        opacity: 0;
        transform: translateZ(-100px) scale(0.5);
    }

    to {
        opacity: 1;
        transform: translateZ(0) scale(1);
    }
}
</style>
