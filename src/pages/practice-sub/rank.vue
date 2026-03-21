<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px' }">
        <text class="nav-back" @tap="navBack"> ← </text>
        <text class="nav-title"> 考研学霸榜 </text>
        <view class="placeholder" />
      </view>
    </view>

    <!-- 加载动画 -->
    <BaseLoading :visible="loading" text="加载排行榜数据..." :is-dark="isDark" />

    <!-- 空状态 -->
    <view v-if="!loading && empty" class="empty-container">
      <BaseEmpty icon="trophy" title="暂无排行榜数据" desc="快去刷题，成为第一个上榜的学霸吧！" :is-dark="isDark" />
      <wd-button plain custom-class="go-practice-btn" @click="toPractice">去刷题</wd-button>
    </view>

    <!-- 排行榜内容 -->
    <scroll-view
      v-else
      scroll-y="true"
      class="rank-scroll"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
      enable-back-to-top="true"
      @scrolltolower="loadMoreRanks"
    >
      <!-- 领奖台区域 -->
      <view v-if="rankList.length > 0" class="podium-section">
        <view v-if="rankList[1]" class="podium-item rank-2" @tap="showFootprint(rankList[1])">
          <view class="avatar-wrap">
            <image
              class="avatar"
              :src="rankList[1].avatar || defaultAvatar"
              alt="头像" mode="aspectFill"
              @error="onAvatarError($event, rankList[1])"
            />
            <view class="badge"> 2 </view>
          </view>
          <text class="name">
            {{ rankList[1].name }}
          </text>
          <text class="score"> {{ rankList[1].score }}分 </text>
        </view>

        <view v-if="rankList[0]" class="podium-item rank-1" @tap="showFootprint(rankList[0])">
          <view class="avatar-wrap">
            <view class="crown-glow" />
            <image
              class="avatar"
              :src="rankList[0].avatar || defaultAvatar"
              alt="头像" mode="aspectFill"
              @error="onAvatarError($event, rankList[0])"
            />
            <view class="badge"> 1 </view>
          </view>
          <text class="name">
            {{ rankList[0].name }}
          </text>
          <text class="score"> {{ rankList[0].score }}分 </text>
        </view>

        <view v-if="rankList[2]" class="podium-item rank-3" @tap="showFootprint(rankList[2])">
          <view class="avatar-wrap">
            <image
              class="avatar"
              :src="rankList[2].avatar || defaultAvatar"
              alt="头像" mode="aspectFill"
              @error="onAvatarError($event, rankList[2])"
            />
            <view class="badge"> 3 </view>
          </view>
          <text class="name">
            {{ rankList[2].name }}
          </text>
          <text class="score"> {{ rankList[2].score }}分 </text>
        </view>
      </view>

      <!-- 排行榜列表 (F007: 增量渲染，避免一次性渲染全部DOM) -->
      <view v-if="otherRanks.length > 0" class="list-section">
        <view
          v-for="(item, index) in displayedOtherRanks"
          :key="index"
          class="glass-card rank-item"
          :class="getRankItemClass(item)"
          @tap="showFootprint(item)"
        >
          <view class="rank-num-box">
            <text class="rank-num">
              {{ index + 4 }}
            </text>
          </view>
          <image
            class="item-avatar"
            :src="item.avatar || defaultAvatar"
            alt="头像" mode="aspectFill"
            lazy-load
            @error="onAvatarError($event, item)"
          />
          <view class="item-info">
            <text class="item-name">
              {{ item.name }}
            </text>
            <text class="item-desc"> 坚持 {{ item.days }} 天 · 已刷 {{ item.done }} 题 </text>
          </view>
          <text class="item-score">
            {{ item.score }}
          </text>
        </view>
      </view>

      <!-- 只有我自己的情况 -->
      <view v-else-if="list.length === 1" class="only-me-container">
        <BaseEmpty icon="trophy" title="只有你一个人上榜" desc="继续加油，保持领先！" :is-dark="isDark" />
      </view>

      <view class="footer-safe" />
    </scroll-view>

    <!-- 固定底部：我的排名 -->
    <view class="my-rank-fixed">
      <view class="my-rank-card">
        <text class="rank-num">
          {{ myRank > 100 ? '99+' : myRank }}
        </text>
        <image
          class="item-avatar"
          :src="userInfo.avatarUrl || defaultAvatar"
          alt="头像" mode="aspectFill"
          @error="onAvatarError($event, userInfo, 'avatarUrl')"
        />
        <view class="item-info">
          <text class="item-name"> {{ userInfo.nickName || '考研人' }} (我) </text>
          <text class="item-desc">
            {{ rankGapText }}
          </text>
          <text class="item-score-text"> 分数: {{ myScore }} </text>
        </view>
        <wd-button size="small" type="primary" custom-class="rank-btn" @click="toPractice">去超车</wd-button>
      </view>
    </view>

    <!-- 学霸学习足迹智能分析名片弹窗 -->
    <view v-if="showFootprintModal" class="footprint-mask" @tap="closePopup">
      <view class="footprint-card glass-card" @tap.stop>
        <view class="close-btn" @tap="closePopup">
          <BaseIcon name="close" :size="32" />
        </view>

        <view class="card-header">
          <image
            class="card-avatar"
            :src="activeUser.avatar || defaultAvatar"
            alt="头像" mode="aspectFill"
            @error="onAvatarError($event, activeUser)"
          />
          <view class="header-info">
            <text class="card-name">
              {{ activeUser.name }}
            </text>
            <view class="ai-label">
              <view class="sparkle-icon">
                <BaseIcon name="sparkle" :size="28" />
              </view>
              <text>{{ aiPersona }}</text>
            </view>
          </view>
        </view>

        <view class="footprint-data-row">
          <view class="data-item">
            <text class="val">
              {{ activeUser.days || 0 }}
            </text>
            <text class="lbl"> 坚持天数 </text>
          </view>
          <view class="data-item">
            <text class="val">
              {{ activeUser.score || 0 }}
            </text>
            <text class="lbl"> 学霸分 </text>
          </view>
          <view class="data-item">
            <text class="val">
              {{ activeUser.done || 0 }}
            </text>
            <text class="lbl"> 总刷题 </text>
          </view>
        </view>

        <view v-if="activeUser.target" class="target-school-box">
          <text class="target-label"> 目标院校： </text>
          <text class="target-val">
            {{ activeUser.target }}
          </text>
        </view>

        <view class="ai-analysis-content">
          <view class="analysis-tag"> <BaseIcon name="sparkle" :size="28" /> AI 学习足迹摘要 </view>
          <scroll-view scroll-y="true" class="analysis-scroll">
            <text class="analysis-text">
              {{ aiAnalysisText }}
            </text>
          </scroll-view>
        </view>

        <wd-button type="primary" custom-class="challenge-btn" @click="startPK">向 TA 发起挑战</wd-button>
      </view>
    </view>
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
// 检查点4.1: 排行榜WebSocket实时更新
import { rankingSocket } from './ranking-socket.js';
import { selfPositionTracker } from './self-position-tracker.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { getStatusBarHeight, getWindowInfo as _getWindowInfo } from '@/utils/core/system.js';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';
import BaseLoading from './components/base-loading/base-loading.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: {
    BaseLoading,
    BaseEmpty,
    BaseIcon
  },
  data() {
    return {
      statusBarHeight: 44,
      capsuleMargin: 100,
      userInfo: {},
      defaultAvatar: DEFAULT_AVATAR,
      myScore: 0,
      myRank: 999,
      // rankGapText 已移至 computed 中，不再在 data 中定义
      showFootprintModal: false,
      activeUser: {},
      aiAnalysisText: '智能正在调阅该学霸的学习档案...',
      aiPersona: '正在分析',
      isAnalyzing: false,
      isDark: false,
      // 排行榜数据
      loading: false, // 加载状态
      refreshing: false, // 下拉刷新状态
      empty: false, // 空状态
      rankList: [], // 前三名数据
      otherRanks: [], // 其他排名数据
      list: [], // 完整排行榜数据
      apiData: null, // 原始 API 返回数据
      // 检查点4.1: WebSocket实时更新相关
      rankingWebsocketConnected: false, // ranking websocket连接状态
      selfPositionHighlighted: false, // 自己位置是否高亮
      isNavigating: false, // 防止重复跳转
      displayRankCount: 30 // F007: 增量渲染，初始显示30条
    };
  },
  computed: {
    rankGapText() {
      if (this.myRank <= 100) {
        return `排名第 ${this.myRank} 名，继续加油！`;
      }
      const minScore = this.otherRanks.length > 0 ? this.otherRanks[this.otherRanks.length - 1].score : 1000;
      const gap = minScore - this.myScore;
      return gap > 0 ? `还差 ${gap} 分进入前百名` : '已进入前百名';
    },
    // F007: 增量渲染 — 只渲染前 displayRankCount 条到 DOM
    displayedOtherRanks() {
      return this.otherRanks.slice(0, this.displayRankCount);
    }
  },
  onLoad() {
    this.initSystem();
    this.loadUserData();
    // 注意：calculateMyScore() 现在在 loadRankData() 完成后调用
    this.loadRankData(); // 加载排行榜数据
    this._loadedOnce = true;

    // 初始化主题
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    // 监听全局主题更新事件
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // 检查点4.1: 初始化WebSocket实时排行榜更新
    this.initRankingWebsocket();
  },
  onShow() {
    // 首次进入时 onLoad 已加载，跳过 onShow 的重复请求
    if (this._loadedOnce) {
      this._loadedOnce = false;
      return;
    }
    // 从其他页面返回时刷新数据
    setTimeout(() => {
      this.loadRankData();
    }, 300);

    // 检查点4.1: 重新连接WebSocket（如果断开）
    if (!this.rankingWebsocketConnected) {
      this.initRankingWebsocket();
    }
  },
  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate', this._themeHandler);
    // 检查点4.1: 断开WebSocket连接
    this.disconnectRankingWebsocket();
  },
  methods: {
    // ✅ 图片加载失败处理
    onAvatarError(e, user, key = 'avatar') {
      if (user) {
        user[key] = this.defaultAvatar;
      }
    },

    // F007: 滚动到底部时加载更多排名
    loadMoreRanks() {
      if (this.displayRankCount < this.otherRanks.length) {
        this.displayRankCount = Math.min(this.displayRankCount + 30, this.otherRanks.length);
      }
    },

    initSystem() {
      this.statusBarHeight = getStatusBarHeight();

      // #ifdef MP-WEIXIN
      try {
        const capsule = uni.getMenuButtonBoundingClientRect();
        if (capsule && capsule.width > 0) {
          const windowWidth = _getWindowInfo().windowWidth;
          this.capsuleMargin = windowWidth - capsule.left + 10;
        } else {
          this.capsuleMargin = 100;
        }
      } catch (e) {
        logger.log('获取胶囊按钮信息失败', e);
        this.capsuleMargin = 100;
      }
      // #endif
      // #ifndef MP-WEIXIN
      this.capsuleMargin = 20;
      // #endif
    },

    // 加载排行榜数据
    async loadRankData() {
      this.loading = true;
      this.empty = false;

      try {
        const userId = storageService.get('EXAM_USER_ID', '');
        // 调用 rank-center 云函数获取排行榜数据
        const res = await lafService.rankCenter({
          action: 'get',
          userId: userId
        });

        // 打印完整的后端返回数据（用于调试）
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        }

        this.apiData = res;

        if (res && res.code === 0 && res.data) {
          // 数据规范化：确保 data 是数组
          let list = Array.isArray(res.data) ? res.data : [];

          // 数据规范化：处理可能的对象格式 { list: [...], myRank: ... }
          if (!Array.isArray(res.data) && res.data.list && Array.isArray(res.data.list)) {
            list = res.data.list;
            // 如果后端返回了 myRank，使用它
            if (typeof res.data.myRank === 'number') {
              this.myRank = res.data.myRank;
            }
          }

          // 数据规范化：确保每个项目都有必要的字段
          list = list.map((item, index) => {
            // 调试：打印原始 item 的 score 值
            if (index === 0) {
            }

            const normalizedItem = {
              nickName: item.nickName || item.name || '匿名用户',
              name: item.nickName || item.name || '匿名用户',
              score: Number(item.score) || 0,
              days: Number(item.days) || 0,
              done: Number(item.done) || 0,
              target: item.target || '',
              avatarUrl: item.avatarUrl || item.avatar || this.defaultAvatar,
              avatar: item.avatarUrl || item.avatar || this.defaultAvatar,
              _id: item.uid || item._id || item.id || `user_${index}`
            };

            // 调试：打印规范化后的 score 值
            if (index === 0) {
            }

            return normalizedItem;
          });

          // 排序验证：确保按分数降序排列
          list = list.sort((a, b) => {
            const scoreA = Number(a.score) || 0;
            const scoreB = Number(b.score) || 0;
            return scoreB - scoreA; // 降序
          });

          // 验证排序是否正确
          const isSorted = this.validateSorting(list);
          if (!isSorted) {
            logger.warn('[PK] 数据未正确排序，已重新排序');
          }

          this.list = list;

          // 处理前三名数据
          this.rankList = list.slice(0, 3).map((item) => ({
            name: item.name,
            score: item.score,
            days: item.days,
            done: item.done,
            target: item.target,
            avatar: item.avatar
          }));

          // 处理其他排名数据
          this.otherRanks = list.slice(3).map((item) => ({
            name: item.name,
            score: item.score,
            days: item.days,
            done: item.done,
            target: item.target,
            avatar: item.avatar
          }));

          // 计算我的排名和分数（在数据加载完成后）
          // 优先使用后端返回的分数，而不是重新计算
          this.calculateMyScoreAndRank();

          // 处理空状态
          this.empty = list.length === 0;
        } else {
          // 数据获取失败
          this.empty = true;
          logger.error('[PK] 获取排行榜数据失败:', {
            code: res?.code,
            message: res?.message,
            data: res?.data
          });
        }
      } catch (error) {
        logger.error('[PK] 调用排行榜 API 失败:', error);
        this.empty = true;
        uni.showToast({
          title: '获取排行榜数据失败',
          icon: 'none'
        });
      } finally {
        this.loading = false;
      }
    },

    // 验证排序是否正确（降序）
    validateSorting(list) {
      if (list.length <= 1) return true;
      for (let i = 0; i < list.length - 1; i++) {
        const current = Number(list[i].score) || 0;
        const next = Number(list[i + 1].score) || 0;
        if (current < next) {
          return false;
        }
      }
      return true;
    },
    loadUserData() {
      this.userInfo = storageService.get('userInfo', { nickName: '考研人', avatarUrl: '' });
    },
    calculateMyScoreAndRank() {
      const userId = storageService.get('EXAM_USER_ID', '');
      const myUserInfo = storageService.get('userInfo', {});
      const myNickName = myUserInfo.nickName || '';

      // 优先从排行榜数据中查找我的记录（使用后端返回的真实分数）
      if (this.list && this.list.length > 0) {
        const myRecord = this.list.find(
          (item) =>
            item._id === userId || item.uid === userId || item.nickName === myNickName || item.name === myNickName
        );

        if (myRecord) {
          // 如果找到了我的记录，检查后端返回的分数是否有效
          const backendScore = Number(myRecord.score) || 0;

          // 如果后端返回的分数有效（> 0），使用后端分数
          // 否则使用本地计算的分数（降级方案）
          if (backendScore > 0) {
            this.myScore = backendScore;
            this.myRank = this.list.indexOf(myRecord) + 1;
            // 验证分数更新
            return; // 使用后端数据，不再计算本地分数
          } else {
            logger.warn('[PK] 后端返回的分数无效（为 0 或不存在），使用本地计算的分数作为降级方案');
            // 继续执行本地计算
          }
        } else {
        }
      }

      // 如果没有在排行榜中找到我的记录，或后端分数无效，则计算本地分数
      this.calculateMyScore();
    },

    calculateMyScore() {
      // 计算用户得分：基于刷题数量、坚持天数、正确率（仅当后端没有数据时使用）
      const stats = storageService.get('study_stats', {});
      const mistakes = storageService.get('mistake_book', []);

      // 计算坚持天数
      const studyDays = Object.keys(stats).length || 1;

      // 计算总刷题数
      const totalDone = Object.values(stats).reduce((sum, count) => sum + (count || 0), 0);

      // 计算正确率（假设错题本中的题目都是错的）
      const correctCount = Math.max(0, totalDone - mistakes.length);
      const accuracy = totalDone > 0 ? correctCount / totalDone : 0;

      // 得分计算：刷题数 * 10 + 坚持天数 * 20 + 正确率 * 100
      this.myScore = Math.round(totalDone * 10 + studyDays * 20 + accuracy * 100);

      // 计算排名：基于分数计算排名
      if (this.list && this.list.length > 0) {
        const allScores = this.list.map((r) => Number(r.score) || 0);
        allScores.push(this.myScore);
        allScores.sort((a, b) => b - a);
        this.myRank = allScores.indexOf(this.myScore) + 1;
      } else {
        this.myRank = 999;
      }
    },
    navBack() {
      safeNavigateBack();
    },
    toPractice() {
      // 防止重复点击
      if (this.isNavigating) return;
      this.isNavigating = true;

      uni.switchTab({
        url: '/pages/practice/index',
        complete: () => {
          setTimeout(() => {
            this.isNavigating = false;
          }, 500);
        }
      });
    },
    startPK() {
      // 防止重复点击
      if (this.isNavigating) return;
      this.isNavigating = true;

      this.closePopup();
      // 确保 opponent 参数有效
      const opponentName = this.activeUser?.name || this.activeUser?.nickName || '匿名用户';
      safeNavigateTo(`/pages/practice-sub/pk-battle?opponent=${encodeURIComponent(opponentName)}`, {
        complete: () => {
          setTimeout(() => {
            this.isNavigating = false;
          }, 500);
        }
      });
    },
    async showFootprint(user) {
      this.activeUser = user;
      this.showFootprintModal = true;
      this.aiAnalysisText = '智能正在调阅该学霸的学习档案...';
      this.aiPersona = '正在分析';
      await this.fetchFootprintAnalysis(user);
    },
    async fetchFootprintAnalysis(user) {
      this.isAnalyzing = true;
      this.aiAnalysisText = '智能正在深度扫描足迹...';
      uni.showLoading({ title: '分析中...', mask: false });

      logger.log('[rank] 🤖 调用后端代理进行学霸足迹分析...');

      try {
        // ✅ 使用后端代理调用（安全）- action: 'footprint'
        const response = await lafService.proxyAI('footprint', {
          name: user.name,
          days: user.days || 0,
          score: user.score || 0,
          done: user.done || 0,
          target: user.target || '未设定'
        });

        logger.log('[rank] 📥 后端代理响应:', {
          code: response?.code,
          hasData: !!response?.data
        });

        if (response && response.code === 0 && response.data) {
          const content = response.data.trim();
          logger.log('[rank] ✅ 智能足迹分析成功');

          // 尝试提取称号（第一句话或冒号前的内容）
          const lines = content.split(/[。\n]/);
          const firstLine = lines[0] || content;
          if (firstLine.includes('：') || firstLine.includes(':')) {
            this.aiPersona = firstLine.split(/[：:]/)[0].trim();
            this.aiAnalysisText = content;
          } else if (firstLine.length <= 12) {
            this.aiPersona = firstLine;
            this.aiAnalysisText = content;
          } else {
            this.aiPersona = '学霸先锋';
            this.aiAnalysisText = content;
          }
        } else {
          logger.warn('[rank] ⚠️ 智能足迹分析响应异常，使用默认文案');
          this.aiPersona = '学霸先锋';
          this.aiAnalysisText = `${user.name} 是一位勤奋的考研人，坚持学习 ${user.days || 0} 天，已刷 ${user.done || 0} 题，展现了强大的学习毅力。继续加油，成功上岸！`;
        }
      } catch (e) {
        logger.error('[rank] ❌ 智能足迹分析失败:', e);
        this.aiPersona = '学霸先锋';
        this.aiAnalysisText = `${user.name} 是一位勤奋的考研人，坚持学习 ${user.days || 0} 天，已刷 ${user.done || 0} 题，展现了强大的学习毅力。继续加油，成功上岸！`;
      } finally {
        uni.hideLoading();
        this.isAnalyzing = false;
      }
    },
    closePopup() {
      this.showFootprintModal = false;
      this.activeUser = {};
      this.aiAnalysisText = '智能正在调阅该学霸的学习档案...';
      this.aiPersona = '正在分析';
    },

    // 检查点4.1: 初始化WebSocket实时排行榜更新
    initRankingWebsocket() {
      const userId = storageService.get('EXAM_USER_ID', '');
      if (!userId) {
        logger.log('[Rank-WebSocket] 用户未登录，跳过WebSocket连接');
        return;
      }

      logger.log('[Rank-WebSocket] 初始化排行榜WebSocket连接');

      // 连接WebSocket
      rankingSocket
        .connect({
          userId: userId,
          rankType: 'daily'
        })
        .then(() => {
          this.rankingWebsocketConnected = true;
          logger.log('[Rank-WebSocket] WebSocket连接成功');

          // 设置自己的用户ID用于位置追踪
          selfPositionTracker.setUserId(userId);
          selfPositionTracker.setScrollViewId('rank-scroll-view');
        })
        .catch((err) => {
          logger.warn('[Rank-WebSocket] WebSocket连接失败，使用普通模式:', err);
          // 不显示toast，静默处理
        });

      // 监听排行榜实时更新
      rankingSocket.on('rankingUpdate', (data) => {
        logger.log('[Rank-WebSocket] 收到排行榜更新推送:', data);
        this.handleRankingWebsocketUpdate(data);
      });

      // 监听自己位置变化
      rankingSocket.on('positionChange', (data) => {
        logger.log('[Rank-WebSocket] 收到位置变化推送:', data);
        this.handlePositionChange(data);
      });
    },

    // 检查点4.1: 处理WebSocket排行榜更新
    handleRankingWebsocketUpdate(data) {
      if (data && data.list) {
        // 更新排行榜数据
        this.list = data.list;
        this.rankList = data.list.slice(0, 3);
        this.otherRanks = data.list.slice(3);

        // 重新计算我的排名
        this.calculateMyScoreAndRank();

        logger.log('[Rank-WebSocket] 排行榜数据已实时更新');
      }
    },

    // 检查点4.1: 处理位置变化（自己位置高亮）
    handlePositionChange(data) {
      const userId = storageService.get('EXAM_USER_ID', '');
      if (data.userId === userId) {
        // 自己的位置发生变化，触发高亮
        this.selfPositionHighlighted = true;

        // 滚动到自己位置
        selfPositionTracker.scrollToSelf();

        // 3秒后取消高亮
        setTimeout(() => {
          this.selfPositionHighlighted = false;
        }, 3000);

        // 显示排名变化提示
        const change = data.previousRank - data.rank;
        if (change > 0) {
          uni.showToast({
            title: `排名上升 ${change} 位！`,
            icon: 'none',
            duration: 2000
          });
        } else if (change < 0) {
          uni.showToast({
            title: `排名下降 ${Math.abs(change)} 位`,
            icon: 'none',
            duration: 2000
          });
        }
      }
    },

    // 检查点4.1: 获取排行项的高亮样式类
    getRankItemClass(item) {
      const userId = storageService.get('EXAM_USER_ID', '');
      const userInfo = storageService.get('userInfo', {});
      const isSelf = item._id === userId || item.uid === userId || item.nickName === userInfo.nickName;

      if (isSelf && this.selfPositionHighlighted) {
        return selfPositionTracker.getHighlightClass(userId);
      }
      return isSelf ? 'self-position' : '';
    },

    // 检查点4.1: 断开WebSocket连接
    disconnectRankingWebsocket() {
      if (this.rankingWebsocketConnected) {
        rankingSocket.disconnect();
        this.rankingWebsocketConnected = false;
        logger.log('[Rank-WebSocket] WebSocket已断开');
      }
      selfPositionTracker.destroy();
    }
  }
};
</script>

