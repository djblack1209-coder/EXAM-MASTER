/* global __YOZI_WEBSITE__ */
export const WEBSITE_MODE = typeof __YOZI_WEBSITE__ !== 'undefined' && __YOZI_WEBSITE__ === true;
export const MAC_DOWNLOAD = Object.freeze({
  url: '/downloads/Yozi-AI-2.2.0-macOS-arm64.zip',
  version: '2.2.0',
  platform: 'macOS 14+ · Apple silicon',
  channel: 'macOS'
});
