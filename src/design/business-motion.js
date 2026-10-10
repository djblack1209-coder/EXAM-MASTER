// Unknown platform capabilities use static feedback; H5 follows the system preference.
export function bindBusinessMotion(onChange) {
  let release = () => undefined;
  onChange(true);
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => onChange(media.matches);
    apply();
    if (media.addEventListener) media.addEventListener('change', apply);
    else media.addListener?.(apply);
    release = () => {
      if (media.removeEventListener) media.removeEventListener('change', apply);
      else media.removeListener?.(apply);
    };
  }
  // #endif
  return release;
}
