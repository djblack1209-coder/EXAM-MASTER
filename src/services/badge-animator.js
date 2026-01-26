/**
 * 徽章动画效果服务
 * 检查点4.3: 学习成就系统 - 徽章动画
 * 
 * 功能：
 * - 成就解锁动画效果
 * - 徽章展示动画
 * - 粒子特效
 * - 音效播放
 */

import { ref, reactive, nextTick } from 'vue'

// 动画类型
const ANIMATION_TYPE = {
  UNLOCK: 'unlock',           // 解锁动画
  SHOWCASE: 'showcase',       // 展示动画
  PULSE: 'pulse',             // 脉冲动画
  SHINE: 'shine',             // 闪光动画
  BOUNCE: 'bounce'            // 弹跳动画
}

// 稀有度对应的动画配置
const RARITY_CONFIG = {
  common: {
    color: '#909399',
    particleCount: 10,
    duration: 1500,
    sound: 'unlock_common'
  },
  rare: {
    color: '#409eff',
    particleCount: 20,
    duration: 2000,
    sound: 'unlock_rare'
  },
  epic: {
    color: '#9b59b6',
    particleCount: 30,
    duration: 2500,
    sound: 'unlock_epic'
  },
  legendary: {
    color: '#f39c12',
    particleCount: 50,
    duration: 3000,
    sound: 'unlock_legendary'
  }
}

class BadgeAnimator {
  constructor() {
    // 动画状态
    this.state = reactive({
      isAnimating: false,
      currentAchievement: null,
      animationType: null,
      particles: [],
      progress: 0
    })
    
    // 动画容器ID
    this.containerId = 'badge-animation-container'
    
    // 音效实例
    this.audioContext = null
    this.sounds = {}
    
    // 初始化
    this._init()
  }
  
  /**
   * 初始化
   */
  _init() {
    // 预加载音效
    this._preloadSounds()
  }
  
