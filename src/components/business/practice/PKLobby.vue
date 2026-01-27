<template>
  <view class="pk-lobby-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部用户信息 -->
    <view class="user-section">
      <view class="user-card">
        <image class="user-avatar" :src="userInfo.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError($event, userInfo, 'avatarUrl')"></image>
        <view class="user-info">
          <text class="user-name">{{ userInfo.nickName || '考研人' }}</text>
          <view class="rank-badge" :style="{ background: rankInfo.color }">
            <text class="rank-icon">{{ rankInfo.icon }}</text>
            <text class="rank-name">{{ rankInfo.name }}</text>
          </view>
        </view>
        <view class="rating-display">
          <text class="rating-value">{{ userRating }}</text>
          <text class="rating-label">ELO 评分</text>
        </view>
      </view>
      
      <!-- 段位进度 -->
      <view class="rank-progress">
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: rankInfo.progress + '%', background: rankInfo.color }"></view>
        </view>
        <text class="progress-text" v-if="rankInfo.pointsToNext > 0">
          距离下一段位还需 {{ rankInfo.pointsToNext }} 分
        </text>
        <text class="progress-text" v-else>已达最高段位</text>
      </view>
    </view>
    
    <!-- 战绩统计 -->
    <view class="stats-section">
      <view class="stats-card">
        <view class="stat-item">
          <text class="stat-value">{{ userStats.totalMatches }}</text>
          <text class="stat-label">总场次</text>
        </view>
        <view class="stat-item win">
          <text class="stat-value">{{ userStats.wins }}</text>
          <text class="stat-label">胜利</text>
        </view>
        <view class="stat-item lose">
          <text class="stat-value">{{ userStats.losses }}</text>
          <text class="stat-label">失败</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ userStats.winRate }}</text>
          <text class="stat-label">胜率</text>
        </view>
      </view>
      
      <!-- 近期战绩 -->
      <view class="recent-form" v-if="userStats.recentForm">
        <text class="form-label">近期战绩：</text>
        <view class="form-badges">
          <text 
            v-for="(result, idx) in userStats.recentForm.split('')" 
            :key="idx"
            :class="['form-badge', result === 'W' ? 'win' : result === 'L' ? 'lose' : 'draw']"
          >
            {{ result }}
          </text>
        </view>
      </view>
    </view>
    
    <!-- 匹配按钮 -->
    <view class="match-section">
      <button class="match-btn" :class="{ 'matching': isMatching }" hover-class="btn-hover" @tap="startMatch" :disabled="isMatching">
        <view class="btn-content" v-if="!isMatching">
          <text class="btn-icon">⚔️</text>
          <text class="btn-text">开始匹配</text>
        </view>
        <view class="btn-content matching" v-else>
          <view class="loading-spinner"></view>
          <text class="btn-text">{{ matchingText }}</text>
        </view>
      </button>
      
      <text class="match-tip">基于 ELO 评分匹配实力相当的对手</text>
    </view>
    
    <!-- 匹配动画遮罩 -->
    <view class="matching-overlay" v-if="isMatching">
      <view class="matching-animation">
        <!-- 雷达扫描动画 -->
        <view class="radar-container">
          <view class="radar-circle r1"></view>
          <view class="radar-circle r2"></view>
          <view class="radar-circle r3"></view>
          <view class="radar-line"></view>
          <view class="radar-center">
            <image class="center-avatar" :src="userInfo.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError($event, userInfo, 'avatarUrl')"></image>
          </view>
        </view>
        
        <!-- 匹配状态文字 -->
        <view class="matching-status">
          <text class="status-text">{{ matchingText }}</text>
          <text class="status-sub">评分范围：{{ userRating - 200 }} - {{ userRating + 200 }}</text>
        </view>
        
        <!-- 取消按钮 -->
        <button class="cancel-btn" hover-class="btn-hover" @tap="cancelMatch">取消匹配</button>
      </view>
    </view>
    
    <!-- 匹配成功动画 -->
    <view class="match-found-overlay" v-if="showMatchFound">
      <view class="match-found-content">
        <view class="vs-animation">
          <view class="player-side left">
            <image class="player-avatar" :src="userInfo.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError($event, userInfo, 'avatarUrl')"></image>
            <text class="player-name">{{ userInfo.nickName || '我' }}</text>
            <text class="player-rating">{{ userRating }}</text>
          </view>
          
          <view class="vs-badge">
            <text class="vs-text">VS</text>
          </view>
          
          <view class="player-side right">
            <image class="player-avatar" :src="opponent.avatar || defaultAvatar" mode="aspectFill" @error="onAvatarError($event, opponent, 'avatar')"></image>
            <text class="player-name">{{ opponent.name }}</text>
            <text class="player-rating">{{ opponent.rating }}</text>
          </view>
        </view>
        
        <text class="found-text">匹配成功！</text>
        <text class="countdown-text">{{ countdown }} 秒后开始对战</text>
      </view>
    </view>
    
    <!-- 对战历史 -->
    <view class="history-section" v-if="matchHistory.length > 0">
      <view class="section-header">
        <text class="section-title">对战历史</text>
        <text class="section-more" @tap="viewAllHistory">查看全部</text>
      </view>
      
      <view class="history-list">
        <view 
          class="history-item" 
          v-for="(record, idx) in matchHistory.slice(0, 5)" 
          :key="idx"
          :class="{ 'win': record.ratingChange > 0, 'lose': record.ratingChange < 0 }"
        >
          <image class="opponent-avatar" :src="record.opponent.avatar || defaultAvatar" mode="aspectFill" @error="onAvatarError($event, record.opponent, 'avatar')"></image>
          <view class="match-info">
            <text class="opponent-name">{{ record.opponent.name }}</text>
            <text class="match-score">{{ record.userScore }} : {{ record.opponentScore }}</text>
          </view>
          <view class="rating-change" :class="{ 'positive': record.ratingChange > 0 }">
            <text>{{ record.ratingChange > 0 ? '+' : '' }}{{ record.ratingChange }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { eloMatchmaker } from '../../utils/practice/elo-matchmaker.js';

export default {
  name: 'PKLobby',
  data() {
    return {
      isDark: false,
      userInfo: {},
      defaultAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
      userRating: 1000,
      rankInfo: {},
      userStats: {},
      matchHistory: [],
      isMatching: false,
      matchingText: '正在寻找对手...',
      showMatchFound: false,
      opponent: {},
      countdown: 3
    };
  },
  onLoad() {
    this.initData();
  },
  onShow() {
    this.refreshData();
  },
  methods: {
    // 头像加载失败处理
    onAvatarError(e, obj, key = 'avatar') {
      if (obj) {
        this.$set(obj, key, this.defaultAvatar);
      }
    },
    
    initData() {
      // 获取用户信息
      this.userInfo = uni.getStorageSync('userInfo') || { nickName: '考研人', avatarUrl: '' };
      this.isDark = uni.getStorageSync('theme_mode') === 'dark';
      
      this.refreshData();
    },
    
    refreshData() {
      // 获取 ELO 评分
      this.userRating = eloMatchmaker.getUserRating();
      
      // 获取段位信息
      this.rankInfo = eloMatchmaker.getRankInfo();
      
      // 获取用户统计
      this.userStats = eloMatchmaker.getUserStats();
      
      // 获取对战历史
      this.matchHistory = eloMatchmaker.getMatchHistory(10);
    },
    
    async startMatch() {
      if (this.isMatching) return;
      
      this.isMatching = true;
      this.matchingText = '正在寻找实力相当的研友...';
      
      try {
        const result = await eloMatchmaker.startMatching({
          onProgress: (progress) => {
            this.matchingText = progress.text;
          },
          onFound: (opponent) => {
            this.opponent = opponent;
          }
        });
        
        if (result.success) {
          this.isMatching = false;
          this.showMatchFound = true;
          
          // 3秒倒计时
          this.countdown = 3;
          const countdownTimer = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) {
              clearInterval(countdownTimer);
              this.showMatchFound = false;
              // 跳转到对战页面
              this.goToBattle();
            }
          }, 1000);
        }
      } catch (error) {
        console.error('[PKLobby] 匹配失败:', error);
        this.isMatching = false;
        uni.showToast({
          title: '匹配失败，请重试',
          icon: 'none'
        });
      }
    },
    
    cancelMatch() {
      this.isMatching = false;
      this.matchingText = '正在寻找对手...';
    },
    
    goToBattle() {
      // 将对手信息传递给对战页面
      const opponentStr = encodeURIComponent(JSON.stringify(this.opponent));
      uni.navigateTo({
        url: `/pages/practice/pk-battle?opponent=${opponentStr}`
      });
    },
    
    viewAllHistory() {
      uni.navigateTo({
        url: '/pages/practice/rank-list'
      });
    }
  }
};
</script>

