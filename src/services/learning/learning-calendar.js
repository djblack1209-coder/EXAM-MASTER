// 只更新当前可见学习视图的本机时间；没有存储、联网或学习动作。
export function createLearningCalendar(notify) {
  const readers = new Set();
  const page = typeof document === 'undefined' ? null : document;
  const host = typeof window === 'undefined' ? null : window;
  let timer = null,
    bound = false,
    disposed = false;
  function cancelTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function update() {
    cancelTimer();
    if (disposed || !readers.size || page?.hidden) return;
    const at = Date.now();
    notify(at);
    // 每分钟复核实际本机时间；不按24小时推算时区或夏令时的日界。
    timer = setTimeout(update, Math.max(1, Math.min(60000, 60000 - (at % 60000))));
  }
  function bind() {
    if (bound) return;
    page?.addEventListener('visibilitychange', update);
    host?.addEventListener('focus', update);
    host?.addEventListener('pageshow', update);
    bound = true;
  }
  function unbind() {
    if (!bound) return;
    page?.removeEventListener('visibilitychange', update);
    host?.removeEventListener('focus', update);
    host?.removeEventListener('pageshow', update);
    bound = false;
  }
  function observe() {
    const reader = {};
    let released = false;
    function hide() {
      readers.delete(reader);
      if (!readers.size) {
        cancelTimer();
        unbind();
      }
    }
    return {
      show() {
        if (released || disposed) return;
        readers.add(reader);
        bind();
        update();
      },
      hide,
      dispose() {
        released = true;
        hide();
      }
    };
  }
  return {
    observe,
    read() {
      if (!disposed) notify(Date.now());
    },
    dispose() {
      disposed = true;
      readers.clear();
      cancelTimer();
      unbind();
    }
  };
}