<style lang="scss" scoped>
/* --- 全局变量适配 --- */
.container {
  --neon-gold: var(--warning);
  --neon-silver: var(--text-tertiary);
  --neon-green: var(--success);
  --neon-glow-gold: var(--warning-light);
  --neon-glow-green: var(--success-light);
  --bg-body: var(--bg-body);
  --card-bg: var(--bg-glass);
  --card-border: var(--border);
  --text-primary: var(--text-primary);
  --text-tertiary: var(--text-tertiary);

  height: 100%;

  height: 100vh;
  background: var(--bg-body);
  position: relative;
  overflow: hidden;
  transition: background 0.3s;
}

.container.dark-mode {
  --neon-gold: var(--warning);
  --neon-silver: var(--text-sub);
  --neon-green: var(--success);
  --neon-glow-gold: var(--warning-light);
  --neon-glow-green: var(--success-light);
  --bg-body: var(--bg-body);
  --card-bg: var(--bg-glass);
  --card-border: var(--border);
  --text-primary: var(--text-primary);
  --text-tertiary: var(--text-tertiary);
}

/* 极光背景 */
.aurora-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 500rpx;
  background: var(--gradient-aurora);
  filter: blur(60px);
  z-index: 0;
}

.dark-mode .aurora-bg {
  background: var(--gradient-aurora-dark);
}

