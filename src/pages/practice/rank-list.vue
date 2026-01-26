<template>
  <view class="rank-container">
    <view class="rank-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="title">🏆 学霸风云榜</text>
      <text class="subtitle">全网实时排名 TOP 50</text>
    </view>
    
    <scroll-view scroll-y class="rank-list" :style="{ paddingTop: (statusBarHeight + 80) + 'px' }">
      <view class="glass-item" v-for="(item, index) in rankList" :key="index">
        <view class="left-section">
          <view v-if="index < 3" class="rank-badge" :class="'top'+(index+1)">{{ index + 1 }}</view>
          <text v-else class="rank-num">{{ index + 1 }}</text>
          
          <image :src="item.avatarUrl || item.avatar || '/static/tabbar/profile.png'" class="avatar" mode="aspectFill"></image>
          <text class="nickname">{{ item.nickName || item.name || '神秘学霸' }}</text>
        </view>
        <view class="right-section">
          <text class="score">{{ item.score || 0 }}</text>
          <text class="unit">分</text>
        </view>
      </view>
      
      <view v-if="loading" class="loading-tip">加载中...</view>
      <view v-else-if="rankList.length === 0" class="empty-tip">
        <text>暂无数据，快去 PK 抢占榜首！</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { lafService } from '../../services/lafService.js'
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

