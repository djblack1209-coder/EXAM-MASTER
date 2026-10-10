// uni-app H5 renders buttons as custom elements. Keep the same action for keyboard users.
export function activateLearningButton(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const button = event.target?.closest?.(
    'uni-button[role="button"], button[role="button"], uni-button[role="checkbox"], button[role="checkbox"], [data-learning-toggle]'
  );
  if (!button || !event.currentTarget?.contains?.(button)) return;
  if (button.disabled || button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) button.click();
}

export function bindLearningKeyboard(root) {
  const element = root?.$el || root;
  if (!element?.addEventListener) return () => undefined;
  element.addEventListener('keydown', activateLearningButton);
  return () => element.removeEventListener('keydown', activateLearningButton);
}

const openDialogs = [];

// Only the top dialog owns keyboard focus. Closing/unmounting releases its listener.
export function bindLearningDialog(root, { initialFocus, onEscape } = {}) {
  const element = root?.$el || root;
  const doc = element?.ownerDocument;
  if (!doc?.addEventListener) return () => undefined;
  const previousFocus = doc.activeElement;
  const entry = { element };
  openDialogs.push(entry);
  const isShown = (node) => {
    for (let current = node; current; current = current.parentElement) {
      const style = doc.defaultView?.getComputedStyle(current);
      if (
        current.hidden ||
        current.hasAttribute('inert') ||
        current.getAttribute('aria-hidden') === 'true' ||
        style?.display === 'none' ||
        style?.visibility === 'hidden' ||
        style?.visibility === 'collapse'
      )
        return false;
    }
    return true;
  };
  const controls = () =>
    [...element.querySelectorAll('button, input, textarea, select, a[href], [tabindex]')].filter(
      (node) =>
        !node.disabled &&
        !node.hasAttribute('disabled') &&
        node.getAttribute('aria-disabled') !== 'true' &&
        node.tabIndex >= 0 &&
        isShown(node)
    );
  const focus = initialFocus?.$el || initialFocus;
  const focusInside = () => {
    if (openDialogs.at(-1) !== entry || !isShown(element)) return false;
    (focus && controls().includes(focus) ? focus : controls()[0] || element).focus?.();
    return element.contains(doc.activeElement);
  };
  let focusObserver;
  if (!focusInside() && doc.defaultView?.MutationObserver) {
    focusObserver = new doc.defaultView.MutationObserver(() => {
      if (focusInside()) focusObserver.disconnect();
    });
    // Cached popups may still be hidden by an ancestor while their enter lifecycle starts.
    for (let node = element; node; node = node.parentElement) {
      focusObserver.observe(node, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'inert', 'aria-hidden']
      });
    }
  }
  const keydown = (event) => {
    if (openDialogs.at(-1) !== entry) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape?.();
    }
    if (event.key !== 'Tab') return;
    const available = controls();
    const first = available[0];
    const last = available.at(-1);
    const current = doc.activeElement;
    if (!available.length || !available.includes(current) || (event.shiftKey ? current === first : current === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
      if (!available.length) element.focus?.();
    }
  };
  doc.addEventListener('keydown', keydown);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    focusObserver?.disconnect();
    const wasTop = openDialogs.at(-1) === entry;
    openDialogs.splice(openDialogs.indexOf(entry), 1);
    doc.removeEventListener('keydown', keydown);
    if (
      wasTop &&
      previousFocus?.isConnected &&
      (!openDialogs.length || openDialogs.at(-1).element.contains(previousFocus))
    )
      previousFocus.focus?.();
  };
}
