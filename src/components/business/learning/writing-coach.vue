<template>
  <LearningShell active="learning" title="考研英语写作" @new="newSession" @materials="showMaterials = !showMaterials">
    <!-- #ifdef MP-WEIXIN -->
    <PrivacyPopup />
    <!-- #endif -->
    <template #controls>
      <BaseButton
        v-if="coach && !learning.active.stopped"
        variant="quiet"
        icon="pause"
        icon-only
        label="暂停带练"
        @tap="pauseLearning"
      />
      <BaseButton variant="quiet" icon="chart" :aria-expanded="showBoard" @tap="showBoard = !showBoard"
        >学习看板</BaseButton
      >
      <BaseButton variant="quiet" icon="settings" @tap="$emit('advanced')">高级设置</BaseButton>
    </template>
    <view class="coach-workspace">
      <BaseCard v-if="!coach" padding="large">
        <text class="coach-title">今天，从写好一段开始</text>
        <BaseInput
          v-model="goal"
          label="你想怎样准备考研英语写作？"
          multiline
          maxlength="400"
          placeholder="我是大三学生，准备考英语一，写作很差"
        />
        <BaseButton variant="primary" @tap="begin">开始建档</BaseButton>
        <BaseButton variant="quiet" @tap="goal = '考研英语二，练习图表作文'">英语二写作</BaseButton>
      </BaseCard>

      <BaseCard v-else-if="learning.active.stopped" padding="large"
        ><text class="coach-title">带练已暂停，记录保留</text
        ><BaseButton
          variant="primary"
          @tap="
            act(() => learning.commit('task.resume', { conversationId: learning.active.id, source: 'self_report' }))
          "
          >继续当前带练</BaseButton
        ></BaseCard
      >
      <BaseCard v-else-if="!coach.profile" padding="large">
        <text class="coach-title">先认识你，五项都可以跳过</text>
        <BaseInput
          v-model="profile.exam"
          label="英语一还是英语二？"
          :options="[
            { value: 'english1', label: '英语一' },
            { value: 'english2', label: '英语二' }
          ]"
        />
        <BaseInput v-model="profile.deadline" label="准备哪次考试？" type="date" maxlength="10" />
        <BaseInput
          v-model="profile.foundation"
          label="你觉得目前写作怎么样？（选填）"
          placeholder="例如：句子容易写错"
          maxlength="400"
        />
        <BaseInput
          v-model="profile.minutes"
          label="每天能学多久？"
          :options="[
            { value: '15', label: '15分钟' },
            { value: '25', label: '25分钟' },
            { value: '40', label: '40分钟' }
          ]"
        />
        <text>有自己的资料吗？可在建档后上传，也可以跳过。</text>
        <view class="coach-actions"
          ><BaseButton variant="primary" @tap="saveProfile(false)">保存建档</BaseButton
          ><BaseButton variant="quiet" @tap="saveProfile(true)">跳过，按默认开始</BaseButton></view
        >
      </BaseCard>

      <template v-else>
        <BaseCard v-if="showBoard" data-test="coach-dashboard">
          <text class="coach-title">已保存的学习记录</text>
          <view class="coach-stats"
            ><text>距考试 {{ board.daysToExam }} 天</text><text>本周学习 {{ board.weekDays }} 天</text
            ><text>完成写作 {{ board.essays }} 篇</text><text>已掌握（自评）{{ board.familiar }}</text
            ><text>学习中 {{ board.learning }}</text></view
          >
          <text class="coach-muted">掌握情况来自复习自评；写作反馈是 AI 评估。</text>
          <text v-if="!board.weaknesses.length">还没有薄弱点记录，完成摸底后开始积累。</text>
          <view v-for="weakness in board.weaknesses" :key="weakness" class="coach-weakness">{{ weakness }}</view>
          <view v-for="item in coach.library" :key="item.id" class="coach-saved"
            ><text>{{ item.text }}</text
            ><text class="coach-muted">下次复习：{{ dateLabel(item.due) }}</text></view
          >
          <BaseButton
            v-if="!coach.diagnostic"
            variant="primary"
            :disabled="fileBusy || learning.busy"
            @tap="request('diagnostic')"
            >开始摸底</BaseButton
          >
        </BaseCard>

        <BaseCard v-if="showMaterials || !coach.diagnostic" data-test="coach-materials">
          <text class="coach-title">围绕你的资料练习</text>
          <BaseInput v-model="materialText" label="粘贴资料（选填）" multiline maxlength="50000" />
          <BaseButton :disabled="!materialText.trim() || learning.busy || fileBusy" @tap="pasteMaterial"
            >保存文字</BaseButton
          >
          <!-- #ifdef H5 -->
          <label class="coach-file"
            >选择 txt、md 或文字型 PDF<component
              :is="'input'"
              type="file"
              accept=".txt,.md,.pdf"
              aria-label="选择学习资料"
              :disabled="fileBusy || learning.busy"
              @change="pickFile"
          /></label>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <text class="coach-muted">文字型 PDF 请在网页版导入；这里可粘贴文字。</text>
          <!-- #endif -->
          <text v-if="fileBusy">正在设备内提取文字…</text>
          <text v-for="material in materials" :key="material.id" class="coach-saved"
            >{{ material.name }} · {{ material.segments.length }} 个片段</text
          >
        </BaseCard>

        <BaseCard>
          <BaseChip v-model="learning.sharingAllowed">同意将本次原答和必要资料片段发送给所选模型</BaseChip>
          <BaseButton v-if="!loggedIn" variant="primary" @tap="login">登录后开始带练</BaseButton>
          <text v-if="yesterday" class="coach-muted"
            >上次：{{ yesterday.summary?.learned.join('；') || '已保存未完成训练，可从历史记录回看' }}</text
          >
          <text v-if="learning.busy" role="status">正在准备反馈，原答已保存…</text>
          <BaseButton v-if="learning.busy" variant="quiet" @tap="learning.cancel()">取消等待</BaseButton>
        </BaseCard>

        <BaseCard v-if="dueItem">
          <text class="coach-title">先复习到期句式</text><text>{{ dueItem.text }}</text>
          <BaseInput v-model="answer" label="用这个句式或搭配写一句话" multiline maxlength="1000" />
          <text class="coach-muted">提交后按自己的回忆情况选择，不记为可靠判分。</text>
          <view class="coach-actions"
            ><BaseButton
              v-for="(label, index) in ['再学一次', '吃力', '记得', '轻松']"
              :key="label"
              :disabled="!answer.trim() || learning.busy"
              @tap="review(index + 1)"
              >{{ label }}</BaseButton
            ></view
          >
        </BaseCard>
        <template v-else>
          <BaseCard v-if="!coach.diagnostic">
            <text class="coach-title">十分钟摸底</text><text>成分、搭配、翻译、长难句和审题，每项一题。</text>
            <BaseButton variant="primary" :disabled="fileBusy || learning.busy" @tap="request('diagnostic')">{{
              requestLabel('diagnostic')
            }}</BaseButton>
          </BaseCard>
          <BaseCard v-else-if="!coach.diagnostic.feedback">
            <template v-if="diagnosticCard"
              ><text class="coach-title">{{ diagnosticCard.title }}</text
              ><text>{{ diagnosticCard.prompt }}</text
              ><text v-if="diagnosticCard.example">{{ diagnosticCard.example }}</text
              ><text class="coach-muted">{{ sourceLabel(diagnosticCard.source) }}</text
              ><BaseInput v-model="answer" label="你的原答" multiline maxlength="3000" /><BaseButton
                variant="primary"
                :disabled="!answer.trim() || learning.busy"
                @tap="submitCard(diagnosticCard, true)"
                >提交原答</BaseButton
              ></template
            >
            <BaseButton v-else variant="primary" :disabled="learning.busy" @tap="request('feedback', 'diagnostic')">{{
              requestLabel('feedback', 'diagnostic', '生成薄弱点与今日安排')
            }}</BaseButton>
          </BaseCard>
          <BaseCard v-else-if="!day">
            <text class="coach-title">今天按 {{ coach.profile.minutes }} 分钟安排</text
            ><text>{{ coach.diagnostic.feedback.weaknesses.join('、') || '先练搭配和句子，再逐段写作' }}</text>
            <BaseButton variant="primary" :disabled="learning.busy" @tap="request('daily')">{{
              requestLabel('daily', 'daily', '安排今日训练')
            }}</BaseButton>
          </BaseCard>
          <template v-else>
            <BaseCard v-if="trainingCard">
              <text class="coach-muted"
                >今日训练 {{ day.answers.length + (cardAnswer ? 0 : 1) }} / {{ day.pack.cards.length }}</text
              >
              <text class="coach-title">{{ trainingCard.title }}</text
              ><text>{{ trainingCard.prompt }}</text
              ><text v-if="trainingCard.example">{{ trainingCard.example }}</text
              ><text class="coach-muted">{{ sourceLabel(trainingCard.source) }}</text>
              <template v-if="!cardAnswer"
                ><BaseInput v-model="answer" label="你的原答" multiline maxlength="3000" /><BaseButton
                  variant="primary"
                  :disabled="!answer.trim() || learning.busy"
                  @tap="submitCard(trainingCard, false)"
                  >提交原答</BaseButton
                ></template
              >
              <template v-else
                ><text class="coach-saved">{{ cardAnswer.answer }}</text
                ><BaseButton
                  variant="primary"
                  :disabled="learning.busy"
                  @tap="request('feedback', `card-${trainingCard.id}`)"
                  >{{ requestLabel('feedback', `card-${trainingCard.id}`, '查看本卡反馈') }}</BaseButton
                ></template
              >
            </BaseCard>
            <BaseCard v-else-if="!day.analysis">
              <text class="coach-title">先自己审题</text><text>{{ day.pack.writing.prompt }}</text
              ><text class="coach-muted">{{ sourceLabel(day.pack.writing.source) }}</text>
              <BaseInput
                v-for="field in analysisFields"
                :key="field.key"
                v-model="analysis[field.key]"
                :label="field.label"
                maxlength="600"
              />
              <BaseButton variant="primary" :disabled="learning.busy" @tap="saveAnalysis">提交审题</BaseButton>
            </BaseCard>
            <BaseCard v-else-if="!day.feedback.analysis"
              ><text>{{ day.pack.writing.prompt }}</text
              ><BaseButton variant="primary" :disabled="learning.busy" @tap="request('feedback', 'analysis')">{{
                requestLabel('feedback', 'analysis', '对照审题反馈')
              }}</BaseButton></BaseCard
            >
            <BaseCard v-else-if="paragraphIndex < day.pack.writing.patterns.length">
              <text class="coach-title"
                >第 {{ paragraphIndex + 1 }} 段 ·
                {{
                  paragraphIndex === 0
                    ? '交代目的或描述'
                    : paragraphIndex === day.pack.writing.patterns.length - 1
                      ? '回应目的与建议'
                      : '展开要点与理由'
                }}</text
              >
              <text>{{ day.pack.writing.prompt }}</text
              ><text class="coach-muted">{{ wordLimit }}；先借助句式写，再按反馈改写。</text>
              <text v-for="pattern in day.pack.writing.patterns[paragraphIndex]" :key="pattern" class="coach-pattern">{{
                pattern
              }}</text>
              <template v-if="!day.drafts[paragraphIndex]"
                ><BaseInput v-model="answer" label="这一段的原答" multiline maxlength="1800" /><BaseButton
                  variant="primary"
                  :disabled="!answer.trim() || learning.busy"
                  @tap="saveParagraph(false)"
                  >提交本段</BaseButton
                ></template
              >
              <template v-else-if="!day.feedback[`paragraph-${paragraphIndex}`]"
                ><text class="coach-saved">{{ day.drafts[paragraphIndex].text }}</text
                ><BaseButton
                  variant="primary"
                  :disabled="learning.busy"
                  @tap="request('feedback', `paragraph-${paragraphIndex}`)"
                  >{{ requestLabel('feedback', `paragraph-${paragraphIndex}`, '逐句反馈') }}</BaseButton
                ></template
              >
              <template v-else
                ><text class="coach-muted">结合下面反馈，再写一次。</text
                ><BaseInput v-model="answer" label="这一段的改写" multiline maxlength="1800" /><BaseButton
                  variant="primary"
                  :disabled="!answer.trim() || learning.busy"
                  @tap="saveParagraph(true)"
                  >保存改写</BaseButton
                ></template
              >
            </BaseCard>
            <BaseCard v-else-if="!day.essay"
              ><text class="coach-title">你的全文</text
              ><text v-for="paragraph in day.rewrites" :key="paragraph.id" class="coach-saved">{{
                paragraph.text
              }}</text
              ><BaseButton variant="primary" :disabled="learning.busy" @tap="request('essay')">{{
                requestLabel('essay', 'essay', '查看成文反馈')
              }}</BaseButton></BaseCard
            >
            <BaseCard v-else-if="!day.summary"
              ><text class="coach-title">完成了，留一份小结</text
              ><BaseButton variant="primary" :disabled="learning.busy" @tap="request('summary')">{{
                requestLabel('summary', 'summary', '生成今日小结')
              }}</BaseButton></BaseCard
            >
            <BaseCard v-else
              ><text class="coach-title">{{ day.completed ? '今天已完成' : '今日小结' }}</text
              ><text v-for="item in day.summary.learned" :key="item">{{ item }}</text
              ><text class="coach-title">明天</text
              ><text v-for="item in day.summary.tomorrow" :key="item">{{ item }}</text
              ><BaseButton v-if="!day.completed" variant="primary" @tap="act(() => learning.coachSave('finish'))"
                >确认完成今天</BaseButton
              ><BaseButton variant="quiet" @tap="showBoard = true">查看已保存进度</BaseButton></BaseCard
            >
          </template>
        </template>

        <BaseCard v-if="lastFeedback" data-test="coach-feedback">
          <text class="coach-title">AI 评估</text>
          <view v-for="(line, index) in lastFeedback.lines" :key="index" class="coach-saved"
            ><text>原答：{{ line.original }}</text
            ><text>{{ line.advice }}</text
            ><text>可改为：{{ line.rewrite }}</text></view
          >
          <text v-for="dimension in lastFeedback.dimensions" :key="dimension.name"
            >{{ dimension.name }}：{{ dimension.comment }}</text
          >
          <view v-for="phrase in lastFeedback.phrases" :key="phrase" class="coach-saved"
            ><text>{{ phrase }}</text
            ><BaseButton
              v-if="lastFeedback.id"
              variant="quiet"
              :disabled="learning.busy || coach.library.some((v) => v.text === phrase)"
              @tap="act(() => learning.coachSave('adopt', { feedbackId: lastFeedback.id, phrase }))"
              >{{ coach.library.some((v) => v.text === phrase) ? '已进句式库' : '采用到句式库' }}</BaseButton
            ></view
          >
        </BaseCard>
        <BaseCard v-if="surveyDue"
          ><text class="coach-title">如果每月 ¥{{ trialPrice }}，你会继续使用吗？</text
          ><view class="coach-actions"
            ><BaseButton
              v-for="option in [
                { value: 'yes', label: '会' },
                { value: 'no', label: '暂时不会' },
                { value: 'skip', label: '跳过' }
              ]"
              :key="option.value"
              @tap="act(() => learning.coachSave('survey', { answer: option.value }))"
              >{{ option.label }}</BaseButton
            ></view
          ></BaseCard
        >
        <BaseCard v-if="coach.days.length"
          ><BaseButton variant="quiet" @tap="showHistory = !showHistory">{{
            showHistory ? '收起' : '回看已保存的训练'
          }}</BaseButton
          ><template v-if="showHistory"
            ><view v-for="saved in coach.days" :key="saved.day" class="coach-saved"
              ><text>{{ saved.day }} · {{ saved.completed ? '已完成' : '待继续' }}</text
              ><text v-for="record in saved.answers" :key="record.id">{{ record.answer }}</text
              ><text v-for="paragraph in saved.rewrites" :key="paragraph.id">{{ paragraph.text }}</text></view
            ></template
          ></BaseCard
        >
      </template>
      <BaseCard v-if="message || learning.error" role="alert"
        ><text>{{ message || learning.error }}</text></BaseCard
      >
    </view>
  </LearningShell>
