<template>
    <view class="study-bookshelf" :class="{ 'is-interactive': interactive }">
        <!-- 标题 -->
        <view class="bookshelf-header">
            <text class="header-title">{{ title }}</text>
            <text class="header-subtitle">{{ subtitle }}</text>
        </view>

        <!-- 3D书架容器 -->
        <view class="bookshelf-container">
            <view class="bookshelf-scene">
                <!-- 书架背板 -->
                <view class="bookshelf-back"></view>

                <!-- 书籍列表 -->
                <view class="books-wrapper">
                    <view v-for="(book, index) in booksData" :key="index" class="book" :class="[
                        `book-${book.subject}`,
                        { 'book-completed': book.progress >= 100 }
                    ]" :style="getBookStyle(book, index)" @click="handleBookClick(book)">
                        <!-- 书脊 -->
                        <view class="book-spine">
                            <text class="book-title">{{ book.name }}</text>
                            <text class="book-progress">{{ book.progress }}%</text>
                        </view>

                        <!-- 书顶部 -->
                        <view class="book-top"></view>

                        <!-- 书侧面 -->
                        <view class="book-side"></view>

                        <!-- 进度指示器 -->
                        <view class="book-progress-bar">
                            <view class="progress-fill" :style="{ transform: `scaleY(${book.progress / 100})` }"></view>
                        </view>
                    </view>
                </view>

                <!-- 书架底板 -->
                <view class="bookshelf-shelf"></view>
            </view>
        </view>

        <!-- 图例 -->
        <view class="bookshelf-legend" v-if="showLegend">
            <view v-for="subject in subjects" :key="subject.key" class="legend-item">
                <view class="legend-color" :class="`color-${subject.key}`"></view>
                <text class="legend-label">{{ subject.label }}</text>
            </view>
        </view>
    </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    // 标题
    title: {
        type: String,
        default: '学习进度书架'
    },
    // 副标题
    subtitle: {
        type: String,
        default: '每本书代表一个科目的学习进度'
    },
    // 书籍数据
    books: {
        type: Array,
        default: () => []
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

const emit = defineEmits(['book-click'])

// 科目配置
const subjects = [
    { key: 'politics', label: '政治', color: '#FF6B6B' },
    { key: 'english', label: '英语', color: '#4ECDC4' },
    { key: 'math', label: '数学', color: '#FFB84D' },
    { key: 'major', label: '专业课', color: '#9FE870' }
]

// 处理书籍数据
const booksData = computed(() => {
    if (props.books.length > 0) {
        return props.books
    }

    // 默认数据（示例）
    return [
        { name: '政治', subject: 'politics', progress: 75, chapters: 12, completed: 9 },
        { name: '英语', subject: 'english', progress: 60, chapters: 10, completed: 6 },
        { name: '数学', subject: 'math', progress: 85, chapters: 15, completed: 13 },
        { name: '专业课', subject: 'major', progress: 45, chapters: 20, completed: 9 }
    ]
})

// 获取书籍样式
const getBookStyle = (book, index) => {
    const baseLeft = 10 + index * 22 // 每本书间隔22%
    const height = 60 + Math.random() * 20 // 随机高度增加真实感

    return {
        left: `${baseLeft}%`,
        height: `${height}%`,
        animationDelay: `${index * 0.1}s`
    }
}

// 处理书籍点击
const handleBookClick = (book) => {
    if (props.interactive) {
        emit('book-click', book)
    }
}
</script>

<style lang="scss" scoped>
.study-bookshelf {
    width: 100%;
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.bookshelf-header {
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

.bookshelf-container {
    width: 100%;
    height: 400rpx;
    perspective: 1200px;
    perspective-origin: 50% 50%;
}

.bookshelf-scene {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transform: rotateX(15deg) rotateY(-5deg);
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;

    .is-interactive & {
        &:hover {
            transform: rotateX(10deg) rotateY(0deg);
        }
    }
}

// 书架背板
.bookshelf-back {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg,
            var(--bg-tertiary) 0%,
            var(--bg-secondary) 100%);
    border-radius: var(--radius-md);
    transform: translateZ(-50px);
    box-shadow: var(--shadow-md);
}

// 书籍容器
.books-wrapper {
    position: absolute;
    bottom: 15%;
    left: 0;
    width: 100%;
    height: 70%;
    transform-style: preserve-3d;
}

// 单本书
.book {
    position: absolute;
    bottom: 0;
    width: 18%;
    transform-style: preserve-3d;
    cursor: pointer;
    animation: bookSlideIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    transition: transform 0.3s ease;
    will-change: transform;

    .is-interactive & {
        &:hover {
            transform: translateY(-10px) translateZ(20px);

            .book-spine {
                box-shadow: var(--shadow-glow-brand);
            }
        }
    }

    &.book-completed {
        .book-spine::after {
            content: '✓';
            position: absolute;
            top: 8px;
            right: 8px;
            width: 24px;
            height: 24px;
            background: var(--success);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
        }
    }
}

// 书脊（正面）
.book-spine {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-xs);
    border-radius: var(--radius-sm);
    transform: translateZ(15px);
    transition: box-shadow 0.3s ease;
    will-change: box-shadow;

    .book-title {
        writing-mode: vertical-rl;
        font-size: var(--font-md);
        font-weight: 600;
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .book-progress {
        font-size: var(--font-sm);
        font-weight: 700;
        color: white;
        background: rgba(0, 0, 0, 0.2);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
    }
}

// 书顶部
.book-top {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 30px;
    transform-origin: top;
    transform: rotateX(90deg);
    opacity: 0.8;
}

// 书侧面
.book-side {
    position: absolute;
    top: 0;
    right: 0;
    width: 30px;
    height: 100%;
    transform-origin: right;
    transform: rotateY(90deg);
    opacity: 0.6;
}

// 进度条
.book-progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    overflow: hidden;
    transform: translateZ(14px);

    .progress-fill {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 0;
        background: linear-gradient(to top,
                rgba(255, 255, 255, 0.3),
                rgba(255, 255, 255, 0.1));
        transform-origin: bottom;
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform;
    }
}

// 科目颜色
.book-politics {

    .book-spine,
    .book-top,
    .book-side {
        background: linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%);
    }
}

.book-english {

    .book-spine,
    .book-top,
    .book-side {
        background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
    }
}

.book-math {

    .book-spine,
    .book-top,
    .book-side {
        background: linear-gradient(135deg, #FFB84D 0%, #F77062 100%);
    }
}

.book-major {

    .book-spine,
    .book-top,
    .book-side {
        background: linear-gradient(135deg, #9FE870 0%, #7BC74D 100%);
    }
}

// 书架底板
.bookshelf-shelf {
    position: absolute;
    bottom: 0;
    left: -5%;
    width: 110%;
    height: 15%;
    background: linear-gradient(to bottom,
            var(--bg-tertiary) 0%,
            var(--bg-secondary) 100%);
    border-radius: var(--radius-md);
    transform: translateZ(0);
    box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.1),
        inset 0 2px 4px rgba(255, 255, 255, 0.1);
}

// 图例
.bookshelf-legend {
    display: flex;
    justify-content: center;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-color);

    .legend-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
    }

    .legend-color {
        width: 16px;
        height: 16px;
        border-radius: var(--radius-sm);

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

    .legend-label {
        font-size: var(--font-sm);
        color: var(--text-secondary);
    }
}

// 动画
@keyframes bookSlideIn {
    from {
        opacity: 0;
        transform: translateY(50px) translateZ(-50px);
    }

    to {
        opacity: 1;
        transform: translateY(0) translateZ(0);
    }
}
</style>