/* 导航栏 */
.nav-bar {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 100;
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--card-border);
}
.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}
.nav-back {
  font-size: 36rpx;
  color: var(--text-primary);
  font-weight: bold;
}
.nav-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary);
}
.placeholder {
  width: 36rpx;
}

/* 滚动区域 */
.rank-scroll {
  height: 100%;
  height: 100vh;
  padding: 0 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

/* 领奖台荧光效果 */
.podium-section {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 60rpx 0;
  margin-bottom: 40rpx;
}
.podium-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.avatar-wrap {
  position: relative;
  border-radius: 50%;
  padding: 6rpx;
  background: var(--bg-card);
  transition: transform 0.3s;
  margin-bottom: 20rpx;
}
.dark-mode .avatar-wrap {
  background: var(--bg-glass);
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: block;
}

.badge {
  position: absolute;
  bottom: -10rpx;
  left: 50%;
  transform: translateX(-50%);
  padding: 2rpx 16rpx;
  border-radius: 20rpx;
  color: var(--text-inverse);
  font-size: 20rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 第一名样式 - 金色荧光 */
.rank-1 .avatar-wrap {
  width: 160rpx;
  height: 160rpx;
  box-shadow: 0 0 30rpx var(--neon-glow-gold);
  border: 4rpx solid var(--neon-gold);
}
.dark-mode .rank-1 .avatar-wrap {
  box-shadow: 0 0 50rpx var(--neon-glow-gold);
}
.rank-1 .badge {
  background: var(--neon-gold);
}

/* 第一名皇冠光晕动画 */
.crown-glow {
  position: absolute;
  top: -30rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 40rpx;
  background: var(--neon-gold);
  filter: blur(10px);
  border-radius: 50%;
  animation: pulse 2s infinite;
  z-index: 5;
}

/* 第二名样式 - 银色 */
.rank-2 .avatar-wrap {
  width: 130rpx;
  height: 130rpx;
  border: 4rpx solid var(--neon-silver);
}
.rank-2 .badge {
  background: var(--neon-silver);
  color: var(--text-primary);
}

/* 第三名样式 - 铜色 */
.rank-3 .avatar-wrap {
  width: 120rpx;
  height: 120rpx;
  border: 4rpx solid var(--warning);
}
.rank-3 .badge {
  background: var(--warning);
}

.podium-item .name {
  color: var(--text-primary);
  font-weight: bold;
  margin-top: 20rpx;
  font-size: 26rpx;
  display: block;
}
.podium-item .score {
  color: var(--neon-green);
  font-weight: 900;
  font-size: 22rpx;
  display: block;
  margin-top: 8rpx;
}

/* 排行榜列表 */
.glass-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: 40rpx;
  box-shadow: var(--shadow-md);
}

/* 霓虹列表项 */
.rank-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  margin-bottom: 25rpx;
  border: 1px solid var(--card-border);
  transition: transform 0.2s;
}
.rank-item:active {
  transform: scale(0.98);
}
/* 深色模式下的霓虹边框 */
.dark-mode .rank-item {
  border-left: 6rpx solid var(--neon-green);
  box-shadow: var(--shadow-success);
}

