<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar">
      <!-- 状态栏占位 -->
      <view class="status-bar" />

      <!-- 导航栏内容 -->
      <view class="navbar-content">
        <view class="navbar-left" @tap="goBack">
          <text class="back-icon">
            ‹
          </text>
        </view>
        <view class="navbar-center">
          <text class="navbar-title">
            我的好友
          </text>
        </view>
        <view class="navbar-right" />
      </view>
    </view>

    <!-- 顶部搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrapper">
        <BaseIcon name="search" :size="32" class="search-icon" />
        <input
          v-model="searchKeyword"
          class="search-input"
          type="text"
          placeholder="搜索用户昵称"
          confirm-type="search"
          maxlength="30"
          @confirm="handleSearch"
          @input="debouncedSearch"
        />
        <BaseIcon
          v-if="searchKeyword"
          name="close"
          :size="32"
          class="clear-icon"
          @tap="clearSearch"
        />
      </view>
      <button v-if="searchKeyword" class="search-btn" @tap="handleSearch">
        <text>搜索</text>
      </button>
    </view>

    <!-- Tabs 切换 -->
    <view class="tabs-bar">
      <view class="tab-item" :class="{ active: currentTab === 'friends' }" @tap="switchTab('friends')">
        <text class="tab-text">
          我的好友
        </text>
        <view v-if="currentTab === 'friends'" class="tab-indicator" />
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'requests' }" @tap="switchTab('requests')">
        <text class="tab-text">
          好友请求
        </text>
        <view v-if="pendingRequestsCount > 0" class="red-dot">
          {{ pendingRequestsCount }}
        </view>
        <view v-if="currentTab === 'requests'" class="tab-indicator" />
      </view>
    </view>

    <!-- 内容区域 -->
    <scroll-view
      class="content-scroll"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 搜索结果模式 -->
      <view v-if="isSearchMode">
        <!-- 加载中 -->
        <view v-if="isSearching" class="loading-state">
          <view class="loading-spinner" />
          <text class="loading-text">
            搜索中...
          </text>
        </view>

        <!-- 搜索结果 -->
        <view v-else-if="searchResults.length > 0" class="search-results">
          <view
            v-for="user in searchResults"
            :key="user._id"
            class="user-card"
            @tap="handleAddFriend(user)"
          >
            <image
              class="avatar"
              :src="user.avatar || defaultAvatar"
              mode="aspectFill"
              lazy-load
              @error="onAvatarError($event, user)"
            />
            <view class="info-section">
              <text class="nickname">
                {{ user.nickname || '未命名' }}
              </text>
              <text class="score-text">
                总分: {{ user.score || 0 }}
              </text>
            </view>
            <button class="add-friend-btn" :disabled="isAddingFriend[user._id]" @tap.stop="handleAddFriend(user)">
              <BaseIcon v-if="!isAddingFriend[user._id]" name="sparkle" :size="24" />
              <text>{{ isAddingFriend[user._id] ? '发送中...' : '添加' }}</text>
            </button>
          </view>
        </view>

        <!-- 搜索无结果 -->
        <BaseEmpty
          v-else
          icon="🔍"
          title="未找到用户"
          desc="试试搜索其他昵称"
        />
      </view>

      <!-- 我的好友 Tab -->
      <view v-else-if="currentTab === 'friends'">
        <!-- 加载中 -->
        <view v-if="isLoading && friendList.length === 0" class="loading-state">
          <view class="loading-spinner" />
          <text class="loading-text">
            加载中...
          </text>
        </view>

        <!-- 空状态 -->
        <BaseEmpty
          v-else-if="!isLoading && friendList.length === 0"
          icon="👥"
          title="还没有好友"
          desc="快去搜索添加好友，一起刷题吧！"
        />

        <!-- 好友卡片列表 -->
        <view v-else class="friend-cards">
          <view
            v-for="friend in filteredFriendList"
            :key="friend.uid"
            class="friend-card"
            @tap="goToFriendProfile(friend)"
          >
            <!-- 头像 -->
            <view class="avatar-wrapper">
              <image
                class="avatar"
                :src="friend.avatar || defaultAvatar"
                mode="aspectFill"
                lazy-load
                @error="onAvatarError($event, friend)"
              />
              <!-- 在线状态指示器（模拟） -->
              <view v-if="isOnline(friend)" class="online-indicator" />
            </view>

            <!-- 信息区 -->
            <view class="info-section">
              <view class="name-row">
                <text class="nickname">
                  {{ friend.nickname || '未命名' }}
                </text>
                <text v-if="friend.score" class="level-badge">
                  Lv.{{ Math.floor(friend.score / 100) }}
                </text>
              </view>
              <text class="status-text">
                {{ getStatusText(friend) }}
              </text>
            </view>

            <!-- 分数 -->
            <view class="score-section">
              <text class="score-value">
                {{ friend.score || 0 }}
              </text>
              <text class="score-label">
                总分
              </text>
            </view>

            <!-- PK 挑战按钮 -->
            <button class="pk-btn" @tap.stop="handlePKChallenge(friend)">
              <BaseIcon name="flame" :size="28" class="pk-icon" />
              <text class="pk-text">
                PK
              </text>
            </button>
          </view>
        </view>
      </view>

      <!-- 好友请求 Tab -->
      <view v-else-if="currentTab === 'requests'">
        <!-- 加载中 -->
        <view v-if="isLoadingRequests && requestList.length === 0" class="loading-state">
          <view class="loading-spinner" />
          <text class="loading-text">
            加载中...
          </text>
        </view>

        <!-- 空状态 -->
        <view v-else-if="!isLoadingRequests && requestList.length === 0" class="empty-state">
          <BaseIcon name="email" :size="120" class="empty-icon" />
          <text class="empty-title">
            暂无好友请求
          </text>
          <text class="empty-desc">
            当有人向你发送好友请求时，会显示在这里
          </text>
        </view>

        <!-- 请求卡片列表 -->
        <view v-else class="request-cards">
          <view v-for="request in requestList" :key="request.from_uid" class="request-card">
            <!-- 头像 -->
            <image
              class="avatar"
              :src="request.from_avatar || defaultAvatar"
              mode="aspectFill"
              lazy-load
              @error="onAvatarError($event, request, 'from_avatar')"
            />

            <!-- 信息区 -->
            <view class="info-section">
              <text class="nickname">
                {{ request.from_nickname || '未命名' }}
              </text>
              <text v-if="request.message" class="message">
                {{ request.message }}
              </text>
              <text class="time">
                {{ formatTime(request.created_at) }}
              </text>
            </view>

            <!-- 操作按钮 -->
            <view class="action-btns">
              <button class="accept-btn" :disabled="isAccepting[request.from_uid]" @tap.stop="handleAccept(request)">
                <text>{{ isAccepting[request.from_uid] ? '处理中' : '接受' }}</text>
              </button>
              <button class="reject-btn" :disabled="isRejecting[request.from_uid]" @tap.stop="handleReject(request)">
                <text>{{ isRejecting[request.from_uid] ? '处理中' : '拒绝' }}</text>
              </button>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部统计 -->
    <view v-if="friendList.length > 0" class="bottom-stats">
      <text class="stats-text">
        共 {{ friendList.length }} 位好友
      </text>
    </view>
  </view>
