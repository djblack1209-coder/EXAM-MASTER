<template>
  <view :class="['page-container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="back-icon">
            &#x2190;
          </text>
        </view>
        <text class="nav-title">
          拍照搜题
        </text>
        <view class="nav-action" @tap="selectSubject">
          <text class="nav-action-text">
            {{ selectedSubjectLabel || '学科' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 相机/预览区域 -->
    <view class="camera-area" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- 相机模式 -->
      <camera
        v-if="mode === 'camera'"
        device-position="back"
        flash="auto"
        class="camera-preview"
        @error="onCameraError"
      >
        <view class="viewfinder">
          <view class="corner top-left" />
          <view class="corner top-right" />
          <view class="corner bottom-left" />
          <view class="corner bottom-right" />
        </view>
        <text class="camera-tip">
          将题目放入框内，保持清晰
        </text>
      </camera>

      <!-- 预览模式 -->
      <view v-else-if="mode === 'preview'" class="preview-area">
        <image :src="previewImage" mode="aspectFit" class="preview-image" />
        <view v-if="isRecognizing" class="loading-overlay">
          <view class="loading-spinner" />
          <text class="loading-text">
            {{ loadingText }}
          </text>
          <text class="loading-tips">
            {{ currentTip }}
          </text>
        </view>
      </view>

      <!-- 结果模式 -->
      <view v-else-if="mode === 'result'" class="result-area">
        <scroll-view scroll-y class="result-scroll">
          <!-- 识别文本 -->
          <view class="result-section">
            <view class="rs-header">
              <text class="rs-title">
                识别结果
              </text>
              <view class="confidence-badge">
                <text class="confidence-text">
                  {{ result.confidence ? (result.confidence * 100).toFixed(0) : 0 }}%
                </text>
              </view>
            </view>
            <view class="recognized-text-card">
              <text class="recognized-text">
                {{ result.recognizedText || '未能识别到文字内容，请重新拍照' }}
              </text>
            </view>
          </view>

          <!-- 匹配题目 -->
          <view v-if="result.questions && result.questions.length > 0" class="result-section">
            <view class="rs-header">
              <text class="rs-title">
                题库匹配
              </text>
              <text class="match-count">
                找到 {{ result.questions.length }} 道相似题
              </text>
            </view>
            <view
              v-for="(q, idx) in result.questions"
              :key="idx"
              class="question-card"
              @click="viewQuestion(q)"
            >
              <text class="question-text">
                {{ q.question }}
              </text>
              <view class="question-meta">
                <view class="meta-tag">
                  <text class="meta-tag-text">
                    {{ q.category || '综合' }}
                  </text>
                </view>
                <view class="meta-tag meta-tag-diff">
                  <text class="meta-tag-text">
                    难度 {{ q.difficulty || 3 }}
                  </text>
                </view>
              </view>
            </view>
          </view>

          <!-- AI解析 -->
          <view v-if="result.aiGenerated" class="result-section">
            <view class="rs-header">
              <text class="rs-title">
                AI 智能解析
              </text>
            </view>
            <view class="ai-card">
              <!-- 解题步骤 -->
              <view v-if="result.aiGenerated.analysis && result.aiGenerated.analysis.steps" class="ai-block">
                <text class="ai-block-title">
                  解题步骤
                </text>
                <view v-for="(step, idx) in result.aiGenerated.analysis.steps" :key="idx" class="step-item">
                  <view class="step-num-circle">
                    <text class="step-num-text">
                      {{ idx + 1 }}
                    </text>
                  </view>
                  <text class="step-text">
                    {{ step }}
                  </text>
                </view>
              </view>

              <!-- 参考答案 -->
              <view v-if="result.aiGenerated.answer" class="ai-block">
                <text class="ai-block-title">
                  参考答案
                </text>
                <view class="answer-card">
                  <text class="answer-text">
                    {{ result.aiGenerated.answer }}
                  </text>
                </view>
              </view>

              <!-- 考点 -->
              <view
                v-if="
                  result.aiGenerated.analysis &&
                    result.aiGenerated.analysis.keyPoints &&
                    result.aiGenerated.analysis.keyPoints.length > 0
                "
                class="ai-block"
              >
                <text class="ai-block-title">
                  考查知识点
                </text>
                <view class="tags-row">
                  <view v-for="(point, idx) in result.aiGenerated.analysis.keyPoints" :key="idx" class="kp-tag">
                    <text class="kp-tag-text">
                      {{ point }}
                    </text>
                  </view>
                </view>
              </view>

              <!-- 易错点 -->
              <view
                v-if="result.aiGenerated.commonMistakes && result.aiGenerated.commonMistakes.length > 0"
                class="ai-block"
              >
                <text class="ai-block-title">
                  易错提醒
                </text>
                <view v-for="(mistake, idx) in result.aiGenerated.commonMistakes" :key="idx" class="mistake-item">
                  <view class="warning-dot" />
                  <text class="mistake-text">
                    {{ mistake }}
                  </text>
                </view>
              </view>
            </view>
          </view>

          <view class="bottom-safe" />
        </scroll-view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="action-bar">
      <template v-if="mode === 'camera'">
        <view class="action-btn-side" @click="chooseFromAlbum">
          <text class="action-side-text">
            相册
          </text>
        </view>
        <view class="capture-btn" @click="takePhoto">
          <view class="capture-outer">
            <view class="capture-inner" />
          </view>
        </view>
        <view class="action-btn-side" @click="selectSubject">
          <text class="action-side-text">
            {{ selectedSubjectLabel || '学科' }}
          </text>
        </view>
      </template>

      <template v-else-if="mode === 'preview'">
        <button
          class="bar-btn bar-btn-secondary"
          hover-class="btn-hover"
          :disabled="isRecognizing"
          @click="retake"
        >
          <text>重新拍摄</text>
        </button>
        <button
          class="bar-btn bar-btn-primary"
          hover-class="btn-hover"
          :disabled="isRecognizing"
          @click="startRecognize"
        >
          <text>{{ isRecognizing ? '识别中...' : '开始识别' }}</text>
        </button>
      </template>

      <template v-else-if="mode === 'result'">
        <button class="bar-btn bar-btn-secondary" hover-class="btn-hover" @click="retake">
          <text>重新搜题</text>
        </button>
        <button
          v-if="result.questions && result.questions.length > 0"
          class="bar-btn bar-btn-primary"
          hover-class="btn-hover"
          :disabled="isAddingMistake"
          @click="addToMistake"
        >
          <text>{{ isAddingMistake ? '添加中...' : '加入错题本' }}</text>
        </button>
        <button class="bar-btn bar-btn-ghost" hover-class="btn-hover" @click="searchSimilar">
          <text>找相似题</text>
        </button>
      </template>
    </view>
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import storageService from '@/services/storageService.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import { getStatusBarHeight } from '@/utils/core/system.js';

export default {
  data() {
    return {
      statusBarHeight: 44,
      mode: 'camera', // camera | preview | result
      previewImage: null,
      isRecognizing: false,
      loadingText: 'AI正在识别题目...',
      currentTip: '',
      result: null,
      selectedSubject: '',
      isAddingMistake: false,
      subjects: [
        { label: '全部', value: '' },
        { label: '政治', value: 'politics' },
        { label: '英语', value: 'english' },
        { label: '数学', value: 'math' },
        { label: '专业课', value: 'major' }
      ],
      loadingTips: ['正在识别文字...', '正在分析题目结构...', '正在匹配题库...', '正在生成解析...'],
      isDark: false,
      tipIndex: 0,
      tipTimer: null
    };
  },

  computed: {
    selectedSubjectLabel() {
      const found = this.subjects.find((s) => s.value === this.selectedSubject);
      return found ? found.label : '学科';
    }
  },

  onLoad() {
    this.statusBarHeight = getStatusBarHeight();
    this.isDark = initTheme();
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    onThemeUpdate(this._themeHandler);
    this.checkCameraPermission();
  },

  onUnload() {
    this.clearTipTimer();
    offThemeUpdate(this._themeHandler);
  },

  methods: {
    goBack() {
      uni.navigateBack({ delta: 1 });
    },

    // 检查相机权限
    async checkCameraPermission() {
      // #ifdef MP-WEIXIN
      try {
        const setting = await uni.getSetting();
        if (setting.authSetting && setting.authSetting['scope.camera'] === false) {
          uni.showModal({
            title: '提示',
            content: '需要相机权限才能拍照搜题，是否前往设置？',
            success: (res) => {
              if (res.confirm) {
                uni.openSetting();
              }
            }
          });
        }
      } catch (e) {
        logger.error('检查权限失败:', e);
      }
      // #endif
    },

    // 相机错误处理
    onCameraError(e) {
      logger.error('相机错误:', e);
      uni.showToast({
        title: '相机初始化失败，请检查权限',
        icon: 'none',
        duration: 2000
      });
    },

    // 拍照
    takePhoto() {
      const ctx = uni.createCameraContext();
      ctx.takePhoto({
        quality: 'high',
        success: (res) => {
          this.previewImage = res.tempImagePath;
          this.mode = 'preview';
          // 自动开始识别
          this.startRecognize();
        },
        fail: (err) => {
          logger.error('拍照失败:', err);
          uni.showToast({ title: '拍照失败', icon: 'none' });
        }
      });
    },

    // 从相册选择
    chooseFromAlbum() {
      uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
          this.previewImage = res.tempFilePaths[0];
          this.mode = 'preview';
          // 自动开始识别
          this.startRecognize();
        },
        fail: (err) => {
          if (err.errMsg !== 'chooseImage:fail cancel') {
            logger.error('选择图片失败:', err);
            uni.showToast({ title: '选择图片失败', icon: 'none' });
          }
        }
      });
    },

    // 开始识别
    async startRecognize() {
      if (this.isRecognizing) return;

      this.isRecognizing = true;
      this.currentTip = this.loadingTips[0];
      this.startTipRotation();

      try {
        // 图片转base64
        const base64 = await this.imageToBase64(this.previewImage);

        // 调用云函数
        const response = await lafService.photoSearch(base64, {
          subject: this.selectedSubject
        });

        if (response.code === 0 && response.data) {
          // 数据完整性校验 (CP-20260127-QA: 防止空数据导致白屏)
          const rawData = response.data;
          const recognizedText = rawData.recognizedText || rawData.recognition?.questionText || '';

          if (!recognizedText && (!rawData.matchedQuestions || rawData.matchedQuestions.length === 0)) {
            throw new Error('未能识别到有效内容，请确保图片清晰完整');
          }

          // 标准化数据结构，添加空值防护
          const aiSolution = rawData.aiSolution || rawData.aiGenerated || null;
          // 兼容后端返回中文字段名（步骤→steps）
          if (aiSolution && aiSolution.analysis) {
            if (!aiSolution.analysis.steps && aiSolution.analysis['步骤']) {
              aiSolution.analysis.steps = aiSolution.analysis['步骤'];
            }
            if (!aiSolution.answer && aiSolution['答案']) {
              aiSolution.answer = aiSolution['答案'];
            }
            if (!aiSolution.analysis.keyPoints && aiSolution.analysis['考点']) {
              aiSolution.analysis.keyPoints = aiSolution.analysis['考点'];
            }
          }
          this.result = {
            confidence: rawData.confidence ?? rawData.recognition?.confidence ?? 0,
            recognizedText: recognizedText,
            questions: rawData.matchedQuestions || rawData.questions || [],
            aiGenerated: aiSolution,
            recognitionSources: rawData.recognitionSources || null
          };
          this.mode = 'result';

          // 显示识别来源
          const sources = this.result.recognitionSources;
          if (sources) {
            logger.log('识别来源 - 视觉AI:', sources.vision, ', OCR:', sources.ocr);
          }
        } else {
          throw new Error(response.message || '识别失败');
        }
      } catch (error) {
        logger.error('识别失败:', error);
        uni.showModal({
          title: '识别失败',
          content: error.message || '请确保题目清晰、光线充足',
          showCancel: false
        });
        // 识别失败回到预览模式，允许重试
        this.mode = 'preview';
      } finally {
        this.isRecognizing = false;
        this.clearTipTimer();
      }
    },

    // 图片转Base64
    imageToBase64(path) {
      return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        uni.getFileSystemManager().readFile({
          filePath: path,
          encoding: 'base64',
          success: (res) => resolve(res.data),
          fail: (err) => {
            logger.error('读取文件失败:', err);
            reject(new Error('读取图片失败'));
          }
        });
        // #endif

        // #ifdef H5
        // H5环境使用canvas转换
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataURL.split(',')[1]);
        };
        img.onerror = () => reject(new Error('加载图片失败'));
        img.src = path;
        // #endif

        // #ifdef APP-PLUS
        plus.io.resolveLocalFileSystemURL(
          path,
          (entry) => {
            entry.file((file) => {
              const reader = new plus.io.FileReader();
              reader.onloadend = (e) => {
                const base64 = e.target.result.split(',')[1];
                resolve(base64);
              };
              reader.onerror = () => reject(new Error('读取图片失败'));
              reader.readAsDataURL(file);
            });
          },
          () => reject(new Error('解析路径失败'))
        );
        // #endif
      });
    },

    // 开始提示轮换
    startTipRotation() {
      this.tipIndex = 0;
      this.currentTip = this.loadingTips[0];

      this.tipTimer = setInterval(() => {
        this.tipIndex = (this.tipIndex + 1) % this.loadingTips.length;
        this.currentTip = this.loadingTips[this.tipIndex];
      }, 2000);
    },

    // 清除提示定时器
    clearTipTimer() {
      if (this.tipTimer) {
        clearInterval(this.tipTimer);
        this.tipTimer = null;
      }
    },

    // 重新拍摄
    retake() {
      this.previewImage = null;
      this.result = null;
      this.mode = 'camera';
    },

    // 选择学科 - 使用原生 ActionSheet
    selectSubject() {
      const itemList = this.subjects.map((s) => s.label);

      uni.showActionSheet({
        itemList,
        success: (res) => {
          this.selectedSubject = this.subjects[res.tapIndex].value;
        },
        fail: (err) => {
          if (err.errMsg !== 'showActionSheet:fail cancel') {
            logger.error('选择学科失败:', err);
          }
        }
      });
    },

    // 查看题目详情（跳转到刷题页单题模式）
    viewQuestion(question) {
      const id = question._id || question.id;
      if (id) {
        safeNavigateTo(`/pages/practice-sub/do-quiz?mode=single&questionId=${id}`);
      }
    },

    // 加入错题本
    async addToMistake() {
      if (this.isAddingMistake) return;
      if (this.result && this.result.questions && this.result.questions.length > 0) {
        this.isAddingMistake = true;
        const question = this.result.questions[0];
        uni.showLoading({ title: '添加中...', mask: false });
        try {
          // 使用 storageService.addMistake（支持云端同步+本地降级）
          await storageService.addMistake({
            questionId: question._id || question.id,
            question: question.question,
            options: question.options || [],
            correctAnswer: question.answer || question.correctAnswer || '',
            userAnswer: '',
            source: 'photo_search',
            category: question.category || this.selectedSubject || '未分类'
          });
          uni.hideLoading();
          uni.showToast({ title: '已加入错题本', icon: 'success' });
        } catch (e) {
          uni.hideLoading();
          logger.error('加入错题本失败:', e);
          uni.showToast({ title: '加入失败', icon: 'none' });
        } finally {
          this.isAddingMistake = false;
        }
      }
    },

    // 搜索相似题
    searchSimilar() {
      if (this.result && this.result.recognizedText) {
        // 取前50个字符作为搜索关键词
        const keyword = this.result.recognizedText.substring(0, 50);
        // practice/index 是 tabBar 页面，switchTab 不支持 query 参数
        // 通过临时存储传递搜索关键词，供刷题中心后续读取
        try {
          uni.setStorageSync('_pendingSearch', { keyword, timestamp: Date.now() });
        } catch (_e) {
          /* ignore */
        }
        uni.showToast({ title: '已跳转到刷题中心', icon: 'none' });
        safeNavigateTo('/pages/practice/index');
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
}

// 导航栏
.nav-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  .nav-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24rpx;
    height: 88rpx;
  }

  .nav-back {
    width: 72rpx;
    height: 72rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);

    .back-icon {
      font-size: 36rpx;
      color: #fff;
    }
  }

  .nav-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #fff;
  }

  .nav-action {
    padding: 10rpx 24rpx;
    border-radius: 32rpx;
    background: rgba(255, 255, 255, 0.12);

    .nav-action-text {
      font-size: 24rpx;
      color: #fff;
      font-weight: 500;
    }
  }
}

