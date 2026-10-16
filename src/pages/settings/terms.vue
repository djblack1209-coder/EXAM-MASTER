<template>
  <view
    ref="keyboardRoot"
    class="page-container"
    :style="$yoziInsets"
    :class="{ 'dark-mode': isDark, 'theme-light': !isDark }"
  >
    <view class="top-nav">
      <BaseButton class="nav-back" variant="quiet" icon="arrow-left" icon-only :label="$t('ui.back')" @tap="goBack" />
      <text class="nav-title">{{ $t('pages.terms') }}</text>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <view class="content-section">
        <text class="update-date"> 更新日期：2026年9月29日 · 本地候选，真实收费关闭 </text>

        <view class="section">
          <text class="section-title"> 一、服务说明 </text>
          <text class="section-text">
            {{
              BRAND.name
            }}（以下简称"本应用"）以对话为主要学习入口，提供讲解、作答记录、复习和计划视图，并保留公共课真题练习、错题复习、收藏和学习进度管理。公开版本的运营主体、适用规则和各端支付条款仍需审核。
          </text>
          <text class="section-text"> 本应用提供的内容用于学习辅助，不构成考试结果承诺或替代官方考试信息发布。 </text>
          <text class="section-text">
            核心学习工具免费，错题、基础统计和学习计划不以平台模型会员为条件。
            可选订阅购买模型服务，价格、周期、周额度及结转尚未确定，当前仅开发沙箱且不产生实际收费。使用自带 API
            不扣平台额度，上游费用由用户承担；本地资源有公开的大小和任务预算限制。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 二、账号注册与使用 </text>
          <text class="section-text">
            1. 本地学习无需账号；云同步及受保护接口需有效登录，模型调用需明确连接与数据共享授权。
          </text>
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
            平台软件、第三方组件、题库与用户资料分别按各自授权使用。上传私人资料不表示将其转让给平台或同意公开；题目来源的内容可访问不代表可以已获授权使用。用户需持有相应使用权限。
          </text>
        </view>

        <view class="section">
          <text class="section-title"> 五、免责声明 </text>
          <text class="section-text"> 1. 本应用提供的题目、解析和学习记录用于学习辅助，不构成任何考试通过承诺。 </text>
          <text class="section-text">
            2. 因不可抗力、网络故障等原因导致服务中断，本应用不承担责任，但将尽力恢复服务。
          </text>
          <text class="section-text"> 3. 您应自行核对学习内容，并结合官方考试要求安排复习。 </text>
          <text class="section-text"> 4. 您应确保在本应用中保存或提交的信息合法合规且不侵犯他人权益。 </text>
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

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
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

<style scoped>
.page-container {
  min-height: 100vh;
  color: var(--ink);
  background: var(--canvas);
  font: var(--weight-regular) var(--size-body)/var(--leading-body) var(--font-ui);
}
.top-nav {
  display: flex;
  align-items: center;
  padding: env(safe-area-inset-top, 0px) var(--s-4) 0;
  height: calc(env(safe-area-inset-top, 0px) + var(--control-height) + var(--s-4));
  gap: var(--s-3);
  background: var(--glass);
  backdrop-filter: blur(var(--glass-blur));
  border-bottom: var(--border-thin) solid var(--glass-line);
}
.nav-title {
  color: var(--ink);
  font: var(--weight-ui-emphasis) var(--size-title-3)/var(--leading-title-3) var(--font-ui);
}
.content-scroll {
  height: calc(100vh - env(safe-area-inset-top, 0px) - var(--control-height) - var(--s-4));
}
.content-section {
  max-width: var(--reading-measure);
  margin: 0 auto;
  padding: var(--s-6) var(--s-4);
}
.update-date {
  font-size: var(--size-caption);
  color: var(--ink-3);
  margin-bottom: var(--s-6);
  display: block;
  line-height: var(--leading-small);
}
.section {
  padding: var(--s-5);
  border-radius: var(--r-md);
  background: var(--paper);
  margin-bottom: var(--s-4);
}
.section-title {
  font: var(--weight-ui-emphasis) var(--size-title-3)/var(--leading-title-3) var(--font-ui);
  color: var(--ink);
  margin-bottom: var(--s-3);
  display: block;
}
.section-text {
  font-size: var(--size-body);
  color: var(--ink-2);
  line-height: var(--leading-body);
  margin-bottom: var(--s-3);
  display: block;
  overflow-wrap: anywhere;
}
.section-text:last-child {
  margin-bottom: 0;
}
</style>

<style scoped>
/* #ifdef MP-WEIXIN */
.top-nav {
  padding-top: var(--yozi-status-top, 0px);
  padding-right: calc(var(--yozi-capsule-right, 0px) + var(--s-3));
  height: calc(var(--yozi-status-top, 0px) + var(--control-height) + var(--s-4));
  background: var(--paper);
  backdrop-filter: none;
}
.content-scroll {
  height: calc(100vh - var(--yozi-status-top, 0px) - var(--control-height) - var(--s-4));
}
/* #endif */
</style>
