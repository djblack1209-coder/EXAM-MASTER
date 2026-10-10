import gazeFrames from './playful-gaze-frames.json';

export function gazeTimeForAngle(angle) {
  const tau = Math.PI * 2;
  const target = ((angle % tau) + tau) % tau;
  let nearestTime = gazeFrames[0][1];
  let nearestDistance = Infinity;
  for (const [sampleAngle, time] of gazeFrames) {
    const difference = Math.abs(target - sampleAngle);
    const distance = Math.min(difference, tau - difference);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestTime = time;
    }
  }
  return nearestTime + 1 / 240;
}

// 原视频的非线性帧表；只改变播放时间，不重绘眼睛。
export function bindPlayfulGaze(video) {
  let frame = 0;
  let desiredTime = 0;
  let pointer = null;
  let disposed = false;
  const mobile = window.matchMedia('(max-width: 700px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const seek = () => {
    frame = 0;
    if (disposed || mobile.matches || reducedMotion.matches || video.readyState < 2 || video.seeking) return;
    if (Math.abs(video.currentTime - desiredTime) > 1 / 48) {
      video.currentTime = Math.min(desiredTime, video.duration - 1 / 24);
    }
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(seek);
  };
  const updateTarget = () => {
    if (disposed || mobile.matches || reducedMotion.matches || !pointer) return;
    const rect = video.getBoundingClientRect();
    const scale = Math.max(rect.width / 1920, rect.height / 1080);
    const eyeX = rect.left + rect.width / 2 + (948 - 960) * scale;
    const eyeY = rect.top + rect.height / 2 + (418 - 540) * scale;
    const dx = pointer.x - eyeX;
    const dy = pointer.y - eyeY;
    if (Math.hypot(dx, dy) > 8) {
      desiredTime = gazeTimeForAngle(Math.atan2(dy, dx));
      schedule();
    }
  };
  const move = (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    updateTarget();
  };
  const ready = () => {
    if (disposed) return;
    video.loop = mobile.matches;
    if (mobile.matches && !reducedMotion.matches) {
      video.play()?.catch(() => undefined);
    } else {
      video.pause();
      if (!mobile.matches) {
        updateTarget();
        schedule();
      }
    }
  };
  video.addEventListener('seeked', schedule);
  video.addEventListener('loadeddata', ready);
  for (const media of [mobile, reducedMotion]) {
    if (media.addEventListener) media.addEventListener('change', ready);
    else media.addListener(ready);
  }
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('resize', updateTarget);
  window.addEventListener('scroll', updateTarget, { passive: true });
  if (video.readyState >= 2) ready();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    video.pause();
    video.removeEventListener('seeked', schedule);
    video.removeEventListener('loadeddata', ready);
    for (const media of [mobile, reducedMotion]) {
      if (media.removeEventListener) media.removeEventListener('change', ready);
      else media.removeListener(ready);
    }
    window.removeEventListener('pointermove', move);
    window.removeEventListener('resize', updateTarget);
    window.removeEventListener('scroll', updateTarget);
  };
}
