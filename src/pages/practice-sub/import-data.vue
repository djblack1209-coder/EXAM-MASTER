<template>
  <view class="apple-container" :class="{ 'dark-mode': isDark, 'wot-theme-dark': isDark }">
    <!-- 苹果质感自定义导航栏 -->
    <view class="custom-navbar" :style="{ height: navBarHeight + 'px' }">
      <view class="navbar-status-bar" :style="{ height: statusBarHeight + 'px' }" />
      <view class="navbar-content" style="height: 44px">
        <view id="e2e-import-back-btn" class="navbar-back-btn" @tap="handleBack">
          <BaseIcon name="arrow-left" :size="32" class="back-icon" />
        </view>
        <view class="navbar-title-wrapper">
          <text class="navbar-title"> 资料导入 </text>
        </view>
        <view class="navbar-placeholder" />
      </view>
    </view>

    <view class="page-header">
      <text class="header-title"> 资料导入 </text>
      <text class="header-subtitle"> 智能分析 · 即刻出题 </text>
      <text class="header-note"> 仅对您主动上传的资料进行学习辅助整理，结果仅供备考参考。 </text>
    </view>

    <view class="main-glass-card bounce-in-up">
      <view class="status-bar">
        <view style="display: flex; align-items: center">
          <text class="status-dot" :class="{ active: fileName }" />
          <text class="status-text">
            {{ fileName ? '已加载文件，准备就绪' : '支持 PDF / Word / TXT / MD / Anki' }}
          </text>
        </view>
        <view v-if="fileName" class="ocr-switch" style="display: flex; align-items: center">
          <text style="font-size: 24rpx; color: var(--text-sub); margin-right: 8rpx">深度OCR图表解析</text>
          <wd-switch v-model="useDeepOcr" size="20px" />
        </view>
      </view>

      <view class="operation-zone">
        <view v-if="!fileName" id="e2e-import-choose-file" class="upload-trigger glow-effect" @tap="chooseFile">
          <view class="icon-circle">
            <BaseIcon name="folder" :size="48" />
          </view>
          <text class="upload-main-text">
            {{ isPickingFile ? '正在拉起文件选择...' : '选择复习资料' }}
          </text>
          <text class="upload-sub-text"> 请先将资料发送到微信聊天，再从聊天记录选择 </text>
          <text class="upload-hint-text"> 支持 Anki (.apkg) 牌组文件，导入考研公共题库、自制卡片等 </text>
        </view>

        <view v-else class="file-capsule glass-morphism">
          <view class="file-icon-box">
            <BaseIcon name="file" :size="56" />
          </view>
          <view class="file-info-col">
            <text class="fname-text text-ellipsis">
              {{ fileName }}
            </text>
            <view class="fmeta-row">
              <view class="meta-tag">
                {{ fullFileContent ? '精读模式' : '主题模式' }}
              </view>
              <text class="meta-size">
                {{ cachedFileData && cachedFileData.size > 0 ? formatFileSize(cachedFileData.size) : '已准备好' }}
              </text>
            </view>
          </view>
          <view class="close-btn-circle" @tap.stop="clearFile">
            <BaseIcon name="close" :size="28" />
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-action-bar glass-morphism">
      <view class="action-row main-row">
        <wd-button
          id="e2e-import-start-ai-btn"
          type="primary"
          size="large"
          block
          :disabled="isLooping || !fileName"
          :loading="isLooping"
          custom-class="apple-btn"
          @click="startAI"
        >
          <BaseIcon name="sparkle" :size="28" style="margin-right: 8px" />
          {{ isLooping ? '智能后台生成中...' : '开始智能出题' }}
        </wd-button>
      </view>

      <view class="action-row sub-row sub-row-flex">
        <wd-button
          v-if="!isLooping && (fullFileContent || fileName) && generatedCount > 0"
          plain
          block
          style="flex: 1"
          custom-class="apple-btn secondary"
          @click="continueGenerating"
        >
          <BaseIcon name="refresh" :size="28" style="margin-right: 4px" />
          <text style="font-size: 30rpx">再出一组</text>
        </wd-button>
        <wd-button plain type="danger" block style="flex: 1" custom-class="apple-btn" @click="clearAll">
          清空题库
        </wd-button>
      </view>
    </view>

    <view v-if="showMask" class="ai-loading-mask">
      <view class="ai-card glass-morphism">
        <view class="apple-ai-gradient" />
        <view class="apple-ai-glow" />

        <view class="content-box">
          <!-- ⭐ v5.2: 使用 EnhancedProgress 替代原有的环形进度 -->
          <view class="progress-wrapper">
            <EnhancedProgress
              label="生成进度"
              :current-value="realProgress"
              unit="%"
              :progress="realProgress"
              type="brand"
              :show-hint="true"
              :hint-text="importProgressText"
            />
          </view>

          <text class="loading-title">
            {{ importStatusText }}
          </text>
          <text class="loading-step">
            {{ importProgressText }}
          </text>
          <text class="loading-progress">
            {{ importDetailText }}
          </text>

          <text class="soup-text"> "{{ currentSoup }}" </text>
          <view class="loading-actions">
            <button class="glass-btn ghost" hover-class="btn-scale-sm" @tap="pauseGeneration">暂停生成</button>
            <button class="glass-btn danger" hover-class="btn-scale-sm" @tap="cancelGeneration">取消</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 自定义极速体验弹窗 -->
    <view v-if="showSpeedModal" id="e2e-import-speed-modal" class="speed-modal-mask">
      <view class="speed-card bounce-in">
        <view class="speed-icon-box">
          <BaseIcon name="lightning" :size="48" />
        </view>
        <text class="speed-title"> 极速体验就绪 </text>
        <text class="speed-desc"> 前 5 道题已生成完毕！您可以立即开始刷题，智能将在后台静默为您补充剩余题目。 </text>

        <view class="speed-actions">
          <button class="glass-btn ghost" hover-class="btn-scale-sm" @tap="stayHere">留在本页</button>
          <button id="e2e-import-go-quiz-btn" class="glass-btn shine" hover-class="btn-scale-sm" @tap="goQuiz">
            立即刷题
          </button>
        </view>
      </view>
    </view>

    <view v-if="isPaused" class="pause-banner">
      <view class="pause-info">
        <text class="pause-title"> 任务已暂停 </text>
        <text class="pause-desc"> 可随时继续生成题库 </text>
      </view>
      <button class="glass-btn shine" hover-class="btn-scale-sm" @tap="resumeGeneration">继续生成</button>
    </view>

    <!-- ⭐⭐ v5.2 新增：错误卡片（带重试按钮） -->
    <view v-if="errorInfo && errorInfo.canRetry" class="error-card-mask">
      <view class="error-card bounce-in">
        <view class="error-icon-box">
          <BaseIcon name="warning" :size="48" />
        </view>
        <text class="error-title">
          {{ errorInfo.message }}
        </text>
        <text class="error-desc">
          {{ errorInfo.detail }}
        </text>

        <view class="error-actions">
          <button class="glass-btn ghost" hover-class="btn-scale-sm" @tap="dismissError">关闭</button>
          <button class="glass-btn shine" hover-class="btn-scale-sm" @tap="retryGeneration">重试</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { pageRequireLogin } from '@/utils/auth/loginGuard.js';
