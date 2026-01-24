<template>
    <view class="page">
        <view class="box">
            <text class="title">测试页面</text>
            <text class="desc">如果你能看到这段文字，说明基础渲染正常</text>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            message: '测试'
        }
    }
}
</script>

<style>
.page {
    min-height: 100vh;
    background: #f5f5f5;
    padding: 20px;
}

.box {
    background: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
}

.title {
    display: block;
    font-size: 24px;
    font-weight: bold;
    color: #333;
    margin-bottom: 16px;
}

.desc {
    display: block;
    font-size: 16px;
    color: #666;
}
</style>
