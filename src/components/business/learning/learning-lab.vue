<template>
  <view ref="root" class="learning-lab panel">
    <button class="lab-heading" role="button" tabindex="0" :aria-expanded="opened" @tap="toggleOpened">
      <text class="section-title">互动学习</text>
      <BaseIcon :name="opened ? 'chevron-up' : 'sparkles'" :size="30" :color="iconColor" />
    </button>
    <view v-if="opened" class="lab-content">
      <view class="lab-tabs" aria-label="学习探索方式">
        <button
          v-for="item in tabs"
          :key="item.id"
          role="button"
          tabindex="0"
          :aria-pressed="tab === item.id"
          :class="{ selected: tab === item.id }"
          @tap="chooseTab(item.id)"
        >
          {{ item.label }}
        </button>
      </view>
      <view v-if="pendingVisual" class="lab-tabs">
        <button
          role="button"
          tabindex="0"
          :disabled="stopped || busy"
          :aria-disabled="stopped || busy"
          @tap="applyRequestedVisual(true)"
        >
          查看新演示
        </button>
      </view>
      <text v-if="stopped" class="subtle">已停止</text>
      <template v-if="tab === 'visual'">
        <view v-if="!diagramEditing" class="lab-tabs" aria-label="动态演示概念">
          <button
            v-for="item in visualExamples"
            :key="item.template"
            role="button"
            tabindex="0"
            :disabled="stopped || busy"
            :aria-disabled="stopped || busy"
            :aria-pressed="recipe.template === item.template"
            @tap="chooseExample(item.template)"
          >
            {{ item.label }}
          </button>
        </view>
        <DiagramConditions
          :state="state"
          :question="question"
          :conversation-id="conversationId"
          :context="context"
          :stopped="stopped"
          :busy="busy"
          :record-help="recordDiagramHelp"
          :reset-key="exampleVersion"
          @confirm="adoptDiagram"
          @invalidate="clearDiagram"
          @editing="diagramEditing = $event"
          @reading="
            pause();
            showVideo = false;
          "
        />
        <text v-if="contextRecipeError && !manualRecipe" class="lab-feedback" role="alert">{{
          contextRecipeError
        }}</text>
        <template v-if="!diagramEditing && (!contextRecipeError || manualRecipe)">
          <text v-if="!manualRecipe" class="subtle">示例</text>
          <template v-if="graphRecipe">
            <VelocityTimeGraph :points="recipe.points" :step="step" :visible="visible" />
            <text class="scene-readout">时间 {{ physicsNumber(frame.time) }} s / {{ recipe.physicalSeconds }} s</text>
            <text v-if="step > 0" class="subtle">速度 {{ exactMotionText(frame.exact.velocity) }} m/s</text>
          </template>
          <template v-else-if="forceRecipe">
            <text v-if="movingRecipe" class="subtle">向右为正 · 初速度 {{ recipe.initialVelocityMps }} m/s</text>
            <text v-else class="subtle"
              >初始静止 · 恒定合力 {{ recipe.netForceN }} N{{ recipe.netForceN ? `向${side}` : '' }}</text
            >
            <text v-if="movingRecipe" class="subtle">{{ motionConditions }}</text>
            <view
              v-for="(mass, index) in energyRecipe ? [recipe.massKg] : [recipe.massKg, recipe.massKg * 2]"
              :key="index"
              class="force-lane"
            >
              <text class="lane-label">{{ mass }} kg</text>
              <view
                class="force-track"
                role="img"
                :aria-label="`${mass}kg物体：${physicsNumber(frame.time)}秒，位移${physicsNumber(index ? frame.comparisonPosition : frame.position)}米`"
              >
                <view class="force-axis" />
                <image
                  class="force-character"
                  :src="BRAND.mark"
                  mode="aspectFit"
                  :style="{ left: forcePosition(index ? frame.comparisonPosition : frame.position) }"
                />
                <template v-if="movingRecipe">
                  <text v-if="motionOriginLabel" class="force-origin" :style="{ left: forcePosition(0) }">0</text>
                  <text v-if="step > 0" class="force-start">{{ physicsNumber(frame.minimum) }} m</text>
                  <text v-if="step > 0" class="force-end">{{ physicsNumber(frame.maximum) }} m</text>
                </template>
                <text v-else class="force-start" :class="{ leftward: recipe.direction === 'left' }">0 m</text>
                <text
                  v-if="!movingRecipe && step > 0"
                  class="force-end"
                  :class="{ leftward: recipe.direction === 'left' }"
                  >{{ recipe.direction === 'left' ? '-' : '' }}{{ number(frame.extent) }} m</text
                >
              </view>
              <text v-if="frame.step > 0 && movingRecipe" class="subtle"
                >速度 {{ physicsNumber(index ? frame.comparisonSpeed : frame.speed) }} m/s · 加速度
                {{ physicsNumber(index ? frame.comparisonAcceleration : frame.acceleration) }} m/s²</text
              >
              <text v-else-if="frame.step > 0" class="subtle"
                >加速度 {{ physicsNumber(Math.abs(index ? frame.comparisonAcceleration : frame.acceleration)) }} m/s²{{
                  recipe.netForceN ? `向${side}` : ''
                }}</text
              >
              <text v-if="frame.step > 0 && movingRecipe" class="subtle"
                >路程 {{ physicsNumber(index ? frame.comparisonDistance : frame.distance) }} m · 位移
                {{ physicsNumber(index ? frame.comparisonPosition : frame.position) }} m</text
              >
            </view>
            <text class="scene-readout">时间 {{ physicsNumber(frame.time) }} s / {{ recipe.physicalSeconds }} s</text>
            <view v-if="energyRecipe" class="energy-readout" aria-label="功与动能读数">
              <text class="subtle">质点 · 惯性系 · 质量不变 · 直线运动 · 恒定合力</text>
              <view
                v-for="item in [
                  { key: 'initialKinetic', label: '初动能' },
                  { key: 'finalKinetic', label: '当前动能' }
                ]"
                :key="item.key"
                class="energy-lane"
              >
                <text>{{ item.label }} {{ exactMotionText(frame.exact[item.key]) }} J</text>
                <view
                  class="energy-track"
                  :aria-label="`${item.label}${exactMotionText(frame.exact[item.key])}焦耳`"
                  role="img"
                >
                  <view
                    class="energy-bar"
                    :class="{ current: item.key === 'finalKinetic' }"
                    :style="{ width: `${(100 * frame[item.key]) / frame.energyMaximum}%` }"
                  />
                </view>
              </view>
              <view class="scene-readout"
                ><text>合力总功 {{ exactMotionText(frame.exact.work) }} J</text
                ><text>动能变化 {{ exactMotionText(frame.exact.kineticChange) }} J</text></view
              >
              <text class="subtle">K = ½mv² · W = FΔx（带符号）</text>
              <!-- #ifdef H5 --><a
                class="writing-source"
                :href="ENERGY_BASIS.url"
                target="_blank"
                rel="noopener noreferrer"
                >定义参考</a
              ><!-- #endif -->
              <!-- #ifndef H5 --><text class="reference-credit" selectable>{{ ENERGY_BASIS.url }}</text
              ><!-- #endif -->
            </view>
          </template>
          <template v-else>
            <text class="subtle"
              >向{{ side }} {{ recipe.outward }} 米，再向{{ side === '右' ? '左' : '右' }}
              {{ recipe.backward }} 米</text
            >
            <view
              class="scene"
              role="img"
              :aria-label="`第${frame.step}步：走过${number(frame.distance)}米，位移${displacementText}`"
            >
              <view class="scene-axis" />
              <view
                class="scene-trail"
                :style="{
                  width: `${(84 * Math.min(frame.distance, recipe.outward)) / recipe.outward}%`,
                  left:
                    recipe.direction === 'left'
                      ? `${92 - (84 * Math.min(frame.distance, recipe.outward)) / recipe.outward}%`
                      : '8%'
                }"
              />
              <image
                class="scene-character"
                :src="BRAND.mark"
                mode="aspectFit"
                :style="{
                  left: `${recipe.direction === 'left' ? 92 - (84 * frame.position) / recipe.outward : 8 + (84 * frame.position) / recipe.outward}%`
                }"
              />
              <text class="scene-start" :class="{ 'mirrored-start': recipe.direction === 'left' }">起点 0</text
              ><text class="scene-turn" :class="{ 'mirrored-turn': recipe.direction === 'left' }"
                >{{ recipe.direction === 'left' ? '-' : '' }}{{ recipe.outward }} 米</text
              >
            </view>
            <view class="scene-readout"
              ><text>路程 {{ number(frame.distance) }} m</text><text>位移 {{ displacementText }}</text></view
            >
          </template>
          <text v-if="!prediction" class="lab-prompt">{{
            graphRecipe
              ? '先猜一下：路程与位移的大小会相同吗？'
              : energyRecipe
                ? '先猜一下：观察结束时，动能会变大吗？'
                : motionRecipe
                  ? '先猜一下：较轻的物体会转向吗？'
                  : forceRecipe
                    ? '同样的合力，质量加倍，加速度会怎样？'
                    : '先猜一下：走完后，路程与位移的大小会相同吗？'
          }}</text>
          <view v-if="!prediction" class="lab-tabs">
            <button
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-disabled="stopped || busy"
              @tap="prediction = 'same'"
            >
              {{ energyRecipe ? '我猜不会' : motionRecipe ? '不会转向' : forceRecipe ? '不变' : '我猜相同' }}
            </button>
            <button
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-disabled="stopped || busy"
              @tap="prediction = 'different'"
            >
              {{ energyRecipe ? '我猜会' : motionRecipe ? '会转向' : forceRecipe ? '减半' : '我猜不同' }}
            </button>
          </view>
          <view class="lab-tabs">
            <button
              class="primary"
              role="button"
              tabindex="0"
              :disabled="stopped || busy || !prediction || frame.complete"
              :aria-disabled="stopped || busy || !prediction || frame.complete"
              @tap="togglePlayback"
            >
              {{ playing ? '暂停演示' : reducedMotion ? '逐步观察' : '播放演示' }}
            </button>
            <button
              role="button"
              tabindex="0"
              :disabled="stopped || busy || !prediction || frame.complete"
              :aria-disabled="stopped || busy || !prediction || frame.complete"
              @tap="nextFrame"
            >
              下一步
            </button>
            <button role="button" tabindex="0" @tap="resetVisual">回到起点</button>
          </view>
          <text v-if="visualError" class="lab-feedback" role="alert">{{ visualError }}</text>
          <text v-if="frame.complete && graphRecipe" class="lab-feedback" role="status">
            {{ prediction === (motionTurned ? 'different' : 'same') ? '预测与观察一致。' : '观察带来了新发现。' }}
            正面积 {{ exactMotionText(frame.exact.positiveArea) }} m，负面积大小
            {{ exactMotionText(frame.exact.negativeArea) }} m。 路程 {{ exactMotionText(frame.exact.distance) }} m，位移
            {{ exactMotionText(frame.exact.displacement) }} m。 路程把两侧面积大小相加，位移保留正负。
          </text>
          <text v-else-if="frame.complete && motionRecipe" class="lab-feedback" role="status">
            {{ prediction === (motionTurned ? 'different' : 'same') ? '预测与观察一致。' : '观察带来了新发现。' }}
            较轻物体：路程 {{ exactMotionText(frame.exact.distance) }} m，位移
            {{ exactMotionText(frame.exact.displacement) }} m。
            {{ motionTurned ? '转向前后走过的长度都计入路程。' : '这次运动没有转向。' }}
            {{ motionZeroForce ? '零合力保持已有速度。' : '比较两条轨迹的速度与位移。' }}
          </text>
          <text v-else-if="frame.complete && energyRecipe" class="lab-feedback" role="status">
            {{
              prediction === (frame.exact.kineticChange[0] > 0 ? 'different' : 'same')
                ? '预测与观察一致。'
                : '观察带来了新发现。'
            }}
            合力总功 {{ exactMotionText(frame.exact.work) }} J，等于动能变化。动能{{
              frame.exact.kineticChange[0] > 0 ? '增加' : frame.exact.kineticChange[0] < 0 ? '减少' : '不变'
            }}。
          </text>
          <text v-else-if="frame.complete && forceRecipe" class="lab-feedback" role="status">
            {{ prediction === (recipe.netForceN ? 'different' : 'same') ? '预测与观察一致。' : '观察带来了新发现。' }}
            {{ recipe.netForceN ? '同样合力下，质量加倍，加速度减半。' : '合力为0，两个物体都保持静止。' }}
            用一句话说明质量改变了什么。
          </text>
          <text v-else-if="frame.complete" class="lab-feedback" role="status"
            >{{
              prediction === (recipe.backward ? 'different' : 'same')
                ? '你的预测与这次观察一致。'
                : '观察带来了新发现。'
            }}路程 {{ recipe.outward + recipe.backward }} 米，位移{{
              displacementText
            }}。路程累加走过的长度，位移比较起点与终点。用一句话说明它们为何{{
              recipe.backward ? '不同' : '相同'
            }}。</text
          >
          <button
            v-if="frame.complete"
            class="primary"
            role="button"
            tabindex="0"
            :disabled="stopped || busy"
            :aria-disabled="stopped || busy"
            @tap="requestScience"
          >
            独立检验
          </button>
          <button
            v-if="
              recipe.template === 'distance_displacement' &&
              recipe.direction !== 'left' &&
              recipe.outward === 6 &&
              recipe.backward === 4
            "
            role="button"
            tabindex="0"
            :disabled="stopped"
            :aria-disabled="stopped"
            :aria-expanded="showVideo"
            @tap="toggleVisualVideo"
          >
            {{ showVideo ? '收起视频' : '观看视频' }}
          </button>
          <video
            v-if="showVideo && !stopped"
            class="scene-video"
            :src="visualVideo"
            :autoplay="false"
            :controls="true"
            :show-mute-btn="true"
          ></video>
        </template>
      </template>
      <template v-else-if="tab === 'writing'">
        <view class="lab-tabs" aria-label="写作体裁"
          ><button
            v-for="genre in WRITING_GENRES"
            :key="genre.id"
            role="button"
            tabindex="0"
            :class="{ selected: genre.id === writingGenreId }"
            :aria-pressed="genre.id === writingGenreId"
            :disabled="stopped || busy"
            :aria-disabled="stopped || busy"
            @tap="chooseWritingGenre(genre.id)"
          >
            {{ genre.label }}
          </button></view
        >
        <button
          v-if="!writingBound"
          class="primary"
          role="button"
          tabindex="0"
          :disabled="stopped || busy"
          :aria-disabled="stopped || busy"
          @tap="$emit('writing', context, writingGenreId)"
        >
          开始带练
        </button>
        <template v-else>
          <view
            v-if="availableWritingReferences.length > 1 && readWritingReference"
            class="lab-tabs"
            aria-label="写法参考篇目"
          >
            <button
              v-for="reference in availableWritingReferences"
              :key="reference.id"
              role="button"
              tabindex="0"
              :class="{ selected: reference.id === currentWritingReference?.id }"
              :aria-pressed="reference.id === currentWritingReference?.id"
              :disabled="stopped || busy"
              :aria-disabled="stopped || busy"
              @tap="chooseWritingReference(reference.id)"
            >
              {{ reference.selectionLabel || reference.title }}
            </button>
          </view>
          <button
            v-if="currentWritingReference && readWritingReference"
            role="button"
            tabindex="0"
            :disabled="stopped || busy"
            :aria-disabled="stopped || busy"
            :aria-expanded="!!writingReference"
            aria-controls="public-writing-reference"
            @tap="openWritingReference"
          >
            {{
              currentWritingReference.coverage === 'full_body'
                ? '读信件正文'
                : currentWritingReference.coverage === 'full_text'
                  ? '读正文全文'
                  : currentWritingReference.coverage === 'full_work'
                    ? '读全文'
                    : writingGenreId === 'narrative'
                      ? '读一段叙事'
                      : '读一段说明'
            }}
          </button>
          <view v-if="writingReference" id="public-writing-reference" class="public-writing-reference">
            <text class="lab-title">写法参考</text>
            <text class="reference-title" selectable>{{ writingReference.title }}</text>
            <text class="reference-excerpt" selectable>{{ writingReference.excerpt }}</text>
            <text class="reference-credit" selectable>
              {{ writingReference.copyright }} · {{ writingReference.author }}
              <template v-if="writingReference.coWritingCredit">
                · 协作撰写 {{ writingReference.coWritingCredit }}</template
              >
            </text>
            <text class="reference-credit">{{ writingReference.publisher }} · {{ writingReference.published }}</text>
            <text class="reference-credit">{{ writingReference.changes }}</text>
            <text v-if="writingReference.versionNote" class="reference-credit">{{ writingReference.versionNote }}</text>
            <!-- #ifdef H5 -->
            <view class="reference-links">
              <a class="writing-source" :href="writingReference.url" target="_blank" rel="noopener noreferrer">原文</a>
              <a class="writing-source" :href="writingReference.licenseUrl" target="_blank" rel="noopener noreferrer">{{
                writingReference.license
              }}</a>
            </view>
            <!-- #endif -->
            <!-- #ifndef H5 -->
            <text class="reference-credit" selectable>{{ writingReference.url }}</text>
            <text class="reference-credit" selectable
              >{{ writingReference.license }} · {{ writingReference.licenseUrl }}</text
            >
            <!-- #endif -->
            <text class="lab-title">{{ writingReference.noteAuthor }} 写法批注</text>
            <text v-if="writingReference.notesLicense" class="reference-credit"
              >批注许可 · {{ writingReference.notesLicense }}</text
            >
            <view
              v-for="note in writingReference.notes"
              :key="note.paragraph ? `paragraph-${note.paragraph}` : note.sentence"
              class="reference-note"
            >
              <text>{{ writingReferenceNoteLocation(note) }} · {{ note.label }}</text>
              <text>{{ note.text }}</text>
            </view>
            <view v-if="writingReference.teachingBasis" class="reference-note">
              <text>学习目标 · 第{{ writingReference.teachingBasis.printedPage }}页</text>
              <text>{{ writingReference.teachingBasis.summary }}</text>
              <text class="reference-credit">{{ writingReference.teachingBasis.title }} · Yozi AI 转述</text>
              <!-- #ifdef H5 -->
              <a
                class="writing-source"
                :href="writingReference.teachingBasis.url"
                target="_blank"
                rel="noopener noreferrer"
                >课程标准</a
              >
              <!-- #endif -->
              <!-- #ifndef H5 -->
              <text class="reference-credit" selectable>{{ writingReference.teachingBasis.url }}</text>
              <!-- #endif -->
            </view>
            <button role="button" tabindex="0" @tap="writingReference = null">收起参考</button>
          </view>
          <text class="subtle">草稿 · {{ writingIndex + 1 }} / {{ writingSteps.length }}</text>
          <view class="writing-progress" :style="{ gridTemplateColumns: `repeat(${writingSteps.length}, 1fr)` }"
            ><view
              v-for="(item, index) in writingSteps"
              :key="item.id"
              :class="{ current: index === writingIndex, done: index < writingIndex }"
              ><text>{{
                writingGenreId === 'notice' ? ['活动', '时间', '地点', '行动'][index] : item.label
              }}</text></view
            ></view
          >
          <text class="lab-prompt">{{ writingStep.prompt }}</text>
          <view class="word-list"
            ><button
              v-for="card in visibleWritingWords"
              :key="card.word"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-disabled="stopped || busy"
              @tap="chooseWord(card)"
            >
              {{ card.word }}
            </button></view
          >
          <button
            v-if="foldedWords && !showAllWords"
            role="button"
            tabindex="0"
            :disabled="stopped || busy"
            @tap="showAllWords = true"
          >
            更多词语
          </button>
          <view v-if="vocabularyQuestion" class="vocabulary-check">
            <text class="lab-prompt" selectable>{{ vocabularyQuestion.prompt }}</text>
            <view v-if="!vocabularyResult" class="vocabulary-options" role="group" aria-label="词义选择">
              <button
                v-for="(option, index) in vocabularyQuestion.options"
                :key="option"
                role="button"
                tabindex="0"
                :class="{ selected: vocabularyChoice === 'ABCD'[index] }"
                :aria-pressed="vocabularyChoice === 'ABCD'[index]"
                :disabled="stopped || busy"
                :aria-disabled="stopped || busy"
                @tap="vocabularyChoice = 'ABCD'[index]"
              >
                {{ option }}
              </button>
            </view>
            <text v-if="vocabularyResult" class="lab-feedback" role="status" aria-live="polite">{{
              vocabularyResult
            }}</text>
            <view
              v-if="vocabularyResult && startVocabularyTask"
              class="lab-tabs"
              role="group"
              aria-label="词义复测间隔"
            >
              <button
                v-for="interval in vocabularyDelayOptions"
                :key="interval.days"
                role="button"
                tabindex="0"
                :class="{ selected: vocabularyDelayDays === interval.days }"
                :aria-pressed="vocabularyDelayDays === interval.days"
                :disabled="stopped || busy"
                :aria-disabled="stopped || busy"
                @tap="chooseVocabularyDelay(interval.days)"
              >
                {{ interval.label }}
              </button>
            </view>
            <view class="lab-tabs">
              <button
                v-if="!vocabularyResult"
                class="primary"
                role="button"
                tabindex="0"
                :disabled="stopped || busy || !vocabularyChoice"
                :aria-disabled="stopped || busy || !vocabularyChoice"
                @tap="confirmVocabulary"
              >
                确认词义
              </button>
              <button
                v-if="!vocabularyResult"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-disabled="stopped || busy"
                @tap="wordHelp(vocabularyWord)"
              >
                看释义
              </button>
              <button
                v-else
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-disabled="stopped || busy"
                @tap="openWordCheck(vocabularyWord)"
              >
                换句再认
              </button>
              <button role="button" tabindex="0" @tap="clearVocabulary">回到草稿</button>
              <button
                v-if="vocabularyResult && startVocabularyTask"
                role="button"
                tabindex="0"
                :disabled="stopped || busy || !!vocabularyRetest"
                :aria-disabled="stopped || busy || !!vocabularyRetest"
                @tap="wordTask('retest')"
              >
                {{
                  vocabularyRetest
                    ? `已安排 ${vocabularyRetest.day.slice(5).replace('-', '/')}`
                    : vocabularyDelayDays === 1
                      ? '明日认词'
                      : `${vocabularyDelayDays}天后认词`
                }}
              </button>
              <button
                v-if="vocabularyResult && startVocabularyTask"
                role="button"
                tabindex="0"
                :disabled="stopped || busy"
                :aria-disabled="stopped || busy"
                @tap="wordTask('usage')"
              >
                自己写一句
              </button>
            </view>
          </view>
          <text v-if="wordMessage" class="lab-feedback" role="status">{{ wordMessage }}</text>
          <textarea
            v-model="sentence"
            class="field sentence-input"
            :aria-label="`第${writingIndex + 1}${writingInParagraphs ? '段' : '句'}${writingIsChinese ? '中文' : '英文'}草稿`"
            :disabled="stopped || busy"
            :maxlength="writingDraftLimit(writingGenreId)"
            :placeholder="
              stopped
                ? '已停止'
                : writingInParagraphs
                  ? writingIsChinese
                    ? '写一段中文'
                    : '写一段英文'
                  : writingIsChinese
                    ? '写一句中文'
                    : '写一句英文'
            "
            placeholder-class="space-placeholder"
          ></textarea>
          <button
            v-if="!scaffold"
            role="button"
            tabindex="0"
            :disabled="stopped || busy"
            :aria-disabled="stopped || busy"
            @tap="showScaffold"
          >
            {{ writingInParagraphs ? '需要表达提示' : '需要一个句型' }}
          </button>
          <text v-else class="lab-feedback">{{ writingStep.scaffold }} · {{ writingStep.hint }}</text>
          <view class="lab-tabs">
            <button
              class="primary"
              role="button"
              tabindex="0"
              :disabled="stopped || busy || !sentence.trim()"
              :aria-disabled="stopped || busy || !sentence.trim()"
              @tap="checkSentence"
            >
              {{ writingInParagraphs ? '检查这一段' : '检查这一句' }}
            </button>
            <button
              v-if="feedback && (feedback.ready || feedback.kind === 'content') && !writingComplete"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-disabled="stopped || busy"
              @tap="nextSentence"
            >
              {{
                !feedback.ready
                  ? writingInParagraphs
                    ? '先保留这段'
                    : '先保留这句'
                  : writingIndex === writingSteps.length - 1
                    ? writingGenreId === 'notice'
                      ? '拼成我的通知'
                      : '拼成我的草稿'
                    : writingInParagraphs
                      ? '继续下一段'
                      : '继续下一句'
              }}
            </button>
          </view>
          <text v-if="feedback" class="lab-feedback" role="status" aria-live="polite">{{ feedback.message }}</text>
          <view v-if="writingComplete" class="writing-draft">
            <text class="lab-title">你的草稿</text><text selectable>{{ sentences.join('\n') }}</text>
            <button
              class="primary"
              role="button"
              tabindex="0"
              :disabled="stopped || busy"
              :aria-disabled="stopped || busy"
              @tap="$emit('writing', context, writingGenreId)"
            >
              独立写作
            </button>
          </view>
          <!-- #ifdef H5 --><a
            v-if="writingGenreId === 'notice'"
            class="writing-source"
            :href="WRITING_SOURCE.url"
            target="_blank"
            rel="noopener noreferrer"
            >评分参考</a
          ><!-- #endif -->
          <view v-if="writingGenreId === 'argument'" class="reference-note">
            <text class="subtle">原创练习 · 至少250词 · 辅助反馈待核对</text>
            <!-- #ifdef H5 -->
            <a class="writing-source" :href="ARGUMENT_WRITING_BASIS.formatUrl" target="_blank" rel="noopener noreferrer"
              >官方任务格式</a
            >
            <a
              class="writing-source"
              :href="ARGUMENT_WRITING_BASIS.criteriaUrl"
              target="_blank"
              rel="noopener noreferrer"
              >官方评分维度 · {{ ARGUMENT_WRITING_BASIS.criteriaVersion }}</a
            >
            <!-- #endif -->
            <!-- #ifndef H5 -->
            <text class="reference-credit" selectable>{{ ARGUMENT_WRITING_BASIS.formatUrl }}</text>
            <text class="reference-credit" selectable>{{ ARGUMENT_WRITING_BASIS.criteriaUrl }}</text>
            <!-- #endif -->
          </view>
          <view v-if="writingGenreId === 'discussion'" class="reference-note">
            <text class="subtle">原创讨论 · 建议100词以上 / 10分钟 · 辅助反馈待核对</text>
            <!-- #ifdef H5 -->
            <a
              class="writing-source"
              :href="DISCUSSION_WRITING_BASIS.formatUrl"
              target="_blank"
              rel="noopener noreferrer"
              >官方任务格式 · 2026</a
            >
            <a
              class="writing-source"
              :href="DISCUSSION_WRITING_BASIS.teachingUrl"
              target="_blank"
              rel="noopener noreferrer"
              >官方任务说明</a
            >
            <!-- #endif -->
            <!-- #ifndef H5 -->
            <text class="reference-credit" selectable>{{ DISCUSSION_WRITING_BASIS.formatUrl }}</text>
            <text class="reference-credit" selectable>{{ DISCUSSION_WRITING_BASIS.teachingUrl }}</text>
            <!-- #endif -->
          </view>
          <view v-if="writingGenreId === 'email'" class="reference-note">
            <text class="subtle">原创邮件 · 建议7分钟 · 辅助反馈待核对</text>
            <!-- #ifdef H5 -->
            <a class="writing-source" :href="EMAIL_WRITING_BASIS.formatUrl" target="_blank" rel="noopener noreferrer"
              >官方任务格式 · 2026</a
            >
            <a class="writing-source" :href="EMAIL_WRITING_BASIS.sampleUrl" target="_blank" rel="noopener noreferrer"
              >官方示例与评价要点</a
            >
            <!-- #endif -->
            <!-- #ifndef H5 -->
            <text class="reference-credit" selectable>{{ EMAIL_WRITING_BASIS.formatUrl }}</text>
            <text class="reference-credit" selectable>{{ EMAIL_WRITING_BASIS.sampleUrl }}</text>
            <!-- #endif -->
          </view>
        </template>
      </template>
      <template v-else>
        <text class="lab-title">{{ map.goal }}</text>
        <text class="subtle">近14天 · {{ map.timezone }}</text>
        <view class="heatmap" aria-label="近14天学习活动">
          <view
            v-for="cell in map.heat"
            :key="cell.day"
            class="heat-cell"
            :class="{ active: cell.reliable, pending: !cell.reliable && cell.pending }"
            :aria-label="`${cell.day}：可靠${cell.reliable}次，待核对${cell.pending}次`"
            ><text>{{ cell.day.slice(8) }}</text
            ><text>{{ cell.reliable || '·' }}</text></view
          >
        </view>
        <view class="map-legend" aria-label="学习活动图例"
          ><text class="legend-reliable">已校验</text><text class="legend-pending">待核对</text
          ><text>无记录</text></view
        >
        <view v-if="!map.nodes.length" class="lab-feedback">暂无作答</view>
        <view v-for="node in map.nodes" :key="node.scope" class="map-node">
          <text class="map-node-title">{{ node.label }}</text>
          <text class="subtle">可靠 {{ node.reliable }} · 待核对 {{ node.pending }} · 有提示 {{ node.helped }}</text>
          <view class="map-evidence"
            ><button
              v-for="evidence in node.evidence.slice(-4)"
              :key="evidence.id"
              role="button"
              tabindex="0"
              @tap="$emit('question', evidence.questionKey, evidence.conversationId)"
            >
              回看{{ evidence.status === 'reliable' ? '可靠' : '待核对' }}原答
            </button></view
          >
        </view>
        <text v-if="map.totalNodes > 40" class="subtle">最近40个知识点</text>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { BRAND } from '@/config/brand.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import DiagramConditions from './diagram-conditions.vue';
