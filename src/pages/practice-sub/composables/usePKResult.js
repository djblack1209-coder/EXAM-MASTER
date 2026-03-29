/**
 * PK 结果与分数管理 Mixin
 *
 * 职责：对局结算、AI战报生成、排行榜上传、重新开局、结算页导航
 * 使用方式：在 pk-battle.vue 中通过 mixins: [pkResultMixin] 合并
 *
 * @module composables/usePKResult
 */
import { proxyAI } from '@/services/api/domains/ai.api.js';
import { rankCenter } from '@/services/api/domains/social.api.js';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import storageService from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';

export const pkResultMixin = {
  data() {
    return {
      // 战绩数据（用于分享海报）
      accuracy: 0,
      averageTime: 0,
      knowledgePoints: [],
      // AI 战报
      aiSummary: '智能正在分析本场对局...',
      // 上传锁
      isScoreUploaded: false,
      // 防重复导航
      isNavigating: false
    };
  },

  methods: {
    /**
     * 对局结束处理
     * 计算战绩数据（正确率、平均时间、知识点），切换到结算界面
     * 然后触发 AI 战报生成和分数上传
     */
    async finishGame() {
      // 立即清理所有定时器（防止对手继续答题）
      this.clearAllTimers();
      // 计算战绩数据
      const correctCount = Math.floor(this.myScore / 20);
      this.accuracy = this.questions.length > 0 ? Math.round((correctCount / this.questions.length) * 100) : 0;
      // 使用真实记录的答题时间计算平均值
      if (this.answerTimes.length > 0) {
        const totalTime = this.answerTimes.reduce((sum, t) => sum + t, 0);
        this.averageTime = parseFloat((totalTime / this.answerTimes.length / 1000).toFixed(1));
      } else {
        this.averageTime = 0;
      }
      // 从实际答对的题目中提取知识点
      this.knowledgePoints = this.questions
        .slice(0, correctCount)
        .map((q) => q.category || '未分类')
        .filter((v, i, a) => a.indexOf(v) === i);

      // 切换到结算状态
      this.gameState = 'result';
      // 调用智谱智能生成战后分析
      await this.fetchAISummary();
      // 自动上传分数到排行榜（静默）
      this.uploadScoreToRank().catch((err) => {
        logger.error('[PK] 上传分数失败（静默）:', err);
        toast.info('排行榜同步失败，请稍后重试');
      });

      // 验证结算页状态
      this.$nextTick(() => {
        /* force DOM update after settlement */
      });
    },

    /**
     * 调用后端 AI 生成战报分析
     * 失败时降级为本地随机文案
     */
    async fetchAISummary() {
      this.aiSummary = '智能正在分析战局...';
      toast.loading('智能分析中...');

      const correctCount = Math.floor(this.myScore / 20);
      const accuracy = this.questions.length > 0 ? Math.round((correctCount / this.questions.length) * 100) : 0;

      const result = this.myScore > this.opponentScore ? '胜利' : this.myScore < this.opponentScore ? '惜败' : '平局';

      logger.log('[pk-battle] 🤖 调用后端代理生成智能战报...');

      try {
        const response = await proxyAI('pk_summary', {
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
          comment = comment.replace(/[""\"]/g, '');
          comment = comment.replace(/```json\s*/gi, '');
          comment = comment.replace(/```\s*/g, '');
          this.aiSummary = comment;
          logger.log('[pk-battle] ✅ 智能战报生成成功');
        } else {
          throw new Error('智能响应异常');
        }
      } catch (e) {
        logger.error('[PK] 智能战报生成失败:', e);

        if (e.message && e.message.includes('未登录')) {
          logger.warn('[PK] 智能服务需要登录，使用降级方案');
        }

        // 降级方案：随机显示一条本地文案
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
        toast.hide();
      }
    },

    /**
     * 上传分数到排行榜
     * 内置锁机制防止重复上传，采用 Fire-and-Forget 策略
     */
    async uploadScoreToRank() {
      // 锁机制：防止重复上传
      if (this.isScoreUploaded) {
        return;
      }
      this.isScoreUploaded = true;

      const userId = storageService.get('EXAM_USER_ID', '');
      const userInfo = storageService.get('userInfo', {});

      // 如果没登录，跳过
      if (!userId && !userInfo.nickName) {
        logger.warn('[PK] 用户未登录，跳过上传分数');
        return;
      }

      const nickName = userInfo.nickName || userInfo.name || '考研人';
      const avatarUrl = userInfo.avatarUrl || userInfo.avatar || this.defaultAvatar;
      const finalUserId = userId || userInfo.uid || `temp_${Date.now()}`;

      // 发送本局增量分数，后端 _.inc(score) 自动累加
      const pkScore = this.myScore;

      const uploadData = {
        action: 'update',
        uid: finalUserId,
        userId: finalUserId,
        nickName: nickName,
        avatarUrl: avatarUrl,
        score: pkScore
      };

      // 静默上传，不显示 loading
      rankCenter(uploadData)
        .then((_res) => {
          // 成功日志已记录
        })
        .catch((err) => {
          // Fire and Forget：上传失败不重置标志位
          logger.error('[PK] 上传分数失败（已锁定，不再重试）:', err);
        });
    },

    /**
     * 重新开局
     * 重置所有状态、重新抽取题目、重新开始匹配
     */
    resetGame() {
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
      this.isScoreUploaded = false;
      // Phase 3-2: 重置实时PK状态
      if (this.pkRoom) {
        this.pkRoom.leaveRoom();
        this.pkRoom = null;
      }
      this.isRealMatch = false;

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

    /**
     * 返回首页
     */
    goHome() {
      if (this.isNavigating) return;
      this.isNavigating = true;

      uni.switchTab({
        url: '/pages/index/index',
        fail: () => {
          toast.info('跳转失败');
        },
        complete: () => {
          setTimeout(() => {
            this.isNavigating = false;
          }, 500);
        }
      });
    },

    /**
     * 跳转到排行榜
     */
    goToRank() {
      if (this.isNavigating) return;
      this.isNavigating = true;

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

    /**
     * 点击结算页空白区域（预留）
     */
    handleResultStageClick(_e) {
      // 点击结算页空白区域，不做任何操作
    },

    /**
     * 从结算页退出
     */
    handleExitFromResult() {
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
    }
  }
};
