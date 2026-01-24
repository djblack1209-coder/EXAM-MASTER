<template>
    <view class="test-page">
        <text class="test-title">🎯 测试页面</text>
        <text class="test-text">如果你能看到这段文字，说明Vue渲染正常</text>
        <view class="test-box">
            <text>这是一个测试盒子</text>
        </view>
    </view>
</template>

<script>
export default {
    onLoad() {
        console.log('[test-simple] 页面加载成功');
    },
    onShow() {
        console.log('[test-simple] 页面显示');
    },
    onReady() {
        console.log('[test-simple] 页面渲染完成');
    }
}
</script>

<style scoped>
.test-page {
    min-height: 100vh;
    padding: 40px 20px;
    background: #f5f5f5;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.test-title {
    font-size: 24px;
    font-weight: bold;
    color: #333;
}

.test-text {
    font-size: 16px;
    color: #666;
    line-height: 1.6;
}

.test-box {
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