// 相机区域
.camera-area {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

.camera-preview {
  width: 100%;
  flex: 1;
  min-height: 600rpx;
}

.viewfinder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  height: 300rpx;
  border: 2rpx dashed rgba(255, 255, 255, 0.4);
  border-radius: 16rpx;

  .corner {
    position: absolute;
    width: 40rpx;
    height: 40rpx;
    border-color: #fff;
    border-style: solid;

    &.top-left {
      top: -2rpx;
      left: -2rpx;
      border-width: 4rpx 0 0 4rpx;
      border-radius: 8rpx 0 0 0;
    }

    &.top-right {
      top: -2rpx;
      right: -2rpx;
      border-width: 4rpx 4rpx 0 0;
      border-radius: 0 8rpx 0 0;
    }

    &.bottom-left {
      bottom: -2rpx;
      left: -2rpx;
      border-width: 0 0 4rpx 4rpx;
      border-radius: 0 0 0 8rpx;
    }

    &.bottom-right {
      bottom: -2rpx;
      right: -2rpx;
      border-width: 0 4rpx 4rpx 0;
      border-radius: 0 0 8rpx 0;
    }
  }
}

.camera-tip {
  position: absolute;
  bottom: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 24rpx;
  background: rgba(0, 0, 0, 0.5);
  padding: 12rpx 32rpx;
  border-radius: 32rpx;
  white-space: nowrap;
}

