/**
 * AI 题目生成 Mixin（分包动态加载）
 * 从 practice/index.vue 抽离，减小主包体积
 * 包含：文件导入、AI 生成、题库持久化与备份
 */
import { storageService } from '@/services/storageService.js';
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';
// ✅ 以下模块从分包本地引用，避免打入主包
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { deduplicateQuestions } from '../utils/question-dedup-worker.js';
import { normalizeQuestion, isValidQuestion, normalizeAndValidateQuestions, sanitizeAIInput } from '../utils/question-normalizer.js';

export const aiGenerationMixin = {
  methods: {
    // ==================== 文件导入 ====================
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

      // #ifndef MP-WEIXIN
      if (typeof uni.chooseFile !== 'undefined') {
        uni.chooseFile({
          count: 1,
          extension: ['.pdf', '.doc', '.docx', '.txt', '.md', '.json'],
          success: (res) => {
            this.handleUpload(res.tempFiles[0]);
          },
          fail: (err) => {
            logger.log('文件选择取消或失败', err);
          }
        });
      } else {
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
      }).catch((e) => {
        logger.error('[practice] 导入聊天记录失败:', e);
        uni.showToast({ title: '导入失败，请重试', icon: 'none' });
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
      }).catch((e) => {
        logger.error('[practice] 导入百度网盘失败:', e);
        uni.showToast({ title: '导入失败，请重试', icon: 'none' });
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
      storageService.saveDebounced(this.uploadHistoryKey, records);
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
      storageService.saveDebounced(this.uploadHistoryKey, records);
    },

    handleUpload(file) {
      this.fileName = file.name;
      this.isUploadingFile = true;
      const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
      this.fullFileContent = '';
      this.readOffset = 0;
      this.generatedCount = 0;
      if (!['pdf', 'doc', 'docx', 'txt', 'md', 'json'].includes(ext)) {
        this.isUploadingFile = false;
        uni.showToast({ title: '暂不支持该格式', icon: 'none' });
        return;
      }
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size && file.size > MAX_FILE_SIZE) {
        this.isUploadingFile = false;
        uni.showToast({ title: '文件过大，请选择 10MB 以内的文件', icon: 'none', duration: 3000 });
        return;
      }
      this.currentUploadId = this.saveUploadRecord({
        name: this.fileName,
        size: Math.round((file.size || 0) / 1024),
        source: '本地文件'
      });

      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) { logger.warn('Vibration feedback failed', e); }

      if (['pdf', 'doc', 'docx'].includes(ext)) {
        this.isUploadingFile = false;
        this.startAI();
      } else {
        const fs = uni.getFileSystemManager();
        fs.readFile({
          filePath: file.path || file.tempFilePath,
          encoding: 'utf8',
          success: (res) => {
            this.fullFileContent = res.data;
            this.isUploadingFile = false;
            this.startAI();
          },
          fail: () => {
            this.fullFileContent = '';
            this.isUploadingFile = false;
            this.startAI();
          }
        });
      }
    },

    // ==================== AI 题目生成 ====================
    startAI() {
      if (!this.fullFileContent && !this.fileName) {
        return uni.showToast({ title: '请先导入资料', icon: 'none' });
      }

      this.isLooping = true;
      this.isPaused = false;
      this.showMask = true;
      this.readOffset = 0;
      this.generatedCount = 0;
      const bank = storageService.get('v30_bank', []);
      this.bankSizeAtGenStart = bank.length;
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

      let chunk = '';
      if (this.fullFileContent) {
        chunk = this.fullFileContent.substring(this.readOffset, this.readOffset + this.chunkSize);
        if (this.readOffset >= this.fullFileContent.length) this.readOffset = 0;
      }

      const MAX_CONTENT_LEN = 8000;
      const sanitizedContent = this._sanitizeAIInput(chunk || this.fileName, MAX_CONTENT_LEN);

      try {
        logger.log('[practice] 🤖 调用后端代理生成题目...');
        const res = await lafService.proxyAI('generate_questions', {
          content: sanitizedContent,
          questionCount: batchSize
        });
        this._processAIResponse(res);
      } catch (e) {
        this._handleGenerationError(e);
      } finally {
        this.isRequestInFlight = false;
        if (this.isLooping && !this.isPaused) {
          setTimeout(() => {
            if (this.isLooping && !this.isPaused) {
              this.generateNextBatch();
            }
          }, 1500);
        }
      }
    },

    _processAIResponse(res) {
      if (res.code === 0 || res.success === true) {
        this._handleNewFormatResponse(res);
        return;
      }

      if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices.length > 0) {
        const message = res.data.choices[0]?.message;
        if (!message || !message.content) {
          logger.warn('[practice] AI 响应缺少 message.content');
          this._advanceBatch();
          return;
        }
        let content = message.content;
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
          const newQs = JSON.parse(content);
          if (Array.isArray(newQs) && newQs.length > 0) {
            this._mergeValidQuestions(newQs);
          } else {
            logger.warn('[practice] AI 返回的不是数组格式');
            this._advanceBatch();
          }
        } catch (parseError) {
          logger.error('[practice] JSON 解析失败:', parseError, '原始内容:', content);
          this._handleJsonParseError(content);
        }
        return;
      }

      logger.error('[practice] AI 请求失败:', res);
      this._advanceBatch();
    },

    _normalizeQuestion(q) {
      return normalizeQuestion(q);
    },

    _isValidQuestion(q) {
      return isValidQuestion(q);
    },

    _mergeValidQuestions(newQs) {
      const normalizedQs = newQs.map((q) => this._normalizeQuestion(q));
      const validQs = normalizedQs.filter((q) => this._isValidQuestion(q));

      if (validQs.length > 0) {
        const old = storageService.get('v30_bank', []);
        const uniqueQs = deduplicateQuestions(validQs, old);
        if (uniqueQs.length > 0) {
          this._saveQuestionBank([...old, ...uniqueQs], uniqueQs.length);
        } else {
          logger.log('[practice] 所有题目均为重复，跳过保存');
          this._advanceBatch();
        }
      } else {
        logger.warn('[practice] 生成的题目格式无效，原始数据:', newQs);
        this._advanceBatch();
      }
    },

    _advanceBatch() {
      this.generatedCount++;
      this.readOffset += this.chunkSize;
    },

    _sanitizeAIInput(text, maxLen = 8000) {
      return sanitizeAIInput(text, maxLen);
    },

    _handleGenerationError(e) {
      logger.error('[practice] 生成题目异常:', e);

      if (e.errMsg && e.errMsg.includes('timeout')) {
        logger.log('[practice] 请求超时，将自动重试');
      } else if (e.errMsg && e.errMsg.includes('fail')) {
        this.isLooping = false;
        this.isPaused = true;
        this.updateUploadRecordStatus('failed');
        this.showMask = false;
        uni.showToast({ title: '网络错误，请检查网络后重试', icon: 'none', duration: 3000 });
      } else {
        this.isLooping = false;
        this.isPaused = true;
        this.updateUploadRecordStatus('failed');
        this.showMask = false;
        uni.showToast({ title: '生成失败：' + (e.message || '未知错误'), icon: 'none', duration: 3000 });
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
            try {
              const currentBank = storageService.get('v30_bank', []);
              if (currentBank.length > 0) {
                const backup = JSON.stringify(currentBank);
                storageService.save('v30_bank_backup_before_clear', backup);
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
      const bank = storageService.get('v30_bank', []);
      return Math.max(0, bank.length - this.bankSizeAtGenStart);
    },

    showQuizManage() {
      this.showQuizManageModal = true;
    },

    closeQuizManage() {
      this.showQuizManageModal = false;
    },

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

    startProgressTimer() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
      }
      this.progressTimer = setInterval(() => {
        this.updateGenerationProgress();
      }, 1000);
    },

    updateGenerationProgress() {
      const bank = storageService.get('v30_bank', []);
      const newlyGenerated = Math.max(0, bank.length - this.bankSizeAtGenStart);
      // ✅ 修复：目标数量就是 totalQuestionsLimit，不应乘以 batchQuestionCount
      const targetCount = this.totalQuestionsLimit || 10;
      this.generationProgress = Math.min(100, Math.round((newlyGenerated / targetCount) * 100));

      const importedFiles = storageService.get('imported_files', []);
      const generatingFile = importedFiles.find((f) => f.status === 'generating');
      if (!generatingFile || generatingFile.status === 'completed' || !this.isLooping) {
        this.isGeneratingQuestions = false;
        if (this.progressTimer) {
          clearInterval(this.progressTimer);
        }
      }
    },

    // ==================== 题库持久化与备份 ====================
    _saveQuestionBank(merged, newCount) {
      try {
        const backup = JSON.stringify(merged);
        storageService.save('v30_bank_backup', backup);
        logger.log('[practice] 💾 已创建题库备份:', merged.length, '道题');
      } catch (backupErr) {
        logger.warn('[practice] ⚠️ 备份失败（不影响主流程）:', backupErr);
      }

      storageService.save('v30_bank', merged);

      const saved = storageService.get('v30_bank', []);
      const isSuccess = saved.length === merged.length;
      logger.log('[practice] ✅ 保存验证:', {
        savedCount: saved.length,
        expectedCount: merged.length,
        match: isSuccess
      });

      if (!isSuccess) {
        this._restoreFromBackup();
      }

      this.refreshBankStatus();
      this.updateGenerationProgress();
      logger.log(`[practice] 成功生成 ${newCount} 道题目（共 ${merged.length} 题）`);

      this.generatedCount++;
      this.readOffset += this.chunkSize;

      if (this.generatedCount === 1) {
        this.showMask = false;
        this.showSpeedModal = true;
      }
    },

    _restoreFromBackup() {
      logger.error('[practice] ❌ 保存验证失败！尝试从备份恢复...');
      try {
        const backup = storageService.get('v30_bank_backup');
        if (backup) {
          const restored = JSON.parse(backup);
          storageService.save('v30_bank', restored);
          logger.log('[practice] 🔄 已从备份恢复数据');
        }
      } catch (restoreErr) {
        logger.error('[practice] ❌ 恢复备份失败:', restoreErr);
      }
    },

    _handleJsonParseError(content) {
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const newQs = JSON.parse(jsonMatch[0]);
          if (Array.isArray(newQs) && newQs.length > 0) {
            const validQs = this._normalizeAndValidateQuestions(newQs);
            if (validQs.length > 0) {
              const old = storageService.get('v30_bank', []);
              const uniqueQs = deduplicateQuestions(validQs, old);
              if (uniqueQs.length > 0) {
                const merged = [...old, ...uniqueQs];
                this._saveQuestionBank(merged, uniqueQs.length);
                logger.log(`[practice] 二次解析成功，生成 ${uniqueQs.length} 道题目`);
                return;
              }
            }
          }
        }
      } catch (e) {
        logger.error('[practice] 二次解析也失败:', e);
      }
      this.generatedCount++;
      this.readOffset += this.chunkSize;
    },

    _handleNewFormatResponse(res) {
      logger.log('[practice] ✅ 检测到新格式响应，直接使用 data');
      try {
        let newQs = res.data;
        if (typeof newQs === 'string') {
          newQs = JSON.parse(newQs);
        }

        if (Array.isArray(newQs) && newQs.length > 0) {
          const validQs = this._normalizeAndValidateQuestions(newQs);
          if (validQs.length > 0) {
            const old = storageService.get('v30_bank', []);
            const uniqueQs = deduplicateQuestions(validQs, old);
            if (uniqueQs.length > 0) {
              const merged = [...old, ...uniqueQs];
              this._saveQuestionBank(merged, uniqueQs.length);
              return;
            }
          }
        }
      } catch (e) {
        logger.error('[practice] 新格式处理异常:', e);
      }
      this.generatedCount++;
      this.readOffset += this.chunkSize;
    },

    _normalizeAndValidateQuestions(questions) {
      return normalizeAndValidateQuestions(questions);
    }
  }
};
