<template>
  <BaseCard padding="large" class="profile-draft" data-test="profile-draft">
    <view class="draft-heading"
      ><BaseIcon name="user" /><text>{{ t('tutor.intake.title') }}</text
      ><BaseButton icon-only icon="close" variant="quiet" :label="t('tutor.intake.cancel')" @tap="$emit('cancel')"
    /></view>
    <template v-if="step < fields.length">
      <text class="draft-question">{{ t(`tutor.intake.${field}`) }}</text>
      <view class="draft-options"
        ><BaseChip
          v-for="option in choices[field] || []"
          :key="option"
          :model-value="draft[field] === t(option)"
          @update:model-value="draft[field] = t(option)"
          >{{ t(option) }}</BaseChip
        ></view
      >
      <BaseInput
        v-model="draft[field]"
        :label="t(`tutor.profile.${field}`)"
        :placeholder="t(field === 'deadline' ? 'tutor.intake.date' : 'tutor.intake.free')"
        :maxlength="field === 'deadline' ? 10 : 500"
      />
      <text v-if="invalid" role="alert" class="draft-error">{{
        t(`tutor.intake.${field === 'deadline' ? 'badDate' : 'badMinutes'}`)
      }}</text>
      <view class="draft-actions"
        ><BaseButton
          variant="quiet"
          @tap="
            draft[field] = '';
            step++;
          "
          >{{ t('tutor.intake.skip') }}</BaseButton
        ><BaseButton variant="primary" :disabled="invalid" @tap="step++">{{
          t('tutor.card.nextStep')
        }}</BaseButton></view
      >
    </template>
    <template v-else>
      <text class="draft-question">{{ t('tutor.intake.check') }}</text>
      <view v-for="key in fields" :key="key" class="draft-row"
        ><template v-if="draft[key]?.trim()"
          ><text>{{ t(`tutor.profile.${key}`) }}</text
          ><text>{{ draft[key] }}</text></template
        ></view
      >
      <text class="draft-caption">{{ t('tutor.intake.draft') }}</text>
      <view class="draft-actions"
        ><BaseButton variant="quiet" @tap="step = 0">{{ t('tutor.intake.edit') }}</BaseButton
        ><BaseButton variant="primary" :disabled="busy" @tap="$emit('confirm', { ...draft })">{{
          t('tutor.proposal.confirm')
        }}</BaseButton></view
      >
    </template>
  </BaseCard>
</template>
<script setup>
import '@/i18n/tutor.js';
import { computed, ref } from 'vue';
import { t } from '@/i18n/index.js';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
const props = defineProps({ goal: { type: String, default: '' }, busy: Boolean });
defineEmits(['confirm', 'cancel']);
const fields = ['goal', 'foundation', 'minutes', 'deadline', 'preference'];
const step = ref(0),
  draft = ref({ goal: props.goal, foundation: '', minutes: '', deadline: '', preference: '' });
const field = computed(() => fields[step.value]);
const choices = {
  foundation: ['tutor.intake.beginner', 'tutor.intake.some', 'tutor.intake.review'],
  minutes: ['tutor.intake.ten', 'tutor.intake.twenty', 'tutor.intake.forty'],
  preference: ['tutor.intake.example', 'tutor.intake.practice', 'tutor.intake.visual']
};
const invalid = computed(() => {
  const value = draft.value[field.value]?.trim();
  if (!value) return false;
  if (field.value === 'minutes') return !/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 480;
  if (field.value === 'deadline')
    return (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
    );
  return false;
});
</script>
<style scoped>
.profile-draft {
  max-width: 680px;
  width: 100%;
  margin-block: var(--s-5);
}
.draft-heading,
.draft-actions,
.draft-options {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  flex-wrap: wrap;
}
.draft-heading {
  font-size: var(--size-title-3);
}
.draft-heading .base-button {
  margin-left: auto;
}
.draft-question {
  display: block;
  margin-block: var(--s-5);
  font-size: var(--size-title-3);
}
.draft-options {
  margin-bottom: var(--s-4);
}
.draft-actions {
  justify-content: flex-end;
  margin-top: var(--s-5);
}
.draft-caption {
  display: block;
  color: var(--ink-3);
  margin-top: var(--s-3);
}
.draft-row {
  display: flex;
  justify-content: space-between;
  gap: var(--s-4);
  overflow-wrap: anywhere;
  padding-block: var(--s-2);
}
.draft-error {
  color: var(--error);
}
</style>