import config from '@/config/index.js';
import { ankiImport, ragIngest } from '@/services/api/domains/practice.api.js';
import { useSchoolStore } from '@/stores/modules/school.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import EnhancedProgress from './EnhancedProgress.vue';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
// ✅ 文件处理工具（格式验证、大小限制）
import { fileHandler } from './file-handler.js';
// F019: storageService
import storageService from '@/services/storageService.js';
import { QUOTE_LIBRARY } from '@/config/home-data.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: {
    EnhancedProgress,
    BaseIcon
  },
  data() {
    return {
      useDeepOcr: true,
      // 导航栏相关
      statusBarHeight: 44,
      navBarHeight: 88,
      isDark: false,

      // 状态锁拆分
      isLooping: false,
      isPaused: false,
      showMask: false,
      showSpeedModal: false,
      isPickingFile: false,
      isRequestInFlight: false,
      progressTimer: null,

      // UI 状态
      currentSoup: '',
      soupList: QUOTE_LIBRARY.map((q) => q.text),
      soupTimer: null,

      // 核心业务数据
      fileName: '',
      fullFileContent: '',
      readOffset: 0,
      chunkSize: 1000,
      generatedCount: 0,
      totalQuestionsLimit: 10,
      batchQuestionCount: 5,
      uploadHistoryKey: 'imported_files',
      currentUploadId: '',
      progressWidth: 0,

      // ⭐ 新增：增强的进度和状态管理
      realProgress: 0, // 真实进度百分比 (0-100)
      estimatedTimeLeft: 0, // 预估剩余时间（秒）
      generationStartTime: 0, // 生成开始时间戳
      totalQuestionsGenerated: 0, // 已生成的题目总数
      errorInfo: null, // 错误信息对象 { message, detail, canRetry }
      showErrorCard: false, // 显示错误卡片
      uploadStats: {
        // 上传统计
        totalSize: 0,
        uploadedSize: 0,
        speed: 0
      },
      showFilePreview: false, // 显示文件预览确认
      filePreviewData: null, // 文件预览数据

      // ⭐⭐ v5.2 新增：导入体验优化
      cachedFileData: null, // 缓存文件数据（支持重试）
      firstBatchTime: 0, // 首批生成耗时（毫秒）
      laterBatchAvgTime: 0, // 后续批次平均耗时（毫秒）
      laterBatchCount: 0, // 后续批次计数
      importStatus: 'idle', // 导入状态：idle/parsing/importing/success/error
      currentQuestionIndex: 0, // 当前导入到第几题
      totalQuestionsToImport: 0, // 预计总题数
      importErrorDetail: null, // 详细错误信息
      loopPendingTimers: [], // [R393] 追踪未完成的setTimeout，onUnload时批量清理
      retryCount: 0, // 重试次数
      maxRetryCount: 3, // 最大重试次数
      canGoBack: true, // 是否允许返回
      duplicateCount: 0, // 重复题目数量
      importStartTime: 0, // 导入开始时间
      importSpeed: 0, // 导入速度（题/秒）

      // ⭐⭐ v5.8 新增：批次内进度模拟（TASK-001）
      progressSimulationTimer: null, // 进度模拟定时器
      currentBatchProgress: 0, // 当前批次进度 (0-100)
      batchStartTime: 0 // 当前批次开始时间
    };
  },

  computed: {
    // ⭐⭐ v5.8 优化：动态状态文本（增强emoji和文案）- TASK-002
    importStatusText() {
      if (this.importStatus === 'parsing') {
        return '正在解析文件...';
      } else if (this.importStatus === 'uploading') {
        return '正在上传文件...';
      } else if (this.importStatus === 'importing') {
        // v5.8: 显示更详细的进度信息
        const batchNum = this.generatedCount + 1;
        const totalBatch = this.totalQuestionsLimit;
        return `智能正在生成第 ${batchNum}/${totalBatch} 批题目...`;
      } else if (this.importStatus === 'success') {
        return '导入成功！';
      } else if (this.importStatus === 'error') {
        return '导入失败';
      } else if (this.importStatus === 'retrying') {
        return `正在重试 (${this.retryCount}/${this.maxRetryCount})...`;
      }
      return '智能正在分析...';
    },

    // ⭐⭐ v5.8 优化：更直观的进度显示 - TASK-001
    importProgressText() {
      const current = this.totalQuestionsGenerated;
      const total = this.totalQuestionsLimit * this.batchQuestionCount;

      if (this.importStatus === 'parsing') {
        return '正在解析文件内容...';
      }

      if (this.importStatus === 'importing') {
        // v5.8: 显示批次内的实时进度
        if (this.currentBatchProgress > 0 && this.currentBatchProgress < 100) {
          const estimatedCurrent = current + Math.floor((this.batchQuestionCount * this.currentBatchProgress) / 100);
          return `正在生成第 ${estimatedCurrent} 题（共 ${total} 题）`;
        }
        return `正在生成第 ${current + 1} 题（共 ${total} 题）`;
      }

      if (current === 0) {
        return `准备生成 ${total} 道题目`;
      }

      return `已生成 ${current} / ${total} 道题`;
    },

    // ⭐⭐ v5.8 优化：详情显示 - TASK-001
    importDetailText() {
      const parts = [];

      // v5.8: 显示更精确的进度（包含批次内进度）
      if (this.importStatus === 'importing' && this.currentBatchProgress > 0) {
        const preciseProgress = Math.round(this.realProgress + this.currentBatchProgress / this.totalQuestionsLimit);
        parts.push(`进度 ${Math.min(preciseProgress, 99)}%`);
      } else if (this.realProgress > 0) {
        parts.push(`进度 ${this.realProgress}%`);
      }

      // 预估剩余时间（优化显示）
      if (this.estimatedTimeLeft > 0 && this.importStatus === 'importing') {
        parts.push(`${this.formatTimeLeft(this.estimatedTimeLeft)}`);
      }

      // 导入速度（优先显示）
      if (this.importSpeed > 0 && this.totalQuestionsGenerated > 0) {
        parts.push(`${this.importSpeed.toFixed(1)} 题/秒`);
      }

      // 重复题目提示（醒目显示）
      if (this.duplicateCount > 0) {
        parts.push(`已跳过 ${this.duplicateCount} 道重复题`);
      }

      // v5.8: 文件大小显示（如果有）
      if (this.cachedFileData && this.cachedFileData.size > 0 && this.importStatus === 'parsing') {
        parts.push(`${this.formatFileSize(this.cachedFileData.size)}`);
      }

      return parts.join(' · ');
    }
  },

  onLoad() {
    // 页面级登录保护 — 未登录用户跳转到登录页
    if (!pageRequireLogin(this, { message: '请先登录后导入学习资料' })) return;

    // 获取系统信息，设置状态栏和导航栏高度
    try {
      this.statusBarHeight = getStatusBarHeight();
      // 标准导航栏高度 = 状态栏高度 + 44px
      this.navBarHeight = this.statusBarHeight + 44;

      // 初始化深色模式（直接读 uni storage，与 App.vue switchTheme 对齐）
      const savedTheme = uni.getStorageSync('theme_mode') || 'light';
      this.isDark = savedTheme === 'dark';

      // 监听全局主题更新事件
      this._themeHandler = (mode) => {
        this.isDark = mode === 'dark';
      };
      uni.$on('themeUpdate', this._themeHandler);
    } catch (_e) {
      logger.error('获取系统信息失败:', _e);
    }
  },

  onShow() {
    // ⚡️ 核心修复：回到页面时，自动恢复中断的生成任务
    // 判断条件：开关是开的 && 还没达到目标总数 && 当前没有请求在飞
    if (this.isLooping && !this.isPaused && this.generatedCount < this.totalQuestionsLimit && !this.isRequestInFlight) {
      logger.log('回到页面，检测到任务未完成，继续后台生成...');
      // 如果遮罩已关闭，说明首批已完成，静默继续
      if (!this.showMask) {
        this.generateNextBatch();
      }
    }
  },

  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate', this._themeHandler);

    // 页面卸载时停止循环和遮罩
    this.isLooping = false;
    this.showMask = false;
    this.showSpeedModal = false;
    if (this.soupTimer) {
      clearInterval(this.soupTimer);
      this.soupTimer = null;
    }
    // 停止进度动画
    this.stopProgressAnimation();
    // M16: 清理批量进度模拟定时器
    this.stopBatchProgressSimulation();
    // [R393] 批量清理所有未完成的 setTimeout
    if (this.loopPendingTimers) {
      this.loopPendingTimers.forEach((tid) => clearTimeout(tid));
      this.loopPendingTimers = [];
    }
  },

  methods: {
    // 1. 选择文件 (入口) - 使用 fileHandler 统一处理
    async chooseFile() {
      if (this.isPickingFile) return;

      // 支持的文件类型
      const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'apkg'];
      // 文件大小限制：10MB
      const maxSize = 10 * 1024 * 1024;

      try {
        this.isPickingFile = true;

        const result = await fileHandler.chooseFile({
          count: 1,
          allowedTypes: allowedTypes,
          maxSize: maxSize
        });

        if (result.success && result.file) {
          this.handleUpload(result.file);
        } else if (result.cancelled) {
          // 用户取消，不做处理
          logger.log('[导入资料] 用户取消选择文件');
        } else if (result.privacyScopeMissing) {
          logger.warn('[导入资料] 文件选择失败：隐私权限声明未完成');
        } else if (result.errors && result.errors.length > 0) {
          // 验证失败，错误已在 fileHandler 中显示
          logger.warn('[导入资料] 文件验证失败:', result.errors);
        } else {
          const errMsg = String(result?.error?.errMsg || result?.error?.message || '').trim();
          logger.error('[导入资料] 文件选择失败:', result?.error || result);
          toast.info(errMsg && errMsg.length <= 18 ? errMsg : '文件选择失败，请稍后重试');
        }
      } catch (err) {
        logger.error('[导入资料] 文件选择异常:', err);
        toast.info('文件选择失败');
      } finally {
        this.isPickingFile = false;
      }
    },

    // 2. 处理上传 (分流逻辑) - 增强：文件大小和格式验证
    async handleUpload(file) {
      const that = this; // 保存 this 引用

      // 文件信息
      const fileName = file.name;
      const filePath = file.path || file.tempFilePath;
      const fileSize = file.size || 0;
      const ext = file.ext || fileHandler.getFileExtension(fileName);

      logger.log('[导入资料] 📁 处理文件:', {
        name: fileName,
        size: fileHandler.formatFileSize(fileSize),
        ext: ext
      });

      // ⭐ 再次验证文件（双重保险）
      const validation = fileHandler.validateFile(
        { name: fileName, size: fileSize },
        {
          allowedTypes: ['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'apkg'],
          maxSize: 10 * 1024 * 1024 // 10MB
        }
      );

      if (!validation.valid) {
        toast.info(validation.errors[0], 2500);
        return;
      }

      this.fileName = fileName;

      // 重置数据
      this.fullFileContent = '';
      this.readOffset = 0;
      this.generatedCount = 0;

      // ⭐⭐ v5.2 新增：缓存文件数据（支持重试）
      this.cachedFileData = {
        name: fileName,
        path: filePath,
        size: fileSize,
        ext: ext,
        timestamp: Date.now()
      };

      this.currentUploadId = this.saveUploadRecord({
        name: this.fileName,
        size: Math.round(fileSize / 1024),
        source: '本地文件'
      });

      if (ext === 'apkg') {
        // Anki .apkg: 读取文件并转 base64，调用后端 anki-import 云函数
        toast.loading('正在解析 Anki 牌组...');

        try {
          const fs = uni.getFileSystemManager();
          const base64String = await new Promise((resolve, reject) => {
            fs.readFile({
              filePath: filePath,
              encoding: 'base64',
              success: (res) => resolve(res.data),
              fail: (err) => reject(err)
            });
          });

          // 更新状态
          this.importStatus = 'uploading';

          const response = await ankiImport(base64String, fileName, { timeout: config.ai.timeout, maxRetries: 1 });

          toast.hide();

          if (response.code === 0 && response.data) {
            const result = response.data;
            const deckName = result.deckName || fileName.replace('.apkg', '');
            const cardCount = result.cardCount || 0;

            // 保存导入的题目到本地题库
            if (result.questions && Array.isArray(result.questions) && result.questions.length > 0) {
              this.saveQuestions(result.questions);
            }

            this.importStatus = 'success';

            // 后台触发 RAG 索引（非阻塞，不影响用户流程）
            if (result.bankId || result.questionBankId) {
              ragIngest('index_questions', { bankId: result.bankId || result.questionBankId }).catch((err) => {
                logger.warn('[Import] RAG indexing failed (non-critical):', err);
              });
            }

            modal.show({
              title: 'Anki 牌组导入成功',
              content: `牌组名称：${deckName}\n导入卡片：${cardCount} 张`,
              confirmText: '立即刷题',
              cancelText: '留在本页',
              success: (res) => {
                if (res.confirm) {
                  uni.switchTab({ url: '/pages/practice/index' });
                }
              }
            });
          } else {
            this.importStatus = 'error';
            toast.info(response.message || 'Anki 导入失败', 2500);
          }
        } catch (err) {
          toast.hide();
          this.importStatus = 'error';
          logger.error('[导入资料] Anki 导入异常:', err);
          toast.info('Anki 文件解析失败，请重试');
        }
        return;
      }

      if (['pdf', 'doc', 'docx'].includes(ext)) {
        // PDF/Word: 仅使用文件名
        this.fullFileContent = '';
        // ✅ F026: 添加文件解析进度提示
        toast.loading('正在解析文档...');
        const _docTid1 = setTimeout(() => {
          toast.hide();
          toast.success('已提取主题');
          // 自动启动智能分析
          const _docTid2 = setTimeout(() => {
            that.startAI();
            that.loopPendingTimers = that.loopPendingTimers.filter((t) => t !== _docTid2);
          }, 500);
          that.loopPendingTimers.push(_docTid2);
          that.loopPendingTimers = that.loopPendingTimers.filter((t) => t !== _docTid1);
        }, 300);
        that.loopPendingTimers.push(_docTid1);
      } else {
        // TXT/MD/JSON: 读取内容
        toast.loading('解析文件中...');

        try {
          const readResult = await fileHandler.readTextFile(filePath);
          toast.hide();

          if (readResult.success) {
            that.fullFileContent = readResult.content;
            toast.success('解析成功');
            // 自动启动智能分析
            const _readSuccTid = setTimeout(() => {
              that.startAI();
              that.loopPendingTimers = that.loopPendingTimers.filter((t) => t !== _readSuccTid);
            }, 500);
            that.loopPendingTimers.push(_readSuccTid);
          } else {
            logger.error('[导入资料] 文件读取失败:', readResult.error);
            that.fullFileContent = '';
            toast.info('读取失败，仅使用文件名');
            // 即使失败也启动智能分析（使用文件名）
            const _readFailTid = setTimeout(() => {
              that.startAI();
              that.loopPendingTimers = that.loopPendingTimers.filter((t) => t !== _readFailTid);
            }, 500);
            that.loopPendingTimers.push(_readFailTid);
          }
        } catch (err) {
          toast.hide();
          logger.error('[导入资料] 文件读取异常:', err);
          that.fullFileContent = '';
          toast.info('读取失败，仅使用文件名');
          const _readErrTid = setTimeout(() => {
            that.startAI();
            that.loopPendingTimers = that.loopPendingTimers.filter((t) => t !== _readErrTid);
          }, 500);
          that.loopPendingTimers.push(_readErrTid);
        }
      }
    },

    // 3. 清除当前文件
    clearFile() {
      this.fileName = '';
      this.fullFileContent = '';
      this.readOffset = 0;
      this.currentUploadId = '';
      this.isPaused = false;
      this.showSpeedModal = false; // 关闭弹窗
    },

    // 4. 启动智能连载 (点击按钮触发)
    // 已迁移到独立服务器：通过 school store 的 aiRecommend 调用后端代理
    async startAI() {
      if (!this.fullFileContent && !this.fileName) {
        toast.info('请先导入文件');
        return;
      }

      // 双锁开启
      this.isLooping = true; // 开启循环
      this.isPaused = false;
      this.showMask = true; // 开启遮罩（前5题期间）

      // ⭐⭐ v5.8: 禁用返回按钮 - TASK-004
      this.canGoBack = false;

      this.readOffset = 0;
      this.generatedCount = 0;
      this.progressWidth = 0; // 重置进度

      // ⭐⭐ v5.3 Phase 1: 初始化真实进度追踪
      this.importStartTime = Date.now();
      this.generationStartTime = Date.now();
      this.realProgress = 0;
      this.estimatedTimeLeft = 0;
      this.totalQuestionsGenerated = 0;
      this.importStatus = 'parsing';
      this.duplicateCount = 0;
      this.importSpeed = 0;
      this.currentQuestionIndex = 0;

      // ⭐⭐ v5.8: 重置批次进度 - TASK-001
      this.currentBatchProgress = 0;
      this.retryCount = 0;

      this.startSoupRotation();
      this.updateUploadRecordStatus('generating');

      // 启动进度动画
      this.startProgressAnimation();

      await this.generateNextBatch();
    },

    // 4.1. startAIAnalysis 别名方法 - 修复：兼容可能的旧调用
    // 如果代码中有地方调用了 startAIAnalysis，这个方法会确保不报错
    async startAIAnalysis() {
      logger.warn('startAIAnalysis 已废弃，请使用 startAI');
      return this.startAI();
    },

    // 5. 分批生成逻辑 (核心递归) - 3秒首屏策略 + 防重复请求 + 真实进度
    async generateNextBatch() {
      // 1. 检查是否强制停止
      if (!this.isLooping || this.isPaused) {
        this.stopProgressAnimation();
        return;
      }

      // 2. 检查上限
      if (this.generatedCount >= this.totalQuestionsLimit) {
        this.finishGeneration('已生成所有题目！');
        return;
      }

      // 3. 如果已经在请求了，就别重复发了
      if (this.isRequestInFlight) {
        logger.log('已有请求进行中，跳过本次调用');
        return;
      }

      // ⭐⭐ v5.3 Phase 1: 批次开始，更新状态为importing
      this.importStatus = 'importing';
      this.currentQuestionIndex = this.generatedCount * this.batchQuestionCount + 1;

      // ⭐⭐ v5.8: 启动批次内进度模拟 - TASK-001
      this.batchStartTime = Date.now();
      this.currentBatchProgress = 0;
      this.startBatchProgressSimulation();

      // ⭐ 4. 更新真实进度
      this.updateRealProgress();

      // ⚡️⚡️ 策略优化：第一波只出 3 题，追求极速；后续出 5 题，追求效率
      const _currentBatchSize = this.batchQuestionCount;

      let chunkText = '';
      if (this.fullFileContent) {
        chunkText = this.fullFileContent.substring(this.readOffset, this.readOffset + this.chunkSize);
        if (this.readOffset >= this.fullFileContent.length) this.readOffset = 0;
      }

      // 构建内容文本
      const contentText = chunkText || '主题：' + this.fileName;

      try {
        this.isRequestInFlight = true; // ⚡️ 上锁：请求开始

        // ✅ 使用后端代理调用（安全）- action: 'generate'
        // 后端会自动添加 "请生成题目..." 的 Prompt
        const response = await useSchoolStore().aiRecommend('generate', {
          content: contentText
        });

        // 处理响应
        if (response.code !== 0 || !response.data) {
          logger.error('[导入资料] 智能响应异常:', response.message);
          this.isLooping = false;
          this.isPaused = true;
          this.stopProgressAnimation();
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          toast.info(response.message || '生成失败');
          return;
        }

        // 清洗 JSON（去除可能的 Markdown 代码块标记）
        let aiText = response.data;
        aiText = aiText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        // 解析 JSON
        let newQuestions = [];
        try {
          newQuestions = JSON.parse(aiText);
          if (!Array.isArray(newQuestions)) {
            throw new Error('智能返回格式不是数组');
          }
        } catch (parseError) {
          logger.error('[导入资料] JSON解析失败:', parseError);
          logger.error('[导入资料] 原始数据:', aiText.substring(0, 200));
          modal.show({
            title: '解析失败',
            content: '智能返回的数据格式不正确，请重试。',
            showCancel: false
          });
          this.isLooping = false;
          this.isPaused = true;
          this.stopProgressAnimation();
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          return;
        }

        // 保存题目
        const saved = this.saveQuestions(newQuestions);
        if (!saved) {
          this.isLooping = false;
          this.isPaused = true;
          this.stopProgressAnimation();
          this.importStatus = 'error';
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          toast.info('解析失败，请重试');
          return;
        }
        this.readOffset += this.chunkSize;
        this.generatedCount++; // 这里的计数单位变成了"批次"

        // ⭐⭐ v5.8: 停止批次内进度模拟 - TASK-001
        this.stopBatchProgressSimulation();
        this.currentBatchProgress = 100;

        // ⭐⭐ v5.3 Phase 1: 批次完成，更新真实进度
        this.totalQuestionsGenerated = this.generatedCount * this.batchQuestionCount;
        this.realProgress = Math.round((this.generatedCount / this.totalQuestionsLimit) * 100);

        // 计算导入速度和预估剩余时间
        if (this.importStartTime > 0) {
          const elapsedSeconds = (Date.now() - this.importStartTime) / 1000;
          this.importSpeed = this.totalQuestionsGenerated / elapsedSeconds;
          const remainingQuestions = (this.totalQuestionsLimit - this.generatedCount) * this.batchQuestionCount;
          this.estimatedTimeLeft = Math.round(remainingQuestions / this.importSpeed);
        }

        // ⚡️⚡️ 首批完成逻辑
        if (this.generatedCount === 1) {
          this.showMask = false; // 关闭 Loading
          this.showSpeedModal = true; // 打开自定义漂亮弹窗
        } else {
          // 后续批次：静默生成，只在底部给一个小 Toast 提示进度
          if (this.isLooping) {
            toast.info(`后台已更新一批新题`);
          }
        }

        // 继续下一轮 - [R393] 使用追踪版 setTimeout 防止页面卸载后泄漏
        const tid = setTimeout(() => {
          this.loopPendingTimers = this.loopPendingTimers.filter((t) => t !== tid);
          if (this.isLooping) {
            this.generateNextBatch();
          }
        }, 1500);
        this.loopPendingTimers.push(tid);
      } catch (e) {
        logger.error('生成报错:', e);

        // ⭐⭐ v5.8: 停止批次内进度模拟 - TASK-001
        this.stopBatchProgressSimulation();
        this.stopProgressAnimation();

        // ⭐⭐ v5.8 增强错误处理：详细错误分类 - TASK-003
        let errorMessage = '生成失败';
        let errorDetail = e.message || '未知错误';
        let canRetry = false;
        let autoRetry = false;

        // 错误分类逻辑
        if (
          e.message &&
          (e.message.includes('timeout') || e.message.includes('超时') || e.message.includes('ETIMEDOUT'))
        ) {
          // 网络超时：自动重试
          errorMessage = '网络超时';
          errorDetail = '请求超时，正在自动重试...';
          canRetry = true;
          autoRetry = true;
          this.importStatus = 'retrying';
        } else if (e.message && (e.message.includes('401') || e.message.includes('unauthorized'))) {
          // 未登录：不自动重试
          errorMessage = '未登录';
          errorDetail = '请先登录后再试';
          canRetry = false;
          this.isLooping = false;
          this.isPaused = true;
          this.canGoBack = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
        } else if (
          e.message &&
          (e.message.includes('network') || e.message.includes('网络') || e.message.includes('ECONNREFUSED'))
        ) {
          // 网络错误：可重试
          errorMessage = '网络不稳定';
          errorDetail = '请检查网络连接后重试';
          canRetry = true;
          this.isLooping = false;
          this.isPaused = true;
          this.canGoBack = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
        } else if (
          e.message &&
          (e.message.includes('JSON') || e.message.includes('parse') || e.message.includes('Unexpected'))
        ) {
          // 智能解析失败：可重试
          errorMessage = '智能解析失败';
          errorDetail = '智能返回的数据格式异常，请重试';
          canRetry = true;
          autoRetry = this.retryCount < 2; // 自动重试2次
          if (autoRetry) {
            this.importStatus = 'retrying';
          }
        } else if (
          e.message &&
          (e.message.includes('rate') || e.message.includes('limit') || e.message.includes('429'))
        ) {
          // 频率限制：延迟重试
          errorMessage = '请求过于频繁';
          errorDetail = '请稍等片刻后重试';
          canRetry = true;
          this.isLooping = false;
          this.isPaused = true;
          this.canGoBack = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
        } else {
          // 其他错误：可重试
          errorMessage = '生成失败';
          errorDetail = e.message || '未知错误，请重试';
          canRetry = true;
          this.isLooping = false;
          this.isPaused = true;
          this.canGoBack = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
        }

        // 保存错误信息供重试使用
        this.errorInfo = {
          message: errorMessage,
          detail: errorDetail,
          canRetry: canRetry
        };
        this.importStatus = canRetry ? 'error' : 'error';

        // 自动重试逻辑
        if (autoRetry && this.retryCount < this.maxRetryCount) {
          this.retryCount++;
          logger.log(`[自动重试] 第 ${this.retryCount} 次重试...`);
          toast.info(`正在重试 (${this.retryCount}/${this.maxRetryCount})...`);
          this.startProgressAnimation();
          // [R393] 使用追踪版 setTimeout 防止页面卸载后泄漏
          const retryTid = setTimeout(() => {
            this.loopPendingTimers = this.loopPendingTimers.filter((t) => t !== retryTid);
            if (this.isLooping) {
              this.generateNextBatch();
            }
          }, 2000);
          this.loopPendingTimers.push(retryTid);
        } else if (!autoRetry) {
          // 显示错误提示
          toast.info(errorMessage, 3000);
        }
      } finally {
        this.isRequestInFlight = false; // ⚡️ 解锁：无论成功失败，请求结束
      }
    },

    // ⭐⭐ v5.2-iter2 新增：生成题目hash（用于去重）
    generateQuestionHash(question) {
      // 使用题目文本+选项生成简单hash
      const questionText = question.question || '';
      const optionsText = Array.isArray(question.options) ? question.options.join('') : '';
      return questionText + optionsText;
    },

    // 6. 保存题目到本地存储（含去重逻辑）
    saveQuestions(newQuestions) {
      logger.log('[题库保存] 📥 开始保存题目');
      if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
        logger.warn('[题库保存] ⚠️ 题目数据无效');
        return false;
      }

      try {
        logger.log('[题库保存] 📚 解析成功，新题目数量:', newQuestions.length);

        // 读取旧题库
        const oldBank = storageService.get('v30_bank', []);
        logger.log('[题库保存] 📖 旧题库数量:', oldBank.length);

        // ⭐⭐ v5.2-iter2: 去重逻辑
        // 1. 构建旧题库hash集合
        const oldHashes = new Set(oldBank.map((q) => this.generateQuestionHash(q)));
        logger.log('[题库保存] 🔍 旧题库hash数量:', oldHashes.size);

        // 2. 过滤新题目（排除重复）
        const uniqueQuestions = newQuestions.filter((q) => {
          const hash = this.generateQuestionHash(q);
          return !oldHashes.has(hash);
        });

        // 3. 统计重复数量
        const duplicates = newQuestions.length - uniqueQuestions.length;
        if (duplicates > 0) {
          this.duplicateCount += duplicates;
          logger.log('[题库保存] ⚠️ 检测到重复题目:', duplicates, '道');
        }

        logger.log('[题库保存] ✅ 去重后新题目数量:', uniqueQuestions.length);

        // 检查登录状态
        const userId = storageService.get('EXAM_USER_ID');
        const isLoggedIn = !!userId;
        logger.log('[题库保存] 👤 用户登录状态:', { isLoggedIn, userId: userId || '未登录' });

        // ⭐⭐ v5.2-iter2: 使用去重后的题目合并
        const merged = [...oldBank, ...uniqueQuestions];
        logger.log('[题库保存] 💾 准备保存，合并后总数:', merged.length);

        // 未登录时：保留本地缓存（10-15道题）
        let finalBank = merged;
        if (!isLoggedIn) {
          // 如果题目总数超过15道，只保留最新的15道
          if (merged.length > 15) {
            finalBank = merged.slice(-15);
            logger.log('[题库保存] 📦 未登录状态：保留本地缓存', finalBank.length, '道题（最新15道）');
          } else if (merged.length > 10) {
            finalBank = merged;
            logger.log('[题库保存] 📦 未登录状态：保留本地缓存', finalBank.length, '道题');
          } else {
            finalBank = merged;
            logger.log('[题库保存] 📦 未登录状态：保留本地缓存', finalBank.length, '道题（少于10道，全部保留）');
          }
        }

        // 保存前先备份（防止数据丢失）
        try {
          const backup = JSON.stringify(finalBank);
          storageService.save('v30_bank_backup', backup);
          logger.log('[题库保存] 💾 已创建备份');
        } catch (backupErr) {
          logger.warn('[题库保存] ⚠️ 备份失败（不影响主流程）:', backupErr);
        }

        // 保存（未登录时只保存本地，不保存到云端）
        try {
          storageService.save('v30_bank', finalBank);
          logger.log('[题库保存] 💾 主数据保存完成（', isLoggedIn ? '已登录，可同步云端' : '未登录，仅本地缓存', '）');
        } catch (saveErr) {
          logger.error('[题库保存] ❌ 保存失败:', saveErr);
          // 尝试恢复备份
          try {
            const backup = storageService.get('v30_bank_backup');
            if (backup) {
              const restored = JSON.parse(backup);
              storageService.save('v30_bank', restored);
              logger.log('[题库保存] 🔄 已从备份恢复数据');
            }
          } catch (restoreErr) {
            logger.error('[题库保存] ❌ 恢复备份也失败:', restoreErr);
          }
          return false;
        }

        // 验证保存是否成功
        const saved = storageService.get('v30_bank', []);
        const isSuccess = saved.length === finalBank.length;

        logger.log('[题库保存] ✅ 验证保存结果:', {
          savedCount: saved.length,
          expectedCount: finalBank.length,
          match: isSuccess,
          isLoggedIn: isLoggedIn,
          finalBankSize: finalBank.length
        });

        if (!isSuccess) {
          logger.error('[题库保存] ❌ 保存验证失败！数据可能不完整');
          // 尝试从备份恢复
          try {
            const backup = storageService.get('v30_bank_backup');
            if (backup) {
              const restored = JSON.parse(backup);
              storageService.save('v30_bank', restored);
              logger.log('[题库保存] 🔄 已从备份恢复数据');
            }
          } catch (restoreErr) {
            logger.error('[题库保存] ❌ 恢复备份失败:', restoreErr);
          }
          return false;
        }

        if (!isLoggedIn) {
          logger.log(
            `[题库保存] ✅ 未登录状态：成功存入 ${newQuestions.length} 道题，本地缓存总数: ${finalBank.length}（保留最新${finalBank.length}道）`
          );
          toast.info(`已保存${newQuestions.length}道题（本地缓存）`);
        } else {
          logger.log(`[题库保存] ✅ 成功存入 ${newQuestions.length} 道题，当前总数: ${finalBank.length}`);
        }
        return true;
      } catch (e) {
        logger.error('[题库保存] ❌ 保存失败', e);
        return false;
      }
    },

    // 7. 结束生成（⭐⭐ v5.8: 增强统计报告）
    finishGeneration(msg) {
      this.isLooping = false;
      this.isPaused = false;
      this.showMask = false;
      this.showSpeedModal = false;
      this.importStatus = 'success';
      this.canGoBack = true; // ⭐⭐ v5.8: 恢复返回按钮 - TASK-004
      this.stopBatchProgressSimulation(); // ⭐⭐ v5.8: 停止进度模拟 - TASK-001
      this.stopProgressAnimation();
      this.updateUploadRecordStatus('completed');
      if (this.soupTimer) {
        clearInterval(this.soupTimer);
        this.soupTimer = null;
      }

      // ⭐⭐ v5.3: 构建详细的统计报告
      const totalTime = this.importStartTime > 0 ? Math.round((Date.now() - this.importStartTime) / 1000) : 0;
      const avgSpeed = totalTime > 0 ? (this.totalQuestionsGenerated / totalTime).toFixed(1) : '0';

      let enhancedMsg = `${msg}\n\n`;
      enhancedMsg += `导入统计\n`;
      enhancedMsg += `成功导入：${this.totalQuestionsGenerated} 道新题\n`;

      if (this.duplicateCount > 0) {
        enhancedMsg += `跳过重复：${this.duplicateCount} 道题\n`;
      }

      if (totalTime > 0) {
        const minutes = Math.floor(totalTime / 60);
        const seconds = totalTime % 60;
        if (minutes > 0) {
          enhancedMsg += `总耗时：${minutes} 分 ${seconds} 秒\n`;
        } else {
          enhancedMsg += `总耗时：${seconds} 秒\n`;
        }
        enhancedMsg += `平均速度：${avgSpeed} 题/秒`;
      }

      modal.show({
        title: '题库装填完毕',
        content: enhancedMsg,
        confirmText: '立即刷题',
        cancelText: '留在本页',
        success: (res) => {
          if (res.confirm) {
            uni.switchTab({ url: '/pages/practice/index' });
          }
        },
        fail: (err) => {
          logger.error('弹窗显示失败:', err);
        }
      });
    },

    // 8. 鸡汤轮播 - 修复：setInterval 回调使用箭头函数确保 this 绑定
    startSoupRotation() {
      const that = this; // 保存 this 引用
      let i = 0;
      this.currentSoup = this.soupList[0];

      // 清除旧的定时器
      if (this.soupTimer) {
        clearInterval(this.soupTimer);
        this.soupTimer = null;
      }

      // 使用箭头函数确保 this 绑定正确
      this.soupTimer = setInterval(() => {
        i = (i + 1) % that.soupList.length;
        that.currentSoup = that.soupList[i];
      }, 2500); // 每 2.5 秒换一句
    },

    // 9. 手动继续生成
    continueGenerating() {
      if (!this.fullFileContent && !this.fileName) return;
      this.isLooping = true;
      this.isPaused = false;
      this.showMask = true; // 手动点击时，建议还是显示一会遮罩，给用户反馈
      this.startSoupRotation();
      this.startProgressAnimation();
      this.updateUploadRecordStatus('generating');
      this.generateNextBatch();
    },

    // 10. 处理自定义弹窗点击
    stayHere() {
      this.showSpeedModal = false;
      toast.info('智能正在后台继续生成...');
    },

    goQuiz() {
      this.showSpeedModal = false;
      uni.switchTab({ url: '/pages/practice/index' });
    },

    // ⭐⭐ v5.8 优化：返回上一页（增加生成中拦截）- TASK-004
    handleBack() {
      // v5.8: 检查是否正在生成，如果是则显示确认弹窗
      if (!this.canGoBack || this.isLooping) {
        modal.show({
          title: '任务进行中',
          content: '当前正在生成题目，返回将中断任务。已生成的题目将保留，确定要返回吗？',
          confirmText: '确定返回',
          cancelText: '继续生成',
          confirmColor: 'var(--danger)',
          success: (res) => {
            if (res.confirm) {
              // 用户确认返回，停止生成
              this.isLooping = false;
              this.isPaused = false;
              this.showMask = false;
              this.showSpeedModal = false;
              this.canGoBack = true;
              this.stopBatchProgressSimulation();
              this.stopProgressAnimation();
              this.updateUploadRecordStatus('cancelled');

              safeNavigateBack();
            }
          }
        });
        return;
      }

      safeNavigateBack();
    },

    // 11. 清空数据 - 修复：使用箭头函数确保 this 绑定
    clearAll() {
      const that = this; // 保存 this 引用
      modal.show({
        title: '危险操作',
        content: '确定清空所有本地题库吗？此操作不可恢复！\n\n建议：清空前请确保已备份数据。',
        confirmColor: 'var(--danger)',
        success: (res) => {
          if (res.confirm) {
            // 清空前先创建备份（以防误操作）
            try {
              const currentBank = storageService.get('v30_bank', []);
              if (currentBank.length > 0) {
                const backup = JSON.stringify(currentBank);
                storageService.save('v30_bank_backup_before_clear', backup);
                logger.log('[导入资料] 💾 清空前已创建备份:', currentBank.length, '道题');
              }
            } catch (backupErr) {
              logger.warn('[导入资料] ⚠️ 创建备份失败:', backupErr);
            }

            storageService.remove('v30_bank');
            that.clearFile();
            that.isLooping = false;
            that.isPaused = false;
            that.showMask = false;
            that.showSpeedModal = false;
            that.generatedCount = 0;
            that.progressWidth = 0;
            that.stopProgressAnimation();
            that.stopBatchProgressSimulation();
            toast.info('已清空');
          }
        },
        fail: (err) => {
          logger.error('确认弹窗失败:', err);
        }
      });
    },

    pauseGeneration() {
      if (!this.isLooping) return;
      this.isPaused = true;
      this.isLooping = false;
      this.showMask = false;
      this.stopProgressAnimation();
      this.updateUploadRecordStatus('paused');
      toast.info('已暂停生成');
    },

    // ⭐⭐ v5.2 新增：取消生成
    cancelGeneration() {
      modal.show({
        title: '确认取消',
        content: '确定要取消当前生成任务吗？已生成的题目将保留。',
        confirmColor: 'var(--danger)',
        success: (res) => {
          if (res.confirm) {
            this.isLooping = false;
            this.isPaused = false;
            this.showMask = false;
            this.showSpeedModal = false;
            this.updateUploadRecordStatus('cancelled');
            this.stopProgressAnimation();
            if (this.soupTimer) {
              clearInterval(this.soupTimer);
              this.soupTimer = null;
            }
            toast.info('已取消生成');
          }
        }
      });
    },

    // ⭐⭐ v5.2 新增：智能重试生成（使用缓存）
    retryGeneration() {
      // ⭐ 优先使用缓存的文件数据
      if (this.cachedFileData) {
        logger.log('[重试] 使用缓存的文件数据:', this.cachedFileData.name);
        this.fileName = this.cachedFileData.name;
        // 如果有缓存的文件内容，直接使用
        if (this.fullFileContent) {
          logger.log('[重试] 使用缓存的文件内容，长度:', this.fullFileContent.length);
        }
      } else if (!this.fullFileContent && !this.fileName) {
        toast.info('请先导入文件');
        return;
      }

      // 关闭错误卡片
      this.errorInfo = null;

      // 增加重试计数
      this.retryCount++;

      // 检查重试次数限制
      if (this.retryCount > this.maxRetryCount) {
        modal.show({
          title: '重试次数过多',
          content: `已重试 ${this.maxRetryCount} 次，建议检查网络连接或稍后再试。`,
          showCancel: false
        });
        return;
      }

      // 重置状态
      this.isPaused = false;
      this.isLooping = true;
      this.showMask = true;
      this.importStatus = 'importing';

      // 重新开始生成
      this.startSoupRotation();
      this.startProgressAnimation();
      this.updateUploadRecordStatus('generating');
      this.generateNextBatch();

      toast.info(`正在重试 (${this.retryCount}/${this.maxRetryCount})...`);
    },

    // ⭐⭐ v5.2 新增：关闭错误提示
    dismissError() {
      this.errorInfo = null;
    },

    resumeGeneration() {
      if (!this.fullFileContent && !this.fileName) {
        return toast.info('请先导入文件');
      }
      this.isPaused = false;
      this.isLooping = true;
      if (this.generatedCount === 0) {
        this.showMask = true;
      }
      this.startSoupRotation();
      this.startProgressAnimation();
      this.updateUploadRecordStatus('generating');
      this.generateNextBatch();
    },

    getGeneratedQuestionCount() {
      if (this.generatedCount === 0) return 0;
      return this.generatedCount * this.batchQuestionCount;
    },

    saveUploadRecord(record) {
      logger.log('[文件管理] 📝 开始保存文件记录:', record);
      const records = storageService.get(this.uploadHistoryKey, []);
      const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newRecord = {
        id,
        name: record.name,
        size: record.size || 0,
        date: new Date().toISOString().slice(0, 10),
        source: record.source,
        status: 'ready'
      };
      records.unshift(newRecord);
      logger.log('[文件管理] 💾 保存文件记录到存储:', {
        key: this.uploadHistoryKey,
        newRecord: newRecord,
        totalRecords: records.length,
        allRecords: records
      });

      // 保存前先备份
      try {
        const backup = JSON.stringify(records);
        storageService.save('imported_files_backup', backup);
        logger.log('[文件管理] 💾 已创建备份');
      } catch (backupErr) {
        logger.warn('[文件管理] ⚠️ 备份失败（不影响主流程）:', backupErr);
      }

      try {
        storageService.save(this.uploadHistoryKey, records);
        logger.log('[文件管理] 💾 主数据保存完成');
      } catch (saveErr) {
        logger.error('[文件管理] ❌ 保存失败:', saveErr);
        // 尝试恢复备份
        try {
          const backup = storageService.get('imported_files_backup');
          if (backup) {
            const restored = JSON.parse(backup);
            storageService.save(this.uploadHistoryKey, restored);
            logger.log('[文件管理] 🔄 已从备份恢复数据');
          }
        } catch (restoreErr) {
          logger.error('[文件管理] ❌ 恢复备份也失败:', restoreErr);
        }
        return id; // 即使保存失败，也返回 ID（避免阻塞流程）
      }

      // 验证保存是否成功
      const saved = storageService.get(this.uploadHistoryKey, []);
      const isSuccess = saved.length === records.length;

      logger.log('[文件管理] ✅ 验证保存结果:', {
        savedCount: saved.length,
        expectedCount: records.length,
        match: isSuccess
      });

      if (!isSuccess) {
        logger.error('[文件管理] ❌ 保存验证失败！数据可能不完整');
        // 尝试从备份恢复
        try {
          const backup = storageService.get('imported_files_backup');
          if (backup) {
            const restored = JSON.parse(backup);
            storageService.save(this.uploadHistoryKey, restored);
            logger.log('[文件管理] 🔄 已从备份恢复数据');
          }
        } catch (restoreErr) {
          logger.error('[文件管理] ❌ 恢复备份失败:', restoreErr);
        }
      }

      return id;
    },

    updateUploadRecordStatus(status) {
      if (!this.currentUploadId) return;
      const records = storageService.get(this.uploadHistoryKey, []);
      const index = records.findIndex((item) => item.id === this.currentUploadId);
      if (index === -1) return;
      records[index] = {
        ...records[index],
        status,
        updatedAt: Date.now()
      };
      storageService.save(this.uploadHistoryKey, records);
    },

    // 12. Apple 智能进度动画控制
    startProgressAnimation() {
      // 防止重复启动导致多个 interval 叠加
      this.stopProgressAnimation();
      this.progressTimer = setInterval(() => {
        if (this.isLooping) {
          this.progressWidth += 2;
          if (this.progressWidth >= 100) {
            this.progressWidth = 0;
          }
        }
      }, 150);
    },

    // 13. 停止进度动画
    stopProgressAnimation() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
        this.progressWidth = 0;
      }
    },

    // ⭐⭐ v5.8 新增：启动批次内进度模拟 - TASK-001
    startBatchProgressSimulation() {
      // 清除旧的定时器
      this.stopBatchProgressSimulation();

      // 每200ms更新一次批次内进度
      this.progressSimulationTimer = setInterval(() => {
        if (!this.isLooping || this.isPaused) {
          this.stopBatchProgressSimulation();
          return;
        }

        // 模拟进度增长（从0到90%，留10%给实际完成）
        if (this.currentBatchProgress < 90) {
          // 使用非线性增长，开始快后面慢
          const increment = Math.max(1, Math.floor((90 - this.currentBatchProgress) / 10));
          this.currentBatchProgress = Math.min(90, this.currentBatchProgress + increment);
        }
      }, 200);
    },

    // ⭐⭐ v5.8 新增：停止批次内进度模拟 - TASK-001
    stopBatchProgressSimulation() {
      if (this.progressSimulationTimer) {
        clearInterval(this.progressSimulationTimer);
        this.progressSimulationTimer = null;
      }
    },

    // ⭐⭐ v5.8 新增：格式化文件大小 - TASK-001
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // ⭐⭐ v5.8 新增：格式化剩余时间 - TASK-001
    formatTimeLeft(seconds) {
      if (seconds <= 0) return '即将完成';
      if (seconds < 60) {
        return `剩余约 ${seconds} 秒`;
      } else {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `剩余约 ${minutes} 分 ${secs} 秒`;
      }
    },

    // ⭐ 14. 更新真实进度（v5.3 优化：改进时间预估算法）
    updateRealProgress() {
      // 计算真实进度百分比
      this.realProgress = Math.round((this.generatedCount / this.totalQuestionsLimit) * 100);

      // ⭐⭐ v5.3 优化：改进剩余时间预估算法（考虑首批和后续批次的时间差异）
      if (this.generatedCount > 0 && this.generationStartTime > 0) {
        const elapsed = Date.now() - this.generationStartTime;

        // 如果是第一批，记录首批耗时
        if (this.generatedCount === 1) {
          this.firstBatchTime = elapsed;
        }

        // 如果已经有多批数据，使用更精确的预估
        if (this.generatedCount > 1) {
          // 计算后续批次的平均耗时
          const laterBatchesTotalTime = elapsed - this.firstBatchTime;
          this.laterBatchAvgTime = laterBatchesTotalTime / (this.generatedCount - 1);

          // 预估剩余时间 = 剩余批次 * 后续批次平均耗时
          const remainingBatches = this.totalQuestionsLimit - this.generatedCount;
          this.estimatedTimeLeft = Math.round((this.laterBatchAvgTime * remainingBatches) / 1000);
        } else {
          // 只有第一批数据时，使用首批耗时作为基准
          const remainingBatches = this.totalQuestionsLimit - this.generatedCount;
          this.estimatedTimeLeft = Math.round((this.firstBatchTime * remainingBatches) / 1000);
        }
      }

      // 更新已生成题目总数
      this.totalQuestionsGenerated = this.generatedCount * this.batchQuestionCount;

      // 计算导入速度
      if (this.importStartTime > 0 && this.totalQuestionsGenerated > 0) {
        const elapsedSeconds = (Date.now() - this.importStartTime) / 1000;
        this.importSpeed = this.totalQuestionsGenerated / elapsedSeconds;
      }

      logger.log('[进度更新]', {
        realProgress: this.realProgress,
        estimatedTimeLeft: this.estimatedTimeLeft,
        totalQuestionsGenerated: this.totalQuestionsGenerated,
        importSpeed: this.importSpeed.toFixed(2)
      });
    }
  }
};
</script>