.rank-num-box {
  width: 60rpx;
  flex-shrink: 0;
}
.rank-num {
  font-size: 36rpx;
  font-weight: 900;
  font-style: italic;
  color: var(--text-tertiary);
}
/* 深色模式下的排名数字荧光效果 */
.dark-mode .rank-num {
  color: var(--neon-green);
  text-shadow: var(--shadow-text);
}

.item-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 40rpx;
  margin: 0 25rpx;
  flex-shrink: 0;
}
.item-info {
  flex: 1;
  overflow: hidden;
}
.item-name {
  color: var(--text-primary);
  font-weight: bold;
  font-size: 28rpx;
  display: block;
  margin-bottom: 4rpx;
}
.item-desc {
  color: var(--text-tertiary);
  font-size: 20rpx;
  display: block;
}
.item-score {
  color: var(--text-primary);
  font-weight: 900;
  font-size: 32rpx;
  flex-shrink: 0;
  margin-left: 20rpx;
}

/* 底部我的排名卡片 - 荧光绿背景 */
.my-rank-fixed {
  position: fixed;
  bottom: 40rpx;
  left: 30rpx;
  right: 30rpx;
  z-index: 100;
}
.my-rank-card {
  background: var(--neon-green);
  padding: 30rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  box-shadow: var(--shadow-success);
}
.my-rank-card .rank-num,
.my-rank-card .item-name {
  color: var(--text-primary-foreground);
}
.my-rank-card .item-desc {
  color: var(--text-sub);
}
.my-rank-card .item-avatar {
  border: 2rpx solid var(--border);
}
.rank-btn {
  width: 140rpx;
  height: 60rpx;
  border-radius: 30rpx;
  background: var(--bg-card);
  color: var(--text-primary-foreground);
  font-size: 24rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  margin-left: 20rpx;
  flex-shrink: 0;
  border: none;
}
.rank-btn::after {
  border: none;
}

