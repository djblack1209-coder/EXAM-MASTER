<template>
    <view class="test-page">
        <text class="test-text">测试页面 - 如果你能看到这段文字，说明Vue渲染正常</text>
        <view class="test-box">
            <text>当前时间: {{ currentTime }}</text>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            currentTime: new Date().toLocaleString()
        }
    },
    onLoad() {
        console.log('[TestMinimal] 页面加载成功')
    }
}
</script>

<style scoped>
.test-page {
    padding: 40px 20px;
    background: #f5f5f5;
    min-height: 100vh;
}

.test-text {
    font-size: 18px;
    color: #333;
    margin-bottom: 20px;
    display: block;
}

.test-box {
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
