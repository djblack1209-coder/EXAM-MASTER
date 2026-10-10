import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('public/registerSW.js', 'utf8');
function setup({ controller = {}, waiting = null, reject = false } = {}) {
  const events = {},
    registrationEvents = {},
    workerEvents = {},
    notices = [];
  const worker = { state: 'installing', addEventListener: (type, fn) => (workerEvents[type] = fn) };
  const registration = {
    waiting,
    installing: worker,
    update: vi.fn(async () => {}),
    addEventListener: (type, fn) => (registrationEvents[type] = fn)
  };
  const document = {
    visibilityState: 'visible',
    getElementById: (id) => notices.find((el) => el.id === id),
    createElement(tag) {
      const node = {
        tag,
        style: {},
        handlers: {},
        children: [],
        setAttribute: vi.fn(),
        addEventListener(type, fn) {
          this.handlers[type] = fn;
        },
        append(...nodes) {
          this.children.push(...nodes);
        },
        remove() {
          notices.splice(notices.indexOf(this), 1);
        }
      };
      return node;
    },
    body: { append: (el) => notices.push(el) },
    addEventListener: (type, fn) => (events[type] = fn)
  };
  const register = vi.fn(async () => {
    if (reject) throw Error('offline');
    return registration;
  });
  const reload = vi.fn(),
    write = vi.fn();
  vm.runInNewContext(source, {
    document,
    navigator: { serviceWorker: { controller, register } },
    window: { addEventListener: (type, fn) => (events[type] = fn), location: { reload } },
    localStorage: { setItem: write, clear: write }
  });
  return { events, registrationEvents, workerEvents, registration, worker, register, reload, write, notices };
}
describe('PWA version update preserves current work', () => {
  it('shows one dismissible waiting notice without reloading or writing learning facts', async () => {
    const t = setup();
    await t.events.load();
    await Promise.resolve();
    t.registrationEvents.updatefound();
    t.registration.waiting = t.worker;
    t.worker.state = 'installed';
    t.workerEvents.statechange();
    t.workerEvents.statechange();
    expect(t.notices).toHaveLength(1);
    expect(t.notices[0].children[0].textContent).toContain('完成当前任务');
    t.notices[0].children[1].handlers.click();
    expect(t.notices).toHaveLength(0);
    expect(t.reload).not.toHaveBeenCalled();
    expect(t.write).not.toHaveBeenCalled();
    expect(t.register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  });
  it('does not announce a first offline installation as an update', async () => {
    const t = setup({ controller: null, waiting: {} });
    await t.events.load();
    await Promise.resolve();
    expect(t.notices).toHaveLength(0);
  });
  it('recognizes an already waiting version and checks again when the window becomes visible', async () => {
    const t = setup({ waiting: {} });
    await t.events.load();
    await Promise.resolve();
    expect(t.notices).toHaveLength(1);
    t.events.visibilitychange();
    expect(t.registration.update).toHaveBeenCalledTimes(1);
  });
  it('keeps the page usable when the public update check is offline', async () => {
    const t = setup({ reject: true });
    await t.events.load();
    await Promise.resolve();
    await Promise.resolve();
    expect(t.notices).toHaveLength(0);
    expect(t.reload).not.toHaveBeenCalled();
    expect(t.write).not.toHaveBeenCalled();
  });
});
