import { logger } from '@/utils/logger.js';

export function inferImageMimeType(path = '') {
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export function filePathToBase64(path) {
  return new Promise((resolve, reject) => {
    if (!path) {
      reject(new Error('图片路径为空'));
      return;
    }

    // #ifdef MP-WEIXIN
    try {
      uni.getFileSystemManager().readFile({
        filePath: path,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: (err) => reject(new Error(err?.errMsg || '读取图片失败'))
      });
      return;
    } catch (e) {
      reject(new Error(e?.message || '读取图片失败'));
      return;
    }
    // #endif

    // #ifdef H5
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL(inferImageMimeType(path), 0.9);
        resolve(dataURL.split(',')[1]);
      } catch (err) {
        reject(new Error(err?.message || '转换图片失败'));
      }
    };
    img.onerror = () => reject(new Error('加载图片失败'));
    img.src = path;
    return;
    // #endif

    // #ifdef APP-PLUS
    try {
      plus.io.resolveLocalFileSystemURL(
        path,
        (entry) => {
          const ioEntry = /** @type {any} */ (entry);
          ioEntry.file((file) => {
            const reader = new plus.io.FileReader();
            reader.onloadend = (e) => {
              try {
                const result = /** @type {any} */ (e)?.target?.result || '';
                resolve(String(result).split(',')[1] || '');
              } catch (err) {
                reject(new Error(err?.message || '转换图片失败'));
              }
            };
            reader.onerror = () => reject(new Error('读取图片失败'));
            reader.readAsDataURL(file);
          });
        },
        () => reject(new Error('解析图片路径失败'))
      );
      return;
    } catch (e) {
      reject(new Error(e?.message || '读取图片失败'));
      return;
    }
    // #endif

    logger.warn('[image-base64] 未匹配的平台，无法转换图片');
    reject(new Error('当前平台暂不支持图片转换'));
  });
}