import VelocityTimeGraph from './velocity-time-graph.vue';
import {
  scienceInput,
  SCIENCE_TRANSFER_CONTRACT,
  MOTION_TRANSFER_CONTRACT,
  GRAPH_TRANSFER_CONTRACT,
  ENERGY_TRANSFER_CONTRACT
} from '../../../../laf-backend/functions/_shared/learning-science.js';
import {
  adaptiveWritingWords,
  vocabularyFeedback
} from '../../../../laf-backend/functions/_shared/learning-vocabulary.js';
import {
  WRITING_GENRES,
  NOTICE_CONTRACT,
  GUIDED_WRITING_CONTRACT,
  EXTENDED_WRITING_CONTRACTS,
  ARGUMENT_WRITING_BASIS,
  DISCUSSION_WRITING_BASIS,
  EMAIL_WRITING_BASIS,
  writingDraftLimit,
  GUIDED_WRITING_STEPS,
  WRITING_WORD_MEANINGS,
  writingGenre,
  writingGenreInfo,
  writingStepsForQuestion,
  guidedSentenceFeedback,
  PUBLIC_WRITING_REFERENCES,
  publicWritingReference,
  writingReferenceNoteLocation
} from '../../../../laf-backend/functions/_shared/learning-writing.js';
import {
  visualRecipe,
  visualFrame,
  MOTION_TEMPLATES,
  VELOCITY_GRAPH_TEMPLATE,
  ENERGY_TEMPLATE,
  ENERGY_BASIS,
  energyInput,
  velocityGraphInput,
  motionInput,
  exactMotionText,
  NOTICE_STEPS,
  WRITING_SOURCE,
  learningEvidenceMap
} from '../../../../laf-backend/functions/_shared/learning-visual.js';
const props = defineProps({
  state: { type: Object, required: true },
  conversationId: { type: String, default: null },
  context: { type: String, default: '' },
  stopped: Boolean,
  busy: Boolean,
  recordWritingHelp: { type: Function, default: null },
  readWritingReference: { type: Function, default: null },
  openVocabulary: { type: Function, default: null },
  vocabularyTaskFor: { type: Function, default: null },
  startVocabularyTask: { type: Function, default: null },
  submitVocabulary: { type: Function, default: null },
  recordDiagramHelp: { type: Function, default: null },
  recordScienceHelp: { type: Function, default: null },
  question: { type: Object, default: null },
  visible: { type: Boolean, default: true },
  request: { type: Object, default: null },
  iconColor: { type: String, default: '#7050b0' }
});
const emit = defineEmits(['question', 'writing', 'science']);
const tabs = [
  { id: 'visual', label: '动态演示' },
  { id: 'writing', label: '逐句带练' },
  { id: 'map', label: '学习关系图' }
];
const root = ref(null),
  opened = ref(false),
  tab = ref('visual'),
  step = ref(0),
  prediction = ref(''),
  playing = ref(false),
  showVideo = ref(false),
  reducedMotion = ref(false);
