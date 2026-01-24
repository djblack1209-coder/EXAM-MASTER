<template>
    <view :class="['study-overview-container', themeStore.themeClass, { 'dark-mode': isDark }]" @tap="navigateToDetail">
        <!-- Hot Picks 胶囊卡片容器 -->
        <view class="hot-picks-capsule" :class="getCardClass()" :style="cardContainerStyle">
            <!-- 卡片标题区域 -->
            <view class="capsule-header">
                <text class="capsule-title">📊 Study Overview</text>
                <text class="capsule-arrow">→</text>
            </view>

            <!-- 气泡布局容器 - 支持陀螺仪3D效果 -->
            <view class="bubble-layout" :style="bubbleContainerStyle">
                <!-- 气泡1：学习时长 -->
                <view class="data-bubble bubble-time" :style="bubbleStyles[0]" @tap.stop="navigateToDetail">
                    <image class="bubble-icon" :src="timeIcon" mode="aspectFit"></image>
                    <text class="bubble-value">{{ formatStudyTime(studyTime) }}</text>
                    <text class="bubble-label">Study Time</text>
                </view>

                <!-- 气泡2：完成率 -->
                <view class="data-bubble bubble-progress" :style="bubbleStyles[1]" @tap.stop="navigateToDetail">
                    <image class="bubble-icon" :src="progressIcon" mode="aspectFit"></image>
                    <text class="bubble-value">{{ completionRate }}%</text>
                    <text class="bubble-label">Completion</text>
                </view>

                <!-- 气泡3：能力评级 -->
                <view class="data-bubble bubble-ability" :style="bubbleStyles[2]" @tap.stop="navigateToDetail">
                    <image class="bubble-icon" :src="abilityIcon" mode="aspectFit"></image>
                    <text class="bubble-value">{{ abilityRank }}</text>
                    <text class="bubble-label">Ability Rank</text>
                </view>
            </view>

            <!-- 陀螺仪光晕效果层 -->
            <view class="gyro-glow" :style="gyroGlowStyle"></view>
        </view>
    </view>
</template>

<script>
import { useThemeStore } from '../stores'

