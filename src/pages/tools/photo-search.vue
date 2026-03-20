<template>
  <view :class="['page-container', { 'dark-mode': isDark }]">
    <PrivacyPopup />
    <!-- 自定义导航栏 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="back-icon"> &#x2190; </text>
        </view>
        <text class="nav-title"> 拍照搜题 </text>
        <view class="nav-action" @tap="selectSubject">
          <text class="nav-action-text">
            {{ selectedSubjectLabel || '学科' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 相机/预览区域 -->
    <view class="camera-area" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <view v-if="mode === 'camera'" class="camera-hero">
        <text class="camera-eyebrow"> Photo Search </text>
        <text class="camera-hero-title"> 对准题目，一次拍清 </text>
        <text class="camera-hero-subtitle"> 自动识别题干、匹配题库并生成解析 </text>
      </view>

      <!-- 相机模式 -->
      <!-- #ifdef MP-WEIXIN -->
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
        <text class="camera-tip"> 将题目放入框内，保持清晰 </text>
      </camera>
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <!-- ✅ P0-FIX: App端无camera组件，显示占位提示 -->
      <view v-if="mode === 'camera'" class="camera-placeholder">
        <view class="placeholder-icon">📷</view>
        <text class="placeholder-title">拍照搜题</text>
        <text class="placeholder-hint">点击下方拍照按钮开始</text>
      </view>
      <!-- #endif -->

      <!-- 预览模式 -->
      <view v-else-if="mode === 'preview'" class="preview-area">
        <image :src="previewImage" mode="aspectFit" class="preview-image" />
        <view v-if="isRecognizing" class="scanner-overlay">
          <view class="scan-line" />
          <view class="scan-info">
            <text class="scan-badge">[GLM-OCR V1.5]</text>
            <text class="scan-text">正在深度提取跨模态数学公式...</text>
          </view>
        </view>
      </view>

      <!-- 结果模式 -->
      <view v-else-if="mode === 'result'" class="result-area">
        <scroll-view scroll-y class="result-scroll">
          <!-- 识别文本 -->
          <view class="result-section">
            <view class="rs-header">
              <text class="rs-title"> 识别结果 </text>
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
              <text class="rs-title"> 题库匹配 </text>
              <text class="match-count"> 找到 {{ result.questions.length }} 道相似题 </text>
            </view>
            <view v-for="(q, idx) in result.questions" :key="idx" class="question-card" @tap="viewQuestion(q)">
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
                  <text class="meta-tag-text"> 难度 {{ q.difficulty || 3 }} </text>
                </view>
              </view>
            </view>
          </view>

          <!-- 智能解析 -->
          <view v-if="result.aiGenerated" class="result-section">
            <view class="rs-header">
              <text class="rs-title"> 智能解析 </text>
            </view>
            <view class="ai-card">
              <!-- 解题步骤 -->
              <view v-if="result.aiGenerated.analysis && result.aiGenerated.analysis.steps" class="ai-block">
                <text class="ai-block-title"> 解题步骤 </text>
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
                <text class="ai-block-title"> 参考答案 </text>
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
                <text class="ai-block-title"> 考查知识点 </text>
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
                <text class="ai-block-title"> 易错提醒 </text>
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
        <view id="e2e-photo-search-album" class="action-btn-side" @tap="chooseFromAlbum">
          <text class="action-side-text"> 相册 </text>
        </view>
        <view id="e2e-photo-search-capture" class="capture-btn" @tap="takePhoto">
          <view class="capture-outer">
            <view class="capture-inner" />
          </view>
        </view>
        <view id="e2e-photo-search-subject" class="action-btn-side" @tap="selectSubject">
          <text class="action-side-text">
            {{ selectedSubjectLabel || '学科' }}
          </text>
        </view>
      </template>

      <template v-else-if="mode === 'preview'">
        <button class="bar-btn bar-btn-secondary" hover-class="btn-hover" :disabled="isRecognizing" @tap="retake">
          <text>重新拍摄</text>
        </button>
        <button
          id="e2e-photo-search-start"
          class="bar-btn bar-btn-primary"
          hover-class="btn-hover"
          :disabled="isRecognizing"
          @tap="startRecognize"
        >
          <text>{{ isRecognizing ? '识别中...' : '开始识别' }}</text>
        </button>
      </template>

      <template v-else-if="mode === 'result'">
        <!-- ✅ [零摩擦] 最醒目的CTA：直接开始练习 -->
        <button class="bar-btn bar-btn-primary" hover-class="btn-hover" @tap="startPracticeFromOCR">
          <text>立即练习</text>
        </button>
        <button class="bar-btn bar-btn-secondary" hover-class="btn-hover" @tap="retake">
          <text>重新搜题</text>
        </button>
        <button
          v-if="result.questions && result.questions.length > 0"
          id="e2e-photo-search-add-mistake"
          class="bar-btn bar-btn-ghost"
          hover-class="btn-hover"
          :disabled="isAddingMistake"
          @tap="addToMistake"
        >
          <text>{{ isAddingMistake ? '添加中...' : '加入错题本' }}</text>
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
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { ensureMiniProgramScope, ensurePrivacyAuthorization } from './privacy-authorization.js';

export default {
  components: { PrivacyPopup },
  data() {
    return {
      statusBarHeight: 44,
      mode: 'camera', // camera | preview | result
      previewImage: null,
      isRecognizing: false,
      loadingText: '智能正在识别题目...',
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

  // ✅ P0-FIX: 页面隐藏时清理Tip定时器，防止后台持续运行
  onHide() {
    this.clearTipTimer();
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
    async takePhoto() {
      const privacyOk = await ensurePrivacyAuthorization();
      if (!privacyOk) {
        uni.showToast({ title: '需要先同意隐私授权', icon: 'none' });
        return;
      }

      // #ifdef MP-WEIXIN
      const cameraGranted = await ensureMiniProgramScope('scope.camera', {
        title: '相机权限提示',
        content: '需要相机权限才能拍照搜题，是否前往设置开启？'
      });
      if (!cameraGranted) {
        uni.showToast({ title: '未开启相机权限', icon: 'none' });
        return;
      }

      if (typeof uni.createCameraContext === 'function') {
        const ctx = uni.createCameraContext();
        ctx.takePhoto({
          quality: 'high',
          success: (res) => {
            this.previewImage = res.tempImagePath;
            this.mode = 'preview';
            this.startRecognize();
          },
          fail: () => {
            uni.chooseImage({
              count: 1,
              sourceType: ['camera'],
              success: (res) => {
                this.previewImage = res.tempFilePaths[0];
                this.mode = 'preview';
                this.startRecognize();
              },
              fail: (err) => {
                logger.error('拍照失败:', err);
                if (err?.errMsg && /deny|auth/i.test(err.errMsg)) {
                  uni.showModal({
                    title: '相机权限提示',
                    content: '需要相机权限才能拍照搜题，是否前往设置开启？',
                    success: (res) => {
                      if (res.confirm && typeof uni.openSetting === 'function') {
                        uni.openSetting();
                      }
                    }
                  });
                } else {
                  uni.showToast({ title: '拍照失败，请检查权限', icon: 'none' });
                }
              }
            });
          }
        });
        return;
      }
      // #endif

      uni.chooseImage({
        count: 1,
        sourceType: ['camera'],
        success: (res) => {
          this.previewImage = res.tempFilePaths[0];
          this.mode = 'preview';
          this.startRecognize();
        },
        fail: (err) => {
          logger.error('拍照失败:', err);
          if (err?.errMsg && /deny|auth/i.test(err.errMsg)) {
            uni.showModal({
              title: '相机权限提示',
              content: '需要相机权限才能拍照搜题，是否前往设置开启？',
              success: (res) => {
                if (res.confirm && typeof uni.openSetting === 'function') {
                  uni.openSetting();
                }
              }
            });
          } else {
            uni.showToast({ title: '拍照失败', icon: 'none' });
          }
        }
      });
    },

    // 从相册选择
    async chooseFromAlbum() {
      const privacyOk = await ensurePrivacyAuthorization();
      if (!privacyOk) {
        uni.showToast({ title: '需要先同意隐私授权', icon: 'none' });
        return;
      }

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
            if (err?.errMsg && /deny|auth/i.test(err.errMsg)) {
              uni.showModal({
                title: '相册权限提示',
                content: '需要相册权限才能选择图片，是否前往设置开启？',
                success: (res) => {
                  if (res.confirm && typeof uni.openSetting === 'function') {
                    uni.openSetting();
                  }
                }
              });
            } else {
              uni.showToast({ title: '选择图片失败', icon: 'none' });
            }
          }
        }
      });
    },

    // 开始识别
    async startRecognize() {
      if (this.isRecognizing) return;

      if (!isUserLoggedIn()) {
        uni.showModal({
          title: '请先登录',
          content: '登录后可使用拍照搜题功能',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              safeNavigateTo('/pages/login/index');
            }
          }
        });
        return;
      }

      this.isRecognizing = true;
      this.currentTip = this.loadingTips[0];
      this.startTipRotation();

      try {
        // ✅ P0-FIX: 图片转base64可能失败，需要捕获异常
        let base64;
        try {
          base64 = await this.imageToBase64(this.previewImage);
        } catch (convertErr) {
          logger.error('图片转换失败:', convertErr);
          throw new Error('图片格式转换失败，请重新拍照');
        }

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
            logger.log('识别来源 - 视觉智能:', sources.vision, ', OCR:', sources.ocr);
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

    // ✅ [零摩擦] 查看题目详情 — 修复：写入temp存储后跳转
    viewQuestion(question) {
      const q = {
        id: question._id || question.id || `ocr_${Date.now()}`,
        question: question.question || question.title || '',
        options: question.options || [],
        answer: question.answer || question.correctAnswer || '',
        desc: question.desc || question.analysis || '',
        difficulty: question.difficulty || 2,
        tags: question.tags || [],
        source: 'photo_search'
      };
      storageService.save('temp_practice_question', q);
      safeNavigateTo('/pages/practice-sub/do-quiz?mode=single');
    },

    // ✅ [零摩擦] 从OCR结果直接开始练习（匹配题+AI生成题一起刷）
    startPracticeFromOCR() {
      const questions = [];

      // 收集匹配到的题库题目
      if (this.result?.questions?.length > 0) {
        this.result.questions.forEach((q) => {
          questions.push({
            id: q._id || q.id || `ocr_match_${Date.now()}_${Math.random()}`,
            question: q.question || q.title || '',
            options: q.options || [],
            answer: q.answer || q.correctAnswer || '',
            desc: q.desc || q.analysis || '',
            difficulty: q.difficulty || 2,
            source: 'photo_search_match'
          });
        });
      }

      // 如果有AI生成的解答，也构造为可练习的题目
      if (this.result?.aiGenerated && this.result.recognizedText) {
        const ai = this.result.aiGenerated;
        questions.push({
          id: `ocr_ai_${Date.now()}`,
          question: this.result.recognizedText,
          options: ai.options || [],
          answer: ai.answer || '',
          desc: [ai.steps, ai.keyPoints, ai.commonMistakes].filter(Boolean).join('\n\n'),
          difficulty: 3,
          source: 'photo_search_ai'
        });
      }

      if (questions.length === 0) {
        uni.showToast({ title: '没有可练习的题目', icon: 'none' });
        return;
      }

      // 写入临时题库，跳转刷题
      storageService.save('temp_practice_questions', questions);
      safeNavigateTo('/pages/practice-sub/do-quiz?mode=temp_bank');
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
        storageService.save('_pendingSearch', { keyword, timestamp: Date.now() });
        uni.showToast({ title: '已跳转到刷题中心', icon: 'none' });
        // practice/index 是 tabBar 页面，必须用 switchTab
        uni.switchTab({ url: '/pages/practice/index' });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.page-container {
  height: 100%;
  height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  padding-bottom: calc(176rpx + env(safe-area-inset-bottom, 0px));
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
  bottom: calc(220rpx + env(safe-area-inset-bottom, 0px));
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

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 200rpx;
  background: linear-gradient(
    to bottom,
    rgba(52, 199, 89, 0) 0%,
    rgba(52, 199, 89, 0.2) 50%,
    rgba(52, 199, 89, 0.8) 100%
  );
  border-bottom: 4rpx solid rgba(52, 199, 89, 1);
  animation: scan 2s linear infinite;
  z-index: 2;
}

.scan-info {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 100rpx;
}

.scan-badge {
  background: rgba(52, 199, 89, 0.15);
  border: 1rpx solid rgba(52, 199, 89, 0.4);
  color: #34c759;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  margin-bottom: 16rpx;
  backdrop-filter: blur(8px);
}

.scan-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  text-shadow: 0 2rpx 8rpx rgba(0,0,0,0.5);
}

@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(600rpx); }
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
  box-sizing: border-box;
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom, 0px));
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
  background: linear-gradient(135deg, var(--brand-tint-subtle), var(--brand-tint));

  .confidence-text {
    font-size: 22rpx;
    font-weight: 600;
    color: var(--primary);
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
  border-left: 6rpx solid var(--primary);

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
    /* gap: 12rpx; -- replaced for Android WebView compat */
    & > view + view,
    & > text + text,
    & > view + text,
    & > text + view {
      margin-left: 12rpx;
    }
    margin-top: 16rpx;
  }
}

