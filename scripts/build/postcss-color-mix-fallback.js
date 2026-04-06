/**
 * PostCSS 插件：为包含 var() 的 color-mix() 自动生成 rgba 回退值
 *
 * 问题背景：
 *   color-mix(in srgb, var(--primary) 18%, transparent) 在旧版 WebView 中不支持
 *   （Chrome < 111 / Safari < 16.2 / 微信小程序旧版 X5 内核）
 *   官方 @csstools/postcss-color-mix-function 无法处理 var() 引用
 *
 * 解决方案：
 *   在构建时为每个 color-mix 声明前插入一行 rgba() 回退值
 *   旧浏览器使用 rgba 回退；新浏览器使用 color-mix 覆盖
 *
 * 局限性：
 *   回退值基于浅色模式的变量值，深色模式下回退颜色可能不准确
 *   但至少保证元素可见，不会出现"完全消失"的情况
 */

// 浅色模式下 CSS 变量的原始色值映射
const LIGHT_MODE_VARS = {
  '--primary': '#4a90e2',
  '--brand': '#4a90e2',
  '--success': '#34d399',
  '--warning': '#f59e0b',
  '--danger': '#ef4444',
  '--info': '#4a90e2',
  '--text-tertiary': '#9ca3af',
  '--info-blue': '#4a90e2',
  '--apple-glass-card-bg': 'rgba(255, 255, 255, 0.72)',
  '--apple-group-bg': 'rgba(255, 255, 255, 0.78)'
};

/**
 * 将 hex 颜色转换为 [r, g, b, a] 数组
 * @param {string} color - 支持 #RGB, #RRGGBB, rgba(r,g,b,a) 格式
 * @returns {number[]} [r, g, b, a] 其中 r/g/b 为 0-255, a 为 0-1
 */
function parseColor(color) {
  color = color.trim();

  // rgba(r, g, b, a)
  const rgbaMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1]),
      parseInt(rgbaMatch[2]),
      parseInt(rgbaMatch[3]),
      rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    ];
  }

  // #RGB 或 #RRGGBB
  let hex = color.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length === 6) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
  }

  return null;
}

/**
 * 在 sRGB 色域中混合两个颜色
 * @param {number[]} color1 - [r, g, b, a]
 * @param {number} pct1 - color1 的百分比 (0-100)
 * @param {number[]} color2 - [r, g, b, a]
 * @param {number} pct2 - color2 的百分比 (0-100)
 * @returns {string} rgba() 字符串
 */
function mixColors(color1, pct1, color2, pct2) {
  const p1 = pct1 / 100;
  const p2 = pct2 / 100;

  const r = Math.round(color1[0] * p1 + color2[0] * p2);
  const g = Math.round(color1[1] * p1 + color2[1] * p2);
  const b = Math.round(color1[2] * p1 + color2[2] * p2);
  const a = color1[3] * p1 + color2[3] * p2;

  // 优化输出格式：a=1 时省略 alpha
  if (Math.abs(a - 1) < 0.001) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  // 保留最多 4 位小数，去除尾部零
  const aStr = parseFloat(a.toFixed(4));
  return `rgba(${r}, ${g}, ${b}, ${aStr})`;
}

// 匹配 color-mix(in srgb, var(--xxx) YY%, ZZZ) 的正则
// 捕获组：1=变量名, 2=百分比, 3=第二个颜色
const COLOR_MIX_VAR_RE =
  /color-mix\(\s*in\s+srgb\s*,\s*var\(\s*(--[\w-]+)\s*\)\s+(\d+)%\s*,\s*([\w#]+(?:\([^)]*\))?)\s*\)/g;

/**
 * @type {import('postcss').PluginCreator}
 */
function postcssColorMixFallback() {
  return {
    postcssPlugin: 'postcss-color-mix-var-fallback',
    Declaration(decl) {
      // 跳过不含 color-mix 的声明
      if (!decl.value.includes('color-mix(')) return;
      // 跳过不含 var() 的声明（官方插件已处理纯色值）
      if (!decl.value.includes('var(')) return;
      // 跳过已有回退的声明（避免重复处理）
      if (decl.prev() && decl.prev().prop === decl.prop && !decl.prev().value.includes('color-mix(')) return;

      let fallbackValue = decl.value;
      let hasReplacement = false;

      fallbackValue = fallbackValue.replace(COLOR_MIX_VAR_RE, (_match, varName, pctStr, color2Str) => {
        const pct1 = parseInt(pctStr);
        const pct2 = 100 - pct1;

        // 查找变量的浅色模式值
        const varValue = LIGHT_MODE_VARS[varName];
        if (!varValue) return _match; // 未知变量，保留原样

        const color1 = parseColor(varValue);
        if (!color1) return _match;

        // 解析第二个颜色
        let color2;
        if (color2Str === 'transparent') {
          color2 = [0, 0, 0, 0];
        } else {
          color2 = parseColor(color2Str);
          if (!color2) return _match;
        }

        hasReplacement = true;

        // 处理 transparent 作为第二色的特殊情况（最常见）
        // color-mix(in srgb, COLOR X%, transparent) = COLOR with X% opacity
        if (color2Str === 'transparent') {
          const a = color1[3] * (pct1 / 100);
          const aStr = parseFloat(a.toFixed(4));
          return `rgba(${color1[0]}, ${color1[1]}, ${color1[2]}, ${aStr})`;
        }

        return mixColors(color1, pct1, color2, pct2);
      });

      if (hasReplacement && fallbackValue !== decl.value) {
        // 在当前声明前插入回退值
        decl.cloneBefore({ value: fallbackValue });
      }
    }
  };
}

postcssColorMixFallback.postcss = true;

export default postcssColorMixFallback;
