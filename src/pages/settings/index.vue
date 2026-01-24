<template>
  <view class="settings-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 - 添加设计系统工具类 -->
    <view class="top-nav">
      <text class="nav-title ds-text-display ds-font-bold">设置</text>
    </view>

    <!-- 用户信息卡片 - Wise风格重新设计 -->
    <view class="user-card wise-card">
      <div class="user-header">
        <view class="avatar-section" @tap="handleAvatarClick">
          <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image class="avatar" :src="userInfo.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError">
            </image>
          </button>
          <view v-if="!userInfo.uid" class="login-badge">点击登录</view>
          <view v-else class="login-badge logged-in">已登录</view>
        </view>
        <div class="user-info-section">
          <input type="nickname" class="nickname-input" :value="userInfo.nickName || '考研人'" @blur="onNicknameChange"
            placeholder="点击设置昵称" placeholder-class="nickname-placeholder" />
          <div class="info-grid">
            <div class="info-item" @tap="handleEditSchool">
              <text class="info-label">报考院校</text>
              <text class="info-value">{{ userSchoolInfo.school || '未设置' }}</text>
            </div>
            <div class="info-item" @tap="handleEditMajor">
              <text class="info-label">报考专业</text>
              <text class="info-value">{{ userSchoolInfo.major || '未设置' }}</text>
            </div>
          </div>
        </div>

        <!-- 目标院校管理弹窗 -->
        <view class="modal-mask" v-if="showTargetSchoolsModal" @tap="showTargetSchoolsModal = false">
          <view class="modal-content" @tap.stop>
            <view class="modal-header">
              <text class="modal-title">目标院校管理</text>
              <text class="close-btn" @tap="showTargetSchoolsModal = false">✕</text>
            </view>
            <view class="modal-body">
              <view v-if="targetSchools.length === 0" class="empty-targets">
                <text>暂无目标院校</text>
                <button class="add-btn" @tap="handleAddTargetSchool">去添加目标院校</button>
              </view>
              <view v-else class="target-list">
                <view class="target-item" v-for="(school, index) in targetSchools" :key="index">
                  <image class="target-avatar" :src="school.logo"></image>
                  <view class="target-info">
                    <text class="target-name">{{ school.name }}</text>
                    <text class="target-location">{{ school.location }}</text>
                  </view>
                  <view class="target-actions">
                    <text class="action-btn delete-btn" @tap="removeTargetSchool(index)">删除</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </div>
      <div class="stats-section">
        <div class="stat-card">
          <text class="stat-value">{{ studyDays }}</text>
          <text class="stat-label">坚持天数</text>
        </div>
        <div class="stat-card" @tap="handleTargetSchoolClick">
          <text class="stat-value">{{ targetSchools.length }}</text>
          <text class="stat-label">目标院校</text>
        </div>
      </div>
    </view>

    <!-- 我的好友入口 - 优化样式 -->
    <div class="section">
      <div class="friend-entry-card ds-flex ds-flex-between ds-touchable" @tap="navigateToFriends">
        <div class="entry-left ds-flex">
          <div class="entry-icon ds-flex-center">👥</div>
          <div class="entry-info">
            <text class="entry-title ds-text-lg ds-font-semibold">我的好友</text>
            <text class="entry-desc ds-text-xs">添加好友，一起刷题</text>
          </div>
        </div>
        <text class="entry-arrow">›</text>
      </div>
    </div>

    <!-- 在线好友 - 优化布局 -->
    <div class="section">
      <div class="section-header ds-flex ds-flex-between">
        <h3 class="section-title ds-text-lg ds-font-semibold">AI 导师（在线）</h3>
        <div class="header-actions ds-flex ds-gap-xs">
          <span class="online-badge ds-text-xs ds-font-medium">支持语音对讲</span>
          <view class="invite-btn-header ds-flex ds-gap-xs ds-touchable" @tap="showInviteModal = true">
            <text class="invite-icon-header">👥</text>
            <text class="invite-text-header ds-text-xs ds-font-medium">邀请</text>
          </view>
        </div>
      </div>
      <div class="tutor-list">
        <div class="tutor-item ds-flex" v-for="(tutor, index) in onlineFriends" :key="index">
          <image class="tutor-avatar ds-rounded-full" :src="tutor.avatar"></image>
          <div class="tutor-info">
            <text class="tutor-name ds-text-sm ds-font-medium">{{ tutor.name }}</text>
            <text class="tutor-role ds-text-xs">{{ tutor.role }}</text>
          </div>
          <button class="chat-btn ds-touchable" @tap="startAIChat(tutor)">交流</button>
        </div>
      </div>
    </div>

    <!-- 设置选项 - 优化样式 -->
    <div class="section">
      <div class="settings-list">
        <!-- 语音伴学 -->
        <div class="setting-item ds-flex ds-flex-between">
          <div class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium">AI 语音伴学</text>
            <text class="setting-desc ds-text-xs">导师回答后自动朗读</text>
          </div>
          <switch color="#00a96d" :checked="isVoiceEnabled" @change="toggleVoice" />
        </div>

        <!-- 深色模式（自动切换 Wise/Bitget 主题） -->
        <div class="setting-item ds-flex ds-flex-between">
          <div class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium">深色模式</text>
            <text class="setting-desc ds-text-xs">{{ isDark ? 'Bitget Wallet 风格' : 'Wise 风格' }}</text>
          </div>
          <switch color="#00a96d" :checked="isDark" @change="toggleDark" />
        </div>

        <!-- 清除缓存 -->
        <div class="setting-item ds-flex ds-flex-between ds-touchable" @tap="handleClearCache">
          <div class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium">清除缓存数据</text>
            <text class="setting-desc ds-text-xs">释放存储空间</text>
          </div>
          <text class="cache-size ds-text-xs">{{ cacheSize }}</text>
        </div>
      </div>
    </div>

    <!-- 退出登录 - 优化样式 -->
    <div class="section">
      <button class="logout-btn ds-font-medium ds-touchable" @tap="handleLogout">退出登录</button>
    </div>

    <!-- 底部安全区域 -->
    <div class="footer-safe"></div>

    <!-- 底部导航栏 -->
    <custom-tabbar :activeIndex="3" :isDark="isDark"></custom-tabbar>

    <!-- 邀请好友弹窗 -->
    <InviteModal v-if="showInviteModal" :inviteCode="inviteCode" @close="handleCloseInviteModal"
      @openPoster="handleOpenPoster" />

    <!-- 海报生成弹窗 -->
    <PosterModal v-if="showPosterModal" :visible="showPosterModal" @close="handleClosePosterModal" />

    <!-- 主题选择器弹窗 -->
    <view class="modal-mask" v-if="showThemeSelector" @tap="showThemeSelector = false">
      <view class="modal-content theme-selector" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">选择主题风格</text>
          <text class="close-btn" @tap="showThemeSelector = false">✕</text>
        </view>
        <view class="modal-body">
          <view class="theme-option" @tap="selectTheme('wise')">
            <view class="theme-preview wise-preview">
              <view class="preview-color" style="background: linear-gradient(135deg, #00a96d 0%, #008055 100%);"></view>
            </view>
            <view class="theme-info">
              <text class="theme-name">Wise 绿色主题</text>
              <text class="theme-desc">清新自然，护眼舒适</text>
            </view>
            <text class="theme-check" v-if="themeStore && themeStore.themeType === 'wise'">✓</text>
          </view>
          <view class="theme-option" @tap="selectTheme('bitget')">
            <view class="theme-preview bitget-preview">
              <view class="preview-color" style="background: linear-gradient(135deg, #1a2332 0%, #2d3e50 100%);"></view>
            </view>
            <view class="theme-info">
              <text class="theme-name">Bitget Wallet 蓝色主题</text>
              <text class="theme-desc">科技感十足，专业高效</text>
            </view>
            <text class="theme-check" v-if="themeStore && themeStore.themeType === 'bitget'">✓</text>
          </view>
        </view>
      </view>
    </view>

    <!-- AI 对话弹窗 -->
    <view class="chat-modal" v-if="showChat">
      <view class="chat-mask" @tap="closeChat"></view>
      <view class="chat-panel">
        <view class="chat-header">
          <view class="header-left">
            <text>与 {{ currentTutor.name }} 对话</text>
            <view class="speaking-indicator" v-if="isSpeaking || isRecording">
              <view class="bar" v-for="i in 5" :key="i" :class="{ 'rec': isRecording }"></view>
            </view>
          </view>
          <text class="close-icon" @tap="closeChat">✕</text>
        </view>
        <scroll-view scroll-y class="chat-content" :scroll-top="chatScrollTop" :scroll-into-view="scrollIntoView">
          <view v-for="(msg, i) in chatHistory" :key="i" :id="`msg-${i}`" :class="['msg-bubble', msg.role]">
            <rich-text v-if="msg.role === 'assistant'" :nodes="renderMarkdown(msg.content)"></rich-text>
            <text v-else>{{ msg.content }}</text>
            <view class="msg-time" v-if="msg.time">{{ msg.time }}</view>
            <view class="voice-play-icon" v-if="msg.role === 'assistant' && isVoiceEnabled" @tap="playTTS(msg.content)">
              <text>🔊</text>
            </view>
          </view>
          <view v-if="isThinking" class="msg-bubble assistant" id="thinking">
            <text>正在思考中...</text>
          </view>
          <view id="msg-bottom" style="height: 20px;"></view>
        </scroll-view>
        <view class="chat-input-area">
          <view class="mode-switch" @tap="toggleInputMode">
            <text>{{ isVoiceInput ? '⌨️' : '🎤' }}</text>
          </view>

          <input v-if="!isVoiceInput" v-model="userInput" placeholder="输入备考问题..." confirm-type="send"
            @confirm="sendToAI" class="chat-input" />

          <view v-else class="voice-press-btn" :class="{ 'pressing': isRecording }" @touchstart="handleTouchStart"
            @touchend="handleTouchEnd" @touchcancel="handleTouchEnd">
            <text>{{ isRecording ? '松开 发送' : '按住 说话' }}</text>
          </view>

          <view v-if="!isVoiceInput" class="emoji-btn" @tap="handleEmoji">
            <text>😊</text>
          </view>

          <button v-if="!isVoiceInput" :loading="isRequesting" @tap="sendToAI" class="send-btn">发送</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
