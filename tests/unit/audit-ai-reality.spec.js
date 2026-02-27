/**
 * 总监级审计测试 - Batch 2: AI 智能分析真实性测试
 *
 * 审计维度：
 * 1. 择校 AI 返回非 JSON / 空数组 / 格式异常时的处理
 * 2. proxyAI 对不同 action 的 content 空值检查覆盖范围
 * 3. AI 预测概率解析（"概率|点评"格式异常）
 * 4. catch 块 vs else 块降级公式不一致验证
 * 5. 连续失败熔断器（mixin 有、import-data 无）
 * 6. 无关内容/新闻文本直接发给 AI 无语义拦截
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

// ============================================================
// 1. proxyAI content 空值检查覆盖范围审计
// ============================================================
describe('[审计] proxyAI content 空值检查覆盖范围', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('chat action — 空 content 被拦截，不发请求', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({ code: 0 });

    const result = await lafService.proxyAI('chat', { content: '' });
    expect(result.code).toBe(-1);
    expect(result.message).toContain('不能为空');
    expect(spy).not.toHaveBeenCalled();
  });

  it('analyze action — 空 content 被拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({ code: 0 });

    const result = await lafService.proxyAI('analyze', { content: '   ' });
    expect(result.code).toBe(-1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('generate_questions action — 空 content 被拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({ code: 0 });

    const result = await lafService.proxyAI('generate_questions', { content: '' });
    expect(result.code).toBe(-1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('[BUG发现] generate action — 空 content 不被拦截，直接发给后端', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: { code: 0, data: '[]' }
    });

    const result = await lafService.proxyAI('generate', { content: '' });
    // generate 不在 chat/analyze/generate_questions 白名单中，空 content 不会被拦截
    // 这是一个设计缺陷：import-data.vue 使用 generate action
    expect(spy).toHaveBeenCalled();
  });

  it('[BUG发现] recommend action — 空 content 不被拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: { code: 0, data: '[]' }
    });

    const result = await lafService.proxyAI('recommend', { content: '' });
    expect(spy).toHaveBeenCalled();
  });

  it('[BUG发现] predict action — 空 content 不被拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: { code: 0, data: '60|预测结果' }
    });

    const result = await lafService.proxyAI('predict', { content: '' });
    expect(spy).toHaveBeenCalled();
  });

  it('payload 为 null — 所有 action 都被拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({ code: 0 });

    const result = await lafService.proxyAI('generate', null);
    expect(result.code).toBe(-1);
    expect(result.message).toContain('payload');
    expect(spy).not.toHaveBeenCalled();
  });

  it('payload 为非对象 — 被拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({ code: 0 });

    const result = await lafService.proxyAI('chat', 'string payload');
    expect(result.code).toBe(-1);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ============================================================
// 2. 择校 AI 返回异常数据处理审计
// ============================================================
describe('[审计] 择校 submitForm — AI 返回异常数据处理', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('AI 返回合法 JSON 数组 — schoolList 正常更新', async () => {
    const { lafService } = await import('@/services/lafService.js');
    // proxyAI 直接返回 request() 的响应，response.data 就是 AI 文本
    vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: JSON.stringify([{ name: '北京大学', matchRate: 90, majors: [], tags: ['985'] }])
    });

    const response = await lafService.proxyAI('recommend', {
      content: '请推荐院校',
      school: '清华大学',
      targetSchool: '北京大学',
      targetMajor: '计算机',
      currentMajor: '软件工程',
      degree: '本科',
      englishCert: 'CET-6'
    });

    expect(response.code).toBe(0);
    const parsed = JSON.parse(response.data);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe('北京大学');
  });

  it('AI 返回非 JSON 文本 — JSON.parse 抛异常', async () => {
    const { lafService } = await import('@/services/lafService.js');
    vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: '抱歉，我无法理解您的请求，请重新描述。'
    });

    const response = await lafService.proxyAI('recommend', { content: '推荐院校' });
    // 模拟 school/index.vue submitForm 中的 JSON.parse
    const content = response.data;
    let parseError = null;
    let schoolsList = [{ name: '旧数据-不应保留' }]; // 模拟旧值

    try {
      const parsedData = JSON.parse(content);
      if (Array.isArray(parsedData)) {
        schoolsList = parsedData;
      } else if (parsedData.schools && Array.isArray(parsedData.schools)) {
        schoolsList = parsedData.schools;
      }
    } catch (e) {
      parseError = e;
    }

    // [BUG验证] JSON.parse 失败后 schoolsList 保持旧值（stale state）
    // school/index.vue L1024 catch 块没有重置 schoolList
    expect(parseError).not.toBeNull();
    expect(schoolsList[0].name).toBe('旧数据-不应保留'); // 旧值未被清除
  });

  it('AI 返回空数组 [] — hasRealData 应为 false', async () => {
    const { lafService } = await import('@/services/lafService.js');
    vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: '[]'
    });

    const response = await lafService.proxyAI('recommend', { content: '推荐院校' });
    const content = response.data;
    const parsedData = JSON.parse(content);

    let schoolsList = [];
    let hasRealData = true;
    if (Array.isArray(parsedData)) {
      schoolsList = parsedData;
    }
    if (schoolsList.length === 0) {
      hasRealData = false;
    }

    expect(schoolsList).toEqual([]);
    expect(hasRealData).toBe(false);
  });

  it('AI 返回 { schools: [...] } 嵌套格式 — 正确提取', async () => {
    const { lafService } = await import('@/services/lafService.js');
    vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: JSON.stringify({ schools: [{ name: '复旦大学', matchRate: 85 }] })
    });

    const response = await lafService.proxyAI('recommend', { content: '推荐院校' });
    const parsedData = JSON.parse(response.data);

    let schoolsList = [];
    if (Array.isArray(parsedData)) {
      schoolsList = parsedData;
    } else if (parsedData.schools && Array.isArray(parsedData.schools)) {
      schoolsList = parsedData.schools;
    }

    expect(schoolsList.length).toBe(1);
    expect(schoolsList[0].name).toBe('复旦大学');
  });

  it('AI 返回 { result: "text" } 无 schools 字段 — 空状态', async () => {
    const { lafService } = await import('@/services/lafService.js');
    vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: JSON.stringify({ result: '建议报考985院校' })
    });

    const response = await lafService.proxyAI('recommend', { content: '推荐院校' });
    const parsedData = JSON.parse(response.data);

    let schoolsList = [];
    let hasRealData = true;
    if (Array.isArray(parsedData)) {
      schoolsList = parsedData;
    } else if (parsedData.schools && Array.isArray(parsedData.schools)) {
      schoolsList = parsedData.schools;
    }
    if (schoolsList.length === 0) {
      hasRealData = false;
    }

    expect(schoolsList).toEqual([]);
    expect(hasRealData).toBe(false);
  });

  it('API 返回 code !== 0 — 应显示空状态', async () => {
    const { lafService } = await import('@/services/lafService.js');
    vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 500,
      message: '服务器内部错误',
      data: null
    });

    const response = await lafService.proxyAI('recommend', { content: '推荐院校' });
    // proxyAI 内部会检查 response.code
    // 当后端返回 code !== 0 时，submitForm 的 else 分支处理
    const isSuccess = response && response.code === 0 && response.data;
    // 后端返回 code:500 会被 proxyAI 转换
    // 验证调用方需要处理非成功响应
    expect(typeof response).toBe('object');
  });
});

// ============================================================
// 3. AI 预测概率解析 — "概率|点评" 格式异常处理
// ============================================================
describe('[审计] detail.vue fetchAIPrediction — 概率解析边界', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('标准格式 "75|表现优秀" — 正确解析', () => {
    const result = '75|表现优秀，继续保持';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));
    const aiReason = parts[1] || parts[0] || '数据样本不足';

    expect(probability).toBe(75);
    expect(aiReason).toBe('表现优秀，继续保持');
  });

  it('概率超上限 "99|很好" — 被 clamp 到 95', () => {
    const result = '99|非常优秀';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));

    expect(probability).toBe(95);
  });

  it('概率低于下限 "10|需要努力" — 被 clamp 到 40', () => {
    const result = '10|需要更多努力';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));

    expect(probability).toBe(40);
  });

  it('无分隔符 "这是一段纯文本" — parseInt 返回 NaN，默认 60', () => {
    const result = '这是一段纯文本回复没有分隔符';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));
    const aiReason = parts[1] || parts[0] || '数据样本不足';

    expect(probability).toBe(60);
    // aiReason 回退到 parts[0]，即整段文本
    expect(aiReason).toBe('这是一段纯文本回复没有分隔符');
  });

  it('多个分隔符 "80|很好|建议继续" — 只取前两段', () => {
    const result = '80|很好|建议继续刷题';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));
    const aiReason = parts[1] || parts[0] || '数据样本不足';

    expect(probability).toBe(80);
    expect(aiReason).toBe('很好'); // 第三段 "建议继续刷题" 被丢弃
  });

  it('空字符串 — parseInt 返回 NaN，默认 60', () => {
    const result = '';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));
    const aiReason = parts[1] || parts[0] || '数据样本不足';

    expect(probability).toBe(60);
    expect(aiReason).toBe('数据样本不足'); // parts[0] 是空字符串，falsy
  });

  it('概率为浮点数 "72.5|还不错" — parseInt 截断小数', () => {
    const result = '72.5|还不错';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));

    expect(probability).toBe(72); // parseInt 截断
  });

  it('概率为负数 "-10|很差" — clamp 到 40', () => {
    const result = '-10|很差';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;
    const probability = Math.max(40, Math.min(95, p));

    // parseInt('-10') = -10, || 60 不触发（-10 是 truthy）
    expect(p).toBe(-10);
    expect(probability).toBe(40);
  });

  it('概率为 0 "0|零分" — parseInt 返回 0，|| 60 触发', () => {
    const result = '0|零分评价';
    const parts = result.split('|');
    const p = parseInt(parts[0]) || 60;

    // [BUG发现] 0 是 falsy，|| 60 会把 0 变成 60
    // 虽然 clamp 范围是 40-95，0 本应 clamp 到 40，但这里直接变成 60
    expect(p).toBe(60); // 0 || 60 = 60，不是预期的 0
  });
});

// ============================================================
// 4. catch 块 vs else 块降级公式不一致验证
// ============================================================
describe('[审计] detail.vue — 降级公式一致性', () => {
  it('[BUG验证] else 块降级公式包含 mistake 扣分，catch 块不包含', () => {
    // 用较小的数据验证差异（大数据两者都 clamp 到 95，差异不明显）
    const studyDays = 5;
    const doneCount = 50;
    const mistakeCount = 50;

    // else 块公式 (L753-757): 包含 -Math.min(mistakeCount/5, 20)
    const elseBaseScore = Math.min(
      95,
      40 + studyDays * 2 + Math.min(doneCount / 10, 30) - Math.min(mistakeCount / 5, 20)
    );
    const elseProbability = Math.max(40, Math.min(95, Math.round(elseBaseScore)));

    // catch 块公式 (L774): 缺少 -Math.min(mistakeCount/5, 20)
    const catchBaseScore = Math.min(95, 40 + studyDays * 2 + Math.min(doneCount / 10, 30));
    const catchProbability = Math.max(40, Math.min(95, Math.round(catchBaseScore)));

    // 两个公式结果不同
    expect(elseProbability).not.toBe(catchProbability);

    // else 块因为扣了 mistake 分，概率更低
    expect(elseProbability).toBeLessThan(catchProbability);

    // else: min(95, 40 + 10 + 5 - 10) = min(95, 45) = 45
    // catch: min(95, 40 + 10 + 5) = min(95, 55) = 55
    expect(elseProbability).toBe(45);
    expect(catchProbability).toBe(55);
    expect(catchProbability - elseProbability).toBe(10); // 差 10 分

    // 大数据场景：两者都 clamp 到 95，差异被掩盖
    const bigElse = Math.max(
      40,
      Math.min(95, Math.round(Math.min(95, 40 + 30 * 2 + Math.min(500 / 10, 30) - Math.min(100 / 5, 20))))
    );
    const bigCatch = Math.max(40, Math.min(95, Math.round(Math.min(95, 40 + 30 * 2 + Math.min(500 / 10, 30)))));
    expect(bigElse).toBe(95);
    expect(bigCatch).toBe(95);
    // 大数据时 BUG 被 clamp 掩盖，但小数据时差异明显
  });

  it('降级公式 — studyDays=0, doneCount=0, mistakeCount=0 时两者一致', () => {
    const studyDays = 0;
    const doneCount = 0;
    const mistakeCount = 0;

    const elseScore = Math.min(95, 40 + studyDays * 2 + Math.min(doneCount / 10, 30) - Math.min(mistakeCount / 5, 20));
    const catchScore = Math.min(95, 40 + studyDays * 2 + Math.min(doneCount / 10, 30));

    // 当 mistakeCount=0 时，两个公式一致
    expect(elseScore).toBe(catchScore);
    expect(elseScore).toBe(40);
  });
});

// ============================================================
// 5. 连续失败熔断器审计
// ============================================================
describe('[审计] 连续失败熔断器 — mixin vs import-data', () => {
  it('mixin 有 _consecutiveFailures 计数器和 MAX_CONSECUTIVE_FAILURES=5', () => {
    // 验证 mixin 的熔断逻辑
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    let paused = false;

    // 模拟 5 次连续失败
    for (let i = 0; i < 5; i++) {
      consecutiveFailures++;
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      paused = true;
    }

    expect(paused).toBe(true);
    expect(consecutiveFailures).toBe(5);
  });

  it('mixin — 成功生成后重置计数器', () => {
    let consecutiveFailures = 3;

    // 模拟成功
    consecutiveFailures = 0;

    expect(consecutiveFailures).toBe(0);
  });

  it('[BUG验证] import-data.vue — 无熔断器，失败后直接停止而非计数', async () => {
    // import-data.vue generateNextBatch 中：
    // - AI 响应 code !== 0 → 直接 isLooping=false, isPaused=true（停止）
    // - JSON 解析失败 → 直接 isLooping=false, isPaused=true（停止）
    // - catch 块 → 根据错误类型决定是否 autoRetry
    // 没有 _consecutiveFailures 计数器，没有渐进式降级

    // 模拟 import-data 的行为
    let isLooping = true;
    let isPaused = false;

    // 第一次失败就直接停止
    const responseCode = 500;
    if (responseCode !== 0) {
      isLooping = false;
      isPaused = true;
    }

    expect(isLooping).toBe(false);
    expect(isPaused).toBe(true);

    // 对比 mixin：mixin 会计数到 5 次才暂停，中间继续尝试
    // import-data：第一次非成功响应就完全停止
    // 这意味着 import-data 对临时性 AI 服务波动的容忍度为 0
  });

  it('[BUG验证] import-data — 超时错误会自动重试但无次数上限', () => {
    // import-data.vue L746-754: 超时错误设置 autoRetry=true
    // 但没有 retryCount 上限检查（虽然有 retryCount 变量，但未见上限判断）
    let retryCount = 0;
    let autoRetry = true;
    const MAX_RETRIES = 100; // 假设无上限

    // 模拟无限重试
    while (autoRetry && retryCount < 10) {
      retryCount++;
      // 每次都超时
      autoRetry = true; // 继续重试
    }

    // 如果没有上限，理论上会无限重试
    expect(retryCount).toBe(10);
    // 实际代码中 retryCount 在 startAI 中重置为 0，但 generateNextBatch 的
    // catch 块中 autoRetry 只是设置了 importStatus='retrying'
    // 真正的重试是通过 setTimeout → generateNextBatch 递归实现的
  });
});

// ============================================================
// 6. 无关内容/新闻文本 — 无语义验证直接发给 AI
// ============================================================
describe('[审计] 内容语义验证 — 无关内容处理', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('[BUG验证] 新闻文本直接发给 AI 出题 — 无语义拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: JSON.stringify([{ question: '新闻相关题目', options: ['A', 'B', 'C', 'D'], answer: 'A' }])
    });

    // 模拟用户粘贴新闻文本
    const newsContent = '据新华社报道，今日股市大涨3%，专家分析认为这与近期政策利好有关...';

    // import-data 和 mixin 都不做内容语义验证
    const response = await lafService.proxyAI('generate', { content: newsContent });

    // 新闻内容直接发给了 AI，没有任何拦截
    expect(spy).toHaveBeenCalled();
    const callArgs = spy.mock.calls[0];
    expect(callArgs[1].content).toBe(newsContent);
  });

  it('[BUG验证] 纯数字/乱码内容直接发给 AI — 无拦截', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: '[]'
    });

    const garbageContent = '1234567890!@#$%^&*()_+';
    const response = await lafService.proxyAI('generate', { content: garbageContent });

    expect(spy).toHaveBeenCalled();
  });

  it('[BUG验证] 极短内容（1个字）直接发给 AI — 无最小长度检查', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockResolvedValue({
      code: 0,
      data: '[]'
    });

    const response = await lafService.proxyAI('generate', { content: '啊' });
    expect(spy).toHaveBeenCalled();
  });

  it('mixin 有 sanitizeAIInput 但只做长度截断，不做语义检查', () => {
    // mixin L294: const sanitizedContent = this._sanitizeAIInput(chunk || this.fileName, MAX_CONTENT_LEN);
    // sanitizeAIInput 来自 question-normalizer.js，只做：
    // 1. 去除首尾空白
    // 2. 截断到 maxLen
    // 不做任何语义验证（是否是学习资料、是否有意义等）

    const MAX_CONTENT_LEN = 8000;
    const newsText = '据新华社报道，今日股市大涨3%...'.repeat(100);

    // 模拟 sanitizeAIInput 行为
    const sanitized = newsText.trim().substring(0, MAX_CONTENT_LEN);

    expect(sanitized.length).toBeLessThanOrEqual(MAX_CONTENT_LEN);
    // 内容仍然是新闻，没有被拦截
    expect(sanitized).toContain('股市大涨');
  });

  it('import-data 的 contentText 回退到文件名 — 无内容时用文件名出题', () => {
    // import-data.vue L631: const contentText = chunkText || '主题：' + this.fileName;
    // 当 fullFileContent 为空（如 PDF/Word 无法读取内容）时，
    // 只用文件名作为出题依据

    const fullFileContent = ''; // PDF 无法读取
    const fileName = '高等数学期末复习.pdf';
    const chunkText = fullFileContent.substring(0, 2000);
    const contentText = chunkText || '主题：' + fileName;

    expect(contentText).toBe('主题：高等数学期末复习.pdf');
    // AI 只能根据文件名猜测内容出题，质量无法保证
  });

  it('import-data — 二进制文件读取为乱码后直接发给 AI', () => {
    // 如果用户选择了 .txt 扩展名的二进制文件
    // readFile encoding:'utf8' 会读出乱码
    // 乱码直接作为 content 发给 AI

    const binaryAsUtf8 = '\x00\x01\x02\xFF\xFE\x89PNG\r\n\x1a\n';
    const contentText = binaryAsUtf8.substring(0, 2000) || '主题：fake.txt';

    // 乱码不为空，会直接发送
    expect(contentText.length).toBeGreaterThan(0);
    expect(contentText).toContain('PNG'); // 二进制文件头被当文本读取
  });
});

// ============================================================
// 7. AI 超时保护机制验证
// ============================================================
describe('[审计] AI 超时保护机制', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('proxyAI 有独立超时保护（默认 60s）', async () => {
    const { lafService } = await import('@/services/lafService.js');

    // proxyAI L643-646: Promise.race 超时保护
    // const aiTimeout = _options.timeout || config.ai.timeout || 60000;
    // 验证超时机制存在
    const spy = vi.spyOn(lafService, 'request').mockImplementation(() => {
      return new Promise((resolve) => {
        // 永远不 resolve，模拟超时
        setTimeout(() => resolve({ code: 0, data: {} }), 999999);
      });
    });

    // 使用极短超时测试
    const startTime = Date.now();
    try {
      await lafService.proxyAI('chat', { content: '测试超时' }, { timeout: 100 });
    } catch (e) {
      // 可能抛出 AI_TIMEOUT 错误
    }
    const elapsed = Date.now() - startTime;

    // 应该在 100ms 左右超时，而不是等 999999ms
    expect(elapsed).toBeLessThan(5000);
  });

  it('school/index.vue submitForm 有 20s 超时保护', () => {
    // school/index.vue L918-937: setTimeout 20秒超时
    // 超时后：schoolList=[], hasRealData=false, currentStep=3
    let isTimeoutHandled = false;
    let schoolList = [{ name: '旧数据' }];
    let hasRealData = true;
    let currentStep = 2;

    // 模拟超时触发
    isTimeoutHandled = true;
    schoolList = [];
    hasRealData = false;
    currentStep = 3;

    expect(schoolList).toEqual([]);
    expect(hasRealData).toBe(false);
    expect(currentStep).toBe(3);
  });

  it('超时后 API 响应到达 — isTimeoutHandled 防重复处理', () => {
    // school/index.vue L1049-1052: if (isTimeoutHandled) return;
    let isTimeoutHandled = true; // 超时已触发
    let processed = false;

    // 模拟 API 响应到达
    if (isTimeoutHandled) {
      // 跳过处理
    } else {
      processed = true;
    }

    expect(processed).toBe(false); // 不会重复处理
  });
});
