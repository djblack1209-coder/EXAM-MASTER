import { captureSession, assertSession } from '@/services/auth-storage.js';
/**
 * 智能题目生成 Mixin（分包动态加载）
 * 从 practice/index.vue 抽离，减小主包体积
 * 包含：文件导入、智能生成、题库持久化与备份
 */
import { storageService } from '@/services/storageService.js';
import { createImportRecord, updateImportRecordStatus } from '@/services/resource-intake-contract.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
// [勾] 以下模块从分包本地引用，避免打入主包
import { deduplicateQuestions } from '../utils/question-dedup-worker.js';
import { toast } from '@/utils/toast.js';
import {
  normalizeQuestion,
  isValidQuestion,
  normalizeAndValidateQuestions,
  sanitizeAIInput
} from '../utils/question-normalizer.js';
// ai.api 已移除，proxyAI 降级为 stub
async function proxyAI(_action, _data) {
  logger.warn('[ai-generation-mixin] proxyAI: ai.api 已移除，功能降级');
  return { code: -1, message: 'AI 服务已下线' };
}

export const aiGenerationMixin = {
  data() {
    return { generationSession: captureSession() };
  },
  methods: {
    // ==================== 文件导入 ====================
    chooseImportSource() {
      safeNavigateTo('/pages/practice-sub/question-bank');
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
      assertSession(this.generationSession);
      const records = storageService.get(this.uploadHistoryKey, []);
      const nextRecord = createImportRecord(record);
      records.unshift(nextRecord);
      storageService.saveDebounced(this.uploadHistoryKey, records, true, this.generationSession);
      return nextRecord.id;
    },

    updateUploadRecordStatus(status) {
      assertSession(this.generationSession);
      if (!this.currentUploadId) return;
      const records = storageService.get(this.uploadHistoryKey, []);
      const nextRecords = updateImportRecordStatus(records, this.currentUploadId, status);
      storageService.saveDebounced(this.uploadHistoryKey, nextRecords, true, this.generationSession);
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
        logger.warn('[practice] 连续 [省略] 次生成失败，自动暂停');
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
        logger.log('[practice] [智能] 调用后端代理生成题目...');
        const res = await proxyAI('generate_questions', {
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
          return this._saveQuestionBank([...old, ...uniqueQs], uniqueQs.length);
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
      toast.info('旧题库整理入口暂不可用，原资料已保留');
      return { success: false, code: 'EXPLICIT_MAINTENANCE_REQUIRED' };
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
      toast.info('旧题库整理入口暂不可用，原资料已保留');
      return { success: false, code: 'EXPLICIT_MAINTENANCE_REQUIRED' };
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
      // [勾] 修复：目标数量就是 totalQuestionsLimit，不应乘以 batchQuestionCount
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
    _saveQuestionBank() {
      toast.info('请从学习页开始新的练习，现有题库已保留');
      return { success: false, code: 'RETIRED_LEGACY_GENERATION' };
    },

    _restoreFromBackup() {
      toast.info('旧题库整理入口暂不可用，原资料已保留');
      return { success: false, code: 'EXPLICIT_MAINTENANCE_REQUIRED' };
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
                if (this._saveQuestionBank(merged, uniqueQs.length)?.success !== true) return;
                logger.log('[practice] 二次解析成功，生成 [省略] 道题目');
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
      logger.log('[practice] [勾] 检测到新格式响应，直接使用 data');
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