.footer-safe {
  height: 250rpx;
}

/* 加载状态样式 */
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

/* 空状态样式 */
.empty-container,
.only-me-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  padding: 0 40rpx;
}

.go-practice-btn {
  margin-top: 40rpx;
  width: 200rpx;
  height: 80rpx;
  background: var(--neon-green);
  color: var(--text-primary-foreground);
  font-weight: bold;
  border: none;
  border-radius: 40rpx;
  box-shadow: var(--shadow-success);
}

.go-practice-btn::after {
  border: none;
}

/* 脉冲动画 - 皇冠光晕 */
@keyframes pulse {
  0% {
    transform: translateX(-50%) scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: translateX(-50%) scale(1.5);
    opacity: 0.2;
  }
  100% {
    transform: translateX(-50%) scale(0.8);
    opacity: 0.5;
  }
}

/* 学霸学习足迹弹窗 */
.footprint-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--overlay-dark);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  box-sizing: border-box;
  animation: fadeIn 0.3s;
}

.footprint-card {
  width: 100%;
  max-width: 620rpx;
  padding: 50rpx;
  border-radius: 40rpx;
  position: relative;
  background: var(--card-bg);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s;
  max-height: 80vh;
  overflow-y: auto;
}

.close-btn {
  position: absolute;
  top: 30rpx;
  right: 30rpx;
  color: var(--text-tertiary);
  font-size: 32rpx;
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 40rpx;
}
.card-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  border: 4rpx solid var(--success);
  box-shadow: var(--shadow-success);
}
.header-info {
  margin-left: 20rpx;
  flex: 1;
}
.card-name {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 10rpx;
}
.ai-label {
  display: inline-flex;
  align-items: center;
  background: var(--success-light);
  color: var(--neon-green);
  padding: 4rpx 12rpx;
  border-radius: 10rpx;
  /* gap: 6rpx; -- replaced for Android WebView compat */
}
.sparkle-icon {
  font-size: 20rpx;
}
.ai-label text {
  font-size: 20rpx;
  font-weight: bold;
}

