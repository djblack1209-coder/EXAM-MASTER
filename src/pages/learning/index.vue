<template>
  <LearningShell
    active="learning"
    :title="$t('pages.learning')"
    @materials="showMaterial = true"
    @new="newConversation"
  >
    <!-- #ifdef MP-WEIXIN -->
    <PrivacyPopup />
    <!-- #endif -->
    <template #controls>
      <button
        class="connection-pill"
        role="button"
        tabindex="0"
        :aria-expanded="showConnections"
        @tap="showConnections = !showConnections"
      >
        <view class="quiet-dot" />
        <text>{{ connectionLabel }}</text>
        <BaseIcon name="settings" :size="30" :color="iconColor" />
      </button>
    </template>
    <view ref="learningRoot" class="learning-page">
      <!-- #ifdef H5 -->
      <text v-if="!learningWriteProtectionSupported" class="warning">
        本浏览器缺少多窗口写入保护；请仅保留一个学习窗口。
      </text>
      <!-- #endif -->
      <view v-if="!learning.active" class="welcome-copy">
        <text class="welcome-title">{{ '今天，想把什么\n学明白？' }}</text>
      </view>
      <view v-if="showConnections" class="panel">
        <text class="section-title">模型</text>
        <text class="subtle">
          当前：{{
            learning.selectedMode === 'offline'
              ? '仅保存到本设备'
              : learning.selectedMode === 'local'
                ? '发送到已连接的本地模型'
                : '通过服务器发送到所选模型'
          }}
        </text>
        <view class="button-row">
          <button role="button" tabindex="0" size="mini" @tap="setMode('offline')">本地记录</button>
          <button
            role="button"
            tabindex="0"
            size="mini"
            data-test="model-list-read"
            :disabled="learning.modelListState.phase === 'loading'"
            :aria-disabled="learning.modelListState.phase === 'loading'"
            @tap="loadModels"
          >
            {{ learning.modelListState.phase === 'loading' ? '正在读取云模型' : '查看云模型' }}
          </button>
          <button
            v-if="learning.modelListState.phase === 'loading'"
            role="button"
            tabindex="0"
            size="mini"
            @tap="learning.cancelModelReads('models')"
          >
            取消列表读取
          </button>
          <!-- #ifdef H5 || MP-WEIXIN || APP-PLUS -->
          <button role="button" tabindex="0" size="mini" @tap="localForm = !localForm">本地模型</button>
          <!-- #endif -->
        </view>
        <view
          v-if="learning.modelListState.message"
          class="material-status"
          :class="{ warning: learning.modelListState.phase === 'error' }"
          :role="learning.modelListState.phase === 'error' ? 'alert' : 'status'"
          aria-live="polite"
          :aria-busy="learning.modelListState.phase === 'loading'"
          data-test="model-list-status"
        >
          <WdLoading
            v-if="learning.modelListState.phase === 'loading'"
            :key="iconColor"
            type="outline"
            :color="iconColor"
            :size="20"
            aria-hidden="true"
          />
          <text>{{ learning.modelListState.message }}</text>
        </view>
        <button
          v-if="learning.modelListState.phase === 'error' && learning.modelListState.code === 401"
          role="button"
          tabindex="0"
          size="mini"
          @tap="loginForModels"
        >
          前往登录
        </button>
        <button
          v-else-if="learning.modelListState.phase === 'error'"
          role="button"
          tabindex="0"
          size="mini"
          @tap="loadModels"
        >
          重试云模型列表
        </button>
        <view v-for="model in learning.models" :key="model.id" class="model-row">
          <text>
            {{ model.provider }} / {{ model.model }} ·
            {{ model.source === 'byok' ? '供应商计费' : '平台模型' }}
          </text>
          <text class="subtle">{{ connectionStatusLabel(model.connectionStatus) }}</text>
          <text v-if="model.terms" class="subtle">{{ model.terms }}</text>
          <text v-if="model.privacy" class="subtle">{{ model.privacy }}</text>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.modelListState.phase === 'loading'"
            :aria-disabled="learning.modelListState.phase === 'loading'"
            @tap="selectModel(model.id)"
          >
            {{ learning.modelId === model.id ? '已选择' : '使用此模型' }}
          </button>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.modelListState.phase === 'loading'"
            :aria-disabled="learning.modelListState.phase === 'loading'"
            @tap="testModel(model.id)"
          >
            测试连接
          </button>
          <button
            v-if="model.source === 'byok'"
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.modelListState.phase === 'loading'"
            :aria-disabled="learning.modelListState.phase === 'loading'"
            @tap="removeModel(model.id)"
          >
            删除密钥
          </button>
        </view>
        <button
          class="consent"
          role="checkbox"
          tabindex="0"
          :aria-checked="learning.sharingAllowed"
          @tap="learning.sharingAllowed = !learning.sharingAllowed"
        >
          {{ learning.sharingAllowed ? '☑' : '☐' }}
          允许发送当前目标、学习路线、最近消息和当前题目，不发送整份资料
        </button>
        <button
          role="checkbox"
          tabindex="0"
          :aria-checked="learning.streamEnabled"
          :disabled="learning.busy || !learning.streamSupported"
          :aria-disabled="learning.busy || !learning.streamSupported"
          @tap="learning.streamEnabled = !learning.streamEnabled"
        >
          {{ learning.streamEnabled ? '☑' : '☐' }} 边生成边显示
        </button>
        <button role="button" tabindex="0" size="mini" @tap="byokForm = !byokForm">添加模型</button>
        <view v-if="byokForm" class="form">
          <view class="button-row">
            <button
              v-for="preset in learning.modelPresets"
              :key="preset.id"
              role="button"
              tabindex="0"
              size="mini"
              @tap="usePreset(preset)"
            >
              {{ preset.provider }} · {{ preset.model }}
            </button>
          </view>
          <input v-model="profile.id" aria-label="连接名称" placeholder="连接名称" maxlength="60" />
          <input v-model="profile.provider" aria-label="供应商" placeholder="供应商" maxlength="80" />
          <input v-model="profile.model" aria-label="模型 ID" placeholder="模型 ID" maxlength="120" />
          <input v-model="profile.endpoint" aria-label="模型接口地址" placeholder="HTTPS 接口地址" />
          <input v-model="profile.apiKey" aria-label="API 密钥" password placeholder="API 密钥" />
          <text class="subtle"> 测试和使用会消耗供应商额度，费用按供应商规则计算。 </text>
          <text class="subtle"> 密钥保存在服务器，管理员可访问；删除后的备份按保留期限清理。 </text>
          <button role="checkbox" tabindex="0" :aria-checked="profile.stream" @tap="profile.stream = !profile.stream">
            {{ profile.stream ? '☑' : '☐' }} 支持流式回复
          </button>
          <button role="checkbox" tabindex="0" :aria-checked="profile.vision" @tap="profile.vision = !profile.vision">
            {{ profile.vision ? '☑' : '☐' }} 支持图片输入
          </button>
          <label class="consent">
            <checkbox :checked="vaultConsent" @tap="vaultConsent = !vaultConsent" />
            同意保存密钥并调用所选供应商
          </label>
          <button role="button" tabindex="0" size="mini" @tap="saveModel">保存连接</button>
        </view>
        <view v-if="localForm" class="form">
          <input v-model="localEndpoint" aria-label="本地模型地址" placeholder="本地模型地址" />
          <input v-model="localModel" aria-label="本地模型 ID" placeholder="本地模型 ID" />
          <input v-model="localToken" aria-label="连接令牌" password placeholder="连接令牌" />
          <text class="subtle"> 仅连接此地址，令牌不保存。手机连接电脑时，请填写电脑地址。 </text>
          <!-- #ifdef MP-WEIXIN -->
          <text class="subtle">请使用已获授权的 HTTPS 地址。</text>
          <!-- #endif -->
          <button role="button" tabindex="0" size="mini" @tap="connectLocal">授权此目标并连接</button>
          <text v-if="learning.localConnection?.status" class="subtle">
            {{ learning.localConnection.status === 'model_verified' ? '模型已连接' : '连接成功，模型未测试' }}
            · 仅文本
          </text>
        </view>
        <view class="button-row">
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.modelUsageState.phase === 'loading'"
            :aria-disabled="learning.modelUsageState.phase === 'loading'"
            @tap="loadUsage"
          >
            {{ learning.modelUsageState.phase === 'loading' ? '正在读取模型用量' : '查看模型用量' }}
          </button>
          <button
            v-if="learning.modelUsageState.phase === 'loading'"
            role="button"
            tabindex="0"
            size="mini"
            @tap="learning.cancelModelReads('usage')"
          >
            取消用量读取
          </button>
        </view>
        <view
          v-if="learning.modelUsageState.message"
          class="material-status"
          :class="{ warning: learning.modelUsageState.phase === 'error' }"
          :role="learning.modelUsageState.phase === 'error' ? 'alert' : 'status'"
          aria-live="polite"
          :aria-busy="learning.modelUsageState.phase === 'loading'"
          data-test="model-usage-status"
        >
          <WdLoading
            v-if="learning.modelUsageState.phase === 'loading'"
            :key="iconColor"
            type="outline"
            :color="iconColor"
            :size="20"
            aria-hidden="true"
          />
          <text>{{ learning.modelUsageState.message }}</text>
        </view>
        <button
          v-if="learning.modelUsageState.phase === 'error' && learning.modelUsageState.code === 401"
          role="button"
          tabindex="0"
          size="mini"
          @tap="loginForModels"
        >
          前往登录
        </button>
        <button
          v-else-if="learning.modelUsageState.phase === 'error'"
          role="button"
          tabindex="0"
          size="mini"
          @tap="loadUsage"
        >
          重试模型用量
        </button>
        <view v-if="learning.usage" class="subtle">
          <text>
            剩余额度
            {{
              learning.usage.entitlement.weeklyUnits -
              learning.usage.entitlement.spent -
              learning.usage.entitlement.reserved
            }}
          </text>
          <text>
            已用 {{ learning.usage.cost.spent }} · 处理中 {{ learning.usage.cost.reserved }} · 待结算
            {{ learning.usage.cost.pending }} 次
          </text>
          <text v-if="learning.usage.byokBudget">
            自带模型 {{ learning.usage.byokBudget.used }} / {{ learning.usage.byokBudget.limit }} 次 · 待结算
            {{ learning.usage.byokBudget.pendingCosts }} 次
          </text>
        </view>
      </view>
      <view v-if="!learning.active" class="goal-panel">
        <view class="button-row" aria-label="学习方向">
          <button
            v-for="(label, track) in LEARNING_TRACKS"
            :key="track"
            role="button"
            tabindex="0"
            size="mini"
            :data-test="'task-track-' + track"
            :aria-pressed="taskTrack === track"
            :class="{ chosen: taskTrack === track }"
            @tap="selectTaskTrack(track)"
          >
            {{ label }}
          </button>
        </view>
        <button
          class="quiet-button"
          role="button"
          tabindex="0"
          :aria-expanded="showTaskOptions"
          @tap="showTaskOptions = !showTaskOptions"
        >
          {{ taskStage || taskEdition ? [taskStage, taskEdition].filter(Boolean).join(' · ') : '学习设置' }}
          <BaseIcon :name="showTaskOptions ? 'chevron-up' : 'chevron-down'" :size="26" :color="iconColor" />
        </button>
        <view v-if="showTaskOptions" class="preference-fields">
          <text class="field-label">{{ ['primary', 'junior', 'senior'].includes(taskTrack) ? '年级' : '阶段' }}</text>
          <view class="button-row" aria-label="年级或学习阶段">
            <button
              v-for="option in taskStages"
              :key="option"
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="!customStage && taskStage === option"
              :class="{ chosen: !customStage && taskStage === option }"
              @tap="
                customStage = false;
                taskStage = option;
              "
            >
              {{ option || '不指定' }}
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="customStage"
              @tap="
                customStage = true;
                taskStage = '';
              "
            >
              其他
            </button>
          </view>
          <input
            v-if="customStage"
            v-model="taskStage"
            class="field"
            maxlength="100"
            aria-label="自定义学习阶段"
            placeholder="学习阶段"
          />
          <text class="field-label">{{ ['primary', 'junior', 'senior'].includes(taskTrack) ? '教材' : '考试' }}</text>
          <view class="button-row" aria-label="教材或考试版本">
            <button
              v-for="option in taskEditions"
              :key="option"
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="!customEdition && taskEdition === option"
              :class="{ chosen: !customEdition && taskEdition === option }"
              @tap="
                customEdition = false;
                taskEdition = option;
              "
            >
              {{ option || '不指定' }}
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="customEdition"
              @tap="
                customEdition = true;
                taskEdition = '';
              "
            >
              其他
            </button>
          </view>
          <input
            v-if="customEdition"
            v-model="taskEdition"
            class="field"
            maxlength="100"
            aria-label="自定义教材或考试"
            placeholder="教材或考试"
          />
        </view>
        <textarea
          :value="goal"
          class="field"
          aria-label="学习目标"
          placeholder="输入问题，或选一个主题"
          placeholder-class="space-placeholder"
          maxlength="1000"
          @input="goal = textInputValue($event)"
        ></textarea>
        <view class="goal-actions">
          <button class="material-shortcut" role="button" tabindex="0" @tap="showMaterial = !showMaterial">
            <BaseIcon name="upload" :size="32" :color="iconColor" />
            <text>导入资料</text>
          </button>
          <button
            role="button"
            tabindex="0"
            class="primary"
            :disabled="!goal.trim()"
            :aria-disabled="!goal.trim()"
            @tap="start"
          >
            开始学习
            <BaseIcon name="arrow-right" :size="30" :color="primaryIconColor" />
          </button>
        </view>
        <view class="starter-row">
          <button v-for="starter in starters" :key="starter" role="button" tabindex="0" @tap="goal = starter">
            {{ starter }}
          </button>
        </view>
      </view>
      <view v-if="learning.active" class="conversation-area">
        <view class="conversation-toolbar">
          <view>
            <text class="conversation-title">{{ learning.active.goal }}</text>
          </view>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.busy"
            :aria-disabled="learning.busy"
            @tap="newConversation"
          >
            <BaseIcon name="plus" :size="30" :color="iconColor" />
            <text>新对话</text>
          </button>
        </view>
        <view v-if="learning.active.messages.length > 50" class="conversation-toolbar">
          <button
            role="button"
            size="mini"
            :disabled="messageStart === 0"
            :aria-disabled="messageStart === 0"
            @tap="messageStart = Math.max(0, messageStart - 50)"
          >
            更早消息
          </button>
          <text class="subtle"
            >消息 {{ messageStart + 1 }}–{{ Math.min(messageStart + 50, learning.active.messages.length) }} /
            {{ learning.active.messages.length }}</text
          >
          <button
            role="button"
            size="mini"
            :disabled="messageStart + 50 >= learning.active.messages.length"
            :aria-disabled="messageStart + 50 >= learning.active.messages.length"
            @tap="messageStart = Math.min(learning.active.messages.length - 50, messageStart + 50)"
          >
            更新消息
          </button>
          <button role="button" size="mini" @tap="messageStart = Math.max(0, learning.active.messages.length - 50)">
            回到最新
          </button>
          <button v-if="learning.activeQuestion" role="button" size="mini" @tap="locateQuestionMessages">
            当前题相关对话
          </button>
        </view>
        <view
          v-for="chapter in visibleChapters"
          :id="`learning-day-${chapter.day}`"
          :key="chapter.day"
          class="conversation-day"
          :aria-label="`${chapter.day}学习记录`"
          tabindex="-1"
        >
          <view class="conversation-day-heading">
            <text>{{ chapter.day }}</text>
            <view class="conversation-day-rule" aria-hidden="true" />
          </view>
          <view v-if="chapter.groups.length" class="chapter-modules" aria-label="本日模块记录">
            <button
              v-for="group in chapter.groups"
              :key="group.id"
              role="button"
              tabindex="0"
              :disabled="learning.busy"
              :aria-disabled="learning.busy"
              @tap="learning.locateConversation(learning.active.id, chapter.day, group.id)"
            >
              <text>{{ group.label }}</text>
              <text class="chapter-module-count"
                >{{ group.questionKeys.length }}题 · {{ group.submittedBy ? '已提交' : '未提交' }}</text
              >
              <BaseIcon name="arrow-right" :size="26" :color="iconColor" />
            </button>
          </view>
          <view
            v-for="message in chapter.messages"
            :id="message.id"
            :key="message.id"
            class="message"
            :class="message.role"
            :aria-label="roleLabel(message.role)"
          >
            <LearningMessage v-if="message.role === 'assistant'" :content="message.content" />
            <text v-else class="message-content" selectable>{{ message.content }}</text>
          </view>
        </view>
        <LearningOverview :show-navigation="false" :inline="true" :conversation-id="learning.active.id" />
        <view id="learning-journey-workspace" tabindex="-1"><LearningJourney :inline="true" /></view>
        <view
          v-if="learning.activeQuestion && !learning.batchTrainingActive"
          id="active-learning-question"
          class="question-block"
        >
          <text class="subtle">
            {{ learning.activeQuestion.scope === 'generated' ? '练习' : '我的资料' }} ·
            {{ learning.activeQuestion.validation ? '已校验' : '待核对' }}
          </text>
          <view
            v-for="(reading, index) in quizOriginalView.readings"
            :key="index"
            class="question-block"
            data-test="quiz-original-reading"
          >
            <text class="subtle">{{ reading.label }}</text>
            <text class="message-content" selectable>{{ reading.text }}</text>
          </view>
          <text class="question-prompt" selectable>{{ learning.activeQuestion.prompt }}</text>
          <view v-if="quizOriginalView.target" class="question-block" data-test="quiz-original-target">
            <text class="subtle">指定片段</text>
            <text class="message-content" selectable>{{ quizOriginalView.target }}</text>
          </view>
          <view
            v-if="quizOriginalView.source || quizOriginalView.license"
            class="question-block"
            data-test="quiz-original-source"
          >
            <text v-if="quizOriginalView.source" class="subtle" selectable
              >原记录来源：{{ quizOriginalView.source }} · 待核对</text
            >
            <text v-if="quizOriginalView.license" class="subtle" selectable
              >原记录许可：{{ quizOriginalView.license }} · 待核对</text
            >
          </view>
          <text
            v-if="learning.activeQuestion.source?.kind === 'existing_bank' && !learning.activeQuestion.quizOriginal"
            class="subtle"
            data-test="quiz-original-partial"
            >这份旧记录未保存完整材料，原答保留。</text
          >
          <text v-if="learning.activeQuestion.prerequisite" class="subtle" aria-label="先修诊断依据" selectable>
            {{ learning.activeQuestion.prerequisite.reason }}
          </text>
          <view v-if="learning.activeQuestion.prerequisite" class="button-row">
            <text class="subtle">先修诊断：{{ learning.diagnosticProgress?.text }}</text>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy"
              :aria-disabled="learning.busy"
              @tap="learning.focus(learning.activeQuestion.prerequisite.originalQuestionKey)"
            >
              返回诊断原题
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="sendDirective('独立检验原题')"
            >
              独立检验原题
            </button>
          </view>
          <button
            v-else-if="learning.canDiagnose"
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.busy || learning.active.stopped"
            :aria-disabled="learning.busy || learning.active.stopped"
            @tap="sendDirective('开始先修诊断')"
          >
            开始先修诊断
          </button>
          <view v-if="learning.questionImage" class="button-row">
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="interpretImage"
            >
              看图讲解
            </button>
            <text class="subtle">发送前需确认；识别结果待校对。</text>
          </view>
          <view v-if="learning.canComputeReference" class="button-row">
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="computeReference"
            >
              计算参考
            </button>
          </view>
          <view v-if="learning.canCheckGrammar" class="button-row">
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="checkGrammar"
            >
              检查语法
            </button>
          </view>
          <NumberLine
            v-if="
              !learning.active.stopped &&
              learning.activeStrategy.method === 'diagram' &&
              learning.active.messages.some(
                (m) => m.method === 'diagram' && m.questionKey === learning.active.activeQuestionKey
              )
            "
            :question="learning.activeQuestion"
          />
          <VelocityTimeGraph
            v-if="learning.activeQuestion.scienceExercise?.input.template === 'velocity_time_graph'"
            :points="learning.activeQuestion.scienceExercise.input.points"
            :visible="labVisible"
          />
          <view v-if="choiceOptions.length" class="choice-options" aria-label="答案选项">
            <button
              v-for="option in choiceOptions"
              :key="option.value"
              role="button"
              tabindex="0"
              :aria-pressed="selectedChoices.includes(option.value)"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="chooseAnswer(option.value)"
            >
              {{ option.label }}
            </button>
            <button
              v-if="!learning.activeQuestion.scienceExercise"
              class="quiet-button"
              role="checkbox"
              tabindex="0"
              :aria-checked="multipleChoices"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="toggleMultipleChoices"
            >
              {{ multipleChoices ? '☑' : '☐' }} 多选
            </button>
          </view>
          <template v-else
            ><text v-for="(option, index) in learning.activeQuestion.options || []" :key="index">{{
              option
            }}</text></template
          >
          <text v-for="(issue, index) in learning.activeQuestion.uncertainties || []" :key="index" class="warning">
            {{ issue.resolved ? '已校对' : '待校对' }}：{{ issue.field }} {{ issue.reason }}
          </text>
          <view v-if="learning.activeQuestion.rubric" class="form">
            <text class="subtle">评分维度</text>
            <text v-for="criterion in learning.activeQuestion.rubric.criteria" :key="criterion.id" class="subtle">
              {{ criterion.name }}（{{ criterion.maxScore }}分）{{
                learning.activeQuestion.writingExercise ? '' : `：${criterion.description}`
              }}
            </text>
          </view>
          <view
            v-if="learning.activeQuestion.writingExercise && rubricAttempt"
            class="button-row"
            aria-label="写作操作"
          >
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="run(() => learning.requestWritingFeedback())"
            >
              获取反馈
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="variant"
            >
              换题练习
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped || !!learning.writingRetest"
              :aria-disabled="learning.busy || learning.active.stopped || !!learning.writingRetest"
              @tap="planWritingRetest"
            >
              {{
                learning.writingRetest ? `已安排 ${learning.writingRetest.day.slice(5).replace('-', '/')}` : '明日复测'
              }}
            </button>
          </view>
          <view
            v-if="learning.activeQuestion.vocabularyReview?.phase === 'usage' && rubricAttempt"
            class="button-row"
            aria-label="词语使用反馈"
          >
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
              :aria-disabled="learning.busy || learning.active.stopped"
              @tap="run(() => learning.requestVocabularyFeedback())"
            >
              获取反馈
            </button>
          </view>
          <view v-if="rubricAssessment" class="form" aria-label="当前作答的辅助评分">
            <text v-if="rubricAssessment.vocabularyUse" class="warning">AI 反馈 · 待核对</text>
            <text v-else class="warning">
              AI 评分 · 待核对 {{ rubricAssessment.score === null ? '未定分' : rubricAssessment.score }} /
              {{ rubricAssessment.maxScore }}
            </text>
            <RubricEvidence
              :attempt="rubricAttempt"
              :assessment="rubricAssessment"
              :context-key="learning.recordContext()"
            />
          </view>
          <view
            v-if="learning.activeQuestion.scienceExercise && rubricAttempt"
            class="button-row"
            aria-label="科学检验操作"
          >
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped || !!learning.scienceRetest"
              :aria-disabled="learning.busy || learning.active.stopped || !!learning.scienceRetest"
              @tap="run(() => learning.scheduleScienceRetest())"
            >
              {{
                learning.scienceRetest ? `已安排 ${learning.scienceRetest.day.slice(5).replace('-', '/')}` : '明日复测'
              }}
            </button>
          </view>
          <text
            v-if="
              (learning.activeQuestion.scienceExercise?.phase === 'retest' && !learning.scienceCanSubmit()) ||
              (learning.activeQuestion.writingExercise?.phase === 'retest' && !learning.writingCanSubmit()) ||
              (learning.activeQuestion.vocabularyReview?.phase === 'retest' && !learning.vocabularyCanSubmit())
            "
            class="subtle"
            >{{
              (
                learning.activeQuestion.scienceExercise?.dueDay ||
                learning.activeQuestion.writingExercise?.dueDay ||
                learning.activeQuestion.vocabularyReview?.dueDay
              )
                .slice(5)
                .replace('-', '/')
            }}
            复测</text
          >
          <view class="button-row">
            <button role="button" tabindex="0" size="mini" @tap="hint">提示</button>
            <button
              v-if="
                !learning.activeQuestion.writingExercise &&
                !learning.activeQuestion.vocabularyReview &&
                !learning.activeQuestion.sentenceExercise
              "
              role="button"
              tabindex="0"
              size="mini"
              @tap="variant"
            >
              变式练习
            </button>
            <button
              v-if="
                !learning.activeQuestion.scienceExercise &&
                !learning.activeQuestion.vocabularyReview &&
                !learning.activeQuestion.sentenceExercise
              "
              role="button"
              tabindex="0"
              size="mini"
              @tap="editQuestion"
            >
              校对题目
            </button>
            <button
              v-if="
                learning.activeQuestion.answerType === 'subjective' &&
                !learning.activeQuestion.validation &&
                !learning.activeQuestion.vocabularyReview
              "
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.materialBusy || learning.syncBusy"
              :aria-disabled="learning.busy || learning.materialBusy || learning.syncBusy"
              @tap="editRubric"
            >
              评分维度
            </button>
          </view>
          <view v-if="showRubric" class="form" aria-label="主观题评分维度编辑">
            <view v-for="(criterion, index) in rubricCriteria" :key="criterion.id" class="form">
              <input
                v-model="criterion.name"
                :aria-label="`维度${index + 1}名称`"
                placeholder="维度名称，如 概念准确"
              />
              <textarea
                v-model="criterion.description"
                class="field"
                :aria-label="`维度${index + 1}要求`"
                placeholder="本维度具体要求，可接受的表达或步骤"
              ></textarea>
              <input
                v-model.number="criterion.maxScore"
                type="number"
                :aria-label="`维度${index + 1}满分`"
                placeholder="满分0.5至10，按0.5递增"
              />
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="rubricCriteria.length === 1"
                :aria-disabled="rubricCriteria.length === 1"
                @tap="rubricCriteria.splice(index, 1)"
              >
                移除此维度
              </button>
            </view>
            <view class="button-row">
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="rubricCriteria.length >= 6"
                :aria-disabled="rubricCriteria.length >= 6"
                @tap="addRubricCriterion"
              >
                增加维度
              </button>
              <button role="button" tabindex="0" size="mini" @tap="saveRubric">保存评分维度</button>
              <button role="button" tabindex="0" size="mini" @tap="showRubric = false">取消编辑</button>
            </view>
          </view>
        </view>
        <view v-if="learning.active.stopped" class="button-row">
          <text class="warning">已停止</text>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.busy"
            :aria-disabled="learning.busy"
            @tap="sendDirective('继续当前任务')"
          >
            继续当前任务
          </button>
        </view>
        <view class="method-heading">
          <button
            class="quiet-button"
            role="button"
            tabindex="0"
            :aria-expanded="showMethods"
            @tap="showMethods = !showMethods"
          >
            {{ showMethods ? '收起方法' : '更多方法' }}
          </button>
        </view>
        <view class="button-row methods">
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.busy"
            :aria-disabled="learning.busy"
            @tap="sendDirective('恢复自动教法')"
          >
            恢复自动教法
          </button>
          <button
            v-for="action in visibleActions"
            :key="action"
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.busy && action !== '停止当前任务'"
            :aria-disabled="learning.busy && action !== '停止当前任务'"
            @tap="sendDirective(action)"
          >
            {{ action }}
          </button>
        </view>
        <view v-if="learning.streamPreview" class="message notice" aria-live="polite">
          <text class="subtle">生成中 · 未确认</text>
          <text>{{ learning.streamPreview }}</text>
        </view>
        <view v-if="learning.recoverableRequest && !learning.busy" class="button-row">
          <text class="subtle">回复未确认，可恢复原结果。</text>
          <button role="button" tabindex="0" size="mini" @tap="run(() => learning.recoverModelResult())">
            恢复回复
          </button>
        </view>
        <OatutorPractice
          v-if="learning.activeQuestion?.oatutorExercise?.role === 'main'"
          :question="learning.activeQuestion"
          :state="learning.state"
          :context="learning.oatutorContext()"
          :visible="labVisible"
          :stopped="!!learning.active.stopped"
          :busy="learning.busy || learning.materialBusy || learning.syncBusy || learning.historyBusy"
          :action="learning.oatutorAction"
          :start-task="learning.startOatutor"
        />
        <SentenceBuilder
          v-if="learning.activeQuestion?.sentenceExercise"
          :question="learning.activeQuestion"
          :state="learning.state"
          :context="labContext"
          :visible="labVisible"
          :stopped="!!learning.active.stopped"
          :busy="learning.busy || learning.materialBusy || learning.syncBusy || learning.historyBusy"
          :ready="learning.sentenceCanSubmit()"
          :retest="learning.sentenceRetest"
          :submit-order="learning.submitSentence"
          :record-help="learning.recordSentenceHelp"
          :next-task="learning.startSentenceTask"
          :schedule-retest="learning.scheduleSentenceRetest"
        />
        <view id="learning-composer" class="composer">
          <textarea
            :value="draft"
            class="field"
            :aria-label="
              learning.batchTrainingActive
                ? '训练提问'
                : learning.activeQuestion?.writingExercise
                  ? `${activeWritingGenre.label}作答`
                  : '消息或作答'
            "
            :placeholder="
              learning.batchTrainingActive
                ? '提问或调整这组训练'
                : learning.activeQuestion?.writingExercise
                  ? `写你的${activeWritingGenre.label}`
                  : '提问或写下答案'
            "
            placeholder-class="space-placeholder"
            :maxlength="
              learning.activeQuestion?.writingExercise || learning.activeQuestion?.vocabularyReview?.phase === 'usage'
                ? writingAnswerLimit(learning.activeQuestion)
                : 8000
            "
            @input="draft = textInputValue($event)"
          ></textarea>
          <view class="button-row">
            <button v-if="learning.busy" role="button" tabindex="0" @tap="learning.cancel">取消请求</button>
            <button
              v-else
              role="button"
              tabindex="0"
              class="primary"
              :disabled="!draft.trim()"
              :aria-disabled="!draft.trim()"
              @tap="send"
            >
              {{ learning.batchTrainingActive || learning.activeQuestion?.writingExercise ? '提问' : '发送' }}
            </button>
            <button
              v-if="
                learning.activeQuestion && !learning.batchTrainingActive && !learning.activeQuestion.sentenceExercise
              "
              role="button"
              tabindex="0"
              size="mini"
              :disabled="
                learning.busy ||
                !draft.trim() ||
                learning.active.stopped ||
                !learning.scienceCanSubmit() ||
                !learning.writingCanSubmit() ||
                !learning.vocabularyCanSubmit()
              "
              :aria-disabled="
                learning.busy ||
                !draft.trim() ||
                learning.active.stopped ||
                !learning.scienceCanSubmit() ||
                !learning.writingCanSubmit() ||
                !learning.vocabularyCanSubmit()
              "
              @tap="submitExplicit"
            >
              提交作答
            </button>
          </view>
        </view>
      </view>
      <LearningLab
        v-if="
          !learning.batchTrainingActive &&
          !learning.activeQuestion?.sentenceExercise &&
          !learning.activeQuestion?.oatutorExercise &&
          ![DENSITY_TRANSFER_CONTRACT, PRESSURE_TRANSFER_CONTRACT].includes(
            learning.activeQuestion?.scienceExercise?.contract
          )
        "
        :state="learning.state"
        :conversation-id="learning.selectedConversationId"
        :context="labContext"
        :visible="labVisible"
        :stopped="!!learning.active?.stopped"
        :busy="learning.busy || learning.materialBusy || learning.syncBusy || learning.historyBusy"
        :record-writing-help="recordWritingPracticeHelp"
        :read-writing-reference="readWritingPracticeReference"
        :open-vocabulary="openWritingVocabulary"
        :submit-vocabulary="submitWritingVocabulary"
        :vocabulary-task-for="learning.vocabularyTaskFor"
        :start-vocabulary-task="startWritingVocabularyTask"
        :record-diagram-help="recordDiagramPracticeHelp"
        :record-science-help="recordSciencePracticeHelp"
        :question="learning.activeQuestion"
        :request="learning.visualRequest"
        :icon-color="iconColor"
        @question="openLabQuestion"
        @writing="startIndependentWriting"
        @science="startIndependentScience"
      />
      <DensityPractice
        v-if="
          [DENSITY_TRANSFER_CONTRACT, PRESSURE_TRANSFER_CONTRACT].includes(
            learning.activeQuestion?.scienceExercise?.contract
          )
        "
        :question="learning.activeQuestion"
        :context="labContext"
        :visible="labVisible"
        :stopped="!!learning.active?.stopped"
        :busy="learning.busy || learning.materialBusy || learning.syncBusy || learning.historyBusy"
        :record-help="recordSciencePracticeHelp"
        @science="startIndependentScience"
      />
      <view class="today-layout" :class="{ 'in-session': !!learning.active }">
        <view class="rhythm-panel">
          <view class="rhythm-heading">
            <text class="section-title">学习方式</text>
          </view>
          <view class="rhythm-options">
            <button
              v-for="rhythm in learningRhythms"
              :key="rhythm.id"
              role="button"
              tabindex="0"
              :aria-pressed="selectedRhythm === rhythm.id"
              :class="{ chosen: selectedRhythm === rhythm.id }"
              :disabled="learning.busy"
              :aria-disabled="learning.busy"
              @tap="chooseRhythm(rhythm.id)"
            >
              <BaseIcon :name="rhythm.icon" :size="36" :color="iconColor" />
              <view class="rhythm-copy">
                <text class="rhythm-name">{{ rhythm.label }}</text>
              </view>
              <BaseIcon v-if="selectedRhythm === rhythm.id" name="check" :size="32" :color="iconColor" />
            </button>
          </view>
          <text v-if="rhythmFeedback" class="subtle" role="status">{{ rhythmFeedback }}</text>
        </view>
        <LearningOverview v-if="!learning.active" :show-navigation="false" />
      </view>
      <view class="workspace-tools">
        <view class="button-row">
          <button
            role="button"
            tabindex="0"
            size="mini"
            :aria-expanded="showMaterial"
            @tap="showMaterial = !showMaterial"
          >
            <BaseIcon name="folder" :size="30" :color="iconColor" />
            资料
          </button>
          <button role="button" tabindex="0" size="mini" :aria-expanded="showProfile" @tap="showProfile = !showProfile">
            目标与计划
          </button>
          <button role="button" tabindex="0" size="mini" :aria-expanded="showData" @tap="showData = !showData">
            记录与隐私
          </button>
        </view>
        <view v-if="showData" class="panel">
          <text class="section-title">记录与隐私</text>
          <text class="subtle">记录保存在本设备；同步前需授权，导出不含密钥。</text>
          <view class="button-row">
            <button role="button" tabindex="0" size="mini" @tap="exportRecords">导出记录</button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :aria-expanded="showRestore"
              @tap="showRestore = !showRestore"
            >
              恢复备份
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="recordActionsBusy"
              :aria-disabled="recordActionsBusy"
              @tap="syncRecords"
            >
              同步学习记录
            </button>
            <button v-if="learning.syncBusy" role="button" tabindex="0" size="mini" @tap="learning.cancelSync">
              {{ learning.syncState.kind === 'delete' ? '取消删除请求' : '取消同步' }}
            </button>
            <button
              v-if="learning.state.owner !== 'guest'"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="recordActionsBusy"
              :aria-disabled="recordActionsBusy"
              @tap="previewGuestRecords"
            >
              预览访客记录
            </button>
            <button role="button" tabindex="0" size="mini" @tap="deleteRecords">删除本地记录</button>
            <button
              v-if="learning.state.owner !== 'guest'"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="recordActionsBusy"
              :aria-disabled="recordActionsBusy"
              @tap="deleteCloudRecords"
            >
              删除云端学习副本
            </button>
          </view>
          <view
            v-if="learning.syncState.message"
            class="material-status"
            :class="{ warning: learning.syncState.phase === 'error' }"
            :role="learning.syncState.phase === 'error' ? 'alert' : 'status'"
            aria-live="polite"
            :aria-busy="learning.syncState.phase === 'loading'"
            data-test="record-sync-status"
          >
            <WdLoading
              v-if="learning.syncState.phase === 'loading'"
              class="feedback-loading"
              type="ring"
              size="24px"
              :color="iconColor"
              aria-hidden="true"
            />
            <text>{{ learning.syncState.message }}</text>
          </view>
          <view
            v-if="recordPreviewStatus.message"
            class="material-status"
            :class="{ warning: recordPreviewStatus.phase === 'error' }"
            :role="recordPreviewStatus.phase === 'error' ? 'alert' : 'status'"
            aria-live="polite"
            :aria-busy="recordPreviewStatus.phase === 'loading'"
            data-test="record-preview-status"
          >
            <WdLoading
              v-if="recordPreviewStatus.phase === 'loading'"
              :key="iconColor"
              type="outline"
              :color="iconColor"
              :size="20"
              aria-hidden="true"
            />
            <text>{{ recordPreviewStatus.message }}</text>
          </view>
          <view v-if="recordPreviewBusy || learning.historyBusy">
            <text v-if="learning.historyProgress" class="subtle"
              >正在检查 {{ learning.historyProgress.completed }} / {{ learning.historyProgress.total }}</text
            >
            <button role="button" tabindex="0" size="mini" @tap="cancelRecordPreview">取消历史校验</button>
          </view>
          <text v-if="learning.syncBusy && learning.syncProgress" class="subtle" role="status"
            >{{ learning.syncProgress.phase }} · {{ learning.syncProgress.calls }} 次请求</text
          >
          <view
            v-if="learning.syncBusy && syncOperationProgress"
            class="material-progress"
            role="progressbar"
            aria-label="本次学习操作补传进度"
            aria-valuemin="0"
            :aria-valuemax="syncOperationProgress.total"
            :aria-valuenow="syncOperationProgress.completed"
            :aria-valuetext="
              '云端已接收 ' +
              syncOperationProgress.completed +
              ' / ' +
              syncOperationProgress.total +
              ' 个操作，完整结果仍需核对'
            "
            data-test="record-sync-progress"
          >
            <view
              class="material-progress-fill"
              :style="{ transform: 'scaleX(' + syncOperationProgress.percentage / 100 + ')' }"
            />
          </view>
          <text v-if="learning.syncBusy && syncOperationProgress" class="subtle" role="status"
            >本次补传：云端已接收 {{ syncOperationProgress.completed }} /
            {{ syncOperationProgress.total }} 个学习操作；完整结果仍需核对。</text
          >
          <view v-if="guestPreview" class="form">
            <text class="subtle" role="status"
              >访客新增 {{ guestPreview.imported }} 个操作 · 已有 {{ guestPreview.reused }} 个操作 · 合并
              {{ guestPreview.mergedPlans }} 份计划 · {{ guestPreview.pendingReferences }} 道题待核对</text
            >
            <text class="subtle">确认记录属于你后，合并到当前账户；访客原件保留。</text>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="recordActionsBusy || !guestPreview.imported"
              :aria-disabled="recordActionsBusy || !guestPreview.imported"
              @tap="migrateGuestRecords"
            >
              确认访客记录归属
            </button>
          </view>
          <view v-if="learning.syncConflict" class="form">
            <text class="section-title">同步冲突待处理</text>
            <text class="subtle"
              >本机 {{ learning.syncConflict.localEvents }} 条 · 云端 {{ learning.syncConflict.remoteEvents }} 条</text
            >
            <view class="button-row">
              <button role="button" tabindex="0" size="mini" @tap="exportConflict('local')">导出本机冲突副本</button>
              <button role="button" tabindex="0" size="mini" @tap="exportConflict('remote')">导出云端冲突副本</button>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="recordActionsBusy"
                :aria-disabled="recordActionsBusy"
                @tap="resolveConflict('remote')"
              >
                采用云端继续
              </button>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="recordActionsBusy"
                :aria-disabled="recordActionsBusy"
                @tap="resolveConflict('local')"
              >
                恢复本机冲突副本
              </button>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="recordActionsBusy"
                :aria-disabled="recordActionsBusy"
                @tap="removeConflict"
              >
                移除已保存的冲突副本
              </button>
            </view>
          </view>
          <view v-if="showRestore" class="form">
            <!-- #ifdef H5 -->
            <view class="button-row">
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="recordActionsBusy"
                :aria-disabled="recordActionsBusy"
                @tap="chooseBackupFile"
              >
                选择备份文件
              </button>
              <button
                v-if="recordFileBusy && !desktopHost"
                role="button"
                tabindex="0"
                size="mini"
                @tap="cancelRecordFile('已取消选择或读取备份，原输入和记录保留。', 'cancelled')"
              >
                取消文件读取
              </button>
            </view>
            <view
              v-if="recordFileStatus.message"
              class="material-status"
              :class="{ warning: recordFileStatus.phase === 'error' }"
              :role="recordFileStatus.phase === 'error' ? 'alert' : 'status'"
              aria-live="polite"
              :aria-busy="recordFileBusy"
              data-test="record-file-status"
            >
              <WdLoading v-if="recordFileBusy" type="outline" :color="iconColor" :size="20" aria-hidden="true" />
              <text>{{ recordFileStatus.message }}</text>
            </view>
            <text class="subtle">文件仅在本设备读取。</text>
            <!-- #endif -->
            <textarea
              v-if="backupText.length <= HISTORY_LIMITS.pageCharacters || backupExpanded"
              v-model="backupText"
              class="field"
              aria-label="学习记录 JSON 备份"
              placeholder="粘贴导出的 learning-records.json 内容"
              :maxlength="12000000"
            ></textarea>
            <view
              v-if="backupText.length > HISTORY_LIMITS.pageCharacters"
              class="material-status material-status--stack"
              data-test="record-large-backup"
            >
              <text class="subtle" role="status">已载入 {{ backupText.length }} 字符，尚未合并。</text>
              <button role="button" tabindex="0" size="mini" @tap="backupExpanded = !backupExpanded">
                {{ backupExpanded ? '收起正文' : '展开完整正文' }}
              </button>
              <button role="button" tabindex="0" size="mini" @tap="backupText = ''">清除并重新粘贴</button>
            </view>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="recordActionsBusy || !backupText.trim()"
              :aria-disabled="recordActionsBusy || !backupText.trim()"
              @tap="previewRecords"
            >
              校验并预览
            </button>

            <view v-if="restorePreview">
              <text class="subtle" role="status">
                新增 {{ restorePreview.imported }} 个操作 · 已有 {{ restorePreview.reused }} 个操作 ·
                {{ restorePreview.pendingReferences }} 道题待核对 · {{ restorePreview.pendingReviews }} 项复习暂停
              </text>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="recordActionsBusy || !restorePreview.imported"
                :aria-disabled="recordActionsBusy || !restorePreview.imported"
                @tap="restoreRecords"
              >
                确认合并记录
              </button>
            </view>
            <button role="button" tabindex="0" size="mini" @tap="rollbackRecords">撤销最近一次写入</button>
          </view>
        </view>
        <view v-if="showMaterial" id="material-intake" class="form panel">
          <text class="section-title">资料</text>
          <textarea
            v-model="materialText"
            class="field"
            aria-label="粘贴的私人资料"
            placeholder="粘贴资料"
            maxlength="50000"
          ></textarea>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="!materialText.trim() || materialActionBusy"
            :aria-disabled="!materialText.trim() || materialActionBusy"
            @tap="importText"
          >
            保存文字
          </button>
          <!-- #ifdef H5 || MP-WEIXIN || APP-PLUS -->
          <button
            role="button"
            tabindex="0"
            size="mini"
            :aria-expanded="showMaterialSettings"
            @tap="showMaterialSettings = !showMaterialSettings"
          >
            解析设置
          </button>
          <view v-if="showMaterialSettings">
            <input
              v-model="materialEndpoint"
              aria-label="资料解析器地址"
              :disabled="materialActionBusy"
              placeholder="解析服务地址"
            />
            <input
              v-model="materialToken"
              aria-label="资料解析器令牌"
              :disabled="materialActionBusy"
              password
              placeholder="连接令牌"
            />
            <view class="button-row">
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="materialActionBusy"
                :aria-disabled="materialActionBusy"
                @tap="connectMaterial"
              >
                {{ learning.materialConnectionBusy ? '连接中' : '授权并连接' }}
              </button>
              <button
                v-if="learning.materialConnectionBusy"
                role="button"
                tabindex="0"
                size="mini"
                @tap="learning.cancelMaterial"
              >
                取消连接检查
              </button>
            </view>
            <view
              v-if="learning.materialConnectionBusy"
              class="material-status"
              role="status"
              aria-live="polite"
              data-test="material-connection-pending"
            >
              <WdLoading :key="iconColor" type="outline" :color="iconColor" :size="20" aria-hidden="true" />
              <text>连接中，尚未发送资料。</text>
            </view>
            <text v-if="learning.materialConnection?.status" class="subtle">已连接，文件仅发送到此地址。</text>
            <text v-if="appleReadinessMessage" class="subtle" role="status" data-test="apple-readiness-status">{{
              appleReadinessMessage
            }}</text>
            <label @tap="allowMaterialRecognition = !allowMaterialRecognition">
              <checkbox :checked="allowMaterialRecognition" />识别图片文字
            </label>
            <view data-test="ocr-engine-choice" class="row wrap">
              <button
                role="button"
                tabindex="0"
                size="mini"
                :aria-pressed="materialRecognitionEngine === 'tesseract'"
                @tap="materialRecognitionEngine = 'tesseract'"
              >
                {{ allowMaterialRecognition ? '通用识别' : '普通提取' }}
              </button>
              <button
                v-if="allowMaterialRecognition"
                role="button"
                tabindex="0"
                size="mini"
                :disabled="!appleVisionAvailable"
                :aria-disabled="!appleVisionAvailable"
                :aria-pressed="materialRecognitionEngine === 'apple-vision'"
                @tap="materialRecognitionEngine = 'apple-vision'"
              >
                Apple 识别
              </button>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="!doclingAvailable"
                :aria-disabled="!doclingAvailable"
                :aria-pressed="materialRecognitionEngine === 'docling'"
                data-test="docling-choice"
                @tap="materialRecognitionEngine = 'docling'"
              >
                版面整理
              </button>
            </view>
            <text v-if="materialRecognitionEngine === 'docling'" class="subtle"
              >适合PDF双栏和表格，每次最多4页，可随时取消。</text
            >
          </view>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="materialFileChoiceBusy"
            :aria-disabled="materialFileChoiceBusy"
            @tap="chooseMaterialFile"
          >
            选择 PDF / 作答图片
          </button>
          <view
            v-if="appFileBusy && !learning.materialBusy"
            class="material-status"
            role="status"
            aria-live="polite"
            data-test="material-app-file-pending"
          >
            <WdLoading :key="iconColor" type="outline" :color="iconColor" :size="20" aria-hidden="true" />
            <text>{{ selectedAppFile ? '正在读取文件' : '请选择文件' }}</text>
            <button v-if="!selectedAppFile" role="button" tabindex="0" size="mini" @tap="cancelAppFile">
              取消文件选择
            </button>
          </view>
          <view v-if="clientPlatform === 'app' && selectedAppFile" data-test="app-selected-file" class="button-row">
            <text class="subtle">{{ selectedAppFile.name }} · {{ selectedAppFile.size }} 字节 · 尚未发送</text>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="appFileBusy || learning.materialBusy"
              :aria-disabled="appFileBusy || learning.materialBusy"
              @tap="parseSelectedAppFile"
            >
              确认解析所选文件
            </button>
            <button role="button" tabindex="0" size="mini" @tap="cancelAppFile">取消所选文件</button>
          </view>
          <!-- #endif -->
          <view
            v-if="clientFilePhase && clientFilePhase !== 'import'"
            class="material-status"
            role="status"
            aria-live="polite"
            data-test="material-file-pending"
          >
            <WdLoading
              v-if="clientFilePhase === 'read'"
              :key="iconColor"
              type="outline"
              :color="iconColor"
              :size="20"
              aria-hidden="true"
            />
            <text>{{
              clientFilePhase === 'choose'
                ? '请选择文件'
                : clientFilePhase === 'confirm'
                  ? '等待发送确认'
                  : '正在读取文件'
            }}</text>
            <button role="button" tabindex="0" size="mini" @tap="cancelClientFile">取消所选文件</button>
          </view>
          <view
            v-if="learning.materialImportState"
            class="material-status material-status--stack"
            role="status"
            aria-live="polite"
            data-test="material-import-state"
          >
            <view class="material-status-heading">
              <WdLoading
                v-if="learning.materialImportState.phase === 'processing'"
                :key="iconColor"
                type="outline"
                :color="iconColor"
                :size="20"
                aria-hidden="true"
              />
              <text>{{ materialImportLabel }}</text>
            </view>
            <view
              v-if="materialPageProgress"
              class="material-progress"
              role="progressbar"
              aria-label="资料页处理进度"
              aria-valuemin="0"
              :aria-valuemax="materialPageProgress.total"
              :aria-valuenow="materialPageProgress.completed"
              :aria-valuetext="'已处理 ' + materialPageProgress.completed + ' / ' + materialPageProgress.total + ' 页'"
            >
              <view
                class="material-progress-fill"
                :style="{ transform: 'scaleX(' + materialPageProgress.percentage / 100 + ')' }"
              />
            </view>
            <text v-if="materialPageProgress" class="subtle"
              >已处理 {{ materialPageProgress.completed }} / {{ materialPageProgress.total }} 页</text
            >
            <text v-if="['failed', 'cancelled', 'partial'].includes(learning.materialImportState.phase)" class="subtle"
              >请继续未完成页，或重试失败页。</text
            >
            <button
              v-if="learning.materialImportState.phase === 'processing' && learning.materialBusy"
              role="button"
              tabindex="0"
              size="mini"
              @tap="learning.cancelMaterial"
            >
              取消后续处理
            </button>
          </view>
          <view
            v-if="materialFeedback"
            class="material-status material-status--stack"
            :class="{ 'material-status--error': materialFeedback.kind === 'error' }"
            :role="materialFeedback.kind === 'error' ? 'alert' : 'status'"
            aria-live="polite"
            data-test="material-feedback"
          >
            <text>{{ materialFeedback.message }}</text>
          </view>
          <view
            v-if="!learning.state.materials.length && !materialActionBusy"
            class="material-empty"
            data-test="material-empty"
          >
            <text>暂无资料</text>
          </view>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :aria-expanded="showImportTools"
            @tap="showImportTools = !showImportTools"
          >
            导入记录
          </button>
          <view v-if="showImportTools">
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="
                learning.materialBusy ||
                learning.busy ||
                learning.syncBusy ||
                !learning.materialConnection?.capabilities?.uploadMaintenance?.available
              "
              :aria-disabled="
                learning.materialBusy ||
                learning.busy ||
                learning.syncBusy ||
                !learning.materialConnection?.capabilities?.uploadMaintenance?.available
              "
              @tap="previewUploadMaintenance"
            >
              预览登记整理
            </button>
            <view v-if="uploadMaintenancePreview" data-test="upload-maintenance-preview">
              <text
                >已关闭 {{ uploadMaintenancePreview.closedCount }} 项 · 未确认或已收存
                {{ uploadMaintenancePreview.openCount }} 项 · 总名额 {{ uploadMaintenancePreview.maxReceipts }} 项</text
              >
              <text class="subtle">仅清理已关闭记录，待办和原件保留。</text>
              <text v-if="uploadMaintenancePreview.pending"
                >上次清理尚未完成 · {{ uploadMaintenancePreview.plannedCount }} 项</text
              >
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="
                  learning.materialBusy ||
                  learning.busy ||
                  learning.syncBusy ||
                  (!uploadMaintenancePreview.pending && !uploadMaintenancePreview.closedCount)
                "
                :aria-disabled="
                  learning.materialBusy ||
                  learning.busy ||
                  learning.syncBusy ||
                  (!uploadMaintenancePreview.pending && !uploadMaintenancePreview.closedCount)
                "
                @tap="compactUploadReceipts"
              >
                确认整理已关闭登记
              </button>
            </view>
            <button role="button" tabindex="0" size="mini" @tap="showLocator = !showLocator">定位登记导出与恢复</button>
            <view v-if="showLocator" data-test="upload-locator-panel">
              <text class="subtle">导出不含正文或令牌，请妥善保存。</text>
              <textarea
                v-model="locatorText"
                aria-label="待办定位 JSON"
                class="field"
                maxlength="2500"
                placeholder="粘贴本机导出的定位登记 JSON"
              ></textarea>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="!locatorText || learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                :aria-disabled="
                  !locatorText || learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy
                "
                @tap="restorePendingLocator"
              >
                恢复定位待办
              </button>
              <view v-if="pendingRemovalPreview" data-test="pending-upload-removal">
                <text
                  >本次移除目标 {{ pendingRemovalPreview.entry.connectorOrigin }} ·
                  {{ pendingRemovalPreview.entry.id }}</text
                >
                <button role="button" tabindex="0" size="mini" @tap="downloadPendingLocator">保存本次定位登记</button>
                <checkbox-group
                  data-test="locator-removal-ack"
                  @change="pendingRemovalAcknowledged = ($event.detail?.value || []).includes('saved')"
                >
                  <label
                    ><checkbox
                      value="saved"
                      :checked="pendingRemovalAcknowledged"
                    />已另行保存本次定位信息或确认放弃恢复；远端原件未核验。</label
                  >
                </checkbox-group>
                <button
                  role="button"
                  tabindex="0"
                  size="mini"
                  :disabled="
                    !pendingRemovalAcknowledged ||
                    learning.materialBusy ||
                    learning.busy ||
                    learning.syncBusy ||
                    appFileBusy
                  "
                  :aria-disabled="
                    !pendingRemovalAcknowledged ||
                    learning.materialBusy ||
                    learning.busy ||
                    learning.syncBusy ||
                    appFileBusy
                  "
                  @tap="forgetPendingUpload"
                >
                  确认仅移除本机待办
                </button>
              </view>
            </view>
            <view v-for="entry in learning.pendingUploads" :key="entry.id" class="model-row" data-test="pending-upload">
              <text>导入回执待核对 · {{ entry.id.slice(-8) }} · {{ entry.size }} 字节</text>
              <text class="subtle">{{ entry.connectorOrigin }}</text>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                :aria-disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                @tap="pendingUploadAction(entry, 'inspect')"
              >
                核对原件状态
              </button>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                :aria-disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                @tap="pendingUploadAction(entry, 'recover')"
              >
                恢复已收原件
              </button>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                :aria-disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                @tap="pendingUploadAction(entry, 'close')"
              >
                取消登记并核对原件
              </button>
              <button
                role="button"
                tabindex="0"
                size="mini"
                :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                :aria-disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
                @tap="exportPendingLocator(entry)"
              >
                导出定位与移除待办
              </button>
            </view>
          </view>
          <view v-for="material in learning.state.materials" :key="material.id" class="model-row">
            <text>{{ material.name }} · {{ material.segments.length }} 个片段 · 私人</text>
            <text v-if="material.recognitionEngine === 'apple-vision'" class="subtle">图片识别 · 待校对</text>
            <text v-if="material.recognitionEngine === 'docling'" class="subtle">版面整理 · 待核对</text>
            <button
              v-if="material.segments.some((segment) => segment.status === 'failed')"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="materialActionBusy"
              :aria-disabled="materialActionBusy"
              @tap="retryMaterial(material)"
            >
              重试未解析页
            </button>
            <button
              v-if="material.nextPage"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="materialActionBusy"
              :aria-disabled="materialActionBusy"
              @tap="resumeMaterial(material)"
            >
              继续解析后续页
            </button>
            <button role="button" tabindex="0" size="mini" @tap="selectMaterial(material)">用此资料练习</button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.materialBusy || learning.syncBusy"
              :aria-disabled="learning.busy || learning.materialBusy || learning.syncBusy"
              @tap="deleteMaterial(material)"
            >
              预览并删除资料
            </button>
          </view>
          <view
            v-for="deletion in (learning.state.materialDeletions || []).filter((d) => d.originalStatus === 'pending')"
            :key="deletion.deletionId"
            class="model-row"
          >
            <text>本机学习数据已清理；解析器原件删除待确认。原件编号 {{ deletion.original.fileId.slice(0, 12) }}</text>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.materialBusy || learning.syncBusy || learning.busy"
              :aria-disabled="learning.materialBusy || learning.syncBusy || learning.busy"
              @tap="retryOriginalDeletion(deletion)"
            >
              重试原件删除
            </button>
          </view>
          <view v-if="selectedMaterial" class="form">
            <view class="button-row">
              <button
                v-for="(segment, index) in currentEditorMaterial?.segments || []"
                :key="segment.id"
                role="button"
                tabindex="0"
                size="mini"
                @tap="selectSegment(segment)"
              >
                {{ segment.page ? '第 ' + segment.page + ' 页' : '片段 ' + (index + 1) }}
              </button>
            </view>
            <MaterialLayout
              v-if="selectedSegment?.extractionVersion === MATERIAL_LAYOUT_CONTRACT"
              :segment="selectedSegment"
            />
            <image
              v-else-if="selectedSegment?.preview"
              :src="selectedSegment.preview"
              mode="widthFix"
              class="source-preview"
            />
            <text
              v-if="selectedSegment?.extractionVersion !== MATERIAL_LAYOUT_CONTRACT"
              class="subtle source-excerpt"
              selectable
              >{{ selectedSegment?.content.slice(0, 300) }}</text
            >
            <text v-if="materialEditorSourceChanged" class="warning" role="status">
              此页已更新，请重新选择；当前草稿保留。
            </text>
            <view class="form" data-test="material-objective">
              <view class="button-row">
                <button
                  v-for="(label, kind) in objectiveKinds"
                  :key="kind"
                  role="button"
                  tabindex="0"
                  size="mini"
                  :data-test="'objective-kind-' + kind"
                  :aria-pressed="objectiveKind === kind"
                  @tap="objectiveKind = kind"
                >
                  {{ label }}
                </button>
              </view>
              <view v-if="objectiveFields.fields.length" class="form">
                <text class="subtle">选择{{ objectiveFromLabel }}</text>
                <view class="button-row" :aria-label="objectiveFromLabel">
                  <button
                    v-for="field in objectiveFields.fields"
                    :key="field.key"
                    role="button"
                    tabindex="0"
                    size="mini"
                    class="objective-field"
                    data-test="objective-field-from"
                    :aria-pressed="objectiveFrom === field.key"
                    @tap="objectiveFrom = field.key"
                  >
                    {{ field.key }}：{{ field.value }}
                  </button>
                </view>
                <template v-if="objectiveKind !== 'literal'">
                  <text class="subtle">选择{{ objectiveToLabel }}</text>
                  <view class="button-row" :aria-label="objectiveToLabel">
                    <button
                      v-for="field in objectiveFields.fields"
                      :key="field.key"
                      role="button"
                      tabindex="0"
                      size="mini"
                      class="objective-field"
                      data-test="objective-field-to"
                      :aria-pressed="objectiveTo === field.key"
                      @tap="objectiveTo = field.key"
                    >
                      {{ field.key }}：{{ field.value }}
                    </button>
                  </view>
                </template>
              </view>
              <button
                role="button"
                tabindex="0"
                size="mini"
                class="primary"
                data-test="start-objective"
                :disabled="Boolean(objectiveUnavailable)"
                :aria-disabled="Boolean(objectiveUnavailable)"
                @tap="structureObjective"
              >
                开始练习
              </button>
              <text v-if="objectiveUnavailable" class="subtle" data-test="objective-unavailable" role="status">
                {{ objectiveUnavailable }}
              </text>
            </view>
            <textarea v-model="privatePrompt" class="field" aria-label="题目" placeholder="题目"></textarea>
            <input v-model="privateAnswer" aria-label="参考答案" placeholder="参考答案（选填）" />
            <input v-model="importedUserAnswer" aria-label="纸面作答" placeholder="纸面作答（选填）" />
            <input v-model="teacherAnnotation" aria-label="教师批注" placeholder="教师批注（选填）" />
            <view @tap="privateConditionsConfirmed = !privateConditionsConfirmed">
              <checkbox :checked="privateConditionsConfirmed" />
              已校对题目条件
            </view>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="materialEditorSourceChanged"
              :aria-disabled="materialEditorSourceChanged"
              @tap="structurePrivateQuestion"
            >
              进入对话练习
            </button>
          </view>
        </view>
        <view v-if="showProfile" class="form panel">
          <text class="section-title">目标与计划</text>
          <text class="field-label">我的基础</text>
          <view class="button-row" aria-label="自述基础">
            <button
              v-for="option in foundationOptions"
              :key="option"
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="!customFoundation && foundation === option"
              :class="{ chosen: !customFoundation && foundation === option }"
              @tap="
                customFoundation = false;
                foundation = option;
              "
            >
              {{ option }}
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="customFoundation"
              @tap="
                customFoundation = true;
                foundation = '';
              "
            >
              其他
            </button>
          </view>
          <input v-if="customFoundation" v-model="foundation" aria-label="自述基础" placeholder="我的基础" />
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="!foundation.trim()"
            :aria-disabled="!foundation.trim()"
            @tap="saveFoundation"
          >
            保存基础
          </button>
          <text class="field-label">时区</text>
          <view class="button-row" aria-label="学习时区">
            <button
              v-for="option in timezoneOptions"
              :key="option.value"
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="!customTimezone && timezone === option.value"
              :class="{ chosen: !customTimezone && timezone === option.value }"
              @tap="
                customTimezone = false;
                timezone = option.value;
              "
            >
              {{ option.label }}
            </button>
            <button role="button" tabindex="0" size="mini" :aria-pressed="customTimezone" @tap="customTimezone = true">
              其他
            </button>
          </view>
          <input
            v-if="customTimezone"
            v-model="timezone"
            aria-label="自定义学习时区"
            placeholder="时区，如 Asia/Shanghai"
          />
          <button role="button" tabindex="0" size="mini" @tap="saveTimezone">保存时区</button>
          <text class="field-label">今日任务</text>
          <view class="button-row" aria-label="今日任务">
            <button
              v-for="option in planOptions"
              :key="option"
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="planLines.split('\n').includes(option)"
              :class="{ chosen: planLines.split('\n').includes(option) }"
              @tap="togglePlanTask(option)"
            >
              {{ option }}
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :aria-expanded="showPlanText"
              @tap="showPlanText = !showPlanText"
            >
              自定义任务
            </button>
          </view>
          <textarea
            v-if="showPlanText"
            :value="planLines"
            class="field"
            aria-label="自定义今日任务"
            placeholder="每行一个任务"
            @input="planLines = textInputValue($event)"
          ></textarea>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="!planLines.trim()"
            :aria-disabled="!planLines.trim()"
            @tap="savePlan"
          >
            保存计划
          </button>
          <text v-for="entry in learning.state.profile" :key="entry.id" class="subtle">
            {{ { foundation: '基础', preference: '学习方式' }[entry.field] || '偏好' }}：{{ entry.value }}
          </text>
        </view>
      </view>
      <text v-if="feedback || learning.error" class="warning feedback" role="alert">
        {{ feedback || learning.error }}
      </text>
    </view>
    <CustomModal
      :key="dialogState.id"
      :visible="dialogState.visible"
      :title="dialogState.title"
      :content="dialogState.content"
      :editable="dialogState.editable"
      :placeholder-text="dialogState.placeholderText"
      :confirm-text="dialogState.confirmText"
      :cancel-text="dialogState.cancelText"
      :show-cancel="dialogState.showCancel"
      :type="dialogState.type"
      :is-dark="theme.isDark"
      @confirm="dialogState.confirm"
      @cancel="dialogState.cancel"
      @closed="dialogState.closed"
    />
  </LearningShell>