<style scoped>
.pk-lobby-container {
  min-height: 100vh;
  background: var(--bg-page, #f5f5f5);
  padding: 30rpx;
  padding-bottom: 200rpx;
}

/* 用户信息区 */
.user-section {
  background: var(--bg-card, #ffffff);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.user-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  border: 4rpx solid var(--primary, #007aff);
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  display: block;
  margin-bottom: 8rpx;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.rank-icon {
  font-size: 24rpx;
}

.rank-name {
  font-size: 22rpx;
  color: #ffffff;
  font-weight: 600;
}

.rating-display {
  text-align: center;
}

.rating-value {
  font-size: 48rpx;
  font-weight: 800;
  color: var(--primary, #007aff);
  display: block;
}

.rating-label {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
}

.rank-progress {
  margin-top: 20rpx;
}

.progress-bar {
  height: 12rpx;
  background: var(--bg-secondary, #f0f0f0);
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  display: block;
  text-align: center;
  margin-top: 10rpx;
}

/* 战绩统计 */
.stats-section {
  background: var(--bg-card, #ffffff);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.stats-card {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  display: block;
}

.stat-item.win .stat-value {
  color: var(--success, #34c759);
}

.stat-item.lose .stat-value {
  color: var(--danger, #ff3b30);
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
}

.recent-form {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1px solid var(--border, #eee);
}

.form-label {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  margin-right: 10rpx;
}

.form-badges {
  display: flex;
  gap: 8rpx;
}

.form-badge {
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
  color: #ffffff;
}

.form-badge.win {
  background: var(--success, #34c759);
}

.form-badge.lose {
  background: var(--danger, #ff3b30);
}

.form-badge.draw {
  background: var(--warning, #ff9500);
}

/* 匹配按钮 */
.match-section {
  text-align: center;
  margin-bottom: 30rpx;
}

.match-btn {
  width: 100%;
  height: 100rpx;
  background: linear-gradient(135deg, var(--primary, #007aff), #5856d6);
  border-radius: 50rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 30rpx rgba(0, 122, 255, 0.3);
}

.match-btn.matching {
  background: var(--bg-secondary, #f0f0f0);
  box-shadow: none;
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.btn-icon {
  font-size: 40rpx;
}

.btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}

.match-btn.matching .btn-text {
  color: var(--text-secondary, #666);
}

.loading-spinner {
  width: 36rpx;
  height: 36rpx;
  border: 4rpx solid var(--border, #ddd);
  border-top-color: var(--primary, #007aff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.match-tip {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  display: block;
  margin-top: 16rpx;
}

/* 匹配动画遮罩 */
.matching-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.matching-animation {
  text-align: center;
}

.radar-container {
  width: 400rpx;
  height: 400rpx;
  position: relative;
  margin: 0 auto 40rpx;
}

.radar-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 2rpx solid rgba(0, 122, 255, 0.3);
  border-radius: 50%;
}

.radar-circle.r1 {
  width: 150rpx;
  height: 150rpx;
  animation: radarPulse 2s ease-out infinite;
}

.radar-circle.r2 {
  width: 250rpx;
  height: 250rpx;
  animation: radarPulse 2s ease-out infinite 0.5s;
}

.radar-circle.r3 {
  width: 350rpx;
  height: 350rpx;
  animation: radarPulse 2s ease-out infinite 1s;
}

@keyframes radarPulse {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
}

.radar-line {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 50%;
  height: 4rpx;
  background: linear-gradient(90deg, var(--primary, #007aff), transparent);
  transform-origin: left center;
  animation: radarScan 2s linear infinite;
}

@keyframes radarScan {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.radar-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 4rpx solid var(--primary, #007aff);
}

.center-avatar {
  width: 100%;
  height: 100%;
}

.matching-status {
  margin-bottom: 40rpx;
}

.status-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
  display: block;
  margin-bottom: 10rpx;
}

.status-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
}

.cancel-btn {
  background: transparent;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
  padding: 16rpx 60rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
}

/* 匹配成功动画 */
.match-found-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.match-found-content {
  text-align: center;
  animation: matchFoundIn 0.5s ease-out;
}

@keyframes matchFoundIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.vs-animation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40rpx;
  margin-bottom: 40rpx;
}

.player-side {
  text-align: center;
}

.player-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid var(--primary, #007aff);
  margin-bottom: 16rpx;
}

.player-side.right .player-avatar {
  border-color: var(--danger, #ff3b30);
}

.player-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #ffffff;
  display: block;
  margin-bottom: 8rpx;
}

.player-rating {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
}

.vs-badge {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #ff9500, #ff3b30);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vsPulse 1s ease-in-out infinite;
}

@keyframes vsPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.vs-text {
  font-size: 28rpx;
  font-weight: 900;
  color: #ffffff;
}

.found-text {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--success, #34c759);
  display: block;
  margin-bottom: 16rpx;
}

.countdown-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

/* 对战历史 */
.history-section {
  background: var(--bg-card, #ffffff);
  border-radius: 24rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.section-more {
  font-size: 26rpx;
  color: var(--primary, #007aff);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 16rpx;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 16rpx;
  border-left: 6rpx solid var(--border, #ddd);
}

.history-item.win {
  border-left-color: var(--success, #34c759);
}

.history-item.lose {
  border-left-color: var(--danger, #ff3b30);
}

.opponent-avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  margin-right: 16rpx;
}

.match-info {
  flex: 1;
}

.opponent-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  display: block;
}

.match-score {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
}

.rating-change {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--danger, #ff3b30);
}

.rating-change.positive {
  color: var(--success, #34c759);
}

/* 暗色模式 */
.dark-mode {
  background: var(--bg-page-dark, #000000);
}

.dark-mode .user-section,
.dark-mode .stats-section,
.dark-mode .history-section {
  background: var(--bg-card-dark, #1c1c1e);
}

.dark-mode .user-name,
.dark-mode .stat-value,
.dark-mode .section-title,
.dark-mode .opponent-name {
  color: var(--text-primary-dark, #ffffff);
}

.dark-mode .rating-label,
.dark-mode .stat-label,
.dark-mode .progress-text,
.dark-mode .form-label,
.dark-mode .match-tip,
.dark-mode .match-score {
  color: var(--text-secondary-dark, #8e8e93);
}

.dark-mode .progress-bar,
.dark-mode .history-item {
  background: var(--bg-secondary-dark, #2c2c2e);
}

.dark-mode .recent-form {
  border-top-color: var(--border-dark, #3a3a3c);
}
</style>
