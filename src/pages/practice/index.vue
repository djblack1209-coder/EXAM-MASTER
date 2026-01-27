<template>
  <view class="practice-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 -->
    <view class="top-nav">
      <text class="nav-title">刷题中心</text>
      <view class="nav-actions">
        <!-- 移除垃圾桶图标，避免与微信原生胶囊按钮重叠 -->
      </view>
    </view>

    <!-- 骨架屏加载状态 -->
    <view v-if="isPageLoading" class="skeleton-container">
      <view class="skeleton-status-card skeleton-animate"></view>
      <view class="skeleton-actions">
        <view class="skeleton-btn skeleton-animate"></view>
        <view class="skeleton-btn skeleton-animate"></view>
      </view>
      <view class="skeleton-import-card skeleton-animate"></view>
      <view class="skeleton-menu">
        <view class="skeleton-menu-item skeleton-animate" v-for="i in 5" :key="i"></view>
      </view>
    </view>

    <!-- 状态卡片 -->
    <view class="status-card" :class="{ 'empty-state': !hasBank }" v-if="!isPageLoading">
      <!-- 有题库状态 -->
      <div v-if="hasBank" class="status-content">
        <div class="status-icon">
          <image class="icon-image" src="/static/icons/practice/icon-library.png" mode="aspectFit" :style="isDark ? 'filter: brightness(0) invert(1) opacity(0.9);' : ''"></image>
        </div>
        <div class="status-info">
          <h3 class="status-title">题库就绪</h3>
          <p class="status-desc">当前已收录 {{ totalQuestions }} 道真题</p>
        </div>
        <view class="status-actions">
          <view class="manage-btn" @tap="showQuizManage">
            <image class="manage-icon-img" src="/static/icons/practice/icon-settings.png" mode="aspectFit"></image>
            <text class="manage-text">题库管理</text>
          </view>
        </view>
      </div>

      <!-- 空状态 - 居中显示 -->
      <div v-else class="empty-state-content" @tap="chooseImportSource">
        <div class="empty-icon">
          <text class="empty-icon-emoji">📚</text>
        </div>
        <h3 class="empty-title">题库空空如也</h3>
        <p class="empty-desc">导入学习资料，AI 为您智能生成专属题库</p>
        <view class="empty-action">
          <text class="action-icon-emoji">📤</text>
          <text class="action-text">点击导入资料</text>
        </view>
      </div>
    </view>

    <!-- 题库生成进度条 -->
    <view class="generation-progress-bar" v-if="isGeneratingQuestions && !isPageLoading">
      <view class="progress-info">
        <text class="progress-label">正在生成题库</text>
        <text class="progress-text">{{ generationProgress }}%</text>
      </view>
      <view class="progress-bar-wrapper">
        <view class="progress-bar-bg">
          <view class="progress-bar-fill" :style="{ width: generationProgress + '%' }"></view>
        </view>
      </view>
      <view class="progress-actions">
        <button class="pause-btn-small" @tap="pauseGeneration">暂停</button>
      </view>
    </view>

    <!-- 主要操作区 -->
    <div class="main-actions" v-if="!isPageLoading">
      <!-- 开始刷题按钮 -->
      <button v-if="hasBank" class="primary-btn" @tap="goPractice">
        <image class="btn-icon-img" src="/static/icons/practice/icon-book.png" mode="aspectFit"></image>
        <text class="btn-text">开始刷题</text>
      </button>

      <!-- PK对战入口 -->
      <button v-if="hasBank" class="secondary-btn" @tap="goBattle">
        <image class="btn-icon-img" src="/static/icons/practice/icon-battle.png" mode="aspectFit"></image>
        <text class="btn-text">PK 对战</text>
      </button>

      <!-- 导入资料卡片 -->
      <div class="import-card" @tap="chooseImportSource">
        <div class="import-icon">
          <text class="import-icon-emoji">📤</text>
        </div>
        <div class="import-info">
          <h3 class="import-title">导入学习资料</h3>
          <p class="import-desc">AI 智能分析 · 即刻出题</p>
        </div>
        <div class="import-arrow">
          <text class="arrow">›</text>
        </div>
      </div>
    </div>

    <view class="pause-banner" v-if="isPaused">
      <view class="pause-info">
        <text class="pause-title">上传任务已暂停</text>
        <text class="pause-desc">可随时继续生成题库</text>
      </view>
      <button class="pause-resume-btn" @tap="resumeGeneration">继续生成</button>
    </view>

    <!-- 功能菜单 -->
    <div class="feature-menu" v-if="!isPageLoading">
      <!-- 文件管理 -->
      <div class="menu-item" @tap="goFileManager">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-folder.png" mode="aspectFit"></image>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">文件管理</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow">›</text>
        </div>
      </div>

      <!-- AI导师 -->
      <div class="menu-item" @tap="goAITutor">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-robot.png" mode="aspectFit" :style="isDark ? 'filter: brightness(0) invert(1) opacity(0.9);' : ''"></image>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">AI导师</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow">›</text>
        </div>
      </div>

      <!-- 错题本 -->
      <div class="menu-item" @tap="goMistake">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-error.png" mode="aspectFit"></image>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">错题本</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow">›</text>
        </div>
      </div>

      <!-- 排行榜 -->
      <div class="menu-item" @tap="goRank">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-ranking.png" mode="aspectFit"></image>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">学霸排行榜</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow">›</text>
        </div>
      </div>

      <!-- 学习进度 -->
      <div class="menu-item">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-check.png" mode="aspectFit"></image>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">总学习进度</h3>
        </div>
        <div class="progress-info">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <text class="progress-text">{{ progressPercent }}%</text>
        </div>
      </div>
    </div>

    <!-- AI 加载遮罩 -->
    <view class="ai-loading-mask" v-if="showMask">
      <div class="loading-card">
        <div class="apple-ai-loading">
          <!-- Apple AI 解锁样式的动画 -->
          <div class="apple-ai-ring">
            <div class="apple-ai-pulse"></div>
          </div>
          <text class="apple-ai-icon">✨</text>
        </div>
        <div class="loading-content">
          <h3 class="loading-title">{{ fileName ? '正在研读资料...' : 'AI 准备中...' }}</h3>
          <div class="apple-ai-progress">
            <div class="apple-ai-progress-bar">
              <div class="apple-ai-progress-fill"
                :style="{ width: (generatedCount / totalQuestionsLimit) * 100 + '%' }"></div>
            </div>
            <p class="loading-step">
              {{ generatedCount === 0 ? '分析文档结构' : `已生成 ${getGeneratedQuestionCount()} 题 / 目标 ${totalQuestionsLimit *
                batchQuestionCount}` }}
            </p>
          </div>
          <p class="inspiration-text">"{{ currentSoup }}"</p>
          <view class="loading-actions">
            <button class="pause-btn" @tap="pauseGeneration">暂停生成</button>
          </view>
        </div>
      </div>
    </view>

    <!-- 极速体验弹窗 -->
    <view class="speed-modal-mask" v-if="showSpeedModal">
      <div class="speed-card">
        <div class="speed-content">
          <text class="speed-icon">⚡️</text>
          <h3 class="speed-title">极速体验就绪</h3>
          <p class="speed-desc">前 5 道题已生成！您可以立即开始，AI 将在后台静默为您补充剩余题目。</p>
          <button class="primary-btn" @tap="closeSpeedModalAndPlay">立即开始</button>
        </div>
      </div>
    </view>

    <!-- 题库管理弹窗 -->
    <view class="quiz-manage-modal" v-if="showQuizManageModal">
      <view class="modal-bg" @tap="closeQuizManage"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">题库管理</text>
          <view class="modal-close" @tap="closeQuizManage">
            <text class="modal-close-icon">×</text>
          </view>
        </view>
        <view class="modal-body">
          <view class="manage-info">
            <text class="info-text">当前题库共有 {{ totalQuestions }} 道题目</text>
            <text class="info-sub">清空后需重新导入资料生成</text>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn secondary" @tap="closeQuizManage">取消</button>
          <button class="modal-btn danger" @tap="clearQuizBank">清空题库</button>
        </view>
      </view>
    </view>
    
    <!-- ✅ 检查点2.2：断点恢复弹窗 -->
    <resume-practice-modal
      :visible="showResumeModal"
      :draftInfo="draftInfo"
      type="quiz"
      @resume="handleResumePractice"
      @restart="handleRestartPractice"
    />

    <!-- 底部导航栏 -->
    <custom-tabbar :activeIndex="1" :isDark="isDark"></custom-tabbar>
  </view>