</template>
<script setup>
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { isDesktopRuntime } from '@/services/desktop/runtime.js';
// #ifdef H5
import {
  saveDesktopLearningFile,
  readDesktopLearningBackup,
  chooseDesktopMaterialFile,
  readDesktopMaterialFile,
  discardDesktopMaterialFile
} from '@/services/desktop/learning-files.js';
import { chooseBrowserLearningBackup } from '@/services/learning/record-files.js';
// #endif
import { learningWriteProtectionSupported } from '@/services/learning/learning-write-lease.js';
import { HISTORY_LIMITS } from '../../../laf-backend/functions/_shared/learning-history.js';
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { BRAND } from '@/config/brand.js';
import { onShow, onHide, onLoad, onBackPress } from '@dcloudio/uni-app';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import WdLoading from 'wot-design-uni/components/wd-loading/wd-loading.vue';
import { createLearningDialog } from '@/services/learning/learning-dialog.js';
// #ifdef MP-WEIXIN
import PrivacyPopup from '@/components/common/privacy-popup.vue';
// #endif
import { learningRhythms, currentRhythm } from '@/services/learning/learning-rhythm.js';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import LearningJourney from '@/components/business/learning/learning-journey.vue';
import LearningMessage from '@/components/business/learning/learning-message.vue';
import LearningLab from '@/components/business/learning/learning-lab.vue';
import DensityPractice from '@/components/business/learning/density-practice.vue';
import {
  DENSITY_TRANSFER_CONTRACT,
  PRESSURE_TRANSFER_CONTRACT
} from '../../../laf-backend/functions/_shared/learning-science.js';
import SentenceBuilder from '@/components/business/learning/sentence-builder.vue';
import OatutorPractice from '@/components/business/learning/oatutor-practice.vue';
import NumberLine from '@/components/business/learning/number-line.vue';
import VelocityTimeGraph from '@/components/business/learning/velocity-time-graph.vue';
import RubricEvidence from '@/components/business/learning/rubric-evidence.vue';
import MaterialLayout from '@/components/business/learning/material-layout.vue';
import { structureMaterialCandidate } from '@/services/learning/material-intake.js';
import { quizOriginalReading } from '../../../laf-backend/functions/_shared/learning-quiz-original.js';
import {
  LEARNING_TRACKS,
  MATERIAL_LAYOUT_CONTRACT,
  LEARNING_START_TOPICS,
  materialObjectiveFields,
  createMaterialObjectiveQuestion
} from '@/services/learning/learning-domain.js';
import { learningClientPlatform } from '@/services/learning/local-connector.js';
import { chooseWeixinMaterialFile, readWeixinMaterialFile } from '@/services/learning/material-connector.js';
import {
  chooseAppMaterialFile,
  readAppMaterialFile,
  releaseAppMaterialFile
} from '@/services/learning/app-material.js';
import { useConversationLearningStore, learningId } from '@/stores/modules/conversation-learning.js';
import {
  writingGenre,
  writingGenreInfo,
  writingAnswerLimit
} from '../../../laf-backend/functions/_shared/learning-writing.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
const learning = useConversationLearningStore();
const quizOriginalView = computed(() => quizOriginalReading(learning.activeQuestion));
const theme = useThemeStore();
const labVisible = ref(true);
const labContext = computed(() => learning.writingContext());
const activeWritingGenre = computed(() => writingGenreInfo(writingGenre(learning.activeQuestion)));
function openLabQuestion(key, conversationId) {
  return run(() => learning.focus(key, conversationId));
}
function startIndependentWriting(context, genreId) {
  return run(() => {
    learning.startWriting(context, genreId);
    draft.value = '';
    nextTick(() => uni.pageScrollTo({ selector: '#active-learning-question', duration: 0 }));
  });
}
function startIndependentScience(context, input) {
  return run(() => {
    learning.startScience(context, input);
    draft.value = '';
    nextTick(() => uni.pageScrollTo({ selector: '#active-learning-question', duration: 0 }));
  });
}
function recordWritingPracticeHelp(context, content, genreId) {
  try {
    return learning.recordWritingHelp(context, content, genreId) !== false;
  } catch (e) {
    feedback.value = e.message;
    return false;
  }
}
function readWritingPracticeReference(context, id, version) {
  try {
    return learning.readWritingReference(context, id, version);
  } catch (e) {
    feedback.value = e.message;
    return null;
  }
}
function openWritingVocabulary(context, word) {
  try {
    return learning.openVocabulary(context, word);
  } catch (e) {
    feedback.value = e.message;
    return null;
  }
}
function submitWritingVocabulary(context, key, answer) {
  try {
    return learning.submitVocabulary(context, key, answer);
  } catch (e) {
    feedback.value = e.message;
    return null;
  }
}
function startWritingVocabularyTask(context, key, phase, delayDays = 1) {
  try {
    const result = learning.startVocabularyTask(context, key, phase, delayDays);
    if (phase === 'usage') {
      draft.value = '';
      nextTick(() => uni.pageScrollTo({ selector: '#active-learning-question', duration: 0 }));
    }
    return result;
  } catch (e) {
    feedback.value = e.message;
    return null;
  }
}
function recordDiagramPracticeHelp(context, input) {
  try {
    learning.recordDiagramHelp(context, input);
    return true;
  } catch (e) {
    feedback.value = e.message;
    return false;
  }
}
function recordSciencePracticeHelp(context, input) {
  try {
    return learning.recordScienceHelp(context, input);
  } catch (e) {
    feedback.value = e.message;
    return false;
  }
}
function planWritingRetest() {
  return run(() => learning.scheduleWritingRetest());
}
const iconColor = computed(() => (theme.isDark ? '#f8f4ff' : '#080909'));
const primaryIconColor = computed(() => (theme.isDark ? '#20172f' : '#ffffff'));
const desktopHost = isDesktopRuntime();
const clientPlatform = learningClientPlatform();
const selectedAppFile = ref(null),
  selectedAppFileOwner = ref(null),
  appFileBusy = ref(false);
