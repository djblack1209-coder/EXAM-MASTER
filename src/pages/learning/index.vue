<template>
  <LearningShell active="learning" title="对话学习" @materials="showMaterial = true" @new="newConversation">
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
        <BaseIcon name="settings" :size="30" color="#f8f5ee" />
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
        <text class="welcome-description">一个问题，一段对话。让理解慢慢清晰，让每一步都有迹可循。</text>
      </view>
      <view v-if="showConnections" class="panel">
        <text class="section-title">选择模型与数据流向</text>
        <text class="subtle">
          当前：{{
            learning.selectedMode === 'offline'
              ? '本地记录，无模型调用'
              : learning.selectedMode === 'local'
                ? '当前客户端 → 已授权本地连接器'
                : '客户端 → 本项目后端 → 所选供应商'
          }}
        </text>
        <view class="button-row">
          <button role="button" tabindex="0" size="mini" @tap="setMode('offline')">本地记录</button>
          <button role="button" tabindex="0" size="mini" @tap="loadModels">查看云模型</button>
          <!-- #ifdef H5 || MP-WEIXIN || APP-PLUS -->
          <button role="button" tabindex="0" size="mini" @tap="localForm = !localForm">本地连接器</button>
          <!-- #endif -->
        </view>
        <view v-for="model in learning.models" :key="model.id" class="model-row">
          <text>
            {{ model.provider }} / {{ model.model }} ·
            {{ model.source === 'byok' ? '自带 API，上游费用自行承担' : '可选平台模型服务' }}
          </text>
          <text class="subtle">
            {{ connectionStatusLabel(model.connectionStatus) }} · 文本；结构化
            {{ model.capabilities.structured ? '已声明' : '校验适配' }} · 视觉
            {{
              model.capabilities.vision && model.visionAdapter
                ? 'H5辅助解读 ' + connectionStatusLabel(model.visionStatus)
                : '不可用'
            }}
            · 流式
            {{ model.capabilities.stream ? connectionStatusLabel(model.streamStatus) : '未开放' }}
          </text>
          <text v-if="model.terms" class="subtle">{{ model.terms }}</text>
          <text v-if="model.privacy" class="subtle">{{ model.privacy }}</text>
          <button role="button" tabindex="0" size="mini" @tap="selectModel(model.id)">
            {{ learning.modelId === model.id ? '已选择' : '使用此模型' }}
          </button>
          <button role="button" tabindex="0" size="mini" @tap="testModel(model.id)">测试连接</button>
          <button v-if="model.source === 'byok'" role="button" tabindex="0" size="mini" @tap="removeModel(model.id)">
            删除服务端密钥
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
          允许向所选模型发送当前目标、最近消息与当前题目；不发送整份资料
        </button>
        <button
          role="checkbox"
          tabindex="0"
          :aria-checked="learning.streamEnabled"
          :disabled="learning.busy || !learning.streamSupported"
          @tap="learning.streamEnabled = !learning.streamEnabled"
        >
          {{ learning.streamEnabled ? '☑' : '☐' }} 接收流式教学预览
        </button>
        <text class="subtle">{{
          learning.streamPlatform === 'unsupported'
            ? '此端尚无可靠分块传输，请主动使用非流式。'
            : '仅所选模型声明流式能力时可启用；断流不自动重试或改换消费模式。'
        }}</text>
        <button role="button" tabindex="0" size="mini" @tap="byokForm = !byokForm">配置自带云端 API</button>
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
          <input v-model="profile.id" placeholder="配置名称，如 my-model" maxlength="60" />
          <input v-model="profile.provider" placeholder="供应商名称" maxlength="80" />
          <input v-model="profile.model" placeholder="真实模型 ID" maxlength="120" />
          <input v-model="profile.endpoint" placeholder="HTTPS 完整 chat/completions 地址" />
          <input v-model="profile.apiKey" password placeholder="API 密钥，只交给本项目后端保险库" />
          <text class="subtle">
            连接测试会真实调用所选模型并记录用量。自带API不扣平台额度，上游额度和费用由供应商规则决定。
          </text>
          <text class="subtle">
            需登录及服务端端点白名单。密钥由后端 AES-GCM
            保存，持有部署保险库密钥的管理员可以解密；不承诺端到端保密。删除后备份按部署政策到期清除。
          </text>
          <button role="checkbox" tabindex="0" :aria-checked="profile.stream" @tap="profile.stream = !profile.stream">
            {{ profile.stream ? '☑' : '☐' }} 声明此型号支持 OpenAI 兼容 SSE 与用量收据（请核对供应商文档）
          </button>
          <button role="checkbox" tabindex="0" :aria-checked="profile.vision" @tap="profile.vision = !profile.vision">
            {{ profile.vision ? '☑' : '☐' }} 声明此型号支持 OpenAI 兼容图片输入（H5非流式，上游可能计费）
          </button>
          <label class="consent">
            <checkbox :checked="vaultConsent" @tap="vaultConsent = !vaultConsent" />
            同意本项目后端保存密钥并向指定供应商调用
          </label>
          <button role="button" tabindex="0" size="mini" @tap="saveModel">保存连接</button>
        </view>
        <view v-if="localForm" class="form">
          <input v-model="localEndpoint" placeholder="本地连接器完整地址，如 http://127.0.0.1:8766/chat" />
          <input v-model="localModel" placeholder="本地模型 ID" />
          <input v-model="localToken" password placeholder="本地连接器令牌，仅本次内存保存" />
          <text class="subtle">
            当前客户端只向已授权目标直连。手机的 localhost 是手机自身；连接电脑需填写可达地址并获网络许可。
            模型能力不足时不会自动上传资料或切换平台消费。
          </text>
          <!-- #ifdef MP-WEIXIN -->
          <text class="subtle"
            >微信需基础库3.2.2以上、手机或开发者工具；保留合法域名/HTTPS与隐私要求。服务端需授权微信客户端来源
            {{ WEIXIN_CONNECTOR_ORIGIN }}，真机网络仍须验证。</text
          >
          <!-- #endif -->
          <!-- #ifdef APP-PLUS -->
          <text class="subtle"
            >App需装配受保护原生模块，服务端需允许来源
            {{ APP_CONNECTOR_ORIGIN }}；缺模块不发送请求，设备网络仍待验。</text
          >
          <!-- #endif -->
          <button role="button" tabindex="0" size="mini" @tap="connectLocal">授权此目标并连接</button>
          <text v-if="learning.localConnection?.status" class="subtle">
            {{
              learning.localConnection.status === 'model_verified'
                ? '此模型已成功响应当前本机会话'
                : '连接器已验证，模型推理待验'
            }}
            · 仅文本
          </text>
        </view>
        <button role="button" tabindex="0" size="mini" @tap="loadUsage">查看模型用量</button>
        <view v-if="learning.usage" class="subtle">
          <text>
            周起始 {{ learning.usage.entitlement.week }} · {{ learning.usage.entitlement.timezone }} · 开发规则
            {{ learning.usage.entitlement.policyVersion }}
          </text>
          <text>
            权益规则：开发配置，尚未定价；平台剩余额度
            {{
              learning.usage.entitlement.weeklyUnits -
              learning.usage.entitlement.spent -
              learning.usage.entitlement.reserved
            }}
          </text>
          <text>
            平台成本已结算 {{ learning.usage.cost.spent }} · 预留 {{ learning.usage.cost.reserved }} · 待结算
            {{ learning.usage.cost.pending }} 次。真实收费关闭。
          </text>
          <text v-if="learning.usage.byokBudget">
            自带 API 已预留或执行 {{ learning.usage.byokBudget.used }} / {{ learning.usage.byokBudget.limit }} 次，
            此安全上限不按周补给；上游成本待结算 {{ learning.usage.byokBudget.pendingCosts }} 次，不扣平台额度。
          </text>
          <text v-if="learning.usage.resultCache">
            原调用恢复缓存 {{ learning.usage.resultCache.entries }} /
            {{ learning.usage.resultCache.policy.maxEntries }} 条， {{ learning.usage.resultCache.bytes }} /
            {{ learning.usage.resultCache.policy.maxBytes }} 字节； 最长保留
            {{ Math.floor(learning.usage.resultCache.policy.ttlMs / 60000) }} 分钟，访问时清理。
            到期或容量淘汰后不会自动重新生成或扣量，已保存对话与费用记录保留。
          </text>
        </view>
      </view>
      <view v-if="!learning.active" class="goal-panel">
        <text class="section-title">从你想学的开始</text>
        <textarea
          v-model="goal"
          class="field"
          aria-label="学习目标"
          placeholder="想理解的概念、卡住的题目，或今天的学习目标…"
          placeholder-class="space-placeholder"
          maxlength="1000"
        ></textarea>
        <view class="goal-actions">
          <button class="material-shortcut" role="button" tabindex="0" @tap="showMaterial = !showMaterial">
            <BaseIcon name="upload" :size="32" color="#f8f5ee" />
            <text>带上自己的资料</text>
          </button>
          <button role="button" tabindex="0" class="primary" :disabled="!goal.trim()" @tap="start">
            开始学习
            <BaseIcon name="arrow-right" :size="30" color="#3f4234" />
          </button>
        </view>
        <view class="starter-row">
          <text>也可以试试</text>
          <button v-for="starter in starters" :key="starter" role="button" tabindex="0" @tap="goal = starter">
            {{ starter }}
          </button>
        </view>
        <text class="subtle start-note">
          无需上传资料或填写问卷。本地支持有限计算练习；其他主题可先保存目标，再连接模型。
        </text>
      </view>
      <view v-if="learning.active" class="session-progress" aria-live="polite">
        <text>今日任务 {{ learning.summary.tasks.numerator }}/{{ learning.summary.tasks.denominator }}</text>
        <text>有效作答 {{ learning.summary.validAnswers }} 次</text>
        <text>错题 {{ learning.summary.mistakes.length }} · 待核对 {{ learning.summary.pending }}</text>
      </view>
      <view v-if="learning.active" class="conversation-area">
        <view class="conversation-toolbar">
          <view>
            <text class="conversation-title">{{ learning.active.goal }}</text>
            <text class="subtle">对话会自动保存，作答与复习在这里接着发生。</text>
          </view>
          <button role="button" tabindex="0" size="mini" :disabled="learning.busy" @tap="newConversation">
            <BaseIcon name="plus" :size="30" color="#f8f5ee" />
            <text>新对话</text>
          </button>
        </view>
        <view v-if="learning.active.messages.length > 50" class="conversation-toolbar">
          <button
            role="button"
            size="mini"
            :disabled="messageStart === 0"
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
          v-for="message in visibleMessages"
          :id="message.id"
          :key="message.id"
          class="message"
          :class="message.role"
        >
          <text class="message-role">{{ roleLabel(message.role) }}</text>
          <text class="message-content" selectable>{{ message.content }}</text>
        </view>
        <view v-if="learning.activeQuestion" class="question-block">
          <text class="subtle">
            {{ learning.activeQuestion.scope === 'generated' ? '工具或模型生成题' : '私人资料题' }} · 版本
            {{ learning.activeQuestion.version }} ·
            {{ learning.activeQuestion.validation ? '有独立校验依据' : '答案待核对' }}
          </text>
          <text class="question-prompt" selectable>{{ learning.activeQuestion.prompt }}</text>
          <view v-if="learning.activeQuestion.prerequisite" class="button-row">
            <text class="subtle">先修诊断：{{ learning.diagnosticProgress?.text }}</text>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy"
              @tap="learning.focus(learning.activeQuestion.prerequisite.originalQuestionKey)"
            >
              返回诊断原题
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.active.stopped"
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
              @tap="interpretImage"
            >
              辅助解读本题原页图
            </button>
            <text class="subtle">需逐次确认发送这一页。角色、文字及图形位置是待校对候选，本次不判分、不记错题。</text>
          </view>
          <text v-if="learning.activeQuestion.conditionAnalysis" class="subtle">
            条件关系工具：比较P⇒Q与Q⇒P，写出充分不必要、必要不充分、充要或既不充分也不必要。
            {{
              learning.activeQuestion.conditionAnalysis.status === 'verified'
                ? '保留共同数域与显式排除条件；完整零点分段核验，不以少数同真例子证明蕴含。'
                : '共同定义域不足或表达超出可核验范围；先待核对，不计入可靠错题。'
            }}
          </text>
          <text v-else-if="learning.activeQuestion.algebra?.task === 'inequality'" class="subtle">
            一次不等式工具：完整实数域、有理系数；可用不等式或区间作答。
            比较完整解集，方向或开闭边界不等价判错；不明确表达先澄清。
            变量分母、二次/整数域及未校对条件待核对，图示按帮助记录。
          </text>
          <text v-else-if="learning.activeQuestion.algebra" class="subtle">
            精确代数工具：单变量 x、有界分数、多项式与有理式；方程限一次及有理根二次。
            {{
              learning.activeQuestion.algebra.status === 'verified'
                ? '保留原定义域；漏写关键条件先待核对。'
                : '当前表达超出可核验范围，作答仍可保存，暂不计入可靠错题。'
            }}
          </text>
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
          <text v-for="(option, index) in learning.activeQuestion.options || []" :key="index">{{ option }}</text>
          <text v-for="(issue, index) in learning.activeQuestion.uncertainties || []" :key="index" class="warning">
            {{ issue.resolved ? '已校对' : '待校对' }}：{{ issue.field }} {{ issue.reason }}
          </text>
          <view v-if="learning.activeQuestion.rubric" class="form">
            <text class="subtle">评分维度 · 用户定义或参考候选，不等于独立答案依据</text>
            <text v-for="criterion in learning.activeQuestion.rubric.criteria" :key="criterion.id" class="subtle">
              {{ criterion.name }}（{{ criterion.maxScore }}分）：{{ criterion.description }}
            </text>
          </view>
          <view v-if="rubricAssessment" class="form" aria-label="当前作答的辅助评分">
            <text class="warning">
              AI 辅助评分（待核对）：{{ rubricAssessment.score === null ? '未定分' : rubricAssessment.score }} /
              {{ rubricAssessment.maxScore }}。不计入可靠首答错题率或掌握检验。
            </text>
            <view v-for="dimension in rubricAssessment.dimensions" :key="dimension.id">
              <text class="subtle">
                {{ dimension.name }}：{{ dimension.score === null ? '待核对' : dimension.score }} /
                {{ dimension.maxScore }} · {{ dimension.feedback }}
              </text>
              <view v-for="(quote, index) in dimension.evidence" :key="index">
                <text class="subtle" selectable>原答引用：{{ quote }}</text>
                <template v-if="dimension.evidenceLocations?.[index]">
                  <text class="subtle"
                    >原答第{{ dimension.evidenceLocations[index].startCharacter }}至{{
                      dimension.evidenceLocations[index].endCharacter
                    }}字 · 同文第{{ dimension.evidenceLocations[index].occurrence }}/{{
                      dimension.evidenceLocations[index].occurrences
                    }}处</text
                  >
                  <text class="subtle" selectable
                    >附近原文：{{ dimension.evidenceLocations[index].before }}【{{ quote }}】{{
                      dimension.evidenceLocations[index].after
                    }}</text
                  >
                </template>
                <text v-else class="subtle">旧记录未定位，引用仍待核对。</text>
              </view>
            </view>
          </view>
          <view class="button-row">
            <button role="button" tabindex="0" size="mini" @tap="hint">记录一次提示</button>
            <button role="button" tabindex="0" size="mini" @tap="variant">变式练习</button>
            <button role="button" tabindex="0" size="mini" @tap="editQuestion">局部校对</button>
            <button
              v-if="learning.activeQuestion.answerType === 'subjective' && !learning.activeQuestion.validation"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.materialBusy || learning.syncBusy"
              @tap="editRubric"
            >
              评分维度
            </button>
          </view>
          <view v-if="showRubric" class="form" aria-label="主观题评分维度编辑">
            <text class="subtle"
              >可选，最多6个维度。保存生成新题版本和新任务，旧作答/维度/计划分母保留；修改维度不构成新的独立首答。</text
            >
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
                @tap="addRubricCriterion"
              >
                增加维度
              </button>
              <button role="button" tabindex="0" size="mini" @tap="saveRubric">保存评分维度版本</button>
              <button role="button" tabindex="0" size="mini" @tap="showRubric = false">取消编辑</button>
            </view>
            <text class="subtle"
              >模型只按这些维度给辅助意见；原答引用可核对，语义与分值仍需核对。缺分时总分未定；满分/零分/其余表达为正确/错误/部分正确，均不升级可靠判分。</text
            >
          </view>
        </view>
        <text v-if="learning.activeStrategy.reason" class="subtle strategy">
          教学调整：{{ learning.activeStrategy.reason }}
        </text>
        <view v-if="learning.active.stopped" class="button-row">
          <text class="warning">当前任务已停止；切换题目不会解除停止。</text>
          <button role="button" tabindex="0" size="mini" :disabled="learning.busy" @tap="sendDirective('继续当前任务')">
            继续当前任务
          </button>
        </view>
        <view class="method-heading">
          <text class="subtle">把教法交给你</text>
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
          <button role="button" tabindex="0" size="mini" :disabled="learning.busy" @tap="sendDirective('恢复自动教法')">
            恢复自动教法
          </button>
          <button
            v-for="action in visibleActions"
            :key="action"
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.busy && action !== '停止当前任务'"
            @tap="sendDirective(action)"
          >
            {{ action }}
          </button>
        </view>
        <view v-if="learning.streamPreview" class="message notice" aria-live="polite">
          <text class="subtle">接收中的教学内容 · 尚未校验，未执行工具</text>
          <text>{{ learning.streamPreview }}</text>
        </view>
        <view v-if="learning.recoverableRequest && !learning.busy" class="button-row">
          <text class="subtle"
            >本次模型请求未在对话确认完成。可只读取服务端结果；不会重新调用或扣量，学习上下文须保持一致。</text
          >
          <button role="button" tabindex="0" size="mini" @tap="run(() => learning.recoverModelResult())">
            读取本次已完成结果
          </button>
        </view>
        <view class="composer">
          <textarea
            v-model="draft"
            class="field"
            aria-label="消息或作答"
            placeholder="说说目标、提问或直接作答；不明确的表达会先澄清"
            placeholder-class="space-placeholder"
            maxlength="8000"
          ></textarea>
          <view class="button-row">
            <button v-if="learning.busy" role="button" tabindex="0" @tap="learning.cancel">取消请求</button>
            <button v-else role="button" tabindex="0" class="primary" :disabled="!draft.trim()" @tap="send">
              发送
            </button>
            <button
              v-if="learning.activeQuestion"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || !draft.trim() || learning.active.stopped"
              @tap="submitExplicit"
            >
              确认这是正式作答
            </button>
          </view>
        </view>
      </view>
      <view class="today-layout" :class="{ 'in-session': !!learning.active }">
        <view class="rhythm-panel">
          <view class="rhythm-heading">
            <text class="section-title">找到今天的节奏</text>
            <text class="subtle">可选 · 随时调整</text>
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
              @tap="chooseRhythm(rhythm.id)"
            >
              <BaseIcon :name="rhythm.icon" :size="36" color="#f8f5ee" />
              <view class="rhythm-copy">
                <text class="rhythm-name">{{ rhythm.label }}</text>
                <text class="rhythm-description">{{ rhythm.description }}</text>
              </view>
              <BaseIcon v-if="selectedRhythm === rhythm.id" name="check" :size="32" color="#f8f5ee" />
            </button>
          </view>
          <text v-if="rhythmFeedback" class="subtle" role="status">{{ rhythmFeedback }}</text>
        </view>
        <LearningOverview :show-navigation="false" />
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
            <BaseIcon name="folder" :size="30" color="#f8f5ee" />
            导入与校对资料
          </button>
          <button role="button" tabindex="0" size="mini" :aria-expanded="showProfile" @tap="showProfile = !showProfile">
            目标与计划
          </button>
          <button role="button" tabindex="0" size="mini" :aria-expanded="showData" @tap="showData = !showData">
            记录与隐私
          </button>
        </view>
        <view v-if="showData" class="panel">
          <text class="section-title">你的学习，由你保管</text>
          <text class="subtle"
            >当前资料与记录保存于设备，退出登录后仍按账户隔离保留。同步会先征求授权；导出不含模型密钥。</text
          >
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
            <button role="button" tabindex="0" size="mini" :disabled="learning.syncBusy" @tap="syncRecords">
              同步学习记录
            </button>
            <button v-if="learning.syncBusy" role="button" tabindex="0" size="mini" @tap="learning.cancelSync">
              取消同步
            </button>
            <button
              v-if="learning.state.owner !== 'guest'"
              role="button"
              tabindex="0"
              size="mini"
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
              :disabled="learning.syncBusy"
              @tap="deleteCloudRecords"
            >
              删除云端学习副本
            </button>
          </view>
          <view v-if="learning.historyBusy">
            <text class="subtle"
              >历史校验 {{ learning.historyProgress?.completed || 0 }} /
              {{ learning.historyProgress?.total || 0 }}，完成预览前未修改记录。</text
            >
            <button role="button" size="mini" @tap="learning.cancelHistory()">取消历史校验</button>
          </view>
          <text v-if="learning.syncBusy && learning.syncProgress" class="subtle" role="status"
            >{{ learning.syncProgress.phase }} · {{ learning.syncProgress.calls }} 次请求；已接收批次可幂等补传。</text
          >
          <view v-if="guestPreview" class="form">
            <text class="subtle" role="status"
              >访客新增 {{ guestPreview.imported }} 个操作 · 已有 {{ guestPreview.reused }} 个操作 · 合并
              {{ guestPreview.mergedPlans }} 份计划 · {{ guestPreview.pendingReferences }} 道题待核对</text
            >
            <text class="subtle">仅归入当前账户，不上传；本设备访客原件保留。请确认这些记录属于你。</text>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="!guestPreview.imported"
              @tap="migrateGuestRecords"
            >
              确认访客记录归属
            </button>
          </view>
          <view v-if="learning.syncConflict" class="form">
            <text class="section-title">同步冲突待处理</text>
            <text class="subtle"
              >当前继续使用本机记录。冲突副本：本机 {{ learning.syncConflict.localEvents }} 个操作，云端
              {{ learning.syncConflict.remoteEvents }} 个操作；标识
              {{ learning.syncConflict.ids.join('、') }}。两份副本不会重复计入统计。</text
            >
            <view class="button-row">
              <button role="button" tabindex="0" size="mini" @tap="exportConflict('local')">导出本机冲突副本</button>
              <button role="button" tabindex="0" size="mini" @tap="exportConflict('remote')">导出云端冲突副本</button>
              <button role="button" tabindex="0" size="mini" @tap="resolveConflict('remote')">采用云端继续</button>
              <button role="button" tabindex="0" size="mini" @tap="resolveConflict('local')">恢复本机冲突副本</button>
              <button role="button" tabindex="0" size="mini" @tap="removeConflict">移除已保存的冲突副本</button>
            </view>
          </view>
          <view v-if="showRestore" class="form">
            <text class="subtle">
              粘贴同一账户的 JSON
              备份，仅在设备校验。超过500操作的旧备份及分页历史包，每批最多20操作核验，可取消。历史上限600万字符/2万操作，设备空间不足时保留原记录。
            </text>
            <textarea
              v-model="backupText"
              class="field"
              aria-label="学习记录 JSON 备份"
              placeholder="粘贴导出的 learning-records.json 内容"
              :maxlength="12000000"
              @input="restorePreview = null"
            ></textarea>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.materialBusy"
              @tap="previewRecords"
            >
              校验并预览
            </button>

            <view v-if="restorePreview">
              <text class="subtle" role="status">
                新增 {{ restorePreview.imported }} 个操作 · 已有 {{ restorePreview.reused }} 个操作 ·
                {{ restorePreview.pendingReferences }} 道题待核对 · {{ restorePreview.pendingReviews }} 项复习暂停
              </text>
              <button role="button" tabindex="0" size="mini" :disabled="!restorePreview.imported" @tap="restoreRecords">
                确认合并记录
              </button>
            </view>
            <button role="button" tabindex="0" size="mini" @tap="rollbackRecords">撤销最近一次写入</button>
          </view>
        </view>
        <view v-if="showMaterial" id="material-intake" class="form panel">
          <text class="section-title">你的资料，进入同一段学习</text>
          <text class="subtle">
            粘贴资料只在设备保存。PDF /
            图片需经过已授权的解析连接器，原文件、页码或区域会保留；不清楚的条件先校对。Apple 原生 文字识别
            不能直接用于所有端。
          </text>
          <textarea
            v-model="materialText"
            class="field"
            placeholder="粘贴一段资料，最多 50000 字"
            maxlength="50000"
          ></textarea>
          <button role="button" tabindex="0" size="mini" @tap="importText">本地保存分段资料</button>
          <!-- #ifdef H5 || MP-WEIXIN || APP-PLUS -->
          <input v-model="materialEndpoint" placeholder="资料解析器地址，如 http://127.0.0.1:8765/parse" />
          <input v-model="materialToken" password placeholder="资料解析器令牌，仅本次内存保存" />
          <button role="button" tabindex="0" size="mini" @tap="connectMaterial">授权资料解析器并检查</button>
          <text v-if="learning.materialConnection?.status" class="subtle"
            >资料解析器鉴权与可达性已验证；文件只发至此授权目标。</text
          >
          <label @tap="allowMaterialRecognition = !allowMaterialRecognition">
            <checkbox :checked="allowMaterialRecognition" />允许本地文字识别（扫描页/图片；关键条件仍需校对）
          </label>
          <view v-if="allowMaterialRecognition" data-test="ocr-engine-choice" class="row wrap">
            <button
              role="button"
              tabindex="0"
              size="mini"
              :aria-pressed="materialRecognitionEngine === 'tesseract'"
              @tap="materialRecognitionEngine = 'tesseract'"
            >
              解析器上的 Tesseract
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="!appleVisionAvailable"
              :aria-pressed="materialRecognitionEngine === 'apple-vision'"
              @tap="materialRecognitionEngine = 'apple-vision'"
            >
              解析器 Mac 上的 Apple Vision
            </button>
            <text
              >当前{{
                recognitionLabel(materialRecognitionEngine)
              }}。能力检查不代表识别准确；公式、单位和条件仍需校对。</text
            >
          </view>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :disabled="learning.materialBusy || appFileBusy"
            @tap="chooseMaterialFile"
          >
            选择 PDF / 作答图片
          </button>
          <view v-if="clientPlatform === 'app' && selectedAppFile" data-test="app-selected-file" class="button-row">
            <text class="subtle"
              >已选择 {{ selectedAppFile.name }}（{{
                selectedAppFile.size
              }}
              字节），尚未读取或发送正文；返回后如连接已清除，请重新授权解析器。</text
            >
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="appFileBusy || learning.materialBusy"
              @tap="parseSelectedAppFile"
            >
              确认解析所选文件
            </button>
            <button role="button" tabindex="0" size="mini" @tap="cancelAppFile">取消所选文件</button>
          </view>
          <!-- #endif -->
          <view v-if="learning.materialProgress" class="button-row">
            <text class="subtle">
              已处理 {{ learning.materialProgress.completed }}/{{ learning.materialProgress.total }} 页
            </text>
            <button v-if="learning.materialBusy" role="button" tabindex="0" size="mini" @tap="learning.cancelMaterial">
              取消后续处理
            </button>
          </view>
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
            @tap="previewUploadMaintenance"
          >
            预览登记整理
          </button>
          <view v-if="uploadMaintenancePreview" data-test="upload-maintenance-preview">
            <text
              >已关闭 {{ uploadMaintenancePreview.closedCount }} 项 · 未确认或已收存
              {{ uploadMaintenancePreview.openCount }} 项 · 总名额 {{ uploadMaintenancePreview.maxReceipts }} 项</text
            >
            <text class="subtle"
              >只整理已关闭登记，未确认登记及原件全部保留；旧编号不能重传，请其他客户端重新检查解析器。</text
            >
            <text v-if="uploadMaintenancePreview.pending"
              >上次整理尚未确认完成，本次继续核实原计划
              {{ uploadMaintenancePreview.plannedCount }} 项；后续新增关闭项留到下次。</text
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
              @tap="compactUploadReceipts"
            >
              确认整理已关闭登记
            </button>
          </view>
          <button role="button" tabindex="0" size="mini" @tap="showLocator = !showLocator">定位登记导出与恢复</button>
          <view v-if="showLocator" data-test="upload-locator-panel">
            <text class="subtle"
              >定位登记不含资料正文或令牌；仅在可信位置保存。粘贴同账户导出可恢复本机待办，后续核对需授权原解析器。</text
            >
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
                @tap="forgetPendingUpload"
              >
                确认仅移除本机待办
              </button>
            </view>
          </view>
          <view v-for="entry in learning.pendingUploads" :key="entry.id" class="model-row" data-test="pending-upload">
            <text>导入回执待核对 · {{ entry.id.slice(-8) }} · {{ entry.size }} 字节</text>
            <text class="subtle"
              >目标 {{ entry.connectorOrigin }}；本机只保留无正文定位登记。核对不会重新上传文件。</text
            >
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
              @tap="pendingUploadAction(entry, 'inspect')"
            >
              核对原件状态
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
              @tap="pendingUploadAction(entry, 'recover')"
            >
              恢复已收原件
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
              @tap="pendingUploadAction(entry, 'close')"
            >
              取消登记并核对原件
            </button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.materialBusy || learning.busy || learning.syncBusy || appFileBusy"
              @tap="exportPendingLocator(entry)"
            >
              导出定位与移除待办
            </button>
          </view>
          <view v-for="material in learning.state.materials" :key="material.id" class="model-row">
            <text>{{ material.name }} · {{ material.segments.length }} 个片段 · 私人</text>
            <text v-if="material.recognitionEngine === 'apple-vision'" class="subtle"
              >Apple Vision 由解析器 Mac 执行；识别候选仍需对照原图校对。</text
            >
            <button
              v-if="material.segments.some((segment) => segment.status === 'failed')"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.materialBusy || appFileBusy"
              @tap="retryMaterial(material)"
            >
              重试未解析页
            </button>
            <button
              v-if="material.nextPage"
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.materialBusy || appFileBusy"
              @tap="resumeMaterial(material)"
            >
              继续解析后续页
            </button>
            <button role="button" tabindex="0" size="mini" @tap="selectMaterial(material)">从此资料组织一道题</button>
            <button
              role="button"
              tabindex="0"
              size="mini"
              :disabled="learning.busy || learning.materialBusy || learning.syncBusy"
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
              @tap="retryOriginalDeletion(deletion)"
            >
              重试原件删除
            </button>
          </view>
          <view v-if="selectedMaterial" class="form">
            <view class="button-row">
              <button
                v-for="segment in selectedMaterial.segments"
                :key="segment.id"
                role="button"
                tabindex="0"
                size="mini"
                @tap="selectSegment(segment)"
              >
                {{
                  segment.page
                    ? '第 ' + segment.page + ' 页'
                    : '片段 ' + (selectedMaterial.segments.indexOf(segment) + 1)
                }}
              </button>
            </view>
            <image
              v-if="selectedSegment?.preview"
              :src="selectedSegment.preview"
              mode="widthFix"
              class="source-preview"
            />
            <text class="subtle">{{ selectedSegment?.content.slice(0, 300) }}</text>
            <textarea v-model="privatePrompt" class="field" placeholder="确认题干，保留公式和关键条件"></textarea>
            <input v-model="privateAnswer" placeholder="参考答案候选（可空），不会自动升级为核验依据" />
            <input v-model="importedUserAnswer" placeholder="纸面用户作答（可空），与参考答案分开保存" />
            <input v-model="teacherAnnotation" placeholder="教师批注（可空），不作为标准答案" />
            <view @tap="privateConditionsConfirmed = !privateConditionsConfirmed">
              <checkbox :checked="privateConditionsConfirmed" />
              原页关键条件已局部校对（不等于答案已核验）
            </view>
            <button role="button" tabindex="0" size="mini" @tap="structurePrivateQuestion">进入对话练习</button>
          </view>
        </view>
        <view v-if="showProfile" class="form panel">
          <text class="section-title">目标可以改变，记录仍然连续</text>
          <text class="subtle">画像可跳过或修改，自述与观察分别保留。注意力自述仅影响节奏，不作医学诊断。</text>
          <input v-model="foundation" placeholder="自述基础，如 已掌握基础，希望直接挑战" />
          <button role="button" tabindex="0" size="mini" @tap="saveFoundation">保存或修正自述基础</button>
          <input v-model="timezone" placeholder="学习时区，如 Asia/Shanghai" />
          <button role="button" tabindex="0" size="mini" @tap="saveTimezone">更新时区边界</button>
          <textarea v-model="planLines" class="field" placeholder="每行一个明确任务；旧计划版本将保留"></textarea>
          <button role="button" tabindex="0" size="mini" @tap="savePlan">保存今日计划版本</button>
          <text v-for="entry in learning.state.profile" :key="entry.id" class="subtle">
            {{ entry.source }} · {{ entry.scope }} · {{ entry.field }}：{{ entry.value }}
          </text>
        </view>
      </view>
      <text v-if="feedback || learning.error" class="warning feedback" role="alert">
        {{ feedback || learning.error }}
      </text>
    </view>
  </LearningShell>