<style lang="scss" scoped>
/* --- 全局容器与背景 --- */
.apple-container {
  min-height: 100%;
  min-height: 100vh;
  background-color: var(--background);
  padding: 0 20px 20px;
  padding-bottom: calc(28px + constant(safe-area-inset-bottom));
  padding-bottom: calc(28px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  color: var(--text-primary);
}

/* --- 苹果质感自定义导航栏 --- */
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  /* 导航栏背景 */
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.navbar-status-bar {
  width: 100%;
}

.navbar-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-sizing: border-box;
}

.navbar-back-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
}

.navbar-back-btn:active {
  background: var(--bg-secondary);
  transform: scale(0.95);
}

.back-icon {
  font-size: 64rpx;
  font-weight: 300;
  color: var(--text-primary);
  line-height: 1;
  margin-left: -4px;
}

.navbar-title-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.navbar-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.41px;
  -webkit-font-smoothing: antialiased;
}

.navbar-placeholder {
  width: 44px;
  height: 44px;
}

/* --- 头部大标题 --- */
.page-header {
  margin-top: calc(constant(safe-area-inset-top) + 88px);
  margin-top: calc(env(safe-area-inset-top, 0px) + 88px);
  margin-bottom: 32px;
  padding: 0 8px;
}

.header-title {
  font-size: 68rpx;
  font-weight: 800;
  display: block;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
  color: var(--text-primary);
}

