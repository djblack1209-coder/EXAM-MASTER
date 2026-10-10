import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindPlayfulGaze } from '@/design/playful-gaze.js';
import { bindFutureSky, FUTURE_ASSETS } from '@/design/future-motion.js';
import { bindBusinessMotion } from '@/design/business-motion.js';

afterEach(() => vi.restoreAllMocks());

function legacyMedia(matches) {
  const listeners = new Set();
  return {
    matches,
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    set(value) {
      this.matches = value;
      for (const listener of listeners) listener();
    },
    get listenerCount() {
      return listeners.size;
    }
  };
}

function videoFixture() {
  const video = document.createElement('video');
  vi.spyOn(video, 'play').mockResolvedValue(undefined);
  vi.spyOn(video, 'pause').mockImplementation(() => undefined);
  vi.spyOn(video, 'load').mockImplementation(() => undefined);
  return video;
}

describe('学习首页动效的实际播放与生命周期', () => {
  it('业务浮层跟随减少动态效果，旧浏览器监听在卸载后释放', () => {
    const reduced = legacyMedia(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(reduced);
    const change = vi.fn();
    const release = bindBusinessMotion(change);
    expect(change).toHaveBeenLastCalledWith(false);
    reduced.set(true);
    expect(change).toHaveBeenLastCalledWith(true);
    release();
    expect(reduced.listenerCount).toBe(0);
    const calls = change.mock.calls.length;
    reduced.set(false);
    expect(change).toHaveBeenCalledTimes(calls);
  });
  it('旧 WebView 的手机眼睛视频尊重减少动效，卸载后释放监听', () => {
    const mobile = legacyMedia(true);
    const reduced = legacyMedia(false);
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => (query.includes('max-width') ? mobile : reduced));
    const video = videoFixture();
    const dispose = bindPlayfulGaze(video);
    video.dispatchEvent(new Event('loadeddata'));
    expect(video.loop).toBe(true);
    expect(video.play).toHaveBeenCalledOnce();
    reduced.set(true);
    expect(video.pause).toHaveBeenCalled();
    expect(video.play).toHaveBeenCalledOnce();
    dispose();
    expect(mobile.listenerCount + reduced.listenerCount).toBe(0);
    mobile.set(false);
    video.dispatchEvent(new Event('loadeddata'));
    expect(video.play).toHaveBeenCalledOnce();
  });

  it('天空动效在减少动效时卸载资源，恢复与开关不造成离页播放', () => {
    const reduced = legacyMedia(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(reduced);
    const video = videoFixture();
    const control = bindFutureSky(video);
    video.dispatchEvent(new Event('playing'));
    expect(video.classList.contains('is-playing')).toBe(true);
    reduced.set(true);
    expect(video.hasAttribute('src')).toBe(false);
    expect(video.classList.contains('is-playing')).toBe(false);
    expect(video.load).toHaveBeenCalledOnce();
    reduced.set(false);
    expect(video.getAttribute('src')).toBe(FUTURE_ASSETS.video);
    control.setEnabled(false);
    expect(video.pause).toHaveBeenCalled();
    control.dispose();
    const calls = video.play.mock.calls.length;
    expect(reduced.listenerCount).toBe(0);
    window.dispatchEvent(new Event('pointerdown'));
    video.dispatchEvent(new Event('ended'));
    expect(video.play).toHaveBeenCalledTimes(calls);
  });

  it('天空播完从指定三秒位置续播，保持原视频循环合同', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(legacyMedia(false));
    const video = videoFixture();
    const control = bindFutureSky(video);
    video.dispatchEvent(new Event('ended'));
    expect(video.loop).toBe(false);
    expect(video.currentTime).toBe(3);
    expect(video.play).toHaveBeenCalledTimes(2);
    control.dispose();
  });
});