.footprint-data-row {
  display: flex;
  justify-content: space-between;
  padding: 30rpx 0;
  border-top: 1rpx solid var(--border);
  border-bottom: 1rpx solid var(--border);
  margin-bottom: 30rpx;
}
.data-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.data-item .val {
  font-size: 32rpx;
  font-weight: 900;
  color: var(--text-primary);
  display: block;
}
.data-item .lbl {
  font-size: 20rpx;
  color: var(--text-tertiary);
  margin-top: 6rpx;
  display: block;
}

.target-school-box {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border);
  margin-bottom: 30rpx;
}
.target-label {
  font-size: 24rpx;
  color: var(--text-tertiary);
}
.target-val {
  font-size: 26rpx;
  font-weight: bold;
  color: var(--neon-green);
  margin-left: 10rpx;
}

.ai-analysis-content {
  margin: 30rpx 0;
}
.analysis-tag {
  display: inline-block;
  background: var(--text-primary);
  color: #ffffff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  margin-bottom: 15rpx;
}
.analysis-scroll {
  height: 150rpx;
  max-height: 200rpx;
}
.analysis-text {
  font-size: 26rpx;
  color: var(--text-tertiary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  display: block;
}

.challenge-btn {
  width: 100%;
  height: 90rpx;
  line-height: 90rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-weight: bold;
  font-size: 28rpx;
  border-radius: 20rpx;
  border: 1rpx solid var(--cta-primary-border);
  margin-top: 20rpx;
  box-shadow: var(--cta-primary-shadow);
}
.challenge-btn::after {
  border: none;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(50rpx) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Final polish: leaderboard unified with Apple / Liquid Glass */
.container {
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 52%,
    var(--page-gradient-bottom) 100%
  );
}

.container.dark-mode {
  background: linear-gradient(180deg, #04070d 0%, #0a1018 48%, #04070d 100%);
}

.aurora-bg {
  height: 460rpx;
  background:
    radial-gradient(circle at 12% 14%, rgba(107, 208, 150, 0.26) 0%, transparent 34%),
    radial-gradient(circle at 84% 10%, rgba(255, 255, 255, 0.28) 0%, transparent 24%),
    radial-gradient(circle at 58% 72%, rgba(72, 190, 128, 0.16) 0%, transparent 34%);
  filter: blur(72rpx);
}

.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 12% 14%, rgba(10, 132, 255, 0.22) 0%, transparent 34%),
    radial-gradient(circle at 84% 10%, rgba(95, 170, 255, 0.16) 0%, transparent 24%),
    radial-gradient(circle at 58% 72%, rgba(32, 83, 170, 0.15) 0%, transparent 34%);
}

