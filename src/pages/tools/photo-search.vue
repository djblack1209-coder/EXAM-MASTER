<template>
  <view class="photo-search-container">
    <!-- 顶部标题栏 -->
    <view class="header">
      <text class="title">拍照搜题</text>
      <text class="subtitle">拍照或上传题目图片，AI智能识别解答</text>
    </view>
    
    <!-- 相机/预览区域 -->
    <view class="camera-area">
      <!-- 相机模式 -->
      <camera 
        v-if="mode === 'camera'" 
        device-position="back" 
        flash="auto"
        @error="onCameraError"
        class="camera-preview"
      >
        <!-- 取景框 -->
        <view class="viewfinder">
          <view class="corner top-left"></view>
          <view class="corner top-right"></view>
          <view class="corner bottom-left"></view>
          <view class="corner bottom-right"></view>
        </view>
        <text class="camera-tip">将题目放入框内，保持清晰</text>
      </camera>
      
      <!-- 预览模式 -->
      <view v-else-if="mode === 'preview'" class="preview-area">
        <image :src="previewImage" mode="aspectFit" class="preview-image" />
        
        <!-- 识别中遮罩 -->
        <view v-if="isRecognizing" class="loading-overlay">
          <view class="loading-spinner"></view>
          <text class="loading-text">{{ loadingText }}</text>
          <text class="loading-tips">{{ currentTip }}</text>
        </view>
      </view>
      
      <!-- 结果模式 -->
      <view v-else-if="mode === 'result'" class="result-area">
        <scroll-view scroll-y class="result-scroll">
          <!-- 识别文本 -->
          <view class="result-section">
            <view class="section-header">
              <text class="section-title">识别结果</text>
              <text class="confidence">置信度: {{ (result.confidence * 100).toFixed(0) }}%</text>
            </view>
            <view class="recognized-text">
              <text>{{ result.recognizedText }}</text>
            </view>
          </view>
          
          <!-- 匹配题目 -->
          <view v-if="result.questions && result.questions.length > 0" class="result-section">
            <view class="section-header">
              <text class="section-title">题库匹配</text>
              <text class="match-count">找到 {{ result.questions.length }} 道相似题</text>
            </view>
            <view 
              v-for="(q, idx) in result.questions" 
              :key="idx" 
              class="question-card"
              @click="viewQuestion(q)"
            >
              <text class="question-text">{{ q.question }}</text>
              <view class="question-meta">
                <text class="category">{{ q.category || '综合' }}</text>
                <text class="difficulty">难度: {{ q.difficulty || 3 }}</text>
              </view>
            </view>
          </view>
          
          <!-- AI解析 -->
          <view v-if="result.aiGenerated" class="result-section">
            <view class="section-header">
              <text class="section-title">AI智能解析</text>
            </view>
            <view class="ai-analysis">
              <!-- 解题步骤 -->
              <view v-if="result.aiGenerated.analysis && result.aiGenerated.analysis.steps" class="analysis-block">
                <text class="block-title">解题步骤</text>
                <view v-for="(step, idx) in result.aiGenerated.analysis.steps" :key="idx" class="step-item">
                  <text class="step-num">{{ idx + 1 }}</text>
                  <text class="step-text">{{ step }}</text>
                </view>
              </view>
              
              <!-- 参考答案 -->
              <view v-if="result.aiGenerated.answer" class="analysis-block">
                <text class="block-title">参考答案</text>
                <text class="answer-text">{{ result.aiGenerated.answer }}</text>
              </view>
              
              <!-- 考点 -->
              <view v-if="result.aiGenerated.analysis && result.aiGenerated.analysis.keyPoints && result.aiGenerated.analysis.keyPoints.length > 0" class="analysis-block">
                <text class="block-title">考查知识点</text>
                <view class="tags">
                  <text 
                    v-for="(point, idx) in result.aiGenerated.analysis.keyPoints" 
                    :key="idx" 
                    class="tag"
                  >{{ point }}</text>
                </view>
              </view>
              
              <!-- 易错点 -->
              <view v-if="result.aiGenerated.commonMistakes && result.aiGenerated.commonMistakes.length > 0" class="analysis-block">
                <text class="block-title">易错提醒</text>
                <view v-for="(mistake, idx) in result.aiGenerated.commonMistakes" :key="idx" class="mistake-item">
                  <text class="warning-icon">!</text>
                  <text>{{ mistake }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    
    <!-- 底部操作栏 -->
    <view class="action-bar">
      <!-- 相机模式按钮 -->
      <template v-if="mode === 'camera'">
        <button class="btn-secondary" hover-class="btn-hover" @click="chooseFromAlbum">
          <text class="btn-icon">相册</text>
        </button>
        <button class="btn-primary btn-capture" hover-class="btn-hover" @click="takePhoto">
          <view class="capture-ring"></view>
        </button>
        <button class="btn-secondary" hover-class="btn-hover" @click="selectSubject">
          <text class="btn-icon">{{ selectedSubjectLabel || '学科' }}</text>
        </button>
      </template>
      
      <!-- 预览模式按钮 -->
      <template v-else-if="mode === 'preview'">
        <button class="btn-secondary" hover-class="btn-hover" @click="retake" :disabled="isRecognizing">
          <text>重新拍摄</text>
        </button>
        <button class="btn-primary" hover-class="btn-hover" @click="startRecognize" :disabled="isRecognizing">
          <text>{{ isRecognizing ? '识别中...' : '开始识别' }}</text>
        </button>
      </template>
      
      <!-- 结果模式按钮 -->
      <template v-else-if="mode === 'result'">
        <button class="btn-secondary" hover-class="btn-hover" @click="retake">
          <text>重新搜题</text>
        </button>
        <button class="btn-primary" hover-class="btn-hover" @click="addToMistake" v-if="result.questions && result.questions.length > 0">
          <text>加入错题本</text>
        </button>
        <button class="btn-ghost" hover-class="btn-hover" @click="searchSimilar">
          <text>找相似题</text>
        </button>
      </template>
    </view>
  </view>
</template>

<script>
import { lafService } from '../../services/lafService.js'
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

export default {
  data() {
    return {
      mode: 'camera', // camera | preview | result
      previewImage: null,
      isRecognizing: false,
      loadingText: 'AI正在识别题目...',
      currentTip: '',
      result: null,
      selectedSubject: '',
      subjects: [
        { label: '全部', value: '' },
        { label: '政治', value: 'politics' },
        { label: '英语', value: 'english' },
        { label: '数学', value: 'math' },
        { label: '专业课', value: 'major' }
      ],
      loadingTips: [
        '正在识别文字...',
        '正在分析题目结构...',
        '正在匹配题库...',
        '正在生成解析...'
      ],
      tipIndex: 0,
      tipTimer: null
    }
  },
  
  computed: {
    selectedSubjectLabel() {
      const found = this.subjects.find(s => s.value === this.selectedSubject)
      return found ? found.label : '学科'
    }
  },
  
  onLoad() {
    // 检查相机权限
    this.checkCameraPermission()
  },
  
  onUnload() {
    this.clearTipTimer()
  },
  
  methods: {
    // 检查相机权限
    async checkCameraPermission() {
      // #ifdef MP-WEIXIN
      try {
        const setting = await uni.getSetting()
        if (setting.authSetting && setting.authSetting['scope.camera'] === false) {
          uni.showModal({
            title: '提示',
            content: '需要相机权限才能拍照搜题，是否前往设置？',
            success: (res) => {
              if (res.confirm) {
                uni.openSetting()
              }
            }
          })
        }
      } catch (e) {
        logger.error('检查权限失败:', e)
      }
      // #endif
    },
    
    // 相机错误处理
    onCameraError(e) {
      logger.error('相机错误:', e)
      uni.showToast({ 
        title: '相机初始化失败，请检查权限', 
        icon: 'none',
        duration: 2000
      })
    },
    
    // 拍照
    takePhoto() {
      const ctx = uni.createCameraContext()
      ctx.takePhoto({
        quality: 'high',
        success: (res) => {
          this.previewImage = res.tempImagePath
          this.mode = 'preview'
          // 自动开始识别
          this.startRecognize()
        },
        fail: (err) => {
          logger.error('拍照失败:', err)
          uni.showToast({ title: '拍照失败', icon: 'none' })
        }
      })
    },
    
    // 从相册选择
    chooseFromAlbum() {
      uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
          this.previewImage = res.tempFilePaths[0]
          this.mode = 'preview'
          // 自动开始识别
          this.startRecognize()
        },
        fail: (err) => {
          if (err.errMsg !== 'chooseImage:fail cancel') {
            logger.error('选择图片失败:', err)
            uni.showToast({ title: '选择图片失败', icon: 'none' })
          }
        }
      })
    },
    
    // 开始识别
    async startRecognize() {
      if (this.isRecognizing) return
      
      this.isRecognizing = true
      this.currentTip = this.loadingTips[0]
      this.startTipRotation()
      
      try {
        // 图片转base64
        const base64 = await this.imageToBase64(this.previewImage)
        
        // 调用云函数
        const response = await lafService.photoSearch(base64, {
          subject: this.selectedSubject
        })
        
        if (response.code === 0 && response.data) {
          this.result = response.data
          this.mode = 'result'
          
          // 显示识别来源
          const sources = response.data.recognitionSources
          if (sources) {
            logger.log('识别来源 - 视觉AI:', sources.vision, ', OCR:', sources.ocr)
          }
        } else {
          throw new Error(response.message || '识别失败')
        }
        
      } catch (error) {
        logger.error('识别失败:', error)
        uni.showModal({
          title: '识别失败',
          content: error.message || '请确保题目清晰、光线充足',
          showCancel: false
        })
        // 识别失败回到预览模式，允许重试
        this.mode = 'preview'
      } finally {
        this.isRecognizing = false
        this.clearTipTimer()
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
            logger.error('读取文件失败:', err)
            reject(new Error('读取图片失败'))
          }
        })
        // #endif
        
        // #ifdef H5
        // H5环境使用canvas转换
        const img = new Image()
        img.crossOrigin = 'Anonymous'
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          const dataURL = canvas.toDataURL('image/jpeg', 0.9)
          resolve(dataURL.split(',')[1])
        }
        img.onerror = () => reject(new Error('加载图片失败'))
        img.src = path
        // #endif
        
        // #ifdef APP-PLUS
        plus.io.resolveLocalFileSystemURL(path, (entry) => {
          entry.file((file) => {
            const reader = new plus.io.FileReader()
            reader.onloadend = (e) => {
              const base64 = e.target.result.split(',')[1]
              resolve(base64)
            }
            reader.onerror = () => reject(new Error('读取图片失败'))
            reader.readAsDataURL(file)
          })
        }, () => reject(new Error('解析路径失败')))
        // #endif
      })
    },
    
    // 开始提示轮换
    startTipRotation() {
      this.tipIndex = 0
      this.currentTip = this.loadingTips[0]
      
      this.tipTimer = setInterval(() => {
        this.tipIndex = (this.tipIndex + 1) % this.loadingTips.length
        this.currentTip = this.loadingTips[this.tipIndex]
      }, 2000)
    },
    
    // 清除提示定时器
    clearTipTimer() {
      if (this.tipTimer) {
        clearInterval(this.tipTimer)
        this.tipTimer = null
      }
    },
    
    // 重新拍摄
    retake() {
      this.previewImage = null
      this.result = null
      this.mode = 'camera'
    },
    
    // 选择学科 - 使用原生 ActionSheet
    selectSubject() {
      const itemList = this.subjects.map(s => s.label)
      
      uni.showActionSheet({
        itemList,
        success: (res) => {
          this.selectedSubject = this.subjects[res.tapIndex].value
        },
        fail: (err) => {
          if (err.errMsg !== 'showActionSheet:fail cancel') {
            logger.error('选择学科失败:', err)
          }
        }
      })
    },
    
    // 查看题目详情
    viewQuestion(question) {
      const id = question._id || question.id
      if (id) {
        uni.navigateTo({
          url: `/pages/practice/question-detail?id=${id}`
        })
      }
    },
    
    // 加入错题本
    async addToMistake() {
      if (this.result && this.result.questions && this.result.questions.length > 0) {
        const question = this.result.questions[0]
        uni.showLoading({ title: '添加中...', mask: false })
        try {
          // 调用错题本服务
          await lafService.addMistake({
            questionId: question._id || question.id,
            question: question.question,
            source: 'photo_search'
          })
          uni.hideLoading()
          uni.showToast({ title: '已加入错题本', icon: 'success' })
        } catch (e) {
          uni.hideLoading()
          logger.error('加入错题本失败:', e)
          uni.showToast({ title: '加入失败', icon: 'none' })
        }
      }
    },
    
    // 搜索相似题
    searchSimilar() {
      if (this.result && this.result.recognizedText) {
        // 取前50个字符作为搜索关键词
        const keyword = this.result.recognizedText.substring(0, 50)
        uni.navigateTo({
          url: `/pages/practice/index?search=${encodeURIComponent(keyword)}`
        })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.photo-search-container {
  min-height: 100vh;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
}

.header {
  padding: 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  
  .title {
    font-size: 36rpx;
    font-weight: bold;
    display: block;
  }
  
  .subtitle {
    font-size: 24rpx;
    opacity: 0.8;
    margin-top: 10rpx;
    display: block;
  }
}

.camera-area {
  flex: 1;
  position: relative;
  margin: 20rpx;
  border-radius: 20rpx;
  overflow: hidden;
  background: #000;
}

.camera-preview {
  width: 100%;
  height: 100%;
  min-height: 600rpx;
}

.viewfinder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  height: 300rpx;
  border: 2rpx dashed rgba(255, 255, 255, 0.5);
  
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
    }
    
    &.top-right {
      top: -2rpx;
      right: -2rpx;
      border-width: 4rpx 4rpx 0 0;
    }
    
    &.bottom-left {
      bottom: -2rpx;
      left: -2rpx;
      border-width: 0 0 4rpx 4rpx;
    }
    
    &.bottom-right {
      bottom: -2rpx;
      right: -2rpx;
      border-width: 0 4rpx 4rpx 0;
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
  padding: 10rpx 30rpx;
  border-radius: 30rpx;
}

.preview-area {
  width: 100%;
  height: 100%;
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
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  .loading-spinner {
    width: 60rpx;
    height: 60rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .loading-text {
    color: #fff;
    font-size: 28rpx;
    margin-top: 20rpx;
  }
  
  .loading-tips {
    color: rgba(255, 255, 255, 0.7);
    font-size: 24rpx;
    margin-top: 10rpx;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-area {
  width: 100%;
  height: 100%;
  background: var(--bg-card);
}

.result-scroll {
  height: 100%;
  padding: 20rpx;
}

.result-section {
  margin-bottom: 30rpx;
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15rpx;
    
    .section-title {
      font-size: 30rpx;
      font-weight: bold;
      color: var(--text-main);
    }
    
    .confidence, .match-count {
      font-size: 24rpx;
      color: var(--text-sub);
    }
  }
}

.recognized-text {
  background: var(--bg-secondary);
  padding: 20rpx;
  border-radius: 10rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--text-main);
}

.question-card {
  background: var(--bg-secondary);
  padding: 20rpx;
  border-radius: 10rpx;
  margin-bottom: 15rpx;
  
  .question-text {
    font-size: 28rpx;
    color: var(--text-main);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .question-meta {
    display: flex;
    gap: 20rpx;
    margin-top: 15rpx;
    
    .category, .difficulty {
      font-size: 22rpx;
      color: var(--text-sub);
      background: var(--bg-secondary);
      padding: 5rpx 15rpx;
      border-radius: 5rpx;
    }
  }
}

.ai-analysis {
  background: var(--bg-secondary);
  padding: 20rpx;
  border-radius: 10rpx;
}

.analysis-block {
  margin-bottom: 25rpx;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .block-title {
    font-size: 26rpx;
    font-weight: bold;
    color: #667eea;
    margin-bottom: 10rpx;
    display: block;
  }
}

.step-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10rpx;
  
  .step-num {
    width: 40rpx;
    height: 40rpx;
    background: #667eea;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    flex-shrink: 0;
    margin-right: 15rpx;
  }
  
  .step-text {
    font-size: 26rpx;
    color: var(--text-main);
    line-height: 1.6;
    flex: 1;
  }
}

.answer-text {
  font-size: 28rpx;
  color: #4CAF50;
  font-weight: bold;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  
  .tag {
    font-size: 22rpx;
    color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
  }
}

.mistake-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10rpx;
  
  .warning-icon {
    width: 36rpx;
    height: 36rpx;
    background: #ff9800;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: bold;
    flex-shrink: 0;
    margin-right: 15rpx;
  }
  
  text:last-child {
    font-size: 26rpx;
    color: var(--text-sub);
    line-height: 1.6;
  }
}

.action-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30rpx;
  padding: 30rpx;
  background: var(--bg-card);
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
  
  button {
    border: none;
    font-size: 28rpx;
    
    &::after {
      border: none;
    }
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    padding: 20rpx 50rpx;
    border-radius: 50rpx;
    
    &:disabled {
      opacity: 0.6;
    }
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-main);
    padding: 20rpx 40rpx;
    border-radius: 50rpx;
    
    &:disabled {
      opacity: 0.6;
    }
  }
  
  .btn-ghost {
    background: transparent;
    color: #667eea;
    padding: 20rpx 30rpx;
  }
  
  .btn-capture {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .capture-ring {
      width: 80rpx;
      height: 80rpx;
      border: 6rpx solid #fff;
      border-radius: 50%;
    }
  }
}
</style>
