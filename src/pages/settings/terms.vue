<template>
  <view class="page-container" :class="{ 'dark-mode': isDark }">
    <view class="top-nav">
      <view class="nav-back" @tap="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="nav-title">用户协议</text>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <view class="content-section">
        <text class="update-date">更新日期：2026年2月18日</text>

        <view class="section">
          <text class="section-title">一、服务说明</text>
          <text class="section-text">Exam Master（以下简称"本应用"）是一款面向考研学生的智能学习辅助工具，提供刷题练习、错题管理、择校分析、AI辅导等功能。使用本应用即表示您同意本协议的全部条款。</text>
        </view>

        <view class="section">
          <text class="section-title">二、账号注册与使用</text>
          <text class="section-text">1. 您通过微信授权登录即可使用本应用。</text>
          <text class="section-text">2. 您应妥善保管自己的账号信息，因账号保管不善导致的损失由您自行承担。</text>
          <text class="section-text">3. 您不得将账号转让、出借给他人使用。</text>
        </view>

        <view class="section">
          <text class="section-title">三、用户行为规范</text>
          <text class="section-text">使用本应用时，您应遵守以下规范：</text>
          <text class="section-text">1. 遵守中华人民共和国相关法律法规。</text>
          <text class="section-text">2. 不得利用本应用从事任何违法违规活动。</text>
          <text class="section-text">3. 不得干扰本应用的正常运行，不得攻击本应用的服务器和网络。</text>
          <text class="section-text">4. 不得上传或传播含有违法、有害、威胁、侮辱、诽谤等内容的信息。</text>
        </view>

        <view class="section">
          <text class="section-title">四、知识产权</text>
          <text class="section-text">本应用中的所有内容，包括但不限于文字、图片、软件、界面设计等，均受知识产权法律保护。未经授权，您不得复制、修改、传播本应用中的任何内容。</text>
        </view>

        <view class="section">
          <text class="section-title">五、免责声明</text>
          <text class="section-text">1. 本应用提供的题目、解析、择校数据等内容仅供学习参考，不构成任何专业建议。</text>
          <text class="section-text">2. 因不可抗力、网络故障等原因导致服务中断，本应用不承担责任，但将尽力恢复服务。</text>
          <text class="section-text">3. AI辅导功能生成的内容由人工智能模型产生，可能存在不准确之处，请您自行判断。</text>
        </view>

        <view class="section">
          <text class="section-title">六、服务变更与终止</text>
          <text class="section-text">我们有权根据业务发展需要，变更、中断或终止部分或全部服务。如涉及收费服务的变更，我们将提前通知您。</text>
        </view>

        <view class="section">
          <text class="section-title">七、协议修订</text>
          <text class="section-text">我们有权适时修订本协议。修订后的协议将在本页面发布，继续使用本应用即视为您同意修订后的协议。</text>
        </view>

        <view class="section">
          <text class="section-title">八、争议解决</text>
          <text class="section-text">因本协议引起的争议，双方应友好协商解决。协商不成的，任何一方均可向本应用运营方所在地有管辖权的人民法院提起诉讼。</text>
        </view>

        <view class="section">
          <text class="section-title">九、联系方式</text>
          <text class="section-text">如您对本协议有任何疑问，请通过应用内"设置"页面的反馈功能与我们联系。</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      isDark: false
    };
  },
  onLoad() {
    const savedTheme = uni.getStorageSync('theme_mode') || 'light';
    this.isDark = savedTheme === 'dark';
  },
  methods: {
    goBack() {
      uni.navigateBack({ delta: 1 });
    }
  }
};
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}
.page-container.dark-mode {
  background-color: #121212;
}

.top-nav {
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  padding-top: calc(env(safe-area-inset-top) + 20rpx);
  height: calc(env(safe-area-inset-top) + 100rpx);
  background-color: #1a1a1a;
}
.nav-back {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon {
  color: #ffffff;
  font-size: 36rpx;
}
.nav-title {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: bold;
  margin-left: 16rpx;
}

.content-scroll {
  height: calc(100vh - env(safe-area-inset-top) - 100rpx);
}
.content-section {
  padding: 32rpx;
}
.update-date {
  font-size: 24rpx;
  color: #999999;
  margin-bottom: 32rpx;
  display: block;
}
.dark-mode .update-date {
  color: #666666;
}

.section {
  margin-bottom: 40rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 16rpx;
  display: block;
}
.dark-mode .section-title {
  color: #e0e0e0;
}
.section-text {
  font-size: 28rpx;
  color: #666666;
  line-height: 1.8;
  margin-bottom: 12rpx;
  display: block;
}
.dark-mode .section-text {
  color: #aaaaaa;
}
</style>