let appFileController = null,
  appFileContext = null,
  appFileStage = null,
  appPageAlive = true,
  appPageVisible = true;
let appReadContext = null;
let clientFileSequence = 0,
  clientFileContext = null,
  clientFileReader = null,
  clientFilePicker = null;
const clientFilePhase = ref('');
function releaseClientFilePicker() {
  const picker = clientFilePicker;
  clientFilePicker = null;
  picker?.remove();
}
function discardClientFile() {
  clientFileSequence++;
  clientFileContext = null;
  const reader = clientFileReader;
  clientFileReader = null;
  clientFilePhase.value = '';
  releaseClientFilePicker();
  reader?.abort();
}
function cancelClientFile() {
  if (clientFilePhase.value === 'confirm') dialogs.dismiss();
  discardClientFile();
}
function beginClientFile() {
  discardClientFile();
  const sequence = clientFileSequence,
    context = learning.prepareMaterialAction();
  clientFileContext = context;
  clientFilePhase.value = 'choose';
  return {
    context,
    current: () =>
      appPageAlive &&
      appPageVisible &&
      sequence === clientFileSequence &&
      clientFileContext === context &&
      learning.materialContext() === context,
    finish: () => {
      if (sequence === clientFileSequence) {
        clientFileContext = null;
        clientFileReader = null;
        clientFilePhase.value = '';
        releaseClientFilePicker();
      }
    }
  };
}
watch(
  [() => learning.state, () => learning.materialContext()],
  () => {
    if (clientFileContext && learning.materialContext() !== clientFileContext) discardClientFile();
    if (appReadContext && learning.materialContext() !== appReadContext) appFileController?.abort();
  },
  { flush: 'sync' }
);
function discardAppFile() {
  const file = selectedAppFile.value;
  selectedAppFile.value = null;
  selectedAppFileOwner.value = null;
  releaseAppMaterialFile(file);
}
function cancelAppFile() {
  appFileController?.abort();
  if (appFileStage === 'import') learning.cancelMaterial();
  discardAppFile();
}
watch(
  () => learning.state,
  () => {
    if (
      (selectedAppFileOwner.value && selectedAppFileOwner.value !== learning.recordContext()) ||
      (appFileContext && appFileContext !== learning.recordContext())
    ) {
      appFileController?.abort();
      discardAppFile();
    }
  }
);
const messageStart = ref(0);
const visibleChapters = computed(() =>
  learning.timeline
    .map((chapter) => ({
      ...chapter,
      messages: chapter.messages.filter(
        (message) => message.index >= messageStart.value && message.index < messageStart.value + 50
      )
    }))
    .filter(
      (chapter) =>
        chapter.messages.length ||
        chapter.day === learning.conversationLocation?.day ||
        chapter.day === learning.timeline.at(-1)?.day
    )
);
watch(
  () => learning.conversationLocation,
  async (location) => {
    if (!location || location.conversationId !== learning.active?.id) return;
    if (location.messageId) {
      const index = learning.active.messages.findIndex((m) => m.id === location.messageId);
      if (index >= 0) messageStart.value = Math.max(0, index - 10);
    } else if (!location.day) messageStart.value = Math.max(0, learning.active.messages.length - 50);
    await nextTick();
    if (learning.conversationLocation !== location) return;
    const id = location.groupId
      ? 'learning-journey-workspace'
      : location.day
        ? `learning-day-${location.day}`
        : 'learning-composer';
    // #ifdef H5
    const target = document.getElementById(id);
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
    target?.focus?.({ preventScroll: true });
    // #endif
    // #ifndef H5
    const query = uni.createSelectorQuery();
    query.select(`#${id}`).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec(([rect, viewport]) => {
      if (rect && learning.conversationLocation === location)
        uni.pageScrollTo({ scrollTop: Math.max(0, rect.top + (viewport?.scrollTop || 0)), duration: 0 });
    });
    // #endif
  },
  { immediate: true }
);
function locateQuestionMessages() {
  const messages = learning.active?.messages || [];
  const last = messages.map((m) => m.questionKey).lastIndexOf(learning.active?.activeQuestionKey);
  messageStart.value = Math.max(0, (last < 0 ? messages.length : last + 1) - 50);
}
watch(
  [() => learning.selectedConversationId, () => learning.active?.activeQuestionKey],
  () => {
    if (!learning.conversationLocation?.day) locateQuestionMessages();
  },
  { immediate: true }
);
watch(
  () => learning.active?.messages.length || 0,
  (length, before) => {
    if (!learning.conversationLocation?.day && messageStart.value + 50 >= before)
      messageStart.value = Math.max(0, length - 50);
  }
);
const learningRoot = ref(null);
let unbindKeyboard = () => undefined;
onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(learningRoot.value);
});
onUnmounted(() => unbindKeyboard());
const goal = ref('');
const taskTrack = ref('general'),
  taskStage = ref(''),
  taskEdition = ref('');
