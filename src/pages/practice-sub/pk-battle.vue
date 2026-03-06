<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 匹配阶段 -->
    <view v-if="gameState === 'matching'" class="matching-stage">
      <view class="radar-scanner">
        <view class="radar-circle radar-1" />
        <view class="radar-circle radar-2" />
        <view class="radar-circle radar-3" />
        <view class="radar-line" />
      </view>
      <view class="match-core">
        <view class="avatar-ring pulse">
          <image
            class="user-avatar"
            :src="userInfo.avatarUrl || defaultAvatar"
            mode="aspectFill"
            @error="onUserAvatarError"
          />
        </view>
        <view class="vs-text"> VS </view>
        <view class="avatar-ring opponent-ring" :class="{ found: opponentFound }">
          <image
            class="user-avatar"
            :src="opponent.avatar || defaultAvatar"
            mode="aspectFill"
            @error="onOpponentAvatarError"
          />
          <view v-if="!opponentFound" class="search-overlay">
            <view class="search-icon">
              <BaseIcon name="search" :size="36" />
            </view>
          </view>
        </view>
      </view>
      <view class="match-status">
        <text class="status-title">
          {{ opponentFound ? '匹配成功！' : matchingStatusText }}
        </text>
        <text v-if="opponentFound" class="status-tip"> {{ opponent.name }} 已加入对战 </text>
        <text
          v-if="!opponentFound"
          class="status-tip"
          style="margin-top: 10rpx; font-size: 22rpx; color: var(--text-inverse-secondary)"
        >
          超时将自动匹配机器人对手
        </text>
      </view>
      <view v-if="!opponentFound" class="exit-btn" @tap="handleExit">
        <text>取消匹配</text>
      </view>
    </view>

    <!-- 红光警告遮罩（最后5秒） -->
    <view v-if="showRedWarning && gameState === 'battle'" class="red-warning-overlay" />

    <!-- 对战阶段 - iOS 风格重构 -->
    <view v-if="gameState === 'battle'" class="pk-container">
      <view class="top-bar" :style="{ marginTop: '10px' }">
        <view class="icon-btn" @tap="handleQuit">
          <BaseIcon name="close" :size="32" />
        </view>
        <view class="round-badge">
          <text>Round {{ currentIndex + 1 }} / {{ questions.length }}</text>
        </view>
        <view class="icon-btn ghost" />
      </view>

      <view class="battle-stage" :style="{ marginTop: '30px' }">
        <view class="player-card left">
          <image
            :src="userInfo.avatarUrl || defaultAvatar"
            class="avatar"
            mode="aspectFill"
            @error="onUserAvatarError"
          />
          <text class="score me">
            {{ myScore }}
          </text>
          <view class="progress-track">
            <view class="progress-fill me" :style="{ width: (myScore / 500) * 100 + '%' }" />
          </view>
        </view>

        <text class="vs-text"> VS </text>

        <view class="player-card right">
          <image
            :src="opponent.avatar || defaultAvatar"
            class="avatar"
            mode="aspectFill"
            @error="onOpponentAvatarError"
          />
          <text class="score opp">
            {{ opponentScore }}
          </text>
          <view class="progress-track">
            <view
              class="progress-fill opp"
              :style="{ width: (opponentScore / 500) * 100 + '%' }"
              :class="{ rush: opponentRushing }"
            />
          </view>
        </view>
      </view>

      <view class="question-card">
        <view class="question-header">
          <view class="tag"> 单选 </view>
          <view class="timer-badge" :class="{ warning: timeLeft <= 10, danger: timeLeft <= 5 }">
            <text class="timer-text"> {{ timeLeft }}s </text>
          </view>
        </view>
        <text class="q-text">
          {{ currentQuestion.question || currentQuestion.title || '题目加载中...' }}
        </text>
        <!-- 调试信息 -->
        <view v-if="false">
          <text>题目索引: {{ currentIndex }} / {{ questions.length }}</text>
          <text>选项数量: {{ currentQuestion?.options?.length || 0 }}</text>
          <text>gameState: {{ gameState }}</text>
          <text>showAns: {{ showAns }}</text>
        </view>
      </view>

      <view class="options-group">
        <button
          v-for="(opt, idx) in currentQuestion.options"
          :key="idx"
          class="opt-btn"
          :class="{
            selected: userChoice === idx,
            correct: showAns && isCorrectOption(idx),
            wrong: showAns && userChoice === idx && !isCorrectOption(idx),
            disabled: showAns
          }"
          :disabled="showAns"
          :data-index="idx"
          hover-class="btn-scale-sm"
          style="position: relative; z-index: 10; background: transparent; border: none; padding: 0; margin: 0"
          @tap.stop="handleSelect(idx)"
          @click.stop="handleSelect(idx)"
        >
          <view class="opt-btn-inner">
            <view class="letter">
              {{ ['A', 'B', 'C', 'D'][idx] }}
            </view>
            <text class="content">
              {{ opt }}
            </text>
            <view v-if="showAns" class="opt-icon">
              <BaseIcon v-if="isCorrectOption(idx)" name="check" :size="28" />
              <BaseIcon v-else-if="userChoice === idx && !isCorrectOption(idx)" name="cross" :size="28" />
            </view>
          </view>
        </button>
      </view>

      <view
        v-if="opponentAnswered && !showAns"
        class="opponent-status"
        :style="{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }"
      >
        <text class="opponent-tip"> {{ opponent.name }} 已答题 ✓ </text>
      </view>
    </view>

    <!-- 结算阶段 -->
    <view v-if="gameState === 'result'" class="result-stage" @tap.stop="handleResultStageClick">
      <view class="result-glass glass-card" @tap.stop>
        <view class="result-header">
          <view class="result-icon" :class="{ victory: myScore >= opponentScore, defeat: myScore < opponentScore }">
            <BaseIcon :name="myScore >= opponentScore ? 'trophy' : 'warning'" :size="48" />
          </view>
          <text class="result-title" :class="{ victory: myScore >= opponentScore, defeat: myScore < opponentScore }">
            {{ myScore >= opponentScore ? 'VICTORY' : 'DEFEAT' }}
          </text>
          <text class="result-subtitle"> 战绩对比：{{ myScore }} VS {{ opponentScore }} </text>
        </view>

        <!-- 智能战报分析卡片 -->
        <view class="ai-report-box">
          <view class="ai-header">
            <view class="ai-icon">
              <BaseIcon name="robot" :size="32" />
            </view>
            <text class="ai-title"> 智能犀利点评 </text>
          </view>
          <text class="ai-text">
            {{ aiSummary || '智能正在分析本场对局...' }}
          </text>
        </view>

        <view class="action-btns">
          <button class="btn-share" hover-class="btn-scale-sm" @tap.stop="handleShare">分享战报</button>
          <button class="btn-rank" hover-class="btn-scale-sm" @tap.stop="goToRank">查看排行榜</button>
          <button class="btn-again" hover-class="btn-scale-sm" @tap.stop="resetGame">再来一局</button>
          <button class="btn-home" hover-class="btn-scale-sm" @tap.stop="goHome">返回首页</button>
          <button class="btn-exit" hover-class="btn-scale-sm" @tap.stop="handleExitFromResult">退出</button>
        </view>
      </view>
    </view>

    <!-- 隐藏的画布，用于生成分享海报 -->
    <canvas
      canvas-id="shareCanvas"
      :style="{ width: '375px', height: '600px', position: 'fixed', left: '9000px', top: '0' }"
    ></canvas>

    <!-- ✅ 自定义弹窗：题库为空提示 -->
    <CustomModal
      :visible="showEmptyModal"
      type="upload"
      title="题库空空如也"
      content="PK 对战需要先导入题库，上传学习资料后即可开始对战！"
      confirm-text="去上传"
      :show-cancel="false"
      :is-dark="isDark"
      @confirm="handleEmptyConfirm"
    />
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import CustomModal from '@/components/common/CustomModal.vue';
// ✅ 懒加载：invite-deep-link 478行，仅在用户分享时才需要（改为方法内动态导入）
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
// ✅ F024: 统一使用 storageService
import storageService from '@/services/storageService.js';
import config from '@/config/index.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { createInviteDeepLink, generateInviteCode, generateShareConfig } from './invite-deep-link.js';
// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';

