// Keep the App's first frame until a real page exists, including async routes.
export function mountAppBoot() {
  if (typeof document === 'undefined') return () => undefined;
  const overlay = document.getElementById('yozi-app-boot');
  const app = document.getElementById('app');
  if (!overlay || !app) return () => undefined;
  let finished = false;
  let timer = null;
  const observer = new window.MutationObserver(() => ready());
  function stop() {
    if (finished) return;
    finished = true;
    observer.disconnect();
    clearTimeout(timer);
    overlay.remove();
  }
  function ready() {
    const page = app.querySelector('uni-page-body, .uni-page-body');
    if (page?.firstElementChild) stop();
  }
  observer.observe(app, { childList: true, subtree: true });
  timer = setTimeout(stop, 10000);
  ready();
  return stop;
}

// uni-app's embedded Vue adapter can predate App.onUnmount.
export function bindAppBoot(app) {
  const stop = mountAppBoot();
  const unmount = app.unmount?.bind(app);
  if (unmount) {
    app.unmount = (...args) => {
      stop();
      return unmount(...args);
    };
  }
}
