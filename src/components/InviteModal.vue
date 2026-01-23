<template>
  <view class="modal-mask" @click.self="$emit('close')">
    <view class="modal-container" @tap.stop>
      <view class="close-btn" @click="$emit('close')">
        <text class="close-icon-text">✕</text>
      </view>

      <view class="header-brand">
        <text class="brand-logo-text">📚</text>
        <text class="brand-name">Exam-Master</text>
      </view>
      <text class="title">邀请好友，研途有你</text>
      <text class="subtitle">送TA一份备考神器，并肩作战，一战成硕！</text>

      <view class="ticket-container">
        <view class="ticket-inner">
          <text class="code-label">{{ inviteCode }}</text>
          <text class="code-desc">我的邀请码 (真实可用)</text>
        </view>
      </view>

      <view class="link-row">
        <view class="link-box">
          <text class="link-icon-text">🔗</text>
          <text class="link-text">{{ inviteLink }}</text>
        </view>
        <view class="copy-btn" @click="copyLink">
          <text>复制</text>
        </view>
      </view>

      <view class="qr-preview">
        <image :src="qrCodeUrl" mode="aspectFit" style="width: 100px; height: 100px;"></image>
        <text class="qr-tip">微信扫一扫，立刻加入</text>
      </view>

      <view class="wechat-btn" @click="shareToWechat">
        <text class="wechat-icon-text">💬</text>
        <text class="btn-text">分享给微信好友</text>
      </view>
      
      <view class="poster-btn" @click="openPoster">
        <text class="poster-icon-text">🎨</text>
        <text class="btn-text">生成分享海报</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    inviteCode: {
      type: String,
      default: 'EXAM8888'
    }
  },
  emits: ['close', 'openPoster'],
  computed: {
    // 构造真实的 App 启动链接 (Schemes) 或 Web 链接
    inviteLink() {
      return `https://exam-master.com/join?c=${this.inviteCode}`;
    },
    // 使用公开 API 动态生成二维码
    qrCodeUrl() {
      // 这里的 data 填入你的真实链接
      return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(this.inviteLink)}`;
    }
  },
  methods: {
    // 功能 2: 复制链接
    copyLink() {
      uni.setClipboardData({
        data: `考研神器 Exam-Master，我的邀请码是【${this.inviteCode}】，快来一起刷题！链接：${this.inviteLink}`,
        success: () => {
          uni.showToast({ title: '口令已复制', icon: 'none' });
        }
      });
    },
    // 功能 3: 分享
    shareToWechat() {
      // 尝试使用 uni.share (如果平台支持)
      if (typeof uni.share !== 'undefined') {
        uni.share({
          provider: "weixin",
          scene: "WXSceneSession",
          type: 0,
          href: this.inviteLink,
          title: "Exam-Master 考研神器",
          summary: "输入我的邀请码 " + this.inviteCode + " 领取会员！",
          imageUrl: "/static/tabbar/practice-active.png", // 使用本地图标
          success: function (res) {
            console.log("success:" + JSON.stringify(res));
          },
          fail: (err) => {
            console.log("share fail:", err);
            uni.showToast({ title: '分享功能开发中', icon: 'none' });
          }
        });
      } else {
        // 模拟反馈
        uni.showToast({ title: '正在调起微信分享...', icon: 'none' });
      }
    },
    // 功能 4: 打开海报生成
    openPoster() {
      this.$emit('openPoster');
    }
  }
};
</script>

<style lang="scss" scoped>
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-container {
  width: 320px;
  background: #FFFFFF;
  border-radius: 20px;
  padding: 24px 20px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  
  &:active {
    opacity: 0.6;
  }
}

.header-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.brand-logo {
  width: 50px;
  height: 50px;
  margin-bottom: 8px;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  color: #07C160;
  -webkit-font-smoothing: antialiased;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  text-align: center;
  margin-bottom: 8px;
  -webkit-font-smoothing: antialiased;
}

.subtitle {
  font-size: 13px;
  color: #666;
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Ticket Style */
.ticket-container {
  width: 100%;
  background-color: #07C160;
  border-radius: 12px;
  padding: 8px; /* Outer spacing for dashed border */
  margin-bottom: 20px;
}

.ticket-inner {
  border: 2px dashed rgba(255,255,255,0.6);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
}

.code-label {
  font-size: 32px;
  font-weight: 800;
  color: white;
  letter-spacing: 1px;
  -webkit-font-smoothing: antialiased;
}

.code-desc {
  font-size: 12px;
  color: rgba(255,255,255,0.9);
  margin-top: 4px;
  -webkit-font-smoothing: antialiased;
}

/* Link Row */
.link-row {
  width: 100%;
  display: flex;
  margin-bottom: 20px;
}

.link-box {
  flex: 1;
  background-color: #F5F7FA;
  border-radius: 20px 0 0 20px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  height: 40px;
  min-width: 0;
}

.link-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  opacity: 0.5;
  flex-shrink: 0;
}

.link-icon-text {
  font-size: 16px;
  margin-right: 8px;
  opacity: 0.5;
  flex-shrink: 0;
}

.close-icon-text {
  font-size: 20px;
  color: #999;
  font-weight: bold;
}

.brand-logo-text {
  font-size: 50px;
  margin-bottom: 8px;
  display: block;
}

.link-text {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-font-smoothing: antialiased;
}

.copy-btn {
  width: 70px;
  background-color: #07C160;
  color: white;
  border-radius: 0 20px 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  
  &:active {
    opacity: 0.85;
    background-color: #05a050;
  }
}

.wechat-btn {
  width: 100%;
  height: 44px;
  background-color: #07C160;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
  -webkit-tap-highlight-color: transparent;
  
  &:active {
    opacity: 0.85;
    transform: scale(0.98);
  }
}

.poster-btn {
  width: 100%;
  height: 44px;
  background-color: #FFD700;
  border: 1px solid #FFA500;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
  -webkit-tap-highlight-color: transparent;
  
  &:active {
    opacity: 0.9;
    transform: scale(0.98);
    background-color: #FFC107;
  }
}

.poster-icon-text {
  font-size: 20px;
  margin-right: 8px;
  flex-shrink: 0;
}

.poster-btn .btn-text {
  color: #333;
  font-weight: 600;
}

.wechat-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  flex-shrink: 0;
}

.wechat-icon-text {
  font-size: 24px;
  margin-right: 8px;
  flex-shrink: 0;
}

.btn-text {
  color: white;
  font-size: 15px;
  font-weight: 600;
  -webkit-font-smoothing: antialiased;
}

.qr-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.qr-tip {
  font-size: 10px;
  color: #999;
  margin-top: 4px;
  -webkit-font-smoothing: antialiased;
}
</style>