</template>
<script setup>
import { computed, ref, reactive, watch, onUnmounted } from 'vue';
import { useConversationLearningStore, learningId } from '@/stores/modules/conversation-learning.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { getToken } from '@/services/auth-storage.js';
import { readWritingMaterial } from '@/services/learning/writing-material.js';
import { resolveSkippedProfile } from '@/services/learning/coach-profile.js';
import {
  WRITING_METHOD,
  writingCoachDashboard
} from '../../../../laf-backend/functions/_shared/learning-writing-coach.js';
import LearningShell from './learning-shell.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
const emit = defineEmits(['advanced', 'general']);
const learning = useConversationLearningStore();
const goal = ref(''),
  answer = ref(''),
  materialText = ref(''),
  message = ref('');
const showMaterials = ref(false),
  showBoard = ref(false),
  showHistory = ref(false),
  fileBusy = ref(false);
const profile = reactive({
  exam: 'english1',
  deadline: `${new Date().getFullYear()}-12-22`,
  foundation: '',
  minutes: '25'
});
// 档案草稿是组件级状态，不随 coach 重置；新一轮带练必须从种子重来，
// 否则上一轮选过的考试类型会压过这一轮目标里写明的类型。
function resetProfileDraft() {
  Object.assign(profile, {
    exam: 'english1',
    deadline: `${new Date().getFullYear()}-12-22`,
    foundation: '',
    minutes: '25'
  });
}
const analysisFields = [
  { key: 'genre', label: '体裁' },
  { key: 'recipient', label: '对象' },
  { key: 'purpose', label: '目的' },
  { key: 'points', label: '要点' },
  { key: 'words', label: '字数' }
];
const analysis = reactive(Object.fromEntries(analysisFields.map((f) => [f.key, ''])));
const coach = computed(() => learning.active?.coach);
const today = computed(() => dayKey(learning.calendarTime, learning.state.timezone));
const day = computed(() => coach.value?.days.find((d) => d.day === today.value));
const board = computed(() => writingCoachDashboard(coach.value, today.value, learning.state.timezone));
const loggedIn = computed(() => Boolean(getToken()));
const dueItem = computed(() => coach.value?.library.find((v) => v.due <= learning.calendarTime));
const yesterday = computed(() => coach.value?.days.filter((d) => d.day < today.value).at(-1));
const diagnosticCard = computed(() =>
  coach.value?.diagnostic?.cards.find((c) => !coach.value.diagnostic.answers.some((a) => a.cardId === c.id))
);
const trainingCard = computed(() => day.value?.pack.cards.find((c) => !day.value.feedback[`card-${c.id}`]));
const cardAnswer = computed(() => day.value?.answers.find((a) => a.cardId === trainingCard.value?.id));
const paragraphIndex = computed(() => day.value?.rewrites.length || 0);
const lastFeedback = computed(
  () => day.value?.essay || Object.values(day.value?.feedback || {}).at(-1) || coach.value?.diagnostic?.feedback
);
const materials = computed(() => learning.state.materials.filter((m) => coach.value?.materialIds.includes(m.id)));
const wordLimit = computed(() =>
  coach.value?.profile && day.value
    ? WRITING_METHOD.words[coach.value.profile.exam][day.value.pack.writing.essayType]
    : ''
);
const configuredPrice = Number(import.meta.env.VITE_TRIAL_MONTHLY_PRICE || 19);
const trialPrice =
  Number.isFinite(configuredPrice) && configuredPrice >= 0 && configuredPrice <= 10000 ? configuredPrice : 19;
