import process from 'process';
import { writeFileSync } from 'fs';

const APPIUM_HOST = process.env.APPIUM_HOST || '127.0.0.1';
const APPIUM_PORT = process.env.APPIUM_PORT || '4723';
const APPIUM_BASE = `http://${APPIUM_HOST}:${APPIUM_PORT}`;

const APP_ID = process.env.APP_ID || 'com.exam.master';
const ANDROID_UDID = process.env.ANDROID_UDID || process.env.ANDROID_SERIAL || 'emulator-5554';
const ANDROID_APK_PATH = process.env.ANDROID_APK_PATH || '';
const CHROMEDRIVER_PATH = process.env.CHROMEDRIVER_PATH || '';
const CHROMEDRIVER_DIR = process.env.CHROMEDRIVER_DIR || '';
const SOURCE_OUTPUT = process.env.APP_SOURCE_OUTPUT || 'docs/reports/current/appium-webview-source.html';
const TEXT_OUTPUT = process.env.APP_TEXT_OUTPUT || 'docs/reports/current/appium-webview-text.txt';
const DEBUG_OUTPUT = process.env.APP_DEBUG_OUTPUT || 'docs/reports/current/appium-webview-debug.json';

const timeoutMs = Number.parseInt(process.env.APPIUM_TIMEOUT_MS || '60000', 10);
const webviewWaitMs = Number.parseInt(process.env.APPIUM_WEBVIEW_WAIT_MS || '30000', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (path, init = {}) => {
  const url = `${APPIUM_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
};

const withTimeout = async (promise, ms, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const createSession = async () => {
  const caps = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': ANDROID_UDID,
    'appium:appPackage': APP_ID,
    'appium:appActivity': 'io.dcloud.PandoraEntry',
    'appium:newCommandTimeout': 120,
    'appium:autoGrantPermissions': true,
    'appium:chromedriverAutodownload': true,
    'appium:disableWindowAnimation': true,
    'appium:skipDeviceInitialization': true,
    'appium:skipServerInstallation': true,
    'appium:forceEspressoRebuild': false,
    'appium:uiautomator2ServerInstallTimeout': 60000,
    ...(CHROMEDRIVER_PATH ? { 'appium:chromedriverExecutable': CHROMEDRIVER_PATH } : {}),
    ...(CHROMEDRIVER_DIR ? { 'appium:chromedriverExecutableDir': CHROMEDRIVER_DIR } : {}),
    'appium:autoWebview': true,
    'appium:autoWebviewTimeout': webviewWaitMs
  };

  if (ANDROID_APK_PATH) {
    caps['appium:app'] = ANDROID_APK_PATH;
  }

  const payload = {
    capabilities: {
      alwaysMatch: caps,
      firstMatch: [{}]
    }
  };

  const data = await withTimeout(request('/session', {
    method: 'POST',
    body: JSON.stringify(payload)
  }), timeoutMs, 'create session');

  const sessionId = data.value?.sessionId || data.sessionId || data.value?.['sessionId'] || data.value?.['session_id'];
  if (!sessionId) {
    throw new Error(`Failed to extract sessionId: ${JSON.stringify(data)}`);
  }

  return sessionId;
};

const getContexts = async (sessionId) => {
  const data = await request(`/session/${sessionId}/contexts`, { method: 'GET' });
  return data.value || data;
};

const setContext = async (sessionId, context) => {
  await request(`/session/${sessionId}/context`, {
    method: 'POST',
    body: JSON.stringify({ name: context })
  });
};

const getSource = async (sessionId) => {
  const data = await request(`/session/${sessionId}/source`, { method: 'GET' });
  return data.value || '';
};

const executeScript = async (sessionId, script, args = []) => {
  const data = await request(`/session/${sessionId}/execute/sync`, {
    method: 'POST',
    body: JSON.stringify({ script, args })
  });
  return data.value;
};

const getWindowHandles = async (sessionId) => {
  const data = await request(`/session/${sessionId}/window/handles`, { method: 'GET' });
  return data.value || [];
};

const setWindowHandle = async (sessionId, handle) => {
  await request(`/session/${sessionId}/window`, {
    method: 'POST',
    body: JSON.stringify({ handle })
  });
};

const getUrl = async (sessionId) => {
  const data = await request(`/session/${sessionId}/url`, { method: 'GET' });
  return data.value || '';
};

const getTitle = async (sessionId) => {
  const data = await request(`/session/${sessionId}/title`, { method: 'GET' });
  return data.value || '';
};

const ensureWindowHandle = async (sessionId) => {
  try {
    const handles = await getWindowHandles(sessionId);
    if (handles.length) {
      await setWindowHandle(sessionId, handles[0]);
    }
    return handles;
  } catch {
    return [];
  }
};

const deleteSession = async (sessionId) => {
  try {
    await request(`/session/${sessionId}`, { method: 'DELETE' });
  } catch {
    // ignore
  }
};

const assertContains = (source, keyword) => {
  if (!source || !source.includes(keyword)) {
    throw new Error(`WebView source missing keyword: ${keyword}`);
  }
};

const waitForKeywords = async (sessionId, keywords, deadlineMs) => {
  const start = Date.now();
  let lastSource = '';
  while (Date.now() - start < deadlineMs) {
    try {
      await ensureWindowHandle(sessionId);
      lastSource = await getSource(sessionId);
      const hasAll = keywords.every((keyword) => lastSource.includes(keyword));
      if (hasAll) {
        return lastSource;
      }
    } catch (err) {
      lastSource = '';
    }
    await sleep(1500);
  }
  return lastSource;
};

const waitForWebviewText = async (sessionId, keywords, deadlineMs) => {
  const start = Date.now();
  let lastText = '';
  while (Date.now() - start < deadlineMs) {
    try {
      await ensureWindowHandle(sessionId);
      const readyState = await executeScript(sessionId, 'return document.readyState;', []);
      const text = await executeScript(
        sessionId,
        'return document.body && document.body.innerText ? document.body.innerText : document.documentElement.innerText;',
        []
      );
      lastText = String(text || '');
      const hasAll = keywords.every((keyword) => lastText.includes(keyword));
      if (readyState && hasAll) {
        return lastText;
      }
    } catch (err) {
      lastText = '';
    }
    await sleep(1500);
  }
  return lastText;
};

const main = async () => {
  let sessionId;
  try {
    sessionId = await createSession();

    const start = Date.now();
    let contexts = await getContexts(sessionId);

    while (!contexts.find((ctx) => String(ctx).includes('WEBVIEW'))) {
      if (Date.now() - start > webviewWaitMs) break;
      await sleep(1000);
      contexts = await getContexts(sessionId);
    }

    const webviewContext = contexts.find((ctx) => String(ctx).includes('WEBVIEW'));
    if (!webviewContext) {
      throw new Error(`No WEBVIEW context found. contexts=${JSON.stringify(contexts)}`);
    }

    await setContext(sessionId, webviewContext);
    await sleep(2000);

    const handles = await ensureWindowHandle(sessionId);

    const debug = {
      contexts,
      webviewContext,
      handles,
      title: '',
      url: ''
    };

    try {
      debug.title = await getTitle(sessionId);
    } catch {
      debug.title = '';
    }

    try {
      debug.url = await getUrl(sessionId);
    } catch {
      debug.url = '';
    }

    const source = await waitForKeywords(sessionId, ['首页', '刷题', '择校', '我的'], timeoutMs);

    try {
      writeFileSync(SOURCE_OUTPUT, source || '', 'utf8');
    } catch {
      // ignore
    }

    let textDump = '';
    try {
      textDump = await waitForWebviewText(sessionId, ['首页', '刷题', '择校', '我的'], timeoutMs);
      writeFileSync(TEXT_OUTPUT, textDump, 'utf8');
    } catch {
      // ignore
    }

    try {
      writeFileSync(DEBUG_OUTPUT, JSON.stringify(debug, null, 2), 'utf8');
    } catch {
      // ignore
    }

    if (!source) {
      assertContains(textDump, '首页');
      assertContains(textDump, '刷题');
      assertContains(textDump, '择校');
      assertContains(textDump, '我的');
    } else {
      assertContains(source, '首页');
      assertContains(source, '刷题');
      assertContains(source, '择校');
      assertContains(source, '我的');
    }

    console.log(`[appium-webview] smoke passed, source saved: ${SOURCE_OUTPUT}, text saved: ${TEXT_OUTPUT}`);
  } finally {
    if (sessionId) {
      await deleteSession(sessionId);
    }
  }
};

main().catch((err) => {
  console.error('[appium-webview] smoke failed:', err.message || err);
  process.exitCode = 1;
});
