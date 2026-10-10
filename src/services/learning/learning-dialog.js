// Page-owned confirmations share one presentation; every callback belongs to its original request.
export function createLearningDialog({ getContext, onChange, onError = () => undefined }) {
  let sequence = 0;
  let active = null;
  let destroyed = false;
  let view = { id: 0, visible: false, content: '', editable: false };

  function publish(next) {
    view = next;
    onChange(view);
  }
  function invoke(callback, value) {
    try {
      const result = callback?.(value);
      if (result?.catch) result.catch(onError);
    } catch (error) {
      onError(error);
    }
  }
  function current(request) {
    try {
      return getContext() === request.context && (!request.options.isCurrent || request.options.isCurrent());
    } catch {
      return false;
    }
  }
  function close(id) {
    if (view.id !== id || view.visible) return;
    publish({ ...view, content: '' });
  }
  function settle(id, confirm, content = '', redact = false) {
    if (!active || active.id !== id) return false;
    const request = active;
    const valid = current(request);
    active = null;
    publish({ ...view, visible: false, ...(redact || !valid ? { content: '' } : {}) });
    const accepted = confirm && valid;
    const result = {
      confirm: accepted,
      cancel: !accepted,
      ...(request.options.editable ? { content: accepted ? String(content) : '' } : {})
    };
    if (confirm && !valid) onError(new Error('账户、记录或当前题目已变化，未执行旧确认，请重新打开。'));
    invoke(request.options.success, result);
    invoke(request.options.complete, result);
    return accepted;
  }
  function show(options) {
    let context;
    try {
      context = getContext();
    } catch {
      context = null;
    }
    if (destroyed || !context || active) {
      const error = new Error(active ? '请先完成当前弹窗，稍后重试。' : '当前页面或账户不可用，请重新打开。');
      invoke(options.fail, error);
      invoke(options.complete, error);
      if (!options.fail) onError(error);
      return null;
    }
    const id = ++sequence;
    active = { id, context, options };
    publish({
      id,
      visible: true,
      title: options.title || '提示',
      content: options.content || '',
      editable: options.editable === true,
      placeholderText: options.placeholderText || '',
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      showCancel: options.showCancel !== false,
      type: options.type || 'info',
      confirm: (content) => settle(id, true, content),
      cancel: () => settle(id, false),
      closed: () => close(id)
    });
    return id;
  }
  function dismiss() {
    if (active) settle(active.id, false, '', true);
    else if (view.content) publish({ ...view, content: '' });
  }
  function invalidate() {
    if (active && !current(active)) dismiss();
  }
  return {
    show,
    dismiss,
    invalidate,
    destroy() {
      destroyed = true;
      dismiss();
    }
  };
}