.header-subtitle {
  font-size: 34rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.header-note {
  margin-top: 16rpx;
  display: block;
  font-size: 28rpx;
  line-height: 1.8;
  color: var(--text-secondary);
}

/* --- 主体玻璃卡片 --- */
.main-glass-card {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 28rpx;
  padding: 24px;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
  position: relative;
  margin-bottom: 24px;
}

/* 状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  width: 100%;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bg-secondary);
  margin-right: 8px;
  transition: all 0.3s;
}

.status-dot.active {
  background: var(--success);
  box-shadow: var(--shadow-success);
}

.status-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

/* --- 操作区：上传按钮 --- */
.upload-trigger {
  min-height: 280px;
  background: var(--bg-card);
  border-radius: 24rpx;
  border: 4rpx dashed rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.upload-trigger:active {
  transform: scale(0.98);
  background: var(--apple-glass-card-bg);
}

.icon-circle {
  width: 56px;
  height: 56px;
  background: rgba(28, 176, 246, 0.12);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  border: none;
}

.icon-text {
  font-size: 56rpx;
}

.upload-main-text {
  font-size: 34rpx;
  font-weight: 800;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.upload-sub-text {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-top: 12rpx;
  line-height: 1.6;
  text-align: center;
  padding: 0 20rpx;
}

.upload-hint-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 16rpx;
  line-height: 1.6;
  text-align: center;
  padding: 0 20rpx;
}

/* --- 操作区：文件胶囊 --- */
.file-capsule {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.file-icon-box {
  width: 48px;
  height: 48px;
  background: rgba(28, 176, 246, 0.12);
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.file-info-col {
  flex: 1;
  overflow: hidden;
}

.fname-text {
  font-size: 32rpx;
  font-weight: 800;
  margin-bottom: 6px;
  display: block;
  color: var(--text-primary);
}

.fmeta-row {
  display: flex;
  align-items: center;
}

.meta-tag {
  font-size: 20rpx;
  padding: 6px 12px;
  background: var(--apple-glass-card-bg);
  border-radius: 999px;
  margin-right: 8px;
  font-weight: 700;
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.meta-size {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.close-btn-circle {
  width: 44px;
  height: 44px;
  background: var(--apple-glass-card-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* --- 底部悬浮按钮栏 --- */
.bottom-action-bar {
  padding: 24px;
  background: var(--bg-card);
  border-radius: 28rpx 28rpx 0 0;
  border-top: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.sub-row-flex {
  display: flex;
  margin-top: 16rpx;
}
.sub-row-flex > button + button,
.sub-row-flex > view + view,
.sub-row-flex > wd-button + wd-button {
  margin-left: 16rpx;
}

.action-row {
  display: flex;
  /* gap: 15px; -- replaced for Android WebView compat */
}

.main-row {
  margin-bottom: 15px;
}

/* Apple 风格按钮 */
.apple-btn {
  flex: 1;
  height: 56px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 800;
  border: none;
  transition: all 0.3s;
}

.apple-btn::after {
  border: none;
}

.apple-btn:active {
  transform: scale(0.97);
}

.primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.primary.disabled {
  opacity: 0.6;
  filter: grayscale(0.5);
  box-shadow: none;
}

.secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  height: 44px;
  font-size: 30rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.secondary::after {
  border: none;
}

.danger-ghost {
  background: var(--apple-glass-card-bg);
  color: var(--danger-red);
  height: 44px;
  font-size: 30rpx;
  border: 1px solid color-mix(in srgb, var(--danger) 28%, transparent);
}

.danger-ghost::after {
  border: none;
}

/* 通用工具类 */
.glass-morphism {
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bounce-in-up {
  animation: bounceInUp 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
}

@keyframes bounceInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.glow-effect {
  position: relative;
  overflow: hidden;
}

.glow-effect::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, var(--glow-light) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}

.glow-effect:active::after {
  opacity: 1;
}

/*  Apple 智能 Loading 样式 */
.ai-loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mask-dark);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}

.ai-card {
  width: 320px;
  height: 400px;
  border-radius: 32px;
  position: relative;
  overflow: hidden;
  background: var(--bg-card-dark);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-2xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: translateZ(0);
}

/* Apple 智能渐变背景 */
.apple-ai-gradient {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    225deg,
    var(--info-blue-alpha) 0%,
    var(--primary-light-alpha) 25%,
    var(--primary-alpha) 50%,
    var(--danger-light-alpha) 75%,
    var(--warning-alpha) 100%
  );
  filter: blur(50px);
  animation: rotateGradient 8s linear infinite;
}

/* Apple 智能发光效果 */
.apple-ai-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, var(--info-blue-alpha) 0%, transparent 70%);
  animation: pulseGlow 4s ease-in-out infinite;
}

@keyframes rotateGradient {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulseGlow {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.content-box {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 30px;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

/* Apple 智能进度指示器 */
.apple-ai-indicator {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.indicator-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1); /* fallback for Android */
  background: conic-gradient(transparent 0deg, var(--info-blue-alpha) 0deg 360deg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-progress {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1); /* fallback for Android */
  background: conic-gradient(var(--info-blue) 0deg, var(--info-light) 50deg, transparent 180deg 360deg);
  transform: translate(-50%, -50%) rotate(-90deg);
  -webkit-clip-path: circle(50% at 50% 50%);
  clip-path: circle(50% at 50% 50%);
  animation: progressPulse 2s ease-in-out infinite;
}

@keyframes progressPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.ai-star {
  font-size: 112rpx;
  z-index: 3;
  animation: starPulse 2s infinite ease-in-out;
  display: block;
  position: relative;
}

@keyframes starPulse {
  0% {
    opacity: 0.7;
    transform: scale(0.95);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.loading-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-main, var(--ds-color-text-primary));
  margin-bottom: 12px;
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.loading-step {
  font-size: 28rpx;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  font-weight: 500;
}

.loading-progress {
  font-size: 26rpx;
  color: var(--info-blue);
  margin-bottom: 32px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.soup-text {
  font-size: 32rpx;
  color: var(--text-secondary);
  font-style: italic;
  line-height: 1.6;
  min-height: 60px;
  transition: all 0.5s ease;
  opacity: 0.9;
  font-weight: 400;
  letter-spacing: 0.3px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.loading-actions {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.pause-banner {
  position: fixed;
  left: 20px;
  right: 20px;
  bottom: 120px;
  background: var(--bg-card-dark);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 12px; -- replaced for Android WebView compat */
  z-index: 9000;
}

.pause-info {
  display: flex;
  flex-direction: column;
  /* gap: 4px; -- replaced for Android WebView compat */
}

.pause-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main, var(--ds-color-text-primary));
}

.pause-desc {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* 自定义极速体验弹窗 */
.speed-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mask-dark);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px); /* 磨砂玻璃背景 */
  -webkit-backdrop-filter: blur(8px);
}

/* 弹窗主体 */
.speed-card {
  width: 300px;
  background: var(--bg-card-dark);
  border: 1px solid var(--border-glass);
  border-radius: 24px;
  padding: 30px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: var(--shadow-2xl);
}

/* 弹窗动画 */
.bounce-in {
  animation: bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.speed-icon-box {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--warning-light), var(--warning));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: var(--shadow-warning);
}

.speed-icon {
  font-size: 60rpx;
}

.speed-title {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--text-inverse);
  margin-bottom: 12px;
}

.speed-desc {
  font-size: 28rpx;
  color: var(--text-tertiary);
  line-height: 1.6;
  margin-bottom: 30px;
}

.speed-actions {
  width: 100%;
  display: flex;
  justify-content: space-between;
  /* gap: 15px; -- replaced for Android WebView compat */
}

/* 按钮升级 */
.glass-btn.ghost {
  background: var(--apple-glass-card-bg);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
  box-shadow: var(--apple-shadow-surface);
}

.glass-btn.ghost::after {
  border: none;
}

.glass-btn.shine {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  box-shadow: var(--cta-primary-shadow);
  border: 1px solid var(--cta-primary-border);
}

.glass-btn.shine::after {
  border: none;
}

.glass-btn.danger {
  background: var(--apple-glass-card-bg);
  color: var(--danger-red);
  border: 1px solid color-mix(in srgb, var(--danger) 28%, transparent);
  margin-left: 10px;
  box-shadow: var(--apple-shadow-surface);
}

.glass-btn.danger::after {
  border: none;
}

/* ⭐⭐ v5.2 新增：错误卡片样式 */
.error-card-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mask-dark);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.error-card {
  width: 300px;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid color-mix(in srgb, var(--danger) 34%, transparent);
  border-radius: 28px;
  padding: 30px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: var(--apple-shadow-floating);
}

.error-icon-box {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--danger-red), var(--danger-light));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: var(--shadow-danger);
}

.error-icon {
  font-size: 60rpx;
}

.error-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--danger-red);
  margin-bottom: 12px;
}