.nav-bar {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  border-bottom: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.nav-content {
  padding: 0 24rpx;
}

.nav-back {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
  color: var(--text-main);
}

.dark-mode .nav-back {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.nav-title {
  color: var(--text-main);
}

.dark-mode .nav-title {
  color: #ffffff;
}

.rank-scroll {
  padding: 0 24rpx;
}

.podium-section,
.rank-item,
.my-rank-card,
.footprint-card,
.go-practice-btn {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .podium-section,
.dark-mode .rank-item,
.dark-mode .my-rank-card,
.dark-mode .footprint-card,
.dark-mode .go-practice-btn {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.podium-section {
  padding: 40rpx 20rpx 28rpx;
  margin-top: 8rpx;
  margin-bottom: 30rpx;
  border-radius: 40rpx;
  align-items: stretch;
  /* gap: 12rpx; -- replaced for Android WebView compat */
}

.podium-item {
  justify-content: flex-end;
  padding: 16rpx 10rpx 12rpx;
  border-radius: 30rpx;
}

.rank-1 {
  transform: translateY(-14rpx);
}

.avatar-wrap {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.42) 0%, transparent 40%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.82) 0%, rgba(240, 248, 243, 0.56) 100%);
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .avatar-wrap {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.rank-1 .avatar-wrap,
.rank-2 .avatar-wrap,
.rank-3 .avatar-wrap {
  box-shadow: var(--apple-shadow-card);
}

.rank-1 .avatar-wrap {
  border-color: rgba(255, 191, 71, 0.34);
}

.rank-2 .avatar-wrap {
  border-color: rgba(255, 255, 255, 0.58);
}

.rank-3 .avatar-wrap {
  border-color: rgba(255, 159, 10, 0.3);
}

.crown-glow {
  top: -18rpx;
  width: 56rpx;
  height: 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 191, 71, 0.72);
  filter: blur(8rpx);
  opacity: 0.72;
  animation: none;
}

.badge {
  min-width: 52rpx;
  height: 40rpx;
  padding: 0 14rpx;
  box-shadow: var(--apple-shadow-surface);
}

.rank-1 .badge {
  background: rgba(255, 191, 71, 0.9);
  color: #4d3300;
}

.rank-2 .badge {
  background: rgba(255, 255, 255, 0.9);
  color: var(--text-main);
}

.rank-3 .badge {
  background: rgba(255, 159, 10, 0.88);
  color: #4b2d00;
}

.podium-item .name,
.podium-item .score,
.item-name,
.item-desc,
.item-score,
.card-name,
.data-item .val,
.target-val {
  color: var(--text-main);
}

.dark-mode .podium-item .name,
.dark-mode .podium-item .score,
.dark-mode .item-name,
.dark-mode .item-desc,
.dark-mode .item-score,
.dark-mode .card-name,
.dark-mode .data-item .val,
.dark-mode .target-val,
.dark-mode .analysis-text {
  color: #ffffff;
}

.podium-item .score,
.item-desc,
.data-item .lbl,
.target-label,
.analysis-text {
  color: var(--text-sub);
}

.rank-item {
  padding: 24rpx 22rpx;
  margin-bottom: 18rpx;
  border-radius: 28rpx;
  border-left: none;
}

.dark-mode .rank-item {
  border-left: none;
  box-shadow: var(--apple-shadow-card);
}

.rank-num {
  font-style: normal;
  color: var(--text-sub);
}

.dark-mode .rank-num {
  color: rgba(255, 255, 255, 0.74);
  text-shadow: none;
}

.item-avatar,
.card-avatar,
.my-rank-card .item-avatar {
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}

.item-score {
  color: #22873a;
}

.dark-mode .item-score {
  color: #7bc0ff;
}

.my-rank-fixed {
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
}

.my-rank-card {
  padding: 22rpx;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  border-radius: 32rpx;
}

.my-rank-card .rank-num,
.my-rank-card .item-name,
.my-rank-card .item-desc,
.my-rank-card .item-score-text {
  color: var(--text-main);
}

.dark-mode .my-rank-card .rank-num,
.dark-mode .my-rank-card .item-name,
.dark-mode .my-rank-card .item-desc,
.dark-mode .my-rank-card .item-score-text {
  color: #ffffff;
}

.rank-btn,
.go-practice-btn,
.challenge-btn {
  border-radius: 999rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.rank-btn {
  width: auto;
  min-width: 160rpx;
  padding: 0 24rpx;
  color: var(--cta-primary-text);
  background: var(--cta-primary-bg);
}

.go-practice-btn {
  width: 240rpx;
  height: 88rpx;
  font-weight: 620;
}

.footprint-mask {
  background: rgba(9, 18, 12, 0.32);
}

.dark-mode .footprint-mask {
  background: rgba(3, 8, 14, 0.52);
}

.footprint-card {
  padding: 54rpx 34rpx 34rpx;
  border-radius: 36rpx;
}

.footprint-card::before {
  content: '';
  position: absolute;
  top: 12rpx;
  left: 50%;
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.12);
}

.dark-mode .footprint-card::before {
  background: rgba(255, 255, 255, 0.16);
}

.close-btn {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
  color: var(--text-main);
}

.dark-mode .close-btn {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.card-avatar {
  border-color: rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-card);
}

.ai-label {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(52, 199, 89, 0.12);
  color: var(--text-main);
  border: 1px solid rgba(52, 199, 89, 0.18);
}

.dark-mode .ai-label {
  background: rgba(10, 132, 255, 0.14);
  color: #ffffff;
  border-color: rgba(10, 132, 255, 0.18);
}

.analysis-tag {
  display: inline-flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 999rpx;
  padding: 8rpx 16rpx;
}

.dark-mode .analysis-tag {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
