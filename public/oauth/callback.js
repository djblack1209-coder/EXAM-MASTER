'use strict';

(() => {
  const page = new URL(window.location.href);
  const provider = page.pathname.match(/\/oauth\/(wechat)\.html$/)?.[1];
  const application = new URL('../', page);
  const parameters = new URLSearchParams();
  // Preserve duplicates so the existing callback validator rejects them.
  for (const key of ['code', 'state', 'error', 'error_description']) {
    for (const value of page.searchParams.getAll(key)) parameters.append(key, value);
  }
  const clean = new URL(page.href);
  clean.search = '';
  clean.hash = '';
  try {
    window.history.replaceState(window.history.state, '', clean.href);
  } catch {
    application.hash = '/pages/login/index';
    window.location.replace(application.href);
    return;
  }
  application.hash = provider ? `/pages/login/wechat-callback` : '/pages/login/index';
  if (provider && parameters.size) application.hash += `?${parameters}`;
  // Only a fixed page on this origin can receive the response. No network or storage access here.
  window.location.replace(application.href);
})();