const showTaskOptions = ref(false),
  customStage = ref(false),
  customEdition = ref(false);
const stagesByTrack = {
  general: ['入门', '基础', '进阶'],
  primary: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
  junior: ['七年级', '八年级', '九年级'],
  senior: ['高一', '高二', '高三'],
  postgraduate: ['基础', '强化', '冲刺'],
  civil: ['入门', '专项', '冲刺'],
  ielts: ['入门', '基础', '进阶'],
  toefl: ['入门', '基础', '进阶']
};
const editionsByTrack = {
  primary: ['人教版', '北师大版', '苏教版', '外研版'],
  junior: ['人教版', '北师大版', '苏教版', '外研版'],
  senior: ['人教版', '北师大版', '苏教版', '外研版'],
  postgraduate: ['英语一', '英语二', '数学一', '数学二', '数学三', '政治', '专业课'],
  civil: ['国考', '省考'],
  ielts: ['学术类', '培训类'],
  toefl: ['iBT']
};
const taskStages = computed(() => ['', ...(stagesByTrack[taskTrack.value] || [])]);
const taskEditions = computed(() => ['', ...(editionsByTrack[taskTrack.value] || [])]);
function selectTaskTrack(track) {
  if (taskTrack.value === track) return;
  taskTrack.value = track;
  taskStage.value = '';
  taskEdition.value = '';
  customStage.value = customEdition.value = false;
}
const objectiveKind = ref('literal'),
  objectiveFrom = ref(''),
  objectiveTo = ref('');
