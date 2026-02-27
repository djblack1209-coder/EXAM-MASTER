<template>
  <view class="chat-container" :class="{ 'dark-mode': isDark }">
    <!-- 导航栏 -->
    <view class="nav-bar">
      <image
        :src="icons8('ios-glyphs', 30, '333333', 'chevron-left')"
        class="back-icon"
        mode="aspectFit"
        @tap="goBack"
        @error="onCdnIconError"
      />
      <view class="nav-center" hover-class="item-hover" @tap="showFriendSelector = true">
        <image
          :src="currentFriend.avatar"
          class="friend-avatar-small"
          mode="aspectFill"
          @error="onAvatarError"
        />
        <text class="nav-title">
          {{ currentFriend.name }}
        </text>
        <text class="nav-arrow">
          ▼
        </text>
      </view>
      <image
        :src="icons8('ios', 50, '333333', 'menu--v1')"
        class="menu-icon"
        mode="aspectFit"
        @tap="showMenu"
        @error="onCdnIconError"
      />
    </view>

    <!-- AI好友选择器弹窗 -->
    <view v-if="showFriendSelector" class="friend-selector-modal" @tap="showFriendSelector = false">
      <view class="friend-selector-content" @tap.stop>
        <view class="selector-header">
          <text class="selector-title">
            选择AI好友
          </text>
          <text class="selector-close" hover-class="item-hover" @tap="showFriendSelector = false">
            ×
          </text>
        </view>
        <view class="friend-list">
          <view
            v-for="friend in aiFriends"
            :key="friend.type"
            class="friend-item"
            :class="{ active: currentFriend.type === friend.type }"
            hover-class="item-hover"
            @tap="selectFriend(friend)"
          >
            <image
              :src="friend.avatar"
              class="friend-avatar"
              mode="aspectFill"
              lazy-load
              @error="onAvatarError"
            />
            <view class="friend-info">
              <text class="friend-name">
                {{ friend.name }}
              </text>
              <text class="friend-role">
                {{ friend.role }}
              </text>
            </view>
            <view v-if="currentFriend.type === friend.type" class="friend-check">
              ✓
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 骨架屏加载状态 -->
    <view v-if="isPageLoading" class="skeleton-chat">
      <view class="skeleton-welcome">
        <view class="skeleton-avatar-lg skeleton-animate" />
        <view class="skeleton-name skeleton-animate" />
        <view class="skeleton-role skeleton-animate" />
        <view class="skeleton-intro skeleton-animate" />
      </view>
    </view>

    <!-- 聊天消息列表 -->
    <scroll-view
      v-if="!isPageLoading"
      class="chat-list"
      scroll-y
      :scroll-top="scrollTop"
      scroll-with-animation
      :scroll-into-view="scrollIntoView"
    >
      <!-- 欢迎消息 -->
      <view v-if="messages.length === 0" class="welcome-card">
        <image :src="currentFriend.avatar" class="welcome-avatar" mode="aspectFill" />
        <text class="welcome-name">
          {{ currentFriend.name }}
        </text>
        <text class="welcome-role">
          {{ currentFriend.role }}
        </text>
        <text class="welcome-intro">
          {{ currentFriend.intro }}
        </text>
      </view>

      <!-- 消息列表 -->
      <view
        v-for="(msg, index) in messages"
        :id="'msg-' + index"
        :key="msg.id || 'msg-' + index"
        class="msg-row"
        :class="msg.role"
      >
        <!-- AI消息 -->
        <template v-if="msg.role === 'assistant'">
          <image :src="currentFriend.avatar" class="avatar" mode="aspectFill" />
          <view class="bubble left-bubble">
            <text>{{ msg.content }}</text>
            <text class="msg-time">
              {{ msg.time }}
            </text>
          </view>
        </template>
        <!-- 用户消息 -->
        <template v-else>
          <view
            class="bubble right-bubble"
            :class="{
              sending: msg.status === 'sending',
              failed: msg.status === 'failed'
            }"
          >
            <text>{{ msg.content }}</text>
            <view class="msg-footer">
              <text class="msg-time">
                {{ msg.time }}
              </text>
              <view v-if="msg.status" class="msg-status">
                <text v-if="msg.status === 'sending'" class="status-icon">
                  ⏳
                </text>
                <text v-else-if="msg.status === 'sent'" class="status-icon sent">
                  ✓
                </text>
                <text v-else-if="msg.status === 'failed'" class="status-icon failed" @tap="retryMessage(index)">
                  ⚠️ 点击重试
                </text>
              </view>
            </view>
          </view>
          <image
            :src="icons8('color', 96, '', 'user-male-circle--v1')"
            class="avatar"
            mode="aspectFill"
            @error="onAvatarError"
          />
        </template>
      </view>

      <!-- 正在输入指示器 -->
      <view v-if="isTyping" class="msg-row assistant">
        <image :src="currentFriend.avatar" class="avatar" mode="aspectFill" />
        <view class="bubble left-bubble typing-bubble">
          <view class="typing-dots">
            <view class="dot" />
            <view class="dot" />
            <view class="dot" />
          </view>
        </view>
      </view>

      <view id="msg-bottom" style="height: 20px" />
    </scroll-view>

    <!-- 情绪快捷标签 -->
    <view v-if="showEmotionTags && !isPageLoading" class="emotion-tags">
      <view
        v-for="emotion in emotionOptions"
        :key="emotion.value"
        class="emotion-tag"
        :class="{ active: currentEmotion === emotion.value }"
        hover-class="item-hover"
        @tap="selectEmotion(emotion.value)"
      >
        <text>{{ emotion.emoji }} {{ emotion.label }}</text>
      </view>
    </view>

    <!-- 语音波形动画 -->
    <view v-if="showVoiceWave" class="voice-wave">
      <view class="wave-container">
        <view
          v-for="i in 5"
          :key="i"
          class="wave-bar"
          :style="{ height: `${20 + voiceLevel * 30}px`, animationDelay: `${i * 0.1}s` }"
        />
      </view>
      <text class="voice-hint">
        正在录音...
      </text>
    </view>

    <!-- 输入区域 -->
    <view v-if="!isPageLoading" class="input-area">
      <view class="input-tools">
        <image
          :src="icons8('ios', 50, '666666', 'happy--v1')"
          class="tool-icon"
          mode="aspectFit"
          @tap="toggleEmotionTags"
          @error="onCdnIconError"
        />
        <image
          :src="isRecording ? icons8('ios', 50, 'FF3B30', 'microphone') : icons8('ios', 50, '666666', 'microphone')"
          class="tool-icon"
          mode="aspectFit"
          @touchstart="startRecording"
          @touchend="stopRecording"
          @touchcancel="stopRecording"
          @error="onCdnIconError"
        />
        <image
          :src="
            isRealtimeMode
              ? icons8('ios', 50, '007AFF', 'lightning-bolt')
              : icons8('ios', 50, '666666', 'lightning-bolt')
          "
          class="tool-icon"
          mode="aspectFit"
          @tap="toggleRealtimeMode"
          @error="onCdnIconError"
        />
      </view>
      <input
        v-model="messageText"
        type="text"
        class="msg-input"
        :placeholder="isRealtimeMode ? '实时答疑模式...' : '和AI好友聊聊...'"
        confirm-type="send"
        maxlength="500"
        @confirm="handleSend"
        @focus="onInputFocus"
      />
      <view
        class="send-btn"
        :class="{ active: messageText.trim() }"
        hover-class="item-hover"
        @tap="handleSend"
      >
        <text class="send-icon">
          ↑
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import { lafService } from '@/services/lafService.js';
import { storageService } from '@/services/storageService.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
// AI路由器
import { realtimeAnswer } from './ai-router.js';
// 外部 CDN 配置
import config from '@/config';

