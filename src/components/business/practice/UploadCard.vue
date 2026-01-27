<template>
  <view class="upload-card ds-card ds-flex ds-flex-col ds-touchable" :class="{ 'dark-mode': isDark }"
    @tap="handleUpload">
    <view class="upload-icon ds-touch-target">
      <view class="cloud-icon">☁️</view>
      <view class="arrow-icon">↑</view>
    </view>
    <text class="upload-title ds-text-xl ds-font-semibold">上传题库</text>
    <text class="upload-tip ds-text-xs ds-text-secondary">支持 .txt/.docx/.pdf 格式</text>
  </view>
</template>

<script setup>
import { ref } from 'vue'

// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['upload', 'success', 'error'])
const isUploading = ref(false)

const handleUpload = () => {
  if (isUploading.value) return
  
  // 显示上传选项
  uni.showActionSheet({
    itemList: ['从相册选择图片', '选择文件', '拍照上传'],
    success: (res) => {
      switch (res.tapIndex) {
        case 0:
          chooseImage()
          break
        case 1:
          chooseFile()
          break
        case 2:
          takePhoto()
          break
      }
    }
  })
}

// 从相册选择图片
const chooseImage = () => {
  uni.chooseImage({
    count: 9,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: (res) => {
      processFiles(res.tempFilePaths, 'image')
    },
    fail: (err) => {
      console.log('选择图片取消或失败:', err)
    }
  })
}

// 选择文件
const chooseFile = () => {
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 5,
    type: 'file',
    extension: ['txt', 'doc', 'docx', 'pdf'],
    success: (res) => {
      const files = res.tempFiles.map(f => ({
        path: f.path,
        name: f.name,
        size: f.size,
        type: 'file'
      }))
      processFiles(files, 'file')
    },
    fail: (err) => {
      console.log('选择文件取消或失败:', err)
      // 降级到图片选择
      uni.showModal({
        title: '提示',
        content: '当前环境不支持文件选择，是否改为选择图片？',
        success: (res) => {
          if (res.confirm) {
            chooseImage()
          }
        }
      })
    }
  })
  // #endif

  // #ifndef MP-WEIXIN
  // 非微信环境，提示用户
  uni.showModal({
    title: '选择文件',
    content: '请选择 txt、doc、docx 或 pdf 格式的文件',
    confirmText: '选择图片',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        chooseImage()
      }
    }
  })
  // #endif
}

// 拍照上传
const takePhoto = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['camera'],
    success: (res) => {
      processFiles(res.tempFilePaths, 'photo')
    },
    fail: (err) => {
      console.log('拍照取消或失败:', err)
    }
  })
}

// 处理上传的文件
const processFiles = (files, type) => {
  isUploading.value = true
  uni.showLoading({ title: '处理中...' })
  
  // 保存文件信息到本地存储
  const importedFiles = uni.getStorageSync('imported_files') || []
  const now = new Date()
  const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
  
  let newFiles = []
  
  if (type === 'file' && Array.isArray(files) && files[0]?.name) {
    // 文件类型
    newFiles = files.map(f => ({
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: f.name,
      path: f.path,
      size: Math.round((f.size || 0) / 1024),
      date: dateStr,
      source: '文件导入',
      status: 'pending',
      type: 'file'
    }))
  } else {
    // 图片类型
    const paths = Array.isArray(files) ? files : [files]
    newFiles = paths.map((path, idx) => ({
      id: Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 9),
      name: type === 'photo' ? `拍照_${dateStr.replace(/[\/\s:]/g, '')}.jpg` : `图片_${idx + 1}.jpg`,
      path: path,
      size: 0,
      date: dateStr,
      source: type === 'photo' ? '拍照上传' : '相册导入',
      status: 'pending',
      type: 'image'
    }))
  }
  
  // 合并并保存
  const updatedFiles = [...newFiles, ...importedFiles]
  uni.setStorageSync('imported_files', updatedFiles)
  
  uni.hideLoading()
  isUploading.value = false
  
  uni.showToast({ 
    title: `已添加 ${newFiles.length} 个文件`, 
    icon: 'success' 
  })
  
  // 触发事件
  emit('upload', newFiles)
  emit('success', { files: newFiles, total: updatedFiles.length })
  
  // 提示用户下一步操作
  setTimeout(() => {
    uni.showModal({
      title: '文件已添加',
      content: '是否立即使用 AI 生成题目？',
      confirmText: '立即生成',
      cancelText: '稍后处理',
      success: (res) => {
        if (res.confirm) {
          // 跳转到资料导入页面进行 AI 处理
          uni.navigateTo({ url: '/pages/practice/import-data' })
        }
      }
    })
  }, 1500)
}
</script>

<style lang="scss" scoped>
.upload-card {
  background-color: var(--ds-bg-primary);
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  margin-bottom: 30rpx;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
  transition: all 150ms ease-out;

  &:active {
    transform: scale(0.98);
  }
}

.upload-icon {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, var(--ds-success) 0%, var(--ds-success-dark) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
  transition: all 150ms ease-out;
}

.cloud-icon {
  font-size: 60rpx;
  position: absolute;
  top: 20rpx;
}

.arrow-icon {
  font-size: 50rpx;
  color: var(--bg-card);
  font-weight: bold;
  margin-top: 10rpx;
}

.upload-title {
  color: var(--ds-text-primary);
  margin-bottom: 16rpx;
}

.upload-tip {
  color: var(--ds-text-secondary);
}

/* 深色模式 */
. {
  .upload-card {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .arrow-icon {
    color: #1c1c1e;
  }
}
</style>