const objectiveKinds = {
  literal: '字面信息定位',
  difference: '增量计算',
  growth_percent: '增长率计算',
  share_percent: '占比计算'
};
const objectiveFromLabel = computed(() =>
  objectiveKind.value === 'literal' ? '要查的字段' : objectiveKind.value === 'share_percent' ? '部分字段' : '基期字段'
);
const objectiveToLabel = computed(() => (objectiveKind.value === 'share_percent' ? '整体字段' : '现期字段'));
const draft = ref('');
function textInputValue(event) {
  return event?.detail?.value ?? event?.target?.value ?? '';
}
const multipleChoices = ref(false),
  choiceDraft = ref('');
const choiceOptions = computed(() => {
  const q = learning.activeQuestion;
  if (q?.answerType !== 'choice' || !Array.isArray(q.options) || !q.options.length || q.options.length > 8) return [];
  const items = q.options.map((option, index) => {
    if (typeof option !== 'string') return null;
    const prefix = /^([A-H])[.、．]\s*/i.exec(option);
    const value = prefix ? prefix[1].toUpperCase() : String.fromCharCode(65 + index);
    return { value, label: prefix ? option : `${value}. ${option}` };
  });
  return items.every(Boolean) && new Set(items.map((item) => item.value)).size === items.length ? items : [];
});
const selectedChoices = computed(() =>
  /^[A-H](?:[、,\s]*[A-H])*$/i.test(draft.value.trim())
    ? [...new Set(draft.value.toUpperCase().match(/[A-H]/g) || [])]
    : []
);
function chooseAnswer(value) {
  if (learning.busy || learning.active?.stopped || !choiceOptions.value.some((item) => item.value === value)) return;
  const values = selectedChoices.value;
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  draft.value = multipleChoices.value ? next.sort().join('、') : value;
  choiceDraft.value = draft.value;
}
function toggleMultipleChoices() {
  multipleChoices.value = !multipleChoices.value;
  if (!multipleChoices.value && selectedChoices.value.length > 1) {
    draft.value = selectedChoices.value[0];
    choiceDraft.value = draft.value;
  }
}
watch([() => learning.recordContext(), () => learning.active?.id, () => learning.active?.activeQuestionKey], () => {
  if (choiceDraft.value && draft.value === choiceDraft.value) draft.value = '';
  choiceDraft.value = '';
  multipleChoices.value = false;
});
const feedback = ref('');
const dialogState = shallowRef({ id: 0, visible: false });
const dialogs = createLearningDialog({
  getContext: () => (appPageAlive && appPageVisible ? learning.recordContext() : null),
  onChange: (state) => {
    dialogState.value = state;
  },
  onError: (error) => {
    feedback.value = error.message;
  }
});
const showLearningDialog = dialogs.show;
function checkGrammar() {
  if (learning.busy || !learning.canCheckGrammar) return;
  const context = learning.computeReferenceContext();
  showLearningDialog({
    title: '检查已提交的英文原答',
    content: '在项目后端用本机基础规则检查。建议可能误报，记为本题帮助，不自动修改或打分。',
    confirmText: '检查',
    success: (result) => {
      if (learning.computeReferenceContext() !== context) return;
      if (result.confirm) run(() => learning.requestGrammarHelp(true));
    }
  });
}
function computeReference() {
  if (learning.busy || !learning.canComputeReference) return;
  const context = learning.computeReferenceContext();
  showLearningDialog({
    title: '计算本题参考',
    content: '使用已同步的题目和原答，在项目后端计算。结果记为本题帮助，不改判分。',
    confirmText: '计算并阅读',
    isCurrent: () => !learning.busy && learning.computeReferenceContext() === context,
    success: (result) => {
      if (result.confirm) run(() => learning.requestComputeReference(true));
    }
  });
}
watch(
  () => learning.state,
  () => dialogs.invalidate(),
  { flush: 'sync' }
);
onBackPress(() => {
  if (!dialogState.value.visible) return false;
  dialogs.dismiss();
  return true;
});
const showConnections = ref(false);
const showMaterial = ref(false);
const showProfile = ref(false);
const showData = ref(false);
const showRestore = ref(false);
const backupText = ref('');
const backupExpanded = ref(false);
const uploadMaintenancePreview = ref(null),
  pendingRemovalPreview = ref(null),
  pendingRemovalAcknowledged = ref(false),
  locatorText = ref(''),
  showLocator = ref(false);
const restorePreview = ref(null);
const guestPreview = ref(null);
const recordPreviewBusy = ref(false);
const recordPreviewStatus = ref({ phase: 'idle', message: '' });
const recordFileBusy = ref(false);
const recordFileStatus = ref({ phase: 'idle', message: '' });
let activeRecordFile = null;
function cancelRecordFile(message = '', phase = 'idle') {
  const request = activeRecordFile;
  activeRecordFile = null;
  request?.controller?.abort();
  recordFileBusy.value = false;
  recordFileStatus.value = { phase, message };
}
const recordActionsBusy = computed(
  () =>
    learning.busy ||
    learning.materialBusy ||
    learning.syncBusy ||
    learning.historyBusy ||
    recordPreviewBusy.value ||
    recordFileBusy.value
);
let recordPreviewSequence = 0;
let activeRecordPreview = null;
function invalidateRecordPreviews(message = '', phase = 'idle') {
  recordPreviewSequence++;
  learning.cancelHistory();
  restorePreview.value = null;
  guestPreview.value = null;
  recordPreviewStatus.value = { phase, message };
  dialogs.invalidate();
}
function cancelRecordPreview() {
  invalidateRecordPreviews('已取消历史校验，当前记录和备份输入保留；请待校验收尾后再重试。', 'cancelled');
}
watch(
  backupText,
  () => {
    if (activeRecordFile) cancelRecordFile('备份输入已变化，已取消旧文件读取；原记录保留。', 'cancelled');
    else cancelRecordFile();
    if (backupText.value.length <= HISTORY_LIMITS.pageCharacters) backupExpanded.value = false;
    if (activeRecordPreview || restorePreview.value || guestPreview.value || recordPreviewStatus.value.message)
      invalidateRecordPreviews('备份内容已变化，请重新校验；当前记录保留。');
  },
  { flush: 'sync' }
);
watch(
  [() => learning.state.owner, () => learning.state.revision, () => learning.recordContext()],
  () => {
    if (activeRecordFile) cancelRecordFile('账户或学习记录已变化，请重新选择备份文件；原记录保留。', 'cancelled');
    else cancelRecordFile();
    if (activeRecordPreview || restorePreview.value || guestPreview.value)
      invalidateRecordPreviews('账户或学习记录已变化，请重新校验；未合并旧预览。');
    else if (recordPreviewStatus.value.message) invalidateRecordPreviews();
  },
  { flush: 'sync' }
);
watch(
  [showData, showRestore],
  ([dataVisible, restoreVisible], [oldDataVisible, oldRestoreVisible]) => {
    if ((!dataVisible && oldDataVisible) || (!restoreVisible && oldRestoreVisible)) {
      cancelRecordFile();
      invalidateRecordPreviews();
    }
  },
  { flush: 'sync' }
);
async function prepareRecordPreview(kind) {
  if (recordActionsBusy.value || !appPageAlive || !appPageVisible) return;
  if (kind === 'restore' && !backupText.value.trim()) return;
  const request = {
    sequence: ++recordPreviewSequence,
    context: learning.recordContext(),
    revision: learning.state.revision,
    content: kind === 'restore' ? backupText.value : null
  };
  const current = () =>
    appPageAlive &&
    appPageVisible &&
    request.sequence === recordPreviewSequence &&
    request.context &&
    learning.recordContext() === request.context &&
    learning.state.revision === request.revision &&
    (kind !== 'restore' || backupText.value === request.content);
  activeRecordPreview = request;
  restorePreview.value = null;
  guestPreview.value = null;
  recordPreviewBusy.value = true;
  recordPreviewStatus.value = {
    phase: 'loading',
    message:
      kind === 'restore'
        ? '正在校验备份，当前记录未修改；可取消。'
        : '正在校验访客记录，当前账户和访客原件未修改；可取消。'
  };
  try {
    const preview = await (kind === 'restore'
      ? learning.previewRestore(request.content)
      : learning.previewGuestMigration());
    if (!current()) return;
    if (kind === 'restore') restorePreview.value = preview;
    else guestPreview.value = preview;
    recordPreviewStatus.value = {
      phase: 'success',
      message: '校验完成，请核对下方新增数量后再确认合并；当前记录未修改。'
    };
  } catch (failure) {
    if (current())
      recordPreviewStatus.value = {
        phase: failure.code === 'CANCELLED' ? 'cancelled' : 'error',
        message: `${failure.message || '校验未完成'}；请检查备份或记录后重新校验，当前记录保留。`
      };
  } finally {
    if (activeRecordPreview === request) {
      activeRecordPreview = null;
      recordPreviewBusy.value = false;
    }
  }
}
const showMethods = ref(false);
const showRubric = ref(false);
const rubricCriteria = ref([]);
const rubricAttempt = computed(
  () =>
    learning.state.attempts
      .filter(
        (a) =>
          a.conversationId === learning.selectedConversationId && a.questionKey === learning.active?.activeQuestionKey
      )
      .at(-1) || null
);
const rubricAssessment = computed(
  () =>
    rubricAttempt.value?.assistance
      ?.filter((a) => ['subjective-rubric-v1', 'subjective-rubric-v2'].includes(a.contract))
      .at(-1) || null
);
watch([() => learning.state.owner, () => learning.active?.activeQuestionKey], () => {
  showRubric.value = false;
  rubricCriteria.value = [];
});
function addRubricCriterion() {
  if (rubricCriteria.value.length < 6)
    rubricCriteria.value.push({ id: learningId('criterion'), name: '', description: '', maxScore: 2 });
}
function editRubric() {
  rubricCriteria.value = (learning.activeQuestion.rubric?.criteria || []).map((c) => ({ ...c }));
  if (!rubricCriteria.value.length) addRubricCriterion();
  showRubric.value = true;
}
function saveRubric() {
  return run(() => {
    learning.setRubric(rubricCriteria.value.map((c) => ({ ...c })));
    showRubric.value = false;
    feedback.value = '评分维度已保存。';
  });
}
const rhythmFeedback = ref('');
const selectedRhythm = computed(() =>
  learning.activeStrategy.source === 'self_report'
    ? currentRhythm(learning.state.profile, learning.selectedConversationId, learning.activeStrategy.method)
    : null
);
const connectionLabel = computed(() =>
  learning.selectedMode === 'offline'
    ? '连接模型'
    : learning.selectedMode === 'local'
      ? '本地模型'
      : learning.modelId
        ? '云模型 · 已选择'
        : '云模型 · 待选择'
);
const starters = LEARNING_START_TOPICS;
const byokForm = ref(false);
const localForm = ref(false);
const profile = ref({
  id: '',
  provider: '',
  model: '',
  endpoint: '',
  apiKey: '',
  structured: false,
  stream: false,
  vision: false
});
const vaultConsent = ref(false);
const localEndpoint = ref('http://127.0.0.1:8766/chat');
const localModel = ref('');
const localToken = ref('');
const materialEndpoint = ref('http://127.0.0.1:8765/parse');
const materialToken = ref('');
const allowMaterialRecognition = ref(false);
const materialRecognitionEngine = ref('tesseract');
const doclingAvailable = computed(() => learning.materialConnection?.capabilities?.docling?.available === true);
watch(allowMaterialRecognition, (allowed) => {
  if (!allowed && materialRecognitionEngine.value === 'apple-vision') materialRecognitionEngine.value = 'tesseract';
});
const appleVisionAvailable = computed(() => learning.materialConnection?.capabilities?.appleVision?.available === true);
const appleReadinessMessage = computed(() => {
  const status = learning.materialConnection?.capabilities?.appleVision?.readiness?.status;
  return status === 'preparing'
    ? 'Apple 识别准备中，请稍后检查连接。'
    : status === 'failed'
      ? 'Apple 识别暂不可用，请检查解析服务。'
      : '';
});
function recognitionLabel(engine, allowRecognition = true) {
  if (engine === 'docling') return allowRecognition ? '整理PDF版面并识别图片文字' : '整理PDF版面，仅提取原有文字';
  if (!allowRecognition) return '仅提取PDF文本';
  return engine === 'apple-vision' ? '由解析器 Mac 上的 Apple Vision 识别' : '由解析器上的 Tesseract 识别';
}
const materialText = ref('');
const materialFeedback = ref(null);
let materialFeedbackSequence = 0;
const materialActionBusy = computed(() =>
  Boolean(learning.materialBusy || learning.materialConnectionBusy || appFileBusy.value || clientFilePhase.value)
);
const materialFileChoiceBusy = computed(() =>
  Boolean(
    learning.materialBusy ||
    learning.materialConnectionBusy ||
    appFileBusy.value ||
    ['choose', 'confirm', 'import'].includes(clientFilePhase.value)
  )
);
const materialImportLabel = computed(() => {
  const outcome = learning.materialImportState;
  if (outcome?.phase === 'partial' && outcome.failedPages > 0 && outcome.extractedSegments === 0)
    return '未识别到正文，请重试。';
  return (
    {
      processing: '正在解析',
      saved: '已保存 · 待校对',
      partial: '部分已保存，请继续或重试。',
      cancelled: '后续处理已取消',
      failed: '解析未完成'
    }[outcome?.phase] || ''
  );
});
const syncOperationProgress = computed(() => {
  const progress = learning.syncProgress;
  if (
    !Number.isSafeInteger(progress?.total) ||
    progress.total <= 0 ||
    !Number.isSafeInteger(progress.completed) ||
    progress.completed < 0 ||
    progress.completed > progress.total
  )
    return null;
  return {
    completed: progress.completed,
    total: progress.total,
    percentage: (progress.completed / progress.total) * 100
  };
});
const materialPageProgress = computed(() => {
  const progress = learning.materialProgress;
  if (
    !Number.isSafeInteger(progress?.total) ||
    progress.total <= 0 ||
    !Number.isSafeInteger(progress.completed) ||
    progress.completed < 0
  )
    return null;
  const completed = Math.min(progress.completed, progress.total);
  return { completed, total: progress.total, percentage: (completed / progress.total) * 100 };
});
watch(
  () => learning.state,
  () => {
    if (materialFeedback.value && materialFeedback.value.context !== learning.recordContext()) {
      materialFeedbackSequence++;
      materialFeedback.value = null;
    }
  },
  { flush: 'sync' }
);
const selectedMaterial = ref(null);
const selectedSegment = ref(null);
const privateCandidate = ref(null);
const currentEditorMaterial = computed(() =>
  learning.state.materials.find((material) => material.id === selectedMaterial.value?.id)
);
const materialEditorSourceChanged = computed(() => {
  if (!selectedSegment.value) return false;
  const current = currentEditorMaterial.value?.segments.find((segment) => segment.id === selectedSegment.value.id);
  const source = (segment, material) =>
    JSON.stringify([
      segment?.content,
      segment?.extractionVersion || material?.extractionVersion,
      segment?.extractionEventId,
      segment?.role,
      segment?.reviewRequired,
      segment?.status,
      segment?.uncertainties
    ]);
  return source(current, currentEditorMaterial.value) !== source(selectedSegment.value, selectedMaterial.value);
});
const objectiveFields = computed(() => {
  if (materialEditorSourceChanged.value) return { fields: [], error: '资料已重新提取，请重新选择本页后再练习。' };
  try {
    return { fields: materialObjectiveFields(selectedSegment.value), error: '' };
  } catch (error) {
    return { fields: [], error: error.message };
  }
});
function objectiveInput() {
  return {
    segmentId: selectedSegment.value?.id,
    kind: objectiveKind.value,
    from: objectiveFrom.value.trim(),
    to: objectiveTo.value.trim()
  };
}
const objectiveUnavailable = computed(() => {
  if (learning.busy) return '请先结束当前操作。';
  if (learning.active?.stopped) return '请先明确继续学习任务，再开始资料练习。';
  if (objectiveFields.value.error) return objectiveFields.value.error;
  if (!objectiveFrom.value.trim()) return '请选择资料中的一个字段。';
  if (objectiveKind.value !== 'literal' && !objectiveTo.value.trim())
    return '请选择资料中不同的' + objectiveToLabel.value + '。';
  try {
    createMaterialObjectiveQuestion('material-preview', currentEditorMaterial.value, objectiveInput());
    return '';
  } catch (error) {
    return error.message;
  }
});
function clearMaterialEditor() {
  selectedMaterial.value = null;
  selectedSegment.value = null;
  privateCandidate.value = null;
  privatePrompt.value = '';
  privateAnswer.value = '';
  importedUserAnswer.value = '';
  teacherAnnotation.value = '';
  privateConditionsConfirmed.value = false;
}
watch(
  () => selectedMaterial.value && !learning.state.materials.some((m) => m.id === selectedMaterial.value.id),
  (missing) => {
    if (missing) clearMaterialEditor();
  }
);
const teacherAnnotation = ref('');
const privateConditionsConfirmed = ref(false);
const privatePrompt = ref('');
const privateAnswer = ref('');
const importedUserAnswer = ref('');
const foundation = ref('');
const timezone = ref(learning.state.timezone);
const planLines = ref('');
const foundationOptions = ['从基础开始', '有些基础', '挑战进阶'];
const customFoundation = ref(false),
  customTimezone = ref(false),
  showPlanText = ref(false);