const visualError = ref('');
const contextRecipeError = ref(''),
  viewChosen = ref(false),
  appliedRequestId = ref(null),
  recipeSource = ref('example');
let observationHelpKey = '';
const defaultRecipe = visualRecipe({ template: 'distance_displacement' });
const manualRecipe = ref(null),
  exampleRecipe = ref(defaultRecipe),
  exampleVersion = ref(0),
  diagramEditing = ref(false);
const visualExamples = [
  { template: 'distance_displacement', label: '路程与位移' },
  { template: 'constant_net_force', label: '合力与加速度' },
  { template: 'accelerated_motion', label: '初速度与转向' },
  { template: 'changing_net_force', label: '分段合力' },
  { template: VELOCITY_GRAPH_TEMPLATE, label: '速度—时间图' },
  { template: ENERGY_TEMPLATE, label: '功与动能' }
];
const visualVideo = '/static/learning-media/distance-return.mp4';
const recipe = computed(() => manualRecipe.value || exampleRecipe.value);
const motionRecipe = computed(() => MOTION_TEMPLATES.includes(recipe.value.template));
const energyRecipe = computed(() => recipe.value.template === ENERGY_TEMPLATE);
const movingRecipe = computed(() => motionRecipe.value || energyRecipe.value);
const graphRecipe = computed(() => recipe.value.template === VELOCITY_GRAPH_TEMPLATE);
const forceRecipe = computed(() => recipe.value.template === 'constant_net_force' || movingRecipe.value);
const motionConditions = computed(() => {
  const value = recipe.value;
  const schedule = value.segments || [
    { seconds: value.physicalSeconds, netForceN: value.netForceN, direction: value.direction }
  ];
  return schedule
    .map(
      (s, i) =>
        `第${i + 1}段 ${s.seconds}s · ${s.netForceN}N${s.netForceN ? `向${s.direction === 'left' ? '左' : '右'}` : '无方向'}`
    )
    .join('；');
});
const motionTurned = computed(() => frame.value.distance > Math.abs(frame.value.position) + 1e-10);
const motionZeroForce = computed(
  () => !(recipe.value.segments?.[frame.value.phaseIndex]?.netForceN ?? recipe.value.netForceN)
);
const side = computed(() => (recipe.value.direction === 'left' ? '左' : '右'));
const frame = computed(() => visualFrame(recipe.value, step.value));
const motionOriginLabel = computed(
  () =>
    movingRecipe.value &&
    -frame.value.minimum / (frame.value.maximum - frame.value.minimum) > 0.15 &&
    -frame.value.minimum / (frame.value.maximum - frame.value.minimum) < 0.85
);
const map = computed(() => learningEvidenceMap(props.state, { conversationId: props.conversationId }));
let timer = null,
  unbind = () => {
    /* 尚未绑定键盘。 */
  },
  motionQuery;
