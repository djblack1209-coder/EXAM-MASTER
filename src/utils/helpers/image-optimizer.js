/**
 * 图片优化工具
 * 用于图片压缩、格式转换、懒加载等优化操作
 */

/**
 * 图片压缩配置
 */
const COMPRESS_CONFIG = {
  // 最大宽度
  maxWidth: 1080,
  // 最大高度
  maxHeight: 1920,
  // 压缩质量 (0-1)
  quality: 0.8,
  // 头像尺寸
  avatarSize: 200,
  // 缩略图尺寸
  thumbnailSize: 150
};

/**
 * 压缩图片
 * @param {string} src - 图片路径或base64
 * @param {Object} options - 压缩选项
 * @returns {Promise<string>} 压缩后的base64
 */
export function compressImage(src, options = {}) {
  const config = { ...COMPRESS_CONFIG, ...options };

  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    // 微信小程序使用 canvas 压缩
    wx.getImageInfo({
      src,
      success: (info) => {
        const { width, height } = calculateSize(info.width, info.height, config.maxWidth, config.maxHeight);

        // 创建离屏 canvas
        const canvas = wx.createOffscreenCanvas({ type: '2d', width, height });
        const ctx = canvas.getContext('2d');

        const img = canvas.createImage();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);

          // 导出为 base64
          const base64 = canvas.toDataURL('image/jpeg', config.quality);
          resolve(base64);
        };
        img.onerror = reject;
        img.src = src;
      },
      fail: reject
    });
    // #endif

    // #ifdef H5
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const { width, height } = calculateSize(img.width, img.height, config.maxWidth, config.maxHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const base64 = canvas.toDataURL('image/jpeg', config.quality);
      resolve(base64);
    };
    img.onerror = reject;
    img.src = src;
    // #endif

    // #ifdef APP-PLUS
    plus.io.resolveLocalFileSystemURL(src, (entry) => {
      entry.file((file) => {
        const reader = new plus.io.FileReader();
        reader.onloadend = (e) => {
          resolve(e.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }, reject);
    // #endif
  });
}

/**
 * 计算压缩后的尺寸
 * @param {number} width - 原始宽度
 * @param {number} height - 原始高度
 * @param {number} maxWidth - 最大宽度
 * @param {number} maxHeight - 最大高度
 * @returns {Object} { width, height }
 */
function calculateSize(width, height, maxWidth, maxHeight) {
  let newWidth = width;
  let newHeight = height;

  // 按比例缩放
  if (width > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round(height * (maxWidth / width));
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round(newWidth * (maxHeight / newHeight));
  }

  return { width: newWidth, height: newHeight };
}

/**
 * 压缩头像图片
 * @param {string} src - 图片路径
 * @returns {Promise<string>} 压缩后的base64
 */
export function compressAvatar(src) {
  return compressImage(src, {
    maxWidth: COMPRESS_CONFIG.avatarSize,
    maxHeight: COMPRESS_CONFIG.avatarSize,
    quality: 0.85
  });
}

/**
 * 生成缩略图
 * @param {string} src - 图片路径
 * @param {number} size - 缩略图尺寸
 * @returns {Promise<string>} 缩略图base64
 */
export function generateThumbnail(src, size = COMPRESS_CONFIG.thumbnailSize) {
  return compressImage(src, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.7
  });
}

/**
 * 图片懒加载指令
 * 使用方式: v-lazy="imageUrl"
 */
export const lazyLoadDirective = {
  mounted(el, binding) {
    const defaultSrc = '/static/images/placeholder.png';
    const targetSrc = binding.value;

    // 设置占位图
    el.src = defaultSrc;
    el.dataset.src = targetSrc;

    // 使用 IntersectionObserver 实现懒加载
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.onload = () => {
              img.classList.add('loaded');
            };
            img.onerror = () => {
              img.src = defaultSrc;
            };
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      observer.observe(el);
      el._lazyObserver = observer;
    } else {
      // 降级处理：直接加载
      el.src = targetSrc;
    }
  },

  updated(el, binding) {
    if (binding.value !== binding.oldValue) {
      el.dataset.src = binding.value;
      if (el._lazyObserver) {
        el._lazyObserver.observe(el);
      }
    }
  },

  unmounted(el) {
    if (el._lazyObserver) {
      el._lazyObserver.disconnect();
    }
  }
};

/**
 * 图片预加载
 * @param {string[]} urls - 图片URL列表
 * @returns {Promise<void>}
 */
export function preloadImages(urls) {
  const promises = urls.map((url) => {
    return new Promise((resolve, _reject) => {
      // #ifdef H5
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve; // 即使失败也继续
      img.src = url;
      // #endif

      // #ifdef MP-WEIXIN
      wx.getImageInfo({
        src: url,
        success: resolve,
        fail: resolve
      });
      // #endif

      // #ifndef H5 || MP-WEIXIN
      resolve();
      // #endif
    });
  });

  return Promise.all(promises);
}

/**
 * 获取图片信息
 * @param {string} src - 图片路径
 * @returns {Promise<Object>} 图片信息
 */
export function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    wx.getImageInfo({
      src,
      success: resolve,
      fail: reject
    });
    // #endif

    // #ifdef H5
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
        path: src,
        type: src.split('.').pop() || 'unknown'
      });
    };
    img.onerror = reject;
    img.src = src;
    // #endif

    // #ifndef H5 || MP-WEIXIN
    uni.getImageInfo({
      src,
      success: resolve,
      fail: reject
    });
    // #endif
  });
}

/**
 * 选择并压缩图片
 * @param {Object} options - 选择选项
 * @returns {Promise<Object>} { tempFilePath, base64, width, height }
 */
export function chooseAndCompressImage(options = {}) {
  const defaultOptions = {
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    maxWidth: COMPRESS_CONFIG.maxWidth,
    maxHeight: COMPRESS_CONFIG.maxHeight,
    quality: COMPRESS_CONFIG.quality
  };

  const config = { ...defaultOptions, ...options };

  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: config.count,
      sizeType: config.sizeType,
      sourceType: config.sourceType,
      success: async (res) => {
        try {
          const tempFilePath = res.tempFilePaths[0];
          const info = await getImageInfo(tempFilePath);

          // 如果图片尺寸超过限制，进行压缩
          if (info.width > config.maxWidth || info.height > config.maxHeight) {
            const base64 = await compressImage(tempFilePath, config);
            resolve({
              tempFilePath,
              base64,
              width: Math.min(info.width, config.maxWidth),
              height: Math.min(info.height, config.maxHeight),
              compressed: true
            });
          } else {
            // 不需要压缩，直接返回
            resolve({
              tempFilePath,
              base64: null,
              width: info.width,
              height: info.height,
              compressed: false
            });
          }
        } catch (err) {
          reject(err);
        }
      },
      fail: reject
    });
  });
}

/**
 * 图片缓存管理
 */
class ImageCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (this.cache.has(key)) {
      // LRU: 移到最后
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

// 导出图片缓存实例
export const imageCache = new ImageCache();

export default {
  compressImage,
  compressAvatar,
  generateThumbnail,
  lazyLoadDirective,
  preloadImages,
  getImageInfo,
  chooseAndCompressImage,
  imageCache,
  COMPRESS_CONFIG
};
