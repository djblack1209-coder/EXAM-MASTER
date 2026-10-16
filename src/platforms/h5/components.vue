<template>
  <view v-if="enabled" class="component-preview" :class="theme.isDark ? 'theme-dark' : 'theme-light'">
    <view class="preview-heading"
      ><text class="preview-title">{{ t('preview.title') }}</text
      ><view class="preview-row">
        <BaseSegmented v-model="themeDraft" :options="themeOptions" :label="t('preview.theme')" />
        <BaseButton variant="quiet" @tap="setLanguage(currentLanguage === 'en' ? 'zh-CN' : 'en')">{{
          t('preview.language')
        }}</BaseButton>
        <BaseCheckbox
          :model-value="mascotReducedMotion"
          @update:model-value="setMascotReducedMotion($event, { persist: false })"
          >{{ t('preview.motion') }}</BaseCheckbox
        >
      </view></view
    >
    <view class="preview-grid">
      <BaseCard :title="t('preview.buttons')" class="preview-section" data-section="buttons"
        ><view class="preview-stack">
          <BaseButton>{{ t('preview.primary') }}</BaseButton>
          <view class="preview-row"
            ><BaseButton variant="secondary">{{ t('preview.secondary') }}</BaseButton
            ><BaseButton variant="quiet" icon="bulb">{{ t('preview.quiet') }}</BaseButton
            ><BaseButton variant="danger">{{ t('preview.danger') }}</BaseButton></view
          >
          <view class="preview-row"
            ><BaseButton variant="secondary" small>{{ t('preview.small') }}</BaseButton
            ><BaseButton variant="quiet" icon="up" icon-only :label="t('preview.icon')" /><BaseButton
              variant="secondary"
              disabled
              >{{ t('preview.disabled') }}</BaseButton
            ></view
          >
          <BaseButton variant="secondary" block>{{ t('preview.block') }}</BaseButton>
          <BaseButton variant="secondary" loading>{{ t('ui.loading') }}</BaseButton>
        </view></BaseCard
      >
      <BaseCard :title="t('preview.filters')" class="preview-section" data-section="filters"
        ><view class="preview-stack">
          <view class="preview-row"
            ><BaseChip v-model="chips[0]">{{ t('preview.general') }}</BaseChip
            ><BaseChip v-model="chips[1]">{{ t('preview.middle') }}</BaseChip
            ><BaseChip v-model="chips[2]" :count="20">{{ t('preview.high') }}</BaseChip></view
          >
          <BaseSegmented v-model="period" :options="periodOptions" :label="t('preview.today')" />
          <view class="preview-row"
            ><BaseTag
              v-for="tone in tones"
              :key="tone"
              :tone="tone"
              :icon="tone === 'mint' ? 'check' : tone === 'apricot' ? 'pen' : ''"
              >{{ t(`preview.${tone}`) }}</BaseTag
            ></view
          >
        </view></BaseCard
      >
      <BaseCard :title="t('preview.options')" class="preview-section" data-section="options"
        ><BaseOptions v-model="answer" :options="answerOptions" :label="t('preview.options')"
      /></BaseCard>
      <BaseCard :title="t('preview.inputs')" class="preview-section" data-section="inputs"
        ><view class="preview-stack">
          <BaseInput
            v-model="goal"
            :label="t('preview.goal')"
            :placeholder="t('preview.goalPlaceholder')"
            :help="t('preview.help')"
          />
          <BaseInput v-model="draft" multiline :label="t('preview.answer')" />
          <BaseInput model-value="yozi@" :label="t('preview.email')" :error="t('preview.emailError')" />
          <BaseInput v-model="phone" prefix="+86" :label="t('preview.phone')" inputmode="tel" />
          <BaseInput v-model="usPhone" prefix="+1" :label="t('preview.usPhone')" inputmode="tel" />
          <BaseInput
            v-model="code"
            verification
            :resend-seconds="resendSeconds"
            :label="t('preview.code')"
            inputmode="numeric"
            @resend="resendSeconds = 30"
          />
          <BaseInput disabled :label="t('preview.disabled')" />
          <view class="preview-row"
            ><BaseInput :label="t('preview.birthYear')" model-value="2005" inputmode="numeric" /><BaseInput
              :label="t('preview.birthMonth')"
              model-value="06"
              inputmode="numeric"
          /></view>
          <BaseCheckbox v-model="agreed">{{ t('preview.agree') }}</BaseCheckbox
          ><BaseCheckbox model-value disabled>{{ t('preview.disabled') }}</BaseCheckbox>
        </view></BaseCard
      >
      <BaseCard :title="t('preview.stats')" class="preview-section" data-section="stats"
        ><view class="preview-stats"
          ><BaseStat :label="t('preview.completed')" :value="5" :denominator="5" /><BaseStat
            :label="t('preview.reliable')"
            :value="3"
            :unit="t('preview.count')" /><BaseStat
            :label="t('preview.apricot')"
            :value="2"
            :unit="t('preview.count')" /></view
      ></BaseCard>
      <BaseCard :title="t('preview.chat')" class="preview-section" data-section="chat"
        ><view class="preview-stack"
          ><BaseBubble>{{ t('preview.aiMessage') }}</BaseBubble
          ><BaseBubble author="user">{{ t('preview.userMessage') }}</BaseBubble></view
        ></BaseCard
      >
      <BaseCard :title="t('preview.surfaces')" class="preview-section" data-section="surfaces"
        ><view class="preview-stack"
          ><BaseCard :title="t('preview.paper')">{{ t('preview.aiMessage') }}</BaseCard
          ><BaseCard surface="glass" :title="t('preview.glass')">{{ t('preview.setting') }}</BaseCard></view
        ></BaseCard
      >
      <BaseCard :title="t('preview.states')" class="preview-section" data-section="states"
        ><view class="preview-stack"
          ><BaseEmpty :title="t('preview.empty')" :desc="t('preview.emptyDescription')" show-button /><BaseEmpty
            state="loading"
            :title="t('preview.loading')" /><BaseEmpty
            state="error"
            :desc="t('preview.errorDescription')"
            show-button /></view
      ></BaseCard>
      <BaseCard :title="t('preview.overlays')" class="preview-section" data-section="overlays"
        ><view class="preview-stack"
          ><view class="preview-row"
            ><BaseButton variant="secondary" @tap="openDialog('center')">{{ t('preview.modal') }}</BaseButton
            ><BaseButton variant="secondary" @tap="openDialog('bottom')">{{ t('preview.sheet') }}</BaseButton></view
          ><BaseToast visible :duration="0" /><BaseListRow
            icon="moon"
            :label="t('preview.theme')"
            :value="t(theme.isDark ? 'preview.dark' : 'preview.light')"
            @tap="themeDraft = theme.isDark ? 'light' : 'dark'" /><BaseListRow
            icon="user"
            :label="t('preview.setting')"
            :value="currentLanguage === 'en' ? 'English' : '简体中文'" /><BaseListRow
            :label="t('preview.disabled')"
            disabled /></view
      ></BaseCard>
      <BaseCard :title="t('preview.brand')" class="preview-section" data-section="brands"
        ><view class="preview-stack"
          ><BaseButton variant="wechat" icon="wechat" block>微信</BaseButton
          ><BaseButton variant="apple" icon="apple" block>Apple</BaseButton
          ><BaseButton variant="google" icon="google" block>Google</BaseButton></view
        ></BaseCard
      >
      <BaseCard :title="t('preview.wot')" class="preview-section" data-section="wot"
        ><view class="preview-stack"
          ><WdButton>{{ t('preview.primary') }}</WdButton
          ><WdButton plain>{{ t('preview.secondary') }}</WdButton
          ><WdInput v-model="wotInput" :placeholder="t('preview.goalPlaceholder')" /><WdSegmented
            v-model:value="wotPeriod"
            :options="[t('preview.today'), t('preview.week'), t('preview.all')]" /><view class="preview-row"
            ><WdTag type="primary">{{ t('preview.violet') }}</WdTag
            ><WdTag type="success">{{ t('preview.mint') }}</WdTag></view
          ><WdLoading size="small" /></view
      ></BaseCard>
      <BaseCard :title="t('preview.icons')" class="preview-section" data-section="icons"
        ><view class="preview-icon-grid"
          ><view v-for="icon in iconNames" :key="icon" class="preview-icon"
            ><BaseIcon :name="icon" /><text>{{ icon }}</text></view
          ></view
        ></BaseCard
      >
    </view>
    <BaseCard :title="t('preview.mascot')" class="preview-section" data-section="mascots"
      ><view class="preview-stack">
        <BaseSegmented v-model="playMode" :label="t('preview.playModes')" :options="playOptions" />
        <view class="preview-mascot-grid"
          ><view v-for="pose in poses" :key="pose" class="preview-mascot"
            ><YoziMascot
              :key="`${pose}-${replay}`"
              :pose="pose"
              :play="activePose === pose ? playMode : 'none'"
              :decorative="false"
            /><text>{{ t(`mascot.${pose}`) }}</text
            ><BaseButton variant="quiet" small @tap="playPose(pose)">{{ t('preview.play') }}</BaseButton></view
          ></view
        >
        <YoziMascot size="large" play="none" :decorative="false" /> </view
    ></BaseCard>
    <CustomModal
      v-model:visible="dialogVisible"
      :position="dialogPosition"
      :title="t('preview.dialogTitle')"
      :content="t('preview.dialogContent')"
      :confirm-text="t('preview.danger')"
      type="error"
      mask-closable
      escape-closable
      close-button
      :is-dark="theme.isDark"
    />
  </view>
  <BaseEmpty v-else />
