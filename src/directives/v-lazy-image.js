/**
 * v-lazy-image directive — lazy-loads images with fade-in.
 * Uses IntersectionObserver on H5, falls back to uni-app lazy-load attr on mini-program.
 *
 * Usage: <image v-lazy-image="imageUrl" />
 */

const PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22%3E%3Crect fill=%22%23f0f0f0%22 width=%221%22 height=%221%22/%3E%3C/svg%3E';

// #ifdef H5
let observer = null;
if (typeof IntersectionObserver !== 'undefined') {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = /** @type {HTMLImageElement} */ (entry.target);
        const src = img.dataset.lazySrc;
        if (!src) return;
        img.src = src;
        img.onload = () => {
          img.style.opacity = '1';
        };
        observer.unobserve(img);
      });
    },
    { rootMargin: '200px' }
  );
}
// #endif

export default {
  mounted(el, binding) {
    const src = binding.value;
    // #ifdef H5
    if (observer) {
      el.src = PLACEHOLDER;
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.35s ease-in';
      el.dataset.lazySrc = src;
      observer.observe(el);
      return;
    }
    // #endif
    // Mini-program fallback: native lazy-load
    el.setAttribute('lazy-load', 'true');
    el.src = src;
  },
  updated(el, binding) {
    if (binding.value !== binding.oldValue) {
      el.dataset.lazySrc = binding.value;
      // #ifdef H5
      if (observer) {
        el.src = PLACEHOLDER;
        el.style.opacity = '0';
        observer.observe(el);
      }
      // #endif
    }
  },
  unmounted(el) {
    // #ifdef H5
    if (observer) observer.unobserve(el);
    // #endif
  }
};