</template>
<script setup>
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { learningWriteProtectionSupported } from '@/services/learning/learning-write-lease.js';
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { onShow, onHide, onLoad } from '@dcloudio/uni-app';
import LearningShell from '@/components/business/learning/learning-shell.vue';
// #ifdef MP-WEIXIN
import PrivacyPopup from '@/components/common/privacy-popup.vue';
// #endif
import { learningRhythms, currentRhythm } from '@/services/learning/learning-rhythm.js';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import NumberLine from '@/components/business/learning/number-line.vue';
import { structureMaterialCandidate } from '@/services/learning/material-intake.js';
import { learningClientPlatform, WEIXIN_CONNECTOR_ORIGIN } from '@/services/learning/local-connector.js';
import { chooseWeixinMaterialFile, readWeixinMaterialFile } from '@/services/learning/material-connector.js';
import { APP_CONNECTOR_ORIGIN } from '@/services/learning/app-connector.js';
import {
  chooseAppMaterialFile,
  readAppMaterialFile,
  releaseAppMaterialFile
} from '@/services/learning/app-material.js';
import { useConversationLearningStore, learningId } from '@/stores/modules/conversation-learning.js';
const learning = useConversationLearningStore();
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
  clientFileReader = null;
function discardClientFile() {
  clientFileSequence++;
  clientFileContext = null;
  const reader = clientFileReader;
  clientFileReader = null;
  reader?.abort();
}
function beginClientFile() {
  discardClientFile();
  const sequence = clientFileSequence,
    context = learning.prepareMaterialAction();
  clientFileContext = context;
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
const visibleMessages = computed(
  () => learning.active?.messages.slice(messageStart.value, messageStart.value + 50) || []
);
function locateQuestionMessages() {
  const messages = learning.active?.messages || [];
  const last = messages.map((m) => m.questionKey).lastIndexOf(learning.active?.activeQuestionKey);
  messageStart.value = Math.max(0, (last < 0 ? messages.length : last + 1) - 50);
}
watch([() => learning.selectedConversationId, () => learning.active?.activeQuestionKey], locateQuestionMessages, {
  immediate: true
});
watch(
  () => learning.active?.messages.length || 0,
  (length, before) => {
    if (messageStart.value + 50 >= before) messageStart.value = Math.max(0, length - 50);
  }
);
const learningRoot = ref(null);
let unbindKeyboard = () => undefined;
onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(learningRoot.value);
});
onUnmounted(() => unbindKeyboard());
const goal = ref('');
const draft = ref('');
const feedback = ref('');
const showConnections = ref(false);
const showMaterial = ref(false);
const showProfile = ref(false);
const showData = ref(false);
const showRestore = ref(false);
const backupText = ref('');
const uploadMaintenancePreview = ref(null),
  pendingRemovalPreview = ref(null),
  pendingRemovalAcknowledged = ref(false),
  locatorText = ref(''),
  showLocator = ref(false);