</template>

<script>
import CustomTabbar from '../../components/layout/custom-tabbar/custom-tabbar.vue'
import ResumePracticeModal from '../../components/common/ResumePracticeModal.vue'
import { storageService } from '../../services/storageService.js'
import { lafService } from '../../services/lafService.js'
import { getApiKey } from '../../../common/config.js'
import { requireLogin } from '../../utils/auth/loginGuard.js'
// ✅ 检查点2.2：导入草稿检测器
import { detectUnfinishedPractice, clearDraft } from '../../utils/practice/draft-detector.js'
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '../../utils/analytics/event-bus-analytics.js'
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

export default {
  components: {
    CustomTabbar,
    ResumePracticeModal
  },
  data() {
    return {
      // 页面状态
      hasBank: false,
      totalQuestions: 0,
      progressPercent: 0,
      isDark: false,
      isPageLoading: true, // 页面初始加载状态

      // AI 引擎状态
      fileName: '',
      fullFileContent: '',
      readOffset: 0,
      chunkSize: 1000,
      generatedCount: 0,
      totalQuestionsLimit: 10,
      isLooping: false,
      isPaused: false,
      showMask: false,
      showSpeedModal: false,
      isRequestInFlight: false,
      batchQuestionCount: 5,
      uploadHistoryKey: 'imported_files',
      currentUploadSource: '',
      currentUploadId: '',

      // 题库生成进度
      isGeneratingQuestions: false,
      generationProgress: 0,
      progressTimer: null,
      showQuizManageModal: false,
      
      // ✅ 检查点2.2：断点恢复弹窗状态
      showResumeModal: false,
      draftInfo: null,
      
      // 防重复点击
      isNavigating: false,

      // 励志语录
      currentSoup: '',
      soupList: [
        "星光不问赶路人，时光不负有心人。",
        "行百里者半九十，坚持就是胜利！",
        "功不唐捐，每一份努力都有意义。",
        "顶峰相见，我们在更高处相遇。"
      ],
      soupTimer: null
    }
  },
  onShow() {
    // 隐藏系统原生 TabBar
    uni.hideTabBar({
      animation: false
    });

    // 每次显示页面时重新读取主题状态
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';
    logger.log('[practice] 🎨 onShow 刷新主题:', savedTheme, 'isDark:', this.isDark);

    this.refreshBankStatus();
    this.checkGenerationStatus();
    
    // ✅ 检查点2.2：检测未完成的练习
    this.checkUnfinishedPractice();

    // 恢复后台生成
    if (this.isLooping && this.generatedCount < this.totalQuestionsLimit && !this.isRequestInFlight) {
      setTimeout(() => {
        this.generateNextBatch();
      }, 500);
    }
  },
  onLoad() {
    // 初始化主题
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';
    logger.log('[practice] 🎨 初始化主题:', savedTheme, 'isDark:', this.isDark);

    // 监听全局主题更新事件
    uni.$on('themeUpdate', (mode) => {
      this.isDark = mode === 'dark';
      logger.log('[practice] 🎨 主题更新:', mode, 'isDark:', this.isDark);
    });
  },
  onUnload() {
    // 清理定时器和事件监听
    if (this.soupTimer) {
      clearInterval(this.soupTimer);
      this.soupTimer = null;
    }
    uni.$off('themeUpdate');
  },
  methods: {
    refreshBankStatus() {
      this.isPageLoading = true;
      logger.log('[刷题中心] 🔍 开始刷新题库状态');

      // 同时使用两种方式读取，确保兼容性
      let bankFromStorage = uni.getStorageSync('v30_bank') || [];
      let bankFromService = storageService.get('v30_bank', []);

      // 如果主数据为空，尝试从备份恢复
      if (bankFromStorage.length === 0 && bankFromService.length === 0) {
        logger.warn('[刷题中心] ⚠️ 题库数据为空，尝试从备份恢复...');
        let restored = false;

        // 尝试从多个备份源恢复（包括 uniStorage 和 storageService）
        const backupKeys = [
          'v30_bank_backup',           // 正常备份
          'v30_bank_backup_before_clear' // 清空前备份
        ];

        // 诊断：检查所有备份源的状态
        logger.log('[刷题中心] 🔍 诊断备份源状态:');
        for (const backupKey of backupKeys) {
          try {
            const backupFromUni = uni.getStorageSync(backupKey);
            const backupFromService = storageService.get(backupKey, null);

            logger.log(`  - ${backupKey}:`, {
              uniStorage: backupFromUni ? (typeof backupFromUni === 'string' ? '字符串' : Array.isArray(backupFromUni) ? `数组(${backupFromUni.length})` : typeof backupFromUni) : '不存在',
              storageService: backupFromService ? (Array.isArray(backupFromService) ? `数组(${backupFromService.length})` : typeof backupFromService) : '不存在'
            });

            // 尝试从 uniStorage 恢复
            if (backupFromUni) {
              try {
                let restoredData = null;

                // 处理不同格式的备份数据
                if (typeof backupFromUni === 'string') {
                  // 如果是字符串，尝试解析 JSON
                  restoredData = JSON.parse(backupFromUni);
                } else if (Array.isArray(backupFromUni)) {
                  // 如果已经是数组，直接使用
                  restoredData = backupFromUni;
                }

                if (Array.isArray(restoredData) && restoredData.length > 0) {
                  logger.log(`[刷题中心] 🔄 从备份恢复题库数据 (${backupKey} - uniStorage):`, restoredData.length, '道题');
                  uni.setStorageSync('v30_bank', restoredData);
                  storageService.save('v30_bank', restoredData);
                  bankFromStorage = restoredData;
                  bankFromService = restoredData;
                  restored = true;
                  uni.showToast({
                    title: `已从备份恢复 ${restoredData.length} 道题`,
                    icon: 'success',
                    duration: 2000
                  });
                  break; // 找到一个有效的备份就停止
                }
              } catch (parseErr) {
                logger.warn(`[刷题中心] ⚠️ 解析备份失败 (${backupKey} - uniStorage):`, parseErr);
              }
            }

            // 如果 uniStorage 恢复失败，尝试从 storageService 恢复
            if (!restored && backupFromService) {
              try {
                let restoredData = null;

                if (typeof backupFromService === 'string') {
                  restoredData = JSON.parse(backupFromService);
                } else if (Array.isArray(backupFromService)) {
                  restoredData = backupFromService;
                }

                if (Array.isArray(restoredData) && restoredData.length > 0) {
                  logger.log(`[刷题中心] 🔄 从备份恢复题库数据 (${backupKey} - storageService):`, restoredData.length, '道题');
                  uni.setStorageSync('v30_bank', restoredData);
                  storageService.save('v30_bank', restoredData);
                  bankFromStorage = restoredData;
                  bankFromService = restoredData;
                  restored = true;
                  uni.showToast({
                    title: `已从备份恢复 ${restoredData.length} 道题`,
                    icon: 'success',
                    duration: 2000
                  });
                  break;
                }
              } catch (parseErr) {
                logger.warn(`[刷题中心] ⚠️ 解析备份失败 (${backupKey} - storageService):`, parseErr);
              }
            }
          } catch (restoreErr) {
            logger.warn(`[刷题中心] ⚠️ 恢复备份失败 (${backupKey}):`, restoreErr);
          }
        }

        if (!restored) {
          logger.warn('[刷题中心] ❌ 所有备份都不可用，数据已丢失');
          logger.log('[刷题中心] 💡 建议：请重新导入题库数据');
        }
      }

      logger.log('[刷题中心] 📚 题库读取结果:', {
        storageService: bankFromService.length,
        uniStorage: bankFromStorage.length,
        match: bankFromService.length === bankFromStorage.length
      });

      // 优先使用 storageService，如果为空则使用 uni.getStorageSync
      const bank = bankFromService.length > 0 ? bankFromService : bankFromStorage;

      this.hasBank = bank.length > 0;
      this.totalQuestions = bank.length;

      logger.log('[刷题中心] ✅ 题库状态更新:', {
        hasBank: this.hasBank,
        totalQuestions: this.totalQuestions
      });

      // 计算学习进度
      const userAnswers = storageService.get('v30_user_answers', {});
      const doneCount = Object.keys(userAnswers).length;
      this.progressPercent = bank.length > 0 ? Math.round((doneCount / bank.length) * 100) : 0;
      
      this.isPageLoading = false;
    },

    goPractice() {
      // 防重复点击
      if (this.isNavigating) return;
      this.isNavigating = true;
      
      requireLogin(() => {
        if (!this.hasBank) {
          this.isNavigating = false;
          return uni.showToast({ title: '请先导入题库', icon: 'none' });
        }
        // ✅ 检查点 5.1: 追踪"开始刷题"按钮点击
        analytics.track('button_click', {
          buttonName: '开始刷题',
          page: 'practice/index',
          questionCount: this.totalQuestions
        });
        uni.navigateTo({ 
          url: '/pages/practice/do-quiz',
          complete: () => {
            // 延迟解锁，防止快速返回后再次点击
            setTimeout(() => { this.isNavigating = false; }, 500);
          }
        });
      }, {
        message: '请先登录后开始刷题',
        loginUrl: '/pages/settings/index',
        onCancel: () => { this.isNavigating = false; }
      });
    },
    
    // ✅ 检查点2.2：检测未完成的练习
    checkUnfinishedPractice() {
      const draft = detectUnfinishedPractice();
      if (draft && draft.currentIndex > 0) {
        this.draftInfo = draft;
        this.showResumeModal = true;
        logger.log('[practice] 📝 检测到未完成的练习:', draft);
      }
    },
    
    // ✅ 检查点2.2：处理恢复练习
    handleResumePractice(draftInfo) {
      this.showResumeModal = false;
      logger.log('[practice] ▶️ 恢复练习:', draftInfo);
      // 跳转到答题页面，答题页面会自动恢复进度
      uni.navigateTo({ url: '/pages/practice/do-quiz' });
    },
    
    // ✅ 检查点2.2：处理重新开始
    handleRestartPractice() {
      this.showResumeModal = false;
      clearDraft('quiz');
      logger.log('[practice] 🔄 重新开始练习');
      uni.navigateTo({ url: '/pages/practice/do-quiz' });
    },

    goBattle() {
      // 防重复点击
      if (this.isNavigating) return;
      this.isNavigating = true;
      
      requireLogin(() => {
        if (!this.hasBank) {
          this.isNavigating = false;
          return uni.showToast({ title: '请先导入题库', icon: 'none' });
        }
        uni.navigateTo({ 
          url: '/pages/practice/pk-battle',
          complete: () => {
            setTimeout(() => { this.isNavigating = false; }, 500);
          }
        });
      }, {
        message: '请先登录后参与PK对战',
        loginUrl: '/pages/settings/index',
        onCancel: () => { this.isNavigating = false; }
      });
    },

    goFileManager() {
      uni.navigateTo({ url: '/pages/practice/file-manager' });
    },

    goAITutor() {
      uni.navigateTo({ url: '/pages/chat/index' });
    },

    goMistake() {
      uni.navigateTo({ url: '/pages/mistake/index' });
    },

    goRank() {
      uni.navigateTo({ url: '/pages/practice/rank' });
    },

    chooseImportSource() {
      requireLogin(() => {
        uni.showActionSheet({
          itemList: ['本地文件', '聊天记录', '百度网盘'],
          success: (res) => {
            if (res.tapIndex === 0) this.chooseLocalFile();
            if (res.tapIndex === 1) this.importFromChat();
            if (res.tapIndex === 2) this.importFromBaidu();
          }
        });
      }, {
        message: '请先登录后上传资料',
        loginUrl: '/pages/settings/index'
      });
    },

    chooseLocalFile() {
      this.currentUploadSource = 'local';
      // #ifdef MP-WEIXIN
      if (typeof wx !== 'undefined' && wx.chooseMessageFile) {
        wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['pdf', 'doc', 'docx', 'txt', 'md', 'json'],
          success: (res) => {
            this.handleUpload(res.tempFiles[0]);
          },
          fail: (e) => {
            logger.log('文件选择取消', e);
          }
        });
      } else {
        uni.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['pdf', 'doc', 'docx', 'txt', 'md'],
          success: (res) => {
            this.handleUpload(res.tempFiles[0]);
          }
        });
      }
      // #endif

      // #ifndef MP-WECHAT
      if (typeof uni.chooseFile !== 'undefined') {
        uni.chooseFile({
          count: 1,
          extension: ['.pdf', '.doc', '.docx', '.txt', '.md', '.json'],
          success: (res) => {
            this.handleUpload(res.tempFiles[0]);
          },
          fail: (err) => {
            // 静默失败，不显示错误提示
            logger.log('文件选择取消或失败', err);
          }
        });
      } else {
        // 移除弹窗提示，静默处理
        logger.log('当前环境不支持文件选择');
      }
      // #endif
    },

    importFromChat() {
      this.currentUploadSource = 'chat';
      this.getClipboardText().then((text) => {
        if (!text) {
          uni.showToast({ title: '请先复制聊天记录', icon: 'none' });
          return;
        }
        this.fileName = `聊天记录_${this.formatDate()}.txt`;
        this.fullFileContent = text;
        this.readOffset = 0;
        this.generatedCount = 0;
        this.currentUploadId = this.saveUploadRecord({
          name: this.fileName,
          size: Math.round(text.length / 1024),
          source: '聊天记录'
        });
        this.startAI();
      });
    },

    importFromBaidu() {
      this.currentUploadSource = 'baidu';
      this.getClipboardText().then((text) => {
        if (!text) {
          uni.showToast({ title: '请先复制网盘链接或文本', icon: 'none' });
          return;
        }
        this.fileName = `百度网盘_${this.formatDate()}`;
        if (text.length > 400) {
          this.fullFileContent = text;
        } else {
          this.fullFileContent = '';
        }
        this.readOffset = 0;
        this.generatedCount = 0;
        this.currentUploadId = this.saveUploadRecord({
          name: this.fileName,
          size: this.fullFileContent ? Math.round(this.fullFileContent.length / 1024) : 0,
          source: '百度网盘'
        });
        if (!this.fullFileContent) {
          uni.showToast({ title: '已记录链接，基于主题生成', icon: 'none' });
        }
        this.startAI();
      });
    },

    getClipboardText() {
      return new Promise((resolve) => {
        uni.getClipboardData({
          success: (res) => resolve((res.data || '').trim()),
          fail: () => resolve('')
        });
      });
    },

    formatDate() {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const h = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      return `${y}${m}${d}_${h}${mm}`;
    },

    saveUploadRecord(record) {
      const records = storageService.get(this.uploadHistoryKey, []);
      const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      records.unshift({
        id,
        name: record.name,
        size: record.size || 0,
        date: new Date().toISOString().slice(0, 10),
        source: record.source,
        status: 'ready'
      });
      storageService.save(this.uploadHistoryKey, records);
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

    handleUpload(file) {
      this.fileName = file.name;
      const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
      this.fullFileContent = '';
      this.readOffset = 0;
      this.generatedCount = 0;
      if (!['pdf', 'doc', 'docx', 'txt', 'md', 'json'].includes(ext)) {
        uni.showToast({ title: '暂不支持该格式', icon: 'none' });
        return;
      }
      this.currentUploadId = this.saveUploadRecord({
        name: this.fileName,
        size: Math.round((file.size || 0) / 1024),
        source: '本地文件'
      });

      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) { logger.warn('Vibration feedback failed', e); }

      if (['pdf', 'doc', 'docx'].includes(ext)) {
        // PDF 模式：仅使用文件名，立即启动，无需延迟
        this.startAI();
      } else {
        // 文本模式：读取内容，优化加载速度
        const fs = uni.getFileSystemManager();
        fs.readFile({
          filePath: file.path || file.tempFilePath,
          encoding: 'utf8',
          success: (res) => {
            this.fullFileContent = res.data;
            // 立即启动，无需延迟和弹窗
            this.startAI();
          },
          fail: () => {
            this.fullFileContent = '';
            // 即使失败也启动，使用文件名
            this.startAI();
          }
        });
      }
    },

    // AI 启动逻辑
    startAI() {
      if (!this.fullFileContent && !this.fileName) {
        return uni.showToast({ title: '请先导入资料', icon: 'none' });
      }

      this.isLooping = true;
      this.isPaused = false;
      this.showMask = true;
      this.readOffset = 0;
      this.generatedCount = 0;
      this.startSoupRotation();
      this.updateUploadRecordStatus('generating');
      this.generateNextBatch();
    },

    async generateNextBatch() {
      if (!this.isLooping || this.isPaused || this.isRequestInFlight) return;
      if (this.generatedCount >= this.totalQuestionsLimit) {
        this.finishGeneration();
        return;
      }

      this.isRequestInFlight = true;
      const batchSize = this.batchQuestionCount;

      let chunk = "";
      if (this.fullFileContent) {
        chunk = this.fullFileContent.substring(this.readOffset, this.readOffset + this.chunkSize);
        if (this.readOffset >= this.fullFileContent.length) this.readOffset = 0;
      }

      // 构建出题 Prompt
      const prompt = `考研出题专家。资料片段："""${chunk || "主题:" + this.fileName}"""。出${batchSize}道单选题。JSON数组返回。无Markdown。`;

      try {
        // ✅ 安全修复：使用后端代理调用 AI（action: 'generate_questions'）
        logger.log('[practice] 🤖 调用后端代理生成题目...');

        const res = await lafService.proxyAI('generate_questions', {
          content: chunk || this.fileName,
          questionCount: batchSize
        });

        // 处理返回结果
        if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices.length > 0) {
          let content = res.data.choices[0].message.content;

          // 清理 JSON 格式（移除 Markdown 代码块标记）
          content = content.replace(/```json/g, '').replace(/```/g, '').trim();

          try {
            const newQs = JSON.parse(content);

            // 验证题目格式
            if (Array.isArray(newQs) && newQs.length > 0) {
              // 标准化题目格式：统一字段名
              const normalizedQs = newQs.map(q => {
                // 统一 answer 字段（支持 answer、correct_answer、correctAnswer）
                const answer = q.answer || q.correct_answer || q.correctAnswer || '';
                // 统一 question 字段
                const question = q.question || q.title || q.content || '';
                // 统一 options 字段（确保是数组）
                let options = q.options || [];
                if (!Array.isArray(options)) {
                  options = [];
                }
                // 统一 category 字段
                const category = q.category || q.subject || '未分类';
                // 统一 desc/analysis 字段
                const desc = q.desc || q.analysis || q.explanation || '';

                return {
                  question: question,
                  options: options,
                  answer: answer.toUpperCase().charAt(0), // 统一为大写字母 A/B/C/D
                  category: category,
                  desc: desc,
                  type: q.type || '单选',
                  // 保留原始数据
                  ...q
                };
              });

              // 过滤有效题目：必须有 question、options（至少4个）、answer
              const validQs = normalizedQs.filter(q =>
                q.question &&
                q.question.trim().length > 0 &&
                q.options &&
                Array.isArray(q.options) &&
                q.options.length >= 4 &&
                q.answer &&
                ['A', 'B', 'C', 'D'].includes(q.answer)
              );

              if (validQs.length > 0) {
                const old = storageService.get('v30_bank', []);
                const merged = [...old, ...validQs];

                // 保存前先创建备份
                try {
                  const backup = JSON.stringify(merged);
                  uni.setStorageSync('v30_bank_backup', backup);
                  logger.log('[practice] 💾 已创建题库备份:', merged.length, '道题');
                } catch (backupErr) {
                  logger.warn('[practice] ⚠️ 备份失败（不影响主流程）:', backupErr);
                }

                // 保存主数据
                storageService.save('v30_bank', merged);

                // 验证保存是否成功
                const saved = storageService.get('v30_bank', []);
                const isSuccess = saved.length === merged.length;
                logger.log('[practice] ✅ 保存验证:', {
                  savedCount: saved.length,
                  expectedCount: merged.length,
                  match: isSuccess
                });

                if (!isSuccess) {
                  logger.error('[practice] ❌ 保存验证失败！尝试从备份恢复...');
                  try {
                    const backup = uni.getStorageSync('v30_bank_backup');
                    if (backup) {
                      const restored = JSON.parse(backup);
                      storageService.save('v30_bank', restored);
                      logger.log('[practice] 🔄 已从备份恢复数据');
                    }
                  } catch (restoreErr) {
                    logger.error('[practice] ❌ 恢复备份失败:', restoreErr);
                  }
                }

                this.refreshBankStatus();
                this.updateGenerationProgress();
                logger.log(`[practice] 成功生成 ${validQs.length} 道题目（共 ${merged.length} 题）`);

                // 成功生成题目后更新计数
                this.generatedCount++;
                this.readOffset += this.chunkSize;

                // 极速体验逻辑
                if (this.generatedCount === 1) {
                  this.showMask = false;
                  this.showSpeedModal = true;
                }
              } else {
                logger.warn('[practice] 生成的题目格式无效，原始数据:', newQs);
                // 即使格式无效，也更新计数避免卡死
                this.generatedCount++;
                this.readOffset += this.chunkSize;
              }
            } else {
              logger.warn('[practice] AI 返回的不是数组格式');
              // 格式错误时也更新计数
              this.generatedCount++;
              this.readOffset += this.chunkSize;
            }
          } catch (parseError) {
            logger.error('[practice] JSON 解析失败:', parseError, '原始内容:', content);
            // 尝试修复常见的 JSON 格式问题
            try {
              // 如果内容被包裹在字符串中，尝试提取
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const newQs = JSON.parse(jsonMatch[0]);
                if (Array.isArray(newQs) && newQs.length > 0) {
                  // 标准化题目格式（与主逻辑保持一致）
                  const normalizedQs = newQs.map(q => {
                    const answer = (q.answer || q.correct_answer || q.correctAnswer || '').toString().toUpperCase().charAt(0);
                    const question = q.question || q.title || q.content || '';
                    let options = q.options || [];
                    if (!Array.isArray(options)) options = [];
                    const category = q.category || q.subject || '未分类';
                    const desc = q.desc || q.analysis || q.explanation || '';

                    return {
                      question: question,
                      options: options,
                      answer: answer,
                      category: category,
                      desc: desc,
                      type: q.type || '单选',
                      ...q
                    };
                  });

                  // 过滤有效题目
                  const validQs = normalizedQs.filter(q =>
                    q.question &&
                    q.question.trim().length > 0 &&
                    q.options &&
                    Array.isArray(q.options) &&
                    q.options.length >= 4 &&
                    q.answer &&
                    ['A', 'B', 'C', 'D'].includes(q.answer)
                  );

                  if (validQs.length > 0) {
                    const old = storageService.get('v30_bank', []);
                    const merged = [...old, ...validQs];

                    // 保存前先创建备份
                    try {
                      const backup = JSON.stringify(merged);
                      uni.setStorageSync('v30_bank_backup', backup);
                      logger.log('[practice] 💾 已创建题库备份（二次解析）:', merged.length, '道题');
                    } catch (backupErr) {
                      logger.warn('[practice] ⚠️ 备份失败（不影响主流程）:', backupErr);
                    }

                    // 保存主数据
                    storageService.save('v30_bank', merged);

                    // 验证保存是否成功
                    const saved = storageService.get('v30_bank', []);
                    const isSuccess = saved.length === merged.length;
                    if (!isSuccess) {
                      logger.error('[practice] ❌ 保存验证失败！尝试从备份恢复...');
                      try {
                        const backup = uni.getStorageSync('v30_bank_backup');
                        if (backup) {
                          const restored = JSON.parse(backup);
                          storageService.save('v30_bank', restored);
                          logger.log('[practice] 🔄 已从备份恢复数据');
                        }
                      } catch (restoreErr) {
                        logger.error('[practice] ❌ 恢复备份失败:', restoreErr);
                      }
                    }

                    this.refreshBankStatus();
                    this.updateGenerationProgress();
                    logger.log(`[practice] 二次解析成功，生成 ${validQs.length} 道题目（共 ${merged.length} 题）`);

                    // 成功解析后更新计数
                    this.generatedCount++;
                    this.readOffset += this.chunkSize;

                    // 极速体验逻辑
                    if (this.generatedCount === 1) {
                      this.showMask = false;
                      this.showSpeedModal = true;
                    }
                  } else {
                    logger.warn('[practice] 二次解析后题目格式仍无效');
                    this.generatedCount++;
                    this.readOffset += this.chunkSize;
                  }
                } else {
                  // 解析失败，仍然更新计数
                  this.generatedCount++;
                  this.readOffset += this.chunkSize;
                }
              } else {
                // 无法提取 JSON，更新计数继续
                this.generatedCount++;
                this.readOffset += this.chunkSize;
              }
            } catch (e) {
              logger.error('[practice] 二次解析也失败:', e);
              // 解析完全失败，更新计数避免卡死
              this.generatedCount++;
              this.readOffset += this.chunkSize;
            }
          }
        } else if (res.code === 0 || res.success === true) {
          // ✅ 兼容新格式：{ success: true, data: [...], code: 0 }
          logger.log('[practice] ✅ 检测到新格式响应，直接使用 data');

          try {
            let newQs = res.data;

            // ✅ 修复：如果 data 是字符串，先解析为数组
            if (typeof newQs === 'string') {
              logger.log('[practice] 🔧 检测到字符串格式，尝试解析 JSON');
              try {
                newQs = JSON.parse(newQs);
                logger.log('[practice] ✅ JSON 解析成功，题目数量:', Array.isArray(newQs) ? newQs.length : 0);
              } catch (parseErr) {
                logger.error('[practice] ❌ JSON 解析失败:', parseErr);
                logger.warn('[practice] 新格式 data 不是有效的 JSON 字符串');
                this.generatedCount++;
                this.readOffset += this.chunkSize;
                return;
              }
            }

            // 验证题目格式
            if (Array.isArray(newQs) && newQs.length > 0) {
              // 标准化题目格式
              const normalizedQs = newQs.map(q => {
                // ✅ 修复：支持数字索引转字母（0→A, 1→B, 2→C, 3→D）
                let answer = q.answer || q.correct_answer || q.correctAnswer || '';

                // ✅ 新增：如果 answer 为空，尝试从 correct 字段获取
                if (!answer && q.correct !== undefined) {
                  answer = q.correct;
                }

                // 如果是数字，转换为字母
                if (typeof answer === 'number') {
                  const letters = ['A', 'B', 'C', 'D'];
                  answer = letters[answer] || 'A';
                } else if (answer) {
                  // 如果是字符串且不为空，取第一个字符并转大写
                  answer = answer.toString().toUpperCase().charAt(0);
                } else {
                  // ✅ 容错：如果答案仍为空，使用默认值 'A'
                  logger.warn('[practice] ⚠️ 题目答案为空，使用默认值 A:', q.question);
                  answer = 'A';
                }

                const question = q.question || q.title || q.content || '';
                let options = q.options || [];
                if (!Array.isArray(options)) options = [];
                const category = q.category || q.subject || '未分类';
                const desc = q.desc || q.analysis || q.explanation || '';

                // ✅ 关键修复：先展开原始对象，再覆盖标准化字段，确保转换后的值不被覆盖
                return {
                  ...q,  // 先展开原始对象
                  question: question,
                  options: options,
                  answer: answer,  // 后设置的值会覆盖原始值
                  category: category,
                  desc: desc,
                  type: q.type || '单选'
                };
              });

              // ✅ 添加详细调试日志
              logger.log('[practice] 🔍 标准化后的题目数量:', normalizedQs.length);
              logger.log('[practice] 🔍 第一道题目详情:', normalizedQs[0]);

              // 过滤有效题目
              const validQs = normalizedQs.filter((q, index) => {
                const isValid = q.question &&
                  q.question.trim().length > 0 &&
                  q.options &&
                  Array.isArray(q.options) &&
                  q.options.length >= 4 &&
                  q.answer &&
                  ['A', 'B', 'C', 'D'].includes(q.answer);

                // 如果验证失败，打印详细信息
                if (!isValid) {
                  logger.warn(`[practice] ⚠️ 题目 ${index + 1} 验证失败:`, {
                    hasQuestion: !!q.question,
                    questionLength: q.question ? q.question.trim().length : 0,
                    hasOptions: !!q.options,
                    isOptionsArray: Array.isArray(q.options),
                    optionsLength: Array.isArray(q.options) ? q.options.length : 0,
                    hasAnswer: !!q.answer,
                    answer: q.answer,
                    answerType: typeof q.answer,
                    isValidAnswer: ['A', 'B', 'C', 'D'].includes(q.answer),
                    fullQuestion: q
                  });
                }

                return isValid;
              });

              logger.log('[practice] ✅ 有效题目数量:', validQs.length, '/', normalizedQs.length);

              if (validQs.length > 0) {
                const old = storageService.get('v30_bank', []);
                const merged = [...old, ...validQs];

                // 保存前先创建备份
                try {
                  const backup = JSON.stringify(merged);
                  uni.setStorageSync('v30_bank_backup', backup);
                  logger.log('[practice] 💾 已创建题库备份:', merged.length, '道题');
                } catch (backupErr) {
                  logger.warn('[practice] ⚠️ 备份失败（不影响主流程）:', backupErr);
                }

                // 保存主数据
                storageService.save('v30_bank', merged);

                // 验证保存是否成功
                const saved = storageService.get('v30_bank', []);
                const isSuccess = saved.length === merged.length;
                logger.log('[practice] ✅ 保存验证:', {
                  savedCount: saved.length,
                  expectedCount: merged.length,
                  match: isSuccess
                });

                if (!isSuccess) {
                  logger.error('[practice] ❌ 保存验证失败！尝试从备份恢复...');
                  try {
                    const backup = uni.getStorageSync('v30_bank_backup');
                    if (backup) {
                      const restored = JSON.parse(backup);
                      storageService.save('v30_bank', restored);
                      logger.log('[practice] 🔄 已从备份恢复数据');
                    }
                  } catch (restoreErr) {
                    logger.error('[practice] ❌ 恢复备份失败:', restoreErr);
                  }
                }

                this.refreshBankStatus();
                this.updateGenerationProgress();
                logger.log(`[practice] ✅ 新格式处理成功，生成 ${validQs.length} 道题目（共 ${merged.length} 题）`);

                // 成功生成题目后更新计数
                this.generatedCount++;
                this.readOffset += this.chunkSize;

                // 极速体验逻辑
                if (this.generatedCount === 1) {
                  this.showMask = false;
                  this.showSpeedModal = true;
                }
              } else {
                logger.warn('[practice] 新格式题目验证失败');
                this.generatedCount++;
                this.readOffset += this.chunkSize;
              }
            } else {
              logger.warn('[practice] 新格式 data 不是有效数组');
              this.generatedCount++;
              this.readOffset += this.chunkSize;
            }
          } catch (e) {
            logger.error('[practice] 新格式处理异常:', e);
            this.generatedCount++;
            this.readOffset += this.chunkSize;
          }
        } else {
          logger.error('[practice] AI 请求失败:', res);
          // 请求失败时，仍然继续生成流程（避免卡死）
          this.generatedCount++;
          this.readOffset += this.chunkSize;
        }

      } catch (e) {
        logger.error('[practice] 生成题目异常:', e);

        // 根据错误类型处理
        if (e.errMsg && e.errMsg.includes('timeout')) {
          // 超时：静默重试，不操作UI
          logger.log('[practice] 请求超时，将自动重试');
        } else if (e.errMsg && e.errMsg.includes('fail')) {
          // 网络错误：停止生成并提示
          this.isLooping = false;
          this.isPaused = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          uni.showToast({ title: '网络错误，请检查网络后重试', icon: 'none', duration: 3000 });
        } else {
          // 其他错误：停止生成
          this.isLooping = false;
          this.isPaused = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          uni.showToast({ title: '生成失败：' + (e.message || '未知错误'), icon: 'none', duration: 3000 });
        }
      } finally {
        this.isRequestInFlight = false;
        // 递归继续生成（如果还在循环中且未暂停）
        if (this.isLooping && !this.isPaused) {
          setTimeout(() => {
            if (this.isLooping && !this.isPaused) {
              this.generateNextBatch();
            }
          }, 1500);
        }
      }
    },

    closeSpeedModalAndPlay() {
      this.showSpeedModal = false;
      this.goPractice();
    },

    finishGeneration() {
      this.isLooping = false;
      this.isPaused = false;
      this.showMask = false;
      clearInterval(this.soupTimer);
      this.refreshBankStatus();
      this.updateUploadRecordStatus('completed');
      uni.showToast({ title: '智能出题完毕', icon: 'success' });
    },

    startSoupRotation() {
      let i = 0;
      this.currentSoup = this.soupList[0];
      if (this.soupTimer) {
        clearInterval(this.soupTimer);
      }
      this.soupTimer = setInterval(() => {
        i = (i + 1) % this.soupList.length;
        this.currentSoup = this.soupList[i];
      }, 2500);
    },

    clearAll() {
      uni.showModal({
        title: '⚠️ 危险操作',
        content: '确定清空所有题库吗？此操作不可恢复！\n\n建议：清空前请确保已备份数据。',
        confirmColor: '#FF3B30',
        success: (res) => {
          if (res.confirm) {
            // 清空前先创建备份（以防误操作）
            try {
              const currentBank = storageService.get('v30_bank', []);
              if (currentBank.length > 0) {
                const backup = JSON.stringify(currentBank);
                uni.setStorageSync('v30_bank_backup_before_clear', backup);
                logger.log('[刷题中心] 💾 清空前已创建备份:', currentBank.length, '道题');
              }
            } catch (backupErr) {
              logger.warn('[刷题中心] ⚠️ 创建备份失败:', backupErr);
            }

            storageService.remove('v30_bank');
            this.refreshBankStatus();
            this.isLooping = false;
            this.isPaused = false;

            uni.showToast({
              title: '已清空题库',
              icon: 'success'
            });
          }
        }
      });
    },

    pauseGeneration() {
      if (!this.isLooping) return;
      this.isPaused = true;
      this.isLooping = false;
      this.showMask = false;
      this.updateUploadRecordStatus('paused');
      uni.showToast({ title: '已暂停生成', icon: 'none' });
    },

    resumeGeneration() {
      if (!this.fileName && !this.fullFileContent) {
        return uni.showToast({ title: '请先导入资料', icon: 'none' });
      }
      this.isPaused = false;
      this.isLooping = true;
      if (this.generatedCount === 0) {
        this.showMask = true;
      }
      this.startSoupRotation();
      this.updateUploadRecordStatus('generating');
      this.generateNextBatch();
    },

    getGeneratedQuestionCount() {
      if (this.generatedCount === 0) return 0;
      return this.generatedCount * this.batchQuestionCount;
    },

    // 显示题库管理弹窗
    showQuizManage() {
      this.showQuizManageModal = true;
    },

    // 关闭题库管理弹窗
    closeQuizManage() {
      this.showQuizManageModal = false;
    },

    // 清空题库
    clearQuizBank() {
      uni.showModal({
        title: '确认清空',
        content: '确定要清空所有题库吗？此操作不可恢复。',
        confirmColor: '#FF3B30',
        success: (res) => {
          if (res.confirm) {
            storageService.remove('v30_bank');
            storageService.remove('v30_user_answers');
            this.refreshBankStatus();
            this.showQuizManageModal = false;
            uni.showToast({ title: '已清空题库', icon: 'success' });
          }
        }
      });
    },

    // 检查题库生成状态
    checkGenerationStatus() {
      const importedFiles = storageService.get('imported_files', []);
      const generatingFile = importedFiles.find(f => f.status === 'generating');

      if (generatingFile && this.isLooping) {
        this.isGeneratingQuestions = true;
        this.startProgressTimer();
      } else {
        this.isGeneratingQuestions = false;
        if (this.progressTimer) {
          clearInterval(this.progressTimer);
        }
      }
    },

    // 启动进度定时器
    startProgressTimer() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
      }
      this.progressTimer = setInterval(() => {
        this.updateGenerationProgress();
      }, 1000);
    },

    // 更新生成进度
    updateGenerationProgress() {
      const bank = storageService.get('v30_bank', []);
      const targetCount = this.totalQuestionsLimit * this.batchQuestionCount;
      const currentCount = bank.length;
      this.generationProgress = Math.min(100, Math.round((currentCount / targetCount) * 100));

      // 检查是否完成
      const importedFiles = storageService.get('imported_files', []);
      const generatingFile = importedFiles.find(f => f.status === 'generating');
      if (!generatingFile || generatingFile.status === 'completed' || !this.isLooping) {
        this.isGeneratingQuestions = false;
        if (this.progressTimer) {
          clearInterval(this.progressTimer);
        }
      }
    }
  }
}
</script>

