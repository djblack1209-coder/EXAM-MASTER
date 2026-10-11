import { onBeforeUnmount, shallowRef } from 'vue';

// Page-scoped presentation only: business callbacks keep their existing owner checks.
export function usePageDialog() {
  const pageDialog = shallowRef(null);
  const queue = [];
  let active = null;
  function advance() {
    active = queue.shift() || null;
    pageDialog.value = active?.options || null;
  }
  function show(options = {}) {
    return new Promise((resolve) => {
      queue.push({ options, resolve });
      if (!active) advance();
    });
  }
  function settleDialog(confirm, content) {
    if (!active) return;
    const current = active;
    const result = {
      confirm: !!confirm,
      cancel: !confirm,
      ...(current.options.editable ? { content: typeof content === 'string' ? content : '' } : {})
    };
    advance();
    try {
      current.options.success?.(result);
    } finally {
      current.resolve(result);
    }
  }
  onBeforeUnmount(() => {
    // Unmount cancels pending UI without executing navigation or writes from callbacks.
    for (const request of [active, ...queue]) request?.resolve({ confirm: false, cancel: true });
    active = null;
    queue.length = 0;
    pageDialog.value = null;
  });
  return { pageDialog, settleDialog, modal: { show } };
}