// icons8 图标 URL 生成器（集中管理，便于替换或自建）
const icons8 = (style, size, color, name) =>
  `${config.externalCdn.icons8BaseUrl}/${style}/${size}/${color}/${name}.png`;

// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';

// ✅ F024: 暗黑模式状态
const isDark = ref(false);
const initTheme = () => {
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';
};
const onThemeUpdate = (mode) => {
  isDark.value = mode === 'dark';
};

// AI好友配置
const aiFriends = ref([
  {
    type: 'yan-cong',
    name: '研聪',
    role: '清华学霸',
    avatar: icons8('color', 96, '', 'student-male--v1'),
    intro: '清华计算机系研一在读，去年初试第3名上岸。表面高冷学霸，实际是个闷骚的数据控，喜欢用数据说话。',
    personality: '理性、高效、数据驱动',
    speakingStyle: '简洁有力，常引用数据'
  },
  {
    type: 'yan-man',
    name: '研漫',
    role: '心理导师',
    avatar: icons8('color', 96, '', 'female-profile'),
    intro: '北师大心理学硕士在读，专攻教育心理学。温暖如春风，共情能力极强，是大家的"树洞"。',
    personality: '温暖、共情、善于倾听',
    speakingStyle: '温柔体贴，善于引导'
  },
  {
    type: 'yan-shi',
    name: '研师',
    role: '985名师',
    avatar: icons8('color', 96, '', 'teacher'),
    intro: '某985高校副教授，有10年考研辅导经验。专业严谨但不古板，严格中带着关怀。',
    personality: '专业、严谨、经验丰富',
    speakingStyle: '直击要点，不说废话'
  },
  {
    type: 'yan-you',
    name: '研友',
    role: '同届伙伴',
    avatar: icons8('color', 96, '', 'conference-call--v1'),
    intro: '和你同届备考的研友，目标是人大新闻学院。乐观开朗，段子手，是备考路上的开心果。',
    personality: '乐观、幽默、接地气',
    speakingStyle: '轻松活泼，爱用表情'
  }
]);

