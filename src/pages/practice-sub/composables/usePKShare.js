/**
 * PK 分享与海报管理 Mixin
 *
 * 职责：Canvas 海报绘制、邀请链接生成、分享逻辑
 * 使用方式：在 pk-battle.vue 中通过 mixins: [pkShareMixin] 合并
 *
 * @module composables/usePKShare
 */
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import storageService from '@/services/storageService.js';
import { createInviteDeepLink, generateInviteCode, generateShareConfig } from '../invite-deep-link.js';

export const pkShareMixin = {
  data() {
    return {
      // 好友PK邀请相关
      sharePkRoomId: '',
      sharePkInviteCode: '',
      sharePkDeepLink: '',
      showSharePkCard: false,
      // 海报生成锁
      isGeneratingShare: false
    };
  },

  methods: {
    /**
     * 生成 PK 邀请链接
     * 创建房间ID、邀请码和深度链接
     */
    async generateSharePkLink() {
      const userId = storageService.get('EXAM_USER_ID', '');

      this.sharePkRoomId = `pk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      this.sharePkInviteCode = generateInviteCode({
        roomId: this.sharePkRoomId,
        userId: userId
      });

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

    /**
     * 分享 PK 对战
     * 小程序环境调用分享API，H5/APP 环境复制链接
     */
    async sharePkBattle() {
      try {
        const shareInfo = await this.generateSharePkLink();

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
        uni.showShareMenu({
          withShareTicket: true,
          menus: ['shareAppMessage', 'shareTimeline']
        });
        // #endif

        // #ifdef H5 || APP-PLUS
        uni.setClipboardData({
          data: shareInfo.deepLink,
          success: () => {
            toast.info('PK链接已复制，快去分享给好友吧！');
          }
        });
        // #endif
      } catch (error) {
        logger.error('[PK-Share] 分享失败:', error);
        toast.info('分享失败，请稍后重试');
      }
    },

    /**
     * 生成战报海报并预览
     * 使用 Canvas 绘制胜利/失败版海报，支持 3 倍超清导出
     * 同时静默上传分数到排行榜
     */
    async handleShare() {
      // 防止重复点击
      if (this.isGeneratingShare) {
        return;
      }

      this.isGeneratingShare = true;
      toast.loading('生成战报中...');

      // 设置超时处理
      const timeoutTimer = setTimeout(() => {
        if (this.isGeneratingShare) {
          logger.error('[PK] 生成战报超时');
          toast.hide();
          this.isGeneratingShare = false;
          toast.info('生成战报超时，请稍后重试');
        }
      }, 10000);

      try {
        // 静默上传分数到排行榜
        this.uploadScoreToRank().catch((err) => {
          logger.error('[PK] 分享时上传分数失败:', err);
        });

        // Canvas 绘图
        const ctx = uni.createCanvasContext('shareCanvas', this);
        const W = 375;
        const H = 600;

        const isVictory = this.myScore >= this.opponentScore;

        // ========== 胜利版海报 ==========
        if (isVictory) {
          // 背景 - 皇家蓝与紫罗兰极光渐变
          const gradient = ctx.createLinearGradient(0, 0, W, H);
          gradient.addColorStop(0, '#1E3A8A');
          gradient.addColorStop(0.5, '#7C3AED');
          gradient.addColorStop(1, '#1E3A8A');
          ctx.setFillStyle(gradient);
          ctx.fillRect(0, 0, W, H);

          // 金色流光点缀
          ctx.setFillStyle('rgba(255, 215, 0, 0.2)');
          ctx.fillRect(0, 0, W, 4);

          // 头部：荣耀宣告
          ctx.setFontSize(32);
          ctx.setFillStyle('#FFD700');
          ctx.setTextAlign('center');
          ctx.fillText('PK 胜利！', W / 2, 60);

          ctx.setFontSize(14);
          ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
          ctx.fillText('在知识巅峰对决中胜出！', W / 2, 85);

          // 核心对决区（非对称设计）
          ctx.setFillStyle('rgba(255, 215, 0, 0.3)');
          ctx.beginPath();
          ctx.arc(100, 150, 50, 0, Math.PI * 2);
          ctx.fill();

          ctx.setFontSize(18);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText(this.userInfo.nickName || '考研人', 100, 220);

          ctx.setFontSize(80);
          ctx.setFillStyle('#FFD700');
          ctx.fillText(this.myScore.toString(), 100, 280);

          ctx.setFontSize(12);
          ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
          ctx.fillText('本局得分', 100, 300);

          // VS 闪电符号
          ctx.setFontSize(24);
          ctx.setFillStyle('#FFD700');
          ctx.fillText('⚡', W / 2, 200);

          // 对手
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

          // 战绩分析区（三个卡片）
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

          // 底部：激励文案
          ctx.setFontSize(14);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText('保持状态，下一个状元就是你！', W / 2, 520);

          ctx.setFontSize(11);
          ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
          ctx.fillText('Exam Master - 考研刷题助手', W / 2, 550);
        } else {
          // ========== 失败版海报 ==========
          const gradient = ctx.createLinearGradient(0, 0, W, H);
          gradient.addColorStop(0, '#0EA5E9');
          gradient.addColorStop(0.5, '#06B6D4');
          gradient.addColorStop(1, '#0EA5E9');
          ctx.setFillStyle(gradient);
          ctx.fillRect(0, 0, W, H);

          ctx.setFillStyle('rgba(255, 165, 0, 0.15)');
          ctx.fillRect(0, 0, W, 4);

          ctx.setFontSize(28);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.setTextAlign('center');
          ctx.fillText('惜败！差一点点就赢了', W / 2, 60);

          ctx.setFontSize(64);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText(this.myScore.toString(), W / 2, 180);

          ctx.setFontSize(14);
          ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
          ctx.fillText('VS', W / 2, 220);

          ctx.setFontSize(48);
          ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
          ctx.fillText(this.opponentScore.toString(), W / 2, 260);

          ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
          ctx.fillRect(30, 300, W - 60, 80);

          ctx.setFontSize(14);
          ctx.setFillStyle('#FFA500');
          ctx.fillText('本局进步点', W / 2, 330);

          ctx.setFontSize(12);
          ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
          ctx.fillText('虽然输了，但你的历史类题目全对！', W / 2, 360);

          ctx.setFontSize(12);
          ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
          ctx.fillText('对手比你快了0.5秒', W / 2, 420);
          ctx.fillText('引导用户去提升速度', W / 2, 440);

          ctx.setFontSize(14);
          ctx.setFillStyle(this.isDark ? '#1c1c1e' : '#ffffff');
          ctx.fillText('不服！再战一局', W / 2, 520);

          ctx.setFontSize(11);
          ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
          ctx.fillText('Exam Master - 考研刷题助手', W / 2, 550);
        }

        // 渲染并导出图片
        ctx.draw(false, () => {
          setTimeout(() => {
            clearTimeout(timeoutTimer);

            uni.canvasToTempFilePath(
              {
                canvasId: 'shareCanvas',
                width: W,
                height: H,
                destWidth: W * 3,
                destHeight: H * 3,
                success: (res) => {
                  toast.hide();
                  this.isGeneratingShare = false;
                  uni.previewImage({
                    urls: [res.tempFilePath],
                    fail: () => {
                      toast.info('预览失败');
                    }
                  });
                },
                fail: (err) => {
                  logger.error('[PK] 绘图失败', err);
                  toast.hide();
                  this.isGeneratingShare = false;
                  toast.info('绘图失败，请稍后重试');
                }
              },
              this
            );
          }, 1000);
        });
      } catch (error) {
        logger.error('[PK] 生成战报异常:', error);
        clearTimeout(timeoutTimer);
        toast.hide();
        this.isGeneratingShare = false;
        toast.info('生成战报失败，请稍后重试');
      }
    }
  }
};