export default {
  components: {
    CustomModal,
    BaseIcon
  },
  data() {
    return {
      gameState: 'matching', // matching, battle, result
      isDark: false,
      statusBarHeight: 44,
      userInfo: {},
      defaultAvatar: DEFAULT_AVATAR,
      opponent: { name: '寻找中...', avatar: '', level: '' },
      opponentFound: false,
      currentIndex: 0,
      questions: [],
      myScore: 0,
      opponentScore: 0,
      userChoice: null,
      opponentChoice: null,
      opponentAnswered: false,
      showAns: false,
      aiSummary: '智能正在分析本场对局...',
      opProgress: 0,
      myProgress: 0,
      // ✅ 自定义弹窗状态
      showEmptyModal: false,
      opponentRushing: false,
      opponentTimers: [],
      questionTimer: null, // 题目倒计时定时器
      timeLeft: 30, // 每道题剩余时间（秒）
      isGeneratingShare: false, // 是否正在生成分享海报
      isScoreUploaded: false, // 是否已上传分数（防止重复上传）
      isNavigating: false, // 防止重复跳转
      showRedWarning: false, // 是否显示红光警告
      // 匹配状态相关
      matchingTimer: null, // 匹配定时器
      matchingTimeoutTimer: null, // 匹配超时定时器
      matchingStatusTimer: null, // 匹配状态更新定时器
      matchingStartTime: 0, // 匹配开始时间
      matchingTimeout: 30000, // 匹配超时时间（30秒）
      matchingStatusText: '正在寻找实力相当的研友...', // 匹配状态文本
      // 战绩数据（用于分享海报）
      accuracy: 0, // 正确率
      averageTime: 0, // 平均答题时间（秒）
      knowledgePoints: [], // 掌握的知识点
      questionStartTime: 0, // 当前题目开始时间戳
      answerTimes: [], // 每道题的实际答题时间（毫秒）
      // 智能对手库（从后端获取，本地作为降级方案）
      // 注意：当前版本为单机PK模式，对手为智能机器人
      // 后续版本将支持真实用户匹配
      botList: [],
      // 是否已从后端加载机器人配置
      botsLoaded: false,
      // 检查点4.2: 好友PK邀请相关
      sharePkRoomId: '', // PK房间ID
      sharePkInviteCode: '', // PK邀请码
      sharePkDeepLink: '', // PK深度链接
      showSharePkCard: false // 是否显示分享卡片
    };
  },
  computed: {
    currentQuestion() {
      const q = this.questions[this.currentIndex];
      if (!q) {
        logger.warn('[PK] 当前题目不存在:', {
          currentIndex: this.currentIndex,
          questionsLength: this.questions.length
        });
        return { question: '加载中...', options: [] };
      }

      // 数据规范化：确保题目格式正确
      let options = q.options || [];

      // 修复智能回传格式问题：确保options是数组且格式正确
      if (!Array.isArray(options)) {
        logger.warn('[PK] options不是数组，尝试转换:', options);
        // 尝试从字符串解析
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch (e) {
            logger.error('[PK] 无法解析options字符串:', e);
            options = [];
          }
        } else if (typeof options === 'object' && options !== null) {
          // 如果是对象，尝试转换为数组
          options = Object.values(options);
        } else {
          options = [];
        }
      }

      // 确保每个选项都是字符串，且去除前后空格
      options = options
        .map((opt) => {
          if (typeof opt === 'string') {
            return opt.trim();
          } else if (typeof opt === 'object' && opt !== null) {
            // 如果选项是对象，尝试提取文本
            return (opt.text || opt.content || opt.label || String(opt)).trim();
          }
          return String(opt).trim();
        })
        .filter((opt) => opt.length > 0); // 过滤空选项

      // 如果选项数量不足4个，补充空选项（安全上限防止无限循环）
      let _safetyCounter = 0;
      while (options.length < 4 && _safetyCounter++ < 10) {
        options.push(`选项${options.length + 1}`);
      }

      // 限制选项数量为4个
      options = options.slice(0, 4);

      const normalized = {
        question: (q.question || q.title || '题目加载中...').trim(),
        options: options,
        answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
        type: q.type || '单选',
        id: q.id || `q_${this.currentIndex}`
      };

      // 调试日志
      if (this.currentIndex === 0) {
      }

      return normalized;
    },
    isCorrectOption() {
      return (idx) => {
        if (!this.currentQuestion || !this.showAns) return false;
        const correctAnswer = this.currentQuestion.answer;
        if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
          return ['A', 'B', 'C', 'D'][idx] === correctAnswer;
        }
        const opt = this.currentQuestion.options?.[idx];
        return opt === correctAnswer || (opt?.startsWith(correctAnswer) ?? false);
      };
    }
  },

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: 'PK 对战 - Exam-Master 考研备考',
      path: '/pages/practice-sub/pk-battle'
    };
  },

  onLoad(options) {
    // 检查路由参数（从排行榜跳转时可能传递 opponent 参数）
    if (options && options.opponent) {
    }

    this.initData();
    // 先加载智能对手配置，再开始匹配
    this.loadBotConfig().then(() => {
      this.startMatching();
    });
  },
  onShow() {
    // 页面从后台恢复时，根据当前阶段恢复必要计时器
    if (this.gameState === 'matching' && !this.opponentFound && !this.matchingTimer && !this.matchingStatusTimer) {
      this.startMatching();
      return;
    }

    if (this.gameState === 'matching' && this.opponentFound && !this.questionTimer) {
      this.gameState = 'battle';
      this.startBattle();
      return;
    }

    if (this.gameState === 'battle' && !this.showAns && !this.questionTimer && this.timeLeft > 0) {
      this.startQuestionTimer(false);
    }
  },
  onHide() {
    // 页面进入后台时暂停所有计时器，避免后台持续运行
    this.clearAllTimers();
  },
  onUnload() {
    this.clearAllTimers();
  },
  methods: {
    // 用户头像加载失败处理
    onUserAvatarError() {
      this.userInfo.avatarUrl = this.defaultAvatar;
    },

    // 对手头像加载失败处理
    onOpponentAvatarError() {
      this.opponent.avatar = this.defaultAvatar;
    },

    initData() {
      this.statusBarHeight = getStatusBarHeight();
      this.userInfo = storageService.get('userInfo', { nickName: '考研人', avatarUrl: '' });
      // ✅ F024: 统一使用 storageService 读取主题
      this.isDark = storageService.get('theme_mode', 'light') === 'dark';

      // 加载题库（随机抽取5道题）
      const allQuestions = storageService.get('v30_bank', []);

      if (allQuestions.length === 0) {
        logger.warn('[PK] 题库为空，无法开始对战');
        // ✅ 使用自定义弹窗替换原生弹窗
        this.showEmptyModal = true;
        return;
      }

      // 随机抽取5道题
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      this.questions = shuffled.slice(0, Math.min(5, shuffled.length));
    },

    /**
     * 从后端加载智能对手配置
     * 如果后端不可用，使用本地默认配置
     */
    async loadBotConfig() {
      // 直接使用本地默认配置（后端 pk-battle.ts 无 get_bot_config action）
      this.botList = this.getDefaultBotConfig();
      this.botsLoaded = true;
    },

    /**
     * 获取默认智能对手配置
     * 基于真实用户数据统计生成的智能对手模型
     */
    getDefaultBotConfig() {
      // 根据用户当前分数动态生成对手
      const userScore = storageService.get('user_pk_score', 0);
      const baseLevel = Math.max(50, Math.min(95, Math.floor(userScore / 100) + 60));

      return [
        {
          name: '智能学霸',
          avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=AI_Scholar_${Date.now()}`,
          level: `Lv.${baseLevel + 10}`,
          accuracy: 0.85, // 智能答题正确率
          speed: 'fast' // 智能答题速度
        },
        {
          name: '智能研友',
          avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=AI_Friend_${Date.now()}`,
          level: `Lv.${baseLevel}`,
          accuracy: 0.7,
          speed: 'normal'
        },
        {
          name: '智能新手',
          avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=AI_Newbie_${Date.now()}`,
          level: `Lv.${baseLevel - 10}`,
          accuracy: 0.55,
          speed: 'slow'
        },
        {
          name: '智能挑战者',
          avatar: `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=AI_Challenger_${Date.now()}`,
          level: `Lv.${baseLevel + 5}`,
          accuracy: 0.75,
          speed: 'normal'
        }
      ];
    },
    startMatching() {
      // 确保智能对手配置已加载
      if (!this.botsLoaded || this.botList.length === 0) {
        logger.warn('[PK] 智能对手配置未加载，使用默认配置');
        this.botList = this.getDefaultBotConfig();
        this.botsLoaded = true;
      }

      // 重置匹配状态
      this.matchingStartTime = Date.now();
      this.matchingTimeout = 30000; // 30秒超时
      this.matchingStatusText = '正在寻找实力相当的研友...';

      // 启动匹配状态更新
      this.startMatchingStatusUpdate();

      // 模拟匹配过程（1.5-3秒随机延迟）
      const matchDelay = Math.random() * 1500 + 1500; // 1.5-3秒

      this.matchingTimer = setTimeout(() => {
        // 随机选择一个智能对手
        const randomBot = this.botList[Math.floor(Math.random() * this.botList.length)];
        this.opponent = {
          name: randomBot.name,
          avatar: randomBot.avatar,
          level: randomBot.level,
          isBot: true, // 标记为智能对手
          accuracy: randomBot.accuracy || 0.7,
          speed: randomBot.speed || 'normal'
        };
        this.opponentFound = true;
        this.matchingStatusText = '匹配成功！正在建立连接...';

        // 停止状态更新
        this.stopMatchingStatusUpdate();

        // 震动反馈
        try {
          if (typeof uni.vibrateShort === 'function') {
            uni.vibrateShort();
          }
        } catch (e) {
          logger.warn('Vibrate feedback failed during match success', e);
        }

        // 1秒后进入对战
        setTimeout(() => {
          this.gameState = 'battle';
          this.startBattle();
        }, 1000);
      }, matchDelay);

      // 30秒超时处理
      this.matchingTimeoutTimer = setTimeout(() => {
        if (!this.opponentFound) {
          this.stopMatchingStatusUpdate();
          this.handleMatchingTimeout();
        }
      }, this.matchingTimeout);
    },

    startMatchingStatusUpdate() {
      const statusTexts = ['正在寻找实力相当的研友...', '正在匹配中...', '寻找对手中...', '正在连接服务器...'];
      let index = 0;

      this.matchingStatusTimer = setInterval(() => {
        if (!this.opponentFound) {
          const elapsed = Date.now() - this.matchingStartTime;
          const remaining = Math.max(0, Math.ceil((this.matchingTimeout - elapsed) / 1000));

          if (remaining > 0) {
            index = (index + 1) % statusTexts.length;
            this.matchingStatusText = `${statusTexts[index]} (${remaining}s)`;
          }
        }
      }, 2000);
    },

    stopMatchingStatusUpdate() {
      if (this.matchingStatusTimer) {
        clearInterval(this.matchingStatusTimer);
        this.matchingStatusTimer = null;
      }
    },

    handleMatchingTimeout() {
      // 超时后自动匹配智能对手
      const randomBot = this.botList[Math.floor(Math.random() * this.botList.length)];
      this.opponent = {
        name: randomBot.name,
        avatar: randomBot.avatar,
        level: randomBot.level,
        isBot: true,
        accuracy: randomBot.accuracy || 0.7,
        speed: randomBot.speed || 'normal'
      };
      this.opponentFound = true;
      this.matchingStatusText = '已为您匹配智能对手';

      uni.showToast({
        title: '已转为智能对战',
        icon: 'none',
        duration: 2000
      });

      // 1.5秒后进入对战
      setTimeout(() => {
        this.gameState = 'battle';
        this.startBattle();
      }, 1500);
    },
    startBattle() {
      // 重置分数上传标志位（新一局开始）
      this.isScoreUploaded = false;

      // 开始第一题的对战
      this.currentIndex = 0;

      if (this.questions.length === 0) {
        logger.error('[PK] 题目为空，无法开始对战');
        uni.showToast({
          title: '题目加载失败',
          icon: 'none'
        });
        return;
      }

      this.simulateOpponentAnswer(0);
      this.questionStartTime = Date.now(); // 记录第一题开始时间
      this.answerTimes = []; // 重置答题时间记录
      this.startQuestionTimer(); // 启动第一题的倒计时
    },
    startQuestionTimer(resetTime = true) {
      // 清除之前的倒计时
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 重置倒计时和红光警告
      if (resetTime || !Number.isFinite(this.timeLeft) || this.timeLeft <= 0) {
        this.timeLeft = 30;
      }
      this.showRedWarning = false;

      // 启动倒计时
      this.questionTimer = setInterval(() => {
        this.timeLeft--;

        // 最后5秒显示红光警告
        if (this.timeLeft <= 5 && this.timeLeft > 0) {
          this.showRedWarning = true;
        } else if (this.timeLeft > 5) {
          this.showRedWarning = false;
        }

        // 时间到了，自动判定错误
        if (this.timeLeft <= 0) {
          this.showRedWarning = false;
          this.handleTimeOut();
        }
      }, 1000);
    },
    handleTimeOut() {
      // 清除倒计时
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 如果已经显示答案，不再处理
      if (this.showAns) {
        return;
      }

      // 自动判定为错误（选择 -1 表示超时）
      this.userChoice = -1;
      this.showAns = true;

      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) {
        logger.warn('Vibrate feedback failed during answer timeout', e);
      }

      // 显示超时提示
      uni.showToast({
        title: '答题超时',
        icon: 'none',
        duration: 1500
      });

      // 1.5秒后进入下一题
      setTimeout(() => {
        this.goToNextQuestion();
      }, 1500);
    },
    goToNextQuestion() {
      this.showAns = false;
      this.userChoice = null;
      this.opponentChoice = null;
      this.opponentAnswered = false;

      if (this.currentIndex < this.questions.length - 1) {
        this.currentIndex++;
        // 开始下一题的机器人答题
        this.simulateOpponentAnswer(this.currentIndex);
        // 记录下一题开始时间
        this.questionStartTime = Date.now();
        // 启动新题目的倒计时
        this.startQuestionTimer();
      } else {
        this.finishGame();
      }
    },
    simulateOpponentAnswer(questionIndex) {
      // 检查游戏状态，如果已经结束则不再答题
      if (questionIndex >= this.questions.length || this.gameState !== 'battle') {
        logger.warn('[PK] 对手答题被跳过:', {
          questionIndex: questionIndex,
          questionsLength: this.questions.length,
          gameState: this.gameState
        });
        return;
      }

      const question = this.questions[questionIndex];
      if (!question) {
        logger.error('[PK] 题目不存在，无法模拟对手答题:', questionIndex);
        return;
      }

      // 规范化正确答案：确保格式为 A/B/C/D
      const correctAnswerRaw = question.answer;
      const correctAnswer = correctAnswerRaw.toString().toUpperCase().charAt(0);
      const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctAnswer);

      // 根据智能对手配置计算答题时间
      let answerTimeBase = 5000; // 默认5秒
      if (this.opponent.speed === 'fast') {
        answerTimeBase = 3000; // 快速：3秒
      } else if (this.opponent.speed === 'slow') {
        answerTimeBase = 7000; // 慢速：7秒
      }
      const answerTime = Math.random() * 2000 + answerTimeBase; // 在基础时间上浮动2秒

      // 使用智能对手配置的正确率
      const accuracy = this.opponent.accuracy || 0.7;
      const willAnswerCorrectly = Math.random() < accuracy;

      const timer = setTimeout(() => {
        // 再次检查游戏状态，防止在答题过程中游戏已结束
        if (this.gameState !== 'battle') {
          logger.warn('[PK] 游戏已结束，取消对手答题:', {
            questionIndex: questionIndex,
            gameState: this.gameState
          });
          return;
        }

        // 对手答题
        this.opponentAnswered = true;

        // 确定对手选择的选项
        if (willAnswerCorrectly && correctIndex >= 0) {
          // 70%概率答对，且答案格式正确
          this.opponentChoice = correctIndex;
        } else if (willAnswerCorrectly && correctIndex < 0) {
          // 70%概率答对，但答案格式不对，随机选一个
          this.opponentChoice = Math.floor(Math.random() * (question.options?.length || 4));
        } else {
          // 30%概率答错（随机选一个错误答案）
          const wrongOptions = [0, 1, 2, 3].filter((i) => i !== correctIndex);
          if (wrongOptions.length > 0) {
            this.opponentChoice = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
          } else {
            // 如果所有选项都是正确答案（异常情况），随机选一个
            this.opponentChoice = Math.floor(Math.random() * (question.options?.length || 4));
          }
        }

        // 判断对手是否正确（直接判断，不依赖 showAns）
        // 因为 isCorrectOption 需要 showAns 为 true，所以这里直接判断
        const isOpponentCorrect = correctIndex >= 0 && this.opponentChoice === correctIndex;

        if (isOpponentCorrect) {
          // 对手答对，增加得分并显示冲刺动画
          this.opponentScore += 20;
          this.opponentRushing = true;
          setTimeout(() => {
            this.opponentRushing = false;
          }, 500);
        } else {
        }

        // 更新对手进度条
        this.opProgress = ((questionIndex + 1) / this.questions.length) * 100;
      }, answerTime);

      this.opponentTimers.push(timer);
    },
    handleSelect(idx) {
      // 立即打印，确保事件触发
      // 检查状态
      if (this.gameState !== 'battle') {
        logger.warn('[PK] 当前不在对战状态，无法答题:', {
          gameState: this.gameState
        });
        return;
      }

      if (this.showAns) {
        return; // 只有在显示答案时才禁止点击，对手答题后仍可继续
      }

      if (!this.currentQuestion || !this.currentQuestion.options || this.currentQuestion.options.length === 0) {
        logger.error('[PK] 题目数据不完整，无法答题:', {
          currentQuestion: this.currentQuestion
        });
        uni.showToast({
          title: '题目加载中，请稍候',
          icon: 'none'
        });
        return;
      }

      // 记录真实答题时间
      if (this.questionStartTime > 0) {
        this.answerTimes.push(Date.now() - this.questionStartTime);
      }

      this.userChoice = idx;
      this.showAns = true;

      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) {
        logger.warn('Vibrate feedback failed during option selection', e);
      }

      // 判断是否正确
      const isCorrect = this.isCorrectOption(idx);
      if (isCorrect) {
        this.myScore += 20;
      } else {
      }

      // 更新我的进度条
      this.myProgress = ((this.currentIndex + 1) / this.questions.length) * 100;

      // 清除倒计时
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 1.5秒后进入下一题
      setTimeout(() => {
        this.goToNextQuestion();
      }, 1500);
    },
    async finishGame() {
      // 立即清理所有定时器（防止对手继续答题）
      this.clearAllTimers();
      // 计算战绩数据（用于分享海报）
      const correctCount = Math.floor(this.myScore / 20);
      this.accuracy = this.questions.length > 0 ? Math.round((correctCount / this.questions.length) * 100) : 0;
      // 使用真实记录的答题时间计算平均值
      if (this.answerTimes.length > 0) {
        const totalTime = this.answerTimes.reduce((sum, t) => sum + t, 0);
        this.averageTime = parseFloat((totalTime / this.answerTimes.length / 1000).toFixed(1)); // 毫秒转秒
      } else {
        this.averageTime = 0;
      }
      // 从实际答对的题目中提取知识点
      this.knowledgePoints = this.questions
        .slice(0, correctCount)
        .map((q) => q.category || '未分类')
        .filter((v, i, a) => a.indexOf(v) === i);

      // 切换到结算状态（必须在清理定时器之后）
      this.gameState = 'result';
      // 调用智谱智能生成针对性战后分析
      await this.fetchAISummary();
      // 自动上传分数到排行榜（结算页显示时触发）
      // 注意：uploadScoreToRank 现在是 async 方法，但不等待结果（静默上传）
      // uploadScoreToRank 内部已有锁机制，防止重复上传
      this.uploadScoreToRank().catch((err) => {
        logger.error('[PK] 上传分数失败（静默）:', err);
        uni.showToast({ title: '排行榜同步失败，请稍后重试', icon: 'none' });
      });

      // 验证结算页状态
      this.$nextTick(() => {
        /* force DOM update after settlement */
      });
    },
    async fetchAISummary() {
      // 设置 Loading 状态
      this.aiSummary = '智能正在分析战局...';
      uni.showLoading({ title: '智能分析中...', mask: false });

      const correctCount = Math.floor(this.myScore / 20);
      const accuracy = this.questions.length > 0 ? Math.round((correctCount / this.questions.length) * 100) : 0;

      const result = this.myScore > this.opponentScore ? '胜利' : this.myScore < this.opponentScore ? '惜败' : '平局';

      logger.log('[pk-battle] 🤖 调用后端代理生成智能战报...');

      try {
        // ✅ 使用后端代理调用（安全）- action: 'pk_summary'
        const response = await lafService.proxyAI('pk_summary', {
          myScore: this.myScore,
          opponentScore: this.opponentScore,
          totalQuestions: this.questions.length,
          accuracy: accuracy,
          result: result,
          opponentName: this.opponent.name
        });

        logger.log('[pk-battle] 📥 后端代理响应:', {
          code: response?.code,
          hasData: !!response?.data
        });

        if (response && response.code === 0 && response.data) {
          let comment = response.data.trim();
          // 清洗可能存在的引号和多余标记
          comment = comment.replace(/["""]/g, '');
          comment = comment.replace(/```json\s*/gi, '');
          comment = comment.replace(/```\s*/g, '');
          this.aiSummary = comment;
          logger.log('[pk-battle] ✅ 智能战报生成成功');
        } else {
          throw new Error('智能响应异常');
        }
      } catch (e) {
        logger.error('[PK] 智能战报生成失败:', e);

        // 检查是否是401未登录错误
        if (e.message && e.message.includes('未登录')) {
          logger.warn('[PK] 智能服务需要登录，使用降级方案');
        }

        // 降级方案：如果智能挂了，随机显示一条本地库
        const fallback =
          result === '胜利'
            ? [
                '胜败乃兵家常事，但这局你赢了！手速和准确率都不错，继续保持！',
                '这手速，阅卷老师都追不上！精准度碾压对手，看来知识点掌握得很扎实。',
                '大获全胜！这波操作我给满分，继续保持这种学习状态！'
              ]
            : result === '惜败'
              ? [
                  '差点就赢了，建议少吃一口饭，多背一个词，下次一定能反超！',
                  '对手很厉害，但你的潜力更大，再多刷几题就能反超。',
                  '虽然惜败，但表现可圈可点。胜败乃兵家常事，大侠请重新来过！'
                ]
              : [
                  '势均力敌！这局平局，下局见分晓。',
                  '实力与运气并存，这波操作我给满分！再来一局决胜负！',
                  '平分秋色！看来双方都很强，不如再战一局？'
                ];
        this.aiSummary = fallback[Math.floor(Math.random() * fallback.length)];
      } finally {
        uni.hideLoading();
      }
    },
    goHome() {
      // 防止重复点击
      if (this.isNavigating) return;
      this.isNavigating = true;

      // 使用 switchTab 跳转到首页（TabBar 页面）
      uni.switchTab({
        url: '/pages/index/index',
        fail: () => {
          uni.showToast({ title: '跳转失败', icon: 'none' });
        },
        complete: () => {
          setTimeout(() => {
            this.isNavigating = false;
          }, 500);
        }
      });
    },
    goToRank() {
      // 防止重复点击
      if (this.isNavigating) return;
      this.isNavigating = true;

      // 跳转到排行榜页面
      safeNavigateTo('/pages/practice-sub/rank', {
        success: () => {
          /* navigation succeeded */
        },
        complete: () => {
          setTimeout(() => {
            this.isNavigating = false;
          }, 500);
        }
      });
    },
    clearAllTimers() {
      // 清除对手答题定时器
      this.opponentTimers.forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      this.opponentTimers = [];
      // 清除题目倒计时
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 清除匹配相关定时器
      if (this.matchingTimer) {
        clearTimeout(this.matchingTimer);
        this.matchingTimer = null;
      }
      if (this.matchingTimeoutTimer) {
        clearTimeout(this.matchingTimeoutTimer);
        this.matchingTimeoutTimer = null;
      }
      this.stopMatchingStatusUpdate();
    },
    resetGame() {
      // 防止重复点击
      if (this.isNavigating) return;
      this.isNavigating = true;

      this.clearAllTimers();
      this.gameState = 'matching';
      this.currentIndex = 0;
      this.myScore = 0;
      this.opponentScore = 0;
      this.myProgress = 0;
      this.opProgress = 0;
      this.opponentFound = false;
      this.opponent = { name: '寻找中...', avatar: '' };
      this.aiSummary = '智能正在分析本场对局...';
      this.userChoice = null;
      this.opponentChoice = null;
      this.opponentAnswered = false;
      this.showAns = false;
      this.opponentRushing = false;
      this.timeLeft = 30;
      this.accuracy = 0;
      this.averageTime = 0;
      this.knowledgePoints = [];
      this.isScoreUploaded = false; // 重置分数上传标志

      // 重新随机抽取题目
      const allQuestions = storageService.get('v30_bank', []);
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      this.questions = shuffled.slice(0, Math.min(5, shuffled.length));

      // 重置防重复点击状态
      setTimeout(() => {
        this.isNavigating = false;
      }, 500);

      this.startMatching();
    },
    handleResultStageClick(_e) {
      // 点击结算页空白区域，不做任何操作（已通过 @tap.stop 阻止冒泡）
      // 如果需要点击空白处返回，可以在这里实现
    },
    handleExitFromResult() {
      // 从结算页退出
      uni.showModal({
        title: '确认退出？',
        content: '退出后将返回首页',
        success: (res) => {
          if (res.confirm) {
            this.clearAllTimers();
            this.goHome();
          }
        }
      });
    },

    // ✅ 处理题库为空弹窗确认
    handleEmptyConfirm() {
      this.showEmptyModal = false;
      safeNavigateTo('/pages/practice-sub/import-data');
    },

    // 检查点4.2: 好友PK邀请 - 生成分享PK链接
    async generateSharePkLink() {
      const userId = storageService.get('EXAM_USER_ID', '');

      // 生成房间ID
      this.sharePkRoomId = `pk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // 生成邀请码
      this.sharePkInviteCode = generateInviteCode({
        roomId: this.sharePkRoomId,
        userId: userId
      });

      // 生成深度链接
      this.sharePkDeepLink = await createInviteDeepLink({
        type: 'pk',
        roomId: this.sharePkRoomId,
        inviteCode: this.sharePkInviteCode,
        inviterId: userId,
        subject: '综合题库',
        questionCount: this.questions.length || 5
      });

      logger.log('[PK-Share] 生成PK分享链接:', {
        roomId: this.sharePkRoomId,
        inviteCode: this.sharePkInviteCode,
        deepLink: this.sharePkDeepLink
      });

      return {
        roomId: this.sharePkRoomId,
        inviteCode: this.sharePkInviteCode,
        deepLink: this.sharePkDeepLink
      };
    },

    // 检查点4.2: 好友PK邀请 - 分享PK对战
    async sharePkBattle() {
      try {
        // 生成分享链接
        const shareInfo = await this.generateSharePkLink();

        // 获取分享配置
        const shareConfig = generateShareConfig({
          type: 'pk',
          roomId: shareInfo.roomId,
          inviteCode: shareInfo.inviteCode,
          inviterName: this.userInfo.nickName || '考研人',
          subject: '综合题库',
          questionCount: this.questions.length || 5
        });

        logger.log('[PK-Share] 分享配置:', shareConfig);

        // #ifdef MP-WEIXIN
        // 小程序环境使用分享API
        uni.showShareMenu({
          withShareTicket: true,
          menus: ['shareAppMessage', 'shareTimeline']
        });
        // #endif

        // #ifdef H5 || APP-PLUS
        // H5/APP环境复制链接
        uni.setClipboardData({
          data: shareInfo.deepLink,
          success: () => {
            uni.showToast({
              title: 'PK链接已复制，快去分享给好友吧！',
              icon: 'none',
              duration: 2000
            });
          }
        });
        // #endif
      } catch (error) {
        logger.error('[PK-Share] 分享失败:', error);
        uni.showToast({
          title: '分享失败，请稍后重试',
          icon: 'none'
        });
      }
    },

    // 生成海报并上传分数 - 全新设计理念：知识的碰撞与荣耀时刻
    async handleShare() {
      // 防止重复点击
      if (this.isGeneratingShare) {
        return;
      }

      this.isGeneratingShare = true;
      // 使用 mask: true 禁用 Loading 期间的交互
      uni.showLoading({
        title: '生成战报中...',
        mask: true // 禁用交互，防止点击退出
      });

      // 设置超时处理，避免无限等待
      const timeoutTimer = setTimeout(() => {
        if (this.isGeneratingShare) {
          logger.error('[PK] 生成战报超时');
          uni.hideLoading();
          this.isGeneratingShare = false;
          uni.showToast({
            title: '生成战报超时，请稍后重试',
            icon: 'none',
            duration: 2000
          });
        }
      }, 10000); // 10秒超时

      try {
        // A. 自动静默上传分数到排行榜（数据闭环）
        // uploadScoreToRank 内部已有锁机制，防止重复上传
        this.uploadScoreToRank().catch((err) => {
          logger.error('[PK] 分享时上传分数失败:', err);
          // 静默失败，不打断分享流程
        });

        // B. 开始 Canvas 绘图 - 全新设计理念
        const ctx = uni.createCanvasContext('shareCanvas', this);
        const W = 375; // 画布宽
        const H = 600; // 画布高（增加高度以容纳更多内容）

        const isVictory = this.myScore >= this.opponentScore;

        // ========== 胜利版海报设计 ==========
        if (isVictory) {
          // -- 1. 背景 - 皇家蓝与紫罗兰极光渐变 --
          const gradient = ctx.createLinearGradient(0, 0, W, H);
          gradient.addColorStop(0, '#1E3A8A'); // 皇家蓝
          gradient.addColorStop(0.5, '#7C3AED'); // 紫罗兰
          gradient.addColorStop(1, '#1E3A8A');
          ctx.setFillStyle(gradient);
          ctx.fillRect(0, 0, W, H);

          // 金色流光点缀
          ctx.setFillStyle('rgba(255, 215, 0, 0.2)');
          ctx.fillRect(0, 0, W, 4);

          // -- 2. 头部：荣耀宣告 --
          ctx.setFontSize(32);
          ctx.setFillStyle('#FFD700'); // 金色
          ctx.setTextAlign('center');
          ctx.fillText('PK 胜利！', W / 2, 60);

          ctx.setFontSize(14);
          ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
          ctx.fillText('在知识巅峰对决中胜出！', W / 2, 85);

          // -- 3. 核心对决区（非对称设计）--
          // 左侧（赢家 - 自身视角）
          // 头像框（带金色月桂叶特效）
          ctx.setFillStyle('rgba(255, 215, 0, 0.3)');
          ctx.beginPath();
          ctx.arc(100, 150, 50, 0, Math.PI * 2);
          ctx.fill();

          ctx.setFontSize(18);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText(this.userInfo.nickName || '考研人', 100, 220);

          // 核心比分 - 巨大发光数字
          ctx.setFontSize(80);
          ctx.setFillStyle('#FFD700');
          ctx.fillText(this.myScore.toString(), 100, 280);

          ctx.setFontSize(12);
          ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
          ctx.fillText('本局得分', 100, 300);

          // 中间 VS 闪电符号
          ctx.setFontSize(24);
          ctx.setFillStyle('#FFD700');
          ctx.fillText('⚡', W / 2, 200);

          // 右侧（对手）
          ctx.setFillStyle('rgba(255, 255, 255, 0.2)');
          ctx.beginPath();
          ctx.arc(275, 150, 40, 0, Math.PI * 2);
          ctx.fill();

          ctx.setFontSize(14);
          ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
          ctx.fillText(this.opponent.name, 275, 220);

          ctx.setFontSize(48);
          ctx.setFillStyle('rgba(255, 255, 255, 0.5)');
          ctx.fillText(this.opponentScore.toString(), 275, 260);

          // -- 4. 战绩深度分析区（三个卡片）--
          const cardY = 350;
          const cardWidth = (W - 60) / 3;

          // 卡片1：精准度
          ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
          ctx.fillRect(20, cardY, cardWidth - 10, 100);
          ctx.setFontSize(20);
          ctx.setFillStyle('#FFD700');
          ctx.fillText('🎯', 20 + (cardWidth - 10) / 2, cardY + 30);
          ctx.setFontSize(16);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText(`${this.accuracy}%`, 20 + (cardWidth - 10) / 2, cardY + 55);
          ctx.setFontSize(11);
          ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
          ctx.fillText('精准度', 20 + (cardWidth - 10) / 2, cardY + 75);

          // 卡片2：速度压制
          ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
          ctx.fillRect(20 + cardWidth, cardY, cardWidth - 10, 100);
          ctx.setFontSize(20);
          ctx.setFillStyle('#FFD700');
          ctx.fillText('⚡', 20 + cardWidth + (cardWidth - 10) / 2, cardY + 30);
          ctx.setFontSize(16);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText(`${this.averageTime.toFixed(1)}s`, 20 + cardWidth + (cardWidth - 10) / 2, cardY + 55);
          ctx.setFontSize(11);
          ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
          ctx.fillText('快如闪电', 20 + cardWidth + (cardWidth - 10) / 2, cardY + 75);

          // 卡片3：知识点覆盖
          ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
          ctx.fillRect(20 + cardWidth * 2, cardY, cardWidth - 10, 100);
          ctx.setFontSize(20);
          ctx.setFillStyle('#FFD700');
          ctx.fillText('📚', 20 + cardWidth * 2 + (cardWidth - 10) / 2, cardY + 30);
          ctx.setFontSize(16);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText(`${this.knowledgePoints.length}`, 20 + cardWidth * 2 + (cardWidth - 10) / 2, cardY + 55);
          ctx.setFontSize(11);
          ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
          ctx.fillText('知识点', 20 + cardWidth * 2 + (cardWidth - 10) / 2, cardY + 75);

          // -- 5. 底部：激励文案 --
          ctx.setFontSize(14);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText('保持状态，下一个状元就是你！', W / 2, 520);

          ctx.setFontSize(11);
          ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
          ctx.fillText('Exam Master - 考研刷题助手', W / 2, 550);
        } else {
          // ========== 失败版海报设计 ==========
          // -- 1. 背景 - 静谧蓝与青色渐变 --
          const gradient = ctx.createLinearGradient(0, 0, W, H);
          gradient.addColorStop(0, '#0EA5E9'); // 静谧蓝
          gradient.addColorStop(0.5, '#06B6D4'); // 青色
          gradient.addColorStop(1, '#0EA5E9');
          ctx.setFillStyle(gradient);
          ctx.fillRect(0, 0, W, H);

          // 暖橙色点缀（鼓励、希望）
          ctx.setFillStyle('rgba(255, 165, 0, 0.15)');
          ctx.fillRect(0, 0, W, 4);

          // -- 2. 头部：鼓励标题 --
          ctx.setFontSize(28);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.setTextAlign('center');
          ctx.fillText('惜败！差一点点就赢了', W / 2, 60);

          // -- 3. 核心对决区 --
          ctx.setFontSize(64);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText(this.myScore.toString(), W / 2, 180);

          ctx.setFontSize(14);
          ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
          ctx.fillText('VS', W / 2, 220);

          ctx.setFontSize(48);
          ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
          ctx.fillText(this.opponentScore.toString(), W / 2, 260);

          // -- 4. 本局进步点 --
          ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
          ctx.fillRect(30, 300, W - 60, 80);

          ctx.setFontSize(14);
          ctx.setFillStyle('#FFA500'); // 暖橙色
          ctx.fillText('本局进步点', W / 2, 330);

          ctx.setFontSize(12);
          ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
          ctx.fillText('虽然输了，但你的历史类题目全对！', W / 2, 360);

          // -- 5. 差距分析 --
          ctx.setFontSize(12);
          ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
          ctx.fillText('对手比你快了0.5秒', W / 2, 420);
          ctx.fillText('引导用户去提升速度', W / 2, 440);

          // -- 6. 底部：鼓励文案 --
          ctx.setFontSize(14);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText('不服！再战一局', W / 2, 520);

          ctx.setFontSize(11);
          ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
          ctx.fillText('Exam Master - 考研刷题助手', W / 2, 550);
        }

        // C. 渲染并导出图片
        ctx.draw(false, () => {
          setTimeout(() => {
            // 延时确保绘制完成
            clearTimeout(timeoutTimer); // 清除超时定时器

            uni.canvasToTempFilePath(
              {
                canvasId: 'shareCanvas',
                width: W,
                height: H,
                destWidth: W * 3, // 3倍超清
                destHeight: H * 3,
                success: (res) => {
                  uni.hideLoading();
                  this.isGeneratingShare = false;
                  // 全屏预览海报
                  uni.previewImage({
                    urls: [res.tempFilePath],
                    fail: () => {
                      uni.showToast({ title: '预览失败', icon: 'none' });
                    }
                  });
                },
                fail: (err) => {
                  logger.error('[PK] 绘图失败', err);
                  uni.hideLoading();
                  this.isGeneratingShare = false;
                  uni.showToast({ title: '绘图失败，请稍后重试', icon: 'none' });
                }
              },
              this
            );
          }, 1000); // 增加延时，确保绘制完成
        });
      } catch (error) {
        // 捕获所有错误，确保关闭 Loading
        logger.error('[PK] 生成战报异常:', error);
        clearTimeout(timeoutTimer);
        uni.hideLoading();
        this.isGeneratingShare = false;
        uni.showToast({
          title: '生成战报失败，请稍后重试',
          icon: 'none',
          duration: 2000
        });
      }
    },

    // 辅助方法：上传分数到排行榜
    async uploadScoreToRank() {
      // 🔒 锁机制：防止重复上传
      if (this.isScoreUploaded) {
        return;
      }
      // 立即设置标志位，防止并发调用
      this.isScoreUploaded = true;

      // 优先使用 EXAM_USER_ID（与登录系统一致）
      const userId = storageService.get('EXAM_USER_ID', '');
      const userInfo = storageService.get('userInfo', {});

      // 如果没登录，就不传了
      if (!userId && !userInfo.nickName) {
        logger.warn('[PK] 用户未登录，跳过上传分数');
        logger.warn('[PK] 用户未登录，跳过上传分数');
        return;
      }

      // 确保所有必要字段都有值（提供默认值）
      const nickName = userInfo.nickName || userInfo.name || '考研人';
      const avatarUrl = userInfo.avatarUrl || userInfo.avatar || this.defaultAvatar;
      const finalUserId = userId || userInfo.uid || `temp_${Date.now()}`;

      // 发送本局增量分数，后端 _.inc(score) 自动累加
      const pkScore = this.myScore;

      // 修复：action 应为 'update'（后端 handler map 只有 update/get/getUserRank）
      // 修复：发送本局增量分数（pkScore），后端用 _.inc() 累加，不再发累计总分
      const uploadData = {
        action: 'update',
        uid: finalUserId,
        userId: finalUserId,
        nickName: nickName,
        avatarUrl: avatarUrl,
        score: pkScore // 本局增量分数，后端 _.inc(score) 累加
      };

      // 已迁移到 Sealos：使用 lafService.rankCenter 替代 uniCloud.callFunction('rank-center')
      // 静默上传，不显示 loading（避免打断用户体验）
      lafService
        .rankCenter(uploadData)
        .then((_res) => {
          // 标志位已在方法开头设置，这里只记录成功日志
          // 可选：静默提示
          // uni.showToast({ title: '已上传排行榜', icon: 'success', duration: 1000 });
        })
        .catch((err) => {
          // 🔒 修复 Module 10 Bug: 采用 "Fire and Forget" 策略
          // 上传失败时，不重置标志位，防止重复上传
          // 原因：网络超时可能导致数据已写入但响应失败，重试会造成重复上传
          logger.error('[PK] 上传分数失败（已锁定，不再重试）:', err);
          // 静默失败，不影响用户分享体验
        });
    },
    handleExit() {
      uni.showModal({
        title: '确认退出？',
        content: '退出后将丢失当前匹配进度',
        success: (res) => {
          if (res.confirm) {
            this.clearAllTimers();
            uni.navigateBack();
          }
        }
      });
    },
    handleQuit() {
      uni.showModal({
        title: '退出对战',
        content: '中途退出将视为放弃本局，确定吗？',
        confirmColor: '#FF3B30',
        success: (res) => {
          if (res.confirm) {
            this.clearAllTimers();
            // 返回首页（TabBar 页面）
            uni.switchTab({
              url: '/pages/index/index',
              fail: () => {
                uni.navigateBack();
              }
            });
          }
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
/* iOS 风格全局容器 */
.container {
  min-height: 100vh;
  background-color: var(--text-primary);
  background-image: linear-gradient(180deg, var(--bg-tertiary) 0%, var(--text-primary) 100%);
  color: var(--text-inverse);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  position: relative;
}
.container.dark-mode {
  background: var(--bg-body);
}

/* 极光背景 */
.aurora-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 10% 10%, var(--brand-light-alpha), transparent 40%),
    radial-gradient(circle at 90% 90%, var(--danger-red-alpha), transparent 40%);
  z-index: 0;
  animation: auroraShift 8s ease-in-out infinite;
  pointer-events: none; /* 确保背景不拦截点击事件 */
}

@keyframes auroraShift {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* 雷达扫描动画 */
.radar-scanner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400rpx;
  height: 400rpx;
  z-index: 1;
}

.radar-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 2rpx solid var(--brand-light-alpha);
  border-radius: 50%;
}

.radar-circle.radar-1 {
  width: 300rpx;
  height: 300rpx;
  animation: radarPulse 2s infinite;
}

.radar-circle.radar-2 {
  width: 350rpx;
  height: 350rpx;
  animation: radarPulse 2s infinite 0.3s;
}

.radar-circle.radar-3 {
  width: 400rpx;
  height: 400rpx;
  animation: radarPulse 2s infinite 0.6s;
}

.radar-line {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, var(--brand-light), transparent);
  transform-origin: left center;
  animation: radarRotate 2s linear infinite;
}

@keyframes radarPulse {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

@keyframes radarRotate {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

/* 匹配阶段 */
.matching-stage {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  position: relative;
  padding-top: calc(constant(safe-area-inset-top) + 60px); /* 增加顶部间距，避免头像与刘海屏重叠 */
  padding-top: calc(env(safe-area-inset-top, 0px) + 60px); /* 增加顶部间距，避免头像与刘海屏重叠 */
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-sizing: border-box;
}
.match-core {
  display: flex;
  align-items: center;
  gap: 40rpx;
  margin-bottom: 60rpx;
  position: relative;
  z-index: 2;
}
.avatar-ring {
  width: 180rpx;
  height: 180rpx;
  border-radius: 90rpx;
  border: 4rpx solid var(--brand-light);
  padding: 10rpx;
  background: var(--bg-overlay);
  position: relative;
  backdrop-filter: blur(10px);
}
.user-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}
.vs-text {
  font-size: 60rpx;
  font-weight: 900;
  font-style: italic;
  color: var(--text-inverse);
  text-shadow: 0 0 20rpx var(--brand-light-alpha);
}
.opponent-ring {
  border-color: var(--text-tertiary);
}
.opponent-ring.found {
  border-color: var(--danger-red);
  animation: foundPulse 0.5s ease-out;
}
.search-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-overlay);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.search-icon {
  font-size: 60rpx;
  opacity: 0.6;
  animation: pulse 1.5s infinite;
}
.match-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  position: relative;
  z-index: 2;
}
.status-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--text-inverse);
}
.status-tip {
  font-size: 24rpx;
  color: var(--text-inverse-secondary);
}
.exit-btn {
  margin-top: 60rpx;
  padding: 20rpx 60rpx;
  background: var(--bg-card-alpha);
  border-radius: 50rpx;
  font-size: 28rpx;
  color: var(--text-inverse);
  border: 1rpx solid var(--border-light-alpha);
  position: relative;
  z-index: 2;
}

