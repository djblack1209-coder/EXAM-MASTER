<template>
  <view class="apple-container" :class="{ 'dark-mode': isDark }">
    <!-- 苹果质感自定义导航栏 -->
    <view class="custom-navbar" :style="{ height: navBarHeight + 'px' }">
      <view class="navbar-status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="navbar-content" style="height: 44px;">
        <view class="navbar-back-btn" @tap="handleBack">
          <text class="back-icon">‹</text>
        </view>
        <view class="navbar-title-wrapper">
          <text class="navbar-title">资料导入</text>
        </view>
        <view class="navbar-placeholder"></view>
      </view>
    </view>

    <view class="page-header">
      <text class="header-title">资料导入</text>
      <text class="header-subtitle">AI 智能分析 · 即刻出题</text>
    </view>

    <view class="main-glass-card bounce-in-up">
      
      <view class="status-bar">
        <text class="status-dot" :class="{ active: fileName }"></text>
        <text class="status-text">{{ fileName ? '已加载文件，准备就绪' : '支持 PDF / Word / TXT / MD' }}</text>
      </view>

      <view class="operation-zone">
        <view v-if="!fileName" class="upload-trigger glow-effect" @tap="chooseFile">
          <view class="icon-circle">
            <text class="icon-text">📁</text>
          </view>
          <text class="upload-main-text">选择复习资料</text>
          <text class="upload-sub-text">点击浏览本地文件</text>
        </view>

        <view v-else class="file-capsule glass-morphism">
          <view class="file-icon-box">
             <text style="font-size: 28px;">📄</text>
          </view>
          <view class="file-info-col">
            <text class="fname-text text-ellipsis">{{ fileName }}</text>
            <view class="fmeta-row">
              <view class="meta-tag">{{ fullFileContent ? '精读模式' : '主题模式' }}</view>
              <text class="meta-size">已准备好</text>
            </view>
          </view>
          <view class="close-btn-circle" @tap.stop="clearFile">
            <text >✕</text>
          </view>
        </view>
      </view>
      
    </view>
    
    <view class="bottom-action-bar glass-morphism">
      <view class="action-row main-row">
        <button 
          class="apple-btn primary glow-effect" 
          @tap="startAI"
          :disabled="isLooping || !fileName"
          :class="{ disabled: isLooping || !fileName }"
        >
          <text style="margin-right: 8px;">✨</text>
          {{ isLooping ? 'AI 正在后台生成中...' : '开始 AI 出题' }}
        </button>
      </view>
      
      <view class="action-row sub-row">
        <button 
          v-if="!isLooping && (fullFileContent || fileName) && generatedCount > 0" 
          class="apple-btn secondary" 
          @tap="continueGenerating"
        >
          <text style="font-size: 14px; margin-right: 4px;">🔄</text>
          <text style="font-size: 15px;">再出一组</text>
        </button>
        <button class="apple-btn danger-ghost" @tap="clearAll">
          清空题库
        </button>
      </view>
    </view>

    <view class="ai-loading-mask" v-if="showMask">
      <view class="ai-card glass-morphism">
        <view class="apple-ai-gradient"></view>
        <view class="apple-ai-glow"></view>
        
        <view class="content-box">
          <view class="apple-ai-indicator">
            <view class="indicator-ring">
              <view class="ring-progress" :style="{ width: progressWidth + '%' }"></view>
            </view>
            <text class="ai-star">✨</text>
          </view>
          
          <text class="loading-title">{{ importStatusText }}</text>
          <text class="loading-step">{{ importProgressText }}</text>
          <text class="loading-progress">{{ importDetailText }}</text>
          
          <text class="soup-text">"{{ currentSoup }}"</text>
          <view class="loading-actions">
            <button class="glass-btn ghost" @tap="pauseGeneration">暂停生成</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 自定义极速体验弹窗 -->
    <view class="speed-modal-mask" v-if="showSpeedModal">
      <view class="speed-card bounce-in">
        <view class="speed-icon-box">
          <text class="speed-icon">⚡️</text>
        </view>
        <text class="speed-title">极速体验就绪</text>
        <text class="speed-desc">前 5 道题已生成完毕！您可以立即开始刷题，AI 将在后台静默为您补充剩余题目。</text>
        
        <view class="speed-actions">
          <button class="glass-btn ghost" @tap="stayHere">留在本页</button>
          <button class="glass-btn shine" @tap="goQuiz">立即刷题</button>
        </view>
      </view>
    </view>

    <view class="pause-banner" v-if="isPaused">
      <view class="pause-info">
        <text class="pause-title">任务已暂停</text>
        <text class="pause-desc">可随时继续生成题库</text>
      </view>
      <button class="glass-btn shine" @tap="resumeGeneration">继续生成</button>
    </view>
  </view>
</template>

<script>
import { lafService } from '../../services/lafService.js'

