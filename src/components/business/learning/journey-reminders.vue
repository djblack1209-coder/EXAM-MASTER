<template>
  <view v-if="learning.journey" ref="root" class="journey-reminders" data-test="journey-reminders">
    <view class="reminder-heading"
      ><text class="section-title">学习提醒</text>
      <button role="button" tabindex="0" :aria-expanded="editing" @tap="edit">
        {{ editing ? '收起设置' : '设置提醒' }}
      </button></view
    >
    <view v-if="editing" class="reminder-form">
      <view class="button-row" aria-label="提醒类型">
        <button
          v-for="kind in REMINDER_KINDS"
          :key="kind.id"
          role="button"
          tabindex="0"
          :aria-pressed="form.kind === kind.id"
          :class="{ chosen: form.kind === kind.id }"
          @tap="form.kind = kind.id"
        >
          {{ kind.label }}
        </button>
      </view>
      <view class="button-row" aria-label="常用提醒时间">
        <button
          v-for="time in ['08:00', '14:00', '20:00']"
          :key="time"
          role="button"
          tabindex="0"
          :aria-pressed="form.time === time"
          @tap="form.time = time"
        >
          {{ time }}
        </button>
        <button role="button" tabindex="0" @tap="nearbyTime">填入3分钟后的时刻</button>
      </view>
      <label
        ><text>提醒时间</text><input v-model="form.time" aria-label="提醒时间" placeholder="HH:mm" maxlength="5"
      /></label>
      <label><text>时区</text><input v-model="form.timezone" aria-label="提醒时区" maxlength="80" /></label>
      <view class="button-row" aria-label="提醒重复日">
        <button
          v-for="(label, day) in weekdays"
          :key="day"
          role="button"
          tabindex="0"
          :aria-pressed="form.repeatDays.includes(day)"
          :class="{ chosen: form.repeatDays.includes(day) }"
          @tap="toggleDay(day)"
        >
          {{ label }}
        </button>
      </view>
      <view class="button-row"
        ><button
          class="primary"
          role="button"
          tabindex="0"
          :disabled="busy"
          :aria-disabled="busy"
          data-test="reminder-save"
          @tap="save"
        >
          保存提醒</button
        ><button role="button" tabindex="0" @tap="editing = false">取消</button></view
      >
    </view>
    <view v-for="reminder in learning.active.reminders || []" :key="reminder.id" class="reminder-row">
      <view
        ><text>{{ kindName(reminder.kind) }} · {{ reminder.time }}</text>
        <text class="reminder-meta"
          >{{ reminder.timezone }} · {{ reminder.repeatDays.map((d) => weekdays[d]).join('、') }} ·
          {{ reminder.enabled ? '已保存' : '已暂停' }}</text
        ></view
      >
      <button role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @tap="toggle(reminder)">
        {{ reminder.enabled ? '暂停' : '启用' }}
      </button>
    </view>
    <text v-for="receipt in latestReceipts" :key="receipt.id" class="reminder-meta"
      >{{ kindName(receipt.kind) }} · {{ receipt.day }} ·
      {{ receipt.historyOnly ? '历史终端回执' : receiptLabel(receipt.status) }}</text
    >
    <view class="button-row"
      ><button
        role="button"
        tabindex="0"
        :disabled="busy || channel === 'unsupported'"
        :aria-disabled="busy || channel === 'unsupported'"
        data-test="reminder-permission"
        @tap="allow"
      >
        允许{{ channel === 'macos' ? '系统定时' : '应用内' }}通知
      </button>
      <button v-if="channel === 'macos'" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @tap="check">
        核对系统安排
      </button></view
    >
    <text class="reminder-meta">{{
      channel === 'macos'
        ? '系统定时覆盖未来7天，重开自动接续；退出后仍可触发，显示取决于系统通知设置。'
        : channel === 'web'
          ? '应用打开时提醒；退出后的系统定时通知需要macOS桌面端。'
          : '此终端尚未接入系统通知，提醒设置仍可保存。'
    }}</text>
    <text v-if="message" class="reminder-feedback" :class="{ warning: failed }" :role="failed ? 'alert' : 'status'">{{
      message
    }}</text>
  </view>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { REMINDER_KINDS } from '../../../../laf-backend/functions/_shared/learning-reminders.js';
import { learningNotificationsFor } from '@/services/learning/learning-notifications.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
const learning = useConversationLearningStore();
const root = ref(null),
  editing = ref(false),
  form = ref({}),
  message = ref(''),
  failed = ref(false),
  handling = ref(false);
