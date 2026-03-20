/**
 * 答题音效模块 - 使用 Web Audio API 程序化生成音效
 *
 * 功能：
 * 1. 正确答案音效 - 上行双音 (C5 → E5)
 * 2. 错误答案音效 - 下行蜂鸣 (A3 → F3, 轻微失真)
 * 3. 连击音效 - 根据等级递增的和弦
 * 4. 点击音效 - 短促滴答声
 * 5. 小程序平台降级为震动反馈
 *
 * 音频上下文池化管理，最多 3 个实例
 */

import { logger } from '@/utils/logger.js';

// ==================== 状态管理 ====================

const STORAGE_KEY = 'quiz_sound_enabled';
let _soundEnabled = true; // ✅ [体感革命] 默认开启音效，让用户第一次就感受到反馈

// 启动时从存储读取偏好（已设置过的用户尊重其选择）
try {
  const stored = uni.getStorageSync(STORAGE_KEY);
  if (stored === false) {
    _soundEnabled = false; // 只有明确关闭过才禁用
  }
} catch (_e) {
  _soundEnabled = true;
}

// ==================== Web Audio API 检测 ====================

let _audioCtx = null;
let _webAudioSupported = false;

function getAudioContext() {
  if (_audioCtx && _audioCtx.state !== 'closed') return _audioCtx;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      _audioCtx = new AudioCtx();
      _webAudioSupported = true;
      return _audioCtx;
    }
  } catch (_e) {
    // Web Audio API 不可用（小程序环境）
  }
  _webAudioSupported = false;
  return null;
}

// 延迟初始化，首次播放时检测
function ensureAudioContext() {
  if (_audioCtx && _audioCtx.state !== 'closed') {
    // 某些浏览器需要 resume 被挂起的上下文
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => { /* ignore */ });
    }
    return _audioCtx;
  }
  return getAudioContext();
}

// ==================== 音频上下文池（uni-app InnerAudioContext）====================

const MAX_POOL_SIZE = 3;
const _audioPool = [];

function getPooledAudio() {
  // 回收已停止的实例
  const idle = _audioPool.find((a) => a._idle);
  if (idle) {
    idle._idle = false;
    return idle;
  }
  if (_audioPool.length < MAX_POOL_SIZE) {
    try {
      const ctx = uni.createInnerAudioContext();
      ctx._idle = false;
      ctx.onEnded(() => {
        ctx._idle = true;
      });
      ctx.onError(() => {
        ctx._idle = true;
      });
      _audioPool.push(ctx);
      return ctx;
    } catch (_e) {
      return null;
    }
  }
  // 池满，强制复用最早的
  const oldest = _audioPool[0];
  oldest.stop();
  oldest._idle = false;
  return oldest;
}

// ==================== 音符频率表 ====================

const NOTE_FREQ = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
  A3: 220.0,
  F3: 174.61,
  G3: 196.0
};

// ==================== 核心音效生成 ====================

/**
 * 播放一个音调
 * @param {number} freq - 频率 Hz
 * @param {number} duration - 持续时间 秒
 * @param {number} startOffset - 延迟开始 秒
 * @param {Object} opts - 可选参数 { type, gain, detune }
 */
function playTone(freq, duration, startOffset = 0, opts = {}) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + startOffset;
  const { type = 'sine', gain: gainVal = 0.15, detune = 0 } = opts;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (detune) osc.detune.setValueAtTime(detune, now);

  // 包络：快速起音，自然衰减
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gainVal, now + 0.01);
  gainNode.gain.linearRampToValueAtTime(gainVal * 0.8, now + duration * 0.6);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

// ==================== 小程序震动降级 ====================

function vibrateFallback(pattern = 'light') {
  try {
    if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type: pattern });
    }
  } catch (_e) {
    // 静默失败
  }
}

function vibratePattern(count, interval = 100) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => vibrateFallback('light'), i * interval);
  }
}

// ==================== 导出的音效函数 ====================

/**
 * 正确答案音效 - 上行双音 C5 → E5，各 100ms
 */
