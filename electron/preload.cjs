/**
 * Electron preload 脚本
 * 在渲染进程中提供安全的 API 桥接
 */

const { contextBridge } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  isElectron: true,

  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});