.meta-tag {
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
  background: var(--brand-tint-subtle);

  &.meta-tag-diff {
    background: var(--warning-light);

    .meta-tag-text {
      color: var(--warning);
    }
  }

  .meta-tag-text {
    font-size: 20rpx;
    color: var(--primary);
    font-weight: 500;
  }
}

// 智能解析卡片
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
    color: var(--primary);
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
    background: var(--gradient-primary);
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
  /* gap: 10rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 10rpx;
  }
}

.kp-tag {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, var(--brand-tint-subtle), var(--brand-tint));

  .kp-tag-text {
    font-size: 22rpx;
    color: var(--primary);
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
  height: 24rpx;
}

// 底部操作栏
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 120;
  display: flex;
  justify-content: center;
  align-items: center;
  /* gap: 24rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 24rpx;
  }
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
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
  background: var(--cta-primary-bg);
  border: 1rpx solid var(--cta-primary-border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--cta-primary-shadow);
}

.capture-inner {
  width: 80rpx;
  height: 80rpx;
  border: 6rpx solid rgba(16, 40, 26, 0.18);
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
    background: var(--cta-primary-bg);
    color: var(--cta-primary-text);
    border: 1rpx solid var(--cta-primary-border);
    box-shadow: var(--cta-primary-shadow);

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
    color: var(--primary);
  }
}

.btn-hover {
  opacity: 0.8;
  transform: scale(0.97);
}

// Dark mode overrides
.dark-mode {
  .capture-inner {
    border-color: rgba(255, 255, 255, 0.9);
  }

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
    background: linear-gradient(135deg, var(--brand-tint), var(--brand-tint-strong));
  }

  .meta-tag {
    background: var(--brand-tint);

    &.meta-tag-diff {
      background: var(--warning-light);
    }
  }

  .answer-card {
    background: linear-gradient(135deg, rgba(52, 199, 89, 0.12), rgba(48, 209, 88, 0.12));
    border-color: rgba(52, 199, 89, 0.25);
  }

  .kp-tag {
    background: linear-gradient(135deg, var(--brand-tint), var(--brand-tint-strong));
  }

  .action-bar {
    background: rgba(0, 0, 0, 0.9);
  }

  .bar-btn.bar-btn-ghost {
    color: var(--primary);
  }
}

/* Apple / Liquid Glass overrides */
.page-container {
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 52%,
    var(--page-gradient-bottom) 100%
  );
}

