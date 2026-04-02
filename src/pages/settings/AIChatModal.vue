<template>
  <!-- F002: 智能对话弹窗 — 从 settings/index.vue 提取 -->
  <view v-if="visible" class="chat-modal">
    <view class="chat-mask" @tap="handleClose" />
    <view class="chat-panel">
      <view class="chat-header">
        <view class="header-left">
          <text>与 {{ tutor.name }} 对话</text>
          <view v-if="isSpeaking || isRecording" class="speaking-indicator">
            <view v-for="i in 5" :key="i" class="bar" :class="{ rec: isRecording }" />
          </view>
        </view>
        <text class="close-icon" @tap="handleClose"><BaseIcon name="close" :size="32" /></text>
      </view>
      <scroll-view scroll-y class="chat-content" :scroll-top="chatScrollTop" :scroll-into-view="scrollIntoView">
        <view v-for="(msg, i) in chatHistory" :id="`msg-${i}`" :key="i" :class="['msg-bubble', msg.role]">
          <rich-text v-if="msg.role === 'assistant'" :nodes="renderMarkdown(msg.content)" />
          <text v-else>
            {{ msg.content }}
          </text>
          <view v-if="msg.time" class="msg-time">
            {{ msg.time }}
          </view>
          <view v-if="msg.role === 'assistant' && voiceEnabled" class="voice-play-icon" @tap="playTTS(msg.content)">
            <BaseIcon name="volume" :size="32" />
          </view>
        </view>
        <view v-if="isThinking" id="thinking" class="msg-bubble assistant">
          <text>正在思考中...</text>
        </view>
        <view id="msg-bottom" style="height: 20px" />
      </scroll-view>
      <view class="chat-input-area">
        <view class="mode-switch" @tap="toggleInputMode">
          <BaseIcon v-if="isVoiceInput" name="keyboard" :size="40" />
          <BaseIcon v-else name="microphone" :size="40" />
        </view>

        <input
          v-if="!isVoiceInput"
          v-model="userInput"
          placeholder="输入备考问题..."
          confirm-type="send"
          class="chat-input"
          maxlength="500"
          @confirm="sendToAI"
        />

        <view
          v-else
          class="voice-press-btn"
          :class="{ pressing: isRecording }"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
          @touchcancel="handleTouchEnd"
        >
          <text>{{ isRecording ? '松开 发送' : '按住 说话' }}</text>
        </view>

        <view v-if="!isVoiceInput" class="emoji-btn" @tap="handleEmoji">
          <BaseIcon name="smiley" :size="40" />
        </view>

        <button v-if="!isVoiceInput" :loading="isRequesting" class="send-btn" @tap="sendToAI">发送</button>
      </view>

      <!-- 表情选择器 -->
      <view v-if="showEmojiPicker" class="emoji-picker">
        <view class="emoji-grid">
          <view v-for="(emoji, idx) in emojiList" :key="idx" class="emoji-item" @tap="selectEmoji(emoji)">
            <text>{{ emoji }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import { sanitizeAIChatInput } from '@/utils/security/sanitize.js';
import { useSchoolStore } from '@/stores/modules/school.js';
import { useToolsStore } from '@/stores/modules/tools.js';

const ENABLE_WECHAT_SI_PLUGIN = false;

export default {
  name: 'AIChatModal',
  props: {
    visible: { type: Boolean, default: false },
    tutor: { type: Object, default: () => ({}) },
    voiceEnabled: { type: Boolean, default: true }
  },
  emits: ['close'],
  data() {
    return {
      userInput: '',
      chatHistory: [],
      isThinking: false,
      chatScrollTop: 0,
      scrollIntoView: '',
      isVoiceInput: true,
      isRecording: false,
      isSpeaking: false,
      isRequesting: false,
      showEmojiPicker: false,
      emojiList: [
        '😊',
        '😄',
        '😃',
        '😀',
        '😁',
        '😆',
        '😅',
        '🤣',
        '😂',
        '🙂',
        '😉',
        '😌',
        '😍',
        '🥰',
        '😘',
        '😗',
        '😙',
        '😚',
        '😋',
        '😛',
        '😜',
        '🤪',
        '😝',
        '🤑',
        '🤗',
        '🤭',
        '🤫',
        '🤔',
        '🤐',
        '🤨',
        '😐',
        '😑',
        '😶',
        '😏',
        '😒',
        '🙄',
        '😬',
        '🤥',
        '😌',
        '😔',
        '👍',
        '👎',
        '👏',
        '🙌',
        '🤝',
        '💪',
        '✌️',
        '🤞',
        '🤟',
        '🤘',
        '📚',
        '📖',
        '✏️',
        '📝',
        '🎓',
        '🏆',
        '⭐',
        '💯',
        '✅',
        '❌'
      ],
      recorderManager: null,
      audioCtx: null,
      // [AUDIT FIX R262] 追踪所有 setTimeout，防止组件销毁后回调操作已卸载组件
      pendingTimers: []
    };
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.openChat();
      }
    }
  },
  mounted() {
    this.initAudio();
    this.initRecorder();
  },
  beforeUnmount() {
    // [AUDIT FIX R262] 批量清理所有待执行的 setTimeout
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];
    if (this.audioCtx) {
      this.audioCtx.destroy();
      this.audioCtx = null;
    }
    if (this.recorderManager) {
      this.recorderManager.stop();
      this.recorderManager = null;
    }
  },
  methods: {
    // [AUDIT FIX R262] 安全的 setTimeout — 自动追踪，组件销毁时批量清理
    _safeTimeout(fn, delay) {
      const id = setTimeout(() => {
        this.pendingTimers = this.pendingTimers.filter((t) => t !== id);
        fn();
      }, delay);
      this.pendingTimers.push(id);
      return id;
    },
    openChat() {
      this.chatHistory = [
        {
          role: 'assistant',
          content: `你好，考研路上我陪你。我是${this.tutor.name}，请直接对我说话吧。`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];
      this.userInput = '';
      this._safeTimeout(() => {
        this.scrollChatToBottom();
      }, 300);
    },
    handleClose() {
      if (this.isRecording && this.recorderManager) {
        this.recorderManager.stop();
      }
      if (this.audioCtx) {
        try {
          this.audioCtx.stop();
        } catch (e) {
          logger.log('关闭音频', e);
        }
      }
      this.chatHistory = [];
      this.userInput = '';
      this.isThinking = false;
      this.isSpeaking = false;
      this.isRecording = false;
      this.$emit('close');
    },
    sendToAI() {
      if (!this.userInput.trim() || this.isRequesting) return;

      // [AUDIT FIX R135] 净化用户输入 — 移除危险字符，防 XSS/注入
      const content = sanitizeAIChatInput(this.userInput.trim(), 2000);
      if (!content) return;

      // 9.4: 输入长度限制，防止 API 调用失败或成本过高
      const MAX_INPUT_LENGTH = 2000;
      if (content.length > MAX_INPUT_LENGTH) {
        toast.info(`输入内容过长，请控制在 ${MAX_INPUT_LENGTH} 字以内`);
        return;
      }

      this.chatHistory.push({
        role: 'user',
        content,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      this.userInput = '';
      this.isRequesting = true;
      this.isThinking = true;
      this.scrollChatToBottom();

      logger.log('[AIChatModal] 调用后端代理...');

      // 9.1: 使用 content 字段（后端要求），而非 messages 数组
      // 9.9: 优化上下文窗口和参数 — 限制历史长度控制成本
      const recentHistory = this.chatHistory
        .filter((msg) => msg.role !== 'system')
        .slice(-6) // 最近 3 轮对话
        .map((msg) => `${msg.role === 'user' ? '用户' : '老师'}：${msg.content}`)
        .join('\n');
      const systemHint =
        this.tutor.prompt || `你是一个专业的考研老师，名叫${this.tutor.name}，负责${this.tutor.role}教学。请简洁回答。`;
      // 截断上下文，避免超长对话累积过多 token
      const MAX_CONTEXT_CHARS = 3000;
      let contextStr = recentHistory;
      if (contextStr.length > MAX_CONTEXT_CHARS) {
        contextStr = contextStr.slice(-MAX_CONTEXT_CHARS);
      }
      const aiContent = `${systemHint}\n\n对话记录：\n${contextStr}`;

      const schoolStore = useSchoolStore();
      schoolStore
        .aiRecommend('chat', {
          content: aiContent,
          temperature: 0.8 // 聊天场景适当提高创造性
        })
        .then((res) => {
          // 9.6: 可重试错误自动重试（最多1次），非网络错误不重试
          if (res.success === false && res._offline && !this._aiRetried) {
            this._aiRetried = true;
            logger.log('[AIChatModal] Network error, retrying in 2s...');
            this._safeTimeout(() => {
              schoolStore
                .aiRecommend('chat', { content: aiContent })
                .then((retryRes) => {
                  this._aiRetried = false;
                  this._handleAIResponse(retryRes);
                })
                .catch((retryErr) => {
                  this._aiRetried = false;
                  this._handleAIError(retryErr);
                });
            }, 2000);
            return;
          }
          this._aiRetried = false;
          this._handleAIResponse(res);
        })
        .catch((err) => {
          this._aiRetried = false;
          this._handleAIError(err);
        });
    },

    // 9.6: 智能响应处理（提取方法，供重试复用）
    _handleAIResponse(res) {
      this.isThinking = false;
      this.isRequesting = false;

      if (res.success === false || (res.code && res.code !== 0)) {
        const errorMsg = res.message || '智能服务暂时不可用';
        logger.error('[AIChatModal] 智能响应错误:', errorMsg);
        this.chatHistory.push({
          role: 'assistant',
          content: res._offline ? '当前网络不可用，请检查网络后重试。' : `抱歉，${errorMsg}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        this.scrollChatToBottom();
        return;
      }

      let answer = '';
      if (typeof res.data === 'string') {
        answer = res.data;
      } else if (res.data && res.data.choices && res.data.choices.length > 0) {
        answer = res.data.choices[0]?.message?.content || '';
      }

      if (answer) {
        this.chatHistory.push({
          role: 'assistant',
          content: answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (this.voiceEnabled && this.audioCtx) {
          this._safeTimeout(() => {
            this.playTTS(answer);
          }, 300);
        }
      } else {
        this.chatHistory.push({
          role: 'assistant',
          content: '抱歉，我刚刚走神了，请再说一遍。',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
      this.scrollChatToBottom();
    },

    _handleAIError(err) {
      logger.error('[AIChatModal] 智能请求失败:', err);
      this.isThinking = false;
      this.isRequesting = false;
      this.chatHistory.push({
        role: 'assistant',
        content: '网络连接失败，请检查网络后重试。',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      this.scrollChatToBottom();
    },
    scrollChatToBottom() {
      this._safeTimeout(() => {
        if (this.chatHistory.length > 0) {
          this.scrollIntoView = `msg-${this.chatHistory.length - 1}`;
        } else if (this.isThinking) {
          this.scrollIntoView = 'thinking';
        } else {
          this.scrollIntoView = 'msg-bottom';
        }
        this.chatScrollTop = 99999;
      }, 100);
    },
    async playTTS(text) {
      if (!text || !this.audioCtx || !this.voiceEnabled) return;

      const trimmedText = String(text).trim().slice(0, 300);
      if (!trimmedText) return;

      try {
        const toolsStore = useToolsStore();
        const response = await toolsStore.textToSpeech(trimmedText, {
          voice: 'tongtong',
          format: 'wav'
        });

        if (response.code !== 0 || !response.data?.audioBase64) {
          return;
        }

        const audioBase64 = response.data.audioBase64;
        const mimeType = response.data.mimeType || 'audio/wav';

        // #ifdef MP-WEIXIN
        try {
          const fs = uni.getFileSystemManager();
          const filePath = `${wx.env.USER_DATA_PATH}/tts_${Date.now()}.wav`;
          fs.writeFile({
            filePath,
            data: audioBase64,
            encoding: 'base64',
            success: () => {
              this.audioCtx.src = filePath;
              this.audioCtx.play();
            },
            fail: () => {
              this.audioCtx.src = `data:${mimeType};base64,${audioBase64}`;
              this.audioCtx.play();
            }
          });
        } catch (e) {
          logger.warn('[AIChatModal] 写入 TTS 音频失败，回退 data URL', e);
          this.audioCtx.src = `data:${mimeType};base64,${audioBase64}`;
          this.audioCtx.play();
        }
        // #endif

        // #ifndef MP-WEIXIN
        this.audioCtx.src = `data:${mimeType};base64,${audioBase64}`;
        this.audioCtx.play();
        // #endif
      } catch (error) {
        logger.warn('[AIChatModal] TTS 播放失败:', error);
      }
    },
    toggleInputMode() {
      this.isVoiceInput = !this.isVoiceInput;
      if (this.isRecording && this.recorderManager) {
        this.recorderManager.stop();
      }
    },
    handleEmoji() {
      this.showEmojiPicker = !this.showEmojiPicker;
    },
    selectEmoji(emoji) {
      this.userInput += emoji;
      this.showEmojiPicker = false;
    },
    escapeHtml(text) {
      if (!text) return '';
      const htmlEntities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
      };
      return String(text).replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
    },
    renderMarkdown(text) {
      if (!text) return '';
      let processed = this.escapeHtml(text);
      processed = processed
        .replace(/^#{1,6}\s+(.*)$/gm, '<strong>$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em style="font-style:italic;">$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br/>')
        .replace(/#{1,6}/g, '');
      return processed;
    },
    initAudio() {
      this.audioCtx = uni.createInnerAudioContext();
      this.audioCtx.onPlay(() => {
        this.isSpeaking = true;
      });
      this.audioCtx.onEnded(() => {
        this.isSpeaking = false;
      });
      this.audioCtx.onError((err) => {
        logger.error('音频播放错误', err);
        this.isSpeaking = false;
      });
      this.audioCtx.onStop(() => {
        this.isSpeaking = false;
      });
    },
    initRecorder() {
      // #ifdef MP-WEIXIN
      try {
        this.recorderManager = uni.getRecorderManager();
        this.recorderManager.onStart(() => {
          this.isRecording = true;
          uni.vibrateShort({ type: 'light' });
        });
        this.recorderManager.onStop((res) => {
          this.isRecording = false;
          if (res.tempFilePath) {
            this.processVoice(res.tempFilePath);
          } else {
            toast.info('录音失败，请重试');
          }
        });
        let errorToastShown = false;
        this.recorderManager.onError((err) => {
          logger.error('录音错误', err);
          this.isRecording = false;
          if (!errorToastShown) {
            errorToastShown = true;
            let errorMsg = '录音出错，请重试';
            if (err && err.errMsg) {
              if (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize')) {
                errorMsg = '请先授权麦克风权限';
              } else if (err.errMsg.includes('bindRecorderManager')) {
                errorMsg = '录音功能初始化失败';
              }
            }
            toast.info(errorMsg);
            this._safeTimeout(() => {
              errorToastShown = false;
            }, 2000);
          }
        });
        if (this.recorderManager.onInterruptionBegin) {
          this.recorderManager.onInterruptionBegin(() => {
            this.isRecording = false;
          });
        }
        logger.log('[AIChatModal] 录音管理器初始化成功');
      } catch (e) {
        logger.error('[AIChatModal] 录音管理器初始化失败:', e);
        this.recorderManager = null;
      }
      // #endif
      // #ifdef APP-PLUS
      try {
        this.recorderManager = uni.getRecorderManager();
        this.recorderManager.onStart(() => {
          this.isRecording = true;
          uni.vibrateShort({ type: 'light' });
        });
        this.recorderManager.onStop((res) => {
          this.isRecording = false;
          if (res.tempFilePath) {
            this.processVoice(res.tempFilePath);
          } else {
            toast.info('录音失败，请重试');
          }
        });
        this.recorderManager.onError((err) => {
          logger.error('录音错误', err);
          this.isRecording = false;
          toast.info('录音出错，请重试');
        });
        logger.log('[AIChatModal] App端录音管理器初始化成功');
      } catch (e) {
        logger.error('[AIChatModal] App端录音管理器初始化失败:', e);
        this.recorderManager = null;
      }
      // #endif
      // #ifdef H5
      logger.log('[AIChatModal] H5环境，录音功能不可用');
      this.recorderManager = null;
      // #endif
    },
    handleTouchStart() {
      if (this.isRecording) return;
      if (!this.recorderManager) {
        toast.info('录音功能未初始化');
        return;
      }

      const startRecording = () => {
        try {
          this.recorderManager.start({
            format: 'mp3',
            duration: 60000,
            sampleRate: 16000,
            numberOfChannels: 1
          });
        } catch (e) {
          logger.error('启动录音失败', e);
          this.isRecording = false;
          toast.info('启动录音失败');
        }
      };

      // #ifdef MP-WEIXIN
      uni.authorize({
        scope: 'scope.record',
        success: () => {
          startRecording();
        },
        fail: () => {
          uni.showModal({
            title: '需要麦克风权限',
            content: '请在设置中开启麦克风权限',
            showCancel: false
          });
        }
      });
      // #endif

      // #ifdef APP-PLUS
      // App 端直接启动录音，系统会自动弹出权限请求
      startRecording();
      // #endif
    },
    handleTouchEnd() {
      if (this.recorderManager && this.isRecording) {
        try {
          this.recorderManager.stop();
        } catch (e) {
          logger.error('停止录音失败', e);
          this.isRecording = false;
        }
      }
    },
    async processVoice(filePath) {
      toast.loading('语音识别中...');

      try {
        const backendText = await this.recognizeVoiceByBackend(filePath);
        if (backendText) {
          this.userInput = backendText;
          toast.success('识别成功', 1000);
          this._safeTimeout(() => {
            this.sendToAI();
          }, 300);
          return;
        }

        const pluginText = await this.recognizeVoiceByWechatPlugin(filePath);
        if (pluginText) {
          this.userInput = pluginText;
          toast.success('识别成功', 1000);
          this._safeTimeout(() => {
            this.sendToAI();
          }, 300);
          return;
        }

        toast.info('未识别到语音内容，请重试');
      } catch (err) {
        logger.error('[AIChatModal] 语音识别失败:', err);
        toast.info('语音识别失败，请重试');
      } finally {
        toast.hide();
      }
    },

    async recognizeVoiceByBackend(filePath) {
      try {
        const audioBase64 = await this.readAudioAsBase64(filePath);
        if (!audioBase64) return '';

        const toolsStore = useToolsStore();
        const response = await toolsStore.speechToText(audioBase64, 'mp3', {
          prompt: '考研学习场景语音识别，请保留专业术语'
        });

        if (response.code === 0 && response.data?.text) {
          return String(response.data.text).trim();
        }
      } catch (error) {
        logger.warn('[AIChatModal] 后端语音识别失败:', error);
      }

      return '';
    },

    recognizeVoiceByWechatPlugin(filePath) {
      return new Promise((resolve) => {
        if (!ENABLE_WECHAT_SI_PLUGIN) {
          resolve('');
          return;
        }

        // #ifdef MP-WEIXIN
        try {
          const plugin = requirePlugin('WechatSI');
          if (plugin?.manager?.translateVoice) {
            plugin.manager.translateVoice({
              filePath,
              success: (res) => resolve((res.result || '').trim()),
              fail: () => resolve('')
            });
            return;
          }
        } catch (e) {
          logger.warn('[AIChatModal] WechatSI 插件识别失败:', e);
        }
        // #endif
        resolve('');
      });
    },

    readAudioAsBase64(filePath) {
      return new Promise((resolve, reject) => {
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
    }
  }
};
</script>

<style lang="scss" scoped>
/* 智能对话窗样式 */
.chat-modal {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background-color: var(--overlay-dark);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.chat-panel {
  width: 100%;
  height: 75vh;
  background-color: var(--card-bg, var(--bg-card));
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  /* gap: 12px; -- replaced for Android WebView compat */
  font-weight: 600;
  color: var(--text-primary);
}

.speaking-indicator {
  display: flex;
  align-items: flex-end;
  /* gap: 4px; -- replaced for Android WebView compat */
  height: 24px;
}

.speaking-indicator .bar {
  width: 3px;
  height: 40%;
  background-color: var(--brand-color);
  border-radius: 2px;
  animation: bounce 0.5s infinite alternate;
}

.speaking-indicator .bar.rec {
  background-color: var(--danger-red);
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
  font-size: 28rpx;
  line-height: 1.6;
  word-wrap: break-word;
}

.msg-time {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 6px;
  text-align: right;
}

.msg-bubble.assistant .msg-time {
  text-align: left;
  color: var(--text-tertiary);
}

.msg-bubble.user .msg-time {
  text-align: right;
  color: var(--text-primary-foreground);
  opacity: 0.7;
}

.msg-bubble.assistant {
  background-color: var(--success-light);
  color: var(--text-sub);
  align-self: flex-start;
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

.msg-bubble.user {
  background-color: var(--brand-color);
  color: var(--text-inverse);
  align-self: flex-end;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.voice-play-icon {
  position: absolute;
  bottom: -24px;
  right: 10px;
  font-size: 40rpx;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.voice-play-icon:hover {
  opacity: 1;
  transform: scale(1.1);
}

.chat-input-area {
  display: flex;
  align-items: center;
  /* gap: 16px; -- replaced for Android WebView compat */
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.mode-switch {
  width: 40px;
  height: 40px;
  background-color: var(--success-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mode-switch:hover {
  background-color: var(--success-light);
  opacity: 0.8;
  transform: scale(1.05);
}

.chat-input-area input,
.chat-input-area .chat-input {
  flex: 1;
  background-color: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 12px 20px;
  font-size: 28rpx;
  color: var(--text-primary);
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
  font-size: 40rpx;
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
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  border-radius: 20px;
  font-size: 28rpx;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: var(--cta-primary-shadow);
}

.chat-input-area .send-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.voice-press-btn {
  flex: 1;
  height: 48px;
  background-color: var(--success-light);
  border: 1px solid var(--brand-color);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  color: var(--brand-color);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 28rpx;
}

.voice-press-btn.pressing {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-color: var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  transform: scale(0.98);
}

.chat-input-area button {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  border-radius: 24px;
  padding: 12px 24px;
  font-size: 28rpx;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: var(--cta-primary-shadow);
}

.chat-input-area button:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.close-icon {
  font-size: 48rpx;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 4px;
}

.close-icon:hover {
  color: var(--text-primary);
  transform: scale(1.1);
}

/* 表情选择器样式 */
.emoji-picker {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  padding: 16px;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  border-radius: 16px 16px 0 0;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 8px; -- replaced for Android WebView compat */
}

.emoji-item {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.emoji-item:active {
  background: var(--bg-secondary);
  transform: scale(1.2);
}
</style>