export default {
    name: 'StudyOverview',
    props: {
        // 学习时长（分钟）
        studyTime: {
            type: Number,
            default: 0
        },
        // 完成率（百分比）
        completionRate: {
            type: Number,
            default: 0
        },
        // 能力评级
        abilityRank: {
            type: String,
            default: '-'
        }
    },
    data() {
        return {
            themeStore: null,
            isDark: false,

            // 图标路径
            timeIcon: '/static/icons/study.png',
            progressIcon: '/static/icons/stack-of-books.png',
            abilityIcon: '/ranking.png',

            // 气泡样式（随机位置和大小）
            bubbleStyles: [],

            // 陀螺仪光晕位置
            gyroGlowStyle: {},

            // 气泡容器样式
            bubbleContainerStyle: {},

            // 卡片容器样式
            cardContainerStyle: {},

            // 陀螺仪数据
            gyroData: {
                x: 0,
                y: 0
            }
        }
    },
    created() {
        this.themeStore = useThemeStore()
        this.isDark = this.themeStore.isDark

        // 监听主题变化
        uni.$on('themeUpdate', (mode) => {
            this.isDark = mode === 'dark'
        })

        // 生成随机气泡布局
        this.generateBubbleLayout()

        // 启动陀螺仪
        this.startGyroscope()
    },
    beforeUnmount() {
        // 清理事件监听
        uni.$off('themeUpdate')

        // 停止陀螺仪
        uni.stopAccelerometer()
    },
    methods: {
        /**
         * 获取卡片样式类名
         */
        getCardClass() {
            const classes = []

            // 根据主题添加光晕效果类
            if (this.isDark) {
                classes.push('bitget-glow')
            } else {
                classes.push('wise-shine')
            }

            return classes.join(' ')
        },

        /**
         * 格式化学习时长显示
         */
        formatStudyTime(minutes) {
            if (minutes >= 60) {
                const hours = Math.floor(minutes / 60)
                const mins = minutes % 60
                return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
            }
            return `${minutes}m`
        },

        /**
         * 生成随机气泡布局（确保正圆形且不重叠）
         */
        generateBubbleLayout() {
            const bubbles = []
            const positions = []

            // 定义三个气泡的基础配置
            const bubbleConfigs = [
                { minSize: 180, maxSize: 220, name: 'time' },      // 学习时长（大）
                { minSize: 140, maxSize: 180, name: 'progress' },  // 完成率（中）
                { minSize: 120, maxSize: 160, name: 'ability' }    // 能力评级（小到中）
            ]

            bubbleConfigs.forEach((config, index) => {
                let position
                let attempts = 0
                const maxAttempts = 50

                // 尝试找到不重叠的位置
                do {
                    const size = this.randomSize(config.minSize, config.maxSize)
                    position = {
                        size: size,
                        left: this.randomPosition(5, 70),
                        top: this.randomPosition(10, 60)
                    }
                    attempts++
                } while (this.checkOverlap(position, positions) && attempts < maxAttempts)

                positions.push(position)

                // 生成样式
                bubbles.push({
                    width: position.size + 'rpx',
                    height: position.size + 'rpx',
                    left: position.left + '%',
                    top: position.top + '%',
                    position: 'absolute'
                })
            })

            this.bubbleStyles = bubbles
        },

        /**
         * 检查气泡是否重叠
         */
        checkOverlap(newPos, existingPositions) {
            for (let pos of existingPositions) {
                const distance = Math.sqrt(
                    Math.pow(newPos.left - pos.left, 2) +
                    Math.pow(newPos.top - pos.top, 2)
                )
                const minDistance = (newPos.size + pos.size) / 2 / 7.5 // 转换为百分比单位
                if (distance < minDistance) {
                    return true
                }
            }
            return false
        },

        /**
         * 生成随机大小
         */
        randomSize(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min
        },

        /**
         * 生成随机位置
         */
        randomPosition(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min
        },

        /**
         * 启动陀螺仪监听
         */
        startGyroscope() {
            // #ifdef MP-WEIXIN || APP-PLUS
            uni.startAccelerometer({
                interval: 'game',
                success: () => {
                    uni.onAccelerometerChange((res) => {
                        // 节流处理，避免过度渲染
                        this.throttleGyroUpdate(res)
                    })
                },
                fail: (err) => {
                    console.log('[StudyOverview] 陀螺仪启动失败:', err)
                    // 降级方案：使用静态效果
                    this.useStaticEffect()
                }
            })
            // #endif

            // #ifndef MP-WEIXIN
            // H5等平台降级方案
            this.useStaticEffect()
            // #endif
        },

        /**
         * 节流更新陀螺仪数据
         */
        throttleGyroUpdate(res) {
            // 限制旋转角度，避免过度倾斜
            let x = res.x * 25
            let y = res.y * 25

            // 限制最大角度
            x = Math.max(-15, Math.min(15, x))
            y = Math.max(-15, Math.min(15, y))

            // 保存陀螺仪数据
            this.gyroData.x = x
            this.gyroData.y = y

            // 更新光晕位置（跟随设备倾斜）
            this.gyroGlowStyle = {
                transform: `translate(${x * 2}px, ${y * 2}px)`,
                opacity: 0.6,
                transition: 'transform 0.1s ease-out'
            }

            // 更新容器倾斜效果（3D透视）
            this.bubbleContainerStyle = {
                transform: `perspective(1000px) rotateX(${-y * 0.3}deg) rotateY(${x * 0.3}deg)`,
                transition: 'transform 0.1s ease-out'
            }

            // 更新卡片容器样式（轻微倾斜）
            this.cardContainerStyle = {
                transform: `perspective(1000px) rotateX(${-y * 0.1}deg) rotateY(${x * 0.1}deg)`,
                transition: 'transform 0.1s ease-out'
            }
        },

        /**
         * 使用静态效果（降级方案）
         */
        useStaticEffect() {
            // 静态光晕动画
            this.gyroGlowStyle = {
                animation: 'staticGlow 3s ease-in-out infinite'
            }
        },

        /**
         * 跳转到详情页面
         */
        navigateToDetail() {
            uni.navigateTo({
                url: '/src/pages/study-detail/index',
                fail: (err) => {
                    console.error('[StudyOverview] 跳转失败:', err)
                    uni.showToast({
                        title: '页面开发中',
                        icon: 'none'
                    })
                }
            })
        }
    }
}
</script>

<style lang="scss" scoped>
@import '../styles/theme-wise.scss';
@import '../styles/theme-bitget.scss';

/* ============================================
   容器样式
   ============================================ */
.study-overview-container {
    padding: 0;
    margin-bottom: 24rpx;
}

/* ============================================
   Hot Picks 胶囊卡片 - 参考Bitget Wallet设计
   ============================================ */