<style scoped>
/* ============================================
   Wise-Style 刷题页面样式 - Phase 3 页面级重构
   ============================================ */

/* 基础容器 - 使用设计系统变量 */
.practice-container {
  min-height: 100vh;
  background-color: var(--bg-page);
  padding: 20px;
  padding-bottom: 140px;
  box-sizing: border-box;
  color: var(--text-sub);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s ease;
}

/* ============================================
   顶部导航 - 优化文字间距和对齐
   ============================================ */
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 40px;
  margin-bottom: 32px;
  padding: 0 4px;
  /* 微调对齐 */
}

.nav-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.nav-actions {
  display: flex;
  gap: 12px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background-color: var(--primary);
  transform: scale(1.05);
}

.icon-btn.danger {
  background-color: var(--danger-light);
}

.icon-btn.danger:hover {
  background-color: var(--danger);
}

/* 状态卡片 */
.status-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-md, 0 4px 20px rgba(0, 0, 0, 0.06));
  transition: all 0.3s ease;
}

.status-card:hover {
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.08));
  transform: translateY(-2px);
}

/* 空状态样式 - 居中显示 */
.status-card.empty-state {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--bg-secondary);
}

.status-card.empty-state:hover {
  background: var(--bg-card);
  border-color: var(--primary);
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
  width: 100%;
}

