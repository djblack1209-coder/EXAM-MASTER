import { describe, expect, it, vi } from 'vitest';
import { receiveDesktopModelIntake } from '@/services/desktop/windows.js';

function context(route = 'pages/learning/index') {
  return {
    owner: vi.fn().mockReturnValue('student'),
    currentRoute: () => route,
    navigate: vi.fn().mockResolvedValue(undefined),
    learning: {
      loadModels: vi.fn().mockResolvedValue({ success: true }),
      refresh: vi.fn(),
      beginModelIntake: vi.fn().mockResolvedValue({ success: true }),
      modelId: ''
    }
  };
}
const intent = { owner: 'student', modelId: 'free-model' };
describe('native model intake handoff', () => {
  it('keeps the current conversation page alive so onHide cannot cancel its new read', async () => {
    const target = context();
    target.learning.streamSupported = true;
    await receiveDesktopModelIntake(intent, target);
    expect(target.navigate).not.toHaveBeenCalled();
    expect(target.learning.beginModelIntake).toHaveBeenCalledExactlyOnceWith('free-model');
    expect(target.learning.modelId).toBe('free-model');
    expect(target.learning.streamEnabled).toBe(true);
  });
  it('refreshes the catalog and rejects failed or stale selection without changing the model', async () => {
    const target = context();
    target.learning.loadModels.mockResolvedValue({ success: false });
    expect(await receiveDesktopModelIntake(intent, target)).toEqual({ success: false });
    expect(target.learning.modelId).toBe('');
    target.learning.loadModels.mockImplementation(async () => {
      target.owner.mockReturnValue('other');
      return { success: true };
    });
    expect(await receiveDesktopModelIntake(intent, target)).toBeNull();
    expect(target.learning.modelId).toBe('');
  });
  it('waits for a different page to leave before starting the model', async () => {
    const target = context('pages/archive/index');
    let finish;
    target.navigate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const pending = receiveDesktopModelIntake(intent, target);
    expect(target.learning.beginModelIntake).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(target.learning.beginModelIntake).toHaveBeenCalledOnce();
  });
  it('rejects a stale account handoff before and after navigation', async () => {
    const target = context('pages/archive/index');
    target.owner.mockReturnValue('another-student');
    await receiveDesktopModelIntake(intent, target);
    expect(target.navigate).not.toHaveBeenCalled();
    target.owner.mockReturnValue('student');
    target.navigate.mockImplementation(async () => {
      target.owner.mockReturnValue('another-student');
    });
    await receiveDesktopModelIntake(intent, target);
    expect(target.learning.beginModelIntake).not.toHaveBeenCalled();
    expect(target.learning.modelId).toBe('');
  });
});
