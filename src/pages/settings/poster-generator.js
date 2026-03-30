/**
 * 海报生成器 - 使用微信 Canvas 2D 新接口
 *
 * 功能：
 * 1. 使用 Canvas 2D 接口（非旧版 canvas-id）
 * 2. 支持高分屏（Retina）清晰度
 * 3. 跨域图片处理
 * 4. Loading 状态管理
 * 5. 权限检查与引导
 *
 * @version 2.0.0
 * @author Frontend Team
 */

import { logger } from '@/utils/logger.js';
import { getPixelRatio } from '@/utils/core/system.js';
import { toast } from '@/utils/toast.js';

// 海报配置常量
const POSTER_CONFIG = {
  // 海报尺寸（设计稿尺寸）
  WIDTH: 750,
  HEIGHT: 1000,

  // 生成超时时间
  TIMEOUT: 10000,

  // 图片质量
  QUALITY: 1.0,

  // 默认主题色
  THEME: {
    primary: '#07C160',
    secondary: '#0052D4',
    accent: '#FFC107',
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.8)',
    textTertiary: 'rgba(255, 255, 255, 0.6)'
  }
};

/**
 * 海报生成器类
 */
class PosterGenerator {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.dpr = 1;
    this.isGenerating = false;
  }

  /**
   * 初始化 Canvas 2D
   * @param {string} canvasId - canvas 组件的 id（非 canvas-id）
   * @param {Object} componentInstance - 组件实例（用于 createSelectorQuery）
   * @returns {Promise<boolean>}
   */
  async initCanvas(canvasId, componentInstance = null) {
    return new Promise((resolve, reject) => {
      const query = componentInstance ? uni.createSelectorQuery().in(componentInstance) : uni.createSelectorQuery();

      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            logger.error('[PosterGenerator] Canvas 节点未找到:', canvasId);
            reject(new Error('Canvas 节点未找到'));
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          // 获取设备像素比，确保高清显示
          this.dpr = getPixelRatio();

          // 设置 canvas 实际尺寸（物理像素）
          canvas.width = POSTER_CONFIG.WIDTH * this.dpr;
          canvas.height = POSTER_CONFIG.HEIGHT * this.dpr;

          // 缩放上下文以匹配设计稿尺寸
          ctx.scale(this.dpr, this.dpr);

          this.canvas = canvas;
          this.ctx = ctx;

          logger.log('[PosterGenerator] Canvas 2D 初始化成功', {
            dpr: this.dpr,
            width: canvas.width,
            height: canvas.height
          });

          resolve(true);
        });
    });
  }

  /**
   * 加载图片（处理跨域）
   * @param {string} src - 图片地址
   * @returns {Promise<Image>}
   */
  async loadImage(src) {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        reject(new Error('Canvas 未初始化'));
        return;
      }

      const img = this.canvas.createImage();

      img.onload = () => {
        logger.log('[PosterGenerator] 图片加载成功:', src.substring(0, 50));
        resolve(img);
      };

      img.onerror = (err) => {
        logger.error('[PosterGenerator] 图片加载失败:', src, err);
        reject(new Error(`图片加载失败: ${src}`));
      };

      // 处理跨域图片：先下载到本地
      if (src.startsWith('http')) {
        uni.downloadFile({
          url: src,
          success: (res) => {
            if (res.statusCode === 200) {
              img.src = res.tempFilePath;
            } else {
              reject(new Error(`图片下载失败: ${res.statusCode}`));
            }
          },
          fail: (err) => {
            logger.error('[PosterGenerator] 图片下载失败:', err);
            reject(err);
          }
        });
      } else {
        img.src = src;
      }
    });
  }

  /**
   * 绘制渐变背景
   * @param {Array} colors - 渐变色数组
   * @param {number} angle - 渐变角度（度）
   */
  drawGradientBackground(colors = ['#667eea', '#764ba2'], angle = 135) {
    const ctx = this.ctx;
    const width = POSTER_CONFIG.WIDTH;
    const height = POSTER_CONFIG.HEIGHT;

    // 计算渐变起止点
    const radian = (angle * Math.PI) / 180;
    const x1 = 0;
    const y1 = 0;
    const x2 = width * Math.cos(radian);
    const y2 = height * Math.sin(radian);

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);

    colors.forEach((color, index) => {
      gradient.addColorStop(index / (colors.length - 1), color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * 绘制装饰圆
   * @param {Array} circles - 圆形配置数组 [{x, y, radius, color}]
   */
  drawDecorationCircles(circles = []) {
    const ctx = this.ctx;

    const defaultCircles = [
      { x: 650, y: 100, radius: 150, color: 'rgba(255, 255, 255, 0.1)' },
      { x: 100, y: 900, radius: 100, color: 'rgba(255, 255, 255, 0.1)' }
    ];

    const circlesToDraw = circles.length > 0 ? circles : defaultCircles;

    circlesToDraw.forEach((circle) => {
      ctx.fillStyle = circle.color;
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * 绘制文字（支持自动换行）
   * @param {string} text - 文字内容
   * @param {Object} options - 配置项
   */
  drawText(text, options = {}) {
    const ctx = this.ctx;
    const {
      x = POSTER_CONFIG.WIDTH / 2,
      y = 400,
      maxWidth = 600,
      lineHeight = 54,
      fontSize = 36,
      fontWeight = 'bold',
      color = '#ffffff',
      align = 'center',
      fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif',
      prefix = '',
      suffix = ''
    } = options;

    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = align;

    const fullText = `${prefix}${text}${suffix}`;

    // 文字换行处理
    const chars = fullText.split('');
    let line = '';
    let currentY = y;

    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY);
        line = chars[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }

    // 绘制最后一行
    ctx.fillText(line, x, currentY);

    return currentY; // 返回最后一行的 Y 坐标
  }

  /**
   * 绘制圆形图片（头像）
   * @param {Image} img - 图片对象
   * @param {Object} options - 配置项
   */
  drawCircleImage(img, options = {}) {
    const ctx = this.ctx;
    const { x = POSTER_CONFIG.WIDTH / 2, y = 150, radius = 60, borderWidth = 4, borderColor = '#ffffff' } = options;

    ctx.save();

    // 绘制边框
    if (borderWidth > 0) {
      ctx.beginPath();
      ctx.arc(x, y, radius + borderWidth, 0, Math.PI * 2);
      ctx.fillStyle = borderColor;
      ctx.fill();
    }

    // 裁剪圆形区域
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    // 绘制图片
    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);

    ctx.restore();
  }

  /**
   * 绘制二维码
   * @param {Image} qrImg - 二维码图片
   * @param {Object} options - 配置项
   */
  drawQRCode(qrImg, options = {}) {
    const ctx = this.ctx;
    const {
      x = POSTER_CONFIG.WIDTH / 2,
      y = 800,
      size = 150,
      padding = 10,
      bgColor = '#ffffff',
      borderRadius = 12
    } = options;

    // 绘制白色背景
    ctx.fillStyle = bgColor;
    this.roundRect(
      x - size / 2 - padding,
      y - size / 2 - padding,
      size + padding * 2,
      size + padding * 2,
      borderRadius
    );
    ctx.fill();

    // 绘制二维码
    ctx.drawImage(qrImg, x - size / 2, y - size / 2, size, size);
  }

  /**
   * 绘制圆角矩形
   * @param {number} x - X 坐标
   * @param {number} y - Y 坐标
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @param {number} radius - 圆角半径
   */
  roundRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  /**
   * 导出海报图片
   * @param {Object} options - 导出配置
   * @returns {Promise<string>} - 临时文件路径
   */
  async exportImage(options = {}) {
    const { type = 'png', quality = POSTER_CONFIG.QUALITY } = options;

    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        reject(new Error('Canvas 未初始化'));
        return;
      }

      // 使用 Canvas 2D 的 toTempFilePath 方法
      uni.canvasToTempFilePath({
        canvas: this.canvas,
        fileType: type,
        quality: quality,
        success: (res) => {
          logger.log('[PosterGenerator] 海报导出成功:', res.tempFilePath);
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          logger.error('[PosterGenerator] 海报导出失败:', err);
          reject(err);
        }
      });
    });
  }

  /**
   * 生成每日金句海报
   * @param {Object} data - 海报数据
   * @param {string} canvasId - Canvas ID
   * @param {Object} componentInstance - 组件实例
   * @returns {Promise<string>} - 临时文件路径
   */
  async generateQuotePoster(data, canvasId, componentInstance = null) {
    const { quote = '', author = '古人云', date = this.formatDate(new Date()), theme = 'gradient' } = data;

    if (this.isGenerating) {
      throw new Error('正在生成中，请稍候');
    }

    this.isGenerating = true;

    // 显示 Loading
    toast.loading('海报生成中...');

    try {
      // 初始化 Canvas
      await this.initCanvas(canvasId, componentInstance);

      // 绘制背景
      const themeColors = {
        gradient: ['#667eea', '#764ba2'],
        dark: ['#1a1a2e', '#16213e'],
        light: ['#f5f7fa', '#c3cfe2'],
        brand: ['#07C160', '#0052D4']
      };

      this.drawGradientBackground(themeColors[theme] || themeColors.gradient);

      // 绘制装饰圆
      this.drawDecorationCircles();

      // 绘制金句
      const quoteY = this.drawText(quote, {
        y: 400,
        fontSize: 36,
        fontWeight: 'bold',
        color: '#ffffff',
        prefix: '"',
        suffix: '"',
        maxWidth: 600,
        lineHeight: 54
      });

      // 绘制作者
      this.drawText(`—— ${author}`, {
        y: quoteY + 80,
        fontSize: 26,
        fontWeight: 'normal',
        color: 'rgba(255, 255, 255, 0.8)'
      });

      // 绘制日期
      this.drawText(date, {
        y: quoteY + 140,
        fontSize: 24,
        fontWeight: 'normal',
        color: 'rgba(255, 255, 255, 0.6)'
      });

      // 绘制品牌
      this.drawText('Exam-Master', {
        y: 920,
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff'
      });

      this.drawText('考研路上，与你同行', {
        y: 960,
        fontSize: 22,
        fontWeight: 'normal',
        color: 'rgba(255, 255, 255, 0.7)'
      });

      // 导出图片
      const tempFilePath = await this.exportImage();

      toast.hide();
      this.isGenerating = false;

      return tempFilePath;
    } catch (error) {
      toast.hide();
      this.isGenerating = false;
      logger.error('[PosterGenerator] 生成金句海报失败:', error);
      throw error;
    }
  }

  /**
   * 生成邀请海报
   * @param {Object} data - 海报数据
   * @param {string} canvasId - Canvas ID
   * @param {Object} componentInstance - 组件实例
   * @returns {Promise<string>} - 临时文件路径
   */
  async generateInvitePoster(data, canvasId, componentInstance = null) {
    const { inviteCode = 'EXAM2026', qrCodeUrl = '', avatarUrl = '', nickname: _nickname = '考研人' } = data;

    if (this.isGenerating) {
      throw new Error('正在生成中，请稍候');
    }

    this.isGenerating = true;

    // 显示 Loading
    toast.loading('海报生成中...');

    try {
      // 初始化 Canvas
      await this.initCanvas(canvasId, componentInstance);

      // 绘制背景
      this.drawGradientBackground(['#07C160', '#0052D4', '#FFC107']);

      // 绘制装饰圆
      this.drawDecorationCircles();

      // 绘制头像（如果有）
      if (avatarUrl) {
        try {
          const avatarImg = await this.loadImage(avatarUrl);
          this.drawCircleImage(avatarImg, {
            x: POSTER_CONFIG.WIDTH / 2,
            y: 150,
            radius: 50
          });
        } catch (_e) {
          logger.warn('[PosterGenerator] 头像加载失败，跳过');
        }
      }

      // 绘制标题
      this.drawText('Exam-Master', {
        y: 250,
        fontSize: 24,
        fontWeight: '600',
        color: '#ffffff'
      });

      this.drawText('考研备考神器', {
        y: 320,
        fontSize: 40,
        fontWeight: 'bold',
        color: '#ffffff'
      });

      this.drawText('智能助力，一战成硕！', {
        y: 380,
        fontSize: 20,
        fontWeight: 'normal',
        color: 'rgba(255, 255, 255, 0.9)'
      });

      // 绘制邀请码卡片
      const ctx = this.ctx;
      const cardX = (POSTER_CONFIG.WIDTH - 500) / 2;
      const cardY = 450;

      // 白色卡片背景
      ctx.fillStyle = '#ffffff';
      this.roundRect(cardX, cardY, 500, 120, 16);
      ctx.fill();

      // 虚线边框
      ctx.strokeStyle = '#07C160';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      this.roundRect(cardX + 16, cardY + 16, 468, 88, 8);
      ctx.stroke();
      ctx.setLineDash([]);

      // 邀请码文字
      ctx.fillStyle = '#07C160';
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(inviteCode, POSTER_CONFIG.WIDTH / 2, cardY + 65);

      ctx.fillStyle = '#666666';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('我的邀请码', POSTER_CONFIG.WIDTH / 2, cardY + 95);

      // 绘制二维码（如果有）
      if (qrCodeUrl) {
        try {
          const qrImg = await this.loadImage(qrCodeUrl);
          this.drawQRCode(qrImg, {
            y: 720,
            size: 120
          });
        } catch (_e) {
          logger.warn('[PosterGenerator] 二维码加载失败，跳过');
        }
      }

      // 扫码提示
      this.drawText('扫码一起上岸', {
        y: 850,
        fontSize: 18,
        fontWeight: 'normal',
        color: 'rgba(255, 255, 255, 0.9)'
      });

      // 导出图片
      const tempFilePath = await this.exportImage();

      toast.hide();
      this.isGenerating = false;

      return tempFilePath;
    } catch (error) {
      toast.hide();
      this.isGenerating = false;
      logger.error('[PosterGenerator] 生成邀请海报失败:', error);
      throw error;
    }
  }

  /**
   * 生成学习成绩单海报（用于社交分享炫耀）
   * @param {Object} data - 学习数据
   * @param {string} canvasId - Canvas ID
   * @param {Object} componentInstance - 组件实例
   * @returns {Promise<string>} - 临时文件路径
   */
  async generateStudyReportPoster(data, canvasId, componentInstance = null) {
    const {
      nickname = '考研人',
      avatarUrl = '',
      level = 0,
      xp = 0,
      streakDays = 0,
      totalQuestions = 0,
      accuracy = 0,
      studyDays = 0,
      abilityRank = '-',
      topKnowledge = [] // [{ name, score }]
    } = data;

    if (this.isGenerating) {
      throw new Error('正在生成中，请稍候');
    }

    this.isGenerating = true;
    toast.loading('生成成绩单...');

    try {
      await this.initCanvas(canvasId, componentInstance);

      // 背景渐变（深色学术风）
      this.drawGradientBackground(['#1a1a2e', '#16213e', '#0f3460']);
      this.drawDecorationCircles();

      // 头像
      if (avatarUrl) {
        try {
          const avatarImg = await this.loadImage(avatarUrl);
          this.drawCircleImage(avatarImg, { x: 120, y: 120, radius: 40 });
        } catch (_e) {
          /* skip */
        }
      }

      // 用户名 + 等级
      this.drawText(nickname, {
        x: 200,
        y: 105,
        fontSize: 32,
        fontWeight: 'bold',
        color: '#ffffff',
        align: 'left'
      });
      this.drawText(`Lv.${level}  ·  ${xp} XP`, {
        x: 200,
        y: 145,
        fontSize: 22,
        fontWeight: 'normal',
        color: 'rgba(255,255,255,0.7)',
        align: 'left'
      });

      // 标题
      this.drawText('[统计] 学习成绩单', {
        y: 230,
        fontSize: 38,
        fontWeight: 'bold',
        color: '#ffffff'
      });

      const today = this.formatDate(new Date());
      this.drawText(today, {
        y: 280,
        fontSize: 20,
        fontWeight: 'normal',
        color: 'rgba(255,255,255,0.6)'
      });

      // 核心数据卡片区域
      const cardY = 320;
      const cardH = 320;
      const ctx = this.ctx;
      const dpr = this.dpr;

      // 半透明卡片背景
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      const rx = 60 * dpr,
        ry = cardY * dpr,
        rw = 630 * dpr,
        rh = cardH * dpr,
        rr = 24 * dpr;
      ctx.moveTo(rx + rr, ry);
      ctx.lineTo(rx + rw - rr, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
      ctx.lineTo(rx + rw, ry + rh - rr);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
      ctx.lineTo(rx + rr, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
      ctx.lineTo(rx, ry + rr);
      ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2x3 数据网格
      const stats = [
        { label: '累计刷题', value: String(totalQuestions), unit: '题' },
        { label: '正确率', value: `${accuracy}`, unit: '%' },
        { label: '连续学习', value: String(streakDays), unit: '天' },
        { label: '学习天数', value: String(studyDays), unit: '天' },
        { label: '能力评级', value: abilityRank, unit: '' },
        { label: '连续 连击', value: `${streakDays > 0 ? '✓' : '-'}`, unit: '' }
      ];

      const cols = 3;
      const cellW = 210,
        cellH = 140;
      const gridX = 60,
        gridY = cardY + 20;

      stats.forEach((stat, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = gridX + col * cellW + cellW / 2;
        const cy = gridY + row * cellH;

        this.drawText(stat.value, {
          x: cx,
          y: cy + 50,
          fontSize: 42,
          fontWeight: 'bold',
          color: '#FFD700'
        });
        this.drawText(stat.unit, {
          x: cx + 4,
          y: cy + 85,
          fontSize: 18,
          fontWeight: 'normal',
          color: 'rgba(255,255,255,0.5)'
        });
        this.drawText(stat.label, {
          x: cx,
          y: cy + 115,
          fontSize: 20,
          fontWeight: 'normal',
          color: 'rgba(255,255,255,0.7)'
        });
      });

      // 知识点掌握 TOP 3
      if (topKnowledge.length > 0) {
        this.drawText('掌握最好的知识点', {
          y: 680,
          fontSize: 22,
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)'
        });

        topKnowledge.slice(0, 3).forEach((kp, i) => {
          const barY = 720 + i * 50;
          const barWidth = Math.min(500, (kp.score / 100) * 500);

          // 进度条背景
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(125 * dpr, barY * dpr, 500 * dpr, 24 * dpr);
          // 进度条填充
          const grad = ctx.createLinearGradient(125 * dpr, 0, (125 + barWidth) * dpr, 0);
          grad.addColorStop(0, '#4CAF50');
          grad.addColorStop(1, '#8BC34A');
          ctx.fillStyle = grad;
          ctx.fillRect(125 * dpr, barY * dpr, barWidth * dpr, 24 * dpr);
          ctx.restore();

          this.drawText(`${kp.name}  ${kp.score}%`, {
            x: 375,
            y: barY - 8,
            fontSize: 18,
            fontWeight: 'normal',
            color: 'rgba(255,255,255,0.8)'
          });
        });
      }

      // 底部品牌
      this.drawText('Exam-Master', {
        y: 910,
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff'
      });
      this.drawText('考研路上，与你同行', {
        y: 950,
        fontSize: 20,
        fontWeight: 'normal',
        color: 'rgba(255,255,255,0.6)'
      });

      const tempFilePath = await this.exportImage();
      toast.hide();
      this.isGenerating = false;
      return tempFilePath;
    } catch (error) {
      toast.hide();
      this.isGenerating = false;
      logger.error('[PosterGenerator] 生成成绩单海报失败:', error);
      throw error;
    }
  }

  /**
   * 格式化日期
   * @param {Date} date - 日期对象
   * @returns {string}
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[date.getDay()];
    return `${year}年${month}月${day}日 星期${weekDay}`;
  }
}

// 导出单例
export const posterGenerator = new PosterGenerator();

// 导出配置
export { POSTER_CONFIG };

export default posterGenerator;