</template>

<script>
import { socialService } from './socialService.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';
// 防抖工具
import { debounce } from '@/utils/throttle.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: {
    BaseEmpty,
    BaseIcon
  },
  data() {
    return {
      isDark: false,
      currentTab: 'friends', // 'friends' | 'requests'
      searchKeyword: '',
      friendList: [],
      requestList: [],
      searchResults: [],
      isLoading: false,
      isLoadingRequests: false,
      isRefreshing: false,
      isSearching: false,
      isSearchMode: false,
      defaultAvatar: DEFAULT_AVATAR,
      // 防重复点击
      isAddingFriend: {}, // { [userId]: boolean }
      isAccepting: {}, // { [requestId]: boolean }
      isRejecting: {}, // { [requestId]: boolean }
      // 防抖搜索函数
      debouncedSearch: null
    };
  },
  computed: {
    // 待处理的好友请求数量
    pendingRequestsCount() {
      return this.requestList.length;
    },
    // 过滤后的好友列表（根据搜索关键词）
    filteredFriendList() {
      if (!this.searchKeyword.trim()) {
        return this.friendList;
      }

      const keyword = this.searchKeyword.toLowerCase();
      return this.friendList.filter((friend) => friend.nickname?.toLowerCase().includes(keyword));
    }
  },
  created() {
    // 初始化防抖搜索函数（300ms 延迟）
    this.debouncedSearch = debounce(this.handleSearch, 300);
  },
  onLoad() {
    logger.log('[FriendList] 页面加载');
    this.isDark = storageService.get('theme_mode') === 'dark';
    // ✅ F024: 监听主题实时切换
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);
    this.loadFriendList();
    this.loadFriendRequests();
    this._loadedOnce = true;
  },
  onShow() {
    logger.log('[FriendList] 页面显示');
    // 首次进入时 onLoad 已加载，跳过 onShow 的重复请求
    if (!this._loadedOnce) {
      this.loadFriendList(false);
      this.loadFriendRequests();
    }
    this._loadedOnce = false;
  },
  onPullDownRefresh() {
    logger.log('[FriendList] 下拉刷新');
    this.onRefresh();
  },
  onUnload() {
    // ✅ F024: 清理主题监听，防止内存泄漏
    if (this._themeHandler) {
      uni.$off('themeUpdate', this._themeHandler);
    }
  },
  methods: {
    /**
     * 头像加载失败处理
     */
    onAvatarError(e, obj, key = 'avatar') {
      if (obj) {
        obj[key] = this.defaultAvatar;
      }
    },

    /**
     * 返回上一页
     */
    goBack() {
      uni.navigateBack({
        delta: 1,
        fail: () => {
          // 如果无法返回（例如直接访问），跳转到设置页面
          uni.switchTab({
            url: '/pages/profile/index'
          });
        }
      });
    },

    /**
     * 加载好友列表
     */
    async loadFriendList(showLoading = true) {
      if (showLoading) {
        this.isLoading = true;
      }

      try {
        logger.log('[FriendList] 开始加载好友列表');

        const res = await socialService.getFriendList('score', !showLoading);

        logger.log('[FriendList] 加载结果:', res);

        if (res.code === 0) {
          // 映射后端字段到前端格式
          // 后端: _id, nickname, avatar_url, streak_days, total_questions
          // 前端: uid, nickname, avatar, score, last_active
          this.friendList = (res.data || []).map((friend) => ({
            ...friend,
            uid: friend._id || friend.uid,
            nickname: friend.nickname || '未命名',
            avatar: friend.avatar_url || friend.avatar || this.defaultAvatar,
            avatar_url: friend.avatar_url || friend.avatar || this.defaultAvatar,
            score: friend.total_questions || friend.score || 0,
            studyDays: friend.streak_days || friend.studyDays || 0,
            accuracy:
              friend.correct_questions && friend.total_questions
                ? Math.round((friend.correct_questions / friend.total_questions) * 100)
                : friend.accuracy || 0,
            last_active: friend.last_study_date || friend.last_active || 0
          }));
          logger.log('[FriendList] 好友数量:', this.friendList.length);
        } else {
          logger.error('[FriendList] 加载失败:', res.msg || res.message);
          uni.showToast({
            title: res.msg || res.message || '加载失败',
            icon: 'none'
          });
        }
      } catch (err) {
        logger.error('[FriendList] 加载异常:', err);
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        });
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
        uni.stopPullDownRefresh();
      }
    },

    /**
     * 下拉刷新
     */
    async onRefresh() {
      logger.log('[FriendList] 刷新好友列表');
      this.isRefreshing = true;
      // 清除缓存，强制从云端获取
      socialService.clearCache();
      await this.loadFriendList(false);
    },

    /**
     * 切换 Tab
     */
    switchTab(tab) {
      logger.log('[FriendList] 切换 Tab:', tab);
      this.currentTab = tab;
      this.isSearchMode = false;
      this.searchKeyword = '';
      this.searchResults = [];
    },

    /**
     * 搜索用户（云端搜索）
     */
    async handleSearch() {
      if (!this.searchKeyword || this.searchKeyword.trim().length < 2) {
        uni.showToast({
          title: '请输入至少2个字符',
          icon: 'none'
        });
        return;
      }

      logger.log('[FriendList] 搜索用户:', this.searchKeyword);
      this.isSearching = true;
      this.isSearchMode = true;

      try {
        const res = await socialService.searchUser(this.searchKeyword.trim());

        if (res.code === 0) {
          this.searchResults = res.data || [];
          logger.log('[FriendList] 搜索结果:', this.searchResults.length, '个用户');
        } else {
          logger.error('[FriendList] 搜索失败:', res.msg);
          uni.showToast({
            title: res.msg || '搜索失败',
            icon: 'none'
          });
        }
      } catch (err) {
        logger.error('[FriendList] 搜索异常:', err);
        uni.showToast({
          title: '搜索失败',
          icon: 'none'
        });
      } finally {
        this.isSearching = false;
      }
    },

    /**
     * 清除搜索
     */
    clearSearch() {
      this.searchKeyword = '';
      this.isSearchMode = false;
      this.searchResults = [];
    },

    /**
     * 加载好友请求列表
     */
    async loadFriendRequests() {
      this.isLoadingRequests = true;

      try {
        logger.log('[FriendList] 开始加载好友请求列表');

        const res = await socialService.getFriendRequests();

        logger.log('[FriendList] 好友请求结果:', res);

        if (res.code === 0) {
          // 映射后端字段到前端格式
          // 后端返回: { user_id, requester_info: { _id, nickname, avatar_url, streak_days } }
          // 前端期望: { from_uid, from_nickname, from_avatar, message, created_at }
          this.requestList = (res.data || []).map((request) => ({
            ...request,
            from_uid: request.user_id || request.from_uid,
            from_nickname: request.requester_info?.nickname || request.from_nickname || '未命名',
            from_avatar: request.requester_info?.avatar_url || request.from_avatar || this.defaultAvatar,
            message: request.request_message || request.message || '',
            created_at: request.created_at || Date.now()
          }));
          logger.log('[FriendList] 好友请求数量:', this.requestList.length);
        } else {
          logger.error('[FriendList] 加载好友请求失败:', res.msg || res.message);
        }
      } catch (err) {
        logger.error('[FriendList] 加载好友请求异常:', err);
        // 静默失败，不打扰用户（好友请求非核心功能）
      } finally {
        this.isLoadingRequests = false;
      }
    },

    /**
     * 添加好友
     */
    async handleAddFriend(user) {
      // 防重复点击
      if (this.isAddingFriend[user._id]) return;

      logger.log('[FriendList] 添加好友:', user.nickname);

      uni.showModal({
        title: '添加好友',
        content: `确定要添加 ${user.nickname} 为好友吗？`,
        success: async (res) => {
          if (res.confirm) {
            this.isAddingFriend[user._id] = true;
            uni.showLoading({ title: '发送中...' });

            try {
              const result = await socialService.sendRequest(user._id, '你好，我想加你为好友');

              uni.hideLoading();

              if (result.code === 0) {
                uni.showToast({
                  title: '好友请求已发送',
                  icon: 'success'
                });
                // 清除搜索结果
                this.clearSearch();
              } else {
                uni.showToast({
                  title: result.msg || '发送失败',
                  icon: 'none'
                });
              }
            } catch (err) {
              uni.hideLoading();
              logger.error('[FriendList] 发送好友请求失败:', err);
              uni.showToast({
                title: '发送失败',
                icon: 'none'
              });
            } finally {
              this.isAddingFriend[user._id] = false;
            }
          }
        }
      });
    },

    /**
     * 接受好友请求
     */
    async handleAccept(request) {
      // 防重复点击
      if (this.isAccepting[request.from_uid]) return;

      logger.log('[FriendList] 接受好友请求:', request.from_nickname);

      this.isAccepting[request.from_uid] = true;
      uni.showLoading({ title: '处理中...' });

      try {
        const res = await socialService.handleRequest(request.from_uid, 'accept');

        uni.hideLoading();

        if (res.code === 0) {
          uni.showToast({
            title: '已添加为好友',
            icon: 'success'
          });
          // 刷新列表
          this.loadFriendRequests();
          this.loadFriendList(false);
        } else {
          uni.showToast({
            title: res.msg || '操作失败',
            icon: 'none'
          });
        }
      } catch (err) {
        uni.hideLoading();
        logger.error('[FriendList] 接受好友请求失败:', err);
        uni.showToast({
          title: '操作失败',
          icon: 'none'
        });
      } finally {
        this.isAccepting[request.from_uid] = false;
      }
    },

    /**
     * 拒绝好友请求
     */
    async handleReject(request) {
      // 防重复点击
      if (this.isRejecting[request.from_uid]) return;

      logger.log('[FriendList] 拒绝好友请求:', request.from_nickname);

      uni.showModal({
        title: '确认拒绝',
        content: `确定要拒绝 ${request.from_nickname} 的好友请求吗？`,
        success: async (res) => {
          if (res.confirm) {
            this.isRejecting[request.from_uid] = true;
            uni.showLoading({ title: '处理中...' });

            try {
              const result = await socialService.handleRequest(request.from_uid, 'reject');

              uni.hideLoading();

              if (result.code === 0) {
                uni.showToast({
                  title: '已拒绝',
                  icon: 'success'
                });
                // 刷新列表
                this.loadFriendRequests();
              } else {
                uni.showToast({
                  title: result.msg || '操作失败',
                  icon: 'none'
                });
              }
            } catch (err) {
              uni.hideLoading();
              logger.error('[FriendList] 拒绝好友请求失败:', err);
              uni.showToast({
                title: '操作失败',
                icon: 'none'
              });
            } finally {
              this.isRejecting[request.from_uid] = false;
            }
          }
        }
      });
    },

    /**
     * 跳转到好友资料页
     */
    goToFriendProfile(friend) {
      logger.log('[FriendList] 查看好友资料:', friend.nickname);

      // 使用普通字符串拼接构建URL参数（兼容小程序，避免URLSearchParams不可用）
      const uid = friend.uid || '';
      const nickname = encodeURIComponent(friend.nickname || '未命名');
      const avatar = encodeURIComponent(friend.avatar || this.defaultAvatar);
      const score = friend.score || 0;
      const studyDays = friend.studyDays || 0;
      const accuracy = friend.accuracy || 0;
      const lastActive = friend.last_active || 0;

      const queryStr = `uid=${uid}&nickname=${nickname}&avatar=${avatar}&score=${score}&studyDays=${studyDays}&accuracy=${accuracy}&lastActive=${lastActive}`;

      safeNavigateTo(`/pages/social/friend-profile?${queryStr}`);
    },

    /**
     * 发起 PK 挑战
     */
    handlePKChallenge(friend) {
      logger.log('[FriendList] 发起 PK 挑战:', friend.nickname);

      uni.showModal({
        title: '发起挑战',
        content: `确定要向 ${friend.nickname} 发起 PK 挑战吗？`,
        confirmText: '挑战',
        confirmColor: '#FF3B30',
        success: (res) => {
          if (res.confirm) {
            // 跳转到 PK 对战页面
            safeNavigateTo(
              `/pages/practice-sub/pk-battle?mode=friend&opponentId=${friend.uid}&opponentName=${encodeURIComponent(friend.nickname)}&opponentAvatar=${encodeURIComponent(friend.avatar || this.defaultAvatar)}&opponentScore=${friend.score || 0}`,
              {
                success: () => {
                  logger.log('[FriendList] ✅ 成功跳转到 PK 对战页面');
                }
              }
            );
          }
        }
      });
    },

    /**
     * 判断好友是否在线（模拟）
     */
    isOnline(friend) {
      if (!friend.last_active) return false;

      const now = Date.now();
      const lastActive = friend.last_active;

      // 5分钟内活跃视为在线
      return now - lastActive < 5 * 60 * 1000;
    },

    /**
     * 获取状态文本
     */
    getStatusText(friend) {
      if (this.isOnline(friend)) {
        return '在线';
      }

      if (!friend.last_active) {
        return '很久未见';
      }

      const now = Date.now();
      const diff = now - friend.last_active;

      // 计算时间差
      const minutes = Math.floor(diff / (60 * 1000));
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));

      if (minutes < 60) {
        return `${minutes}分钟前活跃`;
      } else if (hours < 24) {
        return `${hours}小时前活跃`;
      } else if (days < 7) {
        return `${days}天前活跃`;
      } else {
        return '很久未见';
      }
    },

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
      if (!timestamp) return '';

      const now = Date.now();
      const diff = now - timestamp;

      const minutes = Math.floor(diff / (60 * 1000));
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));

      if (minutes < 1) {
        return '刚刚';
      } else if (minutes < 60) {
        return `${minutes}分钟前`;
      } else if (hours < 24) {
        return `${hours}小时前`;
      } else if (days < 7) {
        return `${days}天前`;
      } else {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
/* Wise 风格容器 */
.container {
  min-height: 100vh;
  background-color: var(--bg-body);
  display: flex;
  flex-direction: column;
}

.container.dark-mode {
  background-color: var(--bg-body);
}

/* 自定义导航栏 */
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: var(--bg-card);
  z-index: 999;
  box-shadow: var(--shadow-sm);
}

