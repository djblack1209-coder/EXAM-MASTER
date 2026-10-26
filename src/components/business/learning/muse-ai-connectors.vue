<template>
  <view class="ai-connectors">
    <text v-if="!getToken()" class="connect-status">登录后才能连接 AI 老师；本地学习记录仍可查看。</text>
    <text v-else-if="learning.modelListState?.phase === 'loading'" class="connect-status" role="status"
      >正在读取已保存的连接…</text
    >
    <view v-else-if="learning.modelListState?.phase === 'error'" class="connect-status" role="alert">
      <text>{{ learning.modelListState.message || '连接读取失败，请重试。' }}</text>
      <BaseButton variant="quiet" @tap="learning.loadModels()">重新读取连接</BaseButton>
    </view>
    <view class="connect-search"
      ><BaseIcon name="search" size="18px" /><BaseInput
        v-model="query"
        label="搜索 AI 连接器"
        placeholder="搜索"
        hide-label
        maxlength="80"
    /></view>
    <view class="connect-tabs" role="tablist" aria-label="连接器状态">
      <BaseButton
        v-for="tab in tabs"
        :key="tab.id"
        variant="quiet"
        role="tab"
        :aria-selected="filter === tab.id"
        :selected="filter === tab.id"
        @tap="filter = tab.id"
        >{{ tab.label }}</BaseButton
      >
    </view>
    <view v-for="group in providerGroups" :key="group.id" class="connect-group">
      <text class="connect-group-title">{{ group.label }}</text>
      <view class="connect-list">
        <view v-for="provider in group.items" :key="provider.id" class="connect-row">
          <image
            v-if="provider.logo"
            :src="provider.logo"
            class="connect-logo"
            :class="{ 'brand-mono': provider.mono }"
            mode="aspectFit"
            alt=""
          />
          <view class="connect-name"
            ><text>{{ provider.provider }}</text
            ><text v-if="provider.saved" class="connect-model">{{ provider.saved.model }}</text
            ><text class="connect-model">{{ connectionLabel(provider.saved) }}</text></view
          >
          <BaseButton variant="quiet" :disabled="learning.busy || learning.intakeBusy" @tap="open(provider)">{{
            provider.saved ? (provider.saved.configured ? '管理' : '填写密钥') : '添加'
          }}</BaseButton>
        </view>
      </view>
    </view>
    <view
      v-if="!providers.length && !['loading', 'error'].includes(learning.modelListState?.phase)"
      class="connect-empty"
      >{{ filter === 'connected' ? '暂无连接' : '没有匹配的连接器' }}</view
    >
    <text v-if="message" class="connect-status" role="status">{{ message }}</text>
    <CustomModal
      :visible="Boolean(current)"
      :title="`${current?.saved ? '管理' : '连接'} ${current?.provider || ''}`"
      container-class="connect-dialog"
      :is-dark="theme.isDark"
      :show-actions="false"
      close-button
      mask-closable
      @cancel="close"
    >
      <template #title>
        <view class="connect-dialog-heading">
          <image
            v-if="current?.logo"
            :src="current.logo"
            class="connect-logo"
            :class="{ 'brand-mono': current.mono }"
            mode="aspectFit"
            alt=""
          />
          <text>{{ current?.provider }}</text>
        </view>
      </template>
      <view class="connect-form">
        <template v-if="current?.saved">
          <text class="connect-model">{{ current.saved.model }}</text>
          <BaseButton
            v-if="current.saved.configured"
            variant="primary"
            :loading="saving"
            :disabled="learning.busy || learning.intakeBusy"
            @tap="select(current.saved)"
            >{{ learning.modelId === current.saved.id ? '正在使用' : '使用此模型' }}</BaseButton
          >
          <BaseButton v-if="current.saved.configured" variant="quiet" @tap="editing = !editing">更换密钥</BaseButton>
          <BaseButton variant="quiet" :disabled="saving" @tap="disconnecting = true">{{
            current.saved.configured ? '断开连接' : '移除'
          }}</BaseButton>
        </template>
        <template v-if="!current?.saved?.configured || editing">
          <BaseInput v-if="!current?.saved" v-model="draft.model" label="模型" :maxlength="120" autocomplete="off" />
          <BaseInput
            v-model="apiKey"
            label="API 密钥"
            type="password"
            :maxlength="MODEL_API_KEY_MAX_LENGTH"
            autocomplete="off"
          />
          <text class="connect-status">{{
            apiKey.trim() || editing
              ? '密钥会加密保存到 Yozi 服务端，运维可解密；连接后开始模型建档。'
              : '可先添加，稍后填写密钥。添加不会调用模型。'
          }}</text>
          <BaseButton
            variant="primary"
            :loading="saving"
            :disabled="saving || !draft.model.trim() || (Boolean(current?.saved) && !apiKey.trim())"
            @tap="connect"
            >{{ current?.saved ? '保存并连接' : apiKey.trim() ? '连接' : '添加' }}</BaseButton
          >
        </template>
        <text v-if="error" class="connect-error" role="alert">{{ error }}</text>
      </view>
    </CustomModal>
    <CustomModal
      :visible="loginRequired"
      title="登录后才能连接 AI 老师"
      :is-dark="theme.isDark"
      confirm-text="去登录"
      cancel-text="继续本地学习"
      @confirm="goLogin"
      @cancel="continueLocal"
      ><text>登录用于安全保存和管理模型连接。未登录仍可查看本地学习记录。</text></CustomModal
    >
    <CustomModal
      :visible="disconnecting"
      title="断开连接？"
      :is-dark="theme.isDark"
      confirm-text="断开连接"
      :confirm-loading="saving"
      @cancel="disconnecting = false"
      @confirm="disconnect"
    />
  </view>