/* 全局：深空黑 */
.pk-container {
  min-height: 100vh;
  background: radial-gradient(circle at center top, var(--bg-tertiary) 0%, var(--text-primary) 100%);
  padding: 0 24px;
  padding-top: calc(constant(safe-area-inset-top) + 30px); /* 增加顶部间距，整体下移，避免与胶囊按钮重叠 */
  padding-top: calc(env(safe-area-inset-top, 0px) + 30px); /* 增加顶部间距，整体下移，避免与胶囊按钮重叠 */
  padding-bottom: constant(safe-area-inset-bottom); /* 底部安全区域 */
  padding-bottom: env(safe-area-inset-bottom, 0px); /* 底部安全区域 */
  color: var(--text-inverse);
  position: relative;
  z-index: 1; /* 确保在对战阶段时，pk-container 在 aurora-bg 之上 */
  box-sizing: border-box;
}

/* 顶部栏 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px; /* 减少底部间距，整体下移 */
  margin-top: 10px; /* 增加顶部间距 */
}

.icon-btn {
  width: 36px;
  height: 36px;
  background: var(--bg-card-alpha);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
}

.icon-btn:active {
  background: var(--bg-hover-alpha);
  transform: scale(0.95);
}

.icon-btn.ghost {
  opacity: 0;
}

