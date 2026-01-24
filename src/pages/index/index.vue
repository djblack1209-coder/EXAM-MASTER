<template>
	<view class="page">
		<view class="box">
			<text class="title">Exam Master 首页</text>
			<text class="desc">✅ 基础渲染正常</text>
			<text class="info">这是临时首页，用于验证基础功能</text>
		</view>
	</view>
</template>

<script>
export default {
	name: 'IndexPage',
	data() {
		return {
			message: '首页加载成功'
		}
	},
	onLoad() {
		console.log('[Index] 页面加载成功');
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	padding: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.box {
	background: white;
	padding: 60rpx 40rpx;
	border-radius: 24rpx;
	text-align: center;
	box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
	max-width: 600rpx;
}

.title {
	display: block;
	font-size: 48rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 32rpx;
}

.desc {
	display: block;
	font-size: 32rpx;
	color: #4CAF50;
	margin-bottom: 24rpx;
	font-weight: 600;
}

.info {
	display: block;
	font-size: 28rpx;
	color: #666;
	line-height: 1.6;
}
</style>
