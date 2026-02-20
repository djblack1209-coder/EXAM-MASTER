/**
 * Canvas 报告绘制工具集
 * 提取自 mistake/index.vue 中的重复 Canvas 绘制逻辑
 *
 * @module canvas-bindreport
 */

/**
 * 根据深色模式生成主题色配置
 * @param {boolean} isDark - 是否深色模式
 * @returns {Object} 主题色配置对象
 */
export function getCanvasTheme(isDark) {
  return {
    bgColor: isDark ? '#1a1a1a' : '#ffffff',
    bgStart: isDark ? '#0F1A0A' : '#E8F5E9',
    bgEnd: isDark ? '#1E3A0F' : '#FFFFFF',
    titleColor: isDark ? '#2ECC71' : '#27AE60',
    mainText: isDark ? '#F1F5F9' : '#1A1A1A',
    subText: isDark ? '#94A3B8' : '#666666',
    borderColor: isDark ? '#333333' : '#E0E0E0',
    cardBg: isDark ? 'rgba(30, 58, 15, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    accent: '#2ECC71',
    dividerColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E0E0'
  };
}

/**
 * 绘制带阴影的圆角卡片
 * @param {Object} ctx - Canvas 2D 上下文
 * @param {number} x - 左上角 X 坐标
 * @param {number} y - 左上角 Y 坐标
 * @param {number} w - 卡片宽度
 * @param {number} h - 卡片高度
 * @param {number} r - 圆角半径
 * @param {string} fill - 填充颜色
 * @param {boolean} [isDark=false] - 是否深色模式（影响阴影强度）
 */
export function drawStyledCard(ctx, x, y, w, h, r, fill, isDark = false) {
  ctx.save();
  const shadowOpacity = isDark ? 0.3 : 0.1;
  ctx.setShadow(0, 4, 20, `rgba(0, 0, 0, ${shadowOpacity})`);
  ctx.beginPath();
  ctx.setFillStyle(fill);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 文本换行绘制（支持中英文混合）
 * @param {Object} ctx - Canvas 2D 上下文
 * @param {string} text - 要绘制的文本内容
 * @param {number} x - 起始 X 坐标
 * @param {number} y - 起始 Y 坐标
 * @param {number} maxWidth - 每行最大宽度（像素）
 * @param {number} lineHeight - 行高（像素）
 * @param {number} [maxY=1200] - 最大 Y 坐标（超出则截断）
 */
export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxY = 1200) {
  const paragraphs = text.split('\n');
  let currentY = y;
  let truncated = false;

  // [AUDIT FIX] 使用 for 循环替代 forEach，确保截断时能正确跳出所有段落
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    if (truncated) break;
    const para = paragraphs[pIdx];

    if (pIdx > 0) {
      currentY += lineHeight * 0.5;
    }

    const chars = para.split('');
    let line = '';

    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = chars[n];
        currentY += lineHeight;

        if (currentY > maxY) {
          ctx.fillText('...', x, currentY);
          truncated = true;
          break;
        }
      } else {
        line = testLine;
      }
    }

    if (!truncated && line && currentY <= maxY) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
  }
}

/**
 * 绘制能力雷达图
 * @param {Object} ctx - Canvas 2D 上下文
 * @param {number} x - 雷达图中心 X 坐标
 * @param {number} y - 雷达图中心 Y 坐标
 * @param {number} r - 雷达图半径
 * @param {Array<{category: string, rate: number}>} data - 各维度数据
 * @param {Object} theme - 主题色配置对象
 */