// 情绪选项
const emotionOptions = ref([
  { value: 'frustrated', emoji: '😫', label: '沮丧' },
  { value: 'anxious', emoji: '😰', label: '焦虑' },
  { value: 'excited', emoji: '🎉', label: '开心' },
  { value: 'tired', emoji: '😴', label: '疲惫' },
  { value: 'confused', emoji: '🤔', label: '困惑' },
  { value: 'neutral', emoji: '😊', label: '平静' }
]);

// 状态
const currentFriend = ref(aiFriends.value[0]);
const messages = ref([]);
const messageText = ref('');
const scrollTop = ref(0);
const scrollIntoView = ref('');
const statusBarHeight = ref(20);
const isTyping = ref(false);
const showFriendSelector = ref(false);
const showEmotionTags = ref(false);
const currentEmotion = ref('neutral');
const conversationCount = ref(0);
const defaultAvatar = DEFAULT_AVATAR;
const isPageLoading = ref(true); // 页面初始加载状态

// 语音相关状态
const isRecording = ref(false);
const showVoiceWave = ref(false);
const voiceLevel = ref(0);
const audioChunks = ref([]); // ✅ BUG FIX: 声明 audioChunks ref（之前缺失导致运行时错误）

// 实时答疑状态
const isRealtimeMode = ref(false);

// 录音定时器ID（组件级变量，避免污染全局作用域）
let recordingIntervalId = null;

// ✅ 图片加载失败处理
const onAvatarError = (e) => {
  const target = e?.target;
  if (target && target.src && target.src !== defaultAvatar) {
    target.src = defaultAvatar;
  }
};
// CDN图标加载失败 — 隐藏broken图标
const onCdnIconError = (e) => {
  const target = e?.target;
  if (target) {
    target.style = 'display:none';
  }
};

// 用户学习状态（从本地获取）
let _recorderManager = null; // 录音器单例，避免重复注册回调
const userContext = reactive({
  studyState: '正常',
  recentAccuracy: 0,
  streak: 0,
  recentConversations: ''
});

onMounted(async () => {
  // ✅ F024: 初始化主题
  initTheme();
  uni.$on('themeUpdate', onThemeUpdate);

  // 获取状态栏高度
  statusBarHeight.value = getStatusBarHeight();

  // 获取路由参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (currentPage.options) {
    // 如果传入了好友类型
    if (currentPage.options.friendType) {
      const friendType = decodeURIComponent(currentPage.options.friendType);
      const friend = aiFriends.value.find((f) => f.type === friendType);
      if (friend) {
        currentFriend.value = friend;
      }
    }
    // 如果传入了好友名字（兼容旧版）
    if (currentPage.options.name) {
      const name = decodeURIComponent(currentPage.options.name);
      const friend = aiFriends.value.find((f) => f.name === name);
      if (friend) {
        currentFriend.value = friend;
      }
    }
  }

  // 加载用户学习数据 + 历史对话，带安全超时 (P011)
  const loadingTimeout = setTimeout(() => {
    if (isPageLoading.value) {
      isPageLoading.value = false;
      logger.warn('[Chat] 加载超时，强制关闭骨架屏');
    }
  }, 8000);

  try {
    await loadUserContext();
    await loadChatHistory();
  } catch (e) {
    logger.error('[Chat] 初始化加载失败:', e);
  } finally {
    clearTimeout(loadingTimeout);
    setTimeout(() => {
      isPageLoading.value = false;
    }, 300);
  }
});