.dark-mode .custom-navbar {
  background-color: var(--bg-glass);
  border-bottom: 1rpx solid var(--border);
}

.status-bar {
  height: var(--status-bar-height);
  background-color: transparent;
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 32rpx;
}

.navbar-left {
  width: 80rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.back-icon {
  font-size: 48rpx;
  color: var(--text-main, var(--ds-color-text-primary));
  font-weight: 300;
  line-height: 1;
}

.dark-mode .back-icon {
  color: var(--brand-color);
}

.navbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.navbar-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-main, var(--ds-color-text-primary));
}

.dark-mode .navbar-title {
  color: var(--text-main, var(--ds-color-text-primary));
}

.navbar-right {
  width: 80rpx;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 32rpx;
  background-color: var(--bg-card);
  border-bottom: 1rpx solid var(--border);
  margin-top: calc(var(--status-bar-height) + 88rpx);
}

.dark-mode .search-bar {
  background-color: var(--bg-glass);
  border-bottom-color: var(--border);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary);
  border-radius: 24rpx;
  padding: 16rpx 24rpx;
  position: relative;
}

.dark-mode .search-input-wrapper {
  background-color: var(--overlay);
}

.search-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-main, var(--ds-color-text-primary));
  background-color: transparent;
}

.dark-mode .search-input {
  color: var(--text-main, var(--ds-color-text-primary));
}