.hot-picks-capsule {
    border-radius: 32rpx;
    padding: 40rpx 32rpx;
    position: relative;
    overflow: hidden;
    min-height: 400rpx;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.hot-picks-capsule:active {
    transform: scale(0.98);
}

/* ============================================
   Wise 主题样式（浅色模式）
   ============================================ */

/* 背景为白色时：渐变绿色胶囊 + 白色文字 */
.theme-wise .hot-picks-capsule {
    background: linear-gradient(135deg, #37B24D 0%, #2F9E44 100%);
    box-shadow: 0 8px 24px rgba(55, 178, 77, 0.25);
}

/* 背景为绿色时：白色胶囊 + 黑色文字（通过父容器控制）*/
.theme-wise .bg-green .hot-picks-capsule {
    background: var(--bg-card);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.theme-wise .bg-green .hot-picks-capsule .capsule-title,
.theme-wise .bg-green .hot-picks-capsule .capsule-arrow {
    color: #111111;
}

.theme-wise .bg-green .hot-picks-capsule .bubble-value,
.theme-wise .bg-green .hot-picks-capsule .bubble-label {
    color: #111111;
}

/* ============================================
   Wise 深色模式样式
   ============================================ */
.theme-wise.dark-mode .hot-picks-capsule {
    background: linear-gradient(135deg, #1e3a0f 0%, #0d1f05 100%);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* ============================================
   Bitget 主题样式（深色模式）
   ============================================ */
.theme-bitget .hot-picks-capsule {
    background: linear-gradient(135deg, #1a2332 0%, #2d3e50 100%);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.theme-bitget.dark-mode .hot-picks-capsule {
    background: linear-gradient(135deg, #1a2840 0%, #2d4560 100%);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

/* ============================================
   卡片头部
   ============================================ */
.capsule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32rpx;
    position: relative;
    z-index: 10;
}

.capsule-title {
    font-size: 32rpx;
    font-weight: 700;
    color: var(--bg-card);
    letter-spacing: 0.5rpx;
}

.capsule-arrow {
    font-size: 32rpx;
    color: rgba(255, 255, 255, 0.6);
    transition: all 0.3s ease;
}

.hot-picks-capsule:active .capsule-arrow {
    transform: translateX(8rpx);
    color: rgba(255, 255, 255, 1);
}

/* ============================================
   气泡布局容器
   ============================================ */
.bubble-layout {
    position: relative;
    min-height: 320rpx;
    transition: transform 0.1s ease-out;
    transform-style: preserve-3d;
}

/* ============================================
   数据气泡样式 - Hot Picks风格
   ============================================ */
.data-bubble {
    position: absolute;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 2rpx solid rgba(255, 255, 255, 0.25);
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24rpx;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.data-bubble:active {
    background: rgba(255, 255, 255, 0.22);
    transform: scale(0.95);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* 气泡图标 */
.bubble-icon {
    width: 48rpx;
    height: 48rpx;
    margin-bottom: 12rpx;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) brightness(1.2);
}

/* 气泡数值 */
.bubble-value {
    font-size: 40rpx;
    font-weight: 700;
    color: var(--bg-card);
    line-height: 1;
    margin-bottom: 8rpx;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
}

/* 气泡标签 */
.bubble-label {
    font-size: 20rpx;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
    text-align: center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* ============================================
   陀螺仪光晕效果层
   ============================================ */
.gyro-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 300rpx;
    height: 300rpx;
    margin-left: -150rpx;
    margin-top: -150rpx;
    border-radius: 50%;
    pointer-events: none;
    z-index: 1;
    opacity: 0.6;
}

/* Wise 主题光晕 */
.theme-wise .gyro-glow {
    background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
}

.theme-wise.dark-mode .gyro-glow {
    background: radial-gradient(circle, rgba(159, 232, 112, 0.3) 0%, transparent 70%);
}

/* Bitget 主题光晕 */
.theme-bitget .gyro-glow {
    background: radial-gradient(circle, rgba(10, 132, 255, 0.4) 0%, transparent 70%);
}

.theme-bitget.dark-mode .gyro-glow {
    background: radial-gradient(circle, rgba(64, 156, 255, 0.5) 0%, transparent 70%);
}

/* ============================================
   光晕划过效果 - Wise浅色模式
   ============================================ */
.wise-shine {
    position: relative;
}

.wise-shine::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg,
            transparent 30%,
            rgba(255, 255, 255, 0.2) 50%,
            transparent 70%);
    animation: wise-shine-sweep 4s ease-in-out infinite;
    pointer-events: none;
}

@keyframes wise-shine-sweep {
    0% {
        transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }

    100% {
        transform: translateX(100%) translateY(100%) rotate(45deg);
    }
}

/* ============================================
   陀螺仪光晕效果 - Bitget深色模式
   ============================================ */
.bitget-glow {
    position: relative;
}

.bitget-glow::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(10, 132, 255, 0.25) 0%, transparent 70%);
    animation: bitget-glow-pulse 3s ease-in-out infinite;
    pointer-events: none;
}

@keyframes bitget-glow-pulse {

    0%,
    100% {
        opacity: 0.5;
        transform: scale(1);
    }

    50% {
        opacity: 1;
        transform: scale(1.1);
    }
}

/* ============================================
   静态光晕动画（降级方案）
   ============================================ */
@keyframes staticGlow {

    0%,
    100% {
        opacity: 0.4;
    }

    50% {
        opacity: 0.8;
    }
}

/* ============================================
   悬停效果增强
   ============================================ */
.hot-picks-capsule:hover {
    transform: translateY(-4rpx);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.hot-picks-capsule:hover .data-bubble {
    border-color: rgba(255, 255, 255, 0.4);
}

/* ============================================
   响应式调整
   ============================================ */
@media (max-width: 375px) {
    .bubble-icon {
        width: 40rpx;
        height: 40rpx;
    }

    .bubble-value {
        font-size: 32rpx;
    }

    .bubble-label {
        font-size: 18rpx;
    }

    .hot-picks-capsule {
        min-height: 360rpx;
    }
}

/* ============================================
   性能优化
   ============================================ */
.data-bubble,
.gyro-glow,
.bubble-layout {
    will-change: transform;
}
</style>