.round-badge {
  background: var(--bg-overlay);
  border: 1px solid var(--border-light-alpha);
  padding: 4px 14px;
  border-radius: 100px;
  font-size: 26rpx;
  color: var(--text-tertiary);
  font-weight: 600;
}

/* 战场区 */
.battle-stage {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  margin-top: 20px; /* 与顶部栏保持间距，避免与胶囊按钮重叠 */
}

.player-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 80px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--border-light-alpha);
  margin-bottom: 8px;
  box-shadow: 0 8px 16px var(--shadow-lg);
}

.score {
  font-size: 56rpx;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 6px;
}

.score.me {
  color: var(--brand-light);
  text-shadow: 0 0 10px var(--brand-light-alpha);
}

.score.opp {
  color: var(--danger-red);
  text-shadow: 0 0 10px var(--danger-red-alpha);
}

.progress-track {
  width: 100%;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 2px;
}

.progress-fill.me {
  background: var(--brand-light);
}

.progress-fill.opp {
  background: var(--danger-red);
}

.progress-fill.opp.rush {
  animation: barRush 0.5s ease-out;
}

@keyframes barRush {
  0% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(1.05);
  }
  100% {
    transform: scaleX(1);
  }
}

.vs-text {
  font-style: italic;
  font-weight: 900;
  font-size: 48rpx;
  color: var(--text-tertiary);
}