.search-input::placeholder {
  color: var(--text-sub);
}

.clear-icon {
  font-size: 32rpx;
  color: var(--text-sub);
  padding: 0 12rpx;
}

.search-btn {
  background: var(--gradient-primary);
  color: #ffffff;
  border-radius: 48rpx;
  padding: 16rpx 32rpx;
  font-size: 26rpx;
  font-weight: 600;
  border: none;
  box-shadow: var(--shadow-success);
  min-width: 120rpx;
  text-align: center;
}

.search-btn::after {
  border: none;
}

.search-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
}

/* Tabs 切换栏 */
.tabs-bar {
  display: flex;
  background-color: var(--bg-card);
  border-bottom: 1rpx solid var(--border);
}

.dark-mode .tabs-bar {
  background-color: var(--bg-glass);
  border-bottom-color: var(--border);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  position: relative;
}

.tab-text {
  font-size: 30rpx;
  color: var(--text-sub);
  font-weight: 500;
  transition: all 0.3s;
}

.tab-item.active .tab-text {
  color: var(--text-main, var(--ds-color-text-primary));
  font-weight: 600;
}

.dark-mode .tab-item.active .tab-text {
  color: var(--brand-color);
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 6rpx;
  background: var(--gradient-primary);
  border-radius: 3rpx;
}