</template>
<script setup>
import './messages.js';
import { computed, ref, watch } from 'vue';
import { t, setLanguage, currentLanguage } from '@/i18n/index.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { mascotReducedMotion, setMascotReducedMotion } from '@/design/mascot-motion.js';
import { BOARD_ICONS } from '@/components/base/base-icon/board-icons.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseTag from '@/components/base/base-tag/base-tag.vue';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseBubble from '@/components/base/base-bubble/base-bubble.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseToast from '@/components/base/base-toast/base-toast.vue';
import BaseListRow from '@/components/base/base-list-row/base-list-row.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import WdButton from '@/components/base/base-button/wot-button.vue';
import WdLoading from '@/components/base/base-loading/base-loading.vue';
import WdInput from 'wot-design-uni/components/wd-input/wd-input.vue';
import WdTag from 'wot-design-uni/components/wd-tag/wd-tag.vue';
import WdSegmented from 'wot-design-uni/components/wd-segmented/wd-segmented.vue';
const enabled = typeof __YOZI_PREVIEW__ !== 'undefined' && __YOZI_PREVIEW__;
const theme = useThemeStore();
const themeDraft = ref(theme.isDark ? 'dark' : 'light');
watch(themeDraft, (value) => theme.setDarkMode(value === 'dark', { persist: false }));
const themeOptions = computed(() => ['light', 'dark'].map((value) => ({ value, label: t(`preview.${value}`) })));
const period = ref('today');
const periodOptions = computed(() =>
  ['today', 'week', 'all'].map((value) => ({ value, label: t(`preview.${value}`) }))
);
const chips = ref([true, false, false]);
const tones = ['violet', 'mint', 'coral', 'apricot', 'neutral'];
const answer = ref('selected');
const answerOptions = computed(() =>
  ['default', 'selected', 'correct', 'wrong', 'pending'].map((value) => ({
    value,
    state: value,
    label: t(`preview.${value}Option`)
  }))
);
const goal = ref(''),
  draft = ref(''),
  phone = ref(''),
  usPhone = ref(''),
  code = ref(''),
  agreed = ref(false),
  resendSeconds = ref(12);
