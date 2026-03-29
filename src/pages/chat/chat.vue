<template>
  <view class="chat-container" :class="{ 'dark-mode': isDark }">
    <PrivacyPopup />
    <!-- 导航栏 -->
    <view
      class="nav-bar apple-glass"
      :style="{ paddingTop: statusBarHeight + 'px', paddingRight: `calc(32rpx + ${capsuleSafeRight}px)` }"
    >
      <image
        :src="icons8('ios-glyphs', 30, '333333', 'chevron-left')"
        class="back-icon"
        alt="返回"
        mode="aspectFit"
        @tap="goBack"
        @error="onCdnIconError"
      />
      <view class="nav-center" hover-class="item-hover" @tap="showFriendSelector = true">
        <image
          :src="currentFriend.avatar"
          class="friend-avatar-small"
          alt="头像"
          mode="aspectFill"
          @error="onAvatarError"
        />
        <text class="nav-title">
          {{ currentFriend.name }}
        </text>
        <text class="nav-arrow"> ▼ </text>
      </view>
      <image
        :src="icons8('ios', 50, '333333', 'menu--v1')"
        class="menu-icon"
        alt=""
        mode="aspectFit"
        @tap="showMenu"
        @error="onCdnIconError"
      />
    </view>

    <!-- 智能好友选择器弹窗 -->
    <view v-if="showFriendSelector" class="friend-selector-modal" @tap="showFriendSelector = false">
      <view class="friend-selector-content apple-glass-card" @tap.stop>
        <view class="selector-header">
          <text class="selector-title"> 选择智能好友 </text>
          <text class="selector-close" hover-class="item-hover" @tap="showFriendSelector = false"> × </text>
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
              alt="头像"
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
            <view v-if="currentFriend.type === friend.type" class="friend-check"> ✓ </view>
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
      <view v-if="messages.length === 0" class="welcome-card apple-glass-card">
        <image :src="currentFriend.avatar" class="welcome-avatar" alt="头像" mode="aspectFill" />
        <text class="welcome-name">
          {{ currentFriend.name }}
        </text>
        <text class="welcome-role">
          {{ currentFriend.role }}
        </text>
        <text class="welcome-intro">
          {{ currentFriend.intro }}
        </text>
        <text class="welcome-note"> 内容用于学习交流参考，请结合教材与官方资料自行判断。 </text>
      </view>

      <!-- 消息列表 -->
      <view
        v-for="(msg, index) in messages"
        :id="'msg-' + index"
        :key="msg.id || 'msg-' + index"
        class="msg-row"
        :class="msg.role"
      >
        <!-- 智能消息 -->
        <template v-if="msg.role === 'assistant'">
          <image :src="currentFriend.avatar" class="avatar" alt="头像" mode="aspectFill" />
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
                <text v-if="msg.status === 'sending'" class="status-icon"> ⏳ </text>
                <text v-else-if="msg.status === 'sent'" class="status-icon sent"> ✓ </text>
                <text v-else-if="msg.status === 'failed'" class="status-icon failed" @tap="retryMessage(index)">
                  ⚠️ 点击重试
                </text>
              </view>
            </view>
          </view>
          <image
            :src="icons8('color', 96, '', 'user-male-circle--v1')"
            class="avatar"
            alt="头像"
            mode="aspectFill"
            @error="onAvatarError"
          />
        </template>
      </view>

      <!-- 正在输入指示器 -->
      <view v-if="isTyping" class="msg-row assistant">
        <image :src="currentFriend.avatar" class="avatar" alt="头像" mode="aspectFill" />
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
    <view v-if="showEmotionTags && !isPageLoading" class="emotion-tags apple-glass">
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
      <text class="voice-hint"> 正在录音... </text>
    </view>

    <!-- 输入区域 -->
    <view v-if="!isPageLoading" class="input-area apple-glass">
      <view class="input-tools">
        <image
          :src="icons8('ios', 50, '666666', 'happy--v1')"
          class="tool-icon"
          alt=""
          mode="aspectFit"
          @tap="toggleEmotionTags"
          @error="onCdnIconError"
        />
        <image
          :src="isRecording ? icons8('ios', 50, 'FF3B30', 'microphone') : icons8('ios', 50, '666666', 'microphone')"
          class="tool-icon"
          alt=""
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
          alt=""
          mode="aspectFit"
          @tap="toggleRealtimeMode"
          @error="onCdnIconError"
        />
      </view>
      <input
        id="e2e-chat-input"
        v-model="messageText"
        type="text"
        class="msg-input apple-glass-pill"
        :placeholder="isRealtimeMode ? '实时答疑模式...' : '和智能好友聊聊...'"
        confirm-type="send"
        maxlength="500"
        @confirm="handleSend"
        @focus="onInputFocus"
      />
      <view
        id="e2e-chat-send"
        class="send-btn apple-glass-pill"
        :class="{ active: messageText.trim() }"
        hover-class="item-hover"
        @tap="handleSend"
      >
        <text class="send-icon"> ↑ </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { toast } from '@/utils/toast.js';
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useSchoolStore } from '@/stores/modules/school.js';
import { useToolsStore } from '@/stores/modules/tools.js';
import { storageService } from '@/services/storageService.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { ensureMiniProgramScope, ensurePrivacyAuthorization } from './privacy-authorization.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
// 智能路由器
import { realtimeAnswer } from './ai-router.js';
// 外部 CDN 配置
import config from '@/config';
// ✅ AI 打字机效果
import { useTypewriter } from './composables/useTypewriter.js';
import { sanitizeAIChatInput } from '@/utils/security/sanitize.js';

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

