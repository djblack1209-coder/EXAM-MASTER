/**
 * PK 匹配流程 Mixin
 *
 * 职责：匹配发起、真人匹配、bot降级、匹配状态轮播、匹配超时处理、退出匹配
 * 使用方式：在 pk-battle.vue 中通过 mixins: [pkMatchingMixin] 合并
 *
 * @module composables/usePKMatching
 */
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import config from '@/config/index.js';
import storageService from '@/services/storageService.js';
import { usePKRoom } from './usePKRoom.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { safeNavigateBack } from '@/utils/safe-navigate';

export const pkMatchingMixin = {
  data() {
    return {
      // 对手信息
      opponent: { name: '寻找中...', avatar: '', level: '' },
      opponentFound: false,
      // 匹配定时器
      matchingTimer: null,
      matchingTimeoutTimer: null,
      matchingStatusTimer: null,
      matchingStartTime: 0,
      matchingTimeout: 30000, // 匹配超时时间（30秒）
      matchingStatusText: '正在寻找实力相当的研友...',
      // 智能对手库（从后端获取，本地作为降级方案）
      botList: [],
      botsLoaded: false,
      // Phase 3-2: 实时PK房间
      pkRoom: null,
      isRealMatch: false,
      realMatchPollWatcher: null
    };
  },

  methods: {
    /**
     * 从后端加载智能对手配置
     * 当前版本直接使用本地默认配置
     */
    async loadBotConfig() {
      // 直接使用本地默认配置（后端 pk-battle.ts 无 get_bot_config action）
      this.botList = this.getDefaultBotConfig();
      this.botsLoaded = true;
    },

    /**
     * 获取默认智能对手配置
     * 基于用户当前分数动态生成匹配难度
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
          accuracy: 0.85,
          speed: 'fast'
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

    /**
     * 开始匹配流程
     * 先确保 bot 配置就绪，然后尝试真人匹配
     */
    startMatching() {
      // 确保智能对手配置已加载（作为降级方案）
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

      // Phase 3-2: 尝试真人匹配
      this.tryRealMatch();
    },

    /**
     * Phase 3-2: 尝试真人实时匹配，超时降级为 bot
     */
    async tryRealMatch() {
      try {
        // 初始化 PKRoom composable（Options API 中手动调用）
        if (!this.pkRoom) {
          this.pkRoom = usePKRoom();
        }

        const category = this.questions?.[0]?.category || '综合';
        const matched = await this.pkRoom.findMatch(category, this.questions.length || 5);

        if (!matched) {
          logger.warn('[PK] 真人匹配请求失败，降级为 bot');
          this.fallbackToBot();
          return;
        }

        // 开始监听房间状态变化
        this.watchRoomStatus();
      } catch (e) {
        logger.warn('[PK] 真人匹配异常，降级为 bot:', e);
        this.fallbackToBot();
      }
    },

    /**
     * Phase 3-2: 监听房间状态，处理匹配成功/超时
     * 每 500ms 轮询一次 pkRoom 状态
     */
    watchRoomStatus() {
      if (this.realMatchPollWatcher) clearInterval(this.realMatchPollWatcher);

      this.realMatchPollWatcher = setInterval(() => {
        if (!this.pkRoom) return;

        const status = this.pkRoom.roomStatus.value;

        if (status === 'ready' || status === 'playing') {
          // 匹配成功！切换为真人对战模式
          clearInterval(this.realMatchPollWatcher);
          this.realMatchPollWatcher = null;
          this.stopMatchingStatusUpdate();
          this.isRealMatch = true;

          const op = this.pkRoom.opponent.value;
          this.opponent = {
            name: op?.name || '研友',
            avatar: op?.avatar || this.defaultAvatar,
            level: '',
            isBot: false,
            accuracy: 0.7,
            speed: 'normal'
          };
          this.opponentFound = true;
          this.matchingStatusText = '匹配成功！真人对战即将开始...';

          // 使用房间题目替换本地题目
          if (this.pkRoom.questions.value && this.pkRoom.questions.value.length > 0) {
            this.questions = this.pkRoom.questions.value;
          }

          try {
            if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
          } catch (_e) {
            /* silent */
          }

          setTimeout(() => {
            this.gameState = 'battle';
            this.startRealBattle();
          }, 1000);
        } else if (status === 'timeout' || status === 'expired') {
          // 匹配超时，降级为 bot
          clearInterval(this.realMatchPollWatcher);
          this.realMatchPollWatcher = null;
          logger.log('[PK] 真人匹配超时，降级为 bot');
          this.fallbackToBot();
        }
      }, 500);

      // 30 秒硬超时保底
      setTimeout(() => {
        if (this.realMatchPollWatcher) {
          clearInterval(this.realMatchPollWatcher);
          this.realMatchPollWatcher = null;
          if (!this.isRealMatch && !this.opponentFound) {
            this.fallbackToBot();
          }
        }
      }, this.matchingTimeout);
    },

    /**
     * Phase 3-2: 降级为 bot 对战
     * 当真人匹配失败或超时时调用
     */
    fallbackToBot() {
      this.isRealMatch = false;
      if (this.pkRoom) {
        this.pkRoom.leaveRoom();
        this.pkRoom = null;
      }

      // 原有 bot 匹配逻辑
      const matchDelay = Math.random() * 1500 + 1500;
      this.matchingTimer = setTimeout(() => {
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
        this.matchingStatusText = '匹配成功！正在建立连接...';
        this.stopMatchingStatusUpdate();

        try {
          if (typeof uni.vibrateShort === 'function') uni.vibrateShort();
        } catch (_e) {
          /* silent */
        }

        setTimeout(() => {
          this.gameState = 'battle';
          this.startBattle();
        }, 1000);
      }, matchDelay);

      // 超时处理
      this.matchingTimeoutTimer = setTimeout(() => {
        if (!this.opponentFound) {
          this.stopMatchingStatusUpdate();
          this.handleMatchingTimeout();
        }
      }, this.matchingTimeout);
    },

    /**
     * 启动匹配状态文字轮播
     * 每2秒切换一条提示，并显示剩余等待时间
     */
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

    /**
     * 停止匹配状态文字轮播
     */
    stopMatchingStatusUpdate() {
      if (this.matchingStatusTimer) {
        clearInterval(this.matchingStatusTimer);
        this.matchingStatusTimer = null;
      }
    },

    /**
     * 匹配超时处理
     * 超时后自动匹配一个智能对手，1.5秒后进入对战
     */
    handleMatchingTimeout() {
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

      toast.info('已转为智能对战');

      // 1.5秒后进入对战
      setTimeout(() => {
        this.gameState = 'battle';
        this.startBattle();
      }, 1500);
    },

    /**
     * 匹配阶段退出
     * 弹窗确认后清理所有定时器并返回上一页
     */
    handleExit() {
      vibrateLight();
      uni.showModal({
        title: '确认退出？',
        content: '退出后将丢失当前匹配进度',
        success: (res) => {
          if (res.confirm) {
            this.clearAllTimers();
            safeNavigateBack();
          }
        }
      });
    }
  }
};