export function drawRadarChart(ctx, x, y, r, data, theme) {
  if (!data || data.length === 0) return;

  const numPoints = data.length;
  const angleStep = (2 * Math.PI) / numPoints;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);

  // 1. 蜘蛛网背景
  ctx.setStrokeStyle(theme.subText);
  ctx.setLineWidth(1);
  ctx.setGlobalAlpha(0.2);
  for (let level = 1; level <= 5; level++) {
    const levelRadius = (r / 5) * level;
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep;
      const px = levelRadius * Math.cos(angle);
      const py = levelRadius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 2. 轴线和标签
  ctx.setFontSize(24);
  ctx.setFillStyle(theme.mainText);
  ctx.setTextAlign('center');
  ctx.setTextBaseline('middle');
  ctx.setGlobalAlpha(0.8);
  ctx.setLineWidth(1);
  ctx.setStrokeStyle(theme.subText);

  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep;
    const endX = r * Math.cos(angle);
    const endY = r * Math.sin(angle);
    const labelRadius = r + 40;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.save();
    const labelX = labelRadius * Math.cos(angle);
    const labelY = labelRadius * Math.sin(angle);
    ctx.translate(labelX, labelY);
    ctx.rotate(Math.PI / 2 + angle);
    ctx.fillText(data[i].category, 0, 0);
    ctx.restore();
  }

  // 3. 数据多边形
  ctx.beginPath();
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep;
    const dataRadius = r * data[i].rate;
    const px = dataRadius * Math.cos(angle);
    const py = dataRadius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  ctx.setFillStyle(theme.accent);
  ctx.setGlobalAlpha(0.4);
  ctx.fill();

  ctx.setGlobalAlpha(1.0);
  ctx.setLineWidth(4);
  ctx.setStrokeStyle(theme.accent);
  ctx.setLineJoin('round');
  ctx.stroke();

  // 4. 数据点
  ctx.setFillStyle('#FFFFFF');
  ctx.setStrokeStyle(theme.accent);
  ctx.setLineWidth(2);
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep;
    const dataRadius = r * data[i].rate;
    const px = dataRadius * Math.cos(angle);
    const py = dataRadius * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 绘制水平分隔线
 * @param {Object} ctx - Canvas 2D 上下文
 * @param {number} x1 - 起始 X
 * @param {number} x2 - 结束 X
 * @param {number} y - Y 坐标
 * @param {string} color - 线条颜色
 */
export function drawDivider(ctx, x1, x2, y, color) {
  ctx.save();
  ctx.setStrokeStyle(color);
  ctx.setLineWidth(2);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/**
 * 将 Canvas 导出为临时图片文件
 * @param {string} canvasId - Canvas 组件 ID
 * @param {Object} component - Vue 组件实例 (this)
 * @returns {Promise<string>} 临时图片路径
 */
export function canvasToImage(canvasId, component) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      uni.canvasToTempFilePath(
        {
          canvasId,
          quality: 0.92,
          success: (res) => {
            const path = res.tempFilePath || '';
            if (!path) {
              reject(new Error('图片路径为空'));
            } else {
              resolve(path);
            }
          },
          fail: reject
        },
        component
      );
    }, 300);
  });
}

/**
 * 绘制单行文本标签（消除重复的 setFillStyle/setFontSize/fillText 模式）
 * @param {Object} ctx - Canvas 2D 上下文
 * @param {string} text - 文本内容
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {Object} [options] - 配置选项
 * @param {number} [options.fontSize=28] - 字体大小
 * @param {string} [options.color='#333'] - 文字颜色
 * @param {string} [options.align='left'] - 对齐方式
 */
export function drawLabel(ctx, text, x, y, { fontSize = 28, color = '#333', align = 'left' } = {}) {
  ctx.save();
  ctx.setFillStyle(color);
  ctx.setFontSize(fontSize);
  ctx.setTextAlign(align);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * 绘制报告背景（渐变 + 装饰圆）
 * @param {Object} ctx - Canvas 2D 上下文
 * @param {number} w - 画布宽度
 * @param {number} h - 画布高度
 * @param {Object} theme - 主题色配置
 * @param {boolean} isDark - 是否深色模式
 */
export function drawReportBackground(ctx, w, h, theme, isDark) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, theme.bgStart);
  grad.addColorStop(1, theme.bgEnd);
  ctx.setFillStyle(grad);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.setGlobalAlpha(isDark ? 0.2 : 0.5);
  ctx.beginPath();
  ctx.arc(w, 0, 400, 0, 2 * Math.PI);
  ctx.setFillStyle(theme.accent);
  ctx.fill();
  ctx.restore();
}