const controller = learningNotificationsFor(learning);
const channel = controller.channel;
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const busy = computed(
  () => handling.value || learning.busy || learning.syncBusy || learning.materialBusy || learning.historyBusy
);
const latestReceipts = computed(() =>
  (learning.active.reminders || [])
    .map((reminder) => {
      const receipt = (learning.active.reminderReceipts || [])
        .filter((r) => r.reminderId === reminder.id && r.generation === reminder.generation)
        .at(-1);
      return receipt ? { ...receipt, kind: reminder.kind } : null;
    })
    .filter(Boolean)
);
const receiptLabel = (status) =>
  ({
    accepted: '终端已显示通知',
    failed: '显示失败，请调整并重新保存提醒',
    unknown: '显示状态待确认',
    opened: '已从提醒返回'
  })[status];
let unbind = () => undefined,
  refreshTimer = null;
const kindName = (id) => REMINDER_KINDS.find((k) => k.id === id)?.label || '提醒';
function nearbyTime() {
  try {
    form.value.time = new Intl.DateTimeFormat('en-GB', {
      timeZone: form.value.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(Date.now() + 3 * 60000));
  } catch {
    message.value = '请先填写有效时区';
    failed.value = true;
  }
}
function edit() {
  if (!editing.value)
    form.value = {
      kind: 'study',
      time: '20:00',
      repeatDays: [0, 1, 2, 3, 4, 5, 6],
      timezone: learning.journey.timezone,
      enabled: true
    };
  editing.value = !editing.value;
  message.value = '';
}
function toggleDay(day) {
  form.value.repeatDays = form.value.repeatDays.includes(day)
    ? form.value.repeatDays.filter((d) => d !== day)
    : [...form.value.repeatDays, day];
}
async function operation(callback) {
  if (busy.value) return;
  handling.value = true;
  try {
    const result = await callback();
    failed.value = false;
    message.value =
      result?.status === 'partial-scheduled'
        ? `本机系统已确认 ${result.count} / ${result.total} 项安排，后续重开接续`
        : result?.status === 'scheduled'
          ? `本机系统已确认 ${result.count} 项定时安排`
          : '提醒设置已保存';
  } catch (error) {
    message.value = typeof error === 'string' ? error : error.message || '提醒暂不可用，请重试';
    failed.value = true;
  } finally {
    handling.value = false;
  }
}
function save() {
  operation(async () => {
    learning.configureReminder(learning.journeyContext(), form.value);
    editing.value = false;
    return controller.refresh();
  });
}
function toggle(reminder) {
  operation(async () => {
    const { kind, time, timezone, repeatDays, enabled } = reminder;
    learning.configureReminder(learning.journeyContext(), {
      reminderId: reminder.id,
      kind,
      time,
      timezone,
      repeatDays,
      enabled: !enabled
    });
    return controller.refresh();
  });
}
function allow() {
  operation(() => controller.allow());
}
function check() {
  operation(() => controller.refresh());
}
watch(
  () => `${learning.recordContext()}:${learning.state.revision}`,
  () => {
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      controller.refresh().catch((error) => {
        message.value = typeof error === 'string' ? error : error.message;
        failed.value = true;
      });
    }, 250);
  }
);
onMounted(() => {
  unbind = bindLearningKeyboard(root.value);
  controller.initialize().catch((error) => {
    message.value = typeof error === 'string' ? error : error.message;
    failed.value = true;
  });
});
onUnmounted(() => {
  if (refreshTimer !== null) clearTimeout(refreshTimer);
  unbind();
});
</script>
<style scoped>
.journey-reminders {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--space-line);
}
.reminder-heading,
.reminder-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.reminder-form {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}
.reminder-form label {
  display: grid;
  gap: 8px;
  font-size: 14px;
}
.reminder-form input {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--space-line);
  border-radius: 12px;
}
.reminder-row {
  margin: 16px 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--space-line);
}
.reminder-row > view {
  min-width: 0;
  flex: 1;
  font-size: 16px;
  line-height: 1.75;
}
.reminder-meta {
  display: block;
  font-size: 12px;
  color: var(--space-muted);
  line-height: 1.7;
  margin-top: 8px;
  overflow-wrap: anywhere;
}
.reminder-feedback {
  display: block;
  font-size: 14px;
  line-height: 1.7;
  margin-top: 16px;
}
@media (max-width: 520px) {
  .reminder-heading {
    flex-wrap: wrap;
  }
}
</style>
