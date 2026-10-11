import { invoke } from '@tauri-apps/api/core';
import { isDesktopRuntime } from '@/services/desktop/runtime.js';
import { storageService } from '@/services/storageService.js';
import { assert } from './learning-domain.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import { getCurrentRoute } from '@/utils/home-navigation.js';

const CONSENT_KEY = 'learning_notification_consent_v1';
const controllers = new WeakMap();
export function learningNotificationsFor(learning) {
  let controller = controllers.get(learning);
  if (!controller || controller.isDisposed()) {
    controller = createLearningNotifications(
      learning,
      () => {
        if (getCurrentRoute() !== 'pages/learning/index') safeNavigateTo('/pages/learning/index');
      },
      invoke,
      () => {
        const route = getCurrentRoute();
        return !!route && route !== 'pages/splash/index';
      }
    );
    controllers.set(learning, controller);
    learning.attachNotifications?.(controller);
  }
  return controller;
}
export function notificationChannel() {
  if (isDesktopRuntime()) return 'macos';
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.Notification === 'function') return 'web';
  // #endif
  return 'unsupported';
}

// 只在用户明确授权后使用。平台接纳不等于真实显示；web不提供退出应用后的调度。
export function createLearningNotifications(learning, onOpen, native = invoke, canOpen = () => true) {
  const channel = notificationChannel();
  let token = null,
    sequence = 0,
    disposed = false,
    active = false,
    timer = null,
    openTimer = null;
  let running = Promise.resolve();
  let trustedIdentity = learning.notificationContext();
  const notices = new Set();
  const opened = new Set();
  const waiting = new Map();
  let initialization = null;
  let stopListening = () => undefined;
  const context = () => learning.recordContext();
  const consent = () => storageService.get(CONSENT_KEY, null)?.context === learning.notificationContext();
  const current = (job) =>
    learning.state.conversations.some(
      (c) =>
        !c.stopped &&
        c.id === job.conversationId &&
        c.reminders?.some((r) => r.id === job.reminderId && r.generation === job.generation && r.enabled)
    );
  function open(job, expected = context()) {
    if (disposed || typeof job?.id !== 'string' || opened.has(job.id)) return;
    if (context() !== expected) {
      waiting.delete(job.id);
      return;
    }
    // 冷启动的系统点击先保留；初始页面和启动页的默认导航完成后再返回任务。
    if (!canOpen()) {
      if (!waiting.has(job.id) && waiting.size < 20) waiting.set(job.id, { job, expected });
      scheduleOpen();
      return;
    }
    waiting.delete(job.id);
    try {
      learning.openReminder(job);
      learning.reminderReceipt(job, 'opened', channel, context());
      opened.add(job.id);
      onOpen?.(job);
    } catch {
      /* 过期或其他账户提醒不导航、不恢复任务。 */
    }
  }
  function scheduleOpen() {
    if (active && openTimer === null && waiting.size) openTimer = setTimeout(drainOpen, 100);
  }
  function drainOpen() {
    openTimer = null;
    if (disposed || !active) return;
    for (const { job, expected } of waiting.values()) open(job, expected);
    scheduleOpen();
  }
  async function permission(request = false) {
    if (channel === 'macos') {
      const reply = await native('learning_notification_permission', { request, consent: request });
      return reply.permission;
    }
    if (channel === 'web') return request ? window.Notification.requestPermission() : window.Notification.permission;
    return 'unsupported';
  }
  async function allow() {
    const identity = learning.prepareNotificationConsent();
    const expected = context();
    learning.refresh();
    const result = await permission(true);
    assert(!disposed && context() === expected, 'CONTEXT_CHANGED', '账户或记录已变化，旧通知许可未保存');
    assert(result === 'granted', 'NOTIFICATION_PERMISSION', '通知未获授权，请在系统设置中允许后重试');
    assert(learning.notificationContext() === identity, 'CONTEXT_CHANGED', '学习记录已恢复，旧通知许可未保存');
    assert(storageService.save(CONSENT_KEY, { context: identity }, true), 'STORAGE_FAILED', '通知许可未保存，请重试');
    trustedIdentity = identity;
    return refresh();
  }
  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function refresh() {
    const pending = running.catch(() => undefined).then(performRefresh);
    running = pending;
    return pending;
  }
  async function performRefresh() {
    if (disposed) return null;
    const expected = context();
    {
      learning.refresh();
      if (channel === 'macos') {
        if (!token) token = await native('begin_learning_notifications');
        const requested = consent() ? learning.reminderQueue().filter((j) => j.dueAt > Date.now()) : [];
        const jobs = requested.slice(0, 64);
        if (disposed || context() !== expected) return null;
        const reply = await native('replace_learning_notifications', {
          token,
          sequence: ++sequence,
          consent: consent(),
          jobs: jobs.map(({ accepted: _accepted, ...job }) => job)
        });
        if (disposed || context() !== expected) return null;
        assert(
          reply?.ok && reply.cancelled === true && Array.isArray(reply.acceptedIds),
          'NOTIFICATION_FAILED',
          '系统提醒尚未完整确认，请重试'
        );
        assert(
          jobs.every((j) => reply.acceptedIds.includes(j.id)),
          'NOTIFICATION_FAILED',
          '部分提醒尚未安排，请重试'
        );
        const actions = await native('take_learning_notification_actions');
        if (!disposed && context() === expected) actions.forEach((job) => open(job));
        return {
          channel,
          status: requested.length > 64 ? 'partial-scheduled' : jobs.length ? 'scheduled' : 'saved',
          count: jobs.length,
          total: requested.length
        };
      }
      if (channel === 'web' && active && consent() && (await permission()) === 'granted') {
        const at = Date.now();
        const jobs = learning
          .reminderQueue(at)
          .filter((j) => !j.accepted && j.dueAt <= at && at - j.dueAt < 15 * 60000);
        for (const job of jobs) {
          if (disposed || context() !== expected || !current(job)) break;
          // 先记录未知状态，保存失败不投递；不确定回执不能自动重复发送。
          learning.reminderReceipt(job, 'unknown', 'web', expected);
          let notification;
          try {
            notification = new window.Notification('Yozi AI', {
              body:
                job.kind === 'review'
                  ? '有学习任务到期，打开后独立复测。'
                  : job.kind === 'recap'
                    ? '回顾今天的学习，确认下一步安排。'
                    : '到了你安排的学习时间。',
              tag: job.id
            });
            notices.add(notification);
            notification.onshow = () => {
              if (!disposed && context() === expected && current(job)) {
                try {
                  learning.reminderReceipt(job, 'accepted', 'web', expected);
                } catch {
                  /* 未确认不重复投递。 */
                }
              } else notification.close();
            };
            notification.onclick = () => {
              window.focus();
              open(job);
              notification.close();
            };
            notification.onerror = () => {
              if (!disposed && context() === expected) {
                try {
                  learning.reminderReceipt(job, 'failed', 'web', expected);
                } catch {
                  /* 保留未确认状态。 */
                }
              }
            };
            notification.onclose = () => notices.delete(notification);
          } catch {
            learning.reminderReceipt(job, 'failed', 'web', expected);
          }
        }
      }
      return {
        channel,
        status: channel === 'unsupported' ? 'unsupported' : consent() ? 'active' : 'permission-required',
        count: 0
      };
    }
  }
  function tick() {
    clearTimer();
    if (disposed || !active) return;
    refresh()
      .catch(() => undefined)
      .finally(() => {
        if (!disposed && active) timer = setTimeout(tick, 15000);
      });
  }
  function show() {
    active = true;
    scheduleOpen();
    tick();
  }
  function hide() {
    active = false;
    clearTimer();
    if (openTimer !== null) clearTimeout(openTimer);
    openTimer = null;
  }
  function initialize() {
    if (initialization) return initialization;
    initialization = (async () => {
      if (channel === 'macos') {
        const { listen } = await import('@tauri-apps/api/event');
        if (disposed) return;
        stopListening = await listen('learning-notification-action', (event) => open(event.payload));
        if (disposed) stopListening();
      }
      show();
    })();
    return initialization;
  }
  function dispose() {
    disposed = true;
    hide();
    stopListening();
    notices.forEach((n) => n.close());
    notices.clear();
    waiting.clear();
    if (channel === 'macos' && token && learning.notificationContext() !== trustedIdentity) {
      native('replace_learning_notifications', { token, sequence: ++sequence, jobs: [], consent: false }).catch(
        () => undefined
      );
    }
  }
  return { channel, allow, permission, refresh, show, hide, initialize, dispose, isDisposed: () => disposed };
}