const number = (value) => Number(value.toFixed(1));
const physicsNumber = (value) => {
  const rounded = Number(value.toFixed(3));
  return Math.abs(rounded - value) > 1e-10 ? `≈${rounded}` : String(rounded);
};
const displacementText = computed(() =>
  frame.value.displacement === 0 ? '0 m' : `向${side.value} ${number(Math.abs(frame.value.displacement))} m`
);
const forcePosition = (value) =>
  `${
    movingRecipe.value
      ? 8 + (84 * (value - frame.value.minimum)) / (frame.value.maximum - frame.value.minimum)
      : recipe.value.direction === 'left'
        ? 92 - (84 * Math.abs(value)) / frame.value.extent
        : 8 + (84 * Math.abs(value)) / frame.value.extent
  }%`;
function clearDiagram() {
  manualRecipe.value = null;
  resetVisual();
}
function adoptDiagram(value) {
  if (props.stopped || props.busy) return;
  resetVisual();
  manualRecipe.value = value;
}
function chooseExample(template) {
  if (props.stopped || props.busy) return;
  viewChosen.value = true;
  if (manualRecipe.value && recipe.value.template === template) return;
  recipeSource.value = 'example';
  contextRecipeError.value = '';
  clearDiagram();
  exampleVersion.value++;
  exampleRecipe.value =
    template === ENERGY_TEMPLATE
      ? visualRecipe({
          template,
          massKg: 1,
          initialVelocityMps: 4,
          netForceN: 2,
          direction: 'left',
          physicalSeconds: 3
        })
      : template === VELOCITY_GRAPH_TEMPLATE
        ? visualRecipe({
            template,
            points: [
              { time: 0, velocity: 2 },
              { time: 3, velocity: -1 },
              { time: 5, velocity: -1 },
              { time: 8, velocity: 2 }
            ]
          })
        : template === 'accelerated_motion'
          ? visualRecipe({
              template,
              massKg: 0.5,
              netForceN: 0.5,
              direction: 'left',
              initialVelocityMps: 2,
              physicalSeconds: 4
            })
          : template === 'changing_net_force'
            ? visualRecipe({
                template,
                massKg: 0.5,
                initialVelocityMps: 1,
                segments: [
                  { seconds: 2, netForceN: 0.5, direction: 'left' },
                  { seconds: 2, netForceN: 0, direction: 'none' },
                  { seconds: 2, netForceN: 0.5, direction: 'right' }
                ]
              })
            : template === 'constant_net_force'
              ? visualRecipe({ template, massKg: 2, netForceN: 4, direction: 'right' })
              : defaultRecipe;
}
function observedScienceInput(value = recipe.value) {
  return scienceInput(
    value.template === ENERGY_TEMPLATE
      ? energyInput(value)
      : value.template === VELOCITY_GRAPH_TEMPLATE
        ? velocityGraphInput(value)
        : MOTION_TEMPLATES.includes(value.template)
          ? motionInput(value)
          : value.template === 'constant_net_force'
            ? { template: value.template, massKg: value.massKg, netForceN: value.netForceN, direction: value.direction }
            : {
                template: value.template,
                outward: value.outward,
                backward: value.backward,
                direction: value.direction || 'right'
              }
  );
}
function requestScience() {
  if (props.stopped || props.busy || !frame.value.complete) return;
  emit('science', props.context, observedScienceInput());
}
function ensureObservationHelp() {
  // 原图条件确认已先保存图示帮助；普通示例另归当前物理题。
  if (manualRecipe.value || (!props.question?.scienceExercise && props.question?.subject !== '物理')) return true;
  const key = JSON.stringify([
    props.context,
    observedScienceInput(),
    (props.state.attempts || []).filter((a) => a.questionKey === `${props.question.id}@${props.question.version}`)
      .length
  ]);
  if (key === observationHelpKey) return true;
  if (props.recordScienceHelp?.(props.context, observedScienceInput()) !== true) {
    visualError.value = '观察帮助未保存，请重试。';
    return false;
  }
  observationHelpKey = key;
  visualError.value = '';
  return true;
}
function toggleVisualVideo() {
  pause();
  if (showVideo.value) {
    showVideo.value = false;
    return;
  }
  if (!props.stopped && !props.busy && ensureObservationHelp()) showVideo.value = true;
}
function pause() {
  if (timer) clearInterval(timer);
  timer = null;
  playing.value = false;
}
function resetVisual() {
  pause();
  step.value = 0;
  prediction.value = '';
  showVideo.value = false;
  visualError.value = '';
  observationHelpKey = '';
}
function chooseTab(id) {
  viewChosen.value = true;
  if (tab.value === id) return;
  pause();
  showVideo.value = false;
  if (manualRecipe.value) clearDiagram();
  diagramEditing.value = false;
  tab.value = id;
}
function toggleOpened() {
  viewChosen.value = true;
  opened.value = !opened.value;
}
function resetContextRecipe() {
  contextRecipeError.value = '';
  recipeSource.value = 'example';
  exampleRecipe.value = defaultRecipe;
  const exercise = props.question?.scienceExercise;
  if (!exercise) return;
  try {
    const input = scienceInput(exercise.input);
    const contract =
      input.template === ENERGY_TEMPLATE
        ? ENERGY_TRANSFER_CONTRACT
        : input.template === VELOCITY_GRAPH_TEMPLATE
          ? GRAPH_TRANSFER_CONTRACT
          : MOTION_TEMPLATES.includes(input.template)
            ? MOTION_TRANSFER_CONTRACT
            : SCIENCE_TRANSFER_CONTRACT;
    if (exercise.contract !== contract) throw new Error('unsupported science contract');
    exampleRecipe.value = visualRecipe(input);
    recipeSource.value = 'question';
  } catch {
    contextRecipeError.value = '当前题目演示未就绪，请选择示例。';
  }
}
const requestedVisual = computed(() => {
  const request = props.request;
  const key = props.question ? `${props.question.id}@${props.question.version}` : null;
  if (
    !request?.id ||
    request.owner !== props.state.owner ||
    request.learningContext !== props.context ||
    request.conversationId !== props.conversationId ||
    (request.questionKey || null) !== key
  )
    return null;
  try {
    return visualRecipe(observedScienceInput(request.recipe));
  } catch {
    return null;
  }
});
const pendingVisual = computed(() => requestedVisual.value && props.request.id !== appliedRequestId.value);
function applyRequestedVisual(explicit = false) {
  if (props.stopped || props.busy || !props.visible || !pendingVisual.value) return;
  if (explicit) viewChosen.value = true;
  manualRecipe.value = null;
  diagramEditing.value = false;
  exampleRecipe.value = requestedVisual.value;
  contextRecipeError.value = '';
  recipeSource.value = 'request';
  appliedRequestId.value = props.request.id;
  exampleVersion.value++;
  resetVisual();
  opened.value = true;
  tab.value = 'visual';
}
function nextFrame() {
  pause();
  if (!props.stopped && !props.busy && prediction.value && !frame.value.complete && ensureObservationHelp())
    step.value++;
}
function togglePlayback() {
  if (playing.value) return pause();
  if (props.stopped || props.busy || !prediction.value || frame.value.complete) return;
  if (reducedMotion.value) return nextFrame();
  if (!ensureObservationHelp()) return;
  playing.value = true;
  timer = setInterval(
    () => {
      if (props.stopped || props.busy || !opened.value || step.value >= recipe.value.steps) return pause();
      step.value++;
      if (step.value >= recipe.value.steps) pause();
    },
    (recipe.value.duration * 1000) / recipe.value.steps
  );
}
const writingIndex = ref(0),
  writingGenreId = ref(writingGenre(props.question)),
  sentence = ref(''),
  sentences = ref([]),
  feedback = ref(null),
  scaffold = ref(false),
  wordMessage = ref(''),
  writingComplete = ref(false);