// 智能好友配置
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
const capsuleSafeRight = ref(20);
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
  capsuleSafeRight.value = getCapsuleSafeRight();

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

    // 如果从做题页带了上下文问题 → 自动填入并发送
    if (currentPage.options.context === 'question') {
      const ctx = storageService.get('chat_context_question', '');
      if (ctx) {
        // 延迟到页面加载完成后自动发送
        setTimeout(() => {
          messageText.value = ctx;
          storageService.remove('chat_context_question');
          handleSend();
        }, 1500);
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
    toast.info('学习数据加载失败，智能回复可能不够精准');
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
    toast.info('聊天记录加载失败', 1500);
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

// 选择智能好友
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
    toast.info(`已标记心情: ${emotionInfo.emoji}`, 1500);
  }
};

// 切换情绪标签显示
const toggleEmotionTags = () => {
  showEmotionTags.value = !showEmotionTags.value;
};

const redirectToLoginForChat = () => {
  try {
    storageService.remove('EXAM_TOKEN');
    storageService.remove('EXAM_USER_ID');
    storageService.remove('userInfo');
    storageService.save('redirect_after_login', '/pages/chat/chat');
  } catch (_error) {
    // ignore cleanup failure
  }

  uni.navigateTo({
    url: '/pages/login/index',
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' });
    }
  });
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

  safeNavigateBack();
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
              toast.success('已清空');
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
  toast.info(isRealtimeMode.value ? '已切换到实时答疑模式' : '已切换到普通聊天模式', 1500);
};