// Vue 原生钩子
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
// UniApp 特有钩子
import { onShow } from '@dcloudio/uni-app';
import CustomTabbar from '../../components/custom-tabbar/custom-tabbar.vue';
import InviteModal from '../../components/InviteModal.vue';
import PosterModal from '../../components/PosterModal.vue';
import { setTheme, isNightTime } from '../../utils/core/theme.js';
import { getApiKey } from '../../../common/config.js';
import { storageService } from '../../services/storageService.js';
import { lafService } from '../../services/lafService.js';
import { useThemeStore } from '../../stores';

// 基础状态
const userInfo = ref({});
const userSchoolInfo = ref({}); // 用户学校信息（报考院校、专业）
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'; // 默认头像
const studyDays = ref(1);
const targetSchools = ref([]);
const cacheSize = ref('0KB');
const isDark = ref(false);
const isVoiceEnabled = ref(true); // 语音开关
const isSpeaking = ref(false); // 正在播放语音状态
const isRequesting = ref(false);
const showTargetSchoolsModal = ref(false); // 目标院校管理弹窗
const showInviteModal = ref(false); // 邀请好友弹窗
const showPosterModal = ref(false); // 海报生成弹窗
const inviteCode = ref('EXAM8888'); // 邀请码（可以从后端获取）
const showThemeSelector = ref(false); // 主题选择器弹窗

// 主题系统
let themeStore = null;
const currentThemeName = computed(() => {
  if (!themeStore) return 'Wise 绿色主题';
  return themeStore.themeType === 'wise' ? 'Wise 绿色主题' : 'Bitget Wallet 蓝色主题';
});

// 对话逻辑
const showChat = ref(false);
const currentTutor = ref({});
const userInput = ref('');
const chatHistory = ref([]);
const isThinking = ref(false);
const chatScrollTop = ref(0);
const scrollIntoView = ref('');

// 语音输入相关
const isVoiceInput = ref(true); // 默认使用语音输入
const isRecording = ref(false);

// 录音和音频上下文
let recorderManager = null;
let audioCtx = null;