/* 题目卡片 */
.question-card {
  background: var(--bg-card-alpha);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 24px;
  min-height: 100px;
  margin-bottom: 24px;
  border: 1px solid var(--border-light-alpha);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tag {
  display: inline-block;
  background: var(--info-blue);
  font-size: 20rpx;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  color: var(--text-inverse);
}

.timer-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--success-green-alpha);
  border: 1px solid var(--success-green);
  border-radius: 12px;
  padding: 4px 12px;
  min-width: 50px;
  transition: all 0.3s;
}

.timer-badge.warning {
  background: var(--warning-yellow-alpha);
  border-color: var(--warning-yellow);
  animation: pulse-warning 1s infinite;
}

.timer-badge.danger {
  background: var(--danger-red-alpha);
  border-color: var(--danger-red);
  animation: pulse-danger 0.5s infinite;
}

.timer-text {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--success-green);
}

.timer-badge.warning .timer-text {
  color: var(--warning-yellow);
}

.timer-badge.danger .timer-text {
  color: var(--danger-red);
}

@keyframes pulse-warning {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes pulse-danger {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.q-text {
  font-size: 34rpx;
  line-height: 1.5;
  font-weight: 500;
  color: var(--text-inverse);
}

/* 选项列表 */
.options-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: calc(constant(safe-area-inset-bottom) + 20px); /* 底部安全区域 + 额外间距 */
  padding-bottom: calc(env(safe-area-inset-bottom) + 20px); /* 底部安全区域 + 额外间距 */
  margin-bottom: 20px;
}

.opt-btn {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  width: 100%;
  position: relative;
  z-index: 10;
  -webkit-tap-highlight-color: transparent;
}

.opt-btn::after {
  border: none;
}

.opt-btn-inner {
  background: var(--bg-card-dark);
  padding: 16px 20px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  border: 1px solid transparent;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.opt-btn:active .opt-btn-inner {
  transform: scale(0.98);
  background: var(--bg-hover);
}

.opt-btn.disabled {
  pointer-events: none;
  opacity: 0.6;
}

.letter {
  width: 28px;
  height: 28px;
  background: var(--bg-hover);
  border-radius: 50%;
  text-align: center;
  line-height: 28px;
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-tertiary);
  margin-right: 14px;
  flex-shrink: 0;
}

.content {
  font-size: 32rpx;
  color: var(--text-inverse);
  flex: 1;
}

.opt-icon {
  font-size: 36rpx;
  font-weight: bold;
  margin-left: 8px;
  flex-shrink: 0;
}

/* 状态色 */
.opt-btn.selected .opt-btn-inner {
  border-color: var(--info-blue);
  background: var(--bg-info-light);
}

.opt-btn.selected .letter {
  background: var(--info-blue);
  color: var(--text-inverse);
}

.opt-btn.correct .opt-btn-inner {
  border-color: var(--success-green);
  background: var(--bg-success-light);
}

.opt-btn.wrong .opt-btn-inner {
  border-color: var(--danger-red);
  background: var(--bg-danger-light);
}

.opt-btn.correct {
  border-color: var(--success-green);
  background: var(--bg-success-light);
}

.opt-btn.correct .letter {
  background: var(--success-green);
  color: var(--text-inverse);
}

.opt-btn.correct .opt-icon {
  color: var(--success-green);
}

.opt-btn.wrong {
  border-color: var(--danger-red);
  background: var(--bg-danger-light);
}

.opt-btn.wrong .letter {
  background: var(--danger-red);
  color: var(--text-inverse);
}

.opt-btn.wrong .opt-icon {
  color: var(--danger-red);
}

.opponent-status {
  text-align: center;
  padding: 20px;
  margin: 20px 0;
  margin-bottom: calc(constant(safe-area-inset-bottom) + 40px); /* 再次上移，增加与底部按钮的间距 */
  margin-bottom: calc(env(safe-area-inset-bottom, 0px) + 40px); /* 再次上移，增加与底部按钮的间距 */
}

.opponent-tip {
  color: rgba(255, 255, 255, 0.6);
  font-size: 28rpx;
}

.footer-placeholder {
  height: 100rpx;
}

/* 结算 - 绿色主题，高级质感 */
.result-stage {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 10;
  background: linear-gradient(135deg, var(--bg-body) 0%, #0f2400 50%, var(--bg-body) 100%);
  background-size: 200% 200%;
  animation: gradientShift 8s ease infinite;
}
@keyframes gradientShift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
.result-glass {
  width: 100%;
  padding: 60rpx 40rpx;
  text-align: center;
  background: rgba(22, 51, 0, 0.85);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-radius: 32rpx;
  border: 1px solid rgba(159, 232, 112, 0.2);
  box-shadow:
    0 20rpx 60rpx rgba(0, 0, 0, 0.3),
    0 0 40rpx rgba(159, 232, 112, 0.1);
}
.result-header {
  margin-bottom: 40rpx;
}
.result-icon {
  font-size: 120rpx;
  margin-bottom: 20rpx;
  animation: resultBounce 0.5s ease-out;
}
@keyframes resultBounce {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}
.result-title {
  font-size: 80rpx;
  font-weight: 900;
  display: block;
  margin-bottom: 10rpx;
  letter-spacing: 4rpx;
}
.result-title.victory {
  color: var(--brand-color); /* Wise 绿色 */
  text-shadow:
    0 0 30rpx rgba(159, 232, 112, 0.6),
    0 0 60rpx rgba(159, 232, 112, 0.3);
}
.result-title.defeat {
  color: #ff6b6b; /* 柔和的红色 */
  text-shadow: 0 0 30rpx rgba(255, 107, 107, 0.5);
}
.result-subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.7);
  display: block;
}
/* 智能战报分析卡片样式 - 绿色主题，高级质感 */
.ai-report-box {
  margin: 40rpx 0;
  padding: 30rpx;
  background: rgba(159, 232, 112, 0.08); /* Wise 绿色微透明 */
  border-radius: 24rpx;
  border: 1px solid rgba(159, 232, 112, 0.25);
  width: 100%;
  box-sizing: border-box;
  animation: fadeIn 0.5s ease;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.ai-report-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(159, 232, 112, 0.15), transparent);
  will-change: transform;
  animation: shine 3s infinite;
}