</template>
<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import {
  MODEL_CONNECTION_PRESETS,
  MODEL_API_KEY_MAX_LENGTH,
  visibleModelChoices
} from '../../../../laf-backend/functions/_shared/ai-providers/model-endpoints.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { getToken, getUserId } from '@/services/auth-storage.js';
import { isDesktopSettingsWindow, startDesktopModelIntake } from '@/services/desktop/windows.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import { modelBrand } from '@/config/model-brands.js';
import { publicError } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import CustomModal from '@/components/common/CustomModal.vue';
const learning = useConversationLearningStore(),
  theme = useThemeStore();
const query = ref(''),
  filter = ref('available'),
  loginRequired = ref(false),
  current = ref(null),
  apiKey = ref(''),
  editing = ref(false),
  saving = ref(false),
  disconnecting = ref(false),
  message = ref(''),
  error = ref(''),
  draft = ref({});
const tabs = [
  { id: 'available', label: '可用' },
  { id: 'connected', label: '已连接' }
];
const catalog = computed(() => {
  const unique = new Map();
  for (const preset of visibleModelChoices(
    [...MODEL_CONNECTION_PRESETS, ...learning.modelPresets],
    learning.models.filter((model) => model.source === 'byok')
  ))
    if (!unique.has(preset.provider)) unique.set(preset.provider, { ...preset, ...modelBrand(preset.provider) });
  for (const saved of visibleModelChoices(learning.models, learning.models).filter(
    (model) => model.source === 'byok'
  )) {
    const prior = [...unique.values()].find((item) => item.provider === saved.provider && !item.saved);
    if (prior) unique.set(prior.provider, { ...prior, saved });
    else unique.set(saved.id, { ...saved, saved, ...modelBrand(saved.provider) });
  }
  return [...unique.values()];
});
function connectionLabel(saved) {
  if (!saved?.configured) return '未连接';
  return (
    { connected: '已配置 · 最近请求成功', failed: '已配置 · 验证失败', stale: '已配置 · 需重新验证' }[
      saved.connectionStatus
    ] || '已配置 · 未验证'
  );
}
const providers = computed(() =>
  catalog.value.filter(
    (item) =>
      (filter.value !== 'connected' || item.saved?.configured) &&
      `${item.provider} ${item.model}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())
  )
);
const providerGroups = computed(() =>
  [
    { id: 'general', label: '通用' },
    { id: 'other', label: '其他' }
  ]
    .map((group) => ({ ...group, items: providers.value.filter((item) => item.group === group.id) }))
    .filter((group) => group.items.length)
);
function close() {
  loginRequired.value = false;
  current.value = null;
  apiKey.value = '';
  error.value = '';
  editing.value = false;
  disconnecting.value = false;
}
function open(provider) {
  close();
  if (!getToken()) {
    loginRequired.value = true;
    return;
  }
  current.value = provider;
  draft.value = { ...provider, ...(provider.saved || {}) };
}
function goLogin() {
  close();
  safeNavigateTo('/pages/login/index');
}
function continueLocal() {
  close();
  safeNavigateTo('/pages/learning/index');
}
async function select(model) {
  if (learning.busy || learning.intakeBusy || saving.value) return;
  const context = learning.recordContext();
  saving.value = true;
  error.value = '';
  try {
    if (isDesktopSettingsWindow()) {
      await startDesktopModelIntake(model.id, getUserId());
      close();
      return;
    }
    const result = await learning.beginModelIntake(model.id);
    if (context !== learning.recordContext()) return;
    if (!result.success) {
      error.value = result.error === 'INTAKE_UNAVAILABLE' ? '服务更新后即可开始对话建档' : publicError(result);
      return;
    }
    const catalog = await learning.loadModels();
    if (context !== learning.recordContext()) return;
    if (!catalog.success) {
      error.value = publicError(catalog);
      return;
    }
    learning.modelId = model.id;
    learning.selectedMode = 'cloud';
    learning.streamEnabled = learning.streamSupported === true;
    if (!learning.active?.coach?.profile && !learning.active?.studyProfile) learning.selectedConversationId = null;
    close();
    safeNavigateTo('/pages/learning/index');
  } catch (failure) {
    if (context === learning.recordContext())
      error.value = isDesktopSettingsWindow()
        ? '模型尚未启用，请在主窗口查看错误；连接配置已保留，可稍后重试。'
        : publicError(failure);
  } finally {
    saving.value = false;
  }
}
async function connect() {
  if (saving.value || !draft.value.model?.trim() || !current.value || (current.value.saved && !apiKey.value.trim()))
    return;
  if (!getToken()) {
    apiKey.value = '';
    current.value = null;
    loginRequired.value = true;
    return;
  }
  const context = learning.recordContext();
  saving.value = true;
  error.value = '';
  try {
    const profile = {
      id: current.value.saved?.id || draft.value.id,
      provider: draft.value.provider,
      model: draft.value.model.trim(),
      endpoint: draft.value.endpoint,
      structured: (current.value.saved?.capabilities?.structured ?? draft.value.structured) === true,
      stream: (current.value.saved?.capabilities?.stream ?? draft.value.stream) === true,
      vision: current.value.saved?.capabilities?.vision === true,
      apiKey: apiKey.value
    };
    const result = await learning.saveModel(profile, true);
    if (context !== learning.recordContext()) return;
    if (!result.success) {
      error.value = result.error === 'INTAKE_UNAVAILABLE' ? '服务更新后即可开始对话建档' : publicError(result);
      return;
    }
    if (!profile.apiKey.trim()) {
      close();
      message.value = '已添加，可稍后填写密钥';
      return;
    }
    if (isDesktopSettingsWindow()) {
      await startDesktopModelIntake(profile.id, getUserId());
      close();
      return;
    }
    const connection = await learning.beginModelIntake(profile.id);
    if (context !== learning.recordContext()) return;
    if (!connection.success) {
      error.value = connection.error === 'INTAKE_UNAVAILABLE' ? '服务更新后即可开始对话建档' : publicError(connection);
      return;
    }
    const catalog = await learning.loadModels();
    if (context !== learning.recordContext()) return;
    if (!catalog.success) {
      error.value = publicError(catalog);
      return;
    }
    learning.modelId = profile.id;
    learning.selectedMode = 'cloud';
    learning.streamEnabled = learning.streamSupported === true;
    if (!learning.active?.coach?.profile && !learning.active?.studyProfile) learning.selectedConversationId = null;
    close();
    safeNavigateTo('/pages/learning/index');
  } catch (failure) {
    if (context === learning.recordContext())
      error.value = isDesktopSettingsWindow()
        ? '模型尚未启用，请在主窗口查看错误；连接配置已保留，可稍后重试。'
        : publicError(failure);
  } finally {
    apiKey.value = '';
    saving.value = false;
  }
}
async function disconnect() {
  const id = current.value?.saved?.id;
  if (!id || saving.value) return;
  const context = learning.recordContext();
  saving.value = true;
  try {
    const result = await learning.removeModel(id);
    if (context !== learning.recordContext()) return;
    if (result.success) {
      close();
      message.value = '连接已断开';
    } else error.value = result.error === 'INTAKE_UNAVAILABLE' ? '服务更新后即可开始对话建档' : publicError(result);
  } catch (failure) {
    if (context === learning.recordContext())
      error.value = isDesktopSettingsWindow()
        ? '模型尚未启用，请在主窗口查看错误；连接配置已保留，可稍后重试。'
        : publicError(failure);
  } finally {
    disconnecting.value = false;
    saving.value = false;
  }
}
watch(
  () => learning.recordContext(),
  () => {
    close();
    query.value = '';
    message.value = '';
  }
);
onMounted(async () => {
  if (getToken())
    try {
      await learning.loadModels();
    } catch {
      /* Store owns read status. */
    }
});
onUnmounted(close);
</script>
<style scoped>
.ai-connectors {
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 32px;
}
.connect-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  min-height: 44px;
  border-radius: 999px;
  background: var(--muse-raised);
  color: var(--ink-3);
}
.connect-search :deep(.base-field) {
  flex: 1;
  min-width: 0;
}
.connect-search :deep(.base-field__group) {
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 0;
  outline: none !important;
}
.connect-search:focus-within {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.connect-search :deep(.base-field__input:focus-visible),
.connect-form :deep(.base-field__input:focus-visible) {
  outline: none;
}
.connect-form :deep(.base-field__group.is-focused) {
  outline-offset: 0 !important;
  box-shadow: none;
}
.connect-tabs {
  display: flex;
  padding: 4px;
  border-radius: 999px;
  background: var(--muse-raised);
}
.connect-tabs .base-button {
  color: var(--ink-2);
  flex: 1;
  border-radius: 999px;
  min-height: 44px;
}
.connect-tabs .is-selected {
  background: var(--muse-selected);
}
.connect-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.connect-group-title {
  font-size: 14px;
  color: var(--ink-3);
  font-weight: 600;
  margin: 4px 4px 0;
}
.connect-list {
  border-radius: 16px;
  background: var(--muse-raised);
  padding: 6px 16px;
}
.connect-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.connect-row:last-child {
  border: 0;
}
/* Like Muse's connector tiles, each official mark sits whole on a light rounded tile, so black
   and colored marks stay legible on dark surfaces without recoloring or the global image dimming. */
.ai-connectors .connect-logo,
.connect-dialog-heading .connect-logo {
  flex: none;
  width: 32px;
  height: 32px;
  padding: 5px;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #0000000f;
  opacity: 1;
  filter: none;
}
.connect-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.connect-name text {
  display: block;
}
.connect-model {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 20px;
}
.connect-row .base-button {
  flex: none;
  color: var(--blue);
  padding: 0 8px;
  min-width: 44px;
}
.connect-empty {
  padding: 32px 16px;
  color: var(--ink-3);
  font-size: 13px;
  text-align: center;
}
.connect-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
  min-width: 0;
}
.connect-dialog-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 4px 44px 8px;
  text-align: center;
}
.connect-dialog-heading .connect-logo {
  width: 40px;
  height: 40px;
  padding: 6px;
  border-radius: 10px;
}
:global(.connect-dialog .modal-close) {
  position: absolute;
  top: 12px;
  right: 12px;
}
.connect-status {
  font-size: 12px;
  color: var(--ink-3);
}
.connect-error {
  font-size: 13px;
  color: var(--danger);
  line-height: 20px;
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .ai-connectors {
    gap: 16px;
  }
}
</style>