.error-desc {
  font-size: 28rpx;
  color: var(--text-tertiary);
  line-height: 1.6;
  margin-bottom: 30px;
}

.error-actions {
  width: 100%;
  display: flex;
  justify-content: space-between;
  /* gap: 15px; -- replaced for Android WebView compat */
}

.progress-wrapper {
  width: 100%;
  margin-bottom: 24px;
}

/* Final polish: import flow unified with Duolingo gamified design */
.apple-container {
  position: relative;
  background: var(--background);
  color: var(--text-primary);
}

.apple-container::before {
  content: '';
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 12%, rgba(28, 176, 246, 0.1) 0%, transparent 34%),
    radial-gradient(circle at 84% 10%, rgba(28, 176, 246, 0.06) 0%, transparent 24%);
}

.apple-container.dark-mode::before {
  background:
    radial-gradient(circle at 12% 12%, rgba(10, 132, 255, 0.2) 0%, transparent 34%),
    radial-gradient(circle at 84% 10%, rgba(95, 170, 255, 0.14) 0%, transparent 24%),
    radial-gradient(circle at 62% 82%, rgba(32, 83, 170, 0.15) 0%, transparent 32%);
}

.main-glass-card,
.bottom-action-bar,
.pause-banner,
.speed-card,
.error-card,
.ai-card {
  position: relative;
  z-index: 1;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  border-radius: 0;
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.navbar-back-btn {
  background: rgba(28, 176, 246, 0.12);
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.page-header,
.main-glass-card,
.bottom-action-bar,
.pause-banner {
  position: relative;
  z-index: 1;
}

.header-title,
.upload-main-text,
.fname-text,
.loading-title,
.speed-title {
  color: var(--text-primary);
}

.header-subtitle,
.header-note,
.status-text,
.upload-sub-text,
.meta-size,
.loading-step,
.pause-desc,
.speed-desc,
.error-desc,
.soup-text {
  color: var(--text-secondary);
}

.upload-trigger,
.file-capsule,
.secondary,
.danger-ghost,
.glass-btn.ghost,
.glass-btn.danger {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.upload-trigger {
  border-style: dashed;
}

.icon-circle,
.file-icon-box,
.close-btn-circle {
  background: rgba(28, 176, 246, 0.12);
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  color: var(--info);
}

.meta-tag {
  background: rgba(28, 176, 246, 0.12);
  border-color: rgba(28, 176, 246, 0.18);
}

.secondary,
.danger-ghost {
  color: var(--text-primary);
}

.glass-btn {
  min-width: 0;
  height: 88rpx;
  padding: 0 26rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 620;
}

.glass-btn::after {
  border: none;
}

.glass-btn.shine,
.primary {
  background: var(--info);
  color: var(--text-inverse);
  border: none;
  box-shadow: 0 8rpx 0 #0e8ac0;
}

.glass-btn.shine:active,
.primary:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #0e8ac0;
}

.glass-btn.danger,
.danger-ghost {
  color: var(--danger);
}

.glow-effect::after {
  top: 0;
  left: -80%;
  width: 70%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34), transparent);
  opacity: 0;
  transform: skewX(-18deg);
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
}