.empty-icon {
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-10px);
  }
}

.empty-icon-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  opacity: 0.8;
}

/* Emoji图标样式 - 深色模式自动适配 */
.empty-icon-emoji {
  font-size: 64px;
  display: block;
  line-height: 1;
}

.action-icon-emoji {
  font-size: 18px;
  display: inline-block;
  line-height: 1;
}

.import-icon-emoji {
  font-size: 32px;
  display: block;
  line-height: 1;
}

.empty-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  letter-spacing: -0.3px;
}

.empty-desc {
  font-size: 15px;
  color: var(--text-sub);
  margin: 0 0 24px 0;
  line-height: 1.6;
  max-width: 280px;
}

.empty-action {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  background-color: var(--primary);
  border-radius: 24px;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-md);
}

.empty-action:active {
  transform: scale(0.95);
  box-shadow: var(--shadow-sm);
}

.action-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  /* 按钮背景是主色（绿色），图标需要深色以保持对比度 */
  filter: brightness(0) opacity(0.8);
}

.action-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary-foreground);
  letter-spacing: 0.3px;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.manage-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: var(--primary-light);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.manage-btn:active {
  background-color: var(--primary);
  transform: scale(0.95);
}

.manage-icon {
  font-size: 16px;
}

.manage-text {
  font-size: 14px;
  color: var(--primary);
  font-weight: 500;
}