@keyframes shine {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(200%);
  }
}

.ai-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  position: relative;
  z-index: 1;
}

.ai-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.ai-title {
  color: var(--brand-color); /* Wise 绿色 */
  font-size: 28rpx;
  font-weight: bold;
  text-shadow: 0 0 10rpx rgba(159, 232, 112, 0.5);
}

.ai-text {
  color: #ffffff;
  font-size: 28rpx;
  line-height: 1.8;
  text-align: left;
  display: block;
  white-space: pre-wrap;
  position: relative;
  z-index: 1;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  min-height: 60rpx;
}

/* 兼容原有的 ai-summary 样式 */
.ai-summary {
  background: rgba(255, 255, 255, 0.05);
  padding: 30rpx;
  border-radius: 20rpx;
  margin: 40rpx 0;
  text-align: left;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}
.ai-summary .tag {
  display: inline-block;
  background: #00e5ff;
  color: #000;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  margin-bottom: 10rpx;
  font-weight: bold;
}
.summary-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  display: block;
  white-space: pre-wrap;
}

.action-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-top: 40rpx;
}
.btn-share {
  flex: 1;
  min-width: calc(50% - 10rpx);
  background: rgba(159, 232, 112, 0.15);
  border-radius: 16rpx;
  font-size: 28rpx;
  border: 1px solid rgba(159, 232, 112, 0.3);
  color: var(--brand-color);
  padding: 20rpx 0;
  font-weight: 600;
  transition: all 0.3s ease;
}
.btn-share:active {
  background: rgba(159, 232, 112, 0.25);
  transform: scale(0.98);
}
.btn-share::after {
  border: none;
}
.btn-again {
  flex: 1;
  min-width: calc(50% - 10rpx);
  background: linear-gradient(135deg, var(--brand-color), #7ed321);
  color: #1a1a1a;
  border-radius: 16rpx;
  font-size: 28rpx;
  border: none;
  padding: 20rpx 0;
  font-weight: bold;
  box-shadow: 0 4rpx 12rpx rgba(159, 232, 112, 0.3);
  transition: all 0.3s ease;
}
.btn-again:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(159, 232, 112, 0.2);
}
.btn-again::after {
  border: none;
}
.btn-rank {
  flex: 1;
  min-width: calc(50% - 10rpx);
  background: linear-gradient(135deg, #ffd700, #ffa500);
  color: #1a1a1a;
  border-radius: 16rpx;
  font-size: 28rpx;
  border: none;
  padding: 20rpx 0;
  font-weight: bold;
  box-shadow: 0 4rpx 12rpx rgba(255, 215, 0, 0.3);
  transition: all 0.3s ease;
}
.btn-rank:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(255, 215, 0, 0.2);
}
.btn-rank::after {
  border: none;
}
.btn-home {
  flex: 1;
  min-width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16rpx;
  font-size: 28rpx;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
  padding: 20rpx 0;
  font-weight: 500;
  transition: all 0.3s ease;
}
.btn-home:active {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(0.98);
}
.btn-home::after {
  border: none;
}
.btn-exit {
  flex: 1;
  min-width: 100%;
  background: rgba(255, 107, 107, 0.15);
  border-radius: 16rpx;
  font-size: 28rpx;
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
  padding: 20rpx 0;
  margin-top: 20rpx;
  font-weight: 500;
  transition: all 0.3s ease;
}
.btn-exit:active {
  background: rgba(255, 107, 107, 0.25);
  transform: scale(0.98);
}
.btn-exit::after {
  border: none;
}

/* 动画 */
@keyframes pulse {
  0% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.3;
  }
}
.pulse {
  animation: pulse 2s infinite;
}
@keyframes foundPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 20rpx rgba(255, 60, 60, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 60, 60, 0);
  }
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 红光警告遮罩（最后5秒）- 参考苹果智能呼吸感 */
.red-warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 0, 0, 0.4);
  z-index: 9998;
  pointer-events: none;
  animation: redWarningBreath 1.5s ease-in-out infinite;
}

@keyframes redWarningBreath {
  0% {
    opacity: 0.15;
    background: rgba(255, 0, 0, 0.15);
    filter: blur(0px);
  }
  50% {
    opacity: 0.6;
    background: rgba(255, 0, 0, 0.6);
    filter: blur(2px);
  }
  100% {
    opacity: 0.15;
    background: rgba(255, 0, 0, 0.15);
    filter: blur(0px);
  }
}
</style>
