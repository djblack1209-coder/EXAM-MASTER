<template>
  <view class="page-container" :class="{ 'dark-mode': isDark }">
    <view class="top-nav">
      <view class="nav-back" @tap="goBack">
        <text class="back-icon"> ← </text>
      </view>
      <text class="nav-title"> 用户协议 </text>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <view class="content-section">
        <text class="update-date"> 更新日期：2026年2月18日 </text>

        <view class="section">
          <text class="section-title"> 一、服务说明 </text>
          <text class="section-text">
            Exam
            Master（以下简称"本应用"）是一款面向考研学生的智能学习辅助工具，提供刷题练习、错题管理、择校分析、智能辅导等功能。使用本应用即表示您同意本协议的全部条款。
          </text>
          <text class="section-text">
            本应用主要基于用户主动提交的学习资料与公开招生信息提供学习辅助服务，不构成招生承诺、录取保证或替代官方信息发布。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 二、账号注册与使用 </text>
          <text class="section-text"> 1. 您通过微信授权登录即可使用本应用。 </text>
          <text class="section-text"> 2. 您应妥善保管自己的账号信息，因账号保管不善导致的损失由您自行承担。 </text>
          <text class="section-text"> 3. 您不得将账号转让、出借给他人使用。 </text>
        </view>

        <view class="section">
          <text class="section-title"> 三、用户行为规范 </text>
          <text class="section-text"> 使用本应用时，您应遵守以下规范： </text>
          <text class="section-text"> 1. 遵守中华人民共和国相关法律法规。 </text>
          <text class="section-text"> 2. 不得利用本应用从事任何违法违规活动。 </text>
          <text class="section-text"> 3. 不得干扰本应用的正常运行，不得攻击本应用的服务器和网络。 </text>
          <text class="section-text"> 4. 不得上传或传播含有违法、有害、威胁、侮辱、诽谤等内容的信息。 </text>
        </view>

        <view class="section">
          <text class="section-title"> 四、知识产权 </text>
          <text class="section-text">
            本应用中的所有内容，包括但不限于文字、图片、软件、界面设计等，均受知识产权法律保护。未经授权，您不得复制、修改、传播本应用中的任何内容。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 五、免责声明 </text>
          <text class="section-text">
            1. 本应用提供的题目、解析、择校数据等内容仅供学习参考，不构成任何专业建议。
          </text>
          <text class="section-text">
            2. 因不可抗力、网络故障等原因导致服务中断，本应用不承担责任，但将尽力恢复服务。
          </text>
          <text class="section-text">
            3. 智能辅导功能生成的内容由算法模型与规则策略联合处理，可能存在不准确或滞后之处，请您自行判断并复核。
          </text>
          <text class="section-text">
            4. 您应确保上传资料合法合规且不侵犯他人权益；如因上传内容引发争议或损失，由上传方承担相应责任。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 六、服务变更与终止 </text>
          <text class="section-text">
            我们有权根据业务发展需要，变更、中断或终止部分或全部服务。如涉及收费服务的变更，我们将提前通知您。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 七、协议修订 </text>
          <text class="section-text">
            我们有权适时修订本协议。修订后的协议将在本页面发布，继续使用本应用即视为您同意修订后的协议。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 八、争议解决 </text>
          <text class="section-text">
            因本协议引起的争议，双方应友好协商解决。协商不成的，任何一方均可向本应用运营方所在地有管辖权的人民法院提起诉讼。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 九、联系方式 </text>
          <text class="section-text"> 如您对本协议有任何疑问，请通过应用内"设置"页面的反馈功能与我们联系。 </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
export default {
  data() {
    return {
      isDark: false
    };
  },
  onLoad() {
    const savedTheme = storageService.get('theme_mode', 'light');
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
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 52%,
    var(--page-gradient-bottom) 100%
  );
}
.page-container.dark-mode {
  background: linear-gradient(180deg, #04070d 0%, #0a1018 48%, #04070d 100%);
}

.top-nav {
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  padding-top: calc(constant(safe-area-inset-top) + 20rpx);
  padding-top: calc(env(safe-area-inset-top, 0px) + 20rpx);
  height: calc(constant(safe-area-inset-top) + 100rpx);
  height: calc(env(safe-area-inset-top, 0px) + 100rpx);
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  border-bottom: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}
.nav-back {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.62);
  border: 1rpx solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}
.back-icon {
  color: var(--text-main);
  font-size: 36rpx;
}
.dark-mode .nav-back {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}
.dark-mode .back-icon {
  color: #ffffff;
}
.nav-title {
  color: var(--text-main);
  font-size: 34rpx;
  font-weight: bold;
  margin-left: 16rpx;
}
.dark-mode .nav-title {
  color: #ffffff;
}

.content-scroll {
  height: calc(100vh - constant(safe-area-inset-top) - 100rpx);
  height: calc(100vh - env(safe-area-inset-top, 0px) - 100rpx);
}
.content-section {
  padding: 32rpx;
}
.update-date {
  font-size: 24rpx;
  color: var(--text-sub);
  margin-bottom: 32rpx;
  display: block;
}
.dark-mode .update-date {
  color: rgba(255, 255, 255, 0.62);
}

.section {
  margin-bottom: 24rpx;
  padding: 26rpx 24rpx;
  border-radius: 28rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}
.dark-mode .section {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}
.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--text-main);
  margin-bottom: 16rpx;
  display: block;
}
.dark-mode .section-title {
  color: #ffffff;
}
.section-text {
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.8;
  margin-bottom: 12rpx;
  display: block;
}
.dark-mode .section-text {
  color: rgba(255, 255, 255, 0.68);
}
</style>