.status-icon {
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 图标图片样式 */
.icon-image {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.manage-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.status-icon .emoji {
  font-size: 48px;
}

.status-info {
  flex: 1;
}

.status-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.status-desc {
  font-size: 14px;
  color: var(--text-sub);
  margin: 0;
}

/* 主要操作区 */
.main-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

/* 主要按钮 */
.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: 20px;
  padding: 20px 40px;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
}

.primary-btn:hover {
  background-color: var(--primary);
  box-shadow: var(--shadow-xl);
  transform: translateY(-2px);
}

.primary-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.btn-icon {
  font-size: 28px;
}

/* 按钮图标图片样式 */
.btn-icon-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.menu-icon-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

/* 次要按钮（PK对战） */
.secondary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: 20px;
  padding: 20px 40px;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
}

.secondary-btn:hover {
  background-color: var(--primary);
  box-shadow: var(--shadow-xl);
  transform: translateY(-2px);
}

.secondary-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.btn-icon {
  font-size: 28px;
}

/* 导入资料卡片 */
.import-card {
  display: flex;
  align-items: center;
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-md);
}

.import-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.import-icon {
  margin-right: 16px;
}

.import-icon .emoji {
  font-size: 32px;
}

.import-info {
  flex: 1;
}

.import-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.import-desc {
  font-size: 14px;
  color: var(--text-sub);
  margin: 0;
}

