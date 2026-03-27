/**
 * 智能题目生成 Mixin（分包动态加载）
 * 从 practice/index.vue 抽离，减小主包体积
 * 包含：文件导入、智能生成、题库持久化与备份
 */
import { storageService } from '@/services/storageService.js';
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
// ✅ 以下模块从分包本地引用，避免打入主包
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { deduplicateQuestions } from '../utils/question-dedup-worker.js';
import { toast } from '@/utils/toast.js';
import {
  normalizeQuestion,
  isValidQuestion,
  normalizeAndValidateQuestions,
  sanitizeAIInput
} from '../utils/question-normalizer.js';

export const aiGenerationMixin = {
  methods: {
    // ==================== 文件导入 ====================
    chooseImportSource() {
      const fallbackToImportPage = () => {
        safeNavigateTo('/pages/practice-sub/import-data');
      };

      requireLogin(
        () => {
          if (typeof uni.showActionSheet !== 'function') {
            fallbackToImportPage();
            return;
          }

          uni.showActionSheet({
            itemList: ['本地文件', '聊天记录', '百度网盘'],
            success: (res) => {
              if (res.tapIndex === 0) this.chooseLocalFile();
              if (res.tapIndex === 1) this.importFromChat();
              if (res.tapIndex === 2) this.importFromBaidu();
            },
            fail: (err) => {
              logger.warn('[practice] 导入来源弹窗拉起失败，回退到导入页:', err);
              fallbackToImportPage();
            }
          });
        },
        {
          message: '请先登录后上传资料',
          loginUrl: '/pages/settings/index'
        }
      );
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
      this.getClipboardText()
        .then((text) => {
          if (!text) {
            toast.info('请先复制聊天记录');
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
        })
        .catch((e) => {
          logger.error('[practice] 导入聊天记录失败:', e);
          toast.info('导入失败，请重试');
        });
    },

    importFromBaidu() {
      this.currentUploadSource = 'baidu';
      this.getClipboardText()
        .then((text) => {
          if (!text) {
            toast.info('请先复制网盘链接或文本');
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
            toast.info('已记录链接，基于主题生成');
          }
          this.startAI();
        })
        .catch((e) => {
          logger.error('[practice] 导入百度网盘失败:', e);
          toast.info('导入失败，请重试');
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
        toast.info('暂不支持该格式');
        return;
      }
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size && file.size > MAX_FILE_SIZE) {
        this.isUploadingFile = false;
        toast.info('文件过大，请选择 10MB 以内的文件', 3000);
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
      } catch (e) {
        logger.warn('Vibration feedback failed', e);
      }

      if (['pdf', 'doc', 'docx'].includes(ext)) {
        this.isUploadingFile = false;
        this.startAI();
      } else {
        // 读取文本文件内容
        try {
          const filePath = file.path || file.tempFilePath;
          // #ifdef MP-WEIXIN
          const fs = uni.getFileSystemManager();
          fs.readFile({
            filePath,
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
          // #endif
          // #ifdef APP-PLUS
          plus.io.resolveLocalFileSystemURL(
            filePath,
            (entry) => {
              entry.file((f) => {
                const reader = new plus.io.FileReader();
                reader.onloadend = (e) => {
                  this.fullFileContent = e.target.result || '';
                  this.isUploadingFile = false;
                  this.startAI();
                };
                reader.onerror = () => {
                  this.fullFileContent = '';
                  this.isUploadingFile = false;
                  this.startAI();
                };
                reader.readAsText(f);
              });
            },
            () => {
              this.fullFileContent = '';
              this.isUploadingFile = false;
              this.startAI();
            }
          );
          // #endif
          // #ifdef H5
          this.fullFileContent = '';
          this.isUploadingFile = false;
          this.startAI();
          // #endif
        } catch (_e) {
          this.fullFileContent = '';
          this.isUploadingFile = false;
          this.startAI();
        }
      }
    },

    // ==================== 智能题目生成 ====================
    startAI() {
      if (!this.fullFileContent && !this.fileName) {
        return toast.info('请先导入资料');
      }

      this.isLooping = true;
      this.isPaused = false;
      this.showMask = true;
      this.readOffset = 0;
      this.generatedCount = 0;
      this._consecutiveFailures = 0; // 连续失败计数器，防止无限循环
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

      // 防止无限循环：连续失败超过阈值时自动暂停
      const MAX_CONSECUTIVE_FAILURES = 5;
      if (this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logger.warn(`[practice] 连续 ${this._consecutiveFailures} 次生成失败，自动暂停`);
        this.pauseGeneration();
        uni.showModal({
          title: '智能生成暂停',
          content: `连续 ${this._consecutiveFailures} 次未能解析出有效题目，已自动暂停。\n\n可能原因：资料格式不适合出题，或智能服务暂时异常。\n\n你可以更换资料后重试。`,
          showCancel: false,
          confirmText: '我知道了'
        });
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
        this._consecutiveFailures++;
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
          logger.warn('[practice] 智能响应缺少 message.content');
          this._consecutiveFailures++;
          this._advanceBatch();
          return;
        }
        let content = message.content;
        content = content
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        try {
          const newQs = JSON.parse(content);
          if (Array.isArray(newQs) && newQs.length > 0) {
            this._mergeValidQuestions(newQs);
          } else {
            logger.warn('[practice] 智能返回的不是数组格式');
            this._consecutiveFailures++;
            this._advanceBatch();
          }
        } catch (parseError) {
          logger.error('[practice] JSON 解析失败:', parseError, '原始内容:', content);
          this._consecutiveFailures++;
          this._handleJsonParseError(content);
        }
        return;
      }

      logger.error('[practice] 智能请求失败:', res);
      this._consecutiveFailures++;
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
          this._consecutiveFailures = 0; // 成功生成，重置连续失败计数
          this._saveQuestionBank([...old, ...uniqueQs], uniqueQs.length);
        } else {
          logger.log('[practice] 所有题目均为重复，跳过保存');
          this._consecutiveFailures++;
          this._advanceBatch();
        }
      } else {
        logger.warn('[practice] 生成的题目格式无效，原始数据:', newQs);
        this._consecutiveFailures++;
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
        toast.info('网络错误，请检查网络后重试', 3000);
      } else {
        this.isLooping = false;
        this.isPaused = true;
        this.updateUploadRecordStatus('failed');
        this.showMask = false;
        toast.info('生成失败：', 3000);
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
      toast.success('智能出题完毕');
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

            toast.success('已清空题库');
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
      toast.info('已暂停生成');
    },

    resumeGeneration() {
      if (!this.fileName && !this.fullFileContent) {
        return toast.info('请先导入资料');
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
            toast.success('已清空题库');
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
                this._consecutiveFailures = 0; // 二次解析成功，重置
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
      // 二次解析也失败，_consecutiveFailures 已在调用方递增
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
              this._consecutiveFailures = 0; // 成功，重置
              const merged = [...old, ...uniqueQs];
              this._saveQuestionBank(merged, uniqueQs.length);
              return;
            }
          }
        }
      } catch (e) {
        logger.error('[practice] 新格式处理异常:', e);
      }
      this._consecutiveFailures++;
      this.generatedCount++;
      this.readOffset += this.chunkSize;
    },

    _normalizeAndValidateQuestions(questions) {
      return normalizeAndValidateQuestions(questions);
    }
  }
};