const showMaterialSettings = ref(false),
  showImportTools = ref(false);
const timezoneOptions = [
  { label: '北京', value: 'Asia/Shanghai' },
  { label: '洛杉矶', value: 'America/Los_Angeles' },
  { label: '纽约', value: 'America/New_York' },
  { label: '伦敦', value: 'Europe/London' },
  { label: '东京', value: 'Asia/Tokyo' },
  { label: 'UTC', value: 'UTC' }
];
const planOptions = ['理解一个概念', '完成一组练习', '复习错题', '写一段短文'];
function togglePlanTask(title) {
  const tasks = planLines.value.split('\n').filter((line) => line.trim());
  planLines.value = (tasks.includes(title) ? tasks.filter((line) => line !== title) : [...tasks, title]).join('\n');
}
watch(
  () => learning.state.owner,
  () => {
    backupText.value = '';
    uploadMaintenancePreview.value = null;
    pendingRemovalPreview.value = null;
    pendingRemovalAcknowledged.value = false;
    locatorText.value = '';
    showLocator.value = false;
    restorePreview.value = null;
    guestPreview.value = null;
    draft.value = '';
    feedback.value = '';
    goal.value = '';
    taskTrack.value = 'general';
    taskStage.value = taskEdition.value = '';
    showTaskOptions.value = customStage.value = customEdition.value = false;
    profile.value = {
      id: '',
      provider: '',
      model: '',
      endpoint: '',
      apiKey: '',
      structured: false,
      stream: false,
      vision: false
    };
    localToken.value = '';
    materialToken.value = '';
    materialText.value = '';
    selectedMaterial.value = null;
    selectedSegment.value = null;
    privateCandidate.value = null;
    teacherAnnotation.value = '';
    privatePrompt.value = '';
    privateAnswer.value = '';
    importedUserAnswer.value = '';
    privateConditionsConfirmed.value = false;
    foundation.value = '';
    planLines.value = '';
    customFoundation.value = customTimezone.value = showPlanText.value = false;
    showMaterialSettings.value = showImportTools.value = false;
    vaultConsent.value = false;
    timezone.value = learning.state.timezone;
  }
);
const actions = [
  '直接讲解',
  '太简单了',
  '换一个例子',
  '用图示讲解',
  '换方法',
  '降低难度',
  '今天只复习错题',
  '停止当前任务'
];
const visibleActions = computed(() => (showMethods.value ? actions : ['直接讲解', '换一个例子', '停止当前任务']));
async function chooseRhythm(id) {
  const result = await run(() => learning.setRhythm(id));
  if (result)
    rhythmFeedback.value = id === 'review' && !result.focused ? '已切换复习，暂无待复测题目。' : '已切换学习方式。';
}
onLoad((options) => {
  if (options.panel === 'materials') showMaterial.value = true;
  if (options.panel === 'connections') showConnections.value = true;
  if (options.panel === 'profile') showProfile.value = true;
});
const roleLabel = (role) => ({ user: '你', assistant: BRAND.name, tool: '结果', notice: BRAND.name })[role];
async function run(action) {
  feedback.value = '';
  try {
    return await action();
  } catch (e) {
    feedback.value = e.message;
  }
}
async function runMaterial(action, { connectionCheck = false } = {}) {
  const sequence = ++materialFeedbackSequence;
  const context = learning.recordContext();
  materialFeedback.value = null;
  const notify = (message, kind = 'success') => {
    if (appPageAlive && appPageVisible && sequence === materialFeedbackSequence && learning.recordContext() === context)
      materialFeedback.value = { message, kind, context };
  };
  try {
    return await action(notify);
  } catch (failure) {
    const message =
      failure instanceof TypeError
        ? '暂时无法连接资料解析器。请检查地址、访问令牌和服务是否运行，再重新检查连接；也可先粘贴文字。'
        : failure.code === 'CONNECTION_FAILED'
          ? connectionCheck
            ? '资料解析器连接检查未通过，尚未发送资料。请核对地址、访问令牌和服务是否运行，再重新检查连接；也可先粘贴文字。'
            : '资料连接请求未完成。请核对地址、访问令牌和服务是否运行。导入结果未确认，请保留原件；若有导入待办，先核对，避免重复上传。'
          : failure.code === 'TIMEOUT'
            ? '资料连接请求超时，尚未确认完成。可重新检查连接；先核对已保存内容或导入待办，避免重复上传。'
            : failure.message || '资料操作未完成，请保留原件后重试。';
    notify(message, failure.code === 'CANCELLED' ? 'info' : 'error');
  }
}
function start() {
  return run(() =>
    learning.start(goal.value, { track: taskTrack.value, stage: taskStage.value, edition: taskEdition.value })
  );
}
function newConversation() {
  learning.selectedConversationId = null;
}
async function send() {
  const input = draft.value.trim();
  if (!input) return;
  await run(() => learning.send(input, { discussionOnly: learning.batchTrainingActive }));
  // Failed local writes must leave the answer available for retry; preserve new typing during a model request.
  if (!feedback.value && draft.value.trim() === input) draft.value = '';
}
function sendDirective(action) {
  return run(() => learning.send(action));
}
function submitExplicit() {
  return run(() => {
    learning.submit(draft.value, true);
    draft.value = '';
  });
}
function setMode(mode) {
  learning.cancel();
  learning.selectedMode = mode;
  learning.streamEnabled = false;
  learning.sharingAllowed = false;
}
function selectModel(id) {
  setMode('cloud');
  learning.modelId = id;
}
function interpretImage() {
  const owner = learning.state.owner,
    conversationId = learning.active?.id,
    questionId = learning.activeQuestion?.id,
    modelId = learning.modelId;
  const model = learning.models.find((m) => m.id === modelId);
  if (
    learning.selectedMode !== 'cloud' ||
    model?.source !== 'byok' ||
    !model.capabilities?.vision ||
    !model.visionAdapter ||
    learning.streamEnabled ||
    !learning.sharingAllowed
  ) {
    feedback.value = '请选择声明支持图片的自带API、非流式模式，并允许当前上下文共享；不会自动切换模型或上传资料。';
    return;
  }
  showLearningDialog({
    title: '确认本次页图发送',
    content: `将当前题目原页图（整页，可能包含旁边的作答与批注）及当前上下文经本项目后端发送至 ${model.provider} / ${model.model}。上游费用由你的API账户承担，图像成本待对账，不扣平台额度。解读是待校对候选，不能直接记错题。`,
    confirmText: '发送这一页',
    success: (result) => {
      if (!result.confirm) return;
      run(() => {
        if (
          learning.state.owner !== owner ||
          learning.active?.id !== conversationId ||
          learning.activeQuestion?.id !== questionId ||
          learning.modelId !== modelId
        )
          throw new Error('账户、题目或模型已变化，未发送旧页图');
        return learning.interpretQuestionImage(true);
      });
    }
  });
}
async function loadModels() {
  await readModelResource(() => learning.loadModels());
}
function loginForModels() {
  storageService.save('redirect_after_login', '/pages/learning/index?panel=connections');
  safeNavigateTo('/pages/login/index');
}
async function readModelResource(action) {
  const context = learning.recordContext();
  try {
    await action();
  } catch (failure) {
    if (
      appPageAlive &&
      appPageVisible &&
      learning.recordContext() === context &&
      failure.code !== 'CANCELLED' &&
      failure.code !== 'CONTEXT_CHANGED'
    )
      feedback.value = failure.message;
  }
}
function connectionStatusLabel(status) {
  return (
    { untested: '尚未测试', connected: '最近调用成功', failed: '最近调用失败', stale: '连接需重新验证' }[status] ||
    '连接未知'
  );
}
function usePreset(preset) {
  profile.value = {
    ...profile.value,
    id: preset.id,
    provider: preset.provider,
    model: preset.model,
    endpoint: preset.endpoint,
    structured: preset.structured,
    stream: preset.stream === true
  };
  feedback.value = `${preset.terms} ${preset.privacy}`;
}
async function testModel(id) {
  const result = await run(() => learning.testModel(id));
  if (result) feedback.value = result.success ? '模型测试成功，用量已记录。' : result.message;
}
async function loadUsage() {
  await readModelResource(() => learning.loadUsage());
}
async function saveModel() {
  const result = await run(() => learning.saveModel({ ...profile.value }, vaultConsent.value));
  profile.value.apiKey = '';
  if (result) feedback.value = result.success ? '连接已保存。' : result.message;
}
async function removeModel(id) {
  const result = await run(() => learning.removeModel(id));
  if (result) feedback.value = result.success ? '密钥已删除。' : result.message;
}
function connectLocal() {
  return run(async () => {
    const url = new URL(localEndpoint.value);
    learning.localConnection = {
      endpoint: localEndpoint.value,
      model: localModel.value,
      token: localToken.value,
      consent: true,
      allowedOrigins: [url.origin]
    };
    localToken.value = '';
    await learning.checkLocalConnection();
    setMode('local');
    feedback.value = '已连接；允许发送学习内容后即可使用。';
  });
}
function hint() {
  const conversationId = learning.selectedConversationId;
  const questionKey = learning.active?.activeQuestionKey;
  showLearningDialog({
    title: '记录使用的提示',
    editable: true,
    placeholderText: '填写你使用的提示',
    isCurrent: () =>
      learning.selectedConversationId === conversationId && learning.active?.activeQuestionKey === questionKey,
    success: (res) => {
      if (res.confirm && res.content?.trim())
        run(() =>
          learning.commit(
            'hint.add',
            {
              conversationId,
              content: res.content,
              level: 1
            },
            learningId('hint')
          )
        );
    }
  });
}
function variant() {
  return run(() => learning.generateVariant());
}
function editQuestion() {
  const question = learning.activeQuestion;
  showLearningDialog({
    title: '局部校对题干',
    editable: true,
    content: question.prompt,
    isCurrent: () => learning.activeQuestion === question,
    success: (res) => {
      if (res.confirm && res.content?.trim())
        run(() =>
          learning.correctQuestion(question, { prompt: res.content, uncertainties: [] }, '用户校对关键题干，旧版本保留')
        );
    }
  });
}
function importText() {
  if (materialActionBusy.value || !materialText.value.trim()) return;
  return runMaterial((notify) => {
    learning.importText(materialText.value);
    materialText.value = '';
    notify('资料已保存到本设备。');
  });
}
function connectMaterial() {
  if (materialActionBusy.value) return;
  return runMaterial(
    async (notify) => {
      const url = new URL(materialEndpoint.value);
      const previous = learning.materialConnection;
      const token = materialToken.value || (previous?.endpoint === url.href ? previous.token : '');
      learning.materialConnection = {
        endpoint: url.href,
        token,
        consent: true,
        allowedOrigins: [url.origin]
      };
      materialToken.value = '';
      await learning.checkMaterialConnection();
      notify('连接成功，尚未发送资料。');
    },
    { connectionCheck: true }
  );
}

function previewUploadMaintenance() {
  return run(async () => {
    uploadMaintenancePreview.value = await learning.previewUploadMaintenance(true);
    feedback.value = '维护预览已取得；尚未整理登记或删除原件。';
  });
}
function compactUploadReceipts() {
  const preview = uploadMaintenancePreview.value;
  if (!preview) return;
  showLearningDialog({
    title: '整理已关闭导入登记',
    type: 'warning',
    content: `本次核实整理 ${preview.pending ? preview.plannedCount : preview.closedCount} 项已关闭登记，未确认登记和原件全部保留。先封存旧批次，旧编号不能再次上传；其他客户端需重新检查解析器。`,
    success: (res) => {
      if (res.confirm)
        run(async () => {
          const result = await learning.compactUploadReceipts(preview, true);
          uploadMaintenancePreview.value = null;
          feedback.value = `已核实整理 ${result.removedCount} 项已关闭登记；未删除原件。`;
        });
    }
  });
}
function locatorContent(preview) {
  return JSON.stringify({ format: 'wenli-upload-locator-v1', owner: preview.owner, entry: preview.entry }, null, 2);
}
function exportPendingLocator(entry) {
  return run(() => {
    pendingRemovalPreview.value = learning.previewPendingRemoval(entry.id);
    pendingRemovalAcknowledged.value = false;
    locatorText.value = locatorContent(pendingRemovalPreview.value);
    showLocator.value = true;
    feedback.value = '已生成本次无正文定位登记；尚未移除待办或核验远端原件。';
  });
}
function downloadPendingLocator() {
  return run(async () => {
    const preview = pendingRemovalPreview.value;
    if (!preview) return;
    const current = learning.previewPendingRemoval(preview.entry.id);
    if (
      current.owner !== preview.owner ||
      current.context !== preview.context ||
      current.fingerprint !== preview.fingerprint
    )
      throw new Error('账户或待办已变化，请重新导出定位');
    const content = locatorContent(current);
    // #ifdef H5
    if (desktopHost) {
      const context = learning.recordContext();
      const result = await saveDesktopLearningFile('locator', content, {
        isCurrent: () => appPageAlive && learning.recordContext() === context
      });
      feedback.value = result.saved ? '定位登记已保存；远端原件未核验。' : '已取消保存，定位待办保留。';
      return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })),
      link = document.createElement('a');
    link.href = url;
    link.download = 'yozi-ai-upload-locator.json';
    link.click();
    URL.revokeObjectURL(url);
    feedback.value = '已生成定位登记下载；请确认在可信位置保存。远端原件未核验。';
    // #endif
    // #ifndef H5
    uni.setClipboardData({ data: content });
    feedback.value = '定位登记已交给系统复制接口，请确认另行保存；远端原件未核验。';
    // #endif
  });
}
function forgetPendingUpload() {
  const preview = pendingRemovalPreview.value;
  if (!preview || !pendingRemovalAcknowledged.value) return;
  showLearningDialog({
    title: '仅移除本机定位待办',
    type: 'warning',
    content: `仅移除 ${preview.entry.id} 的本机定位登记。不关闭原导入、不删除或核验解析器原件；迟到正文及原件可能仍由原解析器保留。请凭已保存定位信息另行处理。`,
    success: (res) => {
      if (res.confirm)
        run(() => {
          learning.forgetPendingUpload(preview, true);
          pendingRemovalPreview.value = null;
          pendingRemovalAcknowledged.value = false;
          feedback.value = '仅本机定位待办已移除；远端原件未核验，未宣称删除。';
        });
    }
  });
}
function restorePendingLocator() {
  const content = locatorText.value,
    context = learning.recordContext();
  showLearningDialog({
    title: '恢复本机定位待办',
    content: '仅恢复当前账户的无正文定位登记，不读取或发送原件。后续核对/恢复须重新授权原解析器。',
    success: (res) => {
      if (res.confirm)
        run(() => {
          if (learning.recordContext() !== context) throw new Error('账户或记录已变化，请重新确认');
          const result = learning.restorePendingLocator(content, true);
          pendingRemovalPreview.value = null;
          pendingRemovalAcknowledged.value = false;
          feedback.value = result.alreadyPresent
            ? '相同定位待办已存在，未重复保存或查询。'
            : '本机定位待办已恢复；尚未查询或发送原件。';
        });
    }
  });
}