.preview-area {
  width: 100%;
  flex: 1;
  min-height: 600rpx;
  position: relative;

  .preview-image {
    width: 100%;
    height: 100%;
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .loading-spinner {
    width: 64rpx;
    height: 64rpx;
    border: 4rpx solid rgba(102, 126, 234, 0.25);
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    color: #fff;
    font-size: 28rpx;
    font-weight: 500;
    margin-top: 24rpx;
  }

  .loading-tips {
    color: rgba(255, 255, 255, 0.6);
    font-size: 24rpx;
    margin-top: 10rpx;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 结果区域
.result-area {
  width: 100%;
  flex: 1;
  background: var(--bg-secondary, #f5f5f7);
  border-radius: 32rpx 32rpx 0 0;
}

.result-scroll {
  height: 100%;
  padding: 28rpx 32rpx;
}

.result-section {
  margin-bottom: 28rpx;
}

.rs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;

  .rs-title {
    font-size: 30rpx;
    font-weight: 700;
    color: var(--text-primary, #111);
  }

  .match-count {
    font-size: 22rpx;
    color: var(--text-secondary, #666);
  }
}

.confidence-badge {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));

  .confidence-text {
    font-size: 22rpx;
    font-weight: 600;
    color: #667eea;
  }
}

.recognized-text-card {
  background: var(--bg-card, #fff);
  padding: 24rpx;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);

  .recognized-text {
    font-size: 28rpx;
    line-height: 1.7;
    color: var(--text-primary, #111);
  }
}

.question-card {
  background: var(--bg-card, #fff);
  padding: 24rpx;
  border-radius: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  border-left: 6rpx solid #667eea;

  .question-text {
    font-size: 28rpx;
    color: var(--text-primary, #111);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.6;
  }

  .question-meta {
    display: flex;
    gap: 12rpx;
    margin-top: 16rpx;
  }
}

.meta-tag {
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
  background: rgba(102, 126, 234, 0.08);

  &.meta-tag-diff {
    background: rgba(255, 149, 0, 0.08);

    .meta-tag-text {
      color: #ff9500;
    }
  }

  .meta-tag-text {
    font-size: 20rpx;
    color: #667eea;
    font-weight: 500;
  }
}

// AI 解析卡片
.ai-card {
  background: var(--bg-card, #fff);
  padding: 24rpx;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.ai-block {
  margin-bottom: 28rpx;

  &:last-child {
    margin-bottom: 0;
  }

  .ai-block-title {
    font-size: 26rpx;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 12rpx;
    display: block;
  }
}

.step-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;

  .step-num-circle {
    width: 40rpx;
    height: 40rpx;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 16rpx;
    margin-top: 4rpx;
  }

  .step-num-text {
    font-size: 20rpx;
    color: #fff;
    font-weight: 700;
  }

  .step-text {
    font-size: 26rpx;
    color: var(--text-primary, #111);
    line-height: 1.6;
    flex: 1;
  }
}

.answer-card {
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.06), rgba(48, 209, 88, 0.06));
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(52, 199, 89, 0.15);

  .answer-text {
    font-size: 28rpx;
    color: #34c759;
    font-weight: 600;
    line-height: 1.6;
  }
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.kp-tag {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));

  .kp-tag-text {
    font-size: 22rpx;
    color: #667eea;
    font-weight: 500;
  }
}

.mistake-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;

  .warning-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    background: #ff9500;
    flex-shrink: 0;
    margin-right: 14rpx;
    margin-top: 14rpx;
  }

  .mistake-text {
    font-size: 26rpx;
    color: var(--text-secondary, #666);
    line-height: 1.6;
    flex: 1;
  }
}

.bottom-safe {
  height: 200rpx;
}

// 底部操作栏
.action-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  button {
    border: none;
    font-size: 28rpx;

    &::after {
      border: none;
    }
  }
}

// 拍照按钮
.capture-btn {
  width: 120rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.capture-outer {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(102, 126, 234, 0.4);
}

.capture-inner {
  width: 80rpx;
  height: 80rpx;
  border: 6rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
}

.action-btn-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;

  .action-side-text {
    font-size: 26rpx;
    color: #fff;
    font-weight: 500;
  }
}

// 操作栏按钮
.bar-btn {
  flex: 1;
  padding: 22rpx 0;
  border-radius: 50rpx;
  text-align: center;
  font-weight: 600;

  &.bar-btn-primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.3);

    &:disabled {
      opacity: 0.5;
      box-shadow: none;
    }
  }

  &.bar-btn-secondary {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;

    &:disabled {
      opacity: 0.5;
    }
  }

  &.bar-btn-ghost {
    background: transparent;
    color: #667eea;
  }
}

.btn-hover {
  opacity: 0.8;
  transform: scale(0.97);
}

// Dark mode overrides
.dark-mode {
  .result-area {
    background: var(--bg-secondary, #1c1c1e);
  }

  .recognized-text-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .question-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .ai-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .confidence-badge {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
  }

  .meta-tag {
    background: rgba(102, 126, 234, 0.15);

    &.meta-tag-diff {
      background: rgba(255, 149, 0, 0.15);
    }
  }

  .answer-card {
    background: linear-gradient(135deg, rgba(52, 199, 89, 0.12), rgba(48, 209, 88, 0.12));
    border-color: rgba(52, 199, 89, 0.25);
  }

  .kp-tag {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15));
  }

  .action-bar {
    background: rgba(0, 0, 0, 0.9);
  }

  .bar-btn.bar-btn-ghost {
    color: #a0b0ff;
  }
}
</style>
