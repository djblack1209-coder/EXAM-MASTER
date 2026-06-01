import pako from 'pako/dist/pako_inflate.min.js';

const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
const cache = new Map();

function base64ToBytes(base64) {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && typeof wx.base64ToArrayBuffer === 'function') {
    return new Uint8Array(wx.base64ToArrayBuffer(base64));
  }
  // #endif

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  throw new Error('当前环境不支持题库解码');
}

function bytesToText(bytes) {
  if (textDecoder) {
    return textDecoder.decode(bytes);
  }

  let binary = '';
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return decodeURIComponent(escape(binary));
}

export function decodeBankData(bankId, compressedBase64) {
  if (cache.has(bankId)) {
    return cache.get(bankId);
  }

  const compressedBytes = base64ToBytes(compressedBase64);
  const jsonBytes = pako.inflate(compressedBytes);
  const bank = JSON.parse(bytesToText(jsonBytes));
  cache.set(bankId, bank);
  return bank;
}
