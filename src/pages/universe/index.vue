<template>
  <view class="universe-container" @touchstart="handleScreenTouch" @touchend="handleScreenTouchEnd">
    <!-- 粒子宇宙画布 -->
    <canvas
      id="universeCanvas"
      canvas-id="universeCanvas"
      class="universe-canvas"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    ></canvas>

    <!-- 悬浮导航栏 - 提升层级确保可点击 -->
    <view
      class="floating-nav glassmorphism"
      :class="{ 'nav-hidden': !navVisible }"
      :style="{ top: statusBarHeight + 10 + 'px' }"
    >
      <view class="nav-btn" hover-class="nav-btn-hover" @click.stop="handleBack">
        <text class="nav-icon">
          ←
        </text>
        <text class="nav-label">
          返回
        </text>
      </view>
      <view class="nav-divider" />
      <view class="nav-btn" hover-class="nav-btn-hover" @click.stop="handleHome">
        <text class="nav-icon">
          ⌂
        </text>
        <text class="nav-label">
          主页
        </text>
      </view>
      <view class="nav-divider" />
      <view class="nav-btn" hover-class="nav-btn-hover" @click.stop="toggleResourcePanel">
        <text class="nav-icon">
          📚
        </text>
        <text class="nav-label">
          资源
        </text>
      </view>
      <view class="nav-divider" />
      <view class="nav-btn" hover-class="nav-btn-hover" @click.stop="handleRefresh">
        <text class="nav-icon">
          ↻
        </text>
        <text class="nav-label">
          重置
        </text>
      </view>
    </view>

    <!-- 学习资源推荐面板 -->
    <view
      class="resource-panel glassmorphism"
      :class="{ 'panel-visible': showResourcePanel }"
      :style="{ paddingTop: statusBarHeight + 70 + 'px' }"
    >
      <view class="panel-header">
        <text class="panel-title">
          📚 学习资源推荐
        </text>
        <text class="panel-close" @click="showResourcePanel = false">
          ×
        </text>
      </view>

      <!-- 分类标签 -->
      <scroll-view scroll-x class="category-scroll">
        <view class="category-tabs">
          <view
            v-for="(cat, key) in resourceCategories"
            :key="key"
            class="category-tab"
            :class="{ active: selectedCategory === key }"
            @click="selectCategory(key)"
          >
            <text class="tab-icon">
              {{ cat.icon }}
            </text>
            <text class="tab-name">
              {{ cat.name }}
            </text>
          </view>
        </view>
      </scroll-view>

      <!-- 资源列表 -->
      <scroll-view scroll-y class="resource-list" @scrolltolower="loadMoreResources">
        <view v-if="resourceLoading" class="loading-box">
          <view class="loading-spinner small" />
          <text class="loading-text">
            加载中...
          </text>
        </view>

        <view v-else-if="resources.length === 0" class="empty-box">
          <view class="empty-icon">
            <BaseIcon name="empty" :size="80" />
          </view>
          <text class="empty-text">
            暂无推荐资源
          </text>
        </view>

        <view
          v-for="item in resources"
          :key="item.id"
          class="resource-card"
          @click="openResource(item)"
        >
          <image
            class="resource-thumb"
            :src="item.thumbnail || '/static/images/default-avatar.png'"
            mode="aspectFill"
            lazy-load
            @error="
              (e) => {
                if (e.target) e.target.src = '/static/images/default-avatar.png';
              }
            "
          />
          <view class="resource-info">
            <text class="resource-title">
              {{ item.title }}
            </text>
            <text class="resource-desc">
              {{ item.description }}
            </text>
            <view class="resource-meta">
              <text class="meta-tag">
                {{ item.subjectIcon }} {{ item.subjectName }}
              </text>
              <text class="meta-stat">
                👁 {{ formatNumber(item.viewCount) }}
              </text>
              <text class="meta-stat">
                ⭐ {{ item.rating }}
              </text>
            </view>
            <view class="resource-footer">
              <text class="resource-author">
                {{ item.author }}
              </text>
              <text class="resource-price" :class="{ free: item.isFree }">
                {{ item.isFree ? '免费' : '¥' + item.price }}
              </text>
            </view>
          </view>
        </view>

        <view v-if="hasMoreResources" class="load-more" @click="loadMoreResources">
          <text>加载更多</text>
        </view>
      </scroll-view>
    </view>

    <!-- 高科技感载入动画 -->
    <view v-if="isLoading" class="loading-overlay">
      <!-- 星际穿梭背景 -->
      <view class="starfield">
        <view class="star-layer layer-1" />
        <view class="star-layer layer-2" />
        <view class="star-layer layer-3" />
      </view>

      <!-- 中心光晕 -->
      <view class="center-glow" />

      <!-- 环形进度指示器 -->
      <view class="ring-container">
        <view class="ring ring-outer" />
        <view class="ring ring-middle" />
        <view class="ring ring-inner" />
      </view>

      <!-- 粒子发散效果 -->
      <view class="particles">
        <view
          v-for="i in 20"
          :key="i"
          class="particle"
          :style="getParticleStyle(i)"
        />
      </view>

      <!-- 流光文字 -->
      <view class="loading-content">
        <text class="loading-title">
          UNIVERSE
        </text>
        <text class="loading-subtitle">
          正在校准极限穿梭感...
        </text>
        <view class="progress-bar">
          <view class="progress-fill" />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight, getWindowInfo as _getWindowInfo, getPixelRatio } from '@/utils/core/system.js';
