// uni-app H5 renders buttons as custom elements. Keep the same action for keyboard users.
export function activateLearningButton(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const button = event.target?.closest?.('uni-button[role="button"], button[role="button"], [data-learning-toggle]');
  if (!button || !event.currentTarget?.contains?.(button)) return;
  if (button.disabled || button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') return;
  event.preventDefault();
  event.stopPropagation();
  button.click();
}

export function bindLearningKeyboard(root) {
  const element = root?.$el || root;
  if (!element?.addEventListener) return () => undefined;
  element.addEventListener('keydown', activateLearningButton);
  return () => element.removeEventListener('keydown', activateLearningButton);
}
