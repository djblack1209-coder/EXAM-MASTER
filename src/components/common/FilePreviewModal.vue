<template>
  <view class="preview-modal-mask" v-if="visible" @tap="handleMaskClick">
    <view class="preview-card" @tap.stop>
      <view class="preview-header">
        <text class="preview-title">文件预览</text>
        <view class="close-btn" @tap="handleClose">
          <text class="close-icon">✕</text>
        </view>
      </view>
      
      <view class="preview-body">
        <!-- 文件信息 -->
        <view class="file-info-section">
          <view class="info-row">
            <text class="info-label">文件名：</text>
            <text class="info-value">{{ fileData.name }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">大小：</text>
            <text class="info-value">{{ formatSize(fileData.size) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">类型：</text>
            <text class="info-value">{{ fileData.type }}</text>
          </view>
        </view>
        
        <!-- 内容预览 -->
        <view class="content-preview-section">
          <text class="section-title">内容预览</text>
          <scroll-view class="content-scroll" scroll-y>
            <text class="content-text">{{ previewContent }}</text>
          </scroll-view>
        </view>
      </view>
      
      <view class="preview-footer">
        <button class="preview-btn cancel" hover-class="btn-hover" @tap="handleClose">取消</button>
        <button class="preview-btn confirm" hover-class="btn-hover" @tap="handleConfirm">确认上传</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'FilePreviewModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    fileData: {
      type: Object,
      default: () => ({
        name: '',
        size: 0,
        type: '',
        content: ''
      })
    }
  },
  computed: {
    previewContent() {
      if (!this.fileData.content) {
        return '无法预览此文件类型的内容';
      }
      // 限制预览长度为前1000个字符
      const maxLength = 1000;
      if (this.fileData.content.length > maxLength) {
        return this.fileData.content.substring(0, maxLength) + '\n\n... (内容过长，仅显示前1000字符)';
      }
      return this.fileData.content;
    }
  },
  methods: {
    formatSize(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    handleMaskClick() {
      this.handleClose();
    },
    handleClose() {
      this.$emit('close');
    },
    handleConfirm() {
      this.$emit('confirm');
    }
  }
}
</script>

<style scoped>
.preview-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.preview-card {
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.preview-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:active {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(0.95);
}

.close-icon {
  font-size: 18px;
  color: #fff;
}

.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.file-info-section {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 14px;
  color: var(--ds-color-text-tertiary, #8E8E93);
  min-width: 60px;
}

.info-value {
  font-size: 14px;
  color: #fff;
  flex: 1;
  word-break: break-all;
}

.content-preview-section {
  margin-top: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
  display: block;
}

.content-scroll {
  max-height: 300px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 16px;
}

.content-text {
  font-size: 13px;
  color: #E4E4E7;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
}

.preview-footer {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 12px;
}

.preview-btn {
  flex: 1;
  height: 48px;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  transition: all 0.2s;
}

.preview-btn::after {
  border: none;
}

.preview-btn:active {
  transform: scale(0.97);
}

.preview-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.preview-btn.confirm {
  background: linear-gradient(135deg, #0A84FF, #005BEA);
  color: white;
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.3);
}
</style>