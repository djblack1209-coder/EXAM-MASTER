import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseBrowserLearningBackup, RECORD_FILE_LIMITS } from '../../src/services/learning/record-files.js';

function choose(options) {
  const promise = chooseBrowserLearningBackup(options);
  promise.catch(() => undefined);
  const picker = document.querySelector('input[type="file"]');
  return { promise, picker };
}
function select(picker, files) {
  Object.defineProperty(picker, 'files', { configurable: true, value: files });
  picker.dispatchEvent(new Event('change'));
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.querySelectorAll('input[type="file"]').forEach((input) => input.remove());
});

describe('browser learning backup file boundaries', () => {
  it('reads the complete selected UTF-8 file without interpreting or submitting its operations', async () => {
    const content = '{"原答":"19","正文":"中文😀é","events":[{"type":"material.delete"}]}';
    const phases = [];
    const request = choose({ onPhase: (phase) => phases.push(phase) });
    select(request.picker, [new File([content], '学习记录.JSON', { type: 'application/octet-stream' })]);
    expect(await request.promise).toBe(content);
    expect(phases).toEqual(['choosing', 'reading']);
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(uni.request).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'empty'])('system cancellation preserves data and releases the selection', async (kind) => {
    const request = choose();
    if (kind === 'cancel') request.picker.dispatchEvent(new Event('cancel'));
    else select(request.picker, []);
    expect(await request.promise).toBeNull();
    expect(request.picker.isConnected).toBe(false);
  });
  it.each([
    [[new File(['{}'], 'records.txt')], 'JSON'],
    [[new File([], 'records.json')], '为空'],
    [[{ name: 'records.json', size: RECORD_FILE_LIMITS.bytes + 1 }], '4800'],
    [[new File(['{}'], 'a.json'), new File(['{}'], 'b.json')], '一个']
  ])('rejects unsupported selections before reading', async (files, message) => {
    const read = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');
    const request = choose();
    select(request.picker, files);
    await expect(request.promise).rejects.toThrow(message);
    expect(read).not.toHaveBeenCalled();
    expect(request.picker.isConnected).toBe(false);
  });
  it('rejects malformed UTF-8 instead of silently replacing private text', async () => {
    const request = choose();
    select(request.picker, [new File([new Uint8Array([0x7b, 0xff, 0x7d])], 'invalid.json')]);
    await expect(request.promise).rejects.toMatchObject({ code: 'INVALID_ENCODING' });
    expect(request.picker.isConnected).toBe(false);
  });
  it('bounds decoded characters separately from the file byte guard', async () => {
    const request = choose();
    select(request.picker, [new File([' '.repeat(RECORD_FILE_LIMITS.characters) + 'x'], 'large.json')]);
    await expect(request.promise).rejects.toThrow('1200');
    expect(request.picker.isConnected).toBe(false);
  });
  it('does not open a picker without strict UTF-8 support', async () => {
    vi.stubGlobal('TextDecoder', undefined);
    await expect(chooseBrowserLearningBackup()).rejects.toThrow('继续粘贴');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
  it('aborts a live read and refuses its late load callback', async () => {
    const controller = new AbortController();
    let reader;
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function () {
      reader = this;
      Object.defineProperty(this, 'readyState', { configurable: true, value: 1 });
    });
    const stop = vi.spyOn(FileReader.prototype, 'abort').mockImplementation(() => undefined);
    const request = choose({ signal: controller.signal });
    select(request.picker, [new File(['{}'], 'records.json')]);
    const late = reader.onload;
    controller.abort();
    await expect(request.promise).rejects.toMatchObject({ code: 'CANCELLED' });
    late();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(reader.onload).toBeNull();
    expect(request.picker.isConnected).toBe(false);
  });
  it('checks ownership again before reading the selected file', async () => {
    let current = true;
    const read = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');
    const request = choose({ isCurrent: () => current });
    current = false;
    select(request.picker, [new File(['{}'], 'old-owner.json')]);
    await expect(request.promise).rejects.toMatchObject({ code: 'STALE_FILE' });
    expect(read).not.toHaveBeenCalled();
    expect(request.picker.isConnected).toBe(false);
  });
  it('does not accept late content after a lifecycle change or a partial read', async () => {
    let current = true,
      reader;
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function () {
      reader = this;
    });
    const request = choose({ isCurrent: () => current });
    select(request.picker, [new File(['{}'], 'records.json')]);
    current = false;
    reader.onload();
    await expect(request.promise).rejects.toMatchObject({ code: 'STALE_FILE' });
    const partial = choose();
    select(partial.picker, [new File(['{}'], 'records.json')]);
    Object.defineProperty(reader, 'result', { value: new Uint8Array([0x7b]).buffer });
    reader.onload();
    await expect(partial.promise).rejects.toThrow('读取不完整');
    expect(partial.picker.isConnected).toBe(false);
  });
  it('settles reader errors and picker failures without retained readers or inputs', async () => {
    let reader;
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function () {
      reader = this;
    });
    const request = choose();
    select(request.picker, [new File(['{}'], 'records.json')]);
    reader.onerror();
    await expect(request.promise).rejects.toMatchObject({ code: 'FILE_READ_FAILED' });
    expect(reader.onerror).toBeNull();
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {
      throw new Error('picker blocked');
    });
    await expect(chooseBrowserLearningBackup()).rejects.toThrow('picker blocked');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