.import-arrow {
  color: var(--text-sub);
}

.arrow {
  font-size: 24px;
  font-weight: 600;
}

/* 功能菜单 */
.feature-menu {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-md, 0 4px 20px rgba(0, 0, 0, 0.06));
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background-color: var(--bg-secondary);
}

.menu-icon {
  margin-right: 16px;
}

.menu-icon .emoji {
  font-size: 28px;
}

.menu-info {
  flex: 1;
}

.menu-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.menu-arrow {
  color: var(--text-sub);
}

/* 进度条 */
.progress-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  width: 120px;
  height: 8px;
  background-color: var(--primary-light);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}

/* AI 加载遮罩 */
.ai-loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.loading-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  box-shadow: var(--shadow-xl);
  max-width: 400px;
  width: 90%;
  animation: fadeInUp 0.3s ease-out;
}

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

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Apple AI 解锁样式 */
.apple-ai-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 30px;
}

.apple-ai-ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 229, 255, 0.1) 0%, transparent 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.apple-ai-pulse {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(0, 229, 255, 0.6);
  animation: appleAIPulse 2s ease-out infinite;
  position: absolute;
}

.apple-ai-pulse.second {
  animation-delay: 0.3s;
  border-color: rgba(0, 122, 255, 0.6);
}

.apple-ai-pulse.third {
  animation-delay: 0.6s;
  border-color: rgba(255, 159, 10, 0.6);
}