.glow-effect:active::after {
  opacity: 1;
  transform: translateX(240%) skewX(-18deg);
}

.ai-loading-mask,
.speed-modal-mask,
.error-card-mask {
  background: var(--overlay);
}

.apple-container.dark-mode .ai-loading-mask,
.apple-container.dark-mode .speed-modal-mask,
.apple-container.dark-mode .error-card-mask {
  background: rgba(3, 8, 14, 0.52);
}

.ai-card {
  width: 640rpx;
  max-width: calc(100vw - 48rpx);
  min-height: 760rpx;
  height: auto;
  border-radius: 38rpx;
}

.apple-ai-gradient {
  top: -30%;
  left: -30%;
  width: 160%;
  height: 160%;
  background:
    radial-gradient(circle at 20% 20%, rgba(107, 208, 150, 0.36) 0%, transparent 34%),
    radial-gradient(circle at 80% 24%, rgba(255, 255, 255, 0.34) 0%, transparent 24%),
    radial-gradient(circle at 56% 76%, rgba(72, 190, 128, 0.2) 0%, transparent 34%);
  filter: blur(56px);
  animation: importAuroraShift 10s ease-in-out infinite;
}

.apple-container.dark-mode .apple-ai-gradient {
  background:
    radial-gradient(circle at 20% 20%, rgba(10, 132, 255, 0.3) 0%, transparent 34%),
    radial-gradient(circle at 80% 24%, rgba(95, 170, 255, 0.22) 0%, transparent 24%),
    radial-gradient(circle at 56% 76%, rgba(32, 83, 170, 0.18) 0%, transparent 34%);
}

.apple-ai-glow {
  background: linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 46%);
  animation: none;
}

@keyframes importAuroraShift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.86;
  }

  50% {
    transform: translate3d(12rpx, -12rpx, 0) scale(1.06);
    opacity: 1;
  }
}

.loading-progress {
  color: var(--info);
}

.pause-banner {
  bottom: 138px;
  border-radius: 28rpx;
}

.speed-card,
.error-card {
  width: 640rpx;
  max-width: calc(100vw - 56rpx);
  border-radius: 36rpx;
}

.speed-icon-box,
.error-icon-box {
  box-shadow: none;
  border: 1px solid transparent;
}

.speed-icon-box {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  border-color: color-mix(in srgb, var(--success) 18%, transparent);
  color: var(--success-dark);
}

.error-icon-box {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--danger) 20%, transparent);
  color: var(--danger);
}

.error-title,
.pause-title {
  color: var(--text-primary);
}
</style>