// 开始录音
const startRecording = async () => {
  try {
    const privacyOk = await ensurePrivacyAuthorization();
    if (!privacyOk) {
      toast.info('需要先同意隐私授权');
      return;
    }

    const granted = await ensureMiniProgramScope('scope.record', {
      title: '录音权限提示',
      content: '需要麦克风权限才能语音提问，是否前往设置开启？'
    });
    if (!granted) {
      toast.info('未开启录音权限');
      return;
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
        if (res.tempFilePath) {
          processVoiceToText(res.tempFilePath);
        } else {
          toast.info('录音文件读取失败');
        }
      });
      _recorderManager.onError((err) => {
        logger.error('[Chat] 录音错误:', err);
        isRecording.value = false;
        showVoiceWave.value = false;
        // ✅ P0-FIX: 清理录音定时器，防止内存泄漏
        if (recordingIntervalId) {
          clearInterval(recordingIntervalId);
          recordingIntervalId = null;
        }
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
    toast.info('录音权限被拒绝');
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

const readAudioAsBase64 = (filePath) =>
  new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    try {
      const fs = uni.getFileSystemManager();
      fs.readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data || ''),
        fail: (err) => reject(err)
      });
    } catch (e) {
      reject(e);
    }
    // #endif

    // #ifdef H5
    fetch(filePath)
      .then((resp) => resp.blob())
      .then(
        (blob) =>
          new Promise((innerResolve, innerReject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = String(reader.result || '').split(',')[1] || '';
              innerResolve(base64);
            };
            reader.onerror = innerReject;
            reader.readAsDataURL(blob);
          })
      )
      .then((base64) => resolve(base64))
      .catch((err) => reject(err));
    // #endif

    // #ifdef APP-PLUS
    plus.io.resolveLocalFileSystemURL(
      filePath,
      (entry) => {
        entry.file((file) => {
          const reader = new plus.io.FileReader();
          reader.onloadend = (e) => {
            const base64 = String(e.target.result || '').split(',')[1] || '';
            resolve(base64);
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      },
      (err) => reject(err)
    );
    // #endif
  });

const processVoiceToText = async (filePath) => {
  if (!filePath) return;

  toast.loading('语音识别中...');
  try {
    const audioBase64 = await readAudioAsBase64(filePath);
    if (!audioBase64) {
      throw new Error('语音文件解析失败');
    }

    const response = await useToolsStore().speechToText(audioBase64, 'mp3', {
      prompt: '考研学习场景语音识别，请保留专业术语'
    });

    const recognizedText = response?.data?.text ? String(response.data.text).trim() : '';
    if (!recognizedText) {
      throw new Error(response?.message || '未识别到语音内容');
    }

    messageText.value = recognizedText;
    toast.success('识别成功', 1000);

    await handleSend();
  } catch (error) {
    logger.error('[Chat] 语音识别失败:', error);
    toast.info(error?.message || '语音识别失败，请重试', 1800);
  } finally {
    toast.hide();
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

    // 添加智能回复
    const aiMsg = {
      role: 'assistant',
      content: '',
      time: formatTime(new Date()),
      isRealtime: true,
      status: 'sent' // ✅ F027
    };
    messages.value.push(aiMsg);
    const rtMsgIndex = messages.value.length - 1;

    // 打字机效果逐字显示
    const typewriter = useTypewriter({
      speed: 25,
      initialDelay: 50,
      onChar: (text) => {
        if (messages.value[rtMsgIndex]) {
          messages.value[rtMsgIndex].content = text;
        }
        scrollToBottom();
      }
    });
    await typewriter.startTyping(reply);

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

    toast.info('网络错误，请稍后重试');
  }
};

// 发送消息（更新）
const handleSend = async () => {
  const content = sanitizeAIChatInput(messageText.value.trim());
  if (!content || isTyping.value) return;

  const loggedIn = requireLogin(null, {
    message: '请先登录后再和智能好友聊天'
  });
  if (!loggedIn) {
    return;
  }

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
    // 调用智能好友对话API
    const response = await useSchoolStore().aiFriendChat(sessionFriendType, content, {
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
      logger.log('[Chat] 智能回复成功');
    } else {
      if (response?.code === 401 || /未登录|登录已过期|重新登录/.test(response?.message || '')) {
        uni.showModal({
          title: '登录提示',
          content: '当前登录已失效，请重新登录后继续聊天',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              redirectToLoginForChat();
            }
          }
        });
      }
      logger.warn('[Chat] 智能回复异常:', response.message);
    }

    // 添加智能回复
    const aiMsg = {
      role: 'assistant',
      content: '',
      time: formatTime(new Date())
    };
    messages.value.push(aiMsg);
    const aiMsgIndex = messages.value.length - 1;

    // 打字机效果逐字显示
    const typewriter = useTypewriter({
      speed: 25,
      initialDelay: 50,
      onChar: (text) => {
        if (messages.value[aiMsgIndex]) {
          messages.value[aiMsgIndex].content = text;
        }
        scrollToBottom();
      }
    });
    await typewriter.startTyping(reply);

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

    toast.info('发送失败，点击消息重试');
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

      const response = await useSchoolStore().aiFriendChat(sessionFriendType, msg.content, {
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
      toast.info('重试失败');
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
  height: 100%;
  height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top, var(--bg-page)) 0%,
    var(--page-gradient-mid, var(--bg-page)) 56%,
    var(--page-gradient-bottom, var(--bg-page)) 100%
  );
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

.chat-container::before,
.chat-container::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: -1;
}