.dark-mode.page-container {
  background: linear-gradient(180deg, #04070d 0%, #0a1018 48%, #04070d 100%);
}

.nav-header {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  border-bottom: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.nav-header .nav-back,
.nav-header .nav-action {
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.nav-header .back-icon,
.nav-header .nav-title,
.nav-header .nav-action-text {
  color: var(--text-main);
}

.dark-mode .nav-header .nav-back,
.dark-mode .nav-header .nav-action {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.92) 0%, rgba(10, 12, 18, 0.88) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .nav-header .back-icon,
.dark-mode .nav-header .nav-title,
.dark-mode .nav-header .nav-action-text {
  color: #ffffff;
}

.camera-area {
  padding-left: 20rpx;
  padding-right: 20rpx;
}

.camera-preview,
.preview-area,
.result-area {
  border-radius: 34rpx 34rpx 0 0;
  overflow: hidden;
}

.camera-preview,
.preview-area {
  margin-top: 12rpx;
  box-shadow: var(--apple-shadow-card);
}

.viewfinder {
  border: 2rpx dashed rgba(255, 255, 255, 0.54);
  background: rgba(255, 255, 255, 0.06);
}

.viewfinder .corner {
  border-color: rgba(255, 255, 255, 0.9);
}

.camera-tip {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
  color: var(--text-main);
}

.dark-mode .camera-tip,
.dark-mode .scanner-overlay {
  color: #ffffff;
}

.scanner-overlay {
  background: rgba(9, 18, 12, 0.28);
}

.result-area {
  margin-top: 12rpx;
  background: transparent;
}

.result-scroll {
  padding: 24rpx;
}

.result-section {
  margin-bottom: 22rpx;
}

.rs-header .rs-title {
  font-size: 24rpx;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  color: var(--text-secondary, var(--text-sub));
}

.rs-header .match-count {
  color: var(--text-sub);
}

.confidence-badge,
.recognized-text-card,
.question-card,
.ai-card,
.action-btn-side,
.bar-btn.bar-btn-secondary,
.bar-btn.bar-btn-ghost {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.76) 0%, rgba(241, 248, 243, 0.5) 100%);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .confidence-badge,
.dark-mode .recognized-text-card,
.dark-mode .question-card,
.dark-mode .ai-card,
.dark-mode .action-btn-side,
.dark-mode .bar-btn.bar-btn-secondary,
.dark-mode .bar-btn.bar-btn-ghost,
.dark-mode .action-bar {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.confidence-badge .confidence-text,
.recognized-text-card .recognized-text,
.question-card .question-text,
.ai-block .ai-block-title,
.step-item .step-text,
.mistake-item .mistake-text,
.action-btn-side .action-side-text,
.bar-btn.bar-btn-secondary,
.bar-btn.bar-btn-ghost {
  color: var(--text-main);
}

.question-card {
  border-left: none;
}

.meta-tag {
  background: rgba(52, 199, 89, 0.12);
  border: 1px solid rgba(52, 199, 89, 0.18);
}

.meta-tag.meta-tag-diff {
  background: rgba(255, 159, 10, 0.12);
  border-color: rgba(255, 159, 10, 0.18);
}

.meta-tag .meta-tag-text {
  color: var(--text-main);
}

.step-item .step-num-circle {
  background: var(--cta-primary-bg);
}

.step-item .step-num-text {
  color: var(--cta-primary-text);
}

.answer-card {
  background: rgba(52, 199, 89, 0.1);
  border: 1px solid rgba(52, 199, 89, 0.18);
}

.answer-card .answer-text {
  color: var(--text-main);
}

.kp-tag {
  background: rgba(52, 199, 89, 0.12);
  border: 1px solid rgba(52, 199, 89, 0.18);
}

.kp-tag .kp-tag-text {
  color: var(--text-main);
}

.action-bar {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  border-top: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.action-btn-side {
  border-radius: 999rpx;
}

.capture-outer {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

.capture-inner {
  border-color: rgba(19, 48, 28, 0.22);
}

.bar-btn {
  border-radius: 999rpx;
}

.bar-btn.bar-btn-primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
}

.dark-mode .bar-btn.bar-btn-primary {
  background: var(--cta-primary-bg);
}

.dark-mode .confidence-badge .confidence-text,
.dark-mode .recognized-text-card .recognized-text,
.dark-mode .question-card .question-text,
.dark-mode .ai-block .ai-block-title,
.dark-mode .step-item .step-text,
.dark-mode .mistake-item .mistake-text,
.dark-mode .action-btn-side .action-side-text,
.dark-mode .bar-btn.bar-btn-secondary,
.dark-mode .bar-btn.bar-btn-ghost,
.dark-mode .meta-tag .meta-tag-text,
.dark-mode .answer-card .answer-text,
.dark-mode .kp-tag .kp-tag-text {
  color: #ffffff;
}

/* Final polish: camera mode and result grouping */
.camera-area {
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
  padding-left: 24rpx;
  padding-right: 24rpx;
}

.camera-hero {
  margin-top: 8rpx;
  padding: 22rpx 24rpx;
  border-radius: 28rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .camera-hero {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.camera-eyebrow,
.camera-hero-title,
.camera-hero-subtitle {
  display: block;
}

.camera-eyebrow {
  margin-bottom: 8rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-sub);
}

.camera-hero-title {
  font-size: 38rpx;
  font-weight: 700;
  color: var(--text-main);
}

.camera-hero-subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--text-sub);
}

.dark-mode .camera-eyebrow,
.dark-mode .camera-hero-subtitle {
  color: rgba(255, 255, 255, 0.68);
}

.dark-mode .camera-hero-title {
  color: #ffffff;
}

.camera-preview,
.preview-area,
.result-area {
  flex: 1;
  min-height: 0;
}

.camera-preview,
.preview-area {
  border-radius: 36rpx;
}

.viewfinder {
  top: 48%;
  width: calc(100% - 72rpx);
  height: 340rpx;
  border-radius: 30rpx;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.camera-tip {
  bottom: calc(242rpx + env(safe-area-inset-bottom, 0px));
  padding: 14rpx 28rpx;
}

.result-scroll {
  padding: 28rpx 24rpx;
}

.result-section {
  padding: 20rpx;
  border-radius: 28rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .result-section {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.result-section .rs-header {
  margin-bottom: 18rpx;
}

.recognized-text-card,
.question-card,
.ai-card {
  border-radius: 24rpx;
}

.question-card {
  margin-bottom: 14rpx;
}

.question-meta,
.tags-row {
  /* gap: 12rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 12rpx;
  }
}

.action-bar {
  left: 24rpx;
  right: 24rpx;
  bottom: 20rpx;
  border-radius: 34rpx;
  padding-left: 24rpx;
  padding-right: 24rpx;
}

.dark-mode .action-bar {
  box-shadow: var(--apple-shadow-card);
}

.action-btn-side,
.bar-btn {
  min-height: 92rpx;
}

.action-btn-side {
  flex: 0 0 168rpx;
}

.capture-btn {
  flex: 1;
}

.capture-outer {
  width: 116rpx;
  height: 116rpx;
}

/* ✅ P0-FIX: App端相机占位样式 */
.camera-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
}

.placeholder-icon {
  font-size: 120rpx;
  margin-bottom: 32rpx;
}

.placeholder-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.placeholder-hint {
  font-size: 28rpx;
  color: #888;
}

.dark-mode .placeholder-title {
  color: #fff;
}

.dark-mode .placeholder-hint {
  color: #aaa;
}
</style>