export default {
  data() {
    return {
      statusBarHeight: 44,
      rankList: [],
      loading: true
    }
  },
  onLoad() {
    // 获取系统栏高度
    const sys = uni.getSystemInfoSync();
    this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
  },
  onShow() {
    this.fetchRank();
  },
  methods: {
    async fetchRank() {
      logger.log('[rank-list] 🏆 开始获取排行榜数据');
      this.loading = true;
      
      try {
        const userId = uni.getStorageSync('EXAM_USER_ID') || '';
        logger.log('[rank-list] 📤 发送 API 请求:', {
          url: '/rank-center',
          action: 'get_rank',
          userId: userId || '未登录'
        });
        
        const res = await lafService.request('/rank-center', {
          action: 'get_rank',
          userId: userId
        });
        
        logger.log('[rank-list] 📥 API 响应:', {
          code: res?.code,
          hasData: !!res?.data,
          dataType: Array.isArray(res?.data) ? 'array' : typeof res?.data,
          dataLength: Array.isArray(res?.data) ? res.data.length : 0
        });
        
        if (res && res.code === 0 && res.data) {
          let rankData = Array.isArray(res.data) ? res.data : [];
          
          // 数据排序：确保按分数降序排列
          rankData = rankData.sort((a, b) => {
            const scoreA = Number(a.score) || 0;
            const scoreB = Number(b.score) || 0;
            return scoreB - scoreA; // 降序
          });
          
          // 限制显示前 50 名
          this.rankList = rankData.slice(0, 50);
          
          logger.log('[rank-list] ✅ 排行榜数据加载成功:', {
            totalCount: rankData.length,
            displayCount: this.rankList.length,
            top3Scores: this.rankList.slice(0, 3).map(item => ({
              name: item.nickName || item.name,
              score: item.score
            })),
            isSorted: this.validateSorting(this.rankList)
          });
        } else {
          // 如果接口不存在或返回错误，使用本地模拟数据
          logger.warn('[rank-list] ⚠️ 排行榜接口未返回有效数据，使用模拟数据');
          logger.log('[rank-list] 📊 响应详情:', {
            code: res?.code,
            message: res?.message,
            data: res?.data
          });
          this.rankList = this.getMockRankData();
        }
      } catch (e) {
        logger.error('[rank-list] ❌ 获取榜单失败:', e);
        logger.log('[rank-list] 📊 错误详情:', {
          message: e.message || e,
          error: e
        });
        // 降级方案：使用本地模拟数据
        this.rankList = this.getMockRankData();
        uni.showToast({ 
          title: '网络异常，显示模拟数据', 
          icon: 'none',
          duration: 2000
        });
      } finally {
        this.loading = false;
        logger.log('[rank-list] ✅ 排行榜加载流程结束，当前列表数量:', this.rankList.length);
      }
    },
    validateSorting(list) {
      // 验证排序是否正确（降序）
      if (list.length <= 1) return true;
      for (let i = 0; i < list.length - 1; i++) {
        const current = Number(list[i].score) || 0;
        const next = Number(list[i + 1].score) || 0;
        if (current < next) {
          logger.warn('[rank-list] ⚠️ 排序验证失败: 第', i + 1, '名分数', current, '小于第', i + 2, '名分数', next);
          return false;
        }
      }
      return true;
    },
    getMockRankData() {
      // 返回模拟数据，确保页面可以正常显示（已按分数降序排列）
      logger.log('[rank-list] 📦 使用模拟数据（降级方案）');
      return [
        { nickName: '考研一哥', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=King', score: 2840 },
        { nickName: '上岸锦鲤', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky', score: 2620 },
        { nickName: '学霸张', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang', score: 2450 },
        { nickName: '满分狂魔', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Perfect', score: 2280 },
        { nickName: '知识库', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Library', score: 2100 },
        { nickName: '逻辑帝', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Logic', score: 1950 },
        { nickName: '英语大魔王', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=English', score: 1800 },
        { nickName: '凌晨四点', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Night', score: 1650 },
        { nickName: '刷题机器', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Machine', score: 1500 },
        { nickName: '知识收割机', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Harvest', score: 1350 }
      ];
    }
  }
}
</script>

<style scoped>
.rank-container {
  min-height: 100vh;
  background: var(--bg-body);
  padding: 20rpx;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
  position: relative;
}

.rank-header { 
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border-bottom: 1rpx solid var(--border);
  padding: 20rpx;
  text-align: center;
}

.title { 
  color: var(--primary); 
  font-size: 48rpx; 
  font-weight: bold; 
  display: block;
  text-shadow: var(--shadow-text);
}

.subtitle { 
  color: var(--text-tertiary); 
  font-size: 24rpx; 
  margin-top: 10rpx; 
  display: block; 
  letter-spacing: 4rpx;
}

.rank-list {
  padding: 20rpx;
  box-sizing: border-box;
}

.glass-item {
  background: var(--bg-glass);
  border: 1rpx solid var(--border);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  backdrop-filter: blur(10px);
  transition: all 0.3s;
}

.glass-item:active {
  transform: scale(0.98);
  background: var(--bg-secondary);
}

.left-section { 
  display: flex; 
  align-items: center;
  flex: 1;
}

.rank-badge { 
  width: 48rpx; 
  height: 48rpx; 
  border-radius: 50%; 
  text-align: center; 
  line-height: 48rpx; 
  color: var(--text-inverse); 
  font-weight: bold; 
  font-size: 24rpx; 
  margin-right: 24rpx;
  flex-shrink: 0;
}

.rank-badge.top1 { 
  background: var(--gradient-primary);
  box-shadow: var(--shadow-success);
  animation: goldGlow 2s infinite;
}

.rank-badge.top2 { 
  background: linear-gradient(135deg, var(--text-tertiary), var(--text-sub));
  box-shadow: var(--shadow-sm);
}

.rank-badge.top3 { 
  background: linear-gradient(135deg, var(--warning-yellow), var(--warning-yellow-dark));
  box-shadow: var(--shadow-sm);
}

@keyframes goldGlow {
  0%, 100% { box-shadow: var(--shadow-success); }
  50% { box-shadow: var(--shadow-lg); }
}

.rank-num { 
  width: 48rpx; 
  text-align: center; 
  color: var(--text-tertiary); 
  font-weight: bold; 
  font-size: 28rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.avatar { 
  width: 80rpx; 
  height: 80rpx; 
  border-radius: 50%; 
  margin-right: 24rpx; 
  border: 2rpx solid var(--primary-light);
  flex-shrink: 0;
}

.nickname { 
  color: var(--text-primary); 
  font-size: 28rpx;
  max-width: 300rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.right-section {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
}

.score { 
  color: var(--primary); 
  font-size: 40rpx; 
  font-weight: bold; 
  font-family: 'DIN Alternate', sans-serif;
  text-shadow: var(--shadow-text);
}

.unit { 
  color: var(--text-tertiary); 
  font-size: 24rpx; 
  margin-left: 8rpx;
}

.empty-tip, .loading-tip { 
  text-align: center; 
  color: var(--text-tertiary); 
  margin-top: 100rpx; 
  font-size: 28rpx;
  padding: 40rpx;
}
</style>