/**
 * 答题音频反馈模块。
 *
 * H5 使用 Web Audio 生成短促、低音量的交互提示；小程序不可用时降级为轻震动。
 * 所有声音都可通过 quiz_sound_enabled 关闭，且带节流，避免连续答题时堆叠。
 */

import { logger } from '@/utils/logger.js';

// ==================== 状态管理 ====================

export const STORAGE_KEY = 'quiz_sound_enabled';
let _soundEnabled = true;
const _lastPlayedAt = new Map();

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
    const AudioCtx =
      typeof window !== 'undefined' ? window.AudioContext || /** @type {any} */ (window).webkitAudioContext : null;
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
      _audioCtx.resume().catch(() => {
        /* ignore */
      });
    }
    return _audioCtx;
  }
  return getAudioContext();
}

// ==================== 音符频率表 ====================

const NOTE_FREQ = {
  B3: 246.94,
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

const AUDIO_EVENTS = {
  tap: { throttle: 45, haptic: 'light' },
  correct: { throttle: 110, haptic: 'light' },
  wrong: { throttle: 150, haptic: 'medium' },
  combo: { throttle: 650, haptic: 'light' },
  flip: { throttle: 180, haptic: 'light' },
  complete: { throttle: 2000, haptic: 'medium' },
  achievement: { throttle: 900, haptic: 'medium' }
};

function shouldPlay(eventName) {
  if (!_soundEnabled) return false;
  const config = AUDIO_EVENTS[eventName] || { throttle: 80 };
  const now = Date.now();
  const last = _lastPlayedAt.get(eventName) || 0;
  if (now - last < config.throttle) return false;
  _lastPlayedAt.set(eventName, now);
  return true;
}

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
  const { type = 'sine', gain: gainVal = 0.09, detune = 0, attack = 0.008, releaseRatio = 1 } = opts;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (detune) osc.detune.setValueAtTime(detune, now);

  // 包络：快速起音，自然衰减
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gainVal, now + attack);
  gainNode.gain.linearRampToValueAtTime(gainVal * 0.8, now + duration * 0.6);
  gainNode.gain.linearRampToValueAtTime(0, now + duration * releaseRatio);

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

function playEvent(eventName, webAudioPlayer, fallback = null) {
  if (!shouldPlay(eventName)) return false;

  if (_webAudioSupported || ensureAudioContext()) {
    webAudioPlayer();
  } else if (fallback) {
    fallback();
  } else {
    vibrateFallback(AUDIO_EVENTS[eventName]?.haptic || 'light');
  }
  return true;
}

// ==================== 导出的音效函数 ====================

/** 正确答案：明亮双音，短促且不刺耳。 */
export function playCorrectSound() {
  return playEvent('correct', () => {
    playTone(NOTE_FREQ.E5, 0.07, 0, { type: 'sine', gain: 0.07 });
    playTone(NOTE_FREQ.G5, 0.1, 0.075, { type: 'triangle', gain: 0.065 });
  });
}

/** 错误答案：柔和低频提示，不做刺耳惩罚音。 */
export function playWrongSound() {
  return playEvent(
    'wrong',
    () => {
      playTone(NOTE_FREQ.B3, 0.09, 0, { type: 'triangle', gain: 0.065 });
      playTone(NOTE_FREQ.G3, 0.12, 0.07, { type: 'sine', gain: 0.055 });
    },
    () => vibrateFallback('medium')
  );
}

/**
 * 连击音效：每 5 连击触发一次短上行音型。
 * @param {number} level - 连击等级 0-4
 */
