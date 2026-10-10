import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import CustomModal from '@/components/common/CustomModal.vue';
import { activateLearningButton, bindLearningDialog } from '@/services/learning/keyboard-controls.js';
import { createLearningDialog } from '@/services/learning/learning-dialog.js';

// uni-app preprocesses renderjs; the plain Vue unit compiler cannot parse that native-only block.
vi.mock('wot-design-uni/components/wd-root-portal/wd-root-portal.vue', () => ({
  default: { name: 'WdRootPortal', template: '<div><slot /></div>' }
}));

const wrappers = [];
const PopupFixture = {
  props: ['modelValue', 'duration', 'closeOnClickModal'],
  template: '<div v-if="modelValue" class="wd-popup-wrapper"><slot /></div>'
};
function render(props = {}) {
  const wrapper = mount(CustomModal, {
    attachTo: document.body,
    props: { visible: true, title: '确认退出', content: '学习记录保留在本机', ...props },
    global: {
      stubs: {
        WdPopup: PopupFixture,
        WdLoading: true,
        BaseIcon: true,
        view: { template: '<div><slot /></div>' },
        text: { template: '<span><slot /></span>' }
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('学习页确认请求的生命周期', () => {
  function controller() {
    let context = 'owner:1';
    let view;
    const error = vi.fn();
    const dialog = createLearningDialog({
      getContext: () => context,
      onChange: (state) => {
        view = state;
      },
      onError: error
    });
    return {
      dialog,
      error,
      view: () => view,
      setContext: (value) => {
        context = value;
      }
    };
  }
  it('重复、迟到和旧关闭回调不能确认新请求；未渲染即取消也不锁住下次弹窗', () => {
    const c = controller(),
      first = vi.fn(),
      second = vi.fn(),
      complete = vi.fn();
    c.dialog.show({ success: first, complete });
    const old = c.view();
    old.cancel();
    c.dialog.show({ success: second });
    old.confirm();
    old.closed();
    expect(c.view().visible).toBe(true);
    c.view().confirm();
    c.view().confirm();
    expect(first).toHaveBeenCalledExactlyOnceWith({ confirm: false, cancel: true });
    expect(complete).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledExactlyOnceWith({ confirm: true, cancel: false });
  });
  it('账户或页面失效立即取消、清空编辑正文，旧确认不产生动作', () => {
    const c = controller(),
      success = vi.fn();
    c.dialog.show({ content: '私人题干', editable: true, success });
    const old = c.view();
    c.setContext(null);
    c.dialog.invalidate();
    expect(c.view()).toMatchObject({ visible: false, content: '' });
    old.confirm('迟到正文');
    expect(success).toHaveBeenCalledExactlyOnceWith({ confirm: false, cancel: true, content: '' });
  });
  it('当前题目变化拒绝确认；有效长正文完整交给业务回调', () => {
    const c = controller(),
      success = vi.fn();
    let current = true;
    c.dialog.show({ editable: true, isCurrent: () => current, success });
    current = false;
    c.view().confirm('旧题干');
    expect(success).toHaveBeenLastCalledWith({ confirm: false, cancel: true, content: '' });
    expect(c.error).toHaveBeenCalledOnce();
    current = true;
    const content = '多行题干\n'.repeat(40);
    c.dialog.show({ editable: true, isCurrent: () => current, success });
    c.view().confirm(content);
    expect(success).toHaveBeenLastCalledWith({ confirm: true, cancel: false, content });
  });
  it('并发请求失败不会替换已有确认，卸载后不能再次打开', () => {
    const c = controller(),
      fail = vi.fn(),
      complete = vi.fn(),
      success = vi.fn();
    c.dialog.show({ success });
    const id = c.view().id;
    expect(c.dialog.show({ fail, complete })).toBeNull();
    expect(c.view().id).toBe(id);
    expect(fail).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    c.dialog.destroy();
    expect(success).toHaveBeenCalledExactlyOnceWith({ confirm: false, cancel: true });
    expect(c.dialog.show({ fail })).toBeNull();
    expect(c.view().visible).toBe(false);
  });
});

describe('编辑弹窗', () => {
  it('预填与多行长正文完整保留，自动进入输入框、取消后归还入口', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const original = '题干预填\n'.repeat(35);
    const wrapper = render({ editable: true, content: original });
    await flushPromises();
    const input = wrapper.get('textarea');
    expect(input.element.value).toBe(original);
    expect(input.attributes('maxlength')).toBe('-1');
    expect(document.activeElement).toBe(input.element);
    const updated = original + '修改结尾';
    await input.setValue(updated);
    await wrapper.get('.confirm-btn').trigger('tap');
    await wrapper.get('.confirm-btn').trigger('tap');
    expect(wrapper.emitted('confirm')).toEqual([[updated]]);
    await wrapper.setProps({ visible: false });
    expect(document.activeElement).toBe(opener);
  });
  it('空白不能确认；取消不会提交输入，关闭清空并重新预填', async () => {
    const wrapper = render({ editable: true, content: '', placeholderText: '填写你使用的提示' });
    await flushPromises();
    await wrapper.get('textarea').setValue('  \n');
    expect(wrapper.get('.confirm-btn').attributes('disabled')).toBeDefined();
    await wrapper.get('.confirm-btn').trigger('tap');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await wrapper.get('textarea').setValue('尚未保存');
    await wrapper.get('.cancel-btn').trigger('tap');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await wrapper.setProps({ visible: false });
    await wrapper.setProps({ content: '重新预填', visible: true });
    expect(wrapper.get('textarea').element.value).toBe('重新预填');
  });
});
describe('业务弹窗的键盘和动作保护', () => {
  it('弹窗祖先真正显示后再进入焦点，关闭时释放观察并归还原入口', async () => {
    const opener = document.createElement('button');
    const popup = document.createElement('div');
    popup.style.display = 'none';
    const dialog = document.createElement('div');
    dialog.tabIndex = -1;
    const confirm = document.createElement('button');
    dialog.append(confirm);
    popup.append(dialog);
    document.body.append(opener, popup);
    opener.focus();
    const release = bindLearningDialog(dialog, { initialFocus: confirm });
    try {
      expect(document.activeElement).toBe(opener);
      popup.style.display = '';
      await flushPromises();
      expect(document.activeElement).toBe(confirm);
      release();
      expect(document.activeElement).toBe(opener);
      popup.style.display = 'none';
      popup.style.display = '';
      await flushPromises();
      expect(document.activeElement).toBe(opener);
    } finally {
      release();
    }
  });
  it('进入取消按钮、循环焦点、Escape 取消后归还原入口，重复关闭不重复发出动作', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const wrapper = render();
    await flushPromises();
    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe(wrapper.find('.modal-title').attributes('id'));
    const cancel = wrapper.find('.cancel-btn').element;
    const confirm = wrapper.find('.confirm-btn').element;
    expect(document.activeElement).toBe(cancel);
    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(confirm);
    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(cancel);
    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await wrapper.setProps({ visible: false });
    expect(document.activeElement).toBe(opener);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
  it('禁用和加载时确认零执行；解除后同一轮确认只执行一次', async () => {
    const wrapper = render({ confirmDisabled: true });
    await flushPromises();
    await wrapper.find('.confirm-btn').trigger('tap');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await wrapper.setProps({ confirmDisabled: false, confirmLoading: true });
    expect(wrapper.find('.confirm-btn').attributes('aria-busy')).toBe('true');
    await wrapper.find('.confirm-btn').trigger('tap');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await wrapper.setProps({ confirmLoading: false });
    await wrapper.find('.confirm-btn').trigger('tap');
    await wrapper.find('.confirm-btn').trigger('tap');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('update:visible')).toEqual([[false]]);
  });
  it('必须确认的提示不被 Escape 关闭，移除组件后释放键盘接管', async () => {
    const wrapper = render({ showCancel: false, maskClosable: false });
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.find('.confirm-btn').element);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(wrapper.emitted('cancel')).toBeUndefined();
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });
  it('隐私复选按钮键盘只切换一次，按住重复键和输入框不触发操作', () => {
    const root = document.createElement('div');
    const consent = document.createElement('uni-button');
    consent.setAttribute('role', 'checkbox');
    consent.setAttribute('tabindex', '0');
    root.append(consent);
    const click = vi.spyOn(consent, 'click');
    const event = { key: ' ', target: consent, currentTarget: root, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    activateLearningButton(event);
    activateLearningButton({ ...event, repeat: true });
    expect(click).toHaveBeenCalledOnce();
    consent.setAttribute('aria-disabled', 'true');
    activateLearningButton(event);
    expect(click).toHaveBeenCalledOnce();
    const input = document.createElement('input');
    root.append(input);
    activateLearningButton({ ...event, key: 'Enter', target: input });
    expect(click).toHaveBeenCalledOnce();
  });
});