const wotInput = ref(''),
  wotPeriod = ref('');
const dialogVisible = ref(false),
  dialogPosition = ref('center');
function openDialog(position) {
  dialogPosition.value = position;
  dialogVisible.value = true;
}
const iconNames = Object.keys(BOARD_ICONS);
const poses = ['idle', 'wave', 'think', 'celebrate', 'encourage', 'read', 'sleep', 'point', 'curious'];
const activePose = ref(''),
  playMode = ref('auto'),
  replay = ref(0);
const playOptions = computed(() =>
  ['auto', 'once', 'loop', 'none'].map((value) => ({ value, label: t(`preview.${value}`) }))
);
function playPose(pose) {
  activePose.value = pose;
  replay.value++;
}
</script>
<style scoped>
.component-preview {
  padding: var(--s-6);
  color: var(--ink);
  background: var(--canvas);
  min-height: 100vh;
  font-family: var(--font-ui);
  box-sizing: border-box;
}
.preview-heading {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  margin-bottom: var(--s-6);
}
.preview-title {
  font: var(--weight-display) var(--size-title-1)/var(--leading-title-1) var(--font-display);
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s-5);
  margin-bottom: var(--s-5);
}
.preview-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}
.preview-row > .base-field {
  flex: 1;
}
.preview-stack {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  align-items: stretch;
}
.preview-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s-3);
}
.preview-mascot-grid,
.preview-icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--mascot-medium), 1fr));
  gap: var(--s-3);
}
.preview-mascot,
.preview-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3);
  background: var(--paper-sunk);
  border-radius: var(--r-md);
  font-size: var(--size-caption);
}
@media (max-width: 900px) {
  .preview-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .component-preview {
    padding: var(--s-4);
  }
}
</style>
