<template>
    <view class="test-container">
        <text class="test-text">首页测试 - 基础渲染</text>
        <view class="test-card">
            <text>如果你能看到这段文字，说明页面渲染正常</text>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            message: '测试页面'
        }
    },
    onLoad() {
        console.log('测试页面加载')
    },
    onShow() {
        console.log('测试页面显示')
    }
}
</script>

<style>
.test-container {
    padding: 20px;
    background: #f5f5f5;
    min-height: 100vh;
}

.test-text {
    font-size: 24px;
    font-weight: bold;
    color: #333;
    margin-bottom: 20px;
    display: block;
}

.test-card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
