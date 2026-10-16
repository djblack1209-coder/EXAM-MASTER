<template>
  <view v-if="source" class="diagram-conditions">
    <BaseButton
      :aria-expanded="opened"
      :disabled="stopped || busy"
      :aria-disabled="stopped || busy"
      variant="quiet"
      @tap="toggle"
    >
      {{ confirmed ? t('learning.kr8') : t('learning.k3u') }}
    </BaseButton>
    <BaseButton variant="quiet" @tap="previewOriginal">{{ t('learning.kj6') }}</BaseButton>
    <text v-if="confirmed" class="subtle" role="status">{{ t('learning.kj0') }}</text>
    <view v-if="opened" class="diagram-form">
      <text class="diagram-label"
        >{{ t('learning.koc') }}{{ source.binding.page ? t('learning.k4j', { v0: source.binding.page }) : '' }}</text
      >
      <image class="diagram-image" :src="source.image" mode="aspectFit" :aria-label="t('learning.k8h')" />
      <view class="diagram-options" :aria-label="t('learning.kt2')">
        <BaseChip
          v-for="item in templates"
          :key="item.value"
          :class="{ selected: template === item.value }"
          :disabled="stopped || busy"
          :model-value="template === item.value"
          @update:model-value="chooseTemplate(item.value)"
        >
          {{ learningText(item.label) }}
        </BaseChip>
      </view>
      <template v-if="template === 'distance_displacement'">
        <view v-for="field in distanceFields" :key="field.value" class="diagram-field">
          <text class="diagram-label">{{ learningText(field.label) }}</text>
          <view class="diagram-options">
            <BaseButton
              v-for="n in field.choices"
              :key="n"
              :disabled="stopped || busy"
              variant="quiet"
              @tap="set(field.value, String(n))"
            >
              {{ n }}
            </BaseButton>
          </view>
          <BaseInput
            :model-value="draft[field.value]"
            type="number"
            maxlength="5"
            :disabled="stopped || busy"
            :placeholder="t('learning.k9h')"
            :label="field.label"
            @input="set(field.value, $event.target?.value ?? $event.detail?.value ?? '')"
          />
          <view class="diagram-options" :aria-label="t('learning.kge', { v0: learningText(field.label) })">
            <BaseChip
              v-for="unit in ['m', 'cm']"
              :key="unit"
              :disabled="stopped || busy"
              :class="{ selected: draft[field.unit] === unit }"
              :model-value="draft[field.unit] === unit"
              @update:model-value="set(field.unit, unit)"
            >
              {{ unit }}
            </BaseChip>
          </view>
        </view>
      </template>
      <template v-else-if="template === 'velocity_time_graph'">
        <view class="diagram-field">
          <text class="diagram-label">{{ t('learning.k24') }}</text>
          <view class="diagram-options">
            <BaseChip
              v-for="unit in ['s', 'ms']"
              :key="unit"
              :disabled="stopped || busy"
              :class="{ selected: draft.timeUnit === unit }"
              :model-value="draft.timeUnit === unit"
              @update:model-value="set('timeUnit', unit)"
            >
              {{ unit }}
            </BaseChip>
          </view>
          <text class="diagram-label">{{ t('learning.kk2') }}</text>
          <view class="diagram-options">
            <BaseChip
              v-for="unit in ['m/s', 'cm/s']"
              :key="unit"
              :disabled="stopped || busy"
              :class="{ selected: draft.velocityUnit === unit }"
              :model-value="draft.velocityUnit === unit"
              @update:model-value="set('velocityUnit', unit)"
            >
              {{ unit }}
            </BaseChip>
          </view>
          <text class="diagram-label">{{ t('learning.kiz') }}</text>
          <view class="diagram-options">
            <BaseChip
              v-for="item in [
                { value: 'right', label: '向右' },
                { value: 'left', label: '向左' },
                { value: 'unknown', label: '无法确定' }
              ]"
              :key="item.value"
              :disabled="stopped || busy"
              :class="{ selected: draft.positiveDirection === item.value }"
              :model-value="draft.positiveDirection === item.value"
              @update:model-value="set('positiveDirection', item.value)"
            >
              {{ learningText(item.label) }}
            </BaseChip>
          </view>
          <text class="diagram-label">{{ t('learning.kdy') }}</text>
          <view class="diagram-options">
            <BaseChip
              v-for="item in [
                { value: 'linear', label: '直线' },
                { value: 'curve', label: '曲线' },
                { value: 'unknown', label: '无法确定' }
              ]"
              :key="item.value"
              :disabled="stopped || busy"
              :class="{ selected: draft.lineKind === item.value }"
              :model-value="draft.lineKind === item.value"
              @update:model-value="set('lineKind', item.value)"
            >
              {{ learningText(item.label) }}
            </BaseChip>
          </view>
        </view>
        <view v-for="(point, index) in draft.points" :key="index" class="diagram-field">
          <text class="diagram-label">{{ t('learning.kb3') }}{{ index + 1 }}</text>
          <text class="diagram-label">{{ t('learning.kgr') }}</text>
          <view class="diagram-options">
            <BaseButton
              v-for="n in [0, 1, 2, 3, 5, 8]"
              :key="n"
              :disabled="stopped || busy"
              variant="quiet"
              @tap="setPoint(index, 'time', String(n))"
            >
              {{ n }}
            </BaseButton>
          </view>
          <BaseInput
            :model-value="point.time"
            type="digit"
            maxlength="8"
            :disabled="stopped || busy"
            :placeholder="t('learning.kgr')"
            :label="t('learning.kr1', { v0: index + 1 })"
            @input="setPoint(index, 'time', $event.target?.value ?? $event.detail?.value ?? '')"
          />
          <text class="diagram-label">{{ t('learning.kog') }}</text>
          <view class="diagram-options">
            <BaseButton
              v-for="n in [-2, -1, 0, 1, 2]"
              :key="n"
              :disabled="stopped || busy"
              variant="quiet"
              @tap="setPoint(index, 'velocity', String(n))"
            >
              {{ n }}
            </BaseButton>
          </view>
          <BaseInput
            :model-value="point.velocity"
            type="text"
            maxlength="8"
            :disabled="stopped || busy"
            :placeholder="t('learning.k20')"
            :label="t('learning.kr', { v0: index + 1 })"
            @input="setPoint(index, 'velocity', $event.target?.value ?? $event.detail?.value ?? '')"
          />
        </view>
        <view class="diagram-options">
          <BaseButton
            v-if="draft.points.length < 4"
            :disabled="stopped || busy"
            variant="quiet"
            @tap="changePoints(true)"
            >{{ t('learning.kin') }}</BaseButton
          >
          <BaseButton
            v-if="draft.points.length > 2"
            :disabled="stopped || busy"
            variant="quiet"
            @tap="changePoints(false)"
            >{{ t('learning.k9v') }}</BaseButton
          >
        </view>
      </template>
      <template v-else>
        <view class="diagram-field">
          <text class="diagram-label">{{ t('learning.kg1') }}</text>
          <view class="diagram-options">
            <BaseButton
              v-for="n in [1, 2, 4, 10]"
              :key="n"
              :disabled="stopped || busy"
              variant="quiet"
              @tap="set('massKg', String(n))"
            >
              {{ n }}
            </BaseButton>
          </view>
          <BaseInput
            :model-value="draft.massKg"
            :type="motionTemplate ? 'digit' : 'number'"
            :maxlength="motionTemplate ? 8 : 5"
            :disabled="stopped || busy"
            :placeholder="t('learning.k9h')"
            :label="t('learning.k37')"
            @input="set('massKg', $event.target?.value ?? $event.detail?.value ?? '')"
          />
          <view class="diagram-options" :aria-label="t('learning.kg8')">
            <BaseChip
              v-for="unit in ['kg', 'g']"
              :key="unit"
              :disabled="stopped || busy"
              :class="{ selected: draft.massUnit === unit }"
              :model-value="draft.massUnit === unit"
              @update:model-value="set('massUnit', unit)"
            >
              {{ unit }}
            </BaseChip>
          </view>
        </view>
        <view v-if="template !== 'changing_net_force'" class="diagram-field">
          <text class="diagram-label">{{ t('learning.k96') }}</text>
          <view class="diagram-options">
            <BaseButton
              v-for="n in [0, 2, 4, 8]"
              :key="n"
              :disabled="stopped || busy"
              variant="quiet"
              @tap="set('netForceN', String(n))"
            >
              {{ n }}
            </BaseButton>
            <BaseChip
              :disabled="stopped || busy"
              :class="{ selected: draft.forceUnit === 'N' }"
              :model-value="draft.forceUnit === 'N'"
              @update:model-value="set('forceUnit', 'N')"
            >
              N
            </BaseChip>
          </view>
          <BaseInput
            :model-value="draft.netForceN"
            :type="motionTemplate ? 'digit' : 'number'"
            :maxlength="motionTemplate ? 8 : 5"
            :disabled="stopped || busy"
            :placeholder="t('learning.k9h')"
            :label="t('learning.k9l')"
            @input="set('netForceN', $event.target?.value ?? $event.detail?.value ?? '')"
          />
        </view>
        <view class="diagram-field">
          <text class="diagram-label">{{ t('learning.kjs') }}</text>
          <view class="diagram-options">
            <BaseChip
              v-for="item in initialStates"
              :key="item.value"
              :disabled="stopped || busy"
              :class="{ selected: draft.initialState === item.value }"
              :model-value="draft.initialState === item.value"
              @update:model-value="set('initialState', item.value)"
            >
              {{ learningText(item.label) }}
            </BaseChip>
          </view>
          <text class="diagram-label">{{ t('learning.kjv') }}</text>
          <view class="diagram-options">
            <BaseChip
              v-for="item in forces"
              :key="item.value"
              :disabled="stopped || busy"
              :class="{ selected: draft.forceKind === item.value }"
              :model-value="draft.forceKind === item.value"
              @update:model-value="set('forceKind', item.value)"
            >
              {{ learningText(item.label) }}
            </BaseChip>
          </view>
        </view>
        <template v-if="motionTemplate">
          <template v-if="template === 'work_kinetic_energy'">
            <text class="diagram-label">{{ t('learning.k31') }}</text>
            <view class="diagram-options" :aria-label="t('learning.k31')">
              <BaseChip
                v-for="item in [
                  { value: 'particle', label: '可视为质点' },
                  { value: 'other', label: '转动或形变' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                :disabled="stopped || busy"
                :class="{ selected: draft.bodyKind === item.value }"
                :model-value="draft.bodyKind === item.value"
                @update:model-value="set('bodyKind', item.value)"
              >
                {{ learningText(item.label) }}
              </BaseChip>
            </view>
            <text class="diagram-label">{{ t('learning.ksi') }}</text>
            <view class="diagram-options" :aria-label="t('learning.ksi')">
              <BaseChip
                v-for="item in [
                  { value: 'inertial', label: '惯性系' },
                  { value: 'other', label: '加速参考系' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                :disabled="stopped || busy"
                :class="{ selected: draft.frameKind === item.value }"
                :model-value="draft.frameKind === item.value"
                @update:model-value="set('frameKind', item.value)"
              >
                {{ learningText(item.label) }}
              </BaseChip>
            </view>
            <text class="diagram-label">{{ t('learning.kg1') }}</text>
            <view class="diagram-options" :aria-label="t('learning.kcm')">
              <BaseChip
                v-for="item in [
                  { value: 'constant', label: '不变' },
                  { value: 'changing', label: '变化' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                :disabled="stopped || busy"
                :class="{ selected: draft.massKind === item.value }"
                :model-value="draft.massKind === item.value"
                @update:model-value="set('massKind', item.value)"
              >
                {{ learningText(item.label) }}
              </BaseChip>
            </view>
            <text class="diagram-label">{{ t('learning.k73') }}</text>
            <view class="diagram-options" :aria-label="t('learning.k73')">
              <BaseChip
                v-for="item in [
                  { value: 'linear', label: '直线' },
                  { value: 'multidimensional', label: '多维' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                :disabled="stopped || busy"
                :class="{ selected: draft.motionKind === item.value }"
                :model-value="draft.motionKind === item.value"
                @update:model-value="set('motionKind', item.value)"
              >
                {{ learningText(item.label) }}
              </BaseChip>
            </view>
          </template>
          <view v-if="draft.initialState !== 'rest'" class="diagram-field">
            <text class="diagram-label">{{ t('learning.kuz') }}</text>
            <view class="diagram-options">
              <BaseButton
                v-for="n in [0.5, 1, 2, 4]"
                :key="n"
                :disabled="stopped || busy"
                variant="quiet"
                @tap="set('initialVelocityMps', String(n))"
              >
                {{ n }}
              </BaseButton>
            </view>
            <BaseInput
              :model-value="draft.initialVelocityMps"
              type="digit"
              maxlength="8"
              :disabled="stopped || busy"
              :placeholder="t('learning.k9h')"
              :label="t('learning.kuz')"
              @input="set('initialVelocityMps', $event.target?.value ?? $event.detail?.value ?? '')"
            />
            <view class="diagram-options" :aria-label="t('learning.knn')">
              <BaseChip
                v-for="unit in ['m/s', 'cm/s']"
                :key="unit"
                :disabled="stopped || busy"
                :class="{ selected: draft.velocityUnit === unit }"
                :model-value="draft.velocityUnit === unit"
                @update:model-value="set('velocityUnit', unit)"
              >
                {{ unit }}
              </BaseChip>
            </view>
            <view class="diagram-options" :aria-label="t('learning.koa')">
              <BaseChip
                v-for="item in [
                  { value: 'left', label: '向左' },
                  { value: 'right', label: '向右' }
                ]"
                :key="item.value"
                :disabled="stopped || busy"
                :class="{ selected: draft.velocityDirection === item.value }"
                :model-value="draft.velocityDirection === item.value"
                @update:model-value="set('velocityDirection', item.value)"
              >
                {{ learningText(item.label) }}
              </BaseChip>
            </view>
          </view>
          <view v-if="['accelerated_motion', 'work_kinetic_energy'].includes(template)" class="diagram-field">
            <text class="diagram-label">{{ t('learning.kck') }}</text>
            <view class="diagram-options">
              <BaseButton
                v-for="n in [2, 4, 6, 10]"
                :key="n"
                :disabled="stopped || busy"
                variant="quiet"
                @tap="set('physicalSeconds', String(n))"
              >
                {{ n }}
              </BaseButton>
              <BaseChip
                :disabled="stopped || busy"
                :class="{ selected: draft.timeUnit === 's' }"
                :model-value="draft.timeUnit === 's'"
                @update:model-value="set('timeUnit', 's')"
              >
                s
              </BaseChip>
            </view>
            <BaseInput
              :model-value="draft.physicalSeconds"
              type="number"
              maxlength="2"
              :disabled="stopped || busy"
              :placeholder="t('learning.k9h')"
              :label="t('learning.kck')"
              @input="set('physicalSeconds', $event.target?.value ?? $event.detail?.value ?? '')"
            />
          </view>
          <template v-if="template === 'changing_net_force'">
            <view v-for="(segment, index) in draft.segments" :key="index" class="diagram-field">
              <text class="diagram-label">{{ t('learning.kq6') }}{{ index + 1 }}{{ t('learning.knv') }}</text>
              <view class="diagram-options">
                <BaseButton
                  v-for="n in [1, 2, 3]"
                  :key="n"
                  :disabled="stopped || busy"
                  variant="quiet"
                  @tap="setSegment(index, 'seconds', String(n))"
                >
                  {{ n }}{{ t('learning.kss') }}</BaseButton
                >
                <BaseChip
                  :disabled="stopped || busy"
                  :class="{ selected: segment.timeUnit === 's' }"
                  :model-value="segment.timeUnit === 's'"
                  @update:model-value="setSegment(index, 'timeUnit', 's')"
                >
                  s
                </BaseChip>
              </view>
              <BaseInput
                :model-value="segment.seconds"
                type="number"
                maxlength="2"
                :disabled="stopped || busy"
                :placeholder="t('learning.kck')"
                :label="t('learning.k6z', { v0: index + 1 })"
                @input="setSegment(index, 'seconds', $event.target?.value ?? $event.detail?.value ?? '')"
              />
              <view class="diagram-options">
                <BaseButton
                  v-for="n in [0, 0.5, 1, 2]"
                  :key="n"
                  :disabled="stopped || busy"
                  variant="quiet"
                  @tap="setSegment(index, 'netForceN', String(n))"
                >
                  {{ n }}
                </BaseButton>
                <BaseChip
                  :disabled="stopped || busy"
                  :class="{ selected: segment.forceUnit === 'N' }"
                  :model-value="segment.forceUnit === 'N'"
                  @update:model-value="setSegment(index, 'forceUnit', 'N')"
                >
                  N
                </BaseChip>
              </view>
              <BaseInput
                :model-value="segment.netForceN"
                type="digit"
                maxlength="8"
                :disabled="stopped || busy"
                :placeholder="t('learning.k96')"
                :label="t('learning.kjw', { v0: index + 1 })"
                @input="setSegment(index, 'netForceN', $event.target?.value ?? $event.detail?.value ?? '')"
              />
              <view class="diagram-options" :aria-label="t('learning.kvg', { v0: index + 1 })">
                <BaseChip
                  v-for="item in segment.netForceN === '0'
                    ? [{ value: 'none', label: '无方向' }]
                    : [
                        { value: 'left', label: '向左' },
                        { value: 'right', label: '向右' }
                      ]"
                  :key="item.value"
                  :disabled="stopped || busy"
                  :class="{ selected: segment.direction === item.value }"
                  :model-value="segment.direction === item.value"
                  @update:model-value="setSegment(index, 'direction', item.value)"
                >
                  {{ learningText(item.label) }}
                </BaseChip>
              </view>
            </view>
            <BaseButton :disabled="stopped || busy" variant="quiet" @tap="changeSegments">
              {{ draft.segments.length === 2 ? t('learning.k3i') : t('learning.kld') }}
            </BaseButton>
          </template>
        </template>
      </template>
      <text v-if="!['changing_net_force', 'velocity_time_graph'].includes(template)" class="diagram-label">{{
        template === 'distance_displacement' ? t('learning.kt') : t('learning.kc9')
      }}</text>
      <view v-if="!['changing_net_force', 'velocity_time_graph'].includes(template)" class="diagram-options">
        <BaseChip
          v-for="item in directions"
          :key="item.value"
          :disabled="stopped || busy"
          :class="{ selected: draft.direction === item.value }"
          :model-value="draft.direction === item.value"
          @update:model-value="set('direction', item.value)"
        >
          {{ learningText(item.label) }}
        </BaseChip>
      </view>
      <BaseEmpty v-if="error" state="error" :title="learningText(error)" mascot-size="small" />
      <BaseButton
        class="primary"
        :disabled="stopped || busy"
        :aria-disabled="stopped || busy"
        variant="primary"
        @tap="confirm"
        >{{ t('learning.ka7') }}</BaseButton
      >
    </view>
  </view>
</template>
<script setup>
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { learningText } from '@/i18n/learning.js';
import { t } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';

import { computed, ref, watch, nextTick, onUnmounted } from 'vue';
import { sourceDiagram, confirmedDiagramRecipe } from '../../../../laf-backend/functions/_shared/learning-diagram.js';
const props = defineProps({
  state: { type: Object, required: true },
  question: { type: Object, default: null },
  conversationId: { type: String, default: null },
  context: { type: String, default: '' },
  stopped: Boolean,
  busy: Boolean,
  recordHelp: { type: Function, default: null },
  resetKey: { type: Number, default: 0 }
});
const emit = defineEmits(['confirm', 'invalidate', 'editing', 'reading']);
const source = computed(() => sourceDiagram(props.state, props.question, props.conversationId));
const opened = ref(false),
  confirmed = ref(false),
  error = ref(''),
  template = ref('distance_displacement');
const emptySegment = () => ({ seconds: '', timeUnit: '', netForceN: '', forceUnit: '', direction: '' });
const emptyDraft = () => ({
  outward: '',
  backward: '',
  outwardUnit: '',
  backwardUnit: '',
  massKg: '',
  massUnit: '',
  netForceN: '',
  forceUnit: '',
  initialState: '',
  forceKind: '',
  massKind: '',
  motionKind: '',
  bodyKind: '',
  frameKind: '',
  direction: '',
  initialVelocityMps: '',
  velocityUnit: '',
  velocityDirection: '',
  physicalSeconds: '',
  timeUnit: '',
  segments: [emptySegment(), emptySegment()],
  points: [
    { time: '', velocity: '' },
    { time: '', velocity: '' }
  ],
  positiveDirection: '',
  lineKind: ''
});
const draft = ref(emptyDraft());
const templates = [
  { value: 'distance_displacement', label: '路程与位移' },
  { value: 'constant_net_force', label: '合力与加速度' },
  { value: 'accelerated_motion', label: '初速度与转向' },
  { value: 'changing_net_force', label: '分段合力' },
  { value: 'velocity_time_graph', label: '速度—时间图' },
  { value: 'work_kinetic_energy', label: '功与动能' }
];
const motionTemplate = computed(() =>
  ['accelerated_motion', 'changing_net_force', 'work_kinetic_energy'].includes(template.value)
);
const distanceFields = [
  { value: 'outward', unit: 'outwardUnit', label: '去程距离', choices: [2, 4, 6, 8] },
  { value: 'backward', unit: 'backwardUnit', label: '回程距离', choices: [0, 2, 4, 6] }
];
const initialStates = [
  { value: 'rest', label: '静止' },
  { value: 'moving', label: '已有速度' },
  { value: 'unknown', label: '无法确定' }
];
const forces = computed(() => [
  { value: 'net_constant', label: '恒定合力' },
  ...(template.value === 'changing_net_force' ? [{ value: 'net_segments', label: '分段恒定合力' }] : []),
  { value: 'applied', label: '单个推力' },
  { value: 'unknown', label: '无法确定' }
]);
const directions = computed(() =>
  template.value !== 'distance_displacement' && draft.value.netForceN === '0'
    ? [{ value: 'none', label: '无方向' }]
    : [
        { value: 'left', label: '向左' },
        { value: 'right', label: '向右' }
      ]
);
let ownsPreview = false,
  previewSequence = 0;
function closeOriginal() {
  if (!ownsPreview) return;
  ownsPreview = false;
  const sequence = previewSequence;
  const close = () => {
    if (typeof uni.closePreviewImage === 'function')
      uni.closePreviewImage({
        fail: () => {
          // 已关闭的自有查看无需再次处理。
        }
      });
  };
  close();
  nextTick(() => {
    if (previewSequence === sequence && !ownsPreview) close();
  });
}
function previewOriginal() {
  if (!source.value) return;
  emit('reading');
  if (typeof uni.previewImage !== 'function') {
    error.value = '原图查看暂不可用，请在资料中查看';
    return;
  }
  ownsPreview = true;
  previewSequence++;
  uni.previewImage({
    urls: [source.value.image],
    current: source.value.image,
    fail: () => {
      ownsPreview = false;
      error.value = '原图未能打开，请重试';
    }
  });
}
function invalidate() {
  confirmed.value = false;
  error.value = '';
  emit('invalidate');
}
function release() {
  closeOriginal();
  invalidate();
  opened.value = false;
  draft.value = emptyDraft();
}
function toggle() {
  if (props.stopped || props.busy) return;
  opened.value = !opened.value;
  if (opened.value) invalidate();
}
function set(key, value) {
  if (props.stopped || props.busy) return;
  invalidate();
  draft.value[key] = value;
  if (key === 'initialState' && motionTemplate.value) {
    draft.value.initialVelocityMps = value === 'rest' ? '0' : '';
    draft.value.velocityUnit = value === 'rest' ? 'm/s' : '';
    draft.value.velocityDirection = value === 'rest' ? 'none' : '';
  }
  if (key === 'netForceN' && (value === '0' || draft.value.direction === 'none')) draft.value.direction = '';
}
function setSegment(index, key, value) {
  if (props.stopped || props.busy) return;
  invalidate();
  draft.value.segments[index][key] = value;
  if (key === 'netForceN' && (value === '0' || draft.value.segments[index].direction === 'none'))
    draft.value.segments[index].direction = '';
}
function setPoint(index, key, value) {
  if (props.stopped || props.busy) return;
  invalidate();
  draft.value.points[index][key] = value;
}
function changePoints(add) {
  if (props.stopped || props.busy) return;
  invalidate();
  if (add && draft.value.points.length < 4) draft.value.points.push({ time: '', velocity: '' });
  else if (!add && draft.value.points.length > 2) draft.value.points.pop();
}
function changeSegments() {
  if (props.stopped || props.busy) return;
  invalidate();
  if (draft.value.segments.length === 2) draft.value.segments.push(emptySegment());
  else draft.value.segments.pop();
}
function chooseTemplate(value) {
  if (props.stopped || props.busy) return;
  invalidate();
  template.value = value;
  draft.value = emptyDraft();
}
function confirm() {
  if (!opened.value || props.stopped || props.busy || !source.value) return;
  const fields =
    template.value === 'velocity_time_graph'
      ? ['points', 'timeUnit', 'velocityUnit', 'positiveDirection', 'lineKind']
      : motionTemplate.value
        ? [
            'massKg',
            'massUnit',
            'initialVelocityMps',
            'velocityUnit',
            'velocityDirection',
            'initialState',
            'forceKind',
            ...(template.value === 'work_kinetic_energy' ? ['massKind', 'motionKind', 'bodyKind', 'frameKind'] : []),
            ...(['accelerated_motion', 'work_kinetic_energy'].includes(template.value)
              ? ['netForceN', 'forceUnit', 'direction', 'physicalSeconds', 'timeUnit']
              : ['segments'])
          ]
        : template.value === 'constant_net_force'
          ? ['massKg', 'massUnit', 'netForceN', 'forceUnit', 'direction', 'initialState', 'forceKind']
          : ['outward', 'outwardUnit', 'backward', 'backwardUnit', 'direction'];
  const input = {
    explicit: true,
    binding: source.value.binding,
    sourceSnapshot: { stamp: source.value.stamp, image: source.value.image },
    template: template.value,
    ...Object.fromEntries(fields.map((k) => [k, draft.value[k]]))
  };
  try {
    const recipe = confirmedDiagramRecipe(input, source.value);
    if (!props.recordHelp || props.recordHelp(props.context, input) !== true) throw Error('演示帮助未保存，请重试');
    confirmed.value = true;
    opened.value = false;
    error.value = '';
    emit('confirm', recipe);
  } catch (e) {
    error.value = e.message;
  }
}
watch([() => props.context, () => source.value?.stamp, () => source.value?.image, () => props.resetKey], release, {
  flush: 'sync'
});
watch(opened, (value) => emit('editing', value), { flush: 'sync' });
onUnmounted(closeOriginal);
</script>
<style scoped>
.diagram-conditions,
.diagram-form,
.diagram-field {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.diagram-conditions {
  border-top: var(--border-thin) solid var(--line);
  padding-top: var(--s-3);
}
.diagram-image {
  width: 100%;
  height: var(--mascot-large);
  border-radius: var(--s-3);
  background: var(--paper);
}
.diagram-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.diagram-label {
  font-size: var(--size-small);
  font-weight: var(--weight-ui-emphasis);
}
</style>
