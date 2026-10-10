<template>
  <view v-if="source" class="diagram-conditions">
    <button
      role="button"
      tabindex="0"
      :aria-expanded="opened"
      :disabled="stopped || busy"
      :aria-disabled="stopped || busy"
      @tap="toggle"
    >
      {{ confirmed ? '修改原图条件' : '按原图演示' }}
    </button>
    <button role="button" tabindex="0" @tap="previewOriginal">查看原图</button>
    <text v-if="confirmed" class="subtle" role="status">原图条件已确认</text>
    <view v-if="opened" class="diagram-form">
      <text class="diagram-label">原图{{ source.binding.page ? ` · 第${source.binding.page}页` : '' }}</text>
      <image class="diagram-image" :src="source.image" mode="aspectFit" aria-label="当前题目的原页图" />
      <view class="diagram-options" aria-label="演示概念">
        <button
          v-for="item in templates"
          :key="item.value"
          role="button"
          tabindex="0"
          :aria-pressed="template === item.value"
          :class="{ selected: template === item.value }"
          :disabled="stopped || busy"
          @tap="chooseTemplate(item.value)"
        >
          {{ item.label }}
        </button>
      </view>
      <template v-if="template === 'distance_displacement'">
        <view v-for="field in distanceFields" :key="field.value" class="diagram-field">
          <text class="diagram-label">{{ field.label }}</text>
          <view class="diagram-options">
            <button
              v-for="n in field.choices"
              :key="n"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              @tap="set(field.value, String(n))"
            >
              {{ n }}
            </button>
          </view>
          <input
            :value="draft[field.value]"
            type="number"
            maxlength="5"
            :aria-label="field.label"
            :disabled="stopped || busy"
            placeholder="数值"
            @input="set(field.value, $event.target?.value ?? $event.detail?.value ?? '')"
          />
          <view class="diagram-options" :aria-label="`${field.label}单位`">
            <button
              v-for="unit in ['m', 'cm']"
              :key="unit"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft[field.unit] === unit"
              :class="{ selected: draft[field.unit] === unit }"
              @tap="set(field.unit, unit)"
            >
              {{ unit }}
            </button>
          </view>
        </view>
      </template>
      <template v-else-if="template === 'velocity_time_graph'">
        <view class="diagram-field">
          <text class="diagram-label">时间单位</text>
          <view class="diagram-options">
            <button
              v-for="unit in ['s', 'ms']"
              :key="unit"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.timeUnit === unit"
              :class="{ selected: draft.timeUnit === unit }"
              @tap="set('timeUnit', unit)"
            >
              {{ unit }}
            </button>
          </view>
          <text class="diagram-label">速度单位</text>
          <view class="diagram-options">
            <button
              v-for="unit in ['m/s', 'cm/s']"
              :key="unit"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.velocityUnit === unit"
              :class="{ selected: draft.velocityUnit === unit }"
              @tap="set('velocityUnit', unit)"
            >
              {{ unit }}
            </button>
          </view>
          <text class="diagram-label">速度正方向</text>
          <view class="diagram-options">
            <button
              v-for="item in [
                { value: 'right', label: '向右' },
                { value: 'left', label: '向左' },
                { value: 'unknown', label: '无法确定' }
              ]"
              :key="item.value"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.positiveDirection === item.value"
              :class="{ selected: draft.positiveDirection === item.value }"
              @tap="set('positiveDirection', item.value)"
            >
              {{ item.label }}
            </button>
          </view>
          <text class="diagram-label">折点之间</text>
          <view class="diagram-options">
            <button
              v-for="item in [
                { value: 'linear', label: '直线' },
                { value: 'curve', label: '曲线' },
                { value: 'unknown', label: '无法确定' }
              ]"
              :key="item.value"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.lineKind === item.value"
              :class="{ selected: draft.lineKind === item.value }"
              @tap="set('lineKind', item.value)"
            >
              {{ item.label }}
            </button>
          </view>
        </view>
        <view v-for="(point, index) in draft.points" :key="index" class="diagram-field">
          <text class="diagram-label">折点 {{ index + 1 }}</text>
          <text class="diagram-label">时间</text>
          <view class="diagram-options">
            <button
              v-for="n in [0, 1, 2, 3, 5, 8]"
              :key="n"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              @tap="setPoint(index, 'time', String(n))"
            >
              {{ n }}
            </button>
          </view>
          <input
            :value="point.time"
            type="digit"
            maxlength="8"
            :aria-label="`折点${index + 1}时间`"
            :disabled="stopped || busy"
            placeholder="时间"
            @input="setPoint(index, 'time', $event.target?.value ?? $event.detail?.value ?? '')"
          />
          <text class="diagram-label">带符号速度</text>
          <view class="diagram-options">
            <button
              v-for="n in [-2, -1, 0, 1, 2]"
              :key="n"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              @tap="setPoint(index, 'velocity', String(n))"
            >
              {{ n }}
            </button>
          </view>
          <input
            :value="point.velocity"
            type="text"
            maxlength="8"
            :aria-label="`折点${index + 1}速度`"
            :disabled="stopped || busy"
            placeholder="速度，保留正负号"
            @input="setPoint(index, 'velocity', $event.target?.value ?? $event.detail?.value ?? '')"
          />
        </view>
        <view class="diagram-options">
          <button
            v-if="draft.points.length < 4"
            role="button"
            tabindex="0"
            :disabled="stopped || busy"
            @tap="changePoints(true)"
          >
            添加折点
          </button>
          <button
            v-if="draft.points.length > 2"
            role="button"
            tabindex="0"
            :disabled="stopped || busy"
            @tap="changePoints(false)"
          >
            移除末折点
          </button>
        </view>
      </template>
      <template v-else>
        <view class="diagram-field">
          <text class="diagram-label">质量</text>
          <view class="diagram-options">
            <button
              v-for="n in [1, 2, 4, 10]"
              :key="n"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              @tap="set('massKg', String(n))"
            >
              {{ n }}
            </button>
          </view>
          <input
            :value="draft.massKg"
            :type="motionTemplate ? 'digit' : 'number'"
            :maxlength="motionTemplate ? 8 : 5"
            aria-label="原图质量"
            :disabled="stopped || busy"
            placeholder="数值"
            @input="set('massKg', $event.target?.value ?? $event.detail?.value ?? '')"
          />
          <view class="diagram-options" aria-label="质量单位">
            <button
              v-for="unit in ['kg', 'g']"
              :key="unit"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.massUnit === unit"
              :class="{ selected: draft.massUnit === unit }"
              @tap="set('massUnit', unit)"
            >
              {{ unit }}
            </button>
          </view>
        </view>
        <view v-if="template !== 'changing_net_force'" class="diagram-field">
          <text class="diagram-label">合力</text>
          <view class="diagram-options">
            <button
              v-for="n in [0, 2, 4, 8]"
              :key="n"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              @tap="set('netForceN', String(n))"
            >
              {{ n }}
            </button>
            <button
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.forceUnit === 'N'"
              :class="{ selected: draft.forceUnit === 'N' }"
              @tap="set('forceUnit', 'N')"
            >
              N
            </button>
          </view>
          <input
            :value="draft.netForceN"
            :type="motionTemplate ? 'digit' : 'number'"
            :maxlength="motionTemplate ? 8 : 5"
            aria-label="原图合力"
            :disabled="stopped || busy"
            placeholder="数值"
            @input="set('netForceN', $event.target?.value ?? $event.detail?.value ?? '')"
          />
        </view>
        <view class="diagram-field">
          <text class="diagram-label">初始状态</text>
          <view class="diagram-options">
            <button
              v-for="item in initialStates"
              :key="item.value"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.initialState === item.value"
              :class="{ selected: draft.initialState === item.value }"
              @tap="set('initialState', item.value)"
            >
              {{ item.label }}
            </button>
          </view>
          <text class="diagram-label">力的条件</text>
          <view class="diagram-options">
            <button
              v-for="item in forces"
              :key="item.value"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-pressed="draft.forceKind === item.value"
              :class="{ selected: draft.forceKind === item.value }"
              @tap="set('forceKind', item.value)"
            >
              {{ item.label }}
            </button>
          </view>
        </view>
        <template v-if="motionTemplate">
          <template v-if="template === 'work_kinetic_energy'">
            <text class="diagram-label">物体模型</text>
            <view class="diagram-options" aria-label="物体模型">
              <button
                v-for="item in [
                  { value: 'particle', label: '可视为质点' },
                  { value: 'other', label: '转动或形变' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-pressed="draft.bodyKind === item.value"
                :class="{ selected: draft.bodyKind === item.value }"
                @tap="set('bodyKind', item.value)"
              >
                {{ item.label }}
              </button>
            </view>
            <text class="diagram-label">参考系</text>
            <view class="diagram-options" aria-label="参考系">
              <button
                v-for="item in [
                  { value: 'inertial', label: '惯性系' },
                  { value: 'other', label: '加速参考系' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-pressed="draft.frameKind === item.value"
                :class="{ selected: draft.frameKind === item.value }"
                @tap="set('frameKind', item.value)"
              >
                {{ item.label }}
              </button>
            </view>
            <text class="diagram-label">质量</text>
            <view class="diagram-options" aria-label="质量条件">
              <button
                v-for="item in [
                  { value: 'constant', label: '不变' },
                  { value: 'changing', label: '变化' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-pressed="draft.massKind === item.value"
                :class="{ selected: draft.massKind === item.value }"
                @tap="set('massKind', item.value)"
              >
                {{ item.label }}
              </button>
            </view>
            <text class="diagram-label">运动范围</text>
            <view class="diagram-options" aria-label="运动范围">
              <button
                v-for="item in [
                  { value: 'linear', label: '直线' },
                  { value: 'multidimensional', label: '多维' },
                  { value: 'unknown', label: '无法确定' }
                ]"
                :key="item.value"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-pressed="draft.motionKind === item.value"
                :class="{ selected: draft.motionKind === item.value }"
                @tap="set('motionKind', item.value)"
              >
                {{ item.label }}
              </button>
            </view>
          </template>
          <view v-if="draft.initialState !== 'rest'" class="diagram-field">
            <text class="diagram-label">初速度大小</text>
            <view class="diagram-options">
              <button
                v-for="n in [0.5, 1, 2, 4]"
                :key="n"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                @tap="set('initialVelocityMps', String(n))"
              >
                {{ n }}
              </button>
            </view>
            <input
              :value="draft.initialVelocityMps"
              type="digit"
              maxlength="8"
              aria-label="初速度大小"
              :disabled="stopped || busy"
              placeholder="数值"
              @input="set('initialVelocityMps', $event.target?.value ?? $event.detail?.value ?? '')"
            />
            <view class="diagram-options" aria-label="初速度单位">
              <button
                v-for="unit in ['m/s', 'cm/s']"
                :key="unit"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-pressed="draft.velocityUnit === unit"
                :class="{ selected: draft.velocityUnit === unit }"
                @tap="set('velocityUnit', unit)"
              >
                {{ unit }}
              </button>
            </view>
            <view class="diagram-options" aria-label="初速度方向">
              <button
                v-for="item in [
                  { value: 'left', label: '向左' },
                  { value: 'right', label: '向右' }
                ]"
                :key="item.value"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-pressed="draft.velocityDirection === item.value"
                :class="{ selected: draft.velocityDirection === item.value }"
                @tap="set('velocityDirection', item.value)"
              >
                {{ item.label }}
              </button>
            </view>
          </view>
          <view v-if="['accelerated_motion', 'work_kinetic_energy'].includes(template)" class="diagram-field">
            <text class="diagram-label">持续时间</text>
            <view class="diagram-options">
              <button
                v-for="n in [2, 4, 6, 10]"
                :key="n"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                @tap="set('physicalSeconds', String(n))"
              >
                {{ n }}
              </button>
              <button
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-pressed="draft.timeUnit === 's'"
                :class="{ selected: draft.timeUnit === 's' }"
                @tap="set('timeUnit', 's')"
              >
                s
              </button>
            </view>
            <input
              :value="draft.physicalSeconds"
              type="number"
              maxlength="2"
              aria-label="持续时间"
              :disabled="stopped || busy"
              placeholder="数值"
              @input="set('physicalSeconds', $event.target?.value ?? $event.detail?.value ?? '')"
            />
          </view>
          <template v-if="template === 'changing_net_force'">
            <view v-for="(segment, index) in draft.segments" :key="index" class="diagram-field">
              <text class="diagram-label">第{{ index + 1 }}段</text>
              <view class="diagram-options">
                <button
                  v-for="n in [1, 2, 3]"
                  :key="n"
                  role="button"
                  tabindex="0"
                  :disabled="stopped || busy"
                  @tap="setSegment(index, 'seconds', String(n))"
                >
                  {{ n }}秒
                </button>
                <button
                  role="button"
                  tabindex="0"
                  :disabled="stopped || busy"
                  :aria-pressed="segment.timeUnit === 's'"
                  :class="{ selected: segment.timeUnit === 's' }"
                  @tap="setSegment(index, 'timeUnit', 's')"
                >
                  s
                </button>
              </view>
              <input
                :value="segment.seconds"
                type="number"
                maxlength="2"
                :aria-label="`第${index + 1}段持续时间`"
                :disabled="stopped || busy"
                placeholder="持续时间"
                @input="setSegment(index, 'seconds', $event.target?.value ?? $event.detail?.value ?? '')"
              />
              <view class="diagram-options">
                <button
                  v-for="n in [0, 0.5, 1, 2]"
                  :key="n"
                  role="button"
                  tabindex="0"
                  :disabled="stopped || busy"
                  @tap="setSegment(index, 'netForceN', String(n))"
                >
                  {{ n }}
                </button>
                <button
                  role="button"
                  tabindex="0"
                  :disabled="stopped || busy"
                  :aria-pressed="segment.forceUnit === 'N'"
                  :class="{ selected: segment.forceUnit === 'N' }"
                  @tap="setSegment(index, 'forceUnit', 'N')"
                >
                  N
                </button>
              </view>
              <input
                :value="segment.netForceN"
                type="digit"
                maxlength="8"
                :aria-label="`第${index + 1}段合力`"
                :disabled="stopped || busy"
                placeholder="合力"
                @input="setSegment(index, 'netForceN', $event.target?.value ?? $event.detail?.value ?? '')"
              />
              <view class="diagram-options" :aria-label="`第${index + 1}段合力方向`">
                <button
                  v-for="item in segment.netForceN === '0'
                    ? [{ value: 'none', label: '无方向' }]
                    : [
                        { value: 'left', label: '向左' },
                        { value: 'right', label: '向右' }
                      ]"
                  :key="item.value"
                  role="button"
                  tabindex="0"
                  :disabled="stopped || busy"
                  :aria-pressed="segment.direction === item.value"
                  :class="{ selected: segment.direction === item.value }"
                  @tap="setSegment(index, 'direction', item.value)"
                >
                  {{ item.label }}
                </button>
              </view>
            </view>
            <button role="button" tabindex="0" :disabled="stopped || busy" @tap="changeSegments">
              {{ draft.segments.length === 2 ? '添加第三段' : '移除第三段' }}
            </button>
          </template>
        </template>
      </template>
      <text v-if="!['changing_net_force', 'velocity_time_graph'].includes(template)" class="diagram-label">{{
        template === 'distance_displacement' ? '去程方向' : '合力方向'
      }}</text>
      <view v-if="!['changing_net_force', 'velocity_time_graph'].includes(template)" class="diagram-options">
        <button
          v-for="item in directions"
          :key="item.value"
          role="button"
          tabindex="0"
          :disabled="stopped || busy"
          :aria-pressed="draft.direction === item.value"
          :class="{ selected: draft.direction === item.value }"
          @tap="set('direction', item.value)"
        >
          {{ item.label }}
        </button>
      </view>
      <text v-if="error" class="warning" role="alert">{{ error }}</text>
      <button
        class="primary"
        role="button"
        tabindex="0"
        :disabled="stopped || busy"
        :aria-disabled="stopped || busy"
        @tap="confirm"
      >
        确认条件并演示
      </button>
    </view>
  </view>
</template>
<script setup>
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
  gap: 12px;
}
.diagram-conditions {
  border-top: 1px solid var(--space-line);
  padding-top: 12px;
}
.diagram-image {
  width: 100%;
  height: 240px;
  border-radius: 12px;
  background: var(--yozi-solid);
}
.diagram-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.diagram-options button {
  margin: 0;
  min-width: 44px;
  min-height: 44px;
  font-size: 14px;
}
.diagram-label {
  font-size: 14px;
  font-weight: 600;
}
.diagram-field input {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  box-sizing: border-box;
  background: var(--yozi-glass);
  border: 1px solid var(--space-line);
  border-radius: 12px;
  color: var(--space-text);
}
.selected {
  background: var(--space-user, var(--yozi-solid)) !important;
}
</style>