// 加载用户上下文
const loadUserContext = async () => {
  try {
    // 从本地存储获取学习数据
    const studyStats = storageService.get('study_stats', {});
    userContext.recentAccuracy = studyStats.accuracy || 0;
    userContext.streak = studyStats.streakDays || 0;

    // 判断学习状态
    if (userContext.recentAccuracy < 50) {
      userContext.studyState = '需要加强';
    } else if (userContext.recentAccuracy > 80) {
      userContext.studyState = '状态良好';
    } else {
      userContext.studyState = '正常';
    }
  } catch (e) {
    logger.warn('[Chat] 加载用户上下文失败:', e);
    // P007: 提供用户反馈，避免静默失败
    uni.showToast({ title: '学习数据加载失败，AI回复可能不够精准', icon: 'none', duration: 2000 });
  }
};

// 加载聊天历史
const loadChatHistory = async () => {
  try {
    const historyKey = `chat_history_${currentFriend.value.type}`;
    const history = storageService.get(historyKey, []);
    if (history.length > 0) {
      messages.value = history.slice(-20); // 只加载最近20条
      conversationCount.value = history.length;
      // 构建最近对话摘要
      userContext.recentConversations = history
        .slice(-3)
        .map((m) => `${m.role === 'user' ? '用户' : currentFriend.value.name}: ${m.content.substring(0, 50)}`)
        .join('\n');

      nextTick(() => {
        scrollToBottom();
      });
    }
  } catch (e) {
    logger.warn('[Chat] 加载聊天历史失败:', e);
    // P007: 提供用户反馈
    uni.showToast({ title: '聊天记录加载失败', icon: 'none', duration: 1500 });
  }
};

// 保存聊天历史
const saveChatHistory = () => {
  try {
    const historyKey = `chat_history_${currentFriend.value.type}`;
    storageService.save(historyKey, messages.value.slice(-50)); // 只保存最近50条
  } catch (e) {
    logger.warn('[Chat] 保存聊天历史失败:', e);
  }
};

// 选择AI好友
const selectFriend = async (friend) => {
  if (friend.type === currentFriend.value.type) {
    showFriendSelector.value = false;
    return;
  }

  // 保存当前对话
  saveChatHistory();

  // 切换好友
  isTyping.value = false;
  currentFriend.value = friend;
  messages.value = [];
  conversationCount.value = 0;
  showFriendSelector.value = false;

  // 加载新好友的历史对话
  await loadChatHistory();
};

// 选择情绪
const selectEmotion = (emotion) => {
  currentEmotion.value = emotion;
  showEmotionTags.value = false;

  // 显示提示
  const emotionInfo = emotionOptions.value.find((e) => e.value === emotion);
  if (emotionInfo) {
    uni.showToast({
      title: `已标记心情: ${emotionInfo.emoji}`,
      icon: 'none',
      duration: 1500
    });
  }
};

// 切换情绪标签显示
const toggleEmotionTags = () => {
  showEmotionTags.value = !showEmotionTags.value;
};

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    scrollIntoView.value = 'msg-bottom';
    setTimeout(() => {
      scrollIntoView.value = '';
    }, 100);
  });
};

// 格式化时间
const formatTime = (date) => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 输入框获得焦点
const onInputFocus = () => {
  showEmotionTags.value = false;
  scrollToBottom();
};

// 返回
const goBack = () => {
  // 保存聊天历史
  saveChatHistory();

  uni.navigateBack({
    fail: () => {
      uni.reLaunch({
        url: '/pages/index/index'
      });
    }
  });
};

// 显示菜单
const showMenu = () => {
  uni.showActionSheet({
    itemList: ['清空聊天记录', '查看好友资料', '切换到实时答疑模式'],
    success: (res) => {
      if (res.tapIndex === 0) {
        // 清空聊天记录
        uni.showModal({
          title: '确认清空',
          content: `确定要清空与${currentFriend.value.name}的聊天记录吗？`,
          success: (modalRes) => {
            if (modalRes.confirm) {
              messages.value = [];
              conversationCount.value = 0;
              saveChatHistory();
              uni.showToast({ title: '已清空', icon: 'success' });
            }
          }
        });
      } else if (res.tapIndex === 1) {
        // 查看好友资料
        uni.showModal({
          title: currentFriend.value.name,
          content: `${currentFriend.value.role}\n\n${currentFriend.value.intro}`,
          showCancel: false
        });
      } else if (res.tapIndex === 2) {
        // 切换到实时答疑模式
        toggleRealtimeMode();
      }
    }
  });
};