const surveyDue = computed(
  () =>
    coach.value?.profile &&
    !learning.state.conversations.some((c) => c.coach?.survey) &&
    Date.parse(today.value) -
      Math.min(...learning.state.conversations.filter((c) => c.coach).map((c) => Date.parse(c.coach.startedDay))) >=
      6 * 86400000
);
const calendar = learning.observeCalendar();
calendar.show();
onUnmounted(() => calendar.dispose());
watch(
  () => `${learning.recordContext()}:${learning.active?.id}:${today.value}`,
  () => {
    answer.value = '';
    message.value = '';
  }
);
async function act(action) {
  message.value = '';
  try {
    return await action();
  } catch (error) {
    message.value = error.message || '未完成，请保留原答后重试';
  }
}
function begin() {
  act(() => {
    const text = goal.value.trim() || '考研英语写作';
    if (!/英语[一二]|考研英语|考研.*写作/.test(text)) {
      emit('general', text);
      return;
    }
    resetProfileDraft();
    learning.startCoach(text);
    // 目标里写明的考试类型双向生效，不再只认英语二。
    if (/英语二/.test(text)) profile.exam = 'english2';
    else if (/英语一/.test(text)) profile.exam = 'english1';
    showMaterials.value = true;
  });
}
function newSession() {
  if (learning.busy) return;
  learning.selectedConversationId = null;
}
function pauseLearning() {
  act(() => {
    if (learning.busy) learning.cancel();
    learning.commit('task.stop', { conversationId: learning.active.id });
  });
}
function saveProfile(skip) {
  act(() =>
    learning.coachSave('profile', {
      profile: skip ? resolveSkippedProfile(profile) : { ...profile, minutes: Number(profile.minutes) }
    })
  );
}
function sourceLabel(source) {
  return source.kind === 'private_material'
    ? `${source.name}${source.page ? ` · 第${source.page}页` : ''} · 内容待核对`
    : '模型生成 · 内容待核对';
}
function dateLabel(at) {
  return new Date(at).toLocaleDateString('zh-CN');
}
function requestLabel(phase, target = phase, label = '开始摸底') {
  return coach.value?.requests.some(
    (r) =>
      r.status === 'pending' &&
      r.request.day === today.value &&
      r.request.phase === phase &&
      r.request.target === target
  )
    ? '查询原请求结果'
    : label;
}
function request(phase, target = phase) {
  // 提取未完成时并发开始模型请求，会让刚写入的资料无法绑定，因此两个方向都拦住。
  if (fileBusy.value) {
    message.value = '正在提取资料，请稍候再开始';
    return;
  }
  return act(() => learning.requestCoach(phase, target));
}
function submitCard(card, diagnostic) {
  act(() => {
    learning.coachSave('answer', {
      target: diagnostic ? 'diagnostic' : 'daily',
      cardId: card.id,
      answer: answer.value
    });
    answer.value = '';
  });
}
function saveAnalysis() {
  act(() => learning.coachSave('analysis', { fields: { ...analysis } }));
}
function saveParagraph(rewrite) {
  act(() => {
    learning.coachSave('paragraph', { index: paragraphIndex.value, rewrite, text: answer.value });
    answer.value = '';
  });
}
function review(rating) {
  act(() => {
    learning.coachReview(dueItem.value.id, answer.value, rating);
    answer.value = '';
  });
}
function bindMaterial(material) {
  // 保存与绑定由 store 一次完成：忙碌时整笔不写，不会留下未绑定的资料。
  learning.attachMaterial(material);
  showMaterials.value = true;
}
function pasteMaterial() {
  act(() => {
    learning.attachText(materialText.value);
    materialText.value = '';
  });
}
async function pickFile(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const context = learning.recordContext(),
    id = learning.active.id;
  fileBusy.value = true;
  await act(async () => {
    const material = await readWritingMaterial(file, learningId('material'));
    if (context !== learning.recordContext() || id !== learning.active?.id)
      throw new Error('当前目标已变化，请重新选择资料');
    if (learning.busy) throw new Error('提取已完成，但正在生成反馈；请稍后重新选择该文件');
    bindMaterial(material);
    message.value = '资料已保存到当前目标，提取文字未离开设备';
  });
  fileBusy.value = false;
  event.target.value = '';
}
function login() {
  uni.navigateTo({ url: '/pages/login/index' });
}
</script>
<style scoped>
.coach-workspace {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
  padding: var(--s-5, 20px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding-bottom: 80px;
}
.coach-workspace :deep(.base-card__body) {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.coach-title {
  display: block;
  font-size: 20px;
  line-height: 1.45;
  font-weight: 700;
}
.coach-muted {
  display: block;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ink-3, #606579);
}
.coach-actions,
.coach-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.coach-stats > text {
  flex: 1 1 160px;
  font-size: 16px;
}
.coach-saved {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line-soft, #dedfeb);
}
.coach-pattern,
.coach-weakness {
  display: block;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-subtle, #eeeffa);
}
.coach-file {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
}
.coach-file :deep(input) {
  max-width: 100%;
}
@media (max-width: 520px) {
  .coach-workspace {
    padding: 12px 12px 80px;
  }
  .coach-title {
    font-size: 18px;
  }
  .coach-actions :deep(button) {
    flex: 1 1 auto;
  }
}
</style>
