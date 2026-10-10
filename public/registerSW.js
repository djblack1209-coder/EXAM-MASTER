// Public app-shell updates wait for current windows; this bootstrap never reloads or touches learning storage.
(() => {
  if (!('serviceWorker' in navigator)) return;
  const showUpdate = () => {
    if (document.getElementById('yozi-version-ready')) return;
    const notice = document.createElement('aside');
    notice.id = 'yozi-version-ready';
    notice.setAttribute('role', 'status');
    notice.style.cssText =
      'position:fixed;z-index:100000;inset:auto 16px 16px;max-width:620px;margin:auto;padding:16px;border-radius:18px;background:var(--yozi-surface,#f5f1ff);color:var(--yozi-text,#24203c);border:1px solid #b9a5ed;box-shadow:0 8px 32px #34205b26;font:16px/1.5 system-ui;display:flex;gap:16px;align-items:center;';
    const text = document.createElement('span');
    text.textContent = '新版本已就绪。完成当前任务后，关闭所有 Yozi 页面再打开。';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '继续学习';
    button.style.cssText =
      'flex:none;min-height:44px;padding:8px 14px;border:0;border-radius:12px;background:#6850ba;color:#fff;font:inherit;cursor:pointer;';
    button.addEventListener('click', () => notice.remove());
    notice.append(text, button);
    document.body.append(notice);
  };
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const notify = () => {
          if (registration.waiting && navigator.serviceWorker.controller) showUpdate();
        };
        notify();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') notify();
          });
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible')
            registration.update().catch(() => {
              /* An unavailable public update check must preserve the current page. */
            });
        });
      })
      .catch(() => {
        /* First offline opening keeps the installed app usable. */
      });
  });
})();
