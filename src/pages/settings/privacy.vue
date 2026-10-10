<template>
  <view ref="keyboardRoot" class="page-container" :class="{ 'dark-mode': isDark }">
    <view class="top-nav">
      <button class="nav-back" role="button" aria-label="返回" tabindex="0" @tap="goBack">
        <text class="back-icon">
          <BaseIcon name="arrow-left" :size="20" />
        </text>
      </button>
      <text class="nav-title"> 隐私政策 </text>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <view class="content-section">
        <text class="update-date"> 更新日期：2026年9月29日 · 本地候选说明，公开发布前需审核 </text>

        <view class="section">
          <text class="section-title"> 一、引言 </text>
          <text class="section-text">
            欢迎使用
            {{
              BRAND.name
            }}（以下简称"本应用"）。我们深知个人信息对您的重要性，将严格遵守相关法律法规，采取相应的安全保护措施，保护您的个人信息安全。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 二、我们收集的信息 </text>
          <text class="section-text"> 为了向您提供服务，我们可能会收集以下信息： </text>
          <text class="section-text">
            1. 选择账号服务时使用登录资料。本地学习可以不登录；微信昵称、头像仅用于您选择的账号展示。
          </text>
          <text class="section-text">
            2. 学习数据：您的刷题记录、错题本、收藏和题库同步状态，用于提供练习、复习和学习进度展示。
          </text>
          <text class="section-text"> 对话、私人材料片段、页图、作答和计划按所选模式保存，不默认进入公共题库。 </text>
          <text class="section-text"> 3. 设备信息：设备型号、操作系统版本、屏幕分辨率，用于适配显示和优化性能。 </text>
        </view>

        <view class="section">
          <text class="section-title"> 三、信息的使用 </text>
          <text class="section-text"> 我们收集的信息仅用于以下目的： </text>
          <text class="section-text"> 1. 提供、维护和改进本应用的功能与服务。 </text>
          <text class="section-text"> 2. 展示学习进度、错题复习和题库练习状态。 </text>
          <text class="section-text"> 3. 保障账号安全与服务稳定运行。 </text>
        </view>

        <view class="section">
          <text class="section-title"> 四、信息的存储与保护 </text>
          <text class="section-text">
            本地模式使用当前设备的普通本地存储，包含恢复副本，不承诺系统级加密。
            只有明确选择云同步或模型并同意共享，相关记录或当前任务必要上下文才发送至所选服务；
            本机解析的原件、页图与识别留在本机。不会因本地能力不足静默上传整份资料。
          </text>
          <text class="section-text">
            自带 API
            的密钥由项目后端单独加密保存，服务端运维具备解密能力，不是端到端加密。普通学习导出不含密钥。本地连接令牌仅本次页面持有，离开页面后需重新连接。上游模型处理规则需按所选供应商核对。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 五、您的权利 </text>
          <text class="section-text">
            您可以查看、纠正和导出学习记录，删除本地新学习记录会覆盖相应恢复副本，
            但不会同时删除旧记录、云副本或本机解析原件；这些范围需分别处理。 账号注销流程保留7天冷静期，期间可撤销申请。
            生产备份保留周期、清除范围和必要留存尚需部署验收，不宣称即时删除全部副本。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 六、未成年人保护 </text>
          <text class="section-text">
            我们重视对未成年人个人信息的保护。如您为未满18周岁的未成年人，请在监护人的陪同和指导下使用本应用。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 七、隐私政策的更新 </text>
          <text class="section-text"> 我们可能会适时修订本隐私政策。更新后的政策将在本页面发布，建议您定期查阅。 </text>
        </view>

        <view class="section">
          <text class="section-title"> 八、题库与学习数据说明 </text>
          <text class="section-text"> 1. 本应用的题库、练习进度、错题和收藏数据用于提供刷题、复习和结果回顾。 </text>
          <text class="section-text">
            2. 题目和解析用于学习辅助，不作为考试结果、录取结果或任何具有法律效力的依据。
          </text>
          <text class="section-text">
            3. 您可在应用内管理个人资料、清理本地缓存，或通过账号注销流程申请删除账号相关数据。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 九、联系我们 </text>
          <text class="section-text"> 如您对本隐私政策有任何疑问，请通过应用内"设置"页面的反馈功能与我们联系。 </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { BRAND } from '@/config/brand.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';

const keyboardRoot = ref(null);
let unbindKeyboard = () => undefined;
onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(keyboardRoot.value);
});
onBeforeUnmount(() => unbindKeyboard());

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

function goBack() {
  safeNavigateBack();
}
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  color: var(--text-main);
  background: var(--yozi-background);
  font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.top-nav {
  @include em-mobile-topbar;
  display: flex;
  align-items: center;
  padding: env(safe-area-inset-top, 0px) 16px 0;
  height: calc(env(safe-area-inset-top, 0px) + 64px);
  gap: 12px;
}
.nav-back {
  @include em-mobile-pressable;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 0;
  background: var(--yozi-glass);
  color: var(--text-main);
  box-shadow: var(--yozi-control-shadow);
}
.nav-back::after {
  border: 0;
}
.nav-back:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.nav-title {
  color: var(--text-main);
  font-size: 17px;
  font-weight: 700;
}
.content-scroll {
  height: calc(100vh - env(safe-area-inset-top, 0px) - 64px);
}
.content-section {
  max-width: 76ch;
  margin: 0 auto;
  padding: 20px 16px;
}
.update-date {
  font-size: 12px;
  color: var(--text-sub);
  margin-bottom: 20px;
  display: block;
  line-height: 1.65;
}
.section {
  @include em-mobile-glass-surface(24px, 20px);
  margin-bottom: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 12px;
  display: block;
}
.section-text {
  font-size: 14px;
  color: var(--text-sub);
  line-height: 1.8;
  margin-bottom: 12px;
  display: block;
  overflow-wrap: anywhere;
}
.section-text:last-child {
  margin-bottom: 0;
}
</style>