export function playComboSound(level = 0) {
  const clampedLevel = Math.max(0, Math.min(4, level));
  return playEvent(
    'combo',
    () => {
      const sequences = [
        [NOTE_FREQ.G5, NOTE_FREQ.A5],
        [NOTE_FREQ.G5, NOTE_FREQ.A5, NOTE_FREQ.C6],
        [NOTE_FREQ.E5, NOTE_FREQ.G5, NOTE_FREQ.A5, NOTE_FREQ.C6],
        [NOTE_FREQ.E5, NOTE_FREQ.G5, NOTE_FREQ.B5, NOTE_FREQ.C6],
        [NOTE_FREQ.G5, NOTE_FREQ.A5, NOTE_FREQ.B5, NOTE_FREQ.C6]
      ];
      const notes = sequences[clampedLevel];
      const gain = 0.055 / Math.sqrt(notes.length);
      notes.forEach((freq, i) => {
        playTone(freq, 0.075, i * 0.045, { type: 'triangle', gain });
      });
    },
    () => vibratePattern(Math.min(clampedLevel + 1, 3), 55)
  );
}

/** 点击/选择：20-40ms 低音量轻触音。 */
export function playClickSound() {
  return playEvent('tap', () => {
    playTone(880, 0.026, 0, { type: 'sine', gain: 0.035, attack: 0.004 });
  });
}

/** 翻卡：短纸感轻拨音。 */
export function playFlipSound() {
  return playEvent('flip', () => {
    playTone(NOTE_FREQ.C5, 0.035, 0, { type: 'triangle', gain: 0.04, detune: -8, attack: 0.004 });
    playTone(NOTE_FREQ.G4, 0.045, 0.032, { type: 'sine', gain: 0.028, detune: 8, attack: 0.004 });
  });
}

/** 成就/升级：短上行 flourish，区别于完成乐句。 */
export function playAchievementSound() {
  return playEvent(
    'achievement',
    () => {
      [NOTE_FREQ.D5, NOTE_FREQ.G5, NOTE_FREQ.B5].forEach((freq, i) => {
        playTone(freq, 0.09, i * 0.055, { type: 'triangle', gain: 0.05 });
      });
    },
    () => vibratePattern(2, 70)
  );
}

/** 练习完成：温和完成乐句，约 1.3 秒。 */
export function playCompleteFanfare() {
  return playEvent(
    'complete',
    () => {
      const notes = [
        [NOTE_FREQ.C5, 0, 0.12, 0.06],
        [NOTE_FREQ.E5, 0.16, 0.12, 0.055],
        [NOTE_FREQ.G5, 0.32, 0.14, 0.055],
        [NOTE_FREQ.C6, 0.5, 0.32, 0.065],
        [NOTE_FREQ.G5, 0.82, 0.26, 0.035]
      ];
      notes.forEach((freq, i) => {
        if (Array.isArray(freq)) {
          playTone(freq[0], freq[2], freq[1], { type: i === 3 ? 'sine' : 'triangle', gain: freq[3] });
        }
      });
    },
    () => vibratePattern(3, 100)
  );
}

/**
 * 通用事件入口，便于页面侧只表达意图。
 * @param {'tap'|'correct'|'wrong'|'combo'|'flip'|'complete'|'achievement'} eventName
 * @param {Object} options
 */
export function playQuizSound(eventName, options = {}) {
  switch (eventName) {
    case 'tap':
      return playClickSound();
    case 'correct':
      return playCorrectSound();
    case 'wrong':
      return playWrongSound();
    case 'combo':
      return playComboSound(options.level || 0);
    case 'flip':
      return playFlipSound();
    case 'complete':
      return playCompleteFanfare();
    case 'achievement':
      return playAchievementSound();
    default:
      return false;
  }
}

export function getAudioFeedbackProfile() {
  return {
    tap: '20-40ms low-volume touch cue',
    correct: '120-180ms bright two-note cue',
    wrong: '120-180ms soft low cue',
    combo: 'short rising motif throttled at combo milestones',
    flip: 'short paper-like flip cue',
    complete: 'warm 1.2-1.8s completion phrase',
    achievement: 'ascending flourish distinct from completion'
  };
}

export function resetSoundThrottle() {
  _lastPlayedAt.clear();
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
    logger.warn('[QuizSound] 保存音效设置失败:', _e);
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
  _lastPlayedAt.clear();

  if (_audioCtx && _audioCtx.state !== 'closed') {
    try {
      _audioCtx.close();
    } catch (_e) {
      /* AudioContext 关闭失败不影响功能 */
    }
    _audioCtx = null;
  }
}
