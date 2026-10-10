export const FUTURE_ASSETS = Object.freeze({
  video:
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_111243_26a0a351-0bff-4c24-9872-14c77a2726f6.mp4',
  still:
    'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/b85a9c31-6e42-483c-b333-be20054ad692.jpg',
  scene: 'https://soft-zoom-63098134.figma.site/_assets/v11/83aecec75c5d8511dbb24e3a6369d7380e3f2278.png'
});

export function bindFutureSky(video) {
  let disposed = false;
  let enabled = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reveal = () => {
    if (!disposed) video.classList.add('is-playing');
  };
  const hide = () => video.classList.remove('is-playing');
  const play = () => {
    if (!disposed && enabled && !reduced.matches) video.play()?.catch(() => undefined);
  };
  const rewind = () => {
    if (disposed || !enabled || reduced.matches) return;
    try {
      video.currentTime = 3;
    } catch (_error) {
      /* Decoder may not be ready. */
    }
    if (video.paused) play();
  };
  const update = () => {
    if (video.duration && video.currentTime >= video.duration - 0.25) rewind();
  };
  const apply = () => {
    if (reduced.matches) {
      hide();
      video.removeAttribute('autoplay');
      video.pause();
      video.removeAttribute('src');
      video.load();
    } else {
      if (!video.getAttribute('src')) video.src = FUTURE_ASSETS.video;
      if (enabled) play();
      else video.pause();
      if (video.readyState >= 3) reveal();
    }
  };
  const retry = () => {
    window.removeEventListener('pointerdown', retry);
    window.removeEventListener('touchstart', retry);
    play();
  };
  video.loop = false;
  video.addEventListener('playing', reveal);
  video.addEventListener('error', hide);
  video.addEventListener('ended', rewind);
  video.addEventListener('timeupdate', update);
  if (reduced.addEventListener) reduced.addEventListener('change', apply);
  else reduced.addListener(apply);
  window.addEventListener('pointerdown', retry, { once: true });
  window.addEventListener('touchstart', retry, { once: true });
  apply();
  return {
    setEnabled(value) {
      enabled = Boolean(value);
      apply();
    },
    dispose() {
      disposed = true;
      video.pause();
      video.removeEventListener('playing', reveal);
      video.removeEventListener('error', hide);
      video.removeEventListener('ended', rewind);
      video.removeEventListener('timeupdate', update);
      if (reduced.removeEventListener) reduced.removeEventListener('change', apply);
      else reduced.removeListener(apply);
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('touchstart', retry);
    }
  };
}

export function runFutureEntrance(root, onFinish = () => undefined) {
  let finished = false;
  let frame = 0;
  const animations = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(failsafe);
    cancelAnimationFrame(frame);
    root.classList.remove('entrance-pending');
    root.classList.add('entrance-complete');
    for (const animation of animations) animation.cancel();
    onFinish();
  };
  const failsafe = setTimeout(finish, 2800);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof root.animate !== 'function') {
    finish();
    return finish;
  }
  frame = requestAnimationFrame(() => {
    if (finished) return;
    const animate = (selector, keys, duration, delay, easing = 'cubic-bezier(.22,1,.36,1)') => {
      const element = root.querySelector(selector);
      if (element) animations.push(element.animate(keys, { duration, delay, easing, fill: 'both' }));
    };
    animate('.hi', { opacity: [0, 1], translate: ['0 7px', '0 0'] }, 520, 40);
    animate(
      '.name',
      { opacity: [0, 1], translate: ['0 15px', '0 0'], clipPath: ['inset(100% 0 0 0)', 'inset(0 0 0 0)'] },
      760,
      135,
      'cubic-bezier(.16,1,.3,1)'
    );
    animate('.role', { opacity: [0, 1], translate: ['0 8px', '0 0'] }, 580, 430);
    animate(
      '.scene-assembly',
      { opacity: [0, 1], translate: ['0 18px', '0 0'], scale: ['.985', '1'] },
      980,
      390,
      'cubic-bezier(.16,1,.3,1)'
    );
    root.querySelectorAll('.future-nav .nav-link, .future-nav .mode').forEach((element, index) => {
      animations.push(
        element.animate(
          { opacity: [0, 1], translate: ['-7px 0', '0 0'] },
          { duration: 470, delay: 690 + index * 52, fill: 'both', easing: 'cubic-bezier(.22,1,.36,1)' }
        )
      );
    });
    Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
  });
  return finish;
}