const writingReference = ref(null);
const writingReferenceId = ref('');
const availableWritingReferences = computed(() =>
  PUBLIC_WRITING_REFERENCES.filter((item) => item.genreId === writingGenreId.value)
);
const currentWritingReference = computed(
  () =>
    availableWritingReferences.value.find((item) => item.id === writingReferenceId.value) ||
    availableWritingReferences.value[0]
);
function chooseWritingReference(id) {
  if (
    !props.visible ||
    props.stopped ||
    props.busy ||
    !writingBound.value ||
    !availableWritingReferences.value.some((item) => item.id === id)
  )
    return;
  if (id === currentWritingReference.value?.id) return;
  writingReferenceId.value = id;
  writingReference.value = null;
}
function openWritingReference() {
  if (!props.visible || props.stopped || props.busy || !writingBound.value) return;
  const reference = currentWritingReference.value;
  const saved = reference && props.readWritingReference?.(props.context, reference.id, reference.version);
  if (saved?.hintId && saved.reference?.id === reference.id && saved.reference.version === reference.version)
    writingReference.value = publicWritingReference(reference.id, reference.version);
}
const vocabularyQuestion = ref(null),
  vocabularyWord = ref(''),
  vocabularyChoice = ref(''),
  vocabularyDelayDays = ref(1),
  showAllWords = ref(false);
