export function isDesktopRuntime() {
  /* global __WENLI_DESKTOP__ */
  // The compile flag alone never grants a browser native capabilities.
  return (
    typeof __WENLI_DESKTOP__ !== 'undefined' &&
    __WENLI_DESKTOP__ === true &&
    typeof window !== 'undefined' &&
    typeof window.__TAURI_INTERNALS__?.invoke === 'function'
  );
}