// 切换实时答疑模式
const toggleRealtimeMode = () => {
  isRealtimeMode.value = !isRealtimeMode.value;
  uni.showToast({
    title: isRealtimeMode.value ? '已切换到实时答疑模式' : '已切换到普通聊天模式',
    icon: 'none',
    duration: 1500
  });
};

// 开始录音
const startRecording = async () => {
  try {
    const res = await uni.getSetting();
    if (!res.authSetting['scope.record']) {
      const _authRes = await uni.authorize({
        scope: 'scope.record'
      });
    }

    isRecording.value = true;
    showVoiceWave.value = true;
    audioChunks.value = [];

    logger.log('[Chat] 开始录音');

    // 使用 uni-app RecorderManager 进行真实录音（单例，避免重复注册回调）
    if (!_recorderManager) {
      _recorderManager = uni.getRecorderManager();
      _recorderManager.onFrameRecorded?.((res) => {
        if (res.frameBuffer) {
          audioChunks.value.push(res.frameBuffer);
        }
      });
      _recorderManager.onStop((res) => {
        logger.log('[Chat] 录音完成:', res.tempFilePath);
        uni.showToast({
          title: '语音输入功能开发中，请使用文字输入',
          icon: 'none',
          duration: 2000
        });
      });
      _recorderManager.onError((err) => {
        logger.error('[Chat] 录音错误:', err);
        isRecording.value = false;
        showVoiceWave.value = false;
      });
    }
    _recorderManager.start({
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1,
      frameSize: 50
    });

    // 音量动画（基于真实录音帧回调，此处用定时器作为视觉反馈）
    const interval = setInterval(() => {
      voiceLevel.value = Math.random() * 0.8 + 0.2;
    }, 100);
    recordingIntervalId = interval;
  } catch (error) {
    logger.error('[Chat] 录音权限获取失败:', error);
    uni.showToast({
      title: '录音权限被拒绝',
      icon: 'none'
    });
  }
};

// 停止录音
const stopRecording = async () => {
  try {
    isRecording.value = false;
    showVoiceWave.value = false;

    // 清除录音定时器
    if (recordingIntervalId) {
      clearInterval(recordingIntervalId);
      recordingIntervalId = null;
    }

    logger.log('[Chat] 停止录音');

    // 停止真实录音（触发 onStop 回调）—— 使用单例，避免停止错误实例
    if (_recorderManager) {
      _recorderManager.stop();
    }
  } catch (error) {
    logger.error('[Chat] 停止录音失败:', error);
  }
};

// 实时答疑处理
const handleRealtimeAnswer = async (question) => {
  if (!question.trim()) return;

  const sessionFriendType = currentFriend.value.type;

  // 添加用户消息
  const userMsg = {
    role: 'user',
    content: question,
    time: formatTime(new Date()),
    status: 'sending' // ✅ F027: 实时模式也添加消息状态
  };
  messages.value.push(userMsg);
  messageText.value = '';
  conversationCount.value++;

  // 滚动到底部
  scrollToBottom();

  // 显示输入指示器
  isTyping.value = true;

  try {
    // 调用实时答疑API
    const response = await realtimeAnswer(question, {
      emotion: currentEmotion.value,
      studyState: userContext.studyState,
      recentAccuracy: userContext.recentAccuracy
    });

    // 好友切换后丢弃旧请求结果，避免串会话
    if (currentFriend.value.type !== sessionFriendType) {
      return;
    }

    isTyping.value = false;
    // ✅ F027: 标记用户消息发送成功
    userMsg.status = 'sent';

    let reply = '抱歉，我暂时无法回复，请稍后再试~';

    if (response.success && response.data) {
      reply = response.data;
      logger.log('[Chat] 实时答疑成功');
    } else {
      logger.warn('[Chat] 实时答疑异常:', response.message);
    }

    // 添加AI回复
    const aiMsg = {
      role: 'assistant',
      content: reply,
      time: formatTime(new Date()),
      isRealtime: true,
      status: 'sent' // ✅ F027
    };
    messages.value.push(aiMsg);

    // 保存聊天历史
    saveChatHistory();

    // 滚动到底部
    scrollToBottom();
  } catch (error) {
    if (currentFriend.value.type !== sessionFriendType) {
      return;
    }

    isTyping.value = false;
    // ✅ F027: 标记用户消息发送失败
    userMsg.status = 'failed';
    logger.error('[Chat] 实时答疑失败:', error);

    uni.showToast({
      title: '网络错误，请稍后重试',
      icon: 'none'
    });
  }
};

