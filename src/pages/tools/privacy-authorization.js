/**
 * 微信小程序隐私授权与权限检查工具
 *
 * [分包隔离副本] 与 pages/chat/privacy-authorization.js 内容完全相同。
 * 分包本地副本 — 避免从 @/utils/auth/ 拉入主包。
 * 修改时请同步更新对应副本。
 */

export async function ensurePrivacyAuthorization() {
  const wxRef = typeof globalThis !== 'undefined' ? globalThis['wx'] : undefined;
  if (!wxRef || typeof wxRef.requirePrivacyAuthorize !== 'function') {
    return true;
  }

  return new Promise((resolve) => {
    try {
      wxRef.requirePrivacyAuthorize({
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    } catch (_error) {
      resolve(true);
    }
  });
}

export async function ensureMiniProgramScope(scope, modalOptions = {}) {
  const uniRef = typeof globalThis !== 'undefined' ? globalThis['uni'] : undefined;
  if (!uniRef || typeof uniRef.getSetting !== 'function') {
    return true;
  }

  const title = modalOptions.title || '权限提示';
  const content = modalOptions.content || '需要授权后才能继续使用该功能，是否前往设置？';

  try {
    const setting = await uniRef.getSetting();
    const authSetting = setting?.authSetting || {};

    if (authSetting[scope] === true) {
      return true;
    }

    if (authSetting[scope] === false) {
      const shouldOpen = await new Promise((resolve) => {
        uniRef.showModal({
          title,
          content,
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false)
        });
      });

      if (shouldOpen && typeof uniRef.openSetting === 'function') {
        await uniRef.openSetting();
      }

      const latest = await uniRef.getSetting();
      return latest?.authSetting?.[scope] === true;
    }

    if (typeof uniRef.authorize === 'function') {
      try {
        await uniRef.authorize({ scope });
        return true;
      } catch (_error) {
        const shouldOpen = await new Promise((resolve) => {
          uniRef.showModal({
            title,
            content,
            success: (res) => resolve(!!res.confirm),
            fail: () => resolve(false)
          });
        });

        if (shouldOpen && typeof uniRef.openSetting === 'function') {
          await uniRef.openSetting();
        }

        const latest = await uniRef.getSetting();
        return latest?.authSetting?.[scope] === true;
      }
    }
  } catch (_error) {
    return false;
  }

  return true;
}