.red-dot {
  position: absolute;
  top: 20rpx;
  right: 30%;
  background-color: var(--danger);
  color: #ffffff;
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 20rpx;
  min-width: 32rpx;
  text-align: center;
  font-weight: 600;
}

/* 内容滚动区 */
.content-scroll {
  flex: 1;
  padding: 24rpx 32rpx;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-spinner {
  width: 80rpx;
  height: 80rpx;
  border: 6rpx solid var(--success-light);
  border-top-color: var(--brand-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 24rpx;
  font-size: 28rpx;
  color: var(--text-sub);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
  opacity: 0.3;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main, var(--ds-color-text-primary));
  margin-bottom: 12rpx;
}

.dark-mode .empty-title {
  color: var(--text-main, var(--ds-color-text-primary));
}

.empty-desc {
  font-size: 28rpx;
  color: var(--text-sub);
  margin-bottom: 48rpx;
}

.empty-btn {
  background: var(--gradient-primary);
  color: #ffffff;
  border-radius: 48rpx;
  padding: 24rpx 64rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  box-shadow: var(--shadow-success);
}

.empty-btn::after {
  border: none;
}

/* 好友卡片 */
.friend-cards {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.friend-card {
  background-color: var(--bg-card);
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  box-shadow: var(--shadow-md);
  transition: all 0.3s;
}

.dark-mode .friend-card {
  background-color: var(--bg-glass);
  border: 1rpx solid var(--border);
}

.friend-card:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-sm);
}