export default {
  data() {
    return {
      // 导航栏相关
      statusBarHeight: 44,
      navBarHeight: 88,
      isDark: false,
      
      // 状态锁拆分
      isLooping: false,
      isPaused: false,
      showMask: false,
      showSpeedModal: false,
      isRequestInFlight: false,
      progressTimer: null,
      
      // UI 状态
      currentSoup: '',
      soupList: [
        "星光不问赶路人，时光不负有心人。",
        "看似不起眼的日复一日，会在将来的某一天，突然坚持出意义。",
        "苦尽甘来时，山河星月都做贺礼。",
        "乾坤未定，你我皆是黑马。",
        "种一棵树最好的时间是十年前，其次是现在。"
      ],
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
      realProgress: 0,           // 真实进度百分比 (0-100)
      estimatedTimeLeft: 0,      // 预估剩余时间（秒）
      generationStartTime: 0,    // 生成开始时间戳
      totalQuestionsGenerated: 0, // 已生成的题目总数
      errorInfo: null,           // 错误信息对象 { message, detail, canRetry }
      showErrorCard: false,      // 显示错误卡片
      uploadStats: {             // 上传统计
        totalSize: 0,
        uploadedSize: 0,
        speed: 0
      },
      showFilePreview: false,    // 显示文件预览确认
      filePreviewData: null,     // 文件预览数据
      
      // ⭐⭐ v5.2 新增：导入体验优化
      importStatus: 'idle',      // 导入状态：idle/parsing/importing/success/error
      currentQuestionIndex: 0,   // 当前导入到第几题
      totalQuestionsToImport: 0, // 预计总题数
      importErrorDetail: null,   // 详细错误信息
      retryCount: 0,             // 重试次数
      maxRetryCount: 3,          // 最大重试次数
      canGoBack: true,           // 是否允许返回
      duplicateCount: 0,         // 重复题目数量
      importStartTime: 0,        // 导入开始时间
      importSpeed: 0,            // 导入速度（题/秒）
    }
  },
  
  computed: {
    // ⭐⭐ v5.2 新增：动态状态文本
    importStatusText() {
      if (this.importStatus === 'parsing') {
        return '正在解析文件...';
      } else if (this.importStatus === 'importing') {
        return `正在导入第 ${this.currentQuestionIndex} 题...`;
      } else if (this.importStatus === 'success') {
        return '导入成功！';
      } else if (this.importStatus === 'error') {
        return '导入失败';
      }
      return 'AI 正在分析...';
    },
    
    importProgressText() {
      const current = this.totalQuestionsGenerated;
      const total = this.totalQuestionsLimit * this.batchQuestionCount;
      return `已生成 ${current} 道题 / 目标 ${total}`;
    },
    
    importDetailText() {
      let text = `进度: ${this.realProgress}%`;
      if (this.estimatedTimeLeft > 0) {
        text += ` · 预计剩余 ${this.estimatedTimeLeft} 秒`;
      }
      if (this.duplicateCount > 0) {
        text += ` · 已跳过 ${this.duplicateCount} 道重复题`;
      }
      return text;
    }
  },
  
  onLoad() {
    // 获取系统信息，设置状态栏和导航栏高度
    try {
      const systemInfo = uni.getSystemInfoSync();
      this.statusBarHeight = systemInfo.statusBarHeight || 44;
      // 标准导航栏高度 = 状态栏高度 + 44px
      this.navBarHeight = this.statusBarHeight + 44;
      
      // 初始化深色模式
      const savedTheme = uni.getStorageSync('theme_mode') || 'light';
      this.isDark = savedTheme === 'dark';
      
      // 监听全局主题更新事件
      uni.$on('themeUpdate', (mode) => {
        this.isDark = mode === 'dark';
      });
    } catch (e) {
      console.error('获取系统信息失败:', e);
    }
  },
  
  onShow() {
    // ⚡️ 核心修复：回到页面时，自动恢复中断的生成任务
    // 判断条件：开关是开的 && 还没达到目标总数 && 当前没有请求在飞
    if (this.isLooping && !this.isPaused && this.generatedCount < this.totalQuestionsLimit && !this.isRequestInFlight) {
      console.log('回到页面，检测到任务未完成，继续后台生成...');
      // 如果遮罩已关闭，说明首批已完成，静默继续
      if (!this.showMask) {
        this.generateNextBatch();
      }
    }
  },
  
  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate');
    
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
  },

  methods: {
    // 1. 选择文件 (入口) - 修复：确保所有回调使用箭头函数
    chooseFile() {
      // 保存 this 引用，确保在所有回调中都能正确访问
      const that = this;
      
      // #ifdef MP-WEIXIN
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['pdf', 'doc', 'docx', 'txt', 'md', 'json'],
        success: (res) => {
          const file = res.tempFiles[0];
          that.handleUpload(file);
        },
        fail: (err) => {
          console.error('文件选择失败:', err);
          uni.showToast({ title: '文件选择失败', icon: 'none' });
        }
      });
      // #endif

      // #ifndef MP-WEIXIN
      uni.chooseFile({
        count: 1,
        extension: ['.pdf', '.doc', '.docx', '.txt', '.md', '.json'],
        success: (res) => {
          const file = res.tempFiles[0];
          that.handleUpload(file);
        },
        fail: (err) => {
          console.error('文件选择失败:', err);
          uni.showToast({ title: '文件选择失败', icon: 'none' });
        }
      });
      // #endif
    },

    // 2. 处理上传 (分流逻辑) - 修复：确保所有回调使用箭头函数
    handleUpload(file) {
      const that = this; // 保存 this 引用
      
      this.fileName = file.name;
      const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
      
      // 重置数据
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
      
      if (['pdf', 'doc', 'docx'].includes(ext)) {
        // PDF/Word: 仅使用文件名
        this.fullFileContent = ""; 
        uni.showToast({ title: '已提取主题', icon: 'success' });
        // 自动启动 AI 分析
        setTimeout(() => {
          that.startAI();
        }, 500);
      } else {
        // TXT/MD: 读取内容
        const fs = uni.getFileSystemManager();
        fs.readFile({
          filePath: file.path || file.tempFilePath,
          encoding: 'utf8',
          success: (res) => {
            that.fullFileContent = res.data;
            uni.showToast({ title: '解析成功', icon: 'success' });
            // 自动启动 AI 分析
            setTimeout(() => {
              that.startAI();
            }, 500);
          },
          fail: (err) => {
            console.error('文件读取失败:', err);
            that.fullFileContent = ""; 
            uni.showToast({ title: '读取失败，仅使用文件名', icon: 'none' });
            // 即使失败也启动 AI 分析（使用文件名）
            setTimeout(() => {
              that.startAI();
            }, 500);
          }
        });
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

    // 4. 启动 AI 连载 (点击按钮触发)
    // 已迁移到 Sealos：使用 lafService.proxyAI 替代 uniCloud.callFunction('proxy-ai')
    async startAI() {
      if (!this.fullFileContent && !this.fileName) {
        uni.showToast({ title: '请先导入', icon: 'none' });
        return;
      }

      // 双锁开启
      this.isLooping = true;  // 开启循环
      this.isPaused = false;
      this.showMask = true;   // 开启遮罩（前5题期间）
      
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
      
      this.startSoupRotation(); 
      this.updateUploadRecordStatus('generating');
      
      // 启动进度动画
      this.startProgressAnimation();
      
      await this.generateNextBatch();
    },

    // 4.1. startAIAnalysis 别名方法 - 修复：兼容可能的旧调用
    // 如果代码中有地方调用了 startAIAnalysis，这个方法会确保不报错
    async startAIAnalysis() {
      console.warn('startAIAnalysis 已废弃，请使用 startAI');
      return this.startAI();
    },

    // 5. 分批生成逻辑 (核心递归) - 3秒首屏策略 + 防重复请求 + 真实进度
    async generateNextBatch() {
      // 1. 检查是否强制停止
      if (!this.isLooping || this.isPaused) return;

      // 2. 检查上限
      if (this.generatedCount >= this.totalQuestionsLimit) {
        this.finishGeneration("已生成所有题目！");
        return;
      }

      // 3. 如果已经在请求了，就别重复发了
      if (this.isRequestInFlight) {
        console.log('已有请求进行中，跳过本次调用');
        return;
      }
      
      // ⭐⭐ v5.3 Phase 1: 批次开始，更新状态为importing
      this.importStatus = 'importing';
      this.currentQuestionIndex = this.generatedCount * this.batchQuestionCount + 1;
      
      // ⭐ 4. 更新真实进度
      this.updateRealProgress();

      // ⚡️⚡️ 策略优化：第一波只出 3 题，追求极速；后续出 5 题，追求效率
      const currentBatchSize = this.batchQuestionCount;

      let chunkText = "";
      if (this.fullFileContent) {
        chunkText = this.fullFileContent.substring(this.readOffset, this.readOffset + this.chunkSize);
        if (this.readOffset >= this.fullFileContent.length) this.readOffset = 0;
      } 

      // 构建内容文本
      let contentText = chunkText || "主题：" + this.fileName;
      
      try {
        this.isRequestInFlight = true; // ⚡️ 上锁：请求开始

        // ✅ 使用后端代理调用（安全）- action: 'generate'
        // 后端会自动添加 "请生成题目..." 的 Prompt
        const response = await lafService.proxyAI('generate', {
          content: contentText
        });
        
        // 处理响应
        if (response.code !== 0 || !response.data) {
          console.error('[导入资料] AI响应异常:', response.message);
          this.isLooping = false;
          this.isPaused = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          uni.showToast({ title: response.message || '生成失败', icon: 'none' });
          return;
        }
        
        // 清洗 JSON（去除可能的 Markdown 代码块标记）
        let aiText = response.data;
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // 解析 JSON
        let newQuestions = [];
        try {
          newQuestions = JSON.parse(aiText);
          if (!Array.isArray(newQuestions)) {
            throw new Error('AI 返回格式不是数组');
          }
        } catch (parseError) {
          console.error('[导入资料] JSON解析失败:', parseError);
          console.error('[导入资料] 原始数据:', aiText.substring(0, 200));
          uni.showModal({
            title: '解析失败',
            content: 'AI 返回的数据格式不正确，请重试。',
            showCancel: false
          });
          this.isLooping = false;
          this.isPaused = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          return;
        }
        
        // 保存题目
        const saved = this.saveQuestions(newQuestions);
        if (!saved) {
          this.isLooping = false;
          this.isPaused = true;
          this.importStatus = 'error';
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          uni.showToast({ title: '解析失败，请重试', icon: 'none' });
          return;
        }
        this.readOffset += this.chunkSize;
        this.generatedCount++; // 这里的计数单位变成了"批次"
        
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
          if(this.isLooping) {
             uni.showToast({ 
               title: `后台已更新一批新题`, 
               icon: 'none', 
               duration: 2000 
             });
          }
        }
        
        // 继续下一轮 - 修复：使用箭头函数确保 this 绑定
        setTimeout(() => {
          if (this.isLooping) {
            this.generateNextBatch();
          }
        }, 1500);

      } catch (e) {
        console.error("生成报错:", e);
        
        // ⭐ 增强错误处理：详细错误分类
        let errorMessage = '生成失败';
        let canRetry = false;
        
        if (e.message && (e.message.includes('timeout') || e.message.includes('超时'))) {
          errorMessage = '网络超时，正在重试...';
          canRetry = true;
          // 静默重试，不打扰用户
          setTimeout(() => {
            if (this.isLooping) {
              this.generateNextBatch();
            }
          }, 2000);
        } else if (e.message && e.message.includes('401')) {
          errorMessage = '未登录，请先登录后重试';
          canRetry = false;
          this.isLooping = false;
          this.isPaused = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          uni.showToast({ title: errorMessage, icon: 'none', duration: 3000 });
        } else if (e.message && (e.message.includes('network') || e.message.includes('网络'))) {
          errorMessage = '网络不稳定，请稍后重试';
          canRetry = true;
          this.isLooping = false;
          this.isPaused = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          uni.showToast({ title: errorMessage, icon: 'none', duration: 3000 });
        } else {
          errorMessage = '生成失败，请重试';
          canRetry = true;
          this.isLooping = false;
          this.isPaused = true;
          this.updateUploadRecordStatus('failed');
          this.showMask = false;
          uni.showToast({ title: errorMessage, icon: 'none', duration: 3000 });
        }
        
        // 保存错误信息供重试使用
        this.errorInfo = {
          message: errorMessage,
          detail: e.message || '未知错误',
          canRetry: canRetry
        };
      } finally {
        this.isRequestInFlight = false; // ⚡️ 解锁：无论成功失败，请求结束
      }
    },

    // 6. 保存题目到本地存储
    saveQuestions(newQuestions) {
      console.log('[题库保存] 📥 开始保存题目');
      if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
        console.warn('[题库保存] ⚠️ 题目数据无效');
        return false;
      }
      
      try {
        console.log('[题库保存] 📚 解析成功，新题目数量:', newQuestions.length);
        
        // 读取旧题库
        const oldBank = uni.getStorageSync('v30_bank') || [];
        console.log('[题库保存] 📖 旧题库数量:', oldBank.length);
        
        // 检查登录状态
        const userId = uni.getStorageSync('EXAM_USER_ID');
        const isLoggedIn = !!userId;
        console.log('[题库保存] 👤 用户登录状态:', { isLoggedIn, userId: userId || '未登录' });
        
        // 合并
        const merged = [...oldBank, ...newQuestions];
        console.log('[题库保存] 💾 准备保存，合并后总数:', merged.length);
        
        // 未登录时：保留本地缓存（10-15道题）
        let finalBank = merged;
        if (!isLoggedIn) {
          // 如果题目总数超过15道，只保留最新的15道
          if (merged.length > 15) {
            finalBank = merged.slice(-15);
            console.log('[题库保存] 📦 未登录状态：保留本地缓存', finalBank.length, '道题（最新15道）');
          } else if (merged.length > 10) {
            finalBank = merged;
            console.log('[题库保存] 📦 未登录状态：保留本地缓存', finalBank.length, '道题');
          } else {
            finalBank = merged;
            console.log('[题库保存] 📦 未登录状态：保留本地缓存', finalBank.length, '道题（少于10道，全部保留）');
          }
        }
        
        // 保存前先备份（防止数据丢失）
        try {
          const backup = JSON.stringify(finalBank);
          uni.setStorageSync('v30_bank_backup', backup);
          console.log('[题库保存] 💾 已创建备份');
        } catch (backupErr) {
          console.warn('[题库保存] ⚠️ 备份失败（不影响主流程）:', backupErr);
        }
        
        // 保存（未登录时只保存本地，不保存到云端）
        try {
          uni.setStorageSync('v30_bank', finalBank);
          console.log('[题库保存] 💾 主数据保存完成（', isLoggedIn ? '已登录，可同步云端' : '未登录，仅本地缓存', '）');
        } catch (saveErr) {
          console.error('[题库保存] ❌ 保存失败:', saveErr);
          // 尝试恢复备份
          try {
            const backup = uni.getStorageSync('v30_bank_backup');
            if (backup) {
              const restored = JSON.parse(backup);
              uni.setStorageSync('v30_bank', restored);
              console.log('[题库保存] 🔄 已从备份恢复数据');
            }
          } catch (restoreErr) {
            console.error('[题库保存] ❌ 恢复备份也失败:', restoreErr);
          }
          return false;
        }
        
        // 验证保存是否成功
        const saved = uni.getStorageSync('v30_bank') || [];
        const isSuccess = saved.length === finalBank.length;
        
        console.log('[题库保存] ✅ 验证保存结果:', {
          savedCount: saved.length,
          expectedCount: finalBank.length,
          match: isSuccess,
          isLoggedIn: isLoggedIn,
          finalBankSize: finalBank.length
        });
        
        if (!isSuccess) {
          console.error('[题库保存] ❌ 保存验证失败！数据可能不完整');
          // 尝试从备份恢复
          try {
            const backup = uni.getStorageSync('v30_bank_backup');
            if (backup) {
              const restored = JSON.parse(backup);
              uni.setStorageSync('v30_bank', restored);
              console.log('[题库保存] 🔄 已从备份恢复数据');
            }
          } catch (restoreErr) {
            console.error('[题库保存] ❌ 恢复备份失败:', restoreErr);
          }
          return false;
        }
        
        if (!isLoggedIn) {
          console.log(`[题库保存] ✅ 未登录状态：成功存入 ${newQuestions.length} 道题，本地缓存总数: ${finalBank.length}（保留最新${finalBank.length}道）`);
          uni.showToast({
            title: `已保存${newQuestions.length}道题（本地缓存）`,
            icon: 'none',
            duration: 2000
          });
        } else {
          console.log(`[题库保存] ✅ 成功存入 ${newQuestions.length} 道题，当前总数: ${finalBank.length}`);
        }
        return true;
      } catch (e) {
        console.error("[题库保存] ❌ 保存失败", e);
        return false;
      }
    },

    // 7. 结束生成
    finishGeneration(msg) {
      this.isLooping = false;
      this.isPaused = false;
      this.showMask = false;
      this.showSpeedModal = false; // 确保弹窗关闭
      this.updateUploadRecordStatus('completed');
      if (this.soupTimer) {
        clearInterval(this.soupTimer);
        this.soupTimer = null;
      }
      
      // 只有当用户还在这个页面时，才弹窗，否则静默结束
      // 修复：使用箭头函数确保 this 绑定
      uni.showModal({
        title: '✅ 题库装填完毕',
        content: msg,
        confirmText: '去刷题',
        success: (res) => {
          if (res.confirm) {
            uni.switchTab({ url: '/src/pages/practice/index' });
          }
        },
        fail: (err) => {
          console.error('弹窗显示失败:', err);
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
       this.updateUploadRecordStatus('generating');
       this.generateNextBatch();
    },

    // 10. 处理自定义弹窗点击
    stayHere() {
      this.showSpeedModal = false;
      uni.showToast({ title: 'AI 正在后台继续生成...', icon: 'none' });
    },
    
    goQuiz() {
      this.showSpeedModal = false;
      uni.switchTab({ url: '/src/pages/practice/index' });
    },

    // 返回上一页
    handleBack() {
      uni.navigateBack({
        fail: () => {
          // 如果无法返回，跳转到刷题首页
          uni.switchTab({ url: '/src/pages/practice/index' });
        }
      });
    },
    
    // 11. 清空数据 - 修复：使用箭头函数确保 this 绑定
    clearAll() {
      const that = this; // 保存 this 引用
      uni.showModal({
        title: '⚠️ 危险操作',
        content: '确定清空所有本地题库吗？此操作不可恢复！\n\n建议：清空前请确保已备份数据。',
        confirmColor: '#FF453A',
        success: (res) => {
          if (res.confirm) {
            // 清空前先创建备份（以防误操作）
            try {
              const currentBank = uni.getStorageSync('v30_bank') || [];
              if (currentBank.length > 0) {
                const backup = JSON.stringify(currentBank);
                uni.setStorageSync('v30_bank_backup_before_clear', backup);
                console.log('[导入资料] 💾 清空前已创建备份:', currentBank.length, '道题');
              }
            } catch (backupErr) {
              console.warn('[导入资料] ⚠️ 创建备份失败:', backupErr);
            }
            
            uni.removeStorageSync('v30_bank');
            that.clearFile();
            that.isLooping = false;
            that.isPaused = false;
            that.showMask = false;
            that.showSpeedModal = false;
            that.generatedCount = 0;
            that.progressWidth = 0;
            uni.showToast({ title: '已清空' });
          }
        },
        fail: (err) => {
          console.error('确认弹窗失败:', err);
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
      if (!this.fullFileContent && !this.fileName) {
        return uni.showToast({ title: '请先导入', icon: 'none' });
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

    saveUploadRecord(record) {
      console.log('[文件管理] 📝 开始保存文件记录:', record);
      const records = uni.getStorageSync(this.uploadHistoryKey) || [];
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
      console.log('[文件管理] 💾 保存文件记录到存储:', {
        key: this.uploadHistoryKey,
        newRecord: newRecord,
        totalRecords: records.length,
        allRecords: records
      });
      
      // 保存前先备份
      try {
        const backup = JSON.stringify(records);
        uni.setStorageSync('imported_files_backup', backup);
        console.log('[文件管理] 💾 已创建备份');
      } catch (backupErr) {
        console.warn('[文件管理] ⚠️ 备份失败（不影响主流程）:', backupErr);
      }
      
      try {
        uni.setStorageSync(this.uploadHistoryKey, records);
        console.log('[文件管理] 💾 主数据保存完成');
      } catch (saveErr) {
        console.error('[文件管理] ❌ 保存失败:', saveErr);
        // 尝试恢复备份
        try {
          const backup = uni.getStorageSync('imported_files_backup');
          if (backup) {
            const restored = JSON.parse(backup);
            uni.setStorageSync(this.uploadHistoryKey, restored);
            console.log('[文件管理] 🔄 已从备份恢复数据');
          }
        } catch (restoreErr) {
          console.error('[文件管理] ❌ 恢复备份也失败:', restoreErr);
        }
        return id; // 即使保存失败，也返回 ID（避免阻塞流程）
      }
      
      // 验证保存是否成功
      const saved = uni.getStorageSync(this.uploadHistoryKey) || [];
      const isSuccess = saved.length === records.length;
      
      console.log('[文件管理] ✅ 验证保存结果:', {
        savedCount: saved.length,
        expectedCount: records.length,
        match: isSuccess
      });
      
      if (!isSuccess) {
        console.error('[文件管理] ❌ 保存验证失败！数据可能不完整');
        // 尝试从备份恢复
        try {
          const backup = uni.getStorageSync('imported_files_backup');
          if (backup) {
            const restored = JSON.parse(backup);
            uni.setStorageSync(this.uploadHistoryKey, restored);
            console.log('[文件管理] 🔄 已从备份恢复数据');
          }
        } catch (restoreErr) {
          console.error('[文件管理] ❌ 恢复备份失败:', restoreErr);
        }
      }
      
      return id;
    },

    updateUploadRecordStatus(status) {
      if (!this.currentUploadId) return;
      const records = uni.getStorageSync(this.uploadHistoryKey) || [];
      const index = records.findIndex((item) => item.id === this.currentUploadId);
      if (index === -1) return;
      records[index] = {
        ...records[index],
        status,
        updatedAt: Date.now()
      };
      uni.setStorageSync(this.uploadHistoryKey, records);
    },
    
    // 12. Apple AI 进度动画控制
    startProgressAnimation() {
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
    
    // ⭐ 14. 更新真实进度（新增）
    updateRealProgress() {
      // 计算真实进度百分比
      this.realProgress = Math.round((this.generatedCount / this.totalQuestionsLimit) * 100);
      
      // 计算预估剩余时间
      if (this.generatedCount > 0 && this.generationStartTime > 0) {
        const elapsed = Date.now() - this.generationStartTime;
        const avgTimePerBatch = elapsed / this.generatedCount;
        const remainingBatches = this.totalQuestionsLimit - this.generatedCount;
        this.estimatedTimeLeft = Math.round((avgTimePerBatch * remainingBatches) / 1000);
      }
      
      // 更新已生成题目总数
      this.totalQuestionsGenerated = this.generatedCount * this.batchQuestionCount;
      
      console.log('[进度更新]', {
        realProgress: this.realProgress,
        estimatedTimeLeft: this.estimatedTimeLeft,
        totalQuestionsGenerated: this.totalQuestionsGenerated
      });
    }
  }
}
</script>

<style scoped>
/* --- 全局容器与背景 --- */
.apple-container {
  min-height: 100vh;
  background-color: var(--text-primary);
  /* 增加微妙的顶部蓝色光晕 */
  background-image: radial-gradient(circle at 50% 0%, rgba(10, 132, 255, 0.15) 0%, var(--text-primary) 60%);
  padding: 20px;
  padding-bottom: 120px; /* 为底部悬浮栏留空 */
  padding-top: calc(env(safe-area-inset-top) + 20px);
  box-sizing: border-box;
  color: #fff;
}

/* 深色模式样式 */
.apple-container.dark-mode {
  background-color: var(--bg-body);
}

/* --- 苹果质感自定义导航栏 --- */
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  /* 毛玻璃背景 - 苹果质感 */
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
}

/* 深色模式下的导航栏 */
.apple-container.dark-mode .custom-navbar {
  background: rgba(28, 28, 30, 0.8);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
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
  background: rgba(0, 0, 0, 0.1);
  transform: scale(0.95);
}

.apple-container.dark-mode .navbar-back-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.back-icon {
  font-size: 32px;
  font-weight: 300;
  color: #1A1A1A;
  line-height: 1;
  margin-left: -4px;
}

.apple-container.dark-mode .back-icon {
  color: var(--bg-card);
}

.navbar-title-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.navbar-title {
  font-size: 17px;
  font-weight: 600;
  color: #1A1A1A;
  letter-spacing: -0.41px;
  -webkit-font-smoothing: antialiased;
}

.apple-container.dark-mode .navbar-title {
  color: var(--bg-card);
}

.navbar-placeholder {
  width: 44px;
  height: 44px;
}

/* --- 头部大标题 --- */
.page-header { 
  margin-top: calc(env(safe-area-inset-top) + 88px); /* 为导航栏留出空间（标准高度） */
  margin-bottom: 30px; 
  padding-left: 10px; 
}

.header-title { 
  font-size: 34px; 
  font-weight: 800; 
  display: block; 
  margin-bottom: 8px; 
  letter-spacing: 0.5px; 
  color: var(--bg-card);
}

.header-subtitle { 
  font-size: 17px; 
  color: #8E8E93; 
  font-weight: 500; 
}

/* --- 主体玻璃卡片 --- */
.main-glass-card {
  background: rgba(28, 28, 30, 0.6); /* iOS深色系背景色 */
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  position: relative;
}

/* 状态栏 */
.status-bar { 
  display: flex; 
  align-items: center; 
  margin-bottom: 24px; 
}

.status-dot { 
  width: 8px; 
  height: 8px; 
  border-radius: 50%; 
  background: #3A3A3C; 
  margin-right: 8px; 
  transition: all 0.3s; 
}

.status-dot.active { 
  background: #30D158; 
  box-shadow: 0 0 10px rgba(48, 209, 88, 0.5); 
}

.status-text { 
  font-size: 13px; 
  color: #AEAEB2; 
  font-weight: 500; 
}

/* --- 操作区：上传按钮 --- */
.upload-trigger {
  height: 160px;
  background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  border-radius: 20px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.upload-trigger:active { 
  transform: scale(0.98); 
  background: rgba(255,255,255,0.08); 
}

.icon-circle {
  width: 56px; 
  height: 56px; 
  background: #0A84FF; /* iOS Blue */
  border-radius: 50%; 
  display: flex; 
  align-items: center; 
  justify-content: center;
  margin-bottom: 16px; 
  box-shadow: 0 4px 15px rgba(10, 132, 255, 0.3);
}

.icon-text {
  font-size: 28px;
}

.upload-main-text { 
  font-size: 17px; 
  font-weight: 600; 
  margin-bottom: 4px; 
  color: var(--bg-card);
}

.upload-sub-text { 
  font-size: 13px; 
  color: #8E8E93; 
}

/* --- 操作区：文件胶囊 --- */
.file-capsule {
  display: flex; 
  align-items: center;
  padding: 16px; 
  border-radius: 18px;
  background: rgba(44, 44, 46, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.file-icon-box { 
  width: 48px; 
  height: 48px; 
  background: rgba(255,255,255,0.05); 
  border-radius: 12px; 
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
  font-size: 16px; 
  font-weight: 600; 
  margin-bottom: 6px; 
  display: block; 
  color: var(--bg-card);
}

.fmeta-row { 
  display: flex; 
  align-items: center; 
}

.meta-tag { 
  font-size: 10px; 
  padding: 2px 6px; 
  background: #0A84FF; 
  border-radius: 4px; 
  margin-right: 8px; 
  font-weight: 700; 
  color: var(--bg-card);
}

.meta-size { 
  font-size: 12px; 
  color: #8E8E93; 
}

.close-btn-circle { 
  width: 28px; 
  height: 28px; 
  background: rgba(142, 142, 147, 0.2); 
  border-radius: 50%; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
}

/* --- 底部悬浮按钮栏 --- */
.bottom-action-bar {
  position: fixed; 
  bottom: 30px; 
  left: 20px; 
  right: 20px;
  background: rgba(28, 28, 30, 0.8);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 28px;
  padding: 15px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  z-index: 100;
  padding-bottom: calc(15px + env(safe-area-inset-bottom));
}

.action-row { 
  display: flex; 
  gap: 15px; 
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
  font-size: 17px; 
  font-weight: 600; 
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
  background: linear-gradient(135deg, #0A84FF, #005BEA);
  color: white;
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.3);
}

.primary.disabled { 
  opacity: 0.6; 
  filter: grayscale(0.5); 
  box-shadow: none; 
}

.secondary {
  background: rgba(10, 132, 255, 0.1); 
  color: #0A84FF;
  height: 44px; 
  font-size: 15px;
}

.secondary::after {
  border: none;
}

.danger-ghost {
  background: transparent; 
  color: #FF453A;
  height: 44px; 
  font-size: 15px;
}

.danger-ghost::after {
  border: none;
}

/* 通用工具类 */
.glass-morphism { 
  backdrop-filter: blur(20px); 
  -webkit-backdrop-filter: blur(20px); 
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
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
  opacity: 0; 
  transition: opacity 0.5s; 
  pointer-events: none;
}

.glow-effect:active::after { 
  opacity: 1; 
}

/*  Apple AI Loading 样式 */
.ai-loading-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}

.ai-card {
  width: 320px; height: 400px;
  border-radius: 32px;
  position: relative;
  overflow: hidden;
  background: rgba(24, 24, 27, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  transform: translateZ(0);
}

/* Apple AI 渐变背景 */
.apple-ai-gradient {
  position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
  background: linear-gradient(225deg, 
    rgba(10, 132, 255, 0.15) 0%, 
    rgba(0, 212, 255, 0.15) 25%, 
    rgba(139, 92, 246, 0.15) 50%, 
    rgba(236, 72, 153, 0.15) 75%, 
    rgba(251, 146, 60, 0.15) 100%);
  filter: blur(50px);
  animation: rotateGradient 8s linear infinite;
}

/* Apple AI 发光效果 */
.apple-ai-glow {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle at center, 
    rgba(10, 132, 255, 0.05) 0%, 
    rgba(10, 132, 255, 0) 70%);
  animation: pulseGlow 4s ease-in-out infinite;
}

@keyframes rotateGradient {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.content-box { 
  position: relative; z-index: 2; 
  display: flex; flex-direction: column; align-items: center; 
  padding: 40px 30px; text-align: center; 
  width: 100%;
  box-sizing: border-box;
}

/* Apple AI 进度指示器 */
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
  background: conic-gradient(
    transparent 0deg,
    rgba(10, 132, 255, 0.1) 0deg 360deg
  );
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
  background: conic-gradient(
    rgba(10, 132, 255, 1) 0deg,
    rgba(10, 132, 255, 0.8) 50deg,
    transparent 180deg 360deg
  );
  transform: translate(-50%, -50%) rotate(-90deg);
  clip-path: circle(50% at 50% 50%);
  animation: progressPulse 2s ease-in-out infinite;
}

@keyframes progressPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.ai-star {
  font-size: 56px;
  z-index: 3;
  animation: starPulse 2s infinite ease-in-out;
  display: block;
  position: relative;
}

@keyframes starPulse {
  0% { opacity: 0.7; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 0.7; transform: scale(0.95); }
}

.loading-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--bg-card);
  margin-bottom: 12px;
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.loading-step {
  font-size: 14px;
  color: #A1A1AA;
  margin-bottom: 8px;
  font-weight: 500;
}

.loading-progress {
  font-size: 13px;
  color: #0A84FF;
  margin-bottom: 32px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.soup-text { 
  font-size: 16px;
  color: #E4E4E7;
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
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  z-index: 9000;
}

.pause-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pause-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bg-card);
}

.pause-desc {
  font-size: 12px;
  color: #A1A1AA;
}

/* 自定义极速体验弹窗 */
.speed-modal-mask {
  position: fixed; 
  top: 0; 
  left: 0; 
  right: 0; 
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
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
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 30px 24px;
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

/* 弹窗动画 */
.bounce-in { 
  animation: bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
}

@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}

.speed-icon-box {
  width: 60px; 
  height: 60px; 
  background: linear-gradient(135deg, #FFD000, #FF9500);
  border-radius: 50%; 
  display: flex; 
  align-items: center; 
  justify-content: center;
  margin-bottom: 20px; 
  box-shadow: 0 0 20px rgba(255, 165, 0, 0.4);
}

.speed-icon { 
  font-size: 30px; 
}

.speed-title { 
  font-size: 20px; 
  font-weight: bold; 
  color: #fff; 
  margin-bottom: 12px; 
}

.speed-desc { 
  font-size: 14px; 
  color: #8F939C; 
  line-height: 1.6; 
  margin-bottom: 30px; 
}

.speed-actions { 
  width: 100%; 
  display: flex; 
  justify-content: space-between; 
  gap: 15px; 
}

/* 按钮升级 */
.glass-btn.ghost {
  background: rgba(255, 255, 255, 0.1); 
  color: #fff; 
  border: 1px solid rgba(255,255,255,0.2);
}

.glass-btn.ghost::after {
  border: none;
}

.glass-btn.shine {
  background: linear-gradient(90deg, #00C6FB, #005BEA); 
  color: white;
  box-shadow: 0 4px 15px rgba(0, 91, 234, 0.4); 
  border: none;
}

.glass-btn.shine::after {
  border: none;
}
</style>