// 在线好友列表，包含基础导师和专业导师
const onlineFriends = ref([
  { name: 'Dr. Logic', role: '逻辑/数学', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' },
  { name: 'Miss English', role: '英语名师', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka' },
  { name: '知心姐姐', role: '心理疏导', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Liliana' }
]);

// 监听目标院校变化，动态添加专业导师
watch(() => targetSchools.value, (newSchools) => {
  // 清除已有的专业导师
  onlineFriends.value = onlineFriends.value.filter(friend => friend.role !== '专业导师');

  // 如果有目标院校，根据专业添加专业导师
  if (newSchools.length > 0) {
    // 从本地存储获取用户的专业信息
    const userSchoolInfo = storageService.get('user_school_info', {});
    const userMajor = userSchoolInfo.major || '计算机科学与技术';

    // 添加专业导师
    onlineFriends.value.push({
      name: `${userMajor}专业导师`,
      role: '专业导师',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Professional',
      prompt: `你是${userMajor}的考研指导老师，专业知识丰富，擅长解答考研相关问题，特别是${userMajor}专业的考研规划、复习方法和院校选择等方面的问题。`
    });
  }
}, { deep: true });

// 初始化时检查目标院校
onMounted(() => {
  // 加载用户的学校信息
  const userSchoolInfo = uni.getStorageSync('user_school_info') || {};
  // 检查是否有目标院校
  if (targetSchools.value.length > 0 && userSchoolInfo.major) {
    // 添加专业导师
    onlineFriends.value.push({
      name: `${userSchoolInfo.major}专业导师`,
      role: '专业导师',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Professional',
      prompt: `你是${userSchoolInfo.major}的考研指导老师，专业知识丰富，擅长解答考研相关问题，特别是${userSchoolInfo.major}专业的考研规划、复习方法和院校选择等方面的问题。`
    });
  }
});



// 深色模式
const isNightMode = computed(() => {
  return isDark.value && isNightTime();
});

onMounted(() => {
  loadData();
  initAudio();
  initRecorder();

  // 初始化主题系统
  themeStore = useThemeStore();

  // 同步主题状态
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  // 监听全局主题更新事件
  uni.$on('themeUpdate', (mode) => {
    isDark.value = mode === 'dark';
  });
});

// 监听全局主题更新事件，确保主题状态正确同步
uni.$on('updateTheme', (mode) => {
  isDark.value = mode === 'dark';
});

onShow(() => {
  // 每次显示时重新加载数据，确保登录状态和头像同步
  loadData();

  // 强制同步导航栏颜色
  const isDark = uni.getStorageSync('theme_mode') === 'dark';
  uni.setNavigationBarColor({
    frontColor: isDark ? '#ffffff' : '#000000',
    backgroundColor: isDark ? '#163300' : '#FFFFFF',
    animation: { duration: 0 }
  });
});

onUnmounted(() => {
  // 移除事件监听
  uni.$off('themeUpdate');
  if (audioCtx) {
    audioCtx.destroy();
    audioCtx = null;
  }
  if (recorderManager) {
    recorderManager.stop();
    recorderManager = null;
  }
});

const initAudio = () => {
  audioCtx = uni.createInnerAudioContext();
  audioCtx.onPlay(() => {
    isSpeaking.value = true;
  });
  audioCtx.onEnded(() => {
    isSpeaking.value = false;
  });
  audioCtx.onError((err) => {
    console.error('音频播放错误', err);
    isSpeaking.value = false;
  });
  audioCtx.onStop(() => {
    isSpeaking.value = false;
  });
};

const initRecorder = () => {
  recorderManager = uni.getRecorderManager();

  recorderManager.onStart(() => {
    isRecording.value = true;
    // 短促震动反馈
    uni.vibrateShort({
      type: 'light'
    });
  });

  recorderManager.onStop((res) => {
    isRecording.value = false;
    if (res.tempFilePath) {
      processVoice(res.tempFilePath);
    } else {
      uni.showToast({
        title: '录音失败，请重试',
        icon: 'none'
      });
    }
  });

  recorderManager.onError((err) => {
    console.error('录音错误', err);
    isRecording.value = false;
    uni.showToast({
      title: '录音出错，请重试',
      icon: 'none'
    });
  });
};

const handleTouchStart = () => {
  if (!recorderManager) {
    uni.showToast({
      title: '录音功能未初始化',
      icon: 'none'
    });
    return;
  }

  // 检查权限
  uni.authorize({
    scope: 'scope.record',
    success: () => {
      recorderManager.start({
        format: 'mp3',
        duration: 60000, // 最长60秒
        sampleRate: 16000,
        numberOfChannels: 1
      });
    },
    fail: () => {
      uni.showModal({
        title: '需要麦克风权限',
        content: '请在设置中开启麦克风权限',
        showCancel: false
      });
    }
  });
};

const handleTouchEnd = () => {
  if (recorderManager && isRecording.value) {
    recorderManager.stop();
  }
};

const processVoice = (filePath) => {
  uni.showLoading({ title: '语音识别中...' });

  // 模拟 STT 过程
  setTimeout(() => {
    uni.hideLoading();

    // 注意：这里只是模拟，实际应该调用真实的语音识别API
    // 暂时禁用自动发送，改为提示用户手动发送
    uni.showToast({
      title: '语音识别功能开发中，请使用文字输入',
      icon: 'none',
      duration: 2000
    });

    // 不再自动发送，让用户手动输入
    // userInput.value = mockText;
    // sendToAI();
  }, 1000);
};

const toggleInputMode = () => {
  isVoiceInput.value = !isVoiceInput.value;
  // 切换模式时停止录音
  if (isRecording.value && recorderManager) {
    recorderManager.stop();
  }
};

// 处理表情按钮
const handleEmoji = () => {
  uni.showToast({
    title: '表情功能开发中',
    icon: 'none'
  });
};

// Markdown 渲染函数（完整版，处理所有Markdown格式）
const renderMarkdown = (text) => {
  if (!text) return "";

  let processed = text
    // 1. 处理标题符号 # ## ### -> 移除或转换为粗体
    .replace(/^#{1,6}\s+(.*)$/gm, '<strong style="font-weight:700;color:#1C1C1E;font-size:16px;display:block;margin:8px 0;">$1</strong>')
    // 2. 处理粗体 **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#1C1C1E;">$1</strong>')
    // 3. 处理斜体 *text* -> <em>text</em>（但不在粗体处理之后，避免冲突）
    .replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em style="font-style:italic;">$1</em>')
    // 4. 处理代码 `code` -> <code>code</code>
    .replace(/`([^`]+)`/g, '<code style="background:#F5F5F7;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;">$1</code>')
    // 5. 处理换行
    .replace(/\n/g, '<br/>')
    // 6. 清理多余的#符号（如果还有残留）
    .replace(/#{1,6}/g, '');

  return processed;
};

const loadData = () => {
  userInfo.value = storageService.get('userInfo', {});
  userSchoolInfo.value = storageService.get('user_school_info', {});
  targetSchools.value = storageService.get('target_schools', []);
  const stats = storageService.get('study_stats', {});
  studyDays.value = Object.keys(stats).length || 1;
  isVoiceEnabled.value = storageService.get('voice_enabled', true) !== false;

  uni.getStorageInfo({
    success: (res) => {
      cacheSize.value = (res.currentSize || 0) + 'KB';
    }
  });
};

// 编辑报考院校
const handleEditSchool = () => {
  uni.showModal({
    title: '编辑报考院校',
    editable: true,
    placeholderText: '请输入报考院校',
    content: userSchoolInfo.value.school || '',
    success: (res) => {
      if (res.confirm && res.content) {
        userSchoolInfo.value.school = res.content.trim();
        storageService.save('user_school_info', userSchoolInfo.value);
        uni.showToast({
          title: '更新成功',
          icon: 'success'
        });
      }
    }
  });
};

// 编辑报考专业
const handleEditMajor = () => {
  uni.showModal({
    title: '编辑报考专业',
    editable: true,
    placeholderText: '请输入报考专业',
    content: userSchoolInfo.value.major || '',
    success: (res) => {
      if (res.confirm && res.content) {
        userSchoolInfo.value.major = res.content.trim();
        storageService.save('user_school_info', userSchoolInfo.value);
        uni.showToast({
          title: '更新成功',
          icon: 'success'
        });
      }
    }
  });
};

const playTTS = (text) => {
  if (!text || !audioCtx || !isVoiceEnabled.value) return;

  // 修复：禁用TTS功能，避免音频解码错误
  // 百度TTS API在某些环境下可能无法正常工作
  console.log('[Settings-Chat] 🔊 TTS功能已禁用（避免音频解码错误）');
  return;

  // 原代码保留但不执行
  /*
  // 停止当前播放
  try {
    audioCtx.stop();
  } catch (e) {
    console.log('停止音频', e);
  }
  
  // 调用 TTS 接口
  const speed = currentTutor.value.spd || 5;
  const url = `https://tts.baidu.com/text2audio?lan=zh&ie=UTF-8&spd=${speed}&text=${encodeURIComponent(text)}`;
  
  audioCtx.src = url;
  audioCtx.play();
  */
};

const startAIChat = (tutor) => {
  currentTutor.value = tutor;
  // 添加初始欢迎消息（确保历史消息显示）
  chatHistory.value = [{
    role: 'assistant',
    content: `你好，考研路上我陪你。我是${tutor.name}，请直接对我说话吧。`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }];
  showChat.value = true;
  userInput.value = '';
  // 确保消息列表渲染后再滚动
  setTimeout(() => {
    scrollChatToBottom();
  }, 300);
};

const closeChat = () => {
  // 停止录音
  if (isRecording.value && recorderManager) {
    recorderManager.stop();
  }
  // 停止播放
  if (audioCtx) {
    try {
      audioCtx.stop();
    } catch (e) {
      console.log('关闭音频', e);
    }
  }
  showChat.value = false;
  chatHistory.value = [];
  userInput.value = '';
  isThinking.value = false;
  isSpeaking.value = false;
  isRecording.value = false;
};

const sendToAI = async () => {
  if (!userInput.value.trim() || isRequesting.value) return;

  const content = userInput.value.trim();
  chatHistory.value.push({
    role: 'user',
    content,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  userInput.value = '';
  isRequesting.value = true;
  isThinking.value = true;
  scrollChatToBottom();

  // 优化：使用更轻量的提示，不打断用户输入
  // 移除Toast，改为在消息气泡中显示发送状态（可选）

  // ✅ 安全修复：使用后端代理调用 AI
  console.log('[Settings-Chat] 🤖 调用后端代理...');

  lafService.proxyAI('chat', {
    messages: [
      { role: 'system', content: currentTutor.value.prompt || `你是一个专业的考研老师，名叫${currentTutor.value.name}，负责${currentTutor.value.role}教学。` },
      ...chatHistory.value.filter(msg => msg.role !== 'system')
    ],
    temperature: 0.7
  }).then((res) => {
    isThinking.value = false;
    isRequesting.value = false;
    console.log('[Settings-Chat] ✅ AI 响应:', {
      statusCode: res.statusCode,
      hasData: !!res.data,
      hasChoices: !!(res.data && res.data.choices),
      choicesLength: res.data?.choices?.length || 0
    });

    if (res.data && res.data.choices && res.data.choices.length > 0) {
      const answer = res.data.choices[0].message.content;
      console.log('[Settings-Chat] 📝 AI 回复内容:', answer.substring(0, 100) + '...');
      chatHistory.value.push({
        role: 'assistant',
        content: answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      // 如果开启了语音，自动播放
      if (isVoiceEnabled.value && audioCtx) {
        setTimeout(() => {
          playTTS(answer);
        }, 300);
      }
    } else {
      console.warn('[Settings-Chat] ⚠️ AI 响应格式异常:', res.data);
      chatHistory.value.push({
        role: 'assistant',
        content: '抱歉，我刚刚走神了，请再说一遍。',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
    scrollChatToBottom();
  }).catch((err) => {
    console.error('[Settings-Chat] ❌ AI 请求失败:', err);
    isThinking.value = false;
    isRequesting.value = false;
    chatHistory.value.push({
      role: 'assistant',
      content: '网络连接失败，请检查网络后重试。',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    scrollChatToBottom();
  });
};

const scrollChatToBottom = () => {
  // 使用 scroll-into-view 确保滚动到底部
  setTimeout(() => {
    if (chatHistory.value.length > 0) {
      scrollIntoView.value = `msg-${chatHistory.value.length - 1}`;
    } else if (isThinking.value) {
      scrollIntoView.value = 'thinking';
    } else {
      scrollIntoView.value = 'msg-bottom';
    }
    // 备用方案：使用 scroll-top
    chatScrollTop.value = 99999;
  }, 100);
};

const toggleVoice = (e) => {
  isVoiceEnabled.value = e.detail.value;
  storageService.save('voice_enabled', isVoiceEnabled.value);
  if (!isVoiceEnabled.value && audioCtx) {
    try {
      audioCtx.stop();
    } catch (e) {
      console.log('停止音频', e);
    }
  }
  uni.showToast({
    title: isVoiceEnabled.value ? '已开启语音伴学' : '已关闭语音伴学',
    icon: 'none'
  });
};

const toggleDark = (e) => {
  isDark.value = e.detail.value;
  const mode = isDark.value ? 'dark' : 'light';
  // 使用主题工具函数统一处理
  setTheme(mode);

  const toastMsg = isDark.value
    ? (isNightTime() ? '已开启深色模式（护眼模式已激活）' : '已开启深色模式')
    : '已关闭深色模式';
  uni.showToast({ title: toastMsg, icon: 'none' });
};

const handleClearCache = () => {
  uni.showModal({
    title: '提示',
    content: '确定清理缓存吗？',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync();
        loadData();
      }
    }
  });
};

const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出当前账号吗？',
    confirmColor: '#E74C3C',
    success: (res) => {
      if (res.confirm) {
        // 只清除用户信息，保留其他数据
        storageService.remove('userInfo');
        userInfo.value = {};
        uni.showToast({ title: '已退出登录', icon: 'none' });
        // 延迟回到首页刷新
        setTimeout(() => {
          uni.reLaunch({ url: '/src/pages/index/index' });
        }, 1000);
      }
    }
  });
};

// 移除目标院校
const removeTargetSchool = (index) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除目标院校 "${targetSchools.value[index].name}" 吗？`,
    confirmColor: '#E74C3C',
    success: (res) => {
      if (res.confirm) {
        // 从数组中删除
        targetSchools.value.splice(index, 1);
        // 更新本地存储
        storageService.save('target_schools', targetSchools.value);
        uni.showToast({ title: '已删除目标院校', icon: 'success' });
      }
    }
  });
};

const navTo = (url) => {
  console.log('[Settings] 🚀 准备跳转到:', url);
  // 修复：使用正确的路径格式
  const correctUrl = url.startsWith('/') ? url : '/' + url;
  uni.navigateTo({
    url: correctUrl,
    success: () => {
      console.log('[Settings] ✅ 跳转成功:', correctUrl);
    },
    fail: (err) => {
      console.error('[Settings] ❌ 跳转失败:', err);
      // 尝试使用 switchTab（如果是 TabBar 页面）
      if (url.includes('school/index')) {
        uni.switchTab({
          url: '/src/pages/school/index',
          fail: () => {
            uni.showToast({ title: '跳转失败，请检查页面路径', icon: 'none' });
          }
        });
      } else {
        uni.showToast({ title: '跳转失败，请检查页面路径', icon: 'none' });
      }
    }
  });
};

// 处理目标院校点击
const handleTargetSchoolClick = () => {
  if (targetSchools.value.length > 0) {
    showTargetSchoolsModal.value = true;
  } else {
    // 跳转到择校页面（TabBar页面，使用switchTab）
    uni.switchTab({
      url: '/src/pages/school/index',
      success: () => {
        console.log('[Settings] ✅ 已跳转到择校页面');
      },
      fail: (err) => {
        console.error('[Settings] ❌ 跳转择校页面失败:', err);
        uni.showToast({ title: '跳转失败', icon: 'none' });
      }
    });
  }
};

// 处理添加目标院校
const handleAddTargetSchool = () => {
  showTargetSchoolsModal.value = false;
  // 跳转到择校页面（TabBar页面，使用switchTab）
  uni.switchTab({
    url: '/src/pages/school/index',
    success: () => {
      console.log('[Settings] ✅ 已跳转到择校页面');
    },
    fail: (err) => {
      console.error('[Settings] ❌ 跳转择校页面失败:', err);
      uni.showToast({ title: '跳转失败', icon: 'none' });
    }
  });
};

// 头像选择防抖锁
const isChoosingAvatar = ref(false);

// 微信最新登录规范：获取头像
const onChooseAvatar = (e) => {
  // 防抖：如果正在选择，直接返回
  if (isChoosingAvatar.value) {
    console.log('[Settings] ⚠️ 头像选择进行中，忽略重复点击');
    return;
  }

  // 加锁
  isChoosingAvatar.value = true;

  try {
    // #ifdef MP-WECHAT
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      console.log('[Settings] 📸 头像已选择:', avatarUrl);
      // 更新用户头像（立即更新，确保UI响应）
      userInfo.value.avatarUrl = avatarUrl;
      // 如果已有用户信息，保留其他字段
      if (!userInfo.value.nickName) {
        userInfo.value.nickName = userInfo.value.nickName || '考研人';
      }
      // 保存用户信息到本地
      storageService.save('userInfo', userInfo.value);
      console.log('[Settings] ✅ 头像已保存到本地存储');
      // 强制触发响应式更新（确保头像立即显示）
      const updatedUserInfo = { ...userInfo.value };
      userInfo.value = {};
      setTimeout(() => {
        userInfo.value = updatedUserInfo;
      }, 50);
      // 显示成功提示
      uni.showToast({ title: '头像已更新', icon: 'success' });
      // 如果没有登录，完成登录流程
      if (!userInfo.value.uid) {
        doRealLogin();
      }
    }
    // #endif

    // #ifndef MP-WECHAT
    // 非微信环境，使用模拟数据
    const mockAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Date.now();
    userInfo.value.avatarUrl = mockAvatar;
    if (!userInfo.value.nickName) {
      userInfo.value.nickName = '考研人';
    }
    // 保存用户信息到本地
    storageService.save('userInfo', userInfo.value);
    // 强制触发响应式更新
    const updatedUserInfo = { ...userInfo.value };
    userInfo.value = {};
    setTimeout(() => {
      userInfo.value = updatedUserInfo;
    }, 50);
    // 显示成功提示
    uni.showToast({ title: '头像已更新', icon: 'success' });
    if (!userInfo.value.uid) {
      doRealLogin();
    }
    // #endif
  } catch (error) {
    console.error('[Settings] ❌ 头像选择失败', error);
    uni.showToast({ title: '头像更新失败', icon: 'none' });
  } finally {
    // 1秒后解锁
    setTimeout(() => {
      isChoosingAvatar.value = false;
    }, 1000);
  }
};

// 微信最新登录规范：获取昵称
const onNicknameChange = (e) => {
  const nickName = e.detail.value;

  // #ifdef MP-WECHAT
  if (nickName && nickName.trim()) {
    userInfo.value.nickName = nickName.trim();
    // 如果头像已存在，保留头像；否则使用默认头像
    if (!userInfo.value.avatarUrl) {
      userInfo.value.avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Date.now();
    }
    doRealLogin();
  }
  // #endif

  // #ifndef MP-WECHAT
  // 非微信环境
  if (nickName && nickName.trim()) {
    userInfo.value.nickName = nickName.trim();
    // 如果头像已存在，保留头像；否则使用默认头像
    if (!userInfo.value.avatarUrl) {
      userInfo.value.avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Date.now();
    }
    saveUserInfo();
    uni.showToast({ title: '昵称已更新', icon: 'success' });
  }
  // #endif
};

// 真实登录闭环
const doRealLogin = () => {
  // #ifdef MP-WECHAT
  uni.showLoading({ title: '同步数据中...' });

  uni.login({
    provider: 'weixin',
    success: (loginRes) => {
      console.log('[Settings] 🔐 WeChat Code:', loginRes.code);
      // 商业化标准：这里应该调用后端 API

      // 临时模拟：生成 UID（如果还没有）
      if (!userInfo.value.uid) {
        userInfo.value.uid = 'USER_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        console.log('[Settings] 🆔 生成用户ID:', userInfo.value.uid);
      }

      // 确保头像和昵称都存在
      if (!userInfo.value.avatarUrl) {
        userInfo.value.avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Date.now();
      }
      if (!userInfo.value.nickName) {
        userInfo.value.nickName = '考研人';
      }

      saveUserInfo();
      uni.hideLoading();
      uni.showToast({ title: '登录成功', icon: 'success' });
      console.log('[Settings] ✅ 登录完成，用户信息:', {
        uid: userInfo.value.uid,
        nickName: userInfo.value.nickName,
        hasAvatar: !!userInfo.value.avatarUrl
      });
    },
    fail: (err) => {
      console.error('[Settings] ❌ 登录失败', err);
      uni.hideLoading();
      uni.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
  });
  // #endif

  // #ifndef MP-WECHAT
  // 非微信环境，直接保存
  // 确保头像和昵称都存在
  if (!userInfo.value.avatarUrl) {
    userInfo.value.avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Date.now();
  }
  if (!userInfo.value.nickName) {
    userInfo.value.nickName = '考研人';
  }
  if (!userInfo.value.uid) {
    userInfo.value.uid = 'USER_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }
  saveUserInfo();
  uni.showToast({ title: '信息已保存', icon: 'success' });
  // #endif
};

// 保存用户信息到本地缓存
const saveUserInfo = () => {
  console.log('[Settings] 💾 保存用户信息:', {
    uid: userInfo.value.uid,
    nickName: userInfo.value.nickName,
    avatarUrl: userInfo.value.avatarUrl ? '已设置' : '未设置'
  });
  uni.setStorageSync('userInfo', userInfo.value);
  // 强制触发响应式更新
  const updatedInfo = { ...userInfo.value };
  userInfo.value = {};
  setTimeout(() => {
    userInfo.value = updatedInfo;
  }, 50);
};

// 头像点击事件处理（优化：确保登录功能正常）
const handleAvatarClick = () => {
  console.log('[Settings] 👤 头像被点击，当前登录状态:', !!userInfo.value.uid);

  if (!userInfo.value.uid) {
    // 未登录状态，提示用户点击头像按钮进行登录
    uni.showModal({
      title: '登录提示',
      content: '请点击头像按钮选择头像和昵称完成登录',
      showCancel: false,
      confirmText: '知道了'
    });
  } else {
    // 已登录，显示用户信息
    uni.showToast({
      title: `已登录：${userInfo.value.nickName || '考研人'}`,
      icon: 'none',
      duration: 2000
    });
  }
};

// 头像加载错误处理
const onAvatarError = (e) => {
  console.log('[Settings] ⚠️ 头像加载失败，使用默认头像', e);
  // 注意：不要在这里修改 userInfo.avatarUrl，否则会覆盖用户选择的头像
  // 只在真正加载失败时使用默认头像显示，但不保存到 userInfo
  // 如果头像URL无效，让用户重新选择
  if (userInfo.value.avatarUrl && userInfo.value.avatarUrl !== defaultAvatar) {
    console.log('[Settings] ⚠️ 头像URL无效，但保留用户选择:', userInfo.value.avatarUrl);
    // 不修改 userInfo，让用户重新选择
  }
};

// 关闭邀请弹窗
const handleCloseInviteModal = () => {
  showInviteModal.value = false;
};

// 打开海报生成弹窗
const handleOpenPoster = () => {
  showInviteModal.value = false; // 先关闭邀请弹窗
  setTimeout(() => {
    showPosterModal.value = true; // 然后打开海报弹窗
  }, 300); // 延迟300ms，让关闭动画完成
};

// 关闭海报弹窗
const handleClosePosterModal = () => {
  showPosterModal.value = false;
};

// 跳转到好友列表
const navigateToFriends = () => {
  console.log('[Settings] 🚀 跳转到好友列表');
  uni.navigateTo({
    url: '/src/pages/social/friend-list',
    success: () => {
      console.log('[Settings] ✅ 跳转成功');
    },
    fail: (err) => {
      console.error('[Settings] ❌ 跳转失败:', err);
      uni.showToast({
        title: '跳转失败',
        icon: 'none'
      });
    }
  });
};

// 选择主题
const selectTheme = (type) => {
  if (!themeStore) {
    themeStore = useThemeStore();
  }

  themeStore.setThemeType(type);
  showThemeSelector.value = false;

  uni.showToast({
    title: `已切换到${type === 'wise' ? 'Wise' : 'Bitget Wallet'}主题`,
    icon: 'success'
  });
};
</script>

<style scoped>
/* 基础样式 - 像素完美版 */
.settings-container {
  min-height: 100vh;
  background-color: var(--bg-main, #ffffff);
  padding: 32rpx;
  /* 8px网格 */
  padding-bottom: 100px;
  box-sizing: border-box;
  color: var(--text-body, #495057);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s ease;
}

/* 添加fadeInUp动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 深色模式 */
.settings-container.dark-mode {
  --bg-main: #163300;
  --text-body: #E2E8F0;
  --text-title: #ffffff;
  --card-bg: rgba(255, 255, 255, 0.05);
  --card-border: rgba(255, 255, 255, 0.1);
  --accent-green: #9FE870;
  --accent-blue: #00B9FF;
  --danger-red: #ff453a;
  --input-bg: rgba(255, 255, 255, 0.1);
  --input-placeholder: #666666;
}

/* 顶部导航 - 像素完美版 */
.top-nav {
  margin-top: 40px;
  margin-bottom: 32rpx;
  /* 8px网格 */
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
  animation-delay: 0.05s;
}

.nav-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-title, #000000);
  line-height: 1.3;
  /* 大标题紧凑 */
  letter-spacing: -0.5px;
  /* 大标题紧凑 */
}

/* 用户信息卡片 - 全新顶级设计（紧凑、现代、高粘性） */
.user-card.wise-card {
  background: linear-gradient(135deg, var(--accent-green, #37B24D) 0%, var(--accent-green-dark, #2F9E44) 100%);
  border: none;
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(55, 178, 77, 0.25);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* 添加光晕效果 */
.user-card.wise-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.user-card.wise-card:hover::before {
  opacity: 1;
}

.user-card.wise-card:hover {
  box-shadow: 0 12px 32px rgba(55, 178, 77, 0.35);
  transform: translateY(-4px);
}

.user-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
}

.avatar-btn {
  background: none;
  padding: 0;
  border: none;
  line-height: normal;
  position: relative;
}

.avatar-btn::after {
  border: none;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.avatar-section:hover .avatar {
  transform: scale(1.08);
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.login-badge {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  text-align: center;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.login-badge.logged-in {
  background: rgba(255, 255, 255, 0.35);
}

.user-info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nickname-input {
  font-size: 22px;
  font-weight: 700;
  color: white;
  background-color: transparent;
  border: none;
  padding: 0;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  letter-spacing: -0.5px;
  line-height: 1.3;
  /* 添加呼吸感 */
}

.nickname-placeholder {
  color: rgba(255, 255, 255, 0.65);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-item {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-item:active {
  background: rgba(255, 255, 255, 0.28);
  transform: scale(0.97);
}

.info-label {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 3px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.5;
  /* 添加呼吸感 */
}

.info-value {
  display: block;
  font-size: 13px;
  color: white;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  line-height: 1.5;
  /* 添加呼吸感 */
}

.stats-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
}

.stat-card {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  padding: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-card:active {
  background: rgba(255, 255, 255, 0.28);
  transform: scale(0.97);
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 900;
  color: white;
  margin-bottom: 3px;
  line-height: 1.2;
  /* 数值轻微呼吸感 */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  letter-spacing: -0.5px;
  /* 数字紧凑 */
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
  letter-spacing: 0.3px;
  line-height: 1.5;
  /* 添加呼吸感 */
}

/* 深色模式下的用户卡片（Bitget风格） */
.dark-mode .user-card.wise-card {
  background: linear-gradient(135deg, #1a2840 0%, #2d4560 100%);
  box-shadow: 0 8px 24px rgba(10, 132, 255, 0.25);
}

.dark-mode .user-card.wise-card::before {
  background: radial-gradient(circle, rgba(10, 132, 255, 0.2) 0%, transparent 70%);
}

.dark-mode .user-card.wise-card:hover {
  box-shadow: 0 12px 32px rgba(10, 132, 255, 0.35);
}

/* 通用区块样式 - 像素完美版 */
.section {
  margin-bottom: 32rpx;
  /* 8px网格 */
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
}

/* 延迟动画 */
.section:nth-child(1) {
  animation-delay: 0.1s;
}

.section:nth-child(2) {
  animation-delay: 0.2s;
}

.section:nth-child(3) {
  animation-delay: 0.3s;
}

.section:nth-child(4) {
  animation-delay: 0.4s;
}

.section:nth-child(5) {
  animation-delay: 0.5s;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-title, #000000);
  margin: 0;
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.online-badge {
  font-size: 12px;
  color: var(--accent-green, #00a96d);
  background-color: rgba(0, 169, 109, 0.1);
  padding: 4px 12px;
  border-radius: 12px;
}

.invite-btn-small {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--accent-green, #00a96d);
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.invite-btn-small:active {
  opacity: 0.85;
  transform: scale(0.95);
}

.invite-icon {
  font-size: 14px;
}

.invite-text-small {
  font-size: 12px;
  color: white;
}

/* AI导师列表 */
.tutor-list {
  background-color: var(--card-bg, #ffffff);
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.tutor-item {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
  transition: background-color 0.2s ease;
}

.tutor-item:last-child {
  border-bottom: none;
}

.tutor-item:hover {
  background-color: rgba(0, 169, 109, 0.05);
}

.tutor-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tutor-info {
  flex: 1;
}

.tutor-name {
  display: block;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-title, #000000);
  margin-bottom: 4px;
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.tutor-role {
  font-size: 14px;
  color: var(--text-body, #495057);
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.chat-btn {
  background-color: transparent;
  border: 2px solid var(--accent-green, #00a96d);
  color: var(--accent-green, #00a96d);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-btn:hover {
  background-color: var(--accent-green, #00a96d);
  color: white;
  transform: scale(1.05);
}

/* 设置选项列表 */
.settings-list {
  background-color: var(--card-bg, #ffffff);
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background-color: rgba(0, 169, 109, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-title, #000000);
  margin-bottom: 4px;
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.setting-desc {
  font-size: 12px;
  color: var(--text-body, #495057);
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.cache-size {
  font-size: 14px;
  color: var(--text-body, #495057);
}

/* 退出登录按钮 */
.logout-btn {
  width: 100%;
  background-color: transparent;
  border: 2px solid var(--danger-red, #ff453a);
  color: var(--danger-red, #ff453a);
  border-radius: 16px;
  padding: 16px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.logout-btn:hover {
  background-color: var(--danger-red, #ff453a);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255, 69, 58, 0.3);
}

/* 底部安全区域 */
.footer-safe {
  height: 20px;
}

/* 目标院校管理弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--card-bg, #ffffff);
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-title, #000000);
}

.close-btn {
  font-size: 24px;
  color: var(--text-light, #9e9e9e);
  cursor: pointer;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: var(--text-title, #000000);
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.empty-targets {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-light, #9e9e9e);
}

.add-btn {
  margin-top: 20px;
  background-color: var(--accent-green, #00a96d);
  color: white;
  border: none;
  border-radius: 16px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-btn:hover {
  background-color: var(--accent-green-dark, #008055);
  transform: translateY(-2px);
}

.target-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.target-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: var(--card-bg, #ffffff);
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.target-item:hover {
  background-color: rgba(0, 169, 109, 0.05);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.target-avatar {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-right: 16px;
  object-fit: cover;
}

.target-info {
  flex: 1;
}

.target-name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-title, #000000);
  margin-bottom: 4px;
}

.target-location {
  font-size: 12px;
  color: var(--text-light, #9e9e9e);
}

.target-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn {
  color: #FF453A;
  background-color: rgba(255, 69, 58, 0.1);
}

.delete-btn:hover {
  background-color: rgba(255, 69, 58, 0.2);
}

/* AI 对话窗样式 */
.chat-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
}

.chat-panel {
  width: 100%;
  height: 75vh;
  background-color: var(--card-bg, #ffffff);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  color: var(--text-title, #000000);
}

/* 动态波形指示器 */
.speaking-indicator {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 24px;
}

.speaking-indicator .bar {
  width: 3px;
  height: 40%;
  background-color: var(--accent-green, #00a96d);
  border-radius: 2px;
  animation: bounce 0.5s infinite alternate;
}

.speaking-indicator .bar.rec {
  background-color: var(--danger-red, #ff453a);
  animation-duration: 0.3s;
}

.speaking-indicator .bar:nth-child(1) {
  animation-delay: 0s;
}

.speaking-indicator .bar:nth-child(2) {
  animation-delay: 0.1s;
}

.speaking-indicator .bar:nth-child(3) {
  animation-delay: 0.2s;
}

.speaking-indicator .bar:nth-child(4) {
  animation-delay: 0.3s;
}

.speaking-indicator .bar:nth-child(5) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  from {
    height: 20%;
  }

  to {
    height: 100%;
  }
}

.chat-content {
  flex: 1;
  padding: 10px 0;
  overflow-y: auto;
}

.msg-bubble {
  margin-bottom: 20px;
  padding: 16px 20px;
  border-radius: 18px;
  max-width: 80%;
  position: relative;
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}

.msg-time {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.4);
  margin-top: 6px;
  text-align: right;
}

.msg-bubble.assistant .msg-time {
  text-align: left;
  color: rgba(0, 0, 0, 0.4);
}

.msg-bubble.user .msg-time {
  text-align: right;
  color: rgba(255, 255, 255, 0.7);
}

.msg-bubble.assistant {
  background-color: rgba(0, 169, 109, 0.1);
  color: var(--text-body, #495057);
  align-self: flex-start;
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

.msg-bubble.user {
  background-color: var(--accent-green, #00a96d);
  color: white;
  align-self: flex-end;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.voice-play-icon {
  position: absolute;
  bottom: -24px;
  right: 10px;
  font-size: 20px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.voice-play-icon:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* 底部输入区 */
.chat-input-area {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--card-border, #e9ecef);
}

.mode-switch {
  width: 40px;
  height: 40px;
  background-color: rgba(0, 169, 109, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mode-switch:hover {
  background-color: rgba(0, 169, 109, 0.2);
  transform: scale(1.05);
}

.chat-input-area input,
.chat-input-area .chat-input {
  flex: 1;
  background-color: var(--input-bg, #f5f5f5);
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 24px;
  padding: 12px 20px;
  font-size: 14px;
  color: var(--text-title, #000000);
  min-height: 40px;
  box-sizing: border-box;
}

.chat-input-area .emoji-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 8px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.chat-input-area .emoji-btn:active {
  opacity: 0.7;
  transform: scale(0.95);
}

.chat-input-area .send-btn {
  min-width: 60px;
  height: 40px;
  padding: 0 16px;
  background-color: var(--accent-green, #00a96d);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.chat-input-area .send-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.voice-press-btn {
  flex: 1;
  height: 48px;
  background-color: rgba(0, 169, 109, 0.1);
  border: 1px solid var(--accent-green, #00a96d);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  color: var(--accent-green, #00a96d);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.voice-press-btn.pressing {
  background-color: var(--accent-green, #00a96d);
  color: white;
  transform: scale(0.98);
}

.chat-input-area button {
  background-color: var(--accent-green, #00a96d);
  color: white;
  border: none;
  border-radius: 24px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.chat-input-area button:hover {
  background-color: #008055;
  transform: translateY(-1px);
}

.close-icon {
  font-size: 24px;
  color: var(--text-body, #495057);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 4px;
}

.close-icon:hover {
  color: var(--text-title, #000000);
  transform: scale(1.1);
}

/* 我的好友入口卡片 */
.friend-entry-card {
  background-color: var(--card-bg, #ffffff);
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.friend-entry-card:hover {
  background-color: rgba(0, 169, 109, 0.05);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.friend-entry-card:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.entry-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.entry-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #9FE870, #7ED321);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: 0 4px 12px rgba(159, 232, 112, 0.3);
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entry-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-title, #000000);
}

.entry-desc {
  font-size: 13px;
  color: var(--text-body, #495057);
  opacity: 0.8;
}

.entry-arrow {
  font-size: 32px;
  color: var(--text-body, #495057);
  opacity: 0.4;
  font-weight: 300;
}

/* 深色模式下的好友入口卡片 */
.dark-mode .friend-entry-card {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .friend-entry-card:hover {
  background-color: rgba(159, 232, 112, 0.1);
}

.dark-mode .entry-title {
  color: #ffffff;
}

.dark-mode .entry-desc {
  color: #E2E8F0;
}

.dark-mode .entry-arrow {
  color: #E2E8F0;
}

/* 问题9修复：邀请按钮重新设计 */
.invite-btn-header {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #00a96d 0%, #008055 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 169, 109, 0.3);
  -webkit-tap-highlight-color: transparent;
}

.invite-btn-header:hover {
  box-shadow: 0 4px 12px rgba(0, 169, 109, 0.4);
  transform: translateY(-1px);
}

.invite-btn-header:active {
  opacity: 0.9;
  transform: translateY(0) scale(0.98);
}

.invite-icon-header {
  font-size: 14px;
}

.invite-text-header {
  font-size: 12px;
  color: white;
}

/* 主题选择器样式 */
.theme-selector {
  max-width: 500px;
}

.theme-option {
  display: flex;
  align-items: center;
  padding: 20px;
  margin-bottom: 16px;
  background-color: var(--card-bg, #ffffff);
  border: 2px solid var(--card-border, #e9ecef);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.theme-option:hover {
  border-color: var(--accent-green, #00a96d);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.theme-option:last-child {
  margin-bottom: 0;
}

.theme-preview {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  margin-right: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.preview-color {
  width: 100%;
  height: 100%;
}

.theme-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-title, #000000);
}

.theme-desc {
  font-size: 13px;
  color: var(--text-body, #495057);
  opacity: 0.8;
}

.theme-check {
  font-size: 24px;
  color: var(--accent-green, #00a96d);
  font-weight: 700;
  margin-left: 12px;
}

/* 深色模式下的主题选择器 */
.dark-mode .theme-option {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .theme-option:hover {
  border-color: var(--accent-green, #9FE870);
  background-color: rgba(159, 232, 112, 0.1);
}

.dark-mode .theme-name {
  color: #ffffff;
}

.dark-mode .theme-desc {
  color: #E2E8F0;
}

.setting-arrow {
  font-size: 20px;
  color: var(--text-body, #495057);
  opacity: 0.4;
}
</style>