// 发送消息（更新）
const handleSend = async () => {
  const content = messageText.value.trim();
  if (!content || isTyping.value) return;

  if (isRealtimeMode.value) {
    // 实时答疑模式
    await handleRealtimeAnswer(content);
  } else {
    // 普通聊天模式
    await handleNormalChat(content);
  }
};

// 普通聊天处理
const handleNormalChat = async (content) => {
  const sessionFriendType = currentFriend.value.type;
  const sessionFriendName = currentFriend.value.name;

  // 添加用户消息（带发送状态）
  const userMsg = {
    role: 'user',
    content: content,
    time: formatTime(new Date()),
    status: 'sending'
  };
  const msgIndex = messages.value.length;
  messages.value.push(userMsg);
  messageText.value = '';
  conversationCount.value++;

  // 滚动到底部
  scrollToBottom();

  // 显示输入指示器
  isTyping.value = true;

  try {
    // 调用AI好友对话API
    const response = await lafService.aiFriendChat(sessionFriendType, content, {
      emotion: currentEmotion.value,
      conversationCount: conversationCount.value,
      studyState: userContext.studyState,
      recentAccuracy: userContext.recentAccuracy,
      recentConversations: userContext.recentConversations
    });

    if (currentFriend.value.type !== sessionFriendType) {
      return;
    }

    // 更新消息状态为已发送
    if (messages.value[msgIndex]) {
      messages.value[msgIndex].status = 'sent';
    }
    isTyping.value = false;

    let reply = '抱歉，我暂时无法回复，请稍后再试~';

    if (response.code === 0 && response.data) {
      reply = response.data;
      logger.log('[Chat] AI回复成功');
    } else {
      logger.warn('[Chat] AI回复异常:', response.message);
    }

    // 添加AI回复
    const aiMsg = {
      role: 'assistant',
      content: reply,
      time: formatTime(new Date())
    };
    messages.value.push(aiMsg);

    // 更新最近对话摘要
    userContext.recentConversations = messages.value
      .slice(-3)
      .map((m) => `${m.role === 'user' ? '用户' : sessionFriendName}: ${m.content.substring(0, 50)}`)
      .join('\n');

    // 保存聊天历史
    saveChatHistory();

    // 重置情绪为中性
    currentEmotion.value = 'neutral';

    // 滚动到底部
    scrollToBottom();
  } catch (error) {
    if (currentFriend.value.type !== sessionFriendType) {
      return;
    }

    // 更新消息状态为失败
    if (messages.value[msgIndex]) {
      messages.value[msgIndex].status = 'failed';
    }
    isTyping.value = false;
    logger.error('[Chat] 发送消息失败:', error);

    uni.showToast({
      title: '发送失败，点击消息重试',
      icon: 'none'
    });
  }
};

// 重试发送失败的消息
const retryMessage = async (index) => {
  const msg = messages.value[index];
  if (msg && msg.status === 'failed') {
    const sessionFriendType = currentFriend.value.type;

    // 重置状态为发送中
    messages.value[index].status = 'sending';

    try {
      isTyping.value = true;

      const response = await lafService.aiFriendChat(sessionFriendType, msg.content, {
        emotion: currentEmotion.value,
        conversationCount: conversationCount.value,
        studyState: userContext.studyState,
        recentAccuracy: userContext.recentAccuracy,
        recentConversations: userContext.recentConversations
      });

      if (currentFriend.value.type !== sessionFriendType) {
        return;
      }

      messages.value[index].status = 'sent';
      isTyping.value = false;

      let reply = '抱歉，我暂时无法回复，请稍后再试~';

      if (response.code === 0 && response.data) {
        reply = response.data;
      }

      const aiMsg = {
        role: 'assistant',
        content: reply,
        time: formatTime(new Date())
      };
      messages.value.push(aiMsg);
      saveChatHistory();
      scrollToBottom();
    } catch {
      if (currentFriend.value.type !== sessionFriendType) {
        return;
      }

      messages.value[index].status = 'failed';
      isTyping.value = false;
      uni.showToast({
        title: '重试失败',
        icon: 'none'
      });
    }
  }
};

// ✅ F024: 清理主题监听 + 录音定时器
onUnmounted(() => {
  uni.$off('themeUpdate', onThemeUpdate);
  if (recordingIntervalId) {
    clearInterval(recordingIntervalId);
    recordingIntervalId = null;
  }
});
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-secondary);
}

