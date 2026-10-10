// 与桌面备份选择器一致的物理容量；逻辑恢复仍由现有 repository 校验。
export const RECORD_FILE_LIMITS = Object.freeze({ bytes: 48000000, characters: 12000000 });

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

// 只读取用户本次选择的文件，不上传、不解析操作，也不授予恢复权限。
export function chooseBrowserLearningBackup({ isCurrent = () => true, signal, onPhase = () => undefined } = {}) {
  return new Promise((resolve, reject) => {
    let picker = null,
      reader = null,
      settled = false,
      selected = false;
    const current = () => {
      if (signal?.aborted) throw failure('CANCELLED', '已取消选择或读取备份');
      if (!isCurrent()) throw failure('STALE_FILE', '账户、页面或备份输入已变化，请重新选择文件');
    };
    const finish = (error, content = null) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      if (picker) {
        picker.onchange = null;
        picker.oncancel = null;
        picker.remove();
      }
      if (reader) {
        reader.onload = null;
        reader.onerror = null;
        reader.onabort = null;
        if (reader.readyState === 1) reader.abort();
      }
      if (error) reject(error);
      else resolve(content);
    };
    const abort = () => finish(failure('CANCELLED', '已取消选择或读取备份'));
    try {
      current();
      if (typeof document === 'undefined' || !document.body || typeof FileReader !== 'function')
        throw failure('PLATFORM_UNSUPPORTED', '当前浏览器无法选择备份文件，请继续粘贴 JSON 备份');
      if (typeof TextDecoder !== 'function' || new TextDecoder('utf-8', { fatal: true }).fatal !== true)
        throw failure('PLATFORM_UNSUPPORTED', '当前浏览器无法严格读取 UTF-8，请继续粘贴 JSON 备份');
      picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = '.json,application/json';
      picker.hidden = true;
      picker.oncancel = () => {
        if (!selected) finish(null);
      };
      picker.onchange = () => {
        if (selected || settled) return;
        selected = true;
        try {
          current();
          if (!picker.files?.length) return finish(null);
          const file = picker.files[0];
          if (picker.files.length !== 1 || !/\.json$/i.test(file.name))
            throw failure('INVALID_FILE', '请选择一个 JSON 学习记录备份，原输入和记录保留');
          if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > RECORD_FILE_LIMITS.bytes)
            throw failure('RESOURCE_LIMIT', '备份文件为空或超过 4800 万字节，原输入和记录保留');
          reader = new FileReader();
          reader.onerror = () => finish(failure('FILE_READ_FAILED', '无法读取备份文件，请重新选择；原输入和记录保留'));
          reader.onabort = abort;
          reader.onload = () => {
            try {
              current();
              const bytes = reader.result;
              if (Object.prototype.toString.call(bytes) !== '[object ArrayBuffer]' || bytes.byteLength !== file.size)
                throw failure('FILE_READ_FAILED', '备份文件读取不完整，原输入和记录保留');
              let content;
              try {
                content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
              } catch {
                throw failure('INVALID_ENCODING', '备份文件不是有效 UTF-8 文本，原输入和记录保留');
              }
              if (!content.trim() || content.length > RECORD_FILE_LIMITS.characters)
                throw failure('RESOURCE_LIMIT', '备份为空或超过 1200 万字符，原输入和记录保留');
              current();
              finish(null, content);
            } catch (error) {
              finish(error);
            }
          };
          onPhase('reading');
          current();
          reader.readAsArrayBuffer(file);
        } catch (error) {
          finish(error);
        }
      };
      signal?.addEventListener('abort', abort, { once: true });
      document.body.appendChild(picker);
      onPhase('choosing');
      current();
      picker.click();
    } catch (error) {
      finish(error);
    }
  });
}