/* 头像 */
.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 2rpx solid var(--success-light);
}

.online-indicator {
  position: absolute;
  bottom: 4rpx;
  right: 4rpx;
  width: 20rpx;
  height: 20rpx;
  background-color: var(--success);
  border-radius: 50%;
  border: 3rpx solid var(--bg-card);
}

.dark-mode .online-indicator {
  border-color: var(--bg-glass);
}

/* 信息区 */
.info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.nickname {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main, var(--ds-color-text-primary));
}

.dark-mode .nickname {
  color: var(--text-main, var(--ds-color-text-primary));
}

.level-badge {
  background-color: var(--success-light);
  color: var(--brand-color);
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 600;
}

.status-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 分数区 */
.score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 0 24rpx;
  border-left: 1rpx solid var(--border);
}

.dark-mode .score-section {
  border-left-color: var(--border);
}

.score-value {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--brand-color);
}

.score-label {
  font-size: 20rpx;
  color: var(--text-sub);
}

/* PK 挑战按钮 */
.pk-btn {
  background: var(--gradient-danger);
  color: #ffffff;
  border-radius: 48rpx;
  padding: 16rpx 24rpx;
  font-size: 24rpx;
  font-weight: 600;
  border: none;
  box-shadow: var(--shadow-danger);
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-width: 100rpx;
  justify-content: center;
  flex-shrink: 0;
}