const vocabularyDelayOptions = [
  { days: 1, label: '明日' },
  { days: 3, label: '3天后' },
  { days: 7, label: '7天后' }
];
const vocabularyAttempt = computed(() =>
  props.state.attempts.find(
    (a) =>
      a.questionKey ===
      (vocabularyQuestion.value && `${vocabularyQuestion.value.id}@${vocabularyQuestion.value.version}`)
  )
);
const vocabularyResult = computed(() =>
  vocabularyAttempt.value
    ? vocabularyAttempt.value.corrections?.length
      ? '已校对，换句再认。'
      : vocabularyFeedback(vocabularyQuestion.value, vocabularyAttempt.value).message
    : ''
);
const vocabularyRetest = computed(
  () =>
    vocabularyQuestion.value &&
    props.vocabularyTaskFor?.(
      `${vocabularyQuestion.value.id}@${vocabularyQuestion.value.version}`,
      'retest',
      vocabularyDelayDays.value
    )
);
function chooseVocabularyDelay(days) {
  if (props.stopped || props.busy || !writingBound.value || !vocabularyQuestion.value || !vocabularyResult.value)
    return;
  if (vocabularyDelayOptions.some((item) => item.days === days)) vocabularyDelayDays.value = days;
}
function wordTask(phase) {
  if (props.stopped || props.busy || !vocabularyQuestion.value || !vocabularyResult.value) return;
  props.startVocabularyTask?.(
    props.context,
    `${vocabularyQuestion.value.id}@${vocabularyQuestion.value.version}`,
    phase,
    phase === 'retest' ? vocabularyDelayDays.value : 1
  );
}
const writingSteps = computed(() =>
  props.question?.writingExercise && writingGenre(props.question) === writingGenreId.value
    ? writingStepsForQuestion(props.question)
    : writingGenreId.value === 'notice'
      ? NOTICE_STEPS
      : GUIDED_WRITING_STEPS[writingGenreId.value]
);
const writingStep = computed(() => writingSteps.value[writingIndex.value]);
const writingInParagraphs = computed(() => writingDraftLimit(writingGenreId.value) === 2000);
const writingIsChinese = computed(() => writingGenreInfo(writingGenreId.value).language === 'zh');
const writingWords = computed(() =>
  writingBound.value
    ? adaptiveWritingWords(props.state, props.question, writingStep.value.words)
    : writingStep.value.words.map((word) => ({ word, senseId: null, folded: false }))
);
const foldedWords = computed(() => writingWords.value.filter((card) => card.folded).length);
const visibleWritingWords = computed(() => writingWords.value.filter((card) => showAllWords.value || !card.folded));
const writingBound = computed(
  () => !!props.question?.writingExercise && writingGenre(props.question) === writingGenreId.value
);
function chooseWritingGenre(id) {
  if (props.stopped || props.busy || id === writingGenreId.value) return;
  writingGenreInfo(id);
  clearDraft();
  writingGenreId.value = id;
}
function wordHelp(word) {
  if (props.stopped || props.busy) return;
  const content = `${word}：${WRITING_WORD_MEANINGS[word]}`;
  if (saveWritingHelp(content)) wordMessage.value = content;
}
function chooseWord(card) {
  if (card.senseId && props.openVocabulary) openWordCheck(card.word);
  else wordHelp(card.word);
}
function openWordCheck(word) {
  if (props.stopped || props.busy || !writingBound.value || !props.openVocabulary) return;
  const q = props.openVocabulary(props.context, word);
  if (!q?.vocabularyExercise) return;
  vocabularyQuestion.value = q;
  vocabularyWord.value = word;
  vocabularyChoice.value = '';
  vocabularyDelayDays.value = 1;
  wordMessage.value = '';
}
function confirmVocabulary() {
  if (props.stopped || props.busy || !vocabularyQuestion.value || !vocabularyChoice.value || !props.submitVocabulary)
    return;
  const result = props.submitVocabulary(
    props.context,
    `${vocabularyQuestion.value.id}@${vocabularyQuestion.value.version}`,
    vocabularyChoice.value
  );
  if (result?.attemptId) wordMessage.value = '';
}
function clearVocabulary() {
  vocabularyQuestion.value = null;
  vocabularyWord.value = '';
  vocabularyChoice.value = '';
  vocabularyDelayDays.value = 1;
}
function saveWritingHelp(content) {
  return (
    writingBound.value &&
    (!props.recordWritingHelp || props.recordWritingHelp(props.context, content, writingGenreId.value) !== false)
  );
}
function showScaffold() {
  if (!props.stopped && !props.busy && saveWritingHelp(`${writingStep.value.scaffold} · ${writingStep.value.hint}`))
    scaffold.value = true;
}
function checkSentence() {
  if (props.stopped || props.busy) return;
  const result = guidedSentenceFeedback(writingGenreId.value, writingStep.value.id, sentence.value, props.question);
  if (saveWritingHelp(result.message)) feedback.value = result;
}
function nextSentence() {
  if (props.stopped || props.busy || !(feedback.value?.ready || feedback.value?.kind === 'content')) return;
  sentences.value[writingIndex.value] = sentence.value.trim();
  if (writingIndex.value === writingSteps.value.length - 1) {
    writingComplete.value = true;
    return;
  }
  writingIndex.value++;
  sentence.value = '';
  feedback.value = null;
  scaffold.value = false;
  wordMessage.value = '';
  clearVocabulary();
  showAllWords.value = false;
}
function clearDraft() {
  writingReference.value = null;
  writingReferenceId.value = '';
  clearVocabulary();
  showAllWords.value = false;
  writingIndex.value = 0;
  sentence.value = '';
  sentences.value = [];
  feedback.value = null;
  scaffold.value = false;
  wordMessage.value = '';
  writingComplete.value = false;
}
function release() {
  diagramEditing.value = false;
  manualRecipe.value = null;
  resetVisual();
  clearDraft();
  opened.value = false;
}
watch(
  [
    () => props.context,
    () => props.state.owner,
    () => props.conversationId,
    () => props.question?.id,
    () => props.question?.version,
    () => props.question?.writingExercise?.contract,
    () => props.question?.writingExercise?.genreId,
    () => props.question?.scienceExercise?.contract,
    () => JSON.stringify(props.question?.scienceExercise?.input)
  ],
  () => {
    release();
    viewChosen.value = false;
    appliedRequestId.value = null;
    resetContextRecipe();
    exampleVersion.value++;
    tab.value = [NOTICE_CONTRACT, GUIDED_WRITING_CONTRACT, ...EXTENDED_WRITING_CONTRACTS].includes(
      props.question?.writingExercise?.contract
    )
      ? 'writing'
      : 'visual';
    writingGenreId.value = writingGenre(props.question);
  },
  { flush: 'sync', immediate: true }
);
watch(
  () => props.busy,
  (value) => {
    if (value) {
      pause();
      showVideo.value = false;
      writingReference.value = null;
    }
  },
  { flush: 'sync' }
);
watch(
  () => props.stopped,
  () => {
    pause();
    showVideo.value = false;
    writingReference.value = null;
  },
  { flush: 'sync' }
);
watch(
  () =>
    props.state.attempts.filter(
      (attempt) => attempt.questionKey === (props.question && `${props.question.id}@${props.question.version}`)
    ).length,
  () => {
    writingReference.value = null;
  },
  { flush: 'sync' }
);
watch(opened, (value) => {
  if (!value) {
    pause();
    showVideo.value = false;
    if (manualRecipe.value) clearDiagram();
    diagramEditing.value = false;
  }
});
watch(sentence, () => {
  feedback.value = null;
  writingComplete.value = false;
});
watch(
  requestedVisual,
  (value) => {
    if (!value) {
      if (recipeSource.value === 'request') {
        resetContextRecipe();
        if (!manualRecipe.value) resetVisual();
      }
      return;
    }
    if (!viewChosen.value) applyRequestedVisual();
  },
  { immediate: true, flush: 'sync' }
);
function motionChanged() {
  reducedMotion.value = motionQuery?.matches || false;
  if (reducedMotion.value) pause();
}
onMounted(() => {
  unbind = bindLearningKeyboard(root.value);
  // #ifdef H5
  motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  motionChanged();
  motionQuery?.addEventListener?.('change', motionChanged);
  // #endif
});
watch(
  () => props.visible,
  (visible) => {
    if (!visible) release();
  },
  { flush: 'sync' }
);
onUnmounted(() => {
  pause();
  unbind();
  motionQuery?.removeEventListener?.('change', motionChanged);
});
</script>

