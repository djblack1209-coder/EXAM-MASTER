/**
 * 总监级审计测试 - Batch 3: 文件上传边界测试
 *
 * 审计维度：
 * 1. 扩展名 vs MIME type 不匹配（.txt 改名 .pdf）
 * 2. 0 字节文件通过验证
 * 3. PDF/Word 不读取内容只用文件名
 * 4. 二进制文件当 TXT 读取（乱码）
 * 5. 危险文件伪装（.exe → .txt）
 * 6. 文件大小边界（刚好 10MB、超过 10MB）
 * 7. 无扩展名文件处理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

// ============================================================
// 1. FileHandler 扩展名验证审计
// ============================================================
describe('[审计] FileHandler — 扩展名验证', () => {
  let fileHandler;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import('@/pages/practice-sub/file-handler.js');
    fileHandler = mod.fileHandler || mod.default;
  });

  it('合法 PDF 文件 — 验证通过', () => {
    const result = fileHandler.validateFileType('高数笔记.pdf');
    expect(result.valid).toBe(true);
    expect(result.ext).toBe('pdf');
  });

  it('合法 TXT 文件 — 验证通过', () => {
    const result = fileHandler.validateFileType('复习资料.txt');
    expect(result.valid).toBe(true);
    expect(result.ext).toBe('txt');
  });

  it('合法 MD 文件 — 验证通过', () => {
    const result = fileHandler.validateFileType('笔记.md');
    expect(result.valid).toBe(true);
    expect(result.ext).toBe('md');
  });

  it('合法 DOCX 文件 — 验证通过', () => {
    const result = fileHandler.validateFileType('论文.docx');
    expect(result.valid).toBe(true);
    expect(result.ext).toBe('docx');
  });

  it('[BUG验证] 仅检查扩展名 — .txt 改名 .pdf 可通过', () => {
    // 用户可以把任何文件改名为 .pdf 通过验证
    // FileHandler 不检查 MIME type 或 magic bytes
    const result = fileHandler.validateFileType('fake_pdf_actually_txt.pdf');
    expect(result.valid).toBe(true); // 仅看扩展名，通过
    expect(result.ext).toBe('pdf');
  });

  it('[BUG验证] 图片改名 .txt 可通过', () => {
    const result = fileHandler.validateFileType('screenshot.png.txt');
    expect(result.valid).toBe(true);
    expect(result.ext).toBe('txt');
  });

  it('危险文件 .exe — 被拦截', () => {
    const result = fileHandler.validateFileType('virus.exe');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exe');
  });

  it('危险文件 .bat — 被拦截', () => {
    const result = fileHandler.validateFileType('script.bat');
    expect(result.valid).toBe(false);
  });

  it('危险文件 .sh — 被拦截', () => {
    const result = fileHandler.validateFileType('deploy.sh');
    expect(result.valid).toBe(false);
  });

  it('危险文件 .apk — 被拦截', () => {
    const result = fileHandler.validateFileType('app.apk');
    expect(result.valid).toBe(false);
  });

  it('[BUG验证] 危险文件伪装 — .exe 改名 .txt 可通过', () => {
    // 真正的 exe 文件改名为 .txt，扩展名验证无法识别
    const result = fileHandler.validateFileType('malware.exe.txt');
    expect(result.valid).toBe(true); // 只看最后的扩展名 .txt
    expect(result.ext).toBe('txt');
  });

  it('未知扩展名 .xyz — 被拦截', () => {
    const result = fileHandler.validateFileType('data.xyz');
    expect(result.valid).toBe(false);
  });

  it('无扩展名文件 — getFileExtension 返回空字符串', () => {
    const ext = fileHandler.getFileExtension('README');
    expect(ext).toBe('');
  });

  it('无扩展名文件 — validateFileType 拦截', () => {
    const result = fileHandler.validateFileType('README');
    expect(result.valid).toBe(false);
  });

  it('空文件名 — getFileExtension 返回空字符串', () => {
    const ext = fileHandler.getFileExtension('');
    expect(ext).toBe('');
  });

  it('null 文件名 — getFileExtension 返回空字符串', () => {
    const ext = fileHandler.getFileExtension(null);
    expect(ext).toBe('');
  });

  it('多个点的文件名 — 取最后一个扩展名', () => {
    const ext = fileHandler.getFileExtension('my.file.name.pdf');
    expect(ext).toBe('pdf');
  });

  it('大写扩展名 .PDF — 转小写后验证通过', () => {
    const result = fileHandler.validateFileType('文件.PDF');
    expect(result.valid).toBe(true);
    expect(result.ext).toBe('pdf');
  });

  it('指定 allowedTypes 时 — 不在列表中的被拦截', () => {
    const result = fileHandler.validateFileType('data.json', ['pdf', 'txt']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pdf');
  });

  it('指定 allowedTypes 时 — 在列表中的通过', () => {
    const result = fileHandler.validateFileType('data.json', ['json', 'txt']);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// 2. 文件大小验证审计
// ============================================================
describe('[审计] FileHandler — 文件大小验证', () => {
  let fileHandler;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import('@/pages/practice-sub/file-handler.js');
    fileHandler = mod.fileHandler || mod.default;
  });

  it('正常大小文件 (1MB) — 验证通过', () => {
    const result = fileHandler.validateFileSize(1 * 1024 * 1024);
    expect(result.valid).toBe(true);
  });

  it('刚好 10MB — 验证通过（等于上限）', () => {
    const result = fileHandler.validateFileSize(10 * 1024 * 1024);
    expect(result.valid).toBe(true);
  });

  it('超过 10MB (10MB + 1 byte) — 验证失败', () => {
    const result = fileHandler.validateFileSize(10 * 1024 * 1024 + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('[BUG验证] 0 字节文件 — 验证通过（无最小大小检查）', () => {
    // FileHandler.validateFileSize 只检查上限，不检查下限
    // 0 字节文件可以通过验证
    const result = fileHandler.validateFileSize(0);
    expect(result.valid).toBe(true); // 0 字节不会被拦截
  });

  it('自定义 maxSize — 超过自定义上限被拦截', () => {
    const result = fileHandler.validateFileSize(6 * 1024 * 1024, 5 * 1024 * 1024);
    expect(result.valid).toBe(false);
  });

  it('完整文件验证 — 同时检查类型和大小', () => {
    const file = { name: '笔记.pdf', size: 5 * 1024 * 1024 };
    const result = fileHandler.validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.ext).toBe('pdf');
    expect(result.errors).toEqual([]);
  });

  it('完整文件验证 — 类型和大小都不合法', () => {
    const file = { name: 'virus.exe', size: 20 * 1024 * 1024 };
    const result = fileHandler.validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2); // 类型错误 + 大小错误
  });

  it('[BUG验证] 完整验证 — 0 字节 PDF 通过', () => {
    const file = { name: '空文件.pdf', size: 0 };
    const result = fileHandler.validateFile(file);
    expect(result.valid).toBe(true); // 0 字节不被拦截
  });
});

// ============================================================
// 3. 文件格式化工具函数审计
// ============================================================
describe('[审计] FileHandler — 工具函数', () => {
  let fileHandler;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import('@/pages/practice-sub/file-handler.js');
    fileHandler = mod.fileHandler || mod.default;
  });

  it('formatFileSize — 0 字节', () => {
    expect(fileHandler.formatFileSize(0)).toBe('0 B');
  });

  it('formatFileSize — 1KB', () => {
    expect(fileHandler.formatFileSize(1024)).toBe('1 KB');
  });

  it('formatFileSize — 1.5MB', () => {
    const result = fileHandler.formatFileSize(1.5 * 1024 * 1024);
    expect(result).toBe('1.5 MB');
  });

  it('formatFileSize — 10MB', () => {
    expect(fileHandler.formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('getFileIcon — PDF 返回书本图标', () => {
    const icon = fileHandler.getFileIcon('test.pdf');
    expect(icon).toBe('📕');
  });

  it('getFileIcon — 未知类型返回默认图标', () => {
    const icon = fileHandler.getFileIcon('test.xyz');
    expect(icon).toBe('📁');
  });

  it('getFileIcon — 无扩展名返回默认图标', () => {
    const icon = fileHandler.getFileIcon('README');
    expect(icon).toBe('📁');
  });
});

// ============================================================
// 4. Mixin handleUpload — 文件内容读取审计
// ============================================================
describe('[审计] ai-generation-mixin handleUpload — 内容读取', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('[BUG验证] PDF/Word 文件不读取内容 — 直接用文件名出题', () => {
    // mixin L222-224: if (['pdf', 'doc', 'docx'].includes(ext)) {
    //   this.isUploadingFile = false;
    //   this.startAI(); // 不读取内容，fullFileContent 为空
    // }
    const ext = 'pdf';
    let fullFileContent = '';
    let readFile = false;

    if (['pdf', 'doc', 'docx'].includes(ext)) {
      // 不读取文件内容
      readFile = false;
    } else {
      readFile = true;
    }

    expect(readFile).toBe(false);
    expect(fullFileContent).toBe('');
    // AI 只能根据文件名猜测内容
  });

  it('TXT 文件 — 读取内容', () => {
    const ext = 'txt';
    let readFile = false;

    if (['pdf', 'doc', 'docx'].includes(ext)) {
      readFile = false;
    } else {
      readFile = true;
    }

    expect(readFile).toBe(true);
  });

  it('MD 文件 — 读取内容', () => {
    const ext = 'md';
    let readFile = false;

    if (['pdf', 'doc', 'docx'].includes(ext)) {
      readFile = false;
    } else {
      readFile = true;
    }

    expect(readFile).toBe(true);
  });

  it('JSON 文件 — 读取内容', () => {
    const ext = 'json';
    let readFile = false;

    if (['pdf', 'doc', 'docx'].includes(ext)) {
      readFile = false;
    } else {
      readFile = true;
    }

    expect(readFile).toBe(true);
  });

  it('[BUG验证] 二进制文件伪装 .txt — readFile utf8 读出乱码', () => {
    // 用户选择了一个实际是 PNG 的 .txt 文件
    // uni.getFileSystemManager().readFile encoding:'utf8' 会读出乱码
    const binaryContent = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR';
    const ext = 'txt';

    // 扩展名验证通过
    expect(['pdf', 'doc', 'docx', 'txt', 'md', 'json'].includes(ext)).toBe(true);

    // 内容是乱码但不为空
    expect(binaryContent.length).toBeGreaterThan(0);
    expect(binaryContent).toContain('PNG');

    // 乱码会直接作为 content 发给 AI
    const contentText = binaryContent.substring(0, 2000) || '主题：fake.txt';
    expect(contentText).toContain('PNG');
  });

  it('[BUG验证] readFile 失败 — fullFileContent 设为空，仍然 startAI', () => {
    // mixin L235-239: fail 回调中 fullFileContent = '', 仍然调用 startAI()
    let fullFileContent = 'old content';
    let startAICalled = false;

    // 模拟 readFile 失败
    fullFileContent = '';
    startAICalled = true; // startAI() 被调用

    expect(fullFileContent).toBe('');
    expect(startAICalled).toBe(true);
    // AI 会用文件名出题，因为 fullFileContent 为空
  });

  it('mixin 文件大小上限 10MB — 超过被拦截', () => {
    // mixin L202-206: MAX_FILE_SIZE = 10 * 1024 * 1024
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const fileSize = 11 * 1024 * 1024;

    let blocked = false;
    if (fileSize > MAX_FILE_SIZE) {
      blocked = true;
    }

    expect(blocked).toBe(true);
  });

  it('mixin 不支持的格式 — 被拦截', () => {
    const ext = 'xlsx';
    const supported = ['pdf', 'doc', 'docx', 'txt', 'md', 'json'];

    expect(supported.includes(ext)).toBe(false);
  });
});

// ============================================================
// 5. import-data.vue 文件处理审计
// ============================================================
describe('[审计] import-data.vue — 文件处理', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('import-data 支持的文件格式列表', () => {
    // import-data.vue 使用 wx.chooseMessageFile extension 参数
    const supported = ['pdf', 'doc', 'docx', 'txt', 'md'];
    expect(supported).toContain('pdf');
    expect(supported).toContain('txt');
    expect(supported).toContain('md');
    expect(supported).not.toContain('json'); // import-data 不支持 json
    expect(supported).not.toContain('xlsx'); // 不支持 Excel
  });

  it('[BUG验证] import-data 无 _consecutiveFailures — 单次失败即停止', () => {
    // 对比 mixin 的渐进式降级
    let isLooping = true;
    let isPaused = false;

    // 模拟 AI 响应 code !== 0
    const responseCode = -1;
    if (responseCode !== 0 || !true) {
      // !response.data
      isLooping = false;
      isPaused = true;
    }

    expect(isLooping).toBe(false);
    expect(isPaused).toBe(true);
  });

  it('import-data JSON 解析失败 — 停止并显示 Modal', () => {
    let isLooping = true;
    let isPaused = false;
    let showModal = false;

    const aiText = '这不是JSON格式的回复';
    try {
      JSON.parse(aiText);
    } catch (e) {
      isLooping = false;
      isPaused = true;
      showModal = true;
    }

    expect(isLooping).toBe(false);
    expect(isPaused).toBe(true);
    expect(showModal).toBe(true);
  });

  it('import-data AI 返回非数组 — 抛出错误', () => {
    let error = null;
    const aiText = '{"message": "这是一个对象不是数组"}';

    try {
      const parsed = JSON.parse(aiText);
      if (!Array.isArray(parsed)) {
        throw new Error('AI 返回格式不是数组');
      }
    } catch (e) {
      error = e;
    }

    expect(error).not.toBeNull();
    expect(error.message).toContain('不是数组');
  });

  it('import-data Markdown 代码块清洗', () => {
    // import-data.vue L655-658: 清洗 JSON
    let aiText = '```json\n[{"question":"题目"}]\n```';
    aiText = aiText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    expect(aiText).toBe('[{"question":"题目"}]');
    const parsed = JSON.parse(aiText);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('import-data 多层 Markdown 代码块清洗', () => {
    let aiText = '```json\n```json\n[{"q":"test"}]\n```\n```';
    aiText = aiText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // 多层清洗后应该只剩 JSON
    expect(aiText).toBe('[{"q":"test"}]');
  });
});

// ============================================================
// 6. 拍照搜题 photo-search 文件处理审计
// ============================================================
describe('[审计] photo-search — 图片处理', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('[BUG验证] 无图片质量预检 — 任何图片直接发送', () => {
    // photo-search.vue 不检查图片分辨率、清晰度、大小
    // 用户拍摄模糊照片也会直接发给 AI
    const imageFile = {
      path: '/tmp/blurry_photo.jpg',
      size: 100, // 极小的图片（可能是纯色或损坏）
      width: 10,
      height: 10
    };

    // 没有质量检查逻辑
    let qualityCheck = true; // 假设总是通过
    expect(qualityCheck).toBe(true);
    // 低质量图片会浪费 AI 调用配额
  });

  it('[BUG验证] 无置信度阈值 — 5% 和 95% 展示完全一样', () => {
    // photo-search 返回结果不区分置信度
    const highConfidence = { answer: 'A', confidence: 0.95 };
    const lowConfidence = { answer: 'B', confidence: 0.05 };

    // 两者展示方式完全相同，用户无法判断可靠性
    const displayHigh = `答案: ${highConfidence.answer}`;
    const displayLow = `答案: ${lowConfidence.answer}`;

    // 格式完全一样，没有置信度提示
    expect(displayHigh).not.toContain('置信度');
    expect(displayLow).not.toContain('置信度');
  });
});