const restorePreview = ref(null);
const guestPreview = ref(null);
const showMethods = ref(false);
const showRubric = ref(false);
const rubricCriteria = ref([]);
const rubricAssessment = computed(
  () =>
    learning.state.attempts
      .filter(
        (a) =>
          a.conversationId === learning.selectedConversationId && a.questionKey === learning.active?.activeQuestionKey
      )
      .at(-1)
      ?.assistance?.filter((a) => ['subjective-rubric-v1', 'subjective-rubric-v2'].includes(a.contract))
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
    feedback.value = '评分维度已保存为新题版本，历史作答与计划保留。未执行模型评估，也未将维度当成可靠答案。';
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
    ? '本地学习 · 模型连接'
    : learning.selectedMode === 'local'
      ? '本地连接器'
      : learning.modelId
        ? '云模型 · 已选择'
        : '云模型 · 待选择'
);
const starters = ['理解一个概念', '梳理一道难题', '12 + 8'];
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
const appleVisionAvailable = computed(() => learning.materialConnection?.capabilities?.appleVision?.available === true);
function recognitionLabel(engine) {
  return engine === 'apple-vision' ? '由解析器 Mac 上的 Apple Vision 识别' : '由解析器上的 Tesseract 识别';
}
const materialText = ref('');
const selectedMaterial = ref(null);
const selectedSegment = ref(null);
const privateCandidate = ref(null);
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
    rhythmFeedback.value =
      id === 'review' && !result.focused
        ? '已切换为复习节奏。还没有可复测的题目，先完成一次练习。'
        : '节奏已保存。可以继续提问，也可以随时换一种方式。';
}
onLoad((options) => {
  if (options.panel === 'materials') showMaterial.value = true;
  if (options.panel === 'profile') showProfile.value = true;
});
const roleLabel = (role) => ({ user: '你', assistant: '学习助手', tool: '工具执行结果', notice: '学习系统' })[role];
async function run(action) {
  feedback.value = '';
  try {
    return await action();
  } catch (e) {
    feedback.value = e.message;
  }
}
function start() {
  return run(() => learning.start(goal.value));
}
function newConversation() {
  learning.selectedConversationId = null;
}
async function send() {
  const input = draft.value.trim();
  if (!input) return;
  await run(() => learning.send(input));
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
  uni.showModal({
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
  await run(() => learning.loadModels());
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
  if (result) feedback.value = result.success ? '指定模型真实调用成功，用量已记录。' : result.message;
}
async function loadUsage() {
  const result = await run(() => learning.loadUsage());
  if (result && !result.success) feedback.value = result.message;
}
async function saveModel() {
  const result = await run(() => learning.saveModel({ ...profile.value }, vaultConsent.value));
  profile.value.apiKey = '';
  if (result) feedback.value = result.success ? '服务端连接配置已保存，真实调用仍需单独验证。' : result.message;
}
async function removeModel(id) {
  const result = await run(() => learning.removeModel(id));
  if (result) feedback.value = result.success ? '服务端密钥已删除。' : result.message;
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
    feedback.value = '连接器已通过可达性与鉴权检查，仅开放文本；本地模型推理待发送消息验证。勾选上下文共享后开始。';
  });
}
function hint() {
  uni.showModal({
    title: '记录使用的提示',
    editable: true,
    placeholderText: '填写你使用的提示',
    success: (res) => {
      if (res.confirm && res.content?.trim())
        run(() =>
          learning.commit(
            'hint.add',
            {
              conversationId: learning.selectedConversationId,
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
  uni.showModal({
    title: '局部校对题干',
    editable: true,
    content: learning.activeQuestion.prompt,
    success: (res) => {
      if (res.confirm && res.content?.trim())
        run(() =>
          learning.correctQuestion(
            learning.activeQuestion,
            { prompt: res.content, uncertainties: [] },
            '用户校对关键题干，旧版本保留'
          )
        );
    }
  });
}
function importText() {
  return run(() => {
    learning.importText(materialText.value);
    materialText.value = '';
    feedback.value = '已分段保存到本地私人资料。';
  });
}
function connectMaterial() {
  return run(async () => {
    const url = new URL(materialEndpoint.value);
    learning.materialConnection = {
      endpoint: url.href,
      token: materialToken.value,
      consent: true,
      allowedOrigins: [url.origin]
    };
    materialToken.value = '';
    const result = await learning.checkMaterialConnection();
    feedback.value = `资料连接器已验证；PDF 文本 ${result.pdfText ? '可用' : '不可用'}，页图 ${result.pagePreview ? '可用' : '不可用'}，文字识别程序 ${result.ocrBinaryAvailable ? '存在，语种仍需验证' : '不可用'}，Apple Vision ${result.ocrEngines.appleVision.available ? '能力可用，识别质量仍需校对' : '不可用'}。${result.uploadRecovery?.available ? '未确认原件可核对和恢复。' : '此解析器未开放丢失回执恢复。'}尚未发送资料。`;
  });
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
  uni.showModal({
    title: '整理已关闭导入登记',
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
  return run(() => {
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
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })),
      link = document.createElement('a');
    link.href = url;
    link.download = 'wenli-upload-locator.json';
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
  uni.showModal({
    title: '仅移除本机定位待办',
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
  uni.showModal({
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
  uni.showModal({
    title: action === 'recover' ? '恢复解析器已收原件' : action === 'close' ? '取消未确认导入' : '核对未确认原件',
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
function resumeMaterial(material, startPage = material.nextPage) {
  return run(() => {
    if (appFileBusy.value) throw new Error('请先结束当前文件动作');
    return learning.importFile({
      fileId: material.original?.connectorFileId || material.id,
      materialId: material.id,
      startPage,
      size: 0,
      name: material.name,
      allowRecognition: material.recognitionAllowed === true,
      ...(material.recognitionEngine === 'apple-vision' ? { recognitionEngine: 'apple-vision' } : {})
    });
  });
}
function deleteMaterial(material) {
  return run(() => {
    const preview = learning.previewMaterialDeletion(material.id);
    uni.showModal({
      title: '确认资料删除范围',
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
  uni.showModal({
    title: '重试解析器原件删除',
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
    return run(async () => {
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
        feedback.value = '已选择文件元信息。请确认当前资料解析器后解析；尚未读取或发送文件正文。';
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
    return run(async () => {
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
        const consent = await new Promise((resolve, reject) =>
          uni.showModal({
            title: '发送至已授权的资料解析器',
            content: `将「${file.name}」原文件交给已授权目标。${allowRecognition ? recognitionLabel(recognitionEngine) : '仅提取PDF文本'}；资料、原件与页图保持私人，关键条件仍需校对。`,
            confirmText: '解析资料',
            cancelText: '取消',
            success: resolve,
            fail: reject
          })
        );
        if (!consent.confirm) return;
        assertCurrent();
        const input = await readWeixinMaterialFile(file, { consent: true, assertCurrent });
        assertCurrent();
        const result = await learning.importFile({
          ...input,
          actionContext: action.context,
          allowRecognition,
          ...(allowRecognition ? { recognitionEngine } : {})
        });
        feedback.value = result.nextPage
          ? `已保存片段；剩余从第${result.nextPage}页继续，当前动作最多20页。`
          : '已保存私人资料和页图，未将识别内容自动作为标准答案。';
      } finally {
        action.finish();
      }
    });
  // #ifdef H5
  if (!learning.materialConnection) {
    feedback.value = '请先授权本地资料连接器；文件不会自动上传云端。';
    return;
  }
  let action;
  try {
    action = beginClientFile();
  } catch (error) {
    feedback.value = error.message;
    return;
  }
  const allowRecognition = allowMaterialRecognition.value;
  const recognitionEngine = materialRecognitionEngine.value;
  const stillAuthorized = action.current;
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.pdf,.png,.jpg,.jpeg';
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
      feedback.value = '文件超过 10 MB，请先按区段拆分。';
      action.finish();
      return;
    }
    let confirmed = false;
    uni.showModal({
      title: '发送至已授权的本地解析器',
      content: `原文件只交给已授权资料连接器。当前${allowRecognition ? recognitionLabel(recognitionEngine) : '仅提取 PDF 文本'}；关键条件仍需校对。`,
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
        let accepted = false;
        reader.onerror = () => {
          if (!stillAuthorized()) return;
          feedback.value = '文件读取失败';
          action.finish();
        };
        reader.onload = () =>
          run(async () => {
            if (accepted || !stillAuthorized()) return;
            accepted = true;
            clientFileReader = null;
            try {
              const result = await learning.importFile({
                name: file.name,
                size: file.size,
                actionContext: action.context,
                contentBase64: String(reader.result).split(',')[1],
                allowRecognition,
                ...(allowRecognition ? { recognitionEngine } : {})
              });
              feedback.value = result.nextPage
                ? `已保存片段；剩余从第 ${result.nextPage} 页继续，当前动作最多 20 页。`
                : '已保存私人资料和页图，未将识别内容自动作为标准答案。';
            } finally {
              action.finish();
            }
          });
        reader.readAsDataURL(file);
      },
      fail: () => action.finish()
    });
  };
  picker.click();
  // #endif
}
function parseSelectedAppFile() {
  return run(async () => {
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
        uni.showModal({
          title: '发送所选文件至当前资料解析器',
          content: `将「${file.name}」（${file.size}字节）交给${target}。${allowRecognition ? recognitionLabel(recognitionEngine) : '仅提取PDF文本'}；原件与页图保持私人，关键条件仍需校对。`,
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
        ...(allowRecognition ? { recognitionEngine } : {})
      });
      feedback.value = result.nextPage
        ? `已保存片段；剩余从第${result.nextPage}页继续，当前动作最多20页。`
        : '已保存私人资料和页图，未将识别内容自动作为标准答案。';
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
    feedback.value = '题干、纸面作答与参考候选已分别保存，未核验内容不自动判错。';
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
  return run(() => {
    const content = learning.exportData();
    // 文件下载受浏览器宿主限制时，仍能查看并手动保存同一份备份。
    backupText.value = content;
    showRestore.value = true;
    restorePreview.value = null;
    // #ifdef H5
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
function deleteRecords() {
  uni.showModal({
    title: '删除本地对话学习数据',
    content:
      '删除当前用户的新学习记录、材料与恢复副本。旧题库和旧版学习数据保留；未确认原件的无正文定位待办保留，以便核对/取消，解析器原件与云端密钥需另行确认删除。',
    success: (res) => {
      if (res.confirm) run(() => learning.deleteData());
    }
  });
}
function previewRecords() {
  restorePreview.value = null;
  return run(async () => {
    restorePreview.value = await learning.previewRestore(backupText.value);
  });
}
function deleteCloudRecords() {
  uni.showModal({
    title: '删除云端学习副本',
    content:
      '请先停止其他设备同步。删除后端学习副本和已存教学结果缓存，并取消已预留的模型任务；费用事实、模型密钥、本机与备份分别保留。以后主动同步或调用模型会产生新副本。',
    success: (result) => {
      if (result.confirm)
        run(async () => {
          await learning.deleteCloudRecords(true);
          feedback.value =
            '服务端已确认清除学习副本和教学结果缓存；费用事实与本机记录保留，后续主动同步或模型调用会产生新副本。';
        });
    }
  });
}
function restoreRecords() {
  const content = backupText.value;
  const preview = restorePreview.value;
  if (!preview) return;
  uni.showModal({
    title: '合并学习备份',
    content: `新增 ${preview.imported} 个操作，保留当前记录，并创建恢复前副本。不会上传备份或恢复模型密钥。`,
    success: (result) => {
      if (!result.confirm) return;
      run(() => {
        const restored = learning.restoreData(content, preview);
        feedback.value = `已合并 ${restored.imported} 个操作；统计已按有效记录重算。`;
        restorePreview.value = null;
        backupText.value = '';
      });
    }
  });
}
function rollbackRecords() {
  uni.showModal({
    title: '撤销最近一次写入',
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
  uni.showModal({
    title: '同步当前用户的学习记录',
    content:
      '会把对话、私人资料片段、页图与学习记录发送至本项目后端，以便多设备使用。没有登录或服务不可用时，本地记录保留。',
    success: (res) => {
      if (res.confirm)
        run(async () => {
          await learning.syncRecords(true);
          feedback.value = '学习记录已同步并按服务端事实重算。';
        });
    }
  });
}
function previewGuestRecords() {
  guestPreview.value = null;
  return run(async () => {
    guestPreview.value = await learning.previewGuestMigration();
  });
}
function migrateGuestRecords() {
  const preview = guestPreview.value;
  if (!preview) return;
  uni.showModal({
    title: '确认访客记录属于你',
    content: '归入当前账户，保留已有任务和访客原件，并创建恢复前副本。不会上传；共享设备上的其他人记录请勿认领。',
    success: (result) => {
      if (result.confirm)
        run(() => {
          const outcome = learning.migrateGuest(preview, true);
          feedback.value = `已归入 ${outcome.imported} 个访客操作，合并 ${outcome.mergedPlans} 份计划。`;
          guestPreview.value = null;
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
  learning.refresh();
  const preview = learning.syncConflict;
  if (!preview) return;
  uni.showModal({
    title: side === 'remote' ? '采用云端记录继续' : '恢复本机冲突副本',
    content:
      side === 'remote'
        ? '重新读取云端并校验未变更后，采用该版本。未合并的本机内容保留在冲突副本与恢复副本中；不会重复计入统计。'
        : '当前本机数据先保存为恢复副本，再采用发生冲突时的本机版本。云端不改变。',
    success: (result) => {
      if (result.confirm)
        run(async () => {
          if (side === 'remote') await learning.adoptCloudRecords(preview, true);
          else learning.restoreConflictLocal(preview);
          feedback.value =
            side === 'remote' ? '已采用云端记录，原本机冲突副本仍保留。' : '已恢复本机冲突副本，云端未变更。';
        });
    }
  });
}
function removeConflict() {
  uni.showModal({
    title: '移除冲突副本',
    content: '请先导出需要保留的两份副本。移除仅删除此冲突归档，不会删除当前本机或云端学习记录。',
    success: (result) => {
      if (result.confirm)
        run(() => {
          learning.clearSyncConflict();
          feedback.value = '冲突归档已移除，可重新同步。';
        });
    }
  });
}
onShow(() => {
  appPageVisible = true;
  return run(() => learning.refresh());
});
onHide(() => {
  appPageVisible = false;
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
  learning.cancelSync();
});
onUnmounted(() => {
  appPageAlive = false;
  discardClientFile();
  appPageVisible = false;
  appFileController?.abort();
  discardAppFile();
  learning.cancel();
  learning.cancelMaterial();
  learning.cancelSync();
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
.session-progress {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--space-muted);
  padding: 10px 0;
  border-bottom: 1px solid var(--space-line);
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
.welcome-description {
  display: block;
  margin-top: 16px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--space-muted);
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
.start-note {
  margin-top: 12px;
  font-size: 11px !important;
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
  background: rgba(219, 229, 190, 0.17);
}
.rhythm-name {
  font-size: 13px;
  display: block;
}
.rhythm-description {
  display: block;
  font-size: 10px;
  color: var(--space-muted);
}
.connection-pill {
  border-radius: 24px !important;
  font-size: 11px !important;
  min-height: 38px !important;
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
  background: rgba(241, 238, 224, 0.18);
  width: fit-content;
  max-width: 80%;
}
.message.notice,
.message.tool {
  border: 0;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(37, 40, 31, 0.38);
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
  background: var(--space-glass);
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
  background: #45473c;
  padding: 16px;
  border-radius: 24px;
  margin-top: 16px;
  position: sticky;
  bottom: 16px;
  z-index: 2;
  box-shadow: 0 8px 24px rgba(22, 26, 19, 0.15);
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
  .rhythm-description {
    display: none;
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
    background: #454739;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .message.user {
    background: #555c48;
  }
  .message.notice,
  .message.tool {
    background: #363d2f;
  }
}
</style>