  /**
   * 预加载音效
   */
  _preloadSounds() {
    // #ifdef H5
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('[BadgeAnimator] AudioContext not supported')
    }
    // #endif
  }
  
  /**
   * 显示解锁动画
   * @param {Object} achievement - 成就对象
   * @returns {Promise} 动画完成Promise
   */
  async showUnlock(achievement) {
    if (this.state.isAnimating) {
      // 等待当前动画完成
      await this._waitForAnimation()
    }
    
    return new Promise(async (resolve) => {
      this.state.isAnimating = true
      this.state.currentAchievement = achievement
      this.state.animationType = ANIMATION_TYPE.UNLOCK
      
      const config = RARITY_CONFIG[achievement.rarity] || RARITY_CONFIG.common
      
      // 创建动画容器
      await this._createAnimationContainer()
      
      // 播放音效
      this._playSound(config.sound)
      
      // 执行动画序列
      await this._runUnlockSequence(achievement, config)
      
      // 清理
      this._cleanup()
      
      this.state.isAnimating = false
      this.state.currentAchievement = null
      
      resolve()
    })
  }
  
  /**
   * 创建动画容器
   */
  async _createAnimationContainer() {
    // #ifdef H5
    let container = document.getElementById(this.containerId)
    
    if (!container) {
      container = document.createElement('div')
      container.id = this.containerId
      container.innerHTML = `
        <div class="badge-animation-overlay">
          <div class="badge-animation-content">
            <div class="badge-icon-wrapper">
              <div class="badge-icon"></div>
              <div class="badge-glow"></div>
              <div class="badge-ring"></div>
            </div>
            <div class="badge-info">
              <div class="badge-title"></div>
              <div class="badge-name"></div>
              <div class="badge-description"></div>
              <div class="badge-reward"></div>
            </div>
            <div class="particles-container"></div>
          </div>
        </div>
      `
      document.body.appendChild(container)
      
      // 添加样式
      this._injectStyles()
    }
    // #endif
    
    await nextTick()
  }
  
  /**
   * 注入动画样式
   */
  _injectStyles() {
    // #ifdef H5
    const styleId = 'badge-animator-styles'
    if (document.getElementById(styleId)) return
    
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .badge-animation-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .badge-animation-overlay.show {
        opacity: 1;
      }
      
      .badge-animation-content {
        text-align: center;
        transform: scale(0.5);
        opacity: 0;
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }
      
      .badge-animation-overlay.show .badge-animation-content {
        transform: scale(1);
        opacity: 1;
      }
      
      .badge-icon-wrapper {
        position: relative;
        width: 120px;
        height: 120px;
        margin: 0 auto 20px;
      }
      
      .badge-icon {
        width: 100%;
        height: 100%;
        font-size: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        position: relative;
        z-index: 2;
        animation: badgePop 0.6s ease-out;
      }
      
      .badge-glow {
        position: absolute;
        top: -10px;
        left: -10px;
        right: -10px;
        bottom: -10px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
        animation: glowPulse 1.5s ease-in-out infinite;
      }
      
      .badge-ring {
        position: absolute;
        top: -20px;
        left: -20px;
        right: -20px;
        bottom: -20px;
        border: 3px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        animation: ringExpand 1s ease-out;
      }
      
      .badge-info {
        color: #fff;
      }
      
      .badge-title {
        font-size: 14px;
        color: rgba(255,255,255,0.7);
        margin-bottom: 8px;
        animation: fadeInUp 0.5s ease-out 0.3s both;
      }
      
      .badge-name {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 8px;
        animation: fadeInUp 0.5s ease-out 0.4s both;
      }
      
      .badge-description {
        font-size: 14px;
        color: rgba(255,255,255,0.8);
        margin-bottom: 16px;
        animation: fadeInUp 0.5s ease-out 0.5s both;
      }
      
      .badge-reward {
        display: inline-flex;
        gap: 16px;
        padding: 8px 16px;
        background: rgba(255,255,255,0.1);
        border-radius: 20px;
        animation: fadeInUp 0.5s ease-out 0.6s both;
      }
      
      .badge-reward span {
        font-size: 14px;
      }
      
      .particles-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        overflow: hidden;
      }
      
      .particle {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        animation: particleFly 1s ease-out forwards;
      }
      
      @keyframes badgePop {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      
      @keyframes glowPulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
      }
      
      @keyframes ringExpand {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(1.5); opacity: 0; }
      }
      
      @keyframes fadeInUp {
        0% { opacity: 0; transform: translateY(20px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes particleFly {
        0% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(var(--tx), var(--ty)) scale(0);
        }
      }
      
      /* 稀有度颜色 */
      .badge-icon.common { background: linear-gradient(135deg, #909399 0%, #606266 100%); }
      .badge-icon.rare { background: linear-gradient(135deg, #409eff 0%, #337ecc 100%); }
      .badge-icon.epic { background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); }
      .badge-icon.legendary { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); }
      
      .badge-name.common { color: #909399; }
      .badge-name.rare { color: #409eff; }
      .badge-name.epic { color: #9b59b6; }
      .badge-name.legendary { color: #f39c12; }
    `
    document.head.appendChild(style)
    // #endif
  }
  
  /**
   * 执行解锁动画序列
   */
  async _runUnlockSequence(achievement, config) {
    // #ifdef H5
    const container = document.getElementById(this.containerId)
    if (!container) return
    
    const overlay = container.querySelector('.badge-animation-overlay')
    const iconEl = container.querySelector('.badge-icon')
    const titleEl = container.querySelector('.badge-title')
    const nameEl = container.querySelector('.badge-name')
    const descEl = container.querySelector('.badge-description')
    const rewardEl = container.querySelector('.badge-reward')
    const particlesContainer = container.querySelector('.particles-container')
    
    // 设置内容
    iconEl.textContent = achievement.icon
    iconEl.className = `badge-icon ${achievement.rarity}`
    titleEl.textContent = '成就解锁'
    nameEl.textContent = achievement.name
    nameEl.className = `badge-name ${achievement.rarity}`
    descEl.textContent = achievement.description
    
    // 设置奖励
    const rewards = []
    if (achievement.reward?.exp) rewards.push(`+${achievement.reward.exp} 经验`)
    if (achievement.reward?.coins) rewards.push(`+${achievement.reward.coins} 金币`)
    rewardEl.innerHTML = rewards.map(r => `<span>${r}</span>`).join('')
    
    // 生成粒子
    this._createParticles(particlesContainer, config)
    
    // 显示动画
    await new Promise(resolve => setTimeout(resolve, 50))
    overlay.classList.add('show')
    
    // 等待动画完成
    await new Promise(resolve => setTimeout(resolve, config.duration))
    
    // 隐藏动画
    overlay.classList.remove('show')
    await new Promise(resolve => setTimeout(resolve, 300))
    // #endif
    
    // #ifdef MP-WEIXIN || APP-PLUS
    // 小程序/APP使用uni API
    await this._showMiniProgramAnimation(achievement, config)
    // #endif
  }
  
  /**
   * 创建粒子效果
   */
  _createParticles(container, config) {
    // #ifdef H5
    container.innerHTML = ''
    
    for (let i = 0; i < config.particleCount; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      
      // 随机位置和方向
      const angle = (Math.PI * 2 * i) / config.particleCount
      const distance = 100 + Math.random() * 100
      const tx = Math.cos(angle) * distance
      const ty = Math.sin(angle) * distance
      
      particle.style.cssText = `
        left: 50%;
        top: 50%;
        background: ${config.color};
        --tx: ${tx}px;
        --ty: ${ty}px;
        animation-delay: ${Math.random() * 0.3}s;
      `
      
      container.appendChild(particle)
    }
    // #endif
  }
  
  /**
   * 小程序/APP动画
   */
  async _showMiniProgramAnimation(achievement, config) {
    // 使用uni的showModal或自定义组件
    return new Promise((resolve) => {
      uni.showModal({
        title: '🎉 成就解锁',
        content: `${achievement.icon} ${achievement.name}\n${achievement.description}`,
        showCancel: false,
        confirmText: '太棒了',
        success: () => resolve()
      })
    })
  }
  
  /**
   * 播放音效
   */
  _playSound(soundName) {
    // #ifdef H5
    if (!this.audioContext) return
    
    // 简单的音效生成
    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      // 根据音效类型设置频率
      const frequencies = {
        unlock_common: [440, 550],
        unlock_rare: [440, 550, 660],
        unlock_epic: [440, 550, 660, 880],
        unlock_legendary: [440, 550, 660, 880, 1100]
      }
      
      const freqs = frequencies[soundName] || frequencies.unlock_common
      
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
      
      freqs.forEach((freq, i) => {
        setTimeout(() => {
          oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime)
        }, i * 100)
      })
      
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5)
      
      oscillator.start()
      oscillator.stop(this.audioContext.currentTime + 0.5)
      
    } catch (e) {
      console.warn('[BadgeAnimator] Sound play error:', e)
    }
    // #endif
    
    // #ifdef MP-WEIXIN || APP-PLUS
    // 使用uni的音频API
    const innerAudioContext = uni.createInnerAudioContext()
    innerAudioContext.src = `/static/sounds/${soundName}.mp3`
    innerAudioContext.play()
    // #endif
  }
  
  /**
   * 等待当前动画完成
   */
  _waitForAnimation() {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.state.isAnimating) {
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
  }
  
  /**
   * 清理动画容器
   */
  _cleanup() {
    // #ifdef H5
    const container = document.getElementById(this.containerId)
    if (container) {
      const particlesContainer = container.querySelector('.particles-container')
      if (particlesContainer) {
        particlesContainer.innerHTML = ''
      }
    }
    // #endif
  }
  
  /**
   * 展示徽章（非解锁，仅展示）
   */
  async showcase(achievement, options = {}) {
    const { duration = 2000 } = options
    
    this.state.animationType = ANIMATION_TYPE.SHOWCASE
    this.state.currentAchievement = achievement
    
    // 简化的展示动画
    // #ifdef H5
    // 可以实现更简单的展示效果
    // #endif
    
    await new Promise(resolve => setTimeout(resolve, duration))
    
    this.state.currentAchievement = null
  }
  
  /**
   * 销毁
   */
  destroy() {
    // #ifdef H5
    const container = document.getElementById(this.containerId)
    if (container) {
      container.remove()
    }
    
    const style = document.getElementById('badge-animator-styles')
    if (style) {
      style.remove()
    }
    // #endif
  }
}

// 单例导出
export const badgeAnimator = new BadgeAnimator()

// 导出类和常量
export { BadgeAnimator, ANIMATION_TYPE, RARITY_CONFIG }

// Vue组合式API Hook
export function useBadgeAnimator() {
  const isAnimating = ref(false)
  const currentAchievement = ref(null)
  
  // 同步状态
  const syncState = () => {
    isAnimating.value = badgeAnimator.state.isAnimating
    currentAchievement.value = badgeAnimator.state.currentAchievement
  }
  
  return {
    isAnimating,
    currentAchievement,
    showUnlock: async (achievement) => {
      syncState()
      await badgeAnimator.showUnlock(achievement)
      syncState()
    },
    showcase: async (achievement, options) => {
      syncState()
      await badgeAnimator.showcase(achievement, options)
      syncState()
    },
    destroy: () => badgeAnimator.destroy()
  }
}