.chat-container::before {
  width: 380rpx;
  height: 380rpx;
  right: -120rpx;
  top: 120rpx;
  background: radial-gradient(circle, var(--brand-tint) 0%, transparent 72%);
  filter: blur(10rpx);
}

.chat-container::after {
  width: 320rpx;
  height: 320rpx;
  left: -120rpx;
  bottom: 220rpx;
  background: radial-gradient(circle, var(--brand-tint-subtle) 0%, transparent 74%);
  filter: blur(8rpx);
}

/* ✅ F024: 暗黑模式适配 — 使用 CSS 变量替代硬编码色值 */
.chat-container.dark-mode {
  background-color: var(--bg-page, #0b0b0f);

  .nav-bar {
    border-color: rgba(255, 255, 255, 0.12);
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
    background-color: transparent;
    color: var(--text-main, var(--ds-color-text-primary));
    box-shadow: var(--apple-shadow-card);
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
    border-color: rgba(255, 255, 255, 0.12);
  }

  .msg-input {
    color: var(--text-main, var(--ds-color-text-primary));
  }

  .send-btn {
    background: rgba(255, 255, 255, 0.08);

    &.active {
      background: var(--cta-primary-bg);
      box-shadow: var(--cta-primary-shadow);
    }
  }

  .send-icon {
    color: var(--text-tertiary, var(--ds-color-text-tertiary));

    .send-btn.active & {
      color: var(--primary-foreground);
    }
  }

  .emotion-tags {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .emotion-tag {
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-secondary, var(--ds-color-text-secondary));

    &.active {
      background: var(--cta-primary-bg);
      color: var(--cta-primary-text);
    }
  }

  .friend-selector-content {
    background: transparent;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 32rpx;
  padding-right: 32rpx;
  border-bottom: 1rpx solid transparent;
  z-index: 10;
}

.nav-center {
  display: flex;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}

.friend-avatar-small {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 680;
  letter-spacing: -0.2rpx;
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
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: var(--apple-shadow-floating);
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
  padding: 22rpx;
  border-radius: 18rpx;
  margin-bottom: 8rpx;

  &:active {
    background: rgba(255, 255, 255, 0.18);
  }

  &.active {
    background: rgba(255, 255, 255, 0.28);
    box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.24);
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
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  box-shadow: var(--cta-primary-shadow);
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
  max-width: 640rpx;
  margin: 12rpx auto 0;
  border-radius: 40rpx;
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

.welcome-note {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.5;
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
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  color: var(--text-primary);
  margin-left: 16rpx;
  border: 1rpx solid var(--glass-border);
  border-bottom-left-radius: 10rpx;
  box-shadow: var(--apple-shadow-card);
}

.right-bubble {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, transparent 46%),
    linear-gradient(160deg, rgba(27, 130, 74, 0.98) 0%, rgba(15, 95, 52, 0.92) 100%);
  color: #fff;
  margin-right: 16rpx;
  border-bottom-right-radius: 10rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12rpx 28rpx rgba(15, 95, 52, 0.24);

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
  /* gap: 16rpx; -- replaced for Android WebView compat */
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
  /* gap: 8rpx; -- replaced for Android WebView compat */
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
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 24rpx 32rpx;
  border-top: 1rpx solid transparent;
}

.emotion-tag {
  padding: 12rpx 22rpx;
  background: rgba(120, 120, 128, 0.12);
  border-radius: 999rpx;
  font-size: 26rpx;
  color: var(--text-secondary);

  &:active {
    opacity: 0.7;
  }

  &.active {
    background: var(--cta-primary-bg);
    color: var(--cta-primary-text);
    box-shadow: var(--cta-primary-shadow);
  }
}

/* 输入区域 */
.input-area {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid transparent;
  /* gap: 16rpx; -- replaced for Android WebView compat */
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
  border-radius: 36rpx;
  border: 1rpx solid transparent;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: var(--text-primary);
}

.send-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &.active {
    background: var(--cta-primary-bg);
    box-shadow: var(--cta-primary-shadow);
    transform: scale(1.05);
  }
}

.send-icon {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-secondary);

  .send-btn.active & {
    color: var(--cta-primary-text);
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
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-bottom: 20rpx;
}

.wave-bar {
  width: 12rpx;
  background: linear-gradient(180deg, var(--primary), var(--accent-cool));
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
