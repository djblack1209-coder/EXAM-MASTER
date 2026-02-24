<template>
  <view class="page-container" :class="{ 'dark-mode': isDark }">
    <view class="top-nav">
      <view class="nav-back" @tap="goBack">
        <text class="back-icon">
          ←
        </text>
      </view>
      <text class="nav-title">
        隐私政策
      </text>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <view class="content-section">
        <text class="update-date">
          更新日期：2026年2月18日
        </text>

        <view class="section">
          <text class="section-title">
            一、引言
          </text>
          <text class="section-text">
            欢迎使用 Exam Master（以下简称"本应用"）。我们深知个人信息对您的重要性，将严格遵守相关法律法规，采取相应的安全保护措施，保护您的个人信息安全。
          </text>
        </view>

        <view class="section">
          <text class="section-title">
            二、我们收集的信息
          </text>
          <text class="section-text">
            为了向您提供服务，我们可能会收集以下信息：
          </text>
          <text class="section-text">
            1. 账号信息：微信昵称、头像，用于创建和展示您的个人资料。
          </text>
          <text class="section-text">
            2. 学习数据：您的刷题记录、错题本、收藏、学习计划等，用于提供个性化学习服务。
          </text>
          <text class="section-text">
            3. 设备信息：设备型号、操作系统版本、屏幕分辨率，用于适配显示和优化性能。
          </text>
          <text class="section-text">
            4. 相机与相册：仅在您主动使用拍照搜题、证件照制作或更换头像功能时调用。
          </text>
          <text class="section-text">
            5. 麦克风：仅在您主动使用AI语音对话功能时调用。
          </text>
          <text class="section-text">
            6. 剪贴板：仅在您主动复制分享内容或题目信息时使用。
          </text>
        </view>

        <view class="section">
          <text class="section-title">
            三、信息的使用
          </text>
          <text class="section-text">
            我们收集的信息仅用于以下目的：
          </text>
          <text class="section-text">
            1. 提供、维护和改进本应用的功能与服务。
          </text>
          <text class="section-text">
            2. 个性化您的学习体验，如智能推荐题目、生成学习报告。
          </text>
          <text class="section-text">
            3. 保障账号安全与服务稳定运行。
          </text>
        </view>

        <view class="section">
          <text class="section-title">
            四、信息的存储与保护
          </text>
          <text class="section-text">
            您的数据存储在安全的云服务器上，我们采用加密传输和访问控制等技术手段保护您的信息安全。我们不会将您的个人信息出售、出租或以其他方式提供给第三方。
          </text>
        </view>

        <view class="section">
          <text class="section-title">
            五、您的权利
          </text>
          <text class="section-text">
            您有权查看、修改您的个人资料信息。您可以在"设置"页面中管理您的账号信息。如需删除账号及相关数据，请联系我们。
          </text>
        </view>

        <view class="section">
          <text class="section-title">
            六、未成年人保护
          </text>
          <text class="section-text">
            我们重视对未成年人个人信息的保护。如您为未满18周岁的未成年人，请在监护人的陪同和指导下使用本应用。
          </text>
        </view>

        <view class="section">
          <text class="section-title">
            七、隐私政策的更新
          </text>
          <text class="section-text">
            我们可能会适时修订本隐私政策。更新后的政策将在本页面发布，建议您定期查阅。
          </text>
        </view>

        <view class="section">
          <text class="section-title">
            八、联系我们
          </text>
          <text class="section-text">
            如您对本隐私政策有任何疑问，请通过应用内"设置"页面的反馈功能与我们联系。
          </text>
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
