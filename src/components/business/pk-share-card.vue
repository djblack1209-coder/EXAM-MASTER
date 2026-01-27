<template>
  <view class="pk-share-card" :class="{ 'show': visible }">
    <!-- 分享卡片内容 -->
    <view class="share-card-content" ref="cardRef">
      <!-- 头部背景 -->
      <view class="card-header">
        <view class="pk-badge">PK对战</view>
        <text class="card-title">{{ title || '来一场知识PK吧！' }}</text>
      </view>
      
      <!-- 对战双方信息 -->
      <view class="battle-info">
        <!-- 发起者 -->
        <view class="player-card inviter">
          <image 
            class="player-avatar" 
            :src="inviterInfo.avatar || defaultAvatar" 
            mode="aspectFill"
            @error="onAvatarError"
          />
          <text class="player-name">{{ inviterInfo.nickname || '我' }}</text>
          <view class="player-stats">
            <text class="stat-value">{{ inviterInfo.winRate || 0 }}%</text>
            <text class="stat-label">胜率</text>
          </view>
        </view>
        
        <!-- VS标识 -->
        <view class="vs-badge">
          <text class="vs-text">VS</text>
          <view class="vs-lightning"></view>
        </view>
        
        <!-- 被邀请者（占位） -->
        <view class="player-card invitee">
          <view class="player-avatar placeholder">
            <text class="placeholder-text">?</text>
          </view>
          <text class="player-name">等你来战</text>
          <view class="player-stats">
            <text class="stat-value">--</text>
            <text class="stat-label">胜率</text>
          </view>
        </view>
      </view>
      
      <!-- PK信息 -->
      <view class="pk-details">
        <view class="detail-item">
          <text class="detail-icon">📚</text>
          <text class="detail-text">{{ subjectName || '综合题库' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-icon">❓</text>
          <text class="detail-text">{{ questionCount || 10 }}道题</text>
        </view>
        <view class="detail-item">
          <text class="detail-icon">⏱️</text>
          <text class="detail-text">{{ timeLimit || 60 }}秒/题</text>
        </view>
      </view>
      
      <!-- 邀请码 -->
      <view class="invite-code-section" v-if="inviteCode">
        <text class="code-label">邀请码</text>
        <text class="code-value">{{ inviteCode }}</text>
      </view>
      
      <!-- 二维码区域 -->
      <view class="qrcode-section" v-if="showQrcode">
        <canvas 
          canvas-id="pkQrcode" 
          class="qrcode-canvas"
          :style="{ width: '120px', height: '120px' }"
        />
        <text class="qrcode-tip">扫码立即开战</text>
      </view>
      
      <!-- 底部信息 -->
      <view class="card-footer">
        <image class="app-logo" :src="appLogo" mode="aspectFit" />
        <text class="app-name">考试大师</text>
        <text class="footer-slogan">一起学习，共同进步</text>
      </view>
    </view>
    
    <!-- 操作按钮 -->
    <view class="share-actions">
      <button class="share-btn wechat" hover-class="btn-hover" open-type="share" @click="handleShareWechat">
        <text class="btn-icon">💬</text>
        <text class="btn-text">微信好友</text>
      </button>
      
      <button class="share-btn moments" hover-class="btn-hover" @click="handleShareMoments">
        <text class="btn-icon">🌐</text>
        <text class="btn-text">朋友圈</text>
      </button>
      
      <button class="share-btn copy" hover-class="btn-hover" @click="handleCopyLink">
        <text class="btn-icon">🔗</text>
        <text class="btn-text">复制链接</text>
      </button>
      
      <button class="share-btn save" hover-class="btn-hover" @click="handleSaveImage">
        <text class="btn-icon">💾</text>
        <text class="btn-text">保存图片</text>
      </button>
    </view>
    
    <!-- 关闭按钮 -->
    <view class="close-btn" @click="handleClose">
      <text class="close-icon">×</text>
    </view>
  </view>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { createInviteDeepLink, generateInviteCode } from '@/services/invite-deep-link'

export default {
  name: 'PKShareCard',
  
  props: {
    // 是否显示
    visible: {
      type: Boolean,
      default: false
    },
    // 卡片标题
    title: {
      type: String,
      default: ''
    },
    // 发起者信息
    inviterInfo: {
      type: Object,
      default: () => ({
        userId: '',
        nickname: '',
        avatar: '',
        winRate: 0
      })
    },
    // 科目名称
    subjectName: {
      type: String,
      default: ''
    },
    // 题目数量
    questionCount: {
      type: Number,
      default: 10
    },
    // 每题时限（秒）
    timeLimit: {
      type: Number,
      default: 60
    },
    // PK房间ID
    roomId: {
      type: String,
      default: ''
    },
    // 是否显示二维码
    showQrcode: {
      type: Boolean,
      default: true
    }
  },
  
  emits: ['close', 'share-success', 'share-fail'],
  
  setup(props, { emit }) {
    const cardRef = ref(null)
    const inviteCode = ref('')
    const shareLink = ref('')
    
    // 默认头像
    const defaultAvatar = '/static/images/default-avatar.png'
    const appLogo = '/static/images/logo.png'
    
    // 生成邀请码和链接
    const generateShareInfo = async () => {
      try {
        // 生成邀请码
        inviteCode.value = generateInviteCode({
          roomId: props.roomId,
          userId: props.inviterInfo.userId
        })
        
        // 生成深度链接
        shareLink.value = await createInviteDeepLink({
          type: 'pk',
          roomId: props.roomId,
          inviteCode: inviteCode.value,
          inviterId: props.inviterInfo.userId,
          subject: props.subjectName,
          questionCount: props.questionCount
        })
        
        // 生成二维码
        if (props.showQrcode) {
          generateQrcode(shareLink.value)
        }
        
      } catch (error) {
        console.error('[PKShareCard] Generate share info error:', error)
      }
    }
    
    // 生成二维码
    const generateQrcode = (url) => {
      // 使用uQRCode或其他二维码库
      // #ifdef MP-WEIXIN
      const qrcode = require('@/common/uqrcode.js')
      qrcode({
        canvasId: 'pkQrcode',
        text: url,
        size: 120,
        margin: 10,
        backgroundColor: '#ffffff',
        foregroundColor: '#000000'
      })
      // #endif
    }
    
    // 分享到微信好友
    const handleShareWechat = () => {
      // #ifdef MP-WEIXIN
      // 小程序环境使用open-type="share"自动处理
      // #endif
      
      // #ifdef H5 || APP-PLUS
      uni.share({
        provider: 'weixin',
        scene: 'WXSceneSession',
        type: 5, // 小程序
        title: props.title || `${props.inviterInfo.nickname}邀请你PK`,
        summary: `${props.subjectName} ${props.questionCount}道题，来一场知识对决！`,
        href: shareLink.value,
        imageUrl: props.inviterInfo.avatar || defaultAvatar,
        success: () => {
          emit('share-success', { platform: 'wechat' })
          showToast('分享成功')
        },
        fail: (err) => {
          emit('share-fail', { platform: 'wechat', error: err })
        }
      })
      // #endif
    }
    
    // 分享到朋友圈
    const handleShareMoments = async () => {
      // 先保存图片，再引导用户分享
      const imagePath = await saveCardAsImage()
      
      if (imagePath) {
        // #ifdef APP-PLUS
        uni.share({
          provider: 'weixin',
          scene: 'WXSceneTimeline',
          type: 2, // 图片
          imageUrl: imagePath,
          success: () => {
            emit('share-success', { platform: 'moments' })
          },
          fail: (err) => {
            emit('share-fail', { platform: 'moments', error: err })
          }
        })
        // #endif
        
        // #ifdef MP-WEIXIN || H5
        showToast('图片已保存，请手动分享到朋友圈')
        // #endif
      }
    }
    
    // 复制链接
    const handleCopyLink = () => {
      uni.setClipboardData({
        data: shareLink.value,
        success: () => {
          showToast('链接已复制')
          emit('share-success', { platform: 'copy' })
        },
        fail: () => {
          showToast('复制失败')
        }
      })
    }
    
    // 保存图片
    const handleSaveImage = async () => {
      const imagePath = await saveCardAsImage()
      if (imagePath) {
        showToast('图片已保存到相册')
        emit('share-success', { platform: 'save' })
      }
    }
    
    // 将卡片保存为图片
    const saveCardAsImage = () => {
      return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        uni.canvasToTempFilePath({
          canvasId: 'shareCardCanvas',
          success: (res) => {
            uni.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => resolve(res.tempFilePath),
              fail: reject
            })
          },
          fail: reject
        })
        // #endif
        
        // #ifdef H5
        // H5环境使用html2canvas
        import('html2canvas').then(({ default: html2canvas }) => {
          const element = document.querySelector('.share-card-content')
          html2canvas(element).then(canvas => {
            const link = document.createElement('a')
            link.download = `pk-invite-${Date.now()}.png`
            link.href = canvas.toDataURL()
            link.click()
            resolve(link.href)
          }).catch(reject)
        }).catch(reject)
        // #endif
        
        // #ifdef APP-PLUS
        // APP环境使用renderjs或原生截图
        resolve(null)
        // #endif
      })
    }
    
    // 显示提示
    const showToast = (title) => {
      uni.showToast({
        title,
        icon: 'none',
        duration: 2000
      })
    }
    
    // 关闭
    const handleClose = () => {
      emit('close')
    }
    
    // 监听显示状态
    watch(() => props.visible, (val) => {
      if (val) {
        generateShareInfo()
      }
    })
    
    // 小程序分享配置
    onMounted(() => {
      // #ifdef MP-WEIXIN
      uni.$on('onShareAppMessage', () => {
        return {
          title: props.title || `${props.inviterInfo.nickname}邀请你PK`,
          path: `/pages/practice/pk-battle?roomId=${props.roomId}&inviteCode=${inviteCode.value}`,
          imageUrl: '/static/images/pk-share-cover.png'
        }
      })
      // #endif
    })
    
    // 头像加载失败处理
    const onAvatarError = (e) => {
      e.target.src = defaultAvatar
    }
    
    return {
      cardRef,
      inviteCode,
      shareLink,
      defaultAvatar,
      appLogo,
      handleShareWechat,
      handleShareMoments,
      handleCopyLink,
      handleSaveImage,
      handleClose,
      onAvatarError
    }
  }
}
</script>