function pendingUploadAction(entry, action) {
  const owner = learning.recordContext(),
    context = learning.materialContext();
  showLearningDialog({
    title: action === 'recover' ? '恢复解析器已收原件' : action === 'close' ? '取消未确认导入' : '核对未确认原件',
    type: action === 'close' ? 'warning' : 'info',
    content:
      action === 'recover'
        ? '只从原授权存储继续解析，不重新上传。沿本次登记的识别许可；候选仍需校对。'
        : action === 'close'
          ? '关闭这次导入，拒绝迟到正文；仅清理本次新建且未被其他登记引用的原件。已有或共享原件保留。'
          : '仅向原授权存储核对这次导入，不读取或重新发送原件正文。',
    success: (res) => {
      if (!res.confirm) return;
      run(async () => {
        if (learning.recordContext() !== owner || learning.materialContext() !== context)
          throw new Error('账户或资料授权已变化，请重新核对；待办保留');
        if (action === 'recover') {
          materialFeedbackSequence++;
          materialFeedback.value = null;
        }
        const result = await (action === 'recover'
          ? learning.recoverUpload(entry.id, true)
          : action === 'close'
            ? learning.closeUpload(entry.id, true)
            : learning.inspectUpload(entry.id, true));
        feedback.value =
          result.state === 'retired'
            ? '该登记批次已封存，旧编号不能重传；原件删除状态未核验，待办仍保留。'
            : result.state === 'linked'
              ? '原件已关联现有资料；已清理重复待办，请继续使用已保存资料。'
              : action === 'recover'
                ? '已从解析器原件恢复私人资料，未重新上传；候选仍需校对。'
                : result.state === 'closed'
                  ? result.sharedOriginalRetained
                    ? '登记已关闭；已有或其他登记使用的原件保留。'
                    : '登记已关闭，原件清理状态已确认。'
                  : result.state === 'absent'
                    ? '原存储暂未找到该导入原件；待办保留，可明确取消登记以阻止迟到正文。'
                    : result.state === 'stored'
                      ? '已找到原件，可明确确认恢复；尚未读取原件内容。'
                      : '登记仍在等待或处理，可稍后核对或明确取消。';
      });
    }
  });
}