@keyframes appleAIPulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }

  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.apple-ai-icon {
  font-size: 64px;
  position: relative;
  z-index: 1;
  animation: appleAIFloat 3s ease-in-out infinite;
}

@keyframes appleAIFloat {

  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }

  50% {
    transform: translateY(-10px) rotate(180deg);
  }
}

.loading-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

/* Apple AI 进度条 */
.apple-ai-progress {
  width: 100%;
  margin: 16px 0 20px 0;
}

.apple-ai-progress-bar {
  width: 100%;
  height: 4px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.apple-ai-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00E5FF, #007AFF);
  border-radius: 2px;
  transition: width 0.3s ease;
  animation: appleAIProgress 1s ease-in-out infinite alternate;
}

@keyframes appleAIProgress {
  0% {
    background-position: 0% 50%;
  }

  100% {
    background-position: 100% 50%;
  }
}

.loading-step {
  font-size: 14px;
  color: var(--text-sub);
  margin: 0;
}

.inspiration-text {
  font-size: 16px;
  color: var(--text-sub);
  font-style: italic;
  margin: 0;
  max-width: 300px;
  background: var(--bg-secondary);
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid var(--border);
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* 极速体验弹窗 */
.speed-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.speed-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  box-shadow: var(--shadow-xl);
  max-width: 400px;
  width: 90%;
  animation: fadeInUp 0.3s ease-out;
}