<style lang="scss" scoped>
.pk-share-card {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  
  &.show {
    opacity: 1;
    visibility: visible;
  }
}

.share-card-content {
  width: 300px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.card-header {
  padding: 20px;
  text-align: center;
  
  .pk-badge {
    display: inline-block;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    color: #fff;
    font-size: 12px;
    margin-bottom: 10px;
  }
  
  .card-title {
    display: block;
    color: #fff;
    font-size: 18px;
    font-weight: bold;
  }
}

.battle-info {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 20px;
  background: #fff;
}

.player-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .player-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 3px solid #667eea;
    
    &.placeholder {
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-style: dashed;
      
      .placeholder-text {
        font-size: 24px;
        color: var(--ds-color-text-tertiary, #999);
      }
    }
  }
  
  .player-name {
    margin-top: 8px;
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }
  
  .player-stats {
    margin-top: 4px;
    text-align: center;
    
    .stat-value {
      font-size: 16px;
      font-weight: bold;
      color: #667eea;
    }
    
    .stat-label {
      display: block;
      font-size: 10px;
      color: var(--ds-color-text-tertiary, #999);
    }
  }
}

.vs-badge {
  position: relative;
  
  .vs-text {
    font-size: 24px;
    font-weight: bold;
    color: #ff6b6b;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .vs-lightning {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 20px;
    background: url('/static/images/lightning.png') no-repeat center;
    background-size: contain;
  }
}

.pk-details {
  display: flex;
  justify-content: space-around;
  padding: 15px 20px;
  background: #f8f9fa;
  
  .detail-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .detail-icon {
      font-size: 20px;
      margin-bottom: 4px;
    }
    
    .detail-text {
      font-size: 12px;
      color: var(--ds-color-text-secondary, #666);
    }
  }
}

.invite-code-section {
  padding: 15px 20px;
  background: #fff;
  text-align: center;
  border-top: 1px dashed #eee;
  
  .code-label {
    font-size: 12px;
    color: var(--ds-color-text-tertiary, #999);
    margin-right: 10px;
  }
  
  .code-value {
    font-size: 18px;
    font-weight: bold;
    color: #667eea;
    letter-spacing: 2px;
  }
}

.qrcode-section {
  padding: 20px;
  background: #fff;
  text-align: center;
  
  .qrcode-canvas {
    margin: 0 auto;
  }
  
  .qrcode-tip {
    display: block;
    margin-top: 10px;
    font-size: 12px;
    color: var(--ds-color-text-tertiary, #999);
  }
}

.card-footer {
  padding: 15px 20px;
  background: linear-gradient(180deg, #764ba2 0%, #667eea 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  
  .app-logo {
    width: 24px;
    height: 24px;
    margin-right: 8px;
  }
  
  .app-name {
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    margin-right: 10px;
  }
  
  .footer-slogan {
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
  }
}

.share-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
  
  .share-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 12px;
    border: none;
    
    .btn-icon {
      font-size: 24px;
      margin-bottom: 4px;
    }
    
    .btn-text {
      font-size: 12px;
      color: #333;
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
}

.close-btn {
  position: absolute;
  top: 40px;
  right: 20px;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .close-icon {
    font-size: 24px;
    color: #fff;
  }
}
</style>
