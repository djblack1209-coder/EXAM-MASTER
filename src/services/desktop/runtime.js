export function isDesktopRuntime() {
  /* global __YOZI_DESKTOP__ */
  // The compile flag alone never grants a browser native capabilities.
  return (
    typeof __YOZI_DESKTOP__ !== 'undefined' &&
    __YOZI_DESKTOP__ === true &&
    typeof window !== 'undefined' &&
    typeof window.__TAURI_INTERNALS__?.invoke === 'function'
  );
}