.speed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.speed-icon {
  font-size: 64px;
  margin-bottom: 20px;
  animation: pulse 1.5s ease-in-out infinite;
}

.speed-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.speed-desc {
  font-size: 14px;
  color: var(--text-sub);
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.pause-banner {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pause-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pause-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.pause-desc {
  font-size: 12px;
  color: var(--text-sub);
}

.pause-resume-btn {
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: 16px;
  padding: 8px 14px;
  font-size: 12px;
}

.loading-actions {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}

.pause-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-sub);
  border-radius: 16px;
  padding: 8px 14px;
  font-size: 12px;
}

/* 题库生成进度条 */
.generation-progress-bar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: 16px;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.progress-label {
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

.progress-text {
  font-size: 14px;
  color: var(--text-sub);
}

.progress-bar-wrapper {
  flex: 2;
  min-width: 0;
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: var(--primary-light);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-actions {
  flex-shrink: 0;
}

.pause-btn-small {
  padding: 8px 16px;
  background: var(--warning-light);
  color: var(--warning);
  border-radius: 16px;
  font-size: 14px;
  border: none;
  font-weight: 500;
}

.pause-btn-small::after {
  border: none;
}

/* 题库管理弹窗 */
.quiz-manage-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--overlay);
  backdrop-filter: blur(5px);
  z-index: 1;
}

.modal-content {
  position: relative;
  width: 85%;
  max-width: 500px;
  background: var(--bg-card);
  border-radius: 20px;
  overflow: hidden;
  z-index: 2;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-secondary);
}

.modal-close-icon {
  font-size: 24px;
  color: var(--text-sub);
  line-height: var(--line-height-normal);
}

.modal-body {
  padding: 24px 20px;
}

.manage-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-text {
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

.info-sub {
  font-size: 14px;
  color: var(--text-sub);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--border);
}

.modal-btn {
  flex: 1;
  padding: 12px 0;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  border: none;
}

.modal-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-btn.danger {
  background: var(--danger);
  color: var(--primary-foreground);
}

.modal-btn::after {
  border: none;
}

/* ============================================
   深色模式图标适配 - 根据用户需求调整
   ============================================ */
/* 白色图标：AI导师（题库图标使用 inline style） */
.practice-container.dark-mode .menu-item:nth-child(2) .menu-icon-img {
  filter: brightness(0) invert(1) opacity(0.9) !important;
}

/* 深色模式下需要反色的图标：空状态云图标、书本、对战 */
.practice-container.dark-mode .empty-icon-img,
.practice-container.dark-mode .btn-icon-img {
  filter: brightness(0) invert(1) opacity(0.9) !important;
}

/* 深色模式下导入卡片图标 - 只反色不改变亮度 */
.practice-container.dark-mode .import-card .menu-icon-img {
  filter: invert(1) !important;
}

/* 深色模式下按钮上的图标保持深色（因为按钮背景是亮色） */
.practice-container.dark-mode .action-icon {
  filter: brightness(0) opacity(0.8) !important;
}

/* 深色模式下保持彩色的图标：文件管理、错题本、排行榜、学习进度、设置 */
.practice-container.dark-mode .manage-icon-img,
.practice-container.dark-mode .menu-item:nth-child(1) .menu-icon-img,
.practice-container.dark-mode .menu-item:nth-child(3) .menu-icon-img,
.practice-container.dark-mode .menu-item:nth-child(4) .menu-icon-img,
.practice-container.dark-mode .menu-item:nth-child(5) .menu-icon-img {
  filter: none !important;
}

/* 骨架屏样式 */
.skeleton-container {
  padding: 20px;
}

.skeleton-status-card {
  height: 120px;
  border-radius: 20px;
  margin-bottom: 20px;
}

.skeleton-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.skeleton-btn {
  flex: 1;
  height: 56px;
  border-radius: 28px;
}

.skeleton-import-card {
  height: 80px;
  border-radius: 16px;
  margin-bottom: 20px;
}

.skeleton-menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-menu-item {
  height: 64px;
  border-radius: 16px;
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
</style>