export function playCorrectSound() {
  if (!_soundEnabled) return;

  if (_webAudioSupported || ensureAudioContext()) {
    playTone(NOTE_FREQ.C5, 0.1, 0, { type: 'sine', gain: 0.15 });
    playTone(NOTE_FREQ.E5, 0.1, 0.1, { type: 'sine', gain: 0.15 });
  } else {
    vibrateFallback('light');
  }
}

/**
 * 错误答案音效 - 下行蜂鸣 A3 → F3，150ms，轻微失真
 */
export function playWrongSound() {
  if (!_soundEnabled) return;

  if (_webAudioSupported || ensureAudioContext()) {
    playTone(NOTE_FREQ.A3, 0.15, 0, { type: 'sawtooth', gain: 0.1, detune: 15 });
    playTone(NOTE_FREQ.F3, 0.15, 0.12, { type: 'sawtooth', gain: 0.1, detune: -15 });
  } else {
    vibratePattern(2, 80);
  }
}

/**
 * 连击音效 - 根据等级播放递增和弦
 * @param {number} level - 连击等级 0-4
 */
export function playComboSound(level = 0) {
  if (!_soundEnabled) return;

  const clampedLevel = Math.max(0, Math.min(4, level));

  if (_webAudioSupported || ensureAudioContext()) {
    // 不同等级的和弦音符组合，等级越高音符越多越丰富
    const chords = [
      [NOTE_FREQ.C5], // level 0: 单音
      [NOTE_FREQ.C5, NOTE_FREQ.E5], // level 1: 大三度
      [NOTE_FREQ.C5, NOTE_FREQ.E5, NOTE_FREQ.G5], // level 2: 大三和弦
      [NOTE_FREQ.C5, NOTE_FREQ.E5, NOTE_FREQ.G5, NOTE_FREQ.B5], // level 3: 大七和弦
      [NOTE_FREQ.C5, NOTE_FREQ.E5, NOTE_FREQ.G5, NOTE_FREQ.B5, NOTE_FREQ.C6] // level 4: 完整和弦+八度
    ];

    const notes = chords[clampedLevel];
    const gain = 0.1 / Math.sqrt(notes.length); // 防止多音叠加过响

    notes.forEach((freq, i) => {
      playTone(freq, 0.2, i * 0.03, { type: 'sine', gain });
    });
  } else {
    vibratePattern(clampedLevel + 1, 60);
  }
}

/**
 * 点击音效 - 短促滴答声 1000Hz, 30ms
 */
export function playClickSound() {
  if (!_soundEnabled) return;

  if (_webAudioSupported || ensureAudioContext()) {
    playTone(1000, 0.03, 0, { type: 'sine', gain: 0.08 });
  } else {
    vibrateFallback('light');
  }
}

/**
 * ✅ [体感革命] 练习完成 fanfare — 上行琶音 C5→E5→G5→C6
 */
export function playCompleteFanfare() {
  if (!_soundEnabled) return;

  if (_webAudioSupported || ensureAudioContext()) {
    playTone(NOTE_FREQ.C5, 0.2, 0, { type: 'sine', gain: 0.12 });
    playTone(NOTE_FREQ.E5, 0.2, 0.15, { type: 'sine', gain: 0.12 });
    playTone(NOTE_FREQ.G5, 0.2, 0.3, { type: 'sine', gain: 0.12 });
    playTone(NOTE_FREQ.C6, 0.4, 0.45, { type: 'sine', gain: 0.15 });
  } else {
    vibratePattern(3, 100);
  }
}

/**
 * 设置音效开关
 * @param {boolean} enabled
 */
export function setSoundEnabled(enabled) {
  _soundEnabled = !!enabled;
  try {
    uni.setStorageSync(STORAGE_KEY, _soundEnabled);
  } catch (_e) {
    logger.warn('[QuizSound] 保存音效设置失败:', e);
  }
}

/**
 * 获取当前音效开关状态
 * @returns {boolean}
 */
export function isSoundEnabled() {
  return _soundEnabled;
}

/**
 * 销毁音频资源（页面卸载时调用）
 */
export function destroySoundResources() {
  _audioPool.forEach((ctx) => {
    try {
      ctx.destroy();
    } catch (_e) {}
  });
  _audioPool.length = 0;

  if (_audioCtx && _audioCtx.state !== 'closed') {
    try {
      _audioCtx.close();
    } catch (_e) {}
    _audioCtx = null;
  }
}