/* ✅ F024: 暗黑模式适配 — 使用 CSS 变量替代硬编码色值 */
.chat-container.dark-mode {
  background-color: var(--bg-primary, #0a0a0a);

  .nav-bar {
    background-color: var(--bg-secondary, #1a1a1a);
    border-bottom-color: var(--border-color, #2a2a2a);
  }

  .nav-title {
    color: var(--text-main, var(--ds-color-text-primary));
  }

  .nav-arrow {
    color: var(--text-tertiary, var(--ds-color-text-tertiary));
  }

  .back-icon,
  .menu-icon {
    filter: invert(1) brightness(0.9);
  }

  .left-bubble {
    background-color: var(--bg-card, #1e1e1e);
    color: var(--text-main, var(--ds-color-text-primary));
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
  }

  .welcome-card {
    .welcome-name {
      color: var(--text-main, var(--ds-color-text-primary));
    }
    .welcome-role {
      color: var(--text-tertiary, var(--ds-color-text-tertiary));
    }
    .welcome-intro {
      color: var(--text-tertiary, var(--ds-color-text-tertiary));
    }
  }

  .input-area {
    background-color: var(--bg-secondary, #1a1a1a);
    border-top-color: var(--border-color, #2a2a2a);
  }

  .msg-input {
    background-color: var(--bg-tertiary, #2a2a2a);
    color: var(--text-main, var(--ds-color-text-primary));
  }

  .send-btn {
    background: var(--bg-tertiary, #2a2a2a);
  }

  .send-icon {
    color: var(--text-tertiary, var(--ds-color-text-tertiary));
  }

  .emotion-tags {
    background: var(--bg-secondary, #1a1a1a);
    border-top-color: var(--border-color, #2a2a2a);
  }

  .emotion-tag {
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-secondary, var(--ds-color-text-secondary));

    &.active {
      background: var(--primary, #007aff);
      color: white;
    }
  }

  .friend-selector-content {
    background: var(--bg-card, #1e1e1e);
  }

  .selector-header {
    border-bottom-color: var(--border-color, #2a2a2a);
  }

  .selector-title {
    color: var(--text-main, var(--ds-color-text-primary));
  }

  .friend-item {
    &:active {
      background: var(--bg-tertiary, #2a2a2a);
    }
    &.active {
      background: rgba(0, 122, 255, 0.15);
    }
  }

  .friend-name {
    color: var(--text-main, var(--ds-color-text-primary));
  }
  .friend-role {
    color: var(--text-tertiary, var(--ds-color-text-tertiary));
  }

  .tool-icon {
    filter: invert(0.7);
  }

  .skeleton-animate {
    background: linear-gradient(
      90deg,
      var(--bg-card, #1e1e1e) 25%,
      var(--bg-tertiary, #2a2a2a) 50%,
      var(--bg-card, #1e1e1e) 75%
    );
    background-size: 200% 100%;
  }
}

.nav-bar {
  height: 88rpx;
  padding-top: v-bind('statusBarHeight + "px"');
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 32rpx;
  padding-right: 32rpx;
  background-color: var(--bg-card);
  border-bottom: 1rpx solid var(--border-light);
  z-index: 10;
}

.nav-center {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.friend-avatar-small {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-arrow {
  font-size: 20rpx;
  color: var(--text-secondary);
}

.back-icon,
.menu-icon {
  width: 48rpx;
  height: 48rpx;

  &:active {
    opacity: 0.6;
  }
}

/* 好友选择器弹窗 */
.friend-selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 200rpx;
}

.friend-selector-content {
  width: 90%;
  max-width: 700rpx;
  background: var(--bg-card);
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 20rpx 80rpx rgba(0, 0, 0, 0.2);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 40rpx;
  border-bottom: 1rpx solid var(--border-light);
}

.selector-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.selector-close {
  font-size: 48rpx;
  color: var(--text-secondary);
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.friend-list {
  padding: 16rpx;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 24rpx;
  margin-bottom: 8rpx;

  &:active {
    background: var(--bg-secondary);
  }

  &.active {
    background: var(--primary-light, rgba(0, 122, 255, 0.1));
  }
}

.friend-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  margin-right: 24rpx;
}

.friend-info {
  flex: 1;
}

.friend-name {
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-primary);
  display: block;
}

.friend-role {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.friend-check {
  width: 48rpx;
  height: 48rpx;
  background: var(--primary, #007aff);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

/* 聊天列表 */
.chat-list {
  flex: 1;
  padding: 32rpx;
  box-sizing: border-box;
}

/* 欢迎卡片 */
.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  text-align: center;
}

.welcome-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  margin-bottom: 32rpx;
}

.welcome-name {
  font-size: 40rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.welcome-role {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 32rpx;
}

.welcome-intro {
  font-size: 28rpx;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 560rpx;
}

/* 消息行 */
.msg-row {
  display: flex;
  margin-bottom: 32rpx;
  align-items: flex-end;

  &.user {
    flex-direction: row-reverse;
  }
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.bubble {
  max-width: 70%;
  padding: 20rpx 28rpx;
  border-radius: 32rpx;
  font-size: 30rpx;
  line-height: 1.5;
  position: relative;
}

.left-bubble {
  background-color: var(--bg-card);
  color: var(--text-primary);
  margin-left: 16rpx;
  border-bottom-left-radius: 8rpx;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
}

.right-bubble {
  background: linear-gradient(135deg, var(--primary, #007aff), var(--primary-dark, #5856d6));
  color: white;
  margin-right: 16rpx;
  border-bottom-right-radius: 8rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 122, 255, 0.3);

  &.sending {
    opacity: 0.7;
  }

  &.failed {
    background: linear-gradient(135deg, var(--ds-color-error, #ff3b30), #ff6b6b);
    box-shadow: 0 4rpx 16rpx rgba(255, 59, 48, 0.3);
  }
}

.msg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 8rpx;
}

.msg-status {
  display: flex;
  align-items: center;
}

.status-icon {
  font-size: 24rpx;

  &.sent {
    color: rgba(255, 255, 255, 0.8);
  }

  &.failed {
    color: #ffd60a;
    font-size: 22rpx;
  }
}

.msg-time {
  display: block;
  font-size: 22rpx;
  opacity: 0.6;
}

/* 输入指示器 */
.typing-bubble {
  padding: 28rpx 36rpx;
}

.typing-dots {
  display: flex;
  gap: 8rpx;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-8rpx);
    opacity: 1;
  }
}

/* 情绪标签 */
.emotion-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  background: var(--bg-card);
  border-top: 1rpx solid var(--border-light);
}

.emotion-tag {
  padding: 12rpx 24rpx;
  background: var(--bg-secondary);
  border-radius: 32rpx;
  font-size: 26rpx;
  color: var(--text-secondary);

  &:active {
    opacity: 0.7;
  }

  &.active {
    background: var(--primary, #007aff);
    color: white;
  }
}

/* 输入区域 */
.input-area {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: var(--bg-card);
  border-top: 1rpx solid var(--border-light);
  gap: 16rpx;
}

.input-tools {
  display: flex;
  align-items: center;
}

.tool-icon {
  width: 56rpx;
  height: 56rpx;

  &:active {
    opacity: 0.6;
  }
}

.msg-input {
  flex: 1;
  height: 72rpx;
  background-color: var(--bg-secondary);
  border-radius: 36rpx;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: var(--text-primary);
}

.send-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &.active {
    background: linear-gradient(135deg, #007aff, #5856d6);
    transform: scale(1.05);
  }
}

.send-icon {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-secondary);

  .send-btn.active & {
    color: white;
  }
}

/* 骨架屏样式 */
.skeleton-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
}

.skeleton-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 560rpx;
}

.skeleton-avatar-lg {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  margin-bottom: 32rpx;
}

.skeleton-name {
  width: 240rpx;
  height: 48rpx;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

.skeleton-role {
  width: 160rpx;
  height: 32rpx;
  border-radius: 8rpx;
  margin-bottom: 32rpx;
}

.skeleton-intro {
  width: 100%;
  height: 120rpx;
  border-radius: 16rpx;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-card) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 语音波形动画 */
.voice-wave {
  position: fixed;
  bottom: 160rpx;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 9;
  animation: slideUp 0.3s ease-out;
}

.wave-container {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.wave-bar {
  width: 12rpx;
  background: linear-gradient(180deg, #007aff, #5856d6);
  border-radius: 6rpx;
  animation: wave 1s ease-in-out infinite;
}

@keyframes wave {
  0%,
  100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}

.voice-hint {
  color: white;
  font-size: 28rpx;
  opacity: 0.8;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* hover-class 反馈 */
.item-hover {
  opacity: 0.7;
}
</style>