function selectMaterial(material) {
  selectedMaterial.value = material;
  selectSegment(material.segments[0]);
}
function selectSegment(segment) {
  const material = currentEditorMaterial.value;
  if (!material) return;
  selectedMaterial.value = material;
  segment = material.segments.find((current) => current.id === segment?.id);
  if (!segment) return clearMaterialEditor();
  objectiveFrom.value = '';
  objectiveTo.value = '';
  selectedSegment.value = segment;
  privateCandidate.value = structureMaterialCandidate(segment);
  privatePrompt.value = privateCandidate.value.prompt;
  privateAnswer.value = privateCandidate.value.reference;
  importedUserAnswer.value = privateCandidate.value.userAnswer;
  teacherAnnotation.value = privateCandidate.value.annotation;
  privateConditionsConfirmed.value = false;
}
function retryMaterial(material) {
  return resumeMaterial(material, material.segments.find((segment) => segment.status === 'failed').page);
}
function materialResultMessage(result) {
  const outcome = learning.materialImportState;
  if (outcome?.failedPages > 0 && outcome.extractedSegments === 0)
    return `原件已保留，但本轮未提取到可用正文。请重试未解析页${result.nextPage ? `，剩余从第 ${result.nextPage} 页继续` : ''}；失败页不作为可靠题干或标准答案。`;
  if (result.nextPage)
    return `已保存片段；剩余从第 ${result.nextPage} 页继续，当前动作最多 ${result.pagesPerAction || 20} 页。`;
  if (outcome?.failedPages > 0) return '原件与已提取片段已保存，未解析页请重试；失败页不作为可靠题干或标准答案。';
  return '已保存私人资料和页图，未将识别内容自动作为标准答案。';
}
function resumeMaterial(material, startPage = material.nextPage) {
  return runMaterial(async (notify) => {
    if (appFileBusy.value) throw new Error('请先结束当前文件动作');
    const result = await learning.importFile({
      fileId: material.original?.connectorFileId || material.id,
      materialId: material.id,
      startPage,
      size: 0,
      name: material.name,
      allowRecognition: material.recognitionAllowed === true,
      ...(material.recognitionEngine && material.recognitionEngine !== 'tesseract'
        ? { recognitionEngine: material.recognitionEngine }
        : {}),
      ...(material.original?.storageId ? { storageId: material.original.storageId } : {})
    });
    notify(materialResultMessage(result));
    return result;
  });
}
function deleteMaterial(material) {
  return run(() => {
    const preview = learning.previewMaterialDeletion(material.id);
    showLearningDialog({
      title: '确认资料删除范围',
      type: 'warning',
      content: `清除「${preview.name}」、${preview.questions} 个关联题目版本、${preview.conversations} 个关联对话的全部正文（${preview.messages} 条）和作答（${preview.attempts} 次），同时清理本机恢复、迁移及冲突副本。计划保留任务分母，${preview.tasks} 项任务标为资料已删除。${preview.original ? '将请求原解析器删除原件与页图；失败会保留待办。' : ''}云端副本需主动同步删除墓碑；其他设备、已导出文件及运维备份另行处理。`,
      success: (res) => {
        if (res.confirm)
          run(async () => {
            const result = await learning.deleteMaterial(preview, true);
            clearMaterialEditor();
            backupText.value = '';
            restorePreview.value = null;
            feedback.value =
              result.original.status === 'pending'
                ? `本机关联记录已清理；解析器原件删除待确认：${result.original.message}`
                : '本机关联记录已清理，原件删除状态已确认。云端删除需主动同步；计划分母保留。';
          });
      }
    });
  });
}
function retryOriginalDeletion(deletion) {
  showLearningDialog({
    title: '重试解析器原件删除',
    type: 'warning',
    content: '仅向导入原件的已授权解析器请求删除该原件与页图；其他学习数据不变。',
    success: (res) => {
      if (res.confirm)
        run(async () => {
          const result = await learning.retryOriginalDeletion(deletion.deletionId, true);
          feedback.value =
            result.status === 'deleted' ? '解析器已确认原件与页图删除。' : `原件删除待确认：${result.message}`;
        });
    }
  });
}
function chooseMaterialFile() {
  if (clientPlatform === 'app')
    return runMaterial(async (notify) => {
      if (appFileBusy.value) throw new Error('文件动作仍在执行');
      discardAppFile();
      const owner = learning.recordContext(),
        controller = new AbortController();
      appFileController = controller;
      appFileContext = owner;
      appFileBusy.value = true;
      appFileStage = 'choose';
      try {
        const file = await chooseAppMaterialFile({
          signal: controller.signal,
          assertCurrent: () => {
            if (!appPageAlive || learning.recordContext() !== owner)
              throw new Error('账户或页面已变化，所选文件未读取或发送');
          }
        });
        selectedAppFile.value = file;
        selectedAppFileOwner.value = owner;
        notify('已选择文件元信息。请确认当前资料解析器后解析；尚未读取或发送文件正文。');
      } finally {
        if (appFileController === controller) {
          appFileController = null;
          appFileContext = null;
          appFileBusy.value = false;
          appFileStage = null;
        }
      }
    });
  if (learningClientPlatform() === 'weixin')
    return runMaterial(async (notify) => {
      if (!learning.materialConnection) throw new Error('请先授权资料连接器；文件不会自动上传云端');
      const action = beginClientFile(),
        allowRecognition = allowMaterialRecognition.value,
        recognitionEngine = materialRecognitionEngine.value;
      const assertCurrent = () => {
        if (!action.current()) throw new Error('账户、记录、页面或资料授权已变更，请重新选择；所选资料未发送');
      };
      try {
        const file = await chooseWeixinMaterialFile(assertCurrent);
        assertCurrent();
        clientFilePhase.value = 'confirm';
        const consent = await new Promise((resolve, reject) =>
          showLearningDialog({
            title: '发送至已授权的资料解析器',
            content: `将「${file.name}」原文件交给已授权目标。${recognitionLabel(recognitionEngine, allowRecognition)}；资料、原件与页图保持私人，关键条件仍需校对。`,
            confirmText: '解析资料',
            cancelText: '取消',
            success: resolve,
            fail: reject
          })
        );
        if (!consent.confirm) return;
        assertCurrent();
        clientFilePhase.value = 'read';
        const input = await readWeixinMaterialFile(file, { consent: true, assertCurrent });
        assertCurrent();
        clientFilePhase.value = 'import';
        const result = await learning.importFile({
          ...input,
          actionContext: action.context,
          allowRecognition,
          ...(allowRecognition || recognitionEngine === 'docling' ? { recognitionEngine } : {})
        });
        notify(materialResultMessage(result));
      } finally {
        action.finish();
      }
    });
  // #ifdef H5
  if (desktopHost)
    return runMaterial(async (notify) => {
      if (!learning.materialConnection) throw new Error('请先授权本地资料连接器；文件不会自动上传云端。');
      const action = beginClientFile(),
        allowRecognition = allowMaterialRecognition.value,
        recognitionEngine = materialRecognitionEngine.value;
      let file;
      try {
        file = await chooseDesktopMaterialFile({ isCurrent: action.current });
        if (!file) return;
        clientFilePhase.value = 'confirm';
        const consent = await new Promise((resolve, reject) =>
          showLearningDialog({
            title: '发送至已授权的本地解析器',
            content: `原文件只交给已授权资料连接器。当前${recognitionLabel(recognitionEngine, allowRecognition)}；关键条件仍需校对。`,
            confirmText: '解析资料',
            cancelText: '取消',
            isCurrent: action.current,
            success: resolve,
            fail: reject
          })
        );
        if (!consent.confirm || !action.current()) return;
        clientFilePhase.value = 'read';
        const input = await readDesktopMaterialFile(file, { consent: true, isCurrent: action.current });
        if (!action.current()) return;
        clientFilePhase.value = 'import';
        const result = await learning.importFile({
          ...input,
          actionContext: action.context,
          allowRecognition,
          ...(allowRecognition || recognitionEngine === 'docling' ? { recognitionEngine } : {})
        });
        notify(materialResultMessage(result));
      } finally {
        await discardDesktopMaterialFile(file);
        action.finish();
      }
    });
  if (!learning.materialConnection) {
    return runMaterial(() => {
      throw new Error('请先授权本地资料连接器；文件不会自动上传云端。');
    });
  }
  let action;
  try {
    action = beginClientFile();
  } catch (error) {
    return runMaterial(() => {
      throw error;
    });
  }
  materialFeedbackSequence++;
  materialFeedback.value = null;
  const allowRecognition = allowMaterialRecognition.value;
  const recognitionEngine = materialRecognitionEngine.value;
  const stillAuthorized = action.current;
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.pdf,.png,.jpg,.jpeg';
  picker.hidden = true;
  let selected = false;
  picker.oncancel = () => action.finish();
  picker.onchange = () => {
    if (selected || !stillAuthorized()) return;
    selected = true;
    const file = picker.files?.[0];
    if (!file) {
      action.finish();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      runMaterial(() => {
        throw new Error('文件超过 10 MB，请先按区段拆分。');
      });
      action.finish();
      return;
    }
    let confirmed = false;
    clientFilePhase.value = 'confirm';
    showLearningDialog({
      title: '发送至已授权的本地解析器',
      content: `原文件只交给已授权资料连接器。当前${recognitionLabel(recognitionEngine, allowRecognition)}；关键条件仍需校对。`,
      confirmText: '解析资料',
      cancelText: '取消',
      success: (consent) => {
        if (confirmed || !stillAuthorized()) return;
        confirmed = true;
        if (!consent.confirm) {
          action.finish();
          return;
        }
        const reader = new FileReader();
        clientFileReader = reader;
        clientFilePhase.value = 'read';
        let accepted = false;
        reader.onerror = () => {
          if (!stillAuthorized()) return;
          runMaterial(() => {
            throw new Error('文件读取失败，请重新选择；所选正文未发送。');
          });
          action.finish();
        };
        reader.onload = () =>
          runMaterial(async (notify) => {
            if (accepted || !stillAuthorized()) return;
            accepted = true;
            clientFileReader = null;
            clientFilePhase.value = 'import';
            try {
              const result = await learning.importFile({
                name: file.name,
                size: file.size,
                actionContext: action.context,
                contentBase64: String(reader.result).split(',')[1],
                allowRecognition,
                ...(allowRecognition || recognitionEngine === 'docling' ? { recognitionEngine } : {})
              });
              notify(materialResultMessage(result));
            } finally {
              action.finish();
            }
          });
        reader.readAsDataURL(file);
      },
      fail: () => action.finish()
    });
  };
  clientFilePicker = picker;
  try {
    document.body.appendChild(picker);
    picker.click();
  } catch {
    action.finish();
    return runMaterial(() => {
      throw new Error('文件选择未能打开，请重新选择；所选正文未读取或发送。');
    });
  }
  // #endif
}
function parseSelectedAppFile() {
  return runMaterial(async (notify) => {
    if (appFileBusy.value || !selectedAppFile.value || !appPageVisible) throw new Error('请先选择文件并返回当前页面');
    if (selectedAppFileOwner.value !== learning.recordContext()) {
      discardAppFile();
      throw new Error('所选文件不属于当前账户，请重新选择');
    }
    if (!learning.materialConnection) throw new Error('请先重新授权当前资料解析器；所选文件尚未读取或发送');
    const file = selectedAppFile.value,
      owner = learning.recordContext(),
      context = learning.prepareMaterialAction(),
      target = new URL(learning.materialConnection.endpoint).origin,
      allowRecognition = allowMaterialRecognition.value,
      recognitionEngine = materialRecognitionEngine.value,
      controller = new AbortController();
    appFileController = controller;
    appFileContext = owner;
    appFileBusy.value = true;
    appFileStage = 'read';
    appReadContext = context;
    const assertCurrent = () => {
      if (
        !appPageAlive ||
        !appPageVisible ||
        controller.signal.aborted ||
        learning.recordContext() !== owner ||
        learning.materialContext() !== context ||
        selectedAppFile.value !== file
      )
        throw new Error('账户、页面、连接或所选文件已变化，未发送资料');
    };
    try {
      const consent = await new Promise((resolve, reject) =>
        showLearningDialog({
          title: '发送所选文件至当前资料解析器',
          content: `将「${file.name}」（${file.size}字节）交给${target}。${recognitionLabel(recognitionEngine, allowRecognition)}；原件与页图保持私人，关键条件仍需校对。`,
          confirmText: '确认解析',
          cancelText: '取消',
          success: resolve,
          fail: reject
        })
      );
      if (!consent.confirm) return;
      assertCurrent();
      const input = await readAppMaterialFile(file, { consent: true, signal: controller.signal, assertCurrent });
      assertCurrent();
      appFileStage = 'import';
      const result = await learning.importFile({
        ...input,
        actionContext: context,
        allowRecognition,
        ...(allowRecognition || recognitionEngine === 'docling' ? { recognitionEngine } : {})
      });
      notify(materialResultMessage(result));
    } finally {
      if (selectedAppFile.value === file) discardAppFile();
      else releaseAppMaterialFile(file);
      if (appFileController === controller) {
        appFileController = null;
        appFileContext = null;
        appFileBusy.value = false;
        appFileStage = null;
        appReadContext = null;
      }
    }
  });
}
function structurePrivateQuestion() {
  return run(() => {
    if (materialEditorSourceChanged.value) throw new Error('请重新选择本页后再组织练习。');
    if (!learning.active) learning.start('根据私人资料学习');
    learning.structureQuestion(selectedMaterial.value.id, {
      segmentId: selectedSegment.value.id,
      prompt: privatePrompt.value,
      type: privateCandidate.value.options.length ? 'choice' : 'subjective',
      options: privateCandidate.value.options,
      reference: privateAnswer.value,
      userAnswer: importedUserAnswer.value,
      annotation: teacherAnnotation.value,
      uncertainties: privateConditionsConfirmed.value ? [] : privateCandidate.value.uncertainties
    });
    feedback.value = '题目已保存，答案待核对。';
  });
}
function structureObjective() {
  return run(() => {
    if (objectiveUnavailable.value) throw new Error(objectiveUnavailable.value);
    const input = objectiveInput();
    // 先用共享原文校验规则检查字段；失败不会留下空对话，也不会恢复已停止任务。
    createMaterialObjectiveQuestion('material-preview', currentEditorMaterial.value, input);
    if (!learning.active)
      learning.start('根据私人资料完成可校验练习', {
        track: taskTrack.value,
        stage: taskStage.value,
        edition: taskEdition.value
      });
    learning.structureObjective(selectedMaterial.value.id, input);
    showMaterial.value = false;
    feedback.value = '练习已准备好。';
    nextTick(() => uni.pageScrollTo({ selector: '#active-learning-question', duration: 0 }));
  });
}
function saveFoundation() {
  return run(() =>
    learning.commit('profile.set', {
      field: 'foundation',
      value: foundation.value,
      source: 'self_report',
      scope: learning.active?.goal || '当前任务'
    })
  );
}
function saveTimezone() {
  return run(() => learning.commit('timezone.set', { timezone: timezone.value }));
}
function savePlan() {
  return run(() =>
    learning.commit('plan.set', {
      tasks: planLines.value
        .split('\n')
        .filter((line) => line.trim())
        .map((title) => ({ title, condition: 'manual' })),
      reason: '用户编辑今日任务；历史计划保持可追溯'
    })
  );
}
function exportRecords() {
  return run(async () => {
    const content = learning.exportData();
    // 文件下载受浏览器宿主限制时，仍能查看并手动保存同一份备份。
    backupText.value = content;
    showRestore.value = true;
    restorePreview.value = null;
    // #ifdef H5
    if (desktopHost) {
      const context = learning.recordContext();
      const result = await saveDesktopLearningFile('records', content, {
        isCurrent: () => appPageAlive && learning.recordContext() === context
      });
      feedback.value = result.saved
        ? '个人记录备份已保存；包含私人学习内容，不含模型配置密钥。'
        : '已取消保存，仍可在下方面板查看备份。';
      return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'learning-records.json';
    link.click();
    URL.revokeObjectURL(url);
    feedback.value = '已生成个人记录备份，也可在下方面板查看和保存；包含私人学习内容，不含模型配置密钥。';
    // #endif
    // #ifndef H5
    uni.setClipboardData({ data: content });
    feedback.value = '个人记录已复制，请在可信位置保存。';
    // #endif
  });
}
function chooseBackupFile() {
  // #ifdef H5
  if (recordActionsBusy.value || !appPageAlive || !appPageVisible || !showData.value || !showRestore.value) return;
  if (!desktopHost && typeof AbortController !== 'function') {
    recordFileStatus.value = { phase: 'error', message: '当前浏览器无法取消文件读取，请继续粘贴 JSON 备份。' };
    return;
  }
  const request = {
    context: learning.recordContext(),
    revision: learning.state.revision,
    content: backupText.value,
    controller: desktopHost ? null : new AbortController()
  };
  const current = () =>
    activeRecordFile === request &&
    appPageAlive &&
    appPageVisible &&
    showData.value &&
    showRestore.value &&
    learning.recordContext() === request.context &&
    learning.state.revision === request.revision &&
    backupText.value === request.content;
  invalidateRecordPreviews();
  feedback.value = '';
  activeRecordFile = request;
  recordFileBusy.value = true;
  recordFileStatus.value = { phase: 'loading', message: '请选择 JSON 备份；原输入和记录保留，可取消。' };
  return (async () => {
    try {
      const content = await (desktopHost
        ? readDesktopLearningBackup({ isCurrent: current })
        : chooseBrowserLearningBackup({
            isCurrent: current,
            signal: request.controller.signal,
            onPhase: (phase) => {
              if (current() && phase === 'reading')
                recordFileStatus.value = { phase: 'loading', message: '正在读取备份文件，尚未校验或合并；可取消。' };
            }
          }));
      if (!current()) return;
      activeRecordFile = null;
      recordFileBusy.value = false;
      if (content === null) {
        recordFileStatus.value = { phase: 'cancelled', message: '已取消选择备份，原输入和记录保留。' };
        return;
      }
      backupText.value = content;
      restorePreview.value = null;
      recordFileStatus.value = { phase: 'success', message: '备份已读取，请校验并预览后确认合并；当前记录未修改。' };
    } catch (error) {
      if (current())
        recordFileStatus.value = {
          phase: 'error',
          message: error.message || '备份读取失败，请重新选择；原输入和记录保留。'
        };
    } finally {
      if (activeRecordFile === request) {
        activeRecordFile = null;
        recordFileBusy.value = false;
      }
    }
  })();
  // #endif
}
function deleteRecords() {
  showLearningDialog({
    title: '删除本地对话学习数据',
    type: 'warning',
    content:
      '删除当前用户的新学习记录、材料与恢复副本。旧题库和旧版学习数据保留；未确认原件的无正文定位待办保留，以便核对/取消，解析器原件与云端密钥需另行确认删除。',
    success: (res) => {
      if (res.confirm) run(() => learning.deleteData());
    }
  });
}
function previewRecords() {
  return prepareRecordPreview('restore');
}
let syncPageSequence = 0;
async function runRecordSync(action) {
  feedback.value = '';
  const sequence = syncPageSequence,
    context = learning.recordContext(),
    previous = learning.syncState;
  try {
    await action();
  } catch (failure) {
    if (
      appPageAlive &&
      appPageVisible &&
      sequence === syncPageSequence &&
      learning.recordContext() === context &&
      learning.syncState === previous
    )
      learning.syncState = { phase: 'error', kind: null, context, message: failure.message };
  }
}
function deleteCloudRecords() {
  if (recordActionsBusy.value) return;
  showLearningDialog({
    title: '删除云端学习副本',
    type: 'warning',
    content:
      '请先停止其他设备同步。删除后端学习副本和已存教学结果缓存，并取消已预留的模型任务；费用事实、模型密钥、本机与备份分别保留。以后主动同步或调用模型会产生新副本。',
    isCurrent: () => !recordActionsBusy.value,
    success: (result) => {
      if (result.confirm) runRecordSync(() => learning.deleteCloudRecords(true));
    }
  });
}
function restoreRecords() {
  const content = backupText.value;
  const preview = restorePreview.value;
  if (!preview) return;
  showLearningDialog({
    title: '合并学习备份',
    content: `新增 ${preview.imported} 个操作，保留当前记录，并创建恢复前副本。不会上传备份或恢复模型密钥。`,
    isCurrent: () => restorePreview.value === preview && backupText.value === content && !recordActionsBusy.value,
    success: (result) => {
      if (!result.confirm) return;
      run(() => {
        const restored = learning.restoreData(content, preview);
        feedback.value = `已合并 ${restored.imported} 个操作；统计已按有效记录重算。`;
        restorePreview.value = null;
        backupText.value = '';
        recordPreviewStatus.value = { phase: 'success', message: feedback.value };
      });
    }
  });
}
function rollbackRecords() {
  showLearningDialog({
    title: '撤销最近一次写入',
    type: 'warning',
    content: '恢复到最近一次写入前的本地副本。随后云同步仍需单独授权。',
    success: (result) => {
      if (result.confirm)
        run(() => {
          learning.rollbackRecords();
          feedback.value = '已恢复写入前记录。';
          restorePreview.value = null;
        });
    }
  });
}
function syncRecords() {
  if (recordActionsBusy.value) return;
  if (!getUserId() || !getToken()) {
    showLearningDialog({
      title: '登录后同步学习记录',
      content: '当前记录保留在本机。登录后，请再次选择同步并确认授权。',
      confirmText: '去登录',
      cancelText: '暂不登录',
      success: (result) => {
        if (!result.confirm) return;
        storageService.save('redirect_after_login', '/pages/learning/index');
        safeNavigateTo('/pages/login/index');
      }
    });
    return;
  }
  showLearningDialog({
    title: '同步当前用户的学习记录',
    content:
      '会把对话、私人资料片段、页图与学习记录发送至本项目后端，以便多设备使用。没有登录或服务不可用时，本地记录保留。',
    isCurrent: () => !recordActionsBusy.value,
    success: (res) => {
      if (res.confirm) runRecordSync(() => learning.syncRecords(true));
    }
  });
}
function previewGuestRecords() {
  return prepareRecordPreview('guest');
}
function migrateGuestRecords() {
  const preview = guestPreview.value;
  if (!preview) return;
  showLearningDialog({
    title: '确认访客记录属于你',
    content: '归入当前账户，保留已有任务和访客原件，并创建恢复前副本。不会上传；共享设备上的其他人记录请勿认领。',
    isCurrent: () => guestPreview.value === preview && !recordActionsBusy.value,
    success: (result) => {
      if (result.confirm)
        run(() => {
          const outcome = learning.migrateGuest(preview, true);
          feedback.value = `已归入 ${outcome.imported} 个访客操作，合并 ${outcome.mergedPlans} 份计划。`;
          guestPreview.value = null;
          recordPreviewStatus.value = { phase: 'success', message: feedback.value };
        });
    }
  });
}
function exportConflict(side) {
  return run(() => {
    backupText.value = learning.exportSyncConflict(side);
    showRestore.value = true;
    restorePreview.value = null;
    feedback.value = '冲突副本已在下方面板生成，请保存到可信位置；普通恢复仍会校验冲突并重新判分。';
  });
}
function resolveConflict(side) {
  if (recordActionsBusy.value) return;
  learning.refresh();
  const preview = learning.syncConflict;
  if (!preview) return;
  showLearningDialog({
    title: side === 'remote' ? '采用云端记录继续' : '恢复本机冲突副本',
    content:
      side === 'remote'
        ? '重新读取云端并校验未变更后，采用该版本。未合并的本机内容保留在冲突副本与恢复副本中；不会重复计入统计。'
        : '当前本机数据先保存为恢复副本，再采用发生冲突时的本机版本。云端不改变。',
    isCurrent: () => !recordActionsBusy.value && learning.isSyncConflictCurrent(preview),
    success: (result) => {
      if (result.confirm)
        runRecordSync(async () => {
          if (side === 'remote') await learning.adoptCloudRecords(preview, true);
          else learning.restoreConflictLocal(preview);
        });
    }
  });
}
function removeConflict() {
  if (recordActionsBusy.value) return;
  learning.refresh();
  const preview = learning.syncConflict;
  if (!preview) return;
  showLearningDialog({
    title: '移除冲突副本',
    type: 'warning',
    content: '请先导出需要保留的两份副本。移除仅删除此冲突归档，不会删除当前本机或云端学习记录。',
    isCurrent: () => !recordActionsBusy.value && learning.isSyncConflictCurrent(preview),
    success: (result) => {
      if (result.confirm) runRecordSync(() => learning.clearSyncConflict(preview));
    }
  });
}
onShow(() => {
  labVisible.value = true;
  appPageVisible = true;
  return run(() => learning.refresh());
});
onHide(() => {
  labVisible.value = false;
  appPageVisible = false;
  cancelRecordFile();
  syncPageSequence++;
  invalidateRecordPreviews();
  learning.cancelModelReads();
  materialFeedbackSequence++;
  materialFeedback.value = null;
  dialogs.dismiss();
  discardClientFile();
  if (appFileStage !== 'choose') {
    appFileController?.abort();
    discardAppFile();
  }
  profile.value.apiKey = '';
  localToken.value = '';
  materialToken.value = '';
  learning.localConnection = null;
  learning.materialConnection = null;
  learning.sharingAllowed = false;
  learning.cancel();
  learning.cancelMaterial();
  learning.cancelSync({ clearFeedback: true });
});
onUnmounted(() => {
  labVisible.value = false;
  appPageAlive = false;
  cancelRecordFile();
  syncPageSequence++;
  invalidateRecordPreviews();
  learning.cancelModelReads();
  dialogs.destroy();
  discardClientFile();
  appPageVisible = false;
  appFileController?.abort();
  discardAppFile();
  learning.cancel();
  learning.cancelMaterial();
  learning.cancelSync({ clearFeedback: true });
  profile.value.apiKey = '';
  localToken.value = '';
  materialToken.value = '';
  learning.localConnection = null;
  learning.materialConnection = null;
});
</script>
<style scoped>
.learning-page {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.material-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--space-line);
  overflow-wrap: anywhere;
}
.material-status--stack {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.material-status-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.material-status--error {
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: var(--space-warning-bg);
}
.material-progress {
  height: 4px;
  overflow: hidden;
  border-radius: 12px;
  background: var(--space-line);
}
.material-progress-fill {
  height: 100%;
  background: var(--space-paper);
  transform-origin: left;
  transition: transform 180ms ease-out;
}
.material-empty {
  color: var(--space-muted);
  padding: 12px 0;
  overflow-wrap: anywhere;
}
.conversation-day {
  scroll-margin-top: 88px;
}
.conversation-day-heading {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 28px 0 16px;
  color: var(--space-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.conversation-day-rule {
  height: 1px;
  flex: 1;
  background: var(--space-line);
}
.chapter-modules {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}
.learning-space .chapter-modules button {
  width: 100%;
  margin: 0;
  padding: 12px 0;
  gap: 12px;
  justify-content: flex-start;
  text-align: left;
  background: transparent;
  border: 0;
  box-shadow: none;
  white-space: normal;
}
.chapter-module-count {
  margin-left: auto;
  color: var(--space-muted);
  font-size: 12px;
  white-space: nowrap;
}
#learning-journey-workspace {
  scroll-margin-top: 88px;
}
.today-layout.in-session {
  grid-template-columns: 1fr;
}
.welcome-copy {
  padding: 4px 0 24px;
}
.welcome-title {
  white-space: pre-line;
  display: block;
  font-size: 38px;
  line-height: 1.3;
  font-weight: 300;
  letter-spacing: -0.03em;
}
.goal-panel {
  padding: 24px;
  border-radius: 24px;
  background: var(--space-glass);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.goal-panel .field {
  height: 88px;
  padding: 12px 0;
  margin-top: 8px;
  border: 0;
  background: transparent;
}
.goal-panel input.field {
  height: 44px;
}
.preference-fields {
  display: grid;
  gap: 8px;
  margin: 12px 0;
}
.field-label {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--space-muted);
}
.choice-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.learning-space .choice-options button {
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
}
.goal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.learning-space .material-shortcut {
  background: transparent;
  padding-left: 0;
  font-size: 12px;
}
.starter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--space-line);
  font-size: 11px;
  color: var(--space-muted);
}
.learning-space .starter-row button {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 24px;
}
.today-layout:not(.in-session) {
  order: 1;
}
.workspace-tools {
  order: 2;
}
.feedback {
  order: 3;
}
.today-layout {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 16px;
  margin: 20px 0;
}
.rhythm-panel {
  padding: 20px;
  border-radius: 24px;
  background: var(--space-glass);
}
.rhythm-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.rhythm-heading .section-title {
  font-size: 16px;
}
.rhythm-heading .subtle {
  font-size: 10px;
}
.rhythm-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.learning-space .rhythm-options button {
  text-align: left;
  justify-content: flex-start;
  padding: 9px 10px;
  background: transparent;
  gap: 10px;
}
.rhythm-options .rhythm-copy {
  flex: 1;
}
.learning-space .rhythm-options button.chosen {
  background: var(--space-user);
}
.rhythm-name {
  font-size: 13px;
  display: block;
}
.connection-pill {
  border-radius: 24px !important;
  font-size: 11px !important;
  min-height: 44px !important;
  padding: 8px 12px !important;
}
.conversation-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0 20px;
  border-bottom: 1px solid var(--space-line);
}
.conversation-toolbar > view {
  min-width: 0;
}
.conversation-title {
  display: block;
  font-size: 26px;
  font-weight: 400;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.conversation-toolbar button {
  flex-shrink: 0;
  align-self: flex-start;
}
.message {
  max-width: 68ch;
  padding: 14px 0;
  margin: 8px 0;
}
.message-role {
  display: block;
  color: var(--space-muted);
  font-size: 11px;
  margin-bottom: 6px;
}
.message-content {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 15px;
  line-height: 1.9;
}
.message.user {
  margin-left: auto;
  padding: 14px 18px;
  border-radius: 20px 20px 6px 20px;
  background: var(--space-user);
  width: fit-content;
  max-width: 80%;
}
.message.notice,
.message.tool {
  border: 0;
  padding: 12px 16px;
  border-radius: 16px;
  background: var(--space-notice);
}
.message.notice .message-content,
.message.tool .message-content {
  font-size: 12px;
  line-height: 1.9;
}
.question-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  margin: 20px 0;
  background: var(--yozi-solid);
  border-radius: 24px;
}
.question-prompt {
  font-size: 23px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.strategy {
  margin: 12px 0;
}
.method-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 22px;
}
.methods {
  margin: 8px 0 16px;
}
.methods button {
  font-size: 12px;
  border-radius: 24px;
}
.composer {
  background: var(--space-composer);
  padding: 16px;
  border-radius: 24px;
  margin-top: 16px;
  position: sticky;
  bottom: 16px;
  z-index: 2;
  box-shadow: var(--yozi-shadow);
}
.composer .field {
  height: 86px;
  border: 0;
  background: transparent;
  padding: 4px 2px;
}
.composer .button-row {
  justify-content: flex-end;
  margin-top: 10px;
}
.composer .button-row button {
  font-size: 12px;
}
@media (max-width: 520px) {
  .composer {
    position: static;
  }
}
.workspace-tools {
  padding-top: 12px;
  margin-top: 24px;
  border-top: 1px solid var(--space-line);
}
.workspace-tools > .button-row button {
  background: transparent;
  font-size: 12px;
  padding-left: 0;
}
.source-preview {
  width: 100%;
}
.source-excerpt {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.objective-field {
  max-width: 100%;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
}
@media (max-width: 1100px) {
  .today-layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 900px) {
  .welcome-title {
    white-space: pre-line;
    font-size: 36px;
  }
  .welcome-copy {
    padding-top: 8px;
    padding-bottom: 26px;
  }
  .composer {
    bottom: calc(104px + env(safe-area-inset-bottom));
  }
}
@media (max-width: 520px) {
  .welcome-title {
    white-space: pre-line;
    font-size: 32px;
  }
  .goal-panel {
    padding: 20px;
  }
  .goal-actions {
    gap: 8px;
  }
  .goal-actions button {
    padding: 10px 12px;
  }
  .learning-space .material-shortcut {
    font-size: 11px;
    padding: 8px 0;
  }
  .rhythm-options {
    flex-direction: row;
    gap: 6px;
  }
  .learning-space .rhythm-options button {
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 8px;
    min-width: 0;
  }
  .rhythm-name {
    font-size: 12px;
    white-space: nowrap;
  }
  .rhythm-heading {
    margin-bottom: 8px;
  }
  .conversation-title {
    font-size: 22px;
  }
  .conversation-toolbar > button {
    font-size: 11px;
    padding: 8px;
  }
  .message-content {
    font-size: 14px;
  }
  .question-prompt {
    font-size: 21px;
  }
  .composer .button-row {
    justify-content: flex-start;
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .goal-panel {
    background: var(--space-glass);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .message.user {
    background: var(--space-user);
  }
  .message.notice,
  .message.tool {
    background: var(--space-notice);
  }
}
</style>