<style scoped>
.public-writing-reference {
  margin: 12px 0 20px;
  padding: 16px;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  background: var(--yozi-solid);
  overflow-wrap: anywhere;
}
.reference-title,
.reference-excerpt,
.reference-credit {
  display: block;
  margin-bottom: 12px;
}
.reference-excerpt {
  white-space: pre-wrap;
  line-height: 1.75;
  font-size: 16px;
}
.reference-credit {
  color: var(--space-muted);
  font-size: 12px;
  line-height: 1.6;
}
.reference-links {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.reference-links a {
  display: inline-flex;
  align-items: center;
  min-width: 44px;
}
.reference-links a:focus-visible,
.writing-source:focus-visible {
  outline: 2px solid var(--space-focus, #785bbc);
  outline-offset: 4px;
}
.reference-note {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 12px 0;
  line-height: 1.6;
}
.vocabulary-check {
  margin: 12px 0;
  padding: 16px;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  background: var(--yozi-reading);
}
.vocabulary-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0;
}
.vocabulary-options button {
  width: 100%;
  text-align: left;
  white-space: normal;
}
.learning-lab {
  margin: 24px 0;
  overflow: hidden;
  background: var(--yozi-solid);
  border-radius: 24px;
  box-shadow: var(--yozi-shadow);
}
.lab-heading {
  display: flex;
  width: 100%;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0;
}
.lab-heading view,
.lab-content,
.writing-draft {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lab-content {
  padding-top: 16px;
}
.lab-tabs,
.word-list,
.map-evidence,
.scene-readout {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.energy-readout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--yozi-solid);
  border-radius: 12px;
}
.energy-lane {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.energy-track {
  height: 12px;
  background: var(--yozi-glass);
  border-radius: 8px;
  overflow: hidden;
}
.energy-bar {
  height: 100%;
  background: #7050b0;
  border-radius: inherit;
}
.energy-bar.current {
  background: #5473d8;
}
.lab-tabs button,
.word-list button,
.map-evidence button {
  margin: 0;
  min-height: 44px;
  font-size: 14px;
}
.lab-title {
  display: block;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
}
.lab-prompt {
  display: block;
  font-size: 16px;
  line-height: 1.65;
}
.lab-feedback {
  display: block;
  padding: 12px 16px;
  background: var(--yozi-glass);
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
}
.selected {
  background: var(--space-user, var(--yozi-solid)) !important;
}
.scene {
  position: relative;
  height: 148px;
  margin: 8px 20px;
}
.scene-axis,
.scene-trail {
  position: absolute;
  left: 8%;
  top: 84px;
  width: 84%;
  height: 4px;
  border-radius: 4px;
  background: var(--space-line, #aaa0c0);
}
.scene-trail {
  background: #9878d4;
  top: 76px;
}
.scene-character {
  position: absolute;
  top: 30px;
  width: 48px;
  height: 48px;
  transform: translateX(-50%);
}
.scene-start,
.scene-turn {
  position: absolute;
  top: 105px;
  font-size: 14px;
}
.mirrored-start {
  left: auto;
  right: 8%;
  transform: translateX(50%);
}
.mirrored-turn {
  right: auto;
  left: 8%;
  transform: translateX(-50%);
}
.force-lane {
  padding: 8px 0;
}
.lane-label {
  font-size: 16px;
  font-weight: 600;
}
.force-track {
  position: relative;
  height: 96px;
  margin: 0 20px;
}
.force-axis {
  position: absolute;
  top: 58px;
  left: 8%;
  width: 84%;
  height: 3px;
  background: var(--space-line);
}
.force-character {
  position: absolute;
  top: 8px;
  width: 44px;
  height: 44px;
  transform: translateX(-50%);
}
.force-start,
.force-end {
  position: absolute;
  top: 68px;
  font-size: 12px;
}
.force-origin {
  position: absolute;
  top: 68px;
  transform: translateX(-50%);
  font-size: 12px;
}
.force-start {
  left: 8%;
  transform: translateX(-50%);
}
.force-end {
  right: 8%;
  transform: translateX(50%);
}
.force-start.leftward {
  left: auto;
  right: 8%;
  transform: translateX(50%);
}
.force-end.leftward {
  right: auto;
  left: 8%;
  transform: translateX(-50%);
}
.scene-start {
  left: 8%;
  transform: translateX(-50%);
}
.scene-turn {
  right: 8%;
  transform: translateX(50%);
}
.scene-readout {
  justify-content: space-between;
  font-weight: 600;
}
.scene-video {
  width: 100%;
  height: 240px;
  border-radius: 12px;
}
.writing-progress {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.writing-progress view {
  padding: 8px;
  font-size: 12px;
  border-bottom: 2px solid var(--space-line, #aaa0c0);
}
.writing-progress .current,
.writing-progress .done {
  border-color: #9878d4;
}
.sentence-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 112px;
  padding: 12px;
  border: 1px solid var(--space-line, #aaa0c0);
  border-radius: 12px;
  background: var(--yozi-glass);
  color: var(--space-ink);
  font-size: 16px;
}
.writing-source {
  color: inherit;
  text-decoration: underline;
  min-height: 44px;
  line-height: 44px;
  font-size: 12px;
}
.heatmap {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.heat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  border: 1px solid var(--space-line, #aaa0c0);
  border-radius: 8px;
  font-size: 12px;
}
.heat-cell.active {
  background: var(--space-user, #e2d8f3);
}
.heat-cell.pending {
  border-style: dashed;
}
.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--space-muted);
}
.map-legend text::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  vertical-align: middle;
  border: 1px solid var(--space-line);
  border-radius: 3px;
}
.map-legend .legend-reliable::before {
  background: var(--space-user);
}
.map-legend .legend-pending::before {
  border-style: dashed;
}
.map-node {
  position: relative;
  border-left: 2px solid var(--space-line, #aaa0c0);
  margin-left: 12px;
  padding: 4px 0 12px 16px;
}
.map-node-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.map-evidence {
  padding-top: 8px;
}
@media (max-width: 560px) {
  .writing-progress {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .scene {
    margin: 8px 12px;
  }
  .scene-readout {
    font-size: 14px;
  }
  .scene-video {
    height: 180px;
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .learning-lab,
  .lab-feedback,
  .sentence-input {
    background: var(--yozi-solid);
  }
}
</style>