import { lafService } from '@/services/lafService.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: { BaseIcon },
  data() {
    return {
      statusBarHeight: 44,

      // Canvas 相关
      canvasWidth: 0,
      canvasHeight: 0,
      ctx: null,
      canvasNode: null,
      animationFrame: null,
      isLoading: true,
      useCanvas2D: false, // 标记使用哪种Canvas API

      // 导航栏显示状态
      navVisible: true,
      navHideTimer: null,

      // 背景星空粒子
      bgStars: [],
      bgStarsRotation: 0,

      // 核心星球粒子
      coreParticles: [],
      shellParticles: [],
      ringParticles: [],

      // 星球旋转
      planetRotationY: 0,
      rotationVelocity: 0,

      // 相机参数
      camera: {
        z: 25, // 相机距离
        targetZ: 25, // 目标距离
        y: 0, // 垂直偏移
        targetY: 0 // 目标垂直偏移
      },

      // 物理参数
      friction: 0.96,
      baseIdleRotation: 0.0015,

      // 触摸交互
      touches: [],
      lastTouchX: null,
      lastTouchY: null,
      lastPinchDistance: 0,
      isPinching: false,

      // 粒子基础大小
      baseParticleSize: 0.06,

      // 导航锁 - 防止多次路由跳转
      isNavigating: false,

      // 初始化定时器
      initTimer: null,

      // 学习资源相关
      showResourcePanel: false,
      resourceLoading: false,
      resources: [],
      resourceCategories: {
        video: { name: '视频课程', icon: '🎬' },
        article: { name: '文章教程', icon: '📄' },
        book: { name: '电子书籍', icon: '📚' },
        practice: { name: '练习题库', icon: '📝' },
        tool: { name: '学习工具', icon: '🛠️' }
      },
      selectedCategory: 'video',
      resourcePage: 1,
      hasMoreResources: true
    };
  },
  onLoad() {
    this.initData();
    // 添加定时器锁，防止多次初始化
    this.initTimer = setTimeout(() => {
      this.initCanvas();
      this.initTimer = null;
    }, 200);
  },
  onShow() {
    this.startNavHideTimer();
  },
  onHide() {
    // 页面隐藏时清理资源
    this.clearNavHideTimer();
  },
  onUnload() {
    // 页面卸载时清理所有资源
    this.stopAnimation();
    this.clearNavHideTimer();
    // 清理初始化定时器
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    // 重置导航锁
    this.isNavigating = false;
  },
  methods: {
    // 生成粒子样式（用于加载动画）
    getParticleStyle(index) {
      const angle = (index / 20) * 360;
      const delay = (index / 20) * 2;
      return {
        '--angle': `${angle}deg`,
        '--delay': `${delay}s`
      };
    },

    initData() {
      this.statusBarHeight = getStatusBarHeight();
      const winInfo = _getWindowInfo();
      this.canvasWidth = winInfo.windowWidth;
      this.canvasHeight = winInfo.windowHeight;
    },

    // ==================== 学习资源相关方法 ====================

    toggleResourcePanel() {
      this.showResourcePanel = !this.showResourcePanel;
      if (this.showResourcePanel && this.resources.length === 0) {
        this.loadResources();
      }
    },

    selectCategory(category) {
      if (this.selectedCategory === category) return;
      this.selectedCategory = category;
      this.resourcePage = 1;
      this.resources = [];
      this.hasMoreResources = true;
      this.loadResources();
    },

    async loadResources() {
      if (this.resourceLoading) return;

      this.resourceLoading = true;
      try {
        const response = await lafService.getLearningResources({
          category: this.selectedCategory,
          page: this.resourcePage,
          limit: 10
        });

        if (response.code === 0 && response.data) {
          const newResources = response.data.resources || [];
          if (this.resourcePage === 1) {
            this.resources = newResources;
          } else {
            this.resources = [...this.resources, ...newResources];
          }
          this.hasMoreResources = newResources.length >= 10;
        }
      } catch (error) {
        logger.error('[Universe] 加载资源失败:', error);
        uni.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        this.resourceLoading = false;
      }
    },

    loadMoreResources() {
      if (!this.hasMoreResources || this.resourceLoading) return;
      this.resourcePage++;
      this.loadResources();
    },

    openResource(item) {
      logger.log('[Universe] 打开资源:', item.title);
      // 可以跳转到资源详情页或外部链接
      if (item.url && item.url !== '#') {
        // #ifdef H5
        // [AUDIT FIX] 验证 URL 协议，防止 javascript:/data: 等恶意链接
        if (/^https?:\/\//i.test(item.url)) {
          window.open(item.url, '_blank');
        }
        // #endif
        // #ifndef H5
        uni.showModal({
          title: item.title,
          content: `${item.description}\n\n作者: ${item.author}\n评分: ${item.rating}`,
          confirmText: '开始学习',
          success: (res) => {
            if (res.confirm) {
              uni.showToast({ title: '功能开发中', icon: 'none' });
            }
          }
        });
        // #endif
      } else {
        uni.showModal({
          title: item.title,
          content: `${item.description}\n\n作者: ${item.author}\n评分: ${item.rating}\n观看: ${this.formatNumber(item.viewCount)}`,
          confirmText: '开始学习',
          success: (res) => {
            if (res.confirm) {
              uni.showToast({ title: '功能开发中', icon: 'none' });
            }
          }
        });
      }
    },

    formatNumber(num) {
      if (!num) return '0';
      if (num >= 10000) {
        return (num / 10000).toFixed(1) + 'w';
      }
      if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
      }
      return num.toString();
    },

    // ==================== Canvas 初始化 ====================

    initCanvas() {
      // #ifdef H5
      this.initCanvas2D();
      // #endif
      // #ifndef H5
      this.initCanvasLegacy();
      // #endif
    },

    // H5平台使用Canvas 2D API
    initCanvas2D() {
      const query = uni.createSelectorQuery().in(this);

      query
        .select('#universeCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            logger.warn('Canvas 2D not available, falling back to legacy');
            this.initCanvasLegacy();
            return;
          }

          this.useCanvas2D = true;
          this.canvasNode = res[0].node;
          this.ctx = this.canvasNode.getContext('2d');

          // 高DPI缩放
          const dpr = getPixelRatio();
          this.canvasNode.width = res[0].width * dpr;
          this.canvasNode.height = res[0].height * dpr;
          this.ctx.scale(dpr, dpr);

          this.canvasWidth = res[0].width;
          this.canvasHeight = res[0].height;

          logger.log('✅ Canvas 2D initialized', {
            width: this.canvasWidth,
            height: this.canvasHeight
          });

          // 初始化粒子系统
          this.initParticles();

          // 隐藏加载提示
          this.isLoading = false;

          // 启动动画循环
          this.animate();
        });
    },

    // 小程序平台使用Legacy Canvas API
    initCanvasLegacy() {
      this.useCanvas2D = false;
      this.ctx = uni.createCanvasContext('universeCanvas', this);

      if (!this.ctx) {
        logger.error('Failed to create canvas context');
        return;
      }

      const winInfo = _getWindowInfo();
      this.canvasWidth = winInfo.windowWidth;
      this.canvasHeight = winInfo.windowHeight;

      logger.log('✅ Canvas Legacy initialized', {
        width: this.canvasWidth,
        height: this.canvasHeight
      });

      // 初始化粒子系统
      this.initParticles();

      // 隐藏加载提示
      this.isLoading = false;

      // 启动动画循环
      this.animate();
    },

    initParticles() {
      // 1. 背景星空 (优化数量)
      this.bgStars = [];
      for (let i = 0; i < 3000; i++) {
        const r = 800 * (0.5 + Math.random() * 1.5);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        this.bgStars.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          size: 0.7,
          opacity: 0.4
        });
      }

      // 2. 核心粒子
      this.coreParticles = [];
      for (let i = 0; i < 800; i++) {
        const r = Math.random() * 5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        this.coreParticles.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          color: '#ff9800'
        });
      }

      // 3. 外壳粒子
      this.shellParticles = [];
      for (let i = 0; i < 1500; i++) {
        const r = 5 * (0.98 + Math.random() * 0.02);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        this.shellParticles.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          color: '#ff5722'
        });
      }

      // 4. 星环粒子
      this.ringParticles = [];
      for (let i = 0; i < 400; i++) {
        const r = 7 + Math.random() * 3;
        const t = Math.random() * Math.PI * 2;
        this.ringParticles.push({
          x: r * Math.cos(t),
          y: (Math.random() - 0.5) * 0.2,
          z: r * Math.sin(t),
          color: '#ffffff',
          opacity: 0.4
        });
      }

      logger.log('✅ Particles initialized', {
        bgStars: this.bgStars.length,
        core: this.coreParticles.length,
        shell: this.shellParticles.length,
        ring: this.ringParticles.length
      });
    },

    // 3D投影函数
    project3D(x, y, z, cameraZ) {
      const near = 0.001;
      const relZ = z - cameraZ;

      if (relZ >= -near) {
        return null;
      }

      const scale = Math.abs(1 / relZ) * 100;

      return {
        x: this.canvasWidth / 2 + x * scale,
        y: this.canvasHeight / 2 - y * scale,
        scale: scale,
        depth: -relZ
      };
    },

    // 旋转变换 (绕Y轴)
    rotateY(x, y, z, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: x * cos + z * sin,
        y: y,
        z: -x * sin + z * cos
      };
    },

    animate() {
      // 更新物理
      this.updatePhysics();

      // 渲染
      this.render();

      // 继续动画循环
      // #ifdef H5
      this.animationFrame = requestAnimationFrame(() => this.animate());
      // #endif
      // #ifndef H5
      this.animationFrame = setTimeout(() => this.animate(), 16);
      // #endif
    },

    updatePhysics() {
      // 旋转摩擦力
      this.rotationVelocity *= this.friction;
      this.planetRotationY += this.baseIdleRotation + this.rotationVelocity;

      // 相机移动 (Lerp插值)
      this.camera.z += (this.camera.targetZ - this.camera.z) * 0.15;
      this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;

      // 背景星空缓慢旋转
      this.bgStarsRotation += 0.0001;
    },

    render() {
      if (!this.ctx) return;

      const ctx = this.ctx;

      // 清空画布
      if (this.useCanvas2D) {
        ctx.fillStyle = '#000000';
      } else {
        ctx.setFillStyle('#000000');
      }
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

      // 1. 绘制背景星空
      this.renderBgStars(ctx);

      // 2. 绘制星球粒子
      this.renderPlanet(ctx);

      // Legacy API需要调用draw()
      if (!this.useCanvas2D) {
        ctx.draw(true);
      }
    },

    renderBgStars(ctx) {
      const starColor = 'rgba(255, 255, 255, 0.4)';
      if (this.useCanvas2D) {
        ctx.fillStyle = starColor;
      } else {
        ctx.setFillStyle(starColor);
      }

      this.bgStars.forEach((star) => {
        const rotated = this.rotateY(star.x, star.y, star.z, this.bgStarsRotation);
        const projected = this.project3D(rotated.x, rotated.y, rotated.z, this.camera.z + 500);

        if (
          projected &&
          projected.x > 0 &&
          projected.x < this.canvasWidth &&
          projected.y > 0 &&
          projected.y < this.canvasHeight
        ) {
          const size = Math.max(0.5, star.size * projected.scale * 0.01);
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    },

    renderPlanet(ctx) {
      const cameraZ = this.camera.z;
      const cameraY = this.camera.y;

      // 收集所有粒子并排序
      const allParticles = [];

      // 核心粒子
      this.coreParticles.forEach((p) => {
        const rotated = this.rotateY(p.x, p.y, p.z, this.planetRotationY);
        rotated.y += cameraY * 0.1;
        allParticles.push({
          ...rotated,
          color: p.color,
          type: 'core'
        });
      });

      // 外壳粒子
      this.shellParticles.forEach((p) => {
        const rotated = this.rotateY(p.x, p.y, p.z, this.planetRotationY);
        rotated.y += cameraY * 0.1;
        allParticles.push({
          ...rotated,
          color: p.color,
          type: 'shell'
        });
      });

      // 星环粒子
      this.ringParticles.forEach((p) => {
        const rotated = this.rotateY(p.x, p.y, p.z, this.planetRotationY);
        rotated.y += cameraY * 0.1;
        allParticles.push({
          ...rotated,
          color: p.color,
          opacity: p.opacity,
          type: 'ring'
        });
      });

      // 按深度排序 (远的先绘制)
      allParticles.sort((a, b) => a.z - b.z);

      // 计算动态粒子大小
      const dist = cameraZ;
      let dynamicSize = this.baseParticleSize;

      if (dist < 8) {
        dynamicSize = this.baseParticleSize * (20 / Math.max(dist, 0.005));
      }

      // 绘制所有粒子
      allParticles.forEach((p) => {
        const projected = this.project3D(p.x, p.y, p.z, cameraZ);

        if (
          projected &&
          projected.x > -50 &&
          projected.x < this.canvasWidth + 50 &&
          projected.y > -50 &&
          projected.y < this.canvasHeight + 50
        ) {
          let size;
          if (p.type === 'ring') {
            size = Math.max(0.5, 0.03 * projected.scale);
          } else {
            size = Math.max(0.5, dynamicSize * projected.scale);
          }

          // 根据深度计算透明度
          const depthOpacity = Math.min(1, Math.max(0.3, 1 - projected.depth / 50));
          const opacity = p.opacity !== undefined ? p.opacity * depthOpacity : 0.8 * depthOpacity;

          if (this.useCanvas2D) {
            // Canvas 2D: 使用渐变实现发光效果
            const gradient = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, size * 2);

            const baseColor = p.color;
            gradient.addColorStop(0, this.colorWithOpacity(baseColor, opacity));
            gradient.addColorStop(0.5, this.colorWithOpacity(baseColor, opacity * 0.5));
            gradient.addColorStop(1, this.colorWithOpacity(baseColor, 0));

            ctx.beginPath();
            ctx.fillStyle = gradient;
            ctx.arc(projected.x, projected.y, size * 2, 0, Math.PI * 2);
            ctx.fill();

            // 绘制核心亮点
            ctx.beginPath();
            ctx.fillStyle = this.colorWithOpacity('#ffffff', opacity * 0.8);
            ctx.arc(projected.x, projected.y, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Legacy API: 简化渲染（不使用渐变）
            // 绘制外发光层
            ctx.beginPath();
            ctx.setFillStyle(this.colorWithOpacity(p.color, opacity * 0.3));
            ctx.arc(projected.x, projected.y, size * 2, 0, Math.PI * 2);
            ctx.fill();

            // 绘制主体
            ctx.beginPath();
            ctx.setFillStyle(this.colorWithOpacity(p.color, opacity));
            ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
            ctx.fill();

            // 绘制核心亮点
            ctx.beginPath();
            ctx.setFillStyle(this.colorWithOpacity('#ffffff', opacity * 0.6));
            ctx.arc(projected.x, projected.y, size * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    },

    colorWithOpacity(hexColor, opacity) {
      const hex = hexColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },

    stopAnimation() {
      if (this.animationFrame) {
        // #ifdef H5
        cancelAnimationFrame(this.animationFrame);
        // #endif
        // #ifndef H5
        clearTimeout(this.animationFrame);
        // #endif
        this.animationFrame = null;
      }
    },

    // 导航栏自动隐藏逻辑
    startNavHideTimer() {
      this.clearNavHideTimer();
      this.navHideTimer = setTimeout(() => {
        this.navVisible = false;
        this.navHideTimer = null;
      }, 3000);
    },

    clearNavHideTimer() {
      if (this.navHideTimer) {
        clearTimeout(this.navHideTimer);
        this.navHideTimer = null;
      }
    },

    handleScreenTouch() {
      this.navVisible = true;
      this.startNavHideTimer();
    },

    handleScreenTouchEnd() {
      this.startNavHideTimer();
    },

    // Canvas触摸交互
    handleTouchStart(e) {
      this.touches = e.touches;

      if (e.touches.length === 2) {
        this.isPinching = true;
        this.lastPinchDistance = this.getPinchDistance(e.touches);
      } else if (e.touches.length === 1) {
        this.isPinching = false;
        this.lastTouchX = e.touches[0].x;
        this.lastTouchY = e.touches[0].y;
      }
    },

    handleTouchMove(e) {
      this.touches = e.touches;

      if (e.touches.length === 2 && this.isPinching) {
        const currentDistance = this.getPinchDistance(e.touches);
        const deltaDistance = currentDistance - this.lastPinchDistance;

        const zoomDelta = -deltaDistance * 0.1;
        this.camera.targetZ = Math.max(0.005, Math.min(25, this.camera.targetZ + zoomDelta));

        this.lastPinchDistance = currentDistance;
      } else if (e.touches.length === 1 && !this.isPinching) {
        const touch = e.touches[0];

        if (this.lastTouchX !== null && this.lastTouchY !== null) {
          const dx = touch.x - this.lastTouchX;
          const dy = touch.y - this.lastTouchY;

          this.rotationVelocity -= dx * 0.002;

          this.camera.targetY += dy * 0.1;
          this.camera.targetY = Math.max(-12, Math.min(12, this.camera.targetY));
        }

        this.lastTouchX = touch.x;
        this.lastTouchY = touch.y;
      }
    },

    handleTouchEnd() {
      this.touches = [];
      this.isPinching = false;
      this.lastTouchX = null;
      this.lastTouchY = null;
    },

    getPinchDistance(touches) {
      if (touches.length < 2) return 0;
      const dx = touches[0].x - touches[1].x;
      const dy = touches[0].y - touches[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    },

    // 导航按钮事件 - 使用 reLaunch 替代 switchTab 避免路由错误
    handleBack() {
      logger.log('🔙 handleBack triggered');
      if (this.isNavigating) return;
      this.isNavigating = true;

      uni.navigateBack({
        delta: 1,
        success: () => {
          this.isNavigating = false;
        },
        fail: (err) => {
          logger.warn('navigateBack failed:', err);
          // 回退失败时，重置导航锁再跳首页（goToHome 会重新加锁）
          this.isNavigating = false;
          this.goToHome();
        }
      });
    },

    handleHome() {
      logger.log('🏠 handleHome triggered');
      this.goToHome();
    },

    // 统一的跳转首页方法，带容错处理
    goToHome() {
      if (this.isNavigating) return;
      this.isNavigating = true;

      uni.reLaunch({
        url: '/pages/index/index',
        success: () => {
          logger.log('✅ reLaunch to home success');
          // 不需要重置isNavigating，因为页面会卸载
        },
        fail: (err) => {
          logger.error('❌ reLaunch failed:', err);
          // 最后的备选方案：尝试 redirectTo
          uni.redirectTo({
            url: '/pages/index/index',
            success: () => {
              // 不需要重置isNavigating，因为页面会卸载
            },
            fail: (err2) => {
              logger.error('❌ redirectTo also failed:', err2);
              uni.showToast({
                title: '跳转失败，请手动返回',
                icon: 'none',
                duration: 2000
              });
              // 跳转失败，重置导航锁
              this.isNavigating = false;
            }
          });
        }
      });
    },

    handleRefresh() {
      logger.log('🔄 handleRefresh triggered');
      this.camera.targetZ = 25;
      this.camera.targetY = 0;
      this.rotationVelocity = 0;
      this.planetRotationY = 0;

      uni.showToast({
        title: '视角已重置',
        icon: 'none'
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.universe-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #000000;
}

.universe-canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

// 学习资源面板
.resource-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 85%;
  max-width: 600rpx;
  height: 100vh;
  background: rgba(10, 10, 26, 0.95);
  backdrop-filter: blur(20px);
  z-index: 9998;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;

  &.panel-visible {
    transform: translateX(0);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 24rpx;
    border-bottom: 1px solid rgba(255, 152, 0, 0.3);

    .panel-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #fff;
    }

    .panel-close {
      font-size: 48rpx;
      color: rgba(255, 255, 255, 0.6);
      padding: 10rpx;
    }
  }

  .category-scroll {
    white-space: nowrap;
    padding: 16rpx 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .category-tabs {
    display: inline-flex;
    padding: 0 16rpx;
    gap: 16rpx;
  }

  .category-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 24rpx;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16rpx;
    border: 1px solid transparent;
    transition: all 0.2s ease;

    &.active {
      background: rgba(255, 152, 0, 0.2);
      border-color: rgba(255, 152, 0, 0.5);
    }

    .tab-icon {
      font-size: 32rpx;
      margin-bottom: 8rpx;
    }

    .tab-name {
      font-size: 22rpx;
      color: rgba(255, 255, 255, 0.8);
      white-space: nowrap;
    }
  }

  .resource-list {
    flex: 1;
    padding: 16rpx;
  }

  .loading-box,
  .empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60rpx 0;

    .loading-spinner.small {
      width: 48rpx;
      height: 48rpx;
      border: 3rpx solid rgba(255, 152, 0, 0.2);
      border-top-color: #ff9800;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .loading-text,
    .empty-text {
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 16rpx;
    }

    .empty-icon {
      font-size: 64rpx;
      margin-bottom: 16rpx;
    }
  }

  .resource-card {
    display: flex;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16rpx;
    margin-bottom: 16rpx;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);

    .resource-thumb {
      width: 180rpx;
      height: 140rpx;
      flex-shrink: 0;
    }

    .resource-info {
      flex: 1;
      padding: 16rpx;
      display: flex;
      flex-direction: column;

      .resource-title {
        font-size: 26rpx;
        font-weight: 500;
        color: #fff;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .resource-desc {
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 8rpx;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .resource-meta {
        display: flex;
        align-items: center;
        gap: 12rpx;
        margin-top: 8rpx;

        .meta-tag {
          font-size: 20rpx;
          color: #ff9800;
          background: rgba(255, 152, 0, 0.15);
          padding: 4rpx 10rpx;
          border-radius: 8rpx;
        }

        .meta-stat {
          font-size: 20rpx;
          color: rgba(255, 255, 255, 0.5);
        }
      }

      .resource-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: auto;

        .resource-author {
          font-size: 20rpx;
          color: rgba(255, 255, 255, 0.4);
        }

        .resource-price {
          font-size: 24rpx;
          font-weight: 600;
          color: #ff5722;

          &.free {
            color: #4caf50;
          }
        }
      }
    }
  }

  .load-more {
    text-align: center;
    padding: 24rpx;

    text {
      font-size: 24rpx;
      color: rgba(255, 152, 0, 0.8);
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 悬浮导航栏 - 提升层级和点击区域
.floating-nav {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999; // 提升到最高层级
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  border-radius: 50rpx;
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;

  &.nav-hidden {
    opacity: 0;
    transform: translateX(-50%) translateY(-20rpx);
    pointer-events: none;
  }

  .nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 32rpx; // 增大点击区域
    min-width: 80rpx;
    min-height: 80rpx;

    .nav-icon {
      font-size: 40rpx; // 增大图标
      color: #ff9800;
      line-height: 1;
    }

    .nav-label {
      font-size: 22rpx; // 稍微增大文字
      color: var(--text-primary);
      margin-top: 6rpx;
    }

    &:active {
      opacity: 0.6;
      transform: scale(0.95);
    }
  }

  .nav-divider {
    width: 1px;
    height: 50rpx;
    background: rgba(255, 152, 0, 0.4);
    margin: 0 12rpx;
  }
}

// 导航按钮 hover 效果
.nav-btn-hover {
  opacity: 0.7;
  transform: scale(0.95);
}

// 玻璃态效果
.glassmorphism {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 152, 0, 0.4);
  box-shadow: var(--shadow-lg);
}

// ========== 高科技感载入动画 ==========
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  background: radial-gradient(ellipse at center, #0a0a1a 0%, #000000 100%);
  overflow: hidden;
}

// 星际穿梭背景
.starfield {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  perspective: 500px;
  overflow: hidden;
}

.star-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 2px;
  background: transparent;
  transform: translate(-50%, -50%);
  animation: starfield-zoom 3s linear infinite;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: #fff;
    border-radius: 50%;
  }
}

.layer-1 {
  box-shadow:
    -200px 0 1px rgba(255, 255, 255, 0.8),
    200px 0 1px rgba(255, 255, 255, 0.8),
    0 -200px 1px rgba(255, 255, 255, 0.8),
    0 200px 1px rgba(255, 255, 255, 0.8),
    140px 140px 1px rgba(255, 255, 255, 0.8),
    -140px -140px 1px rgba(255, 255, 255, 0.8),
    -140px 140px 1px rgba(255, 255, 255, 0.8),
    140px -140px 1px rgba(255, 255, 255, 0.8);
  animation-delay: 0s;
}

.layer-2 {
  box-shadow:
    -300px 0 1px rgba(255, 255, 255, 0.6),
    300px 0 1px rgba(255, 255, 255, 0.6),
    0 -300px 1px rgba(255, 255, 255, 0.6),
    0 300px 1px rgba(255, 255, 255, 0.6),
    210px 210px 1px rgba(255, 255, 255, 0.6),
    -210px -210px 1px rgba(255, 255, 255, 0.6),
    -210px 210px 1px rgba(255, 255, 255, 0.6),
    210px -210px 1px rgba(255, 255, 255, 0.6),
    150px 0 1px rgba(255, 255, 255, 0.6),
    -150px 0 1px rgba(255, 255, 255, 0.6),
    0 150px 1px rgba(255, 255, 255, 0.6),
    0 -150px 1px rgba(255, 255, 255, 0.6);
  animation-delay: -1s;
  transform: scale(1.5);
}

.layer-3 {
  box-shadow:
    -400px 0 1px rgba(255, 255, 255, 0.4),
    400px 0 1px rgba(255, 255, 255, 0.4),
    0 -400px 1px rgba(255, 255, 255, 0.4),
    0 400px 1px rgba(255, 255, 255, 0.4),
    280px 280px 1px rgba(255, 255, 255, 0.4),
    -280px -280px 1px rgba(255, 255, 255, 0.4),
    -280px 280px 1px rgba(255, 255, 255, 0.4),
    280px -280px 1px rgba(255, 255, 255, 0.4),
    200px 0 1px rgba(255, 255, 255, 0.4),
    -200px 0 1px rgba(255, 255, 255, 0.4),
    0 200px 1px rgba(255, 255, 255, 0.4),
    0 -200px 1px rgba(255, 255, 255, 0.4),
    120px 120px 1px rgba(255, 255, 255, 0.4),
    -120px -120px 1px rgba(255, 255, 255, 0.4),
    -120px 120px 1px rgba(255, 255, 255, 0.4),
    120px -120px 1px rgba(255, 255, 255, 0.4);
  animation-delay: -2s;
  transform: scale(2);
}

@keyframes starfield-zoom {
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

// 中心光晕效果
.center-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 300rpx;
  height: 300rpx;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(0, 229, 255, 0.3) 0%, transparent 70%);
  animation: glow-pulse 2s ease-in-out infinite;
  z-index: 1;
}

@keyframes glow-pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 1;
  }
}

// 环形进度指示器
.ring-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #00e5ff;
  border-right-color: #00e5ff;
  animation: ring-rotate 3s linear infinite;
}

.ring-outer {
  width: 400rpx;
  height: 400rpx;
  animation-duration: 4s;
}

.ring-middle {
  width: 300rpx;
  height: 300rpx;
  animation-duration: 3s;
  animation-direction: reverse;
  border-color: transparent;
  border-bottom-color: #ff5722;
  border-left-color: #ff5722;
}

.ring-inner {
  width: 200rpx;
  height: 200rpx;
  animation-duration: 2s;
}

@keyframes ring-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

// 粒子发散效果
.particles {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500rpx;
  height: 500rpx;
  z-index: 1;
}

.particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4rpx;
  height: 4rpx;
  background: linear-gradient(90deg, #00e5ff, #ff5722);
  border-radius: 50%;
  transform-origin: center;
  animation: particle-burst calc(var(--delay) + 3s) ease-out infinite;
}

@keyframes particle-burst {
  0% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(250rpx) scale(0);
    opacity: 0;
  }
}

// 流光文字效果
.loading-content {
  position: absolute;
  top: 65%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 3;
}

.loading-title {
  display: block;
  font-size: 60rpx;
  font-weight: bold;
  background: linear-gradient(45deg, #00e5ff, #ff5722, #00e5ff);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: text-shine 3s ease-in-out infinite;
  letter-spacing: 8rpx;
  margin-bottom: 20rpx;
}

@keyframes text-shine {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.loading-subtitle {
  display: block;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 40rpx;
  animation: text-pulse 2s ease-in-out infinite;
}

@keyframes text-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

// 进度条
.progress-bar {
  width: 400rpx;
  height: 6rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3rpx;
  overflow: hidden;
  margin: 0 auto;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00e5ff, #ff5722);
  border-radius: 3rpx;
  animation: progress-fill 3s ease-in-out infinite;
  width: 0;
}

@keyframes progress-fill {
  0% {
    width: 0;
  }
  100% {
    width: 100%;
  }
}
</style>
