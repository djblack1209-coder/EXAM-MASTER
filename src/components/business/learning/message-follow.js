// Muse 2 ChatView.tsx: follow only within 48px of the end. No learning writes.
export function bindMessageFollow(scroller) {
  if (!scroller?.addEventListener) return () => {};
  let following = true,
    height = scroller.scrollHeight,
    viewport = scroller.clientHeight;
  let growing = null,
    completionFrame = null;
  const frame = (callback) =>
    typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame(callback)
      : setTimeout(callback, 0);
  const cancelFrame = () => {
    if (completionFrame === null) return;
    if (typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(completionFrame);
    else clearTimeout(completionFrame);
    completionFrame = null;
  };
  const mark = () => {
    scroller.dataset.followLatest = String(following);
  };
  const follow = () => {
    if (completionFrame !== null) return;
    if (following && growing?.node.isConnected && growing.node.dataset.replyPending !== 'true') {
      const anchor = growing;
      growing = null;
      // A full card and any inline profile/proposal may land in separate Vue
      // microtasks. Restore the visible reply once, before the next paint.
      following = false;
      mark();
      completionFrame = frame(() => {
        completionFrame = null;
        if (anchor.node.isConnected) scroller.scrollTop += anchor.node.getBoundingClientRect().top - anchor.top;
        height = scroller.scrollHeight;
        viewport = scroller.clientHeight;
        following = height - viewport - scroller.scrollTop <= 48;
        mark();
      });
      return;
    }
    if (following) scroller.scrollTop = scroller.scrollHeight;
    height = scroller.scrollHeight;
    viewport = scroller.clientHeight;
    mark();
    const pending = following ? scroller.querySelector('[data-reply-pending="true"]') : null;
    const top = pending?.getBoundingClientRect().top;
    const bounds = scroller.getBoundingClientRect();
    growing = pending && top >= bounds.top && top < bounds.bottom ? { node: pending, top } : null;
  };
  const scroll = () => {
    const resized = height !== scroller.scrollHeight || viewport !== scroller.clientHeight;
    if (resized && following) follow();
    else {
      following = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 48;
      mark();
    }
  };
  const wheel = (event) => {
    if (event.deltaY < 0) {
      cancelFrame();
      growing = null;
      following = false;
      mark();
    }
  };
  const key = (event) => {
    if (['PageUp', 'Home', 'ArrowUp'].includes(event.key)) {
      cancelFrame();
      growing = null;
      following = false;
      mark();
    }
  };
  scroller.addEventListener('scroll', scroll, { passive: true });
  scroller.addEventListener('wheel', wheel, { passive: true });
  scroller.addEventListener('keydown', key);
  const observer = typeof globalThis.MutationObserver === 'undefined' ? null : new globalThis.MutationObserver(follow);
  observer?.observe(scroller, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-reply-pending']
  });
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(follow);
  resize?.observe(scroller);
  mark();
  return () => {
    cancelFrame();
    observer?.disconnect();
    resize?.disconnect();
    scroller.removeEventListener('scroll', scroll);
    scroller.removeEventListener('wheel', wheel);
    scroller.removeEventListener('keydown', key);
  };
}