.pk-btn::after {
  border: none;
}

.pk-btn:active {
  opacity: 0.85;
  transform: scale(0.95);
}

.pk-icon {
  font-size: 28rpx;
  line-height: 1;
}

.pk-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #ffffff;
}

/* 底部统计 */
.bottom-stats {
  padding: 24rpx 32rpx;
  text-align: center;
  background-color: var(--bg-card);
  border-top: 1rpx solid var(--border);
}

.dark-mode .bottom-stats {
  background-color: var(--bg-glass);
  border-top-color: var(--border);
}

.stats-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 搜索结果 */
.search-results {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.user-card {
  background-color: var(--bg-card);
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  box-shadow: var(--shadow-md);
}

.dark-mode .user-card {
  background-color: var(--bg-glass);
  border: 1rpx solid var(--border);
}

.user-card .avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 2rpx solid var(--success-light);
}

.user-card .info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.user-card .nickname {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main, var(--ds-color-text-primary));
}

.dark-mode .user-card .nickname {
  color: var(--text-main, var(--ds-color-text-primary));
}

.user-card .score-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

.add-friend-btn {
  background: var(--gradient-primary);
  color: #ffffff;
  border-radius: 48rpx;
  padding: 16rpx 32rpx;
  font-size: 24rpx;
  font-weight: 600;
  border: none;
  box-shadow: var(--shadow-success);
  min-width: 120rpx;
  text-align: center;
}

.add-friend-btn::after {
  border: none;
}

.add-friend-btn:active {
  opacity: 0.85;
  transform: scale(0.95);
}

/* 好友请求卡片 */
.request-cards {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.request-card {
  background-color: var(--bg-card);
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  box-shadow: var(--shadow-md);
}

.dark-mode .request-card {
  background-color: var(--bg-glass);
  border: 1rpx solid var(--border);
}

.request-card .avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 2rpx solid var(--success-light);
  flex-shrink: 0;
}

.request-card .info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.request-card .nickname {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main, var(--ds-color-text-primary));
}

.dark-mode .request-card .nickname {
  color: var(--text-main, var(--ds-color-text-primary));
}

.request-card .message {
  font-size: 24rpx;
  color: var(--text-sub);
  line-height: 1.5;
}

.request-card .time {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.action-btns {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  flex-shrink: 0;
}

.accept-btn {
  background: var(--gradient-primary);
  color: #ffffff;
  border-radius: 48rpx;
  padding: 12rpx 28rpx;
  font-size: 24rpx;
  font-weight: 600;
  border: none;
  box-shadow: var(--shadow-success);
  min-width: 100rpx;
  text-align: center;
}

.accept-btn::after {
  border: none;
}

.accept-btn:active {
  opacity: 0.85;
  transform: scale(0.95);
}

.reject-btn {
  background: var(--danger-light);
  color: var(--danger);
  border-radius: 48rpx;
  padding: 12rpx 28rpx;
  font-size: 24rpx;
  font-weight: 600;
  border: 1rpx solid var(--danger);
  min-width: 100rpx;
  text-align: center;
}

.reject-btn::after {
  border: none;
}

.reject-btn:active {
  opacity: 0.85;
  transform: scale(0.95);
}
</style>
